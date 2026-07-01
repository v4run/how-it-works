// The lab stage: a two-switch fabric with a trunk and an L3 gateway. Hosts sit
// on access ports coloured by their VLAN. Sending a frame animates it hop by
// hop — showing where it is untagged (access) vs 802.1Q-tagged (trunk), whether
// it is delivered, blocked, or leaks — and a live frame inspector breaks out the
// 802.1Q tag fields.
import React from 'react';
import { C, MONO, DISP, VLANS, vlanColor } from '../design/theme';
import { FitBox } from '../design/atoms';
import { G } from '../design/glossary';
import { LabState, HOSTS, HostDef, hostById, portVlanOf, ipMatchesVlan, Seg } from './model';
import { SimSnapshot, Level } from './useSimulation';

const W = 1300;
const H = 916;
type Pt = { x: number; y: number };

const OFF = 62; // the Topology container's top offset (node coords are global)
const SWA = { x: 130, y: 232, w: 400, h: 78 };
const SWB = { x: 770, y: 232, w: 400, h: 78 };
const GW = { x: 130, y: 92, w: 400, h: 70 };
const trunkY = SWA.y + SWA.h / 2;
const hostY = 348,
  hostW = 120,
  hostH = 88;
const HX: Record<string, number> = { a1: 197, a2: 330, a3: 463, b1: 837, b2: 970, b3: 1103 };
const swRect = (sw: 'A' | 'B') => (sw === 'A' ? SWA : SWB);
const hostCenter = (id: string): Pt => ({ x: HX[id], y: hostY + hostH / 2 });
const accessPort = (id: string): Pt => ({ x: HX[id], y: swRect(hostById(id).sw).y + swRect(hostById(id).sw).h });
const trunkPort = (k: string): Pt => (k === 'A' ? { x: SWA.x + SWA.w, y: trunkY } : { x: SWB.x, y: trunkY });
const gwBottom: Pt = { x: GW.x + GW.w / 2, y: GW.y + GW.h };
const swaTop: Pt = { x: SWA.x + SWA.w / 2, y: SWA.y };

const toneColor: Record<Level, string> = { info: C.dim, ok: C.green, warn: C.amber, err: C.red, tag: C.cyan };

