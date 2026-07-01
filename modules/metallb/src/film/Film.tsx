// "MetalLB Explainer" — the ~3:28 diagrammatic explainer film. Ported faithfully
// from the Claude Design prototype (metallb-scene.jsx) onto the project's own
// timeline engine (Stage / Sprite / useSprite). Scenes read sprite-local time.
//
// Colour language: green = MetalLB / data path, cyan = control plane (controller
// + BGP peering), amber = ARP / transient, red = failure.
import React from 'react';
import { C as T, MONO, DISP } from '../design/theme';
import { Easing, clamp } from '../engine/anim';
import { Stage, Sprite, useSprite, useTime } from '../engine/timeline';

// Film palette alias (keeps the ported scene code near-verbatim).
const C = {
  green: T.green,
  greenLite: T.greenLite,
  greenDim: T.greenSoft,
  bg: T.bg,
  panel: T.panel,
  panel2: T.panel2,
  line: T.line,
  line2: T.line2,
  txt: T.ink,
  mut: T.dim,
  mut2: T.faint,
  red: T.red,
  redDim: T.redSoft,
  amber: T.amber,
  cyan: T.cyan,
  mono: MONO,
  disp: DISP,
};

type Pt = { x: number; y: number };
type EaseFn = (t: number) => number;

// ── path helpers ────────────────────────────────────────────────
function plen(p: Pt[]) {
  let L = 0;
  for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
  return L;
}
function pat(p: Pt[], u: number): Pt {
  u = clamp(u, 0, 1);
  const T0 = plen(p);
  let d = u * T0;
  for (let i = 1; i < p.length; i++) {
    const dx = p[i].x - p[i - 1].x,
      dy = p[i].y - p[i - 1].y,
      s = Math.hypot(dx, dy);
    if (d <= s || i === p.length - 1) {
      const f = s ? d / s : 0;
      return { x: p[i - 1].x + dx * f, y: p[i - 1].y + dy * f };
    }
    d -= s;
  }
  return p[p.length - 1];
}

// ── small building blocks ───────────────────────────────────────
function Reveal({
  at = 0,
  dur = 0.5,
  y = 16,
  x = 0,
  ease = Easing.easeOutCubic,
  children,
  style,
}: {
  at?: number;
  dur?: number;
  y?: number;
  x?: number;
  ease?: EaseFn;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const { localTime } = useSprite();
  const p = ease(clamp((localTime - at) / dur, 0, 1));
  return <div style={{ opacity: p, transform: `translate(${(1 - p) * x}px, ${(1 - p) * y}px)`, ...style }}>{children}</div>;
}

function SceneWrap({ children, fade = 0.6, zoom = 0.03 }: { children: React.ReactNode; fade?: number; zoom?: number }) {
  const { localTime, duration } = useSprite();
  let o = 1;
  if (localTime < fade) o = clamp(localTime / fade, 0, 1);
  else if (localTime > duration - fade) o = clamp((duration - localTime) / fade, 0, 1);
  const z = 1 + zoom * clamp(localTime / duration, 0, 1);
  return <div style={{ position: 'absolute', inset: 0, opacity: o, transform: `scale(${z})`, transformOrigin: '50% 53%' }}>{children}</div>;
}

function Flow({
  points,
  t,
  count = 4,
  period = 1.5,
  color = C.green,
  size = 10,
  from = 0,
  to = 1,
  glow = true,
  fade = 2.2,
}: {
  points: Pt[];
  t: number;
  count?: number;
  period?: number;
  color?: string;
  size?: number;
  from?: number;
  to?: number;
  glow?: boolean;
  fade?: number;
}) {
  const dots: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const phase = (t / period + i / count) % 1;
    const u = from + (to - from) * phase;
    const pos = pat(points, u);
    const edge = Math.min(phase, 1 - phase) * 2;
    const op = clamp(edge * fade, 0, 1);
    dots.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          left: pos.x - size / 2,
          top: pos.y - size / 2,
          width: size,
          height: size,
          borderRadius: size,
          background: color,
          opacity: op,
          boxShadow: glow ? `0 0 ${size + 4}px ${color}` : 'none',
        }}
      />,
    );
  }
  return <>{dots}</>;
}

function Heading({ n, title, sub, x = 110, y = 120 }: { n: string; title: React.ReactNode; sub?: React.ReactNode; x?: number; y?: number }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 1700 }}>
      <Reveal at={0.1} y={10}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
          <span style={{ fontFamily: C.mono, fontSize: 16, color: C.green, letterSpacing: '0.18em' }}>{n}</span>
          <h1 style={{ margin: 0, fontFamily: C.disp, fontSize: 50, fontWeight: 600, color: C.txt, letterSpacing: '-0.02em' }}>{title}</h1>
        </div>
      </Reveal>
      {sub && (
        <Reveal at={0.35} y={8}>
          <p style={{ margin: '14px 0 0', maxWidth: 1180, fontFamily: C.disp, fontSize: 23, lineHeight: 1.5, color: C.mut, fontWeight: 400 }}>{sub}</p>
        </Reveal>
      )}
    </div>
  );
}

function Callout({ x, y, at = 0, title, body, color = C.green, w = 300 }: { x: number; y: number; at?: number; title: React.ReactNode; body: React.ReactNode; color?: string; w?: number }) {
  return (
    <Reveal at={at} x={-14} y={0} style={{ position: 'absolute', left: x, top: y, width: w }}>
      <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: 16 }}>
        <div style={{ fontFamily: C.mono, fontSize: 13, letterSpacing: '0.12em', color, textTransform: 'uppercase', marginBottom: 7 }}>{title}</div>
        <div style={{ fontFamily: C.disp, fontSize: 19, lineHeight: 1.4, color: C.txt, fontWeight: 400 }}>{body}</div>
      </div>
    </Reveal>
  );
}

