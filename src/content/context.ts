// The class and lesson currently shown, provided by their route layouts to everything rendered inside them.
import { createContext, useContext } from 'react';
import type { ChartData, ChartSpec, ClassOutline, Glossary, GlossaryEntry, LessonOutline, ModuleOutline, Rich, Summary } from './types';

export interface ClassScope {
  outline: ClassOutline;
  glossary: Glossary;
  /** Glossary entry for a {"term"} mark. */
  lookup: (mark: Rich) => GlossaryEntry | undefined;
}

export interface LessonScope {
  /** "module/lesson", as used by glossary references. */
  key: string;
  module: ModuleOutline;
  lesson: LessonOutline;
  /** Path of the lesson, e.g. "/mba-702/1/1". */
  path: string;
  summary: Summary;
  charts: ChartData;
  chart: (id: string) => ChartSpec | undefined;
}

export const ClassContext = createContext<ClassScope | null>(null);
export const LessonContext = createContext<LessonScope | null>(null);

export function useClassScope(): ClassScope {
  const v = useContext(ClassContext);
  if (!v) throw new Error('useClassScope outside a class route');
  return v;
}

export function useLessonScope(): LessonScope {
  const v = useContext(LessonContext);
  if (!v) throw new Error('useLessonScope outside a lesson route');
  return v;
}
