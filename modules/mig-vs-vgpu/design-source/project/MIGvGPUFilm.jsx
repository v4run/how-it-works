// MIGvGPUFilm.jsx
// "NVIDIA MIG vs vGPU — internals" — a ~3min diagrammatic explainer.
// Self-contained: includes a trimmed copy of the animation engine (Stage/Sprite/
// easing) from animations.jsx so it can be mounted as a single module.
// module.exports = { MIGvGPUFilm }

/* ─────────────────────────────────────────────────────────────────────────
   ENGINE (trimmed from animations.jsx starter)
   ───────────────────────────────────────────────────────────────────────── */
const Easing = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => (--t) * t * t + 1,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  easeOutQuart: (t) => 1 - (--t) * t * t * t,
  easeInOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t),
  easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  easeOutBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
function interpolate(input, output, ease = Easing.linear) {
  return (t) => {
    if (t <= input[0]) return output[0];
    if (t >= input[input.length - 1]) return output[output.length - 1];
    for (let i = 0; i < input.length - 1; i++) {
      if (t >= input[i] && t <= input[i + 1]) {
        const span = input[i + 1] - input[i];
        const local = span === 0 ? 0 : (t - input[i]) / span;
        const easeFn = Array.isArray(ease) ? (ease[i] || Easing.linear) : ease;
        return output[i] + (output[i + 1] - output[i]) * easeFn(local);
      }
    }
    return output[output.length - 1];
  };
}
function animate({ from = 0, to = 1, start = 0, end = 1, ease = Easing.easeInOutCubic }) {
  return (t) => {
    if (t <= start) return from;
    if (t >= end) return to;
    return from + (to - from) * ease((t - start) / (end - start));
  };
}
const TimelineContext = React.createContext({ time: 0, duration: 10, playing: false });
const useTime = () => React.useContext(TimelineContext).time;
const useTimeline = () => React.useContext(TimelineContext);
const SpriteContext = React.createContext({ localTime: 0, progress: 0, duration: 0 });
const useSprite = () => React.useContext(SpriteContext);
function Sprite({ start = 0, end = Infinity, children, keepMounted = false }) {
  const { time } = useTimeline();
  const visible = time >= start && time <= end;
  if (!visible && !keepMounted) return null;
  const duration = end - start;
  const localTime = Math.max(0, time - start);
  const progress = duration > 0 && isFinite(duration) ? clamp(localTime / duration, 0, 1) : 0;
  const value = { localTime, progress, duration, visible };
  return React.createElement(SpriteContext.Provider, { value },
    typeof children === 'function' ? children(value) : children);
}

/* ─────────────────────────────────────────────────────────────────────────
   DESIGN TOKENS
   ───────────────────────────────────────────────────────────────────────── */
const C = {
  bg: '#070b0c',
  ink: '#eaf1e6',
  dim: 'rgba(214,226,210,0.58)',
  faint: 'rgba(214,226,210,0.34)',
  line: 'rgba(150,180,140,0.16)',
  mig: '#85c20a',        // NVIDIA green — MIG
  migSoft: 'rgba(133,194,10,0.16)',
  migEdge: 'rgba(133,194,10,0.42)',
  vgpu: '#21d3c9',       // teal — vGPU
  vgpuSoft: 'rgba(33,211,201,0.15)',
  vgpuEdge: 'rgba(33,211,201,0.42)',
  red: '#ff5a52',
  amber: '#f2b134',
};
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const DISP = "'Space Grotesk', system-ui, sans-serif";

