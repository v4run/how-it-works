// The lab stage: a live diagram of the cluster reacting to the control plane.
//
// Left = where traffic enters (an L2 client+switch, or the internet+ToR router
// in BGP). Right = the cluster nodes, each running a speaker. For the selected
// Service we draw who *owns* its external IP — one elected leader in L2, or all
// eligible nodes (ECMP) in BGP — animate traffic flowing there, and show the
// resulting ARP entry / router route table. A banner narrates failovers.
import React from 'react';
import { C, MONO, DISP, hexToRgb } from '../design/theme';
import { FitBox } from '../design/atoms';
import { G } from '../design/glossary';
import {
  LabState,
  NodeT,
  PEER_AS,
  assignedIp,
  activeNodesOf,
  eligibleNodes,
  leaderOf,
  isReachable,
  selectedService,
  poolUsed,
  ipStr,
  backendNodeIds,
  controllerNodeId,
} from './model';
import { SimSnapshot, Level } from './useSimulation';

const W = 1240;
const H = 904;

type Pt = { x: number; y: number };
const NODE_X = 668;
const NODE_W = 332;
const NODE_H = 116;
const NODE_Y = [120, 268, 416];
const nodeLeft = (i: number): Pt => ({ x: NODE_X, y: NODE_Y[i] + NODE_H / 2 });
const podPoint = (i: number): Pt => ({ x: NODE_X + 30, y: NODE_Y[i] + NODE_H - 19 }); // the pod slots, bottom-left of the card

const toneColor: Record<Level, string> = { info: C.dim, ok: C.green, warn: C.amber, err: C.red, ctrl: C.cyan };

export function LabViz({ state, snap }: { state: LabState; snap: SimSnapshot }) {
  return (
    <FitBox max={1} padding={20}>
      <div style={{ width: W, height: H, position: 'relative', fontFamily: DISP }}>
        <Header state={state} />
        <Topology state={state} snap={snap} />
        <Banner snap={snap} />
        <EventLog snap={snap} />
      </div>
    </FitBox>
  );
}

// ── header: selected service + pool usage ───────────────────────
function Header({ state }: { state: LabState }) {
  const svc = selectedService(state);
  const ip = svc ? assignedIp(state, svc) : null;
  const reach = svc ? isReachable(state, svc) : false;
  const used = poolUsed(state);
  const end = state.poolStart + state.poolSize - 1;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {svc ? (
          <>
            <span style={{ fontFamily: DISP, fontSize: 24, fontWeight: 700, color: C.ink }}>{svc.name}</span>
            <span title={G.LoadBalancer} style={{ fontFamily: MONO, fontSize: 12, color: C.faint, border: `1px solid ${C.line}`, borderRadius: 6, padding: '2px 8px', cursor: 'help' }}>type: LoadBalancer</span>
            <span title={ip ? undefined : G.pending} style={{ fontFamily: MONO, fontSize: 16, fontWeight: 600, color: ip ? (reach ? C.green : C.amber) : C.red, cursor: ip ? 'default' : 'help' }}>{ip ?? '<pending>'}</span>
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: reach ? C.green : C.red, border: `1px solid ${reach ? C.greenEdge : C.red}`, borderRadius: 6, padding: '2px 8px' }}>
              {ip ? (reach ? 'reachable' : 'no live node') : 'pending'}
            </span>
          </>
        ) : (
          <span style={{ fontFamily: DISP, fontSize: 20, fontWeight: 600, color: C.dim }}>no Service selected — create one →</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span title={G.IPAddressPool} style={{ fontFamily: MONO, fontSize: 12, color: C.faint, cursor: 'help', borderBottom: `1px dotted ${C.faint}` }}>prod-pool</span>
        <span style={{ fontFamily: MONO, fontSize: 13, color: C.ink }}>
          {ipStr(state.poolStart)}<span style={{ color: C.faint }}> – </span>{ipStr(end)}
        </span>
        <PoolMeter used={used} total={state.poolSize} />
        <span title={state.mode === 'l2' ? `${G.ARP}\n\n${G.NDP}` : `${G.BGP}\n\n${G.ECMP}`} style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', border: `1px solid ${state.mode === 'l2' ? C.greenEdge : 'rgba(92,200,255,0.5)'}`, color: state.mode === 'l2' ? C.green : C.cyan, borderRadius: 6, padding: '3px 9px', cursor: 'help' }}>
          {state.mode === 'l2' ? 'L2 · ARP/NDP' : 'BGP · ECMP'}
        </span>
      </div>
    </div>
  );
}

