import { Link, Navigate, useLoaderData, useLocation } from 'react-router';
import type { ClassOutline } from '../content/types';
import { useTitle } from './useTitle';

/** Links from the single-lesson version of the site (#ch3-2, #/glossary/x, #/quiz) now live under MBA 702 › Module 1 › Lesson 1. */
function legacyTarget(hash: string): string | null {
  if (!hash || hash === '#') return null;
  const lesson = '/mba-702/1/1';
  if (hash.startsWith('#/glossary')) return `/mba-702/glossary${hash.slice('#/glossary'.length)}`;
  if (hash.startsWith('#/quiz') || hash === '#/') return lesson;
  if (hash.startsWith('#/')) return null;
  return `${lesson}${hash}`;
}

export function HomeView() {
  const classes = useLoaderData() as ClassOutline[];
  const legacy = legacyTarget(useLocation().hash);
  useTitle([]);
  if (legacy) return <Navigate to={legacy} replace />;

  return (
    <div className="page single">
      <main>
        <header className="intro">
          <p className="eyebrow">Study notes</p>
          <h1>Classes</h1>
        </header>
        {classes.length === 0 ? (
          <p className="muted">No classes have been added yet.</p>
        ) : (
          <ul className="cards">
            {classes.map((c) => (
              <li key={c.id}>
                <Link to={`/${c.id}`} className="card">
                  <span className="card-code">{c.code}</span>
                  <span className="card-title">{c.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
