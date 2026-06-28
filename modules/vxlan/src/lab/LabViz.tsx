// The lab stage: a spine-leaf fabric with the launched packet animating across
// it (encapsulated through the underlay, decapsulated on the far leaf), a live
// header-stack inspector, the EVPN route / per-VTEP MAC tables, and the event
// log.
import React from 'react';
import { C, MONO, DISP, UI, hexToRgb } from '../design/theme';
import {
  LabState,
  LEAVES,
  SPINES,
  leafName,
  leafLoopback,
  hostsOnLeaf,
  segmentById,
  shortMac,
  hostById,
} from './model';
import { evpnRoutes, macTables, HeaderLayer } from './net';
import { SimSnapshot } from './useSimulation';

const W = 1120;

// ── geometry ─────────────────────────────────────────────────────────────────
const MARGIN = 74;
const leafCx = (i: number) => MARGIN + (i + 0.5) * ((W - 2 * MARGIN) / LEAVES);
const spineCx = (j: number) => W / 2 + (j - (SPINES - 1) / 2) * 300;
const SY_TOP = 44, SY_H = 56, SYC = SY_TOP + SY_H / 2;
const LY_TOP = 230, LY_H = 64, LYC = LY_TOP + LY_H / 2;
const SPINE_W = 168, LEAF_W = 178;
const HOST_TOP = 356, HOST_H = 52, HOST_GAP = 62, HOST_W = 168;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function LabViz({ state, snap }: { state: LabState; snap: SimSnapshot }) {
  const routes = evpnRoutes(state);
  const tables = macTables(state, snap.learned);
  const flow = snap.flow;
  const plan = flow?.plan ?? null;

  // host → {leafIdx, slot}
  const slotOf = (hostId: string): { leafIdx: number; slot: number } => {
    const h = hostById(state, hostId);
    if (!h) return { leafIdx: 0, slot: 0 };
    const slot = hostsOnLeaf(state, h.leafIdx).findIndex((x) => x.id === hostId);
    return { leafIdx: h.leafIdx, slot: Math.max(0, slot) };
  };
  const hostCy = (slot: number) => HOST_TOP + slot * HOST_GAP + HOST_H / 2;

  const nodeCoord = (n: { type: string; id?: string; idx?: number }): [number, number] => {
    if (n.type === 'host' && n.id) {
      const { leafIdx, slot } = slotOf(n.id);
      return [leafCx(leafIdx), hostCy(slot)];
    }
    if (n.type === 'spine') return [spineCx(n.idx ?? 0), SYC];
    return [leafCx(n.idx ?? 0), LYC];
  };

  // packet position along the path
  let pkt: { x: number; y: number } | null = null;
  if (flow && plan && (flow.phase === 'unicast' || flow.phase === 'blocked')) {
    const coords = plan.pathNodes.map(nodeCoord);
    const nSeg = Math.max(1, coords.length - 1);
    const g = flow.packetProgress * nSeg;
    const i = Math.min(nSeg - 1, Math.floor(g));
    const f = g - i;
    pkt = { x: lerp(coords[i][0], coords[i + 1][0], f), y: lerp(coords[i][1], coords[i + 1][1], f) };
  }

  const H = HOST_TOP + maxHostsPerLeaf(state) * HOST_GAP + 16;
  const srcId = state.srcHostId;
  const dstId = state.dstHostId;

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '18px 22px 28px' }}>
      <Banner state={state} snap={snap} />

      {/* Fabric diagram */}
      <div style={{ background: 'rgba(255,255,255,0.012)', border: `1px solid ${C.line}`, borderRadius: 14, padding: '6px 10px 2px', marginTop: 12 }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxHeight: 560 }}>
          {/* layer labels */}
          <text x={14} y={SYC - 30} fontFamily={MONO} fontSize={12} fill={C.steel} letterSpacing="0.1em">UNDERLAY</text>
          <text x={14} y={SYC - 14} fontFamily={MONO} fontSize={10.5} fill={C.faint}>routed IP · ECMP</text>
          <text x={14} y={LYC - 10} fontFamily={MONO} fontSize={12} fill={C.green} letterSpacing="0.1em">VTEPs</text>
          <text x={14} y={HOST_TOP + 6} fontFamily={MONO} fontSize={12} fill={C.dim} letterSpacing="0.1em">HOSTS</text>

          {/* spine ↔ leaf links */}
          {Array.from({ length: SPINES }).map((_, sj) =>
            Array.from({ length: LEAVES }).map((_, li) => (
              <line key={`l${sj}-${li}`} x1={spineCx(sj)} y1={SY_TOP + SY_H} x2={leafCx(li)} y2={LY_TOP} stroke={C.steelLine} strokeWidth={1} opacity={0.45} />
            )),
          )}

          {/* tunnel arc when a packet is encapsulated across the fabric */}
          {plan && plan.crossesFabric && (
            <path
              d={`M ${leafCx(plan.ingressLeaf)} ${LY_TOP} C ${leafCx(plan.ingressLeaf)} ${SYC - 40}, ${leafCx(plan.egressLeaf)} ${SYC - 40}, ${leafCx(plan.egressLeaf)} ${LY_TOP}`}
              fill="none"
              stroke={C.green}
              strokeWidth={2}
              strokeDasharray="3 7"
              opacity={flow && flow.encapsulated ? 0.85 : 0.18}
            />
          )}

          {/* flood / IMET replication lines */}
          {flow && flow.phase === 'flood' && plan &&
            plan.floodTargets.map((li) => {
              const x2 = leafCx(plan.ingressLeaf) + (leafCx(li) - leafCx(plan.ingressLeaf)) * flow.floodProgress;
              return <line key={`f${li}`} x1={leafCx(plan.ingressLeaf)} y1={LY_TOP - 14} x2={x2} y2={LY_TOP - 14} stroke={C.amber} strokeWidth={2.5} strokeDasharray="4 6" strokeLinecap="round" />;
            })}

          {/* host ↔ leaf links */}
          {state.hosts.map((h) => {
            const slot = hostsOnLeaf(state, h.leafIdx).findIndex((x) => x.id === h.id);
            return <line key={`hl${h.id}`} x1={leafCx(h.leafIdx)} y1={LY_TOP + LY_H} x2={leafCx(h.leafIdx)} y2={hostCy(slot) - HOST_H / 2} stroke={C.line} strokeWidth={1} />;
          })}

          {/* spines */}
          {Array.from({ length: SPINES }).map((_, j) => {
            const rr = state.ctrlPlane === 'evpn';
            const activeSpine = !!(flow && plan && plan.crossesFabric && plan.outcome === 'delivered' && plan.spine === j);
            return (
              <g key={`s${j}`}>
                <rect
                  x={spineCx(j) - SPINE_W / 2}
                  y={SY_TOP}
                  width={SPINE_W}
                  height={SY_H}
                  rx={9}
                  fill={C.panel}
                  stroke={activeSpine ? C.steel : rr ? C.greenEdge : C.steelLine}
                  strokeWidth={activeSpine ? 2.2 : 1.4}
                  style={{ filter: activeSpine ? 'drop-shadow(0 0 10px rgba(111,147,184,0.6))' : 'none' }}
                />
                <text x={spineCx(j)} y={SY_TOP + 22} textAnchor="middle" fontFamily={DISP} fontWeight={600} fontSize={15} fill={C.ink}>Spine-{j + 1}</text>
                <text x={spineCx(j)} y={SY_TOP + 40} textAnchor="middle" fontFamily={MONO} fontSize={10.5} fill={rr ? C.green : C.dim}>
                  {rr ? 'MP-BGP route reflector' : 'IP transit'}
                </text>
              </g>
            );
          })}

          {/* leaves (VTEPs) */}
          {Array.from({ length: LEAVES }).map((_, i) => {
            const involved = plan && (plan.ingressLeaf === i || (plan.outcome === 'delivered' && plan.egressLeaf === i));
            const isIngress = plan?.ingressLeaf === i;
            return (
              <g key={`lf${i}`}>
                <rect
                  x={leafCx(i) - LEAF_W / 2}
                  y={LY_TOP}
                  width={LEAF_W}
                  height={LY_H}
                  rx={10}
                  fill={C.panel}
                  stroke={involved ? C.green : C.steelLine}
                  strokeWidth={involved ? 1.8 : 1.2}
                  style={{ filter: involved ? `drop-shadow(0 0 10px ${C.greenGlow})` : 'none' }}
                />
                <text x={leafCx(i)} y={LY_TOP + 24} textAnchor="middle" fontFamily={MONO} fontSize={10} fill={C.green} letterSpacing="0.12em">VTEP</text>
                <text x={leafCx(i)} y={LY_TOP + 42} textAnchor="middle" fontFamily={DISP} fontWeight={600} fontSize={15} fill={C.ink}>{leafName(i)}</text>
                <text x={leafCx(i)} y={LY_TOP + 57} textAnchor="middle" fontFamily={MONO} fontSize={10.5} fill={C.dim}>lo {leafLoopback(i)}</text>
                {isIngress && flow && (
                  <text x={leafCx(i)} y={LY_TOP - 24} textAnchor="middle" fontFamily={MONO} fontSize={11} fill={C.green}>ingress</text>
                )}
              </g>
            );
          })}

          {/* hosts */}
          {state.hosts.map((h) => {
            const slot = hostsOnLeaf(state, h.leafIdx).findIndex((x) => x.id === h.id);
            const seg = segmentById(state, h.segmentId);
            const cx = leafCx(h.leafIdx);
            const cy = hostCy(slot);
            const isSrc = h.id === srcId;
            const isDst = h.id === dstId;
            const col = seg?.color ?? C.dim;
            return (
              <g key={h.id}>
                <rect
                  x={cx - HOST_W / 2}
                  y={cy - HOST_H / 2}
                  width={HOST_W}
                  height={HOST_H}
                  rx={8}
                  fill={`rgba(${hexToRgb(col)},0.12)`}
                  stroke={isSrc || isDst ? col : `rgba(${hexToRgb(col)},0.5)`}
                  strokeWidth={isSrc || isDst ? 2 : 1.2}
                />
                <circle cx={cx - HOST_W / 2 + 14} cy={cy - 14} r={4} fill={col} />
                <text x={cx - HOST_W / 2 + 26} y={cy - 10} fontFamily={DISP} fontWeight={600} fontSize={13} fill={C.ink}>{h.name}</text>
                <text x={cx - HOST_W / 2 + 26} y={cy + 4} fontFamily={MONO} fontSize={9.5} fill={col}>mac {shortMac(h.mac)}</text>
                <text x={cx - HOST_W / 2 + 26} y={cy + 16} fontFamily={MONO} fontSize={9.5} fill={C.dim}>{h.ip}</text>
                <text x={cx + HOST_W / 2 - 10} y={cy - 10} textAnchor="end" fontFamily={MONO} fontSize={9.5} fill={col}>VNI {seg?.vni}</text>
                {(isSrc || isDst) && (
                  <text x={cx + HOST_W / 2 - 10} y={cy + 16} textAnchor="end" fontFamily={MONO} fontSize={10} fontWeight={600} fill={col}>{isSrc ? 'SRC' : 'DST'}</text>
                )}
              </g>
            );
          })}

          {/* the packet */}
          {pkt && flow && (
            <g transform={`translate(${pkt.x}, ${pkt.y})`}>
              <rect
                x={-58}
                y={-15}
                width={116}
                height={30}
                rx={7}
                fill={flow.blocked ? C.red : flow.encapsulated ? C.green : 'rgba(255,255,255,0.14)'}
                stroke={flow.blocked ? C.red : flow.encapsulated ? C.green : C.lineStrong}
                strokeWidth={1.5}
                style={{ filter: flow.encapsulated ? `drop-shadow(0 0 12px ${C.greenGlow})` : 'none' }}
              />
              <text x={0} y={4} textAnchor="middle" fontFamily={MONO} fontWeight={600} fontSize={11.5} fill={flow.encapsulated || flow.blocked ? '#0a0a0a' : C.ink}>
                {flow.blocked ? '✕ blocked' : flow.encapsulated ? 'VXLAN⟨frame⟩' : 'frame'}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Header stack + flow steps */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 14, marginTop: 14 }}>
        <HeaderStack flow={flow} />
        <FlowSteps snap={snap} />
      </div>

      {/* Control-plane tables + event log */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14, marginTop: 14 }}>
        {state.ctrlPlane === 'evpn' ? <RouteTable routes={routes} /> : <MacTables tables={tables} />}
        <EventLog snap={snap} />
      </div>
    </div>
  );
}

