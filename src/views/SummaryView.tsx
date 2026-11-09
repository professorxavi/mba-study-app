import { Chapter } from '../components/Chapter';
import { Rich } from '../components/Inline';
import { Toc } from '../components/Toc';
import { useLessonScope } from '../content/context';
import { LessonHeader } from './LessonHeader';

export function SummaryView() {
  const { summary } = useLessonScope();
  return (
    <div className="page">
      <Toc chapters={summary.chapters} />
      <main>
        <LessonHeader view="Summary">
          <p><Rich text={summary.intro} /></p>
          <ol className="sources">
            {summary.sources.map((s, i) => (
              <li key={i}><span>{i + 1}</span><Rich text={s} /></li>
            ))}
          </ol>
        </LessonHeader>
        {summary.chapters.map((c) => <Chapter key={c.id} chapter={c} />)}
      </main>
    </div>
  );
}
