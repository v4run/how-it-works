// VXLAN interactive lab — domain model.
//
// You build a virtual network on a fixed spine-leaf underlay: create virtual
// L2 segments (VNIs), drop hosts onto leaf switches (the VTEPs) and put each
// host on a segment. Then send a frame between two hosts and watch the VTEP
// encapsulate it (MAC-in-UDP), route it over the underlay, and decapsulate it
// on the far side — with VNI isolation, EVPN control-plane learning (or
// flood-and-learn), and ARP suppression all observable live.
//
// This file holds the *declared* state. Reachability tables, the in-flight
// packet and the event log are derived in net.ts + useSimulation.ts.

import { SEGMENT_COLORS } from '../design/theme';

export const MAX_HOSTS = 10;
export const MAX_SEGMENTS = 4;

// ── Fixed underlay: a small Clos fabric ──────────────────────────────────────
export const SPINES = 2;
export const LEAVES = 4;
// Each leaf is a VTEP with a loopback in the underlay (10.1.1.X).
export const leafLoopback = (i: number) => `10.1.1.${i + 1}`;
export const leafName = (i: number) => `Leaf-${i + 1}`;

export type CtrlPlane = 'evpn' | 'flood';

export interface Segment {
  id: string;
  vni: number; // 24-bit VXLAN Network Identifier
  name: string; // tenant / segment label
  color: string;
  subnet: number; // third octet → 10.0.<subnet>.0/24
}

export interface Host {
  id: string;
  num: number; // stable global host number
  name: string; // h01, h02 …
  mac: string; // full MAC
  ip: string; // overlay IP inside its segment subnet
  leafIdx: number; // which leaf/VTEP it hangs off
  segmentId: string; // which VNI it lives on
}

export interface LabState {
  segments: Segment[];
  hosts: Host[];
  ctrlPlane: CtrlPlane;
  arpSuppression: boolean; // EVPN proxy-ARP at the leaf
  jumbo: boolean; // fabric MTU 9000 vs 1500
  seq: number;
  nextHost: number;
  nextSeg: number;
  // The flow the user has launched (or is composing).
  srcHostId: string | null;
  dstHostId: string | null;
  flowNonce: number; // bumped to (re)launch the active flow animation
}

const macFor = (num: number) => {
  const h = num.toString(16).padStart(2, '0');
  return `02:1a:7c:00:00:${h}`;
};

let _sub = 10;
function makeSegment(seq: number, idx: number): Segment {
  const names = ['web', 'db', 'app', 'storage'];
  return {
    id: `seg-${seq}`,
    vni: 10010 + idx * 10,
    name: names[idx] ?? `seg-${idx}`,
    color: SEGMENT_COLORS[idx % SEGMENT_COLORS.length],
    subnet: _sub + idx,
  };
}

function makeHost(seq: number, num: number, leafIdx: number, seg: Segment): Host {
  return {
    id: `h-${seq}`,
    num,
    name: `h${String(num).padStart(2, '0')}`,
    mac: macFor(num),
    ip: `10.0.${seg.subnet}.${num + 9}`,
    leafIdx,
    segmentId: seg.id,
  };
}

// Short MAC label for tight table cells (last two bytes).
export const shortMac = (mac: string) => mac.split(':').slice(-2).join(':');

export const segmentById = (s: LabState, id: string | null): Segment | null =>
  id ? s.segments.find((x) => x.id === id) ?? null : null;
export const hostById = (s: LabState, id: string | null): Host | null =>
  id ? s.hosts.find((x) => x.id === id) ?? null : null;

// Hosts on a leaf, hosts in a segment.
export const hostsOnLeaf = (s: LabState, leafIdx: number) => s.hosts.filter((h) => h.leafIdx === leafIdx);
export const leavesInSegment = (s: LabState, segId: string) =>
  Array.from(new Set(s.hosts.filter((h) => h.segmentId === segId).map((h) => h.leafIdx))).sort((a, b) => a - b);

// ── Starting scenario ────────────────────────────────────────────────────────
// Two segments, four hosts spread across leaves so a same-VNI flow already
// crosses the fabric (Leaf-1 → Leaf-3) out of the box.
export const initialState: LabState = (() => {
  let s: LabState = {
    segments: [],
    hosts: [],
    ctrlPlane: 'evpn',
    arpSuppression: true,
    jumbo: true,
    seq: 0,
    nextHost: 1,
    nextSeg: 0,
    srcHostId: null,
    dstHostId: null,
    flowNonce: 0,
  };
  s = reducer(s, { type: 'addSegment' }); // web  (VNI 10010)
  s = reducer(s, { type: 'addSegment' }); // db   (VNI 10020)
  s = reducer(s, { type: 'addHost', leafIdx: 0, segmentId: s.segments[0].id }); // h01 web @ Leaf-1
  s = reducer(s, { type: 'addHost', leafIdx: 2, segmentId: s.segments[0].id }); // h02 web @ Leaf-3
  s = reducer(s, { type: 'addHost', leafIdx: 1, segmentId: s.segments[1].id }); // h03 db  @ Leaf-2
  s = reducer(s, { type: 'addHost', leafIdx: 3, segmentId: s.segments[1].id }); // h04 db  @ Leaf-4
  s = { ...s, srcHostId: s.hosts[0].id, dstHostId: s.hosts[1].id };
  return s;
})();

