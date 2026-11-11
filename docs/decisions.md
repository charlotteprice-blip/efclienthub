# Decisions and open questions

## Decided in stage 1 (18 October 2026)

1. Release gate. Drafts live in practitioner only collections and released content is copied out on release. Reason: rules cannot hide fields. See data-model.md.
2. Practitioner and admin roles are separate. Sarah holds `practitioner`. Charlotte holds `admin` on her own account and uses a separate test account for practitioner flows, unless Sarah decides otherwise. Reason: minimum necessary access to health information. During testing Charlotte's own account holds `practitioner`; it goes back to `admin` before launch (CLAUDE.md rule 8).
3. Isolation inside the shared Firebase project. Functions deploy under codebase `clienthub`, Firestore rules deploy only to the `clienthub` database, and Storage rules deploy only to the `clienthub` bucket target. Reason: a Learning Hub deployment must not delete or overwrite anything here. Superseded by decision 29: the Client Hub now has its own Firebase project. The named database, bucket target and codebase stay, so deploys still touch only this app.
4. Membership process mirrors Themescape: sign up before redemption, codes of 12 characters, single use, valid 30 days. See client-journey.md.
5. No third party scripts. The Firebase SDK and Figtree will be stored in `public/assets/vendor` and `public/assets/fonts`. A Content Security Policy in firebase.json enforces this.
6. Repository is `charlotteprice-blip/efclienthub` rather than the `executive-frame-client-hub` named in the brief.

## Decided in stage 2 (18 October 2026)

7. `tokens.css` is generated from Levi's `brand/tokens.json` by `scripts/build-tokens.mjs`, so the Learning Hub can produce an identical file. Client Hub values live in `app.css`. See brand-notes.md.
8. Status colours defined and checked: done #2F5D3A, in progress navy #2E4062, needs attention #6E4A10. Each passes 4.5:1 on sky, warm white and its own tint, and is always shown with an icon and a word.
9. Client type accents and journey copy live only in `public/config/client-types.json`. Type names are never shown to clients.
10. The intake rules are a pure function (`public/js/intake-rules.js`) so the browser and `submitIntake` apply identical logic. A type set on the activation code takes priority. If no rule fits, the type is left for Sarah to assign.
11. The question about previous ADHD assessment is written but switched off, because it collects health information and Sarah has not decided to ask it.
12. Firebase SDK 13.0.0 and Figtree (Latin and Latin Extended) are self hosted by `scripts/vendor.mjs`.

## Decided after stage 2 (18 October 2026)

