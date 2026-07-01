// Domain model for the VLAN lab.
//
// Topology: two switches (SW-A, SW-B) joined by one inter-switch link, plus an
// L3 gateway (a router-on-a-stick, or SW-A acting as an L3 switch with SVIs).
// Six hosts sit on access ports — three per switch. You assign each access
// port's VLAN, tune the trunk (mode / allowed list / native VLAN per end) and
// the routing method, then send a frame (unicast or broadcast) and the planner
// computes its exact hop-by-hop path, including where it is tagged vs untagged,
// whether it is delivered, blocked, or leaks across a native mismatch.

import { VLANS, VLAN_IDS } from '../design/theme';

export type SwitchId = 'A' | 'B';
export type TrunkMode = 'trunk' | 'access';
export type Routing = 'none' | 'router' | 'l3';
export type Dst = string | 'broadcast';

export interface HostDef {
  id: string;
  name: string;
  sw: SwitchId;
  ip: string; // the host's configured IP (does NOT change with the port VLAN)
  intendedVlan: number; // the VLAN whose subnet this IP belongs to
  port: string; // switch port name
}

export const HOSTS: HostDef[] = [
  { id: 'a1', name: 'PC-A', sw: 'A', ip: '10.0.1.11', intendedVlan: 10, port: 'Gi0/1' },
  { id: 'a2', name: 'PC-C', sw: 'A', ip: '10.0.2.21', intendedVlan: 20, port: 'Gi0/2' },
  { id: 'a3', name: 'GUEST-1', sw: 'A', ip: '10.0.3.31', intendedVlan: 30, port: 'Gi0/3' },
  { id: 'b1', name: 'PC-B', sw: 'B', ip: '10.0.1.12', intendedVlan: 10, port: 'Gi0/1' },
  { id: 'b2', name: 'PC-D', sw: 'B', ip: '10.0.2.22', intendedVlan: 20, port: 'Gi0/2' },
  { id: 'b3', name: 'GUEST-2', sw: 'B', ip: '10.0.3.32', intendedVlan: 30, port: 'Gi0/3' },
];
export const hostById = (id: string) => HOSTS.find((h) => h.id === id)!;

export type ActionRec =
  | { id: number; type: 'send'; src: string; dst: Dst }
  | { id: number; type: 'config'; msg: string }
  | { id: number; type: 'preset'; label: string };

export interface LabState {
  vlansEnabled: boolean; // false = the "flat network" starting point (everything in VLAN 1)
  portVlan: Record<string, number>;
  trunkMode: TrunkMode;
  allowed: number[]; // VLANs the trunk carries (trunk mode)
  linkAccessVlan: number; // the single VLAN carried if the link is left as an access port
  nativeA: number; // native VLAN on SW-A's end of the trunk
  nativeB: number; // native VLAN on SW-B's end of the trunk
  routing: Routing;
  routableVlans: number[]; // VLANs that have a subinterface / SVI (a gateway)
  src: string;
  dst: Dst;
  action: ActionRec | null;
  nextAction: number;
}

// VLAN each access port is in (VLAN 1 for every port when VLANs are "off").
export const portVlanOf = (s: LabState, hostId: string): number => (s.vlansEnabled ? s.portVlan[hostId] : 1);

export const subnetIdxOfVlan = (v: number): number => (v === 10 ? 1 : v === 20 ? 2 : v === 30 ? 3 : 0);
export const hostSubnetIdx = (h: HostDef): number => subnetIdxOfVlan(h.intendedVlan);
// A host can reach a gateway only if its port VLAN's subnet matches its own IP.
export const ipMatchesVlan = (s: LabState, h: HostDef): boolean => portVlanOf(s, h.id) === h.intendedVlan;

// ── the frame-walk planner ──────────────────────────────────────
export type NodeKey = string; // 'host:<id>' | 'A' | 'B' | 'GW'
export interface Seg {
  from: NodeKey;
  to: NodeKey;
  tagged: boolean;
  vlan: number;
  kind: 'access' | 'trunk' | 'gwlink';
}
export type Outcome = 'delivered' | 'blocked' | 'leak';
export interface Walk {
  outcome: Outcome;
  reason: string;
  detail: string;
  segs: Seg[];
  broadcast: boolean;
  routed: boolean;
  reached: string[]; // host ids the frame reaches
  landedVlan: number; // VLAN the frame ends up in (differs from srcVlan on a leak)
  srcVlan: number;
}

