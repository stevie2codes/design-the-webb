import { useId, type CSSProperties } from 'react';
import { chart, stats, type Stat, type StatKey } from '../content/site';
import { CHART } from '../field/layout';

/**
 * The honest career chart (SPEC §3.10 S2, §5 C1, §10): a YEARS axis 0–7,
 * bars to scale — 2, 4+, and a stacked 2 + 4+ = 6+ — and past a divider,
 * the AI reporting platform as a count (not years).
 *
 * Geometry comes from CHART in src/field/layout.ts (frame units: x ∈ [0, 1]
 * of the chart width, years on the 0–7 scale), and the plot box is the S2
 * anchor box (--anchor-chart-x|y|w|h, baseline = y + h), so the DOM labels,
 * the fallback bars and the particle chart share one coordinate system.
 *
 * Two parts, rendered as siblings in the About stage:
 * - <CareerChart>: the <figure> — anchors, the mobile field slot, the plot
 *   and the visually hidden <table> (Stat | Value | Note), which is what
 *   assistive tech reads. Desktop: the figure is position: static, so the
 *   plot and the anchor are positioned against the About stage (x 54 → 92vw,
 *   baseline 80svh, 1 yr = 52svh / 7); keep it untransformed there, or it
 *   becomes their containing block. Mobile: the figure is relative and is
 *   the field slot (52svh); the plot sits over it (anchor coordinates are
 *   slot-relative there). About orders it first on mobile.
 * - <CareerStats>: the visible stat blocks (value, label, note), aria-hidden
 *   and not focusable (the table carries the same rows). Wide desktop
 *   (≥ 1000px): one row under the baseline, a column per bar from its left
 *   edge; labels and notes share two subgrid rows, so every note starts on
 *   one line. Mobile and narrow desktop (landscape phones): a list. On
 *   mobile it follows the About text, never precedes the heading.
 *
 * Plot layers (aria-hidden, z-1 so no neighbouring scrim dims them): the
 * fallback bars (quarter-year slabs of dots, the "+" fizz, gridlines,
 * divider, the AI point) shown only while the field is not live; the axis /
 * baseline / ticks SVG (always; pathLength 1 for stroke-dashoffset draws);
 * tick labels, "Years", the legend; the numerals ([data-numeral] with
 * data-count / data-suffix for the lockstep count-up; final values for now);
 * the ember leader ([data-leader], origin-top for a scaleY draw).
 *
 * While the field is not live, hovering a stat dims the fallback groups it
 * does not light and steps the other numerals down to ink-2 (colour only),
 * the DOM echo of uGroupW.
 */

/**
 * Put on the About stage: the gap between the baseline and the stat row
 * (read by the leader in the figure and by the stat row beside it).
 */
export const CHART_STAGE_VARS = '[--label-gap:24px] max-[1200px]:[--label-gap:14px]';

type Swatch = 'steel' | 'signal';

/** S2 group → particle colour (§3.10: g0/g2 developer years steel, g1/g3 design years signal). */
const GROUP_SWATCH: Readonly<Record<number, Swatch>> = { 0: 'steel', 1: 'signal', 2: 'steel', 3: 'signal' };

/** Fraction → CSS percentage. */
const pct = (f: number): string => `${+(f * 100).toFixed(4)}%`;
/** Years → fraction of the frame height (0 at the baseline, 1 at 7 years). */
const yf = (years: number): number => years / CHART.years;
/** A fraction of the chart frame width. */
const ofW = (f: number): string => `calc(var(--anchor-chart-w) * ${+f.toFixed(4)})`;

const STAT = Object.fromEntries(stats.map((s) => [s.key, s])) as Record<StatKey, Stat>;

interface Segment {
  readonly from: number;
  readonly to: number;
  readonly group: number;
}

interface Bar {
  readonly key: StatKey;
  /** Left edge, frame units. */
  readonly x0: number;
  readonly w: number;
  readonly years: number;
  /** Bottom → top. */
  readonly segments: readonly Segment[];
}

