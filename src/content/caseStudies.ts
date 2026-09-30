/**
 * Case studies (SPEC §5 C2, §6 "Case study", Appendix A). Written from
 * Stephen's own brief on the AI report assistant work (Aug–Sep 2026): every
 * fact traces to it. The product, client, customers, people and internal
 * systems stay unnamed, and every figure is recreated with fictional data.
 * No metrics: the brief has none.
 */
import { caseIndex, type CaseIndexEntry } from './caseIndex';
import { MAILTO, type Cta, type RichText } from './site';

// ─── Chrome ─────────────────────────────────────────────────────────────────
export const caseChrome = {
  back: { label: 'All work', pre: '←', href: '/#work' } satisfies Cta,
  kind: 'Case study',
  ndaNote: 'Details generalized under NDA. Every visual is recreated with fictional data.',
  metaLabel: 'Project details',
  decision: { considered: 'Considered', chose: 'Chose', why: 'Why' },
  figure: (n: number): string => `Fig. ${n}`,
  nextHeading: 'Next case study',
  request: {
    lead: 'Want the full story, with the real screens?',
    cta: {
      label: 'Request a walkthrough',
      post: '→',
      href: `${MAILTO}?subject=Case%20study%20walkthrough`,
    } satisfies Cta,
  },
} as const;

// ─── Model ──────────────────────────────────────────────────────────────────
export type FigureId =
  | 'lifecycle'
  | 'two-lane'
  | 'vocabulary'
  | 'chat-patterns'
  | 'answer-details'
  | 'result-card'
  | 'use-cases';

export interface Titled {
  readonly title: string;
  readonly text: string;
}

export type Block =
  | { readonly kind: 'p'; readonly text: RichText }
  | { readonly kind: 'list'; readonly items: readonly RichText[] }
  | { readonly kind: 'steps'; readonly items: readonly Titled[] }
  | {
      readonly kind: 'decision';
      readonly title: string;
      readonly considered: readonly string[];
      readonly chose: string;
      readonly why: string;
    }
  | { readonly kind: 'figure'; readonly figure: FigureId; readonly caption: string }
  | { readonly kind: 'lessons'; readonly items: readonly Titled[] };

export interface CaseSection {
  readonly id: string;
  readonly heading: string;
  readonly blocks: readonly Block[];
}

export interface CaseStudy extends CaseIndexEntry {
  /** The detail page's lede. */
  readonly lede: string;
  readonly meta: readonly { readonly label: string; readonly value: string }[];
  readonly sections: readonly CaseSection[];
}

const CONTEXT = 'AI reporting assistant for a government data platform, in beta';
const ROLE = 'Product designer and design engineer';

