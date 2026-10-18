// Sets up everything the Client Hub needs in Firebase and Google Cloud from
// the terminal, in place of clicking through the Firebase console.
//
//   npm run setup:check            report what exists and what is missing (changes nothing)
//   npm run setup                  make each missing piece, asking before every change
//   npm run setup -- --dry-run     check, then print the commands it would run, change nothing
//   npm run setup -- --plan        print every command in order without checking anything
//   npm run setup -- --yes         make every missing piece without asking
//   npm run setup -- --only=database,site
//
// Needs: Node 20+, the Firebase CLI (installed by npm install), and the
// Google Cloud CLI (gcloud), each logged in as an owner of ef-client-hub:
//   npx firebase login
//   gcloud auth login
//
// Every step checks before it acts, so running it again is safe.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';

const root = join(dirname(new URL(import.meta.url).pathname), '..');
const firebaseBin = join(root, 'node_modules/.bin/firebase');

const CONFIG = {
  project: process.env.CLIENTHUB_PROJECT ?? 'ef-client-hub',
  region: 'australia-southeast1',
  database: 'clienthub',
  site: process.env.CLIENTHUB_SITE ?? 'executiveframe-clienthub',
  bucket: process.env.CLIENTHUB_BUCKET ?? 'executiveframe-clienthub',
  domain: 'clients.executiveframe.co.nz',
  appName: 'Executive Frame Client Hub',
};

const APIS = [
  'firebase.googleapis.com',
  'firebasehosting.googleapis.com',
  'firestore.googleapis.com',
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'identitytoolkit.googleapis.com',
  'cloudfunctions.googleapis.com',
  'run.googleapis.com',
  'cloudbuild.googleapis.com',
  'artifactregistry.googleapis.com',
  'eventarc.googleapis.com',
  'secretmanager.googleapis.com',
];

const args = process.argv.slice(2);
const checkOnly = args.includes('check');
const plan = args.includes('--plan');
const dryRun = args.includes('--dry-run') || plan;
const yes = args.includes('--yes');
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');

// ---------- helpers ----------

const c = { green: (s) => `\x1b[32m${s}\x1b[0m`, yellow: (s) => `\x1b[33m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m` };

