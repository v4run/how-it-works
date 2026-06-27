// The engineering dashboard: the bare-metal fleet walking NICo's Day 0/1
// lifecycle, a node inspector (identity + hardware + lifecycle + isolation),
// the DPU isolation flow rules, a live reconcile/event log, and a reference
// of the real NICo control-plane architecture.
import React from 'react';
import { C, MONO, DISP, UI, hexToRgb } from '../design/theme';
import { LabState, STAGES, STAGE_DAY, AVAILABLE_STAGE, Server, Tenant, tenantById } from './model';
import { SimSnapshot, ServerView, LogEntry, staticServerView } from './useSimulation';
import { HW_CATALOG, osById, nodeFacts, vfFor } from './hardware';

const LEVEL_COLOR: Record<string, string> = { info: C.dim, ok: C.green, warn: C.amber, err: C.red };

export function LabViz({ state, snap, selectedId, onSelect }: { state: LabState; snap: SimSnapshot; selectedId: string | null; onSelect: (id: string) => void }) {
  const [view, setView] = React.useState<'fleet' | 'topology'>('fleet');
  const selected = state.servers.find((s) => s.id === selectedId) ?? state.servers[0] ?? null;
  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: 26 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1280, margin: '0 auto' }}>
        <ViewToggle view={view} setView={setView} snap={snap} />
        {view === 'fleet' ? (
          <>
            <Fleet state={state} snap={snap} selectedId={selected?.id ?? null} onSelect={onSelect} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
              <NodeInspector srv={selected} view={selected ? snap.servers[selected.id] ?? staticServerView(selected) : null} tenant={selected ? tenantById(state, selected.tenantId) : null} />
              <DpuPanel state={state} snap={snap} />
            </div>
            <EventLog events={snap.events} running={snap.running} />
            <Architecture />
          </>
        ) : (
          <Topology state={state} snap={snap} selected={selected} />
        )}
      </div>
    </div>
  );
}

function ViewToggle({ view, setView, snap }: { view: 'fleet' | 'topology'; setView: (v: 'fleet' | 'topology') => void; snap: SimSnapshot }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', border: `1px solid ${C.line}`, borderRadius: 9, overflow: 'hidden' }}>
        {(['fleet', 'topology'] as const).map((v) => {
          const on = view === v;
          return (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{ padding: '8px 16px', border: 'none', cursor: 'pointer', background: on ? `rgba(${hexToRgb(C.green)},0.16)` : 'transparent', color: on ? C.green : C.dim, fontFamily: DISP, fontSize: 14, fontWeight: 600, borderBottom: on ? `2px solid ${C.green}` : '2px solid transparent' }}
            >
              {v === 'fleet' ? 'Fleet & lifecycle' : 'Network topology'}
            </button>
          );
        })}
      </div>
      {view === 'fleet' && (
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
          <LegendChip color={C.amber} label="Day 0 bring-up" />
          <LegendChip color="#7fd4c7" label="available pool" />
          <LegendChip color={C.green} label="Day 1 in service" />
          <LegendChip color={C.red} label="reconciling" />
        </div>
      )}
      <span style={{ fontFamily: MONO, fontSize: 12, color: C.faint, marginLeft: view === 'fleet' ? 0 : 'auto', alignSelf: 'center' }}>t={snap.t.toFixed(1)}s</span>
    </div>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 11, color: C.dim }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: color }} /> {label}
    </span>
  );
}

