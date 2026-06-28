// Ready-made scenarios. Each builds a full LabState by replaying reducer actions.
import { C } from '../design/theme';
import { Action, LabState, WorkloadKind, initialState, reducer } from './model';

function build(actions: Action[]): LabState {
  return actions.reduce((s, a) => reducer(s, a), { ...initialState });
}

// Imperative builder for MIG-backed scenarios, where vGPU ids are generated.
interface SliceSpec {
  profile: string;
  vgpus: { workload?: WorkloadKind; hung?: boolean }[];
}
function buildMigBacked(slices: SliceSpec[]): LabState {
  let st = reducer(initialState, { type: 'setMode', mode: 'mig-vgpu' });
  for (const sl of slices) {
    const before = new Set(st.instances.map((i) => i.id));
    st = reducer(st, { type: 'addMig', profileId: sl.profile });
    const found = st.instances.find((i) => !before.has(i.id));
    if (!found) continue;
    const instId = found.id;
    for (let k = 1; k < sl.vgpus.length; k++) st = reducer(st, { type: 'addSliceVgpu', instId });
    const inst = st.instances.find((i) => i.id === instId)!;
    inst.vgpus.forEach((vg, k) => {
      const spec = sl.vgpus[k];
      if (!spec) return;
      if (spec.workload) st = reducer(st, { type: 'setSliceVgpuWorkload', instId, vgpuId: vg.id, kind: spec.workload });
      if (spec.hung) st = reducer(st, { type: 'toggleSliceVgpuHang', instId, vgpuId: vg.id });
    });
  }
  return reducer(st, { type: 'toggleRunning' });
}

export interface Preset {
  name: string;
  hint: string;
  accent: string;
  build: () => LabState;
}

