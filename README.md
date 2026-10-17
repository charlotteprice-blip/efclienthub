# Executive Frame Client Hub

In treatment web app for clients of Sarah Anticich, served at clients.executiveframe.co.nz. Static HTML, CSS and vanilla JavaScript on Firebase, with no front end framework and no build step. Developer: Charlotte Price (hello@charlotteprice.co.nz). Work log: Notion, Executive Frame, App 2.

This app shares Firebase Authentication with the Learning Hub (app.executiveframe.co.nz) in project `executiveframe-app`. It has its own Hosting site, named Firestore database (`clienthub`), Storage bucket and functions codebase, so a Learning Hub deployment cannot touch it.

## Layout

```
firebase.json          Hosting target, clienthub database, storage target, functions codebase
.firebaserc            project and target mapping
firestore.rules        rules for the clienthub database
firestore.indexes.json
storage.rules          bucket closed to browsers
firebase.test.json     emulator config used only by the rules tests
tests/rules.test.js    security rules tests
functions/             Cloud Functions, codebase "clienthub" (stubs until stage 3)
public/                the app (pages from stage 2 onwards)
  assets/brand         mark SVGs from Levi
  assets/fonts         self hosted Figtree
  assets/vendor        self hosted Firebase SDK
  config/              client type and intake questionnaire config
scripts/               admin scripts, for example setting role claims
docs/                  data model, client journey, decisions
```

## Commands

```
npm install
npm run test:rules     runs the rules tests in the emulators (needs Java 21+)
npm run emulators      local emulators on a demo project
```

Deploy only this app's parts, always naming them:

```
firebase deploy --only hosting:clienthub,firestore,storage:clienthub,functions:clienthub
```

`firestore` here deploys only the `clienthub` database, the only one named in firebase.json. Create that database in the console first, because the CLI would otherwise create it with default settings. Never run a bare `firebase deploy` from this repository.

## Firebase console setup (Charlotte)

1. Create the Firestore database with id `clienthub`, Native mode, location australia-southeast1, and switch on point in time recovery.
2. Create a Hosting site, for example `executiveframe-clienthub`, and put its id in `.firebaserc` under hosting.
3. Create a Storage bucket in australia-southeast1 and put its name in `.firebaserc` under storage.
4. Authentication: add `clients.executiveframe.co.nz` to authorised domains. Google, Microsoft and email providers are shared with the Learning Hub.
5. Connect the custom domain and add the DNS records. Record the DNS change in the Site Changes Log.
6. In Google Cloud, IAM and Admin, Audit Logs: switch on Data Read for Cloud Firestore.
7. Review who holds Owner or Editor on the project.

See docs/decisions.md for decisions and open questions.
