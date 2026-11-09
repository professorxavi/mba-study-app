// Marks glossary terms in a lesson's reading: the first mention of each term in each section becomes a {"term"} mark,
// which the app shows as a definition popover. Safe to re-run: a term already marked in a section is left alone.
// Usage: node scripts/mark-terms.mjs <classId> <module>/<lesson>      e.g. node scripts/mark-terms.mjs mba-702 1/1
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { glossaryKeys, glossaryLookup } from '../src/content/model.ts';
import { CONTENT_ROOT } from './lib/content.mjs';

const [classId, lessonKey] = process.argv.slice(2);
if (!classId || !lessonKey) {
  console.error('Usage: node scripts/mark-terms.mjs <classId> <module>/<lesson>');
  process.exit(1);
}
const classDir = path.join(CONTENT_ROOT, classId);
const readingDir = path.join(classDir, ...lessonKey.split('/'), 'reading');
const glossary = JSON.parse(await readFile(path.join(classDir, 'glossary.json'), 'utf8'));
const lookup = glossaryLookup(glossary);

// Every key → entry id, longest first so "consumer surplus" wins over "surplus" at the same spot.
const keys = glossary.flatMap((g) => glossaryKeys(g).map((k) => ({ key: k, id: g.id }))).sort((a, b) => b.key.length - a.key.length);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = new RegExp(`\\b(${keys.map((k) => escape(k.key)).join('|')})\\b`, 'gi');
const idFor = (text) => keys.find((k) => k.key === text.toLowerCase())?.id;

/** Marks first mentions inside rich text; `marked` holds entry ids already marked in this section. */
function markRich(rich, marked) {
  const pieces = typeof rich === 'string' ? [rich] : rich;
  let changed = false;
  const out = pieces.flatMap((p) => {
    if (typeof p !== 'string') {
      const [kind, value] = Object.entries(p)[0];
      if (kind === 'term') return [p];
      const inner = markRich(value, marked);
      changed ||= inner.changed;
      return [{ [kind]: inner.rich }];
    }
    const parts = [];
    let last = 0;
    for (const m of p.matchAll(pattern)) {
      const id = idFor(m[0]);
      if (!id || marked.has(id)) continue; // a later mention, or one inside a longer term already marked
      marked.add(id);
      parts.push(p.slice(last, m.index), { term: m[0] });
      last = m.index + m[0].length;
      changed = true;
    }
    parts.push(p.slice(last));
    return parts.filter((x) => x !== '');
  });
  return { rich: out.length === 1 && typeof out[0] === 'string' ? out[0] : out, changed };
}

// Headings, tables, figure captions and chart captions are left unmarked.
function markBlock(block, marked) {
  let n = 0;
  const apply = (rich) => {
    const r = markRich(rich, marked);
    if (r.changed) n++;
    return r.rich;
  };
  switch (block.type) {
    case 'p':
    case 'quote':
      block.text = apply(block.text);
      break;
    case 'list':
      block.items = block.items.map((item) => {
        if (typeof item === 'string' || Array.isArray(item)) return apply(item);
        item.text = apply(item.text);
        n += markBlock(item.sub, marked);
        return item;
      });
      break;
    case 'example':
    case 'box':
      for (const b of block.blocks) n += markBlock(b, marked);
      break;
  }
  return n;
}

/** Entry ids already marked anywhere in a block tree. */
function existingMarks(blocks) {
  const ids = new Set();
  const walk = (x) => {
    if (Array.isArray(x)) return x.forEach(walk);
    if (x && typeof x === 'object') {
      if ('term' in x) {
        const e = lookup(x.term);
        if (e) ids.add(e.id);
      }
      Object.values(x).forEach(walk);
    }
  };
  walk(blocks);
  return ids;
}

const files = (await readdir(readingDir)).filter((f) => f.endsWith('.json'));
let total = 0;
for (const f of files) {
  const file = path.join(readingDir, f);
  const chapter = JSON.parse(await readFile(file, 'utf8'));
  let n = 0;
  for (const section of chapter.sections) {
    const marked = existingMarks(section.blocks);
    for (const b of section.blocks) n += markBlock(b, marked);
  }
  await writeFile(file, JSON.stringify(chapter, null, 2) + '\n');
  console.log(`${f}: marked terms in ${n} block(s)`);
  total += n;
}
console.log(`done: ${total} block(s) changed in ${files.length} chapter(s)`);
