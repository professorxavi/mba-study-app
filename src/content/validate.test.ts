import { describe, expect, it } from 'vitest';
import type { Chapter, ChartData } from './types';
import { buildAppearsIn, glossaryLookup } from './model';
import { validateClass, type ClassBundle } from './validate';

// A small made-up class: course content itself lives in Firestore, never in the repo.
const charts: ChartData = {
  schedules: { s1: { description: 'test', provenance: 'derived', steps: [{ from: 0, to: 1, value: 2 }] } },
  charts: [{ id: 'c1', kind: 'xy', title: 'T', figure: 'F', source: { pdf: '', page: 0 }, provenance: 'derived', curves: [{ id: 'D', label: 'D', role: 'demand', shape: 'steps', schedule: 's1' }] }],
};
const chapter = (id: string, text: unknown[]): Chapter => ({
  id, label: 'CH', navLabel: 'Ch 1', title: 'Title', navTitle: 'Title', sourceTag: 'Tag',
  sections: [{ id: `${id}-a`, sec: '1.1', title: 'A', blocks: [{ type: 'p', text: text as never }, { type: 'chart', charts: ['c1'], caption: 'cap' }] }],
});

function fixture(): ClassBundle {
  return {
    folder: 'test-101',
    outline: { id: 'test-101', code: 'TEST 101', title: 'Testing', modules: [{ id: '1', title: 'Basics', lessons: [{ id: '1', title: 'First' }] }] },
    glossary: [{ id: 'widget', term: 'widget', aliases: ['widgets'], definition: 'A thing.' }],
    credits: [{ title: 'Book', authors: 'A. Author', license: 'CC BY 4.0', usedIn: ['1/1'] }],
    lessons: [{
      key: '1/1',
      summary: { intro: ['About ', { term: 'widgets' }], sources: ['Book'], chapters: [chapter('ch1', ['A ', { term: 'widget' }, '.'])] },
      reading: [chapter('r1', ['Full text about a ', { term: 'Widget' }, '.'])],
      charts,
    }],
    lessonFolders: ['1/1'],
  };
}

describe('validateClass', () => {
  it('accepts a well-formed class', () => {
    expect(validateClass(fixture())).toEqual([]);
  });

  it('rejects term marks with no glossary entry', () => {
    const c = fixture();
    c.lessons[0].reading = [chapter('r1', [{ term: 'gadget' }])];
    expect(validateClass(c)).toContain('lesson 1/1/reading/r1-a: term "gadget" has no glossary entry');
  });

  it('rejects unknown charts, bad inline marks and unknown block types', () => {
    const c = fixture();
    const blocks = c.lessons[0].summary.chapters[0].sections[0].blocks;
    blocks.push({ type: 'chart', charts: ['nope'], caption: '' }, { type: 'p', text: [{ bold: 'x' } as never] }, { type: 'video' } as never);
    const errors = validateClass(c);
    expect(errors.some((e) => e.includes('unknown chart "nope"'))).toBe(true);
    expect(errors.some((e) => e.includes('inline must have exactly one key'))).toBe(true);
    expect(errors.some((e) => e.includes('unknown block type "video"'))).toBe(true);
  });

  it('requires class.json and the lesson folders to match', () => {
    const c = fixture();
    c.lessonFolders = ['1/1', '1/2'];
    c.outline.modules[0].lessons.push({ id: '3', title: 'Third' });
    const errors = validateClass(c);
    expect(errors).toContain('lesson 1/3: listed in class.json but has no folder');
    expect(errors).toContain('lesson 1/2: folder exists but is not listed in class.json');
  });

  it('requires titles, matching ids and unreserved module ids', () => {
    const c = fixture();
    c.outline.id = 'other';
    c.outline.modules[0].title = '';
    c.outline.modules.push({ id: 'glossary', title: 'X', lessons: [] });
    const errors = validateClass(c);
    expect(errors).toContain('class.json: id "other" must match its folder "test-101"');
    expect(errors).toContain('class.json: module 1 needs a title');
    expect(errors).toContain('class.json: module id "glossary" is reserved for a class page');
  });

  it('flags glossary entries that are never marked and credits for unknown lessons', () => {
    const c = fixture();
    c.glossary.push({ id: 'gizmo', term: 'gizmo', definition: 'Unused.' });
    c.credits[0].usedIn = ['9/9'];
    const errors = validateClass(c);
    expect(errors).toContain('glossary/gizmo: never marked in any lesson');
    expect(errors).toContain('credits[0]: usedIn names unknown lesson "9/9"');
  });
});

describe('glossary lookup', () => {
  it('matches a term without its trailing parenthetical, plus aliases, ignoring case', () => {
    const lookup = glossaryLookup([{ id: 'wtp', term: 'Willingness to pay (WTP)', aliases: ['max WTP'], definition: 'x' }]);
    expect(lookup('willingness to pay')?.id).toBe('wtp');
    expect(lookup('Willingness to Pay (WTP)')?.id).toBe('wtp');
    expect(lookup('MAX wtp')?.id).toBe('wtp');
    expect(lookup('pay')).toBeUndefined();
  });
});

describe('buildAppearsIn', () => {
  it('lists summary and reading sections per term, matching aliases case-insensitively', () => {
    const c = fixture();
    expect(buildAppearsIn(c.glossary, c.lessons).widget).toEqual([
      { lesson: '1/1', view: 'summary', section: 'ch1-a', label: 'Ch 1 §1.1', title: 'A' },
      { lesson: '1/1', view: 'reading', section: 'r1-a', label: 'Ch 1 §1.1', title: 'A' },
    ]);
  });
});
