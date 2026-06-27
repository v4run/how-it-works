// The control plane: declare desired state (add servers, choose discover vs
// provision), manage tenants, assign workloads to nodes, toggle DPU enforcement,
// inject faults, then Run and watch NICo reconcile every node.
import React from 'react';
import { C, MONO, DISP, hexToRgb } from '../design/theme';
import { Button } from '../design/atoms';
import {
  Action,
  LabState,
  Server,
  Tenant,
  Desired,
  MAX_SERVERS,
  MAX_TENANTS,
  tenantById,
} from './model';
import { SimSnapshot, staticServerView } from './useSimulation';
import { OS_IMAGES } from './hardware';
import { PRESETS } from './presets';

type Dispatch = (a: Action) => void;

export function LabControls({ state, dispatch, snap, selectedId, onSelect }: { state: LabState; dispatch: Dispatch; snap: SimSnapshot; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <RunBar state={state} dispatch={dispatch} snap={snap} />
      <Presets dispatch={dispatch} />
      <DpuPolicy state={state} dispatch={dispatch} snap={snap} />
      <Servers state={state} dispatch={dispatch} snap={snap} selectedId={selectedId} onSelect={onSelect} />
      <Tenants state={state} dispatch={dispatch} snap={snap} />
    </div>
  );
}

/* ── Section shell ──────────────────────────────────────────────────────── */
function Section({ title, accent = C.dim, children, right }: { title: string; accent?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, background: 'rgba(255,255,255,0.015)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase', color: accent }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

/* ── Run bar ────────────────────────────────────────────────────────────── */
function RunBar({ state, dispatch, snap }: { state: LabState; dispatch: Dispatch; snap: SimSnapshot }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Button accent={state.running ? C.amber : C.green} filled onClick={() => dispatch({ type: 'toggleRunning' })} style={{ flex: 1 }}>
        {state.running ? '❚❚  Pause' : '▶  Run · reconcile'}
      </Button>
      <Button accent={C.steel} onClick={() => dispatch({ type: 'reset' })}>
        Reset
      </Button>
      <div style={{ fontFamily: MONO, fontSize: 14, color: C.faint, fontVariantNumeric: 'tabular-nums', minWidth: 56, textAlign: 'right' }}>
        {snap.t.toFixed(1)}s
      </div>
    </div>
  );
}

/* ── Presets ────────────────────────────────────────────────────────────── */
function Presets({ dispatch }: { dispatch: Dispatch }) {
  return (
    <Section title="Scenarios">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {PRESETS.map((p) => (
          <Button key={p.name} small accent={p.accent} onClick={() => dispatch({ type: 'loadPreset', preset: p.build() })} title={p.hint}>
            {p.name}
          </Button>
        ))}
      </div>
    </Section>
  );
}

