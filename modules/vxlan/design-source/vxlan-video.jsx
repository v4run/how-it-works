// VXLAN deep-dive animated explainer — scenes for the animations.jsx engine.
// NVIDIA scheme: signature green #76B900 on near-black. Green = overlay/VXLAN,
// steel-blue = underlay/physical fabric, amber = flood/legacy/warning.

const { Stage, Sprite, useTime, useSprite, Easing, interpolate, animate, clamp } = window;

// ── palette ─────────────────────────────────────────────────────────────────
const C = {
  bg: '#0a0a0a',
  panel: '#151516', panel2: '#1b1b1d', panelHi: '#222226',
  line: 'rgba(255,255,255,0.10)', lineStrong: 'rgba(255,255,255,0.20)',
  green: '#76B900', greenSoft: 'rgba(118,185,0,0.14)', greenLine: 'rgba(118,185,0,0.55)',
  greenGlow: 'rgba(118,185,0,0.35)',
  text: '#f3f3f0', dim: '#8f8f8a', faint: '#5b5b56',
  steel: '#6f93b8', steelSoft: 'rgba(111,147,184,0.14)', steelLine: 'rgba(111,147,184,0.5)',
  amber: '#d6953f', amberSoft: 'rgba(214,149,63,0.14)', amberLine: 'rgba(214,149,63,0.5)',
  red: '#cf5b43',
};
const F = {
  d: "'Space Grotesk', system-ui, sans-serif",
  s: "'IBM Plex Sans', system-ui, sans-serif",
  m: "'IBM Plex Mono', ui-monospace, monospace",
};

// ── tiny reveal helpers (read sprite-local time) ─────────────────────────────
function Rise({ at = 0, dur = 0.55, y = 20, x = 0, style, children }) {
  const { localTime } = useSprite();
  const p = Easing.easeOutCubic(clamp((localTime - at) / dur, 0, 1));
  return (
    <div style={{ opacity: p, transform: `translate(${(1 - p) * x}px, ${(1 - p) * y}px)`, willChange: 'transform, opacity', ...style }}>
      {children}
    </div>
  );
}
function Pop({ at = 0, dur = 0.55, style, children }) {
  const { localTime } = useSprite();
  const s = Easing.easeOutBack(clamp((localTime - at) / dur, 0, 1));
  const o = clamp((localTime - at) / (dur * 0.55), 0, 1);
  return (
    <div style={{ opacity: o, transform: `scale(${0.55 + 0.45 * s})`, transformOrigin: 'center', willChange: 'transform, opacity', ...style }}>
      {children}
    </div>
  );
}
// eased 0..1 gate
function gate(localTime, at, dur = 0.5, ease = Easing.easeOutCubic) {
  return ease(clamp((localTime - at) / dur, 0, 1));
}

// ── scene shell: padding + fade-in/out envelope ──────────────────────────────
function SceneFrame({ children, pad = '120px 132px 96px' }) {
  const { localTime, duration } = useSprite();
  const fin = clamp(localTime / 0.5, 0, 1);
  const fout = clamp((duration - localTime) / 0.5, 0, 1);
  const op = Math.min(fin, fout);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: op, padding: pad, boxSizing: 'border-box' }}>
      {children}
    </div>
  );
}

function SceneTitle({ title, sub, at = 0, maxW = 1320 }) {
  return (
    <div style={{ marginBottom: 44 }}>
      <Rise at={at + 0.06} dur={0.55}>
        <div style={{ font: `600 58px/1.05 ${F.d}`, color: C.text, letterSpacing: '-0.02em', maxWidth: maxW, textWrap: 'pretty' }}>{title}</div>
      </Rise>
      {sub && (
        <Rise at={at + 0.16} dur={0.55}>
          <div style={{ font: `400 23px/1.5 ${F.s}`, color: C.dim, marginTop: 16, maxWidth: 1000, textWrap: 'pretty' }}>{sub}</div>
        </Rise>
      )}
    </div>
  );
}

// generic schematic box (switch / host / node)
function Box({ x, y, w, h, title, sub, tag, color = C.steel, active = false, fill = C.panel, at, glow }) {
  const { localTime } = useSprite();
  const o = at == null ? 1 : gate(localTime, at, 0.5);
  const sc = at == null ? 1 : (0.85 + 0.15 * Easing.easeOutBack(clamp((localTime - at) / 0.5, 0, 1)));
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w, height: h,
      background: fill, border: `1.5px solid ${active ? color : C.line}`, borderRadius: 11,
      boxShadow: active ? `inset 0 0 0 1px ${color}, 0 0 34px ${glow || color + '44'}` : '0 1px 0 rgba(255,255,255,0.03)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
      opacity: o, transform: `scale(${sc})`, transformOrigin: 'center', boxSizing: 'border-box',
    }}>
      {tag && <div style={{ font: `500 11px ${F.m}`, letterSpacing: '0.14em', color: active ? color : C.faint, textTransform: 'uppercase' }}>{tag}</div>}
      <div style={{ font: `600 19px ${F.d}`, color: C.text }}>{title}</div>
      {sub && <div style={{ font: `500 12.5px ${F.m}`, color: C.dim, letterSpacing: '0.03em' }}>{sub}</div>}
    </div>
  );
}

