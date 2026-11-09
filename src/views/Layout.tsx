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

const INPUT = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

/** Scroll to the URL's #section (or a highlighted glossary term) once the page has rendered; otherwise to the top. */
function useScrollToTarget() {
  const { pathname, hash, key } = useLocation();
  const params = useMatches().at(-1)?.params ?? {};
  const target = hash ? decodeURIComponent(hash.slice(1)) : params.termId ? `g-${params.termId}` : '';
  useEffect(() => {
    const el = target ? document.getElementById(target) : null;
    if (!el) return void window.scrollTo(0, 0);
    const jump = () => el.scrollIntoView({ behavior: 'instant' });
    jump();
    // Charts above the target settle their height after measuring their width; keep the target in view
    // while that happens, until the reader scrolls on their own.
    const page = new ResizeObserver(jump);
    page.observe(document.body);
    const stop = () => {
      page.disconnect();
      clearTimeout(timer);
      for (const type of INPUT) window.removeEventListener(type, stop);
    };
    const timer = setTimeout(stop, 1500);
    for (const type of INPUT) window.addEventListener(type, stop, { passive: true });
    return stop;
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
