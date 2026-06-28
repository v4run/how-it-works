// The shared GPU-die visual — ported from the prototype.
// 7 GPC-slice columns × 16 SMs each = 112 SMs (one rectangle = one SM).
// The grid is a uniform schematic, but the real per-profile SM counts (from
// nvidia-smi mig -lgip on H100 SXM5) are NOT uniform: 1g.10gb=16, 2g.20gb=32,
// 4g.40gb=64 scale ×16, while 1g.20gb=26, 3g.40gb=60 and 7g.80gb=132 get bonus
// SMs because 132 doesn't divide evenly into 7. So a full 7g.80gb spans all 132
// SMs; a max-density 7-slice split reaches only 7 × 16 = 112.
// Plus an L2 band and 8 memory slices.
import { C, MONO, hexToRgb } from './theme';
import { clamp } from '../engine/anim';

export const COLS = 7; // GPC slices (max MIG instances)
export const ROWS = 16; // SMs per GPC slice (1g.10gb = 16, confirmed on H100 SXM5)
export const TOTAL_SMS = 132; // SMs on the H100 SXM5 die; a 7g.80gb uses all 132, a 7-way split reaches 112
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
  label = 'GH100 · LOGICAL VIEW',
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
            title="Logical partition map, not the physical die floorplan. Columns are MIG GPC slices (the real GH100 has 8 GPCs in two rows around a central, split L2); the bottom strip is MIG's 8 memory slices — each bundles 10 GB of HBM3 with its share of the memory controllers + L2 (the FBP resources). It is not a literal floorplan: the H100 SXM5 has 5 active HBM3 stacks with controllers on the die edges, and the FBP count differs from 8."
          >
            {label}
          </span>
        ) : (
          <span />
        )}
        {!hideHeader ? (
          <span style={{ fontFamily: MONO, fontSize: 12.5, letterSpacing: '0.1em', color: accent, opacity: 0.8 }} title="H100 SXM5: 7 GPC slices, 132 SMs. The grid is a uniform 16-SM/slice schematic, but real per-profile SM counts are non-uniform (1g.10gb=16, 1g.20gb=26, 2g.20gb=32, 3g.40gb=60, 4g.40gb=64, 7g.80gb=132) — a 7g.80gb uses all 132, while a 7-way 1g.10gb split reaches only 112. (nvidia-smi mig -lgip.)">
            {COLS} GPC slices · {TOTAL_SMS} SMs
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

      {/* L2 cache + crossbar band. In MIG mode the crossbar is carved per
          instance — each instance's GPC slices reach only its own memory
          slices (hardware isolation). Without partitions it's all-to-all. */}
      <div
        title={
          groups && groups.length
            ? 'Crossbar partitioned: each GPU instance gets dedicated crossbar lanes, so its GPC slices reach only its own L2 + memory slices. No path crosses between instances — this is where MIG’s spatial isolation is enforced.'
            : 'L2 cache + crossbar: the all-to-all fabric connecting every GPC/SM to every memory slice. MIG partitions it per instance; vGPU time-shares the whole thing.'
        }
        style={{
          position: 'relative',
          marginTop: 16,
          height: 26,
          borderRadius: 6,
          background: `repeating-linear-gradient(90deg, rgba(${hexToRgb(accent)},0.12) 0 26px, rgba(${hexToRgb(accent)},0.05) 26px 32px)`,
          border: `1px solid rgba(${hexToRgb(accent)},0.18)`,
          overflow: 'hidden',
          opacity: clamp(reveal * 1.4 - 0.2, 0, 1),
        }}
      >
        {/* partitioned crossbar lanes, aligned with each instance's GPC columns */}
        {groups &&
          groups.map((g, gi) => {
            const c0 = Math.min(...g.cols);
            const c1 = Math.max(...g.cols);
            const left = c0 * (colW + colGap);
            const width = (c1 - c0 + 1) * colW + (c1 - c0) * colGap;
            const col = g.fault ? C.red : g.color || accent;
            return (
              <div
                key={gi}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left,
                  width,
                  background: `rgba(${hexToRgb(col)},0.22)`,
                  borderLeft: `2px solid rgba(${hexToRgb(col)},0.75)`,
                  borderRight: `2px solid rgba(${hexToRgb(col)},0.75)`,
                  boxShadow: `inset 0 0 14px rgba(${hexToRgb(col)},0.28)`,
                }}
              />
            );
          })}
        <span
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: MONO,
            fontSize: 12,
            letterSpacing: '0.34em',
            color: C.faint,
            textShadow: '0 0 6px rgba(0,0,0,0.7)',
          }}
        >
          {groups && groups.length ? 'L2 · CROSSBAR — PARTITIONED' : 'L2 CACHE · CROSSBAR'}
        </span>
      </div>

      {/* memory strip — 8 MIG memory slices (10 GB each, HBM3-backed) */}
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
                  ? 'Stranded memory slice: the H100 has 8 memory slices but only 7 GPC slices, so this 10 GB slice has no GPC slice to pair with and is unusable.'
                  : 'MIG memory slice — 10 GB of HBM3 plus its share of the memory controllers + L2 cache (the FBP resources).'
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
        {MEM} × 10 GB MEMORY SLICE · HBM3
      </div>
    </div>
  );
}
