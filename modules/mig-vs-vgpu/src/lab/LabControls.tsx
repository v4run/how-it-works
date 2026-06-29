// The control panel: build partitions / vGPUs / VMs, assign workloads, set the
// scheduler, run the sim, and watch per-unit metrics update live.
import React from 'react';
import { C, MONO, DISP, hexToRgb } from '../design/theme';
import { Button } from '../design/atoms';
import {
  Action,
  LabState,
  MigInstance,
  MIG_PROFILES,
  smOf,
  VGPU_PROFILES,
  WORKLOADS,
  WorkloadKind,
  SchedPolicy,
  canPlaceMig,
  canPlaceVgpu,
  usedCompute,
  usedMigMem,
  usedVgpuMem,
  TOTAL_COMPUTE,
  TOTAL_MEM_GB,
  maxVgpusPerSlice,
} from './model';
import { SimSnapshot } from './useSimulation';
import { PRESETS } from './presets';

type Dispatch = (a: Action) => void;

const WORKLOAD_KINDS: WorkloadKind[] = ['idle', 'inference', 'render', 'training'];

export function LabControls({ state, dispatch, snap }: { state: LabState; dispatch: Dispatch; snap: SimSnapshot }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <RunBar state={state} dispatch={dispatch} snap={snap} />
      <ModeToggle state={state} dispatch={dispatch} />
      <Presets dispatch={dispatch} />
      {state.mode === 'vgpu' ? (
        <VgpuBuilder state={state} dispatch={dispatch} snap={snap} />
      ) : (
        <MigBuilder state={state} dispatch={dispatch} snap={snap} />
      )}
    </div>
  );
}

/* ── Section shell ──────────────────────────────────────────────────────── */
function Section({ title, accent = C.dim, children, right }: { title: string; accent?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, background: 'rgba(255,255,255,0.015)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase', color: accent }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

/* ── Run bar ────────────────────────────────────────────────────────────── */
function RunBar({ state, dispatch, snap }: { state: LabState; dispatch: Dispatch; snap: SimSnapshot }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Button accent={state.running ? C.amber : C.mig} filled onClick={() => dispatch({ type: 'toggleRunning' })} style={{ flex: 1 }}>
        {state.running ? '❚❚  Pause workloads' : '▶  Run workloads'}
      </Button>
      <Button accent={C.steel} onClick={() => dispatch({ type: 'reset' })}>
        Reset
      </Button>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 14,
          color: C.faint,
          fontVariantNumeric: 'tabular-nums',
          minWidth: 64,
          textAlign: 'right',
        }}
      >
        {snap.t.toFixed(1)}s
      </div>
    </div>
  );
}

/* ── Mode toggle ────────────────────────────────────────────────────────── */
const MODE_META: { id: LabState['mode']; label: string; accent: string }[] = [
  { id: 'mig', label: 'MIG', accent: C.mig },
  { id: 'vgpu', label: 'vGPU', accent: C.vgpu },
  { id: 'mig-vgpu', label: 'MIG-backed', accent: C.vgpu },
];

