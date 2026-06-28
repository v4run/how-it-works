// GPU simulation domain model for the interactive lab.
// Models an A100-40GB: 7 compute slices (GPC/SM columns) + 8 memory slices (HBM2e).
//
// Three partitioning modes:
//   - MIG        : spatial — GPU Instances own dedicated, contiguous compute
//                  slices. Instances run concurrently; a fault is contained.
//   - vGPU       : temporal — VMs share the whole SM array via a time-slice
//                  scheduler. Memory is statically carved; a hung context can
//                  stall every tenant.
//   - MIG-backed : each MIG slice backs 1..N time-sliced vGPUs (NVIDIA "MIG
//                  time-slicing"). Across slices: parallel + hardware-isolated.
//                  Within a slice with >1 vGPU: time-sliced, so a hung vGPU
//                  stalls only its slice-mates — never another slice.

import { C, VM_COLORS } from '../design/theme';

export const TOTAL_COMPUTE = 7;
export const TOTAL_MEM_GB = 40;
export const MEM_SLICES = 8;
export const MAX_VGPU_PER_SLICE = 3;

export type Mode = 'mig' | 'vgpu' | 'mig-vgpu';
export type SchedPolicy = 'best-effort' | 'equal-share' | 'fixed-share';
export type WorkloadKind = 'inference' | 'training' | 'render' | 'idle';

export interface WorkloadDef {
  kind: WorkloadKind;
  demand: number;
}

export const WORKLOADS: Record<WorkloadKind, { label: string; demand: number; hint: string }> = {
  idle: { label: 'Idle', demand: 0, hint: 'no kernels submitted' },
  inference: { label: 'Inference', demand: 0.55, hint: 'bursty, latency-sensitive' },
  render: { label: 'Render / VDI', demand: 0.7, hint: 'steady framebuffer churn' },
  training: { label: 'Training', demand: 1.0, hint: 'saturates compute' },
};

export interface MigProfile {
  id: string;
  g: number;
  gb: number;
}
export const MIG_PROFILES: MigProfile[] = [
  { id: '1g.5gb', g: 1, gb: 5 },
  { id: '1g.10gb', g: 1, gb: 10 },
  { id: '2g.10gb', g: 2, gb: 10 },
  { id: '3g.20gb', g: 3, gb: 20 },
  { id: '4g.20gb', g: 4, gb: 20 },
  { id: '7g.40gb', g: 7, gb: 40 },
];

export interface VgpuProfile {
  id: string;
  fb: number;
}
export const VGPU_PROFILES: VgpuProfile[] = [
  { id: 'A100-4C', fb: 4 },
  { id: 'A100-5C', fb: 5 },
  { id: 'A100-8C', fb: 8 },
  { id: 'A100-10C', fb: 10 },
  { id: 'A100-20C', fb: 20 },
  { id: 'A100-40C', fb: 40 },
];

// A time-sliced vGPU living on a MIG slice (MIG-backed mode).
export interface SliceVgpu {
  id: string;
  name: string;
  color: string;
  fb: number; // framebuffer GB carved from the slice
  workload: WorkloadDef;
  hung: boolean;
}

export interface MigInstance {
  id: string;
  profileId: string;
  cols: number[];
  gb: number;
  color: string;
  workload: WorkloadDef; // used in pure MIG mode (bare CUDA on the instance)
  faulted: boolean; // XID hardware fault — halts the whole slice
  vgpus: SliceVgpu[]; // MIG-backed mode: 1..MAX time-sliced vGPUs on this slice
}

export interface VM {
  id: string;
  name: string;
  profileId: string;
  fb: number;
  color: string;
  workload: WorkloadDef;
  hung: boolean;
  share: number;
}

export interface LabState {
  mode: Mode;
  scheduler: SchedPolicy;
  quantumMs: number;
  instances: MigInstance[];
  vms: VM[];
  running: boolean;
  seq: number;
}

export const initialState: LabState = {
  mode: 'mig',
  scheduler: 'equal-share',
  quantumMs: 1000,
  instances: [],
  vms: [],
  running: false,
  seq: 0,
};

