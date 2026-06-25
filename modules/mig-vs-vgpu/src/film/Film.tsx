// "NVIDIA MIG vs vGPU — internals" — the ~3:08 diagrammatic explainer.
// Ported faithfully from the Claude Design prototype (MIGvGPUFilm.jsx).
import React from 'react';
import { C, MONO, DISP, fmtClock, hexToRgb } from '../design/theme';
import { Easing, clamp, interpolate } from '../engine/anim';
import { Stage, SceneFrame, CamRig, cam, useTime } from '../engine/timeline';
import { Die } from '../design/Die';
import { Kicker, Caption, Chip, Annotation } from '../design/atoms';

/* ── Backdrop + HUD ─────────────────────────────────────────────────────── */
function Backdrop() {
  const t = useTime();
  const scan = (t * 60) % 1080;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
          opacity: 0.5,
          maskImage: 'radial-gradient(ellipse 75% 65% at 50% 45%, #000 30%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse 75% 65% at 50% 45%, #000 30%, transparent 85%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 60% 50% at 50% 42%, rgba(133,194,10,0.06), transparent 70%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: scan,
          height: 2,
          background: 'linear-gradient(90deg, transparent, rgba(133,194,10,0.10), transparent)',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 240px rgba(0,0,0,0.7)' }} />
    </div>
  );
}

function Hud() {
  return (
    <div style={{ position: 'absolute', top: 40, left: 120, display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 9, height: 9, borderRadius: 9, background: C.mig, boxShadow: `0 0 10px ${C.mig}` }} />
      <span
        style={{
          fontFamily: MONO,
          fontSize: 15,
          letterSpacing: '0.22em',
          color: C.dim,
          textTransform: 'uppercase',
        }}
      >
        GPU Partitioning · Internals
      </span>
    </div>
  );
}
function HudClock() {
  const t = useTime();
  return (
    <div style={{ position: 'absolute', top: 40, right: 120, fontFamily: MONO, fontSize: 15, letterSpacing: '0.16em', color: C.faint }}>
      {fmtClock(t)} / 3:08
    </div>
  );
}

/* ── SCENE 0 — TITLE (0–9) ──────────────────────────────────────────────── */
function S0_Title({ lt }: { lt: number }) {
  const dieR = clamp(lt / 1.6, 0, 1);
  const dieO = clamp(lt / 1.0, 0, 1) * (lt > 6.4 ? clamp((7.6 - lt) / 1.2, 0, 1) : 1) * 0.8;
  const t1 = clamp((lt - 1.4) / 0.6, 0, 1);
  const t2 = clamp((lt - 2.1) / 0.6, 0, 1);
  const sub = clamp((lt - 3.0) / 0.8, 0, 1);
  const dieScale = interpolate([0, 2, 9], [0.86, 0.92, 1.0], Easing.easeOutCubic)(lt);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 470,
          transform: `translate(-50%,-50%) scale(${dieScale})`,
          opacity: dieO * 0.5,
          filter: 'blur(0.3px)',
        }}
      >
        <Die w={520} h={490} reveal={dieR} litCols={'none'} hideHeader label="GPU DIE" />
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, top: 372, textAlign: 'center' }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 20,
            letterSpacing: '0.4em',
            textTransform: 'uppercase',
            color: C.mig,
            opacity: t1,
            transform: `translateY(${(1 - t1) * 10}px)`,
          }}
        >
          One GPU · Many Tenants
        </div>
        <div
          style={{
            fontFamily: DISP,
            fontWeight: 700,
            fontSize: 132,
            letterSpacing: '-0.03em',
            color: C.ink,
            lineHeight: 1,
            marginTop: 22,
            opacity: t2,
            transform: `translateY(${(1 - t2) * 18}px)`,
          }}
        >
          MIG <span style={{ color: C.faint, fontWeight: 400 }}>vs</span> <span style={{ color: C.vgpu }}>vGPU</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 24, color: C.dim, marginTop: 26, opacity: sub, letterSpacing: '0.02em' }}>
          Two ways to share a datacenter GPU — and what's really happening inside the silicon.
        </div>
      </div>
    </div>
  );
}