function PoolMeter({ used, total }: { used: number; total: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} style={{ width: 11, height: 14, borderRadius: 3, background: i < used ? C.green : 'rgba(255,255,255,0.07)', border: `1px solid ${i < used ? C.green : C.line}` }} />
      ))}
    </span>
  );
}

// ── topology ────────────────────────────────────────────────────
function Topology({ state, snap }: { state: LabState; snap: SimSnapshot }) {
  const L2 = state.mode === 'l2';
  const svc = selectedService(state);
  const ip = svc ? assignedIp(state, svc) : null;
  const active = svc ? activeNodesOf(state, svc) : [];
  const activeIds = new Set(active.map((n) => n.id));
  const elig = svc ? new Set(eligibleNodes(state, svc).map((n) => n.id)) : new Set<string>();
  const leader = svc && L2 ? leaderOf(state, svc) : null;
  const ctrlId = controllerNodeId(state);

  // source-side connector point (where edges to the nodes originate)
  const SRC: Pt = L2 ? { x: 416, y: 340 } : { x: 408, y: 316 };
  const CLI_R: Pt = { x: 192, y: 336 };
  const INET_B: Pt = { x: 322, y: 196 };
  const RT_TOP: Pt = { x: 324, y: 230 };

  return (
    <div style={{ position: 'absolute', left: 0, top: 70, width: W, height: 470 }}>
      {/* edges */}
      <svg width={W} height={470} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
        {!L2 && <line x1={INET_B.x} y1={INET_B.y - 70} x2={RT_TOP.x} y2={RT_TOP.y - 70} stroke={C.line} strokeWidth={1.4} />}
        {state.nodes.map((n, i) => {
          const on = activeIds.has(n.id);
          const isElig = elig.has(n.id);
          const p = nodeLeft(i);
          const col = !n.alive ? 'rgba(255,82,82,0.32)' : on ? C.greenEdge : isElig ? C.line : 'rgba(255,255,255,0.045)';
          return <line key={n.id} x1={SRC.x} y1={SRC.y - 70} x2={p.x} y2={p.y - 70} stroke={col} strokeWidth={on ? 2.4 : 1.3} strokeDasharray={isElig || on ? 'none' : '4 6'} />;
        })}
      </svg>

      {/* a single in-flight request, fired by "Send client traffic" — it
          travels the wire once to the node this request lands on (the L2
          leader, or the BGP next-hop this flow hashed to) */}
      {svc &&
        snap.packet &&
        (() => {
          const idx = state.nodes.findIndex((n) => n.id === snap.packet!.nodeId);
          if (idx < 0 || !state.nodes[idx].alive) return null;
          const podIdx = state.nodes.findIndex((n) => n.id === snap.packet!.podNodeId);
          const ingress = L2 ? [CLI_R, SRC, nodeLeft(idx)] : [INET_B, SRC, nodeLeft(idx)];
          // second leg: kube-proxy → backend pod (same node, or a hop to another)
          const path = podIdx >= 0 ? [...ingress, podPoint(podIdx)] : ingress;
          return <SinglePacket points={path} progress={snap.packet.progress} color={C.green} size={15} yShift={-70} />;
        })()}

      {/* source group */}
      {L2 ? (
        <>
          <Box x={42} y={300 - 70} w={150} h={72} label="client" sub="192.168.1.50" title={G['source IP']} />
          <Box x={250} y={296 - 70} w={166} h={88} label="L2 switch" sub="broadcast domain" title={G.ARP} />
        </>
      ) : (
        <>
          <Box x={232} y={120 - 70} w={184} h={72} label="internet" sub={ip ? `→ ${ip}` : '→ …'} title={G['source IP']} />
          <RouterBox x={240} y={230 - 70} w={170} h={172} advCount={active.length} ip={ip} />
        </>
      )}

      {/* nodes */}
      {state.nodes.map((n, i) => {
        const hasPods = !!svc && new Set(backendNodeIds(state, svc)).has(n.id);
        const ineligible = !!svc && !elig.has(n.id) && n.alive && state.policy === 'Local';
        const podHit = !!snap.packet && snap.packet.progress > 0.72 && snap.packet.podNodeId === n.id;
        return (
          <NodeCard
            key={n.id}
            node={n}
            y={NODE_Y[i] - 70}
            controller={n.id === ctrlId}
            serving={activeIds.has(n.id)}
            ineligible={ineligible}
            hasPods={hasPods}
            podHit={podHit}
            leader={!!leader && leader.id === n.id}
            mode={state.mode}
            ip={ip}
            controllerReady={state.controllerReady}
          />
        );
      })}

      {/* what the backend pod sees as the source IP (externalTrafficPolicy) */}
      {svc &&
        snap.packet &&
        snap.packet.progress > 0.58 &&
        (() => {
          const podIdx = state.nodes.findIndex((n) => n.id === snap.packet!.podNodeId);
          if (podIdx < 0) return null;
          const p = podPoint(podIdx);
          const snat = snap.packet.snat;
          const col = snat ? C.amber : C.green;
          return (
            <div
              title={snat ? G.SNAT : G['source IP']}
              style={{ position: 'absolute', left: p.x + 46, top: p.y - 70 - 11, display: 'flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 7, background: 'rgba(10,10,10,0.92)', border: `1px solid ${col}`, cursor: 'help', whiteSpace: 'nowrap' }}
            >
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: col }}>{snat ? `SNAT: pod sees ${snap.packet!.podSrc}` : `pod sees client ${snap.packet!.podSrc} ✓`}</span>
            </div>
          );
        })()}
    </div>
  );
}

