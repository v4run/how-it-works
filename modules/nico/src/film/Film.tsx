// "NVIDIA Infra Controller (NICo)" — the ~1:46 diagrammatic explainer.
// Ported faithfully from the Claude Design prototype (nico-film.jsx) onto the
// project's own timeline engine (Stage / SceneFrame, scenes take localTime).
import React from 'react';
import { C, MONO, DISP, UI, fmtClock } from '../design/theme';
import { Easing, clamp } from '../engine/anim';
import { Stage, SceneFrame, useTime } from '../engine/timeline';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = Easing;
// envelope 0..1 over a window [a,b] of localTime with in/out ramps
const env = (lt: number, a: number, b: number, ramp = 0.5) => {
  if (lt < a) return 0;
  if (lt > b) return 0;
  if (lt < a + ramp) return ease.easeOutCubic(clamp((lt - a) / ramp, 0, 1));
  if (lt > b - ramp) return clamp((b - lt) / ramp, 0, 1);
  return 1;
};
const appear = (lt: number, at: number, dur = 0.6) => ease.easeOutCubic(clamp((lt - at) / dur, 0, 1));

/* ── Caption (lower-left lower-third) ───────────────────────────────────── */
function Caption({ lt, kicker, title, sub, at = 0.3, x = 132, y = 806 }: { lt: number; kicker: string; title: React.ReactNode; sub?: React.ReactNode; at?: number; x?: number; y?: number }) {
  const a = appear(lt, at, 0.6);
  const a2 = appear(lt, at + 0.18, 0.6);
  return (
    <div style={{ position: 'absolute', left: x, top: y, maxWidth: 980 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: a, transform: `translateY(${(1 - a) * 14}px)` }}>
        <div style={{ width: 4, height: 22, background: C.green, borderRadius: 2, boxShadow: `0 0 12px ${C.green}` }} />
        <div style={{ font: `500 15px/1 ${MONO}`, letterSpacing: '0.26em', color: C.green, textTransform: 'uppercase' }}>{kicker}</div>
      </div>
      <div style={{ marginTop: 16, font: `600 56px/1.05 ${DISP}`, letterSpacing: '-0.02em', color: C.ink, opacity: a, transform: `translateY(${(1 - a) * 16}px)` }}>{title}</div>
      {sub && (
        <div style={{ marginTop: 16, font: `400 21px/1.5 ${UI}`, color: C.dim, maxWidth: 760, opacity: a2, transform: `translateY(${(1 - a2) * 12}px)` }}>{sub}</div>
      )}
    </div>
  );
}

