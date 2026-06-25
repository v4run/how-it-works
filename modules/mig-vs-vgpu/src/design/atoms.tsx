// Reusable presentational atoms — ported from the prototype.
import React from 'react';
import { C, MONO, DISP, hexToRgb } from './theme';
import { clamp } from '../engine/anim';

export function Kicker({
  children,
  accent = C.mig,
  delay = 0,
  lt = 0,
}: {
  children: React.ReactNode;
  accent?: string;
  delay?: number;
  lt?: number;
}) {
  const o = clamp((lt - delay) / 0.4, 0, 1);
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 18,
        letterSpacing: '0.32em',
        textTransform: 'uppercase',
        color: accent,
        opacity: o,
        transform: `translateY(${(1 - o) * 8}px)`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span style={{ width: 26, height: 1, background: accent, display: 'inline-block', opacity: 0.7 }} />
      {children}
    </div>
  );
}

// Lower-third caption (the "VO line").
export function Caption({
  lt = 99,
  kicker,
  title,
  body,
  accent = C.mig,
}: {
  lt?: number;
  kicker?: React.ReactNode;
  title?: React.ReactNode;
  body?: React.ReactNode;
  accent?: string;
}) {
  const tO = clamp((lt - 0.15) / 0.5, 0, 1);
  const bO = clamp((lt - 0.45) / 0.6, 0, 1);
  return (
    <div style={{ position: 'absolute', left: 120, bottom: 92, maxWidth: 1180 }}>
      {kicker ? (
        <div style={{ marginBottom: 16 }}>
          <Kicker accent={accent} lt={lt}>
            {kicker}
          </Kicker>
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 20, alignItems: 'stretch' }}>
        <div style={{ width: 4, background: accent, borderRadius: 2, opacity: tO, boxShadow: `0 0 18px ${accent}66` }} />
        <div>
          {title ? (
            <div
              style={{
                fontFamily: DISP,
                fontSize: 46,
                fontWeight: 600,
                color: C.ink,
                lineHeight: 1.08,
                letterSpacing: '-0.01em',
                opacity: tO,
                transform: `translateY(${(1 - tO) * 14}px)`,
              }}
            >
              {title}
            </div>
          ) : null}
          {body ? (
            <div
              style={{
                fontFamily: MONO,
                fontSize: 21,
                color: C.dim,
                lineHeight: 1.55,
                marginTop: 14,
                maxWidth: 980,
                opacity: bO,
                transform: `translateY(${(1 - bO) * 10}px)`,
              }}
            >
              {body}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function Chip({
  children,
  accent = C.mig,
  filled = false,
  style,
}: {
  children: React.ReactNode;
  accent?: string;
  filled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 16,
        letterSpacing: '0.02em',
        padding: '6px 12px',
        borderRadius: 6,
        border: `1px solid ${accent}`,
        background: filled ? accent : 'transparent',
        color: filled ? '#0a0f08' : accent,
        whiteSpace: 'nowrap',
        fontWeight: filled ? 600 : 400,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// Leader-line annotation used in the anatomy scene.
export function Annotation({
  x,
  y,
  dx,
  dy,
  accent = C.mig,
  title,
  sub,
  lt = 0,
  delay = 0,
}: {
  x: number;
  y: number;
  dx: number;
  dy: number;
  accent?: string;
  title: string;
  sub: string;
  lt?: number;
  delay?: number;
}) {
  const o = clamp((lt - delay) / 0.5, 0, 1);
  const len = Math.hypot(dx, dy);
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity: o }}>
      <div
        style={{
          position: 'absolute',
          width: 8,
          height: 8,
          borderRadius: 8,
          background: accent,
          left: -4,
          top: -4,
          boxShadow: `0 0 12px ${accent}`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: len,
          height: 1,
          background: accent,
          opacity: 0.5,
          transformOrigin: 'left center',
          transform: `rotate(${Math.atan2(dy, dx)}rad) scaleX(${o})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: dx + (dx < 0 ? -4 : 4),
          top: dy,
          transform: dx < 0 ? 'translateX(-100%)' : 'none',
          textAlign: dx < 0 ? 'right' : 'left',
          whiteSpace: 'nowrap',
        }}
      >
        <div style={{ fontFamily: DISP, fontSize: 22, fontWeight: 600, color: C.ink }}>{title}</div>
        <div style={{ fontFamily: MONO, fontSize: 14, color: C.dim, marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

// Static grid backdrop (no animated scanline) for the lab.
export function GridBackdrop() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
          opacity: 0.5,
          maskImage: 'radial-gradient(ellipse 90% 80% at 50% 40%, #000 30%, transparent 90%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 80% at 50% 40%, #000 30%, transparent 90%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(133,194,10,0.05), transparent 70%)',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 240px rgba(0,0,0,0.7)' }} />
    </div>
  );
}

// Scales its child down to fit the available area (never up past `max`), keeping
// it centered. Avoids the flexbox "centered overflow clips the top" scroll trap.
export function FitBox({ children, max = 1, padding = 28 }: { children: React.ReactNode; max?: number; padding?: number }) {
  const outer = React.useRef<HTMLDivElement>(null);
  const inner = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  React.useLayoutEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return;
      const ow = outer.current.clientWidth - padding * 2;
      const oh = outer.current.clientHeight - padding * 2;
      const iw = inner.current.offsetWidth;
      const ih = inner.current.offsetHeight;
      if (iw === 0 || ih === 0) return;
      setScale(Math.max(0.2, Math.min(max, ow / iw, oh / ih)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (outer.current) ro.observe(outer.current);
    if (inner.current) ro.observe(inner.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [max, padding]);
  return (
    <div ref={outer} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div ref={inner} style={{ transform: `scale(${scale})`, transformOrigin: 'center', flexShrink: 0 }}>
        {children}
      </div>
    </div>
  );
}

// Generic button used throughout the lab UI.
export function Button({
  children,
  onClick,
  accent = C.mig,
  filled = false,
  disabled = false,
  small = false,
  title,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  accent?: string;
  filled?: boolean;
  disabled?: boolean;
  small?: boolean;
  title?: string;
  style?: React.CSSProperties;
}) {
  const [hover, setHover] = React.useState(false);
  // Accents may be hex or already-rgba (e.g. C.dim); only hex can be alpha-wrapped.
  const isHex = accent.startsWith('#');
  const fill = (a: number) => (isHex ? `rgba(${hexToRgb(accent)},${a})` : `rgba(255,255,255,${a})`);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: MONO,
        fontSize: small ? 13 : 15,
        letterSpacing: '0.02em',
        padding: small ? '6px 10px' : '9px 14px',
        borderRadius: 8,
        border: `1px solid ${disabled ? C.line : accent}`,
        background: disabled ? 'rgba(255,255,255,0.02)' : filled ? accent : hover ? fill(0.16) : fill(0.08),
        color: disabled ? C.faint : filled ? '#06100a' : accent,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: filled ? 600 : 500,
        whiteSpace: 'nowrap',
        transition: 'background 0.12s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
