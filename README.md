# Executive Frame Client Hub

In treatment web app for clients of Sarah Anticich, served at clients.executiveframe.co.nz. Static HTML, CSS and vanilla JavaScript on Firebase, with no front end framework and no build step. Developer: Charlotte Price (hello@charlotteprice.co.nz). Work log: Notion, Executive Frame, App 2.

This app runs in its own Firebase project, `ef-client-hub`, separate from the Learning Hub (app.executiveframe.co.nz). Accounts, health information and deployments are fully separate. Inside the project it still uses a named Firestore database (`clienthub`), its own Hosting site, Storage bucket and functions codebase.

## Layout

```
firebase.json            Hosting, clienthub database, storage target, functions codebase
firestore.rules          rules for the clienthub database; storage.rules closes the bucket
functions/               Cloud Functions: index.js connects handlers.js to Firebase; core.js holds the tested rules
public/index.html        the live app; every route loads it
public/js/live/          live app: app.js (routes, auth, actions), data.js, views-client.js, views-staff.js
public/js/               shared: ui.js, scoring.js, intake-rules.js, client-types.js, mark.js, journey-ring.js, firebase.js
public/config/           app.json, client-types.json, intake.json
public/css/              tokens.css (generated), app.css, components.css
public/sample/           clickable sample on invented data
brand/                   Levi's tokens.json and the status colours
scripts/                 setup, roles, measures, serve, vendor, tokens, contrast, sample build, worklog
tests/                   unit tests, rules tests, in memory Firestore, end to end harness
docs/                    firebase-setup.md, data model, client journey, decisions, brand notes, intake guide
```

Start with docs/firebase-setup.md.

## Terminal tasks

Everything for this app runs from the terminal. `npm run tasks` lists every task with a one line description.

First time on a computer:

```
npm install
npx firebase login
gcloud auth login
gcloud auth application-default login
```

Set up Firebase (replaces the console steps):

```
npm run setup:check          report what exists and what is missing, changes nothing
npm run setup -- --plan      print every command setup could run, checks nothing
npm run setup                create each missing piece, asking before every change
```

`setup` enables the Google Cloud APIs, creates the `clienthub` Firestore database in Sydney with point in time recovery and delete protection, creates and links the Hosting site and Storage bucket, registers the web app and writes its settings into `public/js/firebase-config.js`, authorises the sign in domains, switches on Firestore read and write audit logs, adds the custom domain and prints the DNS records it needs, and lists who holds broad access to the project. Each step checks first, so running it again is safe.

People and roles:

```
npm run roles -- list
npm run roles -- set <email> practitioner     Sarah
npm run roles -- set <email> admin            Charlotte's own account
npm run roles -- remove <email>
```

Build, check and deploy:

```
npm run serve                sample, style guide and previews at localhost:5173
npm run check                unit tests and colour contrast
npm test                     check plus the security rules tests (needs Java 21+)
npm run deploy:rules         rules and indexes
npm run deploy:hosting       website files
npm run deploy:functions     Cloud Functions
npm run deploy               everything, after all tests pass
npm run worklog              today's commits as a Notion work log entry
```

Never run a bare `firebase deploy` from this repository; the npm scripts name this app's parts every time.

## Still done outside the terminal

1. Creating the `ef-client-hub` project itself under Sarah's Google account, with the Blaze plan, and adding Charlotte as Owner.
2. Adding the DNS records that `npm run setup:check` prints, at the DNS host for executiveframe.co.nz, and logging that change in the Site Changes Log.
3. Approving copy and decisions with Sarah (docs/decisions.md).

See docs/decisions.md for decisions and open questions.
