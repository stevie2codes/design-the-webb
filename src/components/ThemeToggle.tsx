import { Moon, Pencil } from 'lucide-react';
import { footer } from '../content/site';
import { toggleTheme, useTheme } from '../theme';

/**
 * Theme toggle (sketch branch; src/theme.ts). `variant="footer"`: the text
 * toggle beside Motion ("Theme: Sketch / Ink", aria-pressed = ink, the
 * current option lit like MotionToggle). `variant="icon"`: the nav's 44px
 * icon button (a moon in the notebook, a pencil in the dark), named by what
 * it switches to. Both need JS (hidden under no-js by their callers).
 */
export default function ThemeToggle({ variant = 'footer', className = '' }: { variant?: 'footer' | 'icon'; className?: string }) {
  const theme = useTheme();
  const t = footer.theme;
  const ink = theme === 'ink';

  if (variant === 'icon') {
    const Icon = ink ? Pencil : Moon;
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={ink ? t.toSketch : t.toInk}
        title={ink ? t.toSketch : t.toInk}
        className={`grid size-11 place-items-center rounded-full text-ink-2 transition-colors duration-240 ease-ui hover:text-ink focus-visible:text-ink ${className}`}
      >
        <Icon aria-hidden="true" size={18} strokeWidth={1.5} />
      </button>
    );
  }

  const on = 'text-ink';
  const off = 'text-ink-3';
  return (
    <button
      type="button"
      aria-pressed={ink}
      onClick={toggleTheme}
      className={`link-line t-label gap-[0.6em] text-ink-2 ${className}`}
    >
      <span>{t.label}:</span>
      <span aria-hidden="true" className={`transition-colors duration-240 ease-ui ${ink ? off : on}`}>
        {t.sketch}
      </span>
      <span aria-hidden="true" className="text-ink-3">
        /
      </span>
      <span className={`transition-colors duration-240 ease-ui ${ink ? on : off}`}>{t.ink}</span>
    </button>
  );
}
