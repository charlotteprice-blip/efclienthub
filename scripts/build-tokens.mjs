// Generates public/css/tokens.css from brand/tokens.json (Levi Wilson's
// interim app brand kit). tokens.css is shared, unchanged, with the
// Learning Hub: run this same script there against the same tokens.json.
// Client Hub specific values live in public/css/app.css, never here.
//
//   node scripts/build-tokens.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = join(dirname(new URL(import.meta.url).pathname), '..');
const t = JSON.parse(readFileSync(join(root, 'brand/tokens.json'), 'utf8'));

const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const px = (n) => `${n}px`;
const lines = [];
const out = (s = '') => lines.push(s);

function themeBlock(theme) {
  return Object.entries(theme).map(([k, v]) => `  --${kebab(k)}: ${v};`).join('\n');
}

out('/* Executive Frame app tokens. Generated from brand/tokens.json by');
out('   scripts/build-tokens.mjs. Do not edit by hand. Shared with the');
out(`   Learning Hub. Source note: ${t._note} */`);
out();
out('@font-face { font-family: "Figtree"; font-style: normal; font-display: swap; font-weight: 300; src: url("/assets/fonts/figtree-latin-300-normal.woff2") format("woff2"); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }');
out('@font-face { font-family: "Figtree"; font-style: normal; font-display: swap; font-weight: 400; src: url("/assets/fonts/figtree-latin-400-normal.woff2") format("woff2"); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }');
out('@font-face { font-family: "Figtree"; font-style: normal; font-display: swap; font-weight: 500; src: url("/assets/fonts/figtree-latin-500-normal.woff2") format("woff2"); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }');
for (const w of t.font.weights) {
  out(`@font-face { font-family: "Figtree"; font-style: normal; font-display: swap; font-weight: ${w}; src: url("/assets/fonts/figtree-latin-ext-${w}-normal.woff2") format("woff2"); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }`);
}
out();
out(':root {');
out('  /* palette */');
for (const [k, v] of Object.entries(t.palette)) out(`  --ef-${kebab(k)}: ${v};`);
out();
out('  /* light theme (default) */');
out(themeBlock(t.themes.light));
out();
out('  /* inverted theme values, for reference by components */');
for (const [k, v] of Object.entries(t.themes.inverted)) out(`  --inv-${kebab(k)}: ${v};`);
out();
out('  /* font */');
out(`  --font-family: "${t.font.family}", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;`);
out();
out('  /* type: size / line height / weight / tracking */');
for (const [name, s] of Object.entries(t.type)) {
  const n = kebab(name);
  out(`  --type-${n}-size: ${px(s.size)};`);
  out(`  --type-${n}-line: ${px(s.lineHeight)};`);
  out(`  --type-${n}-weight: ${s.weight};`);
  out(`  --type-${n}-tracking: ${s.tracking}em;`);
}
out();
out('  /* spacing */');
t.spacing.forEach((v, i) => out(`  --space-${i + 1}: ${px(v)};`));
out();
out('  /* radius */');
for (const [k, v] of Object.entries(t.radius)) out(`  --radius-${kebab(k)}: ${px(v)};`);
out();
out('  /* sizes */');
for (const [k, v] of Object.entries(t.sizes)) out(`  --${kebab(k)}: ${k === 'iconStroke' ? v : px(v)};`);
out();
out('  /* motion */');
out(`  --motion-duration: ${t.motion.durationMs}ms;`);
out(`  --motion-easing: ${t.motion.easing};`);
out(`  --mark-draw-on: ${t.motion.markDrawOnMs}ms;`);
out('}');
out();
out('/* Inverted theme, used for calls to action and emphasis panels. */');
out('[data-theme="inverted"] {');
out(themeBlock(t.themes.inverted));
out('}');
out();
out('@media (prefers-reduced-motion: reduce) {');
out('  :root { --motion-duration: 0ms; --mark-draw-on: 0ms; }');
out('}');

writeFileSync(join(root, 'public/css/tokens.css'), lines.join('\n') + '\n');
console.log('Wrote public/css/tokens.css');
