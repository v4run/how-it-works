// GPU simulation domain model for the interactive lab.
// Models an H100 SXM5 80GB: 7 GPC slices (SM columns) + 8 memory slices (HBM3).
//
// Three partitioning modes:
//   - MIG        : spatial — GPU Instances own dedicated, contiguous GPC
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
export const TOTAL_MEM_GB = 80;
export const MEM_SLICES = 8;
export const MEM_PER_SLICE_GB = TOTAL_MEM_GB / MEM_SLICES; // 10 GB on H100 80GB
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
  g: number; // GPC slices
  gb: number; // framebuffer (nominal)
  sm: number; // SMs in the instance (real, non-uniform — from nvidia-smi mig -lgip)
}
// H100 SXM5 80GB GPU-instance profiles, with real SM counts confirmed on
// hardware (nvidia-smi mig -lgip). Note the SMs are NOT a clean g × 16: the
// die's 132 SMs don't divide evenly into 7, so 1g.20gb / 3g.40gb / 7g.80gb get
// bonus SMs over what their slice count alone would imply.
export const MIG_PROFILES: MigProfile[] = [
  { id: '1g.10gb', g: 1, gb: 10, sm: 16 },
  { id: '1g.20gb', g: 1, gb: 20, sm: 26 }, // 1 GPC slice, 2 memory slices
  { id: '2g.20gb', g: 2, gb: 20, sm: 32 },
  { id: '3g.40gb', g: 3, gb: 40, sm: 60 },
  { id: '4g.40gb', g: 4, gb: 40, sm: 64 },
  { id: '7g.80gb', g: 7, gb: 80, sm: 132 },
];
export const smOf = (profileId: string): number => MIG_PROFILES.find((p) => p.id === profileId)?.sm ?? 0;

