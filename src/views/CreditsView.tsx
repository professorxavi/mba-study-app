import { Link, useLoaderData } from 'react-router';
import { useClassScope } from '../content/context';
import type { Credit } from '../content/types';
import { useTitle } from './useTitle';

export function CreditsView() {
  const credits = useLoaderData() as Credit[];
  const { outline } = useClassScope();
  useTitle(['Credits', outline.code]);
  const lessonLabel = (key: string) => {
    const [m, l] = key.split('/');
    return `Module ${m}, Lesson ${l}`;
  };

  return (
    <div className="page single">
      <main>
        <header className="intro">
          <p className="eyebrow">{outline.code}</p>
          <h1>Credits</h1>
          <p className="muted">The readings in this class are adapted from these sources, used under their licenses.</p>
        </header>
        {credits.length === 0 ? (
          <p className="muted">No sources have been listed for this class yet.</p>
        ) : (
          <ul className="credits">
            {credits.map((c, i) => (
              <li key={i}>
                <p className="credit-title">{c.url ? <a href={c.url}>{c.title}</a> : c.title}</p>
                <p>
                  {c.authors}
                  {c.publisher && <>. {c.publisher}</>}.{' '}
                  {c.licenseUrl ? <a href={c.licenseUrl}>{c.license}</a> : c.license}.
                </p>
                {c.usedIn.length > 0 && (
                  <p className="small muted">
                    Used in:{' '}
                    {c.usedIn.map((key, j) => (
                      <span key={key}>
                        {j > 0 && ', '}
                        <Link to={`/${outline.id}/${key}/reading`}>{lessonLabel(key)}</Link>
                      </span>
                    ))}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