/* ── Persistent backdrop (grid + vignette) ──────────────────────────────── */
function Backdrop() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.bg }}>
      <div style={{ position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(${C.lineSoft} 1px, transparent 1px), linear-gradient(90deg, ${C.lineSoft} 1px, transparent 1px)`,
        backgroundSize: '64px 64px', opacity: 0.6 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 70% at 50% 42%, rgba(118,185,0,0.05), transparent 70%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 120% 120% at 50% 50%, transparent 45%, rgba(0,0,0,0.55))' }} />
    </div>
  );
}

/* ── Server rack (datacenter background) ─────────────────────────────────── */
function Rack({ x, y, w, h, units, idx, allGreen, t }: { x: number; y: number; w: number; h: number; units: number; idx: number; allGreen?: boolean; t: number }) {
  const unitH = (h - 24) / units;
  const rows: React.ReactNode[] = [];
  for (let i = 0; i < units; i++) {
    const seed = (idx * 97 + i * 31) % 100;
    let led: string, glow = true;
    if (allGreen) led = C.green;
    else if (seed % 11 === 0) led = C.amber;
    else if (seed % 3 === 0) led = C.green;
    else { led = 'rgba(255,255,255,0.13)'; glow = false; }
    const blink = glow ? (0.45 + 0.55 * Math.abs(Math.sin(t * 1.5 + seed))) : 1;
    rows.push(
      <div key={i} style={{ height: unitH - 4, margin: '2px 0', background: '#0a0f0b', border: '1px solid rgba(255,255,255,0.045)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 7px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[0, 1].map((k) => <div key={k} style={{ width: 22, height: 1.5, background: 'rgba(255,255,255,0.07)' }} />)}
        </div>
        <div style={{ width: 6, height: 6, borderRadius: 3, background: led, opacity: blink, boxShadow: glow ? `0 0 7px ${led}` : 'none' }} />
      </div>,
    );
  }
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, background: 'linear-gradient(#0c110d,#080b09)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, padding: 12, boxSizing: 'border-box', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
      {rows}
    </div>
  );
}

function RackRow({ y = 320, count = 7, allGreen = false }: { y?: number; count?: number; allGreen?: boolean }) {
  const t = useTime();
  const rackW = 152, gap = 38, h = 500;
  const startX = (1920 - (count * rackW + (count - 1) * gap)) / 2;
  const racks: React.ReactNode[] = [];
  for (let r = 0; r < count; r++) {
    racks.push(<Rack key={r} x={startX + r * (rackW + gap)} y={y} w={rackW} h={h} units={13} idx={r} allGreen={allGreen} t={t} />);
  }
  return (
    <>
      {racks}
      <div style={{ position: 'absolute', left: 0, right: 0, top: y + h + 1, height: 120, background: 'linear-gradient(rgba(118,185,0,0.06), transparent)' }} />
    </>
  );
}

// Zoom wrapper for the title / closing beats.
function Zoom({ lt, dur, amount, children }: { lt: number; dur: number; amount: number; children: React.ReactNode }) {
  const z = 1 + amount * ease.easeInOutSine(clamp(lt / dur, 0, 1));
  return <div style={{ position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: 'center' }}>{children}</div>;
}

/* ════════════════════════════ SCENE 1 — TITLE ═══════════════════════════ */
function S1_Title({ lt, dur }: { lt: number; dur: number }) {
  const k = appear(lt, 0.5, 0.6);
  const t1 = appear(lt, 0.9, 0.7);
  const t2 = appear(lt, 1.25, 0.7);
  const sub = appear(lt, 1.9, 0.8);
  return (
    <Zoom lt={lt} dur={dur} amount={0.05}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.5, transform: `translateY(${lerp(20, 0, ease.easeOutCubic(clamp(lt / 2, 0, 1)))}px)` }}>
        <RackRow y={356} count={7} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 80% at 28% 52%, rgba(7,10,8,0.55), rgba(7,10,8,0.9) 70%)' }} />
      <div style={{ position: 'absolute', left: 132, top: 372 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: k }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: C.green, boxShadow: `0 0 24px ${C.green}` }} />
          <div style={{ font: `500 16px/1 ${MONO}`, letterSpacing: '0.32em', color: C.dim, textTransform: 'uppercase' }}>NVIDIA · Infrastructure</div>
        </div>
        <div style={{ marginTop: 26, font: `700 104px/0.98 ${DISP}`, letterSpacing: '-0.035em', color: C.ink, opacity: t1, transform: `translateY(${(1 - t1) * 22}px)` }}>
          Infra Controller
        </div>
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 22, opacity: t2, transform: `translateY(${(1 - t2) * 18}px)` }}>
          <span style={{ font: `700 104px/0.98 ${DISP}`, letterSpacing: '-0.035em', color: C.green, textShadow: `0 0 40px rgba(118,185,0,0.4)` }}>NICo</span>
          <span style={{ font: `400 26px/1 ${MONO}`, color: C.faint }}>// nvidia.github.io/infra-controller</span>
        </div>
        <div style={{ marginTop: 34, font: `400 25px/1.5 ${UI}`, color: C.dim, maxWidth: 720, opacity: sub, transform: `translateY(${(1 - sub) * 14}px)` }}>
          Zero-touch lifecycle automation for bare metal — securing datacenter infrastructure at its foundation.
        </div>
      </div>
    </Zoom>
  );
}

/* ════════════════════════════ SCENE 2 — PROBLEM ═════════════════════════ */
function S2_Problem({ lt }: { lt: number }) {
  const steps = [
    { t: 'Discover', d: 'find & identify every box' },
    { t: 'Image', d: 'push the right OS' },
    { t: 'Network', d: 'wire VLANs & fabric' },
    { t: 'Secure', d: 'enforce tenant isolation' },
  ];
  const head = appear(lt, 0.4, 0.7);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 132, top: 168, maxWidth: 1100, opacity: head, transform: `translateY(${(1 - head) * 16}px)` }}>
        <div style={{ font: `500 15px/1 ${MONO}`, letterSpacing: '0.26em', color: C.amber, textTransform: 'uppercase' }}>The bare-metal problem</div>
        <div style={{ marginTop: 18, font: `600 60px/1.06 ${DISP}`, letterSpacing: '-0.02em', color: C.ink }}>
          Standing up bare metal is <span style={{ color: C.amber }}>slow, manual, error-prone.</span>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 132, top: 470, right: 132, display: 'flex', gap: 28 }}>
        {steps.map((s, i) => {
          const a = appear(lt, 1.0 + i * 0.45, 0.55);
          const flicker = 0.55 + 0.45 * Math.abs(Math.sin(lt * 3 + i));
          return (
            <div key={i} style={{ flex: 1, padding: '30px 28px', background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, opacity: a, transform: `translateY(${(1 - a) * 22}px)` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ font: `500 14px/1 ${MONO}`, color: C.faint }}>{String(i + 1).padStart(2, '0')}</div>
                <div style={{ font: `400 12px/1 ${MONO}`, letterSpacing: '0.18em', color: C.amber, opacity: flicker }}>MANUAL</div>
              </div>
              <div style={{ marginTop: 22, font: `600 30px/1.1 ${DISP}`, color: C.ink }}>{s.t}</div>
              <div style={{ marginTop: 12, font: `400 17px/1.45 ${UI}`, color: C.dim }}>{s.d}</div>
              <div style={{ marginTop: 22, height: 4, borderRadius: 2, background: 'rgba(242,169,59,0.18)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${30 + 20 * Math.abs(Math.sin(lt * 1.3 + i))}%`, background: C.amber, opacity: 0.7 }} />
              </div>
            </div>
          );
        })}
      </div>
      <Caption lt={lt} kicker="What NICo replaces" title="One API instead of a hundred runbooks." at={3.0} />
    </div>
  );
}

