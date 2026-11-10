// Content validation, run by the content scripts before anything is written to Firestore (and by tests on fixtures).
import katex from 'katex';
import { buildAppearsIn, glossaryLookup, plainText, termMarks, type LessonContent } from './model.ts';
import { INLINE_KINDS, type Block, type Chapter, type ChartData, type ChartSpec, type ClassOutline, type Credit, type GlossaryEntry, type Rich } from './types.ts';

const BLOCK_TYPES = new Set(['p', 'list', 'example', 'table', 'quote', 'chart', 'h', 'figure', 'box', 'equation']);
const ID = /^[a-z0-9][a-z0-9-]*$/;
/** Class-level page names that a module id would collide with in URLs. */
const RESERVED = new Set(['glossary', 'credits']);

function checkRich(r: unknown, where: string, errors: string[]): void {
  if (typeof r === 'string') return;
  if (!Array.isArray(r)) return void errors.push(`${where}: rich text must be a string or array`);
  r.forEach((piece, i) => {
    if (typeof piece === 'string') return;
    const keys = piece && typeof piece === 'object' ? Object.keys(piece) : [];
    if (keys.length !== 1 || !(INLINE_KINDS as readonly string[]).includes(keys[0])) {
      errors.push(`${where}[${i}]: inline must have exactly one key of ${INLINE_KINDS.join('/')}`);
    } else {
      checkRich((piece as Record<string, unknown>)[keys[0]], `${where}[${i}].${keys[0]}`, errors);
    }
  });
}

function checkBlock(b: Block, where: string, chartIds: Set<string>, errors: string[]): void {
  if (!b || !BLOCK_TYPES.has(b.type)) return void errors.push(`${where}: unknown block type "${b?.type}"`);
  switch (b.type) {
    case 'p':
    case 'quote':
    case 'h':
      return checkRich(b.text, where, errors);
    case 'list':
      return b.items.forEach((item, i) => {
        if (typeof item === 'string' || Array.isArray(item)) return checkRich(item, `${where}.items[${i}]`, errors);
        checkRich(item.text, `${where}.items[${i}].text`, errors);
        checkBlock(item.sub, `${where}.items[${i}].sub`, chartIds, errors);
      });
    case 'example':
    case 'box':
      return b.blocks.forEach((child, i) => checkBlock(child, `${where}.blocks[${i}]`, chartIds, errors));
    case 'table':
      return b.rows.forEach((row, i) => {
        if (row.length !== b.columns.length) errors.push(`${where}.rows[${i}]: ${row.length} cells, ${b.columns.length} columns`);
        row.forEach((cell, j) => checkRich(cell, `${where}.rows[${i}][${j}]`, errors));
      });
    case 'figure':
      return checkRich(b.caption, where, errors);
    case 'chart':
      checkRich(b.caption, where, errors);
      return b.charts.forEach((id) => {
        if (!chartIds.has(id)) errors.push(`${where}: unknown chart "${id}"`);
      });
    case 'equation':
      try {
        katex.renderToString(b.tex, { displayMode: true, throwOnError: true });
      } catch (e) {
        errors.push(`${where}: equation does not parse: ${(e as Error).message}`);
      }
      return;
  }
}

function checkChapters(chapters: Chapter[], where: string, chartIds: Set<string>, errors: string[]): void {
  const ids = new Set<string>();
  const seen = (id: string, at: string) => {
    if (!id || !ID.test(id)) errors.push(`${at}: id "${id}" must be lowercase letters, digits and dashes`);
    if (ids.has(id)) errors.push(`${at}: duplicate id "${id}"`);
    ids.add(id);
  };
  for (const ch of chapters) {
    seen(ch.id, `${where}/${ch.id}`);
    for (const s of ch.sections) {
      seen(s.id, `${where}/${ch.id}/${s.id}`);
      s.blocks.forEach((b, i) => checkBlock(b, `${where}/${s.id}[${i}]`, chartIds, errors));
    }
  }
}

