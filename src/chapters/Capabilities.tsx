import { useCallback, useEffect, useRef, useState } from 'react';
import Chapter from '../components/Chapter';
import ChapterHeading from '../components/ChapterHeading';
import { capabilities, type Capability } from '../content/site';
import { STACK_FIT } from '../field/layout';
import { StateId } from '../field/states/ids';
import { subscribeScroll } from '../motion/lenis';
import { headingId } from '../scroll/chapters';
import { store } from '../scroll/store';
import type { ChapterContext } from '../scroll/useChapter';
import { posterF, watchFilm } from './choreo/film';
import { claimFocus, releaseFocus } from './choreo/fx';

/** The four plates (S8 focus groups g0–g3, top first). */
const ROWS = capabilities.items.length;
const PLATE_GROUPS = [0, 1, 2, 3] as const;
/**
 * The plate focus is claimed only while the field shows the stack: from the
 * tail of seg7 (S7's spokes share g0–g3 and must not dim) to the very start
 * of the spiral — released at F 8.04 (tuned; was 8.6) so every plate carries
 * its full light into the spiral instead of three dimmed plates. Displayed
 * film position.
 */
const FOCUS_GATE = [7.9, 8.04] as const;
const FOCUS_OWNER = 'capabilities';

/**
 * Stuck-stage measures (the `staged:` variant: desktop, full motion, and only
 * while the stage really is sticky). While stuck the stage is exactly 100svh
 * and every row must stay readable at once (hold rule), so the vw-driven
 * roles are also capped by height (never below their role minimums), and
 * the vertical rhythm is in svh. When it still cannot fit, the fit guard in
 * <Chapter> drops the chapter to flow, and there — as under reduced motion,
 * without JS and on short landscape phones — the plain roles and rhythm
 * apply (.t-display-l / .t-display-m, py-6).
 */
const STATEMENT_FS =
  'staged:text-[max(2rem,min(clamp(2.25rem,1.3rem+3.4vw,5rem),5.4svh))] staged:low:text-[max(2rem,min(clamp(2.25rem,1.3rem+3.4vw,5rem),4.6svh))]';
const TITLE_FS = 'staged:text-[max(1.625rem,min(clamp(1.625rem,1.1rem+1.8vw,2.75rem),3.9svh))]';
/**
 * The short-laptop tier (`low:`, height ≤ 760px: 1366×657, 1536×730,
 * 1280×720 … down to 640px tall): a two-line statement (4.6svh cap), tighter
 * row rhythm (py .75svh, description lead-in .6svh, line-height 1.5) and a
 * 2svh list gap, so the stuck stage fits instead of falling back to flow.
 * The top padding stays: the heading must clear the nav's 96px scrim.
 */
const LOW = {
  list: 'staged:low:mt-[2svh]',
  row: 'staged:low:py-[0.75svh]',
  desc: 'staged:low:mt-[0.6svh] staged:low:leading-[1.5]',
} as const;

/**
 * The left column: gutter → 49vw (§5 C4). The width keeps every description
 * on two lines down to 1280px wide (at a 44ch caption measure each takes
 * three, and the stuck stage no longer fits below ≈ 1000px of height), and
 * still clears the stack, whose drawn shape starts at ≈ 53vw.
 */
const COLUMN = 'desktop:w-[calc(49vw-var(--gutter))]';