const BARS: readonly Bar[] = CHART.bars.map((b): Bar => {
  const x0 = b.xc - b.w / 2;
  if ('stack' in b) {
    const [lower, upper] = b.stack;
    return {
      key: b.stat,
      x0,
      w: b.w,
      years: b.years,
      segments: [
        { from: 0, to: lower, group: b.groups[0] },
        { from: lower, to: lower + upper, group: b.groups[1] },
      ],
    };
  }
  return { key: b.stat, x0, w: b.w, years: b.years, segments: [{ from: 0, to: b.years, group: b.groups[0] }] };
});

/** Numerals: left-aligned with their bar (or the AI leader), 2svh above the data. */
const NUMERALS = [
  ...BARS.map((b) => ({ stat: STAT[b.key], x: b.x0, top: yf(b.years), lift: '0px' })),
  // The AI point's reticle is ~12px in radius; keep the numeral clear of it.
  { stat: STAT.ai, x: CHART.ai.xc, top: CHART.ai.y, lift: '12px' },
];

/**
 * Wide desktop label row: columns start at each bar's left edge, and the AI
 * caption hangs off the leader (x .90). Fed to the wrapper as CSS variables.
 */
const COL_LEFT: readonly number[] = stats.map((s) =>
  s.key === 'ai' ? CHART.ai.xc : (BARS.find((b) => b.key === s.key)?.x0 ?? 0),
);
const LABEL_ROW = {
  '--label-pad': ofW(COL_LEFT[0]),
  '--label-cols': [...COL_LEFT.slice(1).map((x, i) => ofW(x - COL_LEFT[i])), 'minmax(0, 1fr)'].join(' '),
} as CSSProperties;

/**
 * Fallback-bar dimming while a stat is hovered: a group dims unless the
 * hovered stat lights it (the DOM echo of uGroupW). The stats are a sibling
 * of the figure, so the :has() scope is the stage. Literal strings so
 * Tailwind can see them.
 */
const DIM_UNLESS_LIT: Readonly<Record<number, string>> = {
  0: '[.stage:has([data-stat]:hover:not([data-lights~=g0]))_&]:opacity-25',
  1: '[.stage:has([data-stat]:hover:not([data-lights~=g1]))_&]:opacity-25',
  2: '[.stage:has([data-stat]:hover:not([data-lights~=g2]))_&]:opacity-25',
  3: '[.stage:has([data-stat]:hover:not([data-lights~=g3]))_&]:opacity-25',
  4: '[.stage:has([data-stat]:hover:not([data-lights~=g4]))_&]:opacity-25',
};

/** Numerals of the other stats step down to ink-2 while a stat is hovered (colour only). */
const NUMERAL_DIM: Readonly<Record<StatKey, string>> = {
  developer: '[.stage:has([data-stat]:hover:not([data-stat=developer]))_&]:text-ink-2',
  design: '[.stage:has([data-stat]:hover:not([data-stat=design]))_&]:text-ink-2',
  tech: '[.stage:has([data-stat]:hover:not([data-stat=tech]))_&]:text-ink-2',
  ai: '[.stage:has([data-stat]:hover:not([data-stat=ai]))_&]:text-ink-2',
};

const SWATCH_BG: Readonly<Record<Swatch, string>> = { steel: 'bg-steel', signal: 'bg-ink' };
const SWATCH_STROKE: Readonly<Record<Swatch, string>> = { steel: 'stroke-steel', signal: 'stroke-ink' };
/** The slab fill: a 4px dot grid (r .95px at α .62), centred in each slab. */
const SWATCH_DOTS: Readonly<Record<Swatch, string>> = {
  steel: 'bg-[radial-gradient(circle,rgb(140_151_173/0.62)_0.95px,transparent_1.3px)]',
  signal: 'bg-[radial-gradient(circle,rgb(242_238_230/0.62)_0.95px,transparent_1.3px)]',
};

/**
 * The key for the steel (developer years) and bone (design years) fills.
 * Desktop: top-left inside the plot, clear of the bars and numerals (all
 * three bars use these two fills). Mobile: under the baseline, in the slot.
 */