function Badge({ children, color = C.green, solid = false }: { children: React.ReactNode; color?: string; solid?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: C.mono,
        fontSize: 12.5,
        fontWeight: 500,
        letterSpacing: '0.04em',
        color: solid ? '#0a0a0a' : color,
        background: solid ? color : 'transparent',
        border: solid ? 'none' : `1px solid ${color}`,
        borderRadius: 6,
        padding: '3px 9px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

// Node box used across topology scenes.
function NodeBox({
  x,
  y,
  w = 210,
  h = 158,
  name,
  ip,
  leader,
  dead,
  controller,
  pods = 2,
  podsActive = false,
  t = 0,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  name: string;
  ip?: string;
  leader?: boolean;
  dead?: boolean;
  controller?: boolean;
  pods?: number;
  podsActive?: boolean;
  t?: number;
}) {
  const bc = dead ? 'rgba(255,82,82,0.55)' : leader ? C.green : C.line;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 14,
        background: dead ? C.redDim : '#101010',
        border: `1.5px solid ${bc}`,
        boxShadow: leader && !dead ? '0 0 34px rgba(118,185,0,0.22)' : 'none',
        padding: '12px 13px',
        opacity: dead ? 0.7 : 1,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: C.disp, fontSize: 17, fontWeight: 600, color: dead ? C.red : C.txt }}>{name}</span>
        {leader && !dead && (
          <span style={{ fontFamily: C.mono, fontSize: 10, color: C.green, border: `1px solid ${C.green}`, borderRadius: 5, padding: '1px 6px', letterSpacing: '0.08em' }}>LEADER</span>
        )}
        {dead && <span style={{ fontFamily: C.mono, fontSize: 14, color: C.red, fontWeight: 700 }}>✕</span>}
      </div>
      {ip && <div style={{ fontFamily: C.mono, fontSize: 12, color: C.mut2, marginTop: 2 }}>{ip}</div>}
      <div style={{ display: 'flex', gap: 6, marginTop: 11, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: C.mono, fontSize: 10.5, color: dead ? C.mut2 : C.green, border: `1px solid ${dead ? C.line : C.greenDim}`, background: dead ? 'transparent' : 'rgba(118,185,0,0.08)', borderRadius: 5, padding: '2px 6px' }}>speaker</span>
        {controller && <span style={{ fontFamily: C.mono, fontSize: 10.5, color: C.cyan, border: '1px solid rgba(92,200,255,0.3)', background: 'rgba(92,200,255,0.07)', borderRadius: 5, padding: '2px 6px' }}>controller</span>}
      </div>
      <div style={{ position: 'absolute', left: 13, bottom: 12, display: 'flex', gap: 6 }}>
        {Array.from({ length: pods }).map((_, i) => {
          const on = podsActive && Math.floor(t * 2 + i) % 2 === 0;
          return (
            <div key={i} style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${C.line}`, background: dead ? 'transparent' : on ? 'rgba(118,185,0,0.22)' : '#181818', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 8, height: 8, borderRadius: 8, background: dead ? C.mut2 : on ? C.greenLite : C.mut2 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// generic device box (client / router / switch / cloud)
function Device({ x, y, w, h, label, sub, icon, color = C.line, glow }: { x: number; y: number; w: number; h: number; label: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode; color?: string; glow?: string }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 14, background: '#101010', border: `1.5px solid ${color}`, boxShadow: glow || 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      {icon}
      <div style={{ fontFamily: C.disp, fontSize: 18, fontWeight: 600, color: C.txt }}>{label}</div>
      {sub && <div style={{ fontFamily: C.mono, fontSize: 12, color: C.mut2 }}>{sub}</div>}
    </div>
  );
}

// terminal / code panel
function Code({ x, y, w, title, lines, accent = C.green }: { x: number; y: number; w: number; title: React.ReactNode; lines: React.ReactNode; accent?: string }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, borderRadius: 12, background: C.panel2, border: `1px solid ${C.line}`, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${C.line2}`, background: '#0b0b0b' }}>
        <span style={{ width: 11, height: 11, borderRadius: 6, background: '#2a2a2a' }} />
        <span style={{ width: 11, height: 11, borderRadius: 6, background: '#2a2a2a' }} />
        <span style={{ width: 11, height: 11, borderRadius: 6, background: accent }} />
        <span style={{ fontFamily: C.mono, fontSize: 12.5, color: C.mut, marginLeft: 8 }}>{title}</span>
      </div>
      <div style={{ padding: '16px 18px', fontFamily: C.mono, fontSize: 16, lineHeight: 1.65 }}>{lines}</div>
    </div>
  );
}

// ── chapters bar (persistent) ───────────────────────────────────
const CH = [
  { t: 0, title: 'Why bare-metal needs MetalLB' },
  { t: 20, title: 'Architecture — controller & speaker' },
  { t: 46, title: 'Address pools & advertisement' },
  { t: 70, title: 'Layer 2 mode — ARP / NDP' },
  { t: 104, title: 'Layer 2 failover' },
  { t: 128, title: 'BGP mode — ECMP load balancing' },
  { t: 166, title: 'BGP convergence & caveats' },
  { t: 190, title: 'Layer 2 vs BGP' },
];
const TOTAL = 208;

function ChaptersBar() {
  const time = useTime();
  let idx = 0;
  for (let i = 0; i < CH.length; i++) if (time >= CH[i].t) idx = i;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 92, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 56px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 13, height: 13, background: C.green, transform: 'rotate(45deg)' }} />
        <span style={{ fontFamily: C.disp, fontSize: 23, fontWeight: 700, color: C.txt, letterSpacing: '-0.01em' }}>MetalLB</span>
        <span style={{ fontFamily: C.mono, fontSize: 13, color: C.mut2, letterSpacing: '0.06em' }}>/ how it works</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontFamily: C.mono, fontSize: 13, color: C.green }}>
          {String(idx + 1).padStart(2, '0')} <span style={{ color: C.mut2 }}>/ {String(CH.length).padStart(2, '0')}</span>
        </span>
        <span style={{ fontFamily: C.disp, fontSize: 16, color: C.mut, fontWeight: 500 }}>{CH[idx].title}</span>
      </div>
      <div style={{ position: 'absolute', left: 56, right: 56, bottom: 0, height: 2, background: C.line2 }}>
        <div style={{ height: '100%', width: `${(time / TOTAL) * 100}%`, background: C.green }} />
      </div>
    </div>
  );
}

