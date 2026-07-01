// Domain model for the MetalLB lab.
//
// The cluster is a handful of nodes. Every node runs a MetalLB *speaker* (the
// DaemonSet); one node also runs the *controller* (the Deployment). You define
// an IPAddressPool and create Services of type LoadBalancer. The controller
// allocates an external IP to each Service from the pool (a sticky assignment);
// the speakers announce it — in **Layer-2 mode** one node answers ARP/NDP for
// the IP (failover only), in **BGP mode** every eligible node advertises the IP
// as a /32 and the router load-balances across them with ECMP.
//
// Announcement state (leader / advertisers / reachability) is *derived* from the
// current set of nodes whose speaker is up. Allocation is *stored* on each
// Service (sticky, like real MetalLB) and only changes when the controller is
// Ready — so killing the controller's node pauses new allocation without
// disturbing IPs already handed out.

export type Mode = 'l2' | 'bgp';
export type Policy = 'Cluster' | 'Local';

export interface NodeT {
  id: string;
  name: string;
  ip: string; // node / next-hop IP
  mac: string; // last octet shown in L2 scenes
  alive: boolean; // node itself up (runs pods, can host the controller)
  speaker: boolean; // the speaker pod on this node is up (announces IPs)
}

export interface ServiceT {
  id: string;
  name: string;
  seq: number; // creation order
  ip: string | null; // sticky external IP the controller assigned, or null = <pending>
}

// A narratable action — the simulation layer turns the most recent one into a
// timed sequence of event-log lines (and, for failures, a convergence banner).
export type ActionRec =
  | { id: number; type: 'traffic'; serviceId: string }
  | { id: number; type: 'node'; nodeId: string; down: boolean }
  | { id: number; type: 'speaker'; nodeId: string; down: boolean }
  | { id: number; type: 'ctrl-ready' }
  | { id: number; type: 'service-add'; serviceId: string }
  | { id: number; type: 'service-remove'; name: string; ip: string | null }
  | { id: number; type: 'mode'; mode: Mode }
  | { id: number; type: 'config' }
  | { id: number; type: 'preset'; label: string };

export interface LabState {
  mode: Mode;
  policy: Policy;
  bfd: boolean; // BGP: Bidirectional Forwarding Detection for fast failure detection
  poolStart: number; // first host octet of the pool, e.g. 240 → 192.168.1.240
  poolSize: number; // number of addresses in the pool
  controllerReady: boolean; // false while the controller Deployment is rescheduling
  nodes: NodeT[];
  services: ServiceT[];
  selected: string | null;
  action: ActionRec | null;
  nextSeq: number;
  nextAction: number;
}

// ── constants ───────────────────────────────────────────────────
export const SUBNET = '192.168.1';
export const ipStr = (octet: number) => `${SUBNET}.${octet}`;
export const CLIENT_IP = '192.168.1.50';
export const MY_AS = 64500; // the cluster's BGP AS
export const PEER_AS = 64512; // the ToR router's AS

const NODE_DEFS: Array<Omit<NodeT, 'alive' | 'speaker'>> = [
  { id: 'n1', name: 'node-1', ip: '10.0.0.11', mac: '…:01' },
  { id: 'n2', name: 'node-2', ip: '10.0.0.12', mac: '…:02' },
  { id: 'n3', name: 'node-3', ip: '10.0.0.13', mac: '…:03' },
];

export function freshNodes(): NodeT[] {
  return NODE_DEFS.map((n) => ({ ...n, alive: true, speaker: true }));
}

// ── derivations ─────────────────────────────────────────────────

// Stable string hash → deterministic node selection for L2.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// A node can announce an IP only if the node is up AND its speaker is up.
export const announcing = (n: NodeT) => n.alive && n.speaker;

export const assignedIp = (_state: LabState, svc: ServiceT): string | null => svc.ip;

// The addresses in the pool, as strings.
export function poolAddresses(state: LabState): string[] {
  const out: string[] = [];
  for (let i = 0; i < state.poolSize; i++) out.push(ipStr(state.poolStart + i));
  return out;
}