export const PRESETS: Preset[] = [
  {
    name: '7× 1g.10gb',
    hint: 'Maximum MIG density — seven independent GPU Instances.',
    accent: C.mig,
    build: () =>
      build([
        { type: 'setMode', mode: 'mig' },
        ...Array.from({ length: 7 }, () => ({ type: 'addMig', profileId: '1g.10gb' }) as Action),
        ...Array.from({ length: 7 }, (_, i) => ({ type: 'setMigWorkload', id: `gi-${i}`, kind: 'inference' }) as Action),
        { type: 'toggleRunning' },
      ]),
  },
  {
    name: 'Mixed profiles',
    hint: 'Two 1g.10gb + 2g.20gb + 3g.40gb — NVIDIA config 10, all concurrent.',
    accent: C.mig,
    build: () =>
      // Config 10 (`1 | 1 | 2 | 3`): the memory-heavy 3g must sit on the right,
      // so add the smaller instances first and the 3g last.
      build([
        { type: 'setMode', mode: 'mig' },
        { type: 'addMig', profileId: '1g.10gb' },
        { type: 'addMig', profileId: '1g.10gb' },
        { type: 'addMig', profileId: '2g.20gb' },
        { type: 'addMig', profileId: '3g.40gb' },
        { type: 'setMigWorkload', id: 'gi-3', kind: 'training' },
        { type: 'setMigWorkload', id: 'gi-2', kind: 'render' },
        { type: 'setMigWorkload', id: 'gi-0', kind: 'inference' },
        { type: 'setMigWorkload', id: 'gi-1', kind: 'inference' },
        { type: 'toggleRunning' },
      ]),
  },
  {
    name: 'MIG fault isolation',
    hint: 'An XID fault in one instance leaves the others untouched.',
    accent: C.red,
    build: () =>
      build([
        { type: 'setMode', mode: 'mig' },
        // Largest-first so every instance lands on a legal placement: three
        // 2g.20gb fill the (0,1)(2,3)(4,5) pairs, the 1g.10gb takes slot 6.
        { type: 'addMig', profileId: '2g.20gb' },
        { type: 'addMig', profileId: '2g.20gb' },
        { type: 'addMig', profileId: '2g.20gb' },
        { type: 'addMig', profileId: '1g.10gb' },
        ...['gi-0', 'gi-1', 'gi-2', 'gi-3'].map((id) => ({ type: 'setMigWorkload', id, kind: 'training' }) as Action),
        { type: 'toggleFault', id: 'gi-1' },
        { type: 'toggleRunning' },
      ]),
  },
  {
    name: 'MIG-backed vGPU',
    hint: 'One vGPU per MIG slice — hardware partitioning + VM isolation.',
    accent: C.vgpu,
    build: () =>
      // Config 8 (`2 | 2 | 3`): smaller slices first, the 3g on the right.
      buildMigBacked([
        { profile: '2g.20gb', vgpus: [{ workload: 'inference' }] },
        { profile: '2g.20gb', vgpus: [{ workload: 'render' }] },
        { profile: '3g.40gb', vgpus: [{ workload: 'training' }] },
      ]),
  },
  {
    name: 'MIG-backed · shared slice',
    hint: 'MIG time-slicing — 3 vGPUs share one slice; another slice runs in parallel.',
    accent: C.vgpu,
    build: () =>
      // Config 2 (`4 | 3`): the 4g on the left, the memory-heavy 3g on the right.
      buildMigBacked([
        { profile: '4g.40gb', vgpus: [{ workload: 'training' }] },
        { profile: '3g.40gb', vgpus: [{ workload: 'training' }, { workload: 'training' }, { workload: 'inference' }] },
      ]),
  },
  {
    name: 'MIG-backed · hang contained',
    hint: 'A hung vGPU stalls its slice-mate, but the other slice runs on.',
    accent: C.red,
    build: () =>
      // Config 2 (`4 | 3`): 4g first (left), 3g last (right).
      buildMigBacked([
        { profile: '4g.40gb', vgpus: [{ workload: 'training' }] },
        { profile: '3g.40gb', vgpus: [{ workload: 'training' }, { workload: 'training', hung: true }] },
      ]),
  },
  {
    name: '4 VMs · equal-share',
    hint: 'Time-sliced vGPU — the whole SM array rotates between VMs.',
    accent: C.vgpu,
    build: () =>
      build([
        { type: 'setMode', mode: 'vgpu' },
        { type: 'setScheduler', scheduler: 'equal-share' },
        ...Array.from({ length: 4 }, () => ({ type: 'addVgpu', profileId: 'H100-10C' }) as Action),
        ...Array.from({ length: 4 }, (_, i) => ({ type: 'setVmWorkload', id: `vm-${i}`, kind: 'training' }) as Action),
        { type: 'toggleRunning' },
      ]),
  },
  {
    name: 'Noisy neighbour (hung)',
    hint: 'One hung context stalls every tenant — no compute fault containment.',
    accent: C.red,
    build: () =>
      build([
        { type: 'setMode', mode: 'vgpu' },
        { type: 'setScheduler', scheduler: 'equal-share' },
        ...Array.from({ length: 4 }, () => ({ type: 'addVgpu', profileId: 'H100-8C' }) as Action),
        ...Array.from({ length: 4 }, (_, i) => ({ type: 'setVmWorkload', id: `vm-${i}`, kind: 'training' }) as Action),
        { type: 'toggleHang', id: 'vm-1' },
        { type: 'toggleRunning' },
      ]),
  },
  {
    name: 'Fixed-share · idle capacity',
    hint: 'Fixed share guarantees 1/max per VM — a half-full GPU leaves slots idle. Switch to equal-share to reclaim them.',
    accent: C.vgpu,
    build: () =>
      // H100-20C maxes at 4 vGPUs (80/20). With only 2 running, each is pinned
      // to 1/4 and the other two slots sit idle (grey on the wheel).
      build([
        { type: 'setMode', mode: 'vgpu' },
        { type: 'setScheduler', scheduler: 'fixed-share' },
        ...Array.from({ length: 2 }, () => ({ type: 'addVgpu', profileId: 'H100-20C' }) as Action),
        ...Array.from({ length: 2 }, (_, i) => ({ type: 'setVmWorkload', id: `vm-${i}`, kind: 'training' }) as Action),
        { type: 'toggleRunning' },
      ]),
  },
];