/* ── SCENE 1 — GPU ANATOMY (9–31) ───────────────────────────────────────── */
function S1_Anatomy({ lt }: { lt: number }) {
  const reveal = clamp(lt / 2.6, 0, 1);
  const z = interpolate([0, 3.5, 9, 15, 22], [1.04, 1.12, 1.16, 1.08, 1.02], Easing.easeInOutSine)(lt);
  const fx = interpolate([0, 9, 15, 22], [960, 980, 720, 960], Easing.easeInOutSine)(lt);
  const fy = interpolate([0, 9, 22], [470, 430, 470], Easing.easeInOutSine)(lt);
  const litCols = lt > 12 ? [3] : 'none';
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <CamRig transform={cam(fx, fy, z)}>
        <div style={{ position: 'absolute', left: 960, top: 470, transform: 'translate(-50%,-50%)' }}>
          <Die w={620} h={560} reveal={reveal} litCols={litCols} label="GA100 · GPU DIE" />
        </div>
        <Annotation x={745} y={300} dx={-150} dy={-40} title="GPCs → SMs" sub="compute · streaming multiprocessors" lt={lt} delay={4.5} />
        <Annotation x={1175} y={470} dx={150} dy={-10} title="L2 cache + crossbar" sub="shared on-chip bandwidth" lt={lt} delay={6.0} />
        <Annotation x={1175} y={628} dx={150} dy={20} title="Memory controllers" sub="8 slices → HBM2e stacks" lt={lt} delay={7.5} />
      </CamRig>

      <Caption
        lt={lt}
        kicker="Anatomy of a datacenter GPU"
        title="Three resources decide how a GPU is shared."
        body={
          lt > 11
            ? 'Compute (GPCs full of SMs), the shared L2 cache + crossbar, and the memory controllers feeding HBM. MIG and vGPU each divide these three — very differently.'
            : "Before you divide a GPU, know what's inside."
        }
      />
    </div>
  );
}

/* ── SCENE 2 — TWO PHILOSOPHIES (31–41) ─────────────────────────────────── */
function S2_Split({ lt }: { lt: number }) {
  const e = Easing.easeInOutCubic(clamp((lt - 0.3) / 1.1, 0, 1));
  const sx = e * 360;
  const leftReveal = clamp((lt - 1.0) / 1.2, 0, 1);
  const rightReveal = clamp((lt - 1.0) / 1.2, 0, 1);
  const lblL = clamp((lt - 2.0) / 0.6, 0, 1);
  const lblR = clamp((lt - 2.4) / 0.6, 0, 1);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 600, top: 430, transform: `translate(-50%,-50%) translateX(${-sx}px)` }}>
        <Die w={460} h={430} accent={C.mig} reveal={leftReveal} litCols={'all'} label="MIG" />
        <div style={{ position: 'absolute', left: '50%', top: -86, transform: 'translateX(-50%)', textAlign: 'center', opacity: lblL }}>
          <div style={{ fontFamily: DISP, fontSize: 40, fontWeight: 700, color: C.mig, letterSpacing: '-0.02em' }}>MIG</div>
          <div style={{ fontFamily: MONO, fontSize: 17, color: C.dim, marginTop: 4 }}>carve the silicon · spatial</div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 1320, top: 430, transform: `translate(-50%,-50%) translateX(${sx}px)` }}>
        <Die w={460} h={430} accent={C.vgpu} reveal={rightReveal} litCols={'all'} label="vGPU" />
        <div style={{ position: 'absolute', left: '50%', top: -86, transform: 'translateX(-50%)', textAlign: 'center', opacity: lblR }}>
          <div style={{ fontFamily: DISP, fontSize: 40, fontWeight: 700, color: C.vgpu, letterSpacing: '-0.02em' }}>vGPU</div>
          <div style={{ fontFamily: MONO, fontSize: 17, color: C.dim, marginTop: 4 }}>share the clock · temporal</div>
        </div>
      </div>

      <Caption
        lt={lt}
        accent={C.ink}
        title="Same chip. Two philosophies."
        body="MIG partitions the GPU in space — dedicated hardware per tenant. vGPU partitions it in time — the whole GPU, scheduled across VMs. Let's open each one up."
      />
    </div>
  );
}