/* ── Allocation helpers ─────────────────────────────────────────────────── */

export function usedCompute(s: LabState): number {
  return s.instances.reduce((a, i) => a + i.cols.length, 0);
}
export function usedMigMem(s: LabState): number {
  return s.instances.reduce((a, i) => a + i.gb, 0);
}
export function usedVgpuMem(s: LabState): number {
  return s.vms.reduce((a, v) => a + v.fb, 0);
}
export function totalSliceVgpus(s: LabState): number {
  return s.instances.reduce((a, i) => a + i.vgpus.length, 0);
}

// Real A100 MIG GPU-instance placements (as reported by
// `nvidia-smi mig -lgipp`): the *valid start slots* for each profile. A
// GPU instance can't begin at an arbitrary index — e.g. a 2g.10gb may only
// start at slot 0, 2 or 4 (the compute slices pair up (0,1)(2,3)(4,5), with
// slice 6 left over for a 1g), a 3g.20gb only at 0 or 4, and a 4g/7g only at 0.
export const PLACEMENTS: Record<string, number[]> = {
  '1g.5gb': [0, 1, 2, 3, 4, 5, 6],
  '1g.10gb': [0, 2, 4, 6],
  '2g.10gb': [0, 2, 4],
  '3g.20gb': [0, 4],
  '4g.20gb': [0],
  '7g.40gb': [0],
};

// First legal, free placement for a profile (lowest start, like nvidia-smi's
// default), honouring both the valid-start set and the occupied columns.
export function findPlacement(s: LabState, profile: MigProfile): number[] | null {
  const occupied = new Set<number>();
  for (const inst of s.instances) inst.cols.forEach((c) => occupied.add(c));
  for (const start of PLACEMENTS[profile.id] ?? []) {
    const cols: number[] = [];
    let ok = true;
    for (let k = 0; k < profile.g; k++) {
      const c = start + k;
      if (c >= TOTAL_COMPUTE || occupied.has(c)) {
        ok = false;
        break;
      }
      cols.push(c);
    }
    if (ok) return cols;
  }
  return null;
}

export interface PlaceResult {
  ok: boolean;
  reason?: string;
  cols?: number[];
}
export function canPlaceMig(s: LabState, profile: MigProfile): PlaceResult {
  if (usedMigMem(s) + profile.gb > TOTAL_MEM_GB)
    return { ok: false, reason: `Only ${TOTAL_MEM_GB - usedMigMem(s)} GB framebuffer free` };
  const block = findPlacement(s, profile);
  if (!block) {
    if (usedCompute(s) + profile.g > TOTAL_COMPUTE)
      return { ok: false, reason: `Only ${TOTAL_COMPUTE - usedCompute(s)} compute slice(s) free` };
    const starts = PLACEMENTS[profile.id] ?? [];
    return { ok: false, reason: `No aligned placement free — ${profile.id} may start only at slot ${starts.join('/')}` };
  }
  return { ok: true, cols: block };
}

export function canPlaceVgpu(s: LabState, profile: VgpuProfile): PlaceResult {
  if (usedVgpuMem(s) + profile.fb > TOTAL_MEM_GB)
    return { ok: false, reason: `Only ${TOTAL_MEM_GB - usedVgpuMem(s)} GB framebuffer free` };
  return { ok: true };
}

export function migMemStrip(s: LabState): (string | null)[] {
  // One cell per 5 GB memory slice. Each instance lights the slices its
  // framebuffer actually occupies — a 7g.40gb fills all 8, a 3g.20gb fills 4.
  const strip: (string | null)[] = Array(MEM_SLICES).fill(null);
  let idx = 0;
  for (const inst of s.instances) {
    const slices = Math.max(1, Math.round(inst.gb / 5));
    for (let k = 0; k < slices && idx < MEM_SLICES; k++) strip[idx++] = inst.color;
  }
  // The A100 has 8 memory slices but only 7 compute slices. Once every compute
  // slice is allocated, any still-free memory slice can't be paired with one,
  // so it's stranded (unusable) — e.g. 7× 1g.5gb leaves the 8th slice's 5 GB
  // unreachable. Larger profiles (3g.20gb, 7g.40gb…) claim the extra slice, so
  // nothing is stranded then.
  if (usedCompute(s) >= TOTAL_COMPUTE) {
    for (let j = 0; j < MEM_SLICES; j++) if (strip[j] == null) strip[j] = 'stranded';
  }
  return strip;
}

