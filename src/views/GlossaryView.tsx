import { useContext, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Rich } from '../components/Inline';
import { LessonContext, useClassScope } from '../content/context';
import { plainText } from '../content/model';
import type { TermRef } from '../content/types';
import { useTitle } from './useTitle';
import { LessonHeader } from './LessonHeader';

/**
 * scope "class": the master glossary, with every place each term appears.
 * scope "lesson": only terms marked in the current lesson, with that lesson's places.
 */
export function GlossaryView({ scope }: { scope: 'class' | 'lesson' }) {
  const { outline, glossary } = useClassScope();
  const lesson = useContext(LessonContext);
  const highlight = useParams().termId ?? '';
  const [query, setQuery] = useState('');
  useTitle(scope === 'class' ? ['Glossary', outline.code] : null);

  const refsFor = (id: string): TermRef[] => (glossary.appearsIn[id] ?? []).filter((r) => scope === 'class' || r.lesson === lesson?.key);
  const all = glossary.entries.filter((g) => refsFor(g.id).length > 0 || scope === 'class').sort((a, b) => a.term.localeCompare(b.term));
  const q = query.trim().toLowerCase();
  const shown = q ? all.filter((g) => [g.term, ...(g.aliases ?? []), plainText(g.definition)].some((t) => t.toLowerCase().includes(q))) : all;
  const letters = [...new Set(shown.map((g) => g.term[0].toUpperCase()))];

  const href = (r: TermRef) => `/${outline.id}/${r.lesson}${r.view === 'reading' ? '/reading' : ''}#${r.section}`;
  const refLabel = (r: TermRef) => {
    const [m, l] = r.lesson.split('/');
    const where = `${r.view === 'reading' ? 'Reading' : 'Summary'} · ${r.label}${r.title ? ` · ${r.title}` : ''}`;
    return scope === 'class' ? `M${m} L${l} · ${where}` : where;
  };

  const filter = (
    <label className="filter">
      <span>Filter terms</span>
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. surplus" />
    </label>
  );

  return (
    <div className="page">
      <nav className="toc letters" aria-label="Glossary letters">
        <p className="toc-label">A–Z</p>
        <ol>
          {letters.map((l) => (
            <li key={l}>
              <a href={`#g-${shown.find((g) => g.term[0].toUpperCase() === l)!.id}`}>{l}</a>
            </li>
          ))}
        </ol>
      </nav>
      <main>
        {scope === 'lesson' ? (
          <LessonHeader view="Glossary">
            <p className="muted">
              Terms from this lesson. The <Link to={`/${outline.id}/glossary`}>class glossary</Link> has every term in {outline.code}.
            </p>
            {filter}
          </LessonHeader>
        ) : (
          <header className="intro">
            <p className="eyebrow">{outline.code} · Glossary</p>
            <h1>Key terms</h1>
            {filter}
          </header>
        )}
        {all.length === 0 && <p className="muted">No glossary terms yet.</p>}
        {all.length > 0 && shown.length === 0 && <p className="muted">No terms match “{query}”.</p>}
        <dl className="glossary">
          {shown.map((g) => (
            <div key={g.id} id={`g-${g.id}`} className={`g-entry${g.id === highlight ? ' hl' : ''}`}>
              <dt>{g.term}</dt>
              <dd>
                <Rich text={g.definition} />
                {refsFor(g.id).length > 0 && (
                  <span className="g-refs">
                    Appears in:{' '}
                    {refsFor(g.id).map((r, i) => (
                      <span key={`${r.lesson}-${r.view}-${r.section}`}>
                        {i > 0 && ', '}
                        <Link to={href(r)}>{refLabel(r)}</Link>
                      </span>
                    ))}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </main>
    </div>
  );
}