13. Layout is a desktop web viewer in the manner of the Themescape viewer: a sky blue frame holding the sidebar navigation and a top bar with the account menu, around a warm white workspace (the kit's reading ground). Below 900px the sidebar becomes a menu drawer so activation and questionnaires still work on a phone. The brief's phone first wording is superseded by Charlotte's instruction; phone use remains supported.
14. On Home, the mark's incomplete circle is the journey indicator, filling in the client type accent as stages pass. This is the 1 distinctive element; everything else stays quiet.
15. Questionnaires open in a focus mode: the sidebar dims, 1 question sits in a centred column, and on a keyboard the number keys choose an answer.
16. Practitioner pages use the same shell with their own navigation (Clients, To review, Activation codes, Questionnaire library) and a wider workspace for tables.
17. Static layout previews live in `public/preview/` with sample content only. They are deleted before launch.

## Clickable sample (18 October 2026)

18. A clickable sample of the whole pilot lives in `public/sample/`, served at `/sample/` and built into 1 shareable file by `npm run build:sample`. It runs on invented data in the browser with no Firebase. `sample-store.js` mirrors each Cloud Function (redeemActivationCode, submitIntake, submitMeasure, scoreMeasure, triggerBooking, issueActivationCode, setClientType, assignMeasure, releaseResults) so it doubles as the specification for stages 3 to 5.
19. Scoring is a pure module (`public/js/scoring.js`) that the scoreMeasure function will use unchanged: reverse scoring, mean or sum per subscale, bands, a minimum share of answers before a subscale is scored, and a draft listing strengths and areas of focus with reasons and Learning Hub topics.
20. Clients see strengths and areas of focus with reasons once released; numeric scores are shown only to Sarah.
21. The 2 sample questionnaires were written for the demonstration, are marked as sample in the library, and must never be used with clients.

## Terminal tasks (18 October 2026)

22. Every setup step that the Firebase CLI, gcloud or a Google API can perform runs from `npm run setup`, which checks before acting, asks before each change and can be rerun safely. Roles are granted with `npm run roles`. Deploys go through named npm scripts only. Creating the project under Sarah's account and adding DNS records at the DNS host stay manual.

## Live app (18 October 2026)

23. The live app is a path routed single page app at `/` (Hosting rewrites every route to index.html), reusing the sample's screens with live data. Routes: /signup, /login, /reset, /activate, /consent, /intake, /dashboard, /questionnaires, /measure/{id}, /done, /results, /formulation, /account, /practitioner and below.
24. Function logic lives in `functions/handlers.js` with an injected database, so the same code runs in Firebase and in the in memory tests (11 journey tests) and the end to end harness.
25. Activation codes are stored only as a SHA 256 hash with the last 4 characters for display; Sarah sees the full code once, when it is issued. A code may optionally be bound to the client's email. Code attempts are limited to 10 an hour per account.
26. Sample questionnaires are assignable only while `ALLOW_SAMPLE_MEASURES=true`; otherwise only questionnaires marked `cleared` can be assigned.
27. Google and Microsoft sign in stay off (`socialSignIn: false`) until open question 9 is decided; email and password works now.
28. Results links to the Learning Hub open in a new tab and need a separate sign in there until the handover in open question 1 is built.

## Separate Firebase project (18 October 2026)

29. The Client Hub runs in its own Firebase project, `ef-client-hub`, created under the charlotteprice.co.nz Google organisation. Health information, accounts and deployments are fully separate from the Learning Hub, which closes earlier concerns about shared console access. Clients have a separate login from the Learning Hub, and results links open the Learning Hub with its own sign in. Ownership: Sarah should be added as Owner and billing should sit with her business, since she is responsible for the health information; to confirm with Sarah.

## Functionality after the pilot (18 October 2026)

30. Charlotte answered the design questions; the agreed scope and build order are in functionality-plan.md. In short: adults seen 1 to 1; Sarah chooses when results are released; check in questionnaires on a per client schedule; latest released formulation only; booking stays a Splose link; all questionnaires in the hub; read only at completion then closure with a 10 year retention date; a practitioner dashboard; email and password sign in only; Learning Hub access at a discounted rate via a code shown in the hub; email at key moments from an Executive Frame address; Sarah edits intake, journey copy and the library herself. Items for Sarah to confirm are marked in the plan.

## Stage 6, check in schedules (18 October 2026)

31. A schedule belongs to 1 client and 1 questionnaire, with a cadence of weekly, fortnightly, every 4 weeks, or a list of dates, a start date and an optional end date. Sarah can pause, resume and end it. 1 active schedule per questionnaire per client.
32. The daily run is a scheduled Cloud Function at 7am New Zealand time. Dates are stored as New Zealand calendar days, not timestamps. Missed dates are skipped rather than stacked; an open copy of the questionnaire is never duplicated.
33. Finishing a check in leaves the journey stage where Sarah has it. The booking step is triggered only by the initial assessment. On Home, a check in that is due takes precedence over the stage's usual action button.
34. Repeated scores are shown to Sarah as a table of subscale scores by completion date once a questionnaire has been completed more than once. Clients see only the released strengths and areas of focus, as before.
35. Email on assignment waits for stage 7; the run is audited as actor `system` so the email step can be added without changing the schedule logic.

## Questionnaire library (18 October 2026)

36. The EF Client Hub Codebook, a copy of the CPC Psychometric Codebook with Hub Library and Hub Subscales sheets, is the single source for questionnaires. `npm run codebook` builds the library files; nothing is retyped.
37. Licence status per instrument is Charlotte's reading of the codebook sources, to confirm with Sarah: cleared (ASRS, CSES, PES, DASS-21, PPS, IPS, GSE), review (ESQ-R, CFI, SKS, SUS, SSES, PTQ, RRS, FSCRS, PCI, SCS-SF), permission needed (BPNSFS, GCS, GADJ). Only cleared instruments can be uploaded or assigned.
38. ASRS and DASS-21 are practitioner only: scored for Sarah, never summarised to the client, skipped by release. DASS-21 items 10, 17 and 21 at 2 or more and FSCRS item 9 at 1 or more are flagged to Sarah as answers to follow up.
39. Default bands are thirds of the response range on the item mean, with a scoring direction per subscale; DASS-21 uses its published normal range cut offs. All client facing wording and Learning Hub topics in the Hub Subscales sheet are drafts for Sarah.
40. Reverse scoring is minimum plus maximum minus the answer, so scales starting at 1 reverse correctly (was maximum minus the answer).

## Questionnaire library, continued (18 October 2026)

41. Transcription scope: every instrument with an open licence (public domain or an explicit free with attribution grant) and an open access item source is transcribed into the codebook, across all domains. Free for non commercial or research only instruments are transcribed too and held at review until the authors confirm practice use. Each transcription gets a second, independent check against its source before Charlotte spot checks and Sarah approves wording.
42. Flagged answers on clinical screeners alert Sarah on the draft only (email arrives with stage 7). No client facing message and no restriction on when a screener can be completed.
43. Default questionnaire batteries per client type live in `client-types.json` `defaultMeasures`, mapped from the codebook Batteries sheet; only cleared questionnaires are assigned. Sarah to confirm the mapping.
44. Clinical screeners found for New Zealand practice are Sarah only in the hub. Risk measures (C-SSRS screener and similar) are not transcribed until Sarah decides, and would never run unattended.

## Open licence instruments merged (18 October 2026)

45. 50 open licence instruments are merged into the codebook from open access sources, each transcribed verbatim and then checked item by item by an independent second pass (829 items across 53 transcriptions; every item matched its source apart from punctuation, and the CAPE-42 dimension memberships were resolved from the CamCOPS source). Transcriptions and check reports live in `measures/sources/`.
46. Licence status for the new rows: cleared only where the source is public domain or the rights holder grants practice use in writing (ADEXI, APS-R, SAPS, AUDIT-C, CAGE, CBI, CES-D, COHS, CPC-12, CUDIT-R, DES-II, FMPS-B, GAD-7, PHQ-2, PHQ-9, JDS, Mini-IPIP, MWQ, NCS-6, PSWQ, RAADS-14, SCS, UCLA-LS-3, WHO-5, and the to decide AMS-C, CAPE-42 and SRQ-63); review where use is research or non commercial only, second hand, or needs the author's word (BIS-11, BIS-Brief, CFC-14, CFQ, GPS, Hua Oranga, MEWS, SWLS, WEBEXEC, WSAS, WHODAS 2.0 and all 10 PROMIS forms). Only rows marked Include = Yes and cleared reach `cleared.json`.
47. Clinical screeners are practitioner only with the published threshold as the upper band; PHQ-9 item 9 at 1 or more alerts Sarah on the draft. An item may carry its own response options (AUDIT-C, CUDIT-R, CBI, PROMIS Global Health, GAD-7 difficulty item), scored on its own range.
48. Not built: BTQ (per event follow up questions) and WFIRS-S (needs a not applicable answer excluded from the mean). Held back for Sarah: IPIP-NEO-120, BFAS, C-SSRS Screener. Hua Oranga goes to Te Rau Ora for confirmation before use, as a courtesy as much as a licence step.
49. Domains 4 and 5 renamed (Clinical and distress screening; Self talk, thinking patterns and personality) and domains 7 (Wellbeing and life satisfaction) and 8 (Functioning and health) added. Client names, subscale labels, bands and strength and focus wording for the new rows are drafts for Sarah; Learning Hub topics are left for Charlotte to map.

## Formulation (18 October 2026)

50. The formulation is 5P (presenting, predisposing, precipitating, perpetuating, protective), with a plain language summary Sarah writes above the cards. The client sees the latest release only, as before.
51. Released areas of focus are offered as perpetuating factors and released strengths as protective factors, each carrying its source on the card; Sarah adds, edits, moves or removes cards and nothing is placed automatically.
52. The client reads the formulation and responds to each card (fits, partly, does not fit, optional comment). Responses go to Sarah on the client's record, tagged with the version answered; local drag and drop rearranging is removed.
53. Library tags (conditions and topics) live in the Hub Library sheet and appear as filter buttons; library columns sort by heading.

## Dashboard (19 October 2026)

54. The practitioner landing page is a dashboard: counts by stage, needs attention (thresholds in `app.json` `attention`), check ins due in the next 7 days, and a linear tracker per client across the 7 journey stages. The client table lives at /practitioner/clients.

## Client Home (19 October 2026)

55. The client Home shows, in order: the journey ring and stage copy; To do (questionnaires and check ins to complete, booking when the stage calls for it and no session is recorded, formulation cards awaiting a response, results shared in the last 14 days); Next session (set by Sarah on the client record, with a note; otherwise the booking link); report progress under the type's report name (questionnaires, Sarah reviews, feedback session, results shared, formulation shared); and Your resources (links Sarah pins plus the Learning Hub topics from released areas of focus). Links only, never files.

## Questionnaire page (19 October 2026)

56. Each questionnaire in the library opens its own page: about and licence, assign to a client, a test run that walks the questions as a client would and shows the resulting draft without saving anything, averages and band counts across the clients who have completed it (raw scores, not norms), the scoring rules, and the question list with reversed, alerting and own scale items marked. Log out sits top right on every page.

## Client record (19 October 2026)

57. The client record is split into tabs under the client's name: Overview (profile, intake, next session, resources), Questionnaires (assigned, check ins, draft results with the release button), Formulation (summary, suggestions, zones, release, and a live 5P map redrawn on every edit with the client's responses as dots), and Requests. Panels flow into 2 columns without gaps and detail rows carry faint lines.
58. The formulation can be drawn 7 ways and Sarah picks the drawing per client: the 5 box map (default), flower (maintenance cycles as petals, after Moorey's six cycles model), river (longitudinal timeline with an eddy), layers (Kuyken, Padesky and Dudley's descriptive, cross sectional and longitudinal levels with strengths alongside), balance, radial with questionnaire sources, and a loop with exits. The choice is saved on the draft as `view`, released with the factors, and shown on the client's Formulation page above the cards, with the response controls always on the cards so the drawing is never the only way to answer. The drawings are inline SVG built from classes, so they work in both themes under the strict Content Security Policy and need no library.