/* ════════════════════ SCENE 3 — ZERO-TOUCH PROVISIONING ═════════════════ */
function S3_Provision({ lt }: { lt: number }) {
  const stages = ['Power on', 'PXE / DHCP discover', 'Inventory', 'Stream OS image', 'Configure', 'Ready'];
  const gate = [1.2, 3.0, 5.2, 7.6, 10.4, 13.0];
  const done = gate.map((g) => lt >= g);
  const active = done.lastIndexOf(true);
  const allReady = lt >= gate[gate.length - 1] + 0.4;
  const prog = clamp((lt - 1.2) / (gate[5] - 1.2), 0, 1);

  let ledColor = 'rgba(255,255,255,0.2)', status = 'UNPROVISIONED', statusColor = C.faint;
  if (allReady) { ledColor = C.green; status = 'READY'; statusColor = C.green; }
  else if (active >= 1) { ledColor = C.amber; status = 'PROVISIONING'; statusColor = C.amber; }

  const head = appear(lt, 0.3, 0.6);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 132, top: 150, opacity: head, transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ font: `500 15px/1 ${MONO}`, letterSpacing: '0.26em', color: C.green, textTransform: 'uppercase' }}>Capability 01 — Zero-touch provisioning</div>
        <div style={{ marginTop: 16, font: `600 56px/1.05 ${DISP}`, letterSpacing: '-0.02em', color: C.ink }}>Power on. NICo does the rest.</div>
      </div>

      <div style={{ position: 'absolute', left: 132, top: 340, width: 520, height: 320, background: C.panel, border: `1px solid ${allReady ? 'rgba(118,185,0,0.5)' : C.line}`, borderRadius: 18, padding: 28, boxSizing: 'border-box', boxShadow: allReady ? `0 0 60px rgba(118,185,0,0.18)` : '0 24px 50px rgba(0,0,0,0.45)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ font: `400 13px/1 ${MONO}`, color: C.faint }}>node / dgx-h100</div>
            <div style={{ marginTop: 8, font: `600 30px/1 ${DISP}`, color: C.ink }}>node-04</div>
          </div>
          <div style={{ width: 16, height: 16, borderRadius: 8, background: ledColor, boxShadow: ledColor !== 'rgba(255,255,255,0.2)' ? `0 0 18px ${ledColor}` : 'none' }} />
        </div>
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ height: 38, borderRadius: 6, background: '#0a0f0b', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '60%', height: 3, borderRadius: 2, background: allReady ? C.green : 'rgba(255,255,255,0.1)', opacity: allReady ? (0.4 + 0.6 * Math.abs(Math.sin(lt * 2 + i))) : 1 }} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 26, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ font: `500 16px/1 ${MONO}`, letterSpacing: '0.12em', color: statusColor }}>{status}</div>
          <div style={{ font: `400 14px/1 ${MONO}`, color: C.faint }}>{Math.round(prog * 100)}%</div>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 712, top: 352, right: 132 }}>
        <div style={{ font: `500 13px/1 ${MONO}`, letterSpacing: '0.22em', color: C.faint, textTransform: 'uppercase', marginBottom: 26 }}>Lifecycle state machine</div>
        {stages.map((s, i) => {
          const on = done[i];
          const isActive = i === active && !allReady;
          const pulse = isActive ? 0.5 + 0.5 * Math.abs(Math.sin(lt * 4)) : 1;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18 }}>
              <div style={{ width: 30, height: 30, borderRadius: 15, flexShrink: 0, background: on ? C.green : 'transparent', border: `2px solid ${on ? C.green : 'rgba(255,255,255,0.18)'}`, boxShadow: on ? `0 0 16px rgba(118,185,0,0.5)` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isActive ? pulse : 1 }}>
                {on && <div style={{ width: 9, height: 9, borderRadius: 5, background: C.bg }} />}
              </div>
              <div style={{ font: `${on ? 600 : 400} 25px/1.2 ${UI}`, color: on ? C.ink : C.faint }}>{s}</div>
              {isActive && <div style={{ font: `400 13px/1 ${MONO}`, color: C.amber, marginLeft: 6 }}>running…</div>}
            </div>
          );
        })}
        <div style={{ marginTop: 10, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', maxWidth: 560 }}>
          <div style={{ height: '100%', width: `${prog * 100}%`, background: `linear-gradient(90deg, ${C.green}, ${C.greenHi})`, boxShadow: `0 0 16px ${C.green}` }} />
        </div>
      </div>

      <Caption lt={lt} kicker="Capability 01" title={allReady ? 'Bare metal, provisioned hands-free.' : 'Discovery → image → configure → ready.'} sub="PXE-boot discovery, inventory capture, OS imaging and configuration — driven entirely by NICo, no operator in the loop." at={1.0} />
    </div>
  );
}