/**
 * C4 What I do — #capabilities (SPEC §5 C4). Sticky on desktop (L 100vh),
 * flow on mobile with the S8 slot first.
 *
 * Desktop: the left column (gutter → 49vw) holds the h2, the two-line
 * statement and the four hairline-separated rows; the S8 STACK sits on the
 * right (centre 70vw, 54svh). Every description is always visible; the
 * active row is emphasis only (colour + a 2px ember rule), no text moves.
 *
 * Hooks:
 * - `li[data-group=k]` + `[data-active]`: the active capability (plate k).
 * - `[data-field-anchor="S8"]`: the desktop box sits in the stage, the mobile
 *   box in the `.field-slot`; each is display:none in the other layout.
 * - `[data-safe]` on the text column (scrim + text-safe mask).
 *
 * Choreography (§5 C4). seg7 (S7 → S8) runs from `capabilities` − 80vh to
 * + 10vh. The statement line-masks in while the section top moves from 60%
 * to 15% of the viewport; the rows fade up (16px) from 40% to 5%.
 * - Stuck: row k is active for p ∈ [k/4, (k+1)/4). The step is time-based
 *   (500 ms CSS transitions): the title turns ink, the index ember, the 2px
 *   ember rule grows (scaleY) — and plate k takes the field's focus
 *   (uGroupW k = 1, the others 0, uFocusOn 1; the director damps them over
 *   500 ms): the drawer slides out and racks into focus, the other plates
 *   turn steel and defocus. No DOM text moves (hold rule).
 * - Hover or click on a row makes it active until the scroll window next
 *   changes.
 * - Flow (mobile, the fit-guard fallback, reduced motion): the row nearest
 *   the viewport centre is active.
 * The plate focus is claimed only while the field shows the stack (see
 * FOCUS_GATE; the S8 poster under reduced motion) and released otherwise.
 */
export default function Capabilities() {
  const titleId = headingId('capabilities');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLOListElement>(null);
  /** The row the scroll window picks (sticky progress, or the centre row in flow). */
  const scrollK = useRef(0);
  /** A hovered / clicked row; cleared when the scroll window changes. */
  const pinned = useRef<number | null>(null);
  const activeK = useRef(0);
  /** Re-evaluates the plate focus; set by the chapter's reveal callback. */
  const syncFocus = useRef<() => void>(() => {});

  const apply = useCallback(() => {
    const k = pinned.current ?? scrollK.current;
    if (k !== activeK.current) {
      activeK.current = k;
      setActive(k); // a discrete step (≤ 4 per pass), never per frame
    }
    syncFocus.current();
  }, []);

  const fromScroll = useCallback(
    (k: number) => {
      if (k === scrollK.current) return;
      scrollK.current = k;
      pinned.current = null;
      apply();
    },
    [apply],
  );

  const onActivate = useCallback(
    (k: number) => {
      pinned.current = k;
      apply();
    },
    [apply],
  );

  // Stuck (§5 C4): row k for p ∈ [k/4, (k+1)/4). Flow chapters get their
  // progress over 'top bottom' → 'bottom top', which means nothing here.
  const onProgress = (p: number) => {
    if (!store.chapters.capabilities?.sticky) return;
    fromScroll(Math.min(ROWS - 1, Math.max(0, Math.floor(p * ROWS))));
  };

  // Flow (mobile, fit-guard fallback, reduced motion): the row nearest the
  // viewport centre is active. A zero-height root at 50% of the viewport
  // picks the row crossing it.
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof IntersectionObserver === 'undefined') return;
    const rows = Array.from(list.children);
    const io = new IntersectionObserver(
      (entries) => {
        if (store.chapters.capabilities?.sticky) return;
        for (const entry of entries) {
          if (entry.isIntersecting) fromScroll(rows.indexOf(entry.target));
        }
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );
    rows.forEach((row) => io.observe(row));
    return () => io.disconnect();
  }, [fromScroll]);

  // The plate focus follows the displayed film (full motion) or the poster
  // (reduced motion); built with the chapter's gsap context.
  const reveal = useCallback((ctx: ChapterContext) => {
    let F = -1;
    let claimed = -1;
    const sync = () => {
      const shown = ctx.reduced ? posterF() === StateId.STACK : F >= FOCUS_GATE[0] && F <= FOCUS_GATE[1];
      const want = shown ? activeK.current : -1;
      if (want === claimed) return;
      claimed = want;
      if (want >= 0) claimFocus(FOCUS_OWNER, [want], PLATE_GROUPS, { focusOn: 1 });
      else releaseFocus(FOCUS_OWNER);
    };
    syncFocus.current = sync;
    const off = ctx.reduced
      ? subscribeScroll(sync)
      : watchFilm(ctx.gsap, (f) => {
          if (f === F) return;
          F = f;
          sync();
        });
    sync();
    return () => {
      off();
      syncFocus.current = () => {};
      releaseFocus(FOCUS_OWNER);
    };
  }, []);

  return (
    <Chapter
      id="capabilities"
      labelledBy={titleId}
      onProgress={onProgress}
      reveal={reveal}
      stageClassName="pb-24 desktop:flex desktop:flex-col desktop:justify-center-safe desktop:pt-[max(104px,11svh)] desktop:pb-[max(48px,4svh)]"
    >
      {/* Mobile: the stack slot opens the chapter (§4.2). Hidden on desktop. */}
      <div className="field-slot" data-slot="capabilities" aria-hidden="true">
        <div data-field-anchor="S8" />
        <StackOutline active={active} />
      </div>

      {/* Desktop S8 box (stage frame), from --anchor-stack-*. */}
      <div aria-hidden="true" data-field-anchor="S8" className="mobile:hidden" />
      <StackOutline active={active} className="mobile:hidden" />

      {/* data-fit: the whole column must fit the stuck stage, or the chapter
          falls back to flow (the fit guard in <Chapter>). The top padding
          keeps the heading clear of the nav band (64px + its 96px scrim),
          the bottom padding the HUD's corner band (≥ 48px). */}
      <div data-fit className="px-gutter mobile:pt-2">
        {/* One scrim for the whole column: stacked [data-safe] blocks closer
            than 48px would darken each other's text. */}
        <div data-safe className={COLUMN}>
          <ChapterHeading heading={capabilities.heading} id={titleId} />
          <p
            data-reveal="lines"
            data-reveal-timed
            className={`t-display-l mt-5 text-balance text-ink staged:mt-[clamp(12px,2svh,24px)] ${STATEMENT_FS}`}
          >
            {capabilities.statement.lead} <span className="t-accent">{capabilities.statement.accent}</span>
          </p>

          <ol ref={listRef} className={`mt-12 staged:mt-[clamp(16px,3svh,48px)] ${LOW.list}`}>
            {capabilities.items.map((item, i) => (
              <CapabilityRow key={item.title} item={item} index={i} active={i === active} onActivate={onActivate} />
            ))}
          </ol>
        </div>
      </div>
    </Chapter>
  );
}