function maxHostsPerLeaf(state: LabState): number {
  let m = 1;
  for (let i = 0; i < LEAVES; i++) m = Math.max(m, hostsOnLeaf(state, i).length);
  return m;
}

// ── status banner ────────────────────────────────────────────────────────────
function Banner({ state, snap }: { state: LabState; snap: SimSnapshot }) {
  const flow = snap.flow;
  let label = 'Build a virtual network, then send a frame.';
  let col = C.dim;
  if (flow) {
    const o = flow.plan.outcome;
    if (o === 'delivered') {
      label = flow.phase === 'done' ? `Delivered ${flow.plan.src.name} → ${flow.plan.dst?.name} on VNI ${flow.plan.segment?.vni}` : `Forwarding ${flow.plan.src.name} → ${flow.plan.dst?.name}…`;
      col = C.green;
    } else if (o === 'isolated') {
      label = `Isolated — ${flow.plan.src.name} and ${flow.plan.dst?.name} are on different VNIs`;
      col = C.red;
    }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <span style={{ width: 9, height: 9, borderRadius: 9, background: col, boxShadow: `0 0 10px ${col}` }} />
      <span style={{ fontFamily: DISP, fontSize: 16, fontWeight: 600, color: C.ink }}>{label}</span>
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <Tag on color={C.green}>{state.ctrlPlane === 'evpn' ? 'BGP EVPN' : 'flood-and-learn'}</Tag>
        <Tag on={state.ctrlPlane === 'evpn' && state.arpSuppression} color={C.green}>ARP suppression {state.ctrlPlane === 'evpn' ? (state.arpSuppression ? 'on' : 'off') : 'n/a'}</Tag>
        <Tag on={state.jumbo} color={state.jumbo ? C.green : C.amber}>MTU {state.jumbo ? '9000' : '1500'}</Tag>
      </span>
    </div>
  );
}
function Tag({ children, color, on }: { children: React.ReactNode; color: string; on?: boolean }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: 11, padding: '4px 9px', borderRadius: 6, border: `1px solid ${on ? color : C.line}`, color: on ? color : C.faint, background: on ? `rgba(${hexToRgb(color.startsWith('#') ? color : '#888888')},0.08)` : 'transparent' }}>{children}</span>
  );
}

