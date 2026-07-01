// "VLANs, from the wire up" — the ~5-minute diagrammatic explainer film.
// Ported faithfully from the Claude Design prototype (vlan-scene.jsx) onto the
// project's shared timeline engine (Stage / Sprite / useSprite / useTime).
//
// VLAN colour code: 10 green (Engineering), 20 amber (Finance), 30 cyan (Guest).
import React from 'react';
import { C as T, MONO, DISP } from '../design/theme';
import { Easing, clamp } from '../engine/anim';
import { Stage, Sprite, useSprite, useTime } from '../engine/timeline';

const DISPLAY = DISP;
const C = {
  bg: T.bg,
  panel: T.panel,
  panel2: T.panel2,
  line: T.line,
  steel: T.steel,
  steelDim: T.steelDim,
  text: T.ink,
  muted: T.dim,
  faint: T.faint,
  green: T.green,
  amber: T.amber,
  cyan: T.cyan,
  violet: T.violet,
  red: T.red,
};

type Pt = { x: number; y: number };
type VMeta = { c: string; name: string };
const V: Record<number, VMeta> = {
  10: { c: C.green, name: 'ENGINEERING' },
  20: { c: C.amber, name: 'FINANCE' },
  30: { c: C.cyan, name: 'GUEST' },
};

const Tm = {
  intro: [0, 8],
  flat: [8, 42],
  segment: [42, 78],
  access: [78, 108],
  tag: [108, 158],
  trunk: [158, 196],
  native: [196, 220],
  route: [220, 256],
  hop: [256, 292],
  recap: [292, 300],
};
const DURATION = 300;

const CHAPTERS: Array<[number, string]> = [
  [0, 'INTRO'],
  [8, '01 · THE FLAT NETWORK'],
  [42, '02 · SEGMENTING'],
  [78, '03 · ACCESS PORTS'],
  [108, '04 · 802.1Q TAGGING'],
  [158, '05 · TRUNK LINKS'],
  [196, '06 · NATIVE VLAN'],
  [220, '07 · INTER-VLAN ROUTING'],
  [256, '08 · VLAN HOPPING'],
  [292, '09 · RECAP'],
];

// ── helpers ─────────────────────────────────────────────────────
function enter(localTime: number, t0 = 0, dur = 0.5, y = 14): React.CSSProperties {
  const p = clamp((localTime - t0) / dur, 0, 1);
  const e = Easing.easeOutCubic(p);
  return { opacity: e, transform: `translateY(${(1 - e) * y}px)` };
}
function enterO(localTime: number, t0 = 0, dur = 0.5): number {
  return Easing.easeOutCubic(clamp((localTime - t0) / dur, 0, 1));
}
function fadeOut(localTime: number, at: number, dur = 0.4): number {
  const p = clamp((localTime - at) / dur, 0, 1);
  return 1 - Easing.easeInCubic(p);
}
function ptOnPath(path: Pt[], p: number): Pt {
  if (path.length === 1) return path[0];
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const L = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
    segs.push(L);
    total += L;
  }
  let d = clamp(p, 0, 1) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const f = segs[i] ? d / segs[i] : 0;
      return { x: path[i].x + (path[i + 1].x - path[i].x) * f, y: path[i].y + (path[i + 1].y - path[i].y) * f };
    }
    d -= segs[i];
  }
  return path[path.length - 1];
}

// ── background / chrome ─────────────────────────────────────────
function Background() {
  const t = useTime();
  const drift = (t * 6) % 48;
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.bg, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: -48,
          backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          backgroundPosition: `${drift}px ${drift}px`,
          opacity: 0.5,
        }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 42%, transparent 40%, rgba(0,0,0,0.55) 100%)' }} />
    </div>
  );
}

function ChapterTag() {
  const t = useTime();
  let label = CHAPTERS[0][1];
  for (const [s, l] of CHAPTERS) if (t >= s) label = l;
  return (
    <div style={{ position: 'absolute', top: 54, right: 90, textAlign: 'right' }}>
      <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: '0.22em', color: C.faint, textTransform: 'uppercase' }}>VLAN · DEEP DIVE</div>
      <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: '0.14em', color: C.green, marginTop: 8 }}>{label}</div>
    </div>
  );
}
function ProgressRail() {
  const t = useTime();
  return (
    <div style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: 3, background: 'rgba(255,255,255,0.05)' }}>
      <div style={{ height: '100%', width: `${(t / DURATION) * 100}%`, background: C.green, boxShadow: `0 0 12px ${C.green}` }} />
    </div>
  );
}

function Header({ kicker, title, lt, t0 = 0 }: { kicker: string; title: string; lt: number; t0?: number }) {
  return (
    <div style={{ position: 'absolute', left: 90, top: 60, ...enter(lt, t0, 0.6, 18) }}>
      <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: '0.3em', color: C.green, textTransform: 'uppercase' }}>{kicker}</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 52, fontWeight: 700, color: C.text, marginTop: 12, letterSpacing: '-0.02em' }}>{title}</div>
    </div>
  );
}

function Takeaway({ text, color = C.green, lt, t0 = 0 }: { text: string; color?: string; lt: number; t0?: number }) {
  return (
    <div style={{ position: 'absolute', left: 90, bottom: 70, display: 'flex', alignItems: 'center', gap: 18, maxWidth: 1500, ...enter(lt, t0, 0.6, 14) }}>
      <div style={{ width: 14, height: 14, borderRadius: 4, background: color, boxShadow: `0 0 14px ${color}`, flexShrink: 0 }} />
      <div style={{ fontFamily: DISPLAY, fontSize: 30, fontWeight: 500, color: C.text, lineHeight: 1.25 }}>{text}</div>
    </div>
  );
}

function Host({ x, y, w = 168, h = 104, color = C.steel, name, ip, dim = false, glow = 0, style = {} }: { x: number; y: number; w?: number; h?: number; color?: string; name: string; ip: string; dim?: boolean; glow?: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        background: C.panel,
        border: `1.5px solid ${dim ? C.steelDim : color}`,
        borderRadius: 12,
        boxShadow: glow ? `0 0 ${18 + glow * 26}px ${color}` : '0 8px 22px rgba(0,0,0,0.45)',
        opacity: dim ? 0.32 : 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 18px',
        fontFamily: MONO,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 11, height: 11, borderRadius: 3, background: dim ? C.steelDim : color, boxShadow: dim ? 'none' : `0 0 8px ${color}` }} />
        <div style={{ color: C.text, fontSize: 20, fontWeight: 600 }}>{name}</div>
      </div>
      <div style={{ color: C.muted, fontSize: 14, marginTop: 8 }}>{ip}</div>
    </div>
  );
}

function SwitchBox({ x, y, w, h = 118, label = 'SW-CORE', sub, style = {} }: { x: number; y: number; w: number; h?: number; label?: string; sub?: string; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        background: 'linear-gradient(180deg, #1b2127, #12161a)',
        border: `1.5px solid #2c343c`,
        borderRadius: 14,
        boxShadow: '0 14px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 26,
        ...style,
      }}
    >
      <div>
        <div style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '0.02em' }}>{label}</div>
        {sub && <div style={{ fontFamily: MONO, fontSize: 13, color: C.muted, marginTop: 4 }}>{sub}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', marginRight: 24 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ width: 6, height: 22, borderRadius: 2, background: i === 0 ? C.green : 'rgba(255,255,255,0.12)' }} />
        ))}
      </div>
    </div>
  );
}

