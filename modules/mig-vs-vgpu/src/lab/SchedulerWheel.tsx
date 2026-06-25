// Time-slice scheduler wheel for vGPU mode. Slice sizes follow the policy
// (equal vs fixed-share weights); the active VM lights up and the hand sweeps.
import { C, MONO, DISP, hexToRgb } from '../design/theme';

export interface WheelSlice {
  id: string;
  name: string;
  color: string;
  weight: number;
  active: boolean;
  hung: boolean;
}

export function SchedulerWheel({
  slices,
  quantumFrac,
  size = 280,
  stalled,
}: {
  slices: WheelSlice[];
  quantumFrac: number;
  size?: number;
  stalled: boolean;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 16;
  const totalW = slices.reduce((a, s) => a + s.weight, 0) || 1;

  // Slice angular spans.
  let acc = -Math.PI / 2;
  const spans = slices.map((s) => {
    const frac = s.weight / totalW;
    const a0 = acc;
    const a1 = acc + frac * Math.PI * 2;
    acc = a1;
    return { ...s, a0, a1 };
  });

  const activeSpan = spans.find((s) => s.active);
  const handAngle = activeSpan
    ? activeSpan.a0 + (activeSpan.a1 - activeSpan.a0) * (stalled ? 0.5 : quantumFrac)
    : -Math.PI / 2;

  const activeSlice = slices.find((s) => s.active);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', inset: 0 }}>
        {spans.length === 0 ? (
          <circle cx={cx} cy={cy} r={r} fill="rgba(255,255,255,0.03)" stroke={C.line} />
        ) : (
          spans.map((s) => {
            const x0 = cx + r * Math.cos(s.a0);
            const y0 = cy + r * Math.sin(s.a0);
            const x1 = cx + r * Math.cos(s.a1);
            const y1 = cy + r * Math.sin(s.a1);
            const large = s.a1 - s.a0 > Math.PI ? 1 : 0;
            const col = s.active && (stalled || s.hung) ? C.red : s.color;
            return (
              <path
                key={s.id + s.a0}
                d={`M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large},1 ${x1},${y1} Z`}
                fill={`rgba(${hexToRgb(col)},${s.active ? 0.85 : 0.16})`}
                stroke={col}
                strokeWidth={s.active ? 2.5 : 1}
              />
            );
          })
        )}
        <line
          x1={cx}
          y1={cy}
          x2={cx + (r - 4) * Math.cos(handAngle)}
          y2={cy + (r - 4) * Math.sin(handAngle)}
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={size * 0.16} fill={C.bg} stroke="rgba(255,255,255,0.14)" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        {activeSlice ? (
          <>
            <div style={{ fontFamily: DISP, fontSize: 22, fontWeight: 700, color: stalled ? C.red : activeSlice.color }}>
              {activeSlice.name}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint, letterSpacing: '0.1em' }}>
              {stalled ? 'STALLED' : 'on GPU'}
            </div>
          </>
        ) : (
          <div style={{ fontFamily: MONO, fontSize: 12, color: C.faint, letterSpacing: '0.1em' }}>idle</div>
        )}
      </div>
    </div>
  );
}
