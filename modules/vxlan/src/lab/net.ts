// Pure VXLAN networking logic: control-plane tables (EVPN routes + per-VTEP MAC
// tables) and the plan for a single launched flow — its outcome, the path the
// packet takes, the header stack the ingress VTEP builds, and the step-by-step
// narration. Kept side-effect free so the UI can render it and the simulation
// can animate it deterministically.

import { Host, LabState, Segment, leafLoopback, leafName, segmentById, hostById, shortMac, SPINES } from './model';

export type StepKind = 'ok' | 'warn' | 'err' | 'info';
export interface FlowStep {
  key: string;
  title: string;
  detail: string;
  kind: StepKind;
}

export type ArpMode = 'suppressed' | 'imet-flood' | 'bum-flood' | 'cached' | 'local' | 'none';

export interface HeaderLayer {
  label: string;
  bytes: string;
  value: string;
  kind: 'outer' | 'vxlan' | 'inner';
}

export type PathNode =
  | { type: 'host'; id: string }
  | { type: 'leaf'; idx: number }
  | { type: 'spine'; idx: number };

export interface FlowPlan {
  src: Host;
  dst: Host | null;
  segment: Segment | null;
  outcome: 'delivered' | 'isolated' | 'invalid';
  crossesFabric: boolean;
  intraLeaf: boolean;
  ingressLeaf: number;
  egressLeaf: number;
  spine: number;
  arpMode: ArpMode;
  floodTargets: number[];
  headers: HeaderLayer[] | null;
  fragWarn: boolean;
  pathNodes: PathNode[];
  steps: FlowStep[];
  learns: MacEntry[]; // committed in flood mode when the flow completes
}

export interface MacEntry {
  leafIdx: number; // the VTEP that holds this entry
  mac: string;
  ip: string;
  vni: number;
  vtep: string; // remote VTEP loopback (or 'local')
  remoteLeaf: number;
  local: boolean;
  color: string;
}

export interface EvpnRoute {
  kind: 2 | 3;
  label: string; // "Type 2" / "Type 3"
  vni: number;
  vtep: string;
  leafIdx: number;
  mac?: string;
  ip?: string;
  color: string;
}

// ── EVPN control plane: routes advertised to the route reflector ─────────────
export function evpnRoutes(s: LabState): EvpnRoute[] {
  const routes: EvpnRoute[] = [];
  // Type 2 — one MAC/IP advertisement per host.
  for (const h of s.hosts) {
    const seg = segmentById(s, h.segmentId);
    if (!seg) continue;
    routes.push({
      kind: 2,
      label: 'Type 2',
      vni: seg.vni,
      vtep: leafLoopback(h.leafIdx),
      leafIdx: h.leafIdx,
      mac: h.mac,
      ip: h.ip,
      color: seg.color,
    });
  }
  // Type 3 — inclusive multicast (IMET): "this VTEP is in this VNI".
  const seen = new Set<string>();
  for (const h of s.hosts) {
    const seg = segmentById(s, h.segmentId);
    if (!seg) continue;
    const key = `${h.leafIdx}|${seg.vni}`;
    if (seen.has(key)) continue;
    seen.add(key);
    routes.push({ kind: 3, label: 'Type 3', vni: seg.vni, vtep: leafLoopback(h.leafIdx), leafIdx: h.leafIdx, color: seg.color });
  }
  return routes;
}

// ── Per-VTEP MAC table ───────────────────────────────────────────────────────
// EVPN mode: every leaf knows every host in the VNIs it participates in (from
// Type-2 routes). Flood mode: a leaf only knows what it has learned from
// completed flows (passed in via `learned`).
export function macTables(s: LabState, learned: MacEntry[]): Record<number, MacEntry[]> {
  const out: Record<number, MacEntry[]> = {};
  const leavesWithHosts = Array.from(new Set(s.hosts.map((h) => h.leafIdx)));
  for (const li of leavesWithHosts) out[li] = [];

  if (s.ctrlPlane === 'evpn') {
    // VNIs each leaf participates in.
    const leafVnis: Record<number, Set<string>> = {};
    for (const h of s.hosts) {
      (leafVnis[h.leafIdx] ??= new Set()).add(h.segmentId);
    }
    for (const li of leavesWithHosts) {
      for (const h of s.hosts) {
        const seg = segmentById(s, h.segmentId);
        if (!seg) continue;
        if (!leafVnis[li]?.has(h.segmentId)) continue; // leaf not in this VNI
        out[li].push({
          leafIdx: li,
          mac: h.mac,
          ip: h.ip,
          vni: seg.vni,
          vtep: h.leafIdx === li ? 'local' : leafLoopback(h.leafIdx),
          remoteLeaf: h.leafIdx,
          local: h.leafIdx === li,
          color: seg.color,
        });
      }
    }
  } else {
    // Flood mode: locally-attached hosts are always known; remotes only once learned.
    for (const li of leavesWithHosts) {
      for (const h of s.hosts.filter((x) => x.leafIdx === li)) {
        const seg = segmentById(s, h.segmentId);
        if (!seg) continue;
        out[li].push({ leafIdx: li, mac: h.mac, ip: h.ip, vni: seg.vni, vtep: 'local', remoteLeaf: li, local: true, color: seg.color });
      }
    }
    for (const e of learned) {
      (out[e.leafIdx] ??= []).push(e);
    }
  }
  return out;
}