const nativeOf = (s: LabState, end: SwitchId) => (end === 'A' ? s.nativeA : s.nativeB);

// Does the inter-switch link carry this VLAN at all? A trunk always carries its
// native VLAN (untagged) regardless of the allowed list.
export function trunkCarries(s: LabState, vlan: number): boolean {
  if (s.trunkMode === 'access') return vlan === s.linkAccessVlan;
  return s.allowed.includes(vlan) || vlan === s.nativeA || vlan === s.nativeB;
}
// Crossing the trunk, is the frame tagged? (Untagged only if it is the sending
// end's native VLAN.)
const taggedCrossing = (s: LabState, vlan: number, from: SwitchId) => vlan !== nativeOf(s, from);

const hkey = (id: string) => `host:${id}`;

export function planWalk(s: LabState, srcId: string, dst: Dst): Walk {
  const src = hostById(srcId);
  const srcVlan = portVlanOf(s, srcId);
  const base = { broadcast: dst === 'broadcast', routed: false, srcVlan, landedVlan: srcVlan };

  // ── BROADCAST ─────────────────────────────────────────────────
  if (dst === 'broadcast') {
    const segs: Seg[] = [];
    const reached: string[] = [];
    // same-switch same-VLAN access ports
    for (const h of HOSTS) {
      if (h.sw === src.sw && h.id !== srcId && portVlanOf(s, h.id) === srcVlan) {
        segs.push({ from: src.sw, to: hkey(h.id), tagged: false, vlan: srcVlan, kind: 'access' });
        reached.push(h.id);
      }
    }
    segs.unshift({ from: hkey(srcId), to: src.sw, tagged: false, vlan: srcVlan, kind: 'access' });
    // cross the trunk if it carries this VLAN
    const other: SwitchId = src.sw === 'A' ? 'B' : 'A';
    const carried = trunkCarries(s, srcVlan);
    if (carried) {
      const tagged = taggedCrossing(s, srcVlan, src.sw);
      segs.push({ from: src.sw, to: other, tagged, vlan: srcVlan, kind: 'trunk' });
      // native mismatch: an untagged native frame is re-classified into the far native
      const landed = !tagged && nativeOf(s, other) !== srcVlan ? nativeOf(s, other) : srcVlan;
      for (const h of HOSTS) {
        if (h.sw === other && portVlanOf(s, h.id) === landed) {
          segs.push({ from: other, to: hkey(h.id), tagged: false, vlan: landed, kind: 'access' });
          reached.push(h.id);
        }
      }
      if (landed !== srcVlan && reached.some((id) => hostById(id).sw === other)) {
        return { ...base, outcome: 'leak', reason: 'native VLAN mismatch', detail: `SW-${src.sw} sent VLAN ${srcVlan} untagged (its native); SW-${other} treats untagged as VLAN ${landed} → the broadcast leaked into VLAN ${landed}.`, segs, reached, landedVlan: landed };
      }
    }
    return { ...base, outcome: 'delivered', reason: 'broadcast contained in VLAN ' + srcVlan, detail: carried ? `Flooded to every VLAN ${srcVlan} port on both switches — and nothing else.` : `Flooded to VLAN ${srcVlan} ports on SW-${src.sw}. The trunk doesn't carry VLAN ${srcVlan}, so SW-${other} never sees it.`, segs, reached };
  }

  // ── UNICAST ───────────────────────────────────────────────────
  const d = hostById(dst);
  const dstVlan = portVlanOf(s, dst);

  // Same VLAN → pure L2 switching.
  if (srcVlan === dstVlan) {
    if (src.sw === d.sw) {
      return {
        ...base,
        outcome: 'delivered',
        reason: 'same VLAN · local switching',
        detail: `Both ports are in VLAN ${srcVlan} on SW-${src.sw}. The switch forwards by MAC within the VLAN — no tag, no router.`,
        segs: [
          { from: hkey(srcId), to: src.sw, tagged: false, vlan: srcVlan, kind: 'access' },
          { from: src.sw, to: hkey(dst), tagged: false, vlan: srcVlan, kind: 'access' },
        ],
        reached: [dst],
      };
    }
    // across the trunk
    if (!trunkCarries(s, srcVlan)) {
      return {
        ...base,
        outcome: 'blocked',
        reason: s.trunkMode === 'access' ? 'inter-switch link is an access port' : `VLAN ${srcVlan} pruned from the trunk`,
        detail: s.trunkMode === 'access' ? `The link between the switches is an access port (VLAN ${s.linkAccessVlan}) — it carries only that one VLAN, so VLAN ${srcVlan} can't cross.` : `VLAN ${srcVlan} isn't in the trunk's allowed list, so its frames are dropped at the trunk.`,
        segs: [{ from: hkey(srcId), to: src.sw, tagged: false, vlan: srcVlan, kind: 'access' }],
        reached: [],
      };
    }
    const tagged = taggedCrossing(s, srcVlan, src.sw);
    const landed = !tagged && nativeOf(s, d.sw) !== srcVlan ? nativeOf(s, d.sw) : srcVlan;
    const segs: Seg[] = [
      { from: hkey(srcId), to: src.sw, tagged: false, vlan: srcVlan, kind: 'access' },
      { from: src.sw, to: d.sw, tagged, vlan: srcVlan, kind: 'trunk' },
    ];
    if (landed !== srcVlan) {
      return { ...base, outcome: 'leak', reason: 'native VLAN mismatch', detail: `SW-${src.sw} sends VLAN ${srcVlan} untagged (its native ${nativeOf(s, src.sw)}); SW-${d.sw}'s native is ${nativeOf(s, d.sw)}, so it files the frame under VLAN ${landed} — the wrong VLAN.`, segs, reached: [], landedVlan: landed };
    }
    segs.push({ from: d.sw, to: hkey(dst), tagged: false, vlan: srcVlan, kind: 'access' });
    return { ...base, outcome: 'delivered', reason: 'same VLAN · tagged across the trunk', detail: `Untagged from PC → ${tagged ? `802.1Q-tagged VLAN ${srcVlan} across the trunk` : `carried untagged (it is the native VLAN ${srcVlan})`} → tag ${tagged ? 'stripped' : 'unchanged'} → untagged to the host.`, segs, reached: [dst] };
  }

  // Different VLAN → must route at L3.
  if (s.routing === 'none') {
    return { ...base, outcome: 'blocked', reason: 'different VLANs, no router', detail: `VLAN ${srcVlan} and VLAN ${dstVlan} are separate broadcast domains (and subnets). Switching alone can't cross them — you need a router or L3 switch. None is configured.`, segs: [{ from: hkey(srcId), to: src.sw, tagged: false, vlan: srcVlan, kind: 'access' }], reached: [] };
  }
  if (!s.routableVlans.includes(srcVlan) || !s.routableVlans.includes(dstVlan)) {
    const missing = !s.routableVlans.includes(srcVlan) ? srcVlan : dstVlan;
    return { ...base, outcome: 'blocked', reason: `no gateway for VLAN ${missing}`, detail: `The ${s.routing === 'router' ? 'router has no subinterface' : 'L3 switch has no SVI'} for VLAN ${missing}, so there's no default gateway to route ${srcVlan}↔${dstVlan}.`, segs: [{ from: hkey(srcId), to: src.sw, tagged: false, vlan: srcVlan, kind: 'access' }], reached: [] };
  }
  if (!ipMatchesVlan(s, src)) {
    return { ...base, outcome: 'blocked', reason: 'host in the wrong VLAN', detail: `${src.name} has IP ${src.ip} (subnet for VLAN ${src.intendedVlan}) but its port is in VLAN ${srcVlan}. Its default gateway ${VLANS[srcVlan]?.gw ?? '—'} isn't in its subnet, so it can't even reach a router.`, segs: [{ from: hkey(srcId), to: src.sw, tagged: false, vlan: srcVlan, kind: 'access' }], reached: [] };
  }

  // Build the routed path: src → (trunk to A if needed) → GW → (trunk to dst switch if needed) → dst.
  // The gateway (router-on-a-stick link, or SW-A's SVIs) hangs off SW-A.
  const segs: Seg[] = [{ from: hkey(srcId), to: src.sw, tagged: false, vlan: srcVlan, kind: 'access' }];
  // src → gateway (must reach SW-A in srcVlan)
  if (src.sw === 'B') {
    if (!trunkCarries(s, srcVlan)) {
      return { ...base, outcome: 'blocked', reason: `trunk can't carry VLAN ${srcVlan} to the gateway`, detail: `The gateway is reached via SW-A, but the trunk doesn't carry VLAN ${srcVlan}, so ${src.name} can't even reach its router.`, segs, reached: [] };
    }
    segs.push({ from: 'B', to: 'A', tagged: taggedCrossing(s, srcVlan, 'B'), vlan: srcVlan, kind: 'trunk' });
  }
  // A → GW
  if (s.routing === 'router') {
    segs.push({ from: 'A', to: 'GW', tagged: true, vlan: srcVlan, kind: 'gwlink' }); // tagged up the router-on-a-stick link
    segs.push({ from: 'GW', to: 'A', tagged: true, vlan: dstVlan, kind: 'gwlink' }); // routed, back down as dstVlan
  }
  // else L3 switch: SW-A routes internally between SVIs (no hairpin segment)
  // GW/A → dst
  if (d.sw === 'B') {
    if (!trunkCarries(s, dstVlan)) {
      return { ...base, outcome: 'blocked', reason: `trunk can't carry VLAN ${dstVlan} to the destination`, detail: `The router put the packet in VLAN ${dstVlan}, but the trunk doesn't carry VLAN ${dstVlan} to SW-B, so it can't reach ${d.name}.`, segs, reached: [], landedVlan: dstVlan };
    }
    segs.push({ from: 'A', to: 'B', tagged: taggedCrossing(s, dstVlan, 'A'), vlan: dstVlan, kind: 'trunk' });
    segs.push({ from: 'B', to: hkey(dst), tagged: false, vlan: dstVlan, kind: 'access' });
  } else {
    segs.push({ from: 'A', to: hkey(dst), tagged: false, vlan: dstVlan, kind: 'access' });
  }
  return {
    ...base,
    routed: true,
    outcome: 'delivered',
    reason: s.routing === 'router' ? 'routed · router-on-a-stick' : 'routed · L3 switch (SVI)',
    detail: s.routing === 'router' ? `Different VLANs → up to the router tagged VLAN ${srcVlan}, routed ${VLANS[srcVlan]?.subnet}→${VLANS[dstVlan]?.subnet}, back down tagged VLAN ${dstVlan}. The single router link is the bottleneck.` : `Different VLANs → SW-A routes between its SVI for VLAN ${srcVlan} and its SVI for VLAN ${dstVlan} in hardware — no hairpin to an external router.`,
    segs,
    reached: [dst],
    landedVlan: dstVlan,
  };
}