/* ── Actions ────────────────────────────────────────────────────────────── */
export type Action =
  | { type: 'addSegment' }
  | { type: 'removeSegment'; id: string }
  | { type: 'addHost'; leafIdx?: number; segmentId?: string }
  | { type: 'removeHost'; id: string }
  | { type: 'moveHost'; id: string; leafIdx: number } // VM mobility
  | { type: 'setHostSegment'; id: string; segmentId: string }
  | { type: 'setCtrlPlane'; plane: CtrlPlane }
  | { type: 'setArpSuppression'; on: boolean }
  | { type: 'setJumbo'; on: boolean }
  | { type: 'setSrc'; id: string }
  | { type: 'setDst'; id: string }
  | { type: 'sendFlow' }
  | { type: 'reset' }
  | { type: 'loadPreset'; preset: LabState };

function autoLeaf(s: LabState): number {
  // Spread hosts: pick the leaf with the fewest hosts.
  const counts = Array.from({ length: LEAVES }, (_, i) => hostsOnLeaf(s, i).length);
  let best = 0;
  for (let i = 1; i < LEAVES; i++) if (counts[i] < counts[best]) best = i;
  return best;
}

export function reducer(s: LabState, a: Action): LabState {
  switch (a.type) {
    case 'addSegment': {
      if (s.segments.length >= MAX_SEGMENTS) return s;
      const seg = makeSegment(s.seq, s.nextSeg);
      return { ...s, seq: s.seq + 1, nextSeg: s.nextSeg + 1, segments: [...s.segments, seg] };
    }
    case 'removeSegment': {
      if (s.segments.length <= 1) return s;
      const hosts = s.hosts.filter((h) => h.segmentId !== a.id);
      return clampFlow({ ...s, segments: s.segments.filter((x) => x.id !== a.id), hosts });
    }
    case 'addHost': {
      if (s.hosts.length >= MAX_HOSTS || s.segments.length === 0) return s;
      const segId = a.segmentId ?? s.segments[0].id;
      const seg = s.segments.find((x) => x.id === segId) ?? s.segments[0];
      const leafIdx = a.leafIdx ?? autoLeaf(s);
      const host = makeHost(s.seq, s.nextHost, leafIdx, seg);
      const next = { ...s, seq: s.seq + 1, nextHost: s.nextHost + 1, hosts: [...s.hosts, host] };
      // Seed src/dst selection if empty.
      if (!next.srcHostId) next.srcHostId = host.id;
      else if (!next.dstHostId && host.id !== next.srcHostId) next.dstHostId = host.id;
      return next;
    }
    case 'removeHost':
      return clampFlow({ ...s, hosts: s.hosts.filter((x) => x.id !== a.id) });
    case 'moveHost':
      return { ...s, hosts: s.hosts.map((x) => (x.id === a.id ? { ...x, leafIdx: a.leafIdx } : x)) };
    case 'setHostSegment': {
      const seg = s.segments.find((x) => x.id === a.segmentId);
      if (!seg) return s;
      return {
        ...s,
        hosts: s.hosts.map((x) => (x.id === a.id ? { ...x, segmentId: a.segmentId, ip: `10.0.${seg.subnet}.${x.num + 9}` } : x)),
      };
    }
    case 'setCtrlPlane':
      return { ...s, ctrlPlane: a.plane };
    case 'setArpSuppression':
      return { ...s, arpSuppression: a.on };
    case 'setJumbo':
      return { ...s, jumbo: a.on };
    case 'setSrc':
      return { ...s, srcHostId: a.id };
    case 'setDst':
      return { ...s, dstHostId: a.id };
    case 'sendFlow':
      return { ...s, flowNonce: s.flowNonce + 1 };
    case 'reset':
      return initialState;
    case 'loadPreset':
      return { ...a.preset };
    default:
      return s;
  }
}

// Keep src/dst selections pointing at hosts that still exist.
function clampFlow(s: LabState): LabState {
  const has = (id: string | null) => !!id && s.hosts.some((h) => h.id === id);
  return {
    ...s,
    srcHostId: has(s.srcHostId) ? s.srcHostId : s.hosts[0]?.id ?? null,
    dstHostId: has(s.dstHostId) ? s.dstHostId : s.hosts[1]?.id ?? s.hosts[0]?.id ?? null,
  };
}
