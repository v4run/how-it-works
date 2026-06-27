// Datacenter simulation domain model for the NICo interactive lab.
//
// You add bare-metal servers (raw, undiscovered). NICo discovers them and drives
// each through a lifecycle state machine — Detected → Discover (PXE/DHCP) →
// Inventory → Image → Configure → Ready — entirely hands-free. Provisioned
// servers are assigned to tenants; each tenant's traffic flows through a
// BlueField DPU that enforces isolation, so cross-tenant traffic is denied at
// the hardware boundary. Turn DPU enforcement off to see what isolation buys.
//
// This file holds the *staged* configuration (the desired state you declare).
// Runtime lifecycle progress + traffic counters are computed in useSimulation.

import { TENANT_COLORS } from '../design/theme';

export const MAX_SERVERS = 12;
export const MAX_TENANTS = 5;

// Host lifecycle state machine, mirroring NICo's real Day 0 / Day 1 flow
// (https://docs.nvidia.com/infra-controller — Day 0/1/2 lifecycle):
//   Day 0 (bring-up): Detected → Discovery → Validation → DPU Provisioning →
//                     Attestation  (host enters the AVAILABLE pool)
//   Day 1 (config):   OS Provisioning → Isolation → In Service (tenant-ready)
export const STAGES = [
  'Detected',
  'Discovery',
  'Validation',
  'DPU Provisioning',
  'Attestation',
  'OS Provisioning',
  'Isolation',
  'In Service',
] as const;
export type StageName = (typeof STAGES)[number];
// Which lifecycle "day" each stage belongs to (for the dashboard framing).
export const STAGE_DAY = [0, 0, 0, 0, 0, 1, 1, 1];
export const READY_STAGE = STAGES.length - 1; // index of "In Service"
export const AVAILABLE_STAGE = 4; // Day 0 complete → AVAILABLE pool (desired=discovered)

export const HW_TYPES = ['dgx-h100', 'hgx-h200', 'dgx-a100', 'mgx-gb200'];

export type Desired = 'discovered' | 'provisioned';

export interface Server {
  id: string;
  num: number; // stable node number (drives name + identity facts)
  name: string; // node-NN
  hw: string;
  os: string; // OS image id to provision
  desired: Desired;
  tenantId: string | null;
  faultInjected: boolean;
}

export interface Tenant {
  id: string;
  name: string; // Tenant A, Tenant B, …
  color: string;
  vlan: number;
  pkey: string;
}

export interface LabState {
  servers: Server[];
  tenants: Tenant[];
  dpuEnforcement: boolean;
  running: boolean;
  seq: number; // unique id source
  nextNode: number; // next node display number
  nextTenant: number; // next tenant letter index (0 = A)
  resetNonce: number; // bumped on Reset to re-init the sim clock + event log
}

const LETTERS = 'ABCDEFGHIJ';

function makeTenant(seq: number, idx: number): Tenant {
  return {
    id: `tn-${seq}`,
    name: `Tenant ${LETTERS[idx] ?? idx}`,
    color: TENANT_COLORS[idx % TENANT_COLORS.length],
    vlan: 100 + idx * 10,
    pkey: '0x' + (0x8001 + idx).toString(16),
  };
}

function makeServer(seq: number, node: number): Server {
  return {
    id: `srv-${seq}`,
    num: node,
    name: `node-${String(node).padStart(2, '0')}`,
    hw: HW_TYPES[(node - 1) % HW_TYPES.length],
    os: 'dgx-os-6',
    desired: 'provisioned',
    tenantId: null,
    faultInjected: false,
  };
}

// A small starting fleet so the lab isn't empty: four nodes, two tenants, with
// two assignments already declared. Not running — hit Run to provision.
export const initialState: LabState = (() => {
  let s: LabState = { servers: [], tenants: [], dpuEnforcement: true, running: false, seq: 0, nextNode: 1, nextTenant: 0, resetNonce: 0 };
  s = reducer(s, { type: 'addTenant' });
  s = reducer(s, { type: 'addTenant' });
  for (let i = 0; i < 4; i++) s = reducer(s, { type: 'addServer' });
  s = reducer(s, { type: 'assignTenant', id: s.servers[2].id, tenantId: s.tenants[0].id });
  s = reducer(s, { type: 'assignTenant', id: s.servers[3].id, tenantId: s.tenants[1].id });
  return s;
})();

/* ── Actions ────────────────────────────────────────────────────────────── */

export type Action =
  | { type: 'addServer' }
  | { type: 'removeServer'; id: string }
  | { type: 'setDesired'; id: string; desired: Desired }
  | { type: 'setOs'; id: string; os: string }
  | { type: 'assignTenant'; id: string; tenantId: string | null }
  | { type: 'toggleFault'; id: string }
  | { type: 'addTenant' }
  | { type: 'removeTenant'; id: string }
  | { type: 'setDpuEnforcement'; on: boolean }
  | { type: 'toggleRunning' }
  | { type: 'reset' }
  | { type: 'loadPreset'; preset: LabState };

export function reducer(s: LabState, a: Action): LabState {
  switch (a.type) {
    case 'addServer': {
      if (s.servers.length >= MAX_SERVERS) return s;
      const server = makeServer(s.seq, s.nextNode);
      return { ...s, seq: s.seq + 1, nextNode: s.nextNode + 1, servers: [...s.servers, server] };
    }
    case 'removeServer':
      return { ...s, servers: s.servers.filter((x) => x.id !== a.id) };
    case 'setDesired':
      return { ...s, servers: s.servers.map((x) => (x.id === a.id ? { ...x, desired: a.desired } : x)) };
    case 'setOs':
      return { ...s, servers: s.servers.map((x) => (x.id === a.id ? { ...x, os: a.os } : x)) };
    case 'assignTenant':
      return { ...s, servers: s.servers.map((x) => (x.id === a.id ? { ...x, tenantId: a.tenantId } : x)) };
    case 'toggleFault':
      return { ...s, servers: s.servers.map((x) => (x.id === a.id ? { ...x, faultInjected: !x.faultInjected } : x)) };

    case 'addTenant': {
      if (s.tenants.length >= MAX_TENANTS) return s;
      const tenant = makeTenant(s.seq, s.nextTenant);
      return { ...s, seq: s.seq + 1, nextTenant: s.nextTenant + 1, tenants: [...s.tenants, tenant] };
    }
    case 'removeTenant':
      return {
        ...s,
        tenants: s.tenants.filter((t) => t.id !== a.id),
        servers: s.servers.map((x) => (x.tenantId === a.id ? { ...x, tenantId: null } : x)),
      };

    case 'setDpuEnforcement':
      return { ...s, dpuEnforcement: a.on };

    case 'toggleRunning':
      return { ...s, running: !s.running };
    case 'reset':
      return { ...s, running: false, resetNonce: s.resetNonce + 1 };
    case 'loadPreset':
      return { ...a.preset };
    default:
      return s;
  }
}

/* ── Selectors ──────────────────────────────────────────────────────────── */

export function tenantById(s: LabState, id: string | null): Tenant | null {
  if (!id) return null;
  return s.tenants.find((t) => t.id === id) ?? null;
}