/* ── DPU policy ─────────────────────────────────────────────────────────── */
function DpuPolicy({ state, dispatch, snap }: { state: LabState; dispatch: Dispatch; snap: SimSnapshot }) {
  const on = state.dpuEnforcement;
  return (
    <Section title="DPU policy" accent={C.green}>
      <div style={{ display: 'flex', gap: 0, border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
        {[
          { v: true, label: 'Enforce isolation' },
          { v: false, label: 'Disabled (leak)' },
        ].map((o) => {
          const active = on === o.v;
          const accent = o.v ? C.green : C.red;
          return (
            <button
              key={String(o.v)}
              onClick={() => dispatch({ type: 'setDpuEnforcement', on: o.v })}
              style={{
                flex: 1,
                padding: '10px 6px',
                border: 'none',
                cursor: 'pointer',
                background: active ? `rgba(${hexToRgb(accent)},0.16)` : 'transparent',
                color: active ? accent : C.dim,
                fontFamily: DISP,
                fontSize: 14,
                fontWeight: 600,
                borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 12, color: C.faint, lineHeight: 1.5 }}>
        {on
          ? 'BlueField DPUs inspect every flow below the host OS. Cross-tenant traffic is denied in hardware — a compromised host can’t bypass it.'
          : 'Enforcement off: cross-tenant traffic leaks between tenants. This is what the DPU boundary prevents.'}
      </div>
      {snap.running && (snap.totalBlocked > 0 || snap.totalLeaked > 0) && (
        <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 13, color: on ? C.green : C.red }}>
          {on ? `✕ ${snap.totalBlocked} cross-tenant packets denied` : `⚠ ${snap.totalLeaked} cross-tenant packets leaked`}
        </div>
      )}
    </Section>
  );
}

/* ── Servers ────────────────────────────────────────────────────────────── */
function Servers({ state, dispatch, snap, selectedId, onSelect }: { state: LabState; dispatch: Dispatch; snap: SimSnapshot; selectedId: string | null; onSelect: (id: string) => void }) {
  const full = state.servers.length >= MAX_SERVERS;
  return (
    <Section
      title={`Hosts · ${state.servers.length}`}
      accent={C.green}
      right={
        <Button small accent={C.green} disabled={full} title={full ? `Max ${MAX_SERVERS} hosts` : 'Add a bare-metal host for NICo to discover'} onClick={() => dispatch({ type: 'addServer' })}>
          + Add host
        </Button>
      }
    >
      {state.servers.length === 0 ? (
        <Empty>No hosts. Add bare metal — NICo discovers it over OOB (Redfish) and runs the lifecycle.</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {state.servers.map((srv) => (
            <ServerRow key={srv.id} srv={srv} state={state} dispatch={dispatch} snap={snap} selected={srv.id === selectedId} onSelect={() => onSelect(srv.id)} />
          ))}
        </div>
      )}
    </Section>
  );
}

function ServerRow({ srv, state, dispatch, snap, selected, onSelect }: { srv: Server; state: LabState; dispatch: Dispatch; snap: SimSnapshot; selected: boolean; onSelect: () => void }) {
  const view = snap.servers[srv.id] ?? staticServerView(srv);
  const tenant = tenantById(state, srv.tenantId);
  const down = view.phase === 'reconciling';
  const ledRgb = view.led.startsWith('#') ? hexToRgb(view.led) : '255,255,255';
  return (
    <div onClick={onSelect} style={{ border: `1px solid ${selected ? `rgba(${ledRgb},0.8)` : down ? `rgba(${hexToRgb(C.red)},0.5)` : C.line}`, borderRadius: 10, padding: 11, background: `rgba(${ledRgb},0.04)`, cursor: 'pointer', boxShadow: selected ? `0 0 0 1px rgba(${ledRgb},0.4)` : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: 5, background: view.led, boxShadow: view.phase !== 'raw' ? `0 0 8px ${view.led}` : 'none' }} />
        <span style={{ fontFamily: DISP, fontSize: 15, fontWeight: 600, color: C.ink }}>{srv.name}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.dim }}>{srv.hw}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: down ? C.red : C.faint, marginLeft: 4 }}>{view.status}</span>
        <button onClick={() => dispatch({ type: 'removeServer', id: srv.id })} style={{ ...xStyle, marginLeft: 'auto' }} title="Remove server">
          ×
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* desired state */}
        <div style={{ display: 'flex', border: `1px solid ${C.line}`, borderRadius: 7, overflow: 'hidden' }}>
          {(['discovered', 'provisioned'] as Desired[]).map((d) => {
            const active = srv.desired === d;
            return (
              <button
                key={d}
                onClick={() => dispatch({ type: 'setDesired', id: srv.id, desired: d })}
                style={{
                  padding: '5px 9px',
                  border: 'none',
                  cursor: 'pointer',
                  background: active ? `rgba(${hexToRgb(C.green)},0.16)` : 'transparent',
                  color: active ? C.green : C.dim,
                  fontFamily: MONO,
                  fontSize: 11,
                }}
              >
                {d === 'discovered' ? 'discover' : 'provision'}
              </button>
            );
          })}
        </div>

        {/* tenant assignment */}
        <select
          value={srv.tenantId ?? ''}
          onChange={(e) => dispatch({ type: 'assignTenant', id: srv.id, tenantId: e.target.value || null })}
          style={{
            fontFamily: MONO,
            fontSize: 12,
            color: tenant ? tenant.color : C.dim,
            background: tenant ? `rgba(${hexToRgb(tenant.color)},0.08)` : 'rgba(255,255,255,0.03)',
            border: `1px solid ${tenant ? `rgba(${hexToRgb(tenant.color)},0.4)` : C.line}`,
            borderRadius: 7,
            padding: '5px 8px',
            cursor: 'pointer',
          }}
        >
          <option value="" style={{ background: '#0c1110', color: C.ink }}>
            no tenant
          </option>
          {state.tenants.map((t) => (
            <option key={t.id} value={t.id} style={{ background: '#0c1110', color: C.ink }}>
              {t.name}
            </option>
          ))}
        </select>

        {/* OS image */}
        <select
          value={srv.os}
          onChange={(e) => dispatch({ type: 'setOs', id: srv.id, os: e.target.value })}
          title="OS image NICo streams during Day 1 provisioning"
          style={{
            fontFamily: MONO,
            fontSize: 12,
            color: C.dim,
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${C.line}`,
            borderRadius: 7,
            padding: '5px 8px',
            cursor: 'pointer',
          }}
        >
          {OS_IMAGES.map((o) => (
            <option key={o.id} value={o.id} style={{ background: '#0c1110', color: C.ink }}>
              {o.label}
            </option>
          ))}
        </select>

        <Toggle on={srv.faultInjected} accent={C.red} title="Inject a hardware fault — NICo stalls at OS provisioning, then reconciles (requeue + retry) until it recovers" onClick={() => dispatch({ type: 'toggleFault', id: srv.id })}>
          {srv.faultInjected ? 'fault' : 'inject fault'}
        </Toggle>
      </div>
    </div>
  );
}

/* ── Tenants ────────────────────────────────────────────────────────────── */
function Tenants({ state, dispatch, snap }: { state: LabState; dispatch: Dispatch; snap: SimSnapshot }) {
  const full = state.tenants.length >= MAX_TENANTS;
  return (
    <Section
      title={`Tenants · ${state.tenants.length}`}
      accent={C.green}
      right={
        <Button small accent={C.green} disabled={full} title={full ? `Max ${MAX_TENANTS} tenants` : 'Add a tenant (gets its own VLAN + InfiniBand pkey)'} onClick={() => dispatch({ type: 'addTenant' })}>
          + Add tenant
        </Button>
      }
    >
      {state.tenants.length === 0 ? (
        <Empty>No tenants. Add one, then assign provisioned servers to it.</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {state.tenants.map((t) => (
            <TenantRow key={t.id} tenant={t} dispatch={dispatch} stat={snap.tenants[t.id]} running={snap.running} />
          ))}
        </div>
      )}
    </Section>
  );
}

function TenantRow({ tenant, dispatch, stat, running }: { tenant: Tenant; dispatch: Dispatch; stat?: SimSnapshot['tenants'][string]; running: boolean }) {
  return (
    <div style={{ border: `1px solid ${tenant.color}44`, borderRadius: 10, padding: '9px 11px', background: `rgba(${hexToRgb(tenant.color)},0.05)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ width: 11, height: 11, borderRadius: 6, background: tenant.color, boxShadow: `0 0 8px ${tenant.color}` }} />
        <span style={{ fontFamily: DISP, fontSize: 15, fontWeight: 600, color: C.ink }}>{tenant.name}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.dim }}>vlan {tenant.vlan} · {tenant.pkey}</span>
        <button onClick={() => dispatch({ type: 'removeTenant', id: tenant.id })} style={{ ...xStyle, marginLeft: 'auto' }} title="Remove tenant">
          ×
        </button>
      </div>
      {running && stat && stat.readyServers > 0 && (
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontFamily: MONO, fontSize: 12 }}>
          <span style={{ color: C.green }}>↑ {Math.round(stat.gbps)} Gb/s · {stat.readyServers} node{stat.readyServers === 1 ? '' : 's'}</span>
          {stat.blocked > 0 && <span style={{ color: C.red }}>✕ {Math.round(stat.blocked)} denied</span>}
          {stat.leaked > 0 && <span style={{ color: C.red }}>⚠ {Math.round(stat.leaked)} leaked</span>}
        </div>
      )}
    </div>
  );
}

/* ── Bits ───────────────────────────────────────────────────────────────── */
function Toggle({ on, onClick, accent, children, title }: { on: boolean; onClick: () => void; accent: string; children: React.ReactNode; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        fontFamily: MONO,
        fontSize: 12,
        padding: '5px 9px',
        borderRadius: 7,
        cursor: 'pointer',
        border: `1px solid ${on ? accent : C.line}`,
        background: on ? `rgba(${hexToRgb(accent)},0.18)` : 'transparent',
        color: on ? accent : C.dim,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: MONO, fontSize: 13, color: C.faint, lineHeight: 1.5 }}>{children}</div>;
}

const xStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 6,
  border: `1px solid ${C.line}`,
  background: 'transparent',
  color: C.dim,
  cursor: 'pointer',
  fontSize: 16,
  lineHeight: 1,
};
