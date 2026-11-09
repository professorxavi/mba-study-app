// Runs the Firebase CLI against the project named in .env, so no project id is committed (no .firebaserc).
// Usage: node --env-file=.env scripts/firebase.mjs <firebase args...>   e.g. `npm run firebase -- deploy --only hosting`
import { spawnSync } from 'node:child_process';

const project = process.env.VITE_FIREBASE_PROJECT_ID;
if (!project) {
  console.error('VITE_FIREBASE_PROJECT_ID is not set. Fill in .env (see .env.example).');
  process.exit(1);
}
const { status } = spawnSync('npx', ['firebase', ...process.argv.slice(2), '--project', project], { stdio: 'inherit', shell: true });
process.exit(status ?? 1);
