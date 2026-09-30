import { ArrowRight, Check, ChevronRight, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { figures, type FigureId } from '../../content/caseStudies';

/**
 * Case-study figures (SPEC §6 "Case study"): recreated mock UI with
 * fictional data, drawn in DOM on solid surfaces. Each mock is aria-hidden
 * decoration; the <figcaption> (CaseStudyPage) carries what it shows.
 * Mock text uses the type roles at reduced sizes; ink-3 only on solid
 * surfaces; ember text only at ≥ 12px (.t-label).
 */
export default function CaseFigure({ id }: { id: FigureId }) {
  switch (id) {
    case 'lifecycle':
      return <Lifecycle />;
    case 'two-lane':
      return <TwoLane />;
    case 'vocabulary':
      return <Vocabulary />;
    case 'chat-patterns':
      return <ChatPatterns />;
    case 'answer-details':
      return <AnswerDetails />;
    case 'result-card':
      return <ResultCard />;
    case 'use-cases':
      return <UseCases />;
  }
}

const ui = 't-body text-[0.8125rem] leading-snug';
const icon = { strokeWidth: 1.5, 'aria-hidden': true } as const;

function Panel({ label, children, className = '' }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`sketch-box rounded-[12px] border border-line bg-surface p-5 ${className}`}>
      {label && <p className="t-micro mb-4 text-ink-3 uppercase">{label}</p>}
      {children}
    </div>
  );
}

function Badge({ children, attention = false }: { children: ReactNode; attention?: boolean }) {
  return (
    <span
      className={`t-label inline-flex min-h-7 items-center self-start rounded-pill border px-3 whitespace-nowrap ${
        attention ? 'border-ember/60 text-ember' : 'border-line-strong text-ink-2'
      }`}
    >
      {children}
    </span>
  );
}

// ─── CS/01 ──────────────────────────────────────────────────────────────────
function Lifecycle() {
  const f = figures.lifecycle;
  return (
    <div className="grid gap-4 desktop:grid-cols-2">
      <Panel label={f.before.label}>
        <ol className="flex flex-col gap-2.5">
          {f.before.steps.map((step, i) => (
            <li key={step} className="flex items-center gap-3 rounded-[8px] border border-line bg-surface-2 px-3 py-2.5">
              <span className="t-micro grid size-6 place-items-center rounded-full border border-line-strong text-ink-2">
                {i + 1}
              </span>
              <span className={`${ui} text-ink`}>{step}</span>
              <ChevronRight {...icon} className="ml-auto size-4 text-ink-3" />
            </li>
          ))}
          <li className="flex items-center gap-3 px-3 py-2">
            <Check {...icon} className="size-4 text-ink-3" />
            <span className={`${ui} text-ink-3`}>{f.before.end}</span>
          </li>
        </ol>
        <p className="t-micro mt-5 text-ink-3">{f.before.note}</p>
      </Panel>
      <Panel label={f.after.label}>
        <div className="rounded-[10px] border border-line-strong bg-surface-2 p-4">
          <p className={`${ui} text-ink`}>{f.after.title}</p>
          <div className="mt-4 flex items-center gap-2 rounded-[6px] border border-line px-3 py-2">
            <Users {...icon} className="size-4 text-ink-3" />
            <span className={`${ui} text-ink-3`}>{f.after.addPeople}</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className={`${ui} text-ink-2`}>{f.after.org}</span>
            <span className="relative h-5 w-9 shrink-0 rounded-pill border border-line-strong">
              <span className="absolute top-1/2 left-1 size-3 -translate-y-1/2 rounded-full bg-ink-3" />
            </span>
          </div>
          <div className="mt-5 flex justify-end">
            <span className="t-label rounded-pill bg-ink px-4 py-2 text-void">{f.after.button}</span>
          </div>
        </div>
        <p className="t-micro mt-5 text-ink-3">{f.after.note}</p>
      </Panel>
    </div>
  );
}

