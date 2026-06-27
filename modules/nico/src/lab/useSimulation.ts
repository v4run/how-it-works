// Live datacenter simulation. Advances a sim clock with requestAnimationFrame
// and produces a throttled snapshot of:
//   - per-server lifecycle state (FSM stage + substep, progress, reconcile retries)
//   - a reconcile/event log: the concrete operations NICo runs per node
//     (Redfish, DHCP/iPXE, PCI inventory, image stream, cloud-init, DOCA flow
//     programming, SR-IOV bind, gRPC registration)
//   - per-tenant traffic counters (allowed, blocked at the DPU, leaked when off)
//
// Provisioning is deterministic from the sim clock: when the run starts each
// server begins its lifecycle (staggered, like a fleet coming up) and walks the
// stages toward its desired state. A fault stalls a server at the Image stage;
// NICo reconciles (requeue + retry) and the server then recovers.

import React from 'react';
import { LabState, READY_STAGE, AVAILABLE_STAGE, Server, Tenant } from './model';
import { C } from '../design/theme';
import { HW_CATALOG, OS_IMAGES, nodeFacts, vfFor } from './hardware';

export type Phase = 'raw' | 'discovering' | 'provisioning' | 'reconciling' | 'discovered' | 'ready';
export type Level = 'info' | 'ok' | 'warn' | 'err';

export interface ServerView {
  id: string;
  stageIdx: number;
  progress: number; // 0..1 within the current stage
  status: string;
  substep: string;
  observed: string; // observed state for desired-vs-observed reconciliation
  led: string;
  phase: Phase;
  reconciles: number;
  ready: boolean;
}

export interface LogEntry {
  id: number;
  t: number;
  node: string;
  level: Level;
  msg: string;
}

export interface TenantStat {
  allowed: number;
  blocked: number;
  leaked: number;
  readyServers: number;
  gbps: number;
}

export interface SimSnapshot {
  t: number;
  running: boolean;
  servers: Record<string, ServerView>;
  tenants: Record<string, TenantStat>;
  events: LogEntry[];
  totalBlocked: number;
  totalLeaked: number;
}

const EMPTY: SimSnapshot = { t: 0, running: false, servers: {}, tenants: {}, events: [], totalBlocked: 0, totalLeaked: 0 };

// Per-stage durations (s): Detected, Discovery, Validation, DPU Provisioning,
// Attestation, OS Provisioning, Isolation. (In Service is terminal.)
const D = [0.5, 1.4, 1.2, 1.6, 0.9, 2.0, 1.3];
const CUM = [0, 0.5, 1.9, 3.1, 4.7, 5.6, 7.6, 8.9]; // entry time of each stage
const IMG_START = CUM[5]; // OS Provisioning — where an injected fault stalls
const AVAILABLE_DONE = CUM[5]; // Day 0 done (Attestation passed) → AVAILABLE pool
const FAULT_STALL = 2.6;
const STAGGER = 0.7;
const DISCOVERED_COLOR = '#7fd4c7';

const SUBSTEP = [
  'Redfish OOB handshake',
  'Scout inventory',
  'SKU + burn-in',
  'DPU OS + HBN',
  'Measured Boot / TPM',
  'PXE OS image',
  'HBN + IB P_Key',
  'in service',
];

function effOf(srv: Server, e: number): { eff: number; reconciling: boolean; reconciles: number } {
  if (!srv.faultInjected || e < IMG_START) return { eff: e, reconciling: false, reconciles: 0 };
  if (e < IMG_START + FAULT_STALL) return { eff: IMG_START, reconciling: true, reconciles: 1 };
  return { eff: e - FAULT_STALL, reconciling: false, reconciles: 1 };
}