## Splose sync (1 November 2026)

59. Built 1 November 2026, switched on in `app.json` but inert until the `SPLOSE_API_KEY` secret is set and Sarah links a client: a scheduled Cloud Function reads each linked client's appointments, forms and (optionally) case from the Splose API and writes a small `sploseProgress` record the client's Home and Sarah's dashboard show beside the journey stage. The sync never moves `journeyStage`; it adds Needs attention rows instead (feedback attended but stage not moved, did not arrive, Splose form not completed after 7 days, link error). Splose has no webhooks and no notes or reports, so this is polling every 15 minutes and covers appointments, forms and the case only. Dates, service names, statuses and counts are stored; never pricing, notes, form answers or invoices. The client copy on Home is draft for Sarah, and the service to stage map (`splose.services`) is empty until Sarah names which Splose services are the first session, feedback, ongoing sessions and review. Still open from splose-sync.md: whether clients see attendance counts (on by default), case tracking (off), and a consent line naming Splose as a source.

## Shared sign in with the Learning Hub (10 November 2026)

60. Both apps now sit in the 1 Firebase project `ef-client-hub` (the Learning Hub in its own Hosting site, functions codebase and database), so 1 login works in both and the separate login in decision 29 no longer applies. The Learning Hub's start page is the 1 address the website and Sarah's emails send people to, and a signed in client should land in the Client Hub without choosing. The Learning Hub must never read the `clienthub` database and the Client Hub sets custom claims only for staff, so the signal lives here as a callable Cloud Function, `hasClientHub` (australia-southeast1). It requires a signed in caller, reads only that caller's own `clients` document with admin access, and returns `{ hasHub: true }` when the document exists and has no `closedAt`, or when the token carries the `practitioner` or `admin` claim; otherwise `{ hasHub: false }`. Nothing else is ever returned, the browser never reads `clients` from the Learning Hub, Firestore rules do not change, and the function logs nothing about who asked or what the answer was (a failure logs the error code only), because being a psychologist's client is health information under the Health Information Privacy Code 2020. It has its own CORS list, the Learning Hub origins (learn.executiveframe.co.nz, executiveframe-learninghub.web.app and .firebaseapp.com) plus this app's own and localhost, so the other functions' CORS is unchanged.

