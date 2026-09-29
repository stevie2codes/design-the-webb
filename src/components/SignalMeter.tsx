import { useEffect, useRef } from 'react';
import { hud } from '../content/site';
import { onSample } from '../motion/lenis';
import { createSignal } from './signal';

/**
 * The hero's S/N meter (hero idea #4): the HUD readout promoted beside the
 * eyebrow — "S/N" in .t-label, the value in .t-readout, and a 1px track
 * whose ember fill is the signal — so the story of the rack focus (noise
 * 0.03 → name 1.00) is told where the eye already is. aria-hidden, like the
 * HUD; `data-hud-local` hands the corner HUD's hero zone to it (Hud.tsx).
 *
 * Value and fill come from createSignal at ≤ 10 Hz (onSample), written
 * through refs (textContent only when the two-decimal text changes; the fill
 * as a scaleX with a short linear transition to bridge the samples).
 * Shown on the desktop full-motion path with JS; under reduced motion, on
 * the mobile layout and on short viewports the corner HUD carries S/N.
 */
export default function SignalMeter({ className = '' }: { className?: string }) {
  const valueRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const valueEl = valueRef.current;
    const fillEl = fillRef.current;
    if (!valueEl || !fillEl) return;
    let shown = valueEl.textContent ?? hud.initial;
    const signal = createSignal(Number.parseFloat(shown) || 0);
    return onSample(() => {
      const sn = signal();
      const text = sn.toFixed(2);
      if (text === shown) return;
      shown = text;
      valueEl.textContent = text;
      fillEl.style.transform = `scaleX(${text})`;
    });
  }, []);

  return (
    <div
      aria-hidden="true"
      data-hud-local=""
      data-safe="tight"
      className={`pointer-events-none flex flex-col items-end gap-2.5 select-none ${className}`}
    >
      <span className="flex items-baseline gap-3">
        <span className="t-label text-ink-2">{hud.label}</span>
        <span ref={valueRef} className="t-readout text-ink">
          {hud.initial}
        </span>
      </span>
      <span className="relative block h-px w-[clamp(96px,11vw,168px)] bg-line-strong">
        <span
          ref={fillRef}
          className="absolute inset-0 origin-left bg-ember transition-transform duration-100 ease-linear"
          style={{ transform: `scaleX(${hud.initial})` }}
        />
      </span>
    </div>
  );
}