function SinglePacket({ points, progress, color, size, yShift = 0 }: { points: Pt[]; progress: number; color: string; size: number; yShift?: number }) {
  const pos = pat(points, progress);
  const op = Math.max(0, Math.min(1, progress * 10, (1 - progress) * 10)); // fade in/out at the ends
  return (
    <div style={{ position: 'absolute', left: pos.x - size / 2, top: pos.y + yShift - size / 2, width: size, height: size, borderRadius: size, background: color, opacity: op, boxShadow: `0 0 ${size + 8}px ${color}`, border: `2px solid #0a0a0a` }} />
  );
}

function plen(p: Pt[]) {
  let L = 0;
  for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
  return L;
}
function pat(p: Pt[], u: number): Pt {
  u = Math.max(0, Math.min(1, u));
  const T = plen(p);
  let d = u * T;
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

// ── boxes ───────────────────────────────────────────────────────
function Box({ x, y, w, h, label, sub, title }: { x: number; y: number; w: number; h: number; label: string; sub?: string; title?: string }) {
  return (
    <div title={title} style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 13, background: '#101010', border: `1.5px solid ${C.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: title ? 'help' : 'default' }}>
      <div style={{ fontFamily: DISP, fontSize: 17, fontWeight: 600, color: C.ink }}>{label}</div>
      {sub && <div style={{ fontFamily: MONO, fontSize: 11.5, color: C.faint }}>{sub}</div>}
    </div>
  );
}

function RouterBox({ x, y, w, h, advCount, ip }: { x: number; y: number; w: number; h: number; advCount: number; ip: string | null }) {
  return (
    <div title={G['ToR router']} style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 13, background: '#101010', border: `1.5px solid rgba(92,200,255,0.4)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, padding: 8, cursor: 'help' }}>
      <div title={`${G.BGP}\n\n${G.ASN}`} style={{ fontFamily: MONO, fontSize: 10.5, color: C.cyan, letterSpacing: '0.08em' }}>BGP peer · AS {PEER_AS}</div>
      <div style={{ fontFamily: DISP, fontSize: 18, fontWeight: 700, color: C.ink }}>ToR router</div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint, textAlign: 'center', lineHeight: 1.4 }}>
        {ip ? (
          <>
            <span title={G['/32']}>{ip}/32</span>
            <br />
            <span title={G.ECMP} style={{ color: advCount ? C.green : C.red, cursor: 'help' }}>ECMP ×{advCount}</span>
          </>
        ) : (
          'no route'
        )}
      </div>
    </div>
  );
}