// ── panels ───────────────────────────────────────────────────────────────────
function Panel({ title, hint, children, minH }: { title: string; hint?: string; children: React.ReactNode; minH?: number }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.012)', border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, minHeight: minH }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.green }}>{title}</span>
        {hint && <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function HeaderStack({ flow }: { flow: SimSnapshot['flow'] }) {
  const headers: HeaderLayer[] | null = flow?.plan.headers ?? null;
  const intra = flow?.plan.intraLeaf;
  return (
    <Panel title="Packet on the wire" hint={flow ? (intra ? 'local switching — no encap' : flow.plan.outcome === 'delivered' ? 'MAC-in-UDP' : '—') : 'launch a flow'}>
      {!headers ? (
        <div style={{ fontFamily: UI, fontSize: 13, color: C.dim, padding: '14px 4px' }}>
          {flow && flow.plan.outcome === 'isolated'
            ? 'No packet is built — the destination is on a different VNI, so the ingress VTEP drops it.'
            : 'Pick a source and destination on the right, then Send a frame to see the headers the VTEP builds.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {headers.map((h, i) => {
            const col = h.kind === 'vxlan' ? C.green : h.kind === 'outer' ? C.steel : C.ink;
            const bg = h.kind === 'vxlan' ? C.greenSoft : h.kind === 'outer' ? C.steelSoft : 'rgba(255,255,255,0.03)';
            const bord = h.kind === 'vxlan' ? C.greenLine : h.kind === 'outer' ? C.steelLine : C.line;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: bg, border: `1px solid ${bord}`, borderRadius: 8, padding: '8px 11px' }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint, width: 34, flexShrink: 0 }}>{h.bytes}</span>
                <span style={{ fontFamily: DISP, fontSize: 13.5, fontWeight: 600, color: col, width: 116, flexShrink: 0 }}>{h.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.dim }}>{h.value}</span>
              </div>
            );
          })}
          {!intra && flow?.plan.outcome === 'delivered' && (
            <div style={{ fontFamily: MONO, fontSize: 11, color: flow.plan.fragWarn ? C.amber : C.faint, marginTop: 2 }}>
              {flow.plan.fragWarn ? '⚠ 1550 B > underlay MTU 1500 → fragment, or dropped (outer DF bit)' : '+50 B overlay overhead · fits jumbo underlay MTU'}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function FlowSteps({ snap }: { snap: SimSnapshot }) {
  const steps = snap.flow?.plan.steps ?? [];
  const shown = snap.events.filter((e) => e.t > 0).length; // proxy for revealed steps
  return (
    <Panel title="This flow" hint={snap.flow ? `${steps.length} steps` : ''} minH={120}>
      {steps.length === 0 ? (
        <div style={{ fontFamily: UI, fontSize: 13, color: C.dim, padding: '10px 4px' }}>The step-by-step path of your frame will appear here.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {steps.map((st, i) => {
            const active = i < Math.max(1, shown);
            const col = st.kind === 'err' ? C.red : st.kind === 'warn' ? C.amber : st.kind === 'ok' ? C.green : C.steel;
            return (
              <div key={st.key} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', opacity: active ? 1 : 0.35, transition: 'opacity 0.2s' }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: col, marginTop: 1, width: 16, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontFamily: DISP, fontSize: 13, fontWeight: 600, color: active ? C.ink : C.dim }}>{st.title}</span>
                  <span style={{ display: 'block', fontFamily: UI, fontSize: 11.5, color: C.dim, lineHeight: 1.4 }}>{st.detail}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function RouteTable({ routes }: { routes: ReturnType<typeof evpnRoutes> }) {
  return (
    <Panel title="EVPN route table" hint={`${routes.length} routes · MP-BGP L2VPN EVPN`} minH={150}>
      {routes.length === 0 ? (
        <Empty>No hosts yet — add hosts to advertise routes.</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Row head cells={['', 'VNI', 'MAC', 'IP', 'VTEP']} />
          {routes.map((r, i) => (
            <Row
              key={i}
              color={r.color}
              cells={[r.label, String(r.vni), r.mac ? shortMac(r.mac) : '— (IMET)', r.ip ?? '—', r.vtep]}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

function MacTables({ tables }: { tables: Record<number, ReturnType<typeof macTables>[number]> }) {
  const leaves = Object.keys(tables).map(Number).sort((a, b) => a - b);
  return (
    <Panel title="Per-VTEP MAC tables" hint="flood-and-learn · data-plane learning" minH={150}>
      {leaves.length === 0 ? (
        <Empty>No hosts yet.</Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {leaves.map((li) => (
            <div key={li}>
              <div style={{ fontFamily: MONO, fontSize: 11, color: C.green, marginBottom: 4 }}>{leafName(li)}</div>
              {tables[li].length === 0 ? (
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint }}>empty</div>
              ) : (
                tables[li].map((e, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontFamily: MONO, fontSize: 10.5, color: e.local ? C.dim : C.ink, padding: '2px 0' }}>
                    <span style={{ width: 6, height: 6, borderRadius: 6, background: e.color, alignSelf: 'center', flexShrink: 0 }} />
                    <span style={{ width: 50 }}>{shortMac(e.mac)}</span>
                    <span style={{ color: C.faint }}>{e.vni}</span>
                    <span style={{ marginLeft: 'auto', color: e.local ? C.faint : C.steel }}>{e.local ? 'local' : e.vtep}</span>
                  </div>
                ))
              )}
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1', fontFamily: MONO, fontSize: 10.5, color: C.faint, marginTop: 2 }}>
            Remote entries appear only after a flow has flooded and learned them.
          </div>
        </div>
      )}
    </Panel>
  );
}

function Row({ cells, head, color }: { cells: string[]; head?: boolean; color?: string }) {
  const widths = ['64px', '54px', '64px', '1fr', '78px'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: widths.join(' '), gap: 8, alignItems: 'center', padding: '3px 0', borderBottom: head ? `1px solid ${C.line}` : 'none' }}>
      {cells.map((c, i) => (
        <span key={i} style={{ fontFamily: MONO, fontSize: head ? 10 : 11, color: head ? C.faint : i === 0 ? color ?? C.dim : C.dim, letterSpacing: head ? '0.1em' : 0, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {i === 0 && !head && color && <span style={{ width: 6, height: 6, borderRadius: 6, background: color, flexShrink: 0 }} />}
          {c}
        </span>
      ))}
    </div>
  );
}

function EventLog({ snap }: { snap: SimSnapshot }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [snap.events]);
  return (
    <Panel title="Reconcile / event log" hint="live" minH={150}>
      <div ref={ref} style={{ maxHeight: 190, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {snap.events.length === 0 ? (
          <Empty>Send a frame to stream the operations each VTEP runs.</Empty>
        ) : (
          snap.events.map((e) => {
            const col = e.level === 'err' ? C.red : e.level === 'warn' ? C.amber : e.level === 'ok' ? C.green : C.steel;
            return (
              <div key={e.id} style={{ display: 'flex', gap: 8, fontFamily: MONO, fontSize: 10.5, lineHeight: 1.45 }}>
                <span style={{ color: C.faint, width: 30, flexShrink: 0, textAlign: 'right' }}>{e.t.toFixed(1)}</span>
                <span style={{ color: col, width: 50, flexShrink: 0 }}>{e.node}</span>
                <span style={{ color: C.dim }}>{e.msg}</span>
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: UI, fontSize: 12.5, color: C.faint, padding: '8px 2px' }}>{children}</div>;
}