function checkCharts(data: ChartData, where: string, errors: string[]): void {
  const ids = new Set<string>();
  for (const chart of data.charts) {
    if (ids.has(chart.id)) errors.push(`${where}: duplicate chart id "${chart.id}"`);
    ids.add(chart.id);
    if (chart.kind === 'circular-flow' && !chart.flow) errors.push(`${where}/${chart.id}: a circular-flow chart needs "flow"`);
    checkKind(chart, `${where}/${chart.id}`, errors);
    const curveIds = new Set((chart.curves ?? []).map((cv) => cv.id));
    for (const curve of chart.curves ?? []) {
      if (curve.shape === 'steps' && !(curve.schedule && data.schedules[curve.schedule])) {
        errors.push(`${where}/${chart.id}: curve ${curve.id} needs a known schedule`);
      }
      if (curve.shape !== 'steps' && !curve.points?.length) errors.push(`${where}/${chart.id}: curve ${curve.id} needs points`);
    }
    for (const area of chart.areas ?? []) {
      const curve = chart.curves?.find((cv) => cv.id === area.curve);
      if (!curve?.schedule) errors.push(`${where}/${chart.id}: area references curve "${area.curve}" without a schedule`);
    }
    for (const id of chart.interactive?.shift?.curves ?? []) {
      if (!curveIds.has(id)) errors.push(`${where}/${chart.id}: interactive shift names unknown curve "${id}"`);
    }
  }
}

/** Shape checks for the share, scatter and matrix kinds and for category axes. */
function checkKind(chart: ChartSpec, at: string, errors: string[]): void {
  if (chart.kind === 'share') {
    const sh = chart.share;
    if (!sh?.parts?.length || !sh.bars?.length) return void errors.push(`${at}: a share chart needs "share" with parts and bars`);
    for (const b of sh.bars) {
      if (b.values.length !== sh.parts.length) errors.push(`${at}: bar "${b.label}" has ${b.values.length} values for ${sh.parts.length} parts`);
      if (sh.unit === '%' && Math.abs(b.values.reduce((a, v) => a + v, 0) - 100) > 0.5) errors.push(`${at}: bar "${b.label}" does not add up to 100%`);
    }
  }
  if (chart.kind === 'scatter') {
    const sc = chart.scatter;
    if (!sc?.points?.length) return void errors.push(`${at}: a scatter chart needs "scatter" with points`);
    for (const p of sc.points) if ([p.x, p.y].some((v) => !(v >= 0 && v <= 10))) errors.push(`${at}: point "${p.label}" is outside 0–10`);
  }
  if (chart.kind === 'matrix') {
    const cells = chart.matrix?.cells;
    if (!(cells?.length === 2 && cells.every((r) => r.length === 2 && r.every((c) => c.text?.trim())))) errors.push(`${at}: a matrix chart needs 2×2 "cells" with text`);
  }
  if (chart.xCategories) {
    const n = chart.xCategories.length;
    for (const c of chart.curves ?? []) {
      for (const [px] of c.points ?? []) if (!Number.isInteger(px) || px < 0 || px >= n) errors.push(`${at}: curve ${c.id} has x = ${px}, not a category index (0–${n - 1})`);
    }
  }
}

/** A class as loaded from a content folder. `lessonFolders` lists the "module/lesson" folders found on disk. */
export interface ClassBundle {
  folder: string;
  outline: ClassOutline;
  glossary: GlossaryEntry[];
  credits: Credit[];
  lessons: (LessonContent & { charts: ChartData })[];
  lessonFolders: string[];
}

