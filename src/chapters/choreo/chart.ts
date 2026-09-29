/**
 * C1 About — the career chart's choreography (SPEC §5 C1, §10 step 4,
 * §3.10 S2 focus groups). Built from About's `reveal(ctx)` callback; reads
 * the hooks CareerChart renders ([data-chart-plot], [data-axis],
 * [data-tick], [data-tick-label], [data-axis-title], [data-legend],
 * [data-numeral], [data-leader], [data-stat]).
 *
 * Full motion:
 * - About top 40% → 0%: the y-axis draws up from the baseline and the
 *   baseline draws left → right (stroke-dashoffset on pathLength 1),
 *   scrubbed. At the end of that window the tick marks and labels (then
 *   "Years" and the legend) fade in, time-based, 30 ms apart; scrolling back
 *   above it reverses them.
 * - The numerals count IN LOCKSTEP with the field: bar k shows
 *   value × smoothstep(.55 + .1k, .95 + .05k, m), where m is the director's
 *   DISPLAYED uMix of seg1 (m = F − 1 clamped), and snap to "2", "4+", "6+"
 *   at m ≥ .995. They are aria-hidden (the hidden table holds the finals).
 *   The S2 generator lands each grain with the exact inverse of this curve
 *   (states/s02-chart.ts `numeralWindow`), so numbers and grains agree —
 *   and so the counted fraction IS the bar's filled height: each numeral
 *   rides its bar's grain front (`--fill`, a CSS translate by the unfilled
 *   height; no layout read) and fades in over the first .05 of its window,
 *   so no "0" hangs over an empty column and no count floats over the
 *   falling stream. It rests at its final place from the snap on (§7.4).
 *   While counting, the decimal is set small (".4" at .42em beside the
 *   whole number): full-size "1.4" is wider than a bar pitch, and
 *   neighbouring counts at similar heights would run into each other.
 * - seg2 (the topple): each numeral fades as its bar tips over, the AI "1"
 *   and the leader with the AI point (TOPPLE below).
 * - F ≥ 1.98 (seg1 m ≥ .98): the AI point ignites, once and time-based
 *   (500 ms): its field group g4 goes from dim (uGroupW 0, α ×.35 while the
 *   grains pour) to lit (the director damps groupW over 500 ms), the ember
 *   leader draws down (scaleY) and the "1" and its stat block fade in.
 *   Below F 1.9 it re-arms (scroll back up and every step reverses).
 *   Rewinds and jump cuts skip the animation and just set the end state.
 * - These run only while the live field draws S2. Otherwise (no WebGL, the
 *   fallback bars, S2 not generated yet) the numerals show their finals and
 *   the AI point, leader and label are simply there.
 *
 * Hover (both motion modes; the stat blocks are aria-hidden and not
 * focusable, §5 C1 — keyboard and screen-reader users read the table):
 * pointing at a stat lights its S2 focus groups (Developer g0 + g2, Product
 * design g1 + g3, In tech g2 + g3, AI platform g4); the others dim (uGroupW
 * 0), damped over 500 ms. A tap toggles it on touch. The claim holds only
 * while the field shows the chart (F ∈ [1.5, 2.6], or the S2 poster under
 * reduced motion), so it can never dim another chapter's shape.
 *
 * Reduced motion: no scrubs, no count, no ignition — finals and the lit AI
 * point from the first paint; hover still sets the focus groups (the engine
 * renders them on demand).
 */
import { CHART } from '../../field/layout';
import { StateId } from '../../field/states/ids';
import { subscribeScroll } from '../../motion/lenis';
import { prime } from '../../motion/prime';
import { stats, type Stat, type StatKey } from '../../content/site';
import { store } from '../../scroll/store';
import type { ChapterContext } from '../../scroll/useChapter';
import { fieldDraws, onFieldStates, posterF, watchFilm } from './film';
import { claimFocus, releaseFocus } from './fx';
import { asReveal, scrubVars } from './reveal';

/** §5 C1 numeral window of bar k (the same curve as states/s02-chart.ts `numeralWindow`). */
export function numeralWindow(k: number): readonly [number, number] {
  return [0.55 + 0.1 * k, 0.95 + 0.05 * k];
}

/** The numerals snap to their final strings at displayed m ≥ .995 (§5 C1). */
export const NUMERAL_SNAP = 0.995;
/** The AI point ignites at seg1 m ≥ .98 (F ≥ 1.98) and re-arms below F 1.9. */
export const IGNITE = { on: 1.98, off: 1.9, dur: 0.5 } as const;
/**
 * seg2, the TOPPLE (tuning, CONTRACTS.md): each numeral fades as its bar
 * tips over, on the same clock as the grains — bar k's per-particle progress
 * is tl = (m − key·S) / (1 − S) with the S3 keys (states/s03-redacted.ts KEY:
 * bars 0, .45, .9; the AI point's sparks land in the lock row, ≈ .15) and
 * S3's stagger S = .45 — so no number floats over an empty bar. It fades over
 * tl 0 → .3 (the bar has leaned ≈ 30°). CSS `filter: opacity()`, which
 * composes with the ignition's `opacity` tween instead of fighting it.
 */
