# Executive Frame Client Hub

In treatment web app for clients of Sarah Anticich, served at clients.executiveframe.co.nz. Static HTML, CSS and vanilla JavaScript on Firebase, with no front end framework and no build step. Developer: Charlotte Price (hello@charlotteprice.co.nz). Work log: Notion, Executive Frame, App 2.

This app shares Firebase Authentication with the Learning Hub (app.executiveframe.co.nz) in project `executiveframe-app`. It has its own Hosting site, named Firestore database (`clienthub`), Storage bucket and functions codebase, so a Learning Hub deployment cannot touch it.

## Layout

```
firebase.json          Hosting target, clienthub database, storage target, functions codebase
.firebaserc            project and target mapping
firestore.rules        rules for the clienthub database
storage.rules          bucket closed to browsers
firebase.test.json     emulator config used only by the rules tests
brand/                 Levi's tokens.json and the Client Hub status colours
tests/rules.test.js    security rules tests (emulators)
tests/unit/            config and intake rule tests (no emulators)
functions/             Cloud Functions, codebase "clienthub" (stubs until stage 3)
public/
  css/tokens.css       generated from brand/tokens.json, shared with the Learning Hub
  css/app.css          Client Hub styles and overrides
  config/              client-types.json and intake.json
  js/                  firebase.js, intake-rules.js, client-types.js, mark.js
  templates/page.html  base layout to copy for each page
  styleguide.html      every component, for checking against the brand
  assets/              brand SVGs, self hosted Figtree and Firebase SDK
scripts/               vendor.mjs, build-tokens.mjs, check-contrast.mjs
docs/                  data model, client journey, decisions, brand notes, intake guide
```

## Commands

```
npm install
npm run vendor         copy the Firebase SDK and Figtree into public/assets
npm run tokens         regenerate public/css/tokens.css from brand/tokens.json
npm run contrast       check every colour pairing against WCAG 2.2
npm run test:unit      config and intake rule tests
npm run test:rules     security rules tests in the emulators (needs Java 21+)
npm test               all of the above checks
npm run build:sample   build the clickable sample into dist/client-hub-sample.html
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