/* ════════════════════ SCENE 4 — DPU-ENFORCED ISOLATION ══════════════════ */
function Packet({ x, y, color, blocked }: { x: number; y: number; color: string; blocked?: boolean }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 16, height: 16, borderRadius: 4, background: color, boxShadow: `0 0 10px ${color}`, transform: 'translate(-50%,-50%)', opacity: blocked ? 0.9 : 1 }} />
  );
}

function S4_Dpu({ lt }: { lt: number }) {
  const t = useTime();
  const head = appear(lt, 0.3, 0.6);
  const netX = 300, dpuX = 960, hostX = 1620;
  const laneY = 470;
  const panelReveal = appear(lt, 0.8, 0.7);
  const dpuReveal = appear(lt, 1.4, 0.7);

  const packets: React.ReactNode[] = [];
  const N = 7;
  for (let i = 0; i < N; i++) {
    const phase = ((t * 1.0) + i / N) % 1;
    const blocked = i % 4 === 0;
    const yo = laneY + (i - (N - 1) / 2) * 26;
    let x: number, color = C.green;
    const show = lt > 1.6;
    if (phase < 0.5) {
      x = lerp(netX + 60, dpuX - 70, phase / 0.5);
      color = '#cfe39a';
    } else {
      if (blocked) {
        x = dpuX - 70 + 18 * Math.sin((phase - 0.5) * Math.PI * 6) * (1 - (phase - 0.5) / 0.5);
        color = C.red;
      } else {
        x = lerp(dpuX + 70, hostX - 70, (phase - 0.5) / 0.5);
        color = C.green;
      }
    }
    if (show) packets.push(<Packet key={i} x={x} y={yo} color={color} blocked={blocked} />);
  }

  const Col = ({ x, w, title, sub, accent, reveal, children }: { x: number; w: number; title: string; sub: string; accent?: string; reveal: number; children?: React.ReactNode }) => (
    <div style={{ position: 'absolute', left: x - w / 2, top: 300, width: w, height: 380, background: C.panel, border: `1px solid ${accent || C.line}`, borderRadius: 16, padding: 24, boxSizing: 'border-box', opacity: reveal, transform: `translateY(${(1 - reveal) * 24}px)`, boxShadow: accent ? `0 0 50px rgba(118,185,0,0.15)` : '0 24px 50px rgba(0,0,0,0.4)' }}>
      <div style={{ font: `500 13px/1 ${MONO}`, letterSpacing: '0.2em', color: accent ? C.green : C.faint, textTransform: 'uppercase' }}>{title}</div>
      <div style={{ marginTop: 10, font: `400 16px/1.4 ${UI}`, color: C.dim }}>{sub}</div>
      {children}
    </div>
  );

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 132, top: 150, opacity: head, transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ font: `500 15px/1 ${MONO}`, letterSpacing: '0.26em', color: C.green, textTransform: 'uppercase' }}>Capability 02 — DPU-enforced isolation</div>
        <div style={{ marginTop: 16, font: `600 56px/1.05 ${DISP}`, letterSpacing: '-0.02em', color: C.ink }}>Zero-trust, enforced in hardware.</div>
      </div>

      <div style={{ position: 'absolute', left: netX, right: 1920 - hostX, top: laneY - 2, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }} />

      <Col x={netX} w={300} title="Network fabric" sub="Untrusted traffic in" reveal={panelReveal}>
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ height: 12, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }} />)}
        </div>
      </Col>

      <Col x={dpuX} w={320} title="BlueField DPU" sub="Policy & isolation boundary" accent="rgba(118,185,0,0.55)" reveal={dpuReveal}>
        <div style={{ marginTop: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 96, height: 96, borderRadius: 20, border: `2px solid ${C.green}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 28px rgba(118,185,0,0.4)`, background: 'rgba(118,185,0,0.06)' }}>
            <div style={{ width: 40, height: 48, borderRadius: '8px 8px 20px 20px', border: `3px solid ${C.green}`, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, margin: 'auto', width: 10, height: 10, borderRadius: 5, top: 8, left: 0, right: 0, background: C.green, boxShadow: `0 0 10px ${C.green}` }} />
            </div>
          </div>
        </div>
        <div style={{ marginTop: 20, font: `400 13px/1.4 ${MONO}`, color: C.green, textAlign: 'center' }}>inspect · authorize · isolate</div>
      </Col>

      <Col x={hostX} w={300} title="Host CPU / GPU" sub="Trusted tenant workload" reveal={panelReveal}>
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ height: 46, borderRadius: 6, background: '#0a0f0b', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: '55%', height: 3, background: C.green, opacity: 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)) }} /></div>)}
        </div>
      </Col>

      {packets}

      <Caption lt={lt} kicker="Capability 02" title="The security boundary lives below the host OS." sub="The BlueField DPU inspects and authorizes every flow before it ever reaches host CPU or GPU — isolation a compromised host can't bypass." at={2.0} />
    </div>
  );
}