export function serverView(srv: Server, e: number): ServerView {
  if (e <= 0) {
    return { id: srv.id, stageIdx: 0, progress: 0, status: 'DETECTED', substep: 'awaiting run', observed: 'absent', led: 'rgba(255,255,255,0.18)', phase: 'raw', reconciles: 0, ready: false };
  }
  const { eff, reconciling, reconciles } = effOf(srv, e);
  const provisioned = srv.desired === 'provisioned';
  const doneTime = provisioned ? CUM[READY_STAGE] : AVAILABLE_DONE;

  if (reconciling) {
    return { id: srv.id, stageIdx: 5, progress: 0, status: 'RECONCILING', substep: 'requeue · backoff', observed: 'os-provisioning', led: C.red, phase: 'reconciling', reconciles, ready: false };
  }
  if (eff >= doneTime) {
    if (provisioned) return { id: srv.id, stageIdx: READY_STAGE, progress: 1, status: 'IN SERVICE', substep: SUBSTEP[7], observed: 'in-service', led: C.green, phase: 'ready', reconciles, ready: true };
    return { id: srv.id, stageIdx: AVAILABLE_STAGE, progress: 1, status: 'AVAILABLE', substep: 'attested', observed: 'available', led: DISCOVERED_COLOR, phase: 'discovered', reconciles, ready: false };
  }
  let stageIdx = 0;
  for (let i = 0; i < CUM.length - 1; i++) if (eff >= CUM[i]) stageIdx = i;
  const progress = Math.min(1, (eff - CUM[stageIdx]) / (D[stageIdx] || 1));
  const day0 = stageIdx <= AVAILABLE_STAGE;
  const status = day0 ? 'DAY 0 · BRING-UP' : 'DAY 1 · PROVISIONING';
  const phase: Phase = day0 ? 'discovering' : 'provisioning';
  const observed = ['detecting', 'discovering', 'validating', 'dpu-provisioning', 'attesting', 'os-provisioning', 'isolating'][stageIdx] ?? 'working';
  return { id: srv.id, stageIdx, progress, status, substep: SUBSTEP[stageIdx], observed, led: C.amber, phase, reconciles, ready: false };
}

export function staticServerView(srv: Server): ServerView {
  return serverView(srv, 0);
}

/* ── Reconcile/event log milestones ─────────────────────────────────────── */
interface Milestone { time: number; level: Level; msg: string }

function buildMilestones(srv: Server, tenant: Tenant | null): Milestone[] {
  const hw = HW_CATALOG[srv.hw];
  const os = OS_IMAGES.find((o) => o.id === srv.os) ?? OS_IMAGES[0];
  const f = nodeFacts(srv.num);
  const vlan = tenant ? tenant.vlan : 1;
  const pkey = tenant ? tenant.pkey : '0x7fff';
  const provisioned = srv.desired === 'provisioned';

  const dpu = hw.dpu.replace(/^\d+× /, '');
  const m: Milestone[] = [
    // Day 0 — Detected
    { time: 0.05, level: 'info', msg: `Redfish reachable on OOB · https://${f.bmc}/redfish/v1` },
    // Day 0 — Discovery (Scout agent)
    { time: 0.55, level: 'info', msg: `Scout agent booted (in-memory) → hardware crawl` },
    { time: 0.95, level: 'info', msg: `PCI inventory: ${hw.gpu}, ${hw.nic}` },
    { time: 1.4, level: 'info', msg: `LLDP: linked ${dpu} ${f.dpuBdf} ↔ host · serial ${f.serial}` },
    { time: 1.75, level: 'ok', msg: `inventory committed → API Service (PostgreSQL)` },
    // Day 0 — Validation
    { time: 1.95, level: 'info', msg: `SKU validate vs site baseline · ${hw.cpu}` },
    { time: 2.4, level: 'info', msg: `burn-in: InfiniBand + NVLink fabric test` },
    { time: 2.9, level: 'ok', msg: `firmware baseline OK: UEFI + BMC compliant` },
    // Day 0 — DPU Provisioning
    { time: 3.15, level: 'info', msg: `BlueField: flash BFB · DOCA HBN (Containerized Cumulus)` },
    { time: 3.9, level: 'info', msg: `DPU firmware: NIC + UEFI + ATF` },
    { time: 4.4, level: 'ok', msg: `DPU Agent online → API Service (gRPC mTLS, 30s poll)` },
    // Day 0 — Attestation
    { time: 4.75, level: 'info', msg: `Measured Boot: PCR quote` },
    { time: 5.35, level: 'ok', msg: `TPM signature verified → AVAILABLE pool` },
  ];
  if (!provisioned) {
    m.push({ time: 5.6, level: 'ok', msg: `Day 0 complete — AVAILABLE (desired=discovered)` });
    return m;
  }
  m.push(
    // Day 1 — OS Provisioning
    { time: 5.65, level: 'info', msg: `host lockdown: UEFI lockdown · disable in-band BMC` },
    { time: 6.0, level: 'info', msg: `PXE/iPXE → stream ${os.label} (${os.size}) → nvme0n1` },
    { time: 6.8, level: 'info', msg: `install ${os.driver} + ${os.doca}` },
    { time: 7.3, level: 'info', msg: `cloud-init: hostname=${srv.name}, ssh CA, FMDS metadata` },
    // Day 1 — Isolation
    { time: 7.65, level: 'info', msg: tenant ? `HBN: VXLAN/EVPN + per-tenant VRF (vlan ${vlan})` : `HBN: mgmt VRF (vlan ${vlan})` },
    { time: 8.05, level: 'info', msg: `UFM: InfiniBand P_Key ${pkey} partition` },
    { time: 8.45, level: 'info', msg: `instance allocated${tenant ? ` → ${tenant.name}` : ''} · SR-IOV ${vfFor(srv.num)}` },
    // Day 1 — In Service
    { time: 8.95, level: 'ok', msg: `IN SERVICE · reconciled (observed == desired)` },
  );
  return m;
}