// chip / pill label
function Chip({ children, color = C.green, solid = false, style }) {
  return (
    <span style={{
      font: `500 13px ${F.m}`, letterSpacing: '0.06em',
      color: solid ? '#0a0a0a' : color, background: solid ? color : 'transparent',
      border: `1px solid ${color}${solid ? '' : '66'}`, borderRadius: 6, padding: '5px 11px',
      whiteSpace: 'nowrap', ...style,
    }}>{children}</span>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCENE 00 — COLD OPEN
// ════════════════════════════════════════════════════════════════════════════
function SceneOpen() {
  const { localTime } = useSprite();
  const word = 'VXLAN';
  const underline = gate(localTime, 1.5, 1.0, Easing.easeInOutCubic);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Rise at={0.2} dur={0.6}>
        <div style={{ font: `500 17px ${F.m}`, letterSpacing: '0.4em', color: C.green, marginBottom: 30, textAlign: 'center' }}>VIRTUAL EXTENSIBLE LAN</div>
      </Rise>
      <div style={{ display: 'flex', gap: 6 }}>
        {word.split('').map((ch, i) => {
          const p = Easing.easeOutBack(clamp((localTime - (0.35 + i * 0.08)) / 0.6, 0, 1));
          return (
            <span key={i} style={{
              font: `700 168px ${F.d}`, color: C.text, letterSpacing: '-0.03em',
              opacity: clamp(p, 0, 1), transform: `translateY(${(1 - p) * 40}px)`, display: 'inline-block',
            }}>{ch}</span>
          );
        })}
      </div>
      <div style={{ width: 560, height: 3, background: C.line, marginTop: 8, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${underline * 100}%`, background: C.green }} />
      </div>
      <Rise at={1.9} dur={0.7}>
        <div style={{ font: `400 30px/1.5 ${F.s}`, color: C.dim, marginTop: 40, textAlign: 'center', maxWidth: 980, textWrap: 'pretty' }}>
          Layer-2 segments, stretched across a routed Layer-3 fabric.
        </div>
      </Rise>
      <Rise at={2.6} dur={0.7}>
        <div style={{ display: 'flex', gap: 14, marginTop: 38 }}>
          <Chip>VTEPs</Chip><Chip>VNI</Chip><Chip>BGP EVPN</Chip><Chip>Spine-Leaf</Chip>
        </div>
      </Rise>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCENE 01 — THE PROBLEM
// ════════════════════════════════════════════════════════════════════════════
function SceneProblem() {
  const { localTime } = useSprite();
  // VLAN counter ceiling
  const vlanCount = Math.round(interpolate([2.0, 3.2], [0, 4094], Easing.easeOutExpo)(localTime));
  return (
    <SceneFrame>
      <SceneTitle title="The data center went routed. Layer 2 didn't follow." sub="Modern fabrics route everything as IP — but workloads still expect a flat L2 segment, and the freedom to live (and move) anywhere on it." />
      <div style={{ position: 'relative', height: 580, marginTop: 8 }}>
        {/* left: L2 broadcast domain blocked by L3 */}
        <Rise at={0.5} dur={0.6} style={{ position: 'absolute', left: 0, top: 20, width: 720 }}>
          <div style={{ font: `500 13px ${F.m}`, letterSpacing: '0.16em', color: C.faint, marginBottom: 20 }}>PROBLEM 1 — L2 STOPS AT THE ROUTER</div>
        </Rise>
        <Box x={0} y={80} w={210} h={120} tag="Rack A" title="VM" sub="10.0.0.5 / vlan 10" color={C.green} active at={0.7} />
        <Box x={510} y={80} w={210} h={120} tag="Rack B" title="VM ′" sub="same L2 segment" color={C.green} active at={2.4} glow={C.greenGlow} />
        {/* routed core in the middle */}
        <Box x={258} y={70} w={204} h={140} tag="L3 core" title="Routed IP" sub="no broadcast" color={C.steel} active at={1.0} />
        {/* broadcast wave hitting wall */}
        <svg width={720} height={300} style={{ position: 'absolute', left: 0, top: 70, pointerEvents: 'none' }}>
          <line x1={210} y1={70} x2={258} y2={70} stroke={C.green} strokeWidth={2} strokeDasharray="5 5"
            style={{ opacity: gate(localTime, 1.4, 0.5) }} />
          <line x1={462} y1={70} x2={510} y2={70} stroke={C.steel} strokeWidth={2} strokeDasharray="5 5"
            style={{ opacity: gate(localTime, 2.2, 0.5) }} />
          <text x={360} y={250} textAnchor="middle" fontFamily={F.m} fontSize={15} fill={C.red}
            style={{ opacity: gate(localTime, 1.8, 0.5) }}>✕ broadcast / ARP can't cross</text>
        </svg>

        {/* right: VLAN 12-bit ceiling */}
        <Rise at={1.6} dur={0.6} style={{ position: 'absolute', right: 0, top: 20, width: 560, textAlign: 'right' }}>
          <div style={{ font: `500 13px ${F.m}`, letterSpacing: '0.16em', color: C.faint, marginBottom: 20 }}>PROBLEM 2 — ONLY 4,094 VLANS</div>
        </Rise>
        <Rise at={1.9} dur={0.6} style={{ position: 'absolute', right: 0, top: 80, width: 560 }}>
          <div style={{ background: C.panel, border: `1.5px solid ${C.line}`, borderRadius: 14, padding: '34px 38px' }}>
            <div style={{ font: `500 14px ${F.m}`, color: C.dim, marginBottom: 10 }}>802.1Q VLAN ID — 12 bits</div>
            <div style={{ font: `600 76px ${F.d}`, color: C.amber, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
              {vlanCount.toLocaleString()}
            </div>
            <div style={{ font: `400 18px/1.5 ${F.s}`, color: C.dim, marginTop: 8 }}>
              usable segments — a hard ceiling for multi-tenant clouds with thousands of tenants.
            </div>
          </div>
        </Rise>
        <Rise at={3.4} dur={0.6} style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center', background: C.greenSoft, border: `1px solid ${C.greenLine}`, borderRadius: 12, padding: '18px 28px' }}>
            <div style={{ width: 9, height: 9, borderRadius: 9, background: C.green }} />
            <div style={{ font: `500 21px ${F.s}`, color: C.text }}>
              Need: <b style={{ color: C.green }}>L2 anywhere</b>, millions of segments, riding on a network that only knows how to route IP.
            </div>
          </div>
        </Rise>
      </div>
    </SceneFrame>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCENE 02 — OVERLAY / UNDERLAY  (the idea)
// ════════════════════════════════════════════════════════════════════════════
function SceneOverlay() {
  const { localTime } = useSprite();
  return (
    <SceneFrame>
      <SceneTitle title="The fix: build a virtual network on top of the physical one." sub="VXLAN is an overlay. The physical IP network becomes a dumb, fast transport — the underlay — and virtual L2 networks are tunneled across it." />
      <div style={{ position: 'relative', height: 560, marginTop: 16 }}>
        {/* OVERLAY layer */}
        <Rise at={0.5} dur={0.6} style={{ position: 'absolute', left: 0, top: 0, right: 0 }}>
          <div style={{ background: C.greenSoft, border: `1.5px solid ${C.greenLine}`, borderRadius: 16, padding: '26px 36px', position: 'relative', height: 168, boxSizing: 'border-box' }}>
            <div style={{ font: `600 15px ${F.m}`, letterSpacing: '0.16em', color: C.green, marginBottom: 6 }}>OVERLAY — what the workloads see</div>
            <div style={{ font: `400 19px/1.5 ${F.s}`, color: C.text, maxWidth: 1180 }}>Virtual Layer-2 segments. A VM thinks it shares a wire with its peers, wherever they physically sit.</div>
            <div style={{ display: 'flex', gap: 14, marginTop: 18 }}>
              <Chip>VM</Chip><Chip>VM</Chip><Chip>VM</Chip>
              <span style={{ font: `400 16px ${F.m}`, color: C.dim, alignSelf: 'center' }}>— all on virtual segment VNI 10010 —</span>
              <Chip>VM</Chip>
            </div>
          </div>
        </Rise>
        {/* tunnel arrows between layers */}
        <svg width={1656} height={120} style={{ position: 'absolute', left: 0, top: 168, pointerEvents: 'none', opacity: gate(localTime, 1.6, 0.6) }}>
          {[300, 1356].map((cx, i) => (
            <g key={i}>
              <line x1={cx} y1={6} x2={cx} y2={108} stroke={C.green} strokeWidth={2.5} strokeDasharray="2 7" strokeLinecap="round" />
            </g>
          ))}
          <text x={828} y={66} textAnchor="middle" fontFamily={F.m} fontSize={15} fill={C.dim}>encapsulate ↓   ·   decapsulate ↑</text>
        </svg>
        {/* UNDERLAY layer */}
        <Rise at={1.2} dur={0.6} style={{ position: 'absolute', left: 0, top: 296, right: 0 }}>
          <div style={{ background: C.steelSoft, border: `1.5px solid ${C.steelLine}`, borderRadius: 16, padding: '26px 36px', height: 168, boxSizing: 'border-box' }}>
            <div style={{ font: `600 15px ${F.m}`, letterSpacing: '0.16em', color: C.steel, marginBottom: 6 }}>UNDERLAY — the physical fabric</div>
            <div style={{ font: `400 19px/1.5 ${F.s}`, color: C.text, maxWidth: 1180 }}>A plain routed IP network. It only forwards packets between switch IPs — it knows nothing about tenants or virtual segments.</div>
            <div style={{ display: 'flex', gap: 14, marginTop: 18 }}>
              <Chip color={C.steel}>OSPF / IS-IS / eBGP</Chip><Chip color={C.steel}>ECMP</Chip><Chip color={C.steel}>just IP routing</Chip>
            </div>
          </div>
        </Rise>
        {/* punchline */}
        <Rise at={2.4} dur={0.6} style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <span style={{ font: `400 22px ${F.s}`, color: C.dim }}>The mechanism:</span>
            <span style={{ font: `600 26px ${F.d}`, color: C.text }}>wrap the original Ethernet frame inside a UDP packet —</span>
            <Chip solid>MAC-in-UDP</Chip>
          </div>
        </Rise>
      </div>
    </SceneFrame>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCENE 03 — VTEP
// ════════════════════════════════════════════════════════════════════════════
function SceneVtep() {
  const { localTime } = useSprite();
  return (
    <SceneFrame>
      <SceneTitle title="Who does the wrapping? The VTEP." sub="A VXLAN Tunnel Endpoint is where encapsulation and decapsulation happen — usually the leaf switch, sometimes a host's virtual switch. It's the door between overlay and underlay." />
      <div style={{ position: 'relative', height: 560, marginTop: 24 }}>
        {/* host A -> VTEP -> tunnel -> VTEP -> host B */}
        <Box x={0} y={150} w={190} h={130} tag="Host A" title="Server" sub="MAC aa:aa" color={C.text} at={0.5} />
        <Box x={300} y={120} w={250} h={190} tag="VTEP" title="Leaf-1" sub="lo: 10.1.1.1" color={C.green} active at={0.9} glow={C.greenGlow} />
        <Box x={1106} y={120} w={250} h={190} tag="VTEP" title="Leaf-2" sub="lo: 10.1.1.2" color={C.green} active at={2.3} glow={C.greenGlow} />
        <Box x={1466} y={150} w={190} h={130} tag="Host B" title="Server" sub="MAC bb:bb" color={C.text} at={2.6} />
        {/* tunnel */}
        <svg width={1656} height={560} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
          <line x1={190} y1={215} x2={300} y2={215} stroke={C.line} strokeWidth={2} style={{ opacity: gate(localTime, 0.9, 0.4) }} />
          <line x1={1356} y1={215} x2={1466} y2={215} stroke={C.line} strokeWidth={2} style={{ opacity: gate(localTime, 2.5, 0.4) }} />
          {/* the tunnel pipe */}
          <line x1={550} y1={215} x2={1106} y2={215} stroke={C.greenLine} strokeWidth={3} strokeDasharray="3 8" strokeLinecap="round"
            style={{ opacity: gate(localTime, 1.5, 0.6) }} />
          <rect x={690} y={188} width={276} height={54} rx={10} fill={C.bg} stroke={C.greenLine} strokeWidth={1.5}
            style={{ opacity: gate(localTime, 1.8, 0.5) }} />
          <text x={828} y={221} textAnchor="middle" fontFamily={F.m} fontSize={15} fill={C.green}
            style={{ opacity: gate(localTime, 1.9, 0.5) }}>VXLAN tunnel · UDP/IP</text>
        </svg>
        {/* labels under VTEPs */}
        <Rise at={1.4} dur={0.5} style={{ position: 'absolute', left: 300, top: 330, width: 250, textAlign: 'center' }}>
          <div style={{ font: `500 14px ${F.m}`, color: C.green }}>encap →</div>
          <div style={{ font: `400 14px/1.4 ${F.s}`, color: C.dim, marginTop: 4 }}>add VXLAN/UDP/IP headers</div>
        </Rise>
        <Rise at={2.7} dur={0.5} style={{ position: 'absolute', left: 1106, top: 330, width: 250, textAlign: 'center' }}>
          <div style={{ font: `500 14px ${F.m}`, color: C.green }}>← decap</div>
          <div style={{ font: `400 14px/1.4 ${F.s}`, color: C.dim, marginTop: 4 }}>strip headers, deliver frame</div>
        </Rise>
        {/* key facts */}
        <Rise at={3.3} dur={0.6} style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <div style={{ display: 'flex', gap: 18, justifyContent: 'center' }}>
            {[
              ['Identified by an IP', 'each VTEP owns a loopback in the underlay'],
              ['Stateless tunnels', 'no per-flow setup — just look up the remote VTEP'],
              ['Hardware line-rate', 'modern leaf ASICs encap/decap with no penalty'],
            ].map(([h, s], i) => (
              <div key={i} style={{ flex: 1, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '18px 22px' }}>
                <div style={{ font: `600 17px ${F.d}`, color: C.text }}>{h}</div>
                <div style={{ font: `400 15px/1.45 ${F.s}`, color: C.dim, marginTop: 6 }}>{s}</div>
              </div>
            ))}
          </div>
        </Rise>
      </div>
    </SceneFrame>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCENE 04 — ENCAPSULATION (packet walk)
// ════════════════════════════════════════════════════════════════════════════
function PacketBlock({ label, bytes, color, sub, w, at, localTime, dim }) {
  const o = gate(localTime, at, 0.5);
  const tx = (1 - gate(localTime, at, 0.5, Easing.easeOutCubic)) * -18;
  return (
    <div style={{ width: w, opacity: o, transform: `translateX(${tx}px)`, flexShrink: 0 }}>
      <div style={{ font: `500 12px ${F.m}`, color: C.faint, textAlign: 'center', marginBottom: 7, letterSpacing: '0.04em' }}>{bytes}</div>
      <div style={{
        height: 92, borderRadius: 9, background: dim ? C.panel : color + '22', border: `1.5px solid ${dim ? C.line : color}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '0 8px', boxSizing: 'border-box',
      }}>
        <div style={{ font: `600 16px ${F.d}`, color: dim ? C.dim : C.text, textAlign: 'center' }}>{label}</div>
        {sub && <div style={{ font: `500 11.5px ${F.m}`, color: dim ? C.faint : color, textAlign: 'center' }}>{sub}</div>}
      </div>
    </div>
  );
}
function SceneEncap() {
  const { localTime } = useSprite();
  // header field highlight (VNI) appears late
  return (
    <SceneFrame>
      <SceneTitle title="Anatomy of a VXLAN packet" sub="The original frame is never touched. The VTEP just prepends four new headers so the underlay can route it from one VTEP IP to another." />
      <div style={{ position: 'relative', height: 540, marginTop: 8 }}>
        {/* assembled packet, outer → inner */}
        <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 8 }}>
          <PacketBlock localTime={localTime} at={2.6} w={150} bytes="14 B" label="Outer Ethernet" sub="leaf ↔ spine MAC" color={C.steel} />
          <PacketBlock localTime={localTime} at={2.1} w={172} bytes="20 B" label="Outer IP" sub="VTEP → VTEP" color={C.steel} />
          <PacketBlock localTime={localTime} at={1.6} w={168} bytes="8 B" label="UDP" sub="dst port 4789" color={C.steel} />
          <PacketBlock localTime={localTime} at={1.1} w={172} bytes="8 B" label="VXLAN header" sub="VNI 10010" color={C.green} />
          <PacketBlock localTime={localTime} at={0.4} w={1} bytes="" label="" color={C.green} dim />
          <div style={{ flex: 1, opacity: gate(localTime, 0.4, 0.5), transform: `scale(${0.96 + 0.04 * gate(localTime, 0.4, 0.5)})`, transformOrigin: 'left center' }}>
            <div style={{ font: `500 12px ${F.m}`, color: C.faint, textAlign: 'center', marginBottom: 7 }}>original frame — unchanged</div>
            <div style={{ height: 92, borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: `1.5px dashed ${C.green}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <Chip color={C.text} style={{ borderColor: C.line }}>Inner Eth — aa:aa→bb:bb</Chip>
              <Chip color={C.text} style={{ borderColor: C.line }}>Inner IP</Chip>
              <Chip color={C.text} style={{ borderColor: C.line }}>payload</Chip>
            </div>
          </div>
        </div>
        {/* brackets */}
        <Rise at={3.1} dur={0.5} style={{ position: 'absolute', top: 132, left: 0, width: 666 }}>
          <div style={{ borderTop: `2px solid ${C.steelLine}`, borderLeft: `2px solid ${C.steelLine}`, borderRight: `2px solid ${C.steelLine}`, height: 14, borderRadius: '6px 6px 0 0' }} />
          <div style={{ font: `500 14px ${F.m}`, color: C.steel, textAlign: 'center', marginTop: 8 }}>+50 bytes of overlay overhead — raise fabric MTU (jumbo) to avoid fragmentation</div>
        </Rise>

        {/* zoom on the 8-byte VXLAN header */}
        <Rise at={3.9} dur={0.6} style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <div style={{ background: C.greenSoft, border: `1.5px solid ${C.greenLine}`, borderRadius: 14, padding: '22px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <Chip solid>8-BYTE VXLAN HEADER</Chip>
              <span style={{ font: `400 17px ${F.s}`, color: C.dim }}>the only genuinely new piece of information VXLAN adds</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                ['Flags', '8 bits', 'I-bit = 1', false],
                ['Reserved', '24 bits', '—', true],
                ['VNI', '24 bits', 'segment ID', false],
                ['Reserved', '8 bits', '—', true],
              ].map(([n, b, s, d], i) => (
                <div key={i} style={{ flex: n === 'VNI' ? 2.4 : (n === 'Reserved' && b === '24 bits' ? 2.4 : 1), background: d ? C.panel : (n === 'VNI' ? C.green + '2e' : C.panel2), border: `1.5px solid ${n === 'VNI' ? C.green : C.line}`, borderRadius: 9, padding: '14px 12px', textAlign: 'center' }}>
                  <div style={{ font: `600 17px ${F.d}`, color: n === 'VNI' ? C.green : (d ? C.faint : C.text) }}>{n}</div>
                  <div style={{ font: `500 13px ${F.m}`, color: C.dim, marginTop: 4 }}>{b} · {s}</div>
                </div>
              ))}
            </div>
          </div>
        </Rise>
      </div>
    </SceneFrame>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCENE 05 — VNI
// ════════════════════════════════════════════════════════════════════════════
function SceneVni() {
  const { localTime } = useSprite();
  const big = Math.round(interpolate([1.0, 3.0], [4094, 16777216], Easing.easeOutExpo)(localTime));
  return (
    <SceneFrame>
      <SceneTitle title="The VNI: 24 bits that replace the VLAN" sub="The VXLAN Network Identifier scopes each virtual segment. It rides inside every encapsulated packet, so the egress VTEP knows exactly which tenant L2 domain the frame belongs to." />
      <div style={{ position: 'relative', height: 540, marginTop: 16, display: 'flex', gap: 40 }}>
        {/* counter */}
        <div style={{ flex: 1.1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Rise at={0.4} dur={0.6}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 22, marginBottom: 18 }}>
              <div style={{ font: `400 22px ${F.s}`, color: C.dim }}>VLAN, 12-bit</div>
              <div style={{ font: `600 40px ${F.d}`, color: C.amber, textDecoration: 'line-through', textDecorationColor: C.amberLine }}>4,094</div>
            </div>
          </Rise>
          <Rise at={0.7} dur={0.6}>
            <div style={{ font: `500 16px ${F.m}`, letterSpacing: '0.14em', color: C.green, marginBottom: 10 }}>VNI, 24-BIT — SEGMENTS AVAILABLE</div>
            <div style={{ font: `700 92px ${F.d}`, color: C.green, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {big.toLocaleString()}
            </div>
            <div style={{ font: `400 19px/1.5 ${F.s}`, color: C.dim, marginTop: 16, maxWidth: 560 }}>
              That's 2<sup>24</sup> — over <b style={{ color: C.text }}>16.7 million</b> isolated segments. Tenant isolation stops being a scarce resource.
            </div>
          </Rise>
        </div>
        {/* role */}
        <Rise at={2.6} dur={0.6} style={{ flex: 0.9, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
          {[
            ['Segment selector', 'VNI 10010 ≠ VNI 10020 — frames in different VNIs never mix, even on the same wire.'],
            ['Carried end-to-end', 'set by the ingress VTEP, read by the egress VTEP. The underlay never inspects it.'],
            ['L2 VNI vs L3 VNI', 'an L2 VNI maps to a bridge domain; an L3 VNI maps to a VRF for routed (inter-subnet) traffic.'],
          ].map(([h, s], i) => (
            <div key={i} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '20px 24px', borderLeft: `3px solid ${C.green}` }}>
              <div style={{ font: `600 19px ${F.d}`, color: C.text }}>{h}</div>
              <div style={{ font: `400 16px/1.5 ${F.s}`, color: C.dim, marginTop: 6 }}>{s}</div>
            </div>
          ))}
        </Rise>
      </div>
    </SceneFrame>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCENE 06 — SPINE-LEAF FABRIC
// ════════════════════════════════════════════════════════════════════════════
function SceneFabric() {
  const { localTime } = useSprite();
  const spines = [{ x: 560, label: 'Spine-1' }, { x: 980, label: 'Spine-2' }];
  const leaves = [320, 640, 960, 1280];
  const sy = 70, ly = 330, lw = 200, lh = 96, sw = 200, sh = 92;
  const leafCx = (i) => leaves[i] + lw / 2;
  const spineCx = (i) => spines[i].x + sw / 2;
  return (
    <SceneFrame>
      <SceneTitle title="Where this lives: the spine-leaf fabric" sub="A Clos topology. Every leaf connects to every spine. Spines are pure IP transit; leaves carry the hosts and act as the VTEPs." />
      <div style={{ position: 'relative', height: 560, marginTop: 16 }}>
        <svg width={1656} height={520} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
          {/* full mesh links spine<->leaf */}
          {spines.map((s, si) => leaves.map((lx, li) => {
            const at = 1.0 + (si * 4 + li) * 0.05;
            return (
              <line key={`${si}-${li}`} x1={spineCx(si)} y1={sy + sh} x2={leafCx(li)} y2={ly}
                stroke={C.steelLine} strokeWidth={1.5} style={{ opacity: gate(localTime, at, 0.4) * 0.7 }} />
            );
          }))}
          {/* overlay tunnel arcing leaf0 -> leaf3 above the fabric */}
          <path d={`M ${leafCx(0)} ${ly} C ${leafCx(0)} 150, ${leafCx(3)} 150, ${leafCx(3)} ${ly}`}
            fill="none" stroke={C.green} strokeWidth={3} strokeDasharray="3 8" strokeLinecap="round"
            style={{ opacity: gate(localTime, 3.0, 0.7) }} />
        </svg>
        {/* spines */}
        {spines.map((s, i) => (
          <Box key={i} x={s.x} y={sy} w={sw} h={sh} tag="Spine" title={s.label} sub="IP transit · ECMP" color={C.steel} active at={0.5 + i * 0.15} />
        ))}
        {/* leaves */}
        {leaves.map((lx, i) => (
          <Box key={i} x={lx} y={ly} w={lw} h={lh} tag="Leaf · VTEP" title={`Leaf-${i + 1}`} sub={`lo 10.1.1.${i + 1}`} color={C.green} active at={0.9 + i * 0.12} glow={C.greenGlow} />
        ))}
        {/* hosts under leaves */}
        {leaves.map((lx, i) => (
          <Box key={`h${i}`} x={lx + 30} y={ly + lh + 34} w={lw - 60} h={64} title="hosts" color={C.text} at={1.6 + i * 0.08} fill={C.bg} />
        ))}
        {/* tunnel label */}
        <Rise at={3.4} dur={0.5} style={{ position: 'absolute', left: leafCx(0) - 120, top: 150, width: 800, textAlign: 'center' }}>
          <span style={{ font: `500 15px ${F.m}`, color: C.green, background: C.bg, padding: '4px 12px', border: `1px solid ${C.greenLine}`, borderRadius: 6 }}>
            VXLAN tunnel rides over the fabric — spines just see VTEP-to-VTEP IP traffic
          </span>
        </Rise>
        <Rise at={3.9} dur={0.5} style={{ position: 'absolute', bottom: -8, left: 0, right: 0 }}>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <Chip color={C.steel}>any-to-any · equal hops</Chip>
            <Chip color={C.steel}>ECMP load-spreads on UDP src-port entropy</Chip>
            <Chip>spines need zero VXLAN awareness</Chip>
          </div>
        </Rise>
      </div>
    </SceneFrame>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCENE 07 — FLOOD AND LEARN (the old data plane)
// ════════════════════════════════════════════════════════════════════════════
function SceneFlood() {
  const { localTime } = useSprite();
  const lw = 200, lh = 96, ly = 250;
  const leaves = [120, 560, 1000, 1440];
  const leafCx = (i) => leaves[i] + lw / 2;
  // flood pulse travels outward from leaf 0
  return (
    <SceneFrame>
      <SceneTitle title="First approach: flood-and-learn" sub="Before any control protocol, a VTEP discovers remote MACs the way a switch always has — by flooding the unknowns and learning from what comes back." />
      <div style={{ position: 'relative', height: 560, marginTop: 8 }}>
        {/* leaves */}
        {leaves.map((lx, i) => (
          <Box key={i} x={lx} y={ly} w={lw} h={lh} tag={i === 0 ? 'ingress VTEP' : 'VTEP'} title={`Leaf-${i + 1}`} color={i === 0 ? C.amber : C.steel} active at={0.5 + i * 0.1} glow={i === 0 ? C.amberSoft : undefined} />
        ))}
        {/* flood replication lines from leaf0 to others */}
        <svg width={1656} height={250} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
          {[1, 2, 3].map((i) => {
            const prog = clamp((localTime - 1.4 - i * 0.12) / 0.6, 0, 1);
            return (
              <g key={i}>
                <line x1={leafCx(0)} y1={ly} x2={leafCx(0) + (leafCx(i) - leafCx(0)) * prog} y2={ly}
                  stroke={C.amber} strokeWidth={2.5} strokeDasharray="4 6" strokeLinecap="round" />
              </g>
            );
          })}
        </svg>
        {/* BUM label */}
        <Rise at={1.0} dur={0.5} style={{ position: 'absolute', left: 120, top: ly + lh + 26, width: 700 }}>
          <div style={{ font: `600 15px ${F.m}`, color: C.amber, letterSpacing: '0.06em' }}>UNKNOWN-UNICAST / BROADCAST / MULTICAST  (BUM)</div>
          <div style={{ font: `400 17px/1.5 ${F.s}`, color: C.dim, marginTop: 6 }}>flooded to <i>every</i> other VTEP in the VNI — via an underlay multicast group, or ingress (head-end) replication that unicasts a copy to each peer.</div>
        </Rise>
        {/* learn callout */}
        <Rise at={2.6} dur={0.5} style={{ position: 'absolute', right: 0, top: ly + lh + 26, width: 480 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '18px 22px' }}>
            <div style={{ font: `600 16px ${F.d}`, color: C.text }}>…then learn from the reply</div>
            <div style={{ font: `400 15px/1.5 ${F.s}`, color: C.dim, marginTop: 6 }}>When the target answers, each VTEP records <span style={{ color: C.green, fontFamily: F.m }}>MAC ↔ remote-VTEP</span> from the decapsulated frame. Data-plane learning, exactly like a bridge.</div>
          </div>
        </Rise>
        {/* problem banner */}
        <Rise at={3.4} dur={0.6} style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(207,91,67,0.12)', border: `1px solid ${C.red}66`, borderRadius: 12, padding: '18px 26px' }}>
            <div style={{ font: `600 18px ${F.m}`, color: C.red }}>✕ doesn't scale</div>
            <div style={{ font: `400 19px/1.45 ${F.s}`, color: C.text }}>
              Every unknown floods the whole fabric, multicast in the underlay is operationally painful, and there's no single source of truth for where a host lives.
            </div>
          </div>
        </Rise>
      </div>
    </SceneFrame>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCENE 08 — BGP EVPN control plane
// ════════════════════════════════════════════════════════════════════════════
function SceneEvpn() {
  const { localTime } = useSprite();
  const lw = 210, lh = 100, ly = 360;
  const leaves = [140, 560, 980, 1400];
  const leafCx = (i) => leaves[i] + lw / 2;
  const rrx = 728, rry = 90, rrw = 200, rrh = 96;
  return (
    <SceneFrame>
      <SceneTitle title="The modern way: a BGP EVPN control plane" sub="Separate control from data. MP-BGP with the EVPN address family distributes reachability, so every VTEP learns who lives where — before a single packet is flooded." />
      <div style={{ position: 'relative', height: 560, marginTop: 8 }}>
        {/* route reflector */}
        <Box x={rrx} y={rry} w={rrw} h={rrh} tag="Route Reflector" title="Spine" sub="MP-BGP · L2VPN EVPN" color={C.green} active at={0.6} glow={C.greenGlow} />
        {/* leaves advertise up */}
        <svg width={1656} height={460} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
          {leaves.map((lx, i) => {
            const at = 1.2 + i * 0.18;
            const prog = clamp((localTime - at) / 0.7, 0, 1);
            const x2 = rrx + rrw / 2, y2 = rry + rrh;
            const x1 = leafCx(i), y1 = ly;
            const cx = x1 + (x2 - x1) * prog, cy = y1 + (y2 - y1) * prog;
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.line} strokeWidth={1.5} />
                <line x1={x1} y1={y1} x2={cx} y2={cy} stroke={C.green} strokeWidth={2.5} strokeLinecap="round" style={{ opacity: gate(localTime, at, 0.3) }} />
                <circle cx={cx} cy={cy} r={5} fill={C.green} style={{ opacity: prog > 0 && prog < 1 ? 1 : 0 }} />
              </g>
            );
          })}
        </svg>
        {/* leaves */}
        {leaves.map((lx, i) => (
          <Box key={i} x={lx} y={ly} w={lw} h={lh} tag="VTEP" title={`Leaf-${i + 1}`} sub={i === 0 ? 'advertises aa:aa' : 'learns routes'} color={C.green} active at={0.8 + i * 0.1} />
        ))}
        {/* advertise label */}
        <Rise at={2.6} dur={0.5} style={{ position: 'absolute', left: 0, top: 222, width: 560 }}>
          <div style={{ font: `500 14px ${F.m}`, color: C.green }}>↑ "host aa:aa lives behind Leaf-1, VNI 10010"</div>
          <div style={{ font: `400 15px/1.45 ${F.s}`, color: C.dim, marginTop: 6 }}>Each VTEP advertises its locally-learned MAC/IP once. The route reflector fans it out — no full mesh of BGP sessions.</div>
        </Rise>
        {/* benefits */}
        <Rise at={3.3} dur={0.6} style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            {[
              ['Learn, don\u2019t flood', 'reachability arrives as routing updates, not broadcast storms'],
              ['One source of truth', 'the BGP table knows every host\u2019s MAC, IP, VNI and VTEP'],
              ['Standards-based', 'RFC 7432 EVPN over RFC 8365 VXLAN — multi-vendor'],
            ].map(([h, s], i) => (
              <div key={i} style={{ flex: 1, background: C.greenSoft, border: `1px solid ${C.greenLine}`, borderRadius: 12, padding: '18px 22px' }}>
                <div style={{ font: `600 17px ${F.d}`, color: C.green }}>{h}</div>
                <div style={{ font: `400 15px/1.45 ${F.s}`, color: C.dim, marginTop: 6 }}>{s}</div>
              </div>
            ))}
          </div>
        </Rise>
      </div>
    </SceneFrame>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCENE 09 — EVPN ROUTE TYPES
// ════════════════════════════════════════════════════════════════════════════
function RouteCard({ n, name, role, detail, accent, primary, at, localTime }) {
  const o = gate(localTime, at, 0.5);
  const ty = (1 - gate(localTime, at, 0.55, Easing.easeOutCubic)) * 24;
  return (
    <div style={{
      opacity: o, transform: `translateY(${ty}px)`,
      background: primary ? C.greenSoft : C.panel, border: `1.5px solid ${primary ? C.greenLine : C.line}`,
      borderRadius: 13, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 8, boxSizing: 'border-box', height: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ font: `700 26px ${F.d}`, color: accent, lineHeight: 1 }}>{n}</div>
        <div style={{ font: `600 19px ${F.d}`, color: C.text, lineHeight: 1.05 }}>{name}</div>
      </div>
      <div style={{ font: `600 13.5px ${F.m}`, color: accent, letterSpacing: '0.03em' }}>{role}</div>
      <div style={{ font: `400 14.5px/1.5 ${F.s}`, color: C.dim, textWrap: 'pretty' }}>{detail}</div>
    </div>
  );
}
function SceneRouteTypes() {
  const { localTime } = useSprite();
  return (
    <SceneFrame>
      <SceneTitle title="The EVPN route types you'll actually meet" sub="EVPN is a single BGP address family carrying several Network Layer Reachability types. Three do the day-to-day work; two handle multihoming." />
      <div style={{ position: 'relative', height: 560, marginTop: 16 }}>
        {/* top row: the big three */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginBottom: 18 }}>
          <RouteCard localTime={localTime} at={0.5} primary accent={C.green} n="Type 2" name="MAC / IP Advertisement"
            role="the workhorse"
            detail="Advertises a host's MAC, optionally its IP, plus the L2 VNI (and an L3 VNI for routing). This is how every VTEP learns where a host lives — and powers MAC mobility when a VM moves." />
          <RouteCard localTime={localTime} at={0.9} primary accent={C.green} n="Type 3" name="Inclusive Multicast (IMET)"
            role="builds the flood list"
            detail="Each VTEP announces 'I'm in VNI 10010.' Peers use these to build the per-VNI ingress-replication list — so the rare BUM that must flood reaches only the right VTEPs." />
          <RouteCard localTime={localTime} at={1.3} primary accent={C.green} n="Type 5" name="IP Prefix Route"
            role="routes between subnets"
            detail="Advertises IP prefixes (not host MACs) for inter-subnet, L3 routing across the fabric — including reaching external networks and silent hosts, via an L3 VNI / VRF." />
        </div>
        {/* bottom row: multihoming pair + note */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.1fr', gap: 18 }}>
          <RouteCard localTime={localTime} at={2.0} accent={C.steel} n="Type 1" name="Ethernet Auto-Discovery"
            role="multihoming"
            detail="Per-ES / per-EVI. Enables fast 'mass withdrawal' on link failure and aliasing (load-balancing) to a dual-homed host." />
          <RouteCard localTime={localTime} at={2.3} accent={C.steel} n="Type 4" name="Ethernet Segment"
            role="multihoming"
            detail="Discovers which VTEPs share an Ethernet Segment (ESI), elects a Designated Forwarder, and enforces split-horizon." />
          <div style={{ opacity: gate(localTime, 2.7, 0.5), background: 'transparent', border: `1px dashed ${C.line}`, borderRadius: 13, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
            <div style={{ font: `600 16px ${F.d}`, color: C.text }}>Why split them out?</div>
            <div style={{ font: `400 14.5px/1.55 ${F.s}`, color: C.dim }}>Types 1 & 4 only appear when a host connects to two leaves at once for redundancy. Single-homed fabrics live almost entirely on Types 2, 3 and 5.</div>
          </div>
        </div>
      </div>
    </SceneFrame>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCENE 10 — ARP SUPPRESSION
// ════════════════════════════════════════════════════════════════════════════
function SceneArp() {
  const { localTime } = useSprite();
  const hx = 80, lx = 470, ly = 180, lw = 280, lh = 200;
  return (
    <SceneFrame>
      <SceneTitle title="A free win: ARP suppression" sub="Because Type-2 routes already carry every host's IP-to-MAC binding, the local leaf can answer ARP itself — the request never has to flood the fabric." />
      <div style={{ position: 'relative', height: 560, marginTop: 24 }}>
        {/* host */}
        <Box x={hx} y={ly + 35} w={210} h={130} tag="Host A" title="Server" sub="who has 10.0.0.9?" color={C.text} at={0.5} />
        {/* leaf with arp cache */}
        <div style={{ position: 'absolute', left: lx, top: ly, width: lw, height: lh, opacity: gate(localTime, 0.9, 0.5) }}>
          <div style={{ width: '100%', height: '100%', background: C.panel, border: `1.5px solid ${C.greenLine}`, borderRadius: 12, boxShadow: `0 0 34px ${C.greenGlow}`, padding: '18px 20px', boxSizing: 'border-box' }}>
            <div style={{ font: `500 11px ${F.m}`, letterSpacing: '0.14em', color: C.green, textTransform: 'uppercase', marginBottom: 4 }}>VTEP · Leaf-1</div>
            <div style={{ font: `600 19px ${F.d}`, color: C.text, marginBottom: 14 }}>Local ARP cache</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[['10.0.0.9', 'bb:bb:..09'], ['10.0.0.4', 'cc:cc:..04']].map(([ip, mac], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', font: `500 14px ${F.m}`, color: i === 0 ? C.green : C.dim, background: i === 0 ? C.greenSoft : 'transparent', padding: '7px 10px', borderRadius: 6 }}>
                  <span>{ip}</span><span>→</span><span>{mac}</span>
                </div>
              ))}
            </div>
            <div style={{ font: `400 12.5px/1.4 ${F.s}`, color: C.faint, marginTop: 12 }}>populated from EVPN Type-2 routes</div>
          </div>
        </div>
        {/* fabric (suppressed) */}
        <Box x={1180} y={ly + 20} w={400} h={160} tag="rest of fabric" title="stays quiet" sub="no flood crosses the spines" color={C.steel} at={1.4} fill={C.bg} />

        {/* arrows: request in, proxy reply back */}
        <svg width={1656} height={520} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
          {/* request host->leaf */}
          <line x1={290} y1={ly + 90} x2={lx} y2={ly + 90} stroke={C.amber} strokeWidth={2.5} strokeDasharray="4 6" style={{ opacity: gate(localTime, 1.6, 0.4) }} />
          <text x={380} y={ly + 78} textAnchor="middle" fontFamily={F.m} fontSize={13} fill={C.amber} style={{ opacity: gate(localTime, 1.7, 0.4) }}>ARP req →</text>
          {/* proxy reply leaf->host */}
          <line x1={lx} y1={ly + 130} x2={290} y2={ly + 130} stroke={C.green} strokeWidth={2.5} style={{ opacity: gate(localTime, 2.4, 0.4) }} />
          <text x={380} y={ly + 152} textAnchor="middle" fontFamily={F.m} fontSize={13} fill={C.green} style={{ opacity: gate(localTime, 2.5, 0.4) }}>← proxy reply bb:bb</text>
          {/* X toward fabric */}
          <line x1={lx + lw} y1={ly + 100} x2={1180} y2={ly + 100} stroke={C.red} strokeWidth={2} strokeDasharray="3 7" style={{ opacity: gate(localTime, 2.8, 0.4) }} />
          <text x={965} y={ly + 88} textAnchor="middle" fontFamily={F.m} fontSize={14} fill={C.red} style={{ opacity: gate(localTime, 2.9, 0.4) }}>✕ no flood</text>
        </svg>

        <Rise at={3.4} dur={0.6} style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center', background: C.greenSoft, border: `1px solid ${C.greenLine}`, borderRadius: 12, padding: '18px 28px' }}>
            <div style={{ width: 9, height: 9, borderRadius: 9, background: C.green }} />
            <div style={{ font: `500 21px ${F.s}`, color: C.text }}>
              The leaf intercepts ARP and replies locally — broadcast suppressed, fabric stays calm even at huge scale.
            </div>
          </div>
        </Rise>
      </div>
    </SceneFrame>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCENE 11 — FULL PACKET WALK
// ════════════════════════════════════════════════════════════════════════════
function SceneWalk() {
  const { localTime } = useSprite();
  // path: HostA -> Leaf1 -> Spine -> Leaf2 -> HostB
  const ay = 300;
  const pts = [
    { x: 150, y: ay },   // host A
    { x: 470, y: ay },   // leaf1
    { x: 828, y: 150 },  // spine
    { x: 1186, y: ay },  // leaf2
    { x: 1506, y: ay },  // host B
  ];
  // packet position along polyline driven by localTime
  const segStart = 1.4, segEnd = 5.4;
  const tt = clamp((localTime - segStart) / (segEnd - segStart), 0, 1);
  const seg = tt * 4; // 4 segments
  const si = Math.min(3, Math.floor(seg));
  const sf = seg - si;
  const px = pts[si].x + (pts[si + 1].x - pts[si].x) * sf;
  const py = pts[si].y + (pts[si + 1].y - pts[si].y) * sf;
  const encapsulated = tt > 0.18 && tt < 0.82; // wrapped while in the fabric
  const steps = [
    ['Lookup', 'Leaf-1 already knows bb:bb is behind Leaf-2 (EVPN Type-2)', 0.0],
    ['Encap', 'wrap in VXLAN(VNI) / UDP 4789 / IP 10.1.1.1→10.1.1.2', 0.22],
    ['ECMP', 'spine routes it like any IP packet — hashes the UDP src port', 0.5],
    ['Decap', 'Leaf-2 strips the headers, reads VNI 10010', 0.78],
    ['Deliver', 'original frame handed to Host B, untouched', 0.95],
  ];
  return (
    <SceneFrame>
      <SceneTitle title="Putting it together: one packet, end to end" sub="Host A to Host B — different leaves, same VNI 10010. Watch the encapsulation appear in the fabric and vanish on the far side." />
      <div style={{ position: 'relative', height: 540, marginTop: 8 }}>
        {/* nodes */}
        <Box x={70} y={ay - 55} w={160} h={110} tag="Host A" title="aa:aa" color={C.text} at={0.3} />
        <Box x={370} y={ay - 65} w={200} h={130} tag="VTEP" title="Leaf-1" sub="10.1.1.1" color={C.green} active at={0.5} />
        <Box x={728} y={90} w={200} h={108} tag="Spine" title="IP transit" sub="ECMP" color={C.steel} active at={0.6} />
        <Box x={1086} y={ay - 65} w={200} h={130} tag="VTEP" title="Leaf-2" sub="10.1.1.2" color={C.green} active at={0.7} />
        <Box x={1426} y={ay - 55} w={160} h={110} tag="Host B" title="bb:bb" color={C.text} at={0.8} />
        {/* path */}
        <svg width={1656} height={420} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
          <polyline points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={C.line} strokeWidth={2} />
          <polyline points={pts.slice(0, si + 1).concat([{ x: px, y: py }]).map(p => `${p.x},${p.y}`).join(' ')}
            fill="none" stroke={encapsulated ? C.green : C.steel} strokeWidth={3} strokeLinecap="round"
            style={{ opacity: gate(localTime, segStart, 0.3) }} />
        </svg>
        {/* moving packet token */}
        {localTime > segStart && localTime < segEnd + 0.3 && (
          <div style={{ position: 'absolute', left: px, top: py, transform: 'translate(-50%,-50%)', transition: 'none', zIndex: 5 }}>
            <div style={{
              padding: encapsulated ? '8px 14px' : '7px 12px', borderRadius: 8,
              background: encapsulated ? C.green : 'rgba(255,255,255,0.1)',
              border: `1.5px solid ${encapsulated ? C.green : C.lineStrong}`,
              font: `600 13px ${F.m}`, color: encapsulated ? '#0a0a0a' : C.text, whiteSpace: 'nowrap',
              boxShadow: encapsulated ? `0 0 24px ${C.greenGlow}` : 'none',
            }}>
              {encapsulated ? 'VXLAN ⟨ frame ⟩' : 'frame'}
            </div>
          </div>
        )}
        {/* step ticker */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
          {steps.map(([h, s, thr], i) => {
            const active = tt >= thr;
            const o = gate(localTime, 0.6 + i * 0.12, 0.5);
            return (
              <div key={i} style={{
                opacity: o, background: active ? C.greenSoft : C.panel,
                border: `1px solid ${active ? C.greenLine : C.line}`, borderRadius: 11, padding: '16px 16px',
                transition: 'background 200ms, border-color 200ms',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ font: `600 13px ${F.m}`, color: active ? C.green : C.faint }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ font: `600 17px ${F.d}`, color: active ? C.text : C.dim }}>{h}</span>
                </div>
                <div style={{ font: `400 13.5px/1.45 ${F.s}`, color: C.dim }}>{s}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneFrame>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCENE 12 — RECAP / OUTRO
// ════════════════════════════════════════════════════════════════════════════
function SceneOutro() {
  const { localTime } = useSprite();
  const items = [
    ['Overlay + Underlay', 'virtual L2 segments tunneled over a plain routed IP fabric'],
    ['VTEP', 'the leaf encapsulates & decapsulates — MAC-in-UDP, port 4789'],
    ['VNI', '24-bit segment ID — 16.7M tenants vs the old 4,094 VLANs'],
    ['Spine-leaf', 'ECMP Clos fabric; spines stay VXLAN-unaware'],
    ['BGP EVPN', 'control-plane learning — Type 2 / 3 / 5 carry the reachability'],
    ['ARP suppression', 'the leaf answers locally; the fabric never floods'],
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '110px 132px', boxSizing: 'border-box' }}>
      <Rise at={0.2} dur={0.6}>
        <div style={{ font: `500 15px ${F.m}`, letterSpacing: '0.22em', color: C.green, marginBottom: 16 }}>THE WHOLE PICTURE</div>
        <div style={{ font: `600 58px/1.05 ${F.d}`, color: C.text, letterSpacing: '-0.02em', maxWidth: 1200 }}>
          VXLAN = Layer-2 segments, routed at data-center scale.
        </div>
      </Rise>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18, marginTop: 48 }}>
        {items.map(([h, s], i) => {
          const at = 0.7 + i * 0.13;
          const o = gate(localTime, at, 0.5);
          const ty = (1 - gate(localTime, at, 0.55, Easing.easeOutCubic)) * 20;
          return (
            <div key={i} style={{ opacity: o, transform: `translateY(${ty}px)`, background: C.panel, border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.green}`, borderRadius: 12, padding: '22px 26px' }}>
              <div style={{ font: `600 21px ${F.d}`, color: C.text }}>{h}</div>
              <div style={{ font: `400 16px/1.5 ${F.s}`, color: C.dim, marginTop: 7 }}>{s}</div>
            </div>
          );
        })}
      </div>
      <Rise at={1.8} dur={0.6} style={{ marginTop: 44 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 14, height: 14, background: C.green, borderRadius: 3 }} />
          <div style={{ font: `400 22px ${F.s}`, color: C.dim }}>
            The frame never changes. Everything else is just <span style={{ color: C.text }}>where to send it</span> and <span style={{ color: C.text }}>how everyone agrees on that</span>.
          </div>
        </div>
      </Rise>
    </div>
  );
}

