// The shared GPU-die visual — ported from the prototype.
// 7 GPC-slice columns × 14 SMs each = 98 SMs (one rectangle = one SM).
// That's the A100's MIG-addressable SM count: 14 SMs per GPC slice, 7
// slices. The full A100 has 108 SMs; the remaining 10 aren't exposed to MIG.
// Plus an L2 band and 8 memory slices.
import { C, MONO, hexToRgb } from './theme';
import { clamp } from '../engine/anim';

export const COLS = 7; // GPC slices (max MIG instances)
export const ROWS = 14; // SMs per GPC slice → 7 × 14 = 98 SMs drawn
export const TOTAL_SMS = 108; // SMs on the A100 die (98 in MIG slices + 10 reserved)
export const MEM = 8;

export interface DieGroup {
  cols: number[];
  label?: string;
  color?: string;
  fault?: boolean;
  o?: number | null;
  badge?: string; // optional small badge shown bottom-center (e.g. VM name)
}

// Per-column accent override (used by the lab to tint each MIG instance distinctly).
export type LitCols = 'all' | 'none' | number[];

interface DieProps {
  w?: number;
  h?: number;
  accent?: string;
  reveal?: number;
  litCols?: LitCols;
  activeAccent?: string | null;
  colAccents?: (string | null)[] | null; // per-column lit color override
  groups?: DieGroup[] | null;
  memGroups?: (string | null)[] | 'mig' | null;
  dividers?: number;
  pulse?: number;
  label?: string;
  hideHeader?: boolean;
  onColClick?: (col: number) => void;
  hoverCol?: number | null;
  onHoverCol?: (col: number | null) => void;
}

// Geometry helper so interactive overlays can align with the rendered field.
export function dieGeometry(w: number) {
  const colGap = 8;
  const pad = 22;
  const innerW = w - pad * 2;
  const colW = (innerW - colGap * (COLS - 1)) / COLS;
  return { colGap, pad, innerW, colW };
}