interface CapabilityRowProps {
  item: Capability;
  index: number;
  active: boolean;
  onActivate: (index: number) => void;
}

/**
 * One hairline-separated row: h3 with its index on the same baseline, then
 * the description. Active: index ember, title ink (others ink-2), and a 2px
 * ember rule in the gutter that grows with scaleY over 500ms.
 */
function CapabilityRow({ item, index, active, onActivate }: CapabilityRowProps) {
  return (
    <li
      data-group={index}
      data-active={active || undefined}
      data-reveal="up"
      data-reveal-window="40,5"
      onPointerEnter={(e) => {
        if (e.pointerType !== 'touch') onActivate(index);
      }}
      onClick={() => onActivate(index)}
      className={`group relative border-t border-line py-6 last:border-b staged:py-[clamp(6px,1.1svh,20px)] ${LOW.row}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 -left-3 w-0.5 origin-top scale-y-0 bg-ember transition-transform duration-500 ease-out-expo group-data-active:scale-y-100 desktop:-left-5 rm:transition-none"
      />
      <div className="flex items-baseline justify-between gap-6">
        <h3
          className={`t-display-m text-ink-2 transition-colors duration-500 ease-ui group-data-active:text-ink ${TITLE_FS}`}
        >
          {item.title}
        </h3>
        <span
          aria-hidden="true"
          className="t-label shrink-0 text-ink-2 transition-colors duration-500 ease-ui group-data-active:text-ember"
        >
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <p className={`t-body mt-3 text-ink-2 staged:mt-[clamp(4px,0.9svh,10px)] ${LOW.desc}`}>{item.description}</p>
    </li>
  );
}

// ─── No-field placeholder ────────────────────────────────────────────────────
// Until the field is live (this DOM-first baseline, no WebGL) the S8 box shows
// the STACK as four hairline isometric plates (§3.10 S8), sized like the
// field's shape: s = min(boxW, boxH) / STACK_FIT, plates .9s × .6s, radius .06s, at
// y = +.27s … −.27s, rotated 45° about Y then 35.264° about X. The active
// plate is drawn solid in ember and pulled out like a drawer (+.06s up,
// +.08s along x); the others are dotted, "out of focus". Hidden once the
// field draws S8 (`field-s8:`, html[data-field-states]).

const PLATE = { w: 0.9, d: 0.6, r: 0.06 } as const;
/** One s = 1 unit; the box is STACK_FIT units across, so the stack fits it. */
const STACK_VIEWBOX = `${-STACK_FIT / 2} ${-STACK_FIT / 2} ${STACK_FIT} ${STACK_FIT}`;
const PLATE_Y = [0.27, 0.09, -0.09, -0.27] as const;
const DRAWER = { x: 0.08, y: 0.06 } as const;

/** True isometric projection to SVG space (y down), in units of s. */
function iso(x: number, y: number, z: number): readonly [number, number] {
  return [Math.SQRT1_2 * (x + z), -0.816497 * y + 0.408248 * (z - x)];
}

const fmt = (n: number): string => String(+n.toFixed(4));

/** The rounded plate outline in the XZ plane (y = 0), projected. */
const PLATE_PATH = (() => {
  const hx = PLATE.w / 2 - PLATE.r;
  const hz = PLATE.d / 2 - PLATE.r;
  const corners: ReadonlyArray<readonly [number, number, number]> = [
    [hx, hz, 0],
    [-hx, hz, Math.PI / 2],
    [-hx, -hz, Math.PI],
    [hx, -hz, (3 * Math.PI) / 2],
  ];
  const pts: string[] = [];
  for (const [cx, cz, a0] of corners) {
    for (let k = 0; k <= 6; k++) {
      const a = a0 + (k / 6) * (Math.PI / 2);
      const [X, Y] = iso(cx + PLATE.r * Math.cos(a), 0, cz + PLATE.r * Math.sin(a));
      pts.push(`${fmt(X)} ${fmt(Y)}`);
    }
  }
  return `M${pts.join('L')}Z`;
})();

const plateOffset = (y: number): string => {
  const [, Y] = iso(0, y, 0);
  return `translate(0 ${fmt(Y)})`;
};

const [DRAWER_X, DRAWER_Y] = iso(DRAWER.x, DRAWER.y, 0);
const DRAWER_TRANSFORM = `translate(${fmt(DRAWER_X)}px, ${fmt(DRAWER_Y)}px)`;

function StackOutline({ active, className = '' }: { active: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={STACK_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      className={`pointer-events-none absolute top-(--anchor-stack-y) left-(--anchor-stack-x) h-(--anchor-stack-h) w-(--anchor-stack-w) overflow-visible field-s8:hidden ${className}`}
    >
      {/* Bottom plate first, so upper plates occlude the ones beneath. */}
      {PLATE_Y.map((y, g) => ({ y, g }))
        .reverse()
        .map(({ y, g }) => {
          const on = g === active;
          return (
            <g key={g} transform={plateOffset(y)}>
              <path
                d={PLATE_PATH}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={on ? 1 : 1.5}
                strokeDasharray={on ? undefined : '0 5'}
                style={{ transform: on ? DRAWER_TRANSFORM : 'none' }}
                className={`transition-[transform,stroke,fill] duration-500 ease-out-expo rm:transition-none ${
                  on ? 'fill-[rgb(22_12_10/0.92)] stroke-ember' : 'fill-void/85 stroke-steel/60'
                }`}
              />
            </g>
          );
        })}
    </svg>
  );
}