const fmtClock = (t) => {
  const m = Math.floor(t / 60); const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

/* ─────────────────────────────────────────────────────────────────────────
   ATOMS
   ───────────────────────────────────────────────────────────────────────── */
function Kicker({ children, accent = C.mig, delay = 0, lt = 0 }) {
  const o = clamp((lt - delay) / 0.4, 0, 1);
  return (
    <div style={{
      fontFamily: MONO, fontSize: 18, letterSpacing: '0.32em', textTransform: 'uppercase',
      color: accent, opacity: o, transform: `translateY(${(1 - o) * 8}px)`,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span style={{ width: 26, height: 1, background: accent, display: 'inline-block', opacity: 0.7 }} />
      {children}
    </div>
  );
}

// Lower-third caption (the "VO line").
function Caption({ lt = 99, kicker, title, body, accent = C.mig }) {
  const tO = clamp((lt - 0.15) / 0.5, 0, 1);
  const bO = clamp((lt - 0.45) / 0.6, 0, 1);
  return (
    <div style={{ position: 'absolute', left: 120, bottom: 92, maxWidth: 1180 }}>
      {kicker ? <div style={{ marginBottom: 16 }}><Kicker accent={accent} lt={lt}>{kicker}</Kicker></div> : null}
      <div style={{ display: 'flex', gap: 20, alignItems: 'stretch' }}>
        <div style={{ width: 4, background: accent, borderRadius: 2, opacity: tO, boxShadow: `0 0 18px ${accent}66` }} />
        <div>
          {title ? (
            <div style={{
              fontFamily: DISP, fontSize: 46, fontWeight: 600, color: C.ink, lineHeight: 1.08,
              letterSpacing: '-0.01em', opacity: tO, transform: `translateY(${(1 - tO) * 14}px)`,
            }}>{title}</div>
          ) : null}
          {body ? (
            <div style={{
              fontFamily: MONO, fontSize: 21, color: C.dim, lineHeight: 1.55, marginTop: 14, maxWidth: 980,
              opacity: bO, transform: `translateY(${(1 - bO) * 10}px)`,
            }}>{body}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Chip({ children, accent = C.mig, filled = false, style }) {
  return (
    <span style={{
      fontFamily: MONO, fontSize: 16, letterSpacing: '0.02em',
      padding: '6px 12px', borderRadius: 6,
      border: `1px solid ${accent}`,
      background: filled ? accent : 'transparent',
      color: filled ? '#0a0f08' : accent,
      whiteSpace: 'nowrap', fontWeight: filled ? 600 : 400,
      ...style,
    }}>{children}</span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   THE GPU DIE — shared visual system
   cols = 7 compute slices (GPC/SM columns); 8 memory slices; an L2 band.
   props:
     accent          base color
     reveal          0..1 build-in of cells
     litCols         'all' | 'none' | number[]  (which compute columns glow)
     activeAccent    color used for "lit" cells (defaults accent)
     groups          MIG slices: [{cols:[i..], label, color, fault}]
     memGroups       array length-8 of colors|null to tint memory slices
     dividers        0..1 strength of vertical hard partition lines (MIG)
     pulse           0..1 (subtle breathing on lit cells)
   ───────────────────────────────────────────────────────────────────────── */
const COLS = 7, ROWS = 7, MEM = 8;
function Die({
  w = 560, h = 524, accent = C.mig, reveal = 1, litCols = 'all', activeAccent = null,
  groups = null, memGroups = null, dividers = 0, pulse = 0, label = 'GA100 · GPU DIE',
  scaleHint = 1, hideHeader = false,
}) {
  const act = activeAccent || accent;
  const litSet = litCols === 'all'
    ? new Set(Array.from({ length: COLS }, (_, i) => i))
    : litCols === 'none' ? new Set() : new Set(litCols);

  const fieldH = h - 196;
  const colGap = 8, cellGap = 7;
  const pad = 22;
  const innerW = w - pad * 2;
  const colW = (innerW - colGap * (COLS - 1)) / COLS;
  const cellH = (fieldH - cellGap * (ROWS - 1)) / ROWS;

  const breathe = 1 + Math.sin(pulse * Math.PI * 2) * 0.0;

  // cell reveal order (top-left to bottom-right diagonal)
  const cellIn = (ci, ri) => {
    const order = (ci + ri) / (COLS + ROWS);
    return clamp((reveal - order * 0.6) / 0.4, 0, 1);
  };

  return (
    <div style={{
      position: 'relative', width: w, height: h, borderRadius: 18,
      background: 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(0,0,0,0.18))',
      border: `1px solid ${C.line}`,
      boxShadow: '0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
      padding: pad, boxSizing: 'border-box',
    }}>
      {/* die header (kept as spacer when hidden so group labels have clearance) */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16, height: 22,
      }}>
        {!hideHeader ? <span style={{ fontFamily: MONO, fontSize: 14, letterSpacing: '0.18em', color: C.faint }}>{label}</span> : <span />}
        {!hideHeader ? <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '0.12em', color: accent, opacity: 0.8 }}>
          {COLS}× GPC · {COLS * ROWS} SM
        </span> : null}
      </div>

      {/* SM field */}
      <div style={{ position: 'relative', display: 'flex', gap: colGap, height: fieldH }}>
        {Array.from({ length: COLS }).map((_, ci) => {
          const lit = litSet.has(ci);
          return (
            <div key={ci} style={{ position: 'relative', width: colW, display: 'flex', flexDirection: 'column', gap: cellGap }}>
              {Array.from({ length: ROWS }).map((_, ri) => {
                const cin = cellIn(ci, ri);
                const cellBg = lit
                  ? act
                  : `rgba(${hexToRgb(accent)},0.12)`;
                const cellBorder = lit ? 'transparent' : `rgba(${hexToRgb(accent)},0.28)`;
                return (
                  <div key={ri} style={{
                    flex: 1, borderRadius: 4,
                    background: cellBg,
                    border: `1px solid ${cellBorder}`,
                    opacity: cin,
                    transform: `scale(${0.7 + 0.3 * cin})`,
                    boxShadow: lit ? `0 0 10px ${act}99, inset 0 0 6px rgba(255,255,255,0.25)` : 'none',
                    transition: 'none',
                  }} />
                );
              })}
            </div>
          );
        })}

        {/* hard partition dividers (MIG) */}
        {dividers > 0 && Array.from({ length: COLS - 1 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', top: -6, bottom: -6,
            left: (i + 1) * colW + i * colGap + colGap / 2 - 1,
            width: 2, background: `rgba(${hexToRgb(accent)},${0.5 * dividers})`,
            boxShadow: `0 0 8px rgba(${hexToRgb(accent)},${0.6 * dividers})`,
          }} />
        ))}

        {/* MIG group outlines */}
        {groups && groups.map((g, gi) => {
          const c0 = Math.min(...g.cols), c1 = Math.max(...g.cols);
          const left = c0 * (colW + colGap) - 5;
          const width = (c1 - c0 + 1) * colW + (c1 - c0) * colGap + 10;
          const col = g.fault ? C.red : (g.color || accent);
          return (
            <div key={gi} style={{
              position: 'absolute', top: -10, bottom: -10, left, width,
              border: `1.5px solid ${col}`, borderRadius: 10,
              boxShadow: `0 0 22px ${col}40, inset 0 0 26px ${col}14`,
              opacity: g.o == null ? 1 : g.o,
            }}>
              {g.label || g.fault ? (
                <span style={{
                  position: 'absolute', top: -27, left: 0, fontFamily: MONO, fontSize: 13,
                  letterSpacing: '0.04em', color: col, whiteSpace: 'nowrap',
                }}>{g.label}</span>
              ) : null}
              {g.fault ? (
                <span style={{
                  position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)',
                  fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', color: C.red,
                  background: C.bg, padding: '0 4px', whiteSpace: 'nowrap',
                }}>XID</span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* L2 band */}
      <div style={{
        marginTop: 16, height: 26, borderRadius: 6,
        background: `repeating-linear-gradient(90deg, rgba(${hexToRgb(accent)},0.16) 0 26px, rgba(${hexToRgb(accent)},0.07) 26px 32px)`,
        border: `1px solid rgba(${hexToRgb(accent)},0.22)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: clamp(reveal * 1.4 - 0.2, 0, 1),
      }}>
        <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.34em', color: C.faint }}>L2 CACHE · CROSSBAR</span>
      </div>

      {/* memory strip (HBM) */}
      <div style={{ marginTop: 12, display: 'flex', gap: 6, height: 40 }}>
        {Array.from({ length: MEM }).map((_, mi) => {
          const tint = memGroups ? memGroups[mi] : null;
          const reserved = mi === MEM - 1 && memGroups === 'mig';
          const mIn = clamp((reveal - 0.4) / 0.5, 0, 1);
          const fill = tint && tint !== 'reserved'
            ? `rgba(${hexToRgb(tint)},0.85)`
            : tint === 'reserved'
              ? 'rgba(120,130,120,0.18)'
              : `rgba(${hexToRgb(accent)},0.14)`;
          return (
            <div key={mi} style={{
              flex: 1, borderRadius: 5, background: fill,
              border: `1px solid rgba(${hexToRgb(tint && tint !== 'reserved' ? tint : accent)},0.3)`,
              opacity: mIn,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: tint && tint !== 'reserved' ? '#06100a' : C.faint }}>
                {tint === 'reserved' ? 'rsv' : 'HBM'}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{
        marginTop: 8, fontFamily: MONO, fontSize: 12, letterSpacing: '0.2em', color: C.faint, textAlign: 'center',
        opacity: clamp((reveal - 0.5) / 0.4, 0, 1),
      }}>
        {MEM}× MEMORY SLICE · HBM2e
      </div>
    </div>
  );
}

function hexToRgb(hex) {
  if (hex.startsWith('rgb')) return hex; // already
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/* small leader-line label used in anatomy */
function Annotation({ x, y, dx, dy, accent = C.mig, title, sub, lt = 0, delay = 0 }) {
  const o = clamp((lt - delay) / 0.5, 0, 1);
  const len = Math.hypot(dx, dy);
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity: o }}>
      <div style={{ position: 'absolute', width: 8, height: 8, borderRadius: 8, background: accent, left: -4, top: -4, boxShadow: `0 0 12px ${accent}` }} />
      <div style={{
        position: 'absolute', left: 0, top: 0, width: len, height: 1, background: accent, opacity: 0.5,
        transformOrigin: 'left center', transform: `rotate(${Math.atan2(dy, dx)}rad) scaleX(${o})`,
      }} />
      <div style={{ position: 'absolute', left: dx + (dx < 0 ? -4 : 4), top: dy, transform: dx < 0 ? 'translateX(-100%)' : 'none', textAlign: dx < 0 ? 'right' : 'left', whiteSpace: 'nowrap' }}>
        <div style={{ fontFamily: DISP, fontSize: 22, fontWeight: 600, color: C.ink }}>{title}</div>
        <div style={{ fontFamily: MONO, fontSize: 14, color: C.dim, marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   BACKDROP — vignette + faint grid + scanline
   ───────────────────────────────────────────────────────────────────────── */
function Backdrop() {
  const t = useTime();
  const scan = (t * 60) % 1080;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg }} />
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
        backgroundSize: '60px 60px', opacity: 0.5,
        maskImage: 'radial-gradient(ellipse 75% 65% at 50% 45%, #000 30%, transparent 85%)',
        WebkitMaskImage: 'radial-gradient(ellipse 75% 65% at 50% 45%, #000 30%, transparent 85%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 60% 50% at 50% 42%, rgba(133,194,10,0.06), transparent 70%)',
      }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, top: scan, height: 2,
        background: 'linear-gradient(90deg, transparent, rgba(133,194,10,0.10), transparent)',
      }} />
      <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 240px rgba(0,0,0,0.7)' }} />
    </div>
  );
}

function ScreenLabel() {
  const t = useTime();
  const sec = Math.floor(t);
  React.useEffect(() => {
    const el = document.getElementById('vroot');
    if (el) el.setAttribute('data-screen-label', fmtClock(t));
  }, [sec]);
  return null;
}

// Persistent corner HUD
function Hud() {
  const t = useTime();
  return (
    <div style={{ position: 'absolute', top: 40, left: 120, display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 9, height: 9, borderRadius: 9, background: C.mig, boxShadow: `0 0 10px ${C.mig}` }} />
      <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: '0.22em', color: C.dim, textTransform: 'uppercase' }}>
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

/* ─────────────────────────────────────────────────────────────────────────
   SCENE FRAME — gates + crossfades a full-frame scene, passes localTime
   ───────────────────────────────────────────────────────────────────────── */
function SceneFrame({ start, end, fin = 0.6, fout = 0.6, children }) {
  return (
    <Sprite start={start} end={end}>
      {(s) => {
        const d = end - start;
        let o = 1;
        if (s.localTime < fin) o = Easing.easeOutCubic(clamp(s.localTime / fin, 0, 1));
        else if (s.localTime > d - fout) o = 1 - Easing.easeInCubic(clamp((s.localTime - (d - fout)) / fout, 0, 1));
        return <div style={{ position: 'absolute', inset: 0, opacity: o }}>{children(s.localTime, d)}</div>;
      }}
    </Sprite>
  );
}

// camera helper: returns transform string focusing world point at canvas center
function cam(focusX, focusY, zoom) {
  return `translate(${960 - focusX * zoom}px, ${540 - focusY * zoom}px) scale(${zoom})`;
}
function CamRig({ transform, children }) {
  return <div style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform, willChange: 'transform' }}>{children}</div>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCENE 0 — TITLE  (0 – 9)
   ═══════════════════════════════════════════════════════════════════════════ */
function S0_Title({ lt }) {
  const dieR = clamp(lt / 1.6, 0, 1);
  const dieO = clamp(lt / 1.0, 0, 1) * (lt > 6.4 ? clamp((7.6 - lt) / 1.2, 0, 1) : 1) * 0.8;
  const t1 = clamp((lt - 1.4) / 0.6, 0, 1);
  const t2 = clamp((lt - 2.1) / 0.6, 0, 1);
  const sub = clamp((lt - 3.0) / 0.8, 0, 1);
  const dieScale = interpolate([0, 2, 9], [0.86, 0.92, 1.0], Easing.easeOutCubic)(lt);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{
        position: 'absolute', left: 960, top: 470, transform: `translate(-50%,-50%) scale(${dieScale})`, opacity: dieO * 0.5,
        filter: 'blur(0.3px)',
      }}>
        <Die w={520} h={490} reveal={dieR} litCols={'none'} hideHeader label="GPU DIE" />
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, top: 372, textAlign: 'center' }}>
        <div style={{
          fontFamily: MONO, fontSize: 20, letterSpacing: '0.4em', textTransform: 'uppercase', color: C.mig,
          opacity: t1, transform: `translateY(${(1 - t1) * 10}px)`,
        }}>One GPU · Many Tenants</div>
        <div style={{
          fontFamily: DISP, fontWeight: 700, fontSize: 132, letterSpacing: '-0.03em', color: C.ink, lineHeight: 1,
          marginTop: 22, opacity: t2, transform: `translateY(${(1 - t2) * 18}px)`,
        }}>
          MIG <span style={{ color: C.faint, fontWeight: 400 }}>vs</span> <span style={{ color: C.vgpu }}>vGPU</span>
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 24, color: C.dim, marginTop: 26, opacity: sub,
          letterSpacing: '0.02em',
        }}>Two ways to share a datacenter GPU — and what's really happening inside the silicon.</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCENE 1 — GPU ANATOMY  (9 – 31)  build the die + annotate the 3 resources
   ═══════════════════════════════════════════════════════════════════════════ */
function S1_Anatomy({ lt }) {
  const reveal = clamp(lt / 2.6, 0, 1);
  // zoom: start mid, push in on field, then pull back
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
        {/* annotations appear after build */}
        <Annotation x={745} y={300} dx={-150} dy={-40} title="GPCs → SMs" sub="compute · streaming multiprocessors" lt={lt} delay={4.5} />
        <Annotation x={1175} y={470} dx={150} dy={-10} title="L2 cache + crossbar" sub="shared on-chip bandwidth" lt={lt} delay={6.0} />
        <Annotation x={1175} y={628} dx={150} dy={20} title="Memory controllers" sub="8 slices → HBM2e stacks" lt={lt} delay={7.5} />
      </CamRig>

      <Caption lt={lt} kicker="Anatomy of a datacenter GPU"
        title="Three resources decide how a GPU is shared."
        body={lt > 11 ? "Compute (GPCs full of SMs), the shared L2 cache + crossbar, and the memory controllers feeding HBM. MIG and vGPU each divide these three — very differently." : "Before you divide a GPU, know what's inside."} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCENE 2 — TWO PHILOSOPHIES  (31 – 41)
   ═══════════════════════════════════════════════════════════════════════════ */
function S2_Split({ lt }) {
  const split = clamp((lt - 0.3) / 1.1, 0, 1) * 360; // separation
  const e = Easing.easeInOutCubic(clamp((lt - 0.3) / 1.1, 0, 1));
  const sx = e * 360;
  const leftReveal = clamp((lt - 1.0) / 1.2, 0, 1);
  const rightReveal = clamp((lt - 1.0) / 1.2, 0, 1);
  const lblL = clamp((lt - 2.0) / 0.6, 0, 1);
  const lblR = clamp((lt - 2.4) / 0.6, 0, 1);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 600 - 0, top: 430, transform: `translate(-50%,-50%) translateX(${-sx}px)` }}>
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

      <Caption lt={lt} accent={C.ink}
        title="Same chip. Two philosophies."
        body="MIG partitions the GPU in space — dedicated hardware per tenant. vGPU partitions it in time — the whole GPU, scheduled across VMs. Let's open each one up." />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCENE 3 — MIG SPATIAL SLICING  (41 – 63)
   ═══════════════════════════════════════════════════════════════════════════ */
function S3_MigSlice({ lt }) {
  const dividers = clamp((lt - 2.5) / 2.0, 0, 1);
  // memory slices tint as they get assigned
  const memAssign = clamp((lt - 9) / 3.5, 0, 1);
  const memGroups = lt > 9 ? Array.from({ length: 8 }, (_, i) => {
    if (i === 7) return 'reserved';
    return (i / 7) <= memAssign ? C.mig : null;
  }) : null;
  // group outlines for 7 instances appear late
  const showGroups = lt > 13;
  const groups = showGroups ? Array.from({ length: 7 }, (_, i) => ({ cols: [i], color: C.mig, o: clamp((lt - 13 - i * 0.25) / 0.5, 0, 1) })) : null;
  const z = interpolate([0, 4, 22], [1.0, 1.06, 1.0], Easing.easeInOutSine)(lt);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <CamRig transform={cam(960, 430, z)}>
        <div style={{ position: 'absolute', left: 960, top: 430, transform: 'translate(-50%,-50%)' }}>
          <Die w={680} h={540} accent={C.mig} reveal={1} litCols={'all'} dividers={dividers} groups={groups} memGroups={memGroups} label="MIG · GA100" />
        </div>
      </CamRig>
      <div style={{ position: 'absolute', left: '50%', top: 96, transform: 'translateX(-50%)', display: 'flex', gap: 14, opacity: clamp((lt - 15) / 0.8, 0, 1) }}>
        <Chip accent={C.mig}>7 compute slices</Chip>
        <Chip accent={C.mig}>8 memory slices · 1 reserved</Chip>
        <Chip accent={C.mig}>hard-wired in hardware</Chip>
      </div>

      <Caption lt={lt} kicker="MIG · spatial partitioning" accent={C.mig}
        title={lt > 9 ? "Compute, cache and memory are hard-assigned." : "MIG slices the physical die."}
        body={lt > 9
          ? "Each GPU Instance gets dedicated SMs, its own L2 slices and its own memory controllers. The crossbar paths are partitioned too — these are real, electrically-isolated boundaries, not software quotas."
          : "On an A100, the silicon divides into 7 compute slices and 8 memory slices — fixed partitions etched across the GPCs and memory system."} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCENE 4 — MIG PROFILES  (63 – 82)
   ═══════════════════════════════════════════════════════════════════════════ */
function S4_Profiles({ lt }) {
  // Build a mixed layout: 3g.20gb (cols0-2) | 2g.10gb (cols3-4) | 1g.5gb | 1g.5gb
  const layout = [
    { cols: [0, 1, 2], label: '3g.20gb', t: 0.4 },
    { cols: [3, 4], label: '2g.10gb', t: 1.4 },
    { cols: [5], label: '1g.5gb', t: 2.4 },
    { cols: [6], label: '1g.5gb', t: 3.0 },
  ];
  const groups = layout.filter(g => lt > 5 + g.t).map(g => ({ cols: g.cols, label: g.label, color: C.mig, o: clamp((lt - 5 - g.t) / 0.5, 0, 1) }));
  const memGroups = lt > 5 ? (() => {
    // distribute memory blocks to profiles
    const map = [C.mig, C.mig, C.mig, C.mig, C.mig, C.mig, C.mig, 'reserved'];
    return map.map((c, i) => (i === 7 ? 'reserved' : (lt > 5.4 + i * 0.2 ? c : null)));
  })() : null;

  const dividers = 1;
  const profiles = ['1g.5gb', '1g.10gb', '2g.10gb', '3g.20gb', '4g.20gb', '7g.40gb'];
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 560, top: 446, transform: 'translate(-50%,-50%)' }}>
        <Die w={620} h={520} accent={C.mig} reveal={1} litCols={'all'} dividers={dividers} groups={groups} memGroups={memGroups} hideHeader label="MIG PROFILE LAYOUT" />
      </div>

      {/* profile menu on right */}
      <div style={{ position: 'absolute', right: 150, top: 250, width: 470, opacity: clamp((lt - 1.0) / 0.8, 0, 1) }}>
        <Kicker accent={C.mig} lt={lt}>Profile catalog · A100-40GB</Kicker>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 22 }}>
          {profiles.map((p, i) => {
            const o = clamp((lt - 1.6 - i * 0.18) / 0.4, 0, 1);
            const [g] = p.split('.');
            return (
              <div key={p} style={{
                fontFamily: MONO, fontSize: 20, padding: '14px 16px', borderRadius: 8,
                border: `1px solid ${C.migEdge}`, background: C.migSoft, color: C.ink,
                opacity: o, transform: `translateX(${(1 - o) * 16}px)`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontWeight: 600 }}>{p}</span>
                <span style={{ color: C.mig, fontSize: 14 }}>{g.replace('g', '')}/7</span>
              </div>
            );
          })}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 16, color: C.dim, marginTop: 20, lineHeight: 1.5, opacity: clamp((lt - 4) / 0.8, 0, 1) }}>
          <span style={{ color: C.mig }}>g</span> = compute slices (of 7) ·{' '}
          <span style={{ color: C.mig }}>gb</span> = framebuffer.<br />
          GPU Instance → <span style={{ color: C.mig }}>Compute Instances</span> subdivide SMs while sharing the instance's memory.
        </div>
      </div>

      <Caption lt={lt} kicker="MIG · fixed profiles" accent={C.mig}
        title="Profiles name the slice: 1g.5gb → 7g.40gb."
        body="Mix and match instances to fit the workload — here a 3g.20gb beside a 2g.10gb and two 1g.5gb. Each is a complete, independent GPU to CUDA." />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCENE 5 — MIG ISOLATION + QoS  (82 – 96)
   ═══════════════════════════════════════════════════════════════════════════ */
function S5_Isolation({ lt }) {
  const faultCol = 2;
  const faulting = lt > 3 && lt < 9.5;
  const groups = Array.from({ length: 4 }, (_, i) => {
    const spans = [[0, 1], [2], [3, 4], [5, 6]][i];
    return { cols: spans, label: ['GI-0', 'GI-1', 'GI-2', 'GI-3'][i], color: C.mig, fault: i === 1 && faulting };
  });
  // QoS bars per instance (guaranteed, steady)
  const qos = [0.28, 0.14, 0.29, 0.29];
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 600, top: 450, transform: 'translate(-50%,-50%)' }}>
        <Die w={580} h={500} accent={C.mig} reveal={1}
          litCols={faulting ? [0, 1, 3, 4, 5, 6] : 'all'}
          dividers={1} groups={groups} hideHeader label="MIG · 4 INSTANCES" />
      </div>

      {/* QoS panel */}
      <div style={{ position: 'absolute', right: 150, top: 300, width: 470, opacity: clamp((lt - 1) / 0.8, 0, 1) }}>
        <Kicker accent={C.mig} lt={lt}>Guaranteed QoS</Kicker>
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {qos.map((q, i) => {
            const o = clamp((lt - 1.6 - i * 0.2) / 0.4, 0, 1);
            const broken = i === 1 && faulting;
            return (
              <div key={i} style={{ opacity: o }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 15, color: broken ? C.red : C.dim, marginBottom: 6 }}>
                  <span>GI-{i} · dedicated BW + L2</span>
                  <span>{broken ? 'halted' : 'steady'}</span>
                </div>
                <div style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${q * 100 / 0.3 * 0.9}%`, height: '100%', borderRadius: 6, background: broken ? C.red : C.mig, boxShadow: `0 0 12px ${broken ? C.red : C.mig}77` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Caption lt={lt} kicker="MIG · fault isolation & QoS" accent={C.mig}
        title={faulting ? "A fault in GI-1 stays in GI-1." : "No noisy neighbors. Ever."}
        body="Because the partitions are physical, a memory error or fault in one instance can't corrupt or stall another. Bandwidth and L2 are reserved — performance is deterministic, not best-effort." />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCENE 6 — vGPU SR-IOV  (96 – 112)
   ═══════════════════════════════════════════════════════════════════════════ */
function S6_SRIOV({ lt }) {
  const reveal = 1;
  // memory carved into 4 equal framebuffers
  const memGroups = lt > 5 ? Array.from({ length: 8 }, (_, i) => [C.vgpu, C.vgpu, C.amber, C.amber, '#8b5cf6', '#8b5cf6', '#e879a6', '#e879a6'][i]) : null;
  const vmColors = [C.vgpu, C.amber, '#8b5cf6', '#e879a6'];
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 600, top: 392, transform: 'translate(-50%,-50%)' }}>
        <Die w={560} h={470} accent={C.vgpu} reveal={1} litCols={'all'} memGroups={memGroups} label="vGPU · GA100 (SR-IOV)" />
      </div>

      {/* hypervisor + VMs on the right */}
      <div style={{ position: 'absolute', right: 140, top: 250, width: 500 }}>
        <Kicker accent={C.vgpu} lt={lt}>SR-IOV · Ampere &amp; later</Kicker>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 22 }}>
          {['VM 0', 'VM 1', 'VM 2', 'VM 3'].map((vm, i) => {
            const o = clamp((lt - 2 - i * 0.3) / 0.5, 0, 1);
            return (
              <div key={vm} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 10,
                border: `1px solid ${vmColors[i]}`, background: `rgba(${hexToRgb(vmColors[i])},0.1)`,
                opacity: o, transform: `translateX(${(1 - o) * 24}px)`,
              }}>
                <span style={{ fontFamily: MONO, fontSize: 13, color: vmColors[i], padding: '3px 8px', border: `1px solid ${vmColors[i]}`, borderRadius: 5 }}>VF{i}</span>
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

      <Caption lt={lt} kicker="vGPU · SR-IOV virtual functions" accent={C.vgpu}
        title="The GPU advertises Virtual Functions — one per VM."
        body="On Ampere and later the vGPU Manager uses SR-IOV: each guest gets its own VF with isolated PCIe address space and DMA. Framebuffer is statically carved per C-series profile — memory is partitioned." />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCENE 7 — vGPU TIME-SLICING SCHEDULER  (112 – 134)   the key differentiator
   ═══════════════════════════════════════════════════════════════════════════ */
function S7_TimeSlice({ lt }) {
  const vmColors = [C.vgpu, C.amber, '#8b5cf6', '#e879a6'];
  const vmNames = ['VM 0', 'VM 1', 'VM 2', 'VM 3'];
  // active VM cycles every 1.1s after intro
  const cycle = 1.1;
  const activeIdx = lt > 3 ? Math.floor(((lt - 3) / cycle)) % 4 : 0;
  // whole field lit in active VM's color
  const memGroups = Array.from({ length: 8 }, (_, i) => [C.vgpu, C.vgpu, C.amber, C.amber, '#8b5cf6', '#8b5cf6', '#e879a6', '#e879a6'][i]);
  const sliceFrac = (((lt - 3) % cycle) / cycle);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 590, top: 392, transform: 'translate(-50%,-50%)' }}>
        <Die w={560} h={470} accent={C.vgpu} reveal={1} litCols={'all'} activeAccent={vmColors[activeIdx]} memGroups={memGroups} label="vGPU · TIME-SLICED COMPUTE" />
        {/* "owned by" banner */}
        <div style={{
          position: 'absolute', left: '50%', bottom: -64, transform: 'translateX(-50%)',
          fontFamily: MONO, fontSize: 18, letterSpacing: '0.04em', color: vmColors[activeIdx],
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ width: 10, height: 10, borderRadius: 10, background: vmColors[activeIdx], boxShadow: `0 0 12px ${vmColors[activeIdx]}` }} />
          entire SM array → {vmNames[activeIdx]}
        </div>
      </div>

      {/* time wheel / scheduler */}
      <div style={{ position: 'absolute', right: 250, top: 300, width: 360, opacity: clamp((lt - 1) / 0.8, 0, 1) }}>
        <Kicker accent={C.vgpu} lt={lt}>Time-slice scheduler</Kicker>
        <div style={{ position: 'relative', width: 300, height: 300, margin: '34px auto 0' }}>
          <svg width="300" height="300" viewBox="0 0 300 300" style={{ position: 'absolute', inset: 0 }}>
            {vmColors.map((c, i) => {
              const a0 = (i / 4) * Math.PI * 2 - Math.PI / 2;
              const a1 = ((i + 1) / 4) * Math.PI * 2 - Math.PI / 2;
              const r = 130, cx = 150, cy = 150;
              const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
              const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
              const isActive = i === activeIdx;
              return (
                <path key={i} d={`M${cx},${cy} L${x0},${y0} A${r},${r} 0 0,1 ${x1},${y1} Z`}
                  fill={`rgba(${hexToRgb(c)},${isActive ? 0.85 : 0.16})`}
                  stroke={c} strokeWidth={isActive ? 2.5 : 1} />
              );
            })}
            {/* rotating hand */}
            <line x1="150" y1="150"
              x2={150 + 128 * Math.cos((lt > 3 ? ((lt - 3) / cycle) % 4 / 4 : 0) * Math.PI * 2 - Math.PI / 2 + (sliceFrac / 4) * Math.PI * 2)}
              y2={150 + 128 * Math.sin((lt > 3 ? ((lt - 3) / cycle) % 4 / 4 : 0) * Math.PI * 2 - Math.PI / 2 + (sliceFrac / 4) * Math.PI * 2)}
              stroke="#fff" strokeWidth="3" strokeLinecap="round" />
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

      <Caption lt={lt} kicker="vGPU · temporal partitioning" accent={C.vgpu}
        title="The whole GPU is handed to each VM, in turn."
        body="Compute isn't carved in space — it's shared in time. The scheduler grants the entire SM array to one VM per quantum, then rotates. Best-effort, equal-share or fixed-share policies tune the QoS." />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCENE 8 — vGPU ISOLATION NOTE  (134 – 144)
   ═══════════════════════════════════════════════════════════════════════════ */
function S8_VgpuIso({ lt }) {
  const hang = lt > 3 && lt < 8;
  const vmColors = [C.vgpu, C.amber, '#8b5cf6', '#e879a6'];
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
          <IsoRow ok label="Memory" note="static framebuffer · isolated" color={C.vgpu} lt={lt} d={1.6} />
          <IsoRow ok label="PCIe / DMA" note="SR-IOV VF · isolated" color={C.vgpu} lt={lt} d={1.9} />
          <IsoRow ok={false} label="Compute fault" note="time-shared · no spatial isolation" color={C.red} lt={lt} d={2.2} />
        </div>
      </div>

      <Caption lt={lt} kicker="vGPU · the trade-off" accent={C.vgpu}
        title="Memory is isolated. Compute is shared."
        body="SR-IOV isolates each VM's framebuffer and DMA — but compute lives on a shared scheduler. A hung or runaway context can stall the queue. There's no hardware fault containment like MIG." />
    </div>
  );
}
function IsoRow({ ok, label, note, color, lt, d }) {
  const o = clamp((lt - d) / 0.5, 0, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: o, transform: `translateX(${(1 - o) * 18}px)` }}>
      <div style={{
        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
        border: `1.5px solid ${ok ? C.vgpu : C.red}`, background: `rgba(${hexToRgb(ok ? C.vgpu : C.red)},0.14)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: MONO, fontSize: 18, color: ok ? C.vgpu : C.red, fontWeight: 700,
      }}>{ok ? '✓' : '!'}</div>
      <div>
        <div style={{ fontFamily: DISP, fontSize: 22, fontWeight: 600, color: C.ink }}>{label}</div>
        <div style={{ fontFamily: MONO, fontSize: 15, color: C.dim, marginTop: 1 }}>{note}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCENE 9 — COMPARISON MATRIX  (144 – 166)
   ═══════════════════════════════════════════════════════════════════════════ */
function S9_Compare({ lt }) {
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
        {/* header */}
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 1fr', gap: 18, marginBottom: 14, opacity: clamp((lt - 0.4) / 0.5, 0, 1) }}>
          <div />
          <ColHead name="MIG" tag="spatial" color={C.mig} />
          <ColHead name="vGPU" tag="temporal" color={C.vgpu} />
        </div>
        {rows.map((r, i) => {
          const o = clamp((lt - 1.0 - i * 0.28) / 0.5, 0, 1);
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '300px 1fr 1fr', gap: 18, alignItems: 'stretch',
              marginBottom: 10, opacity: o, transform: `translateY(${(1 - o) * 14}px)`,
            }}>
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
function ColHead({ name, tag, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '0 22px' }}>
      <span style={{ fontFamily: DISP, fontSize: 32, fontWeight: 700, color }}>{name}</span>
      <span style={{ fontFamily: MONO, fontSize: 15, color: C.dim, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{tag}</span>
    </div>
  );
}
function Cell({ children, color }) {
  return (
    <div style={{
      fontFamily: MONO, fontSize: 18, color: C.ink, padding: '14px 22px', borderRadius: 10,
      border: `1px solid rgba(${hexToRgb(color)},0.3)`, background: `rgba(${hexToRgb(color)},0.07)`,
      display: 'flex', alignItems: 'center', lineHeight: 1.4,
    }}>{children}</div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCENE 10 — MIG-BACKED vGPU + MPS  (166 – 180)
   ═══════════════════════════════════════════════════════════════════════════ */
function S10_Combine({ lt }) {
  const stackO = clamp((lt - 0.5) / 1.0, 0, 1);
  const vmO = clamp((lt - 2.0) / 0.8, 0, 1);
  const mpsO = clamp((lt - 5.0) / 0.8, 0, 1);
  return (
    <div style={{ position: 'absolute', inset: 0, paddingTop: 130 }}>
      <div style={{ textAlign: 'center' }}>
        <Kicker accent={C.ink} lt={lt}><span style={{ margin: '0 auto' }}>They compose</span></Kicker>
        <div style={{ fontFamily: DISP, fontSize: 44, fontWeight: 700, color: C.ink, marginTop: 18, letterSpacing: '-0.02em' }}>
          Not either/or — <span style={{ color: C.mig }}>MIG</span>-backed <span style={{ color: C.vgpu }}>vGPU</span>
        </div>
      </div>

      {/* layered stack diagram */}
      <div style={{ position: 'absolute', left: 480, top: 380, transform: 'translate(-50%,0)', width: 560, opacity: stackO }}>
        <div style={{ position: 'relative' }}>
          {/* MIG slice */}
          <div style={{
            border: `1.5px solid ${C.mig}`, borderRadius: 14, padding: 18, background: C.migSoft,
            boxShadow: `0 0 30px ${C.mig}33`,
          }}>
            <div style={{ fontFamily: MONO, fontSize: 15, color: C.mig, letterSpacing: '0.1em', marginBottom: 12 }}>MIG INSTANCE · 3g.20gb</div>
            <Die w={520} h={240} accent={C.mig} reveal={1} litCols={[0, 1, 2]} label="" />
          </div>
          {/* VM badge on top */}
          <div style={{
            position: 'absolute', right: -30, top: -30, opacity: vmO,
            border: `1.5px solid ${C.vgpu}`, borderRadius: 12, padding: '14px 20px',
            background: `rgba(${hexToRgb(C.vgpu)},0.12)`, backdropFilter: 'blur(6px)',
          }}>
            <div style={{ fontFamily: DISP, fontSize: 22, fontWeight: 600, color: C.ink }}>Guest VM</div>
            <div style={{ fontFamily: MONO, fontSize: 14, color: C.vgpu, marginTop: 2 }}>SR-IOV VF → MIG slice</div>
          </div>
        </div>
      </div>

      {/* MPS aside */}
      <div style={{ position: 'absolute', right: 150, top: 380, width: 440, opacity: mpsO }}>
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, padding: '24px 26px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: '0.18em', color: C.amber, marginBottom: 12 }}>FOOTNOTE · MPS</div>
          <div style={{ fontFamily: DISP, fontSize: 26, fontWeight: 600, color: C.ink, lineHeight: 1.2 }}>Multi-Process Service</div>
          <div style={{ fontFamily: MONO, fontSize: 16, color: C.dim, marginTop: 14, lineHeight: 1.55 }}>
            Cooperative spatial sharing inside <span style={{ color: C.ink }}>one</span> process space — many CUDA contexts, merged. Lower switch cost than time-slicing, but <span style={{ color: C.amber }}>no memory protection, no QoS</span>.
          </div>
        </div>
      </div>

      <Caption lt={lt} accent={C.ink}
        title={lt > 3 ? "Spatial guarantees + full VM isolation." : "Stack them together."}
        body="Run a vGPU on top of a MIG instance and you get hardware partitioning and per-VM isolation at once — the common pattern for secure, guaranteed multi-tenant GPU clouds." />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCENE 11 — CLOSING  (180 – 188)
   ═══════════════════════════════════════════════════════════════════════════ */
function S11_Close({ lt }) {
  const o1 = clamp((lt - 0.4) / 0.8, 0, 1);
  const o2 = clamp((lt - 1.4) / 0.8, 0, 1);
  const o3 = clamp((lt - 2.6) / 0.9, 0, 1);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 28, opacity: o1, marginBottom: 56 }}>
        <Die w={300} h={250} accent={C.mig} reveal={1} litCols={'all'} dividers={1} hideHeader label="MIG · SPATIAL" />
        <Die w={300} h={250} accent={C.vgpu} reveal={1} litCols={'all'} hideHeader label="vGPU · TEMPORAL" />
      </div>
      <div style={{ fontFamily: DISP, fontSize: 52, fontWeight: 700, color: C.ink, letterSpacing: '-0.02em', textAlign: 'center', opacity: o2, lineHeight: 1.12, whiteSpace: 'nowrap' }}>
        Carve the silicon, <span style={{ color: C.mig }}>or</span> share the clock.
      </div>
      <div style={{ fontFamily: MONO, fontSize: 22, color: C.dim, marginTop: 36, opacity: o3, letterSpacing: '0.02em' }}>
        Now you know what's happening inside the GPU.
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   STAGE (engine) — copied from starter
   ───────────────────────────────────────────────────────────────────────── */
function Stage({ width = 1280, height = 720, duration = 10, background = '#0a0a0a', loop = true, autoplay = true, persistKey = 'animstage', children }) {
  const [time, setTime] = React.useState(() => {
    try { const v = parseFloat(localStorage.getItem(persistKey + ':t') || '0'); return isFinite(v) ? clamp(v, 0, duration) : 0; } catch { return 0; }
  });
  const [playing, setPlaying] = React.useState(autoplay);
  const [hoverTime, setHoverTime] = React.useState(null);
  const [scale, setScale] = React.useState(1);
  const stageRef = React.useRef(null); const rafRef = React.useRef(null); const lastTsRef = React.useRef(null);
  React.useEffect(() => { try { localStorage.setItem(persistKey + ':t', String(time)); } catch {} }, [time, persistKey]);
  React.useEffect(() => {
    if (!stageRef.current) return; const el = stageRef.current;
    const measure = () => { const barH = 44; const s = Math.min(el.clientWidth / width, (el.clientHeight - barH) / height); setScale(Math.max(0.05, s)); };
    measure(); const ro = new ResizeObserver(measure); ro.observe(el); window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [width, height]);
  React.useEffect(() => {
    if (!playing) { lastTsRef.current = null; return; }
    const step = (ts) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000; lastTsRef.current = ts;
      setTime((t) => { let next = t + dt; if (next >= duration) { if (loop) next = next % duration; else { next = duration; setPlaying(false); } } return next; });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); lastTsRef.current = null; };
  }, [playing, duration, loop]);
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') { e.preventDefault(); setPlaying(p => !p); }
      else if (e.code === 'ArrowLeft') { setTime(t => clamp(t - (e.shiftKey ? 5 : 0.5), 0, duration)); }
      else if (e.code === 'ArrowRight') { setTime(t => clamp(t + (e.shiftKey ? 5 : 0.5), 0, duration)); }
      else if (e.key === '0' || e.code === 'Home') { setTime(0); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [duration]);
  const displayTime = hoverTime != null ? hoverTime : time;
  React.useEffect(() => { window.__seek = (t) => { setPlaying(false); setTime(clamp(t, 0, duration)); }; }, [duration]);
  const ctxValue = React.useMemo(() => ({ time: displayTime, duration, playing, setTime, setPlaying }), [displayTime, duration, playing]);
  return (
    <div ref={stageRef} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#050708', fontFamily: DISP }}>
      <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ width, height, background, position: 'relative', transform: `scale(${scale})`, transformOrigin: 'center', flexShrink: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
          <TimelineContext.Provider value={ctxValue}>{children}</TimelineContext.Provider>
        </div>
      </div>
      <PlaybackBar time={displayTime} duration={duration} playing={playing} onPlayPause={() => setPlaying(p => !p)} onReset={() => setTime(0)} onSeek={(t) => setTime(t)} onHover={(t) => setHoverTime(t)} />
    </div>
  );
}
function PlaybackBar({ time, duration, playing, onPlayPause, onReset, onSeek, onHover }) {
  const trackRef = React.useRef(null); const [dragging, setDragging] = React.useState(false);
  const timeFromEvent = React.useCallback((e) => { const rect = trackRef.current.getBoundingClientRect(); const x = clamp((e.clientX - rect.left) / rect.width, 0, 1); return x * duration; }, [duration]);
  const onTrackMove = (e) => { if (!trackRef.current) return; const t = timeFromEvent(e); if (dragging) onSeek(t); else onHover(t); };
  const onTrackLeave = () => { if (!dragging) onHover(null); };
  const onTrackDown = (e) => { setDragging(true); onSeek(timeFromEvent(e)); onHover(null); };
  React.useEffect(() => {
    if (!dragging) return; const onUp = () => setDragging(false);
    const onMove = (e) => { if (!trackRef.current) return; onSeek(timeFromEvent(e)); };
    window.addEventListener('mouseup', onUp); window.addEventListener('mousemove', onMove);
    return () => { window.removeEventListener('mouseup', onUp); window.removeEventListener('mousemove', onMove); };
  }, [dragging, timeFromEvent, onSeek]);
  const pct = duration > 0 ? (time / duration) * 100 : 0;
  const fmt = (t) => { const total = Math.max(0, t); const m = Math.floor(total / 60); const s = Math.floor(total % 60); const cs = Math.floor((total * 100) % 100); return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`; };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: 'rgba(12,16,14,0.94)', borderTop: '1px solid rgba(255,255,255,0.08)', width: '100%', maxWidth: 760, alignSelf: 'center', borderRadius: 8, color: C.ink, fontFamily: DISP, userSelect: 'none', flexShrink: 0 }}>
      <IconButton onClick={onReset} title="Return to start (0)"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2v10M12 2L5 7l7 5V2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg></IconButton>
      <IconButton onClick={onPlayPause} title="Play/pause (space)">{playing ? <svg width="14" height="14" viewBox="0 0 14 14"><rect x="3" y="2" width="3" height="10" fill="currentColor" /><rect x="8" y="2" width="3" height="10" fill="currentColor" /></svg> : <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 2l9 5-9 5V2z" fill="currentColor" /></svg>}</IconButton>
      <div style={{ fontFamily: MONO, fontSize: 12, fontVariantNumeric: 'tabular-nums', width: 70, textAlign: 'right', color: C.ink }}>{fmt(time)}</div>
      <div ref={trackRef} onMouseMove={onTrackMove} onMouseLeave={onTrackLeave} onMouseDown={onTrackDown} style={{ flex: 1, height: 22, position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2 }} />
        <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 4, background: C.mig, borderRadius: 2 }} />
        <div style={{ position: 'absolute', left: `${pct}%`, top: '50%', width: 12, height: 12, marginLeft: -6, marginTop: -6, background: '#fff', borderRadius: 6, boxShadow: '0 2px 4px rgba(0,0,0,0.4)' }} />
      </div>
      <div style={{ fontFamily: MONO, fontSize: 12, fontVariantNumeric: 'tabular-nums', width: 70, textAlign: 'left', color: C.faint }}>{fmt(duration)}</div>
    </div>
  );
}
function IconButton({ children, onClick, title }) {
  const [hover, setHover] = React.useState(false);
  return <button onClick={onClick} title={title} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: hover ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: C.ink, cursor: 'pointer', padding: 0 }}>{children}</button>;
}

/* ─────────────────────────────────────────────────────────────────────────
   ROOT FILM
   ───────────────────────────────────────────────────────────────────────── */
function MIGvGPUFilm() {
  return (
    <Stage width={1920} height={1080} duration={188} background={C.bg} persistKey="migvgpu">
      <Backdrop />
      <ScreenLabel />
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

module.exports = { MIGvGPUFilm };
