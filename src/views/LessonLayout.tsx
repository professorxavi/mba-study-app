import { useMemo } from 'react';
import { NavLink, Outlet, useLoaderData } from 'react-router';
import { LessonContext, useClassScope } from '../content/context';
import { lessonQuizTerms } from '../quiz/glossaryQuiz';
import type { LessonData } from '../router';

const TABS: [string, string][] = [
  ['', 'Summary'],
  ['reading', 'Reading'],
  ['glossary', 'Glossary'],
];

export function LessonLayout() {
  const { summary, charts, module, lesson } = useLoaderData() as LessonData;
  const { outline, glossary } = useClassScope();
  const path = `/${outline.id}/${module.id}/${lesson.id}`;
  const scope = useMemo(() => {
    const byId = new Map(charts.charts.map((c) => [c.id, c]));
    return { key: `${module.id}/${lesson.id}`, module, lesson, path, summary, charts, chart: (id: string) => byId.get(id) };
  }, [summary, charts, module, lesson, path]);

  // The quiz is built from the glossary terms this lesson's reading marks; without any, there is no Quiz tab.
  const tabs = useMemo(
    () => (lessonQuizTerms(glossary, scope.key).length > 0 ? [...TABS, ['quiz', 'Quiz'] as [string, string]] : TABS),
    [glossary, scope.key],
  );

  return (
    <LessonContext.Provider value={scope}>
      <div className="subbar">
        <nav className="tabs" aria-label="Lesson views">
          {tabs.map(([to, label]) => (
            <NavLink key={label} to={to ? `${path}/${to}` : path} end>{label}</NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </LessonContext.Provider>
  );
}