const TOPPLE = { keys: [0, 0.45, 0.9], ai: 0.15, stagger: 0.45, fade: 0.3 } as const;

/** Film range in which a stat hover may light S2 focus groups. */
const HOVER_GATE = [1.5, 2.6] as const;
/** Axis draw / tick window (§5 C1: About top 40% → 0%). */
const AXIS_WINDOW = [40, 0] as const;
/** Tick labels arrive 30 ms apart (§5 C1). */
const TICK_STAGGER = 0.03;

const OWNER = 'about';
/** Every S2 stat group (g0–g4); structure (g7) never dims. */
const STAT_GROUPS = [0, 1, 2, 3, 4] as const;
const AI_GROUP = 4;

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** The count-up string of a bar numeral at displayed mix m (finals at the snap). */
export function numeralText(stat: Stat, k: number, m: number): string {
  if (m >= NUMERAL_SNAP) return stat.value;
  const [a, b] = numeralWindow(k);
  const v = stat.count * smoothstep(a, b, m);
  return v < 0.05 ? '0' : v.toFixed(1);
}

const STAT_BY_KEY = new Map<StatKey, Stat>(stats.map((s) => [s.key, s]));

interface Numeral {
  readonly stat: Stat;
  /** Bar index k (numeral window), or −1 for the AI count. */
  readonly k: number;
  readonly el: HTMLElement;
  readonly text: Text | null;
  /** The small decimal (".4") while counting; created by the choreography, removed with it. */
  frac: HTMLSpanElement | null;
  shown: string;
  /** Last written fill (−1: cleared) and opacity (quantised). */
  fill: number;
  alpha: number;
}

/** A bar numeral fades in over the first .05 of its window (m). */
const NUMERAL_FADE_IN = 0.05;
/** The counting decimal's size and spacing (a literal class string, so Tailwind sees it). */
const FRAC_CLASS = 'ml-[0.04em] text-[0.42em] tracking-normal';

