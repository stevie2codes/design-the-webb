/**
 * C5 Contact — choreography (SPEC §5 C5, §3.10 S9, §1 "Credits").
 * Built from Contact's `reveal(ctx)` callback; reads the hooks Contact
 * renders ([data-cta-sink] > [data-cta-disc] > a[data-beacon-cta]).
 *
 * Full motion:
 * - Section top 60% → 15%: the h2 and the headline line-mask in (the h2 with
 *   a one-line clip mask, never SplitText: CONTRACTS.md; the headline via
 *   its `data-reveal="lines"`).
 * - Section top 20% → 0%: the beacon CTA disc scales .6 → 1 and fades in
 *   (scrubbed; the entrance is the only time it moves, §7.4).
 * - Section top 30% → 0%: the email row, the body and the portrait fade up
 *   (their `data-reveal` attributes).
 * - F ≥ 8.98 (the displayed film has nearly converged on S9): IGNITION,
 *   time-based, once — exposure 1 → 1.35 → 1 over 600 ms. It re-arms below
 *   F 8.9 and is skipped while rewinding or in the intro (§4.4); after a nav
 *   jump cut it fires at the snap, as the field fades back in.
 * - The sink (contact + 40 → + 80vh desktop; + 30svh → the document end on
 *   mobile; segments.ts SEGMENTS[layout].sink): store.fx.sink follows scroll
 *   0 → 1 (anchors.ts BEACON_SINK: the beacon rides its stage, then sets
 *   behind the text to the footer horizon, ×.45); the CTA disc fades out
 *   over sink 0 → .15 — on the SAME progress as the beacon, which starts to
 *   travel only at .3, so the label never floats off the core — and takes
 *   no pointer after that (the email text stays the accessible path); the
 *   footer horizon warms as the beacon sets (choreo/horizon.ts).
 *
 * Both modes: hover / keyboard focus on the CTA → uCharge 1 (damped 400 ms);
 * a click fires the nova (full motion) alongside the mailto, never delaying
 * it. Reduced motion: no scrubs, no ignition, no nova, no sink — the disc
 * and everything else are simply there.
 */
import { prime } from '../../motion/prime';
import { SEGMENTS, type SegEdge } from '../../scroll/segments';
import { CONTACT_HEAD, svhPx } from '../../scroll/anchors';
import { headingId } from '../../scroll/chapters';
import { store } from '../../scroll/store';
import type { ChapterContext } from '../../scroll/useChapter';
import { watchFilm } from './film';
import { fireIgnition, setCharge } from './fx';
import { setSunset } from './horizon';
import { asReveal, maskOneLine, scrubVars } from './reveal';

/** Ignition threshold on the displayed film, and its re-arm point. */
export const CONTACT_IGNITE = { on: 8.98, off: 8.9 } as const;
/**
 * The disc fades out over sink 0 → .15 (§5 C5 "over the first 10vh"; tuned
 * to the sink's own progress, ≈ 6vh on desktop): it is gone before the
 * beacon leaves its stage (anchors.ts BEACON_SINK.travel starts at .3).
 */
const DISC_FADE = 0.15;
/** Disc scale-in window (§5 C5: section top 20% → 0%) and its start scale. */
const DISC_WINDOW = [20, 0] as const;
const DISC_FROM_SCALE = 0.6;
/** h2 mask window (§5 C5: section top 60% → 15%). */
const HEAD_WINDOW = [60, 15] as const;

export const CTA_CHARGE_OWNER = 'contact';

const docTop = (el: Element): number => el.getBoundingClientRect().top + window.scrollY;

