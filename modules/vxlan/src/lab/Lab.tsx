// Interactive VXLAN lab: build virtual L2 segments (VNIs) on a spine-leaf
// fabric, attach hosts to leaf VTEPs, and send frames to watch encapsulation,
// EVPN learning, ARP suppression and VNI isolation happen live.
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

      {/* Visualization stage */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <LabViz state={state} snap={snap} />
      </div>

      {/* Control plane */}
      <div
        style={{
          width: 430,
          flexShrink: 0,
          height: '100%',
          overflowY: 'auto',
          borderLeft: `1px solid ${C.line}`,
          background: 'rgba(8,8,8,0.82)',
          backdropFilter: 'blur(8px)',
          padding: 20,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ fontFamily: DISP, fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Control plane</div>
        <div style={{ fontFamily: MONO, fontSize: 12, color: C.faint, marginBottom: 4, lineHeight: 1.5 }}>
          Declare virtual segments and hosts. The leaf VTEPs encapsulate frames into VXLAN, route them over the underlay, and learn reachability via BGP EVPN — or by flooding.
        </div>
        <LabControls state={state} dispatch={dispatch} snap={snap} />
      </div>
    </div>
  );
}
