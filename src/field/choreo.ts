/**
 * The hero's time-based moments, engine side (SPEC §6 intro "the defocus",
 * §5 C0 lock, §9.5 print, §10 steps 1 and 3).
 *
 * State it owns: `store.fx.printed`, `store.fx.scanX` (su), `store.flags.intro`,
 * `store.film.override` while the intro runs, the h1's `--scan` custom
 * property, `html[data-intro="running"]`, and the canvas opacity during the
 * intro fade-in.
 *
 * Invariant while the field is live in full motion: the DOM <h1> is visible
 * (--scan 100% / unset) only while the name is printed (the hero lock is on)
 * or before the field has taken over; otherwise it is masked (--scan 0%) and
 * the particles are the name. Under reduced motion, or whenever the field is
 * not drawing, --scan is unset (the name is always visible).
 */
import { EASE, DUR, gsap } from '../motion/gsap.ts';
import { store, type FilmOverride } from '../scroll/store.ts';
import { StateId } from './states/ids.ts';
import { SCAN_OFF } from './uniforms.ts';

export interface ChoreoHost {
  readonly canvas: HTMLCanvasElement;
  /** The hero <h1>, or null on other routes. */
  h1(): HTMLElement | null;
  /** The printed name's left / right edge in world su now (the h1 box), or null. */
  nameSpan(out: [number, number]): [number, number] | null;
  /** A one-shot is running: keep the loop at full rate. */
  wake(): void;
  /** The director is mid jump cut (one-shots are skipped). */
  cutting(): boolean;
}

/** §6 intro durations (s); repeat visits in a session run at ×.5. */
export const INTRO = { fadeIn: 0.3, unprint: 0.6, defocus: 1.4, lateFadeIn: 0.6, repeatScale: 0.5 } as const;
/** §9.5 print: beam 900 ms cine, then 500 ms relax to the halo; unprint 120 ms. */
export const PRINT = { beam: DUR.scan, relax: 0.5, unprint: 0.12 } as const;
const INTRO_KEY = 'dtw:intro';
/** The intro clock advances at most this much per tick (ms). */
const INTRO_MAX_STEP_MS = 50;

type Timeline = ReturnType<typeof gsap.timeline>;

function readIntroSeen(): boolean {
  try {
    return sessionStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return false;
  }
}

function writeIntroSeen(): void {
  try {
    sessionStorage.setItem(INTRO_KEY, '1');
  } catch {
    /* storage blocked: every visit runs at full length */
  }
}

export class Choreo {
  private readonly host: ChoreoHost;
  /** Print progress q = --scan / 100 (1 = unset, fully visible). */
  private readonly st = { q: 1 };
  private applied: HTMLElement | null = null;
  private appliedQ = 1;
  private printTl: Timeline | null = null;
  private introTl: Timeline | null = null;
  private introOverride: FilmOverride | null = null;
  private introResolve: (() => void) | null = null;
  private introPromise: Promise<void> | null = null;
  private unlisten: (() => void) | null = null;
  private reduced = false;
  private live = false;
  private readonly span: [number, number] = [0, 0];

  constructor(host: ChoreoHost) {
    this.host = host;
  }

  /** The §6 intro is running. */
  get introRunning(): boolean {
    return this.introTl !== null;
  }

  /** A time-based one-shot (intro or print) is animating. */
  get busy(): boolean {
    return this.introTl !== null || (this.printTl?.isActive() ?? false);
  }

  // -------------------------------------------------------------------------
  // The intro (§6 steps 2–6).

