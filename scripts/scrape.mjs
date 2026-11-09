// Drafts a reading chapter from a textbook PDF: headings, paragraphs, bullet lists, callout boxes and figure/table captions.
// Running headers/footers and page numbers are dropped, line-end hyphens joined, and broken fi/fl ligatures repaired
// against an English word list. The draft is a starting point: tables, figure placement and box extents need a review pass.
//
// Usage: node scripts/scrape.mjs <pdf> <out.json> [--pages 1-5] [--until "3.2 "]
//   --pages  page range to read (default: all)
//   --until  stop before the first heading starting with this text (e.g. a section the reading only starts)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const require = createRequire(import.meta.url);
const WORDS = new Set(require('an-array-of-english-words'));

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const pageSpec = opt('pages');
const until = opt('until');
const [pdfPath, outPath] = args;
if (!pdfPath || !outPath) {
  console.error('Usage: node scripts/scrape.mjs <pdf> <out.json> [--pages 1-5] [--until "3.2 "]');
  process.exit(1);
}

// ---------- read positioned lines ----------

const doc = await getDocument({ data: new Uint8Array(await readFile(pdfPath)), verbosity: 0 }).promise;
const [p0, p1] = pageSpec ? pageSpec.split('-').map(Number) : [1, doc.numPages];

/** Lines per page: { page, y, x, size, height, runs: [{ text, font }] }. y grows downward. */
const lines = [];
for (let n = p0; n <= (p1 ?? p0); n++) {
  const page = await doc.getPage(n);
  const { height } = page.getViewport({ scale: 1 });
  const { items } = await page.getTextContent();
  const pageLines = [];
  for (const it of items) {
    if (!it.str) continue;
    const y = height - it.transform[5];
    const size = Math.round(Math.hypot(it.transform[2], it.transform[3]) * 10) / 10;
    let line = pageLines.find((l) => Math.abs(l.y - y) <= Math.max(2, size * 0.3));
    if (!line) pageLines.push((line = { page: n, y, height, size: 0, items: [] }));
    line.items.push({ x: it.transform[4], w: it.width, text: it.str, font: it.fontName, size });
  }
  for (const l of pageLines) {
    l.items.sort((a, b) => a.x - b.x);
    l.x = l.items[0].x;
    // A line's size is its most common size by characters.
    const bySize = new Map();
    for (const i of l.items) bySize.set(i.size, (bySize.get(i.size) ?? 0) + i.text.length);
    l.size = [...bySize].sort((a, b) => b[1] - a[1])[0][0];
    // Merge items into font runs, adding a space where pdf.js left a visible gap.
    l.runs = [];
    let prevEnd = null;
    for (const i of l.items) {
      const gap = prevEnd === null ? 0 : i.x - prevEnd;
      const text = (gap > i.size * 0.2 && !/\s$/.test(l.runs.at(-1)?.text ?? '') && !/^\s/.test(i.text) ? ' ' : '') + i.text;
      const last = l.runs.at(-1);
      if (last && last.font === i.font) last.text += text;
      else l.runs.push({ text, font: i.font });
      prevEnd = i.x + i.w;
    }
    l.text = l.runs.map((r) => r.text).join('').replace(/\s+/g, ' ').trim();
  }
  lines.push(...pageLines.filter((l) => l.text).sort((a, b) => a.y - b.y));
}

// ---------- ligatures ----------
// Some fonts decode a fi/fl/ff ligature glyph as one wrong letter ("crst" for "first", "proGt" for "profit"), and which
// letter stands for which ligature differs per font. Learn each font's substitutions from words with only one possible
// repair, then apply just those, so "dat" becomes "flat" (not "fiat") in a font where d stands for fl.
const LIGS = ['fi', 'fl', 'ff', 'ffi', 'ffl'];
const isWord = (w) => WORDS.has(w.toLowerCase());
const needsRepair = (w) => w.length >= 3 && /^[A-Za-z]+$/.test(w) && !isWord(w);

/** Repairs of `word` as [letter, ligature, repaired] (one or two substitutions), limited to `allowed` letter → ligature. */
function candidates(word, allowed) {
  const ok = (letter, lig) => !allowed || allowed.get(letter) === lig;
  const out = [];
  for (let i = 0; i < word.length; i++) {
    for (const lig of LIGS) {
      if (!ok(word[i], lig)) continue;
      const cand = word.slice(0, i) + lig + word.slice(i + 1);
      if (isWord(cand)) out.push([word[i], lig, cand]);
      for (let j = i + 1; j < word.length; j++) {
        for (const lig2 of LIGS) {
          if (!ok(word[j], lig2)) continue;
          const at = j + lig.length - 1;
          const c2 = cand.slice(0, at) + lig2 + cand.slice(at + 1);
          if (isWord(c2)) out.push([word[i], lig, c2]);
        }
      }
    }
  }
  return out;
}