function ModeToggle({ state, dispatch }: { state: LabState; dispatch: Dispatch }) {
  return (
    <div style={{ display: 'flex', gap: 0, border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden' }}>
      {MODE_META.map((m) => {
        const on = state.mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => dispatch({ type: 'setMode', mode: m.id })}
            style={{
              flex: 1,
              padding: '12px 6px',
              border: 'none',
              cursor: 'pointer',
              background: on ? `rgba(${hexToRgb(m.accent)},0.16)` : 'transparent',
              color: on ? m.accent : C.dim,
              fontFamily: DISP,
              fontSize: 15,
              fontWeight: 600,
              borderBottom: on ? `2px solid ${m.accent}` : '2px solid transparent',
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Presets ────────────────────────────────────────────────────────────── */
function Presets({ dispatch }: { dispatch: Dispatch }) {
  return (
    <Section title="Scenarios">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {PRESETS.map((p) => (
          <Button key={p.name} small accent={p.accent} onClick={() => dispatch({ type: 'loadPreset', preset: p.build() })} title={p.hint}>
            {p.name}
          </Button>
        ))}
      </div>
    </Section>
  );
}

/* ── Budget bar ─────────────────────────────────────────────────────────── */
function BudgetBar({ label, used, total, unit, accent }: { label: string; used: number; total: number; unit: string; accent: string }) {
  const pct = Math.min(100, (used / total) * 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 13, color: C.dim, marginBottom: 5 }}>
        <span>{label}</span>
        <span style={{ color: C.ink }}>
          {used} / {total} {unit}
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 5, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${pct}%`, background: accent, boxShadow: `0 0 10px ${accent}77`, borderRadius: 5 }} />
      </div>
    </div>
  );
}

/* ── Workload select ────────────────────────────────────────────────────── */
function WorkloadSelect({ value, onChange, accent }: { value: WorkloadKind; onChange: (k: WorkloadKind) => void; accent: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as WorkloadKind)}
      style={{
        fontFamily: MONO,
        fontSize: 13,
        color: C.ink,
        background: `rgba(${hexToRgb(accent)},0.08)`,
        border: `1px solid rgba(${hexToRgb(accent)},0.4)`,
        borderRadius: 7,
        padding: '6px 8px',
        cursor: 'pointer',
      }}
    >
      {WORKLOAD_KINDS.map((k) => (
        <option key={k} value={k} style={{ background: '#0c1110', color: C.ink }}>
          {WORKLOADS[k].label}
        </option>
      ))}
    </select>
  );
}

/* ── Live metric bar ────────────────────────────────────────────────────── */
function MetricBar({ label, frac, value, accent, active }: { label: string; frac: number; value: string; accent: string; active?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 11, color: C.faint, marginBottom: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {active ? <span style={{ width: 6, height: 6, borderRadius: 6, background: accent, boxShadow: `0 0 8px ${accent}` }} /> : null}
          {label}
        </span>
        <span style={{ color: C.dim }}>{value}</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, frac * 100)}%`, height: '100%', background: accent, borderRadius: 4, transition: 'width 0.1s linear' }} />
      </div>
    </div>
  );
}

/* ── Toggle pill ────────────────────────────────────────────────────────── */
function Toggle({ on, onClick, accent, children, title }: { on: boolean; onClick: () => void; accent: string; children: React.ReactNode; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        fontFamily: MONO,
        fontSize: 12,
        padding: '5px 9px',
        borderRadius: 7,
        cursor: 'pointer',
        border: `1px solid ${on ? accent : C.line}`,
        background: on ? `rgba(${hexToRgb(accent)},0.18)` : 'transparent',
        color: on ? accent : C.dim,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

/* ── MIG builder + instance list ────────────────────────────────────────── */
function MigBuilder({ state, dispatch, snap }: { state: LabState; dispatch: Dispatch; snap: SimSnapshot }) {
  const backed = state.mode === 'mig-vgpu';
  const accent = backed ? C.vgpu : C.mig;
  return (
    <>
      <Section title={backed ? 'Build · MIG-backed vGPUs' : 'Build · MIG GPU instances'} accent={accent}>
        <BudgetBar label="GPC slices" used={usedCompute(state)} total={TOTAL_COMPUTE} unit="g" accent={C.mig} />
        <BudgetBar label="Framebuffer" used={usedMigMem(state)} total={TOTAL_MEM_GB} unit="GB" accent={C.mig} />
        {backed ? (
          <div style={{ fontFamily: MONO, fontSize: 12, color: C.faint, marginTop: 4, marginBottom: 4, lineHeight: 1.5 }}>
            Each slice runs an independent scheduler. Add <span style={{ color: accent }}>time-sliced vGPUs</span> per slice (NVIDIA MIG time-slicing) — the count is framebuffer-derived (slice memory ÷ 10 GB, so a 1g.10gb holds 1, a 7g.80gb 8): across slices they run in parallel &amp; isolated; within a slice they share its compute.
          </div>
        ) : (
          <div style={{ fontFamily: MONO, fontSize: 12, color: C.faint, marginTop: 4, marginBottom: 4, lineHeight: 1.5 }}>
            Only NVIDIA's <span style={{ color: accent }}>19 valid MIG layouts</span> are allowed. A profile greys out when no legal layout still fits it — order matters, so a memory-heavy 3g.40gb usually has to go <em>last</em>.
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {MIG_PROFILES.map((p) => {
            const res = canPlaceMig(state, p);
            return (
              <Button key={p.id} small accent={C.mig} disabled={!res.ok} title={res.ok ? `Add ${p.id} — ${p.g} GPC slice${p.g === 1 ? '' : 's'}, ${p.sm} SMs, ${p.gb} GB` : res.reason} onClick={() => dispatch({ type: 'addMig', profileId: p.id })}>
                + {p.id}
              </Button>
            );
          })}
        </div>
      </Section>

      <Section title={`${backed ? 'MIG slices' : 'Instances'} · ${state.instances.length}`} accent={accent}>
        {state.instances.length === 0 ? (
          <Empty>{backed ? 'No slices yet. Add a profile above — each MIG slice hosts time-sliced vGPUs, one per 10 GB of its framebuffer.' : 'No GPU Instances yet. Add a profile above to carve the die.'}</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {state.instances.map((inst, idx) =>
              backed ? (
                <SliceCard key={inst.id} inst={inst} idx={idx} dispatch={dispatch} snap={snap} />
              ) : (
                <InstanceCard key={inst.id} inst={inst} idx={idx} dispatch={dispatch} snap={snap} />
              ),
            )}
          </div>
        )}
      </Section>
    </>
  );
}

// Pure-MIG instance (bare CUDA workload on dedicated slices).
function InstanceCard({ inst, idx, dispatch, snap }: { inst: MigInstance; idx: number; dispatch: Dispatch; snap: SimSnapshot }) {
  const m = snap.units[inst.id];
  const down = inst.faulted;
  return (
    <div style={{ border: `1px solid ${down ? C.red : `rgba(${hexToRgb(inst.color)},0.4)`}`, borderRadius: 10, padding: 12, background: `rgba(${hexToRgb(down ? C.red : inst.color)},0.05)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ width: 12, height: 12, borderRadius: 4, background: down ? C.red : inst.color }} />
        <span style={{ fontFamily: DISP, fontSize: 16, fontWeight: 600, color: C.ink }}>GI-{idx}</span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>
          {inst.profileId} · {smOf(inst.profileId)} SMs · cols {inst.cols[0]}–{inst.cols[inst.cols.length - 1]}
        </span>
        <span style={{ marginLeft: 'auto' }}>
          <button onClick={() => dispatch({ type: 'removeMig', id: inst.id })} style={xStyle} title="Remove">
            ×
          </button>
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <WorkloadSelect value={inst.workload.kind} accent={inst.color} onChange={(k) => dispatch({ type: 'setMigWorkload', id: inst.id, kind: k })} />
        <Toggle on={inst.faulted} accent={C.red} title="Inject an XID fault to show hardware isolation" onClick={() => dispatch({ type: 'toggleFault', id: inst.id })}>
          {inst.faulted ? 'XID fault' : 'Inject fault'}
        </Toggle>
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        <MetricBar label="Compute util" frac={m ? m.util : 0} value={`${Math.round((m ? m.util : 0) * 100)}%`} accent={down ? C.red : inst.color} active={!!m?.active} />
        <MetricBar label="Work done" frac={m ? Math.min(1, m.work / 200) : 0} value={`${Math.round(m ? m.work : 0)}`} accent={down ? C.red : inst.color} />
      </div>
    </div>
  );
}

// MIG-backed slice hosting 1..N time-sliced vGPUs.
function SliceCard({ inst, idx, dispatch, snap }: { inst: MigInstance; idx: number; dispatch: Dispatch; snap: SimSnapshot }) {
  const sv = snap.slices[inst.id];
  const down = inst.faulted;
  const maxVg = maxVgpusPerSlice(inst.gb);
  const canAdd = inst.vgpus.length < maxVg;
  return (
    <div style={{ border: `1px solid ${down ? C.red : C.line}`, borderRadius: 10, padding: 12, background: `rgba(${hexToRgb(down ? C.red : C.mig)},0.05)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ width: 12, height: 12, borderRadius: 4, background: down ? C.red : inst.color }} />
        <span style={{ fontFamily: DISP, fontSize: 16, fontWeight: 600, color: C.ink }}>GI-{idx}</span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>
          {inst.profileId} · {smOf(inst.profileId)} SMs · {inst.vgpus.length === 1 ? '1 vGPU' : `${inst.vgpus.length} vGPUs · time-sliced`}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <Toggle on={inst.faulted} accent={C.red} title="XID hardware fault — halts this whole slice" onClick={() => dispatch({ type: 'toggleFault', id: inst.id })}>
            {inst.faulted ? 'XID' : 'fault'}
          </Toggle>
          <button onClick={() => dispatch({ type: 'removeMig', id: inst.id })} style={xStyle} title="Remove slice">
            ×
          </button>
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {inst.vgpus.map((vg) => {
          const m = snap.units[vg.id];
          const isActive = sv?.activeVgpuId === vg.id;
          const stalledMe = !!sv && sv.activeVgpuId !== vg.id && sv.stalled;
          const vdown = inst.faulted || vg.hung;
          return (
            <div key={vg.id} style={{ border: `1px solid ${vdown ? C.red : `rgba(${hexToRgb(vg.color)},0.4)`}`, borderRadius: 8, padding: '8px 10px', background: `rgba(${hexToRgb(vdown ? C.red : vg.color)},0.06)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: 9, background: vg.hung ? C.red : vg.color, boxShadow: isActive && !vg.hung ? `0 0 8px ${vg.color}` : 'none' }} />
                <span style={{ fontFamily: DISP, fontSize: 14, fontWeight: 600, color: C.ink }}>{vg.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.dim }}>{vg.fb}GB FB</span>
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <WorkloadSelect value={vg.workload.kind} accent={vg.color} onChange={(k) => dispatch({ type: 'setSliceVgpuWorkload', instId: inst.id, vgpuId: vg.id, kind: k })} />
                  <Toggle on={vg.hung} accent={C.red} title="Hang this vGPU — stalls only its slice-mates, not other slices" onClick={() => dispatch({ type: 'toggleSliceVgpuHang', instId: inst.id, vgpuId: vg.id })}>
                    {vg.hung ? 'hung' : 'hang'}
                  </Toggle>
                  <button onClick={() => dispatch({ type: 'removeSliceVgpu', instId: inst.id, vgpuId: vg.id })} style={stepStyle} title="Remove vGPU">
                    ×
                  </button>
                </span>
              </div>
              <MetricBar
                label={stalledMe ? 'Stalled by slice-mate' : inst.vgpus.length > 1 ? 'Slice time share' : 'Compute util'}
                frac={m ? (inst.vgpus.length > 1 ? m.timeShare : m.util) : 0}
                value={`${Math.round((m ? (inst.vgpus.length > 1 ? m.timeShare : m.util) : 0) * 100)}%`}
                accent={vg.hung || stalledMe ? C.red : vg.color}
                active={!!m?.active}
              />
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10 }}>
        <Button small accent={C.vgpu} disabled={!canAdd} title={canAdd ? 'Add a time-sliced vGPU to this slice' : `Max ${maxVg} vGPU${maxVg === 1 ? '' : 's'} on a ${inst.profileId} slice (${inst.gb} GB ÷ 10 GB)`} onClick={() => dispatch({ type: 'addSliceVgpu', instId: inst.id })}>
          + time-sliced vGPU
        </Button>
      </div>
    </div>
  );
}

/* ── vGPU builder + VM list ─────────────────────────────────────────────── */
function VgpuBuilder({ state, dispatch, snap }: { state: LabState; dispatch: Dispatch; snap: SimSnapshot }) {
  return (
    <>
      <Section title="Scheduler" accent={C.vgpu}>
        <div style={{ display: 'flex', gap: 0, border: `1px solid ${C.line}`, borderRadius: 9, overflow: 'hidden', marginBottom: 12 }}>
          {(['best-effort', 'equal-share', 'fixed-share'] as SchedPolicy[]).map((p) => {
            const on = state.scheduler === p;
            return (
              <button
                key={p}
                onClick={() => dispatch({ type: 'setScheduler', scheduler: p })}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  border: 'none',
                  cursor: 'pointer',
                  background: on ? `rgba(${hexToRgb(C.vgpu)},0.16)` : 'transparent',
                  color: on ? C.vgpu : C.dim,
                  fontFamily: MONO,
                  fontSize: 12,
                }}
              >
                {p}
              </button>
            );
          })}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 12, color: C.faint, marginBottom: 10, lineHeight: 1.5 }}>
          {state.scheduler === 'best-effort' && 'Idle VMs are skipped — busy tenants split time. Highest throughput, least predictable.'}
          {state.scheduler === 'equal-share' && 'The GPU is split equally among the running VMs (1/N). Add or remove a VM and every share grows or shrinks.'}
          {state.scheduler === 'fixed-share' && 'Each VM gets a fixed slice = framebuffer / GPU memory (1/max for its type) — a 40C gets ½, a 20C ¼ — no matter how many run. Any leftover capacity sits idle (grey on the wheel). Consistent per-VM, but can waste the GPU.'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>Quantum</span>
          <input
            type="range"
            min={200}
            max={2000}
            step={100}
            value={state.quantumMs}
            onChange={(e) => dispatch({ type: 'setQuantum', quantumMs: Number(e.target.value) })}
            style={{ flex: 1, accentColor: C.vgpu }}
          />
          <span style={{ fontFamily: MONO, fontSize: 12, color: C.ink, minWidth: 60, textAlign: 'right' }}>{state.quantumMs} ms</span>
        </div>
      </Section>

      <Section title="Build · vGPU VMs" accent={C.vgpu}>
        <BudgetBar label="Framebuffer" used={usedVgpuMem(state)} total={TOTAL_MEM_GB} unit="GB" accent={C.vgpu} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {VGPU_PROFILES.map((p) => {
            const res = canPlaceVgpu(state, p);
            return (
              <Button key={p.id} small accent={C.vgpu} disabled={!res.ok} title={res.ok ? `Add VM with ${p.id}` : res.reason} onClick={() => dispatch({ type: 'addVgpu', profileId: p.id })}>
                + {p.id}
              </Button>
            );
          })}
        </div>
      </Section>

      <Section title={`Virtual machines · ${state.vms.length}`} accent={C.vgpu}>
        {state.vms.length === 0 ? (
          <Empty>No VMs yet. Add a vGPU profile above; each VM binds an SR-IOV Virtual Function.</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {state.vms.map((vm, idx) => {
              const m = snap.units[vm.id];
              const stalledMe = snap.stalledByHang && snap.activeId !== vm.id;
              return (
                <div
                  key={vm.id}
                  style={{
                    border: `1px solid ${vm.hung ? C.red : `rgba(${hexToRgb(vm.color)},0.4)`}`,
                    borderRadius: 10,
                    padding: 12,
                    background: `rgba(${hexToRgb(vm.hung ? C.red : vm.color)},0.05)`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 6, background: vm.hung ? C.red : vm.color }} />
                    <span style={{ fontFamily: DISP, fontSize: 16, fontWeight: 600, color: C.ink }}>{vm.name}</span>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim }}>
                      {vm.profileId} · {vm.fb}GB · VF{idx}
                    </span>
                    <span style={{ marginLeft: 'auto' }}>
                      <button onClick={() => dispatch({ type: 'removeVgpu', id: vm.id })} style={xStyle} title="Remove VM">
                        ×
                      </button>
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    <WorkloadSelect value={vm.workload.kind} accent={vm.color} onChange={(k) => dispatch({ type: 'setVmWorkload', id: vm.id, kind: k })} />
                    <Toggle on={vm.hung} accent={C.red} title="Simulate a hung/runaway context — stalls the shared scheduler" onClick={() => dispatch({ type: 'toggleHang', id: vm.id })}>
                      {vm.hung ? 'Hung context' : 'Hang context'}
                    </Toggle>
                  </div>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <MetricBar
                      label={stalledMe ? 'Starved' : 'GPU time share'}
                      frac={m ? m.timeShare : 0}
                      value={`${Math.round((m ? m.timeShare : 0) * 100)}%`}
                      accent={vm.hung ? C.red : stalledMe ? C.red : vm.color}
                      active={!!m?.active}
                    />
                    <MetricBar label="Work done" frac={m ? Math.min(1, m.work / 400) : 0} value={`${Math.round(m ? m.work : 0)}`} accent={vm.hung ? C.red : vm.color} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: MONO, fontSize: 13, color: C.faint, lineHeight: 1.5 }}>{children}</div>;
}

const xStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 6,
  border: `1px solid ${C.line}`,
  background: 'transparent',
  color: C.dim,
  cursor: 'pointer',
  fontSize: 16,
  lineHeight: 1,
};
const stepStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 5,
  border: `1px solid ${C.line}`,
  background: 'transparent',
  color: C.ink,
  cursor: 'pointer',
  fontSize: 13,
};
