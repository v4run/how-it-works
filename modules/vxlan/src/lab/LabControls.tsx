// The control plane: choose a control-plane mode, build segments (VNIs) and
// hosts, pick a source/destination and launch a frame, or load a scenario.
import React from 'react';
import { C, MONO, DISP, UI, hexToRgb } from '../design/theme';
import { Button, Toggle, Section } from '../design/atoms';
import {
  LabState,
  Action,
  LEAVES,
  leafName,
  segmentById,
  shortMac,
  MAX_HOSTS,
  MAX_SEGMENTS,
} from './model';
import { SimSnapshot } from './useSimulation';
import { PRESETS } from './presets';

export function LabControls({
  state,
  dispatch,
  snap,
}: {
  state: LabState;
  dispatch: React.Dispatch<Action>;
  snap: SimSnapshot;
}) {
  const hosts = state.hosts;
  const canSend = hosts.length >= 2 && state.srcHostId && state.dstHostId && state.srcHostId !== state.dstHostId;

  return (
    <div>
      {/* Send a frame */}
      <Section title="Send a frame" hint="the experiment">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <HostSelect label="from" value={state.srcHostId} state={state} onChange={(id) => dispatch({ type: 'setSrc', id })} />
          <HostSelect label="to" value={state.dstHostId} state={state} onChange={(id) => dispatch({ type: 'setDst', id })} exclude={state.srcHostId} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button filled onClick={() => dispatch({ type: 'sendFlow' })} disabled={!canSend} style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}>
              ▸ Send frame
            </Button>
            <Button accent={C.steel} onClick={() => swap(state, dispatch)} disabled={!canSend} title="Swap source and destination">
              ⇄
            </Button>
          </div>
          <Outcome snap={snap} />
        </div>
      </Section>

      {/* Control plane */}
      <Section title="Control plane" hint="how VTEPs learn">
        <Segmented
          value={state.ctrlPlane}
          options={[
            { v: 'evpn', label: 'BGP EVPN', sub: 'learn' },
            { v: 'flood', label: 'Flood & learn', sub: 'broadcast' },
          ]}
          onChange={(v) => dispatch({ type: 'setCtrlPlane', plane: v as 'evpn' | 'flood' })}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <Toggle
            on={state.ctrlPlane === 'evpn' && state.arpSuppression}
            onChange={(v) => dispatch({ type: 'setArpSuppression', on: v })}
            label="ARP suppression"
            sub={state.ctrlPlane === 'evpn' ? 'leaf proxies ARP from EVPN cache' : 'requires BGP EVPN'}
          />
          <Toggle on={state.jumbo} onChange={(v) => dispatch({ type: 'setJumbo', on: v })} accent={state.jumbo ? C.green : C.amber} label="Jumbo MTU (9000)" sub="underlay (L3) MTU · headroom for +50 B overlay" />
        </div>
      </Section>

      {/* Segments */}
      <Section title="Segments · VNIs" hint={`${state.segments.length}/${MAX_SEGMENTS}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {state.segments.map((seg) => {
            const count = state.hosts.filter((h) => h.segmentId === seg.id).length;
            return (
              <div key={seg.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, border: `1px solid ${C.line}`, background: `rgba(${hexToRgb(seg.color)},0.06)` }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
                <span style={{ fontFamily: DISP, fontSize: 14, fontWeight: 600, color: C.ink }}>{seg.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: seg.color }}>VNI {seg.vni}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint, marginLeft: 'auto' }}>{count} host{count === 1 ? '' : 's'}</span>
                {state.segments.length > 1 && (
                  <button onClick={() => dispatch({ type: 'removeSegment', id: seg.id })} title="Remove segment" style={xStyle}>×</button>
                )}
              </div>
            );
          })}
          <Button accent={C.steel} small onClick={() => dispatch({ type: 'addSegment' })} disabled={state.segments.length >= MAX_SEGMENTS} style={{ alignSelf: 'flex-start' }}>
            + segment
          </Button>
        </div>
      </Section>

      {/* Hosts */}
      <Section title="Hosts" hint={`${hosts.length}/${MAX_HOSTS}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {hosts.map((h) => {
            const seg = segmentById(state, h.segmentId);
            return (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 9, border: `1px solid ${C.line}` }}>
                <span style={{ width: 8, height: 8, borderRadius: 8, background: seg?.color ?? C.dim, flexShrink: 0 }} />
                <span style={{ fontFamily: DISP, fontSize: 13.5, fontWeight: 600, color: C.ink, width: 34, flexShrink: 0 }}>{h.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint, width: 42, flexShrink: 0 }} title={h.mac}>{shortMac(h.mac)}</span>
                <Mini value={String(h.leafIdx)} onChange={(v) => dispatch({ type: 'moveHost', id: h.id, leafIdx: +v })} options={Array.from({ length: LEAVES }, (_, i) => ({ v: String(i), label: leafName(i) }))} />
                <Mini value={h.segmentId} onChange={(v) => dispatch({ type: 'setHostSegment', id: h.id, segmentId: v })} options={state.segments.map((s) => ({ v: s.id, label: `VNI ${s.vni}` }))} />
                <button onClick={() => dispatch({ type: 'removeHost', id: h.id })} title="Remove host" style={{ ...xStyle, marginLeft: 'auto' }}>×</button>
              </div>
            );
          })}
          <Button small onClick={() => dispatch({ type: 'addHost' })} disabled={hosts.length >= MAX_HOSTS || state.segments.length === 0} style={{ alignSelf: 'flex-start' }}>
            + host
          </Button>
          <div style={{ fontFamily: UI, fontSize: 11.5, color: C.faint, lineHeight: 1.5 }}>
            Move a host to another leaf to see VM mobility — EVPN re-advertises its MAC behind the new VTEP.
          </div>
        </div>
      </Section>

      {/* Scenarios */}
      <Section title="Scenarios" hint="one-click setups">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => dispatch({ type: 'loadPreset', preset: p.make() })}
              style={{ textAlign: 'left', background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.line}`, borderRadius: 9, padding: '9px 11px', cursor: 'pointer' }}
            >
              <span style={{ display: 'block', fontFamily: DISP, fontSize: 13.5, fontWeight: 600, color: C.ink }}>{p.name}</span>
              <span style={{ display: 'block', fontFamily: UI, fontSize: 11.5, color: C.dim, lineHeight: 1.45, marginTop: 2 }}>{p.blurb}</span>
            </button>
          ))}
          <Button accent={C.steel} small onClick={() => dispatch({ type: 'reset' })} style={{ alignSelf: 'flex-start', marginTop: 2 }}>
            ↺ reset
          </Button>
        </div>
      </Section>
    </div>
  );
}

function swap(state: LabState, dispatch: React.Dispatch<Action>) {
  const s = state.srcHostId;
  const d = state.dstHostId;
  if (s && d) {
    dispatch({ type: 'setSrc', id: d });
    dispatch({ type: 'setDst', id: s });
  }
}

function Outcome({ snap }: { snap: SimSnapshot }) {
  const flow = snap.flow;
  if (!flow) return null;
  const o = flow.plan.outcome;
  if (o === 'invalid') return null;
  const col = o === 'delivered' ? C.green : C.red;
  const txt =
    o === 'delivered'
      ? flow.plan.intraLeaf
        ? 'Delivered locally — no VXLAN needed (same leaf).'
        : `Delivered — encapsulated in VNI ${flow.plan.segment?.vni} across the fabric.`
      : 'Blocked — different VNIs are isolated L2 domains.';
  return (
    <div style={{ fontFamily: MONO, fontSize: 11.5, color: col, padding: '7px 10px', borderRadius: 8, border: `1px solid ${col}55`, background: `rgba(${hexToRgb(col)},0.08)` }}>
      {txt}
    </div>
  );
}

// ── small inputs ─────────────────────────────────────────────────────────────
function HostSelect({
  label,
  value,
  state,
  onChange,
  exclude,
}: {
  label: string;
  value: string | null;
  state: LabState;
  onChange: (id: string) => void;
  exclude?: string | null;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontFamily: MONO, fontSize: 12, color: C.faint, width: 34 }}>{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={selStyle}>
        {state.hosts.length === 0 && <option value="">— no hosts —</option>}
        {state.hosts.map((h) => {
          const seg = segmentById(state, h.segmentId);
          return (
            <option key={h.id} value={h.id} disabled={h.id === exclude}>
              {h.name} · {shortMac(h.mac)} · VNI {seg?.vni} · {leafName(h.leafIdx)}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function Mini({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...selStyle, width: 'auto', fontSize: 11.5, padding: '4px 6px' }}>
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string; sub: string }[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map((o) => {
        const on = o.v === value;
        return (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            style={{
              flex: 1,
              padding: '8px 6px',
              borderRadius: 9,
              border: `1px solid ${on ? C.green : C.line}`,
              background: on ? `rgba(${hexToRgb(C.green)},0.12)` : 'rgba(255,255,255,0.02)',
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'block', fontFamily: DISP, fontSize: 13.5, fontWeight: 600, color: on ? C.ink : C.dim }}>{o.label}</span>
            <span style={{ display: 'block', fontFamily: MONO, fontSize: 10.5, color: on ? C.green : C.faint }}>{o.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

const selStyle: React.CSSProperties = {
  flex: 1,
  width: '100%',
  fontFamily: MONO,
  fontSize: 12.5,
  color: C.ink,
  background: '#101010',
  border: `1px solid ${C.line}`,
  borderRadius: 7,
  padding: '7px 8px',
  cursor: 'pointer',
};

const xStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 5,
  border: `1px solid ${C.line}`,
  background: 'transparent',
  color: C.faint,
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