/* ════════════════════ SCENE 5 — MULTITENANT NETWORKING ══════════════════ */
function S5_Tenant({ lt }: { lt: number }) {
  const t = useTime();
  const head = appear(lt, 0.3, 0.6);
  const tenants = [
    { name: 'Tenant A', tag: 'vlan 100 · ib pkey 0x8001', color: '#76B900', y: 318 },
    { name: 'Tenant B', tag: 'vlan 220 · ib pkey 0x8002', color: '#34d1c4', y: 470 },
    { name: 'Tenant C', tag: 'vlan 305 · ib pkey 0x8003', color: '#c98bff', y: 622 },
  ];
  const fabricX = 940, fabricW = 150;
  const leftX = 200, rightX = 1620;
  const fabricReveal = appear(lt, 1.4, 0.7);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 132, top: 150, opacity: head, transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ font: `500 15px/1 ${MONO}`, letterSpacing: '0.26em', color: C.green, textTransform: 'uppercase' }}>Capability 03 — Multitenant networking</div>
        <div style={{ marginTop: 16, font: `600 56px/1.05 ${DISP}`, letterSpacing: '-0.02em', color: C.ink }}>One fabric. Tenants never touch.</div>
      </div>

      <div style={{ position: 'absolute', left: fabricX - fabricW / 2, top: 300, width: fabricW, height: 360, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, opacity: fabricReveal, boxShadow: '0 24px 50px rgba(0,0,0,0.4)' }}>
        <div style={{ writingMode: 'vertical-rl', font: `500 13px/1 ${MONO}`, letterSpacing: '0.24em', color: C.faint, textTransform: 'uppercase' }}>shared fabric</div>
      </div>

      {tenants.map((tn, i) => {
        const reveal = appear(lt, 0.9 + i * 0.35, 0.6);
        const pk: React.ReactNode[] = [];
        const M = 4;
        for (let j = 0; j < M; j++) {
          const phase = ((t * 0.85) + i * 0.2 + j / M) % 1;
          const x = lerp(leftX + 150, rightX - 30, phase);
          if (lt > 1.4) pk.push(<div key={j} style={{ position: 'absolute', left: x, top: tn.y + 30, width: 14, height: 14, borderRadius: 4, background: tn.color, boxShadow: `0 0 10px ${tn.color}`, transform: 'translate(-50%,-50%)' }} />);
        }
        return (
          <React.Fragment key={i}>
            <div style={{ position: 'absolute', left: leftX + 150, width: rightX - 30 - (leftX + 150), top: tn.y + 28, height: 3, background: `linear-gradient(90deg, ${tn.color}55, ${tn.color}22)`, borderRadius: 2, opacity: reveal }} />
            <div style={{ position: 'absolute', left: leftX, top: tn.y, width: 290, height: 60, background: C.panel, border: `1px solid ${tn.color}55`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', boxSizing: 'border-box', opacity: reveal, transform: `translateX(${(1 - reveal) * -20}px)` }}>
              <div style={{ width: 12, height: 12, borderRadius: 6, background: tn.color, boxShadow: `0 0 12px ${tn.color}` }} />
              <div>
                <div style={{ font: `600 19px/1 ${DISP}`, color: C.ink }}>{tn.name}</div>
                <div style={{ marginTop: 5, font: `400 12px/1 ${MONO}`, color: C.faint }}>{tn.tag}</div>
              </div>
            </div>
            <div style={{ position: 'absolute', left: rightX - 70, top: tn.y, width: 170, height: 60, background: C.panel, border: `1px solid ${tn.color}55`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', opacity: reveal, transform: `translateX(${(1 - reveal) * 20}px)` }}>
              <div style={{ font: `400 13px/1 ${MONO}`, color: tn.color }}>workload</div>
            </div>
            {pk}
          </React.Fragment>
        );
      })}

      {(() => {
        const show = env(lt, 6.0, 9.0, 0.5);
        if (show <= 0) return null;
        const yMid = (318 + 470) / 2 + 30;
        return (
          <div style={{ position: 'absolute', left: fabricX, top: yMid, transform: 'translate(-50%,-50%)', opacity: show, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 34, height: 34, borderRadius: 17, border: `2px solid ${C.red}`, color: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `600 20px/1 ${UI}`, background: 'rgba(226,83,61,0.1)' }}>✕</div>
            <div style={{ font: `500 12px/1 ${MONO}`, color: C.red, letterSpacing: '0.1em' }}>cross-tenant denied</div>
          </div>
        );
      })()}

      <Caption lt={lt} kicker="Capability 03" title="VLAN & InfiniBand segmentation on shared hardware." sub="Every tenant gets its own isolated network slice across the same physical fabric — traffic can never leak between them." at={2.4} />
    </div>
  );
}

/* ════════════════════ SCENE 6 — CONTROL PLANE / STACK ═══════════════════ */
function S6_Stack({ lt }: { lt: number }) {
  const head = appear(lt, 0.3, 0.6);
  const layers = [
    { name: 'NICo REST', sub: 'REST API · Temporal · Keycloak · site-agent', items: ['REST API', 'Temporal', 'Keycloak'], at: 4.6 },
    { name: 'NICo Core', sub: 'the controller — reconciliation & lifecycle logic', items: ['Reconcilers', 'Lifecycle FSM', 'gRPC'], at: 3.0 },
    { name: 'Common services', sub: 'MetalLB · cert-manager · Vault · PostgreSQL', items: ['MetalLB', 'cert-manager', 'Vault', 'PostgreSQL'], at: 1.4 },
  ];
  const apiT = appear(lt, 6.6, 0.5);
  const baseTop = 360, lh = 116, gap = 18;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 132, top: 150, opacity: head, transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ font: `500 15px/1 ${MONO}`, letterSpacing: '0.26em', color: C.green, textTransform: 'uppercase' }}>Capability 04 — API-driven control plane</div>
        <div style={{ marginTop: 16, font: `600 56px/1.05 ${DISP}`, letterSpacing: '-0.02em', color: C.ink }}>One declarative API. Three layers.</div>
      </div>

      <div style={{ position: 'absolute', left: 132, top: 372, width: 360, opacity: apiT, transform: `translateX(${(1 - apiT) * -20}px)` }}>
        <div style={{ padding: '20px 22px', background: '#0a0f0b', border: `1px solid rgba(118,185,0,0.4)`, borderRadius: 14, boxShadow: `0 0 30px rgba(118,185,0,0.12)` }}>
          <div style={{ font: `500 12px/1 ${MONO}`, color: C.faint, letterSpacing: '0.16em' }}>CLIENT REQUEST</div>
          <div style={{ marginTop: 12, font: `500 18px/1.5 ${MONO}`, color: C.green }}>POST /v1/nodes</div>
          <div style={{ font: `400 14px/1.5 ${MONO}`, color: C.dim }}>{'{ "state": "provisioned" }'}</div>
        </div>
        <div style={{ marginTop: 18, font: `400 16px/1.5 ${UI}`, color: C.dim }}>Declare the desired state. NICo reconciles every layer to reach it.</div>
      </div>

      <div style={{ position: 'absolute', left: 620, top: baseTop, width: 1180 }}>
        {layers.map((L, i) => {
          const a = appear(lt, L.at, 0.6);
          const isCore = L.name === 'NICo Core';
          const flow = apiT * (0.4 + 0.6 * Math.abs(Math.sin(lt * 3 - i)));
          return (
            <div key={i} style={{ height: lh, marginBottom: gap, background: isCore ? 'rgba(118,185,0,0.07)' : C.panel, border: `1px solid ${isCore ? 'rgba(118,185,0,0.5)' : C.line}`, borderRadius: 16, padding: '0 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: a, transform: `translateY(${(1 - a) * 26}px) scale(${lerp(0.96, 1, a)})`, boxShadow: isCore ? `0 0 40px rgba(118,185,0,0.14)` : 'none' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 9, height: 9, borderRadius: 5, background: isCore ? C.green : C.dim, boxShadow: isCore ? `0 0 10px ${C.green}` : 'none' }} />
                  <div style={{ font: `600 30px/1 ${DISP}`, color: isCore ? C.green : C.ink }}>{L.name}</div>
                </div>
                <div style={{ marginTop: 10, font: `400 16px/1 ${UI}`, color: C.dim }}>{L.sub}</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {L.items.map((it, k) => (
                  <div key={k} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.line}`, font: `400 13px/1 ${MONO}`, color: C.dim, opacity: 0.5 + 0.5 * flow }}>{it}</div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Caption lt={lt} kicker="Capability 04" title="Site-local, zero-trust, fully API-driven." sub="A microservice control plane built in Rust & Go — declare intent, and NICo orchestrates common services, core reconcilers and the REST layer to match." at={2.0} />
    </div>
  );
}

/* ════════════════════════════ SCENE 7 — CLOSING ════════════════════════ */
function S7_Closing({ lt, dur }: { lt: number; dur: number }) {
  const logo = appear(lt, 0.7, 0.7);
  const line = appear(lt, 1.4, 0.8);
  const tags = appear(lt, 2.2, 0.8);
  return (
    <Zoom lt={lt} dur={dur} amount={0.04}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.58 }}>
        <RackRow y={356} count={7} allGreen />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 72% 82% at 50% 50%, rgba(7,10,8,0.32), rgba(7,10,8,0.88) 74%)' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: logo, transform: `translateY(${(1 - logo) * 16}px)` }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: C.green, boxShadow: `0 0 30px ${C.green}` }} />
          <div style={{ font: `700 64px/1 ${DISP}`, letterSpacing: '-0.03em', color: C.ink }}>NVIDIA Infra Controller</div>
        </div>
        <div style={{ marginTop: 30, font: `500 34px/1.3 ${DISP}`, color: C.green, opacity: line, transform: `translateY(${(1 - line) * 14}px)`, textShadow: '0 0 36px rgba(118,185,0,0.3)' }}>
          Zero-touch. Zero-trust. Bare metal, automated.
        </div>
        <div style={{ marginTop: 40, display: 'flex', gap: 18, opacity: tags, transform: `translateY(${(1 - tags) * 12}px)` }}>
          {['Provisioning', 'DPU isolation', 'Multitenancy', 'API control plane'].map((tg, i) => (
            <div key={i} style={{ padding: '11px 20px', borderRadius: 999, border: `1px solid rgba(118,185,0,0.4)`, font: `400 16px/1 ${MONO}`, color: C.dim }}>{tg}</div>
          ))}
        </div>
        <div style={{ marginTop: 44, font: `400 18px/1 ${MONO}`, color: C.faint, opacity: tags }}>github.com/NVIDIA/infra-controller</div>
      </div>
    </Zoom>
  );
}

/* ── Persistent HUD + clock ──────────────────────────────────────────────── */
function Hud() {
  return (
    <div style={{ position: 'absolute', top: 64, left: 132, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 16, height: 16, borderRadius: 4, background: C.green, boxShadow: `0 0 12px ${C.green}` }} />
      <div style={{ font: `500 14px/1 ${MONO}`, letterSpacing: '0.22em', color: C.dim }}>NICo</div>
    </div>
  );
}
function HudClock() {
  const t = useTime();
  return (
    <div style={{ position: 'absolute', top: 64, right: 132, fontFamily: MONO, fontSize: 14, letterSpacing: '0.16em', color: C.faint }}>
      {fmtClock(t)} / 1:46
    </div>
  );
}

/* ── ROOT FILM ──────────────────────────────────────────────────────────── */
export function Film() {
  return (
    <Stage width={1920} height={1080} duration={106} background={C.bg}>
      <Backdrop />
      <Hud />
      <HudClock />

      <SceneFrame start={0} end={10}>{(lt, d) => <S1_Title lt={lt} dur={d} />}</SceneFrame>
      <SceneFrame start={10} end={20}>{(lt) => <S2_Problem lt={lt} />}</SceneFrame>
      <SceneFrame start={20} end={43}>{(lt) => <S3_Provision lt={lt} />}</SceneFrame>
      <SceneFrame start={43} end={62}>{(lt) => <S4_Dpu lt={lt} />}</SceneFrame>
      <SceneFrame start={62} end={83}>{(lt) => <S5_Tenant lt={lt} />}</SceneFrame>
      <SceneFrame start={83} end={99}>{(lt) => <S6_Stack lt={lt} />}</SceneFrame>
      <SceneFrame start={99} end={106} fout={0.2}>{(lt, d) => <S7_Closing lt={lt} dur={d} />}</SceneFrame>
    </Stage>
  );
}
