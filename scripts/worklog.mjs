// Prints a dated work log entry from git commits, ready to paste into the
// App 2 page in Notion. Never includes client data: it reads only commit
// messages and file names.
//
//   npm run worklog                 commits made today
//   npm run worklog -- 2026-10-18   commits made on that day

import { execFileSync } from 'node:child_process';

const day = process.argv[2] ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
const since = `${day}T00:00:00+13:00`;
const until = `${day}T23:59:59+13:00`;

const log = execFileSync('git', ['log', `--since=${since}`, `--until=${until}`, '--reverse', '--pretty=format:%h%x09%s'], { encoding: 'utf8' }).trim();
if (!log) {
  console.log(`\nNo commits on ${day}.\n`);
  process.exit(0);
}

const commits = log.split('\n').map((l) => l.split('\t'));
const first = commits[0][0];
const last = commits.at(-1)[0];
const files = [
  ...new Set(
    execFileSync('git', ['log', `--since=${since}`, `--until=${until}`, '--name-only', '--pretty=format:'], { encoding: 'utf8' })
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f && !f.startsWith('public/assets/vendor/') && !f.startsWith('public/assets/fonts/')),
  ),
].sort();

const date = new Date(`${day}T12:00:00+13:00`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' });
console.log(`\n## ${date}
Commits ${first} to ${last} on main.
### Built
${commits.map(([h, s]) => `- ${s} (${h})`).join('\n')}
### Files changed
${files.join(', ')}
### Stubbed
-
### Decisions and why
-
### Charlotte to configure
- Run npm run setup:check and action anything missing
### Open questions
-
`);