/* ── SCENE 3 — MIG SPATIAL SLICING (41–63) ──────────────────────────────── */
function S3_MigSlice({ lt }: { lt: number }) {
  const dividers = clamp((lt - 2.5) / 2.0, 0, 1);
  const memAssign = clamp((lt - 9) / 3.5, 0, 1);
  const memGroups = lt > 9
    ? Array.from({ length: 8 }, (_, i) => {
        if (i === 7) return 'reserved';
        return i / 7 <= memAssign ? C.mig : null;
      })
    : null;
  const showGroups = lt > 13;
  const groups = showGroups
    ? Array.from({ length: 7 }, (_, i) => ({ cols: [i], color: C.mig, o: clamp((lt - 13 - i * 0.25) / 0.5, 0, 1) }))
    : null;
  const z = interpolate([0, 4, 22], [1.0, 1.06, 1.0], Easing.easeInOutSine)(lt);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <CamRig transform={cam(960, 430, z)}>
        <div style={{ position: 'absolute', left: 960, top: 430, transform: 'translate(-50%,-50%)' }}>
          <Die w={680} h={540} accent={C.mig} reveal={1} litCols={'all'} dividers={dividers} groups={groups} memGroups={memGroups} label="MIG · GA100" />
        </div>
      </CamRig>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 96,
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 14,
          opacity: clamp((lt - 15) / 0.8, 0, 1),
        }}
      >
        <Chip accent={C.mig}>7 compute slices</Chip>
        <Chip accent={C.mig}>8 memory slices · 1 reserved</Chip>
        <Chip accent={C.mig}>hard-wired in hardware</Chip>
      </div>

      <Caption
        lt={lt}
        kicker="MIG · spatial partitioning"
        accent={C.mig}
        title={lt > 9 ? 'Compute, cache and memory are hard-assigned.' : 'MIG slices the physical die.'}
        body={
          lt > 9
            ? 'Each GPU Instance gets dedicated SMs, its own L2 slices and its own memory controllers. The crossbar paths are partitioned too — these are real, electrically-isolated boundaries, not software quotas.'
            : 'On an A100, the silicon divides into 7 compute slices and 8 memory slices — fixed partitions etched across the GPCs and memory system.'
        }
      />
    </div>
  );
}

/* ── SCENE 4 — MIG PROFILES (63–82) ─────────────────────────────────────── */
function S4_Profiles({ lt }: { lt: number }) {
  const layout = [
    { cols: [0, 1, 2], label: '3g.20gb', t: 0.4 },
    { cols: [3, 4], label: '2g.10gb', t: 1.4 },
    { cols: [5], label: '1g.5gb', t: 2.4 },
    { cols: [6], label: '1g.5gb', t: 3.0 },
  ];
  const groups = layout
    .filter((g) => lt > 5 + g.t)
    .map((g) => ({ cols: g.cols, label: g.label, color: C.mig, o: clamp((lt - 5 - g.t) / 0.5, 0, 1) }));
  const memGroups = lt > 5
    ? (() => {
        const map = [C.mig, C.mig, C.mig, C.mig, C.mig, C.mig, C.mig, 'reserved'];
        return map.map((c, i) => (i === 7 ? 'reserved' : lt > 5.4 + i * 0.2 ? c : null));
      })()
    : null;

  const profiles = ['1g.5gb', '1g.10gb', '2g.10gb', '3g.20gb', '4g.20gb', '7g.40gb'];
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 560, top: 446, transform: 'translate(-50%,-50%)' }}>
        <Die w={620} h={520} accent={C.mig} reveal={1} litCols={'all'} dividers={1} groups={groups} memGroups={memGroups} hideHeader label="MIG PROFILE LAYOUT" />
      </div>

      <div style={{ position: 'absolute', right: 150, top: 250, width: 470, opacity: clamp((lt - 1.0) / 0.8, 0, 1) }}>
        <Kicker accent={C.mig} lt={lt}>
          Profile catalog · A100-40GB
        </Kicker>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 22 }}>
          {profiles.map((p, i) => {
            const o = clamp((lt - 1.6 - i * 0.18) / 0.4, 0, 1);
            const [g] = p.split('.');
            return (
              <div
                key={p}
                style={{
                  fontFamily: MONO,
                  fontSize: 20,
                  padding: '14px 16px',
                  borderRadius: 8,
                  border: `1px solid ${C.migEdge}`,
                  background: C.migSoft,
                  color: C.ink,
                  opacity: o,
                  transform: `translateX(${(1 - o) * 16}px)`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 600 }}>{p}</span>
                <span style={{ color: C.mig, fontSize: 14 }}>{g.replace('g', '')}/7</span>
              </div>
            );
          })}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 16, color: C.dim, marginTop: 20, lineHeight: 1.5, opacity: clamp((lt - 4) / 0.8, 0, 1) }}>
          <span style={{ color: C.mig }}>g</span> = compute slices (of 7) · <span style={{ color: C.mig }}>gb</span> = framebuffer.
          <br />
          GPU Instance → <span style={{ color: C.mig }}>Compute Instances</span> subdivide SMs while sharing the instance's memory.
        </div>
      </div>

      <Caption
        lt={lt}
        kicker="MIG · fixed profiles"
        accent={C.mig}
        title="Profiles name the slice: 1g.5gb → 7g.40gb."
        body="Mix and match instances to fit the workload — here a 3g.20gb beside a 2g.10gb and two 1g.5gb. Each is a complete, independent GPU to CUDA."
      />
    </div>
  );
}