// ── reducer ─────────────────────────────────────────────────────
export type Action =
  | { type: 'SET_VLANS_ENABLED'; on: boolean }
  | { type: 'SET_PORT_VLAN'; hostId: string; vlan: number }
  | { type: 'SET_TRUNK_MODE'; mode: TrunkMode }
  | { type: 'TOGGLE_ALLOWED'; vlan: number }
  | { type: 'SET_LINK_ACCESS_VLAN'; vlan: number }
  | { type: 'SET_NATIVE'; end: SwitchId; vlan: number }
  | { type: 'SET_ROUTING'; mode: Routing }
  | { type: 'TOGGLE_ROUTABLE'; vlan: number }
  | { type: 'SELECT_SRC'; id: string }
  | { type: 'SELECT_DST'; dst: Dst }
  | { type: 'SEND' }
  | { type: 'LOAD_PRESET'; state: Partial<LabState>; label: string }
  | { type: 'RESET' };

function rec(state: LabState, a: ActionRec): ActionRec {
  return { ...a, id: state.nextAction } as ActionRec;
}

export function defaultPortVlan(): Record<string, number> {
  const m: Record<string, number> = {};
  for (const h of HOSTS) m[h.id] = h.intendedVlan;
  return m;
}

export const initialState: LabState = {
  vlansEnabled: true,
  portVlan: defaultPortVlan(),
  trunkMode: 'trunk',
  allowed: [...VLAN_IDS],
  linkAccessVlan: 1,
  nativeA: 1,
  nativeB: 1,
  routing: 'l3',
  routableVlans: [...VLAN_IDS],
  src: 'a1',
  dst: 'b1',
  action: null,
  nextAction: 1,
};

