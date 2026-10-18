// Loads questionnaires into the Client Hub library from JSON files.
// Only Charlotte adds questionnaires, and only ones whose licence allows
// use; commercial instruments are never reproduced in the hub.
//
//   npm run measures -- list
//   npm run measures -- check  path/to/measure.json     validate only
//   npm run measures -- upload path/to/measure.json     validate, then save
//
// A file holds 1 measure, or { "measures": [ ... ] }. licenceStatus must be
// "cleared" for use with clients, or "sample" for testing only. Files built
// by npm run codebook may also hold "review" and "permission" entries;
// check accepts them, upload refuses them.
// Needs: gcloud auth application-default login

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { scoreMeasure } from '../public/js/scoring.js';

const [command, file] = process.argv.slice(2);
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
const STATUSES = ['cleared', 'sample'];
const KNOWN = [...STATUSES, 'review', 'permission'];

export function problems(m) {
  const out = [];
  if (!/^[a-z0-9-]{3,60}$/.test(m.id ?? '')) out.push('id must be 3 to 60 lowercase letters, digits or hyphens');
  if (!m.name) out.push('name is missing');
  if (!KNOWN.includes(m.licenceStatus)) out.push(`licenceStatus must be ${KNOWN.join(', ')}`);
  if (!Array.isArray(m.items) || !m.items.length) out.push('items are missing');
  if (!Array.isArray(m.responseOptions) || m.responseOptions.length < 2) out.push('responseOptions need at least 2 options');
  const ids = new Set((m.items ?? []).map((i) => i.id));
  if (ids.size !== (m.items ?? []).length) out.push('item ids must be unique');
  for (const i of m.items ?? []) if (!i.text) out.push(`item ${i.id} has no text`);
  const subs = m.scoringRules?.subscales ?? [];
  if (!subs.length) out.push('scoringRules.subscales are missing');
  const used = subs.flatMap((s) => s.items ?? []);
  for (const id of used) if (!ids.has(id)) out.push(`subscale refers to unknown item ${id}`);
  for (const id of m.scoringRules?.reverseItems ?? []) if (!ids.has(id)) out.push(`reverse item ${id} is unknown`);
  for (const id of (m.scoringRules?.flagItems ?? []).map((f) => f.itemId)) if (!ids.has(id)) out.push(`flag item ${id} is unknown`);
  for (const s of subs) {
    if (!Array.isArray(s.bands)) out.push(`subscale ${s.id} has no bands list (use [] for numbers only)`);
    if (s.topic?.url && !/^https:\/\/app\.executiveframe\.co\.nz\//.test(s.topic.url)) out.push(`subscale ${s.id} topic must link to the Learning Hub`);
  }
  if (!out.length) {
    const all = Object.fromEntries(m.items.map((i) => [i.id, m.responseOptions[0].value]));
    if (!scoreMeasure(m, all).complete) out.push('a full set of answers does not score as complete');
  }
  return out;
}

function load(path) {
  const json = JSON.parse(readFileSync(path, 'utf8'));
  return json.measures ?? [json];
}

async function admin() {
  const { initializeApp, applicationDefault } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = initializeApp({ credential: applicationDefault(), projectId: process.env.CLIENTHUB_PROJECT ?? 'ef-client-hub' });
  return getFirestore(app, 'clienthub');
}

if (isMain && (!['list', 'check', 'upload'].includes(command) || (command !== 'list' && !file))) {
  console.error('\nUsage:\n  npm run measures -- list\n  npm run measures -- check <file.json>\n  npm run measures -- upload <file.json>\n');
  process.exit(1);
}

if (isMain && command === 'list') {
  const db = await admin();
  const snap = await db.collection('measures').get();
  if (snap.empty) console.log('\nThe library is empty.\n');
  for (const d of snap.docs) console.log(`${d.id.padEnd(28)} ${String(d.data().licenceStatus).padEnd(8)} ${d.data().items?.length ?? 0} items  ${d.data().name}`);
  process.exit(0);
}

const measures = isMain ? load(file) : [];
let bad = 0;
for (const m of measures) {
  const p = problems(m);
  if (p.length) {
    bad += 1;
    console.log(`\x1b[31m${m.id ?? '(no id)'}\x1b[0m`);
    for (const x of p) console.log(`  ${x}`);
  } else {
    console.log(`\x1b[32m${m.id}\x1b[0m ${m.items.length} items, ${m.scoringRules.subscales.length} subscales, ${m.licenceStatus}`);
  }
}
if (bad) process.exit(1);
if (isMain && command === 'upload') {
  const held = measures.filter((m) => !STATUSES.includes(m.licenceStatus));
  if (held.length) {
    console.error(`\nRefusing to upload: ${held.map((m) => `${m.id} (${m.licenceStatus})`).join(', ')}. Only cleared or sample questionnaires go into the library. Upload measures/cleared.json instead.\n`);
    process.exit(1);
  }
  const db = await admin();
  for (const m of measures) {
    const { _note, ...doc } = m;
    await db.doc(`measures/${m.id}`).set({ ...doc, updatedAt: Date.now() });
    await db.collection('auditLog').add({ actorUid: 'terminal', action: 'uploaded questionnaire', targetUid: null, measureId: m.id, at: Date.now() });
  }
  console.log(`\nSaved ${measures.length} questionnaire${measures.length === 1 ? '' : 's'} to the library.\n`);
}
