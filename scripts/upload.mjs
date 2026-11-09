// Validates a class from the local content folder, then writes it to Firestore with the Admin SDK.
// Usage: node --env-file=.env scripts/upload.mjs <classId> [--check]
//   --check  only compare Firestore with the local files; write nothing.
// Credentials: Application Default Credentials (`gcloud auth application-default login`).
//
// Firestore layout (every content body is a JSON string in `body`; Firestore can't hold nested arrays):
//   classes/{classId}                                 outline (+ code, title for listing)
//   classes/{classId}/meta/glossary                   { entries, appearsIn }
//   classes/{classId}/meta/credits                    credits
//   classes/{classId}/lessons/{m}-{l}                 summary
//   classes/{classId}/lessons/{m}-{l}/parts/charts    charts
//   classes/{classId}/lessons/{m}-{l}/reading/{chId}  one reading chapter (+ order)
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { buildAppearsIn } from '../src/content/model.ts';
import { validateClass } from '../src/content/validate.ts';
import { loadClass } from './lib/content.mjs';

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const classId = args.find((a) => !a.startsWith('--'));
const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
if (!classId) {
  console.error('Usage: node --env-file=.env scripts/upload.mjs <classId> [--check]');
  process.exit(1);
}
if (!projectId) {
  console.error('VITE_FIREBASE_PROJECT_ID is not set. Fill in .env (see .env.example).');
  process.exit(1);
}

const bundle = await loadClass(classId);
const errors = validateClass(bundle);
if (errors.length) {
  console.error(`✗ ${classId}: ${errors.length} problem(s). Nothing was written.`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

/** Every document this class should have: path → { body, ...extra fields }. */
const docs = new Map();
const put = (p, data, extra = {}) => docs.set(p, { body: JSON.stringify(data), ...extra });
const base = `classes/${classId}`;
put(base, bundle.outline, { code: bundle.outline.code, title: bundle.outline.title });
put(`${base}/meta/glossary`, { entries: bundle.glossary, appearsIn: buildAppearsIn(bundle.glossary, bundle.lessons) });
put(`${base}/meta/credits`, bundle.credits);
for (const l of bundle.lessons) {
  const lp = `${base}/lessons/${l.key.replace('/', '-')}`;
  put(lp, l.summary);
  put(`${lp}/parts/charts`, l.charts);
  l.reading.forEach((ch, i) => put(`${lp}/reading/${ch.id}`, ch, { order: i }));
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

/** Paths of every document currently stored under the class. */
async function existing() {
  const out = [];
  const walk = async (ref) => {
    for (const col of await ref.listCollections()) {
      for (const d of (await col.listDocuments())) {
        const snap = await d.get();
        if (snap.exists) out.push(d.path);
        await walk(d);
      }
    }
  };
  const root = db.doc(base);
  if ((await root.get()).exists) out.push(base);
  await walk(root);
  return out;
}

async function compare() {
  let diffs = 0;
  for (const [p, want] of docs) {
    const snap = await db.doc(p).get();
    if (!snap.exists) {
      console.error(`  missing: ${p}`);
      diffs++;
    } else if (snap.get('body') !== want.body) {
      console.error(`  differs: ${p}`);
      diffs++;
    }
  }
  for (const p of await existing()) {
    if (!docs.has(p)) {
      console.error(`  extra:   ${p}`);
      diffs++;
    }
  }
  return diffs;
}

if (!checkOnly) {
  const stale = (await existing()).filter((p) => !docs.has(p));
  const writes = [...docs].map(([p, data]) => (b) => b.set(db.doc(p), { ...data, updatedAt: FieldValue.serverTimestamp() }));
  const deletes = stale.map((p) => (b) => b.delete(db.doc(p)));
  const ops = [...writes, ...deletes];
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    ops.slice(i, i + 400).forEach((op) => op(batch));
    await batch.commit();
  }
  console.log(`wrote ${writes.length} document(s), deleted ${deletes.length} stale document(s) in ${projectId}`);
  for (const p of stale) console.log(`  deleted: ${p}`);
}

const diffs = await compare();
if (diffs) {
  console.error(`✗ ${classId}: Firestore differs from local content in ${diffs} place(s).`);
  process.exit(1);
}
console.log(`✓ ${classId}: Firestore matches local content (${docs.size} documents).`);
