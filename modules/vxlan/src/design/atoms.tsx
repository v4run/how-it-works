// Reusable presentational atoms for the lab UI.
import React from 'react';
import { C, MONO, DISP, hexToRgb } from './theme';

export function Chip({
  children,
  accent = C.green,
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
        fontSize: 12,
        letterSpacing: '0.04em',
        padding: '4px 9px',
        borderRadius: 6,
        border: `1px solid ${accent}${filled ? '' : '66'}`,
        background: filled ? accent : 'transparent',
        color: filled ? '#0a0a0a' : accent,
        whiteSpace: 'nowrap',
        fontWeight: filled ? 600 : 400,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// Static grid backdrop for the lab stage.
export function GridBackdrop() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(${C.line} 1px, transparent 1px)`,
          backgroundSize: '46px 46px',
          opacity: 0.45,
          maskImage: 'radial-gradient(ellipse 92% 84% at 50% 42%, #000 30%, transparent 92%)',
          WebkitMaskImage: 'radial-gradient(ellipse 92% 84% at 50% 42%, #000 30%, transparent 92%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 70% 55% at 50% 38%, rgba(118,185,0,0.05), transparent 70%)',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 240px rgba(0,0,0,0.7)' }} />
    </div>
  );
}

// Scales its child to fit the available area (never up past `max`), centered.
export function FitBox({ children, max = 1, padding = 24 }: { children: React.ReactNode; max?: number; padding?: number }) {
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
  accent = C.green,
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
        fontSize: small ? 12.5 : 14,
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

// Labeled on/off toggle switch.
export function Toggle({
  on,
  onChange,
  accent = C.green,
  label,
  sub,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  accent?: string;
  label: string;
  sub?: string;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        width: '100%',
        padding: '9px 11px',
        borderRadius: 9,
        border: `1px solid ${on ? accent : C.line}`,
        background: on ? `rgba(${hexToRgb(accent)},0.1)` : 'rgba(255,255,255,0.02)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.12s, border-color 0.12s',
      }}
    >
      <span
        style={{
          width: 34,
          height: 19,
          borderRadius: 12,
          background: on ? accent : 'rgba(255,255,255,0.14)',
          position: 'relative',
          flexShrink: 0,
          transition: 'background 0.14s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 17 : 2,
            width: 15,
            height: 15,
            borderRadius: 9,
            background: '#0a0a0a',
            transition: 'left 0.14s',
          }}
        />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: DISP, fontSize: 14, fontWeight: 600, color: C.ink }}>{label}</span>
        {sub && <span style={{ display: 'block', fontFamily: MONO, fontSize: 11, color: C.faint, marginTop: 1 }}>{sub}</span>}
      </span>
    </button>
  );
}

// Section heading inside the control plane.
export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.green }}>{title}</span>
        {hint && <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