export function Die({
  w = 560,
  h = 524,
  accent = C.mig,
  reveal = 1,
  litCols = 'all',
  activeAccent = null,
  colAccents = null,
  groups = null,
  memGroups = null,
  dividers = 0,
  pulse = 0,
  label = 'GA100 · LOGICAL VIEW',
  hideHeader = false,
  onColClick,
  hoverCol = null,
  onHoverCol,
}: DieProps) {
  const act = activeAccent || accent;
  const litSet =
    litCols === 'all'
      ? new Set(Array.from({ length: COLS }, (_, i) => i))
      : litCols === 'none'
        ? new Set<number>()
        : new Set(litCols);

  const fieldH = h - 196;
  const colGap = 8;
  const cellGap = 4;
  const pad = 22;
  const innerW = w - pad * 2;
  const colW = (innerW - colGap * (COLS - 1)) / COLS;
  void pulse;

  const cellIn = (ci: number, ri: number) => {
    const order = (ci + ri) / (COLS + ROWS);
    return clamp((reveal - order * 0.6) / 0.4, 0, 1);
  };

  return (
    <div
      style={{
        position: 'relative',
        width: w,
        height: h,
        borderRadius: 18,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(0,0,0,0.18))',
        border: `1px solid ${C.line}`,
        boxShadow: '0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
        padding: pad,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, height: 22 }}>
        {!hideHeader ? (
          <span
            style={{ fontFamily: MONO, fontSize: 14, letterSpacing: '0.18em', color: C.faint, cursor: 'help' }}
            title="Logical partition map, not the physical die floorplan. Columns are MIG GPC slices (the real GA100 has 8 GPCs in two rows around a central, split L2); the bottom strip is MIG's 8 memory slices, not physical FBPs/HBM stacks (the A100 has 5 active HBM2 stacks with controllers on the die edges)."
          >
            {label}
          </span>
        ) : (
          <span />
        )}
        {!hideHeader ? (
          <span style={{ fontFamily: MONO, fontSize: 12.5, letterSpacing: '0.1em', color: accent, opacity: 0.8 }} title="One cell = one SM (streaming multiprocessor). 14 SMs per GPC slice × 7 slices = 98; the A100 die has 108 SMs (10 reserved, not MIG-addressable).">
            {COLS} × {ROWS} SMs = {COLS * ROWS} of {TOTAL_SMS}
          </span>
        ) : null}
      </div>

      {/* SM field */}
      <div style={{ position: 'relative', display: 'flex', gap: colGap, height: fieldH }}>
        {Array.from({ length: COLS }).map((_, ci) => {
          const lit = litSet.has(ci);
          const colAct = (colAccents && colAccents[ci]) || act;
          return (
            <div key={ci} style={{ position: 'relative', width: colW, display: 'flex', flexDirection: 'column', gap: cellGap }}>
              {Array.from({ length: ROWS }).map((_, ri) => {
                const cin = cellIn(ci, ri);
                const cellBg = lit ? colAct : `rgba(${hexToRgb(accent)},0.12)`;
                const cellBorder = lit ? 'transparent' : `rgba(${hexToRgb(accent)},0.28)`;
                return (
                  <div
                    key={ri}
                    title={`SM ${ci * ROWS + ri + 1} · GPC slice ${ci + 1}`}
                    style={{
                      flex: 1,
                      borderRadius: 3,
                      background: cellBg,
                      border: `1px solid ${cellBorder}`,
                      opacity: cin,
                      transform: `scale(${0.7 + 0.3 * cin})`,
                      boxShadow: lit ? `0 0 10px ${colAct}99, inset 0 0 6px rgba(255,255,255,0.25)` : 'none',
                    }}
                  />
                );
              })}
            </div>
          );
        })}

        {/* hard partition dividers (MIG) */}
        {dividers > 0 &&
          Array.from({ length: COLS - 1 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: -6,
                bottom: -6,
                left: (i + 1) * colW + i * colGap + colGap / 2 - 1,
                width: 2,
                background: `rgba(${hexToRgb(accent)},${0.5 * dividers})`,
                boxShadow: `0 0 8px rgba(${hexToRgb(accent)},${0.6 * dividers})`,
              }}
            />
          ))}

        {/* MIG group outlines */}
        {groups &&
          groups.map((g, gi) => {
            const c0 = Math.min(...g.cols);
            const c1 = Math.max(...g.cols);
            const left = c0 * (colW + colGap) - 5;
            const width = (c1 - c0 + 1) * colW + (c1 - c0) * colGap + 10;
            const col = g.fault ? C.red : g.color || accent;
            return (
              <div
                key={gi}
                style={{
                  position: 'absolute',
                  top: -10,
                  bottom: -10,
                  left,
                  width,
                  border: `1.5px solid ${col}`,
                  borderRadius: 10,
                  boxShadow: `0 0 22px ${col}40, inset 0 0 26px ${col}14`,
                  opacity: g.o == null ? 1 : g.o,
                }}
              >
                {g.label || g.fault ? (
                  <span
                    style={{
                      position: 'absolute',
                      top: -27,
                      left: 0,
                      fontFamily: MONO,
                      fontSize: 13,
                      letterSpacing: '0.04em',
                      color: col,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {g.label}
                  </span>
                ) : null}
                {g.badge ? (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: -10,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontFamily: MONO,
                      fontSize: 11,
                      letterSpacing: '0.04em',
                      color: col,
                      background: C.bg,
                      padding: '0 5px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {g.badge}
                  </span>
                ) : null}
                {g.fault ? (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: -10,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontFamily: MONO,
                      fontSize: 11,
                      letterSpacing: '0.06em',
                      color: C.red,
                      background: C.bg,
                      padding: '0 4px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    XID
                  </span>
                ) : null}
              </div>
            );
          })}

        {/* interactive column hit-areas (lab builder) */}
        {onColClick &&
          Array.from({ length: COLS }).map((_, ci) => (
            <div
              key={`hit-${ci}`}
              onClick={() => onColClick(ci)}
              onMouseEnter={() => onHoverCol?.(ci)}
              onMouseLeave={() => onHoverCol?.(null)}
              style={{
                position: 'absolute',
                top: -10,
                bottom: -10,
                left: ci * (colW + colGap),
                width: colW,
                cursor: 'pointer',
                borderRadius: 8,
                background: hoverCol === ci ? 'rgba(255,255,255,0.06)' : 'transparent',
                border: hoverCol === ci ? `1px dashed ${C.faint}` : '1px solid transparent',
              }}
            />
          ))}
      </div>

      {/* L2 band */}
      <div
        style={{
          marginTop: 16,
          height: 26,
          borderRadius: 6,
          background: `repeating-linear-gradient(90deg, rgba(${hexToRgb(accent)},0.16) 0 26px, rgba(${hexToRgb(accent)},0.07) 26px 32px)`,
          border: `1px solid rgba(${hexToRgb(accent)},0.22)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: clamp(reveal * 1.4 - 0.2, 0, 1),
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.34em', color: C.faint }}>L2 CACHE · CROSSBAR</span>
      </div>

      {/* memory strip — 8 MIG memory slices (5 GB each, HBM2-backed) */}
      <div style={{ marginTop: 12, display: 'flex', gap: 6, height: 40 }}>
        {Array.from({ length: MEM }).map((_, mi) => {
          const tint = memGroups && memGroups !== 'mig' ? memGroups[mi] : null;
          const stranded = tint === 'stranded';
          const assigned = !!tint && !stranded;
          const mIn = clamp((reveal - 0.4) / 0.5, 0, 1);
          const fill = assigned
            ? `rgba(${hexToRgb(tint as string)},0.85)`
            : stranded
              ? 'rgba(120,130,120,0.18)'
              : `rgba(${hexToRgb(accent)},0.14)`;
          return (
            <div
              key={mi}
              title={
                stranded
                  ? 'Stranded memory slice: the A100 has 8 memory slices but only 7 GPC slices, so this 5 GB slice has no GPC slice to pair with and is unusable.'
                  : 'MIG memory slice — 5 GB, HBM2-backed (not a physical FBP).'
              }
              style={{
                flex: 1,
                borderRadius: 5,
                background: fill,
                border: `1px ${stranded ? 'dashed' : 'solid'} rgba(${hexToRgb(assigned ? (tint as string) : accent)},0.3)`,
                opacity: mIn,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: stranded ? 9 : 10,
                  letterSpacing: stranded ? '0.02em' : '0.1em',
                  color: assigned ? '#06100a' : C.faint,
                }}
              >
                {stranded ? 'stranded' : 'HBM'}
              </span>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: MONO,
          fontSize: 12,
          letterSpacing: '0.2em',
          color: C.faint,
          textAlign: 'center',
          opacity: clamp((reveal - 0.5) / 0.4, 0, 1),
        }}
      >
        {MEM} × 5 GB MEMORY SLICE · HBM2
      </div>
    </div>
  );
}