// Sticky allocation: keep every Service's current IP; release IPs that fall
// outside the pool; and — only while the controller is Ready — hand free pool
// IPs to any pending Services in creation order. Beyond the pool's size (or
// while the controller is down) Services stay <pending>.
export function reconcile(state: LabState): ServiceT[] {
  const poolSet = new Set(poolAddresses(state));
  let services = state.services.map((s) => (s.ip && !poolSet.has(s.ip) ? { ...s, ip: null } : s));
  if (!state.controllerReady) return services; // controller down → no new allocations
  const used = new Set(services.map((s) => s.ip).filter((x): x is string => !!x));
  const free = poolAddresses(state).filter((ip) => !used.has(ip));
  const pending = services.filter((s) => !s.ip).sort((a, b) => a.seq - b.seq);
  const assign = new Map<string, string>();
  let fi = 0;
  for (const s of pending) if (fi < free.length) assign.set(s.id, free[fi++]);
  return services.map((s) => (assign.has(s.id) ? { ...s, ip: assign.get(s.id)! } : s));
}

// Which nodes run this Service's pods. Deterministic: 2 of the 3 nodes.
export function backendNodeIds(state: LabState, svc: ServiceT): string[] {
  const n = state.nodes.length;
  const a = svc.seq % n;
  const b = (svc.seq + 1) % n;
  return [state.nodes[a].id, state.nodes[b].id];
}

// Nodes eligible to announce the IP: speaker up, and — under Local — only nodes
// that actually run a pod of the Service.
export function eligibleNodes(state: LabState, svc: ServiceT): NodeT[] {
  const pool = state.policy === 'Local' ? new Set(backendNodeIds(state, svc)) : null;
  return state.nodes.filter((n) => announcing(n) && (!pool || pool.has(n.id)));
}

// L2: exactly one node answers ARP/NDP for the IP. Not a classic election —
// each speaker deterministically computes the owner from the eligible set
// (lowest hash wins), so losing a node re-derives a new owner.
export function leaderOf(state: LabState, svc: ServiceT): NodeT | null {
  const elig = eligibleNodes(state, svc);
  if (!elig.length) return null;
  return elig.slice().sort((a, b) => hash(svc.name + a.ip) - hash(svc.name + b.ip))[0];
}

// BGP: every eligible node advertises the /32 → the router ECMPs across all.
export function advertisersOf(state: LabState, svc: ServiceT): NodeT[] {
  return eligibleNodes(state, svc);
}

// Nodes actually carrying the IP's ingress traffic (1 for L2, N for BGP).
export function activeNodesOf(state: LabState, svc: ServiceT): NodeT[] {
  if (state.mode === 'l2') {
    const l = leaderOf(state, svc);
    return l ? [l] : [];
  }
  return advertisersOf(state, svc);
}

export function isReachable(state: LabState, svc: ServiceT): boolean {
  return svc.ip != null && activeNodesOf(state, svc).length > 0;
}

export const poolUsed = (state: LabState) => state.services.filter((s) => s.ip).length;
export const selectedService = (state: LabState): ServiceT | null => state.services.find((s) => s.id === state.selected) ?? null;

// The controller is a single-replica Deployment; Kubernetes runs its pod on some
// healthy node and reschedules it if that node dies. Modelled as "the first live
// node" so the badge visibly relocates on failure.
export const controllerNodeId = (state: LabState): string | null => state.nodes.find((n) => n.alive)?.id ?? null;

// ── reducer ─────────────────────────────────────────────────────
export type Action =
  | { type: 'SET_MODE'; mode: Mode }
  | { type: 'SET_POLICY'; policy: Policy }
  | { type: 'SET_BFD'; bfd: boolean }
  | { type: 'SET_POOL'; start?: number; size?: number }
  | { type: 'ADD_SERVICE' }
  | { type: 'REMOVE_SERVICE'; id: string }
  | { type: 'SELECT'; id: string }
  | { type: 'TOGGLE_NODE'; id: string }
  | { type: 'TOGGLE_SPEAKER'; id: string }
  | { type: 'CONTROLLER_READY' }
  | { type: 'SEND_TRAFFIC' }
  | { type: 'LOAD_PRESET'; state: Partial<LabState>; label: string }
  | { type: 'RESET' };

function rec(state: LabState, a: ActionRec): ActionRec {
  return { ...a, id: state.nextAction } as ActionRec;
}
const withAlloc = (s: LabState): LabState => ({ ...s, services: reconcile(s) });

function makeInitial(): LabState {
  const base: LabState = {
    mode: 'l2',
    policy: 'Cluster',
    bfd: true,
    poolStart: 240,
    poolSize: 6,
    controllerReady: true,
    nodes: freshNodes(),
    services: [
      { id: 's1', name: 'web', seq: 1, ip: null },
      { id: 's2', name: 'api', seq: 2, ip: null },
    ],
    selected: 's1',
    action: null,
    nextSeq: 3,
    nextAction: 1,
  };
  return { ...base, services: reconcile(base) };
}

