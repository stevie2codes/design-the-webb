/**
 * Every home and shell string (SPEC Appendix A, §5, §6). Copy is verbatim;
 * do not edit wording here without updating the spec's copy deck.
 *
 * Conventions:
 * - Statement: `lead` in the chapter face + `accent` in `.t-accent`
 *   (Instrument Serif italic, ember). Render as `{lead} <span class="t-accent">{accent}</span>`.
 * - SectionHeading "01 — About": render `num — ` inside an aria-hidden span,
 *   so the accessible name is just the title.
 * - Cta `pre` / `post` are arrow glyphs (← → ↗ ↘ ↑). Render them aria-hidden;
 *   the label (or ariaLabel) is the accessible name.
 */
import type { ChapterId } from '../scroll/chapters';

export interface Statement {
  readonly lead: string;
  readonly accent: string;
}

/** Plain runs and emphasised runs (`strong` renders in ink, not bold). */
export type RichText = ReadonlyArray<string | { readonly strong: string }>;

export interface SectionHeading {
  readonly num: string;
  readonly title: string;
}

export interface Cta {
  readonly label: string;
  readonly href: string;
  readonly pre?: string;
  readonly post?: string;
  readonly ariaLabel?: string;
}

/** A link label whose href comes from elsewhere (a project, a route). */
export type CtaLabel = Omit<Cta, 'href'>;

