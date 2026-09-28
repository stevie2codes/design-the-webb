import type { CtaLabel } from '../content/site';

/**
 * A link/button label with its arrow glyphs (← → ↗ ↘ ↑) hidden from
 * assistive tech: "View work ↘" is announced as "View work".
 */
export default function LinkLabel({ cta }: { cta: CtaLabel }) {
  return (
    <>
      {cta.pre && <span aria-hidden="true">{cta.pre} </span>}
      {cta.label}
      {cta.post && <span aria-hidden="true"> {cta.post}</span>}
    </>
  );
}