const votes = new Map();
for (const l of lines) {
  for (const r of l.runs) {
    for (const w of r.text.match(/[A-Za-z]+/g) ?? []) {
      if (!needsRepair(w)) continue;
      const c = candidates(w);
      if (c.length !== 1) continue;
      const key = `${r.font}|${c[0][0]}|${c[0][1]}`;
      votes.set(key, (votes.get(key) ?? 0) + 1);
    }
  }
}
const ligMap = new Map();
for (const [key, n] of [...votes].sort((a, b) => b[1] - a[1])) {
  const [font, letter, lig] = key.split('|');
  const m = ligMap.get(font) ?? new Map();
  if (n >= 2 && !m.has(letter) && ![...m.values()].includes(lig)) m.set(letter, lig);
  ligMap.set(font, m);
}
for (const l of lines) {
  for (const r of l.runs) {
    const allowed = ligMap.get(r.font);
    if (!allowed?.size) continue;
    r.text = r.text.replace(/[A-Za-z]+/g, (w) => (needsRepair(w) ? candidates(w, allowed)[0]?.[2] ?? w : w));
  }
  l.text = l.runs.map((r) => r.text).join('').replace(/\s+/g, ' ').trim();
}

// ---------- page furniture ----------

const furnitureKey = (t) => t.replace(/\d+/g, '#').toLowerCase();
const seen = new Map();
for (const l of lines) {
  if (l.y < 60 || l.y > l.height - 60) seen.set(furnitureKey(l.text), (seen.get(furnitureKey(l.text)) ?? 0) + 1);
}
const isFurniture = (l) =>
  (l.y < 60 || l.y > l.height - 60) && (seen.get(furnitureKey(l.text)) > 1 || /^\d+$/.test(l.text) || /access for free at/i.test(l.text));
const body = lines.filter((l) => !isFurniture(l));

// The most common size (by characters) is body text; its most common x is the left margin.
const tally = (key) => {
  const m = new Map();
  for (const l of body) m.set(key(l), (m.get(key(l)) ?? 0) + l.text.length);
  return [...m].sort((a, b) => b[1] - a[1])[0][0];
};
const bodySize = tally((l) => l.size);
const margin = tally((l) => (l.size === bodySize ? Math.round(l.x) : -1));
const bodyFont = (() => {
  const m = new Map();
  for (const l of body) if (l.size === bodySize) for (const r of l.runs) m.set(r.font, (m.get(r.font) ?? 0) + r.text.length);
  return [...m].sort((a, b) => b[1] - a[1])[0][0];
})();
const headingSizes = [...new Set(body.filter((l) => l.size > bodySize * 1.12).map((l) => l.size))].sort((a, b) => b - a);

// ---------- text repair ----------