/* ── Fleet grid ─────────────────────────────────────────────────────────── */
function Fleet({ state, snap, selectedId, onSelect }: { state: LabState; snap: SimSnapshot; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <div>
      <SectionLabel>Bare-metal fleet · {state.servers.length} host{state.servers.length === 1 ? '' : 's'}</SectionLabel>
      {state.servers.length === 0 ? (
        <Empty>No hosts yet — add bare metal in the control plane. NICo discovers it over the OOB network (Redfish) and runs it through the lifecycle.</Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginTop: 12 }}>
          {state.servers.map((srv) => (
            <ServerCard key={srv.id} srv={srv} view={snap.servers[srv.id] ?? staticServerView(srv)} tenant={tenantById(state, srv.tenantId)} selected={srv.id === selectedId} onSelect={() => onSelect(srv.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ServerCard({ srv, view, tenant, selected, onSelect }: { srv: Server; view: ServerView; tenant: Tenant | null; selected: boolean; onSelect: () => void }) {
  const hw = HW_CATALOG[srv.hw];
  const ledRgb = view.led.startsWith('#') ? hexToRgb(view.led) : '255,255,255';
  const stageName = STAGES[view.stageIdx];
  const dayTag = view.phase === 'ready' ? 'in service' : view.phase === 'discovered' ? 'available' : view.phase === 'raw' ? 'detected' : `day ${STAGE_DAY[view.stageIdx]}`;
  return (
    <div
      onClick={onSelect}
      style={{
        border: `1px solid ${selected ? `rgba(${ledRgb},0.9)` : view.phase === 'raw' ? C.line : `rgba(${ledRgb},0.45)`}`,
        borderRadius: 12,
        padding: 13,
        cursor: 'pointer',
        background: view.phase === 'raw' ? 'rgba(255,255,255,0.015)' : `rgba(${ledRgb},0.06)`,
        opacity: view.phase === 'raw' ? 0.75 : 1,
        boxShadow: selected ? `0 0 0 1px rgba(${ledRgb},0.5), 0 0 26px rgba(${ledRgb},0.14)` : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint }}>{hw.label}</div>
          <div style={{ fontFamily: DISP, fontSize: 19, fontWeight: 600, color: C.ink, marginTop: 2 }}>{srv.name}</div>
        </div>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: view.led, boxShadow: view.phase !== 'raw' ? `0 0 12px ${view.led}` : 'none' }} />
      </div>

      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: MONO, fontSize: 11.5, color: view.phase === 'reconciling' ? C.red : view.phase === 'ready' ? C.green : view.led }}>{stageName}</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{dayTag}</span>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{view.substep}</div>

      <div style={{ marginTop: 8, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${view.ready || view.phase === 'discovered' ? 100 : ((view.stageIdx + view.progress) / (STAGES.length - 1)) * 100}%`, background: view.phase === 'reconciling' ? C.red : `linear-gradient(90deg, ${C.green}, ${C.greenHi})`, transition: 'width 0.1s linear' }} />
      </div>

      <div style={{ marginTop: 11, display: 'flex', alignItems: 'center', gap: 8, minHeight: 20 }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint }}>{hw.gpuCount}× GPU</span>
        {tenant ? (
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: 11, color: tenant.color, border: `1px solid ${tenant.color}66`, borderRadius: 6, padding: '2px 7px' }}>
            <span style={{ width: 7, height: 7, borderRadius: 4, background: tenant.color }} />
            {tenant.name}
          </span>
        ) : (
          <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11, color: C.faint }}>unassigned</span>
        )}
        {view.reconciles > 0 && <span style={{ fontFamily: MONO, fontSize: 10, color: view.phase === 'reconciling' ? C.red : C.dim }}>↻{view.reconciles}</span>}
      </div>
    </div>
  );
}

/* ── Node inspector ─────────────────────────────────────────────────────── */
function NodeInspector({ srv, view, tenant }: { srv: Server | null; view: ServerView | null; tenant: Tenant | null }) {
  if (!srv || !view) {
    return (
      <Panel title="Node inspector">
        <Empty>Add or select a host to inspect its identity, hardware, lifecycle and isolation.</Empty>
      </Panel>
    );
  }
  const hw = HW_CATALOG[srv.hw];
  const os = osById(srv.os);
  const f = nodeFacts(srv.num);
  const statusColor = view.phase === 'ready' ? C.green : view.phase === 'reconciling' ? C.red : view.phase === 'discovered' ? '#7fd4c7' : view.phase === 'raw' ? C.faint : C.amber;
  return (
    <Panel
      title={`Node inspector · ${srv.name}`}
      right={<span style={{ fontFamily: MONO, fontSize: 11, color: statusColor, border: `1px solid ${statusColor}66`, borderRadius: 6, padding: '3px 8px' }}>{view.status}</span>}
    >
      <KV label="desired" value={srv.desired} />
      <KV label="observed" value={view.observed} valueColor={view.observed === srv.desired || (srv.desired === 'discovered' && view.observed === 'available') || (srv.desired === 'provisioned' && view.observed === 'in-service') ? C.green : C.amber} />

      <SubHead>Identity (out-of-band)</SubHead>
      <Grid2>
        <KV label="BMC / Redfish" value={f.bmc} />
        <KV label="NIC MAC" value={f.mac} />
        <KV label="chassis serial" value={f.serial} />
        <KV label="DHCP lease" value={f.dhcp} />
        <KV label="DPU PCIe" value={f.dpuBdf} />
        <KV label="OS image" value={os.label} />
      </Grid2>

      <SubHead>Hardware (discovered)</SubHead>
      <Grid2>
        <KV label="CPU" value={hw.cpu} />
        <KV label="GPU" value={hw.gpu} />
        <KV label="NIC" value={hw.nic} />
        <KV label="DPU" value={`${hw.dpu} · ${hw.dpuVfs} VFs`} />
        <KV label="memory" value={hw.mem} />
        <KV label="storage" value={hw.disk} />
      </Grid2>

      <SubHead>Lifecycle state machine</SubHead>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {STAGES.map((s, i) => {
          const st = stageState(i, view);
          const col = st === 'done' ? C.green : st === 'active' ? C.amber : st === 'fault' ? C.red : st === 'held' ? '#7fd4c7' : C.faint;
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 14, height: 14, borderRadius: 7, flexShrink: 0, border: `1.5px solid ${col}`, background: st === 'done' || st === 'held' ? col : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {(st === 'done' || st === 'held') && <span style={{ width: 5, height: 5, borderRadius: 3, background: C.bg }} />}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: st === 'pending' ? C.faint : C.ink, minWidth: 132 }}>{s}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>day {STAGE_DAY[i]}</span>
              {st === 'active' && <span style={{ fontFamily: MONO, fontSize: 10, color: C.amber, marginLeft: 'auto' }}>{view.substep}</span>}
              {st === 'fault' && <span style={{ fontFamily: MONO, fontSize: 10, color: C.red, marginLeft: 'auto' }}>reconciling ↻{view.reconciles}</span>}
            </div>
          );
        })}
      </div>

      <SubHead>Isolation binding</SubHead>
      {tenant ? (
        <Grid2>
          <KV label="tenant" value={tenant.name} valueColor={tenant.color} />
          <KV label="SR-IOV VF" value={`${vfFor(srv.num)} (BlueField)`} />
          <KV label="Ethernet" value={`VXLAN/EVPN · VRF vlan ${tenant.vlan}`} />
          <KV label="InfiniBand" value={`UFM P_Key ${tenant.pkey}`} />
        </Grid2>
      ) : (
        <Empty>No tenant assigned — host stays on the management VRF (vlan 1). Assign a tenant to bind an isolated VRF + IB P_Key.</Empty>
      )}
    </Panel>
  );
}

function stageState(i: number, view: ServerView): 'done' | 'active' | 'pending' | 'held' | 'fault' {
  if (view.phase === 'ready') return 'done';
  if (view.phase === 'discovered') return i <= AVAILABLE_STAGE ? 'done' : 'held';
  if (view.phase === 'raw') return 'pending';
  if (view.phase === 'reconciling') return i < view.stageIdx ? 'done' : i === view.stageIdx ? 'fault' : 'pending';
  return i < view.stageIdx ? 'done' : i === view.stageIdx ? 'active' : 'pending';
}

/* ── DPU isolation panel ────────────────────────────────────────────────── */
function DpuPanel({ state, snap }: { state: LabState; snap: SimSnapshot }) {
  const enforced = state.dpuEnforcement;
  const live = state.tenants.filter((t) => (snap.tenants[t.id]?.readyServers ?? 0) > 0);
  return (
    <Panel
      title="DPU isolation · BlueField HBN"
      right={
        <span style={{ fontFamily: MONO, fontSize: 11, color: enforced ? C.green : C.red, border: `1px solid ${enforced ? C.greenEdge : `rgba(${hexToRgb(C.red)},0.5)`}`, background: enforced ? C.greenSoft : `rgba(${hexToRgb(C.red)},0.1)`, borderRadius: 6, padding: '3px 8px' }}>
          {enforced ? 'ENFORCED' : 'DISABLED'}
        </span>
      }
    >
      <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint, lineHeight: 1.5, marginBottom: 12 }}>
        The DPU Agent programs <span style={{ color: C.dim }}>doca_flow</span> ACLs on each BlueField. Tenants get an Ethernet VRF (VXLAN/EVPN) and an InfiniBand P_Key; the DPU drops cross-tenant flows below the host OS.
      </div>
      {live.length === 0 ? (
        <Empty>No in-service tenants yet — provision a host, assign a tenant and Run. Per-tenant flows and DPU ACL hits appear here.</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {live.map((t) => {
            const st = snap.tenants[t.id];
            return (
              <div key={t.id} style={{ border: `1px solid ${t.color}33`, borderRadius: 10, padding: '10px 12px', background: `rgba(${hexToRgb(t.color)},0.04)` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 5, background: t.color, boxShadow: `0 0 8px ${t.color}` }} />
                  <span style={{ fontFamily: DISP, fontSize: 14, fontWeight: 600, color: C.ink }}>{t.name}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint }}>vrf vlan {t.vlan} · P_Key {t.pkey} · {st.readyServers} host{st.readyServers === 1 ? '' : 's'}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11, color: C.green }}>↑ {Math.round(st.gbps)} Gb/s</span>
                </div>
                <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <FlowRule ok label={`allow  vrf-${t.name.slice(-1)} ↔ vrf-${t.name.slice(-1)}  (intra-tenant)`} stat="permit" />
                  {live.length >= 2 && (
                    enforced
                      ? <FlowRule ok={false} label={`deny   vrf-${t.name.slice(-1)} ✗ other vrf  (inter-tenant)`} stat={`${Math.round(st.blocked)} dropped`} />
                      : <FlowRule ok={false} warn label={`(no ACL)  vrf-${t.name.slice(-1)} → other vrf  leaking`} stat={`${Math.round(st.leaked)} leaked`} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function FlowRule({ ok, warn, label, stat }: { ok: boolean; warn?: boolean; label: string; stat: string }) {
  const col = ok ? C.green : warn ? C.red : C.red;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 11 }}>
      <span style={{ color: col }}>{ok ? '✓' : '✕'}</span>
      <span style={{ color: C.dim }}>{label}</span>
      <span style={{ marginLeft: 'auto', color: col }}>{stat}</span>
    </div>
  );
}

/* ── Reconcile / event log ──────────────────────────────────────────────── */
function EventLog({ events, running }: { events: LogEntry[]; running: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const stick = React.useRef(true); // only auto-scroll when the user is at the bottom
  const onScroll = () => {
    const el = ref.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };
  React.useEffect(() => {
    if (stick.current && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [events]);
  return (
    <Panel title="Reconcile log · NICo Core" right={<span style={{ fontFamily: MONO, fontSize: 11, color: running ? C.green : C.faint }}>{running ? '● live · scroll up to pause follow' : 'idle'}</span>}>
      <div ref={ref} onScroll={onScroll} style={{ height: 220, overflowY: 'auto', overscrollBehavior: 'contain', fontFamily: MONO, fontSize: 11.5, lineHeight: 1.65 }}>
        {events.length === 0 ? (
          <Empty>Run the simulation — every operation NICo performs per host streams here (Redfish, Scout, DPU Agent, PXE, HBN, UFM…).</Empty>
        ) : (
          events.map((e) => (
            <div key={e.id} style={{ display: 'flex', gap: 10, whiteSpace: 'nowrap' }}>
              <span style={{ color: C.faint, width: 52, flexShrink: 0, textAlign: 'right' }}>{e.t.toFixed(1)}s</span>
              <span style={{ color: C.dim, width: 64, flexShrink: 0 }}>{e.node}</span>
              <span style={{ color: LEVEL_COLOR[e.level], whiteSpace: 'normal' }}>{e.msg}</span>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

/* ── Architecture reference ─────────────────────────────────────────────── */
function Architecture() {
  return (
    <Panel title="NICo control plane · reference">
      <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint, lineHeight: 1.5, marginBottom: 14 }}>
        Site Controller — a Kubernetes cluster (≥3 nodes) co-located in the datacenter; all services speak mTLS/gRPC. Open-source suite at github.com/NVIDIA/infra-controller.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <ArchCard title="NICo REST · nico-rest" items={['JSON API (operators / cloud)', 'Temporal (workflow engine)', 'Keycloak (OIDC auth)', 'Site Agent (Temporal bridge)']} />
        <ArchCard title="NICo Core · nico-system" accent items={['API Service — source of truth', 'host / network / partition FSMs', 'DHCP→gRPC · PXE service', 'Hardware Health (Redfish→Prometheus)', 'SSH Console (→Loki) · DNS · Admin CLI']} />
        <ArchCard title="Common services" items={['MetalLB (VIP · BGP to ToR)', 'cert-manager · external-secrets', 'Vault (PKI + KV secrets)', 'PostgreSQL (nico_system_nico)']} />
        <ArchCard title="Managed host agents" items={['Scout — discovery / burn-in', 'DPU Agent — BlueField, 30s gRPC', 'FMDS — instance metadata', 'DPU DHCP — per-host isolation']} />
        <ArchCard title="Isolation planes (DPU-enforced)" items={['Ethernet — HBN VXLAN/EVPN + VRF', 'InfiniBand — UFM P_Key partitions', 'NVLink — NMX-M partitions', 'OOB management network separate']} />
        <ArchCard title="Lifecycle" items={['Day 0 — discover · validate · attest', 'Day 1 — OS · isolate · allocate', 'Day 2 — monitor · sanitize · reuse', 'desired-state, reconciled continuously']} />
      </div>
    </Panel>
  );
}
function ArchCard({ title, items, accent }: { title: string; items: string[]; accent?: boolean }) {
  return (
    <div style={{ border: `1px solid ${accent ? C.greenEdge : C.line}`, borderRadius: 10, padding: '12px 14px', background: accent ? C.greenSoft : 'rgba(255,255,255,0.015)' }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', color: accent ? C.green : C.dim, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((it, i) => (
          <div key={i} style={{ fontFamily: UI, fontSize: 12.5, color: C.dim, display: 'flex', gap: 7 }}>
            <span style={{ color: accent ? C.green : C.faint }}>·</span> {it}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Network topology ───────────────────────────────────────────────────── */
type FabricKind = 'compute' | 'storage' | 'frontend' | 'oob';
interface PNode { id: string; name: string; sub: string; kind: 'spine' | 'leaf' | 'host' | 'endpoint'; color?: string; host?: Server }
interface FabricCfg { tierLabels: string[]; tiers: PNode[][]; links: [string, string][]; path: string[]; chip: string; intro: string }

const FABRICS: { id: FabricKind; label: string }[] = [
  { id: 'compute', label: 'Compute (IB)' },
  { id: 'storage', label: 'Storage' },
  { id: 'frontend', label: 'Frontend (North-South)' },
  { id: 'oob', label: 'OOB mgmt' },
];

function Topology({ state, snap, selected }: { state: LabState; snap: SimSnapshot; selected: Server | null }) {
  const tenants = state.tenants;
  const [fabric, setFabric] = React.useState<FabricKind>('compute');
  const [tid, setTid] = React.useState<string | null>((selected && selected.tenantId) || tenants[0]?.id || null);
  const [openHost, setOpenHost] = React.useState<string | null>(selected?.id ?? null);
  React.useEffect(() => { if (!tenants.some((t) => t.id === tid)) setTid(tenants[0]?.id ?? null); }, [tenants, tid]);
  React.useEffect(() => { if (openHost && !state.servers.some((s) => s.id === openHost)) setOpenHost(null); }, [state.servers, openHost]);

  const tenant = fabric === 'oob' ? null : tenants.find((t) => t.id === tid) ?? null;
  const pkey = tenant ? tenant.pkey : '0x8001';
  const vlan = tenant ? tenant.vlan : 100;
  const spkey = '0x' + (parseInt(pkey, 16) + 0x100).toString(16);
  const vni = 10000 + vlan;
  const accent = fabric === 'oob' ? C.steel : tenant ? tenant.color : C.green;
  const tHosts = tenant ? state.servers.filter((s) => s.tenantId === tenant.id) : [];

  const cfg = buildFabric(fabric, state, tenant, pkey, spkey, vni);
  const openSrv = state.servers.find((s) => s.id === openHost) ?? null;

  return (
    <>
      <Panel
        title="Network topology · Clos fabric"
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {fabric !== 'oob' && tenants.length > 0 && (
              <select value={tid ?? ''} onChange={(e) => setTid(e.target.value)} style={{ fontFamily: MONO, fontSize: 12, color: accent, background: `rgba(${hexToRgb(accent)},0.08)`, border: `1px solid rgba(${hexToRgb(accent)},0.4)`, borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }}>
                {tenants.map((tn) => <option key={tn.id} value={tn.id} style={{ background: '#0c1110', color: C.ink }}>{tn.name}</option>)}
              </select>
            )}
          </div>
        }
      >
        {/* fabric tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {FABRICS.map((f) => {
            const on = fabric === f.id;
            return (
              <button key={f.id} onClick={() => setFabric(f.id)} style={{ fontFamily: MONO, fontSize: 12, padding: '6px 11px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${on ? C.greenEdge : C.line}`, background: on ? C.greenSoft : 'transparent', color: on ? C.green : C.dim }}>
                {f.label}
              </button>
            );
          })}
          <span style={{ marginLeft: 'auto', alignSelf: 'center', fontFamily: MONO, fontSize: 11, color: accent, border: `1px solid rgba(${hexToRgb(accent)},0.4)`, background: `rgba(${hexToRgb(accent)},0.08)`, borderRadius: 6, padding: '3px 9px' }}>{cfg.chip}</span>
        </div>

        <div style={{ fontFamily: MONO, fontSize: 11.5, color: C.faint, lineHeight: 1.55, marginBottom: 12 }}>{cfg.intro}</div>

        <Clos cfg={cfg} accent={accent} t={snap.t} openHost={openHost} onHost={setOpenHost} tenantActive={!!tenant || fabric === 'oob'} />

        {fabric === 'compute' && tenant && tHosts.length < 2 && (
          <div style={{ fontFamily: MONO, fontSize: 11, color: C.amber, marginTop: 8, border: `1px solid rgba(${hexToRgb(C.amber)},0.4)`, background: `rgba(${hexToRgb(C.amber)},0.08)`, borderRadius: 7, padding: '7px 10px' }}>
            {tenant.name} has {tHosts.length} host — east-west is GPU↔GPU traffic <em>between two hosts of the same tenant</em>. Assign a 2nd host to {tenant.name} (in the control plane) to see it flow over their shared rail.
          </div>
        )}

        <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint, marginTop: 8 }}>
          Faint links = physical wiring (shared by all tenants). {fabric === 'oob' ? 'OOB carries no tenant data.' : 'Coloured links + the moving dot = the selected tenant’s path — riding the same switches, isolated only by its P_Key / VRF.'} Click a host for its per-GPU rail detail.
        </div>

        {openSrv && <HostDetail fabric={fabric} srv={openSrv} tenant={tenants.find((t) => t.id === openSrv.tenantId) ?? null} onClose={() => setOpenHost(null)} />}
      </Panel>

      <Panel title="Isolation techniques · who enforces what">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          <ArchCard title="Compute east-west" items={[`InfiniBand: UFM P_Key partition (${pkey})`, 'Ethernet: VXLAN VNI + EVPN + VRF', 'enforced by: UFM / BlueField HBN', 'rail-optimized Clos: ConnectX-7 → Quantum-2']} />
          <ArchCard title="Storage east-west" items={[`dedicated partition (${spkey})`, 'GPUDirect Storage — RDMA to GPU mem', 'NVMe-oF over IB or RoCE', 'own leaf-spine, separate from compute']} />
          <ArchCard title="North-south" items={[`VXLAN overlay VNI ${vni}`, 'per-tenant VRF + EVPN/BGP', 'MetalLB VIP at the border leaf', 'gateway: BlueField-3 DPU (HBN)']} />
          <ArchCard title="Out-of-band" items={['physically separate mgmt network', 'Redfish (BMC) + DPU management', 'reached only by NICo Site Controller', 'carries zero tenant traffic']} />
        </div>
      </Panel>
    </>
  );
}

