// The control plane: declare the pool, create LoadBalancer Services, switch the
// announcement mode (L2 / BGP), tune policy/BFD, and break things (kill nodes,
// send traffic) to watch MetalLB react in the stage to the left.
import React from 'react';
import { C, MONO, DISP, hexToRgb } from '../design/theme';
import { Button, Toggle, Section, Chip } from '../design/atoms';
import { G } from '../design/glossary';
import { LabState, Action, assignedIp, selectedService, activeNodesOf, ipStr } from './model';
import { PRESETS } from './presets';

export function LabControls({ state, dispatch }: { state: LabState; dispatch: React.Dispatch<Action> }) {
  const svc = selectedService(state);
  const end = state.poolStart + state.poolSize - 1;

  return (
    <div>
      {/* Mode */}
      <Section title="Advertisement mode" hint="how the IP is announced" tip={`L2Advertisement vs BGPAdvertisement.\n\n${G.L2Advertisement}\n\n${G.BGPAdvertisement}`}>
        <div style={{ display: 'flex', gap: 8 }}>
          <ModeButton on={state.mode === 'l2'} accent={C.green} label="Layer 2" sub="ARP / NDP" onClick={() => dispatch({ type: 'SET_MODE', mode: 'l2' })} />
          <ModeButton on={state.mode === 'bgp'} accent={C.cyan} label="BGP" sub="ECMP" onClick={() => dispatch({ type: 'SET_MODE', mode: 'bgp' })} />
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11.5, color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
          {state.mode === 'l2'
            ? 'One elected leader node answers for each IP. Failover only — not load balancing.'
            : 'Every eligible node advertises the IP as a /32; the router ECMPs across them. Real load balancing.'}
        </div>
      </Section>

      {/* Send traffic / failover trigger */}
      <Section title="Traffic" hint="pick a destination IP">
        <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint, marginBottom: 7 }}>client 192.168.1.50 → destination</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 9 }}>
          {state.services.map((s) => {
            const ip = assignedIp(state, s);
            const on = state.selected === s.id;
            return (
              <button
                key={s.id}
                onClick={() => dispatch({ type: 'SELECT', id: s.id })}
                disabled={!ip}
                title={ip ? `target ${s.name} at ${ip}` : `${s.name} has no IP (pending)`}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 6,
                  padding: '5px 9px',
                  borderRadius: 7,
                  cursor: ip ? 'pointer' : 'not-allowed',
                  border: `1px solid ${on && ip ? C.greenEdge : C.line}`,
                  background: on && ip ? `rgba(${hexToRgb(C.green)},0.12)` : 'rgba(255,255,255,0.02)',
                  opacity: ip ? 1 : 0.5,
                }}
              >
                <span style={{ fontFamily: DISP, fontSize: 12.5, fontWeight: 600, color: on && ip ? C.ink : C.dim }}>{s.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: ip ? (on ? C.green : C.faint) : C.amber }}>{ip ?? 'pending'}</span>
              </button>
            );
          })}
        </div>
        <Button accent={C.green} filled onClick={() => dispatch({ type: 'SEND_TRAFFIC' })} disabled={!svc || !assignedIp(state, svc)} style={{ width: '100%' }}>
          ▸ Send client traffic{svc && assignedIp(state, svc) ? ` → ${assignedIp(state, svc)}` : ''}
        </Button>
        {svc && assignedIp(state, svc) && (
          <div style={{ fontFamily: MONO, fontSize: 11.5, color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
            {state.mode === 'l2'
              ? 'Watch ARP resolve to the leader, then traffic funnel to that one node.'
              : `Watch the router split flows across ${activeNodesOf(state, svc).length} next-hop(s) via ECMP.`}
          </div>
        )}
      </Section>

      {/* IP pool */}
      <Section title="IPAddressPool" hint="prod-pool" tip={G.IPAddressPool}>
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, background: 'rgba(255,255,255,0.015)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontFamily: MONO, fontSize: 14, color: C.ink }}>
              {ipStr(state.poolStart)}<span style={{ color: C.faint }}> – </span>{ipStr(end)}
            </span>
            <Chip accent={C.green}>{state.poolSize} IPs</Chip>
          </div>
          <Stepper label="first address" value={`.${state.poolStart}`} onDec={() => dispatch({ type: 'SET_POOL', start: state.poolStart - 1 })} onInc={() => dispatch({ type: 'SET_POOL', start: state.poolStart + 1 })} />
          <Stepper label="pool size" value={`${state.poolSize}`} onDec={() => dispatch({ type: 'SET_POOL', size: state.poolSize - 1 })} onInc={() => dispatch({ type: 'SET_POOL', size: state.poolSize + 1 })} />
        </div>
      </Section>

      {/* Services */}
      <Section title="LoadBalancer Services" hint={`${state.services.length} / 8`} tip={G.LoadBalancer}>
        {!state.controllerReady && (
          <div style={{ fontFamily: MONO, fontSize: 11, color: C.amber, marginBottom: 8, padding: '6px 9px', border: `1px solid rgba(255,184,77,0.4)`, borderRadius: 8, background: 'rgba(255,184,77,0.08)' }}>
            ⟳ controller rescheduling — new Services stay &lt;pending&gt; until it's Ready (existing IPs unaffected)
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {state.services.map((s) => {
            const ip = assignedIp(state, s);
            const on = state.selected === s.id;
            return (
              <div
                key={s.id}
                onClick={() => dispatch({ type: 'SELECT', id: s.id })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 11px',
                  borderRadius: 9,
                  cursor: 'pointer',
                  border: `1px solid ${on ? C.greenEdge : C.line}`,
                  background: on ? `rgba(${hexToRgb(C.green)},0.08)` : 'rgba(255,255,255,0.015)',
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: 7, background: on ? C.green : C.faint, flexShrink: 0 }} />
                <span style={{ fontFamily: DISP, fontSize: 14, fontWeight: 600, color: C.ink, minWidth: 64 }}>{s.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 12.5, color: ip ? C.green : C.amber, marginLeft: 'auto' }}>{ip ?? '<pending>'}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: 'REMOVE_SERVICE', id: s.id });
                  }}
                  title="delete service"
                  style={{ border: 'none', background: 'transparent', color: C.faint, cursor: 'pointer', fontFamily: MONO, fontSize: 15, lineHeight: 1, padding: '0 2px' }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
        <Button accent={C.green} onClick={() => dispatch({ type: 'ADD_SERVICE' })} disabled={state.services.length >= 8} small style={{ width: '100%', marginTop: 8 }}>
          + Create LoadBalancer Service
        </Button>
      </Section>

      {/* Nodes */}
      <Section title="Cluster nodes" hint="kill a node or just its speaker" tip="Each node runs a speaker (DaemonSet). Kill the whole node (node + speaker + pods) or stop just the speaker to isolate the announcement path.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {state.nodes.map((n) => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderRadius: 9, border: `1px solid ${!n.alive ? 'rgba(255,82,82,0.4)' : !n.speaker ? 'rgba(255,184,77,0.45)' : C.line}`, background: !n.alive ? C.redSoft : !n.speaker ? 'rgba(255,184,77,0.06)' : 'rgba(255,255,255,0.015)' }}>
              <span style={{ width: 7, height: 7, borderRadius: 7, background: !n.alive ? C.red : !n.speaker ? C.amber : C.green, flexShrink: 0 }} />
              <span style={{ fontFamily: DISP, fontSize: 14, fontWeight: 600, color: n.alive ? C.ink : C.red, minWidth: 52 }}>{n.name}</span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint, marginLeft: 'auto' }}>{n.alive ? n.ip : 'down'}</span>
              {n.alive && (
                <Button accent={n.speaker ? C.amber : C.green} small title="The speaker announces this node's IPs. Stopping it (node & pods stay up) isolates the announcement path only." onClick={() => dispatch({ type: 'TOGGLE_SPEAKER', id: n.id })}>
                  {n.speaker ? 'spkr ✕' : 'spkr ▸'}
                </Button>
              )}
              <Button accent={n.alive ? C.red : C.green} small title="Kill the whole node — node, its speaker, and its pods (and the controller if it lives here)." onClick={() => dispatch({ type: 'TOGGLE_NODE', id: n.id })}>
                {n.alive ? 'Kill' : 'Revive'}
              </Button>
            </div>
          ))}
        </div>
      </Section>

      {/* Advanced */}
      <Section title="Tuning">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Toggle
            on={state.policy === 'Local'}
            accent={C.green}
            label="externalTrafficPolicy: Local"
            sub={state.policy === 'Local' ? 'preserve client IP · no extra hop · only pod nodes' : 'Cluster — even spread, but SNAT hides client IP'}
            tip={G.externalTrafficPolicy}
            onChange={(v) => dispatch({ type: 'SET_POLICY', policy: v ? 'Local' : 'Cluster' })}
          />
          <Toggle
            on={state.bfd}
            accent={C.cyan}
            label="BFD (BGP fast detection)"
            sub={state.mode === 'bgp' ? (state.bfd ? 'sub-second failure detection' : 'wait on the ~90s hold timer') : 'only affects BGP mode'}
            tip={G.BFD}
            onChange={(v) => dispatch({ type: 'SET_BFD', bfd: v })}
          />
        </div>
      </Section>

      {/* Presets */}
      <Section title="Scenarios">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => dispatch({ type: 'LOAD_PRESET', state: p.state, label: p.label })}
              style={{ textAlign: 'left', padding: '9px 11px', borderRadius: 9, border: `1px solid ${C.line}`, background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}
            >
              <div style={{ fontFamily: DISP, fontSize: 13.5, fontWeight: 600, color: C.ink }}>{p.label}</div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint, marginTop: 2 }}>{p.hint}</div>
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