/** Build Contact's choreography; returns its cleanup. */
export function contactChoreo(ctx: ChapterContext): () => void {
  const { section, gsap, ScrollTrigger, reduced } = ctx;
  if (reduced) return () => {};
  const cleanups: (() => void)[] = [];

  // ── Reveals ───────────────────────────────────────────────────────────────
  const h2 = section.querySelector<HTMLElement>(`#${headingId('contact')}`);
  if (h2) ctx.track(maskOneLine(gsap, h2, ctx.window(h2, HEAD_WINDOW[0], HEAD_WINDOW[1])));

  const disc = section.querySelector<HTMLElement>('[data-cta-disc]');
  if (disc) {
    const tween = prime(
      gsap.fromTo(
        disc,
        { scale: DISC_FROM_SCALE, opacity: 0 },
        { scale: 1, opacity: 1, ease: 'none', scrollTrigger: scrubVars(ctx.window(disc, DISC_WINDOW[0], DISC_WINDOW[1])) },
      ),
    );
    ctx.track(asReveal(tween, () => gsap.set(disc, { clearProps: 'opacity,transform,scale' })));
  }

  // Mobile: the header's scrim fades in with its line masks (CONTACT_HEAD,
  // the same window as its text-safe mask weight in anchors.ts), so no empty
  // dark box stands in the spiral before the text arrives.
  const head = ctx.layout === 'mobile' ? section.querySelector<HTMLElement>('[data-safe]') : null;
  if (head) {
    const win = ctx.window(head, CONTACT_HEAD.from * 100, CONTACT_HEAD.to * 100);
    const tween = prime(
      gsap.fromTo(head, { '--scrim': 0 }, { '--scrim': 1, ease: 'none', scrollTrigger: scrubVars(win) }),
    );
    ctx.track(asReveal(tween, () => head.style.removeProperty('--scrim')));
  }

  // ── Ignition (F ≥ 8.98, once per arrival) ────────────────────────────────
  let armed = true;
  cleanups.push(
    watchFilm(gsap, (F) => {
      if (armed && F >= CONTACT_IGNITE.on) {
        armed = false;
        // A nav jump cut reaches F ≥ 8.98 only at its snap, as the field
        // fades back in: igniting then reads as the beacon lighting on arrival.
        if (!store.flags.rewinding && !store.flags.intro) fireIgnition(gsap);
      } else if (!armed && F < CONTACT_IGNITE.off) {
        armed = true;
      }
    }),
  );

  // ── The sink ─────────────────────────────────────────────────────────────
  const sinkBox = section.querySelector<HTMLElement>('[data-cta-sink]');
  const cta = section.querySelector<HTMLElement>('[data-beacon-cta]');
  const table = SEGMENTS[ctx.layout].sink;
  const unit = (): number => (store.scroll.H || svhPx()) / 100;
  const smooth = (x: number): number => {
    const t = Math.min(1, Math.max(0, x));
    return t * t * (3 - 2 * t);
  };
  const edge = (e: SegEdge): number => {
    switch (e.at) {
      case 'chapter':
        return (e.ch === 'contact' ? docTop(section) : (store.chapters[e.ch]?.top ?? docTop(section))) + e.off * unit();
      case 'end':
        return ScrollTrigger.maxScroll(window) + e.off * unit();
      default:
        return docTop(section);
    }
  };
  let discShown = 1;
  let sunk = false;
  const writeSink = (p: number): void => {
    store.fx.sink = p;
    setSunset(p);
    const q = Math.round((1 - smooth(p / DISC_FADE)) * 1000) / 1000;
    if (sinkBox && q !== discShown) {
      discShown = q;
      sinkBox.style.opacity = q >= 1 ? '' : String(q);
    }
    const nowSunk = q <= 0.001;
    if (nowSunk !== sunk) {
      sunk = nowSunk;
      if (cta) cta.style.pointerEvents = sunk ? 'none' : '';
      if (sunk) setCharge(CTA_CHARGE_OWNER, false);
    }
  };
  ScrollTrigger.create({
    trigger: section,
    start: () => edge(table.y0),
    end: () => Math.max(edge(table.y1), edge(table.y0) + 1),
    onUpdate: (self) => writeSink(self.progress),
    onRefresh: (self) => writeSink(self.progress),
  });
  cleanups.push(() => {
    store.fx.sink = 0;
    setSunset(0);
    if (sinkBox) sinkBox.style.opacity = '';
    if (cta) cta.style.pointerEvents = '';
  });

  return () => {
    for (const fn of cleanups) fn();
  };
}