// ── SCENE 1 — the problem ───────────────────────────────────────
function S1() {
  const { localTime: lt } = useSprite();
  const blink = Math.floor(lt * 1.5) % 2 === 0;
  const resolved = lt > 13.5;
  return (
    <SceneWrap>
      <Heading
        n="01"
        title="Kubernetes has no load balancer of its own"
        sub="A Service of type LoadBalancer just asks the platform for two things: an external IP, and a way to pull that IP's traffic into the cluster. In a cloud, the cloud-controller answers. On bare metal, nothing does — so the IP stays <pending> forever."
      />
      <Code
        x={110}
        y={360}
        w={760}
        title="kubectl get svc web"
        accent={C.amber}
        lines={
          <>
            <div style={{ color: C.mut }}>$ kubectl get svc web</div>
            <div style={{ color: C.mut2, marginTop: 4 }}>NAME&nbsp;&nbsp;TYPE&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;EXTERNAL-IP&nbsp;&nbsp;&nbsp;&nbsp;PORT(S)</div>
            <div style={{ color: C.txt }}>
              web&nbsp;&nbsp;&nbsp;LoadBalancer&nbsp;&nbsp;
              <span style={{ color: resolved ? C.green : C.amber, opacity: resolved ? 1 : blink ? 1 : 0.25, fontWeight: 600 }}>{resolved ? '192.168.1.240' : '<pending>'}</span>
              &nbsp;&nbsp;80:31472
            </div>
            <div style={{ color: C.mut2, marginTop: 14, fontSize: 14 }}># bare metal, no cloud provider →</div>
            <div style={{ color: resolved ? C.green : C.red, fontSize: 14 }}>{resolved ? '# MetalLB assigned + announced it ✓' : '# nobody allocates the IP, nobody attracts traffic'}</div>
          </>
        }
      />
      <Reveal at={6} x={-12} style={{ position: 'absolute', left: 980, top: 300 }}>
        <div style={{ fontFamily: C.mono, fontSize: 13, color: C.mut2, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 18 }}>MetalLB does exactly two jobs</div>
      </Reveal>
      {[
        { at: 6.6, n: '1', t: 'Allocate', b: 'Hand the Service a real external IP from a pool you define.', who: 'controller' },
        { at: 7.8, n: '2', t: 'Attract', b: "Make the outside network route that IP's packets to a cluster node.", who: 'speaker' },
      ].map((j, i) => (
        <Reveal key={i} at={j.at} y={18} style={{ position: 'absolute', left: 980, top: 350 + i * 150 }}>
          <div style={{ width: 740, borderRadius: 14, background: C.panel, border: `1px solid ${C.greenDim}`, padding: '18px 22px', display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            <div style={{ fontFamily: C.disp, fontSize: 34, fontWeight: 700, color: C.green, lineHeight: 1 }}>{j.n}</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: C.disp, fontSize: 24, fontWeight: 600, color: C.txt }}>{j.t}</span>
                <Badge>{j.who}</Badge>
              </div>
              <div style={{ fontFamily: C.disp, fontSize: 18, color: C.mut, marginTop: 6, lineHeight: 1.4 }}>{j.b}</div>
            </div>
          </div>
        </Reveal>
      ))}
    </SceneWrap>
  );
}

// ── SCENE 2 — architecture ──────────────────────────────────────
function S2() {
  const { localTime: lt } = useSprite();
  const api = { x: 870, y: 300 };
  const nodes = [
    { x: 300, y: 560 },
    { x: 855, y: 560 },
    { x: 1410, y: 560 },
  ];
  return (
    <SceneWrap>
      <Heading
        n="02"
        title="Two components, two responsibilities"
        sub="MetalLB ships a controller and a speaker. The controller decides which IP a Service gets. The speaker makes the network deliver that IP. Allocation and announcement are deliberately separate."
      />
      <svg width="1920" height="1080" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
        <line x1={975} y1={372} x2={510} y2={560} stroke="rgba(92,200,255,0.4)" strokeWidth="1.5" strokeDasharray="6 6" />
        {nodes.map((n, i) => (
          <line key={i} x1={975} y1={372} x2={n.x + 105} y2={560} stroke={C.line} strokeWidth="1.3" />
        ))}
      </svg>
      {lt > 1.5 && <Flow points={[{ x: 975, y: 372 }, { x: 510, y: 560 }]} t={lt} count={3} period={2} color={C.cyan} size={8} />}

      <Reveal at={0.6} style={{ position: 'absolute', left: api.x, top: api.y }}>
        <Device x={0} y={0} w={210} h={72} label="API server" sub="Service objects" color="rgba(92,200,255,0.35)" />
      </Reveal>

      <Reveal at={1.0} style={{ position: 'absolute', left: nodes[0].x, top: nodes[0].y }}>
        <NodeBox x={0} y={0} name="node-1" ip="10.0.0.11" controller pods={2} />
      </Reveal>
      <Reveal at={1.2} style={{ position: 'absolute', left: nodes[1].x, top: nodes[1].y }}>
        <NodeBox x={0} y={0} name="node-2" ip="10.0.0.12" pods={2} />
      </Reveal>
      <Reveal at={1.4} style={{ position: 'absolute', left: nodes[2].x, top: nodes[2].y }}>
        <NodeBox x={0} y={0} name="node-3" ip="10.0.0.13" pods={2} />
      </Reveal>

      <Reveal at={3.4} y={20} style={{ position: 'absolute', left: 300, top: 770 }}>
        <div style={{ width: 560, borderRadius: 14, background: C.panel, border: '1px solid rgba(92,200,255,0.25)', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ fontFamily: C.disp, fontSize: 24, fontWeight: 600, color: C.txt }}>controller</span>
            <Badge color={C.cyan}>Deployment · 1 replica</Badge>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontFamily: C.disp, fontSize: 18, lineHeight: 1.6, color: C.mut }}>
            <li>Watches Services &amp; IPAddressPools</li>
            <li>
              Allocates an IP, writes <span style={{ fontFamily: C.mono, fontSize: 15, color: C.txt }}>.status.loadBalancer</span>
            </li>
            <li>Pure bookkeeping — speaks to no router</li>
          </ul>
        </div>
      </Reveal>
      <Reveal at={4.0} y={20} style={{ position: 'absolute', left: 1060, top: 770 }}>
        <div style={{ width: 560, borderRadius: 14, background: C.panel, border: `1px solid ${C.greenDim}`, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ fontFamily: C.disp, fontSize: 24, fontWeight: 600, color: C.txt }}>speaker</span>
            <Badge>DaemonSet · one per node</Badge>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontFamily: C.disp, fontSize: 18, lineHeight: 1.6, color: C.mut }}>
            <li>Announces allocated IPs to the network</li>
            <li>
              Talks <span style={{ color: C.txt }}>ARP/NDP</span> (L2) or <span style={{ color: C.txt }}>BGP</span>
            </li>
            <li>Runs leader election via memberlist gossip</li>
          </ul>
        </div>
      </Reveal>
    </SceneWrap>
  );
}

