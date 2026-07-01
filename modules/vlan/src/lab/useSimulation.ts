// Drives the lab: a free-running rAF clock for the frame animation, plus
// per-action narration. On "send" it runs the frame-walk planner and streams an
// event-log line for each hop (with the tag state), then the outcome; config
// changes log a line and clear any stale drawn path.
import React from 'react';
import { LabState, Walk, planWalk, hostById, Dst } from './model';

export type Level = 'info' | 'ok' | 'warn' | 'err' | 'tag';
export interface LogEntry {
  id: number;
  node: string;
  level: Level;
  msg: string;
}
export interface FlowState {
  walk: Walk;
  progress: number; // 0..1 across all segments
}
export interface SimSnapshot {
  clock: number;
  events: LogEntry[];
  flow: FlowState | null;
}

const nodeName = (key: string): string => {
  if (key === 'A') return 'SW-A';
  if (key === 'B') return 'SW-B';
  if (key === 'GW') return 'gateway';
  if (key.startsWith('host:')) return hostById(key.slice(5)).name;
  return key;
};

interface Scenario {
  start: number;
  total: number;
  steps: Array<{ at: number; node: string; level: Level; msg: string }>;
  walk?: Walk;
}

export function useSimulation(state: LabState): SimSnapshot {
  const [snap, setSnap] = React.useState<SimSnapshot>({ clock: 0, events: [], flow: null });
  const eventsRef = React.useRef<LogEntry[]>([]);
  const evId = React.useRef(0);
  const clockRef = React.useRef(0);
  const scRef = React.useRef<Scenario | null>(null);
  const loggedRef = React.useRef<Set<number>>(new Set());
  const rafRef = React.useRef<number | null>(null);
  const lastRef = React.useRef<number | null>(null);
  const stateRef = React.useRef(state);
  stateRef.current = state;

  React.useEffect(() => {
    const a = state.action;
    if (!a) return;
    if (a.type === 'preset') eventsRef.current = [];
    if (a.type === 'config') {
      const e: LogEntry = { id: evId.current++, node: 'config', level: 'info', msg: a.msg };
      eventsRef.current = [...eventsRef.current, e].slice(-60);
      scRef.current = null; // clear stale path when the config changes
      return;
    }
    if (a.type === 'preset') {
      const e: LogEntry = { id: evId.current++, node: 'config', level: 'info', msg: `loaded · ${a.label}` };
      eventsRef.current = [e];
      scRef.current = null;
      return;
    }
    // send
    const sc = buildSend(stateRef.current, a.src, a.dst);
    scRef.current = { ...sc, start: clockRef.current };
    loggedRef.current = new Set();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.action?.id]);

  React.useEffect(() => {
    const tick = (now: number) => {
      const last = lastRef.current ?? now;
      lastRef.current = now;
      clockRef.current += Math.min(0.05, (now - last) / 1000);
      const sc = scRef.current;
      let flow: FlowState | null = null;
      if (sc) {
        const el = clockRef.current - sc.start;
        for (let i = 0; i < sc.steps.length; i++) {
          if (!loggedRef.current.has(i) && el >= sc.steps[i].at) {
            loggedRef.current.add(i);
            const s = sc.steps[i];
            eventsRef.current = [...eventsRef.current, { id: evId.current++, node: s.node, level: s.level, msg: s.msg }].slice(-60);
          }
        }
        if (sc.walk) flow = { walk: sc.walk, progress: Math.max(0, Math.min(1, el / sc.total)) };
      }
      setSnap({ clock: clockRef.current, events: eventsRef.current, flow });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return snap;
}

function segLabel(seg: Walk['segs'][number]): { node: string; level: Level; msg: string } {
  const from = nodeName(seg.from);
  const to = nodeName(seg.to);
  if (seg.kind === 'access') {
    return { node: to.startsWith('SW') ? from : to, level: 'info', msg: `${from} → ${to} · untagged frame (access port)` };
  }
  if (seg.kind === 'trunk') {
    return seg.tagged
      ? { node: `${from}→${to}`, level: 'tag', msg: `trunk ${from} → ${to} · 802.1Q-TAGGED VLAN ${seg.vlan}` }
      : { node: `${from}→${to}`, level: 'warn', msg: `trunk ${from} → ${to} · UNTAGGED (native VLAN ${seg.vlan})` };
  }
  // gwlink
  return { node: 'gateway', level: 'tag', msg: `${from} → ${to} · tagged VLAN ${seg.vlan}` };
}

function buildSend(state: LabState, srcId: string, dst: Dst): Omit<Scenario, 'start'> {
  const walk = planWalk(state, srcId, dst);
  const src = hostById(srcId);
  const isB = dst === 'broadcast';
  const total = Math.max(1.6, 0.5 + walk.segs.length * 0.72 + 0.5);
  const steps: Scenario['steps'] = [];
  const header = isB ? `${src.name} broadcasts (VLAN ${walk.srcVlan}) — "who has …?"` : `${src.name} → ${hostById(dst).name}`;
  steps.push({ at: 0, node: src.name, level: 'info', msg: header });

  // reveal each segment as the packet passes it
  const n = Math.max(1, walk.segs.length);
  walk.segs.forEach((seg, i) => {
    const lab = segLabel(seg);
    steps.push({ at: 0.4 + ((i + 1) / n) * (total - 1.0), ...lab });
  });

  const outNode = walk.outcome === 'delivered' ? '✓' : walk.outcome === 'leak' ? '⚠' : '✕';
  const level: Level = walk.outcome === 'delivered' ? 'ok' : walk.outcome === 'leak' ? 'warn' : 'err';
  steps.push({ at: total - 0.3, node: outNode, level, msg: `${walk.reason} — ${walk.detail}` });

  return { total, steps, walk };
}
