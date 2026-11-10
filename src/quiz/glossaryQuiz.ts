// Multiple-choice questions built from the glossary: show a term's definition (with the term blanked out), pick the term.
import { glossaryKeys } from '../content/model';
import type { Glossary, GlossaryEntry, Rich, TermRef } from '../content/types';

export interface Question {
  entry: GlossaryEntry;
  /** The definition with the term (and its aliases) replaced by a blank. */
  prompt: Rich;
  /** Option entries in display order; exactly one is `entry`. */
  options: GlossaryEntry[];
  /** Where the term appears in this lesson's reading, for review. */
  refs: TermRef[];
}

export const OPTION_COUNT = 4;
const BLANK = '_____';

/** Small seeded generator (mulberry32) so a quiz can be rebuilt from its seed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Glossary entries the lesson's reading marks, with the reading places they appear. */
export function lessonQuizTerms(glossary: Glossary, lessonKey: string): { entry: GlossaryEntry; refs: TermRef[] }[] {
  return glossary.entries
    .map((entry) => ({ entry, refs: (glossary.appearsIn[entry.id] ?? []).filter((r) => r.lesson === lessonKey && r.view === 'reading') }))
    .filter((t) => t.refs.length > 0);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Blanks out every way of naming the entry (term, bare term, aliases, simple plurals) inside rich text. */
export function maskTerm(definition: Rich, entry: GlossaryEntry): Rich {
  const names = glossaryKeys(entry).flatMap((k) => [k, `${k}s`, `${k}es`, k.replace(/y$/, 'ies')]);
  // Longest first so "broad cost leadership strategy" is blanked whole before "cost leadership".
  const pattern = new RegExp(`\\b(${[...new Set(names)].sort((a, b) => b.length - a.length).map(escape).join('|')})\\b`, 'gi');
  const mask = (r: Rich): Rich =>
    typeof r === 'string'
      ? r.replace(pattern, BLANK)
      : r.map((p) => (typeof p === 'string' ? (mask(p) as string) : { [Object.keys(p)[0]]: mask(Object.values(p)[0] as Rich) } as typeof p));
  return mask(definition);
}

/**
 * Builds `count` questions (clamped to the lesson's terms) from the lesson's glossary terms.
 * Wrong options come from the same lesson first, then from the rest of the class glossary.
 */
export function buildGlossaryQuiz(glossary: Glossary, lessonKey: string, count: number, seed: number): Question[] {
  const rand = rng(seed);
  const terms = lessonQuizTerms(glossary, lessonKey);
  const n = Math.max(0, Math.min(Math.floor(count), terms.length));
  const lessonIds = new Set(terms.map((t) => t.entry.id));
  const others = glossary.entries.filter((e) => !lessonIds.has(e.id));
  return shuffle(terms, rand)
    .slice(0, n)
    .map(({ entry, refs }) => {
      const pool = [...shuffle(terms.map((t) => t.entry).filter((e) => e.id !== entry.id), rand), ...shuffle(others, rand)];
      const wrong = pool.slice(0, OPTION_COUNT - 1);
      return { entry, prompt: maskTerm(entry.definition, entry), options: shuffle([entry, ...wrong], rand), refs };
    });
}