/* ── SCENE 5 — MIG ISOLATION + QoS (82–96) ──────────────────────────────── */
function S5_Isolation({ lt }: { lt: number }) {
  const faulting = lt > 3 && lt < 9.5;
  const groups = Array.from({ length: 4 }, (_, i) => {
    const spans = [[0, 1], [2], [3, 4], [5, 6]][i];
    return { cols: spans, label: ['GI-0', 'GI-1', 'GI-2', 'GI-3'][i], color: C.mig, fault: i === 1 && faulting };
  });
  const qos = [0.28, 0.14, 0.29, 0.29];
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 600, top: 450, transform: 'translate(-50%,-50%)' }}>
        <Die
          w={580}
          h={500}
          accent={C.mig}
          reveal={1}
          litCols={faulting ? [0, 1, 3, 4, 5, 6] : 'all'}
          dividers={1}
          groups={groups}
          hideHeader
          label="MIG · 4 INSTANCES"
        />
      </div>

      <div style={{ position: 'absolute', right: 150, top: 300, width: 470, opacity: clamp((lt - 1) / 0.8, 0, 1) }}>
        <Kicker accent={C.mig} lt={lt}>
          Guaranteed QoS
        </Kicker>
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {qos.map((q, i) => {
            const o = clamp((lt - 1.6 - i * 0.2) / 0.4, 0, 1);
            const broken = i === 1 && faulting;
            return (
              <div key={i} style={{ opacity: o }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontFamily: MONO,
                    fontSize: 15,
                    color: broken ? C.red : C.dim,
                    marginBottom: 6,
                  }}
                >
                  <span>GI-{i} · dedicated BW + L2</span>
                  <span>{broken ? 'halted' : 'steady'}</span>
                </div>
                <div style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${(q * 100) / 0.3 * 0.9}%`,
                      height: '100%',
                      borderRadius: 6,
                      background: broken ? C.red : C.mig,
                      boxShadow: `0 0 12px ${broken ? C.red : C.mig}77`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Caption
        lt={lt}
        kicker="MIG · fault isolation & QoS"
        accent={C.mig}
        title={faulting ? 'A fault in GI-1 stays in GI-1.' : 'No noisy neighbors. Ever.'}
        body="Because the partitions are physical, a memory error or fault in one instance can't corrupt or stall another. Bandwidth and L2 are reserved — performance is deterministic, not best-effort."
      />
    </div>
  );
}

/* ── SCENE 6 — vGPU SR-IOV (96–112) ─────────────────────────────────────── */
function S6_SRIOV({ lt }: { lt: number }) {
  const memGroups = lt > 5
    ? Array.from({ length: 8 }, (_, i) => [C.vgpu, C.vgpu, C.amber, C.amber, '#8b5cf6', '#8b5cf6', '#e879a6', '#e879a6'][i])
    : null;
  const vmColors = [C.vgpu, C.amber, '#8b5cf6', '#e879a6'];
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 600, top: 392, transform: 'translate(-50%,-50%)' }}>
        <Die w={560} h={470} accent={C.vgpu} reveal={1} litCols={'all'} memGroups={memGroups} label="vGPU · GA100 (SR-IOV)" />
      </div>

      <div style={{ position: 'absolute', right: 140, top: 250, width: 500 }}>
        <Kicker accent={C.vgpu} lt={lt}>
          SR-IOV · Ampere &amp; later
        </Kicker>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 22 }}>
          {['VM 0', 'VM 1', 'VM 2', 'VM 3'].map((vm, i) => {
            const o = clamp((lt - 2 - i * 0.3) / 0.5, 0, 1);
            return (
              <div
                key={vm}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 18px',
                  borderRadius: 10,
                  border: `1px solid ${vmColors[i]}`,
                  background: `rgba(${hexToRgb(vmColors[i])},0.1)`,
                  opacity: o,
                  transform: `translateX(${(1 - o) * 24}px)`,
                }}
              >
                <span style={{ fontFamily: MONO, fontSize: 13, color: vmColors[i], padding: '3px 8px', border: `1px solid ${vmColors[i]}`, borderRadius: 5 }}>
                  VF{i}
                </span>
                <span style={{ fontFamily: DISP, fontSize: 22, fontWeight: 600, color: C.ink }}>{vm}</span>
                <span style={{ fontFamily: MONO, fontSize: 14, color: C.dim, marginLeft: 'auto' }}>A100-2-10C</span>
              </div>
            );
          })}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 15, color: C.dim, marginTop: 18, lineHeight: 1.5, opacity: clamp((lt - 4.5) / 0.8, 0, 1) }}>
          Each VM binds a <span style={{ color: C.vgpu }}>Virtual Function</span> — its own PCIe BDF, MMIO &amp; DMA space.
        </div>
      </div>

      <Caption
        lt={lt}
        kicker="vGPU · SR-IOV virtual functions"
        accent={C.vgpu}
        title="The GPU advertises Virtual Functions — one per VM."
        body="On Ampere and later the vGPU Manager uses SR-IOV: each guest gets its own VF with isolated PCIe address space and DMA. Framebuffer is statically carved per C-series profile — memory is partitioned."
      />
    </div>
  );
}

/* ── SCENE 7 — vGPU TIME-SLICING SCHEDULER (112–134) ────────────────────── */
function S7_TimeSlice({ lt }: { lt: number }) {
  const vmColors = [C.vgpu, C.amber, '#8b5cf6', '#e879a6'];
  const vmNames = ['VM 0', 'VM 1', 'VM 2', 'VM 3'];
  const cycle = 1.1;
  const activeIdx = lt > 3 ? Math.floor((lt - 3) / cycle) % 4 : 0;
  const memGroups = Array.from({ length: 8 }, (_, i) => [C.vgpu, C.vgpu, C.amber, C.amber, '#8b5cf6', '#8b5cf6', '#e879a6', '#e879a6'][i]);
  const sliceFrac = ((lt - 3) % cycle) / cycle;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 590, top: 392, transform: 'translate(-50%,-50%)' }}>
        <Die w={560} h={470} accent={C.vgpu} reveal={1} litCols={'all'} activeAccent={vmColors[activeIdx]} memGroups={memGroups} label="vGPU · TIME-SLICED COMPUTE" />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: -64,
            transform: 'translateX(-50%)',
            fontFamily: MONO,
            fontSize: 18,
            letterSpacing: '0.04em',
            color: vmColors[activeIdx],
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: 10, background: vmColors[activeIdx], boxShadow: `0 0 12px ${vmColors[activeIdx]}` }} />
          entire SM array → {vmNames[activeIdx]}
        </div>
      </div>

      <div style={{ position: 'absolute', right: 250, top: 300, width: 360, opacity: clamp((lt - 1) / 0.8, 0, 1) }}>
        <Kicker accent={C.vgpu} lt={lt}>
          Time-slice scheduler
        </Kicker>
        <div style={{ position: 'relative', width: 300, height: 300, margin: '34px auto 0' }}>
          <svg width="300" height="300" viewBox="0 0 300 300" style={{ position: 'absolute', inset: 0 }}>
            {vmColors.map((c, i) => {
              const a0 = (i / 4) * Math.PI * 2 - Math.PI / 2;
              const a1 = ((i + 1) / 4) * Math.PI * 2 - Math.PI / 2;
              const r = 130;
              const cx = 150;
              const cy = 150;
              const x0 = cx + r * Math.cos(a0);
              const y0 = cy + r * Math.sin(a0);
              const x1 = cx + r * Math.cos(a1);
              const y1 = cy + r * Math.sin(a1);
              const isActive = i === activeIdx;
              return (
                <path
                  key={i}
                  d={`M${cx},${cy} L${x0},${y0} A${r},${r} 0 0,1 ${x1},${y1} Z`}
                  fill={`rgba(${hexToRgb(c)},${isActive ? 0.85 : 0.16})`}
                  stroke={c}
                  strokeWidth={isActive ? 2.5 : 1}
                />
              );
            })}
            <line
              x1="150"
              y1="150"
              x2={150 + 128 * Math.cos((lt > 3 ? (((lt - 3) / cycle) % 4) / 4 : 0) * Math.PI * 2 - Math.PI / 2 + (sliceFrac / 4) * Math.PI * 2)}
              y2={150 + 128 * Math.sin((lt > 3 ? (((lt - 3) / cycle) % 4) / 4 : 0) * Math.PI * 2 - Math.PI / 2 + (sliceFrac / 4) * Math.PI * 2)}
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="150" cy="150" r="46" fill={C.bg} stroke="rgba(255,255,255,0.14)" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
            <div style={{ fontFamily: DISP, fontSize: 30, fontWeight: 700, color: vmColors[activeIdx] }}>{vmNames[activeIdx].replace('VM ', 'VM')}</div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: C.faint, letterSpacing: '0.1em' }}>1ms quantum</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 22, opacity: clamp((lt - 6) / 0.8, 0, 1) }}>
          <Chip accent={C.vgpu}>Best-effort</Chip>
          <Chip accent={C.vgpu}>Equal-share</Chip>
          <Chip accent={C.vgpu}>Fixed-share</Chip>
        </div>
      </div>

      <Caption
        lt={lt}
        kicker="vGPU · temporal partitioning"
        accent={C.vgpu}
        title="The whole GPU is handed to each VM, in turn."
        body="Compute isn't carved in space — it's shared in time. The scheduler grants the entire SM array to one VM per quantum, then rotates. Best-effort, equal-share or fixed-share policies tune the QoS."
      />
    </div>
  );
}

/* ── SCENE 8 — vGPU ISOLATION NOTE (134–144) ────────────────────────────── */
function S8_VgpuIso({ lt }: { lt: number }) {
  const hang = lt > 3 && lt < 8;
  const memGroups = Array.from({ length: 8 }, (_, i) => [C.vgpu, C.vgpu, C.amber, C.amber, '#8b5cf6', '#8b5cf6', '#e879a6', '#e879a6'][i]);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 600, top: 410, transform: 'translate(-50%,-50%)' }}>
        <Die w={560} h={480} accent={C.vgpu} reveal={1} litCols={'all'} activeAccent={hang ? C.red : C.amber} memGroups={memGroups} label="vGPU · SCHEDULER STALL" />
        {hang ? (
          <div style={{ position: 'absolute', left: '50%', bottom: -60, transform: 'translateX(-50%)', fontFamily: MONO, fontSize: 18, color: C.red }}>
            VM 1 hangs → queue stalls for all
          </div>
        ) : null}
      </div>

      <div style={{ position: 'absolute', right: 150, top: 320, width: 480, opacity: clamp((lt - 1) / 0.8, 0, 1) }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <IsoRow ok label="Memory" note="static framebuffer · isolated" lt={lt} d={1.6} />
          <IsoRow ok label="PCIe / DMA" note="SR-IOV VF · isolated" lt={lt} d={1.9} />
          <IsoRow ok={false} label="Compute fault" note="time-shared · no spatial isolation" lt={lt} d={2.2} />
        </div>
      </div>

      <Caption
        lt={lt}
        kicker="vGPU · the trade-off"
        accent={C.vgpu}
        title="Memory is isolated. Compute is shared."
        body="SR-IOV isolates each VM's framebuffer and DMA — but compute lives on a shared scheduler. A hung or runaway context can stall the queue. There's no hardware fault containment like MIG."
      />
    </div>
  );
}
function IsoRow({ ok, label, note, lt, d }: { ok: boolean; label: string; note: string; lt: number; d: number }) {
  const o = clamp((lt - d) / 0.5, 0, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: o, transform: `translateX(${(1 - o) * 18}px)` }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          flexShrink: 0,
          border: `1.5px solid ${ok ? C.vgpu : C.red}`,
          background: `rgba(${hexToRgb(ok ? C.vgpu : C.red)},0.14)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: MONO,
          fontSize: 18,
          color: ok ? C.vgpu : C.red,
          fontWeight: 700,
        }}
      >
        {ok ? '✓' : '!'}
      </div>
      <div>
        <div style={{ fontFamily: DISP, fontSize: 22, fontWeight: 600, color: C.ink }}>{label}</div>
        <div style={{ fontFamily: MONO, fontSize: 15, color: C.dim, marginTop: 1 }}>{note}</div>
      </div>
    </div>
  );
}