// ── persistent chrome ────────────────────────────────────────────────────────
function Chrome({ sections, total }) {
  const t = useTime();
  let cur = sections[0], idx = 0;
  sections.forEach((s, i) => { if (t >= s.start) { cur = s; idx = i; } });
  return (
    <React.Fragment>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.06)', zIndex: 50 }}>
        <div style={{ height: '100%', width: `${(t / total) * 100}%`, background: C.green }} />
      </div>
      <div style={{ position: 'absolute', top: 38, left: 64, display: 'flex', alignItems: 'center', gap: 13, zIndex: 50 }}>
        <div style={{ width: 13, height: 13, background: C.green, borderRadius: 3 }} />
        <div style={{ font: `500 14px ${F.m}`, color: C.dim, letterSpacing: '0.06em' }}>VXLAN · MAC-in-UDP overlay</div>
      </div>
      <div style={{ position: 'absolute', top: 38, right: 64, display: 'flex', alignItems: 'center', gap: 14, zIndex: 50, font: `500 14px ${F.m}`, letterSpacing: '0.08em' }}>
        <span style={{ color: C.faint }}>{String(idx + 1).padStart(2, '0')} / {String(sections.length).padStart(2, '0')}</span>
        <span style={{ width: 1, height: 13, background: C.line }} />
        <span style={{ color: C.green, textTransform: 'uppercase' }}>{cur.label}</span>
      </div>
    </React.Fragment>
  );
}