export function useSimulation(state: LabState): SimSnapshot {
  const [snap, setSnap] = React.useState<SimSnapshot>(EMPTY);

  const acc = React.useRef({
    t: 0,
    lastEmit: 0,
    logId: 0,
    events: [] as LogEntry[],
    startAt: {} as Record<string, number>, // sim time each host began its lifecycle
    fired: {} as Record<string, number>, // milestones fired per node
    faultFired: {} as Record<string, boolean>,
    day2Fired: {} as Record<string, boolean>,
    milestones: {} as Record<string, Milestone[]>,
    msSig: {} as Record<string, string>, // re-provision trigger (desired/os/fault)
    tnSig: {} as Record<string, string>, // tenant binding (refreshes milestone text)
    allowed: {} as Record<string, number>,
    blocked: {} as Record<string, number>,
    leaked: {} as Record<string, number>,
  });
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const rafRef = React.useRef<number | null>(null);
  const lastTs = React.useRef<number | null>(null);

  // Hard reset only on an explicit Reset or preset load (both bump resetNonce).
  // Adding / removing hosts and tenants does NOT reset — already-provisioned
  // hosts keep their state and only the new ones get provisioned.
  React.useEffect(() => {
    const a = acc.current;
    a.t = 0;
    a.lastEmit = 0;
    a.logId = 0;
    a.events = [];
    a.startAt = {};
    a.fired = {};
    a.faultFired = {};
    a.day2Fired = {};
    a.milestones = {};
    a.msSig = {};
    a.tnSig = {};
    a.allowed = {};
    a.blocked = {};
    a.leaked = {};
    setSnap({ ...EMPTY, running: stateRef.current.running });
  }, [state.resetNonce]);

  React.useEffect(() => {
    if (!state.running) {
      lastTs.current = null;
      setSnap((p) => ({ ...p, running: false }));
      return;
    }
    const step = (ts: number) => {
      if (lastTs.current == null) lastTs.current = ts;
      const dt = Math.min(0.05, (ts - lastTs.current) / 1000);
      lastTs.current = ts;
      const s = stateRef.current;
      const a = acc.current;
      a.t += dt;

      const push = (node: string, level: Level, msg: string) => {
        a.events.push({ id: a.logId++, t: a.t, node, level, msg });
        if (a.events.length > 240) a.events.shift();
      };

      const servers: Record<string, ServerView> = {};
      const readyByTenant: Record<string, number> = {};
      const tenantOf = (srv: Server) => s.tenants.find((tn) => tn.id === srv.tenantId) ?? null;
      const freshRun = Object.keys(a.startAt).length === 0; // nothing started yet → stagger the wave
      s.servers.forEach((srv, i) => {
        const msSig = `${srv.desired}|${srv.os}|${srv.faultInjected}`;
        const tnSig = srv.tenantId ?? '';
        if (a.milestones[srv.id] == null) {
          a.milestones[srv.id] = buildMilestones(srv, tenantOf(srv));
          a.msSig[srv.id] = msSig;
          a.tnSig[srv.id] = tnSig;
          a.fired[srv.id] = 0;
        } else if (a.msSig[srv.id] !== msSig) {
          // desired/os/fault changed → NICo re-provisions this host from now
          a.milestones[srv.id] = buildMilestones(srv, tenantOf(srv));
          a.msSig[srv.id] = msSig;
          a.tnSig[srv.id] = tnSig;
          a.fired[srv.id] = 0;
          a.faultFired[srv.id] = false;
          a.day2Fired[srv.id] = false;
          a.startAt[srv.id] = a.t;
          push(srv.name, 'info', `reconcile: desired state changed → re-provisioning`);
        } else if (a.tnSig[srv.id] !== tnSig) {
          // tenant binding changed → refresh isolation text, no re-image
          a.milestones[srv.id] = buildMilestones(srv, tenantOf(srv));
          a.tnSig[srv.id] = tnSig;
        }
        // Assign a start time: staggered on a fresh run, immediate for hosts
        // added later (so existing hosts aren't disturbed).
        if (a.startAt[srv.id] == null) a.startAt[srv.id] = a.t + (freshRun ? i * STAGGER : 0);

        const e = a.t - a.startAt[srv.id];
        const v = serverView(srv, e);
        servers[srv.id] = v;
        if (v.ready && srv.tenantId) readyByTenant[srv.tenantId] = (readyByTenant[srv.tenantId] || 0) + 1;

        if (e <= 0) return;
        const { eff } = effOf(srv, e);
        // fault events (raw timeline)
        if (srv.faultInjected && e >= IMG_START && !a.faultFired[srv.id]) {
          a.faultFired[srv.id] = true;
          push(srv.name, 'err', `image write fault: nvme0n1 checksum mismatch`);
          push(srv.name, 'warn', `reconcile: requeue node, retry image (attempt 2) · backoff ${FAULT_STALL}s`);
        }
        // milestone events (eff timeline)
        const ms = a.milestones[srv.id] || [];
        let fired = a.fired[srv.id] || 0;
        while (fired < ms.length && eff >= ms[fired].time) {
          push(srv.name, ms[fired].level, ms[fired].msg);
          fired++;
        }
        a.fired[srv.id] = fired;

        // Day 2: once in service, health monitoring kicks in.
        if (v.ready && !a.day2Fired[srv.id]) {
          a.day2Fired[srv.id] = true;
          push(srv.name, 'info', `Day 2: health monitor active — Redfish poll + DPU telemetry → Prometheus`);
        }
      });

      // traffic
      const liveTenants = Object.keys(readyByTenant);
      for (const tid of liveTenants) a.allowed[tid] = (a.allowed[tid] || 0) + dt * 120 * readyByTenant[tid];
      if (liveTenants.length >= 2) {
        for (const tid of liveTenants) {
          const probe = dt * 22;
          if (s.dpuEnforcement) a.blocked[tid] = (a.blocked[tid] || 0) + probe;
          else a.leaked[tid] = (a.leaked[tid] || 0) + probe;
        }
      }

      if (a.t - a.lastEmit > 0.06) {
        a.lastEmit = a.t;
        const tenants: Record<string, TenantStat> = {};
        let totalBlocked = 0;
        let totalLeaked = 0;
        for (const t of s.tenants) {
          const ready = readyByTenant[t.id] || 0;
          const blocked = a.blocked[t.id] || 0;
          const leaked = a.leaked[t.id] || 0;
          totalBlocked += blocked;
          totalLeaked += leaked;
          tenants[t.id] = {
            allowed: a.allowed[t.id] || 0,
            blocked,
            leaked,
            readyServers: ready,
            gbps: ready * 25 * (0.7 + 0.3 * Math.abs(Math.sin(a.t * 1.6 + t.vlan))),
          };
        }
        setSnap({ t: a.t, running: true, servers, tenants, events: a.events.slice(-80), totalBlocked: Math.round(totalBlocked), totalLeaked: Math.round(totalLeaked) });
      }

      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTs.current = null;
    };
  }, [state.running]);

  return snap;
}