export function reducer(state: LabState, action: Action): LabState {
  const bump = (s: LabState, a: ActionRec): LabState => ({ ...s, action: rec(state, a), nextAction: state.nextAction + 1 });
  const cfg = (s: LabState, msg: string) => bump(s, { id: 0, type: 'config', msg });
  switch (action.type) {
    case 'SET_VLANS_ENABLED':
      return cfg({ ...state, vlansEnabled: action.on }, action.on ? 'VLANs enabled — ports return to their assigned VLANs' : 'VLANs disabled — one flat network (every port in VLAN 1)');
    case 'SET_PORT_VLAN':
      return cfg({ ...state, portVlan: { ...state.portVlan, [action.hostId]: action.vlan } }, `${hostById(action.hostId).name} → access VLAN ${action.vlan}`);
    case 'SET_TRUNK_MODE':
      return cfg({ ...state, trunkMode: action.mode }, action.mode === 'trunk' ? 'inter-switch link → 802.1Q trunk' : 'inter-switch link → access port (misconfig)');
    case 'TOGGLE_ALLOWED': {
      const has = state.allowed.includes(action.vlan);
      const allowed = has ? state.allowed.filter((v) => v !== action.vlan) : [...state.allowed, action.vlan].sort((a, b) => a - b);
      return cfg({ ...state, allowed }, `${has ? 'pruned' : 'allowed'} VLAN ${action.vlan} ${has ? 'from' : 'on'} the trunk`);
    }
    case 'SET_LINK_ACCESS_VLAN':
      return cfg({ ...state, linkAccessVlan: action.vlan }, `access-link VLAN → ${action.vlan}`);
    case 'SET_NATIVE':
      return cfg(action.end === 'A' ? { ...state, nativeA: action.vlan } : { ...state, nativeB: action.vlan }, `SW-${action.end} native VLAN → ${action.vlan}`);
    case 'SET_ROUTING':
      return cfg({ ...state, routing: action.mode }, action.mode === 'none' ? 'inter-VLAN routing removed' : action.mode === 'router' ? 'inter-VLAN routing → router-on-a-stick' : 'inter-VLAN routing → L3 switch (SVIs)');
    case 'TOGGLE_ROUTABLE': {
      const has = state.routableVlans.includes(action.vlan);
      const routableVlans = has ? state.routableVlans.filter((v) => v !== action.vlan) : [...state.routableVlans, action.vlan].sort((a, b) => a - b);
      return cfg({ ...state, routableVlans }, `${has ? 'removed' : 'added'} gateway for VLAN ${action.vlan}`);
    }
    case 'SELECT_SRC':
      return { ...state, src: action.id };
    case 'SELECT_DST':
      return { ...state, dst: action.dst };
    case 'SEND':
      return bump(state, { id: 0, type: 'send', src: state.src, dst: state.dst });
    case 'LOAD_PRESET':
      return bump({ ...state, ...action.state }, { id: 0, type: 'preset', label: action.label });
    case 'RESET':
      return { ...initialState, portVlan: defaultPortVlan(), allowed: [...VLAN_IDS], routableVlans: [...VLAN_IDS], action: rec(state, { id: 0, type: 'preset', label: 'reset to defaults' }), nextAction: state.nextAction + 1 };
    default:
      return state;
  }
}
