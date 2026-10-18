// End to end harness: serves public/ exactly as Hosting would, swaps the
// Firebase SDK for the stand ins in fake-sdk/, and runs the real Cloud
// Function handlers against an in memory database. Lets the whole live app
// be clicked through without Firebase or the emulators.
//
//   node tests/e2e/server.mjs            then open http://localhost:5174
//   node tests/e2e/walk.mjs              scripted walk through (Playwright)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { makeHandlers } from '../../functions/handlers.js';
import { createMemoryFirestore } from '../support/memory-firestore.js';

const here = dirname(new URL(import.meta.url).pathname);
const root = join(here, '..', '..');
const pub = join(root, 'public');
const port = Number(process.env.PORT ?? 5174);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const readJson = async (p) => JSON.parse(await readFile(join(root, p), 'utf8'));
const firebaseJson = await readJson('firebase.json');
const csp = firebaseJson.hosting[0].headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;

const db = createMemoryFirestore();
const handlers = makeHandlers({
  db,
  intakeConfig: await readJson('public/config/intake.json'),
  clientTypes: await readJson('public/config/client-types.json'),
  allowSample: () => true,
});
for (const m of (await readJson('public/sample/sample-measures.json')).measures) await db.doc(`measures/${m.id}`).set(m);

// Accounts: email -> { uid, email, password, displayName, role }
const users = new Map();
function addUser(email, password, displayName = null, role = null) {
  const uid = `u${users.size + 1}`;
  users.set(email.toLowerCase(), { uid, email, password, displayName, role });
  return users.get(email.toLowerCase());
}
addUser('sarah@example.com', 'sample-pass', 'Sarah', 'practitioner');
addUser('charlotte@example.com', 'sample-pass', 'Charlotte', 'admin');
const byUid = (uid) => [...users.values()].find((u) => u.uid === uid);
const publicUser = (u) => ({ uid: u.uid, email: u.email, displayName: u.displayName, role: u.role });

async function body(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function fake(path, req, res) {
  const b = await body(req);
  if (path === 'auth/signup') {
    if (users.has(b.email.toLowerCase())) return json(res, 400, { code: 'auth/email-already-in-use', message: 'in use' });
    return json(res, 200, publicUser(addUser(b.email, b.password)));
  }
  if (path === 'auth/signin') {
    const u = users.get(String(b.email).toLowerCase());
    if (!u || u.password !== b.password) return json(res, 400, { code: 'auth/invalid-credential', message: 'bad' });
    return json(res, 200, publicUser(u));
  }
  if (path === 'auth/user') {
    const u = byUid(b.uid);
    return u ? json(res, 200, publicUser(u)) : json(res, 404, { code: 'auth/user-not-found', message: 'no user' });
  }
  if (path === 'auth/profile') {
    byUid(b.uid).displayName = b.displayName;
    return json(res, 200, {});
  }
  if (path === 'get') return json(res, 200, { data: db.read(b.path) ?? null });
  if (path === 'query') {
    let docs = db.list(b.collection);
    for (const c of b.constraints) {
      if (c.type === 'where' && c.op === '==') docs = docs.filter((d) => d[c.field] === c.value);
    }
    for (const c of b.constraints.filter((x) => x.type === 'orderBy').reverse()) {
      docs.sort((x, y) => ((x[c.field] ?? 0) > (y[c.field] ?? 0) ? 1 : -1) * (c.dir === 'desc' ? -1 : 1));
    }
    return json(res, 200, { docs: docs.map(({ id, ...data }) => ({ id, data })) });
  }
  if (path.startsWith('call/')) {
    const name = path.slice(5);
    const u = b.uid ? byUid(b.uid) : null;
    const auth = u ? { uid: u.uid, token: { email: u.email, name: u.displayName, ...(u.role ? { role: u.role } : {}) } } : null;
    try {
      const result = await handlers[name]({ auth, data: b.data ?? {} });
      return json(res, 200, { result });
    } catch (e) {
      return json(res, 400, { code: e.code ?? 'internal', message: e.message });
    }
  }
  return json(res, 404, { message: 'unknown fake route' });
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname.startsWith('/__fake/')) return fake(url.pathname.slice(8), req, res);
  const sdk = url.pathname.match(/^\/assets\/vendor\/firebase\/(firebase-(app|auth|firestore|functions)\.js)$/);
  let file = sdk ? join(here, 'fake-sdk', sdk[1]) : join(pub, normalize(decodeURIComponent(url.pathname)));
  const isFile = await stat(file).then((s) => s.isFile()).catch(() => false);
  if (!isFile) {
    const html = `${file}.html`;
    if (await stat(html).then((s) => s.isFile()).catch(() => false)) file = html;
    else if (!extname(url.pathname)) file = join(pub, 'index.html');
    else {
      res.writeHead(404);
      return res.end();
    }
  }
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Content-Security-Policy': csp, 'Cache-Control': 'no-store' });
  return res.end(await readFile(file));
}).listen(port, () => console.log(`Test harness at http://localhost:${port}  (practitioner: sarah@example.com / sample-pass)`));