function buildFabric(fabric: FabricKind, state: LabState, tenant: Tenant | null, pkey: string, spkey: string, vni: number): FabricCfg {
  const hosts = state.servers;
  const colorOf = (srv: Server) => state.tenants.find((t) => t.id === srv.tenantId)?.color;
  const hostNode = (srv: Server, sub: string, withColor = true): PNode => ({ id: srv.id, name: srv.name, sub, kind: 'host', color: withColor ? colorOf(srv) : undefined, host: srv });
  const tHosts = tenant ? hosts.filter((s) => s.tenantId === tenant.id) : [];
  const a = tHosts[0];
  const b = tHosts[1] ?? tHosts[0];
  const idx = (s?: Server) => (s ? Math.max(0, hosts.indexOf(s)) : 0);

  if (fabric === 'compute') {
    const spines: PNode[] = [
      { id: 'sp1', name: 'QM2-spine-1', sub: 'Quantum-2', kind: 'spine' },
      { id: 'sp2', name: 'QM2-spine-2', sub: 'Quantum-2', kind: 'spine' },
    ];
    const leaves: PNode[] = [0, 1, 2, 3].map((i) => ({ id: `leaf${i}`, name: `rail-${i + 1}`, sub: 'QM2 leaf', kind: 'leaf' }));
    const hostNodes = hosts.map((s) => hostNode(s, 'ConnectX-7 ×8'));
    const links: [string, string][] = [];
    hostNodes.forEach((h) => leaves.forEach((l) => links.push([l.id, h.id])));
    leaves.forEach((l) => spines.forEach((sp) => links.push([sp.id, l.id])));
    // Rail-optimized east-west: GPU i of every host attaches to rail i, so a
    // same-rail GPU↔GPU exchange is a single leaf hop (no spine). Only cross-rail
    // traffic climbs to the Quantum-2 spine. Needs ≥2 distinct tenant hosts.
    const k = idx(a) % 4;
    const path = a && b && a.id !== b.id ? [a.id, `leaf${k}`, b.id] : [];
    return {
      tierLabels: ['SPINE', 'LEAF / RAIL', 'HOSTS'],
      tiers: [spines, leaves, hostNodes],
      links,
      path,
      chip: `InfiniBand NDR · UFM P_Key ${pkey}`,
      intro: `East-West GPU↔GPU RDMA on a rail-optimized Clos. Each host's 8 ConnectX-7 NICs attach one-per-GPU to rails 1–8 (4 shown). GPU i of every host lands on the same rail, so a same-rail exchange is a single leaf hop — the moving dot shows ${a && b && a.id !== b.id ? 'two hosts of this tenant talking over their shared rail' : 'this once two hosts share a tenant'}. Only cross-rail traffic climbs to the Quantum-2 spine. Tenants share these switches — isolation is the UFM P_Key, not separate hardware.`,
    };
  }

  if (fabric === 'storage') {
    const array: PNode[] = [{ id: 'arr', name: 'NVMe-oF array', sub: 'parallel FS', kind: 'endpoint' }];
    const spine: PNode[] = [{ id: 'ssp', name: 'storage spine', sub: 'Spectrum-X', kind: 'spine' }];
    const leaves: PNode[] = [0, 1].map((i) => ({ id: `sl${i}`, name: `stor-leaf-${i + 1}`, sub: 'Spectrum-X / IB', kind: 'leaf' }));
    const hostNodes = hosts.map((s) => hostNode(s, 'ConnectX-7 (storage)'));
    const links: [string, string][] = [];
    hostNodes.forEach((h) => leaves.forEach((l) => links.push([l.id, h.id])));
    leaves.forEach((l) => spine.forEach((sp) => links.push([sp.id, l.id])));
    spine.forEach((sp) => links.push([array[0].id, sp.id]));
    const path = a ? [a.id, `sl${idx(a) % 2}`, 'ssp', 'arr'] : [];
    return {
      tierLabels: ['STORAGE', 'SPINE', 'LEAF', 'HOSTS'],
      tiers: [array, spine, leaves, hostNodes],
      links,
      path,
      chip: `GPUDirect RDMA · P_Key ${spkey}`,
      intro: `A separate storage fabric. ConnectX-7 storage ports reach the NVMe-oF array over its own leaf-spine; GPUDirect Storage RDMA-writes straight into GPU memory, bypassing the CPU. Its own partition keeps it isolated from the compute fabric.`,
    };
  }

  if (fabric === 'frontend') {
    const cloud: PNode[] = [{ id: 'cloud', name: 'Cloud / WAN', sub: 'tenant VPC', kind: 'endpoint' }];
    const border: PNode[] = [{ id: 'border', name: 'Border', sub: 'EVPN / BGP', kind: 'endpoint' }];
    const spine: PNode[] = [{ id: 'fsp', name: 'Spectrum-4 spine', sub: 'SN5600', kind: 'spine' }];
    const leaves: PNode[] = [0, 1].map((i) => ({ id: `fl${i}`, name: `Spectrum-4 leaf-${i + 1}`, sub: 'frontend', kind: 'leaf' }));
    const hostNodes = hosts.map((s) => hostNode(s, 'BlueField-3 DPU'));
    const links: [string, string][] = [];
    hostNodes.forEach((h) => leaves.forEach((l) => links.push([l.id, h.id])));
    leaves.forEach((l) => spine.forEach((sp) => links.push([sp.id, l.id])));
    spine.forEach((sp) => links.push([border[0].id, sp.id]));
    links.push([cloud[0].id, border[0].id]);
    const path = a ? [a.id, `fl${idx(a) % 2}`, 'fsp', 'border', 'cloud'] : [];
    return {
      tierLabels: ['INTERNET', 'BORDER', 'SPINE', 'LEAF', 'HOSTS'],
      tiers: [cloud, border, spine, leaves, hostNodes],
      links,
      path,
      chip: `VXLAN VNI ${vni} · VRF · MetalLB VIP`,
      intro: `North-South egress. The BlueField-3 DPU is the frontend gateway: a VXLAN/EVPN overlay with a per-tenant VRF rides the Spectrum-4 Clos, BGP peers with the border leaf, and MetalLB advertises the tenant VIP out to the cloud / WAN.`,
    };
  }

  // oob
  const sc: PNode[] = [{ id: 'sc', name: 'Site Controller', sub: 'NICo (K8s)', kind: 'endpoint' }];
  const core: PNode[] = [{ id: 'core', name: 'OOB core', sub: '1GbE mgmt', kind: 'spine' }];
  const mgmt: PNode[] = [{ id: 'm0', name: 'mgmt switch', sub: '1GbE', kind: 'leaf' }];
  const hostNodes = hosts.map((s) => hostNode(s, 'BMC + DPU mgmt', false));
  const links: [string, string][] = [];
  hostNodes.forEach((h) => links.push(['m0', h.id]));
  links.push(['core', 'm0']);
  links.push(['sc', 'core']);
  const path = hosts[0] ? [hosts[0].id, 'm0', 'core', 'sc'] : [];
  return {
    tierLabels: ['CONTROLLER', 'CORE', 'MGMT', 'BMCs'],
    tiers: [sc, core, mgmt, hostNodes],
    links,
    path,
    chip: 'isolated · Redfish',
    intro: `Out-of-band management — a physically separate network. NICo's Site Controller reaches every host's BMC (Redfish) and DPU management here. Tenants have no access; this plane carries zero tenant data.`,
  };
}

