/**
 * The case-study index (SPEC §5 C2, Appendix A): what the home chapter and
 * the route table need — slug, label, title and a one-line summary. Kept
 * apart from caseStudies.ts so the full copy stays in the lazy page chunk.
 */
export interface CaseIndexEntry {
  readonly slug: string;
  /** "CS/01" … */
  readonly indexLabel: string;
  readonly title: string;
  /** One line for the home index. */
  readonly summary: string;
}

export const caseIndex: readonly CaseIndexEntry[] = [
  {
    slug: 'nothing-to-publish',
    indexLabel: 'CS/01',
    title: 'Nothing to publish',
    summary: 'Replacing a publish wizard with always-saved reports, and finding the words that made it click.',
  },
  {
    slug: 'showing-the-work',
    indexLabel: 'CS/02',
    title: 'Showing the assistant’s work',
    summary: 'Giving an AI’s narration, questions and reasoning a place to go, without adding noise to the chat.',
  },
  {
    slug: 'designing-in-the-codebase',
    indexLabel: 'CS/03',
    title: 'Designing in the codebase',
    summary: 'Working as a design engineer on an AI product: copy-first PRs, disposable prototypes, analytics and use-case framing.',
  },
];

export function isCaseSlug(slug: string): boolean {
  return caseIndex.some((c) => c.slug === slug);
}