export interface VgpuProfile {
  id: string;
  fb: number;
}
export const VGPU_PROFILES: VgpuProfile[] = [
  { id: 'H100-8C', fb: 8 },
  { id: 'H100-10C', fb: 10 },
  { id: 'H100-16C', fb: 16 },
  { id: 'H100-20C', fb: 20 },
  { id: 'H100-40C', fb: 40 },
  { id: 'H100-80C', fb: 80 },
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

// Fixed-share scheduler: every vGPU gets an equal slice of 1/maxVgpus, where
// maxVgpus is how many of this vGPU type the GPU supports (framebuffer-limited),
// regardless of how many are actually running. Returns that slot count, so the
// unused slots can be drawn as reserved-but-idle.
export function fixedShareSlots(vms: VM[]): number {
  if (vms.length === 0) return 0;
  const maxFb = Math.max(...vms.map((v) => v.fb));
  return Math.max(vms.length, Math.floor(TOTAL_MEM_GB / maxFb));
}
export function totalSliceVgpus(s: LabState): number {
  return s.instances.reduce((a, i) => a + i.vgpus.length, 0);
}

// NVIDIA's 19 valid MIG configurations — the authoritative placement table
// from the MIG user guide. Identical on the H100 and A100: same 7 GPC-slice /
// 8 memory-slice geometry, only the memory per slice differs. Each config is
// the set of compute blocks {start, size} it carves from the 7 GPC slices;
// slots not covered are unused (the grey cells in NVIDIA's figure). A layout is
// legal iff its placed blocks are a subset of one of these.
//
// This is the source of truth precisely because the rules don't reduce to a
// clean per-profile "valid start" set: a 3g.40gb is memory-heavy (3 compute /
// 4 memory slices), so it only fully packs the die when it sits on the right
// (e.g. config 8 `2|2|3`) — a 3g on the left always strands a slice (configs
// 5–7 end in grey). Validating against the enumerated configs captures that
// exactly, and reproduces the off-axis 2g positions (configs 6, 18) too.
type MigBlock = { start: number; size: number };
export const MIG_CONFIGS: MigBlock[][] = [
  [{ start: 0, size: 7 }], //                                                 1: 7
  [{ start: 0, size: 4 }, { start: 4, size: 3 }], //                          2: 4|3
  [{ start: 0, size: 4 }, { start: 4, size: 2 }, { start: 6, size: 1 }], //   3: 4|2|1
  [{ start: 0, size: 4 }, { start: 4, size: 1 }, { start: 5, size: 1 }, { start: 6, size: 1 }], // 4
  [{ start: 0, size: 3 }, { start: 3, size: 3 }], //                          5: 3|3 (slot 6 unused)
  [{ start: 0, size: 3 }, { start: 3, size: 2 }, { start: 5, size: 1 }], //   6: 3|2|1 (slot 6)
  [{ start: 0, size: 3 }, { start: 3, size: 1 }, { start: 4, size: 1 }, { start: 5, size: 1 }], // 7 (slot 6)
  [{ start: 0, size: 2 }, { start: 2, size: 2 }, { start: 4, size: 3 }], //   8: 2|2|3
  [{ start: 0, size: 2 }, { start: 2, size: 1 }, { start: 3, size: 1 }, { start: 4, size: 3 }], // 9
  [{ start: 0, size: 1 }, { start: 1, size: 1 }, { start: 2, size: 2 }, { start: 4, size: 3 }], // 10
  [{ start: 0, size: 1 }, { start: 1, size: 1 }, { start: 2, size: 1 }, { start: 3, size: 1 }, { start: 4, size: 3 }], // 11
  [{ start: 0, size: 2 }, { start: 2, size: 2 }, { start: 4, size: 2 }, { start: 6, size: 1 }], // 12
  [{ start: 0, size: 2 }, { start: 2, size: 1 }, { start: 3, size: 1 }, { start: 4, size: 2 }, { start: 6, size: 1 }], // 13
  [{ start: 0, size: 1 }, { start: 1, size: 1 }, { start: 2, size: 2 }, { start: 4, size: 2 }, { start: 6, size: 1 }], // 14
  [{ start: 0, size: 2 }, { start: 2, size: 1 }, { start: 3, size: 1 }, { start: 4, size: 1 }, { start: 5, size: 1 }, { start: 6, size: 1 }], // 15
  [{ start: 0, size: 1 }, { start: 1, size: 1 }, { start: 2, size: 2 }, { start: 4, size: 1 }, { start: 5, size: 1 }, { start: 6, size: 1 }], // 16
  [{ start: 0, size: 1 }, { start: 1, size: 1 }, { start: 2, size: 1 }, { start: 3, size: 1 }, { start: 4, size: 2 }, { start: 6, size: 1 }], // 17
  [{ start: 0, size: 1 }, { start: 1, size: 1 }, { start: 2, size: 1 }, { start: 3, size: 1 }, { start: 4, size: 1 }, { start: 5, size: 2 }], // 18
  [{ start: 0, size: 1 }, { start: 1, size: 1 }, { start: 2, size: 1 }, { start: 3, size: 1 }, { start: 4, size: 1 }, { start: 5, size: 1 }, { start: 6, size: 1 }], // 19
];

const placedBlocks = (s: LabState): MigBlock[] => s.instances.map((i) => ({ start: Math.min(...i.cols), size: i.cols.length }));
const configHasBlock = (cfg: MigBlock[], b: MigBlock) => cfg.some((cb) => cb.start === b.start && cb.size === b.size);
const configMatches = (cfg: MigBlock[], blocks: MigBlock[]) => blocks.every((b) => configHasBlock(cfg, b));

export interface PlaceResult {
  ok: boolean;
  reason?: string;
  cols?: number[];
}

// A profile fits iff some valid config (a) already contains every placed block
// and (b) has a free block of the profile's size. We pick the lowest such block
// (nvidia-smi's default lowest-placement behaviour). Order matters, so a
// memory-heavy 3g added first can dead-end — exactly as real MIG does.
export function canPlaceMig(s: LabState, profile: MigProfile): PlaceResult {
  if (usedMigMem(s) + profile.gb > TOTAL_MEM_GB)
    return { ok: false, reason: `Only ${TOTAL_MEM_GB - usedMigMem(s)} GB framebuffer free` };
  const blocks = placedBlocks(s);
  const occupied = new Set<number>();
  for (const i of s.instances) i.cols.forEach((c) => occupied.add(c));
  let best: number[] | null = null;
  for (const cfg of MIG_CONFIGS) {
    if (!configMatches(cfg, blocks)) continue;
    for (const cb of cfg) {
      if (cb.size !== profile.g) continue;
      const cols = Array.from({ length: cb.size }, (_, k) => cb.start + k);
      if (cols.some((c) => occupied.has(c))) continue;
      if (!best || cb.start < best[0]) best = cols;
    }
  }
  if (best) return { ok: true, cols: best };
  if (usedCompute(s) + profile.g > TOTAL_COMPUTE)
    return { ok: false, reason: `Only ${TOTAL_COMPUTE - usedCompute(s)} GPC slice(s) free` };
  return { ok: false, reason: `No valid H100 MIG layout fits a ${profile.id} here — remove an instance or add it in a different order` };
}

// Can any profile still be added? (Used to decide when free slices are stranded.)
export function canAddAnyMig(s: LabState): boolean {
  return MIG_PROFILES.some((p) => canPlaceMig(s, p).ok);
}

export function canPlaceVgpu(s: LabState, profile: VgpuProfile): PlaceResult {
  if (usedVgpuMem(s) + profile.fb > TOTAL_MEM_GB)
    return { ok: false, reason: `Only ${TOTAL_MEM_GB - usedVgpuMem(s)} GB framebuffer free` };
  return { ok: true };
}

export function migMemStrip(s: LabState): (string | null)[] {
  // One cell per 10 GB memory slice. Each instance lights the slices its
  // framebuffer actually occupies — a 7g.80gb fills all 8, a 3g.40gb fills 4.
  const strip: (string | null)[] = Array(MEM_SLICES).fill(null);
  let idx = 0;
  for (const inst of s.instances) {
    const slices = Math.max(1, Math.round(inst.gb / MEM_PER_SLICE_GB));
    for (let k = 0; k < slices && idx < MEM_SLICES; k++) strip[idx++] = inst.color;
  }
  // A free memory slice is stranded once nothing more can be placed on the GPU
  // — e.g. 7× 1g.10gb leaves the 8th slice's 10 GB unreachable, and a left-3g
  // layout (config 6) strands a slice too. If another instance can still be
  // added, the free slices aren't stranded yet.
  if (!canAddAnyMig(s)) {
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