/* ── SCENE 9 — COMPARISON MATRIX (144–166) ──────────────────────────────── */
function S9_Compare({ lt }: { lt: number }) {
  const rows = [
    ['Partitioning', 'Spatial — physical silicon', 'Temporal — scheduler + static FB'],
    ['Compute', 'Dedicated SMs per instance', 'Whole SM array, time-sliced'],
    ['Memory', 'Dedicated controllers + slices', 'Static framebuffer per profile'],
    ['Fault isolation', 'Hardware-enforced', 'Memory only · compute shared'],
    ['QoS', 'Guaranteed BW + L2', 'Scheduler policy (BE/Equal/Fixed)'],
    ['Granularity', 'Fixed profiles (1g.5gb…7g.40gb)', 'Flexible framebuffer (C-series)'],
    ['Best for', 'Guaranteed multi-tenant inference', 'VM density · VDI · flexible sharing'],
  ];
  const titleO = clamp(lt / 0.6, 0, 1);
  return (
    <div style={{ position: 'absolute', inset: 0, paddingTop: 96 }}>
      <div style={{ textAlign: 'center', opacity: titleO }}>
        <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: '0.4em', textTransform: 'uppercase', color: C.faint }}>Side by side</div>
        <div style={{ fontFamily: DISP, fontSize: 46, fontWeight: 700, color: C.ink, letterSpacing: '-0.02em', marginTop: 18 }}>
          <span style={{ color: C.mig }}>MIG</span> vs <span style={{ color: C.vgpu }}>vGPU</span>, at a glance
        </div>
      </div>

      <div style={{ width: 1480, margin: '60px auto 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 1fr', gap: 18, marginBottom: 14, opacity: clamp((lt - 0.4) / 0.5, 0, 1) }}>
          <div />
          <ColHead name="MIG" tag="spatial" color={C.mig} />
          <ColHead name="vGPU" tag="temporal" color={C.vgpu} />
        </div>
        {rows.map((r, i) => {
          const o = clamp((lt - 1.0 - i * 0.28) / 0.5, 0, 1);
          return (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '300px 1fr 1fr',
                gap: 18,
                alignItems: 'stretch',
                marginBottom: 10,
                opacity: o,
                transform: `translateY(${(1 - o) * 14}px)`,
              }}
            >
              <div style={{ fontFamily: MONO, fontSize: 17, color: C.dim, letterSpacing: '0.04em', display: 'flex', alignItems: 'center' }}>{r[0]}</div>
              <Cell color={C.mig}>{r[1]}</Cell>
              <Cell color={C.vgpu}>{r[2]}</Cell>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function ColHead({ name, tag, color }: { name: string; tag: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '0 22px' }}>
      <span style={{ fontFamily: DISP, fontSize: 32, fontWeight: 700, color }}>{name}</span>
      <span style={{ fontFamily: MONO, fontSize: 15, color: C.dim, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{tag}</span>
    </div>
  );
}
function Cell({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 18,
        color: C.ink,
        padding: '14px 22px',
        borderRadius: 10,
        border: `1px solid rgba(${hexToRgb(color)},0.3)`,
        background: `rgba(${hexToRgb(color)},0.07)`,
        display: 'flex',
        alignItems: 'center',
        lineHeight: 1.4,
      }}
    >
      {children}
    </div>
  );
}

