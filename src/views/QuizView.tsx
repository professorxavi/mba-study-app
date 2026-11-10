import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Rich } from '../components/Inline';
import { useClassScope, useLessonScope } from '../content/context';
import type { TermRef } from '../content/types';
import { buildGlossaryQuiz, lessonQuizTerms, type Question } from '../quiz/glossaryQuiz';
import { LessonHeader } from './LessonHeader';

const DEFAULT_COUNT = 10;
const newSeed = () => Math.floor(Math.random() * 2 ** 31);

type Phase = { name: 'setup' } | { name: 'quiz'; seed: number } | { name: 'done'; seed: number };

/** Multiple-choice quiz on the glossary terms marked in this lesson's reading: read a definition, pick the term. */
export function QuizView() {
  const { glossary } = useClassScope();
  const { key } = useLessonScope();
  const total = useMemo(() => lessonQuizTerms(glossary, key).length, [glossary, key]);
  const [count, setCount] = useState(Math.min(DEFAULT_COUNT, total));
  const [phase, setPhase] = useState<Phase>({ name: 'setup' });
  const [answers, setAnswers] = useState<string[]>([]);
  const questions = useMemo(
    () => (phase.name === 'setup' ? [] : buildGlossaryQuiz(glossary, key, count, phase.seed)),
    [glossary, key, count, phase],
  );

  const start = (seed: number) => {
    setAnswers([]);
    setPhase({ name: 'quiz', seed });
  };

  if (total === 0) {
    return (
      <div className="page single">
        <main>
          <LessonHeader view="Quiz" />
          <p className="muted">This lesson’s reading has no glossary terms, so there is no quiz.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="page single">
      <main className="quiz">
        <LessonHeader view="Quiz">
          <p className="muted">
            Each question shows a definition from the glossary with the term blanked out. Pick the term it defines.
          </p>
        </LessonHeader>

        {phase.name === 'setup' && (
          <form className="quiz-setup" onSubmit={(e) => { e.preventDefault(); start(newSeed()); }}>
            <label className="quiz-count">
              <span>Number of questions: <strong>{count}</strong> of {total}</span>
              <input type="range" min={1} max={total} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </label>
            <button type="submit" className="primary">Start quiz</button>
          </form>
        )}

        {phase.name === 'quiz' && questions[answers.length] && (
          <QuestionCard
            key={`${phase.seed}-${answers.length}`}
            question={questions[answers.length]}
            index={answers.length}
            total={questions.length}
            onDone={(id) => {
              const next = [...answers, id];
              setAnswers(next);
              if (next.length === questions.length) setPhase({ name: 'done', seed: phase.seed });
            }}
          />
        )}

        {phase.name === 'done' && (
          <Results questions={questions} answers={answers} onRetry={() => start(phase.seed)} onNew={() => setPhase({ name: 'setup' })} />
        )}
      </main>
    </div>
  );
}

function ReadingLink({ refs }: { refs: TermRef[] }) {
  const { path } = useLessonScope();
  const r = refs[0];
  if (!r) return null;
  return <Link to={`${path}/reading#${r.section}`}>Review in the reading: {r.label}{r.title ? ` · ${r.title}` : ''}</Link>;
}

function QuestionCard({ question, index, total, onDone }: { question: Question; index: number; total: number; onDone: (id: string) => void }) {
  const [choice, setChoice] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const right = choice === question.entry.id;
  const last = index + 1 === total;

  return (
    <form
      className="quiz-card"
      onSubmit={(e) => {
        e.preventDefault();
        if (!checked) setChecked(true);
        else onDone(choice!);
      }}
    >
      <p className="quiz-progress">Question {index + 1} of {total}</p>
      <fieldset>
        <legend className="quiz-prompt"><Rich text={question.prompt} /></legend>
        <div className="quiz-options">
          {question.options.map((o) => {
            const state = !checked ? '' : o.id === question.entry.id ? ' correct' : o.id === choice ? ' wrong' : '';
            return (
              <label key={o.id} className={`quiz-option${state}${o.id === choice ? ' chosen' : ''}`}>
                <input type="radio" name="option" value={o.id} checked={o.id === choice} disabled={checked} onChange={() => setChoice(o.id)} />
                <span>{o.term}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="quiz-feedback" aria-live="polite">
        {checked && (
          <>
            <p className={right ? 'good' : 'bad'}>
              {right ? 'Correct.' : <>Not quite. The answer is <strong>{question.entry.term}</strong>.</>}
            </p>
            {!right && <p className="small"><ReadingLink refs={question.refs} /></p>}
          </>
        )}
      </div>
      <button type="submit" className="primary" disabled={!choice} autoFocus={checked}>
        {!checked ? 'Check answer' : last ? 'See results' : 'Next question'}
      </button>
    </form>
  );
}

function Results({ questions, answers, onRetry, onNew }: { questions: Question[]; answers: string[]; onRetry: () => void; onNew: () => void }) {
  const missed = questions.filter((q, i) => answers[i] !== q.entry.id);
  const score = questions.length - missed.length;
  return (
    <section className="quiz-results" aria-live="polite">
      <h2>You got {score} of {questions.length}{score === questions.length ? '. Well done!' : '.'}</h2>
      {missed.length > 0 && (
        <>
          <h3>Terms to review</h3>
          <dl className="glossary">
            {missed.map((q) => (
              <div key={q.entry.id} className="g-entry">
                <dt>{q.entry.term}</dt>
                <dd>
                  <Rich text={q.entry.definition} />
                  <span className="g-refs"><ReadingLink refs={q.refs} /></span>
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
      <div className="quiz-actions">
        <button type="button" onClick={onRetry}>Retry these questions</button>
        <button type="button" className="primary" onClick={onNew}>New quiz</button>
      </div>
    </section>
  );
}