export const initialState: LabState = makeInitial();

let uid = 100;
const newId = () => `s${uid++}`;

export function reducer(state: LabState, action: Action): LabState {
  const bump = (s: LabState, a: ActionRec): LabState => ({ ...s, action: rec(state, a), nextAction: state.nextAction + 1 });

  switch (action.type) {
    case 'SET_MODE':
      if (action.mode === state.mode) return state;
      return bump({ ...state, mode: action.mode }, { id: 0, type: 'mode', mode: action.mode });
    case 'SET_POLICY':
      return bump({ ...state, policy: action.policy }, { id: 0, type: 'config' });
    case 'SET_BFD':
      return bump({ ...state, bfd: action.bfd }, { id: 0, type: 'config' });
    case 'SET_POOL': {
      const start = action.start ?? state.poolStart;
      const size = action.size ?? state.poolSize;
      return bump(withAlloc({ ...state, poolStart: clampOctet(start), poolSize: Math.max(1, Math.min(20, size)) }), { id: 0, type: 'config' });
    }
    case 'ADD_SERVICE': {
      if (state.services.length >= 8) return state;
      const id = newId();
      const name = nextName(state.services);
      const svc: ServiceT = { id, name, seq: state.nextSeq, ip: null };
      const ns = withAlloc({ ...state, services: [...state.services, svc], nextSeq: state.nextSeq + 1, selected: id });
      return bump(ns, { id: 0, type: 'service-add', serviceId: id });
    }
    case 'REMOVE_SERVICE': {
      const svc = state.services.find((s) => s.id === action.id);
      if (!svc) return state;
      const services = state.services.filter((s) => s.id !== action.id);
      const selected = state.selected === action.id ? services[0]?.id ?? null : state.selected;
      const ns = withAlloc({ ...state, services, selected });
      return bump(ns, { id: 0, type: 'service-remove', name: svc.name, ip: svc.ip });
    }
    case 'SELECT':
      return { ...state, selected: action.id };
    case 'TOGGLE_NODE': {
      const node = state.nodes.find((n) => n.id === action.id)!;
      const goingDown = node.alive;
      const wasController = controllerNodeId(state) === node.id;
      const nodes = state.nodes.map((n) => (n.id === action.id ? { ...n, alive: !n.alive } : n));
      let controllerReady = state.controllerReady;
      if (goingDown && wasController) controllerReady = false; // must reschedule
      if (!nodes.some((n) => n.alive)) controllerReady = false; // nowhere to run
      const ns = withAlloc({ ...state, nodes, controllerReady });
      return bump(ns, { id: 0, type: 'node', nodeId: action.id, down: goingDown });
    }
    case 'TOGGLE_SPEAKER': {
      const node = state.nodes.find((n) => n.id === action.id)!;
      if (!node.alive) return state; // can't toggle a speaker on a dead node
      const nodes = state.nodes.map((n) => (n.id === action.id ? { ...n, speaker: !n.speaker } : n));
      return bump({ ...state, nodes }, { id: 0, type: 'speaker', nodeId: action.id, down: node.speaker });
    }
    case 'CONTROLLER_READY': {
      if (state.controllerReady || !state.nodes.some((n) => n.alive)) return state;
      return bump(withAlloc({ ...state, controllerReady: true }), { id: 0, type: 'ctrl-ready' });
    }
    case 'SEND_TRAFFIC': {
      if (!state.selected) return state;
      return bump(state, { id: 0, type: 'traffic', serviceId: state.selected });
    }
    case 'LOAD_PRESET':
      return bump(withAlloc({ ...state, ...action.state, controllerReady: true }), { id: 0, type: 'preset', label: action.label });
    case 'RESET':
      return { ...makeInitial(), action: rec(state, { id: 0, type: 'preset', label: 'reset to defaults' }), nextAction: state.nextAction + 1 };
    default:
      return state;
  }
}

function clampOctet(o: number): number {
  return Math.max(2, Math.min(250, Math.round(o)));
}

const NAME_POOL = ['web', 'api', 'cache', 'db', 'auth', 'queue', 'grafana', 'registry'];
function nextName(services: ServiceT[]): string {
  const used = new Set(services.map((s) => s.name));
  for (const n of NAME_POOL) if (!used.has(n)) return n;
  return `svc-${services.length + 1}`;
}
