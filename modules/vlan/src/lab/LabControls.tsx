// The control plane: enable/disable VLANs, assign access-port VLANs, tune the
// trunk (mode / allowed list / native VLAN per end), pick the inter-VLAN routing
// method, choose a source & destination, and send a frame to trace.
import React from 'react';
import { C, MONO, DISP, hexToRgb, VLAN_IDS, VLANS, vlanColor } from '../design/theme';
import { Button, Toggle, Section } from '../design/atoms';
import { G } from '../design/glossary';
import { LabState, Action, HOSTS, hostById, portVlanOf, ipMatchesVlan, Routing, TrunkMode, SwitchId, Dst } from './model';
import { PRESETS } from './presets';

const NATIVE_OPTS = [1, 10, 20, 30];

export function LabControls({ state, dispatch }: { state: LabState; dispatch: React.Dispatch<Action> }) {
  const dstName = state.dst === 'broadcast' ? 'broadcast' : hostById(state.dst).name;
  return (
    <div>
      {/* VLANs on/off */}
      <Section title="Segmentation" hint="the core idea" tip={G.VLAN}>
        <Toggle on={state.vlansEnabled} accent={C.green} label={state.vlansEnabled ? 'VLANs enabled' : 'Flat network (no VLANs)'} sub={state.vlansEnabled ? 'ports grouped into isolated broadcast domains' : 'every port in VLAN 1 — one big broadcast domain'} tip={G['broadcast domain']} onChange={(v) => dispatch({ type: 'SET_VLANS_ENABLED', on: v })} />
      </Section>

      {/* Traffic */}
      <Section title="Send a frame" hint="trace the path" tip="Pick a source and destination, then send. The frame is animated hop by hop with its tagged/untagged state shown.">
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <Picker label="source" value={state.src} onChange={(id) => dispatch({ type: 'SELECT_SRC', id })} options={HOSTS.map((h) => ({ v: h.id, label: h.name, color: vlanColor(portVlanOf(state, h.id)) }))} />
          <Picker label="dest" value={state.dst} onChange={(id) => dispatch({ type: 'SELECT_DST', dst: id as Dst })} options={[{ v: 'broadcast', label: 'broadcast', color: C.dim }, ...HOSTS.filter((h) => h.id !== state.src).map((h) => ({ v: h.id, label: h.name, color: vlanColor(portVlanOf(state, h.id)) }))]} />
        </div>
        <Button accent={C.green} filled onClick={() => dispatch({ type: 'SEND' })} style={{ width: '100%' }}>
          ▸ Send frame → {dstName}
        </Button>
      </Section>

      {/* Access ports */}
      <Section title="Access ports" hint="one VLAN each" tip={G['access port']}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {HOSTS.map((h) => {
            const v = portVlanOf(state, h.id);
            const mism = state.vlansEnabled && !ipMatchesVlan(state, h);
            return (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 8, border: `1px solid ${C.line}`, background: 'rgba(255,255,255,0.015)' }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: vlanColor(v), flexShrink: 0 }} />
                <span style={{ fontFamily: DISP, fontSize: 13, fontWeight: 600, color: C.ink, minWidth: 64 }}>{h.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint }}>SW-{h.sw}</span>
                {mism && <span title={`IP ${h.ip} belongs to VLAN ${h.intendedVlan} — wrong subnet for VLAN ${v}`} style={{ fontFamily: MONO, fontSize: 11, color: C.red, cursor: 'help' }}>⚠</span>}
                <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                  {VLAN_IDS.map((vl) => (
                    <button key={vl} onClick={() => dispatch({ type: 'SET_PORT_VLAN', hostId: h.id, vlan: vl })} disabled={!state.vlansEnabled} title={`${VLANS[vl].name} · ${VLANS[vl].subnet}`} style={{ fontFamily: MONO, fontSize: 11, width: 30, height: 24, borderRadius: 6, cursor: state.vlansEnabled ? 'pointer' : 'not-allowed', border: `1px solid ${v === vl ? VLANS[vl].c : C.line}`, background: v === vl ? `rgba(${hexToRgb(VLANS[vl].c)},0.18)` : 'transparent', color: v === vl ? VLANS[vl].c : C.faint, opacity: state.vlansEnabled ? 1 : 0.4 }}>
                      {vl}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Trunk */}
      <Section title="Inter-switch link" hint="SW-A ↔ SW-B" tip={G['trunk port']}>
        <div style={{ display: 'flex', gap: 8 }}>
          <ModeBtn on={state.trunkMode === 'trunk'} accent={C.green} label="Trunk" sub="802.1Q · many VLANs" onClick={() => dispatch({ type: 'SET_TRUNK_MODE', mode: 'trunk' as TrunkMode })} />
          <ModeBtn on={state.trunkMode === 'access'} accent={C.red} label="Access" sub="one VLAN (misconfig)" onClick={() => dispatch({ type: 'SET_TRUNK_MODE', mode: 'access' as TrunkMode })} />
        </div>
        {state.trunkMode === 'trunk' ? (
          <div style={{ marginTop: 10 }}>
            <Row label="allowed VLANs" tip={G['allowed-VLAN list']}>
              <div style={{ display: 'flex', gap: 5 }}>
                {VLAN_IDS.map((v) => {
                  const on = state.allowed.includes(v);
                  return (
                    <button key={v} onClick={() => dispatch({ type: 'TOGGLE_ALLOWED', vlan: v })} style={{ fontFamily: MONO, fontSize: 11, width: 34, height: 24, borderRadius: 6, cursor: 'pointer', border: `1px solid ${on ? VLANS[v].c : C.line}`, background: on ? `rgba(${hexToRgb(VLANS[v].c)},0.18)` : 'transparent', color: on ? VLANS[v].c : C.faint }}>
                      {v}
                    </button>
                  );
                })}
              </div>
            </Row>
            <Row label="native · SW-A" tip={G['native VLAN']}>
              <NativePick end="A" value={state.nativeA} dispatch={dispatch} />
            </Row>
            <Row label="native · SW-B" tip={G['native mismatch']}>
              <NativePick end="B" value={state.nativeB} dispatch={dispatch} />
            </Row>
            {state.nativeA !== state.nativeB && <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.amber, marginTop: 6 }}>⚠ native mismatch — untagged frames will leak between VLAN {state.nativeA} and {state.nativeB}</div>}
          </div>
        ) : (
          <div style={{ marginTop: 10 }}>
            <Row label="carries VLAN">
              <div style={{ display: 'flex', gap: 5 }}>
                {VLAN_IDS.map((v) => (
                  <button key={v} onClick={() => dispatch({ type: 'SET_LINK_ACCESS_VLAN', vlan: v })} style={{ fontFamily: MONO, fontSize: 11, width: 34, height: 24, borderRadius: 6, cursor: 'pointer', border: `1px solid ${state.linkAccessVlan === v ? VLANS[v].c : C.line}`, background: state.linkAccessVlan === v ? `rgba(${hexToRgb(VLANS[v].c)},0.18)` : 'transparent', color: state.linkAccessVlan === v ? VLANS[v].c : C.faint }}>
                    {v}
                  </button>
                ))}
              </div>
            </Row>
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.red, marginTop: 6 }}>only VLAN {state.linkAccessVlan} crosses — every other VLAN is blocked between switches</div>
          </div>
        )}
      </Section>

      {/* Routing */}
      <Section title="Inter-VLAN routing" hint="cross VLANs" tip={G['inter-VLAN routing']}>
        <div style={{ display: 'flex', gap: 6 }}>
          <ModeBtn on={state.routing === 'none'} accent={C.red} label="None" sub="L2 only" onClick={() => dispatch({ type: 'SET_ROUTING', mode: 'none' as Routing })} small />
          <ModeBtn on={state.routing === 'router'} accent={C.amber} label="Router" sub="on-a-stick" onClick={() => dispatch({ type: 'SET_ROUTING', mode: 'router' as Routing })} small />
          <ModeBtn on={state.routing === 'l3'} accent={C.green} label="L3 switch" sub="SVIs" onClick={() => dispatch({ type: 'SET_ROUTING', mode: 'l3' as Routing })} small />
        </div>
        {state.routing !== 'none' && (
          <Row label={state.routing === 'router' ? 'subinterfaces' : 'SVIs'} tip={state.routing === 'router' ? G.subinterface : G.SVI}>
            <div style={{ display: 'flex', gap: 5 }}>
              {VLAN_IDS.map((v) => {
                const on = state.routableVlans.includes(v);
                return (
                  <button key={v} onClick={() => dispatch({ type: 'TOGGLE_ROUTABLE', vlan: v })} title={`gateway ${VLANS[v].gw}`} style={{ fontFamily: MONO, fontSize: 11, width: 34, height: 24, borderRadius: 6, cursor: 'pointer', border: `1px solid ${on ? VLANS[v].c : C.line}`, background: on ? `rgba(${hexToRgb(VLANS[v].c)},0.18)` : 'transparent', color: on ? VLANS[v].c : C.faint }}>
                    {v}
                  </button>
                );
              })}
            </div>
          </Row>
        )}
        <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
          {state.routing === 'none' ? 'Different VLANs cannot talk — switching alone stays within a VLAN.' : state.routing === 'router' ? 'One trunk to a router with a subinterface per VLAN; cross-VLAN traffic hairpins up and back — the link is a bottleneck.' : 'SW-A routes between VLANs in hardware via an SVI (gateway) per VLAN — no hairpin.'}
        </div>
      </Section>

      {/* Scenarios */}
      <Section title="Scenarios">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => dispatch({ type: 'LOAD_PRESET', state: p.state, label: p.label })} style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.line}`, background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}>
              <div style={{ fontFamily: DISP, fontSize: 12.5, fontWeight: 600, color: C.ink }}>{p.label}</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: C.faint, marginTop: 2 }}>{p.hint}</div>
            </button>
          ))}
        </div>
        <Button accent={C.dim} small onClick={() => dispatch({ type: 'RESET' })} style={{ width: '100%', marginTop: 8 }}>
          ↺ Reset
        </Button>
      </Section>
    </div>
  );
}

function Picker({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ v: string; label: string; color: string }> }) {
  return (
    <label style={{ flex: 1, display: 'block' }}>
      <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', marginTop: 4, fontFamily: MONO, fontSize: 13, color: C.ink, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 9px', cursor: 'pointer' }}
      >
        {options.map((o) => (
          <option key={o.v} value={o.v} style={{ background: C.panel2 }}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ModeBtn({ on, accent, label, sub, onClick, small }: { on: boolean; accent: string; label: string; sub: string; onClick: () => void; small?: boolean }) {
  return (
    <button onClick={onClick} style={{ flex: 1, padding: small ? '7px 8px' : '9px 11px', borderRadius: 9, cursor: 'pointer', textAlign: 'left', border: `1px solid ${on ? accent : C.line}`, background: on ? `rgba(${hexToRgb(accent)},0.12)` : 'rgba(255,255,255,0.02)' }}>
      <div style={{ fontFamily: DISP, fontSize: small ? 13 : 14.5, fontWeight: 700, color: on ? C.ink : C.dim }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: on ? accent : C.faint, marginTop: 1 }}>{sub}</div>
    </button>
  );
}

function Row({ label, tip, children }: { label: string; tip?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
      <span title={tip} style={{ fontFamily: MONO, fontSize: 11.5, color: C.dim, flex: 1, cursor: tip ? 'help' : 'default', borderBottom: tip ? `1px dotted ${C.faint}` : 'none', alignSelf: 'center', display: 'inline-block', width: 'fit-content' }}>{label}</span>
      {children}
    </div>
  );
}

function NativePick({ end, value, dispatch }: { end: SwitchId; value: number; dispatch: React.Dispatch<Action> }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {NATIVE_OPTS.map((v) => (
        <button key={v} onClick={() => dispatch({ type: 'SET_NATIVE', end, vlan: v })} style={{ fontFamily: MONO, fontSize: 11, width: 30, height: 24, borderRadius: 6, cursor: 'pointer', border: `1px solid ${value === v ? C.amber : C.line}`, background: value === v ? `rgba(${hexToRgb(C.amber)},0.16)` : 'transparent', color: value === v ? C.amber : C.faint }}>
          {v}
        </button>
      ))}
    </div>
  );
}
