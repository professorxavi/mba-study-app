import { useEffect } from 'react';
import { Link, Outlet, useLocation, useMatches, useNavigation, useRouteLoaderData } from 'react-router';
import type { ClassData, LessonData } from '../router';

function Breadcrumb() {
  const cls = useRouteLoaderData('class') as ClassData | undefined;
  const lesson = useRouteLoaderData('lesson') as LessonData | undefined;
  if (!cls) return null;
  const base = `/${cls.outline.id}`;
  return (
    <ol className="crumbs">
      <li><Link to={base}>{cls.outline.code}</Link></li>
      {lesson && (
        <>
          <li><Link to={`${base}#m-${lesson.module.id}`}>Module {lesson.module.id}</Link></li>
          <li><Link to={`${base}/${lesson.module.id}/${lesson.lesson.id}`}>Lesson {lesson.lesson.id}</Link></li>
        </>
      )}
    </ol>
  );
}

/** Scroll to the URL's #section (or a highlighted glossary term) once the page has rendered; otherwise to the top. */
function useScrollToTarget() {
  const { pathname, hash, key } = useLocation();
  const params = useMatches().at(-1)?.params ?? {};
  const target = hash ? decodeURIComponent(hash.slice(1)) : params.termId ? `g-${params.termId}` : '';
  useEffect(() => {
    const el = target ? document.getElementById(target) : null;
    if (el) el.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, target, key]);
}

export function Layout() {
  const loading = useNavigation().state === 'loading';
  useScrollToTarget();
  return (
    <>
      <header className="topbar">
        <nav className="bar" aria-label="Breadcrumb">
          <Link to="/" className="brand">Study Notes</Link>
          <Breadcrumb />
        </nav>
        <div className={`loading-bar${loading ? ' on' : ''}`} aria-hidden="true" />
      </header>
      <Outlet />
    </>
  );
}