/** Build the chart choreography; returns its cleanup. */
export function chartChoreo(ctx: ChapterContext): () => void {
  const { section, gsap, reduced } = ctx;
  const plot = section.querySelector<HTMLElement>('[data-chart-plot]');
  if (!plot) return () => {};
  const leader = plot.querySelector<HTMLElement>('[data-leader]');
  const aiNumeral = plot.querySelector<HTMLElement>('[data-numeral="ai"]');
  const aiStat = section.querySelector<HTMLElement>('[data-stat="ai"]');
  const aiParts = [aiNumeral, aiStat].filter((el): el is HTMLElement => el !== null);
  const cleanups: (() => void)[] = [];

  // ── Axis draw + ticks (full motion, scrubbed / time-based) ────────────────
  if (!reduced) {
    const axisY = plot.querySelector<SVGElement>('[data-axis="y"]');
    const axisX = plot.querySelector<SVGElement>('[data-axis="x"]');
    const w = ctx.window(plot, AXIS_WINDOW[0], AXIS_WINDOW[1]);
    const draw = gsap.timeline({ scrollTrigger: scrubVars(w) });
    // pathLength 1: dash 1, gap 1. Offset −1 → 0 draws from the path's END
    // (the y-axis runs top → bottom, so it grows up from the baseline);
    // 1 → 0 draws from its start (the baseline grows left → right).
    // autoRound off: gsap rounds px values to whole pixels by default, and
    // these are fractions of the path length.
    // (A fresh vars object per tween: fromTo writes `startAt` into its vars.)
    const dash = () => ({ ease: 'none', duration: 1, strokeDashoffset: 0, autoRound: false });
    if (axisY) draw.fromTo(axisY, { strokeDasharray: '1 1', strokeDashoffset: -1 }, dash(), 0);
    if (axisX) draw.fromTo(axisX, { strokeDasharray: '1 1', strokeDashoffset: 1 }, dash(), 0);
    prime(draw);
    const axes = [axisY, axisX].filter((el): el is SVGElement => el !== null);
    ctx.track(asReveal(draw, () => axes.length && gsap.set(axes, { clearProps: 'strokeDasharray,strokeDashoffset' })));

    // Tick marks + labels bottom → top, then the axis title and the legend.
    const seq: Element[][] = CHART.ticks.map((t) =>
      Array.from(plot.querySelectorAll(`[data-tick="${t}"], [data-tick-label="${t}"]`)),
    );
    const title = plot.querySelector('[data-axis-title]');
    const legend = plot.querySelector('[data-legend]');
    if (title) seq.push([title]);
    if (legend) seq.push([legend]);
    const ticks = gsap.timeline({
      scrollTrigger: { trigger: w.trigger, start: w.end ?? w.start, toggleActions: 'play none none reverse' },
    });
    seq.forEach((els, i) => {
      if (els.length) ticks.fromTo(els, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'ui' }, i * TICK_STAGGER);
    });
    prime(ticks);
    const tickEls = seq.flat();
    ctx.track(asReveal(ticks, () => tickEls.length && gsap.set(tickEls, { clearProps: 'opacity' })));
  }

  // ── Numerals, ignition, focus ─────────────────────────────────────────────
  const numerals: Numeral[] = [];
  const numeralEls = new Map<Numeral, HTMLElement>();
  for (const el of plot.querySelectorAll<HTMLElement>('[data-numeral]')) {
    const stat = STAT_BY_KEY.get(el.dataset.numeral as StatKey);
    if (!stat) continue;
    const k = CHART.bars.findIndex((b) => b.stat === stat.key);
    const text = el.firstChild instanceof Text ? el.firstChild : null;
    const n: Numeral = { stat, k, el, text, frac: null, shown: stat.value, fill: -1, alpha: -1 };
    numerals.push(n);
    numeralEls.set(n, el);
  }
  // Topple fades (seg2): numeral k, and the AI numeral + leader together.
  let fades: number[] = [];
  const writeFade = (el: HTMLElement | null, i: number, v: number): void => {
    const q = Math.round(v * 100) / 100;
    if (!el || fades[i] === q) return;
    fades[i] = q;
    el.style.filter = q >= 1 ? '' : `opacity(${q})`;
  };
  const toppleFades = (f: number): void => {
    const m = Math.min(1, Math.max(0, f - 2));
    const at = (key: number): number =>
      1 - smoothstep(0, TOPPLE.fade, (m - key * TOPPLE.stagger) / (1 - TOPPLE.stagger));
    let i = 0;
    for (const n of numerals) writeFade(numeralEls.get(n) ?? null, i++, at(n.k >= 0 ? TOPPLE.keys[n.k] : TOPPLE.ai));
    writeFade(leader, i, at(TOPPLE.ai));
  };
  const clearFades = (): void => {
    for (const el of numeralEls.values()) el.style.filter = '';
    if (leader) leader.style.filter = '';
    fades = [];
  };

  const writeNumeral = (n: Numeral, s: string): void => {
    if (n.shown === s || !n.text) return;
    n.shown = s;
    const dot = s.indexOf('.');
    n.text.nodeValue = dot < 0 ? s : s.slice(0, dot);
    const frac = dot < 0 ? '' : s.slice(dot);
    if (frac && !n.frac) {
      n.frac = document.createElement('span');
      n.frac.className = FRAC_CLASS;
      n.el.appendChild(n.frac);
    }
    if (n.frac && n.frac.textContent !== frac) n.frac.textContent = frac;
  };
  const dropFracs = (): void => {
    for (const n of numerals) {
      n.frac?.remove();
      n.frac = null;
    }
  };
  /** Bar numeral k at displayed mix m: its grain front (fill) and its fade-in. */
  const placeNumeral = (n: Numeral, m: number): void => {
    const [a, b] = numeralWindow(n.k);
    const snapped = m >= NUMERAL_SNAP;
    const fill = snapped ? 1 : Math.round(smoothstep(a, b, m) * 1000) / 1000;
    const alpha = snapped ? 1 : Math.round(smoothstep(a, a + NUMERAL_FADE_IN, m) * 100) / 100;
    if (fill !== n.fill) {
      n.fill = fill;
      if (fill >= 1) n.el.style.removeProperty('--fill');
      else n.el.style.setProperty('--fill', String(fill));
    }
    if (alpha !== n.alpha) {
      n.alpha = alpha;
      n.el.style.opacity = alpha >= 1 ? '' : String(alpha);
    }
  };
  const unplace = (n: Numeral): void => {
    n.fill = n.alpha = -1;
    n.el.style.removeProperty('--fill');
    n.el.style.removeProperty('opacity');
  };
  const finals = (): void => {
    for (const n of numerals) {
      writeNumeral(n, n.stat.value);
      if (n.k >= 0) unplace(n);
    }
  };

  let counting = false;
  let ignited = true; // the resting (final) picture
  let F = 2;
  let hovered: StatKey | null = null;
  let igniteAnim: { kill(): unknown } | null = null;

  const setIgnited = (on: boolean, animate: boolean): void => {
    ignited = on;
    igniteAnim?.kill();
    igniteAnim = null;
    const parts = { leader, ai: aiParts };
    if (!animate) {
      if (parts.leader) gsap.set(parts.leader, { scaleY: on ? 1 : 0 });
      if (parts.ai.length) gsap.set(parts.ai, { opacity: on ? 1 : 0 });
      return;
    }
    const tl = gsap.timeline({ onComplete: () => (igniteAnim = null) });
    if (on) {
      if (parts.leader) tl.to(parts.leader, { scaleY: 1, duration: IGNITE.dur, ease: 'out-expo' }, 0);
      if (parts.ai.length) tl.to(parts.ai, { opacity: 1, duration: IGNITE.dur, ease: 'ui' }, 0.08);
    } else {
      // Reversing (scroll back up): quick and quiet.
      if (parts.leader) tl.to(parts.leader, { scaleY: 0, duration: 0.2, ease: 'in-expo' }, 0);
      if (parts.ai.length) tl.to(parts.ai, { opacity: 0, duration: 0.2, ease: 'ui' }, 0);
    }
    igniteAnim = tl;
  };

  const clearIgnition = (): void => {
    igniteAnim?.kill();
    igniteAnim = null;
    if (leader) gsap.set(leader, { clearProps: 'transform' });
    if (aiParts.length) gsap.set(aiParts, { clearProps: 'opacity' });
    ignited = true;
  };

  /** Which focus to claim now: a stat hover (gated to the chart), the pre-ignition dim of g4, or none. */
  let claimed = '';
  const updateFocus = (): void => {
    const shown = reduced ? posterF() === StateId.CHART : F >= HOVER_GATE[0] && F <= HOVER_GATE[1];
    const stat = hovered ? STAT_BY_KEY.get(hovered) : undefined;
    const want = stat && shown ? stat.key : counting && !ignited && F >= 1 ? 'dim' : '';
    if (want === claimed) return; // called every tick: only write on a change
    claimed = want;
    if (stat && want === stat.key) claimFocus(OWNER, stat.groups, STAT_GROUPS);
    else if (want === 'dim') claimFocus(OWNER, [], [AI_GROUP]);
    else releaseFocus(OWNER);
  };

  if (!reduced) {
    const onFilm = (f: number, fr: { cutting: boolean }): void => {
      F = f;
      if (counting) {
        const m = Math.min(1, Math.max(0, f - 1));
        for (const n of numerals) {
          if (n.k < 0) continue;
          writeNumeral(n, numeralText(n.stat, n.k, m));
          placeNumeral(n, m);
        }
        if (!ignited && f >= IGNITE.on) {
          setIgnited(true, !store.flags.rewinding && !store.flags.intro && !fr.cutting);
        } else if (ignited && f < IGNITE.off) {
          setIgnited(false, !store.flags.rewinding && !fr.cutting);
        }
        toppleFades(f);
      }
      updateFocus();
    };
    const syncMode = (): void => {
      const next = fieldDraws(StateId.CHART);
      if (next === counting) return;
      counting = next;
      if (counting) {
        // Enter the count at the displayed film: numerals and ignition follow F.
        ignited = F >= IGNITE.on;
        setIgnited(ignited, false);
        onFilm(F, { cutting: false });
      } else {
        finals();
        clearIgnition();
        clearFades();
        updateFocus();
      }
    };
    cleanups.push(onFieldStates(syncMode));
    cleanups.push(watchFilm(gsap, onFilm));
    syncMode();
  } else {
    cleanups.push(subscribeScroll(updateFocus));
  }

  // Stat hover (pointer) and tap (touch toggles).
  const statOf = (t: EventTarget | null): StatKey | null => {
    const el = t instanceof Element ? t.closest<HTMLElement>('[data-stat]') : null;
    return el && section.contains(el) ? (el.dataset.stat as StatKey) : null;
  };
  const onOver = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') return;
    const k = statOf(e.target);
    if (k === hovered) return;
    hovered = k;
    updateFocus();
  };
  const onLeave = (e: PointerEvent): void => {
    if (e.pointerType === 'touch' || hovered === null) return;
    hovered = null;
    updateFocus();
  };
  const onTap = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') return;
    const k = statOf(e.target);
    hovered = k === hovered ? null : k;
    updateFocus();
  };
  const statsRoot = section.querySelector<HTMLElement>('[data-stats]') ?? section;
  statsRoot.addEventListener('pointerover', onOver);
  statsRoot.addEventListener('pointerleave', onLeave);
  section.addEventListener('pointerup', onTap);
  cleanups.push(() => {
    statsRoot.removeEventListener('pointerover', onOver);
    statsRoot.removeEventListener('pointerleave', onLeave);
    section.removeEventListener('pointerup', onTap);
  });

  return () => {
    for (const fn of cleanups) fn();
    finals();
    dropFracs();
    clearIgnition();
    clearFades();
    hovered = null;
    releaseFocus(OWNER);
  };
}