function ModeButton({ on, accent, label, sub, onClick }: { on: boolean; accent: string; label: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '10px 12px',
        borderRadius: 10,
        cursor: 'pointer',
        textAlign: 'left',
        border: `1px solid ${on ? accent : C.line}`,
        background: on ? `rgba(${hexToRgb(accent)},0.12)` : 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ fontFamily: DISP, fontSize: 15, fontWeight: 700, color: on ? C.ink : C.dim }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: on ? accent : C.faint, marginTop: 1 }}>{sub}</div>
    </button>
  );
}

function Stepper({ label, value, onDec, onInc }: { label: string; value: string; onDec: () => void; onInc: () => void }) {
  const btn: React.CSSProperties = { width: 28, height: 26, borderRadius: 7, border: `1px solid ${C.line}`, background: 'rgba(255,255,255,0.03)', color: C.ink, cursor: 'pointer', fontFamily: MONO, fontSize: 15, lineHeight: 1 };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
      <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim, flex: 1 }}>{label}</span>
      <button onClick={onDec} style={btn}>
        −
      </button>
      <span style={{ fontFamily: MONO, fontSize: 13, color: C.ink, minWidth: 34, textAlign: 'center' }}>{value}</span>
      <button onClick={onInc} style={btn}>
        +
      </button>
    </div>
  );
}