// ─── The studies ────────────────────────────────────────────────────────────
export const caseStudies: readonly CaseStudy[] = [
  {
    ...caseIndex[0],
    lede: 'How AI-built reports get saved, shared and found again: a three-step publish wizard became one share dialog, and most of the design turned out to be vocabulary.',
    meta: [
      { label: 'Role', value: ROLE },
      { label: 'Scope', value: 'Report lifecycle: save, share, find again, update' },
      { label: 'Context', value: CONTEXT },
      { label: 'Year', value: '2026' },
    ],
    sections: [
      {
        id: 'problem',
        heading: 'The problem',
        blocks: [
          {
            kind: 'p',
            text: [
              'Staff at public agencies (cities, counties, state agencies) describe the report they need in plain language, like ',
              { strong: '“run the monthly overtime report for June.”' },
              ' The assistant finds the right datasets, writes and runs the query, and builds the report on a canvas next to the chat.',
            ],
          },
          {
            kind: 'p',
            text: [
              'Before the assistant, making a report meant knowing the data catalog, the query language and a manual drag-and-drop builder. Most staff who need reports know none of that. Once the assistant could build a report, the next question was what happens to it: how it gets saved, shared, found again and kept up to date.',
            ],
          },
        ],
      },
      {
        id: 'role',
        heading: 'My role',
        blocks: [
          {
            kind: 'p',
            text: [
              'I owned the UX of the report lifecycle from concept to prototype to beta handoff, designing in code against real data and the live agent. The services and storage belonged to engineering. I treated them as context and left those decisions to the engineers on purpose.',
            ],
          },
        ],
      },
      {
        id: 'publish',
        heading: 'Decision 1',
        blocks: [
          {
            kind: 'decision',
            title: 'Drop “publish” for always-saved reports',
            considered: [
              'A three-step publish wizard (Details → Access → Review), which I built first',
              'Live-document sharing, where recipients see edits as they happen',
              'Named versions',
              'Always-saved reports, where sharing hands over “the last shared version”',
            ],
            chose:
              'Every report saves automatically and stays in your library. It’s private until you share it. Sharing is one dialog, modeled on Drive, and later edits show up as “Unshared changes” with one action to update the shared version.',
            why: 'Publishing added ceremony, and a lifecycle people had to understand, for no real benefit. One shared copy that gets replaced keeps what recipients see stable, and leaves room for versioning later.',
          },
          {
            kind: 'figure',
            figure: 'lifecycle',
            caption: 'Before and after. Three steps and a “published” state became one dialog that only asks who can see the report.',
          },
          {
            kind: 'p',
            text: [
              'A related call: ',
              { strong: 'every report is listed in the library.' },
              ' No “only list it if you save it” threshold. A threshold is really a second lifecycle state, which means more engineering, and unlisted reports are effectively lost. Clutter is handled with quality instead: AI auto-titles, newest-first ordering and one-click delete.',
            ],
          },
        ],
      },
      {
        id: 'wires',
        heading: 'Same wires, new words',
        blocks: [
          {
            kind: 'p',
            text: [
              'The main pushback was that we should use the platform’s existing publish process. So I mapped every step of the new UX onto the existing publish-and-permissions machinery, in a two-lane diagram: user actions on top, the unchanged platform operations underneath.',
            ],
          },
          {
            kind: 'figure',
            figure: 'two-lane',
            caption: 'The two-lane diagram, simplified. Nothing underneath changes; only the steps and words people see do.',
          },
        ],
      },
      {
        id: 'vocabulary',
        heading: 'Decision 2',
        blocks: [
          {
            kind: 'decision',
            title: 'Three statuses: Only you, Shared, Unshared changes',
            considered: ['Private', 'Restricted', 'Draft', '“Shared · newer edits”', '“Snapshot”'],
            chose:
              'Only you, Shared and Unshared changes, plus “the last shared version” for what recipients see. The UI never says publish, draft or snapshot, and the attention color is reserved for the one state that needs it.',
            why: 'Each rejected word taught the wrong model. I settled the wording in a workshop, borrowing the “unpublished changes” pattern people already know from other tools.',
          },
          {
            kind: 'figure',
            figure: 'vocabulary',
            caption: 'The vocabulary board: the words we dropped, why, and the three statuses that replaced them.',
          },
          {
            kind: 'p',
            text: [
              'For reference I studied how Google Drive, Google Sites, Looker Studio and Claude’s artifacts handle saving, sharing and unpublished changes, and borrowed their vocabulary wherever people would already know it.',
            ],
          },
        ],
      },
      {
        id: 'constraints',
        heading: 'Constraints',
        blocks: [
          {
            kind: 'list',
            items: [
              [
                { strong: 'The backend wasn’t ready for the ideal flow.' },
                ' Every publish created a brand-new asset, so there was no path to update a shared report. I designed the UX against a small fake store and wrote the adoption gaps down for the engineers, instead of proposing storage myself.',
              ],
              [
                { strong: 'There is no “public”.' },
                ' These sites require sign-in, so sharing became named people, with an optional whole-organization toggle.',
              ],
              [
                { strong: 'The design system had a gap.' },
                ' There was no access-control row (person, role, revoke). I hand-built one for the prototype and sketched a proposed component, but left building it as separate work.',
              ],
            ],
          },
        ],
      },
      {
        id: 'outcome',
        heading: 'Outcome',
        blocks: [
          {
            kind: 'list',
            items: [
              ['The design team adopted save-and-share over publish. Developer feedback shaped the final model: private by default, and one shared copy.'],
              ['Engineering accepted the storage direction: every report is a private asset from the start.'],
            ],
          },
        ],
      },
      {
        id: 'learned',
        heading: 'What I learned',
        blocks: [
          {
            kind: 'lessons',
            items: [
              {
                title: 'Words carry the model.',
                text: 'Most of the sharing design was vocabulary. Getting “Unshared changes” and “the last shared version” right did more than any layout change.',
              },
              {
                title: 'Map new UX onto existing machinery early.',
                text: 'The two-lane diagram settled the pushback faster than any argument.',
              },
              {
                title: 'State directions; don’t hedge.',
                text: 'A side-by-side comparison table read as if we were still proposing the option we’d dropped.',
              },
            ],
          },
        ],
      },
    ],
  },

  {
    ...caseIndex[1],
    lede: 'You can’t prompt an AI’s narration away, so I designed a place for it: chat patterns for results, clarifying questions and working notes, and a plain answer to “how did you get this?”',
    meta: [
      { label: 'Role', value: ROLE },
      { label: 'Scope', value: 'Chat patterns, answer details, a design-system component' },
      { label: 'Context', value: CONTEXT },
      { label: 'Year', value: '2026' },
    ],
    sections: [
      {
        id: 'problem',
        heading: 'The problem',
        blocks: [
          {
            kind: 'p',
            text: [
              'The model narrates between tool calls, and it narrates more on harder tasks. Prompt changes alone couldn’t stop it. And when a request was ambiguous, it quietly stacked up assumptions instead of asking.',
            ],
          },
          {
            kind: 'p',
            text: [
              'I owned the assistant’s chat patterns: how results appear, how it asks clarifying questions, and how it shows its work.',
            ],
          },
        ],
      },
      {
        id: 'patterns',
        heading: 'Decision 1',
        blocks: [
          {
            kind: 'decision',
            title: 'Give the narration a place to go',
            considered: ['Tighten the prompt only', 'Hide the narration', 'Give it a place to go'],
            chose:
              'Three chat patterns, prototyped as client tools the agent can call: a launch card that opens a result in the side panel, a clarifying-choice card with option pills and a “use defaults” escape, and collapsed working notes that absorb the narration.',
            why: 'You can’t prompt narration away, so design a place for it. And for ambiguity, asking once beats guessing three times.',
          },
          {
            kind: 'figure',
            figure: 'chat-patterns',
            caption: 'The three patterns in one conversation: working notes, a clarifying choice, and a launch card.',
          },
          {
            kind: 'p',
            text: [
              'Names matter here too: I called it a “launch card” so it wouldn’t collide with the design system’s existing “chip”.',
            ],
          },
        ],
      },
      {
        id: 'answer',
        heading: 'Decision 2',
        blocks: [
          {
            kind: 'decision',
            title: '“How I got this answer”: start expressive, then cut to the design system',
            considered: [
              'Stacked, expandable and lineage layouts',
              'A first-person “trail” with connector lines and markers',
            ],
            chose:
              'The first-person structure (Data used → Assumptions made → Query), built only from standard design-system cards, lists, badges and inline messages. The custom trail visuals are gone.',
            why: 'It is the path of least resistance for engineering and review, with no custom UI to maintain.',
          },
          {
            kind: 'figure',
            figure: 'answer-details',
            caption: 'Three rounds of the answer details: an expressive exploration first, then the version built only from design-system parts.',
          },
          {
            kind: 'p',
            text: [
              'One rename came from the domain, not the layout: “judgment calls” became ',
              { strong: '“Assumptions made”' },
              ', because “calls” collides with “calls for service” in public-safety data.',
            ],
          },
        ],
      },
      {
        id: 'card',
        heading: 'A component for everyone',
        blocks: [
          {
            kind: 'p',
            text: [
              'The result card, and a grouped “N more” variant, went into the company’s open-source AI design-system package, with Storybook stories, a changeset and React wrappers. The whole card is clickable, and the active card is marked with ',
              { strong: 'aria-current' },
              '.',
            ],
          },
          {
            kind: 'figure',
            figure: 'result-card',
            caption: 'Result card anatomy: base, hover and active states, and the grouped variant.',
          },
        ],
      },
      {
        id: 'constraints',
        heading: 'Constraints',
        blocks: [
          {
            kind: 'list',
            items: [
              [
                { strong: 'Platform limits.' },
                ' There was no hidden-reasoning channel, and tools bind when a conversation starts, so every change needed a hard reload to test. I documented these as asks for the platform team.',
              ],
              [
                { strong: 'Honest copy.' },
                ' Charts were declared but not implemented (only tables rendered), so no copy invites people to ask for a chart. While checking, I found a prompt telling the model to use tools that don’t exist.',
              ],
              [
                { strong: 'Contrast.' },
                ' I caught a status chip that failed contrast on the dark toolbar, and it didn’t belong on that surface anyway.',
              ],
            ],
          },
        ],
      },
      {
        id: 'outcome',
        heading: 'Outcome',
        blocks: [
          {
            kind: 'list',
            items: [
              ['The “How I got this answer” view and the result card were built as production code, not just mockups.'],
              ['The result card was offered to the shared design system for other products to use.'],
            ],
          },
        ],
      },
      {
        id: 'learned',
        heading: 'What I learned',
        blocks: [
          {
            kind: 'lessons',
            items: [
              {
                title: 'Start expressive, then cut hard.',
                text: 'The trail explored the idea. The design-system version is the one built for production.',
              },
              {
                title: 'Every element has to earn its place.',
                text: 'A focus surface like the canvas is for making things, not monitoring them, so status belongs where it’s scannable or actionable. I now default to removing things.',
              },
            ],
          },
        ],
      },
    ],
  },

  {
    ...caseIndex[2],
    lede: 'I’m not a core platform developer, but I did my design work inside the product’s codebase: against real data, in small reviewable pull requests, and in prototypes engineers could open without me.',
    meta: [
      { label: 'Role', value: ROLE },
      { label: 'Scope', value: 'Prototypes, production UX changes, beta analytics, table analysis' },
      { label: 'Context', value: CONTEXT },
      { label: 'Year', value: '2026' },
    ],
    sections: [
      {
        id: 'why',
        heading: 'Why code',
        blocks: [
          {
            kind: 'p',
            text: [
              'I set up the full local environment and learned to run the front end against a shared staging environment, so I could design against real data and the live agent instead of static mocks. I had no backend ownership, and kept it that way on purpose.',
            ],
          },
        ],
      },
      {
        id: 'how',
        heading: 'How I worked',
        blocks: [
          {
            kind: 'steps',
            items: [
              {
                title: 'Start small',
                text: 'I shipped copy first (the entry screen and a contextual input placeholder) to learn the ticket → branch → PR workflow before anything bigger.',
              },
              {
                title: 'Prototype where nothing depends on it',
                text: 'Bigger ideas went into disposable prototypes: isolated routes nothing else depends on, deletable in one move. A small fake store let me design with services down, without locking engineers into a storage design.',
              },
              {
                title: 'Make it demoable',
                text: 'Agent-free deep-link routes let engineers open any flow without a live AI session. Static interactive mocks, including an offline bundle, went on tickets so reviewers didn’t need the environment.',
              },
              {
                title: 'Loop fast',
                text: 'I demoed prototypes to engineers and folded their feedback into the prototype, the diagram and the docs, often the same day.',
              },
              {
                title: 'Hand off in pieces',
                text: 'Handoffs went from one long doc to a short entry point plus a one-page ticket per component, after developers told me the first version was too long.',
              },
            ],
          },
        ],
      },
      {
        id: 'scope',
        heading: 'Decision 1',
        blocks: [
          {
            kind: 'decision',
            title: 'Scope the work to where the product is going',
            considered: [
              'Build the canvas empty state the ticket described, pointing at the manual builder',
              'Tag every surface for analytics',
            ],
            chose:
              'The builder had been discontinued, so I built the empty state for the chat panel instead. For analytics I deliberately left deprecated or about-to-be-reworked surfaces untagged.',
            why: 'Designing or instrumenting surfaces that are going away wastes effort and pollutes the data.',
          },
        ],
      },
      {
        id: 'analytics',
        heading: 'Beta analytics',
        blocks: [
          {
            kind: 'p',
            text: [
              'I defined and tagged the beta’s user actions (prompt submitted, report created, widgets added, updated or removed, and sharing outcomes) with a typed event helper and test IDs on menus and controls. I cut the tests down to the ones that protect app behavior, because tracking must never break the app. ',
              { strong: 'It merged after code review and gave the beta its first custom events.' },
            ],
          },
        ],
      },
      {
        id: 'use-cases',
        heading: 'Decision 2',
        blocks: [
          {
            kind: 'decision',
            title: 'Frame the table work by use case, not feature list',
            considered: ['A feature-parity checklist against the legacy table', 'Real public-sector reports'],
            chose:
              'I organized the parity analysis around ten kinds of public-sector report and mapped 28 table capabilities against them.',
            why: 'Each report type maps to the capabilities it actually needs, so the conversation is about real reports instead of a checklist.',
          },
          {
            kind: 'figure',
            figure: 'use-cases',
            caption: 'The ten report types the analysis was organized around, and what it surfaced.',
          },
          {
            kind: 'p',
            text: [
              'It surfaced something the team didn’t expect: the assistant was already ahead of the legacy tool on computed columns, date bucketing and top-N. ',
              { strong: 'The gap was presentation.' },
            ],
          },
        ],
      },
      {
        id: 'outcome',
        heading: 'Outcome',
        blocks: [
          {
            kind: 'list',
            items: [
              ['The analytics work merged and gave the beta its first custom events.'],
              ['The entry-point prototype (a create-menu card, a nav item and a profile callout) went to a developer to productionize.'],
              ['I followed up with why the current table component won’t reach parity.'],
            ],
          },
        ],
      },
      {
        id: 'learned',
        heading: 'What I learned',
        blocks: [
          {
            kind: 'lessons',
            items: [
              {
                title: 'Make prototypes demoable without dependencies.',
                text: 'The agent-free deep links should have come first. For a while the publish wizard couldn’t be seen at all without a live agent.',
              },
              {
                title: 'Frame by use case, not feature list.',
                text: 'It made the table conversation legible to non-engineers.',
              },
            ],
          },
        ],
      },
    ],
  },
];