## Audit fixes (11 November 2026)

Fixes from the 10 November audit (`docs/audits/impeccable-client-hub-2026-11-10.md`), made on the branch `audit-fixes-2026-11-10`. The fix log is `docs/audits/fixes-client-hub-2026-11-11.md`.

61. Flagged answers reach Sarah on the dashboard. A completed questionnaire with flagged answers leads Today with a Follow up pill, shows on the client's dashboard row and on every tab of their record, and counts in To review, including questionnaires that are for Sarah only. It stays there until Sarah presses Mark as followed up on the draft (`markFlagsFollowedUp`, practitioner only, audited), which records `flagsFollowedUpAt` and `flagsFollowedUpBy` on the `scoring` document. The flagged answers stay on the draft either way, and the dashboard names the questionnaire and the count, never the answer. Decision 42 still holds: no client facing message. Whether clients should also see a line on where to get urgent help is Sarah's to decide.
62. Today lists everything waiting on Sarah: flagged answers, drafts to review, every open privacy request (marked Due soon inside the `requestWorkingDays` threshold), and the earlier attention rows. Each row leads with a status pill and its link opens the tab where the work is. The To review count is the number of completed questionnaires waiting (a draft to release, flagged answers, or both, counted once) plus open requests.
63. A save keeps the person's place. Repainting the same page (after a save, an error, a moved factor, a change of drawing) keeps the scroll position and returns focus to the control that was used; only a change of page starts from the top. The message after a save stays in view at the top of the workspace. A form error takes focus and is scrolled into view, and intake shows a short summary that is announced.
64. On a formulation card the fit choice saves the moment it is chosen, like questionnaire answers; Save comment sends the comment. The card says Saved beside itself and the picture redraws its mark, without repainting the page. This refines decision 52.
65. Releasing a formulation asks first. Release formulation opens the same kind of dialog as Release results, naming the client, the number of cards, whether a summary goes with them and the drawing chosen; nothing is shared until Sarah confirms. There is no withdraw: Charlotte decided on 11 November 2026 to add the confirmation only, and the dialog says a released formulation cannot be withdrawn and that a corrected version can be released.
66. Every dialog is named by its heading (`aria-labelledby`), so a screen reader announces what it is.
67. The question screen (refines decision 15). Instructions longer than 140 characters are read once, on a Before you start screen ahead of question 1, and sit behind Show instructions on each question; a short stem stays under the question. A question longer than 90 characters steps down from title to heading size. Back and Next stay in view at the bottom of the screen. Number keys choose the first 9 answers; the arrow keys reach the rest. The menu no longer fades during a questionnaire, because its links still work and faded text failed contrast.
68. Formulation drawings (refines decision 58). The client's response to a card is a mark with its own shape (tick, half, cross, empty ring) and a key in words sits under every drawing. Where the drawing's container is under 800px wide the 5 SVG drawings give way to the map, with a line saying so. Factors are no longer cut short where cards sit in measured columns; petals on the flower and cards on the loop keep a 3 line limit because their neighbours are fixed, and the full words are always on the cards below.
69. Client Home (refines decision 55). Only the first thing that can be pressed in To do is a primary button; the rest are secondary and every link names what it opens. To do and Not started use a neutral pill (empty ring, navy tint); the attention pill is for Sarah's screens. A form Sarah has sent from Splose is said once, as a To do row. On a phone the ring is small and sits beside the step and title. The report tracker says done, the current step or still to come in words for a screen reader. Still open for Charlotte and Sarah: whether to fold later tasks into 1 line, whether to hide the empty resources panel, and the wording that names Splose.
70. Privacy requests. 1 open request for a copy at a time: `createRequest` answers `already: true` for a second access request while 1 is open, and Account shows the date asked and the reply date in place of the button. Corrections are not limited. An empty correction shows a field error.
71. Practice contact. `contactEmail` in `app.json` (consultant@sarahanticich.co.nz, given by Charlotte on 11 November 2026) is shown where a client needs to reach Sarah: the activation screen, the booking dialog until `bookingUrl` is set, and Account.
72. An admin account does not see who the clients are (Charlotte, 11 November 2026). Being a psychologist's client is health information, so client names and emails are for the practitioner only. This is enforced where the data is handed out, not only on screen: the rules make `activationCodes` and `auditLog` practitioner only; admin gets its codes list from `listActivationCodes`, which returns the last 4 characters, type, dates and whether the code is used, with no name, email or uid; a code issued by an admin account stores no name or email whatever is sent, and shows in Sarah's list as issued by admin; and the audit entry for an issued code now names the code by its last 4 characters, not the client. Admin keeps the questionnaire library, config, its own account page and issuing codes. This does not limit what the owner of the Firebase project can see in the Google console (open question 8).
73. A client cannot read scoring rules (Charlotte, 11 November 2026). The rules make `measures` staff only. A client is handed the questions and answer options of the questionnaires assigned or scheduled to them by `myQuestionnaires` (`core.measureForClient`: id, name, instructions, answer options, and each item's id, text and own options), so bands, subscales, flag thresholds, reasons and the practitioner only marker never reach a client's browser. Deploy order matters: functions and hosting first, then rules (`npm run deploy:functions`, `npm run deploy:hosting`, then `npm run deploy:rules`). If the rules went first, the pages then live would find no questionnaires for clients.

## Open questions

Answered by Charlotte on 18 October 2026 (see decision 30): 1 (discounted seat), 2 (clinical record, 10 years), 3 (all in the hub), 5 (adults), 9 (email and password only). Still open: 4, 6, 7, 8, 10, plus the discount rate and the email sender address.


1. Learning Hub access. Does activation grant clients a complimentary Learning Hub seat? Without one, results links reach a paywall. With separate projects, clients hold a separate Learning Hub login.
2. Retention. Is the Client Hub part of Sarah's clinical record, or a working copy summarised into Splose? This sets retentionUntil, which the regulations require to run at least 10 years from the last service.
3. Pilot measures. Will commercial instruments be administered outside the hub? If so, an external assignment type is needed so that booking triggers correctly.
4. Client type. For the pilot, should Sarah set the type when issuing the code, with intake answers recorded but not acted on?
5. Age. Is the pilot limited to adults?
6. App Check. Its reCAPTCHA provider loads a Google script, which conflicts with the no third party scripts rule. Until decided, redeemActivationCode relies on attempt limits.
7. Accent colours for neurodivergent and health types, and their relationship to the status colours.
8. Firebase project access. Who else holds Owner or Editor on ef-client-hub? Should the project move under Sarah's own Google organisation? Checked 1 November 2026: the project sits in the charlotteprice.co.nz organisation; Charlotte is the only person with Owner or Editor (Google's own service account also holds Editor); billing is on "My Billing Account", reached from Charlotte's login. Still to decide: adding Sarah as Owner, moving billing to her business, and moving the project.
9. Google and Microsoft sign in. Firebase Authentication loads `https://apis.google.com/js/api.js` into the page for the sign in window. The current Content Security Policy blocks it, so only email and password sign in would work. Options: allow that 1 Google script on the log in and sign up pages only (Google already processes the sign in), or offer email and password only in the Client Hub. Learning Hub members who signed up with Google would need the first option. To decide before stage 3.
10. Intake wording and rules are drafts for Sarah to approve.