  /**
   * Steps 2–4: fade the canvas in over S1 printed (seamless under the DOM
   * h1), unprint right → left (600 ms), then defocus F 1 → 0 (1,400 ms cine)
   * through a snap override. Any wheel / touch / key / pointerdown skips it.
   * Resolves when it ends or is skipped. Full motion only.
   */
  runIntro(): Promise<void> {
    if (this.introPromise) return this.introPromise;
    if (this.reduced) return Promise.resolve();
    const k = readIntroSeen() ? INTRO.repeatScale : 1;
    this.killPrint();
    this.live = true;
    const ov: FilmOverride = { a: StateId.STATIC, b: StateId.NAME, m: 1, snap: true };
    this.introOverride = ov;
    store.film.override = ov;
    store.flags.intro = true;
    store.fx.printed = 1;
    store.fx.scanX = SCAN_OFF;
    this.st.q = 1;
    this.apply();
    document.documentElement.setAttribute('data-intro', 'running');
    this.listenForSkip();

    this.introPromise = new Promise<void>((resolve) => {
      this.introResolve = resolve;
    });
    const st = this.st;
    const tUnprint = INTRO.fadeIn * k;
    const tDefocus = tUnprint + INTRO.unprint * k;
    // Driven by its own clamped clock (≤ 50 ms per tick), not gsap's global
    // one (lagSmoothing is off for Lenis): a long frame — a shader compile,
    // a busy main thread — slows the title card down instead of skipping it.
    // The stepper is PRIORITIZED (first in the tick, like the time-based
    // tweens of CONTRACTS.md step 3), so the engine's renderFrame draws the
    // beam, `printed` and the override of this tick, in the same paint as
    // the --scan written here.
    this.introTl = gsap
      .timeline({ paused: true, onComplete: () => this.endIntro(false) })
      .to(this.host.canvas, { opacity: 1, duration: INTRO.fadeIn * k, ease: 'none' }, 0)
      .to(
        st,
        {
          q: 0,
          duration: INTRO.unprint * k,
          ease: EASE.cine,
          onUpdate: () => {
            this.apply();
            this.beamAt(st.q);
            store.fx.printed = st.q;
          },
          onComplete: () => {
            store.fx.scanX = SCAN_OFF;
            store.fx.printed = 0;
          },
        },
        tUnprint,
      )
      .to(ov, { m: 0, duration: INTRO.defocus * k, ease: EASE.cine }, tDefocus);
    gsap.ticker.add(this.stepIntro, false, true);
    return this.introPromise;
  }

  /** §6 step 5: end the override now; the damp glides to the scroll target and print follows the lock. */
  skipIntro(): void {
    if (this.introTl) this.endIntro(true);
  }

  private readonly stepIntro = (_time: number, deltaMs: number): void => {
    const tl = this.introTl;
    if (!tl) return;
    tl.time(tl.time() + Math.min(deltaMs, INTRO_MAX_STEP_MS) / 1000);
  };

  private endIntro(skipped: boolean): void {
    gsap.ticker.remove(this.stepIntro);
    this.introTl?.kill();
    this.introTl = null;
    if (store.film.override === this.introOverride) store.film.override = null;
    this.introOverride = null;
    store.flags.intro = false;
    store.fx.scanX = SCAN_OFF;
    this.unlisten?.();
    this.unlisten = null;
    document.documentElement.removeAttribute('data-intro');
    writeIntroSeen();
    if (skipped) {
      gsap.to(this.host.canvas, { opacity: 1, duration: 0.2, ease: 'none', overwrite: true });
      this.syncToLock(PRINT.unprint);
    }
    const done = this.introResolve;
    this.introResolve = null;
    this.introPromise = null;
    done?.();
  }

  private listenForSkip(): void {
    const skip = () => this.skipIntro();
    const opts = { capture: true, passive: true } as const;
    const types = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
    for (const t of types) window.addEventListener(t, skip, opts);
    this.unlisten = () => {
      for (const t of types) window.removeEventListener(t, skip, opts);
    };
  }

  // -------------------------------------------------------------------------
  // The lock print (§9.5).

  /** React to the director's lock edge (+1 print, −1 unprint). */
  onLockEdge(edge: -1 | 1): void {
    if (this.reduced || !this.live || this.introTl) return;
    if (edge > 0) this.printOn(!store.flags.rewinding && !this.host.cutting());
    else this.printOff();
  }

