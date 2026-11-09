// Reads course content from Firestore. Content bodies are JSON strings in a `body` field (see scripts/upload.mjs).
import { collection, doc, getDoc, getDocs, orderBy, query, type DocumentSnapshot } from 'firebase/firestore';
import type { Chapter, ChartData, ClassOutline, Credit, Glossary, Summary } from '../content/types';
import { firestore } from './firebase';

const cache = new Map<string, Promise<unknown>>();

/** One request per key per visit; a failed request is forgotten so it can be retried. */
function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load().catch((e) => {
      cache.delete(key);
      throw e;
    });
    cache.set(key, p);
  }
  return p;
}

const body = <T>(snap: DocumentSnapshot): T | null => (snap.exists() ? (JSON.parse(snap.get('body')) as T) : null);
const read = async <T>(path: string): Promise<T | null> => body<T>(await getDoc(doc(firestore(), path)));
const lessonPath = (c: string, m: string, l: string) => `classes/${c}/lessons/${m}-${l}`;

export const listClasses = () =>
  once('classes', async () => {
    const snap = await getDocs(collection(firestore(), 'classes'));
    return snap.docs.map((d) => body<ClassOutline>(d)!).sort((a, b) => a.code.localeCompare(b.code));
  });

export const getClass = (c: string) => once(`class:${c}`, () => read<ClassOutline>(`classes/${c}`));

export const getGlossary = (c: string) =>
  once(`glossary:${c}`, async () => (await read<Glossary>(`classes/${c}/meta/glossary`)) ?? { entries: [], appearsIn: {} });

export const getCredits = (c: string) => once(`credits:${c}`, async () => (await read<Credit[]>(`classes/${c}/meta/credits`)) ?? []);

export const getLesson = (c: string, m: string, l: string) =>
  once(`lesson:${c}/${m}/${l}`, async () => {
    const [summary, charts] = await Promise.all([
      read<Summary>(lessonPath(c, m, l)),
      read<ChartData>(`${lessonPath(c, m, l)}/parts/charts`),
    ]);
    return summary ? { summary, charts: charts ?? { schedules: {}, charts: [] } } : null;
  });

export const getReading = (c: string, m: string, l: string) =>
  once(`reading:${c}/${m}/${l}`, async () => {
    const snap = await getDocs(query(collection(firestore(), `${lessonPath(c, m, l)}/reading`), orderBy('order')));
    return snap.docs.map((d) => body<Chapter>(d)!);
  });
