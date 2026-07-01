// MetalLB — comprehensive animated explainer (NVIDIA aesthetic)
// Reads Stage, Sprite, useSprite, useTime, Easing, clamp, interpolate from window (animations.jsx).
//
// Original Claude Design prototype source, preserved for provenance. The film is
// ported to TypeScript on the project's shared engine in ../src/film/Film.tsx.

const C = {
  green:'#76B900', greenLite:'#a4e021', greenDim:'rgba(118,185,0,0.16)',
  bg:'#0a0a0a', panel:'#121212', panel2:'#0e0e0e',
  line:'rgba(255,255,255,0.10)', line2:'rgba(255,255,255,0.06)',
  txt:'#f4f4f5', mut:'#9a9a9a', mut2:'#646464',
  red:'#ff5252', redDim:'rgba(255,82,82,0.14)',
  amber:'#ffb84d', cyan:'#5cc8ff',
  mono:"'JetBrains Mono', ui-monospace, monospace",
  disp:"'Space Grotesk', system-ui, sans-serif",
};

// ── path helpers ────────────────────────────────────────────────
function plen(p){let L=0;for(let i=1;i<p.length;i++)L+=Math.hypot(p[i].x-p[i-1].x,p[i].y-p[i-1].y);return L;}
function pat(p,u){u=clamp(u,0,1);const T=plen(p);let d=u*T;for(let i=1;i<p.length;i++){const dx=p[i].x-p[i-1].x,dy=p[i].y-p[i-1].y,s=Math.hypot(dx,dy);if(d<=s||i===p.length-1){const f=s?d/s:0;return{x:p[i-1].x+dx*f,y:p[i-1].y+dy*f};}d-=s;}return p[p.length-1];}

// NOTE: This file is the verbatim design handoff. See ../src/film/Film.tsx for
// the maintained, typed implementation (scenes S1–S8, chapters bar, helpers
// Reveal / SceneWrap / Flow / Heading / Callout / Badge / NodeBox / Device /
// Code, and the MetalLBVideo Stage with sprites at
// 0–20, 20–46, 46–70, 70–104, 104–128, 128–166, 166–190, 190–208s).