  /**
   * Print: the ember beam sweeps the name left → right (900 ms cine) and
   * --scan follows it, so the crisp DOM type prints underneath; then the
   * particles relax into a .45-α halo (uPrinted 0 → 1, 500 ms). Without the
   * beam (rewind, cut, or the name is already visible) it only relaxes.
   */
  printOn(beam = true): void {
    if (this.reduced) return;
    this.killPrint();
    const st = this.st;
    const tl = gsap.timeline();
    if (!beam || st.q >= 0.999) {
      tl.to(st, { q: 1, duration: beam ? 0 : 0.2, ease: 'none', onUpdate: () => this.apply() });
    } else {
      tl.to(st, {
        q: 1,
        duration: PRINT.beam * (1 - st.q),
        ease: EASE.cine,
        onUpdate: () => {
          this.apply();
          this.beamAt(st.q);
        },
        onComplete: () => {
          store.fx.scanX = SCAN_OFF;
        },
      });
    }
    tl.to(store.fx, { printed: 1, duration: PRINT.relax, ease: EASE.ui });
    this.printTl = tl;
    this.host.wake();
  }

  /** Unprint (§5 C0 exit): --scan and uPrinted to 0 in 120 ms: the DOM hands its glyphs back. */
  printOff(duration: number = PRINT.unprint): void {
    if (this.reduced) return;
    this.killPrint();
    store.fx.scanX = SCAN_OFF;
    this.printTl = gsap
      .timeline()
      .to(this.st, { q: 0, duration, ease: 'none', onUpdate: () => this.apply() }, 0)
      .to(store.fx, { printed: 0, duration, ease: 'none' }, 0);
    this.host.wake();
  }

  /** Put the print state where the lock says (field just became visible, skip, mode switch). */
  syncToLock(duration: number): void {
    if (this.reduced) return;
    this.live = true;
    if (store.flags.printedLock) {
      this.killPrint();
      this.printTl = gsap
        .timeline()
        .to(this.st, { q: 1, duration, ease: 'none', onUpdate: () => this.apply() }, 0)
        .to(store.fx, { printed: 1, duration, ease: 'none' }, 0);
    } else {
      this.printOff(duration);
    }
  }

  // -------------------------------------------------------------------------
  // Modes and DOM.

  /** The field is drawing (ready): print state may now follow the lock. */
  attach(): void {
    this.live = true;
  }

  setMode(mode: 'full' | 'reduced'): void {
    const reduced = mode === 'reduced';
    if (reduced === this.reduced) return;
    this.reduced = reduced;
    if (reduced) {
      if (this.introTl) this.endIntro(false);
      this.killPrint();
      this.st.q = 1;
      this.apply();
      store.fx.printed = 1;
      store.fx.scanX = SCAN_OFF;
    } else if (this.live) {
      this.syncToLock(0.3);
    }
  }

  /** Re-apply --scan (a new hero h1 mounted, e.g. back from a detail page). */
  refreshDom(): void {
    this.apply(true);
  }

  /** The field stopped drawing (dispose, context loss): the DOM name must be visible. */
  release(): void {
    if (this.introTl) this.endIntro(false);
    this.killPrint();
    this.live = false;
    this.st.q = 1;
    this.apply(true);
    store.fx.printed = 0;
    store.fx.scanX = SCAN_OFF;
  }

  /** Field visible again after a context restore. */
  resume(): void {
    this.live = true;
    if (!this.reduced) this.syncToLock(0.4);
  }

  private killPrint(): void {
    this.printTl?.kill();
    this.printTl = null;
  }

  private beamAt(q: number): void {
    const s = this.host.nameSpan(this.span);
    store.fx.scanX = s ? s[0] + (s[1] - s[0]) * q : SCAN_OFF;
    this.host.wake();
  }

  /**
   * Write --scan to the hero h1 (unset at q = 1, i.e. the no-JS default).
   * The mask fades over +2% past --scan, so q = 0 maps to −2%: fully hidden.
   */
  private apply(force = false): void {
    const el = this.host.h1();
    const q = Math.min(1, Math.max(0, this.st.q));
    const end = q === 0 || q === 1;
    if (!force && el === this.applied && (end ? q === this.appliedQ : Math.abs(q - this.appliedQ) < 5e-4)) return;
    if (this.applied && this.applied !== el) this.applied.style.removeProperty('--scan');
    this.applied = el;
    this.appliedQ = q;
    if (!el) return;
    if (q >= 0.9995) el.style.removeProperty('--scan');
    else el.style.setProperty('--scan', `${(q * 102 - 2).toFixed(2)}%`);
  }
}