function segPts(seg: Seg): [Pt, Pt] {
  if (seg.kind === 'access') {
    const hid = seg.from.startsWith('host:') ? seg.from.slice(5) : seg.to.slice(5);
    const hc = hostCenter(hid),
      ap = accessPort(hid);
    return seg.from.startsWith('host:') ? [hc, ap] : [ap, hc];
  }
  if (seg.kind === 'trunk') return [trunkPort(seg.from), trunkPort(seg.to)];
  return seg.from === 'GW' ? [gwBottom, swaTop] : [swaTop, gwBottom];
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

export function LabViz({ state, snap }: { state: LabState; snap: SimSnapshot }) {
  return (
    <FitBox max={1} padding={18}>
      <div style={{ width: W, height: H, position: 'relative', fontFamily: DISP }}>
        <Header state={state} />
        <Topology state={state} snap={snap} />
        <FrameInspector state={state} snap={snap} />
        <Outcome snap={snap} />
        <EventLog snap={snap} />
      </div>
    </FitBox>
  );
}

// ── header: legend + selection ──────────────────────────────────
function Header({ state }: { state: LabState }) {
  const src = hostById(state.src);
  const dstName = state.dst === 'broadcast' ? 'broadcast' : hostById(state.dst).name;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: MONO, fontSize: 13, color: C.faint }}>frame</span>
        <span style={{ fontFamily: DISP, fontSize: 19, fontWeight: 700, color: C.ink }}>{src.name}</span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: vlanColor(portVlanOf(state, src.id)) }}>VLAN {portVlanOf(state, src.id)}</span>
        <span style={{ color: C.faint }}>→</span>
        <span style={{ fontFamily: DISP, fontSize: 19, fontWeight: 700, color: C.ink }}>{dstName}</span>
        {state.dst !== 'broadcast' && <span style={{ fontFamily: MONO, fontSize: 12, color: vlanColor(portVlanOf(state, state.dst)) }}>VLAN {portVlanOf(state, state.dst)}</span>}
        {!state.vlansEnabled && <span title={G.VLAN} style={{ fontFamily: MONO, fontSize: 11, color: C.red, border: `1px solid ${C.red}`, borderRadius: 6, padding: '2px 8px', cursor: 'help' }}>VLANs OFF · flat network</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {[10, 20, 30].map((v) => (
          <span key={v} title={`${VLANS[v].name} · ${VLANS[v].subnet} · gw ${VLANS[v].gw}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'help' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: VLANS[v].c }} />
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.dim }}>VLAN {v}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── topology ────────────────────────────────────────────────────
function Topology({ state, snap }: { state: LabState; snap: SimSnapshot }) {
  const walk = snap.flow?.walk ?? null;
  const progress = snap.flow?.progress ?? 0;
  const activeSeg = walk && walk.segs.length ? walk.segs[Math.min(walk.segs.length - 1, Math.floor(progress * walk.segs.length))] : null;
  const reached = new Set(walk?.reached ?? []);
  const sending = !!walk;
  const srcVlan = walk ? walk.srcVlan : -1;

  // full animated polyline
  const path: Pt[] = [];
  if (walk) walk.segs.forEach((seg) => segPts(seg).forEach((p) => path.push(p)));
  const packet = walk && path.length > 1 ? pat(path, progress) : null;

  return (
    <div style={{ position: 'absolute', left: 0, top: OFF, width: W, height: 386 }}>
      {/* links */}
      <svg width={W} height={386} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
        {/* gateway link (router-on-a-stick trunk / SVI uplink) */}
        {state.routing !== 'none' && <line x1={swaTop.x} y1={swaTop.y - OFF} x2={gwBottom.x} y2={gwBottom.y - OFF} stroke={C.steel} strokeWidth={state.routing === 'router' ? 7 : 3} strokeDasharray={state.routing === 'l3' ? '2 5' : 'none'} />}
        {/* trunk / inter-switch link */}
        {state.trunkMode === 'trunk' ? (
          [10, 20, 30].map((v, i) => (
            <line key={v} x1={trunkPort('A').x} y1={trunkY - OFF + (i - 1) * 4} x2={trunkPort('B').x} y2={trunkY - OFF + (i - 1) * 4} stroke={VLANS[v].c} strokeWidth={2.5} opacity={state.allowed.includes(v) ? 0.9 : 0.12} strokeDasharray={state.allowed.includes(v) ? 'none' : '3 5'} />
          ))
        ) : (
          <line x1={trunkPort('A').x} y1={trunkY - OFF} x2={trunkPort('B').x} y2={trunkY - OFF} stroke={C.steel} strokeWidth={4} strokeDasharray="7 6" />
        )}
        {/* access links */}
        {HOSTS.map((h) => {
          const v = portVlanOf(state, h.id);
          return <line key={h.id} x1={HX[h.id]} y1={accessPort(h.id).y - OFF} x2={HX[h.id]} y2={hostCenter(h.id).y - OFF} stroke={vlanColor(v)} strokeWidth={2.5} opacity={sending && v !== srcVlan && !reached.has(h.id) && !walk?.routed ? 0.2 : 0.85} />;
        })}
      </svg>

      {/* gateway */}
      {state.routing !== 'none' && (
        <GwBox state={state} />
      )}
      {/* switches */}
      <SwitchBox rect={SWA} label="SW-A" sub={state.routing === 'l3' ? 'L3 switch · SVIs' : 'switch'} native={state.nativeA} state={state} />
      <SwitchBox rect={SWB} label="SW-B" sub="switch" native={state.nativeB} state={state} />

      {/* trunk / access-link badge */}
      <TrunkBadge state={state} />

      {/* hosts */}
      {HOSTS.map((h) => (
        <HostCard key={h.id} host={h} state={state} selected={state.src === h.id || state.dst === h.id} reached={reached.has(h.id)} sending={sending} srcVlan={srcVlan} landedVlan={walk?.landedVlan ?? -1} />
      ))}

      {/* animated packet + tag chip */}
      {packet && activeSeg && (
        <>
          <div style={{ position: 'absolute', left: packet.x - 8, top: packet.y - OFF - 8, width: 16, height: 16, borderRadius: 16, background: vlanColor(activeSeg.vlan), boxShadow: `0 0 16px ${vlanColor(activeSeg.vlan)}`, border: '2px solid #0a0c0e' }} />
          <div style={{ position: 'absolute', left: packet.x + 14, top: packet.y - OFF - 30, display: 'flex', alignItems: 'center', filter: `drop-shadow(0 0 8px ${vlanColor(activeSeg.vlan)}88)`, pointerEvents: 'none' }}>
            {activeSeg.tagged ? (
              <>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, padding: '3px 6px', background: vlanColor(activeSeg.vlan), color: '#0a0c0e', borderRadius: '5px 0 0 5px' }}>{activeSeg.vlan}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, padding: '3px 8px', background: C.panel2, border: `1px solid ${vlanColor(activeSeg.vlan)}`, borderLeft: 'none', color: C.ink, borderRadius: '0 5px 5px 0' }}>tagged</span>
              </>
            ) : (
              <span style={{ fontFamily: MONO, fontSize: 11, padding: '3px 8px', background: C.panel2, border: `1px dashed ${C.steel}`, color: C.dim, borderRadius: 5 }}>untagged</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SwitchBox({ rect, label, sub, native, state }: { rect: typeof SWA; label: string; sub: string; native: number; state: LabState }) {
  return (
    <div style={{ position: 'absolute', left: rect.x, top: rect.y - OFF, width: rect.w, height: rect.h, borderRadius: 12, background: 'linear-gradient(180deg,#1b2127,#12161a)', border: `1.5px solid #2c343c`, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', paddingLeft: 20 }}>
      <div>
        <div style={{ fontFamily: DISP, fontSize: 20, fontWeight: 700, color: C.ink }}>{label}</div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: C.dim, marginTop: 3 }}>{sub}</div>
      </div>
      {state.trunkMode === 'trunk' && (
        <span title={G['native VLAN']} style={{ marginLeft: 'auto', marginRight: 16, fontFamily: MONO, fontSize: 10.5, color: C.amber, border: `1px solid ${C.amber}`, borderRadius: 5, padding: '2px 7px', cursor: 'help' }}>native {native}</span>
      )}
    </div>
  );
}

function GwBox({ state }: { state: LabState }) {
  const isRouter = state.routing === 'router';
  return (
    <div title={isRouter ? G['router-on-a-stick'] : G.SVI} style={{ position: 'absolute', left: GW.x, top: GW.y - OFF, width: GW.w, height: GW.h, borderRadius: 12, background: 'linear-gradient(180deg,#20262c,#12161a)', border: `1.5px solid ${C.green}`, boxShadow: `0 0 22px ${C.green}33`, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 20, cursor: 'help' }}>
      <div style={{ fontFamily: DISP, fontSize: 18, fontWeight: 700, color: C.ink }}>{isRouter ? 'ROUTER · L3' : 'L3 SWITCH · SVIs'}</div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: C.green, marginTop: 4 }}>
        {state.routableVlans.length ? state.routableVlans.map((v) => (isRouter ? `Gi0/0.${v}` : `vlan${v}`)).join(' · ') : 'no gateways'}
      </div>
    </div>
  );
}