const macKey = (leafIdx: number, mac: string) => `${leafIdx}|${mac}`;

// ── Plan a single flow ───────────────────────────────────────────────────────
export function planFlow(s: LabState, learnedKeys: Set<string>): FlowPlan | null {
  const src = hostById(s, s.srcHostId);
  const dst = hostById(s, s.dstHostId);
  if (!src) return null;

  const srcSeg = segmentById(s, src.segmentId);
  const ingressLeaf = src.leafIdx;
  const spine = 0;

  const base: Omit<FlowPlan, 'outcome' | 'steps' | 'headers' | 'pathNodes' | 'arpMode' | 'floodTargets' | 'learns' | 'fragWarn' | 'crossesFabric' | 'intraLeaf' | 'egressLeaf'> = {
    src,
    dst,
    segment: srcSeg,
    ingressLeaf,
    spine,
  };

  // No destination chosen.
  if (!dst || dst.id === src.id) {
    return {
      ...base,
      dst,
      outcome: 'invalid',
      crossesFabric: false,
      intraLeaf: true,
      egressLeaf: ingressLeaf,
      arpMode: 'none',
      floodTargets: [],
      headers: null,
      fragWarn: false,
      pathNodes: [{ type: 'host', id: src.id }],
      learns: [],
      steps: [{ key: 'pick', title: 'Pick a destination', detail: 'Choose a different host to send a frame to.', kind: 'info' }],
    };
  }

  const dstSeg = segmentById(s, dst.segmentId);
  const egressLeaf = dst.leafIdx;
  const crossesFabric = ingressLeaf !== egressLeaf;
  const intraLeaf = !crossesFabric;

  // Different VNI → isolated. VXLAN keeps L2 domains apart; reaching across
  // would require routing (an L3 VNI / VRF), which these segments don't share.
  if (!srcSeg || !dstSeg || srcSeg.id !== dstSeg.id) {
    return {
      ...base,
      dst,
      outcome: 'isolated',
      crossesFabric,
      intraLeaf,
      egressLeaf,
      arpMode: 'none',
      floodTargets: [],
      headers: null,
      fragWarn: false,
      pathNodes: [{ type: 'host', id: src.id }, { type: 'leaf', idx: ingressLeaf }],
      learns: [],
      steps: [
        { key: 'lookup', title: 'Ingress VTEP lookup', detail: `${leafName(ingressLeaf)} looks for ${shortMac(dst.mac)} in VNI ${srcSeg?.vni ?? '—'}.`, kind: 'info' },
        {
          key: 'blocked',
          title: 'Different VNI — isolated',
          detail: `${src.name} is on VNI ${srcSeg?.vni}, ${dst.name} on VNI ${dstSeg?.vni}. Separate L2 domains never mix; crossing needs an L3 VNI / VRF router.`,
          kind: 'err',
        },
      ],
    };
  }

  // Same VNI — it will be delivered. Work out ARP resolution + path + headers.
  const seg = srcSeg;
  const steps: FlowStep[] = [];

  // 1) MAC resolution phase
  let arpMode: ArpMode;
  let floodTargets: number[] = [];
  const knows = s.ctrlPlane === 'evpn' || intraLeaf || learnedKeys.has(macKey(ingressLeaf, dst.mac));

  if (intraLeaf) {
    arpMode = 'local';
  } else if (s.ctrlPlane === 'evpn') {
    arpMode = s.arpSuppression ? 'suppressed' : 'imet-flood';
  } else {
    arpMode = knows ? 'cached' : 'bum-flood';
  }

  if (intraLeaf) {
    steps.push({ key: 'local', title: 'Local switching', detail: `Both hosts hang off ${leafName(ingressLeaf)} — the frame is bridged locally. No VXLAN, no fabric.`, kind: 'ok' });
  } else if (arpMode === 'suppressed') {
    steps.push({ key: 'arp', title: 'ARP suppressed at the leaf', detail: `${src.name} ARPs for ${dst.ip}. ${leafName(ingressLeaf)} answers locally (${shortMac(dst.mac)}) from its EVPN Type-2 cache — no flood.`, kind: 'ok' });
  } else if (arpMode === 'imet-flood') {
    floodTargets = otherLeavesInSegment(s, seg.id, ingressLeaf);
    steps.push({ key: 'arp', title: 'ARP via ingress replication', detail: `Suppression off: the broadcast is unicast-replicated only to VTEPs in VNI ${seg.vni} (the Type-3 IMET list): ${floodTargets.map(leafName).join(', ') || 'none'}.`, kind: 'warn' });
  } else if (arpMode === 'cached') {
    steps.push({ key: 'arp', title: 'MAC already learned', detail: `${leafName(ingressLeaf)} learned ${shortMac(dst.mac)} → ${leafLoopback(egressLeaf)} from an earlier flood. No re-flood.`, kind: 'ok' });
  } else {
    // bum-flood
    floodTargets = otherLeavesInSegment(s, seg.id, ingressLeaf);
    steps.push({ key: 'flood', title: 'BUM flood (unknown MAC)', detail: `No control plane: ${leafName(ingressLeaf)} floods the unknown-unicast to every VTEP in VNI ${seg.vni}: ${floodTargets.map(leafName).join(', ') || 'none'}. It learns ${shortMac(dst.mac)} from the reply.`, kind: 'warn' });
  }

  // 2) Encap / forward / decap
  let headers: HeaderLayer[] | null = null;
  let fragWarn = false;
  const learns: MacEntry[] = [];

  if (intraLeaf) {
    // No encapsulation at all.
    headers = [
      { label: 'Ethernet frame', bytes: 'L2', value: `${shortMac(src.mac)} → ${shortMac(dst.mac)}`, kind: 'inner' },
      { label: 'IP', bytes: '', value: `${src.ip} → ${dst.ip}`, kind: 'inner' },
      { label: 'payload', bytes: '', value: 'unchanged', kind: 'inner' },
    ];
  } else {
    headers = [
      { label: 'Outer Ethernet', bytes: '14 B', value: `${leafName(ingressLeaf)} ↔ spine`, kind: 'outer' },
      { label: 'Outer IP', bytes: '20 B', value: `${leafLoopback(ingressLeaf)} → ${leafLoopback(egressLeaf)}`, kind: 'outer' },
      { label: 'UDP', bytes: '8 B', value: 'dst port 4789', kind: 'outer' },
      { label: 'VXLAN', bytes: '8 B', value: `VNI ${seg.vni}`, kind: 'vxlan' },
      { label: 'Inner frame', bytes: '—', value: `${shortMac(src.mac)} → ${shortMac(dst.mac)}`, kind: 'inner' },
    ];
    steps.push({ key: 'encap', title: 'Encapsulate (MAC-in-UDP)', detail: `${leafName(ingressLeaf)} wraps the frame: VXLAN(VNI ${seg.vni}) / UDP 4789 / IP ${leafLoopback(ingressLeaf)}→${leafLoopback(egressLeaf)}. +50 bytes.`, kind: 'info' });
    fragWarn = !s.jumbo;
    if (fragWarn) {
      steps.push({ key: 'mtu', title: 'MTU too small', detail: 'Underlay (L3) MTU is 1500. A full 1500-byte inner frame + 50 B overlay = 1550 B > 1500 → the encapsulated packet must fragment into multiple IP packets, or — since VTEPs usually set the outer DF bit — is silently dropped. Raise the underlay to jumbo (9000).', kind: 'warn' });
    }
    steps.push({ key: 'ecmp', title: 'Underlay routing (ECMP)', detail: `Spine routes it as ordinary IP toward ${leafLoopback(egressLeaf)}, hashing the UDP source port to spread load. Spines never see the VNI.`, kind: 'info' });
    steps.push({ key: 'decap', title: 'Decapsulate', detail: `${leafName(egressLeaf)} strips the outer headers, reads VNI ${seg.vni}, and recovers the original frame.`, kind: 'info' });

    // Flood mode learns the remote MAC on both ends after the exchange.
    if (s.ctrlPlane === 'flood') {
      learns.push({ leafIdx: ingressLeaf, mac: dst.mac, ip: dst.ip, vni: seg.vni, vtep: leafLoopback(egressLeaf), remoteLeaf: egressLeaf, local: false, color: seg.color });
      learns.push({ leafIdx: egressLeaf, mac: src.mac, ip: src.ip, vni: seg.vni, vtep: leafLoopback(ingressLeaf), remoteLeaf: ingressLeaf, local: false, color: seg.color });
    }
  }
  steps.push({ key: 'deliver', title: 'Deliver', detail: `${dst.name} receives the original Ethernet frame, untouched.`, kind: 'ok' });

  const pathNodes: PathNode[] = intraLeaf
    ? [{ type: 'host', id: src.id }, { type: 'leaf', idx: ingressLeaf }, { type: 'host', id: dst.id }]
    : [
        { type: 'host', id: src.id },
        { type: 'leaf', idx: ingressLeaf },
        { type: 'spine', idx: spine },
        { type: 'leaf', idx: egressLeaf },
        { type: 'host', id: dst.id },
      ];

  return {
    ...base,
    dst,
    outcome: 'delivered',
    crossesFabric,
    intraLeaf,
    egressLeaf,
    arpMode,
    floodTargets,
    headers,
    fragWarn,
    pathNodes,
    learns,
    steps,
  };
}

function otherLeavesInSegment(s: LabState, segId: string, exclude: number): number[] {
  return Array.from(new Set(s.hosts.filter((h) => h.segmentId === segId && h.leafIdx !== exclude).map((h) => h.leafIdx))).sort((a, b) => a - b);
}

export const macKeyOf = macKey;
export { SPINES };
