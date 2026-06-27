// Ready-made scenarios. Each returns a full LabState built from actions so the
// invariants (ids, host numbers, subnets) stay consistent.

import { LabState, reducer, CtrlPlane } from './model';

interface Spec {
  segments: number; // how many VNIs
  hosts: { leaf: number; seg: number }[];
  ctrlPlane: CtrlPlane;
  arpSuppression: boolean;
  jumbo: boolean;
  src: number; // host index
  dst: number;
}

function build(spec: Spec): LabState {
  let s: LabState = {
    segments: [],
    hosts: [],
    ctrlPlane: spec.ctrlPlane,
    arpSuppression: spec.arpSuppression,
    jumbo: spec.jumbo,
    seq: 0,
    nextHost: 1,
    nextSeg: 0,
    srcHostId: null,
    dstHostId: null,
    flowNonce: 0,
  };
  for (let i = 0; i < spec.segments; i++) s = reducer(s, { type: 'addSegment' });
  for (const h of spec.hosts) s = reducer(s, { type: 'addHost', leafIdx: h.leaf, segmentId: s.segments[h.seg].id });
  s = { ...s, srcHostId: s.hosts[spec.src]?.id ?? null, dstHostId: s.hosts[spec.dst]?.id ?? null };
  return s;
}

export interface Preset {
  id: string;
  name: string;
  blurb: string;
  make: () => LabState;
}

export const PRESETS: Preset[] = [
  {
    id: 'same-vni',
    name: 'Same VNI, across the fabric',
    blurb: 'Two hosts on VNI 10010, different leaves — the canonical encapsulated hop.',
    make: () => build({ segments: 2, hosts: [{ leaf: 0, seg: 0 }, { leaf: 2, seg: 0 }, { leaf: 1, seg: 1 }, { leaf: 3, seg: 1 }], ctrlPlane: 'evpn', arpSuppression: true, jumbo: true, src: 0, dst: 1 }),
  },
  {
    id: 'isolation',
    name: 'Cross-VNI isolation',
    blurb: 'Source and destination on different VNIs — the VTEP drops it. Segments never mix.',
    make: () => build({ segments: 2, hosts: [{ leaf: 0, seg: 0 }, { leaf: 2, seg: 1 }, { leaf: 1, seg: 0 }, { leaf: 3, seg: 1 }], ctrlPlane: 'evpn', arpSuppression: true, jumbo: true, src: 0, dst: 1 }),
  },
  {
    id: 'flood',
    name: 'Flood-and-learn',
    blurb: 'No control plane: the first unknown-unicast floods every VTEP in the VNI, then the leaf learns.',
    make: () => build({ segments: 2, hosts: [{ leaf: 0, seg: 0 }, { leaf: 1, seg: 0 }, { leaf: 2, seg: 0 }, { leaf: 3, seg: 1 }], ctrlPlane: 'flood', arpSuppression: true, jumbo: true, src: 0, dst: 2 }),
  },
  {
    id: 'arp',
    name: 'ARP suppression on/off',
    blurb: 'EVPN already knows every MAC — toggle suppression and re-send to see the leaf proxy the ARP vs replicate it.',
    make: () => build({ segments: 1, hosts: [{ leaf: 0, seg: 0 }, { leaf: 1, seg: 0 }, { leaf: 2, seg: 0 }, { leaf: 3, seg: 0 }], ctrlPlane: 'evpn', arpSuppression: false, jumbo: true, src: 0, dst: 3 }),
  },
  {
    id: 'mtu',
    name: 'MTU / fragmentation',
    blurb: 'Fabric MTU at 1500 — the +50 B of overlay overhead overflows it. Flip to jumbo to fix it.',
    make: () => build({ segments: 1, hosts: [{ leaf: 0, seg: 0 }, { leaf: 3, seg: 0 }], ctrlPlane: 'evpn', arpSuppression: true, jumbo: false, src: 0, dst: 1 }),
  },
  {
    id: 'local',
    name: 'Two hosts, one leaf',
    blurb: 'Both hosts hang off the same VTEP — bridged locally, no VXLAN, no fabric hop at all.',
    make: () => build({ segments: 1, hosts: [{ leaf: 1, seg: 0 }, { leaf: 1, seg: 0 }, { leaf: 3, seg: 0 }], ctrlPlane: 'evpn', arpSuppression: true, jumbo: true, src: 0, dst: 1 }),
  },
];
