// Interactive MetalLB lab: define an IPAddressPool, create LoadBalancer
// Services and watch the controller allocate external IPs, then switch between
// Layer-2 (one elected leader answers ARP/NDP) and BGP (every node advertises a
// /32 and the router ECMPs across them). Send traffic and kill nodes to see how
// each mode fails over.
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

  // The controller is a Deployment: when its node dies (controllerReady=false)
  // Kubernetes reschedules its pod onto a surviving node after a short delay,
  // during which no new IPs are allocated. Model that delay here.
  React.useEffect(() => {
    if (state.controllerReady) return;
    if (!state.nodes.some((n) => n.alive)) return; // nowhere to reschedule
    const t = setTimeout(() => dispatch({ type: 'CONTROLLER_READY' }), 2600);
    return () => clearTimeout(t);
  }, [state.controllerReady, state.nodes]);

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
          Bring the IPs (a pool) and the Services. The controller allocates an external IP to each; the speakers announce it — via Layer-2 ARP or BGP — so the outside network can reach it.
        </div>
        <LabControls state={state} dispatch={dispatch} />
      </div>
    </div>
  );
}
