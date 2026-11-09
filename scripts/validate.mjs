// Validates local content before upload. Usage: node scripts/validate.mjs [classId ...]  (default: every class in content/)
import { listClasses, loadClass } from './lib/content.mjs';
import { validateClass } from '../src/content/validate.ts';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : await listClasses();
if (!ids.length) {
  console.error('No classes found in content/.');
  process.exit(1);
}
let failed = false;
for (const id of ids) {
  const errors = validateClass(await loadClass(id));
  if (errors.length) {
    failed = true;
    console.error(`✗ ${id}: ${errors.length} problem(s)`);
    for (const e of errors) console.error(`  - ${e}`);
  } else {
    console.log(`✓ ${id}`);
  }
}
process.exit(failed ? 1 : 0);
