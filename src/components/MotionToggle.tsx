import { footer } from '../content/site';
import { toggleMotionPref, useMotionPref } from '../motion/motionPref';

/**
 * "Motion: Full / Reduced" (SPEC §5 C6, §8.2): a toggle button with
 * aria-pressed = reduced motion. Both options stay visible and the current
 * one is lit (ink; the other ink-3, which the footer's solid surface allows),
 * so the label never changes width. "Full" and the slash are hidden from
 * assistive tech: the accessible name is "Motion: Reduced", and pressed /
 * not pressed says whether it is on. The choice persists in
 * localStorage['dtw:motion'] and flips html.rm at once (motionPref).
 */
export default function MotionToggle({ className = '' }: { className?: string }) {
  const reduced = useMotionPref() === 'reduced';
  const on = 'text-ink';
  const off = 'text-ink-3';

  return (
    <button
      type="button"
      aria-pressed={reduced}
      onClick={() => toggleMotionPref()}
      className={`link-line t-label gap-[0.6em] text-ink-2 ${className}`}
    >
      <span>{footer.motion.label}:</span>
      <span aria-hidden="true" className={`transition-colors duration-240 ease-ui ${reduced ? off : on}`}>
        {footer.motion.full}
      </span>
      <span aria-hidden="true" className="text-ink-3">
        /
      </span>
      <span className={`transition-colors duration-240 ease-ui ${reduced ? on : off}`}>{footer.motion.reduced}</span>
    </button>
  );
}
