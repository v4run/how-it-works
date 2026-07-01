// Drives the lab's live behaviour. Two things happen here:
//
//   1. A free-running requestAnimationFrame clock (`clock`) that the viz uses to
//      animate traffic dots flowing along the wire.
//   2. Per-action *narration*: whenever the user does something (sends traffic,
//      kills a node, adds a Service, switches mode…), we build a short timeline
//      of event-log lines and a convergence banner that plays out over a few
//      seconds — the same story the explainer film tells, but reacting to the
//      cluster state you actually built.
import React from 'react';
import {
  LabState,
  NodeT,
  assignedIp,
  activeNodesOf,
  leaderOf,
  advertisersOf,
  eligibleNodes,
  selectedService,
  backendNodeIds,
  CLIENT_IP,
} from './model';

export type Level = 'info' | 'ok' | 'warn' | 'err' | 'ctrl';
export interface LogEntry {
  id: number;
  t: number; // seconds since this action began
  node: string;
  level: Level;
  msg: string;
}

export type TransKind = 'l2-down' | 'bgp-down' | 'recover' | 'traffic' | 'alloc' | 'mode' | null;
export interface Transition {
  kind: TransKind;
  label: string;
  sub: string;
  tone: Level;
  progress: number; // 0..1 over the whole scenario
  blackhole: boolean; // service is currently unreachable mid-failover
}

// A single in-flight request, fired by "Send client traffic". Travels the wire
// once to one node (the L2 leader, or — in BGP — the node this flow hashes to).
export interface PacketFlight {
  progress: number; // 0..1 along the path
  nodeId: string; // ingress node it lands on (L2 leader / BGP next-hop)
  podNodeId: string; // node whose backend pod kube-proxy forwards to (may differ → extra hop)
  snat: boolean; // Cluster policy → source IP masqueraded to the node IP
  podSrc: string; // the source IP the backend pod actually sees
}

export interface SimSnapshot {
  clock: number;
  events: LogEntry[];
  transition: Transition | null;
  packet: PacketFlight | null;
}

interface Step {
  at: number;
  node: string;
  level: Level;
  msg: string;
}
interface Seg {
  until: number;
  label: string;
  sub: string;
  tone: Level;
  blackhole?: boolean;
}
interface Scenario {
  start: number;
  total: number;
  steps: Step[];
  kind: TransKind;
  segs: Seg[];
  packet?: { nodeId: string; podNodeId: string; snat: boolean; podSrc: string }; // traffic send → drives the single dot
}

const names = (ns: NodeT[]) => ns.map((n) => n.name).join(', ');

// Which backend pod kube-proxy/IPVS forwards the request to once it reaches the
// ingress node. With externalTrafficPolicy=Local it must stay on the ingress
// node (which is guaranteed to run a pod, since Local only announces from such
// nodes). With Cluster it can be any pod cluster-wide — so it may add a second
// hop to a pod on another node. `salt` varies the choice between requests.
function choosePodNode(state: LabState, svc: Parameters<typeof backendNodeIds>[1], ingress: NodeT, salt: number): NodeT {
  if (state.policy === 'Local') return ingress;
  const backs = backendNodeIds(state, svc)
    .map((id) => state.nodes.find((n) => n.id === id))
    .filter((n): n is NodeT => !!n && n.alive);
  if (!backs.length) return ingress;
  return backs[salt % backs.length];
}

