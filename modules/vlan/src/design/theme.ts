// Design tokens — ported from the Claude Design prototype (vlan-scene.jsx).
// Per-VLAN colour code: VLAN 10 green (Engineering), 20 amber (Finance),
// 30 cyan (Guest). Steel = infrastructure (switches, trunks), red = failure.

export const C = {
  bg: '#0a0c0e',
  panel: '#12161a',
  panel2: '#171c21',
  panelHi: '#1b2127',

  ink: '#e8ece8', // primary text ("text" in the film)
  dim: '#7c8892',
  faint: '#525c66',

  line: 'rgba(255,255,255,0.08)',
  line2: 'rgba(255,255,255,0.05)',

  steel: '#4a525c',
  steelDim: '#333b43',

  green: '#76b900',
  greenEdge: 'rgba(118,185,0,0.5)',
  greenSoft: 'rgba(118,185,0,0.14)',
  amber: '#f2b01e',
  amberSoft: 'rgba(242,176,30,0.14)',
  cyan: '#2dd4bf',
  cyanSoft: 'rgba(45,212,191,0.14)',
  violet: '#a78bfa',
  red: '#ff5a52',
  redSoft: 'rgba(255,90,82,0.14)',
};

export const MONO = "'JetBrains Mono', ui-monospace, monospace";
export const DISP = "'Space Grotesk', system-ui, sans-serif";
export const UI = "'Space Grotesk', system-ui, sans-serif";

// The three VLANs used across the film and the lab.
export interface VlanDef {
  id: number;
  c: string;
  name: string;
  subnet: string;
  gw: string;
}
export const VLANS: Record<number, VlanDef> = {
  10: { id: 10, c: C.green, name: 'Engineering', subnet: '10.0.1.0/24', gw: '10.0.1.1' },
  20: { id: 20, c: C.amber, name: 'Finance', subnet: '10.0.2.0/24', gw: '10.0.2.1' },
  30: { id: 30, c: C.cyan, name: 'Guest', subnet: '10.0.3.0/24', gw: '10.0.3.1' },
};
export const VLAN_IDS = [10, 20, 30];
export const vlanColor = (id: number | null): string => (id != null && VLANS[id] ? VLANS[id].c : C.steel);
export const vlanName = (id: number | null): string => (id != null && VLANS[id] ? VLANS[id].name : '—');

export function hexToRgb(hex: string): string {
  if (hex.startsWith('rgb')) return hex;
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

export const fmtClock = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};
