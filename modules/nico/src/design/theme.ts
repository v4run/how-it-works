// Design tokens — ported from the Claude Design prototype (nico-film.jsx).
// Dark "datacenter" theme for NVIDIA Infra Controller (NICo): NVIDIA green for
// the control plane, distinct hues per tenant.

export const C = {
  bg: '#070a08',
  panel: '#0d120e',
  panel2: '#10160f',
  ink: '#e9ede7',
  dim: 'rgba(214,226,210,0.58)',
  faint: 'rgba(214,226,210,0.34)',
  line: 'rgba(255,255,255,0.08)',
  lineSoft: 'rgba(255,255,255,0.05)',
  green: '#76B900', // NVIDIA signature — the control plane / NICo
  greenHi: '#9fe025',
  greenSoft: 'rgba(118,185,0,0.14)',
  greenEdge: 'rgba(118,185,0,0.45)',
  red: '#e2533d',
  amber: '#f2a93b',
  steel: '#9fb0a0', // opaque neutral for secondary controls (readable on dark)
};

export const MONO = "'IBM Plex Mono', ui-monospace, monospace";
export const DISP = "'Space Grotesk', system-ui, sans-serif";
export const UI = "'IBM Plex Sans', system-ui, sans-serif";

// Per-tenant palette. First three match the film's tenant hues.
export const TENANT_COLORS = ['#76B900', '#34d1c4', '#c98bff', '#f2a93b', '#e879a6'];

export const fmtClock = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

export function hexToRgb(hex: string): string {
  if (hex.startsWith('rgb')) return hex;
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
