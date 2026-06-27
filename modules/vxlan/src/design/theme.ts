// Design tokens — ported from the Claude Design prototype (vxlan-video.jsx).
// Dark fabric theme: NVIDIA green = the overlay / VXLAN, steel-blue = the
// physical underlay fabric, amber = flood / legacy / warning.

export const C = {
  bg: '#0a0a0a',
  panel: '#151516',
  panel2: '#1b1b1d',
  panelHi: '#222226',

  ink: '#f3f3f0', // primary text (a.k.a. "text" in the film)
  dim: '#8f8f8a',
  faint: '#5b5b56',

  line: 'rgba(255,255,255,0.10)',
  lineStrong: 'rgba(255,255,255,0.20)',

  // overlay / VXLAN / control plane
  green: '#76B900',
  greenHi: '#9fe025',
  greenSoft: 'rgba(118,185,0,0.14)',
  greenLine: 'rgba(118,185,0,0.55)',
  greenEdge: 'rgba(118,185,0,0.45)',
  greenGlow: 'rgba(118,185,0,0.35)',

  // underlay / physical fabric
  steel: '#6f93b8',
  steelSoft: 'rgba(111,147,184,0.14)',
  steelLine: 'rgba(111,147,184,0.5)',

  // flood / legacy / warning
  amber: '#d6953f',
  amberSoft: 'rgba(214,149,63,0.14)',
  amberLine: 'rgba(214,149,63,0.5)',

  red: '#cf5b43',
};

export const MONO = "'IBM Plex Mono', ui-monospace, monospace";
export const DISP = "'Space Grotesk', system-ui, sans-serif";
export const UI = "'IBM Plex Sans', system-ui, sans-serif";

// Per-segment (VNI) palette — distinct hues so virtual L2 domains read apart.
export const SEGMENT_COLORS = ['#76B900', '#34d1c4', '#c98bff', '#f2a93b', '#e879a6'];

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
