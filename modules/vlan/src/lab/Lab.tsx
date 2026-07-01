// Interactive VLAN lab: a two-switch fabric with a trunk and an L3 gateway.
// Assign access-port VLANs, tune the trunk (allowed list + native VLAN), pick
// an inter-VLAN routing method, and send frames to watch them get tagged on the
// trunk, stay isolated per broadcast domain, route between VLANs, or break.
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

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', background: C.bg, overflow: 'hidden' }}>
      <GridBackdrop />
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <LabViz state={state} snap={snap} />
      </div>
      <div
        style={{
          width: 440,
          flexShrink: 0,
          height: '100%',
          overflowY: 'auto',
          borderLeft: `1px solid ${C.line}`,
          background: 'rgba(10,12,14,0.82)',
          backdropFilter: 'blur(8px)',
          padding: 20,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ fontFamily: DISP, fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Switch config</div>
        <div style={{ fontFamily: MONO, fontSize: 12, color: C.faint, marginBottom: 4, lineHeight: 1.5 }}>Group ports into VLANs, trunk the switches together, add a Layer-3 gateway to route between VLANs — then send a frame and trace every hop.</div>
        <LabControls state={state} dispatch={dispatch} />
      </div>
    </div>
  );
}
