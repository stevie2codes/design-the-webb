import { useId, type ReactNode } from 'react';
import { StateId } from '../field/states/ids';

/**
 * Hairline posters of the project emblems (SPEC §3.10 S4–S7) for the paths
 * where no field draws: no JS, no WebGL, and this DOM-first baseline. They
 * sit in the emblem's anchor box (mobile field slots, the MCP App card box,
 * the detail page) and are hidden once the field is live — the same role
 * the chart's SVG bars, the S8 plates and the S9 shell play.
 *
 * Drawn in the chapter placeholders' language: dotted strokes read as
 * particles, solid hairlines as resolved signal, ember for the live accent.
 * Geometry follows the state recipes, in each emblem's local units, and is
 * aspect-fit into the box (xMidYMid meet). Strokes never scale.
 */

export type EmblemId = typeof StateId.PULSE | typeof StateId.LATTICE | typeof StateId.DECK | typeof StateId.CONSTELLATION;

export interface EmblemOutlineProps {
  emblem: StateId;
  className?: string;
}

const f = (n: number): string => String(+n.toFixed(4));
const pts = (list: ReadonlyArray<readonly [number, number]>): string => list.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');

/** Shared stroke props: 1px, unscaled; dotted = round dots 5px apart. */
const HAIR = { vectorEffect: 'non-scaling-stroke', fill: 'none', strokeWidth: 1 } as const;
const DOTS = { ...HAIR, strokeWidth: 1.5, strokeLinecap: 'round', strokeDasharray: '0 5' } as const;

export default function EmblemOutline({ emblem, className = '' }: EmblemOutlineProps) {
  const uid = useId().replace(/[^\w-]/g, '');
  const body = BODIES[emblem as EmblemId];
  if (!body) return null;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={body.viewBox}
      preserveAspectRatio="xMidYMid meet"
      className={`pointer-events-none overflow-visible field-live:hidden ${className}`}
    >
      {body.draw(uid)}
    </svg>
  );
}

interface Body {
  readonly viewBox: string;
  readonly draw: (uid: string) => ReactNode;
}

// ─── S4 PULSE: a speech bubble with a heartbeat ─────────────────────────────
// Local box 1 × .64. Bubble 1 × .78H, radius .16; the tail runs
// (.18, bottom) → (.08, bottom + .2H) → (.34, bottom). The ECG runs through
// the bubble centre (x in widths, y in bubble heights, up positive); rings
// ping from the spike apex, kept inside the bubble.
const P_H = 0.64;
const P_BH = 0.78 * P_H;
const P_R = 0.16;
const P_CY = P_BH / 2;
const BUBBLE = [
  `M${f(P_R)},0 H${f(1 - P_R)} A${P_R},${P_R} 0 0 1 1,${f(P_R)} V${f(P_BH - P_R)}`,
  `A${P_R},${P_R} 0 0 1 ${f(1 - P_R)},${f(P_BH)} H.34 L.08,${f(P_BH + 0.2 * P_H)} L.18,${f(P_BH)}`,
  `H${f(P_R)} A${P_R},${P_R} 0 0 1 0,${f(P_BH - P_R)} V${f(P_R)} A${P_R},${P_R} 0 0 1 ${f(P_R)},0 Z`,
].join(' ');
const ECG: ReadonlyArray<readonly [number, number]> = (
  [
    [0.08, 0],
    [0.34, 0],
    [0.38, 0.05],
    [0.42, -0.04],
    [0.46, 0.36],
    [0.5, -0.3],
    [0.54, 0.04],
    [0.6, 0],
    [0.92, 0],
  ] as const
).map(([x, y]) => [x, P_CY - y * P_BH] as const);
const SPIKE = ECG.slice(3, 7);
const APEX = ECG[4];

const pulse: Body = {
  viewBox: `-.02 -.02 1.04 ${f(P_H + 0.04)}`,
  draw: (uid) => (
    <>
      <defs>
        <clipPath id={`${uid}-bubble`}>
          <path d={BUBBLE} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${uid}-bubble)`} className="stroke-steel/35">
        {[0.12, 0.24, 0.36].map((r) => (
          <circle key={r} cx={APEX[0]} cy={APEX[1]} r={r} {...DOTS} />
        ))}
      </g>
      <path d={BUBBLE} {...DOTS} className="stroke-ink/55" />
      <polyline points={pts(ECG)} {...HAIR} strokeLinejoin="round" className="stroke-ink/80" />
      <polyline points={pts(SPIKE)} {...HAIR} strokeWidth={1.5} strokeLinejoin="round" className="stroke-ember" />
      <circle cx={APEX[0]} cy={APEX[1]} r=".012" className="fill-ember" />
    </>
  ),
};

// ─── S5 CIVIC LATTICE: a civic building printed row by row ──────────────────
// 640 × 520 units on a 10-unit lattice (52 rows): steps, six columns with
// capitals, entablature, pediment, drum, dome, lantern. Rows below the
// write-head are printed; rows above are "not yet generated".
const LATTICE_RECTS: ReadonlyArray<readonly [number, number, number, number]> = [
  [20, 504, 600, 16], // steps
  [41, 488, 558, 16],
  [62, 472, 516, 16],
  ...[90, 182, 274, 366, 458, 550].flatMap(
    (cx) =>
      [
        [cx - 13, 322, 26, 150], // column shaft
        [cx - 17, 314, 34, 8], // capital
      ] as const,
  ),
  [40, 292, 560, 22], // entablature
  [210, 188, 220, 40], // drum
  [308, 48, 24, 30], // lantern
];
const WRITE_Y = 280; // the write-head row (row 28 of 52, counted from the top)

const lattice: Body = {
  viewBox: '0 0 640 520',
  draw: (uid) => (
    <>
      <defs>
        <pattern id={`${uid}-node`} width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="5" cy="5" r="1.7" className="fill-ink" />
        </pattern>
        <pattern id={`${uid}-head`} width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="5" cy="5" r="2.1" className="fill-ember" />
        </pattern>
        <clipPath id={`${uid}-hall`}>
          {LATTICE_RECTS.map(([x, y, w, h]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} />
          ))}
          <polygon points="40,292 600,292 320,228" />
          <path d="M210,188 A110,110 0 0 1 430,188 Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${uid}-hall)`}>
        <rect x="0" y="0" width="640" height={WRITE_Y} fill={`url(#${uid}-node)`} opacity={0.2} />
        <rect x="0" y={WRITE_Y} width="640" height="10" fill={`url(#${uid}-head)`} />
        <rect x="0" y={WRITE_Y + 10} width="640" height={520 - WRITE_Y - 10} fill={`url(#${uid}-node)`} opacity={0.7} />
      </g>
      <line x1="10" x2="630" y1={WRITE_Y + 5} y2={WRITE_Y + 5} {...HAIR} className="stroke-ember/35" />
    </>
  ),
};