function show(cmd, list) {
  return [cmd === firebaseBin ? 'npx firebase' : cmd, ...list].map((p) => (/[\s"']/.test(p) ? `'${p}'` : p)).join(' ');
}

function run(cmd, list, { capture = true, input } = {}) {
  if (dryRun) {
    console.log(c.dim(`  would run: ${show(cmd, list)}`));
    return { ok: true, out: '', dry: true };
  }
  const r = spawnSync(cmd, list, { encoding: 'utf8', stdio: capture ? ['pipe', 'pipe', 'pipe'] : 'inherit', input, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) return { ok: false, out: '', err: r.error.message };
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}

// Read only commands still run during a dry run, so the plan is accurate.
function look(cmd, list) {
  const r = spawnSync(cmd, list, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) return { ok: false, out: '', err: r.error.message };
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}

// First meaningful line of a failed command, for the report.
function why(r) {
  const line = `${r.err}\n${r.out}`
    .split('\n')
    .map((l) => l.replace(/\x1b\[[0-9;]*m/g, '').trim())
    .find((l) => l && !/^(npm (warn|notice)|\(node:\d+\))/i.test(l));
  return line ? line.slice(0, 200) : 'no error message';
}

// The Firebase CLI stores its login locally; login:list reads it without the network.
function firebaseLogin() {
  const r = look(firebaseBin, ['login:list', '--json']);
  if (!r.ok) return null;
  try {
    const parsed = JSON.parse(r.out);
    const accounts = Array.isArray(parsed.result) ? parsed.result : [];
    return accounts.map((a) => a.user?.email ?? a.email).filter(Boolean);
  } catch {
    return /logged in as/i.test(r.out) ? [r.out.match(/logged in as\s+(\S+)/i)?.[1] ?? 'unknown'] : [];
  }
}

const fb = (list) => [firebaseBin, [...list, '--project', CONFIG.project]];
const gc = (list) => ['gcloud', [...list, `--project=${CONFIG.project}`]];
const lookJson = (cmd, list) => {
  const r = look(cmd, list);
  if (!r.ok) return null;
  try {
    return JSON.parse(r.out);
  } catch {
    return null;
  }
};

function token() {
  const r = look('gcloud', ['auth', 'print-access-token']);
  if (!r.ok) throw new Error('gcloud is not logged in. Run: gcloud auth login');
  return r.out;
}

async function rest(method, url, body) {
  if (dryRun && method !== 'GET') {
    console.log(c.dim(`  would call: ${method} ${url}${body ? ` ${JSON.stringify(body)}` : ''}`));
    return { ok: true, data: {} };
  }
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', 'x-goog-user-project': CONFIG.project },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

let rl = null;
async function confirm(question) {
  if (yes || dryRun) return true;
  rl ??= createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`  ${question} ${c.bold('[y/N]')} `);
  return /^y(es)?$/i.test(answer.trim());
}

// ---------- steps ----------

const steps = [
  {
    id: 'tools',
    title: 'Tools and logins',
    async check() {
      const problems = [];
      const node = Number(process.versions.node.split('.')[0]);
      if (node < 20) problems.push(`Node ${process.versions.node} is too old; install Node 20 or later`);
      if (!existsSync(firebaseBin)) problems.push('Firebase CLI missing; run npm install');
      if (!look('gcloud', ['--version']).ok) problems.push('gcloud missing; install the Google Cloud CLI (brew install --cask google-cloud-sdk)');
      const java = look('java', ['-version']);
      if (!java.ok) problems.push('Java missing (only needed for npm run test:rules); brew install openjdk@21');
      if (existsSync(firebaseBin)) {
        const accounts = firebaseLogin();
        if (!accounts || accounts.length === 0) {
          problems.push('Firebase CLI not logged in; run npx firebase login');
        } else {
          const list = look(firebaseBin, ['projects:list', '--json']);
          if (!list.ok) problems.push(`Firebase CLI is logged in as ${accounts.join(', ')} but cannot list projects (${why(list)}); try npx firebase login --reauth`);
        }
      }
      if (look('gcloud', ['--version']).ok) {
        const gcloudToken = look('gcloud', ['auth', 'print-access-token']);
        if (!gcloudToken.ok) problems.push('gcloud not logged in; run gcloud auth login');
        const quota = look('gcloud', ['config', 'get-value', 'project']);
        if (quota.ok && quota.out && quota.out !== CONFIG.project) problems.push(`gcloud is pointed at project ${quota.out}; run gcloud config set project ${CONFIG.project}`);
      }
      return problems.length ? { state: 'missing', detail: problems } : { state: 'done' };
    },
    manual: 'Fix the items listed, then run this again.',
  },
  {
    id: 'project',
    title: `Firebase project ${CONFIG.project}`,
    async check() {
      const describe = look('gcloud', ['projects', 'describe', CONFIG.project, '--format=value(projectNumber)']);
      if (describe.ok && describe.out) {
        const firebase = look(firebaseBin, ['projects:list', '--json']);
        if (!firebase.ok) return { state: 'unknown', detail: [`Project ${CONFIG.project} exists (number ${describe.out}) but the Firebase CLI cannot list projects: ${why(firebase)}`] };
        let parsed = null;
        try {
          parsed = JSON.parse(firebase.out);
        } catch {
          parsed = null;
        }
        const found = parsed?.result?.some((p) => p.projectId === CONFIG.project);
        return found
          ? { state: 'done' }
          : { state: 'missing', detail: [`${CONFIG.project} exists in Google Cloud but Firebase is not added to it; in the Firebase console choose Add project and pick ${CONFIG.project}`] };
      }
      return { state: 'missing', detail: [`${CONFIG.project} is not visible to this login (${why(describe)})`] };
    },
    manual: 'The project is created under Sarah\'s Google account with the Blaze plan, and you are added as Owner. That needs her sign in, so it stays a manual step. Then run this again.',
  },
  {
    id: 'apis',
    title: 'Google Cloud APIs',
    async check() {
      const r = look(...gc(['services', 'list', '--enabled', '--format=value(config.name)']));
      if (!r.ok) return { state: 'unknown', detail: [r.err.split('\n')[0]] };
      const enabled = new Set(r.out.split('\n'));
      const missing = APIS.filter((a) => !enabled.has(a));
      this.missing = missing;
      return missing.length ? { state: 'missing', detail: missing } : { state: 'done' };
    },
    async apply() {
      return run(...gc(['services', 'enable', ...(this.missing ?? APIS)]), { capture: false });
    },
  },
  {
    id: 'database',
    title: `Firestore database "${CONFIG.database}" in ${CONFIG.region}, point in time recovery on`,
    async check() {
      const d = lookJson(firebaseBin, ['firestore:databases:get', CONFIG.database, '--json', '--project', CONFIG.project]);
      if (!d) {
        this.mode = 'create';
        return { state: 'missing' };
      }
      const db = d.result ?? d;
      const problems = [];
      if (db.locationId && db.locationId !== CONFIG.region) problems.push(`exists in ${db.locationId}, not ${CONFIG.region}; this cannot be changed, delete and recreate it by hand if it holds no data`);
      if (db.pointInTimeRecoveryEnablement !== 'POINT_IN_TIME_RECOVERY_ENABLED') {
        this.mode = 'pitr';
        problems.push('point in time recovery is off');
      }
      return problems.length ? { state: 'missing', detail: problems } : { state: 'done' };
    },
    async apply() {
      if (this.mode === 'pitr') return run(...fb(['firestore:databases:update', CONFIG.database, '--point-in-time-recovery', 'ENABLED', '--delete-protection', 'ENABLED']), { capture: false });
      return run(
        ...fb(['firestore:databases:create', CONFIG.database, '--location', CONFIG.region, '--point-in-time-recovery', 'ENABLED', '--delete-protection', 'ENABLED']),
        { capture: false },
      );
    },
  },
  {
    id: 'site',
    title: `Hosting site "${CONFIG.site}" linked to the clienthub target`,
    async check() {
      const sites = lookJson(firebaseBin, ['hosting:sites:list', '--json', '--project', CONFIG.project]);
      if (!sites) return { state: 'unknown', detail: ['Could not list Hosting sites'] };
      const exists = (sites.result?.sites ?? sites.result ?? []).some((s) => s.name?.endsWith(`/sites/${CONFIG.site}`));
      const rc = JSON.parse(readFileSync(join(root, '.firebaserc'), 'utf8'));
      const linked = rc.targets?.[CONFIG.project]?.hosting?.clienthub?.includes(CONFIG.site);
      this.exists = exists;
      if (exists && linked) return { state: 'done' };
      return { state: 'missing', detail: [exists ? 'site exists but is not linked to the target' : 'site does not exist'] };
    },
    async apply() {
      if (!this.exists) {
        const r = run(...fb(['hosting:sites:create', CONFIG.site]), { capture: false });
        if (!r.ok) return r;
      }
      return run(...fb(['target:apply', 'hosting', 'clienthub', CONFIG.site]), { capture: false });
    },
  },
  {
    id: 'bucket',
    title: `Storage bucket "${CONFIG.bucket}" in ${CONFIG.region}, added to Firebase, linked to the clienthub target`,
    async check() {
      const b = lookJson('gcloud', ['storage', 'buckets', 'describe', `gs://${CONFIG.bucket}`, '--format=json', `--project=${CONFIG.project}`]);
      this.exists = Boolean(b);
      const problems = [];
      if (!b) problems.push('bucket does not exist');
      else if (b.location && b.location.toLowerCase() !== CONFIG.region) problems.push(`bucket is in ${b.location}, not ${CONFIG.region}`);
      if (b) {
        const fbBucket = await rest('GET', `https://firebasestorage.googleapis.com/v1beta/projects/${CONFIG.project}/buckets/${CONFIG.bucket}`).catch(() => ({ ok: false }));
        this.added = fbBucket.ok;
        if (!fbBucket.ok) problems.push('bucket is not yet added to Firebase');
      }
      const rc = JSON.parse(readFileSync(join(root, '.firebaserc'), 'utf8'));
      this.linked = rc.targets?.[CONFIG.project]?.storage?.clienthub?.includes(CONFIG.bucket);
      if (!this.linked) problems.push('bucket is not linked to the storage target');
      return problems.length ? { state: 'missing', detail: problems } : { state: 'done' };
    },
    async apply() {
      if (!this.exists) {
        const r = run(
          ...gc(['storage', 'buckets', 'create', `gs://${CONFIG.bucket}`, `--location=${CONFIG.region}`, '--uniform-bucket-level-access', '--public-access-prevention']),
          { capture: false },
        );
        if (!r.ok) return r;
      }
      if (!this.added) {
        const r = await rest('POST', `https://firebasestorage.googleapis.com/v1beta/projects/${CONFIG.project}/buckets/${CONFIG.bucket}:addFirebase`, {});
        if (!r.ok) return { ok: false, err: JSON.stringify(r.data) };
      }
      return this.linked ? { ok: true } : run(...fb(['target:apply', 'storage', 'clienthub', CONFIG.bucket]), { capture: false });
    },
  },
  {
    id: 'webapp',
    title: `Web app "${CONFIG.appName}" registered, settings written to public/js/firebase-config.js`,
    async check() {
      const apps = lookJson(firebaseBin, ['apps:list', 'WEB', '--json', '--project', CONFIG.project]);
      if (!apps) return { state: 'unknown', detail: ['Could not list apps'] };
      const app = (apps.result ?? []).find((a) => a.displayName === CONFIG.appName);
      this.appId = app?.appId;
      const written = !readFileSync(join(root, 'public/js/firebase-config.js'), 'utf8').includes('REPLACE_ME');
      if (app && written) return { state: 'done' };
      return { state: 'missing', detail: [app ? 'settings not yet written into firebase-config.js' : 'web app not registered'] };
    },
    async apply() {
      if (!this.appId) {
        const r = run(...fb(['apps:create', 'WEB', CONFIG.appName, '--json']));
        if (dryRun) return r;
        if (!r.ok) return r;
        this.appId = JSON.parse(r.out).result?.appId;
      }
      const r = run(...fb(['apps:sdkconfig', 'WEB', this.appId, '--json']));
      if (dryRun) return r;
      if (!r.ok) return r;
      const cfg = JSON.parse(r.out).result?.sdkConfig ?? JSON.parse(r.out).result;
      writeConfig(cfg);
      return { ok: true };
    },
  },
  {
    id: 'authdomains',
    title: `Authentication: email and password sign in on, sign in allowed from ${CONFIG.domain} and the site's own addresses`,
    async check() {
      const r = await rest('GET', `https://identitytoolkit.googleapis.com/admin/v2/projects/${CONFIG.project}/config`).catch((e) => ({ ok: false, data: { error: e.message } }));
      if (!r.ok) return { state: 'unknown', detail: ['Could not read the Authentication settings. Open Authentication in the Firebase console once and press Get started, then run this again.'] };
      const current = r.data.authorizedDomains ?? [];
      const wanted = [CONFIG.domain, `${CONFIG.site}.web.app`, `${CONFIG.site}.firebaseapp.com`];
      this.next = [...new Set([...current, ...wanted])];
      const problems = wanted.filter((d) => !current.includes(d)).map((d) => `${d} not authorised`);
      this.emailOff = !r.data.signIn?.email?.enabled;
      if (this.emailOff) problems.push('email and password sign in is off');
      return problems.length ? { state: 'missing', detail: problems } : { state: 'done' };
    },
    async apply() {
      const body = { authorizedDomains: this.next };
      const mask = ['authorizedDomains'];
      if (this.emailOff !== false) {
        body.signIn = { email: { enabled: true, passwordRequired: true } };
        mask.push('signIn.email.enabled', 'signIn.email.passwordRequired');
      }
      const r = await rest('PATCH', `https://identitytoolkit.googleapis.com/admin/v2/projects/${CONFIG.project}/config?updateMask=${mask.join(',')}`, body);
      return r.ok ? { ok: true } : { ok: false, err: JSON.stringify(r.data) };
    },
  },
  {
    id: 'auditlogs',
    title: 'Audit logs record every read of the Firestore databases',
    async check() {
      const policy = lookJson('gcloud', ['projects', 'get-iam-policy', CONFIG.project, '--format=json']);
      if (!policy) return { state: 'unknown', detail: ['Could not read the project access policy'] };
      this.policy = policy;
      const cfg = (policy.auditConfigs ?? []).find((a) => a.service === 'datastore.googleapis.com');
      const types = new Set((cfg?.auditLogConfigs ?? []).map((l) => l.logType));
      return types.has('DATA_READ') && types.has('DATA_WRITE') ? { state: 'done' } : { state: 'missing', detail: ['Data Read and Data Write logs for Cloud Firestore are off'] };
    },
    async apply() {
      const policy = this.policy;
      policy.auditConfigs ??= [];
      let cfg = policy.auditConfigs.find((a) => a.service === 'datastore.googleapis.com');
      if (!cfg) {
        cfg = { service: 'datastore.googleapis.com', auditLogConfigs: [] };
        policy.auditConfigs.push(cfg);
      }
      for (const logType of ['DATA_READ', 'DATA_WRITE']) {
        if (!cfg.auditLogConfigs.some((l) => l.logType === logType)) cfg.auditLogConfigs.push({ logType });
      }
      const file = join(mkdtempSync(join(tmpdir(), 'clienthub-')), 'policy.json');
      writeFileSync(file, JSON.stringify(policy));
      // set-iam-policy uses the etag from the read, so it refuses to apply if
      // anyone changed access in the meantime.
      return run('gcloud', ['projects', 'set-iam-policy', CONFIG.project, file, '--format=none'], { capture: false });
    },
  },
  {
    id: 'domain',
    title: `Custom domain ${CONFIG.domain} on the Hosting site`,
    async check() {
      const r = await rest('GET', `https://firebasehosting.googleapis.com/v1beta1/projects/${CONFIG.project}/sites/${CONFIG.site}/customDomains/${CONFIG.domain}`).catch(() => ({ ok: false }));
      if (!r.ok) return { state: 'missing', detail: ['domain not yet added to the site'] };
      this.domainInfo = r.data;
      const state = r.data.hostState ?? r.data.ownershipState;
      if (r.data.hostState === 'HOST_ACTIVE') return { state: 'done' };
      printDns(r.data);
      return { state: 'waiting', detail: [`added, waiting for DNS (${state ?? 'pending'})`] };
    },
    async apply() {
      const r = await rest('POST', `https://firebasehosting.googleapis.com/v1beta1/projects/${CONFIG.project}/sites/${CONFIG.site}/customDomains?customDomainId=${CONFIG.domain}`, {});
      if (!r.ok) return { ok: false, err: JSON.stringify(r.data) };
      console.log('  Domain added. Firebase takes a minute to work out the DNS records; run npm run setup:check to print them.');
      return { ok: true };
    },
  },
  {
    id: 'access',
    title: 'Who can open the project console (report only)',
    async check() {
      const policy = lookJson('gcloud', ['projects', 'get-iam-policy', CONFIG.project, '--format=json']);
      if (!policy) return { state: 'unknown', detail: ['Could not read the project access policy'] };
      const wide = (policy.bindings ?? []).filter((b) => ['roles/owner', 'roles/editor', 'roles/firebase.admin', 'roles/datastore.user', 'roles/datastore.viewer'].includes(b.role));
      const lines = wide.flatMap((b) => b.members.filter((m) => m.startsWith('user:') || m.startsWith('group:')).map((m) => `${b.role.replace('roles/', '')}: ${m.replace(/^(user|group):/, '')}`));
      return { state: 'report', detail: lines.length ? lines : ['No people hold broad roles'] };
    },
  },
];

function writeConfig(cfg) {
  const file = join(root, 'public/js/firebase-config.js');
  const src = readFileSync(file, 'utf8');
  const authDomain = `${CONFIG.site}.web.app`;
  const block = `export const firebaseConfig = {
  apiKey: '${cfg.apiKey}',
  // Switch to '${CONFIG.domain}' once the custom domain is live.
  authDomain: '${authDomain}',
  projectId: '${cfg.projectId ?? CONFIG.project}',
  storageBucket: '${CONFIG.bucket}',
  messagingSenderId: '${cfg.messagingSenderId}',
  appId: '${cfg.appId}',
};`;
  writeFileSync(file, src.replace(/export const firebaseConfig = \{[\s\S]*?\};/, block));
  console.log(c.green('  Wrote public/js/firebase-config.js'));
}

function printDns(info) {
  const updates = info.requiredDnsUpdates?.desired ?? [];
  const records = updates.flatMap((d) => (d.records ?? []).map((r) => ({ domain: d.domainName, ...r })));
  if (!records.length) return;
  console.log('  Add these records at the DNS host for executiveframe.co.nz, then log the change in the Site Changes Log:');
  for (const r of records) console.log(`    ${r.type.padEnd(6)} ${r.domainName ?? r.domain}  ${r.rdata}${r.requiredAction ? `  (${r.requiredAction.toLowerCase()})` : ''}`);
}

// ---------- run ----------

const icon = { done: c.green('done   '), missing: c.yellow('missing'), waiting: c.yellow('waiting'), unknown: c.red('unknown'), report: c.dim('report ') };

console.log(c.bold(`\nExecutive Frame Client Hub setup  ·  project ${CONFIG.project}${dryRun ? '  ·  dry run' : ''}${checkOnly ? '  ·  check only' : ''}\n`));

if (plan) {
  // Print every change command as if nothing existed yet.
  const defaults = { missing: APIS, mode: 'create', exists: false, added: false, linked: false, emailOff: true, next: [CONFIG.domain, `${CONFIG.site}.web.app`, `${CONFIG.site}.firebaseapp.com`], policy: { auditConfigs: [] } };
  for (const step of steps) {
    if (!step.apply) continue;
    console.log(c.bold(step.title));
    Object.assign(step, defaults);
    await step.apply();
  }
  console.log('');
  process.exit(0);
}

let blocked = false;
for (const step of steps) {
  if (only && !only.includes(step.id) && !['tools'].includes(step.id)) continue;
  if (blocked) {
    console.log(`${c.dim('skipped')}  ${step.title}`);
    continue;
  }
  let result;
  try {
    result = await step.check();
  } catch (e) {
    result = { state: 'unknown', detail: [e.message] };
  }
  console.log(`${icon[result.state]}  ${step.title}`);
  for (const d of result.detail ?? []) console.log(c.dim(`         ${d}`));

  if (result.state === 'done' || result.state === 'report' || result.state === 'waiting') continue;
  if (!step.apply) {
    if (step.manual) console.log(`         ${step.manual}`);
    if (['tools', 'project'].includes(step.id)) blocked = true;
    continue;
  }
  if (checkOnly || result.state === 'unknown') continue;
  if (!(await confirm(`Make this change in ${CONFIG.project}?`))) {
    console.log(c.dim('         left as it is'));
    continue;
  }
  const r = await step.apply();
  if (r?.ok) console.log(c.green(dryRun ? '         planned' : '         done'));
  else console.log(c.red(`         failed: ${(r?.err ?? 'see the output above').split('\n')[0]}`));
}

rl?.close();
console.log(
  `\nStill done outside the terminal: adding the DNS records at the executiveframe.co.nz DNS host, and creating the project itself under Sarah's account.\nNext: npm run roles -- set <email> practitioner, then npm run deploy:rules.\n`,
);