function NodeCard({
  node,
  y,
  controller,
  serving,
  ineligible,
  hasPods,
  podHit,
  leader,
  mode,
  ip,
  controllerReady,
}: {
  node: NodeT;
  y: number;
  controller: boolean;
  serving: boolean;
  ineligible: boolean;
  hasPods: boolean;
  podHit: boolean;
  leader: boolean;
  mode: LabState['mode'];
  ip: string | null;
  controllerReady: boolean;
}) {
  const dead = !node.alive;
  const speakerDown = node.alive && !node.speaker;
  const bc = dead ? 'rgba(255,82,82,0.55)' : serving ? C.green : speakerDown ? 'rgba(255,184,77,0.5)' : C.line;
  const showLeader = mode === 'l2' && leader && !dead;
  const showAdv = mode === 'bgp' && serving && !dead;
  // Status badge, top-right — mirrors the film's NodeBox (name left, badge right).
  const badge = dead ? (
    <span style={{ fontFamily: MONO, fontSize: 11, color: C.red, fontWeight: 600 }}>✕ down</span>
  ) : showLeader ? (
    <span title={G.leader} style={{ fontFamily: MONO, fontSize: 10, color: C.green, border: `1px solid ${C.green}`, borderRadius: 5, padding: '1px 6px', letterSpacing: '0.08em', cursor: 'help' }}>LEADER</span>
  ) : showAdv ? (
    <span title={`${G.BGP}\n\n${G['/32']}`} style={{ fontFamily: MONO, fontSize: 10, color: C.greenLite, border: `1px solid rgba(118,185,0,0.5)`, borderRadius: 5, padding: '1px 6px', letterSpacing: '0.04em', cursor: 'help' }}>ADV /32 → {ip}</span>
  ) : speakerDown ? (
    <span style={{ fontFamily: MONO, fontSize: 10, color: C.amber, border: `1px solid ${C.amber}`, borderRadius: 5, padding: '1px 6px' }}>speaker down</span>
  ) : ineligible ? (
    <span title={G.externalTrafficPolicy} style={{ fontFamily: MONO, fontSize: 10, color: C.faint, border: `1px dashed rgba(255,255,255,0.16)`, borderRadius: 5, padding: '1px 6px', cursor: 'help' }}>skipped</span>
  ) : null;
  return (
    <div style={{ position: 'absolute', left: NODE_X, top: y, width: NODE_W, height: NODE_H, borderRadius: 14, background: dead ? C.redSoft : '#101010', border: `1.6px solid ${bc}`, boxShadow: serving && !dead ? '0 0 30px rgba(118,185,0,0.2)' : 'none', padding: '12px 13px', opacity: dead ? 0.72 : 1 }}>
      {/* header: name (left) + status badge (right) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: DISP, fontSize: 17, fontWeight: 600, color: dead ? C.red : C.ink }}>{node.name}</span>
        {badge}
      </div>
      {/* ip directly under the name (with leader's MAC in L2) */}
      <div style={{ fontFamily: MONO, fontSize: 12, color: C.faint, marginTop: 2 }}>
        {node.ip}
        {showLeader ? ` · is-at ${node.mac}` : ''}
      </div>
      {/* component tags */}
      <div style={{ display: 'flex', gap: 6, marginTop: 11, flexWrap: 'wrap', alignItems: 'center' }}>
        <Tag color={speakerDown ? C.amber : dead ? C.faint : C.green} dim={dead} title={G.speaker}>
          {speakerDown ? 'speaker ✕' : 'speaker'}
        </Tag>
        {controller && (
          <Tag color={C.cyan} dim={dead} title={G.controller}>
            {controllerReady ? 'controller' : 'controller ⟳'}
          </Tag>
        )}
      </div>
      {/* pods, bottom-left (as in the film) */}
      <div style={{ position: 'absolute', left: 13, bottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
        <PodMarker hasPods={hasPods} dead={dead} hit={podHit} />
      </div>
    </div>
  );
}

// A single per-node marker meaning "this node runs ≥1 backend pod of the
// selected Service" — NOT a replica count. The Service's pods land on a
// deterministic 2-of-3 node subset (model.ts → backendNodeIds);
// externalTrafficPolicy=Local only announces from these nodes, which is why
// this marker explains whether a node is eligible.
function PodMarker({ hasPods, dead, hit }: { hasPods: boolean; dead: boolean; hit?: boolean }) {
  const lit = hasPods && !dead;
  const flash = !!hit;
  return (
    <>
      <span
        title={lit ? 'runs a backend pod of this Service' : 'no pod for this Service on this node'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          height: 19,
          padding: '0 7px',
          borderRadius: 6,
          border: lit || flash ? `1px solid ${flash ? C.green : 'rgba(118,185,0,0.5)'}` : `1px dashed rgba(255,255,255,0.14)`,
          background: flash ? C.green : lit ? 'rgba(118,185,0,0.16)' : 'transparent',
          boxShadow: flash ? `0 0 12px ${C.green}` : 'none',
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: 7, background: flash ? '#0a0a0a' : lit ? C.greenLite : 'rgba(255,255,255,0.18)' }} />
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: flash ? '#0a0a0a' : lit ? C.green : C.faint }}>{lit || flash ? 'pod' : 'no pod'}</span>
      </span>
    </>
  );
}

