// Serves public/ on http://localhost:5173 so the sample, previews and style
// guide can be opened without Firebase. Uses the same security headers as
// Hosting so problems show up locally.
//
//   npm run serve

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';

const root = join(dirname(new URL(import.meta.url).pathname), '..', 'public');
const port = Number(process.env.PORT ?? 5173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};
const hosting = JSON.parse(await readFile(join(root, '..', 'firebase.json'), 'utf8')).hosting[0];
const csp = hosting.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;

async function resolve(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const candidates = [clean, `${clean}.html`, join(clean, 'index.html')];
  if (clean.startsWith('/measure/')) candidates.push('/measure.html');
  for (const c of candidates) {
    const file = join(root, c);
    if (!file.startsWith(root)) continue;
    try {
      if ((await stat(file)).isFile()) return file;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

createServer(async (req, res) => {
  const file = await resolve(req.url === '/' ? '/index.html' : req.url);
  const headers = { 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' };
  if (!file) {
    res.writeHead(404, { ...headers, 'Content-Type': types['.html'] });
    return res.end(await readFile(join(root, '404.html')));
  }
  res.writeHead(200, { ...headers, 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
  return res.end(await readFile(file));
}).listen(port, () => {
  console.log(`\nClient Hub files at http://localhost:${port}\n  Sample:      http://localhost:${port}/sample/\n  Style guide: http://localhost:${port}/styleguide\n  Previews:    http://localhost:${port}/preview/home\n\nPress Ctrl+C to stop.\n`);
});
