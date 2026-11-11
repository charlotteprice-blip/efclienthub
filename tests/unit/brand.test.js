// The brand pack is the single source: tokens, the mark and the logo files
// in the app must be the pack's, unchanged.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { LOOP, STROKES, TRIANGLE } from '../../public/js/mark-paths.js';

const pack = JSON.parse(readFileSync('brand/ef-tokens.json', 'utf8'));
const tokens = JSON.parse(readFileSync('brand/tokens.json', 'utf8'));
const css = readFileSync('public/css/tokens.css', 'utf8');

describe('tokens come from the brand pack', () => {
  test('palette, radius, spacing and motion are the pack\'s values', () => {
    for (const [name, c] of Object.entries(pack.palette)) assert.equal(tokens.palette[name], c.hex);
    assert.deepEqual(tokens.radius, pack.radius);
    assert.deepEqual(tokens.spacing, pack.spacing);
    assert.equal(tokens.motion.markDrawOnMs, pack.motion.markDrawOnMs);
    for (const hex of Object.values(pack.palette).map((c) => c.hex)) assert.ok(css.includes(hex), hex);
  });
  test('application colours are the pack\'s, as text and tint', () => {
    for (const k of ['error', 'success', 'warning', 'info']) {
      assert.equal(tokens.application[k].text, pack.application[k].light);
      assert.equal(tokens.application[k].tint, pack.application[k].tint);
      assert.ok(css.includes(`--app-${k}: ${pack.application[k].light};`));
      assert.ok(css.includes(`--app-${k}-tint: ${pack.application[k].tint};`));
    }
  });
  test('the primary button is navy, the 1 value that does not follow the pack yet', () => {
    assert.equal(pack.themes.light.primary, pack.palette.slate.hex, 'when the pack says navy, remove primaryOverride from brand/app-tokens.json');
    assert.equal(tokens.themes.light.primary, pack.palette.navy.hex);
    assert.ok(css.includes(`--primary: ${pack.palette.navy.hex};`));
  });
  test('the app keeps its own type sizes and body weight stays 400', () => {
    assert.equal(tokens.type.body.size, 17);
    assert.match(readFileSync('public/css/app.css', 'utf8'), /--type-body-weight: 400;/);
  });
});

describe('the mark', () => {
  test('the inline mark is built from the pack\'s loop and triangle', () => {
    assert.equal(LOOP, pack.logo.mark.loop.path);
    assert.equal(TRIANGLE, pack.logo.mark.triangle);
    assert.deepEqual(STROKES, pack.logo.mark.strokes);
    assert.equal(STROKES.standard, 5);
  });
  test('each path carries pathLength 100, and the draw on runs once', () => {
    const js = readFileSync('public/js/mark.js', 'utf8');
    assert.equal((js.match(/setAttribute\('pathLength', '100'\)/g) ?? []).length, 2);
    const appCss = readFileSync('public/css/app.css', 'utf8');
    assert.ok(!/animation[^;]*infinite/.test(appCss + readFileSync('public/css/components.css', 'utf8')), 'nothing loops');
    assert.match(appCss, /\.mark-draw \.mark-ring \{[^}]*forwards/);
  });
  test('the mark files are the pack\'s drawing, and the old drawing is gone', () => {
    const files = readdirSync('public/assets/brand').filter((f) => f.endsWith('.svg'));
    assert.ok(files.includes('ef-lockup-slate.svg') && files.includes('ef-mark-slate.svg'));
    for (const f of files) {
      const svg = readFileSync(`public/assets/brand/${f}`, 'utf8');
      if (!f.includes('wordmark')) assert.ok(svg.includes(pack.logo.mark.loop.path), `${f} has the pack's loop`);
      assert.ok(!svg.includes('<text'), `${f} carries the wordmark as outlines, not live text`);
    }
    assert.ok(!existsSync('public/assets/brand/mark-slate-small.svg'));
    assert.ok(!existsSync('public/js/journey-ring.js'), 'the journey ring is retired');
  });
});

describe('logo use in the pages', () => {
  const ui = readFileSync('public/js/ui.js', 'utf8');
  test('the header shows the supplied lockup at or above its minimum width, with the app name as text', () => {
    assert.match(ui, /class="brand-lockup" src="\$\{src \|\| LOCKUP_SRC\}" alt="Executive Frame" width="150" height="24"/);
    assert.ok(150 >= pack.logo.minimum.lockupPx);
    assert.ok(ui.includes('<span class="brand-app">Client Hub</span>'));
    assert.ok(!ui.includes('brand-name'), 'the wordmark is never live text');
  });
  test('every page head uses the pack\'s favicon set from this origin', () => {
    for (const page of ['public/index.html', 'public/styleguide.html', 'public/404.html']) {
      const html = readFileSync(page, 'utf8');
      for (const href of ['/favicon.svg', '/favicon.ico', '/apple-touch-icon.png', '/site.webmanifest']) assert.ok(html.includes(`href="${href}"`), `${page} ${href}`);
      assert.ok(!/href="https?:/.test(html), `${page} loads nothing from another origin`);
    }
    for (const f of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'android-chrome-192x192.png', 'android-chrome-512x512.png', 'site.webmanifest']) assert.ok(existsSync(`public/${f}`), f);
  });
});

describe('formulation drawings', () => {
  test('use palette and status tokens only, never the client type accent or a written colour', () => {
    const css = readFileSync('public/css/components.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/\.fv-|\.map-/.test(m[1])) continue;
      assert.ok(!m[2].includes('--accent'), m[1].trim());
      assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(m[2]), m[1].trim());
    }
  });
});