function Tag({ children, color, solid, dim, title }: { children: React.ReactNode; color: string; solid?: boolean; dim?: boolean; title?: string }) {
  return (
    <span title={title} style={{ fontFamily: MONO, fontSize: 10.5, color: solid ? '#0a0a0a' : color, background: solid ? color : dim ? 'transparent' : `rgba(${hexToRgb(color)},0.08)`, border: `1px solid ${solid ? color : `rgba(${hexToRgb(color)},0.4)`}`, borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap', cursor: title ? 'help' : 'default' }}>{children}</span>
  );
}

// ── failover / action banner ────────────────────────────────────
function Banner({ snap }: { snap: SimSnapshot }) {
  const t = snap.transition;
  if (!t || !t.kind) return null;
  const col = toneColor[t.tone];
  // Docked to the empty lower-left corner so it never covers the nodes or the
  // packet path (which live on the right / centre of the stage).
  return (
    <div style={{ position: 'absolute', left: 16, top: 452, width: 380, pointerEvents: 'none' }}>
      <div style={{ display: 'inline-block', minWidth: 300, padding: '11px 18px', borderRadius: 12, background: 'rgba(10,10,10,0.92)', border: `1.5px solid ${col}`, boxShadow: `0 0 28px rgba(${hexToRgb(col)},0.22)` }}>
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '0.14em', color: col, fontWeight: 600 }}>{t.label}</div>
        <div style={{ fontFamily: DISP, fontSize: 15, color: C.dim, marginTop: 4 }}>{t.sub}</div>
        <div style={{ marginTop: 9, height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }}>
          <div style={{ height: '100%', width: `${t.progress * 100}%`, background: col, borderRadius: 3, transition: 'width 0.1s linear' }} />
        </div>
      </div>
    </div>
  );
}

// ── event log ───────────────────────────────────────────────────
function EventLog({ snap }: { snap: SimSnapshot }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [snap.events.length]);
  return (
    <div style={{ position: 'absolute', left: 0, top: 556, width: W, height: H - 556, borderRadius: 14, border: `1px solid ${C.line}`, background: 'rgba(8,10,8,0.6)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderBottom: `1px solid ${C.line2}` }}>
        <span style={{ width: 8, height: 8, borderRadius: 8, background: C.green }} />
        <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.dim }}>MetalLB event log</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint, marginLeft: 'auto' }}>controller + speakers</span>
      </div>
      <div ref={ref} style={{ flex: 1, overflowY: 'auto', padding: '10px 16px', fontFamily: MONO, fontSize: 13.5, lineHeight: 1.7 }}>
        {snap.events.length === 0 ? (
          <div style={{ color: C.faint }}>// create a Service, send traffic, or kill a node to watch MetalLB react…</div>
        ) : (
          snap.events.map((e) => (
            <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ color: C.faint, flexShrink: 0, width: 42 }}>+{e.t.toFixed(1)}s</span>
              <span title={G[e.node]} style={{ color: toneColor[e.level], flexShrink: 0, width: 96, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: G[e.node] ? 'help' : 'default' }}>{e.node}</span>
              <span style={{ color: e.level === 'info' ? C.dim : C.ink }}>{e.msg}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
