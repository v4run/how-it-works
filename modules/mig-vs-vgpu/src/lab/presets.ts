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
    name: '7× 1g.5gb',
    hint: 'Maximum MIG density — seven independent GPU Instances.',
    accent: C.mig,
    build: () =>
      build([
        { type: 'setMode', mode: 'mig' },
        ...Array.from({ length: 7 }, () => ({ type: 'addMig', profileId: '1g.5gb' }) as Action),
        ...Array.from({ length: 7 }, (_, i) => ({ type: 'setMigWorkload', id: `gi-${i}`, kind: 'inference' }) as Action),
        { type: 'toggleRunning' },
      ]),
  },
  {
    name: 'Mixed profiles',
    hint: '3g.20gb + 2g.10gb + two 1g.5gb, all running concurrently.',
    accent: C.mig,
    build: () =>
      build([
        { type: 'setMode', mode: 'mig' },
        { type: 'addMig', profileId: '3g.20gb' },
        { type: 'addMig', profileId: '2g.10gb' },
        { type: 'addMig', profileId: '1g.5gb' },
        { type: 'addMig', profileId: '1g.5gb' },
        { type: 'setMigWorkload', id: 'gi-0', kind: 'training' },
        { type: 'setMigWorkload', id: 'gi-1', kind: 'render' },
        { type: 'setMigWorkload', id: 'gi-2', kind: 'inference' },
        { type: 'setMigWorkload', id: 'gi-3', kind: 'inference' },
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
        // 2g.10gb fill the (0,1)(2,3)(4,5) pairs, the 1g.5gb takes slot 6.
        { type: 'addMig', profileId: '2g.10gb' },
        { type: 'addMig', profileId: '2g.10gb' },
        { type: 'addMig', profileId: '2g.10gb' },
        { type: 'addMig', profileId: '1g.5gb' },
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
      buildMigBacked([
        { profile: '3g.20gb', vgpus: [{ workload: 'training' }] },
        { profile: '2g.10gb', vgpus: [{ workload: 'inference' }] },
        { profile: '2g.10gb', vgpus: [{ workload: 'render' }] },
      ]),
  },
  {
    name: 'MIG-backed · shared slice',
    hint: 'MIG time-slicing — 3 vGPUs share one slice; another slice runs in parallel.',
    accent: C.vgpu,
    build: () =>
      buildMigBacked([
        { profile: '3g.20gb', vgpus: [{ workload: 'training' }, { workload: 'training' }, { workload: 'inference' }] },
        { profile: '4g.20gb', vgpus: [{ workload: 'training' }] },
      ]),
  },
  {
    name: 'MIG-backed · hang contained',
    hint: 'A hung vGPU stalls its slice-mate, but the other slice runs on.',
    accent: C.red,
    build: () =>
      buildMigBacked([
        { profile: '3g.20gb', vgpus: [{ workload: 'training' }, { workload: 'training', hung: true }] },
        { profile: '4g.20gb', vgpus: [{ workload: 'training' }] },
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
        ...Array.from({ length: 4 }, () => ({ type: 'addVgpu', profileId: 'A100-10C' }) as Action),
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
        ...Array.from({ length: 4 }, () => ({ type: 'addVgpu', profileId: 'A100-8C' }) as Action),
        ...Array.from({ length: 4 }, (_, i) => ({ type: 'setVmWorkload', id: `vm-${i}`, kind: 'training' }) as Action),
        { type: 'toggleHang', id: 'vm-1' },
        { type: 'toggleRunning' },
      ]),
  },
  {
    name: 'Fixed-share QoS',
    hint: 'Weighted shares give each VM a guaranteed slice of GPU time.',
    accent: C.vgpu,
    build: () =>
      build([
        { type: 'setMode', mode: 'vgpu' },
        { type: 'setScheduler', scheduler: 'fixed-share' },
        ...Array.from({ length: 3 }, () => ({ type: 'addVgpu', profileId: 'A100-10C' }) as Action),
        { type: 'setVmShare', id: 'vm-0', share: 4 },
        { type: 'setVmShare', id: 'vm-1', share: 2 },
        { type: 'setVmShare', id: 'vm-2', share: 1 },
        ...Array.from({ length: 3 }, (_, i) => ({ type: 'setVmWorkload', id: `vm-${i}`, kind: 'training' }) as Action),
        { type: 'toggleRunning' },
      ]),
  },
];
