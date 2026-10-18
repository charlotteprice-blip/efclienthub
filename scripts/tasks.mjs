// Lists every terminal task for the Client Hub.   npm run tasks

const groups = [
  ['First time on a computer', [
    ['npm install', 'Install the tools this repository uses'],
    ['npx firebase login', 'Log the Firebase CLI in as an owner of ef-client-hub'],
    ['gcloud auth login', 'Log the Google Cloud CLI in as the same person'],
    ['gcloud auth application-default login', 'Let the role script act as you'],
    ['gcloud config set project ef-client-hub', 'Point gcloud at the Client Hub project'],
    ['gcloud auth application-default set-quota-project ef-client-hub', 'Bill API calls from the scripts to the Client Hub project'],
    ['npx firebase login --reauth', 'Sign the Firebase CLI in again when a stored login has gone stale'],
  ]],
  ['Set up Firebase (replaces the console steps)', [
    ['npm run setup:check', 'Report what exists and what is missing; changes nothing'],
    ['npm run setup', 'Create each missing piece, asking before every change'],
    ['npm run setup -- --dry-run', 'Show the commands setup would run, change nothing'],
    ['npm run setup -- --only=domain', 'Run 1 step: tools, project, apis, database, site, bucket, webapp, authdomains, auditlogs, domain, access'],
  ]],
  ['People and roles', [
    ['npm run roles -- list', 'Show who holds a Client Hub role'],
    ['npm run roles -- set <email> practitioner', 'Give someone full clinical access (Sarah)'],
    ['npm run roles -- set <email> admin', 'Give someone system access without clinical content'],
    ['npm run roles -- remove <email>', 'Take a role away and end their sessions'],
  ]],
  ['Questionnaires', [
    ['npm run measures -- list', 'Show the questionnaire library'],
    ['npm run measures -- check <file.json>', 'Validate a questionnaire file without saving it'],
    ['npm run measures -- upload <file.json>', 'Add or update questionnaires in the library'],
  ]],
  ['Build and look', [
    ['npm run harness', 'Run the live app at localhost:5174 with a stand in for Firebase'],
    ['npm run serve', 'Open the sample, style guide and previews at localhost:5173'],
    ['npm run build:sample', 'Build the clickable sample into 1 shareable file in dist/'],
    ['npm run vendor', 'Refresh the self hosted Firebase SDK and Figtree'],
    ['npm run tokens', 'Rebuild tokens.css after Levi updates brand/tokens.json'],
    ['npm run emulators', 'Run Firebase locally on a demo project'],
  ]],
  ['Check', [
    ['npm run check', 'Unit tests and colour contrast (fast, no Java)'],
    ['npm run test:rules', 'Security rules tests in the emulators (needs Java 21+)'],
    ['npm test', 'Everything above'],
  ]],
  ['Deploy (always named parts, never a bare firebase deploy)', [
    ['npm run deploy:rules', 'Firestore and Storage rules and indexes'],
    ['npm run deploy:hosting', 'The website files'],
    ['npm run deploy:functions', 'The Cloud Functions'],
    ['npm run deploy', 'All of the above, after every test passes'],
  ]],
  ['Records', [
    ['npm run worklog', 'Print today\'s commits as a work log entry to paste into Notion'],
  ]],
];

const width = Math.max(...groups.flatMap(([, rows]) => rows.map(([cmd]) => cmd.length)));
for (const [title, rows] of groups) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
  for (const [cmd, what] of rows) console.log(`  ${cmd.padEnd(width)}  \x1b[2m${what}\x1b[0m`);
}
console.log('');
