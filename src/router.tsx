// Routes and their data. Each loader reads from Firestore (cached per visit), so a page renders once its data is in.
import { createBrowserRouter, data, type LoaderFunctionArgs } from 'react-router';
import { getClass, getCredits, getGlossary, getLesson, getReading, listClasses } from './data/api';
import { ClassLayout } from './views/ClassLayout';
import { ClassView } from './views/ClassView';
import { CreditsView } from './views/CreditsView';
import { ErrorView } from './views/ErrorView';
import { GlossaryView } from './views/GlossaryView';
import { HomeView } from './views/HomeView';
import { Layout } from './views/Layout';
import { LessonLayout } from './views/LessonLayout';
import { QuizView } from './views/QuizView';
import { ReadingView } from './views/ReadingView';
import { SummaryView } from './views/SummaryView';

const notFound = () => data('Not found', { status: 404 });

async function classLoader({ params }: LoaderFunctionArgs) {
  const [outline, glossary] = await Promise.all([getClass(params.classId!), getGlossary(params.classId!)]);
  if (!outline) throw notFound();
  return { outline, glossary };
}

async function lessonLoader({ params }: LoaderFunctionArgs) {
  const { classId, moduleId, lessonId } = params as Record<string, string>;
  const [outline, lesson] = await Promise.all([getClass(classId), getLesson(classId, moduleId, lessonId)]);
  const mod = outline?.modules.find((m) => m.id === moduleId);
  const les = mod?.lessons.find((l) => l.id === lessonId);
  if (!mod || !les || !lesson) throw notFound();
  return { ...lesson, module: mod, lesson: les };
}

export type ClassData = Awaited<ReturnType<typeof classLoader>>;
export type LessonData = Awaited<ReturnType<typeof lessonLoader>>;

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <ErrorView />,
    children: [
      {
        errorElement: <ErrorView />,
        children: [
          { index: true, element: <HomeView />, loader: () => listClasses() },
          {
            id: 'class',
            path: ':classId',
            element: <ClassLayout />,
            loader: classLoader,
            children: [
              { index: true, element: <ClassView /> },
              { path: 'credits', element: <CreditsView />, loader: ({ params }) => getCredits(params.classId!) },
              { path: 'glossary/:termId?', element: <GlossaryView scope="class" /> },
              {
                id: 'lesson',
                path: ':moduleId/:lessonId',
                element: <LessonLayout />,
                loader: lessonLoader,
                children: [
                  { index: true, element: <SummaryView /> },
                  {
                    path: 'reading',
                    element: <ReadingView />,
                    loader: ({ params }) => getReading(params.classId!, params.moduleId!, params.lessonId!),
                  },
                  { path: 'glossary', element: <GlossaryView scope="lesson" /> },
                  { path: 'quiz', element: <QuizView /> },
                ],
              },
            ],
          },
          { path: '*', loader: () => { throw notFound(); } },
        ],
      },
    ],
  },
]);