function Port({ x, y, color = C.steel, label, active = false, s = 30 }: { x: number; y: number; color?: string; label?: string; active?: boolean; s?: number }) {
  return (
    <div style={{ position: 'absolute', left: x - s / 2, top: y - s / 2, width: s, height: s, borderRadius: 7, background: '#0c1013', border: `2px solid ${color}`, boxShadow: active ? `0 0 14px ${color}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 8, height: 8, borderRadius: 2, background: color, opacity: active ? 1 : 0.55 }} />
      {label && <div style={{ position: 'absolute', top: s + 4, left: '50%', transform: 'translateX(-50%)', fontFamily: MONO, fontSize: 11, color: C.faint, whiteSpace: 'nowrap' }}>{label}</div>}
    </div>
  );
}

type Link = { a: Pt; b: Pt; color?: string; w?: number; dash?: string; op?: number };
function Cables({ links }: { links: Link[] }) {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: 1920, height: 1080, overflow: 'visible', pointerEvents: 'none' }}>
      {links.map((l, i) => (
        <line key={i} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke={l.color || C.steelDim} strokeWidth={l.w || 2.5} strokeDasharray={l.dash || 'none'} strokeLinecap="round" opacity={l.op == null ? 0.8 : l.op} />
      ))}
    </svg>
  );
}

function Signal({ path, lt, t0, dur, color, size = 15, label }: { path: Pt[]; lt: number; t0: number; dur: number; color: string; size?: number; label?: string | null }) {
  const p = (lt - t0) / dur;
  if (p <= 0 || p >= 1) return null;
  const { x, y } = ptOnPath(path, p);
  const fade = p < 0.12 ? p / 0.12 : p > 0.85 ? (1 - p) / 0.15 : 1;
  return (
    <div style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: '50%', background: color, opacity: fade, boxShadow: `0 0 18px 5px ${color}` }}>
      {label && <div style={{ position: 'absolute', left: size + 6, top: -4, fontFamily: MONO, fontSize: 12, color, whiteSpace: 'nowrap' }}>{label}</div>}
    </div>
  );
}

function Ring({ x, y, lt, t0, color, max = 70 }: { x: number; y: number; lt: number; t0: number; color: string; max?: number }) {
  const p = (lt - t0) / 0.7;
  if (p <= 0 || p >= 1) return null;
  const r = p * max;
  return <div style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', border: `2.5px solid ${color}`, opacity: (1 - p) * 0.8 }} />;
}

function Callout({ text, children, color = C.text, top = 150, opacity = 1 }: { text?: string; children?: React.ReactNode; color?: string; top?: number; opacity?: number }) {
  return (
    <div style={{ position: 'absolute', left: '50%', top, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', padding: '12px 26px', opacity, background: 'rgba(10,12,14,0.92)', border: `1px solid ${color}55`, borderRadius: 999, boxShadow: '0 10px 34px rgba(0,0,0,0.55)', whiteSpace: 'nowrap', zIndex: 20 }}>
      <span style={{ fontFamily: DISPLAY, fontSize: 25, fontWeight: 600, color, textAlign: 'center' }}>{text || children}</span>
    </div>
  );
}

function Badge({ vlan, x, y, lt, t0 = 0, big = false }: { vlan: number; x: number; y: number; lt: number; t0?: number; big?: boolean }) {
  const v = V[vlan];
  return (
    <div style={{ position: 'absolute', left: x, top: y, display: 'inline-flex', alignItems: 'center', gap: 8, padding: big ? '8px 16px' : '5px 11px', borderRadius: 8, background: `${v.c}1a`, border: `1.5px solid ${v.c}`, whiteSpace: 'nowrap', ...enter(lt, t0, 0.5, 8) }}>
      <div style={{ width: big ? 12 : 9, height: big ? 12 : 9, borderRadius: 2, background: v.c }} />
      <span style={{ fontFamily: MONO, fontSize: big ? 18 : 14, fontWeight: 600, color: v.c, letterSpacing: '0.04em' }}>VLAN {vlan}</span>
      {big && <span style={{ fontFamily: MONO, fontSize: 13, color: C.muted, letterSpacing: '0.08em' }}>{v.name}</span>}
    </div>
  );
}

// shared topology geometry
const DEV_W = 168,
  DEV_H = 104,
  DEV_Y = 230;
const DEV_CX = [285, 570, 855, 1140, 1425, 1710];
const SW = { x: 210, y: 640, w: 1500, h: 118 };
const PORT_Y = SW.y;
const DEV_BOTTOM = DEV_Y + DEV_H;
const devVlan = [10, 10, 20, 20, 30, 30];
const devMeta = [
  { name: 'PC-A', ip: '10.0.1.11' },
  { name: 'PC-B', ip: '10.0.1.12' },
  { name: 'PC-C', ip: '10.0.2.21' },
  { name: 'PC-D', ip: '10.0.2.22' },
  { name: 'GUEST-1', ip: '10.0.3.31' },
  { name: 'GUEST-2', ip: '10.0.3.32' },
];
const portName = ['Gi0/1', 'Gi0/2', 'Gi0/3', 'Gi0/4', 'Gi0/5', 'Gi0/6'];

// ── SCENE 0 — INTRO ─────────────────────────────────────────────
function SceneIntro() {
  const { localTime: lt, duration } = useSprite();
  const out = fadeOut(lt, duration - 0.6);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: out }}>
      <Cables links={DEV_CX.map((c, i) => ({ a: { x: c, y: DEV_BOTTOM }, b: { x: c, y: PORT_Y }, op: clamp(lt - 1.2 - i * 0.08, 0, 1) * 0.5 }))} />
      {DEV_CX.map((c, i) => (
        <div key={i} style={enter(lt, 1.2 + i * 0.09, 0.6, 20)}>
          <Host x={c - DEV_W / 2} y={DEV_Y} color={C.steel} name={devMeta[i].name} ip={devMeta[i].ip} />
          <Port x={c} y={PORT_Y} color={C.steel} />
        </div>
      ))}
      <div style={enter(lt, 0.9, 0.7, 20)}>
        <SwitchBox {...SW} sub="24-port managed switch" />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 380, textAlign: 'center', ...enter(lt, 0.2, 0.8, 24) }}>
        <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: '0.4em', color: C.green }}>VIRTUAL LANs</div>
        <div style={{ fontFamily: DISPLAY, fontSize: 128, fontWeight: 700, color: C.text, letterSpacing: '-0.03em', lineHeight: 1 }}>VLANs</div>
        <div style={{ fontFamily: DISPLAY, fontSize: 30, fontWeight: 400, color: C.muted, marginTop: 14 }}>one wire, many networks — from the wire up</div>
      </div>
    </div>
  );
}

// ── SCENE 1 — FLAT NETWORK ──────────────────────────────────────
function SceneFlat() {
  const { localTime: lt } = useSprite();
  const links = DEV_CX.map((c) => ({ a: { x: c, y: DEV_BOTTOM }, b: { x: c, y: PORT_Y }, color: C.steelDim }));
  const rounds = [8.5, 27];
  const problems = ['No isolation — every host can reach every other host', 'One noisy host floods the whole network', 'A breach anywhere is a breach everywhere', 'Broadcast traffic grows with every device you add'];
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Header kicker="The problem" title="One switch, one broadcast domain" lt={lt} />
      <div style={{ position: 'absolute', left: 170, top: 190, width: 1580, height: 540, border: `2px dashed ${C.red}`, borderRadius: 20, opacity: enterO(lt, 4, 0.6) * 0.55 }} />
      <div style={{ position: 'absolute', left: 1440, top: 168, ...enter(lt, 4.3, 0.5, 8) }}>
        <span style={{ fontFamily: MONO, fontSize: 15, color: C.red, background: C.bg, padding: '4px 12px', border: `1px solid ${C.red}`, borderRadius: 6, letterSpacing: '0.1em' }}>BROADCAST DOMAIN</span>
      </div>
      <Cables links={links} />
      {DEV_CX.map((c, i) => (
        <React.Fragment key={i}>
          <Host x={c - DEV_W / 2} y={DEV_Y} color={C.steel} name={devMeta[i].name} ip={devMeta[i].ip} />
          <Port x={c} y={PORT_Y} color={C.steel} label={portName[i]} />
        </React.Fragment>
      ))}
      <SwitchBox {...SW} sub="all ports in the same network" />
      {rounds.map((r, ri) => {
        const sender = ri === 0 ? 0 : 3;
        const sc = DEV_CX[sender];
        return (
          <React.Fragment key={ri}>
            {lt > r - 0.2 && lt < r + 4 && (
              <div style={{ position: 'absolute', left: sc - 150, top: DEV_Y - 52, width: 300, textAlign: 'center', fontFamily: MONO, fontSize: 15, color: C.text, opacity: clamp((lt - r + 0.2) / 0.4, 0, 1) * fadeOut(lt, r + 3, 0.6) }}>
                {devMeta[sender].name} → "who has 10.0.x.x?"
              </div>
            )}
            <Signal path={[{ x: sc, y: DEV_BOTTOM }, { x: sc, y: PORT_Y }]} lt={lt} t0={r} dur={0.55} color={C.red} />
            {DEV_CX.map((c, i) => (
              <React.Fragment key={i}>
                <Signal path={[{ x: sc, y: PORT_Y + 20 }, { x: c, y: PORT_Y + 20 }, { x: c, y: DEV_BOTTOM }]} lt={lt} t0={r + 0.7} dur={0.8} color={C.red} />
                <Ring x={c} y={DEV_Y + DEV_H / 2} lt={lt} t0={r + 1.5} color={C.red} />
              </React.Fragment>
            ))}
            {lt > r + 1.4 && lt < r + 4 && <Callout top={478} color={C.red} opacity={clamp((lt - r - 1.4) / 0.4, 0, 1) * fadeOut(lt, r + 3, 0.6)} text="↑ received by every device — even ones that don't care" />}
          </React.Fragment>
        );
      })}
      <div style={{ position: 'absolute', left: 90, bottom: 60, display: 'flex', gap: 18, flexWrap: 'wrap', maxWidth: 1740 }}>
        {problems.map((p, i) => {
          const t0 = 14 + i * 2.3;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, ...enter(lt, t0, 0.5, 12), opacity: enterO(lt, t0, 0.5) * (lt > 26.5 ? fadeOut(lt, 26.5, 0.5) : 1) }}>
              <span style={{ color: C.red, fontFamily: MONO, fontSize: 18 }}>✕</span>
              <span style={{ fontFamily: DISPLAY, fontSize: 20, color: C.text }}>{p}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SCENE 2 — SEGMENTING ────────────────────────────────────────
function SceneSegment() {
  const { localTime: lt } = useSprite();
  const colored = (i: number) => lt > 2 + i * 0.4;
  const links = DEV_CX.map((c, i) => ({ a: { x: c, y: DEV_BOTTOM }, b: { x: c, y: PORT_Y }, color: colored(i) ? V[devVlan[i]].c : C.steelDim }));
  const bcast = 12;
  const sender = 0;
  const sc = DEV_CX[sender];
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Header kicker="The fix" title="Split one switch into many networks" lt={lt} />
      <div style={{ position: 'absolute', inset: 0, transform: 'translateY(58px)' }}>
      <Cables links={links} />
      {DEV_CX.map((c, i) => {
        const inV10 = devVlan[i] === 10;
        const dimForBcast = lt > bcast - 0.5 && lt < bcast + 6 && !inV10;
        return (
          <React.Fragment key={i}>
            <Host x={c - DEV_W / 2} y={DEV_Y} color={colored(i) ? V[devVlan[i]].c : C.steel} name={devMeta[i].name} ip={devMeta[i].ip} dim={dimForBcast} glow={colored(i) && lt < 6 ? clamp(1 - (lt - (2 + i * 0.4)), 0, 1) : 0} />
            <Port x={c} y={PORT_Y} color={colored(i) ? V[devVlan[i]].c : C.steel} label={portName[i]} active={inV10 && lt > bcast} />
          </React.Fragment>
        );
      })}
      <SwitchBox {...SW} sub="3 logical broadcast domains on one chassis" />
      {colored(5) &&
        ([[10, 0, 1], [20, 2, 3], [30, 4, 5]] as Array<[number, number, number]>).map(([vl, a, b], gi) => {
          const x1 = DEV_CX[a] - DEV_W / 2 - 8,
            x2 = DEV_CX[b] + DEV_W / 2 + 8;
          return (
            <div key={gi} style={{ position: 'absolute', left: x1, top: DEV_Y - 44, width: x2 - x1, ...enter(lt, 6.2 + gi * 0.25, 0.5, 8) }}>
              {/* grouping bracket */}
              <div style={{ height: 12, borderTop: `2px solid ${V[vl].c}`, borderLeft: `2px solid ${V[vl].c}`, borderRight: `2px solid ${V[vl].c}`, borderRadius: '8px 8px 0 0' }} />
              {/* label, centered and lifted clear of the bracket line, opaque so the line never shows through the text */}
              <div style={{ position: 'absolute', top: -46, left: 0, width: x2 - x1, display: 'flex', justifyContent: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 15px', borderRadius: 9, background: C.bg, border: `1.5px solid ${V[vl].c}`, whiteSpace: 'nowrap' }}>
                  <div style={{ width: 11, height: 11, borderRadius: 2, background: V[vl].c }} />
                  <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: V[vl].c }}>VLAN {vl}</span>
                  <span style={{ fontFamily: MONO, fontSize: 13, color: C.text, letterSpacing: '0.06em' }}>{V[vl].name}</span>
                </div>
              </div>
            </div>
          );
        })}
      {lt > bcast - 0.3 && lt < bcast + 6 && <Callout top={478} color={C.green} opacity={clamp((lt - bcast + 0.3) / 0.5, 0, 1) * fadeOut(lt, bcast + 4.5, 0.7)} text="PC-A broadcasts → only VLAN 10 hears it · Finance & Guest never see the frame" />}
      <Signal path={[{ x: sc, y: DEV_BOTTOM }, { x: sc, y: PORT_Y }]} lt={lt} t0={bcast} dur={0.55} color={C.green} />
      {[0, 1].map((i) => {
        const c = DEV_CX[i];
        return (
          <React.Fragment key={i}>
            <Signal path={[{ x: sc, y: PORT_Y + 20 }, { x: c, y: PORT_Y + 20 }, { x: c, y: DEV_BOTTOM }]} lt={lt} t0={bcast + 0.7} dur={0.8} color={C.green} />
            <Ring x={c} y={DEV_Y + DEV_H / 2} lt={lt} t0={bcast + 1.5} color={C.green} />
          </React.Fragment>
        );
      })}
      </div>
      <Takeaway lt={lt} t0={20} text="A VLAN is a broadcast domain defined in software — same cables, same switch, separate networks." />
    </div>
  );
}

// ── SCENE 3 — ACCESS PORTS ──────────────────────────────────────
function SceneAccess() {
  const { localTime: lt } = useSprite();
  const px = [660, 960, 1260],
    py = 560;
  const vlans = [10, 20, 30];
  const dy = 220;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Header kicker="Assigning ports" title="Access ports carry exactly one VLAN" lt={lt} />
      <div style={{ position: 'absolute', inset: 0, transform: 'translateY(48px)' }}>
      <div style={enter(lt, 0.4, 0.6, 16)}>
        <SwitchBox x={360} y={py} w={1200} h={140} label="SW-CORE" sub="switchport mode access" />
      </div>
      <Cables links={px.map((x, i) => ({ a: { x, y: dy + DEV_H }, b: { x, y: py }, color: V[vlans[i]].c }))} />
      {px.map((x, i) => (
        <React.Fragment key={i}>
          <div style={enter(lt, 0.8 + i * 0.25, 0.6, 18)}>
            <Host x={x - DEV_W / 2} y={dy} color={V[vlans[i]].c} name={devMeta[i * 2].name} ip={devMeta[i * 2].ip} />
          </div>
          <Port x={x} y={py} color={V[vlans[i]].c} s={40} active label={`${portName[i]} → access`} />
          <div style={{ position: 'absolute', left: x - 150, top: py + 160, width: 300, textAlign: 'center', fontFamily: MONO, fontSize: 15, color: V[vlans[i]].c, ...enter(lt, 3 + i * 0.4, 0.5, 10) }}>switchport access vlan {vlans[i]}</div>
        </React.Fragment>
      ))}
      {lt > 8 &&
        (() => {
          const t0 = 8,
            sx = px[0];
          const p = clamp((lt - t0) / 2.2, 0, 1);
          return (
            <React.Fragment>
              {p < 1 && (
                <div style={{ position: 'absolute', left: sx - 60, top: dy + DEV_H + p * (py - (dy + DEV_H)) - 18, display: 'flex', alignItems: 'center', opacity: p < 0.9 ? 1 : (1 - p) / 0.1 }}>
                  <div style={{ fontFamily: MONO, fontSize: 13, padding: '6px 10px', background: C.panel2, border: `1px solid ${C.steel}`, borderRadius: 6, color: C.muted }}>untagged frame</div>
                </div>
              )}
              {lt > t0 + 2.3 && (
                <Callout top={150} color={C.green} opacity={clamp((lt - t0 - 2.3) / 0.5, 0, 1)}>
                  <span>
                    The host sends plain, untagged frames — the switch knows the VLAN from the <span style={{ color: C.green }}>port</span>
                  </span>
                </Callout>
              )}
            </React.Fragment>
          );
        })()}
      </div>
      <Takeaway lt={lt} t0={18} text="Access port = one VLAN, host traffic stays untagged. The VLAN lives in the switch's config, not on the wire." />
    </div>
  );
}

// ── SCENE 4 — 802.1Q TAG ────────────────────────────────────────
function SceneTag() {
  const { localTime: lt } = useSprite();
  const baseY = 300,
    fh = 96;
  const fields = [
    { key: 'dst', label: 'Dest MAC', bytes: '6', w: 210, c: C.steel },
    { key: 'src', label: 'Src MAC', bytes: '6', w: 210, c: C.steel },
    { key: 'et', label: 'EtherType', bytes: '2', w: 150, c: C.steel },
    { key: 'pl', label: 'Payload', bytes: '46–1500', w: 300, c: C.steelDim },
    { key: 'fcs', label: 'FCS', bytes: '4', w: 130, c: C.steel },
  ];
  const insertAt = 2;
  const tagW = 240;
  const insP = clamp((lt - 2.5) / 1.0, 0, 1);
  const eIns = Easing.easeInOutCubic(insP);
  const preW = fields.reduce((a, f) => a + f.w, 0) + 24 * (fields.length - 1);
  const totalW = preW + eIns * (tagW + 24);
  const startX = 960 - totalW / 2;
  const xs: number[] = [];
  let cur = startX;
  for (let i = 0; i < fields.length; i++) {
    if (i === insertAt) cur += eIns * (tagW + 24);
    xs.push(cur);
    cur += fields[i].w + 24;
  }
  const tagX = startX + fields.slice(0, insertAt).reduce((a, f) => a + f.w + 24, 0);
  const showBits = lt > 6;
  const bitY = 560;
  const bits = [
    { label: 'TPID', val: '0x8100', bits: '16 bits', w: 210, c: C.green, note: '"this is a tagged frame"' },
    { label: 'PCP', val: '0–7', bits: '3', w: 120, c: C.violet, note: 'priority (QoS)' },
    { label: 'DEI', val: '0/1', bits: '1', w: 90, c: C.violet, note: 'drop-eligible' },
    { label: 'VID', val: '1–4094', bits: '12 bits', w: 300, c: C.amber, note: 'the VLAN ID' },
  ];
  const bitTotalW = bits.reduce((a, b) => a + b.w, 0) + 16 * (bits.length - 1);
  let bx = 960 - bitTotalW / 2;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Header kicker="On the wire" title="The 802.1Q tag — 4 bytes that carry the VLAN" lt={lt} />
      {fields.map((f, i) => (
        <div key={f.key} style={{ position: 'absolute', left: xs[i], top: baseY, width: f.w, height: fh, background: C.panel, border: `1.5px solid ${f.c}`, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', ...enter(lt, 0.4 + i * 0.12, 0.5, 12) }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 600, color: C.text }}>{f.label}</div>
          <div style={{ fontFamily: MONO, fontSize: 13, color: C.muted, marginTop: 6 }}>{f.bytes} bytes</div>
        </div>
      ))}
      {insP > 0.01 && (
        <div style={{ position: 'absolute', left: tagX, top: baseY - 8 * eIns, width: tagW, height: fh + 16 * eIns, background: `linear-gradient(180deg, ${C.green}22, ${C.panel})`, border: `2px solid ${C.green}`, borderRadius: 8, boxShadow: `0 0 ${20 * eIns}px ${C.green}`, opacity: insP, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 700, color: C.green }}>802.1Q tag</div>
          <div style={{ fontFamily: MONO, fontSize: 13, color: C.green, marginTop: 6 }}>4 bytes</div>
        </div>
      )}
      {lt > 3.6 && lt < 6.5 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: baseY + fh + 34, textAlign: 'center', fontFamily: DISPLAY, fontSize: 24, color: C.text, opacity: clamp((lt - 3.6) / 0.5, 0, 1) * fadeOut(lt, 6, 0.5) }}>Slipped in right after the source MAC — the frame grows by just 4 bytes.</div>
      )}
      {showBits && (
        <svg style={{ position: 'absolute', inset: 0, width: 1920, height: 1080, overflow: 'visible', opacity: clamp((lt - 6) / 0.5, 0, 1) }}>
          <path d={`M ${tagX + tagW / 2} ${baseY + fh} L ${tagX + tagW / 2} ${bitY - 70} `} stroke={C.green} strokeWidth="2" strokeDasharray="5 5" fill="none" />
          <path d={`M ${960 - bitTotalW / 2} ${bitY - 70} L ${960 + bitTotalW / 2} ${bitY - 70}`} stroke={C.green} strokeWidth="2" fill="none" opacity="0.4" />
        </svg>
      )}
      {showBits &&
        bits.map((b, i) => {
          const x = bx;
          bx += b.w + 16;
          const t0 = 6.3 + i * 0.35;
          return (
            <div key={b.label} style={{ position: 'absolute', left: x, top: bitY, width: b.w, ...enter(lt, t0, 0.5, 14) }}>
              <div style={{ height: 92, background: C.panel, border: `2px solid ${b.c}`, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 700, color: b.c }}>{b.label}</div>
                <div style={{ fontFamily: MONO, fontSize: 15, color: C.text, marginTop: 5 }}>{b.val}</div>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 12, color: C.faint, textAlign: 'center', marginTop: 8 }}>{b.bits}</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 15, color: C.muted, textAlign: 'center', marginTop: 4 }}>{b.note}</div>
            </div>
          );
        })}
      {lt > 10 && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 78, textAlign: 'center', ...enter(lt, 10, 0.6, 16) }}>
          <span style={{ fontFamily: DISPLAY, fontSize: 30, fontWeight: 500, color: C.text }}>12 bits → </span>
          <span style={{ fontFamily: MONO, fontSize: 30, fontWeight: 700, color: C.amber }}>4096 IDs</span>
          <span style={{ fontFamily: DISPLAY, fontSize: 30, fontWeight: 500, color: C.text }}> (0 & 4095 reserved → </span>
          <span style={{ fontFamily: MONO, fontSize: 30, fontWeight: 700, color: C.green }}>4094 usable</span>
          <span style={{ fontFamily: DISPLAY, fontSize: 30, fontWeight: 500, color: C.text }}>)</span>
        </div>
      )}
    </div>
  );
}

// tagged packet chip riding a trunk
function TaggedPacket({ p1, p2, lt, t0, dur, vlan }: { p1: Pt; p2: Pt; lt: number; t0: number; dur: number; vlan: number }) {
  const p = (lt - t0) / dur;
  if (p <= 0 || p >= 1) return null;
  const x = p1.x + (p2.x - p1.x) * p;
  const fade = p < 0.1 ? p / 0.1 : p > 0.9 ? (1 - p) / 0.1 : 1;
  return (
    <div style={{ position: 'absolute', left: x - 70, top: p1.y - 20, display: 'flex', alignItems: 'center', opacity: fade, filter: `drop-shadow(0 0 10px ${V[vlan].c}aa)` }}>
      <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, padding: '7px 9px', background: V[vlan].c, color: '#0a0c0e', borderRadius: '6px 0 0 6px' }}>{vlan}</div>
      <div style={{ fontFamily: MONO, fontSize: 13, padding: '7px 12px', background: C.panel2, border: `1px solid ${V[vlan].c}`, borderLeft: 'none', color: C.text, borderRadius: '0 6px 6px 0' }}>frame</div>
    </div>
  );
}

// ── SCENE 5 — TRUNK LINKS ───────────────────────────────────────
function SceneTrunk() {
  const { localTime: lt } = useSprite();
  const sw1 = { x: 150, y: 470, w: 440, h: 130 };
  const sw2 = { x: 1330, y: 470, w: 440, h: 130 };
  const trunkY = 535;
  const p1 = { x: sw1.x + sw1.w, y: trunkY };
  const p2 = { x: sw2.x, y: trunkY };
  const leftV = [10, 20],
    rightV = [10, 30];
  const lhx = [260, 470],
    rhx = [1450, 1660],
    hy = 760;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Header kicker="Between switches" title="Trunks carry every VLAN over one link" lt={lt} />
      <svg style={{ position: 'absolute', inset: 0, width: 1920, height: 1080, overflow: 'visible' }}>
        <line x1={p1.x} y1={trunkY} x2={p2.x} y2={trunkY} stroke={C.steel} strokeWidth="10" strokeLinecap="round" opacity={enterO(lt, 1, 0.6)} />
        {[-3, 0, 3].map((o, i) => (
          <line key={i} x1={p1.x} y1={trunkY + o * 4} x2={p2.x} y2={trunkY + o * 4} stroke={[C.green, C.amber, C.cyan][i]} strokeWidth="2.5" opacity={enterO(lt, 1.3, 0.6) * 0.9} />
        ))}
        {lhx.map((x, i) => (
          <line key={'l' + i} x1={x} y1={hy} x2={x} y2={sw1.y + sw1.h} stroke={V[leftV[i]].c} strokeWidth="2.5" opacity={enterO(lt, 1.6, 0.6)} />
        ))}
        {rhx.map((x, i) => (
          <line key={'r' + i} x1={x} y1={hy} x2={x} y2={sw2.y + sw2.h} stroke={V[rightV[i]].c} strokeWidth="2.5" opacity={enterO(lt, 1.6, 0.6)} />
        ))}
      </svg>
      <div style={enter(lt, 0.6, 0.6, 14)}>
        <SwitchBox {...sw1} label="SW-A" sub="access + trunk" />
      </div>
      <div style={enter(lt, 0.6, 0.6, 14)}>
        <SwitchBox {...sw2} label="SW-B" sub="access + trunk" />
      </div>
      <Port x={p1.x} y={trunkY} color={C.text} s={34} active />
      <Port x={p2.x} y={trunkY} color={C.text} s={34} active />
      <div style={{ position: 'absolute', left: 960 - 140, top: trunkY - 78, width: 280, textAlign: 'center', ...enter(lt, 2, 0.5, 10) }}>
        <span style={{ fontFamily: MONO, fontSize: 16, color: C.text, background: C.bg, padding: '6px 14px', border: `1.5px solid ${C.text}`, borderRadius: 8 }}>802.1Q TRUNK</span>
        <div style={{ fontFamily: MONO, fontSize: 13, color: C.muted, marginTop: 8 }}>tagged: VLAN 10, 20, 30</div>
      </div>
      {lhx.map((x, i) => (
        <React.Fragment key={'lh' + i}>
          <Host x={x - DEV_W / 2} y={hy} color={V[leftV[i]].c} name={`H${i + 1}`} ip={`vlan ${leftV[i]}`} style={enter(lt, 1.8 + i * 0.15, 0.5, 12)} />
          <Port x={x} y={sw1.y + sw1.h} color={V[leftV[i]].c} label="access" />
        </React.Fragment>
      ))}
      {rhx.map((x, i) => (
        <React.Fragment key={'rh' + i}>
          <Host x={x - DEV_W / 2} y={hy} color={V[rightV[i]].c} name={`H${i + 3}`} ip={`vlan ${rightV[i]}`} style={enter(lt, 1.8 + i * 0.15, 0.5, 12)} />
          <Port x={x} y={sw2.y + sw2.h} color={V[rightV[i]].c} label="access" />
        </React.Fragment>
      ))}
      {(() => {
        const t0 = 7;
        const src = { x: lhx[0], y: hy },
          srcPort = { x: lhx[0], y: sw1.y + sw1.h };
        const dstPort = { x: rhx[0], y: sw2.y + sw2.h },
          dst = { x: rhx[0], y: hy };
        return (
          <React.Fragment>
            <Signal path={[src, srcPort, { x: lhx[0], y: trunkY }, p1]} lt={lt} t0={t0} dur={1.2} color={C.green} label={lt < t0 + 1.2 ? 'untagged' : null} />
            <TaggedPacket p1={p1} p2={p2} lt={lt} t0={t0 + 1.2} dur={1.6} vlan={10} />
            <Signal path={[p2, { x: rhx[0], y: trunkY }, dstPort, dst]} lt={lt} t0={t0 + 2.8} dur={1.2} color={C.green} label={lt > t0 + 2.8 ? 'untagged' : null} />
            <Ring x={dst.x} y={hy + DEV_H / 2} lt={lt} t0={t0 + 3.9} color={C.green} />
          </React.Fragment>
        );
      })()}
      <div style={{ position: 'absolute', left: 90, bottom: 150, display: 'flex', gap: 20, ...enter(lt, 13, 0.6, 14) }}>
        <div style={{ padding: '14px 20px', background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, maxWidth: 760 }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 700, color: C.text }}>Access port</div>
          <div style={{ fontFamily: DISPLAY, fontSize: 18, color: C.muted, marginTop: 6 }}>
            faces a host · one VLAN · frames <b style={{ color: C.text }}>untagged</b>
          </div>
        </div>
        <div style={{ padding: '14px 20px', background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, maxWidth: 760 }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 700, color: C.text }}>Trunk port</div>
          <div style={{ fontFamily: DISPLAY, fontSize: 18, color: C.muted, marginTop: 6 }}>
            links switches · many VLANs · frames <b style={{ color: C.green }}>802.1Q-tagged</b>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SCENE 6 — NATIVE VLAN ───────────────────────────────────────
function SceneNative() {
  const { localTime: lt } = useSprite();
  const trunkY = 470;
  const x1 = 300,
    x2 = 1620;
  const frames: Array<{ v: number; tagged: boolean }> = [
    { v: 10, tagged: true },
    { v: 20, tagged: true },
    { v: 1, tagged: false },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Header kicker="The exception" title="One VLAN rides the trunk untagged" lt={lt} />
      <svg style={{ position: 'absolute', inset: 0, width: 1920, height: 1080, overflow: 'visible' }}>
        <line x1={x1} y1={trunkY} x2={x2} y2={trunkY} stroke={C.steel} strokeWidth="10" strokeLinecap="round" opacity={enterO(lt, 0.6, 0.6)} />
      </svg>
      <SwitchBox x={x1 - 220} y={trunkY - 65} w={200} h={130} label="SW-A" />
      <SwitchBox x={x2 + 20} y={trunkY - 65} w={200} h={130} label="SW-B" />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 600, display: 'flex', justifyContent: 'center', gap: 40, ...enter(lt, 1.2, 0.6, 16) }}>
        {frames.map((f, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {f.tagged ? (
                <React.Fragment>
                  <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, padding: '10px 12px', background: V[f.v].c, color: '#0a0c0e', borderRadius: '8px 0 0 8px' }}>{f.v}</div>
                  <div style={{ fontFamily: MONO, fontSize: 16, padding: '10px 18px', background: C.panel2, border: `1.5px solid ${V[f.v].c}`, borderLeft: 'none', color: C.text, borderRadius: '0 8px 8px 0' }}>frame</div>
                </React.Fragment>
              ) : (
                <div style={{ fontFamily: MONO, fontSize: 16, padding: '10px 18px', background: C.panel2, border: `1.5px dashed ${C.steel}`, color: C.muted, borderRadius: 8 }}>frame&nbsp;·&nbsp;no tag</div>
              )}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 14, color: f.tagged ? V[f.v].c : C.muted, marginTop: 12 }}>{f.tagged ? `VLAN ${f.v} · tagged` : 'NATIVE VLAN 1 · untagged'}</div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 300, textAlign: 'center', ...enter(lt, 3.5, 0.6, 16) }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 28, color: C.text, fontWeight: 500, maxWidth: 1200, margin: '0 auto', lineHeight: 1.4 }}>
          Any untagged frame arriving on a trunk is assumed to be the <span style={{ color: C.amber }}>native VLAN</span> — VLAN&nbsp;1 by default.
        </div>
      </div>
      <Takeaway lt={lt} t0={7} color={C.amber} text="Both ends must agree on the native VLAN — a mismatch silently bridges two VLANs together." />
    </div>
  );
}

// ── SCENE 7 — INTER-VLAN ROUTING ────────────────────────────────
function TagUpDown({ ax, ay, bx, by, lt, t0, dur, vlan }: { ax: number; ay: number; bx: number; by: number; lt: number; t0: number; dur: number; vlan: number }) {
  const p = (lt - t0) / dur;
  if (p <= 0 || p >= 1) return null;
  const x = ax + (bx - ax) * p,
    y = ay + (by - ay) * p;
  const fade = p < 0.12 ? p / 0.12 : p > 0.88 ? (1 - p) / 0.12 : 1;
  return (
    <div style={{ position: 'absolute', left: x - 52, top: y - 16, display: 'flex', alignItems: 'center', opacity: fade, filter: `drop-shadow(0 0 9px ${V[vlan].c}aa)` }}>
      <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, padding: '6px 8px', background: V[vlan].c, color: '#0a0c0e', borderRadius: '5px 0 0 5px' }}>{vlan}</div>
      <div style={{ fontFamily: MONO, fontSize: 12, padding: '6px 10px', background: C.panel2, border: `1px solid ${V[vlan].c}`, borderLeft: 'none', color: C.text, borderRadius: '0 5px 5px 0' }}>pkt</div>
    </div>
  );
}
function SceneRoute() {
  const { localTime: lt } = useSprite();
  const sw = { x: 610, y: 620, w: 700, h: 120 };
  const router = { x: 810, y: 210, w: 300, h: 120 };
  const rPort = { x: 960, y: router.y + router.h };
  const swTrunkPort = { x: 960, y: sw.y };
  const hA = { x: 720, y: 850, v: 10 },
    hB = { x: 1200, y: 850, v: 20 };
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Header kicker="Crossing VLANs" title="To route between VLANs, go up to Layer 3" lt={lt} />
      <svg style={{ position: 'absolute', inset: 0, width: 1920, height: 1080, overflow: 'visible' }}>
        <line x1={rPort.x} y1={rPort.y} x2={swTrunkPort.x} y2={swTrunkPort.y} stroke={C.steel} strokeWidth="9" strokeLinecap="round" opacity={enterO(lt, 1, 0.6)} />
        {[-2.5, 2.5].map((o, i) => (
          <line key={i} x1={rPort.x + o * 4} y1={rPort.y} x2={swTrunkPort.x + o * 4} y2={swTrunkPort.y} stroke={[C.green, C.amber][i]} strokeWidth="2.5" opacity={enterO(lt, 1.3, 0.6)} />
        ))}
        <line x1={hA.x} y1={hA.y} x2={hA.x} y2={sw.y + sw.h} stroke={V[10].c} strokeWidth="2.5" opacity={enterO(lt, 1.6, 0.6)} />
        <line x1={hB.x} y1={hB.y} x2={hB.x} y2={sw.y + sw.h} stroke={V[20].c} strokeWidth="2.5" opacity={enterO(lt, 1.6, 0.6)} />
      </svg>
      <div style={{ position: 'absolute', left: router.x, top: router.y, width: router.w, height: router.h, background: 'linear-gradient(180deg,#20262c,#12161a)', border: `1.5px solid ${C.green}`, borderRadius: 14, boxShadow: `0 0 26px ${C.green}44`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', ...enter(lt, 0.5, 0.6, 16) }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 700, color: C.text }}>ROUTER · L3</div>
        <div style={{ fontFamily: MONO, fontSize: 13, color: C.green, marginTop: 6 }}>Gi0/0.10 · Gi0/0.20 (subinterfaces)</div>
      </div>
      <Port x={rPort.x} y={rPort.y} color={C.text} s={30} active />
      <Port x={swTrunkPort.x} y={swTrunkPort.y} color={C.text} s={30} active />
      <div style={enter(lt, 0.7, 0.6, 14)}>
        <SwitchBox {...sw} label="SW-CORE" sub="trunk to router · router-on-a-stick" />
      </div>
      <Host x={hA.x - DEV_W / 2} y={hA.y} color={V[10].c} name="PC-A" ip="10.0.1.11 · vlan 10" style={enter(lt, 1.8, 0.5, 12)} />
      <Host x={hB.x - DEV_W / 2} y={hB.y} color={V[20].c} name="PC-C" ip="10.0.2.21 · vlan 20" style={enter(lt, 2.0, 0.5, 12)} />
      <Port x={hA.x} y={sw.y + sw.h} color={V[10].c} label="access v10" />
      <Port x={hB.x} y={sw.y + sw.h} color={V[20].c} label="access v20" />
      {(() => {
        const t0 = 6.5;
        return (
          <React.Fragment>
            <Signal path={[{ x: hA.x, y: hA.y }, { x: hA.x, y: sw.y }, { x: swTrunkPort.x, y: sw.y }]} lt={lt} t0={t0} dur={1.1} color={V[10].c} label={lt < t0 + 1.1 ? 'to PC-C' : null} />
            <TagUpDown ax={swTrunkPort.x} ay={swTrunkPort.y} bx={rPort.x} by={rPort.y} lt={lt} t0={t0 + 1.1} dur={1.2} vlan={10} />
            {lt > t0 + 2.3 && lt < t0 + 3.1 && (
              <div style={{ position: 'absolute', left: router.x, top: router.y - 46, width: router.w, textAlign: 'center', fontFamily: MONO, fontSize: 15, color: C.text, opacity: clamp((lt - t0 - 2.3) / 0.3, 0, 1) * fadeOut(lt, t0 + 2.8, 0.3) }}>route 10.0.1→10.0.2 · re-tag v10→v20</div>
            )}
            <TagUpDown ax={rPort.x} ay={rPort.y} bx={swTrunkPort.x} by={swTrunkPort.y} lt={lt} t0={t0 + 3.0} dur={1.2} vlan={20} />
            <Signal path={[{ x: swTrunkPort.x, y: sw.y }, { x: hB.x, y: sw.y }, { x: hB.x, y: hB.y }]} lt={lt} t0={t0 + 4.2} dur={1.1} color={V[20].c} />
            <Ring x={hB.x} y={hB.y + DEV_H / 2} lt={lt} t0={t0 + 5.3} color={V[20].c} />
          </React.Fragment>
        );
      })()}
      <Takeaway lt={lt} t0={16} color={C.green} text="VLANs are isolated by design — only a router or L3 switch (SVIs) can move traffic between them." />
    </div>
  );
}

// ── SCENE 8 — VLAN HOPPING ──────────────────────────────────────
function FixRow({ lt, t0, items }: { lt: number; t0: number; items: string[] }) {
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 90, display: 'flex', justifyContent: 'center', gap: 16, ...enter(lt, t0, 0.6, 14) }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', background: `${C.green}14`, border: `1px solid ${C.green}`, borderRadius: 10, ...enter(lt, t0 + i * 0.25, 0.5, 10) }}>
          <span style={{ color: C.green, fontSize: 18 }}>✓</span>
          <span style={{ fontFamily: MONO, fontSize: 16, color: C.text }}>{it}</span>
        </div>
      ))}
    </div>
  );
}
function SceneHop() {
  const { localTime: lt } = useSprite();
  const showB = lt >= 16.5;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Header kicker="Security" title="VLAN hopping — and how to stop it" lt={lt} />
      {lt < 17 && (
        <div style={{ position: 'absolute', inset: 0, opacity: fadeOut(lt, 15.5, 1.2) }}>
          <div style={{ position: 'absolute', left: 90, top: 200, fontFamily: MONO, fontSize: 17, letterSpacing: '0.14em', color: C.red, ...enter(lt, 0.5, 0.5, 10) }}>ATTACK 1 · SWITCH SPOOFING (DTP)</div>
          <Host x={200} y={430} w={220} h={120} color={C.red} name="ATTACKER" ip="pretends to be a switch" style={enter(lt, 1, 0.6, 14)} />
          <SwitchBox x={760} y={430} w={400} h={120} label="SWITCH" sub="port left as dynamic/auto" style={enter(lt, 1.2, 0.6, 14)} />
          <div style={{ position: 'absolute', left: 1360, top: 430, ...enter(lt, 3.2, 0.6, 14) }}>
            {/* Badge is absolutely positioned, so stack via explicit y offsets */}
            {[10, 20, 30].map((v, i) => (
              <Badge key={v} vlan={v} x={0} y={i * 62} lt={lt} t0={3.2} big />
            ))}
          </div>
          <svg style={{ position: 'absolute', inset: 0, width: 1920, height: 1080, overflow: 'visible' }}>
            <line x1={420} y1={490} x2={760} y2={490} stroke={C.steel} strokeWidth="3" opacity={enterO(lt, 1.5, 0.5)} />
            <line x1={1160} y1={490} x2={1360} y2={470} stroke={C.steel} strokeWidth="2.5" strokeDasharray="5 5" opacity={enterO(lt, 3.2, 0.5)} />
          </svg>
          {lt > 2 && lt < 6 && <div style={{ position: 'absolute', left: 440, top: 445, fontFamily: MONO, fontSize: 15, color: C.red, opacity: clamp((lt - 2) / 0.4, 0, 1) * fadeOut(lt, 5.2, 0.6) }}>DTP: "let's form a trunk?"</div>}
          {lt > 5.5 && <div style={{ position: 'absolute', left: 440, top: 520, fontFamily: MONO, fontSize: 15, color: C.amber, ...enter(lt, 5.5, 0.5, 8) }}>switch auto-agrees → trunk formed</div>}
          {lt > 8 && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: 640, textAlign: 'center', fontFamily: DISPLAY, fontSize: 26, fontWeight: 600, color: C.red, ...enter(lt, 8, 0.6, 14) }}>
              The attacker now sees traffic for <span style={{ color: C.text }}>every VLAN</span>.
            </div>
          )}
          {lt > 10.5 && <FixRow lt={lt} t0={10.5} items={['shutdown unused ports', 'switchport mode access', 'switchport nonegotiate (kill DTP)']} />}
        </div>
      )}
      {showB && (
        <div style={{ position: 'absolute', inset: 0, opacity: clamp((lt - 16.5) / 1, 0, 1) }}>
          <div style={{ position: 'absolute', left: 90, top: 200, fontFamily: MONO, fontSize: 17, letterSpacing: '0.14em', color: C.red, ...enter(lt, 16.7, 0.5, 10) }}>ATTACK 2 · DOUBLE TAGGING</div>
          <Host x={130} y={430} w={220} h={120} color={C.red} name="ATTACKER" ip="native VLAN 1 · access port" style={enter(lt, 17, 0.6, 14)} />
          <SwitchBox x={640} y={430} w={300} h={120} label="SW-1" sub="native = VLAN 1" style={enter(lt, 17.2, 0.6, 14)} />
          <SwitchBox x={1200} y={430} w={300} h={120} label="SW-2" style={enter(lt, 17.2, 0.6, 14)} />
          <Host x={1560} y={430} w={200} h={120} color={C.cyan} name="VICTIM" ip="VLAN 20" style={enter(lt, 17.4, 0.6, 14)} />
          <svg style={{ position: 'absolute', inset: 0, width: 1920, height: 1080, overflow: 'visible' }}>
            <line x1={350} y1={490} x2={640} y2={490} stroke={C.steel} strokeWidth="3" opacity={enterO(lt, 17.4, 0.5)} />
            <line x1={940} y1={490} x2={1200} y2={490} stroke={C.steel} strokeWidth="7" opacity={enterO(lt, 17.4, 0.5)} />
            <line x1={1500} y1={490} x2={1560} y2={490} stroke={C.cyan} strokeWidth="3" opacity={enterO(lt, 17.4, 0.5)} />
          </svg>
          <div style={{ position: 'absolute', left: 1010, top: 405, fontFamily: MONO, fontSize: 13, color: C.muted, ...enter(lt, 17.6, 0.5, 8) }}>trunk · native 1</div>
          {(() => {
            const t0 = 19;
            const p = (lt - t0) / 6;
            if (p <= 0) return null;
            let stage: string;
            if (p < 0.3) stage = 'both';
            else if (p < 0.45) stage = 'strip';
            else if (p < 0.72) stage = 'inner';
            else if (p < 1) stage = 'deliver';
            else return <Ring x={1660} y={490} lt={lt} t0={t0 + 5.9} color={C.red} />;
            let x: number;
            if (stage === 'both') x = 240 + (640 - 240) * (p / 0.3);
            else if (stage === 'strip') x = 700;
            else if (stage === 'inner') x = 790 + (1200 - 790) * ((p - 0.45) / 0.27);
            else x = 1200 + (1660 - 1200) * ((p - 0.72) / 0.28);
            return (
              <React.Fragment>
                <div style={{ position: 'absolute', left: x - 70, top: 465, display: 'flex', alignItems: 'center', filter: `drop-shadow(0 0 10px ${C.red}aa)` }}>
                  {(stage === 'both' || stage === 'strip') && <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, padding: '6px 8px', background: stage === 'strip' ? C.steelDim : C.steel, color: '#0a0c0e', borderRadius: '5px 0 0 5px', opacity: stage === 'strip' ? 0.4 : 1 }}>1</div>}
                  <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, padding: '6px 8px', background: C.cyan, color: '#0a0c0e' }}>20</div>
                  <div style={{ fontFamily: MONO, fontSize: 13, padding: '6px 10px', background: C.panel2, border: `1px solid ${C.red}`, borderLeft: 'none', color: C.text, borderRadius: '0 5px 5px 0' }}>evil</div>
                </div>
                {stage === 'strip' && <div style={{ position: 'absolute', left: 640, top: 400, width: 300, textAlign: 'center', fontFamily: MONO, fontSize: 14, color: C.amber }}>SW-1 strips outer (native) tag →</div>}
                {stage === 'deliver' && <div style={{ position: 'absolute', left: 1360, top: 400, width: 400, textAlign: 'center', fontFamily: MONO, fontSize: 14, color: C.red }}>lands in VLAN 20 — no reply path</div>}
              </React.Fragment>
            );
          })()}
          {lt > 26 && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: 650, textAlign: 'center', fontFamily: DISPLAY, fontSize: 25, fontWeight: 600, color: C.red, ...enter(lt, 26, 0.6, 14) }}>Outer tag = native VLAN → stripped once → inner tag lands the frame in the victim's VLAN (one-way).</div>
          )}
          {lt > 28.5 && <FixRow lt={lt} t0={28.5} items={['use a dedicated, unused native VLAN', 'never use VLAN 1', 'prune VLANs off trunks']} />}
        </div>
      )}
    </div>
  );
}

// ── SCENE 9 — RECAP ─────────────────────────────────────────────
function SceneRecap() {
  const { localTime: lt } = useSprite();
  const cards = [
    { c: C.green, t: 'VLAN', d: 'a broadcast domain in software' },
    { c: C.amber, t: 'ACCESS', d: 'one VLAN · untagged to the host' },
    { c: C.cyan, t: 'TRUNK', d: 'many VLANs · 802.1Q tagged' },
    { c: C.violet, t: 'ROUTE', d: 'L3 to cross between VLANs' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 180, textAlign: 'center', ...enter(lt, 0.2, 0.6, 20) }}>
        <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: '0.3em', color: C.green }}>THE WHOLE PICTURE</div>
        <div style={{ fontFamily: DISPLAY, fontSize: 64, fontWeight: 700, color: C.text, marginTop: 12, letterSpacing: '-0.02em' }}>VLANs, from the wire up</div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 420, display: 'flex', justifyContent: 'center', gap: 28 }}>
        {cards.map((c, i) => (
          <div key={i} style={{ width: 340, padding: '30px 28px', background: C.panel, border: `1.5px solid ${c.c}`, borderRadius: 16, boxShadow: `0 0 24px ${c.c}22`, ...enter(lt, 0.8 + i * 0.25, 0.6, 20) }}>
            <div style={{ width: 16, height: 16, borderRadius: 5, background: c.c, boxShadow: `0 0 12px ${c.c}` }} />
            <div style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 700, color: c.c, marginTop: 18 }}>{c.t}</div>
            <div style={{ fontFamily: DISPLAY, fontSize: 20, color: C.muted, marginTop: 10, lineHeight: 1.35 }}>{c.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Film() {
  return (
    <Stage width={1920} height={1080} duration={DURATION} background={C.bg}>
      <Background />
      <Sprite start={Tm.intro[0]} end={Tm.intro[1]}>
        <SceneIntro />
      </Sprite>
      <Sprite start={Tm.flat[0]} end={Tm.flat[1]}>
        <SceneFlat />
      </Sprite>
      <Sprite start={Tm.segment[0]} end={Tm.segment[1]}>
        <SceneSegment />
      </Sprite>
      <Sprite start={Tm.access[0]} end={Tm.access[1]}>
        <SceneAccess />
      </Sprite>
      <Sprite start={Tm.tag[0]} end={Tm.tag[1]}>
        <SceneTag />
      </Sprite>
      <Sprite start={Tm.trunk[0]} end={Tm.trunk[1]}>
        <SceneTrunk />
      </Sprite>
      <Sprite start={Tm.native[0]} end={Tm.native[1]}>
        <SceneNative />
      </Sprite>
      <Sprite start={Tm.route[0]} end={Tm.route[1]}>
        <SceneRoute />
      </Sprite>
      <Sprite start={Tm.hop[0]} end={Tm.hop[1]}>
        <SceneHop />
      </Sprite>
      <Sprite start={Tm.recap[0]} end={Tm.recap[1]}>
        <SceneRecap />
      </Sprite>
      <ChapterTag />
      <ProgressRail />
    </Stage>
  );
}