// ─── S6 PROMPT DECK: from prompt to art ─────────────────────────────────────
// Five .62 × .86 cards fanned −16…16° about a pivot 1.25 below their centre;
// the front card carries a procedural "›_" and three dotted text lines; the
// art stroke sweeps over the deck from ember to signal. y is down here.
const CARD = { w: 0.62, h: 0.86, r: 0.05 } as const;
const FAN = [-16, -8, 8, 16] as const;
const PIVOT_Y = 1.25;

const deck: Body = {
  viewBox: '-1 -1.1 2 1.7',
  draw: (uid) => {
    const card = { x: -CARD.w / 2, y: -CARD.h / 2, width: CARD.w, height: CARD.h, rx: CARD.r };
    return (
      <>
        <defs>
          <linearGradient id={`${uid}-art`} x1="-.85" x2=".9" y1="0" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" className="[stop-color:var(--color-ember)]" />
            <stop offset="1" className="[stop-color:var(--color-ink)]" />
          </linearGradient>
        </defs>
        {FAN.map((deg) => (
          <rect
            key={deg}
            {...card}
            transform={`rotate(${deg} 0 ${PIVOT_Y})`}
            {...DOTS}
            className="fill-void/80 stroke-steel/60"
          />
        ))}
        <rect {...card} {...HAIR} className="fill-[rgb(10_10_14/0.92)] stroke-ink/70" />
        {/* "›_": two chevron strokes and the (ember) underscore, upper-left. */}
        <polyline points="-.26,-.36 -.12,-.2 -.26,-.04" {...HAIR} strokeWidth={1.5} className="stroke-ink" />
        <rect x="-.08" y="-.04" width=".14" height=".035" className="fill-ember" />
        {[0.72, 0.5, 0.62].map((w, i) => (
          <line key={w} x1="-.24" x2={f(-0.24 + w * CARD.w * 0.78)} y1={f(0.12 + i * 0.09)} y2={f(0.12 + i * 0.09)} {...DOTS} className="stroke-ink/50" />
        ))}
        <path d="M-.85,-.72 C-.3,-1.25 .35,-.3 .9,-.95" {...HAIR} strokeWidth={2} strokeLinecap="round" stroke={`url(#${uid}-art)`} />
        <circle cx="-.85" cy="-.72" r=".025" className="fill-ember" />
      </>
    );
  },
};

// ─── S7 CONSTELLATION: a hub and its tools ──────────────────────────────────
// Hub r .09; ring r .62 tilted 62° about X; six satellites 60° apart on it,
// spokes to the hub, chords between neighbours. The halo shell (r 1, α .06
// in the field) is drawn tighter here, at r .78, so the graph fills the box.
const RING_RY = 0.62 * Math.cos((62 * Math.PI) / 180);
const SATS = Array.from({ length: 6 }, (_, k) => {
  const a = ((k * 60 + 30) * Math.PI) / 180;
  return [0.62 * Math.cos(a), RING_RY * Math.sin(a)] as const;
});

const constellation: Body = {
  viewBox: '-.8 -.8 1.6 1.6',
  draw: () => (
    <>
      <circle r=".78" {...DOTS} strokeDasharray="0 8" className="stroke-ink/20" />
      <ellipse rx=".62" ry={f(RING_RY)} {...DOTS} className="stroke-steel/60" />
      <polygon points={pts(SATS)} {...HAIR} className="stroke-line-strong" />
      {SATS.map(([x, y], k) => (
        <line key={k} x1="0" y1="0" x2={f(x)} y2={f(y)} {...DOTS} strokeDasharray="0 4" className="stroke-ink/45" />
      ))}
      {SATS.map(([x, y], k) => (
        <g key={k}>
          <circle cx={f(x)} cy={f(y)} r=".045" {...HAIR} className="fill-void stroke-ink/80" />
          {k % 2 === 0 && <circle cx={f(x * 0.55)} cy={f(y * 0.55)} r=".014" className="fill-ember" />}
        </g>
      ))}
      <circle r=".09" {...HAIR} className="fill-void stroke-ink" />
      <circle r=".03" className="fill-ember" />
    </>
  ),
};

const BODIES: Readonly<Record<EmblemId, Body>> = {
  [StateId.PULSE]: pulse,
  [StateId.LATTICE]: lattice,
  [StateId.DECK]: deck,
  [StateId.CONSTELLATION]: constellation,
};