export function vgpuMemStrip(s: LabState): (string | null)[] {
  const strip: (string | null)[] = Array(MEM_SLICES).fill(null);
  let idx = 0;
  for (const vm of s.vms) {
    const slices = Math.max(1, Math.round((vm.fb / TOTAL_MEM_GB) * MEM_SLICES));
    for (let k = 0; k < slices && idx < MEM_SLICES; k++) strip[idx++] = vm.color;
  }
  return strip;
}

/* ── vGPU construction helpers (MIG-backed) ─────────────────────────────── */

// Evenly split a slice's framebuffer across its vGPUs.
function rebalanceFb(inst: MigInstance): MigInstance {
  const n = inst.vgpus.length || 1;
  const each = Math.round((inst.gb / n) * 10) / 10;
  return { ...inst, vgpus: inst.vgpus.map((v) => ({ ...v, fb: each })) };
}

function makeSliceVgpu(seq: number, globalIdx: number, fb: number): SliceVgpu {
  return {
    id: `sv-${seq}`,
    name: `VM ${globalIdx}`,
    color: VM_COLORS[globalIdx % VM_COLORS.length],
    fb,
    workload: { kind: 'idle', demand: 0 },
    hung: false,
  };
}

/* ── Reducer ────────────────────────────────────────────────────────────── */

export type Action =
  | { type: 'setMode'; mode: Mode }
  | { type: 'setScheduler'; scheduler: SchedPolicy }
  | { type: 'setQuantum'; quantumMs: number }
  | { type: 'addMig'; profileId: string }
  | { type: 'removeMig'; id: string }
  | { type: 'setMigWorkload'; id: string; kind: WorkloadKind }
  | { type: 'toggleFault'; id: string }
  | { type: 'addSliceVgpu'; instId: string }
  | { type: 'removeSliceVgpu'; instId: string; vgpuId: string }
  | { type: 'setSliceVgpuWorkload'; instId: string; vgpuId: string; kind: WorkloadKind }
  | { type: 'toggleSliceVgpuHang'; instId: string; vgpuId: string }
  | { type: 'addVgpu'; profileId: string }
  | { type: 'removeVgpu'; id: string }
  | { type: 'setVmWorkload'; id: string; kind: WorkloadKind }
  | { type: 'toggleHang'; id: string }
  | { type: 'setVmShare'; id: string; share: number }
  | { type: 'toggleRunning' }
  | { type: 'reset' }
  | { type: 'loadPreset'; preset: LabState };

const sortByCol = (a: MigInstance, b: MigInstance) => a.cols[0] - b.cols[0];

