// Copies the logic and settings the browser and the Cloud Functions share
// into functions/shared, so both apply identical rules. Runs automatically
// before every functions deploy, emulator start and test run.
//
//   node scripts/sync-functions.mjs

import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = join(dirname(new URL(import.meta.url).pathname), '..');
const out = join(root, 'functions/shared');
mkdirSync(out, { recursive: true });
for (const [from, to] of [
  ['public/js/intake-rules.js', 'intake-rules.js'],
  ['public/js/scoring.js', 'scoring.js'],
  ['public/js/formulation.js', 'formulation.js'],
  ['public/config/intake.json', 'intake.json'],
  ['public/config/client-types.json', 'client-types.json'],
]) {
  copyFileSync(join(root, from), join(out, to));
}
console.log('Synced shared logic into functions/shared');