export interface Portrait {
  readonly src: string;
  /** Intrinsic size (set as width/height attributes). */
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

export const EMAIL = 'stephen@designthewebb.com';
export const MAILTO = `mailto:${EMAIL}`;

export const person = {
  name: 'Stephen Webb',
  initials: 'SW',
  role: 'Senior Product Designer',
  company: 'Tyler Technologies',
  email: EMAIL,
} as const;

/** Default document.title (index.html). Detail pages use detail.documentTitle(). */
export const siteTitle = 'Stephen Webb — Senior Product Designer';

export const skipLink = 'Skip to content';

// ─── C0 Hero ────────────────────────────────────────────────────────────────
export const hero = {
  eyebrow: 'Senior Product Designer — Tyler Technologies',
  /** Uppercased by CSS (.t-name); the DOM text stays "Stephen Webb". */
  name: 'Stephen Webb',
  lede: { lead: 'I make complex data', accent: 'feel obvious.' } satisfies Statement,
  ctaPrimary: { label: 'View work', post: '↘', href: '#work' } satisfies Cta,
  ctaSecondary: { label: 'Get in touch', href: '#contact' } satisfies Cta,
  /** aria-hidden cue, desktop only. */
  scrollCue: 'Scroll to resolve',
} as const;

// ─── C1 About ───────────────────────────────────────────────────────────────
export const about = {
  heading: { num: '01', title: 'About' } satisfies SectionHeading,
  statement: { lead: 'I design products where', accent: 'data meets decisions' } satisfies Statement,
  /** Shown at 120 × 160, grayscale(1) brightness(.9), 1px line frame, radius 12px, lazy. */
  portrait: {
    src: '/photos/headshot-2-optimized.jpg',
    width: 600,
    height: 800,
    alt: 'Portrait of Stephen Webb',
  } satisfies Portrait,
  paragraphs: [
    [
      "I'm a Senior Product Designer at Tyler Technologies with a background in front-end development. I spent two years writing code before moving into design — which means I think in systems, components, and real constraints.",
    ],
    [
      "Right now I'm leading the end-to-end redesign of our reporting platform, re-envisioning it as an ",
      { strong: 'AI-centric experience' },
      ' — giving users specific, use-case-driven reporting tools that actually meet their needs.',
    ],
  ] satisfies readonly RichText[],
} as const;

export type StatKey = 'developer' | 'design' | 'tech' | 'ai';

export interface Stat {
  readonly key: StatKey;
  /** Display value, e.g. "4+". This is what the hidden table and labels hold. */
  readonly value: string;
  /** Numeric part, for the aria-hidden count-up. */
  readonly count: number;
  readonly suffix: '' | '+';
  readonly label: string;
  readonly note: string;
  /** 'years' bars sit on the YEARS axis; the AI platform is a count past the divider. */
  readonly unit: 'years' | 'count';
  /** S2 focus groups lit on hover/focus (uGroupW, §3.10). */
  readonly groups: readonly number[];
}

/** Chart order: the three bars left → right, then the AI platform past the divider. */
export const stats: readonly Stat[] = [
  {
    key: 'developer',
    value: '2',
    count: 2,
    suffix: '',
    label: 'Years as a Developer',
    note: "I speak your engineers' language",
    unit: 'years',
    groups: [0, 2],
  },
  {
    key: 'design',
    value: '4+',
    count: 4,
    suffix: '+',
    label: 'Years in Product Design',
    note: 'Discovery to delivery',
    unit: 'years',
    groups: [1, 3],
  },
  {
    key: 'tech',
    value: '6+',
    count: 6,
    suffix: '+',
    label: 'Years in Tech',
    note: 'SaaS, gov-tech, AI',
    unit: 'years',
    groups: [2, 3],
  },
  {
    key: 'ai',
    value: '1',
    count: 1,
    suffix: '',
    label: 'AI Reporting Platform',
    note: 'End-to-end redesign',
    unit: 'count',
    groups: [4],
  },
];

/** Career chart chrome (geometry lives in CHART in src/field/layout.ts). */
export const chart = {
  axisTitle: 'Years',
  ticks: ['0', '2', '4', '6'],
  /** Legend for the stacked "In tech" bar. Swatches: steel and bone (signal). */
  legend: [
    { label: 'Developer', swatch: 'steel' },
    { label: 'Product design', swatch: 'signal' },
  ],
  /** Visually hidden table columns; rows are `stats` (label, value, note). */
  tableColumns: ['Stat', 'Value', 'Note'],
} as const;

// ─── C2 NDA (#work) ─────────────────────────────────────────────────────────
export const nda = {
  heading: { num: '02', title: 'Selected work' } satisfies SectionHeading,
  badge: 'Under NDA',
  title: 'Tyler Technologies case studies',
  body: 'Detailed case studies from my work at Tyler Technologies. Available upon request.',
  cta: {
    label: 'Request by email',
    post: '→',
    href: `${MAILTO}?subject=Case%20study%20request`,
  } satisfies Cta,
} as const;

// ─── C3 Side projects ───────────────────────────────────────────────────────
/** Chapter chrome and panel microcopy; the projects themselves are in projects.ts. */
export const sideProjects = {
  label: 'Side projects',
  /** aria-hidden stage counter, e.g. "01 / 04". */
  counter: (index: number, total: number): string => `${pad2(index)} / ${pad2(total)}`,
  links: {
    details: { label: 'Project details', post: '→' } satisfies CtaLabel,
    live: { label: 'Live site', post: '↗' } satisfies CtaLabel,
    github: { label: 'GitHub', post: '↗' } satisfies CtaLabel,
  },
  aria: {
    details: (title: string): string => `${title} — project details`,
    live: (title: string): string => `${title} live site`,
    github: (title: string): string => `${title} source on GitHub`,
    card: (title: string): string => `Open ${title} project details`,
  },
  imgAlt: (title: string): string => `${title} screenshot`,
  /** MCP App has no screenshot. */
  screenshotSoon: 'Screenshot coming soon',
  /** aria-hidden Gov Data Generator write-head counter, e.g. "ROWS 07/52". */
  rowsCounter: (row: number): string => `ROWS ${pad2(row)}/52`,
} as const;

/**
 * Cursor ring labels for [data-cursor="open"] / [data-cursor="live"] (§6).
 * The full data-cursor vocabulary: "open" and "live" grow the ring with this
 * label; "text" (reading text) and "hide" (the beacon CTA disc) hide it.
 */
export const cursorLabels = { open: 'Open', live: 'Live' } as const;

// ─── C4 What I do ───────────────────────────────────────────────────────────
export interface Capability {
  readonly title: string;
  readonly description: string;
}

export const capabilities = {
  heading: { num: '03', title: 'What I do' } satisfies SectionHeading,
  statement: { lead: 'Thoughtful craft across the', accent: 'full product surface' } satisfies Statement,
  items: [
    {
      title: 'Product Design',
      description:
        'From discovery to delivery. I design end-to-end product experiences rooted in user research, business strategy, and systems thinking.',
    },
    {
      title: 'Data Visualization',
      description:
        'Turning dense datasets into legible, actionable interfaces. Charts, dashboards, and exploratory tools that respect the complexity of real data.',
    },
    {
      title: 'Design Systems',
      description:
        'Building scalable component libraries and design tokens that keep teams aligned and products consistent across dozens of surfaces.',
    },
    {
      title: 'Prototyping',
      description:
        'High-fidelity interactive prototypes that communicate intent precisely. I prototype to think, test, and sell ideas—not just to document them.',
    },
  ] satisfies readonly Capability[],
} as const;

// ─── C5 Contact ─────────────────────────────────────────────────────────────
export const contact = {
  heading: { num: '04', title: 'Get in touch' } satisfies SectionHeading,
  /** Two lines: lead, then the accent. */
  headline: { lead: "Let's build something", accent: 'worth using' } satisfies Statement,
  /** The beacon CTA disc. */
  /** The accessible name starts with the visible label (WCAG 2.5.3 Label in Name). */
  cta: { label: 'Email me', post: '↗', href: MAILTO, ariaLabel: `Email me — ${EMAIL}` } satisfies Cta,
  email: EMAIL,
  /** Copy button; `done` shows for 1.6 s and is announced via aria-live="polite". */
  copy: { idle: 'Copy', done: 'Copied' },
  body: "Always interested in connecting with fellow designers, engineers, and product thinkers. Let's talk shop.",
  /** Shown at min(15vw, 220px) wide; grayscale(1) → colour on hover/focus; 1px line frame. */
  portrait: {
    src: '/photos/headshot-1-optimized.jpg',
    width: 800,
    height: 533,
    alt: 'Stephen Webb',
  } satisfies Portrait,
  portraitCaption: 'Stephen Webb — Senior Product Designer',
} as const;

// ─── Shell: nav, rail, HUD, footer ──────────────────────────────────────────
export const socials = [
  { label: 'GitHub', post: '↗', href: 'https://github.com/stevie2codes' },
  { label: 'LinkedIn', post: '↗', href: 'https://www.linkedin.com/in/js-webb/' },
] as const satisfies readonly Cta[];

export interface NavItem {
  readonly id: ChapterId;
  readonly num: string;
  readonly label: string;
}

export const nav = {
  /** Links to "/"; collapses to `short` after the hero (y > 190vh). */
  wordmark: 'Stephen Webb',
  short: 'SW',
  items: [
    { id: 'about', num: '01', label: 'About' },
    { id: 'work', num: '02', label: 'Work' },
    { id: 'capabilities', num: '03', label: 'What I do' },
    { id: 'contact', num: '04', label: 'Contact' },
  ] satisfies readonly NavItem[],
  email: { label: 'Email', post: '↗', href: MAILTO, ariaLabel: `Email ${EMAIL}` } satisfies Cta,
  menu: { open: 'Menu', close: 'Close' },
} as const;

export interface RailItem {
  readonly id: ChapterId;
  /** Visible on hover/focus. */
  readonly label: string;
  /** The tick button's accessible name. */
  readonly ariaLabel: string;
}

export const rail = [
  { id: 'top', label: 'Title', ariaLabel: 'Go to title' },
  { id: 'about', label: 'About', ariaLabel: 'Go to About' },
  { id: 'work', label: 'Work', ariaLabel: 'Go to Work' },
  { id: 'capabilities', label: 'What I do', ariaLabel: 'Go to What I do' },
  { id: 'contact', label: 'Contact', ariaLabel: 'Go to Contact' },
] as const satisfies readonly RailItem[];

/** aria-hidden HUD readout, bottom-left on desktop. */
export const hud = { label: 'S/N', initial: '0.03' } as const;

export const footer = {
  copyright: (year: number): string => `© ${year} Stephen Webb`,
  backToTop: { label: 'Back to top', post: '↑' } satisfies CtaLabel,
  /** Toggle button with aria-pressed (pressed = reduced). */
  motion: { label: 'Motion', full: 'Full', reduced: 'Reduced' },
  /** aria-hidden outline wordmark. */
  wordmark: 'Stephen Webb',
} as const;

// ─── Routes ─────────────────────────────────────────────────────────────────
export const detail = {
  back: { label: 'All work', pre: '←', href: '/#projects' } satisfies Cta,
  viewLive: { label: 'View live', post: '↗' } satisfies CtaLabel,
  viewGithub: { label: 'View on GitHub', post: '↗' } satisfies CtaLabel,
  aboutHeading: 'About this project',
  nextHeading: 'Next project',
  screenshotSoon: 'Screenshot coming soon',
  notFound: {
    title: 'Project not found',
    body: "The project you're looking for doesn't exist.",
    back: { label: 'Back to work', href: '/#projects' } satisfies Cta,
  },
  documentTitle: (title: string): string => `${title} — Stephen Webb`,
} as const;

export const notFound = {
  label: '404 — Signal lost',
  title: 'Page not found',
  body: "The page you're looking for doesn't exist or has been moved.",
  cta: { label: 'Back to home', post: '→', href: '/' } satisfies Cta,
} as const;

/** "01 — About" as one plain string (e.g. for logs or document titles). */
export const headingText = (h: SectionHeading): string => `${h.num} — ${h.title}`;

/** A Cta or label as one plain string, glyphs included ("View work ↘"). */
export const ctaText = (c: CtaLabel): string => [c.pre, c.label, c.post].filter(Boolean).join(' ');
