import { useEffect, useRef } from 'react';
import { subscribeMotionPref, getMotionPref } from '../motion/motionPref';
import { getLayoutMode } from '../motion/useLayoutMode';
import { acquireField, defaultBootOptions, releaseField, type FieldHandle } from './index';

/** §6 step 2: the field loads by requestIdleCallback, timeout 800 ms. */
const BOOT_IDLE_TIMEOUT_MS = 800;

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

    const boot = () => {
      if (!alive) return;
      acquired = true;
      const opts = defaultBootOptions(getMotionPref(), getLayoutMode());
      void acquireField(canvas, opts).then((h) => {
        if (!alive) return;
        handle = h;
        // The preference may have flipped while booting.
        h.setMode(getMotionPref());
      });
    };

    let idleId = -1;
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (w.requestIdleCallback) idleId = w.requestIdleCallback(boot, { timeout: BOOT_IDLE_TIMEOUT_MS });
    else timer = setTimeout(boot, 1);

    const unsubscribe = subscribeMotionPref((pref) => handle?.setMode(pref));

    return () => {
      alive = false;
      unsubscribe();
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
