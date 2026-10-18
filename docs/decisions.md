# Decisions and open questions

## Decided in stage 1 (18 October 2026)

1. Release gate. Drafts live in practitioner only collections and released content is copied out on release. Reason: rules cannot hide fields. See data-model.md.
2. Practitioner and admin roles are separate. Sarah holds `practitioner`. Charlotte holds `admin` on her own account and uses a separate test account for practitioner flows, unless Sarah decides otherwise. Reason: minimum necessary access to health information.
3. Isolation inside the shared Firebase project. Functions deploy under codebase `clienthub`, Firestore rules deploy only to the `clienthub` database, and Storage rules deploy only to the `clienthub` bucket target. Reason: a Learning Hub deployment must not delete or overwrite anything here.
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

## Open questions

Answered by Charlotte on 18 October 2026 (see decision 30): 1 (discounted seat), 2 (clinical record, 10 years), 3 (all in the hub), 5 (adults), 9 (email and password only). Still open: 4, 6, 7, 8, 10, plus the discount rate and the email sender address.


1. Learning Hub access. Does activation grant clients a complimentary Learning Hub seat? Without one, results links reach a paywall. With separate projects, clients hold a separate Learning Hub login.
2. Retention. Is the Client Hub part of Sarah's clinical record, or a working copy summarised into Splose? This sets retentionUntil, which the regulations require to run at least 10 years from the last service.
3. Pilot measures. Will commercial instruments be administered outside the hub? If so, an external assignment type is needed so that booking triggers correctly.
4. Client type. For the pilot, should Sarah set the type when issuing the code, with intake answers recorded but not acted on?
5. Age. Is the pilot limited to adults?
6. App Check. Its reCAPTCHA provider loads a Google script, which conflicts with the no third party scripts rule. Until decided, redeemActivationCode relies on attempt limits.
7. Accent colours for neurodivergent and health types, and their relationship to the status colours.
8. Firebase project access. Who else holds Owner or Editor on ef-client-hub? Should the project move under Sarah's own Google organisation?
9. Google and Microsoft sign in. Firebase Authentication loads `https://apis.google.com/js/api.js` into the page for the sign in window. The current Content Security Policy blocks it, so only email and password sign in would work. Options: allow that 1 Google script on the log in and sign up pages only (Google already processes the sign in), or offer email and password only in the Client Hub. Learning Hub members who signed up with Google would need the first option. To decide before stage 3.
10. Intake wording and rules are drafts for Sarah to approve.
