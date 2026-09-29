import { useEffect, useRef } from 'react';
import { sampleNow, subscribeScroll } from '../motion/lenis';
import { subscribeMotionPref, getMotionPref } from '../motion/motionPref';
import { getLayoutMode } from '../motion/useLayoutMode';
import { store } from '../scroll/store';
import { acquireField, clearIntroPending, defaultBootOptions, releaseField, type FieldHandle } from './index';

/** §6 step 2: the field loads by requestIdleCallback, timeout 800 ms. */
const BOOT_IDLE_TIMEOUT_MS = 800;
/** Windows High Contrast & co.: the system palette owns every colour, so there is no field. */
const FORCED_COLORS = '(forced-colors: active)';

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/**
 * The persistent field host (SPEC §3.1, §9.1, §9.10): `#field-root` with one
 * aria-hidden <canvas>, fixed at 100% × 100lvh behind everything. Render it
 * once in the App shell, outside <Routes>, in place of the phase 1
 * `<div id="field-root" className="field-root" />` placeholder.
 *
 * - Same markup on the server and the client (hydration-safe); the canvas
 *   starts transparent (opacity 0), so the CSS glow shows until the engine
 *   has rendered its first frame and fades it in.
 * - Mount: after first paint, in an idle callback (≤ 800 ms), acquireField()
 *   — feature detection, then the dynamic import of the three chunk.
 *   Unmount: releaseField(). Both are ref-counted and StrictMode-safe
 *   (§9.10): the double effect never creates a second WebGL context.
 * - Forwards the motion preference to `handle.setMode` (§8.2 step 5).
 * - Every scroll write invalidates the field (§9.5: under reduced motion
 *   there is no loop, frames render on demand).
 * - No WebGL2 (or only software GL), a feeble device, a failed engine
 *   chunk: the Canvas2D fallback (kind 'canvas2d', field/fallback2d.ts)
 *   draws on this same canvas — or on an overlay it adds inside #field-root
 *   when the host already holds a WebGL context — and sets
 *   html[data-field="fallback"] and `store.mode` ('fallback' | 'reduced').
 *   A lost WebGL context is covered the same way by the engine (§8.4).
 * - No renderer at all (kind 'none': Canvas2D failed too): `store.mode =
 *   'css'`; the canvas stays transparent over the CSS glow.
 * - Forced colors (`forced-colors: active`): no field at all, like the CSS
 *   path — it never boots, and one that is running is released when the
 *   mode turns on (booted again when it turns off). index.css hides the
 *   canvas, atmosphere and scrims and unmasks the <h1> there.
 * - Whenever no intro can follow (no renderer, forced colors), the
 *   pre-paint guess `html[data-intro="pending"]` is dropped.
 */
export default function FieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = window as IdleWindow;
    let acquired = false;
    let alive = true;
    let handle: FieldHandle | null = null;
    let forced: MediaQueryList | null = null;
    try {
      forced = window.matchMedia(FORCED_COLORS);
    } catch {
      forced = null;
    }

    const boot = () => {
      if (!alive || acquired) return;
      if (forced?.matches) {
        clearIntroPending();
        store.mode = 'css';
        return;
      }
      acquired = true;
      const opts = defaultBootOptions(getMotionPref(), getLayoutMode());
      void acquireField(canvas, opts).then((h) => {
        if (!alive || !acquired) return;
        handle = h;
        if (h.kind === 'none') {
          clearIntroPending();
          store.mode = 'css';
          return;
        }
        // The preference may have flipped while booting.
        h.setMode(getMotionPref());
        // HUD / rail read the first real frame (under reduced motion nothing
        // else samples at rest).
        h.onReady(() => requestAnimationFrame(() => alive && sampleNow()));
      });
    };

    let idleId = -1;
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (w.requestIdleCallback) idleId = w.requestIdleCallback(boot, { timeout: BOOT_IDLE_TIMEOUT_MS });
    else timer = setTimeout(boot, 1);

    const unsubscribe = subscribeMotionPref((pref) => handle?.setMode(pref));
    const unscroll = subscribeScroll(() => handle?.invalidate());

    const onForced = () => {
      if (forced?.matches) {
        clearIntroPending();
        store.mode = 'css';
        if (!acquired) return;
        acquired = false;
        handle = null;
        releaseField();
      } else if (!acquired) {
        store.mode = getMotionPref();
        boot();
      }
    };
    forced?.addEventListener('change', onForced);

    return () => {
      alive = false;
      forced?.removeEventListener('change', onForced);
      unsubscribe();
      unscroll();
      if (idleId >= 0) w.cancelIdleCallback?.(idleId);
      if (timer !== null) clearTimeout(timer);
      if (acquired) releaseField();
    };
  }, []);

  return (
    <div id="field-root" aria-hidden="true" className="field-root">
      <canvas ref={canvasRef} className="block h-full w-full" style={{ opacity: 0 }} />
    </div>
  );
}