// faint moving dot-grid backdrop
function Backdrop() {
  const t = useTime();
  const off = (t * 6) % 46;
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.bg, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: -46,
        backgroundImage: `radial-gradient(${C.line} 1px, transparent 1px)`,
        backgroundSize: '46px 46px', backgroundPosition: `${off}px ${off * 0.6}px`, opacity: 0.5,
      }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 42%, transparent 40%, rgba(0,0,0,0.55) 100%)' }} />
    </div>
  );
}

// ── timeline assembly ────────────────────────────────────────────────────────
const SCENES = [
  { id: 'open', label: 'Intro', dur: 8, comp: SceneOpen },
  { id: 'problem', label: 'The Problem', dur: 20, comp: SceneProblem },
  { id: 'overlay', label: 'Overlay & Underlay', dur: 18, comp: SceneOverlay },
  { id: 'vtep', label: 'The VTEP', dur: 18, comp: SceneVtep },
  { id: 'encap', label: 'Encapsulation', dur: 22, comp: SceneEncap },
  { id: 'vni', label: 'The VNI', dur: 16, comp: SceneVni },
  { id: 'fabric', label: 'Spine-Leaf Fabric', dur: 18, comp: SceneFabric },
  { id: 'flood', label: 'Flood-and-Learn', dur: 22, comp: SceneFlood },
  { id: 'evpn', label: 'BGP EVPN', dur: 18, comp: SceneEvpn },
  { id: 'routes', label: 'EVPN Route Types', dur: 24, comp: SceneRouteTypes },
  { id: 'arp', label: 'ARP Suppression', dur: 18, comp: SceneArp },
  { id: 'walk', label: 'Packet Walk', dur: 22, comp: SceneWalk },
  { id: 'outro', label: 'Recap', dur: 13, comp: SceneOutro },
];
let _acc = 0;
const TIMED = SCENES.map((s) => { const o = { ...s, start: _acc, end: _acc + s.dur }; _acc += s.dur; return o; });
const TOTAL = _acc;
const OVERLAP = 0.6;

function VXLANVideo() {
  return (
    <Stage width={1920} height={1080} duration={TOTAL} background={C.bg} persistKey="vxlan">
      <Backdrop />
      {TIMED.map((s) => {
        const Comp = s.comp;
        return (
          <Sprite key={s.id} start={s.start} end={Math.min(TOTAL, s.end + OVERLAP)}>
            <Comp />
          </Sprite>
        );
      })}
      <Chrome sections={TIMED} total={TOTAL} />
    </Stage>
  );
}

window.VXLANVideo = VXLANVideo;
