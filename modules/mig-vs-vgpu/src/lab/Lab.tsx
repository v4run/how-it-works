// Interactive learning environment: configure MIG / vGPU / MIG-backed vGPU,
// run workloads, and watch how each model schedules compute.
import React from 'react';
import { C, MONO, DISP } from '../design/theme';
import { GridBackdrop, FitBox } from '../design/atoms';
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

      {/* Visualization stage — auto-scaled so it's always fully visible */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 24, left: 32, zIndex: 2, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 9, height: 9, borderRadius: 9, background: state.mode === 'mig' ? C.mig : C.vgpu, boxShadow: `0 0 10px ${state.mode === 'mig' ? C.mig : C.vgpu}` }} />
          <span style={{ fontFamily: MONO, fontSize: 14, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dim }}>
            GPU Partitioning Lab · {state.mode === 'mig' ? 'MIG' : state.mode === 'vgpu' ? 'vGPU' : 'MIG-backed vGPU'}
          </span>
        </div>
        <FitBox>
          <LabViz state={state} snap={snap} />
        </FitBox>
      </div>

      {/* Control panel */}
      <div
        style={{
          width: 460,
          flexShrink: 0,
          height: '100%',
          overflowY: 'auto',
          borderLeft: `1px solid ${C.line}`,
          background: 'rgba(8,11,12,0.72)',
          backdropFilter: 'blur(8px)',
          padding: 20,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ fontFamily: DISP, fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Control plane</div>
        <div style={{ fontFamily: MONO, fontSize: 12, color: C.faint, marginBottom: 18, lineHeight: 1.5 }}>
          Carve the silicon (MIG) or share the clock (vGPU). Add partitions, assign workloads, then run.
        </div>
        <LabControls state={state} dispatch={dispatch} snap={snap} />
      </div>
    </div>
  );
}
