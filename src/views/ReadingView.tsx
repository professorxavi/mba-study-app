import { Link, useLoaderData } from 'react-router';
import { Chapter } from '../components/Chapter';
import { Toc } from '../components/Toc';
import { useClassScope, useLessonScope } from '../content/context';
import type { Chapter as ChapterData } from '../content/types';
import { LessonHeader } from './LessonHeader';

export function ReadingView() {
  const chapters = useLoaderData() as ChapterData[];
  const { outline } = useClassScope();
  const { path } = useLessonScope();
  return (
    <div className="page">
      <Toc chapters={chapters} />
      <main>
        <LessonHeader view="Reading">
          <p className="muted">
            The full text of this lesson's readings. For the key points, see the <Link to={path}>summary</Link>; sources are listed under{' '}
            <Link to={`/${outline.id}/credits`}>credits</Link>.
          </p>
        </LessonHeader>
        {chapters.length === 0 ? (
          <p className="muted">The reading for this lesson hasn't been added yet.</p>
        ) : (
          chapters.map((c) => <Chapter key={c.id} chapter={c} />)
        )}
      </main>
    </div>
  );
}
