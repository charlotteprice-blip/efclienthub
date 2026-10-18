// Bundles the clickable sample (public/sample) into 1 self contained HTML
// file, dist/client-hub-sample.html, with styles, fonts, the mark and the
// configs inlined. That file can be opened directly or shared as a page.
//
//   npm run build:sample

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { build } from 'esbuild';

const root = join(dirname(new URL(import.meta.url).pathname), '..');
const pub = (p) => join(root, 'public', p);
const dataUri = (path, type) => `data:${type};base64,${readFileSync(path).toString('base64')}`;

const mark = dataUri(pub('assets/brand/mark-slate-small.svg'), 'image/svg+xml');

const inlineFonts = (css) =>
  css.replace(/url\("\/assets\/fonts\/([^"]+\.woff2)"\)/g, (_, file) => `url("${dataUri(pub(`assets/fonts/${file}`), 'font/woff2')}")`);

const css = [
  inlineFonts(readFileSync(pub('css/tokens.css'), 'utf8')),
  readFileSync(pub('css/app.css'), 'utf8'),
  readFileSync(pub('css/components.css'), 'utf8'),
  readFileSync(pub('sample/sample.css'), 'utf8'),
].join('\n');

const result = await build({
  entryPoints: [pub('sample/sample-app.js')],
  bundle: true,
  format: 'esm',
  target: ['chrome120', 'safari17', 'firefox120'],
  minify: true,
  write: false,
  legalComments: 'none',
});
let js = result.outputFiles[0].text.replaceAll('../assets/brand/mark-slate-small.svg', mark);
js = js.replace(/<\/script/gi, '<\\/script');

const html = readFileSync(pub('sample/index.html'), 'utf8')
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${mark}" type="image/svg+xml">`)
  .replace(/\s*<link rel="stylesheet"[^>]*>/g, '')
  .replace(/\s*<script type="module" src="sample-app.js"><\/script>/, `\n  <style>\n${css}\n  </style>`)
  .replace('</body>', `  <script type="module">\n${js}\n  </script>\n</body>`);

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/client-hub-sample.html'), html);
console.log(`Wrote dist/client-hub-sample.html (${Math.round(html.length / 1024)} KB)`);

// Shareable page version: the hosting page supplies the document skeleton,
// so this copy holds only the title, styles, body content and script.
const title = '<title>Executive Frame Client Hub</title>';
const body = html.slice(html.indexOf('<body class="sample">') + '<body class="sample">'.length, html.lastIndexOf('</body>'));
const page = `${title}
<style>
${css}
</style>
<div class="sample-root">
${body}
</div>
<script>document.body.classList.add('sample');</script>
`;
writeFileSync(join(root, 'dist/client-hub-page.html'), page);
console.log(`Wrote dist/client-hub-page.html (${Math.round(page.length / 1024)} KB)`);