// ── SCENE 3 — address pools & advertisement ─────────────────────
function S3() {
  const { localTime: lt } = useSprite();
  const assigned = lt > 9;
  return (
    <SceneWrap>
      <Heading
        n="03"
        title="You bring the IPs — pools and advertisements"
        sub="Two CRDs do the config. An IPAddressPool is the menu of IPs MetalLB may hand out. An Advertisement (L2 or BGP) selects which pools get announced and how. They're decoupled — change the announce mechanism without touching the addresses."
      />
      <Code
        x={110}
        y={300}
        w={720}
        title="ipaddresspool.yaml"
        accent={C.green}
        lines={
          <>
            <div>
              <span style={{ color: C.cyan }}>apiVersion:</span> metallb.io/v1beta1
            </div>
            <div>
              <span style={{ color: C.cyan }}>kind:</span> <span style={{ color: C.green }}>IPAddressPool</span>
            </div>
            <div>
              <span style={{ color: C.cyan }}>metadata:</span>
            </div>
            <div>
              &nbsp;&nbsp;<span style={{ color: C.cyan }}>name:</span> prod-pool
            </div>
            <div>
              <span style={{ color: C.cyan }}>spec:</span>
            </div>
            <div>
              &nbsp;&nbsp;<span style={{ color: C.cyan }}>addresses:</span>
            </div>
            <div>
              &nbsp;&nbsp;- <span style={{ color: C.amber }}>192.168.1.240-192.168.1.250</span>
            </div>
            <div>
              &nbsp;&nbsp;<span style={{ color: C.cyan }}>autoAssign:</span> true
            </div>
          </>
        }
      />
      <Code
        x={860}
        y={300}
        w={720}
        title="advertisement.yaml"
        accent={C.green}
        lines={
          <>
            <div>
              <span style={{ color: C.cyan }}>kind:</span> <span style={{ color: C.green }}>L2Advertisement</span>&nbsp;&nbsp;<span style={{ color: C.mut2 }}># or BGPAdvertisement</span>
            </div>
            <div>
              <span style={{ color: C.cyan }}>spec:</span>
            </div>
            <div>
              &nbsp;&nbsp;<span style={{ color: C.cyan }}>ipAddressPools:</span>
            </div>
            <div>&nbsp;&nbsp;- prod-pool</div>
            <div style={{ marginTop: 8, color: C.mut2 }}># selects WHICH pools to announce</div>
            <div style={{ color: C.mut2 }}># and HOW: layer-2 ARP, or BGP routes</div>
            <div style={{ marginTop: 6, color: C.green }}># same pool can be L2 here, BGP there</div>
          </>
        }
      />
      <Reveal at={5.5} y={16} style={{ position: 'absolute', left: 110, top: 730 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div style={{ fontFamily: C.mono, fontSize: 16, color: C.mut, border: `1px solid ${C.line}`, borderRadius: 10, padding: '12px 16px', background: C.panel }}>
            Service <span style={{ color: C.green }}>type: LoadBalancer</span>
          </div>
          <span style={{ color: C.green, fontSize: 26 }}>→</span>
          <div style={{ fontFamily: C.mono, fontSize: 16, color: C.cyan, border: '1px solid rgba(92,200,255,0.3)', borderRadius: 10, padding: '12px 16px', background: C.panel }}>controller picks next free IP</div>
          <span style={{ color: C.green, fontSize: 26 }}>→</span>
          <div style={{ fontFamily: C.mono, fontSize: 17, fontWeight: 600, color: assigned ? '#0a0a0a' : C.mut2, background: assigned ? C.green : C.panel, border: `1px solid ${assigned ? C.green : C.line}`, borderRadius: 10, padding: '12px 18px', boxShadow: assigned ? '0 0 28px rgba(118,185,0,0.35)' : 'none' }}>
            EXTERNAL-IP {assigned ? '192.168.1.240' : '…'}
          </div>
        </div>
      </Reveal>
      <Callout x={110} y={870} at={7.5} title="still no traffic yet" body="The IP is allocated, but nothing on the wire knows where it lives. Announcing it is the speaker's job — next." w={1180} color={C.amber} />
    </SceneWrap>
  );
}

// ── SCENE 4 — Layer 2 mode ──────────────────────────────────────
function S4() {
  const { localTime: lt } = useSprite();
  const client = { x: 120, y: 540 };
  const sw = { x: 470, y: 545 };
  const nodes = [
    { x: 780, y: 360 },
    { x: 780, y: 540 },
    { x: 780, y: 720 },
  ];
  const nCenter = (n: Pt) => ({ x: n.x, y: n.y + 30 });
  const swR = { x: sw.x + 150, y: sw.y + 35 };
  const cliR = { x: client.x + 150, y: client.y + 35 };

  const arpPhase = lt > 3 && lt < 9;
  const replyPhase = lt > 9 && lt < 13;
  const dataPhase = lt > 13.5;
  const internalPhase = lt > 22;

  return (
    <SceneWrap>
      <Heading
        n="04"
        title="Layer 2 mode — one node answers for the IP"
        sub="No router config. Speakers elect one leader per service IP; that leader answers ARP/NDP with its own MAC, so the entire L2 segment delivers the IP's traffic to that single node."
      />
      <svg width="1920" height="1080" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
        <line x1={cliR.x} y1={cliR.y} x2={sw.x} y2={swR.y} stroke={C.line} strokeWidth="1.5" />
        {nodes.map((n, i) => (
          <line key={i} x1={swR.x} y1={swR.y} x2={n.x} y2={nCenter(n).y} stroke={i === 1 ? C.greenDim : C.line} strokeWidth={i === 1 ? 2 : 1.3} />
        ))}
      </svg>

      <Reveal at={0.5} style={{ position: 'absolute', left: client.x, top: client.y }}>
        <Device x={0} y={0} w={150} h={70} label="client" sub="192.168.1.50" color={C.line} />
      </Reveal>
      <Reveal at={0.7} style={{ position: 'absolute', left: sw.x, top: sw.y }}>
        <Device x={0} y={0} w={150} h={70} label="L2 switch" sub="broadcast domain" color={C.line} />
      </Reveal>
      <Reveal at={0.9} style={{ position: 'absolute', left: nodes[0].x, top: nodes[0].y - 30 }}>
        <NodeBox x={0} y={0} w={300} h={120} name="node-1" ip="mac …:01" pods={2} podsActive={internalPhase} t={lt} />
      </Reveal>
      <Reveal at={1.0} style={{ position: 'absolute', left: nodes[1].x, top: nodes[1].y - 30 }}>
        <NodeBox x={0} y={0} w={300} h={120} name="node-2" ip="mac …:02" leader pods={2} podsActive={internalPhase} t={lt} />
      </Reveal>
      <Reveal at={1.1} style={{ position: 'absolute', left: nodes[2].x, top: nodes[2].y - 30 }}>
        <NodeBox x={0} y={0} w={300} h={120} name="node-3" ip="mac …:03" pods={2} podsActive={internalPhase} t={lt} />
      </Reveal>

      <Reveal at={1.6} style={{ position: 'absolute', left: 780, top: 288 }}>
        <Badge solid>service IP 192.168.1.240 → leader = node-2</Badge>
      </Reveal>

      {arpPhase && (
        <>
          <Flow points={[cliR, swR]} t={lt} count={2} period={1.3} color={C.amber} size={11} />
          {nodes.map((n, i) => (
            <Flow key={i} points={[swR, nCenter(n)]} t={lt} count={2} period={1.3} color={C.amber} size={10} />
          ))}
          <Reveal at={3.2} style={{ position: 'absolute', left: 120, top: 680 }}>
            <Badge color={C.amber}>ARP broadcast · "Who has 192.168.1.240?"</Badge>
          </Reveal>
        </>
      )}

      {replyPhase && (
        <>
          <Flow points={[nCenter(nodes[1]), swR, cliR]} t={lt} count={3} period={1.1} color={C.green} size={11} />
          <Reveal at={9.2} style={{ position: 'absolute', left: 120, top: 680 }}>
            <Badge color={C.green}>ARP reply · "192.168.1.240 is-at …:02" — only node-2 answers</Badge>
          </Reveal>
        </>
      )}

      {dataPhase && (
        <>
          <Flow points={[cliR, swR, nCenter(nodes[1])]} t={lt} count={5} period={1.2} color={C.green} size={12} />
          <Callout x={120} y={850} at={14} w={560} title="all traffic → one node" body="The switch only knows the IP at node-2's MAC. Every packet for .240 funnels to node-2 — this is failover, not load balancing." color={C.green} />
        </>
      )}

      {internalPhase && (
        <>
          <Flow points={[{ x: nodes[1].x + 150, y: nodes[1].y + 30 }, { x: nodes[0].x + 150, y: nodes[0].y + 30 }]} t={lt} count={2} period={1} color={C.greenLite} size={8} />
          <Flow points={[{ x: nodes[1].x + 150, y: nodes[1].y + 30 }, { x: nodes[2].x + 150, y: nodes[2].y + 30 }]} t={lt} count={2} period={1} color={C.greenLite} size={8} />
          <Callout x={720} y={850} at={22.5} w={520} title="kube-proxy fans out" body="Inside node-2, kube-proxy / IPVS load-balances to backend pods cluster-wide — possibly back across other nodes." color={C.greenLite} />
        </>
      )}

      <Callout x={1300} y={850} at={30} w={300} title="also note" body="IPv6 uses NDP, not ARP. externalTrafficPolicy=Local restricts the leader set to nodes that actually run pods." color={C.mut} />
    </SceneWrap>
  );
}

// ── SCENE 5 — L2 failover ───────────────────────────────────────
function S5() {
  const { localTime: lt } = useSprite();
  const client = { x: 120, y: 540 };
  const sw = { x: 470, y: 545 };
  const nodes = [
    { x: 780, y: 360 },
    { x: 780, y: 540 },
    { x: 780, y: 720 },
  ];
  const swR = { x: sw.x + 150, y: sw.y + 35 };
  const cliR = { x: client.x + 150, y: client.y + 35 };
  const nC = (n: Pt) => ({ x: n.x, y: n.y + 30 });

  const dead = lt > 2.5;
  const detect = lt > 4 && lt < 9.5;
  const newLeader = lt > 9.5;
  const garp = lt > 10 && lt < 14;
  const reconverged = lt > 14;

  const cd = clamp(10 - (lt - 4), 0, 10);

  return (
    <SceneWrap>
      <Heading
        n="05"
        title="Layer 2 failover — re-electing the leader"
        sub="When the leader dies, speakers detect it via memberlist gossip, elect a new leader, and that node sends a gratuitous ARP so switches and clients relearn where the IP now lives."
      />
      <svg width="1920" height="1080" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
        <line x1={cliR.x} y1={cliR.y} x2={sw.x} y2={swR.y} stroke={C.line} strokeWidth="1.5" />
        {nodes.map((n, i) => (
          <line key={i} x1={swR.x} y1={swR.y} x2={n.x} y2={nC(n).y} stroke={i === 2 && newLeader ? C.greenDim : C.line} strokeWidth={i === 2 && newLeader ? 2 : 1.3} />
        ))}
      </svg>
      <div style={{ position: 'absolute', left: client.x, top: client.y }}>
        <Device x={0} y={0} w={150} h={70} label="client" sub="192.168.1.50" color={C.line} />
      </div>
      <div style={{ position: 'absolute', left: sw.x, top: sw.y }}>
        <Device x={0} y={0} w={150} h={70} label="L2 switch" sub="MAC table" color={C.line} />
      </div>
      <div style={{ position: 'absolute', left: nodes[0].x, top: nodes[0].y - 30 }}>
        <NodeBox x={0} y={0} w={300} h={120} name="node-1" ip="mac …:01" pods={2} />
      </div>
      <div style={{ position: 'absolute', left: nodes[1].x, top: nodes[1].y - 30 }}>
        <NodeBox x={0} y={0} w={300} h={120} name="node-2" ip="mac …:02" leader={!dead} dead={dead} pods={2} />
      </div>
      <div style={{ position: 'absolute', left: nodes[2].x, top: nodes[2].y - 30 }}>
        <NodeBox x={0} y={0} w={300} h={120} name="node-3" ip="mac …:03" leader={newLeader} pods={2} />
      </div>

      {!dead && <Flow points={[cliR, swR, nC(nodes[1])]} t={lt} count={4} period={1.2} color={C.green} size={11} />}

      {dead && (
        <Reveal at={2.5} style={{ position: 'absolute', left: 780, top: 288 }}>
          <Badge color={C.red}>node-2 down — its MAC no longer answers .240</Badge>
        </Reveal>
      )}

      {detect && (
        <>
          <Callout x={120} y={690} at={4.1} w={560} title="memberlist gossip detects failure" body="Default detection ~10s. Until peers agree node-2 is gone, traffic to .240 black-holes — the main L2 trade-off." color={C.amber} />
          <div style={{ position: 'absolute', left: 520, top: 300, fontFamily: C.mono, fontSize: 40, fontWeight: 700, color: C.amber }}>{cd.toFixed(1)}s</div>
          <Flow points={[cliR, swR]} t={lt} count={3} period={0.9} color={C.red} size={9} to={1} />
        </>
      )}

      {garp && (
        <>
          <Flow points={[nC(nodes[2]), swR, cliR]} t={lt} count={3} period={1} color={C.green} size={11} />
          <Reveal at={10.2} style={{ position: 'absolute', left: 120, top: 760 }}>
            <Badge color={C.green}>gratuitous ARP · "192.168.1.240 is now at …:03"</Badge>
          </Reveal>
        </>
      )}

      {reconverged && (
        <>
          <Flow points={[cliR, swR, nC(nodes[2])]} t={lt} count={5} period={1.2} color={C.green} size={12} />
          <Callout x={120} y={690} at={14.5} w={560} title="re-converged" body="Switch MAC table + client ARP caches now point at node-3. Service is reachable again — same single-node model, new node." color={C.green} />
        </>
      )}

      <Callout x={1300} y={690} at={16} w={300} title="tuning" body="Sub-second L2 failover isn't possible the way BGP+BFD is — detection is bounded by gossip timing. For fast failover, use BGP." color={C.mut} />
    </SceneWrap>
  );
}

// ── SCENE 6 — BGP mode ──────────────────────────────────────────
function S6() {
  const { localTime: lt } = useSprite();
  const router = { x: 1380, y: 470 };
  const ext = { x: 1640, y: 200 };
  const nodes = [
    { x: 300, y: 340 },
    { x: 300, y: 520 },
    { x: 300, y: 700 },
  ];
  const nR = (n: Pt) => ({ x: n.x + 300, y: n.y + 60 });

  const peering = lt > 3 && lt < 9;
  const established = lt > 8.5;
  const advertise = lt > 10 && lt < 18;
  const ecmpReady = lt > 17;
  const traffic = lt > 20;

  return (
    <SceneWrap>
      <Heading
        n="06"
        title="BGP mode — every node advertises the IP"
        sub="Each speaker opens a BGP session with your routers and advertises the service IP as a /32, next-hop = its own node. The router learns the same prefix from all nodes and installs an ECMP route — real load balancing, spread across the whole cluster."
      />
      <svg width="1920" height="1080" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
        {nodes.map((n, i) => (
          <line key={i} x1={nR(n).x} y1={nR(n).y} x2={router.x} y2={router.y + 90} stroke={established ? C.greenDim : C.line} strokeWidth={established ? 2 : 1.3} strokeDasharray={established ? 'none' : '6 6'} />
        ))}
        <line x1={ext.x} y1={ext.y + 40} x2={router.x + 90} y2={router.y} stroke={C.line} strokeWidth="1.5" />
      </svg>

      {nodes.map((n, i) => (
        <Reveal key={i} at={0.7 + i * 0.15} style={{ position: 'absolute', left: n.x, top: n.y }}>
          <NodeBox x={0} y={0} w={300} h={120} name={`node-${i + 1}`} ip={`10.0.0.1${i + 1}`} pods={2} podsActive={traffic} t={lt} />
        </Reveal>
      ))}
      <Reveal at={0.6} style={{ position: 'absolute', left: router.x, top: router.y }}>
        <Device x={0} y={0} w={180} h={180} label="ToR router" sub="AS 64512" color="rgba(255,255,255,0.18)" icon={<div style={{ fontFamily: C.mono, fontSize: 11, color: C.mut2 }}>BGP peer</div>} />
      </Reveal>
      <Reveal at={0.9} style={{ position: 'absolute', left: ext.x, top: ext.y }}>
        <Device x={0} y={0} w={170} h={80} label="internet" sub="→ 192.168.1.240" color={C.line} />
      </Reveal>

      {peering && (
        <>
          {nodes.map((n, i) => (
            <Flow key={i} points={[nR(n), { x: router.x, y: router.y + 90 }]} t={lt + i * 0.3} count={2} period={1.4} color={C.cyan} size={9} />
          ))}
          <Reveal at={3.2} style={{ position: 'absolute', left: 600, top: 880 }}>
            <Badge color={C.cyan}>TCP/179 · OPEN → KEEPALIVE → ESTABLISHED · peer AS 64500 ↔ AS 64512</Badge>
          </Reveal>
        </>
      )}
      {established && !advertise && !ecmpReady && (
        <Reveal at={8.6} style={{ position: 'absolute', left: 600, top: 880 }}>
          <Badge color={C.green}>3 BGP sessions ESTABLISHED</Badge>
        </Reveal>
      )}

      {advertise && (
        <>
          {nodes.map((n, i) => (
            <Flow key={i} points={[nR(n), { x: router.x, y: router.y + 90 }]} t={lt + i * 0.25} count={2} period={1.2} color={C.green} size={10} />
          ))}
          <Reveal at={10.2} style={{ position: 'absolute', left: 600, top: 880 }}>
            <Badge color={C.green}>UPDATE · 192.168.1.240/32 next-hop = node IP (×3)</Badge>
          </Reveal>
        </>
      )}

      {ecmpReady && (
        <Reveal at={17.2} y={16} style={{ position: 'absolute', left: 1130, top: 680 }}>
          <div style={{ width: 660, borderRadius: 12, background: C.panel2, border: `1px solid ${C.greenDim}`, padding: '16px 20px', fontFamily: C.mono, fontSize: 15.5, lineHeight: 1.7 }}>
            <div style={{ color: C.mut, marginBottom: 6 }}>router# show ip route 192.168.1.240</div>
            <div style={{ color: C.green }}>
              B&nbsp;&nbsp; 192.168.1.240/32 <span style={{ color: C.mut2 }}>[ECMP]</span>
            </div>
            <div style={{ color: C.txt }}>&nbsp;&nbsp;&nbsp;via 10.0.0.11 &nbsp;via 10.0.0.12 &nbsp;via 10.0.0.13</div>
          </div>
        </Reveal>
      )}

      {traffic && (
        <>
          <Flow points={[{ x: ext.x, y: ext.y + 40 }, { x: router.x + 90, y: router.y }]} t={lt} count={4} period={1} color={C.green} size={12} />
          {nodes.map((n, i) => (
            <Flow key={i} points={[{ x: router.x, y: router.y + 90 }, nR(n)]} t={lt + i * 0.2} count={2} period={1.1} color={C.greenLite} size={10} />
          ))}
          <Callout x={300} y={870} at={21} w={760} title="ECMP = true load balancing" body="The router hashes each flow's 5-tuple and splits connections across all three next-hops. Every node carries its share — no single bottleneck." color={C.green} />
        </>
      )}
    </SceneWrap>
  );
}

// ── SCENE 7 — BGP convergence & caveats ─────────────────────────
function S7() {
  const { localTime: lt } = useSprite();
  const router = { x: 1380, y: 470 };
  const nodes = [
    { x: 300, y: 340 },
    { x: 300, y: 520 },
    { x: 300, y: 700 },
  ];
  const nR = (n: Pt) => ({ x: n.x + 300, y: n.y + 60 });
  const dead = lt > 2.5;
  const bfd = lt > 5 && lt < 9;
  const withdraw = lt > 9 && lt < 13;
  const recomputed = lt > 12;
  return (
    <SceneWrap>
      <Heading
        n="07"
        title="BGP convergence — fast, with one sharp edge"
        sub="Lose a node and its BGP session drops; the router withdraws that next-hop and ECMP recomputes. With BFD this is sub-second. The catch: changing the ECMP set rehashes flows, so some established connections land on a different node and reset."
      />
      <svg width="1920" height="1080" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
        {nodes.map((n, i) => {
          const gone = i === 2 && dead;
          return <line key={i} x1={nR(n).x} y1={nR(n).y} x2={router.x} y2={router.y + 90} stroke={gone ? 'rgba(255,82,82,0.4)' : C.greenDim} strokeWidth={2} strokeDasharray={gone ? '5 7' : 'none'} />;
        })}
      </svg>
      {nodes.map((n, i) => (
        <div key={i} style={{ position: 'absolute', left: n.x, top: n.y }}>
          <NodeBox x={0} y={0} w={300} h={120} name={`node-${i + 1}`} ip={`10.0.0.1${i + 1}`} dead={i === 2 && dead} pods={2} podsActive={!(i === 2 && dead)} t={lt} />
        </div>
      ))}
      <div style={{ position: 'absolute', left: router.x, top: router.y }}>
        <Device x={0} y={0} w={180} h={180} label="ToR router" sub="AS 64512" color="rgba(255,255,255,0.18)" />
      </div>

      {nodes.slice(0, 2).map((n, i) => (
        <Flow key={i} points={[{ x: router.x, y: router.y + 90 }, nR(n)]} t={lt + i * 0.3} count={2} period={1.1} color={C.greenLite} size={10} />
      ))}

      {dead && (
        <Reveal at={2.5} style={{ position: 'absolute', left: 300, top: 835 }}>
          <Badge color={C.red}>node-3 down — BGP session lost</Badge>
        </Reveal>
      )}
      {bfd && <Callout x={760} y={835} at={5.1} w={520} title="detection: BFD ≪ hold timer" body="Default BGP hold time is ~90s. BFD detects the dead peer in well under a second, so the router reacts almost immediately." color={C.cyan} />}
      {withdraw && (
        <Reveal at={9.2} style={{ position: 'absolute', left: 760, top: 835 }}>
          <Badge color={C.amber}>router withdraws via 10.0.0.13 — ECMP recomputes to 2 paths</Badge>
        </Reveal>
      )}

      {recomputed && (
        <>
          <Reveal at={12.2} y={16} style={{ position: 'absolute', left: 1130, top: 700 }}>
            <div style={{ width: 660, borderRadius: 12, background: C.panel2, border: `1px solid ${C.greenDim}`, padding: '16px 20px', fontFamily: C.mono, fontSize: 15.5, lineHeight: 1.7 }}>
              <div style={{ color: C.green }}>
                B&nbsp;&nbsp; 192.168.1.240/32 <span style={{ color: C.mut2 }}>[ECMP ×2]</span>
              </div>
              <div style={{ color: C.txt }}>
                &nbsp;&nbsp;&nbsp;via 10.0.0.11 &nbsp;via 10.0.0.12 &nbsp;<span style={{ color: C.red, textDecoration: 'line-through' }}>via .13</span>
              </div>
            </div>
          </Reveal>
          <Callout x={300} y={885} at={14} w={820} title="caveat — rehash resets flows" body="A changed next-hop set re-hashes ALL flows, not just the dead node's. Connections pinned to surviving nodes can move and break. Mitigate with resilient/consistent-hash ECMP on the router." color={C.amber} />
        </>
      )}
    </SceneWrap>
  );
}

// ── SCENE 8 — summary L2 vs BGP ─────────────────────────────────
function S8() {
  const rows = [
    { k: 'Traffic path', l: 'Single elected node', b: 'All nodes via router ECMP' },
    { k: 'Network needs', l: 'None — any L2 segment', b: 'BGP-capable routers' },
    { k: 'Load balancing', l: 'Failover only (kube-proxy inside)', b: 'Real, per-flow across nodes' },
    { k: 'Failover speed', l: '~10s (memberlist gossip)', b: 'Sub-second with BFD' },
    { k: 'Main caveat', l: 'Single-node bottleneck', b: 'Rehash can reset flows' },
    { k: 'Best for', l: 'Simple / no router access', b: 'Scale & true load balancing' },
  ];
  return (
    <SceneWrap>
      <Heading
        n="08"
        title="Layer 2 vs BGP — choosing a mode"
        sub="Same controller, same pools — only the speaker's announcement differs. L2 is zero-infrastructure failover; BGP is real load balancing if your network can peer."
      />
      <div style={{ position: 'absolute', left: 160, top: 330, width: 1600 }}>
        <Reveal at={0.3} style={{ display: 'grid', gridTemplateColumns: '320px 1fr 1fr', gap: 0, marginBottom: 6 }}>
          <div />
          <div style={{ fontFamily: C.disp, fontSize: 26, fontWeight: 700, color: C.txt, padding: '0 26px' }}>
            Layer 2 <span style={{ fontFamily: C.mono, fontSize: 14, color: C.mut2 }}>ARP / NDP</span>
          </div>
          <div style={{ fontFamily: C.disp, fontSize: 26, fontWeight: 700, color: C.green, padding: '0 26px' }}>
            BGP <span style={{ fontFamily: C.mono, fontSize: 14, color: C.mut2 }}>ECMP</span>
          </div>
        </Reveal>
        {rows.map((r, i) => (
          <Reveal key={i} at={0.6 + i * 0.22} y={12} style={{ display: 'grid', gridTemplateColumns: '320px 1fr 1fr', alignItems: 'center', borderTop: `1px solid ${C.line2}`, padding: '18px 0' }}>
            <div style={{ fontFamily: C.mono, fontSize: 14, letterSpacing: '0.06em', color: C.mut2, textTransform: 'uppercase' }}>{r.k}</div>
            <div style={{ fontFamily: C.disp, fontSize: 21, color: C.txt, padding: '0 26px' }}>{r.l}</div>
            <div style={{ fontFamily: C.disp, fontSize: 21, color: C.txt, padding: '0 26px' }}>{r.b}</div>
          </Reveal>
        ))}
      </div>
      <Reveal at={2.4} style={{ position: 'absolute', left: 0, top: 960, width: 1920, textAlign: 'center' }}>
        <span style={{ fontFamily: C.disp, fontSize: 24, fontWeight: 500, color: C.mut }}>MetalLB — a software load balancer for </span>
        <span style={{ fontFamily: C.disp, fontSize: 24, fontWeight: 700, color: C.green }}>bare-metal Kubernetes.</span>
      </Reveal>
    </SceneWrap>
  );
}

export function Film() {
  return (
    <Stage width={1920} height={1080} duration={TOTAL} background={C.bg}>
      <ChaptersBar />
      <Sprite start={0} end={20}>
        <S1 />
      </Sprite>
      <Sprite start={20} end={46}>
        <S2 />
      </Sprite>
      <Sprite start={46} end={70}>
        <S3 />
      </Sprite>
      <Sprite start={70} end={104}>
        <S4 />
      </Sprite>
      <Sprite start={104} end={128}>
        <S5 />
      </Sprite>
      <Sprite start={128} end={166}>
        <S6 />
      </Sprite>
      <Sprite start={166} end={190}>
        <S7 />
      </Sprite>
      <Sprite start={190} end={208}>
        <S8 />
      </Sprite>
    </Stage>
  );
}