function Clos({ cfg, accent, t, openHost, onHost, tenantActive }: { cfg: FabricCfg; accent: string; t: number; openHost: string | null; onHost: (id: string) => void; tenantActive: boolean }) {
  const W = 1240, PAD = 86, topY = 40, rowGap = 104;
  const nT = cfg.tiers.length;
  const H = topY + (nT - 1) * rowGap + 86;
  const pos: Record<string, { x: number; top: number; y: number; w: number; h: number; node: PNode }> = {};
  cfg.tiers.forEach((nodes, ti) => {
    const top = topY + ti * rowGap;
    const n = nodes.length || 1;
    const slot = (W - 2 * PAD) / n;
    nodes.forEach((nd, i) => {
      const isHost = nd.kind === 'host';
      const w = isHost ? Math.max(74, Math.min(120, slot - 8)) : 152;
      const h = isHost ? 54 : 42;
      pos[nd.id] = { x: PAD + slot * i + slot / 2, top, y: top + h / 2, w, h, node: nd };
    });
  });
  const pathPts = cfg.path.filter((id) => pos[id]).map((id) => ({ x: pos[id].x, y: pos[id].y }));

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', minWidth: 760 }}>
        {cfg.tierLabels.map((lb, ti) => (
          <text key={lb} x={8} y={topY + ti * rowGap + 25} style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em' }} fill={C.faint}>{lb}</text>
        ))}
        {cfg.links.map(([u, l], i) => {
          const pu = pos[u], pl = pos[l];
          if (!pu || !pl) return null;
          const hl = tenantActive && pl.node.kind === 'host' && !!pl.node.color && pl.node.color === accent;
          return <line key={i} x1={pu.x} y1={pu.top + pu.h} x2={pl.x} y2={pl.top} stroke={hl ? accent : 'rgba(255,255,255,0.07)'} strokeWidth={hl ? 1.5 : 1} opacity={hl ? 0.7 : 1} />;
        })}
        {pathPts.length >= 2 && <polyline points={pathPts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={accent} strokeWidth={2} opacity={0.5} strokeDasharray="2 7" />}
        <FlowDots points={pathPts} color={accent} t={t} />
        {Object.values(pos).map(({ x, top, w, h, node }) => (
          <NodeBox key={node.id} x={x} top={top} w={w} h={h} node={node} accent={accent} open={node.id === openHost} tenantActive={tenantActive} onClick={() => node.kind === 'host' && onHost(node.id)} />
        ))}
      </svg>
    </div>
  );
}

