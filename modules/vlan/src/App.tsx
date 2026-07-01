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
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>{tab === 'lab' ? <Lab /> : <Film />}</div>
    </div>
  );
}

function TopBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div style={{ height: 54, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 20, padding: '0 22px', borderBottom: `1px solid ${C.line}`, background: 'rgba(10,12,14,0.9)', zIndex: 2 }}>
      <a href="../" title="Back to all modules" style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontFamily: MONO, fontSize: 13, color: C.dim, border: `1px solid ${C.line}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        ← Home
      </a>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <span style={{ display: 'inline-flex', gap: 3 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: C.green }} />
          <span style={{ width: 9, height: 9, borderRadius: 2, background: C.amber }} />
          <span style={{ width: 9, height: 9, borderRadius: 2, background: C.cyan }} />
        </span>
        <span style={{ fontFamily: DISP, fontSize: 17, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
          VLANs <span style={{ color: C.faint, fontWeight: 400 }}>virtual LANs</span>
        </span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.faint, letterSpacing: '0.18em', textTransform: 'uppercase', marginLeft: 4 }}>802.1Q</span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
        <TabButton on={tab === 'lab'} label="Lab" sub="interactive" onClick={() => setTab('lab')} />
        <TabButton on={tab === 'learn'} label="Learn" sub="explainer film" onClick={() => setTab('learn')} />
      </div>

      <span
        title="Educational model built for intuition, not operational accuracy. Real switching has more nuance (STP, VTP/MVRP, per-VLAN MAC learning timing, DTP negotiation states, QinQ, etc.)."
        style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11, color: C.amber, letterSpacing: '0.06em', border: `1px solid rgba(${hexToRgb(C.amber)},0.45)`, background: `rgba(${hexToRgb(C.amber)},0.1)`, borderRadius: 6, padding: '4px 9px', whiteSpace: 'nowrap', cursor: 'help' }}
      >
        ⚠ work in progress · may contain mistakes
      </span>

      <div style={{ fontFamily: MONO, fontSize: 12, color: C.faint, letterSpacing: '0.12em' }}>{tab === 'lab' ? 'assign · trunk · route' : 'space ▸ play · ← → seek'}</div>
    </div>
  );
}

function TabButton({ on, label, sub, onClick }: { on: boolean; label: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${on ? C.greenEdge : 'transparent'}`, background: on ? `rgba(${hexToRgb(C.green)},0.12)` : 'transparent', color: on ? C.ink : C.dim, fontFamily: DISP, fontSize: 15, fontWeight: 600 }}>
      {label}
      <span style={{ fontFamily: MONO, fontSize: 11, color: on ? C.green : C.faint, fontWeight: 400 }}>{sub}</span>
    </button>
  );
}