/* ── SCENE 10 — MIG-BACKED vGPU + MPS (166–180) ─────────────────────────── */
function S10_Combine({ lt }: { lt: number }) {
  const stackO = clamp((lt - 0.5) / 1.0, 0, 1);
  const vmO = clamp((lt - 2.0) / 0.8, 0, 1);
  const mpsO = clamp((lt - 5.0) / 0.8, 0, 1);
  return (
    <div style={{ position: 'absolute', inset: 0, paddingTop: 130 }}>
      <div style={{ textAlign: 'center' }}>
        <Kicker accent={C.ink} lt={lt}>
          <span style={{ margin: '0 auto' }}>They compose</span>
        </Kicker>
        <div style={{ fontFamily: DISP, fontSize: 44, fontWeight: 700, color: C.ink, marginTop: 18, letterSpacing: '-0.02em' }}>
          Not either/or — <span style={{ color: C.mig }}>MIG</span>-backed <span style={{ color: C.vgpu }}>vGPU</span>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 480, top: 380, transform: 'translate(-50%,0)', width: 560, opacity: stackO }}>
        <div style={{ position: 'relative' }}>
          <div style={{ border: `1.5px solid ${C.mig}`, borderRadius: 14, padding: 18, background: C.migSoft, boxShadow: `0 0 30px ${C.mig}33` }}>
            <div style={{ fontFamily: MONO, fontSize: 15, color: C.mig, letterSpacing: '0.1em', marginBottom: 12 }}>MIG INSTANCE · 3g.20gb</div>
            <Die w={520} h={240} accent={C.mig} reveal={1} litCols={[0, 1, 2]} label="" />
          </div>
          <div
            style={{
              position: 'absolute',
              right: -30,
              top: -30,
              opacity: vmO,
              border: `1.5px solid ${C.vgpu}`,
              borderRadius: 12,
              padding: '14px 20px',
              background: `rgba(${hexToRgb(C.vgpu)},0.12)`,
              backdropFilter: 'blur(6px)',
            }}
          >
            <div style={{ fontFamily: DISP, fontSize: 22, fontWeight: 600, color: C.ink }}>Guest VM</div>
            <div style={{ fontFamily: MONO, fontSize: 14, color: C.vgpu, marginTop: 2 }}>SR-IOV VF → MIG slice</div>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', right: 150, top: 380, width: 440, opacity: mpsO }}>
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, padding: '24px 26px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: '0.18em', color: C.amber, marginBottom: 12 }}>FOOTNOTE · MPS</div>
          <div style={{ fontFamily: DISP, fontSize: 26, fontWeight: 600, color: C.ink, lineHeight: 1.2 }}>Multi-Process Service</div>
          <div style={{ fontFamily: MONO, fontSize: 16, color: C.dim, marginTop: 14, lineHeight: 1.55 }}>
            Cooperative spatial sharing inside <span style={{ color: C.ink }}>one</span> process space — many CUDA contexts, merged. Lower switch cost than time-slicing, but{' '}
            <span style={{ color: C.amber }}>no memory protection, no QoS</span>.
          </div>
        </div>
      </div>

      <Caption
        lt={lt}
        accent={C.ink}
        title={lt > 3 ? 'Spatial guarantees + full VM isolation.' : 'Stack them together.'}
        body="Run a vGPU on top of a MIG instance and you get hardware partitioning and per-VM isolation at once — the common pattern for secure, guaranteed multi-tenant GPU clouds."
      />
    </div>
  );
}