/** Joins wrapped lines: a line-end hyphen is dropped when the joined word is a real word. */
function joinLines(parts) {
  let out = '';
  for (const p of parts) {
    if (!out) out = p;
    else if (/[a-z]-$/i.test(out)) {
      const head = out.match(/([A-Za-z]+)-$/)[1];
      const tail = p.match(/^[A-Za-z]+/)?.[0] ?? '';
      out = WORDS.has((head + tail).toLowerCase()) ? out.slice(0, -1) + p : out + p;
    } else out += ' ' + p;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Rich text for a run of lines: non-body fonts inside body text become {strong} (bold key terms). */
function richFor(group) {
  const pieces = [];
  group.forEach((l, li) => {
    l.runs.forEach((r, ri) => {
      let text = r.text;
      if (ri === 0) text = text.replace(/^\s+/, '');
      if (ri === l.runs.length - 1) text = text.replace(/\s+$/, '');
      if (ri === 0 && li > 0) {
        const prev = pieces.at(-1);
        const prevText = prev ? (typeof prev === 'string' ? prev : prev.strong) : '';
        if (/[a-z]-$/i.test(prevText)) {
          const head = prevText.match(/([A-Za-z]+)-$/)[1];
          const tail = text.match(/^[A-Za-z]+/)?.[0] ?? '';
          if (WORDS.has((head + tail).toLowerCase())) {
            if (typeof prev === 'string') pieces[pieces.length - 1] = prev.slice(0, -1);
            else prev.strong = prev.strong.slice(0, -1);
          } else text = text;
        } else text = ' ' + text;
      }
      const emphasised = r.font !== bodyFont && l.size === bodySize && r.text.trim().length > 1 && group.some((g) => g.runs.some((x) => x.font === bodyFont));
      const last = pieces.at(-1);
      if (emphasised) {
        const lead = text.match(/^\s*/)[0];
        if (lead) pieces.push(lead);
        if (last && typeof last === 'object' && !lead) last.strong += text.trimEnd();
        else pieces.push({ strong: text.trim() });
        const trail = text.match(/\s*$/)[0];
        if (trail) pieces.push(trail);
      } else if (typeof last === 'string') pieces[pieces.length - 1] = last + text;
      else pieces.push(text);
    });
  });
  const fixed = pieces
    .map((p) => (typeof p === 'string' ? p.replace(/\s+/g, ' ') : { strong: p.strong.replace(/\s+/g, ' ') }))
    .filter((p) => (typeof p === 'string' ? p.length > 0 : p.strong.length > 0));
  return fixed.length === 1 && typeof fixed[0] === 'string' ? fixed[0].trim() : fixed;
}

// ---------- blocks ----------

const BOX = /^(learning objectives|link it up|clear it up|work it out|bring it home|introduction to .*|key concepts|self-check.*|exercises?|try it|watch it|glossary)$/i;
const CAPTION = /^(figure|table)\s+\d+(\.\d+)*[a-z]?\b/i;
const CAPTION_UPPER = /^(FIGURE|TABLE)\s+\d/;
const BULLET = /^[•▪●◦·]\s*/;
const SECTION = /^(\d+(\.\d+)+)\s+(.*)$/;

/** A figure/table caption: an uppercase label (OpenStax) or a label set apart from the text margin; "Table 3.1 shows…" in a paragraph is not. */
const isCaption = (l) => CAPTION.test(l.text) && (CAPTION_UPPER.test(l.text) || Math.abs(l.x - margin) > 30);
const slug = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const chapterId = path.basename(outPath, '.json');
const sections = [];
let section = null;
let box = null;
const target = () => (box ? box.blocks : section.blocks);
const startSection = (sec, title) => {
  box = null;
  section = { id: `${chapterId}-${sec ? sec.replace(/\./g, '-') : slug(title) || 'intro'}`, ...(sec ? { sec } : {}), ...(title ? { title } : {}), blocks: [] };
  sections.push(section);
};
startSection(null, null);
section.id = `${chapterId}-intro`;

let i = 0;
const lineGap = (a, b) => (a.page === b.page ? b.y - a.y : Infinity);
let chapterTitle = '';

/** Table cells from a line: items split wherever the horizontal gap is wider than a space. */
function cells(l) {
  const out = [];
  let prevEnd = null;
  for (const it of l.items) {
    const t = it.text.trim();
    if (!t) continue;
    if (prevEnd !== null && it.x - prevEnd < it.size * 0.9 && out.length) out[out.length - 1] += ' ' + t;
    else out.push(t);
    prevEnd = it.x + it.w;
  }
  return out;
}

/** "Link it up" holds one paragraph and "Learning objectives" ends with its list; other boxes end at the next heading
 * or when the text returns to the body font (box text is set in its own font). */
const closeShortBox = (kind) => {
  if (!box) return;
  if ((/^link it up$/i.test(box.label) && kind === 'p') || (/^learning objectives$/i.test(box.label) && kind === 'list')) box = null;
};
const mainFont = (group) => {
  const m = new Map();
  for (const l of group) for (const r of l.runs) m.set(r.font, (m.get(r.font) ?? 0) + r.text.length);
  return [...m].sort((a, b) => b[1] - a[1])[0][0];
};

while (i < body.length) {
  const l = body[i];

  // Callout boxes (checked first: their labels can be heading-sized).
  if (BOX.test(l.text) && l.text.length < 40) {
    box = { type: 'box', label: l.text.toUpperCase() === l.text ? l.text[0] + l.text.slice(1).toLowerCase() : l.text, blocks: [] };
    section.blocks.push(box);
    i++;
    continue;
  }

  // Section and sub-headings.
  if (headingSizes.includes(l.size) && !isCaption(l)) {
    const group = [l];
    while (i + 1 < body.length && body[i + 1].size === l.size && lineGap(body[i], body[i + 1]) < l.size * 1.6) group.push(body[++i]);
    i++;
    const text = joinLines(group.map((g) => g.text));
    if (until && text.startsWith(until)) break;
    const m = text.match(SECTION);
    if (m) {
      chapterTitle ||= text;
      startSection(m[1], m[3]);
    } else if (box && box.blocks.length === 0) box.blocks.push({ type: 'h', text });
    else {
      box = null;
      section.blocks.push({ type: 'h', text });
    }
    continue;
  }

  // Figure and table captions: the caption line plus following lines at the same x and size.
  if (isCaption(l)) {
    const group = [l];
    while (i + 1 < body.length && Math.abs(body[i + 1].x - l.x) < 4 && lineGap(body[i], body[i + 1]) < l.size * 1.8 && !isCaption(body[i + 1])) group.push(body[++i]);
    i++;
    const text = joinLines(group.map((g) => g.text));
    const label = text.match(CAPTION)[0];
    box = null;
    section.blocks.push({ type: 'figure', label: label[0].toUpperCase() + label.slice(1).toLowerCase(), caption: text.slice(label.length).trim() });
    continue;
  }

  // Bullet lists: one item per bullet, continuation lines indented past the bullet.
  if (BULLET.test(l.text)) {
    const items = [];
    while (i < body.length && BULLET.test(body[i].text)) {
      const group = [body[i]];
      while (i + 1 < body.length && !BULLET.test(body[i + 1].text) && body[i + 1].x > body[i].x + 2 && lineGap(body[i], body[i + 1]) < bodySize * 1.8) group.push(body[++i]);
      const rich = richFor(group);
      items.push(typeof rich === 'string' ? rich.replace(BULLET, '') : [rich[0].replace?.(BULLET, '') ?? rich[0], ...rich.slice(1)]);
      i++;
    }
    target().push({ type: 'list', items });
    closeShortBox('list');
    continue;
  }

  // Text set away from the margin is table rows or figure art. Rows followed by a TABLE caption become a table draft;
  // anything else is kept visible for the review pass.
  if (Math.abs(l.x - margin) > 30) {
    const group = [l];
    while (i + 1 < body.length && Math.abs(body[i + 1].x - margin) > 30 && !isCaption(body[i + 1]) && !BULLET.test(body[i + 1].text)) group.push(body[++i]);
    i++;
    box = null;
    const rows = group.map(cells);
    const next = body[i];
    if (next && /^table/i.test(next.text) && isCaption(next) && rows.length > 1) {
      const width = Math.max(...rows.map((r) => r.length));
      section.blocks.push({ type: 'table', columns: rows[0].concat(Array(width - rows[0].length).fill('')), rows: rows.slice(1).map((r) => r.concat(Array(width - r.length).fill(''))) });
    } else {
      section.blocks.push({ type: 'figure', label: 'REVIEW: text from a figure or table', caption: group.map((g) => g.text).join(' | ') });
    }
    continue;
  }

  // Paragraphs: break on a larger vertical gap, a first-line indent, or a change of size.
  const group = [l];
  const normalGap = bodySize * 1.6;
  while (i + 1 < body.length) {
    const a = body[i];
    const b = body[i + 1];
    const indent = b.x > margin + 6 && Math.abs(a.x - margin) < 3;
    const breaks = (x) => headingSizes.includes(x.size) || BULLET.test(x.text) || isCaption(x) || BOX.test(x.text) || Math.abs(x.x - margin) > 30;
    if (b.size !== a.size || lineGap(a, b) > normalGap || indent || breaks(b)) {
      // A paragraph continued on the next page starts at the top margin with no indent.
      if (a.page !== b.page && b.size === a.size && !indent && !/[.!?:"”]$/.test(a.text) && !breaks(b)) {
        group.push(body[++i]);
        continue;
      }
      break;
    }
    group.push(body[++i]);
  }
  i++;
  const font = mainFont(group);
  if (box && !/^(link it up|learning objectives)$/i.test(box.label)) {
    box.font ??= font;
    if (font !== box.font && font === bodyFont) box = null;
  }
  target().push({ type: 'p', text: richFor(group) });
  closeShortBox('p');
}

const draft = {
  order: 0,
  id: chapterId,
  label: 'CHAPTER',
  navLabel: 'Ch',
  title: chapterTitle.replace(SECTION, '$3') || chapterId,
  navTitle: chapterTitle.replace(SECTION, '$3') || chapterId,
  sourceTag: '',
  sections: sections.filter((s) => s.blocks.length > 0),
};
// Box fonts were only needed while drafting.
const strip = (blocks) =>
  blocks.forEach((x) => {
    delete x.font;
    if (x.blocks) strip(x.blocks);
  });
draft.sections.forEach((x) => strip(x.blocks));
await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(draft, null, 2) + '\n');
const count = (t) => JSON.stringify(draft).split(`"type":"${t}"`).length - 1;
console.log(`wrote ${outPath}: ${draft.sections.length} sections, ${count('p')} paragraphs, ${count('list')} lists, ${count('box')} boxes, ${count('figure')} figure/review blocks`);
console.log(`body ${bodySize}pt at x≈${margin}; heading sizes ${headingSizes.join(', ')}`);