function NodeBox({ x, top, w, h, node, accent, open, tenantActive, onClick }: { x: number; top: number; w: number; h: number; node: PNode; accent: string; open: boolean; tenantActive: boolean; onClick: () => void }) {
  const isHost = node.kind === 'host';
  const isEnd = node.kind === 'endpoint';
  const dim = isHost && tenantActive && !!node.color && node.color !== accent;
  const border = isHost ? (node.color ? `rgba(${hexToRgb(node.color)},0.75)` : 'rgba(255,255,255,0.2)') : isEnd ? `rgba(${hexToRgb(accent)},0.5)` : 'rgba(255,255,255,0.16)';
  const fill = isEnd ? `rgba(${hexToRgb(accent)},0.08)` : isHost && node.color ? `rgba(${hexToRgb(node.color)},0.08)` : 'rgba(255,255,255,0.025)';
  return (
    <g style={{ cursor: isHost ? 'pointer' : 'default' }} onClick={onClick} opacity={dim ? 0.4 : 1}>
      <rect x={x - w / 2} y={top} width={w} height={h} rx={8} fill={fill} stroke={open ? accent : border} strokeWidth={open ? 2 : 1} />
      <text x={x} y={top + 21} textAnchor="middle" fill={C.ink} style={{ fontFamily: DISP, fontSize: 12, fontWeight: 600 }}>{node.name}</text>
      <text x={x} y={top + 37} textAnchor="middle" fill={C.faint} style={{ fontFamily: MONO, fontSize: 9.5 }}>{node.sub}</text>
      {isHost && node.color && <circle cx={x - w / 2 + 10} cy={top + 10} r={4} fill={node.color} />}
    </g>
  );
}

