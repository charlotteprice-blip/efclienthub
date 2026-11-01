# Executive Frame Client Hub: working notes for Claude

This repo is the Executive Frame Client Hub (App 2), the in treatment web app for clients of Sarah Anticich, a clinical psychologist. Charlotte Price (hello@charlotteprice.co.nz) builds and runs it. Live at https://executiveframe-clienthub.web.app, moving to clients.executiveframe.co.nz once DNS is connected. Read README.md, then docs/decisions.md, docs/data-model.md and docs/functionality-plan.md before changing anything substantial.

## Stack

Static HTML, CSS and vanilla JavaScript, no framework and no build step. Firebase project `ef-client-hub`: Hosting site `executiveframe-clienthub`, named Firestore database `clienthub` in australia-southeast1, Cloud Functions v2 codebase `clienthub`, custom claims `practitioner` or `admin`. The live app is public/index.html with public/js/live/ (app.js routes and actions, views-client.js, views-staff.js, data.js). Shared logic in public/js (scoring.js, formulation.js, formulation-views.js, ui.js) is copied into functions/shared by `npm run sync`, which every test and deploy script runs first.

## Rules that never bend

1. Every write goes through a Cloud Function. Firestore rules allow reads only.
2. No score, report or formulation is shown to a client before Sarah releases it. Automated scoring is a draft for Sarah, never a diagnosis.
3. New Zealand Health Information Privacy Code 2020 applies. Data stays in Sydney. Access and correction requests are due in 20 working days.
4. Only questionnaires Charlotte supplies with a cleared licence go live. Never embed commercial instruments or DSM text.
5. No analytics and no third party scripts. The Content Security Policy blocks inline styles and `style=""`, so widths and colours are set from classes or from script.
6. Never put client data or sample health information in commits, the work log, or chat summaries.
7. Never run a bare `firebase deploy`. Use the npm deploy scripts, which target only this app.
8. Before launch:
   1. Charlotte's own account goes back to `admin` (it is `practitioner` for testing).
   2. The 5 test clients are removed with `npm run seed:test -- remove`.
   3. `ALLOW_SAMPLE_MEASURES` is set to `false` in functions/.env.ef-client-hub, then `npm run deploy:functions`. The file is not in git but deploys with the functions, and it is `true` now.
   4. public/preview/ and public/js/preview.js are deleted (decision 17), with their links in public/styleguide.html and scripts/serve.mjs.
   5. `bookingUrl` in public/config/app.json is set to Sarah's Splose booking page (it is empty now).

## Writing and copy

UK English. No em dashes, en dashes or hyphens in prose or client facing copy (tests check the config files). Digits for numbers. Client facing copy is short, plain and warm; Sarah approves consent, intake and journey wording.

## How Charlotte wants replies

Keep chat replies short, in plain language, with bullet points. Whenever a step needs her terminal, end the reply with the exact blocks to paste, every time, starting with `cd ~/efclienthub`. She works on a Mac; the repo is at ~/efclienthub and pushes to github.com/charlotteprice-blip/efclienthub on `main`.

## Working loop

1. Make the change, keep docs/decisions.md and docs/data-model.md in step with it.
2. `npm run check` (unit tests and colour contrast). `npm run test:rules` needs the Firestore emulator and Java.
3. Look at the result in the local harness: `npm run harness`, then http://localhost:5174. Practitioner sarah@example.com, admin charlotte@example.com, password sample-pass. It runs the real function logic against an in memory database.
4. Commit with a plain message and push.
5. Deploy with `npm run deploy:hosting`, plus `npm run deploy:functions` when functions changed, plus `npm run deploy:rules` when rules changed. If Firebase says credentials are invalid: `firebase login --reauth`. If a script says Google credentials are missing or expired: `gcloud auth application-default login`.
6. Add an entry to the Notion App 2 Work Log (Executive Frame, App 2). Without a Notion connection, run `npm run worklog` and give Charlotte the text to paste.

## Useful commands

`npm run tasks` lists everything. `npm run roles -- list|set <email> practitioner|admin|remove <email>`. `npm run seed:test` and `npm run seed:test -- remove` for the 5 fake clients (all @example.com, password TestClient-2026). `npm run codebook` then `npm run measures -- upload measures/cleared.json` after editing measures/ef-client-hub-codebook.xlsx.

## Where things stand (1 November 2026)

Built: activation codes, consent, intake, questionnaire library of 68 with 31 cleared, scoring drafts and release, check in schedules, 5P formulation with client responses and 7 selectable drawings, practitioner dashboard, client home, resources and next session, privacy requests. Sarah (consultant@sarahanticich.co.nz) has practitioner access and is reviewing.

Still to do, in the order of docs/functionality-plan.md: stage 7 email at key moments, stage 9 Sarah edits config in the hub, stage 10 completion and closure with 10 year retention, stage 11 Learning Hub discount code. Also: licence review for the questionnaires not yet cleared, mapping Learning Hub topics and batteries in the codebook, connecting the custom domain, and the launch steps in rule 8.
