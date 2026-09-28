import type { SectionHeading } from '../content/site';

export interface ChapterHeadingProps {
  heading: SectionHeading;
  /** Use headingId(chapterId) so <Chapter labelledBy> and nav focus find it. */
  id: string;
  as?: 'h2' | 'h3';
  className?: string;
}

/**
 * "01 — About" as a `.t-label` ember heading (§5). The number is
 * aria-hidden, so the accessible name is the title alone. tabIndex -1: nav
 * jumps move focus here (§4.4).
 */
export default function ChapterHeading({ heading, id, as: Tag = 'h2', className }: ChapterHeadingProps) {
  return (
    <Tag id={id} tabIndex={-1} className={className ? `t-label text-ember ${className}` : 't-label text-ember'}>
      <span aria-hidden="true">{heading.num} — </span>
      {heading.title}
    </Tag>
  );
}
