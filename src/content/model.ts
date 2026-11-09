// Pure helpers over content data, shared by the app and the Node content scripts (imported with .ts extensions so Node can run them).
import type { Block, Chapter, GlossaryEntry, Rich, Summary, TermRef } from './types.ts';

/** Rich text flattened to a plain string. */
export function plainText(r: Rich): string {
  if (typeof r === 'string') return r;
  return r.map((p) => (typeof p === 'string' ? p : plainText(Object.values(p)[0] as Rich))).join('');
}

/** Every {"term"} mark in a block tree. */
export function termMarks(b: Block): Rich[] {
  const fromRich = (r: Rich): Rich[] =>
    typeof r === 'string'
      ? []
      : r.flatMap((p) => {
          if (typeof p === 'string') return [];
          if ('term' in p) return [p.term];
          return fromRich(Object.values(p)[0] as Rich);
        });
  switch (b.type) {
    case 'p':
    case 'quote':
    case 'h':
      return fromRich(b.text);
    case 'list':
      return b.items.flatMap((item) =>
        typeof item === 'string' || Array.isArray(item) ? fromRich(item) : [...fromRich(item.text), ...termMarks(item.sub)],
      );
    case 'example':
    case 'box':
      return b.blocks.flatMap(termMarks);
    case 'table':
      return b.rows.flatMap((row) => row.flatMap(fromRich));
    case 'chart':
    case 'figure':
      return fromRich(b.caption);
    default:
      return []; // unknown block types are reported by validateClass
  }
}

const norm = (s: string) => s.trim().toLowerCase();

/** Texts that refer to a glossary entry: its term, its aliases, and the term without a trailing "(WTP)"-style note. */
export function glossaryKeys(g: GlossaryEntry): string[] {
  const bare = g.term.replace(/\s*\([^)]*\)\s*$/, '');
  return [...new Set([g.term, bare, ...(g.aliases ?? [])].map(norm))];
}

/** Resolves a {"term"} mark to its glossary entry by its text (see glossaryKeys; case-insensitive). */
export function glossaryLookup(entries: GlossaryEntry[]): (mark: Rich) => GlossaryEntry | undefined {
  const byKey = new Map<string, GlossaryEntry>();
  for (const g of entries) for (const k of glossaryKeys(g)) byKey.set(k, g);
  return (mark) => byKey.get(norm(plainText(mark)));
}

export interface SectionRef {
  id: string;
  chapterId: string;
  /** e.g. "Ch 1.1 §1.2" or "Ch 3.2". */
  label: string;
  title?: string;
}

export function sectionRefs(chapters: Chapter[]): SectionRef[] {
  return chapters.flatMap((ch) =>
    ch.sections.map((s) => ({
      id: s.id,
      chapterId: ch.id,
      label: s.sec ? `${ch.navLabel} §${s.sec}` : ch.navLabel,
      title: s.title,
    })),
  );
}

/** A lesson's content as the scripts load it from disk. `key` is "module/lesson". */
export interface LessonContent {
  key: string;
  summary: Summary;
  reading: Chapter[];
}

/** Glossary id → every section (summary and reading, all lessons) that marks the term, in reading order. */
export function buildAppearsIn(entries: GlossaryEntry[], lessons: LessonContent[]): Record<string, TermRef[]> {
  const lookup = glossaryLookup(entries);
  const out: Record<string, TermRef[]> = {};
  for (const lesson of lessons) {
    for (const [view, chapters] of [['summary', lesson.summary.chapters], ['reading', lesson.reading]] as const) {
      for (const ref of sectionRefs(chapters)) {
        const section = chapters.find((c) => c.id === ref.chapterId)!.sections.find((s) => s.id === ref.id)!;
        for (const mark of section.blocks.flatMap(termMarks)) {
          const entry = lookup(mark);
          if (!entry) continue;
          const list = (out[entry.id] ??= []);
          if (!list.some((r) => r.lesson === lesson.key && r.view === view && r.section === ref.id)) {
            list.push({ lesson: lesson.key, view, section: ref.id, label: ref.label, ...(ref.title ? { title: ref.title } : {}) });
          }
        }
      }
    }
  }
  return out;
}

/** "Module 1: Title" style display names. */
export const moduleName = (id: string, title: string) => `Module ${id}: ${title}`;
export const lessonName = (id: string, title: string) => `Lesson ${id}: ${title}`;