/* ── SCENE 11 — CLOSING (180–188) ───────────────────────────────────────── */
function S11_Close({ lt }: { lt: number }) {
  const o1 = clamp((lt - 0.4) / 0.8, 0, 1);
  const o2 = clamp((lt - 1.4) / 0.8, 0, 1);
  const o3 = clamp((lt - 2.6) / 0.9, 0, 1);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 28, opacity: o1, marginBottom: 56 }}>
        <Die w={300} h={250} accent={C.mig} reveal={1} litCols={'all'} dividers={1} hideHeader label="MIG · SPATIAL" />
        <Die w={300} h={250} accent={C.vgpu} reveal={1} litCols={'all'} hideHeader label="vGPU · TEMPORAL" />
      </div>
      <div
        style={{
          fontFamily: DISP,
          fontSize: 52,
          fontWeight: 700,
          color: C.ink,
          letterSpacing: '-0.02em',
          textAlign: 'center',
          opacity: o2,
          lineHeight: 1.12,
          whiteSpace: 'nowrap',
        }}
      >
        Carve the silicon, <span style={{ color: C.mig }}>or</span> share the clock.
      </div>
      <div style={{ fontFamily: MONO, fontSize: 22, color: C.dim, marginTop: 36, opacity: o3, letterSpacing: '0.02em' }}>
        Now you know what's happening inside the GPU.
      </div>
    </div>
  );
}

