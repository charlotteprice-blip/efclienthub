// Checks WCAG 2.2 contrast for every colour pairing the Client Hub uses.
// Text pairs need 4.5:1. Non text pairs (borders, accent bars, focus rings,
// status icons) need 3:1. Exits with code 1 if any pair fails.
//
//   node scripts/check-contrast.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = join(dirname(new URL(import.meta.url).pathname), '..');
const t = JSON.parse(readFileSync(join(root, 'brand/tokens.json'), 'utf8'));
const app = JSON.parse(readFileSync(join(root, 'brand/app-colours.json'), 'utf8'));
const clientTypes = JSON.parse(readFileSync(join(root, 'public/config/client-types.json'), 'utf8'));
app.accents = Object.fromEntries(Object.entries(clientTypes.types).map(([k, v]) => [k, { accent: v.accent }]));

function luminance(hex) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function ratio(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const L = t.themes.light;
const I = t.themes.inverted;
const grounds = { 'sky ground': L.ground, 'warm white panel': L.panel };

const checks = [
  ['ink on sky ground', L.ink, L.ground, 4.5],
  ['ink on warm white panel', L.onPanel, L.panel, 4.5],
  ['error on sky ground', L.error, L.ground, 4.5],
  ['error on warm white panel', L.error, L.panel, 4.5],
  ['input border (slate) on warm white panel', L.focus, L.panel, 3],
  ['inverted ink on navy', I.ink, I.ground, 4.5],
  ['inverted error on navy', I.error, I.ground, 4.5],
  ['navy on sky (inverted panel)', I.onPanel, I.panel, 4.5],
];

for (const [name, s] of Object.entries(app.status)) {
  for (const [gName, g] of Object.entries(grounds)) checks.push([`status ${name} on ${gName}`, s.text, g, 4.5]);
  checks.push([`status ${name} on its own tint`, s.text, s.tint, 4.5]);
}
for (const [name, a] of Object.entries(app.accents)) {
  for (const [gName, g] of Object.entries(grounds)) checks.push([`accent ${name} (non text) on ${gName}`, a.accent, g, 3]);
}

let failed = 0;
for (const [name, fg, bg, min] of checks) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failed += 1;
  console.log(`${ok ? 'pass' : 'FAIL'}  ${r.toFixed(2)}:1  (needs ${min}:1)  ${name}  ${fg} on ${bg}`);
}
if (failed) {
  console.error(`\n${failed} pairing(s) fail.`);
  process.exit(1);
}
console.log('\nAll pairings pass.');
