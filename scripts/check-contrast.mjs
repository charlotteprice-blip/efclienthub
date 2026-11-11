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

let failed = 0;
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

// The pack's application colours: every one as text on its own tint (status
// pills and notices) and on the 2 grounds, and each status the app maps
// onto them. The tint is a fill, so it needs no ratio against its ground;
// the icon and word carry the meaning.
for (const [name, a] of Object.entries(t.application)) {
  checks.push([`application ${name} on its own tint`, a.text, a.tint, 4.5]);
  for (const [gName, g] of Object.entries(grounds)) checks.push([`application ${name} on ${gName}`, a.text, g, 4.5]);
  checks.push([`application ${name} on navy`, a.onNavy, I.ground, 4.5]);
}
for (const [name, s] of Object.entries(app.status)) {
  const a = t.application[s.application];
  if (!a) throw new Error(`Status ${name} maps to an unknown application colour ${s.application}`);
  checks.push([`status ${name} (${s.application}) on its own tint`, a.text, a.tint, 4.5]);
}
for (const [kind, name] of Object.entries(app.notice)) {
  const a = t.application[name];
  checks.push([`notice ${kind}: ink on its tint`, L.ink, a.tint, 4.5]);
  checks.push([`notice ${kind}: icon and word on its tint`, a.text, a.tint, 4.5]);
}
checks.push(['primary button: text on navy', L.onPrimary, L.primary, 4.5]);
checks.push(['primary button (non text) on sky', L.primary, L.ground, 3]);
checks.push(['primary button (non text) on warm white', L.primary, L.panel, 3]);
checks.push(['primary button hover: text on slate', L.onPrimary, t.palette.slate, 4.5]);
checks.push(['plain tag: ink on warm white', L.onPanel, L.panel, 4.5]);
for (const [name, a] of Object.entries(app.accents)) {
  for (const [gName, g] of Object.entries(grounds)) checks.push([`accent ${name} (non text) on ${gName}`, a.accent, g, 3]);
}

// Text that used to be muted with opacity, which this script cannot see.
// Each is now a solid colour, or full strength ink, and is checked here.
checks.push(['placeholder text on warm white field', app.text.placeholder.colour, L.panel, 4.5]);
checks.push(['menu link before its page has content (full ink) on sky', L.ink, L.ground, 4.5]);
checks.push(['tracker label for a step not yet done (full ink) on sky', L.ink, L.ground, 4.5]);
checks.push(['menu and foot line during a questionnaire (full ink) on sky', L.ink, L.ground, 4.5]);
checks.push(['map box hint (full ink) on warm white', L.onPanel, L.panel, 4.5]);
// Text on the accent: the selected fit pill and the pressed filter chip.
for (const [name, a] of Object.entries(app.accents)) checks.push([`text on accent ${name} (selected fit pill)`, app.text.onAccent.colour, a.accent, 4.5]);
checks.push(['text on navy (current sub navigation pill)', app.text.onAccent.colour, I.ground, 4.5]);

// The stylesheets must not bring opacity back for text: any opacity below 1
// has to be on this list of places that carry no readable text.
const OPACITY_ALLOWED = [/\.btn\[disabled\]/, /\.choice input/, /\.fit input/, /mark-triangle/, /th \.sort::after/, /fv-rise|from \{|to \{/, /\.fv-faint\b/, /\.fv-dotted/];
for (const file of ['public/css/app.css', 'public/css/components.css']) {
  const css = readFileSync(join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const o = m[2].match(/(?:^|[;\s])opacity:\s*([\d.]+)/);
    if (!o || Number(o[1]) >= 1) continue;
    const selector = m[1].trim();
    const allowed = Number(o[1]) === 0 || OPACITY_ALLOWED.some((re) => re.test(selector));
    if (!allowed) {
      failed += 1;
      console.log(`FAIL  opacity ${o[1]} on "${selector}" in ${file}: muted text must use a solid colour that is checked here`);
    }
  }
}

// Brand pack rules the stylesheets must keep: no shadows anywhere, and no
// colour written into a rule. Every colour is a token (a custom property
// set once at :root) so the palette cannot drift.
for (const file of ['public/css/app.css', 'public/css/components.css']) {
  const css = readFileSync(join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    for (const decl of m[2].split(';')) {
      const [prop, ...rest] = decl.split(':');
      const name = (prop ?? '').trim();
      const value = rest.join(':').trim();
      if (!name || !value) continue;
      if (name === 'box-shadow' && value !== 'none') {
        failed += 1;
        console.log(`FAIL  box-shadow on "${selector}" in ${file}: surfaces are flat, use a border or a change of tone`);
      }
      if (!name.startsWith('--') && !value.startsWith('url(') && /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(value)) {
        failed += 1;
        console.log(`FAIL  colour written into "${selector}" (${name}: ${value}) in ${file}: use a token`);
      }
    }
  }
}

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