export function getCaseStudy(slug: string | undefined): CaseStudy | undefined {
  return slug ? caseStudies.find((c) => c.slug === slug) : undefined;
}

export function getNextCaseStudy(slug: string): CaseStudy {
  const i = caseStudies.findIndex((c) => c.slug === slug);
  return caseStudies[(i + 1) % caseStudies.length];
}

// ─── Figure content (all fictional, aria-hidden mock UI) ────────────────────
export const figures = {
  lifecycle: {
    before: {
      label: 'Before · publish wizard',
      steps: ['Details', 'Access', 'Review'],
      end: 'Published',
      note: '3 steps and a state to understand',
    },
    after: {
      label: 'After · share',
      title: 'Share “Overtime by department, June”',
      addPeople: 'Add people',
      org: 'Everyone in your organization',
      button: 'Share',
      note: '1 dialog: who can see it',
    },
  },
  twoLane: {
    top: 'What people do',
    bottom: 'What the platform does',
    actions: [
      { action: 'Ask for a report', status: 'Only you' },
      { action: 'Share it', status: 'Shared' },
      { action: 'Keep editing', status: 'Unshared changes' },
      { action: 'Update the shared version', status: 'Shared' },
    ],
    machinery: 'The existing publish-and-permissions machinery, unchanged',
    tagline: 'Nothing to publish. Just decide who can see it.',
  },
  vocabulary: {
    dropped: [
      { word: 'Publish · Draft', why: 'Never in the UI: no ceremony, no second lifecycle' },
      { word: 'Restricted', why: 'Made never-shared reports read like catalog assets' },
      { word: 'Shared · newer edits', why: 'Described the mechanism, not what it means for you' },
      { word: 'Snapshot', why: 'Implied a separate copy for every share' },
    ],
    kept: [
      { word: 'Only you', attention: false },
      { word: 'Shared', attention: false },
      { word: 'Unshared changes', attention: true },
    ],
    keptLabel: 'The three statuses',
    note: 'Only the state that needs action gets the accent color.',
  },
  chat: {
    user: 'Run the monthly overtime report for June',
    notes: 'Working notes · 4 steps',
    question: 'Which departments should I include?',
    options: ['All departments', 'Public safety only'],
    defaults: 'Use defaults',
    card: { title: 'Overtime by department, June', kind: 'Report · table', open: 'Open' },
    labels: ['Working notes', 'Clarifying choice', 'Launch card'],
  },
  answer: {
    rounds: [
      { label: 'Stacked', note: 'Explored' },
      { label: 'Trail', note: 'Explored' },
      { label: 'Design system', note: 'Built' },
    ],
    parts: ['Data used', 'Assumptions made', 'Query'],
    dataset: 'Payroll overtime, 2026',
    assumption: 'June means June 1–30',
    query: 'Show query',
  },
  resultCard: {
    states: ['Base', 'Hover', 'Active'],
    title: 'Overtime by department',
    kind: 'Report · table',
    group: { label: 'Grouped', more: '3 more' },
  },
  useCases: {
    types: [
      'Budget vs. actual',
      'Checkbook',
      'Public safety',
      'Permits',
      '311',
      'Courts',
      'HR and payroll',
      'Utility and tax aging',
      'K-12',
      'Health and human services',
    ],
    count: '28 capabilities × 10 report types',
    ahead: { label: 'Already ahead of the legacy tool', items: ['Computed columns', 'Date bucketing', 'Top-N'] },
    gap: { label: 'The real gap', text: 'Presentation' },
  },
} as const;
