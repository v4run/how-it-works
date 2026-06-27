import React from 'react';
import { C, MONO, DISP, hexToRgb } from './design/theme';
import { Film } from './film/Film';
import { Lab } from './lab/Lab';

type Tab = 'lab' | 'learn';

export default function App() {
  const [tab, setTab] = React.useState<Tab>('lab');
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: C.bg }}>
      <TopBar tab={tab} setTab={setTab} />
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {tab === 'lab' ? <Lab /> : <Film />}
      </div>
    </div>
  );
}

function TopBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div
      style={{
        height: 54,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: '0 22px',
        borderBottom: `1px solid ${C.line}`,
        background: 'rgba(8,11,9,0.9)',
        zIndex: 2,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: C.green, boxShadow: `0 0 10px ${C.green}` }} />
        <span style={{ fontFamily: DISP, fontSize: 17, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
          NVIDIA <span style={{ color: C.faint, fontWeight: 400 }}>Infra Controller</span> <span style={{ color: C.green }}>NICo</span>
        </span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.faint, letterSpacing: '0.18em', textTransform: 'uppercase', marginLeft: 4 }}>
          Bare metal, automated
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
        <TabButton on={tab === 'lab'} label="Lab" sub="interactive" onClick={() => setTab('lab')} />
        <TabButton on={tab === 'learn'} label="Learn" sub="explainer film" onClick={() => setTab('learn')} />
      </div>

      <div style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 12, color: C.faint, letterSpacing: '0.12em' }}>
        {tab === 'lab' ? 'declare · provision · isolate' : 'space ▸ play · ← → seek'}
      </div>
    </div>
  );
}

function TabButton({ on, label, sub, onClick }: { on: boolean; label: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        padding: '7px 14px',
        borderRadius: 8,
        cursor: 'pointer',
        border: `1px solid ${on ? C.greenEdge : 'transparent'}`,
        background: on ? `rgba(${hexToRgb(C.green)},0.12)` : 'transparent',
        color: on ? C.ink : C.dim,
        fontFamily: DISP,
        fontSize: 15,
        fontWeight: 600,
      }}
    >
      {label}
      <span style={{ fontFamily: MONO, fontSize: 11, color: on ? C.green : C.faint, fontWeight: 400 }}>{sub}</span>
    </button>
  );
}