function TwoLane() {
  const f = figures.twoLane;
  return (
    <Panel>
      <p className="t-micro text-ink-3 uppercase">{f.top}</p>
      <ol className="mt-3 grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 desktop:grid-cols-4">
        {f.actions.map((a, i) => (
          <li key={a.action} className="relative flex flex-col gap-3 rounded-[8px] border border-line bg-surface-2 p-3">
            <span className={`${ui} text-ink`}>{a.action}</span>
            <Badge attention={a.status === 'Unshared changes'}>{a.status}</Badge>
            {i < f.actions.length - 1 && (
              <ArrowRight {...icon} className="absolute top-1/2 -right-3 hidden size-3 -translate-y-1/2 text-ink-3 desktop:block" />
            )}
            <span className="absolute -bottom-3 left-1/2 h-3 w-px bg-line-strong" />
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded-[8px] border border-dashed border-line-strong px-4 py-3">
        <p className="t-micro text-ink-3 uppercase">{f.bottom}</p>
        <p className={`${ui} mt-1 text-ink-2`}>{f.machinery}</p>
      </div>
      <p className="t-accent mt-6 text-[1.375rem]">{f.tagline}</p>
    </Panel>
  );
}

function Vocabulary() {
  const f = figures.vocabulary;
  return (
    <div className="grid gap-4 desktop:grid-cols-[1.4fr_1fr]">
      <Panel>
        <ul className="flex flex-col divide-y divide-line">
          {f.dropped.map((d) => (
            <li key={d.word} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <span className={`${ui} text-ink-3 line-through decoration-ember/70`}>{d.word}</span>
              <span className={`${ui} text-ink-2`}>{d.why}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel label={f.keptLabel}>
        <div className="flex flex-wrap gap-2">
          {f.kept.map((k) => (
            <Badge key={k.word} attention={k.attention}>
              {k.word}
            </Badge>
          ))}
        </div>
        <p className={`${ui} mt-5 text-ink-2`}>{f.note}</p>
      </Panel>
    </div>
  );
}

// ─── CS/02 ──────────────────────────────────────────────────────────────────
function ChatPatterns() {
  const f = figures.chat;
  return (
    <Panel>
      <div className="mx-auto flex max-w-[34rem] flex-col gap-4">
        <p className={`${ui} self-end rounded-[12px] rounded-br-[4px] bg-surface-2 px-4 py-2.5 text-ink`}>{f.user}</p>

        <Tagged label={f.labels[0]}>
          <div className="flex items-center gap-2 text-ink-3">
            <ChevronRight {...icon} className="size-4" />
            <span className={ui}>{f.notes}</span>
          </div>
        </Tagged>

        <Tagged label={f.labels[1]}>
          <div className="rounded-[10px] border border-line-strong p-4">
            <p className={`${ui} text-ink`}>{f.question}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {f.options.map((o) => (
                <span key={o} className={`${ui} rounded-pill border border-line-strong px-3 py-1 text-ink-2`}>
                  {o}
                </span>
              ))}
              <span className={`${ui} px-2 py-1 text-ink-3 underline underline-offset-4`}>{f.defaults}</span>
            </div>
          </div>
        </Tagged>

        <Tagged label={f.labels[2]}>
          <div className="flex items-center gap-4 rounded-[10px] border border-line-strong p-4">
            <TableGlyph />
            <div className="min-w-0">
              <p className={`${ui} text-ink`}>{f.card.title}</p>
              <p className="t-micro mt-1 text-ink-3">{f.card.kind}</p>
            </div>
            <span className="t-label ml-auto flex items-center gap-1.5 text-ember">
              {f.card.open}
              <ArrowRight {...icon} className="size-3.5" />
            </span>
          </div>
        </Tagged>
      </div>
    </Panel>
  );
}

/** A pattern with its name in the margin (desktop) or above it (mobile). */
function Tagged({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="relative">
      <p className="t-micro mb-1.5 text-ember uppercase desktop:absolute desktop:top-1/2 desktop:right-full desktop:mr-6 desktop:mb-0 desktop:-translate-y-1/2 desktop:text-right desktop:whitespace-nowrap">
        {label}
      </p>
      {children}
    </div>
  );
}

function TableGlyph() {
  return (
    <span className="grid size-10 shrink-0 grid-cols-3 gap-0.5 rounded-[6px] border border-line p-1.5">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={i < 3 ? 'bg-ink-3' : 'bg-line-strong'} />
      ))}
    </span>
  );
}

function AnswerDetails() {
  const f = figures.answer;
  return (
    <div className="grid gap-4 desktop:grid-cols-3">
      {f.rounds.map((round, r) => (
        <Panel key={round.label} className={r === 2 ? 'border-line-strong' : ''}>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <p className="t-micro text-ink-2 uppercase">{round.label}</p>
            <p className={`t-micro uppercase ${r === 2 ? 'text-ink' : 'text-ink-3'}`}>{round.note}</p>
          </div>
          {r === 0 && <StackedSketch />}
          {r === 1 && <TrailSketch />}
          {r === 2 && (
            <div className="flex flex-col gap-2.5">
              <div className="rounded-[8px] border border-line bg-surface-2 p-3">
                <p className="t-micro text-ink-3">{f.parts[0]}</p>
                <p className={`${ui} mt-1 text-ink`}>{f.dataset}</p>
              </div>
              <div className="rounded-[8px] border border-line bg-surface-2 p-3">
                <p className="t-micro text-ink-3">{f.parts[1]}</p>
                <p className={`${ui} mt-1 text-ink`}>{f.assumption}</p>
              </div>
              <div className="flex items-center gap-2 rounded-[8px] border border-line bg-surface-2 p-3">
                <ChevronRight {...icon} className="size-4 text-ink-3" />
                <p className={`${ui} text-ink-2`}>
                  {f.parts[2]} · {f.query}
                </p>
              </div>
            </div>
          )}
        </Panel>
      ))}
    </div>
  );
}

const Line = ({ w }: { w: string }) => <span className="block h-1.5 rounded-full bg-line-strong" style={{ width: w }} />;

function StackedSketch() {
  return (
    <div className="flex flex-col gap-2">
      {['80%', '62%', '74%', '55%'].map((w) => (
        <div key={w} className="flex flex-col gap-1.5 rounded-[6px] border border-line p-2.5">
          <Line w={w} />
          <Line w="40%" />
        </div>
      ))}
    </div>
  );
}

function TrailSketch() {
  return (
    <ol className="relative flex flex-col gap-4 pl-6">
      <span className="absolute top-1 bottom-1 left-[7px] w-px bg-line-strong" />
      {['70%', '84%', '58%', '66%'].map((w, i) => (
        <li key={w} className="relative flex flex-col gap-1.5">
          <span className={`absolute top-0 -left-6 size-3.5 rounded-full border ${i === 1 ? 'border-ember/70' : 'border-line-strong'} bg-surface`} />
          <Line w={w} />
          <Line w="36%" />
        </li>
      ))}
    </ol>
  );
}

function ResultCard() {
  const f = figures.resultCard;
  const tone = ['border-line', 'border-line-strong bg-surface-2', 'border-ink/40 bg-surface-2'] as const;
  return (
    <Panel>
      <div className="grid gap-x-4 gap-y-6 min-[600px]:grid-cols-2">
        {f.states.map((state, i) => (
          <div key={state}>
            <p className="t-micro mb-2 text-ink-3 uppercase">{state}</p>
            <div className={`relative flex items-center gap-3 rounded-[10px] border p-3 ${tone[i]}`}>
              {i === 2 && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-ember" />}
              <TableGlyph />
              <div className="min-w-0">
                <p className={`${ui} truncate text-ink`}>{f.title}</p>
                <p className="t-micro mt-1 text-ink-3">{f.kind}</p>
              </div>
            </div>
          </div>
        ))}
        <div>
          <p className="t-micro mb-2 text-ink-3 uppercase">{f.group.label}</p>
          <div className="relative">
            <span className="absolute inset-x-3 -bottom-1.5 h-3 rounded-b-[10px] border border-t-0 border-line" />
            <div className="relative flex items-center gap-3 rounded-[10px] border border-line bg-surface p-3">
              <TableGlyph />
              <div className="min-w-0">
                <p className={`${ui} truncate text-ink`}>{f.title}</p>
                <p className="t-micro mt-1 text-ink-2">+ {f.group.more}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ─── CS/03 ──────────────────────────────────────────────────────────────────
function UseCases() {
  const f = figures.useCases;
  return (
    <div className="grid gap-4 desktop:grid-cols-[1.6fr_1fr]">
      <Panel label={f.count}>
        <ul className="grid grid-cols-2 gap-2">
          {f.types.map((t) => (
            <li key={t} className={`${ui} rounded-[8px] border border-line bg-surface-2 px-3 py-2.5 text-ink`}>
              {t}
            </li>
          ))}
        </ul>
      </Panel>
      <div className="flex flex-col gap-4">
        <Panel label={f.ahead.label}>
          <ul className="flex flex-col gap-2">
            {f.ahead.items.map((item) => (
              <li key={item} className={`${ui} flex items-center gap-2 text-ink`}>
                <Check {...icon} className="size-4 text-ink-2" />
                {item}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel label={f.gap.label}>
          <p className="t-display-m text-ink">{f.gap.text}</p>
        </Panel>
      </div>
    </div>
  );
}
