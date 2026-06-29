// The live visualization: the shared GPU die reflecting the current topology
// and scheduler state, plus the time-slice wheel in vGPU mode.
import { C, MONO, DISP, hexToRgb } from '../design/theme';
import { Die, DieGroup } from '../design/Die';
import { LabState, migMemStrip, vgpuMemStrip, smOf, fixedShareWedges } from './model';
import { SimSnapshot } from './useSimulation';
import { SchedulerWheel, WheelSlice } from './SchedulerWheel';

export function LabViz({ state, snap }: { state: LabState; snap: SimSnapshot }) {
  if (state.mode === 'vgpu') return <VgpuViz state={state} snap={snap} />;
  return <MigViz state={state} snap={snap} />;
}

function StatusBanner({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 15,
        letterSpacing: '0.04em',
        color,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 16px',
        borderRadius: 8,
        border: `1px solid rgba(${hexToRgb(color)},0.4)`,
        background: `rgba(${hexToRgb(color)},0.08)`,
      }}
    >
      <span style={{ width: 9, height: 9, borderRadius: 9, background: color, boxShadow: `0 0 10px ${color}` }} />
      {children}
    </div>
  );
}

function MigViz({ state, snap }: { state: LabState; snap: SimSnapshot }) {
  const backed = state.mode === 'mig-vgpu';
  const litCols: number[] = [];
  const colAccents: (string | null)[] = Array(7).fill(null);
  const groups: DieGroup[] = [];

  state.instances.forEach((inst, idx) => {
    if (!backed) {
      // Pure MIG: instance-level workload drives the slice.
      const down = inst.faulted;
      const running = !down && inst.workload.demand > 0;
      for (const c of inst.cols) {
        colAccents[c] = down ? C.red : inst.color;
        if (running || down) litCols.push(c);
      }
      groups.push({
        cols: inst.cols,
        label: `GI-${idx}`,
        color: inst.faulted ? C.red : inst.color,
        fault: inst.faulted,
        badge: inst.faulted ? undefined : `${smOf(inst.profileId)} SMs`,
      });
      return;
    }
    // MIG-backed: each slice's columns show its currently-active vGPU.
    const sv = snap.slices[inst.id];
    const activeVg = sv?.activeVgpuId ? inst.vgpus.find((v) => v.id === sv.activeVgpuId) || null : null;
    const stalled = sv?.stalled ?? false;
    const running = !inst.faulted && !!activeVg && !stalled && activeVg.workload.demand > 0;
    const colColor = inst.faulted ? C.red : stalled ? C.red : activeVg ? activeVg.color : inst.color;
    for (const c of inst.cols) {
      colAccents[c] = colColor;
      if (inst.faulted || stalled || running) litCols.push(c);
    }
    const single = inst.vgpus.length === 1;
    groups.push({
      cols: inst.cols,
      // Keep the label to the short slice id so it fits a 1-column slice without
      // overrunning the neighbour; the badge (centred) shows the active vGPU.
      label: `GI-${idx}`,
      color: inst.faulted ? C.red : stalled ? C.red : C.vgpu,
      fault: inst.faulted,
      badge: inst.faulted ? undefined : activeVg ? activeVg.name : single ? inst.vgpus[0]?.name ?? 'VF' : `${inst.vgpus.length} vGPUs`,
    });
  });

  const anyFault = state.instances.some((i) => i.faulted);
  const anyHung = state.instances.some((i) => i.vgpus.some((v) => v.hung));
  const anyDown = backed ? anyFault || anyHung : anyFault;
  const hasInstances = state.instances.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
      <Die
        w={680}
        h={540}
        accent={C.mig}
        reveal={1}
        litCols={hasInstances ? litCols : 'none'}
        colAccents={colAccents}
        dividers={hasInstances ? 1 : 0}
        groups={hasInstances ? groups : null}
        memGroups={hasInstances ? migMemStrip(state) : 'mig'}
        hideHeader={hasInstances}
        label={backed ? 'H100-80GB · MIG-backed · logical' : 'H100-80GB · MIG · logical'}
      />
      {hasInstances ? (
        anyDown ? (
          <StatusBanner color={C.red}>
            {backed
              ? 'Fault / hung vGPU is contained to its MIG slice — other slices run on. Within a slice, a hang stalls only its slice-mates.'
              : 'XID fault contained to its instance — every other GPU Instance keeps running. Spatial isolation holds.'}
          </StatusBanner>
        ) : (
          <StatusBanner color={backed ? C.vgpu : C.mig}>
            {backed
              ? 'MIG-backed vGPU — slices run in parallel & hardware-isolated; multiple vGPUs on a slice time-slice that slice.'
              : 'Spatial partitioning — each instance owns dedicated SMs, L2 and memory. No noisy neighbours.'}
          </StatusBanner>
        )
      ) : (
        <div style={{ fontFamily: MONO, fontSize: 15, color: C.faint }}>
          {backed ? 'No slices yet — add a MIG slice; each can host 1–3 time-sliced vGPUs.' : 'Unpartitioned GPU — add a MIG instance to carve the silicon.'}
        </div>
      )}
    </div>
  );
}