/** Returns a list of problems; empty means the class is safe to upload. */
export function validateClass(c: ClassBundle): string[] {
  const errors: string[] = [];
  const o = c.outline;

  // Outline
  if (o.id !== c.folder) errors.push(`class.json: id "${o.id}" must match its folder "${c.folder}"`);
  if (!ID.test(o.id ?? '')) errors.push(`class.json: id "${o.id}" must be lowercase letters, digits and dashes`);
  if (!o.code?.trim() || !o.title?.trim()) errors.push('class.json: code and title are required');
  if (!o.modules?.length) errors.push('class.json: needs at least one module');
  const outlined: string[] = [];
  const moduleIds = new Set<string>();
  for (const m of o.modules ?? []) {
    if (!ID.test(m.id ?? '') || moduleIds.has(m.id)) errors.push(`class.json: module id "${m.id}" is missing, malformed or repeated`);
    if (RESERVED.has(m.id)) errors.push(`class.json: module id "${m.id}" is reserved for a class page`);
    moduleIds.add(m.id);
    if (!m.title?.trim()) errors.push(`class.json: module ${m.id} needs a title`);
    if (!m.lessons?.length) errors.push(`class.json: module ${m.id} needs at least one lesson`);
    const lessonIds = new Set<string>();
    for (const l of m.lessons ?? []) {
      if (!ID.test(l.id ?? '') || lessonIds.has(l.id)) errors.push(`class.json: lesson id "${l.id}" in module ${m.id} is missing, malformed or repeated`);
      lessonIds.add(l.id);
      if (!l.title?.trim()) errors.push(`class.json: lesson ${m.id}/${l.id} needs a title`);
      outlined.push(`${m.id}/${l.id}`);
    }
  }
  for (const key of outlined) if (!c.lessonFolders.includes(key)) errors.push(`lesson ${key}: listed in class.json but has no folder`);
  for (const key of c.lessonFolders) if (!outlined.includes(key)) errors.push(`lesson ${key}: folder exists but is not listed in class.json`);

  // Glossary
  const termIds = new Set<string>();
  for (const g of c.glossary) {
    if (!ID.test(g.id ?? '')) errors.push(`glossary: id "${g.id}" is malformed`);
    if (termIds.has(g.id)) errors.push(`glossary: duplicate id "${g.id}"`);
    termIds.add(g.id);
    if (!g.term?.trim()) errors.push(`glossary/${g.id}: needs a term`);
    checkRich(g.definition, `glossary/${g.id}`, errors);
  }
  const lookup = glossaryLookup(c.glossary);

  // Lessons
  for (const l of c.lessons) {
    const where = `lesson ${l.key}`;
    checkCharts(l.charts, `${where}/charts`, errors);
    const chartIds = new Set(l.charts.charts.map((ch) => ch.id));
    checkRich(l.summary.intro, `${where}/summary.intro`, errors);
    l.summary.sources.forEach((s, i) => checkRich(s, `${where}/summary.sources[${i}]`, errors));
    checkChapters(l.summary.chapters, `${where}/summary`, chartIds, errors);
    checkChapters(l.reading, `${where}/reading`, chartIds, errors);

    const marks: [string, Rich][] = [
      ...termMarks({ type: 'p', text: l.summary.intro }).map((m) => ['summary.intro', m] as [string, Rich]),
      ...l.summary.chapters.flatMap((ch) => ch.sections.flatMap((s) => s.blocks.flatMap(termMarks).map((m) => [`summary/${s.id}`, m] as [string, Rich]))),
      ...l.reading.flatMap((ch) => ch.sections.flatMap((s) => s.blocks.flatMap(termMarks).map((m) => [`reading/${s.id}`, m] as [string, Rich]))),
    ];
    for (const [at, mark] of marks) if (!lookup(mark)) errors.push(`${where}/${at}: term "${plainText(mark)}" has no glossary entry`);
  }
  const appearsIn = buildAppearsIn(c.glossary, c.lessons);
  for (const g of c.glossary) if (!appearsIn[g.id]) errors.push(`glossary/${g.id}: never marked in any lesson`);

  // Credits
  c.credits.forEach((cr, i) => {
    if (!cr.title?.trim() || !cr.authors?.trim() || !cr.license?.trim()) errors.push(`credits[${i}]: title, authors and license are required`);
    for (const key of cr.usedIn ?? []) if (!outlined.includes(key)) errors.push(`credits[${i}]: usedIn names unknown lesson "${key}"`);
  });

  return errors;
}
