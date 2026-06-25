// Design tokens — ported verbatim from the Claude Design prototype (MIGvGPUFilm.jsx).
// Dark "datacenter" theme: NVIDIA green for MIG (spatial), teal for vGPU (temporal).

export const C = {
  bg: '#070b0c',
  ink: '#eaf1e6',
  dim: 'rgba(214,226,210,0.58)',
  faint: 'rgba(214,226,210,0.34)',
  line: 'rgba(150,180,140,0.16)',
  mig: '#85c20a', // NVIDIA green — MIG
  migSoft: 'rgba(133,194,10,0.16)',
  migEdge: 'rgba(133,194,10,0.42)',
  vgpu: '#21d3c9', // teal — vGPU
  vgpuSoft: 'rgba(33,211,201,0.15)',
  vgpuEdge: 'rgba(33,211,201,0.42)',
  red: '#ff5a52',
  amber: '#f2b134',
  steel: '#9fb0a0', // opaque neutral for secondary controls (readable on dark)
} as const;

export const MONO = "'IBM Plex Mono', ui-monospace, monospace";
export const DISP = "'Space Grotesk', system-ui, sans-serif";

// Per-VM palette used for time-sliced vGPU tenants.
export const VM_COLORS = [C.vgpu, C.amber, '#8b5cf6', '#e879a6', '#5eead4', '#fb923c'];

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