export function useSimulation(state: LabState): SimSnapshot {
  const [snap, setSnap] = React.useState<SimSnapshot>({ clock: 0, events: [], transition: null, packet: null });

  const eventsRef = React.useRef<LogEntry[]>([]);
  const evIdRef = React.useRef(0);
  const clockRef = React.useRef(0);
  const scenarioRef = React.useRef<Scenario | null>(null);
  const loggedRef = React.useRef<Set<number>>(new Set());
  const rafRef = React.useRef<number | null>(null);
  const lastNowRef = React.useRef<number | null>(null);
  const stateRef = React.useRef(state);
  stateRef.current = state;

  // Build a fresh narration timeline whenever a new action fires.
  React.useEffect(() => {
    const a = state.action;
    if (!a) return;
    if (a.type === 'preset') eventsRef.current = []; // presets & reset clear the log
    const sc = buildScenario(stateRef.current);
    if (!sc) return;
    scenarioRef.current = { ...sc, start: clockRef.current };
    loggedRef.current = new Set();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.action?.id]);

  // The single rAF loop: advance the clock, reveal due steps, update the banner.
  React.useEffect(() => {
    const tick = (now: number) => {
      const last = lastNowRef.current ?? now;
      lastNowRef.current = now;
      clockRef.current += Math.min(0.05, (now - last) / 1000);

      const sc = scenarioRef.current;
      let transition: Transition | null = null;
      let packet: PacketFlight | null = null;
      if (sc) {
        const el = clockRef.current - sc.start;
        for (let i = 0; i < sc.steps.length; i++) {
          if (!loggedRef.current.has(i) && el >= sc.steps[i].at) {
            loggedRef.current.add(i);
            const s = sc.steps[i];
            eventsRef.current = [...eventsRef.current, { id: evIdRef.current++, t: +el.toFixed(1), node: s.node, level: s.level, msg: s.msg }].slice(-50);
          }
        }
        if (el <= sc.total) {
          const seg = sc.segs.find((g) => el < g.until) ?? sc.segs[sc.segs.length - 1];
          if (seg) transition = { kind: sc.kind, label: seg.label, sub: seg.sub, tone: seg.tone, progress: Math.min(1, el / sc.total), blackhole: !!seg.blackhole };
          if (sc.packet) packet = { progress: Math.max(0, Math.min(1, el / sc.total)), nodeId: sc.packet.nodeId, podNodeId: sc.packet.podNodeId, snat: sc.packet.snat, podSrc: sc.packet.podSrc };
        } else {
          scenarioRef.current = null;
        }
      }

      setSnap({ clock: clockRef.current, events: eventsRef.current, transition, packet });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return snap;
}

// ── scenario construction ───────────────────────────────────────
function buildScenario(state: LabState): Omit<Scenario, 'start'> | null {
  const a = state.action;
  if (!a) return null;
  const L2 = state.mode === 'l2';

  switch (a.type) {
    case 'traffic': {
      const svc = state.services.find((s) => s.id === a.serviceId);
      if (!svc) return null;
      const ip = assignedIp(state, svc);
      if (!ip) return info('controller', 'warn', `${svc.name}: no external IP (pool exhausted) — nothing to reach`);
      const active = activeNodesOf(state, svc);
      if (!active.length) return info('—', 'err', `${svc.name} (${ip}): no live eligible node — unreachable`);
      // ingress node = the L2 leader, or the BGP next-hop this flow hashed to.
      const ingress = L2 ? active[0] : active[a.id % active.length];
      const pod = choosePodNode(state, svc, ingress, a.id + (L2 ? 0 : 1));
      const local = pod.id === ingress.id;
      const snat = state.policy === 'Cluster'; // Cluster masquerades the source IP
      const podSrc = snat ? ingress.ip : CLIENT_IP;
      // externalTrafficPolicy step: what the backend pod sees as the source IP.
      const srcStep: Step = snat
        ? { at: 0, node: 'kube-proxy', level: 'warn', msg: `SNAT: source ${CLIENT_IP} → ${ingress.ip}; pod sees the node IP, reply returns via ${ingress.name} (client IP lost)` }
        : { at: 0, node: pod.name, level: 'ok', msg: `pod sees real client source ${CLIENT_IP} — preserved (Local, no SNAT, no extra hop)` };
      const srcSeg: Seg = snat
        ? { until: 0, label: `SNAT · pod sees ${ingress.ip}`, sub: 'Cluster masquerades the client IP', tone: 'warn' }
        : { until: 0, label: `source IP preserved · ${CLIENT_IP}`, sub: 'Local keeps the real client IP', tone: 'ok' };

      if (L2) {
        return {
          total: 4.4,
          kind: 'traffic',
          packet: { nodeId: ingress.id, podNodeId: pod.id, snat, podSrc },
          steps: [
            { at: 0.0, node: 'client', level: 'info', msg: `ARP "who-has ${ip}?" — broadcast across the L2 segment` },
            { at: 0.9, node: ingress.name, level: 'ok', msg: `leader replies: ${ip} is-at ${ingress.mac}` },
            { at: 1.7, node: 'L2 switch', level: 'info', msg: `MAC table: ${ip} → ${ingress.name}` },
            { at: 2.4, node: ingress.name, level: 'ok', msg: `request arrives at ${ingress.name}; kube-proxy/IPVS picks a backend pod` },
            local
              ? { at: 3.0, node: ingress.name, level: 'ok', msg: `→ backend pod on ${ingress.name}` }
              : { at: 3.0, node: pod.name, level: 'ok', msg: `→ pod on ${pod.name} — Cluster adds a second hop across nodes` },
            { ...srcStep, at: 3.6 },
          ],
          segs: [
            { until: 1.7, label: 'ARP / NDP resolution', sub: `who has ${ip}?`, tone: 'warn' },
            { until: 2.6, label: `delivered to ${ingress.name}`, sub: 'single node — failover, not load balancing', tone: 'ok' },
            { until: 3.6, label: local ? `pod on ${ingress.name}` : `2nd hop → pod on ${pod.name}`, sub: local ? 'kube-proxy → local backend' : 'kube-proxy → pod on another node', tone: 'ok' },
            { ...srcSeg, until: 4.4 },
          ],
        };
      }
      // BGP
      return {
        total: 4.0,
        kind: 'traffic',
        packet: { nodeId: ingress.id, podNodeId: pod.id, snat, podSrc },
        steps: [
          { at: 0.0, node: 'ToR router', level: 'info', msg: `route ${ip}/32 = ECMP via ${active.length} next-hop${active.length > 1 ? 's' : ''}` },
          { at: 0.9, node: 'ToR router', level: 'ok', msg: `this flow's 5-tuple hashes → ${ingress.name} (other flows spread across ${names(active)})` },
          { at: 1.7, node: ingress.name, level: 'ok', msg: `arrives at ${ingress.name}; kube-proxy/IPVS picks a backend pod` },
          local
            ? { at: 2.4, node: ingress.name, level: 'ok', msg: `→ backend pod on ${ingress.name}` }
            : { at: 2.4, node: pod.name, level: 'ok', msg: `→ pod on ${pod.name} — Cluster adds a second hop across nodes` },
          { ...srcStep, at: 3.1 },
        ],
        segs: [
          { until: 0.9, label: 'ECMP lookup', sub: `${ip}/32 · ${active.length}-way`, tone: 'info' },
          { until: 1.9, label: `this flow → ${ingress.name}`, sub: `1 node per flow · spread across ${active.length}`, tone: 'ok' },
          { until: 3.1, label: local ? `pod on ${ingress.name}` : `2nd hop → pod on ${pod.name}`, sub: local ? 'kube-proxy → local backend' : 'kube-proxy → pod on another node', tone: 'ok' },
          { ...srcSeg, until: 4.0 },
        ],
      };
    }

    case 'node': {
      const node = state.nodes.find((n) => n.id === a.nodeId)!;
      if (!a.down) {
        // recovery
        return {
          total: 1.8,
          kind: 'recover',
          steps: L2
            ? [
                { at: 0.0, node: node.name, level: 'info', msg: `${node.name} back up — speaker rejoins memberlist gossip` },
                { at: 0.8, node: node.name, level: 'ok', msg: `ready as a standby leader candidate` },
              ]
            : [
                { at: 0.0, node: node.name, level: 'info', msg: `${node.name} back up — BGP OPEN → ESTABLISHED with router` },
                { at: 0.8, node: node.name, level: 'ok', msg: `re-advertises /32s; ECMP widens to include ${node.name}` },
              ],
          segs: [{ until: 1.8, label: `${node.name} recovered`, sub: 'rejoining the cluster', tone: 'ok' }],
        };
      }
      // failure — narrate against the selected service (or the first one).
      const svc = selectedService(state) ?? state.services[0];
      const ip = svc ? assignedIp(state, svc) : null;
      // Did this node host the controller? (no live node sits before it.) If so,
      // the Deployment reschedules the controller pod onto a surviving node.
      const killedIdx = state.nodes.findIndex((n) => n.id === a.nodeId);
      const wasController = !state.nodes.some((n, i) => i < killedIdx && n.alive);
      const newCtrl = state.nodes.find((n) => n.alive) ?? null;
      const ctrlNote: Step[] = wasController
        ? [
            newCtrl
              ? { at: 0.3, node: 'controller', level: 'ctrl', msg: `controller pod lost with ${node.name} → Deployment reschedules to ${newCtrl.name}; new IP allocations pause briefly — existing IPs stay announced` }
              : { at: 0.3, node: 'controller', level: 'err', msg: `controller pod lost — no node left to reschedule onto; IP allocation halted` },
          ]
        : [];
      if (L2) {
        // After the kill, leaderOf already reflects the new leader.
        const newLeader = svc ? leaderOf(state, svc) : null;
        const reaffected = svc && ip; // whether we have an IP to talk about
        return {
          total: 4.2,
          kind: 'l2-down',
          steps: [
            { at: 0.0, node: node.name, level: 'err', msg: `${node.name} down — its MAC stops answering ARP` },
            ...ctrlNote,
            { at: 0.5, node: 'memberlist', level: 'warn', msg: `gossip detecting failure… traffic to its IPs black-holes` },
            { at: 2.0, node: 'memberlist', level: 'warn', msg: `peers declare ${node.name} dead (~10s default detection)` },
            reaffected
              ? newLeader
                ? { at: 2.8, node: newLeader.name, level: 'ok', msg: `re-elected leader for ${ip}; sends gratuitous ARP "${ip} is-at ${newLeader.mac}"` }
                : { at: 2.8, node: '—', level: 'err', msg: `${ip}: no eligible node left — service down` }
              : { at: 2.8, node: 'memberlist', level: 'info', msg: `leaders re-evaluated across all announced IPs` },
            { at: 3.6, node: 'cluster', level: newLeader || !reaffected ? 'ok' : 'err', msg: newLeader || !reaffected ? `converged — switches & clients relearn the new MAC` : `selected service has no live node` },
          ],
          segs: [
            { until: 2.0, label: 'DETECTING FAILURE', sub: 'memberlist gossip · ~10s', tone: 'warn', blackhole: true },
            { until: 2.8, label: 'RE-ELECTING LEADER', sub: 'speakers agree on a new owner', tone: 'warn', blackhole: true },
            { until: 4.2, label: newLeader ? `LEADER → ${newLeader.name}` : 'NO LEADER', sub: newLeader ? 'gratuitous ARP relearns the path' : 'no eligible live node', tone: newLeader ? 'ok' : 'err' },
          ],
        };
      }
      // BGP failure
      const advs = svc ? advertisersOf(state, svc) : [];
      return {
        total: 4.2,
        kind: 'bgp-down',
        steps: [
          { at: 0.0, node: node.name, level: 'err', msg: `${node.name} down — BGP session to router dropped` },
          ...ctrlNote,
          state.bfd
            ? { at: 0.6, node: 'BFD', level: 'ctrl', msg: `BFD detected the dead peer in < 1s` }
            : { at: 0.6, node: 'router', level: 'warn', msg: `no BFD — router waits up to the hold timer (~90s) to notice` },
          { at: 1.6, node: 'ToR router', level: 'warn', msg: `withdraws next-hop ${node.ip}; ECMP recomputes to ${advs.length} path${advs.length === 1 ? '' : 's'}` },
          { at: 2.6, node: 'ToR router', level: 'warn', msg: `caveat: next-hop set changed → flows re-hash; some live connections move node and reset` },
          { at: 3.5, node: 'cluster', level: advs.length ? 'ok' : 'err', msg: advs.length ? `converged — load now spread across ${names(advs)}` : `no advertisers left — service withdrawn` },
        ],
        segs: [
          { until: state.bfd ? 0.6 : 1.6, label: state.bfd ? 'BFD DETECT' : 'WAITING ON HOLD TIMER', sub: state.bfd ? '< 1 second' : '~90s without BFD', tone: state.bfd ? 'ctrl' : 'warn', blackhole: !state.bfd },
          { until: 2.6, label: 'WITHDRAW + RECOMPUTE', sub: `ECMP → ${advs.length} paths`, tone: 'warn' },
          { until: 4.2, label: advs.length ? 'RE-CONVERGED' : 'WITHDRAWN', sub: advs.length ? 'rehash may reset some flows' : 'no live node', tone: advs.length ? 'ok' : 'err' },
        ],
      };
    }

    case 'speaker': {
      const node = state.nodes.find((n) => n.id === a.nodeId)!;
      if (!a.down) {
        return {
          total: 1.8,
          kind: 'recover',
          steps: [
            { at: 0.0, node: node.name, level: 'info', msg: `speaker on ${node.name} restarted — rejoins ${L2 ? 'memberlist' : 'BGP peering'}` },
            { at: 0.8, node: node.name, level: 'ok', msg: `resumes announcing the IPs it owns` },
          ],
          segs: [{ until: 1.8, label: `speaker up · ${node.name}`, sub: 'announcing again', tone: 'ok' }],
        };
      }
      // speaker down but the node (and its pods) keep running.
      const svc = selectedService(state) ?? state.services[0];
      const ip = svc ? svc.ip : null;
      if (L2) {
        const newLeader = svc ? leaderOf(state, svc) : null;
        return {
          total: 3.2,
          kind: 'l2-down',
          steps: [
            { at: 0.0, node: node.name, level: 'err', msg: `speaker on ${node.name} stopped — it no longer answers ARP (node & pods stay up)` },
            { at: 0.6, node: 'memberlist', level: 'warn', msg: `peers see the speaker leave — only ${node.name}'s announcements are affected` },
            ip && newLeader
              ? { at: 1.6, node: newLeader.name, level: 'ok', msg: `re-derives owner for ${ip}; gratuitous ARP "${ip} is-at ${newLeader.mac}"` }
              : { at: 1.6, node: '—', level: ip ? 'err' : 'info', msg: ip ? `${ip}: no other eligible speaker — unreachable` : `no announced IP affected` },
            { at: 2.5, node: 'cluster', level: newLeader || !ip ? 'ok' : 'err', msg: newLeader || !ip ? `converged — the IP now lives on another node` : `service down until a speaker returns` },
          ],
          segs: [
            { until: 1.6, label: 'SPEAKER LOST', sub: `${node.name} stops answering ARP`, tone: 'warn', blackhole: !!ip },
            { until: 3.2, label: newLeader ? `OWNER → ${newLeader.name}` : 'NO OWNER', sub: newLeader ? 'gratuitous ARP relearns the path' : 'no eligible speaker', tone: newLeader ? 'ok' : 'err' },
          ],
        };
      }
      const advs = svc ? advertisersOf(state, svc) : [];
      return {
        total: 3.0,
        kind: 'bgp-down',
        steps: [
          { at: 0.0, node: node.name, level: 'err', msg: `speaker on ${node.name} stopped — its BGP session drops (node & pods stay up)` },
          { at: 0.8, node: 'ToR router', level: 'warn', msg: `withdraws next-hop ${node.ip}; ECMP recomputes to ${advs.length} path${advs.length === 1 ? '' : 's'}` },
          { at: 1.8, node: 'cluster', level: advs.length ? 'ok' : 'err', msg: advs.length ? `converged — the other speakers keep advertising (${names(advs)})` : `no advertisers left — service withdrawn` },
        ],
        segs: [
          { until: 0.8, label: 'SPEAKER LOST', sub: `${node.name}'s session drops`, tone: 'warn' },
          { until: 3.0, label: advs.length ? `ECMP → ${advs.length}` : 'WITHDRAWN', sub: advs.length ? 'other nodes keep advertising' : 'no live speaker', tone: advs.length ? 'ok' : 'err' },
        ],
      };
    }

    case 'ctrl-ready': {
      const ctrl = state.nodes.find((n) => n.alive);
      const assigned = state.services.filter((s) => s.ip).length;
      return {
        total: 1.8,
        kind: 'alloc',
        steps: [
          { at: 0.0, node: 'controller', level: 'ctrl', msg: `controller Ready on ${ctrl?.name ?? '—'} — resumes watching Services & IPAddressPools` },
          { at: 0.8, node: 'controller', level: 'ok', msg: `assigns any pending IPs — ${assigned}/${state.services.length} Services now have an external IP` },
        ],
        segs: [{ until: 1.8, label: 'CONTROLLER READY', sub: 'paused allocations resume', tone: 'ctrl' }],
      };
    }

    case 'service-add': {
      const svc = state.services.find((s) => s.id === a.serviceId);
      if (!svc) return null;
      const ip = assignedIp(state, svc);
      if (!ip)
        return info(
          'controller',
          'warn',
          !state.controllerReady
            ? `controller is rescheduling — ${svc.name} stays <pending> until it's Ready`
            : `pool exhausted — ${svc.name} stays <pending> (grow the pool or free an IP)`,
        );
      const active = activeNodesOf(state, svc);
      return {
        total: 1.9,
        kind: 'alloc',
        steps: [
          { at: 0.0, node: 'controller', level: 'ctrl', msg: `allocates ${ip} from prod-pool → ${svc.name}; writes .status.loadBalancer` },
          L2
            ? { at: 0.8, node: 'speaker', level: 'ok', msg: `announces ${ip} via leader ${active[0]?.name ?? '—'} (ARP/NDP)` }
            : { at: 0.8, node: 'speaker', level: 'ok', msg: `advertises ${ip}/32 via ${active.length} node${active.length === 1 ? '' : 's'} (BGP)` },
        ],
        segs: [
          { until: 0.8, label: 'ALLOCATE', sub: `${ip} ← prod-pool`, tone: 'ctrl' },
          { until: 1.9, label: 'ANNOUNCE', sub: L2 ? 'one leader answers ARP' : 'ECMP /32 to router', tone: 'ok' },
        ],
      };
    }

    case 'service-remove':
      return {
        total: 1.6,
        kind: 'alloc',
        steps: [
          { at: 0.0, node: 'controller', level: 'ctrl', msg: a.ip ? `releases ${a.ip} back to prod-pool` : `removed ${a.name}` },
          { at: 0.7, node: 'speaker', level: 'info', msg: a.ip ? `withdraws ${a.ip} (clears ARP / sends BGP withdraw)` : `nothing announced` },
        ],
        segs: [{ until: 1.6, label: 'WITHDRAW', sub: a.ip ? `${a.ip} freed` : a.name, tone: 'info' }],
      };

    case 'mode':
      return {
        total: 1.9,
        kind: 'mode',
        steps: [
          { at: 0.0, node: 'config', level: 'info', msg: `advertisement → ${a.mode === 'l2' ? 'L2Advertisement' : 'BGPAdvertisement'} · same pool, same IPs` },
          a.mode === 'l2'
            ? { at: 0.8, node: 'speaker', level: 'ok', msg: `speakers answer ARP/NDP — one elected leader per IP` }
            : { at: 0.8, node: 'speaker', level: 'ok', msg: `speakers peer with the router — every node advertises /32 (ECMP)` },
        ],
        segs: [{ until: 1.9, label: a.mode === 'l2' ? 'LAYER 2 MODE' : 'BGP MODE', sub: a.mode === 'l2' ? 'ARP / NDP failover' : 'ECMP load balancing', tone: 'info' }],
      };

    case 'preset':
      return info('config', 'info', `loaded preset · ${a.label}`);

    case 'config':
    default:
      return info('config', 'info', `configuration updated`);
  }
}

function info(node: string, level: Level, msg: string): Omit<Scenario, 'start'> {
  return {
    total: 1.4,
    kind: null,
    steps: [{ at: 0.0, node, level, msg }],
    segs: [],
  };
}

// kept for potential reuse / clarity of intent
export { eligibleNodes };
