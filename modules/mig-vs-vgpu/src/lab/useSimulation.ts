// Live scheduler simulation. Advances a sim clock with requestAnimationFrame
// and produces a throttled snapshot of per-unit metrics.
//
//   MIG        : every instance runs concurrently on its dedicated slices.
//                A faulted instance halts alone (spatial isolation).
//   vGPU       : a global time-slice scheduler rotates the whole SM array between
//                VMs by policy. A hung VM stalls every tenant.
//   MIG-backed : each MIG slice runs an INDEPENDENT time-slice scheduler over its
//                own vGPUs. Slices run in parallel and are hardware-isolated, so a
//                hung vGPU stalls only its slice-mates — never another slice.

import React from 'react';
import { LabState, TOTAL_COMPUTE } from './model';

export interface UnitMetric {
  id: string;
  work: number;
  rate: number;
  util: number;
  timeShare: number;
  active: boolean;
  starved: boolean;
}

export interface SliceView {
  activeVgpuId: string | null;
  stalled: boolean;
  quantumFrac: number;
}

export interface SimSnapshot {
  t: number;
  running: boolean;
  activeId: string | null; // vGPU mode: VM holding the GPU
  quantumFrac: number;
  stalledByHang: boolean;
  units: Record<string, UnitMetric>;
  slices: Record<string, SliceView>; // MIG-backed mode: per-slice scheduler state
}

const EMPTY: SimSnapshot = {
  t: 0,
  running: false,
  activeId: null,
  quantumFrac: 0,
  stalledByHang: false,
  units: {},
  slices: {},
};

function buildOrder(s: LabState): string[] {
  if (s.scheduler === 'best-effort') {
    return s.vms.filter((v) => v.workload.demand > 0 || v.hung).map((v) => v.id);
  }
  if (s.scheduler === 'fixed-share') {
    const order: string[] = [];
    for (const v of s.vms) {
      const slots = Math.max(1, Math.round(v.share));
      for (let k = 0; k < slots; k++) order.push(v.id);
    }
    return order;
  }
  return s.vms.map((v) => v.id);
}

