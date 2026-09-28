import { Copy } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { contact } from '../content/site';

/** How long the button reads "Copied" (§5 C5). */
const DONE_MS = 1600;

/**
 * Copy `text` to the clipboard. Uses the async Clipboard API where it is
 * available (secure contexts); otherwise selects `source` and falls back to
 * execCommand('copy'). If both fail, the address is left selected so the
 * visitor can copy it by hand.
 */
async function copyText(text: string, source: HTMLElement | null): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* permission denied or unsupported: fall back below */
  }
  const selection = window.getSelection();
  if (!source || !selection) return false;
  const range = document.createRange();
  range.selectNodeContents(source);
  selection.removeAllRanges();
  selection.addRange(range);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  if (ok) selection.removeAllRanges();
  return ok;
}

export interface CopyEmailProps {
  className?: string;
}

/**
 * The email row (SPEC §5 C5): the address as selectable plain text
 * (`.t-display-m` ink, `user-select: all`) and a Copy button (`.t-label`)
 * that reads "Copied" for 1.6s and announces it through a polite live
 * region. The button keeps the width of its longer label, so the centred
 * row never shifts (§7: the email address never moves).
 *
 * The address may wrap after "@" on very narrow screens; on phones its size
 * is capped so it stays on one line from 320px up. Without JS the button
 * is hidden and the address is still selectable.
 *
 * No scrim of its own: when it sits over the field, wrap it (with the text
 * around it) in one [data-safe] block.
 */
export default function CopyEmail({ className = '' }: CopyEmailProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const addressRef = useRef<HTMLSpanElement>(null);
  const addressId = useId();
  const [user, domain] = contact.email.split('@');

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onCopy = async () => {
    const ok = await copyText(contact.email, addressRef.current);
    if (!ok) return;
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), DONE_MS);
  };

  // Both labels share one grid cell; the hidden one reserves its width.
  const buttonBody = (
    <>
      <Copy aria-hidden="true" size={14} strokeWidth={1.5} className="shrink-0" />
      <span className="grid text-left">
        <span className={`col-start-1 row-start-1 ${copied ? 'invisible' : ''}`}>{contact.copy.idle}</span>
        <span className={`col-start-1 row-start-1 ${copied ? '' : 'invisible'}`}>{contact.copy.done}</span>
      </span>
    </>
  );

  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-3 ${className}`}>
      {/* Desktop: an invisible twin of the button on the left keeps the
          address itself on the page's centre axis (beacon, headline, body). */}
      <span aria-hidden="true" className="btn btn-line invisible gap-2.5 px-5 mobile:hidden nojs:hidden">
        {buttonBody}
      </span>
      <span
        ref={addressRef}
        id={addressId}
        data-cursor="text"
        className="t-display-m text-center text-ink select-all [overflow-wrap:anywhere] mobile:text-[min(1.625rem,calc((100vw-2*var(--gutter))/13.4))]"
      >
        {user}@<wbr />
        {domain}
      </span>
      <button
        type="button"
        onClick={onCopy}
        aria-describedby={addressId}
        data-copied={copied || undefined}
        className="btn btn-line gap-2.5 px-5 nojs:hidden data-copied:border-ember data-copied:text-ember"
      >
        {buttonBody}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? contact.copy.done : ''}
      </span>
    </div>
  );
}