function VgpuViz({ state, snap }: { state: LabState; snap: SimSnapshot }) {
  const hasVms = state.vms.length > 0;
  const activeVm = state.vms.find((v) => v.id === snap.activeId) || null;
  const running = snap.running && hasVms;
  const stalled = snap.stalledByHang;
  const activeColor = activeVm ? activeVm.color : C.vgpu;

  // Equal-share / best-effort: one equal wedge per VM. Fixed-share: each VM's
  // wedge is sized by its framebuffer share (40C = 1/2, 20C = 1/4 …) plus one
  // grey idle wedge for any reserved-but-unused capacity.
  let slices: WheelSlice[];
  if (state.scheduler === 'fixed-share') {
    slices = fixedShareWedges(state.vms).map((w) => {
      const vm = state.vms.find((v) => v.id === w.id);
      return {
        id: w.id,
        name: w.idle ? 'idle' : vm?.name ?? '',
        color: w.idle ? '#5f6a60' : vm?.color ?? C.vgpu,
        weight: w.frac,
        active: w.id === snap.activeId,
        hung: vm?.hung ?? false,
        idle: w.idle,
      };
    });
  } else {
    slices = state.vms.map((v) => ({ id: v.id, name: v.name, color: v.color, weight: 1, active: v.id === snap.activeId, hung: v.hung, idle: false }));
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        <Die
          w={560}
          h={470}
          accent={C.vgpu}
          reveal={1}
          litCols={running && activeVm ? 'all' : 'none'}
          activeAccent={stalled ? C.red : activeColor}
          memGroups={hasVms ? vgpuMemStrip(state) : null}
          label="H100-80GB · vGPU · logical"
        />
        {running && activeVm ? (
          <div
            style={{
              fontFamily: MONO,
              fontSize: 16,
              letterSpacing: '0.03em',
              color: stalled ? C.red : activeColor,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 10, background: stalled ? C.red : activeColor, boxShadow: `0 0 12px ${stalled ? C.red : activeColor}` }} />
            {stalled ? `${activeVm.name} hung — queue stalled for all` : `entire SM array → ${activeVm.name}`}
          </div>
        ) : null}
        <div>
          {!hasVms ? (
            <div style={{ fontFamily: MONO, fontSize: 15, color: C.faint }}>No VMs — create a vGPU to share the GPU in time.</div>
          ) : stalled ? (
            <StatusBanner color={C.red}>
              Hung context holds the GPU — every tenant is blocked. Framebuffers stay isolated, but compute has no fault containment.
            </StatusBanner>
          ) : (
            <StatusBanner color={C.vgpu}>
              Temporal partitioning — the whole SM array is time-sliced across VMs. Memory is statically carved.
            </StatusBanner>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.faint }}>
          {state.scheduler}
        </div>
        <SchedulerWheel slices={slices} quantumFrac={snap.quantumFrac} stalled={stalled} size={280} />
        <div style={{ fontFamily: DISP, fontSize: 16, color: C.dim }}>
          quantum · {state.quantumMs} ms
        </div>
      </div>
    </div>
  );
}