function TrunkBadge({ state }: { state: LabState }) {
  const mid = { x: (trunkPort('A').x + trunkPort('B').x) / 2, y: trunkY - OFF };
  if (state.trunkMode === 'access') {
    return (
      <div title={G['trunk port']} style={{ position: 'absolute', left: mid.x - 120, top: mid.y - 44, width: 240, textAlign: 'center', cursor: 'help' }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.red, background: C.bg, border: `1px solid ${C.red}`, borderRadius: 7, padding: '4px 10px' }}>ACCESS PORT · VLAN {state.linkAccessVlan} only</span>
      </div>
    );
  }
  return (
    <div title={`${G['trunk port']}\n\n${G['allowed-VLAN list']}`} style={{ position: 'absolute', left: mid.x - 120, top: mid.y - 46, width: 240, textAlign: 'center', cursor: 'help' }}>
      <span style={{ fontFamily: MONO, fontSize: 12, color: C.ink, background: C.bg, border: `1.5px solid ${C.ink}`, borderRadius: 7, padding: '4px 10px' }}>802.1Q TRUNK</span>
      <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.dim, marginTop: 5 }}>allowed: {state.allowed.join(', ') || '—'}</div>
    </div>
  );
}

function HostCard({ host, state, selected, reached, sending, srcVlan, landedVlan }: { host: HostDef; state: LabState; selected: boolean; reached: boolean; sending: boolean; srcVlan: number; landedVlan: number }) {
  const v = portVlanOf(state, host.id);
  const col = vlanColor(v);
  const mismatch = state.vlansEnabled && !ipMatchesVlan(state, host);
  const dim = sending && !reached && v !== srcVlan && state.src !== host.id;
  return (
    <div
      style={{
        position: 'absolute',
        left: HX[host.id] - hostW / 2,
        top: hostY - OFF,
        width: hostW,
        height: hostH,
        borderRadius: 11,
        background: C.panel,
        border: `1.5px solid ${reached ? vlanColor(landedVlan >= 0 && reached ? landedVlan : v) : col}`,
        boxShadow: reached ? `0 0 20px ${vlanColor(landedVlan)}` : selected ? `0 0 0 2px rgba(255,255,255,0.22)` : '0 6px 18px rgba(0,0,0,0.4)',
        opacity: dim ? 0.32 : 1,
        padding: '9px 12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 9, height: 9, borderRadius: 2, background: col }} />
        <span style={{ fontFamily: DISP, fontSize: 15, fontWeight: 600, color: C.ink }}>{host.name}</span>
        {mismatch && <span title={`${host.name} has IP ${host.ip} (VLAN ${host.intendedVlan}'s subnet) but its port is in VLAN ${v} — wrong subnet, no working gateway.`} style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11, color: C.red, cursor: 'help' }}>⚠</span>}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.dim, marginTop: 5 }}>{host.ip}</div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: C.faint, marginTop: 3, whiteSpace: 'nowrap' }}>
        <span title={`${G['access port']}\n\nport ${host.port}`} style={{ color: col, cursor: 'help' }}>access · v{v}</span>
      </div>
    </div>
  );
}

