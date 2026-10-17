// Copies the Firebase browser modules and Figtree into public/assets so the
// app loads nothing from outside Firebase Hosting.
//
// Run after `npm install`, and again whenever the firebase or
// @fontsource/figtree versions in package.json change:
//   node scripts/vendor.mjs
//
// The Firebase CDN builds import firebase-app.js from www.gstatic.com.
// That import is rewritten to the local copy.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const root = join(dirname(new URL(import.meta.url).pathname), '..');

// Firebase SDK
const firebaseDir = dirname(require.resolve('firebase/package.json'));
const firebaseVersion = JSON.parse(readFileSync(join(firebaseDir, 'package.json'), 'utf8')).version;
const sdkOut = join(root, 'public/assets/vendor/firebase');
mkdirSync(sdkOut, { recursive: true });

const modules = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js', 'firebase-functions.js'];
const gstatic = /https:\/\/www\.gstatic\.com\/firebasejs\/[^/"']+\/(firebase-[a-z-]+\.js)/g;

for (const name of modules) {
  const source = readFileSync(join(firebaseDir, name), 'utf8');
  const rewritten = source.replace(gstatic, './$1').replace(/\/\/# sourceMappingURL=.*$/m, '');
  if (/https:\/\/www\.gstatic\.com\/firebasejs/.test(rewritten)) {
    throw new Error(`${name} still imports from gstatic after rewriting`);
  }
  writeFileSync(join(sdkOut, name), rewritten);
}
writeFileSync(join(sdkOut, 'VERSION'), `${firebaseVersion}\n`);

// Figtree, Latin and Latin Extended (needed for macrons in te reo Maori)
const fontDir = join(dirname(require.resolve('@fontsource/figtree/package.json')), 'files');
const fontOut = join(root, 'public/assets/fonts');
mkdirSync(fontOut, { recursive: true });
for (const subset of ['latin', 'latin-ext']) {
  for (const weight of [300, 400, 500]) {
    const file = `figtree-${subset}-${weight}-normal.woff2`;
    copyFileSync(join(fontDir, file), join(fontOut, file));
  }
}

console.log(`Vendored Firebase ${firebaseVersion} (${modules.length} modules) and Figtree 300, 400, 500.`);