export function reducer(s: LabState, a: Action): LabState {
  switch (a.type) {
    case 'setMode': {
      if (a.mode === s.mode) return s;
      // Entering MIG-backed: every slice gets at least one vGPU (1:1 default).
      let seq = s.seq;
      let g = totalSliceVgpus(s);
      const instances =
        a.mode === 'mig-vgpu'
          ? s.instances.map((i) => {
              if (i.vgpus.length > 0) return i;
              const vg = makeSliceVgpu(seq++, g++, i.gb);
              return rebalanceFb({ ...i, vgpus: [vg] });
            })
          : s.instances;
      return { ...s, mode: a.mode, seq, instances, running: false };
    }
    case 'setScheduler':
      return { ...s, scheduler: a.scheduler };
    case 'setQuantum':
      return { ...s, quantumMs: a.quantumMs };

    case 'addMig': {
      const profile = MIG_PROFILES.find((p) => p.id === a.profileId);
      if (!profile) return s;
      const res = canPlaceMig(s, profile);
      if (!res.ok || !res.cols) return s;
      let seq = s.seq;
      const id = `gi-${seq++}`;
      const color = MIG_TINTS[s.instances.length % MIG_TINTS.length];
      let inst: MigInstance = {
        id,
        profileId: profile.id,
        cols: res.cols,
        gb: profile.gb,
        color,
        workload: { kind: 'idle', demand: 0 },
        faulted: false,
        vgpus: [],
      };
      if (s.mode === 'mig-vgpu') {
        const vg = makeSliceVgpu(seq++, totalSliceVgpus(s), profile.gb);
        inst = rebalanceFb({ ...inst, vgpus: [vg] });
      }
      return { ...s, seq, instances: [...s.instances, inst].sort(sortByCol) };
    }
    case 'removeMig':
      return { ...s, instances: s.instances.filter((i) => i.id !== a.id) };
    case 'setMigWorkload':
      return {
        ...s,
        instances: s.instances.map((i) =>
          i.id === a.id ? { ...i, workload: { kind: a.kind, demand: WORKLOADS[a.kind].demand } } : i,
        ),
      };
    case 'toggleFault':
      return { ...s, instances: s.instances.map((i) => (i.id === a.id ? { ...i, faulted: !i.faulted } : i)) };

    case 'addSliceVgpu': {
      let seq = s.seq;
      const instances = s.instances.map((i) => {
        if (i.id !== a.instId || i.vgpus.length >= MAX_VGPU_PER_SLICE) return i;
        const vg = makeSliceVgpu(seq++, totalSliceVgpus(s), i.gb);
        return rebalanceFb({ ...i, vgpus: [...i.vgpus, vg] });
      });
      return { ...s, seq, instances };
    }
    case 'removeSliceVgpu':
      return {
        ...s,
        instances: s.instances.map((i) =>
          i.id === a.instId ? rebalanceFb({ ...i, vgpus: i.vgpus.filter((v) => v.id !== a.vgpuId) }) : i,
        ),
      };
    case 'setSliceVgpuWorkload':
      return {
        ...s,
        instances: s.instances.map((i) =>
          i.id === a.instId
            ? { ...i, vgpus: i.vgpus.map((v) => (v.id === a.vgpuId ? { ...v, workload: { kind: a.kind, demand: WORKLOADS[a.kind].demand } } : v)) }
            : i,
        ),
      };
    case 'toggleSliceVgpuHang':
      return {
        ...s,
        instances: s.instances.map((i) =>
          i.id === a.instId ? { ...i, vgpus: i.vgpus.map((v) => (v.id === a.vgpuId ? { ...v, hung: !v.hung } : v)) } : i,
        ),
      };

    case 'addVgpu': {
      const profile = VGPU_PROFILES.find((p) => p.id === a.profileId);
      if (!profile) return s;
      const res = canPlaceVgpu(s, profile);
      if (!res.ok) return s;
      const id = `vm-${s.seq}`;
      const idx = s.vms.length;
      const vm: VM = {
        id,
        name: `VM ${idx}`,
        profileId: profile.id,
        fb: profile.fb,
        color: VM_COLORS[idx % VM_COLORS.length],
        workload: { kind: 'idle', demand: 0 },
        hung: false,
        share: 1,
      };
      return { ...s, seq: s.seq + 1, vms: [...s.vms, vm] };
    }
    case 'removeVgpu':
      return { ...s, vms: s.vms.filter((v) => v.id !== a.id) };
    case 'setVmWorkload':
      return {
        ...s,
        vms: s.vms.map((v) => (v.id === a.id ? { ...v, workload: { kind: a.kind, demand: WORKLOADS[a.kind].demand } } : v)),
      };
    case 'toggleHang':
      return { ...s, vms: s.vms.map((v) => (v.id === a.id ? { ...v, hung: !v.hung } : v)) };
    case 'setVmShare':
      return { ...s, vms: s.vms.map((v) => (v.id === a.id ? { ...v, share: a.share } : v)) };

    case 'toggleRunning':
      return { ...s, running: !s.running };
    case 'reset':
      return { ...initialState, mode: s.mode };
    case 'loadPreset':
      return { ...a.preset };
    default:
      return s;
  }
}

export const MIG_TINTS = [C.mig, '#b6e23a', '#4fb477', '#7dd3a0', '#a3d977', '#5fa800', '#cfe85a'];
