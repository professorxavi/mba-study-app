import type { ReactNode } from 'react';
import { useClassScope, useLessonScope } from '../content/context';
import { lessonName, moduleName } from '../content/model';
import { useTitle } from './useTitle';

/** "MBA 702 · Module 1: …" eyebrow and "Lesson 1: …" heading shared by the lesson views. */
export function LessonHeader({ view, children }: { view: string; children?: ReactNode }) {
  const { outline } = useClassScope();
  const { module, lesson } = useLessonScope();
  const name = lessonName(lesson.id, lesson.title);
  useTitle([view, name, outline.code]);
  return (
    <header className="intro">
      <p className="eyebrow">{outline.code} · {moduleName(module.id, module.title)}</p>
      <h1>{name}</h1>
      {children}
    </header>
  );
}
