// Loads a class from a local content folder (gitignored) into the shape validateClass() expects.
// Layout: <root>/<classId>/class.json, glossary.json, credits.json, <module>/<lesson>/summary.json, charts.json, reading/<chapter>.json
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const CONTENT_ROOT = path.resolve('content');

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const isDir = async (p) => (await stat(p).catch(() => null))?.isDirectory() ?? false;
const subdirs = async (p) => {
  const out = [];
  for (const name of await readdir(p).catch(() => [])) if (await isDir(path.join(p, name))) out.push(name);
  return out;
};

/** Reading chapters, ordered by an `order` field in each file (then file name). */
async function loadReading(dir) {
  const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.json'));
  const chapters = await Promise.all(files.map(async (f) => ({ file: f, ...(await readJson(path.join(dir, f))) })));
  chapters.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.file.localeCompare(b.file));
  return chapters.map(({ file: _file, order: _order, ...ch }) => ch);
}

export async function loadClass(classId, root = CONTENT_ROOT) {
  const dir = path.join(root, classId);
  if (!(await isDir(dir))) throw new Error(`No content folder at ${dir}`);
  const outline = await readJson(path.join(dir, 'class.json'));
  const glossary = await readJson(path.join(dir, 'glossary.json')).catch(() => []);
  const credits = await readJson(path.join(dir, 'credits.json')).catch(() => []);

  const lessonFolders = [];
  const lessons = [];
  for (const m of await subdirs(dir)) {
    for (const l of await subdirs(path.join(dir, m))) {
      const ldir = path.join(dir, m, l);
      lessonFolders.push(`${m}/${l}`);
      lessons.push({
        key: `${m}/${l}`,
        summary: await readJson(path.join(ldir, 'summary.json')),
        charts: await readJson(path.join(ldir, 'charts.json')).catch(() => ({ schedules: {}, charts: [] })),
        reading: await loadReading(path.join(ldir, 'reading')),
      });
    }
  }
  return { folder: classId, outline, glossary, credits, lessons, lessonFolders };
}

export async function listClasses(root = CONTENT_ROOT) {
  return subdirs(root);
}