// ── 802.1Q frame inspector ──────────────────────────────────────
function FrameInspector({ state, snap }: { state: LabState; snap: SimSnapshot }) {
  const walk = snap.flow?.walk ?? null;
  const progress = snap.flow?.progress ?? 0;
  const seg = walk && walk.segs.length ? walk.segs[Math.min(walk.segs.length - 1, Math.floor(progress * walk.segs.length))] : null;
  const tagged = seg ? seg.tagged : false;
  const vlan = seg ? seg.vlan : portVlanOf(state, state.src);
  const vc = vlanColor(vlan);
  const cell = (label: string, sub: string, color: string, tip?: string, w?: number) => (
    <div title={tip} style={{ minWidth: w ?? 62, padding: '7px 8px', border: `1.5px solid ${color}`, borderRadius: 7, textAlign: 'center', background: C.panel, cursor: tip ? 'help' : 'default' }}>
      <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: C.ink }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.faint, marginTop: 3 }}>{sub}</div>
    </div>
  );
  return (
    <div style={{ position: 'absolute', left: 0, top: 522, width: W, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', color: C.faint, textTransform: 'uppercase' }}>
        {seg ? `frame on ${labelSeg(seg)}` : 'frame at the access port'} · {tagged ? <span style={{ color: vc }}>802.1Q tagged</span> : <span style={{ color: C.dim }}>untagged</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 5 }}>
        {cell('Dst MAC', '6', C.steel)}
        {cell('Src MAC', '6', C.steel)}
        {tagged && (
          <div title={G['802.1Q']} style={{ display: 'flex', gap: 3, padding: '3px', border: `2px solid ${vc}`, borderRadius: 8, background: `${vc}14`, cursor: 'help' }}>
            {cell('TPID', '0x8100', C.green, G.TPID, 66)}
            {cell('PCP', '3b', C.violet, G.PCP, 40)}
            {cell('DEI', '1b', C.violet, G['DEI/CFI'], 40)}
            {cell(`VID ${vlan}`, '12b', vc, G['VLAN ID'], 66)}
          </div>
        )}
        {cell('Type', '2', C.steel, G.EtherType)}
        {cell('Payload', '46–1500', C.steelDim)}
        {cell('FCS', '4', C.steel, G.FCS)}
      </div>
      {tagged && <div title={G['baby giant']} style={{ fontFamily: MONO, fontSize: 10.5, color: C.amber, cursor: 'help' }}>+4 bytes → up to ~1522 (baby giant)</div>}
    </div>
  );
}
const labelSeg = (seg: Seg): string => (seg.kind === 'access' ? 'access link' : seg.kind === 'trunk' ? 'the trunk' : 'the router link');