/* ── ROOT FILM ──────────────────────────────────────────────────────────── */
export function Film() {
  return (
    <Stage width={1920} height={1080} duration={188} background={C.bg}>
      <Backdrop />
      <Hud />
      <HudClock />

      <SceneFrame start={0} end={9}>{(lt) => <S0_Title lt={lt} />}</SceneFrame>
      <SceneFrame start={9} end={31}>{(lt) => <S1_Anatomy lt={lt} />}</SceneFrame>
      <SceneFrame start={31} end={41}>{(lt) => <S2_Split lt={lt} />}</SceneFrame>
      <SceneFrame start={41} end={63}>{(lt) => <S3_MigSlice lt={lt} />}</SceneFrame>
      <SceneFrame start={63} end={82}>{(lt) => <S4_Profiles lt={lt} />}</SceneFrame>
      <SceneFrame start={82} end={96}>{(lt) => <S5_Isolation lt={lt} />}</SceneFrame>
      <SceneFrame start={96} end={112}>{(lt) => <S6_SRIOV lt={lt} />}</SceneFrame>
      <SceneFrame start={112} end={134}>{(lt) => <S7_TimeSlice lt={lt} />}</SceneFrame>
      <SceneFrame start={134} end={144}>{(lt) => <S8_VgpuIso lt={lt} />}</SceneFrame>
      <SceneFrame start={144} end={166}>{(lt) => <S9_Compare lt={lt} />}</SceneFrame>
      <SceneFrame start={166} end={180}>{(lt) => <S10_Combine lt={lt} />}</SceneFrame>
      <SceneFrame start={180} end={188} fout={0.2}>{(lt) => <S11_Close lt={lt} />}</SceneFrame>
    </Stage>
  );
}
