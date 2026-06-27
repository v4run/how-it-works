// Drives the launched flow: a requestAnimationFrame clock animates the packet
// along its path (with a flood/ARP phase first where relevant), streams the
// plan's steps into an event log as it passes them, and — in flood-and-learn
// mode — commits the data-plane MAC learning once the flow completes.

import React from 'react';
import { LabState } from './model';
import { FlowPlan, MacEntry, planFlow, macKeyOf } from './net';

export type Level = 'info' | 'ok' | 'warn' | 'err';
export interface LogEntry {
  id: number;
  t: number; // sim seconds since the flow launched
  node: string;
  level: Level;
  msg: string;
}

export type Phase = 'idle' | 'flood' | 'unicast' | 'blocked' | 'done';

export interface FlowAnim {
  plan: FlowPlan;
  phase: Phase;
  floodProgress: number; // 0..1 (ARP/BUM replication)
  packetProgress: number; // 0..1 along plan.pathNodes
  segIdx: number; // current path segment index
  encapsulated: boolean;
  blocked: boolean;
}

export interface SimSnapshot {
  flow: FlowAnim | null;
  events: LogEntry[];
  learned: MacEntry[];
}

const levelOf = (k: FlowPlan['steps'][number]['kind']): Level => k;

export function useSimulation(state: LabState): SimSnapshot {
  const [snap, setSnap] = React.useState<SimSnapshot>({ flow: null, events: [], learned: [] });

  // Persisted across renders.
  const learnedRef = React.useRef<MacEntry[]>([]);
  const eventsRef = React.useRef<LogEntry[]>([]);
  const evIdRef = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);
  const stateRef = React.useRef(state);
  stateRef.current = state;

  // Reset learned MACs when the control plane changes (a fresh table to fill).
  React.useEffect(() => {
    learnedRef.current = [];
  }, [state.ctrlPlane]);

  // Reset everything on a full reset (flowNonce goes back to 0).
  React.useEffect(() => {
    if (state.flowNonce === 0) {
      learnedRef.current = [];
      eventsRef.current = [];
      setSnap({ flow: null, events: [], learned: [] });
    }
  }, [state.flowNonce]);

  // Launch a flow whenever flowNonce increments.
  React.useEffect(() => {
    if (state.flowNonce === 0) return;
    const s = stateRef.current;
    const learnedKeys = new Set(learnedRef.current.map((e) => macKeyOf(e.leafIdx, e.mac)));
    const plan = planFlow(s, learnedKeys);
    if (!plan) return;

    // Timeline windows (seconds).
    const hasFlood = plan.outcome === 'delivered' && (plan.arpMode === 'bum-flood' || plan.arpMode === 'imet-flood');
    const floodDur = hasFlood ? 1.2 : 0;
    const moveDur = plan.outcome === 'isolated' || plan.outcome === 'invalid' ? 1.3 : plan.crossesFabric ? 2.8 : 1.8;
    const total = floodDur + moveDur;

    // Schedule step → log times across the timeline.
    const steps = plan.steps;
    const stepTimes = steps.map((_, i) => {
      const frac = steps.length <= 1 ? 0.2 : 0.06 + (0.9 * i) / (steps.length - 1);
      return frac * total;
    });

    // New flow: start a fresh log section with a header.
    const header: LogEntry = {
      id: evIdRef.current++,
      t: 0,
      node: plan.src.name,
      level: plan.outcome === 'delivered' ? 'ok' : plan.outcome === 'isolated' ? 'err' : 'info',
      msg:
        plan.outcome === 'invalid'
          ? 'pick a destination host'
          : `▸ ${plan.src.name} → ${plan.dst?.name}  ·  ${plan.segment ? 'VNI ' + plan.segment.vni : 'cross-VNI'}  ·  ${s.ctrlPlane === 'evpn' ? 'BGP EVPN' : 'flood-and-learn'}`,
    };
    eventsRef.current = [...eventsRef.current, header].slice(-60);

    const logged = new Set<number>();
    const start = performance.now();
    let committed = false;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const el = (now - start) / 1000;
      const p = Math.min(1, el / total);

      // Reveal steps as the clock passes them.
      for (let i = 0; i < steps.length; i++) {
        if (!logged.has(i) && el >= stepTimes[i]) {
          logged.add(i);
          eventsRef.current = [
            ...eventsRef.current,
            { id: evIdRef.current++, t: +el.toFixed(1), node: nodeFor(plan, steps[i].key), level: levelOf(steps[i].kind), msg: steps[i].title + ' — ' + steps[i].detail },
          ].slice(-60);
        }
      }

      // Phase + packet position.
      let phase: Phase;
      let floodProgress = 0;
      let packetProgress = 0;
      if (hasFlood && el < floodDur) {
        phase = 'flood';
        floodProgress = Math.min(1, el / floodDur);
      } else {
        floodProgress = hasFlood ? 1 : 0;
        const me = Math.max(0, el - floodDur);
        packetProgress = Math.min(1, me / moveDur);
        if (plan.outcome === 'isolated' || plan.outcome === 'invalid') {
          phase = packetProgress >= 1 ? 'blocked' : 'unicast';
        } else {
          phase = packetProgress >= 1 ? 'done' : 'unicast';
        }
      }

      const nSeg = Math.max(1, plan.pathNodes.length - 1);
      const segIdx = Math.min(nSeg - 1, Math.floor(packetProgress * nSeg));
      const encapsulated = !plan.intraLeaf && plan.outcome === 'delivered' && segIdx >= 1 && segIdx <= nSeg - 2;
      const blocked = (plan.outcome === 'isolated' || plan.outcome === 'invalid') && phase === 'blocked';

      // Commit flood-mode learning at the end.
      if (p >= 1 && !committed) {
        committed = true;
        if (plan.learns.length) {
          const have = new Set(learnedRef.current.map((e) => macKeyOf(e.leafIdx, e.mac)));
          const add = plan.learns.filter((e) => !have.has(macKeyOf(e.leafIdx, e.mac)));
          if (add.length) learnedRef.current = [...learnedRef.current, ...add];
        }
      }

      setSnap({
        flow: { plan, phase, floodProgress, packetProgress, segIdx, encapsulated, blocked },
        events: eventsRef.current,
        learned: learnedRef.current,
      });

      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.flowNonce]);

  return snap;
}

function nodeFor(plan: FlowPlan, key: string): string {
  if (key === 'decap' || key === 'deliver') return `Leaf-${plan.egressLeaf + 1}`;
  return `Leaf-${plan.ingressLeaf + 1}`;
}