function FlowDots({ points, color, t, n = 2, speed = 0.2 }: { points: { x: number; y: number }[]; color: string; t: number; n?: number; speed?: number }) {
  if (points.length < 2) return null;
  const segs: { a: { x: number; y: number }; b: { x: number; y: number }; L: number; acc: number }[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    segs.push({ a, b, L, acc: total });
    total += L;
  }
  const at = (u: number) => {
    const d = u * total;
    let s = segs[segs.length - 1];
    for (const sg of segs) if (d <= sg.acc + sg.L) { s = sg; break; }
    const local = s.L ? (d - s.acc) / s.L : 0;
    return { x: s.a.x + (s.b.x - s.a.x) * local, y: s.a.y + (s.b.y - s.a.y) * local };
  };
  const dots: React.ReactNode[] = [];
  for (let k = 0; k < n; k++) {
    const p = at(((t * speed) + k / n) % 1);
    dots.push(<circle key={k} cx={p.x} cy={p.y} r={5} fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />);
  }
  return <>{dots}</>;
}

function HostDetail({ fabric, srv, tenant, onClose }: { fabric: FabricKind; srv: Server; tenant: Tenant | null; onClose: () => void }) {
  const hw = HW_CATALOG[srv.hw];
  const f = nodeFacts(srv.num);
  return (
    <div style={{ marginTop: 14, border: `1px solid ${C.line}`, borderRadius: 10, padding: '12px 14px', background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: DISP, fontSize: 14, fontWeight: 600, color: C.ink }}>{srv.name}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{hw.label} · {tenant ? tenant.name : 'unassigned'}</span>
        <button onClick={onClose} style={{ marginLeft: 'auto', width: 22, height: 22, borderRadius: 6, border: `1px solid ${C.line}`, background: 'transparent', color: C.dim, cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
      </div>
      {fabric === 'compute' || fabric === 'storage' ? (
        <>
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint, marginBottom: 8 }}>
            Rail-optimized wiring — each GPU has a dedicated ConnectX-7; GPU i attaches to rail i (same rail across every host). {tenant ? `Tenant slice = UFM P_Key ${tenant.pkey}.` : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 18px' }}>
            {Array.from({ length: hw.gpuCount }).map((_, i) => (
              <div key={i} style={{ fontFamily: MONO, fontSize: 11, color: C.dim, display: 'flex', gap: 8 }}>
                <span style={{ color: C.green }}>GPU{i}</span> → ConnectX-7 #{i} → <span style={{ color: C.ink }}>rail-{i + 1}</span>
              </div>
            ))}
          </div>
        </>
      ) : fabric === 'frontend' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 18px', fontFamily: MONO, fontSize: 11, color: C.dim }}>
          <div>gateway → <span style={{ color: C.ink }}>BlueField-3 DPU</span></div>
          <div>overlay → <span style={{ color: C.ink }}>VXLAN VNI {10000 + (tenant?.vlan ?? 100)}</span></div>
          <div>routing → <span style={{ color: C.ink }}>per-tenant VRF</span></div>
          <div>SR-IOV → <span style={{ color: C.ink }}>{vfFor(srv.num)} {f.dpuBdf}</span></div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 18px', fontFamily: MONO, fontSize: 11, color: C.dim }}>
          <div>BMC → <span style={{ color: C.ink }}>{f.bmc}</span></div>
          <div>MAC → <span style={{ color: C.ink }}>{f.mac}</span></div>
          <div>mgmt → <span style={{ color: C.ink }}>Redfish (OOB)</span></div>
          <div>reached by → <span style={{ color: C.ink }}>Site Controller only</span></div>
        </div>
      )}
    </div>
  );
}

/* ── Bits ───────────────────────────────────────────────────────────────── */
function Panel({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, background: 'rgba(255,255,255,0.012)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionLabel>{title}</SectionLabel>
        {right}
      </div>
      {children}
    </div>
  );
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim }}>{children}</div>;
}
function SubHead({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.faint, margin: '16px 0 8px' }}>{children}</div>;
}
function Grid2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 18px' }}>{children}</div>;
}
function KV({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint, whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: 11, color: valueColor ?? C.ink, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: MONO, fontSize: 12.5, color: C.faint, lineHeight: 1.55 }}>{children}</div>;
}