export function useSimulation(state: LabState): SimSnapshot {
  const [snap, setSnap] = React.useState<SimSnapshot>(EMPTY);

  const acc = React.useRef({
    work: {} as Record<string, number>,
    activeTime: {} as Record<string, number>,
    total: 0,
    t: 0,
    slotPos: 0,
    quantumElapsed: 0,
    orderSig: '',
    lastEmit: 0,
    sliceState: {} as Record<string, { slot: number; elapsed: number }>,
  });
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const rafRef = React.useRef<number | null>(null);
  const lastTs = React.useRef<number | null>(null);

  const topoSig =
    state.mode +
    '|' +
    state.scheduler +
    '|' +
    state.instances
      .map(
        (i) =>
          `${i.id}:${i.workload.kind}:${i.faulted}:` + i.vgpus.map((v) => `${v.id}/${v.workload.kind}/${v.hung}`).join('+'),
      )
      .join(',') +
    '|' +
    state.vms.map((v) => `${v.id}:${v.workload.kind}:${v.hung}:${v.share}`).join(',');

  React.useEffect(() => {
    const a = acc.current;
    a.work = {};
    a.activeTime = {};
    a.total = 0;
    a.t = 0;
    a.slotPos = 0;
    a.quantumElapsed = 0;
    a.orderSig = '';
    a.lastEmit = 0;
    a.sliceState = {};
    setSnap({ ...EMPTY, running: stateRef.current.running });
  }, [topoSig]);

  React.useEffect(() => {
    if (!state.running) {
      lastTs.current = null;
      setSnap((p) => ({ ...p, running: false }));
      return;
    }
    const step = (ts: number) => {
      if (lastTs.current == null) lastTs.current = ts;
      const dt = Math.min(0.05, (ts - lastTs.current) / 1000);
      lastTs.current = ts;
      const s = stateRef.current;
      const a = acc.current;
      a.t += dt;
      a.total += dt;

      let activeId: string | null = null;
      let quantumFrac = 0;
      let stalledByHang = false;
      const sliceView: Record<string, SliceView> = {};

      const ensure = (id: string) => {
        if (a.work[id] == null) a.work[id] = 0;
        if (a.activeTime[id] == null) a.activeTime[id] = 0;
      };
      const quantumSec = s.quantumMs / 1000;

      if (s.mode === 'mig') {
        for (const inst of s.instances) {
          ensure(inst.id);
          const demand = inst.faulted ? 0 : inst.workload.demand;
          if (demand > 0) {
            a.work[inst.id] += demand * inst.cols.length * dt;
            a.activeTime[inst.id] += dt;
          }
        }
      } else if (s.mode === 'mig-vgpu') {
        for (const inst of s.instances) {
          for (const vg of inst.vgpus) ensure(vg.id);
          if (inst.faulted || inst.vgpus.length === 0) {
            sliceView[inst.id] = { activeVgpuId: null, stalled: false, quantumFrac: 0 };
            continue;
          }
          const slc = (a.sliceState[inst.id] ||= { slot: 0, elapsed: 0 });
          if (inst.vgpus.length === 1) {
            const vg = inst.vgpus[0];
            const demand = vg.hung ? 0 : vg.workload.demand;
            if (demand > 0) {
              a.work[vg.id] += inst.cols.length * demand * dt;
              a.activeTime[vg.id] += dt;
            }
            sliceView[inst.id] = { activeVgpuId: vg.id, stalled: vg.hung, quantumFrac: 0 };
          } else {
            const order = inst.vgpus.map((v) => v.id);
            const activeVgId = order[slc.slot % order.length];
            const activeVg = inst.vgpus.find((v) => v.id === activeVgId)!;
            if (activeVg.hung) {
              // Holds this slice's scheduler — slice-mates starve, other slices fine.
              a.activeTime[activeVgId] += dt;
              slc.elapsed += dt;
              sliceView[inst.id] = { activeVgpuId: activeVgId, stalled: true, quantumFrac: 0 };
            } else {
              const demand = activeVg.workload.demand;
              if (demand > 0) a.work[activeVgId] += inst.cols.length * demand * dt;
              a.activeTime[activeVgId] += dt;
              slc.elapsed += dt;
              sliceView[inst.id] = { activeVgpuId: activeVgId, stalled: false, quantumFrac: Math.min(1, slc.elapsed / quantumSec) };
              if (slc.elapsed >= quantumSec) {
                slc.slot = (slc.slot + 1) % order.length;
                slc.elapsed = 0;
              }
            }
          }
        }
      } else {
        const order = buildOrder(s);
        const sig = order.join(',') + '#' + s.quantumMs;
        if (sig !== a.orderSig) {
          a.orderSig = sig;
          a.slotPos = 0;
          a.quantumElapsed = 0;
        }
        for (const vm of s.vms) ensure(vm.id);
        if (order.length > 0) {
          activeId = order[a.slotPos % order.length];
          const activeVm = s.vms.find((v) => v.id === activeId)!;
          if (activeVm.hung) {
            stalledByHang = true;
            a.activeTime[activeId] += dt;
            a.quantumElapsed += dt;
            quantumFrac = 0;
          } else {
            const demand = activeVm.workload.demand;
            if (demand > 0) a.work[activeId] += TOTAL_COMPUTE * demand * dt;
            a.activeTime[activeId] += dt;
            a.quantumElapsed += dt;
            quantumFrac = Math.min(1, a.quantumElapsed / quantumSec);
            if (a.quantumElapsed >= quantumSec) {
              a.slotPos = (a.slotPos + 1) % order.length;
              a.quantumElapsed = 0;
            }
          }
        }
      }

      if (a.t - a.lastEmit > 0.033) {
        a.lastEmit = a.t;
        const units: Record<string, UnitMetric> = {};
        if (s.mode === 'mig') {
          for (const inst of s.instances) {
            const demand = inst.faulted ? 0 : inst.workload.demand;
            units[inst.id] = {
              id: inst.id,
              work: a.work[inst.id] || 0,
              rate: demand * inst.cols.length,
              util: demand,
              timeShare: a.total > 0 ? (a.activeTime[inst.id] || 0) / a.total : 0,
              active: demand > 0,
              starved: false,
            };
          }
        } else if (s.mode === 'mig-vgpu') {
          for (const inst of s.instances) {
            const halted = inst.faulted;
            const sv = sliceView[inst.id];
            const single = inst.vgpus.length === 1;
            for (const vg of inst.vgpus) {
              const demand = vg.hung ? 0 : vg.workload.demand;
              const timeShare = a.total > 0 ? (a.activeTime[vg.id] || 0) / a.total : 0;
              const active = !halted && !!sv && sv.activeVgpuId === vg.id && !sv.stalled && demand > 0;
              units[vg.id] = {
                id: vg.id,
                work: a.work[vg.id] || 0,
                rate: active ? inst.cols.length * demand : 0,
                util: single ? (halted ? 0 : demand) : timeShare * vg.workload.demand,
                timeShare,
                active,
                starved: !single && !halted && !active && (vg.workload.demand > 0 || vg.hung),
              };
            }
          }
        } else {
          for (const vm of s.vms) {
            const isActive = vm.id === activeId;
            const demand = vm.workload.demand;
            const timeShare = a.total > 0 ? (a.activeTime[vm.id] || 0) / a.total : 0;
            units[vm.id] = {
              id: vm.id,
              work: a.work[vm.id] || 0,
              rate: isActive && !vm.hung ? TOTAL_COMPUTE * demand : 0,
              util: timeShare * demand,
              timeShare,
              active: isActive,
              starved: !isActive && (demand > 0 || vm.hung),
            };
          }
        }
        setSnap({ t: a.t, running: true, activeId, quantumFrac, stalledByHang, units, slices: sliceView });
      }

      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTs.current = null;
    };
  }, [state.running]);

  return snap;
}
