// Design tokens — ported from the Claude Design prototype (metallb-scene.jsx).
// NVIDIA-style signature green on near-black. Cyan = control plane (controller /
// BGP peering), amber = ARP / transient / warning, red = failure.

export const C = {
  bg: '#0a0a0a',
  panel: '#121212',
  panel2: '#0e0e0e',
  panelHi: '#181818',

  ink: '#f4f4f5', // primary text (a.k.a. "txt" in the film)
  dim: '#9a9a9a',
  faint: '#646464',

  line: 'rgba(255,255,255,0.10)',
  line2: 'rgba(255,255,255,0.06)',

  green: '#76B900',
  greenLite: '#a4e021',
  greenSoft: 'rgba(118,185,0,0.16)',
  greenLine: 'rgba(118,185,0,0.55)',
  greenEdge: 'rgba(118,185,0,0.45)',
  greenGlow: 'rgba(118,185,0,0.30)',

  red: '#ff5252',
  redSoft: 'rgba(255,82,82,0.14)',
  amber: '#ffb84d',
  amberSoft: 'rgba(255,184,77,0.14)',
  cyan: '#5cc8ff',
  cyanSoft: 'rgba(92,200,255,0.12)',
};

export const MONO = "'JetBrains Mono', ui-monospace, monospace";
export const DISP = "'Space Grotesk', system-ui, sans-serif";
export const UI = "'Space Grotesk', system-ui, sans-serif";

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