function Legend() {
  return (
    <ul
      aria-hidden="true"
      className="absolute top-[calc(100%+18px)] left-0 flex gap-x-5 gap-y-2 desktop:top-3 desktop:left-4 desktop:flex-col"
    >
      {chart.legend.map((item) => (
        <li key={item.label} className="t-label flex items-center gap-2 whitespace-nowrap text-ink-2">
          <span className={`size-2 shrink-0 rounded-[1px] ${SWATCH_BG[item.swatch]}`} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Shown while the field is not live (no JS, no WebGL, fallback): §5 C1, §8.4.
 * Three layers: gridlines and the divider; the bars' quarter-year slabs
 * (HTML, so each slab tiles its own dot grid and every slab reads the same);
 * then the bar edges and caps, the "+" fizz and the AI point.
 */
function FallbackBars({ uid }: { uid: string }) {
  const y = (years: number) => pct(1 - yf(years));
  const gridEnd = pct(CHART.gridEnd);

  return (
    <div aria-hidden="true" className="chart-bars absolute inset-0 field-live:hidden">
      {/* Gridlines at 2, 4, 6 years (dotted) and the divider (dashed). */}
      <svg focusable="false" className="absolute inset-0 size-full overflow-visible">
        <g className="stroke-steel" strokeWidth={1} shapeRendering="crispEdges">
          {CHART.ticks
            .filter((t) => t > 0)
            .map((t) => (
              <line key={t} x1="0" x2={gridEnd} y1={y(t)} y2={y(t)} strokeOpacity={0.3} strokeDasharray="1 5" />
            ))}
          <line
            x1={pct(CHART.divider)}
            x2={pct(CHART.divider)}
            y1="0"
            y2="100%"
            strokeOpacity={0.4}
            strokeDasharray="3 5"
          />
        </g>
      </svg>

      {/* Slabs: H/28 each (one quarter-year) with a real 0.2svh gap. */}
      {BARS.map((b) =>
        b.segments.map((seg) => {
          const swatch = GROUP_SWATCH[seg.group] ?? 'signal';
          const slabs = Math.round((seg.to - seg.from) * CHART.slabsPerYear);
          return (
            <div
              key={`${b.key}-${seg.group}`}
              data-group={seg.group}
              style={{ left: pct(b.x0), width: pct(b.w), bottom: pct(yf(seg.from)), height: pct(yf(seg.to - seg.from)) }}
              className={`absolute flex flex-col gap-[0.2svh] transition-opacity duration-500 ease-ui ${DIM_UNLESS_LIT[seg.group]}`}
            >
              {Array.from({ length: slabs }, (_, i) => (
                <span key={i} className={`min-h-0 flex-1 bg-size-[4px_4px] bg-center ${SWATCH_DOTS[swatch]}`} />
              ))}
            </div>
          );
        }),
      )}

      <svg focusable="false" className="absolute inset-0 size-full overflow-visible">
        <defs>
          <pattern id={`${uid}-fizz`} width="5" height="6" patternUnits="userSpaceOnUse">
            <circle cx="2.5" cy="3" r="0.8" className="fill-ink" fillOpacity={0.5} />
          </pattern>
          <linearGradient id={`${uid}-rise`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id={`${uid}-fade`} maskContentUnits="objectBoundingBox">
            <rect width="1" height="1" fill={`url(#${uid}-rise)`} />
          </mask>
        </defs>

        {/* Bar side edges and top caps (the cap between the stacked segments is the 2-year line). */}
        {BARS.map((b) =>
          b.segments.map((seg) => {
            const swatch = GROUP_SWATCH[seg.group] ?? 'signal';
            const x1 = pct(b.x0);
            const x2 = pct(b.x0 + b.w);
            return (
              <g
                key={`${b.key}-${seg.group}`}
                data-group={seg.group}
                strokeWidth={1}
                shapeRendering="crispEdges"
                className={`transition-opacity duration-500 ease-ui ${SWATCH_STROKE[swatch]} ${DIM_UNLESS_LIT[seg.group]}`}
              >
                <line x1={x1} x2={x1} y1={y(seg.to)} y2={y(seg.from)} strokeOpacity={0.45} />
                <line x1={x2} x2={x2} y1={y(seg.to)} y2={y(seg.from)} strokeOpacity={0.45} />
                <line x1={x1} x2={x2} y1={y(seg.to)} y2={y(seg.to)} strokeOpacity={seg.to === b.years ? 1 : 0.9} />
              </g>
            );
          }),
        )}

        {/* The "+" drawn as data still arriving: fizz above 4+ and 6+, fading to 0. */}
        {CHART.fizz.map((f) => {
          const b = BARS[f.bar];
          return (
            <rect
              key={f.bar}
              x={pct(b.x0)}
              y={y(f.to)}
              width={pct(b.w)}
              height={pct(yf(f.to - f.from))}
              fill={`url(#${uid}-fizz)`}
              mask={`url(#${uid}-fade)`}
            />
          );
        })}

        {/* Now: the AI reporting platform, past the divider. */}
        <g data-group={4} className={`transition-opacity duration-500 ease-ui ${DIM_UNLESS_LIT[4]}`}>
          <circle cx={pct(CHART.ai.xc)} cy={pct(1 - CHART.ai.y)} r="18" className="fill-ember" fillOpacity={0.08} />
          <circle
            cx={pct(CHART.ai.xc)}
            cy={pct(1 - CHART.ai.y)}
            r="11"
            fill="none"
            className="stroke-ember"
            strokeOpacity={0.75}
            strokeDasharray="1.5 3.5"
          />
          <circle cx={pct(CHART.ai.xc)} cy={pct(1 - CHART.ai.y)} r="3" className="fill-ember" />
        </g>
      </svg>
    </div>
  );
}

/** Y-axis, baseline and ticks: always drawn, 1px line-strong (stroke-dashoffset hooks via pathLength 1). */
function Axis() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="absolute inset-0 size-full overflow-visible stroke-line-strong"
      strokeWidth={1}
      shapeRendering="crispEdges"
    >
      <line data-axis="y" x1="0" x2="0" y1="0" y2="100%" pathLength={1} />
      <line data-axis="x" x1="0" x2={pct(CHART.gridEnd)} y1="100%" y2="100%" pathLength={1} />
      {CHART.ticks.map((t) => {
        const yy = pct(1 - yf(t));
        return <line key={t} data-tick={t} x1="-6" x2="0" y1={yy} y2={yy} pathLength={1} />;
      })}
    </svg>
  );
}

/** Keep a one-letter word on the line before it ("Years as a / Developer", never a lone "A"). */
const bindShortWords = (text: string): string => text.replace(/ (\S) /g, '\u00a0$1 ');

export default function CareerChart({ className = '' }: { className?: string }) {
  const uid = useId().replace(/[^\w-]/g, '');
  const yearsId = `${uid}-years`;

  return (
    <figure aria-labelledby={yearsId} className={`desktop:static mobile:relative mobile:short:mt-14 ${className}`}>
      {/* Desktop S2 anchor (stage-relative: the figure is static there). */}
      <div aria-hidden="true" data-field-anchor="S2" className="mobile:hidden" />
      {/* Mobile: the field slot opens the chapter; the S2 anchor is slot-relative. */}
      <div className="field-slot" data-slot="about" aria-hidden="true">
        <div data-field-anchor="S2" />
      </div>

      {/* The plot box = the S2 anchor box; its bottom edge is the baseline. */}
      <div
        aria-hidden="true"
        data-chart-plot
        className="pointer-events-none absolute z-1 top-[var(--anchor-chart-y)] left-[var(--anchor-chart-x)] h-[var(--anchor-chart-h)] w-[var(--anchor-chart-w)]"
      >
        <FallbackBars uid={uid} />
        <Axis />

        <span id={yearsId} className="t-label absolute bottom-[calc(100%+16px)] left-0 text-ink-2">
          {chart.axisTitle}
        </span>
        {CHART.ticks.map((t, i) => (
          <span
            key={t}
            data-tick-label={t}
            style={{ '--tick': pct(yf(t)) } as CSSProperties}
            className="t-label absolute bottom-[var(--tick)] -left-3 -translate-x-full translate-y-1/2 text-ink-2 tabular-nums mobile:left-1.5 mobile:bottom-[calc(var(--tick)+3px)] mobile:translate-x-0 mobile:translate-y-0"
          >
            {chart.ticks[i]}
          </span>
        ))}
        <Legend />

        {/* Numerals: final values for now; the count-up (§5 C1) drives them later.
            Glyph baseline 2svh above the data (box bottom sits .09em below it). */}
        {NUMERALS.map(({ stat, x, top, lift }) => (
          <span
            key={stat.key}
            data-numeral={stat.key}
            data-count={stat.count}
            data-suffix={stat.suffix}
            style={{ left: pct(x), bottom: `calc(${pct(top)} + 2svh + ${lift} - 0.09em)` }}
            className={`t-stat absolute whitespace-nowrap text-ink transition-colors duration-500 ease-ui desktop:text-[length:min(clamp(3.5rem,2rem+6vw,7.5rem),13svh)] ${NUMERAL_DIM[stat.key]}`}
          >
            {stat.value}
          </span>
        ))}

        {/* The 1px ember leader from the AI point: down to its caption on wide
            desktop, to the baseline where the stats are a list. */}
        <span
          data-leader
          style={{ left: pct(CHART.ai.xc), top: `calc(${pct(1 - CHART.ai.y)} + 16px)` }}
          className="absolute bottom-0 w-px origin-top -translate-x-1/2 bg-ember desktop:min-[1000px]:bottom-[calc(4px-var(--label-gap))]"
        />
      </div>

      <table className="sr-only">
        <thead>
          <tr>
            {chart.tableColumns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.key}>
              <th scope="row">{s.label}</th>
              <td>{s.value}</td>
              <td>{s.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/**
 * The stat blocks (§5 C1): value · label · note, aria-hidden (the figure's
 * table carries the same rows) and not focusable. `[data-stat]` +
 * `data-lights` (the S2 focus groups it lights) are the uGroupW hooks;
 * hover only. The row's scrim stops 8px above it so it never dims the bars'
 * bases.
 */
export function CareerStats({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      data-safe
      data-fit
      style={LABEL_ROW}
      className={`flex flex-col before:-top-2 desktop:absolute desktop:top-[calc(var(--anchor-chart-baseline)+var(--label-gap))] desktop:left-[var(--anchor-chart-x)] desktop:w-[min(calc(var(--anchor-chart-w)+5vw),calc(100vw-var(--anchor-chart-x)-var(--gutter)))] desktop:min-[1000px]:grid desktop:min-[1000px]:grid-cols-(--label-cols) desktop:min-[1000px]:grid-rows-[auto_auto] desktop:min-[1000px]:gap-y-2 desktop:min-[1000px]:pl-(--label-pad) ${className}`}
    >
      {stats.map((stat) => (
        <div
          key={stat.key}
          data-stat={stat.key}
          data-lights={stat.groups.map((g) => `g${g}`).join(' ')}
          className={`group grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 border-t border-line py-4 last:border-b desktop:min-[1000px]:row-span-2 desktop:min-[1000px]:mr-3 desktop:min-[1000px]:grid-cols-1 desktop:min-[1000px]:grid-rows-subgrid desktop:min-[1000px]:border-0 desktop:min-[1000px]:py-0 desktop:min-[1000px]:last:mr-0 desktop:min-[1000px]:last:border-b-0`}
        >
          <span
            className={`t-label row-span-2 tabular-nums desktop:min-[1000px]:hidden ${stat.key === 'ai' ? 'text-ember' : 'text-ink'}`}
          >
            {stat.value}
          </span>
          <span className={`t-label col-start-2 text-balance text-ink desktop:min-[1000px]:col-start-1`}>
            {bindShortWords(stat.label)}
          </span>
          <span
            className={`t-body col-start-2 mt-1.5 text-[14px] leading-[1.45] text-pretty text-ink-2 transition-colors duration-240 ease-ui group-hover:text-ink desktop:min-[1000px]:col-start-1 desktop:min-[1000px]:mt-0`}
          >
            {stat.note}
          </span>
        </div>
      ))}
    </div>
  );
}
