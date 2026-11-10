import { describe, expect, it } from 'vitest';
import { plainText } from '../content/model';
import type { Glossary, GlossaryEntry, TermRef } from '../content/types';
import { buildGlossaryQuiz, lessonQuizTerms, maskTerm } from './glossaryQuiz';

// A made-up glossary: course content itself lives in Firestore, never in the repo.
const entry = (id: string, term: string, definition: GlossaryEntry['definition'], aliases?: string[]): GlossaryEntry => ({ id, term, definition, ...(aliases ? { aliases } : {}) });
const ref = (lesson: string, view: 'summary' | 'reading' = 'reading'): TermRef => ({ lesson, view, section: 's', label: 'Ch 1' });
const glossary: Glossary = {
  entries: [
    entry('widget', 'Widget', 'A widget is a small gadget. Widgets are common.', ['widgets']),
    entry('gizmo', 'Gizmo (G)', [{ strong: 'Gizmo' }, ' means a device; a G for short.']),
    entry('doohickey', 'Doohickey', 'An unnamed part.'),
    entry('thingamajig', 'Thingamajig', 'Something forgotten.'),
    entry('sprocket', 'Sprocket', 'A toothed wheel.'),
    entry('flange', 'Flange', 'A projecting rim.'),
    entry('summary-only', 'Summary only', 'Marked only in a summary.'),
  ],
  appearsIn: {
    widget: [ref('1/1')],
    gizmo: [ref('1/1'), ref('2/1')],
    doohickey: [ref('1/1')],
    sprocket: [ref('2/1')],
    flange: [ref('2/1')],
    'summary-only': [ref('1/1', 'summary')],
  },
};

describe('lessonQuizTerms', () => {
  it('takes only terms marked in the lesson reading', () => {
    expect(lessonQuizTerms(glossary, '1/1').map((t) => t.entry.id).sort()).toEqual(['doohickey', 'gizmo', 'widget']);
    expect(lessonQuizTerms(glossary, '3/1')).toEqual([]);
  });
});

describe('maskTerm', () => {
  it('blanks the term, its aliases, plurals and the bare form, inside styled runs too', () => {
    expect(plainText(maskTerm(glossary.entries[0].definition, glossary.entries[0]))).toBe('A _____ is a small gadget. _____ are common.');
    expect(plainText(maskTerm(glossary.entries[1].definition, glossary.entries[1]))).toBe('_____ means a device; a G for short.');
  });
});

describe('buildGlossaryQuiz', () => {
  it('clamps the count to the lesson terms and asks each term once', () => {
    const quiz = buildGlossaryQuiz(glossary, '1/1', 99, 1);
    expect(quiz).toHaveLength(3);
    expect(new Set(quiz.map((q) => q.entry.id)).size).toBe(3);
    expect(buildGlossaryQuiz(glossary, '1/1', 2, 1)).toHaveLength(2);
    expect(buildGlossaryQuiz(glossary, '3/1', 5, 1)).toEqual([]);
  });

  it('gives four distinct options with the answer exactly once, topping up from the class glossary', () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const q of buildGlossaryQuiz(glossary, '1/1', 3, seed)) {
        const ids = q.options.map((o) => o.id);
        expect(ids).toHaveLength(4);
        expect(new Set(ids).size).toBe(4);
        expect(ids.filter((id) => id === q.entry.id)).toHaveLength(1);
        expect(q.refs.every((r) => r.lesson === '1/1' && r.view === 'reading')).toBe(true);
      }
    }
  });

  it('is repeatable from its seed', () => {
    const ids = (seed: number) => buildGlossaryQuiz(glossary, '2/1', 3, seed).map((q) => [q.entry.id, q.options.map((o) => o.id)]);
    expect(ids(7)).toEqual(ids(7));
  });
});
