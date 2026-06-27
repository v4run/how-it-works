// Interactive datacenter: add bare-metal hosts, let NICo run them through the
// Day 0/1 lifecycle, assign tenants, and watch DPU-enforced isolation —
// modelled on the real NVIDIA Infra Controller (github.com/NVIDIA/infra-controller).
import React from 'react';
import { C, MONO, DISP } from '../design/theme';
import { GridBackdrop } from '../design/atoms';
import { reducer, initialState } from './model';
import { useSimulation } from './useSimulation';
import { LabViz } from './LabViz';
import { LabControls } from './LabControls';

export function Lab() {
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const snap = useSimulation(state);
  const [selectedId, setSelectedId] = React.useState<string | null>(initialState.servers[0]?.id ?? null);

  // Keep selection valid as servers come and go.
  React.useEffect(() => {
    if (!state.servers.some((s) => s.id === selectedId)) setSelectedId(state.servers[0]?.id ?? null);
  }, [state.servers, selectedId]);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', background: C.bg, overflow: 'hidden' }}>
      <GridBackdrop />

      {/* Visualization stage — a scrollable engineering dashboard */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <LabViz state={state} snap={snap} selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      {/* Control plane */}
      <div
        style={{
          width: 470,
          flexShrink: 0,
          height: '100%',
          overflowY: 'auto',
          borderLeft: `1px solid ${C.line}`,
          background: 'rgba(8,11,9,0.82)',
          backdropFilter: 'blur(8px)',
          padding: 20,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ fontFamily: DISP, fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Control plane</div>
        <div style={{ fontFamily: MONO, fontSize: 12, color: C.faint, marginBottom: 18, lineHeight: 1.5 }}>
          Declare desired state — NICo discovers (Redfish/Scout), validates, attests, images and isolates each host, then enforces tenant boundaries at the DPU.
        </div>
        <LabControls state={state} dispatch={dispatch} snap={snap} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
    </div>
  );
}