// ── outcome banner ──────────────────────────────────────────────
function Outcome({ snap }: { snap: SimSnapshot }) {
  const walk = snap.flow?.walk;
  if (!walk) return null;
  const done = (snap.flow?.progress ?? 0) > 0.98;
  const col = walk.outcome === 'delivered' ? C.green : walk.outcome === 'leak' ? C.amber : C.red;
  const icon = walk.outcome === 'delivered' ? '✓ delivered' : walk.outcome === 'leak' ? '⚠ leaked' : '✕ blocked';
  return (
    <div style={{ position: 'absolute', left: 8, top: 448, width: W - 16, opacity: done ? 1 : 0.55, transition: 'opacity 0.2s' }}>
      <div style={{ display: 'inline-flex', flexDirection: 'column', maxWidth: W - 40, padding: '9px 16px', borderRadius: 11, background: 'rgba(10,12,14,0.92)', border: `1.5px solid ${col}` }}>
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '0.1em', color: col, fontWeight: 700 }}>
          {icon} · {walk.reason}
        </div>
        <div style={{ fontFamily: DISP, fontSize: 13.5, color: C.dim, marginTop: 5, lineHeight: 1.45 }}>{walk.detail}</div>
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
    <div style={{ position: 'absolute', left: 0, top: 600, width: W, height: H - 600, borderRadius: 13, border: `1px solid ${C.line}`, background: 'rgba(12,16,18,0.6)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderBottom: `1px solid ${C.line2}` }}>
        <span style={{ width: 8, height: 8, borderRadius: 8, background: C.green }} />
        <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.dim }}>frame trace</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint, marginLeft: 'auto' }}>untagged · tagged · outcome</span>
      </div>
      <div ref={ref} style={{ flex: 1, overflowY: 'auto', padding: '10px 16px', fontFamily: MONO, fontSize: 13, lineHeight: 1.65 }}>
        {snap.events.length === 0 ? (
          <div style={{ color: C.faint }}>// assign port VLANs, tune the trunk, then send a frame to trace its path…</div>
        ) : (
          snap.events.map((e) => (
            <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span title={G[e.node]} style={{ color: toneColor[e.level], flexShrink: 0, width: 96, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: G[e.node] ? 'help' : 'default' }}>{e.node}</span>
              <span style={{ color: e.level === 'info' ? C.dim : e.level === 'tag' ? C.cyan : C.ink }}>{e.msg}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
