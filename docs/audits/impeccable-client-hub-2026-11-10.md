# Impeccable audit: Executive Frame Client Hub

Date: 10 November 2026. Scope: the live app (`public/index.html`, `public/js/live/`, shared `public/js`, `public/css`). Method: the `impeccable` skill in audit mode, the local harness at localhost:5174 with invented clients only, the Browser preview at 375, 768, 1024 and 1280px wide, keyboard only passes, a scripted contrast and target size check on each screen, `npm run check`, the impeccable detector, and a read of the source. Nothing was changed. Nothing here comes from the live site or a real record.

## 1. Summary

1. The hub is in good shape underneath: the release rule holds in the screens and in the Firestore rules, forms are labelled, focus is visible, 102 unit tests pass and all 25 colour pairings pass.
2. The most serious gap is on Sarah's side: an answer that a questionnaire flags for follow up does not appear on the dashboard, in Today or in To review. She sees it only if she opens that client's Questionnaires tab.
3. For clients the main problems are friction, not leaks: every save jumps the page back to the top, intake errors appear off screen, the question screen needs scrolling on a phone, and the formulation drawings are too small to read on a phone.
4. Accessibility is partial against WCAG 2.1 AA: 5 kinds of text fall below 4.5:1 because of opacity, client responses are shown by colour alone, and the drawer and dialogs are missing state and names.
5. Audit health score 13 of 20 (acceptable). 35 findings: 0 P0, 12 P1, 17 P2, 6 P3. None of the 5 issues in the 1 November critique of Home has been addressed yet.

### Audit health score

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 2 | Text at 2.45:1, colour only response dots, lost focus after every save |
| 2 | Performance | 3 | Staff pages reload every collection on each page change |
| 3 | Theming | 3 | Tokens used throughout; a few hard coded colours in the drawings |
| 4 | Responsive design | 2 | Drawings unreadable on phones; task rows collapse at 900 to 1150px |
| 5 | Implementation integrity | 3 | Coherent and specific to the product; 16 advisory drift notes, 0 failures |
| Total | | 13/20 | Acceptable |

Implementation integrity verdict: pass. The app is recognisably its own system (sky and paper, the mark as journey ring, Sarah's voice in the copy). The detector found 0 failures and 16 advisory notes, all small drift from DESIGN.md (finding 32). Its browser overlay cannot run because the Content Security Policy blocks injected scripts; that is correct and was left alone.

Severity: P0 blocks a task. P1 is a major difficulty, a safety or privacy risk, or a WCAG 2.1 AA failure. P2 is a real annoyance with a workaround. P3 is polish.

## 2. Findings, most severe first

### P1

**1. Answers flagged for follow up never reach the dashboard**
- Screen: practitioner Dashboard, To review, client record. Affects: practitioner, and through her the client.
- What is wrong: when a questionnaire has flag items and a client answers at or above the threshold, the "Answers to follow up" notice shows only inside that draft, on the client's Questionnaires tab, below the fold. In the harness the dashboard said "Nothing waiting on you" while a flagged draft existed. A questionnaire marked "For you only" is also left out of the To review count, so the badge can read 0.
- Why it matters: these are the answers Sarah most needs to see quickly. The product promise is that the dashboard says who needs her today.
- Where: `public/js/live/views-staff.js:151` (`attentionItems` has no flag case), `:107` (`reviewCount`), `:356` (flags drawn only in the draft block).
- Fix: add a flag case to `attentionItems` that lists the client first in Today with a Needs attention pill and a link straight to the Questionnaires tab. Count flagged drafts in `reviewCount`. Show the same pill on the client's dashboard row and Overview tab. Decide with Sarah whether the client should also see a calm line on where to get urgent help, since the hub is not monitored. Suggested command: `/impeccable harden`.

**2. An admin account cannot open any questionnaire page**
- Screen: Questionnaire library, 1 questionnaire. Affects: admin (Charlotte, once her account returns to admin under rule 8).
- What is wrong: `measurePage` reads `s.ctx.clients`, `s.ctx.assignments` and `s.ctx.scoring`, which do not exist for the admin role. The page throws and stays on "Checking your access" for ever. More widely, any error thrown while drawing a screen leaves that loader with no message.
- Why it matters: admin runs the library, and the launch steps move Charlotte to admin. A stuck loader with no words is the worst error state in the app.
- Where: `public/js/live/views-staff.js:717` to `:722`; `public/js/live/app.js:106` (`route` has no catch around the view).
- Fix: default those 3 collections to empty for admin and hide Assign and "Across your clients" for that role. Wrap the view call in `route` so a failure paints a plain message with Try again and Log out. Suggested command: `/impeccable harden`.

**3. Intake errors appear off screen and are not announced**
- Screen: intake ("A few questions to start"). Affects: client.
- What is wrong: pressing Finish setting up with a question unanswered repaints the page at the top. The 2 error messages sit about 800px and 1160px down. Nothing is focused, nothing is announced, and the radio groups carry no `aria-invalid` or `aria-describedby`. To the client the button appears to do nothing.
- Why it matters: this is the last step of sign up for people who are often tired or anxious. A silent failure here loses them.
- Where: `public/js/live/views-client.js:273` to `:285`; `public/js/live/app.js:97` to `:101` (focus looks only for `aria-invalid`).
- Fix: give each fieldset and textarea an error id, set `aria-invalid` and `aria-describedby`, scroll to and focus the first invalid control, and add a short summary at the top with `role="alert"`. Do the same for "Choose an answer to continue" on the question screen (`views-client.js:479`). WCAG 3.3.1, 4.1.3. Suggested command: `/impeccable harden`.

**4. Every save jumps the page to the top and drops keyboard focus**
- Screen: client Formulation; practitioner client record (all tabs), Activation codes. Affects: both.
- What is wrong: every action repaints the whole app, scrolls to the top and moves focus to the main region. A client who answers the last of 9 formulation cards is thrown from 1,491px back to 0 and must find their place 8 more times. Sarah changing the drawing in "Live picture" (at the bottom of a long tab), moving a factor or adding a resource is thrown to the top each time.
- Why it matters: it breaks the promise of low attention cost, makes the live 5P map unusable as a live loop, and for keyboard and screen reader users it is a change of context on input.
- Where: `public/js/live/app.js:77` to `:104` (`paint` and `afterPaint`), `:441` to `:450` (card response), `:743` to `:763` (move factor, change drawing).
- Fix: on an action that stays on the same path, keep the scroll position and return focus to the control that was used (or its replacement by id). Reset scroll and focus only when the path changes. Better still for cards: update the 1 card in place. WCAG 3.2.2, 2.4.3. Suggested command: `/impeccable harden`.

**5. Formulation drawings cannot be read on a phone and clip text everywhere**
- Screen: client Formulation, practitioner Live picture; the 5 SVG drawings (flower, river, balance, radial, loop). Affects: both, clients most.
- What is wrong: the drawings are a fixed 960 unit canvas with 13 unit text, scaled to the container. At 375px wide the text renders at about 4.4px. At 1024px it is about 9px, with labels down to 7.8px. Factor text is cut to 2 or 3 lines with an ellipsis, so a client's own words are truncated in the picture. The map and layers views are HTML and read well.
- Why it matters: the formulation is the centrepiece, and the product says phones are 1 of the 2 main scenes. A picture of your own formulation that you cannot read does harm to trust.
- Where: `public/js/formulation-views.js:26` to `:33` (canvas and text sizes), `:42` to `:60` (truncation), `:119` (frame); `public/css/components.css:1035` to `:1041`.
- Fix: below about 700px of container width, show the map or layers view in place of an SVG drawing, or lay the SVG out to a narrower canvas with 16px text. Remove truncation, since card heights are already measured from the text. WCAG 1.4.4, 1.4.10. Suggested command: `/impeccable adapt`.

**6. On a phone the question screen needs scrolling on every question**
- Screen: answering a questionnaire. Affects: client.
- What is wrong: the question is set at 28px and the questionnaire's instructions are repeated in full under every question. 7 of the 31 cleared questionnaires have instructions over 250 characters, up to 550. On a 375 by 812 screen with the longest, the answers start about 600px down and Next question sits at about 1,080px, well below the fold. On a laptop a questionnaire with 11 options puts the button at about 1,220px.
- Why it matters: "1 question per screen, finishable in 1 go" is the stated design. Scrolling 15 to 28 times to reach the button is the opposite.
- Where: `public/js/live/views-client.js:475` to `:476` and `:480` to `:484`; `public/css/app.css:128` (title size).
- Fix: show the full instructions once, on a short intro screen before question 1, and behind a "Show instructions" control afterwards. Step long questions down to the heading size (22px). Keep the Next button visible, for example a sticky action row on phones. Suggested command: `/impeccable adapt`.

**7. The client's response to each card is shown by colour alone**
- Screen: all 7 formulation drawings, client and practitioner. Affects: both.
- What is wrong: fits, partly and does not fit are a green, amber or red dot. The only words are a hover title. Sarah's page explains it as "green fits, amber partly, red does not fit". The red is the brick error colour, hard coded.
- Why it matters: it fails WCAG 1.4.1 (use of colour), it breaks the product's own rule that nothing is shown by colour alone, and DESIGN.md reserves brick for form errors.
- Where: `public/js/formulation-views.js:71` and `:129`; `public/css/components.css:1021` to `:1023` and `:1070` to `:1073`; `public/js/live/views-staff.js:543`.
- Fix: give each state a shape as well as a colour (tick, half, cross, empty ring), add a small key with words beside the drawing, and include the state in the text alternative. Use a status token, not `#8A3F34`. Suggested command: `/impeccable harden`.

**8. Five kinds of text fall below the 4.5:1 contrast minimum**
- Screen: every client screen with the sidebar; Home; the question screen; forms. Affects: both.
- What is wrong: `npm run contrast` checks token pairs but not opacity. Measured in the browser:
  - Formulation link in the menu before release: 2.45:1 (opacity 0.6). It is still a working link.
  - Report tracker labels for steps not yet done: 2.45:1, and 11px on phones.
  - The whole menu and the line "Your answers save as you go" during a questionnaire: opacity 0.45, about 2:1. The links still work.
  - Placeholder text: about 3.75:1 (opacity 0.75). On formulation cards and the Splose search the placeholder is the only visible label.
  - Clinical name under each map box (`.map-hint`): 3.74:1.
- Why it matters: WCAG 1.4.3. The reassurance line and the tracker are exactly the text an anxious client looks for.
- Where: `public/css/components.css:811`, `:716` to `:732`, `:989`; `public/css/app.css:409` to `:412`, `:678` to `:681`.
- Fix: replace opacity with a solid muted ink token that passes 4.5:1 on sky and on paper, and add those pairs to `scripts/check-contrast.mjs`. Keep tracker labels at 14px. In focus mode, keep the foot line at full strength. Suggested command: `/impeccable polish`.

**9. Releasing a formulation takes 1 click with no confirmation, and nothing can be withdrawn**
- Screen: client record, Formulation tab. Affects: practitioner and client.
- What is wrong: Release results opens a dialog that says what the client will see. Release formulation shares it at once. There is no way to withdraw a released formulation or released results.
- Why it matters: rule 2 depends on release being deliberate. The button sits beside the editing controls, and after any edit it becomes the primary button on the tab.
- Where: `public/js/live/app.js:571` to `:577`; `public/js/live/views-staff.js:532`.
- Fix: use the same confirmation dialog as results, naming the client, the number of cards and the drawing chosen. Consider a Withdraw action for both, recorded in the audit log. Suggested command: `/impeccable harden`.

**10. Task rows collapse between about 900 and 1150px wide**
- Screen: client Home (To do); practitioner client record panels. Affects: both.
- What is wrong: the 3 column task row sits inside a 3:2 grid or a 2 column panel flow. At 1024px the text column is 55 to 130px wide, so "Book your feedback session" and its note break at 1 or 2 words per line. The same happens on phones in Sarah's Questionnaires panel, where the "Done" pill with a date will not wrap.
- Why it matters: 1024px is a tablet on its side and many laptop windows. The first thing on Home becomes hard to read.
- Where: `public/css/app.css:835` to `:837`; `public/css/components.css:748` to `:750`, `:799` to `:805`.
- Fix: stack the Home grid to 1 column below about 1200px, or let the task row wrap its pill and button under the text when the text column is narrower than about 240px (a container query suits this). Suggested command: `/impeccable adapt`.

**11. One cleared questionnaire shows an answer scale that does not match its questions**
- Screen: answering questionnaire `jds`. Affects: client, and the validity of the scores Sarah reads.
- What is wrong: the Section One questions ask how much of something there is, but the answers offered are the accuracy scale that belongs to Section Two. The library holds 1 scale for all 15 questions and no question has its own.
- Why it matters: a client cannot answer sensibly, and the draft scoring is built on those answers.
- Where: `measures/cleared.json` (`jds`), from `measures/ef-client-hub-codebook.xlsx`.
- Fix: check the instrument, give Section One questions their own response options in the codebook, rebuild and upload. Scan the other 30 for the same pattern, since no cleared questionnaire has any per question scale. I could not confirm the source instrument, so treat this as "check" until Charlotte has compared it.

**12. Home still does not offer 1 clear next action (earlier critique, not yet addressed)**
- Screen: client Home. Affects: client.
- What is wrong: all 3 P1 issues from the 1 November critique remain. Each outstanding questionnaire has its own primary Start button (4 at first log in). On a phone the journey hero fills the whole first screen with no action. With Splose linked, the same form is described in the hero, in To do (a row with nothing to press) and in Next session, and "Splose" is named 5 times.
- Why it matters: product principle 2 and DESIGN.md ("do not put a second primary button on a view").
- Where: `public/js/live/views-client.js:327` to `:353`, `:79` to `:105`, `:109` to `:126`, `:392` to `:400`.
- Fix: as the critique set out. 1 primary for the first task with the rest folded into a quiet line, a compact hero on phones with the action inside it, and the Splose form said once as "Sarah's booking system". Suggested command: `/impeccable distill`.

### P2

**13. Today leaves out work that is waiting, and its rows are hard to tell apart**
- Screen: practitioner Dashboard. Affects: practitioner.
- What is wrong: drafts to review and open privacy requests are not in Today unless a request is within 5 working days. Today can say "Nothing waiting on you" beside a To review badge of 2. "Review 2 drafts" opens the Overview tab, not the Questionnaires tab where the drafts are. Rows have no pill or kind, and 2 rows for 1 client both end in a link named only "Open". The badge counts clients plus requests while the button counts drafts.
- Where: `public/js/live/views-staff.js:151` to `:193`, `:223` to `:225`, `:249` to `:259`.
- Fix: put drafts and all open requests in Today, link each row to the exact tab, lead each row with a status pill, and give links names such as "Open Alex, did not arrive". WCAG 2.4.4.

**14. A fit answer is lost unless Save is pressed on that card**
- Screen: client Formulation. Affects: client.
- What is wrong: every other answer in the hub saves as it is chosen and the app says so. Here choosing Fits changes the pill but saves nothing until that card's Save is pressed. Leave the page and it is gone, silently. 9 cards means 9 Save buttons.
- Where: `public/js/live/views-client.js:538` to `:546`; `public/js/live/app.js:441` to `:450`.
- Fix: save the fit choice on change, keep Save only for the comment, and show "Saved" beside the card.

**15. Privacy requests can fail silently or be sent twice**
- Screen: client Account and privacy. Affects: client and practitioner.
- What is wrong: Send correction request with an empty box does nothing at all, with no message. Request a copy of my information sends on 1 click with no confirmation and can be pressed again to create duplicates, each with its own 20 working day clock.
- Where: `public/js/live/app.js:317` to `:323` and `:528` to `:533`; `functions/handlers.js:270` to `:282`.
- Fix: show a field error for an empty correction. Disable the copy button, or say "Requested on 10 Nov, reply due 8 Dec", while a request is open.

**16. The booking button leads to a dead end, and there is no way to reach Sarah**
- Screen: All done, Home at the Book feedback stage. Affects: client.
- What is wrong: `bookingUrl` is empty, so the primary button opens a dialog that says booking is not connected and to contact Sarah. No contact detail appears anywhere in the hub.
- Where: `public/config/app.json` (`bookingUrl`); `public/js/live/app.js:524` to `:526`.
- Fix: this is launch step 5 in CLAUDE.md. Until then show Sarah's email or phone in the dialog, and add a contact line to Account.

**17. The phone menu loses its state and does not manage focus**
- Screen: all screens under 900px. Affects: both.
- What is wrong: closing the drawer with Escape or by tapping outside leaves `aria-expanded="true"`. The button is always named "Open menu". Focus stays on the button when the drawer opens, the page behind stays reachable by Tab, and there is no close button inside the drawer.
- Where: `public/js/live/app.js:518` to `:523`, `:650` to `:651`, `:775` to `:778`; `public/js/ui.js:95`.
- Fix: 1 function to open and close that sets the attribute and the label, moves focus to the first link, makes the workspace inert while open and returns focus on close. WCAG 4.1.2, 2.4.3.

**18. Dialogs have no accessible name**
- Screen: Log out, Release results, Unlink from Splose, Book. Affects: both.
- What is wrong: the native dialog is used well (focus is trapped and returns, Escape works) but it has no `aria-labelledby`, so a screen reader announces only "dialog".
- Where: `public/js/live/app.js:504` to `:514`.
- Fix: give the heading an id and point `aria-labelledby` at it. WCAG 4.1.2.

**19. Wide tables cannot be scrolled by keyboard, and 1 is 2,082px wide**
- Screen: Clients table, library, 1 questionnaire, Activation codes, draft results. Affects: practitioner and admin.
- What is wrong: `.table-wrap` scrolls sideways but is not focusable, so a keyboard user cannot reach hidden columns. The Clients table already overflows at 1024px. The Questions table on a questionnaire page is 2,082px wide in a 678px frame because the Notes column does not wrap.
- Where: `public/css/app.css:966` to `:970`; `public/js/live/views-staff.js:805`.
- Fix: add `tabindex="0"`, `role="region"` and a label to each wrapper, and let the Notes column wrap. WCAG 2.1.1, 1.4.10.

**20. The consent notice leaves things out, and there is no way out of onboarding**
- Screen: consent ("Before you start"), intake. Affects: client. Sarah approves this wording.
- What is wrong: the notice does not mention that appointment dates, attendance and form status are read from Splose, that formulation responses and comments are kept, how long information is kept (10 years), or who can see what. Neither consent nor intake offers Log out, so someone who does not want to agree can only close the tab.
- Where: `public/js/live/views-client.js:239` to `:264`, `:266` to `:296`.
- Fix: add 1 short section for each gap, raise `consentVersion`, and add the quiet Log out button used on the activation screen. Rule 3 in CLAUDE.md is the reason this is listed.

**21. An admin account can see who Sarah's clients are**
- Screen: Activation codes as admin. Affects: clients' privacy.
- What is wrong: the codes table shows each client's name and email to the admin role, and the rules let admin read `activationCodes` and `auditLog`. The sidebar says "Client records are not shown to admin accounts". Decision 60 itself records that being a psychologist's client is health information.
- Where: `firestore.rules:134` and `:153`; `public/js/live/views-staff.js:581` to `:593`; `public/js/ui.js:143`.
- Fix: a decision for Charlotte and Sarah. Either record that admin may see names for running codes, and change the sidebar line to say so, or show admin the last 4 characters and status only.

**22. A signed in browser stays signed in for ever**
- Screen: all. Affects: client and practitioner.
- What is wrong: sign in uses local persistence and there is no idle sign out. The shared computer tick box helps only if the person remembers to log out.
- Where: `public/js/firebase.js:31`.
- Fix: sign out after a set idle time (for example 30 minutes for clients), with a calm line on the log in screen saying why. Decide the period with Sarah.

**23. Scoring rules are readable by any activated client**
- Screen: none; a direct read of the database. Affects: client.
- What is wrong: no score is ever drawn for a client, which is what rule 2 asks. But the rules let an activated client read every questionnaire document, including scoring bands, subscales, flag thresholds and the questionnaires marked for Sarah only. A determined client could work out their own band from their answers.
- Where: `firestore.rules:141` (and its comment); `public/js/live/data.js:39` to `:42`.
- Fix: a decision. If it matters, split each questionnaire into a client readable part (questions and options) and a practitioner only part (scoring rules), and let clients read only questionnaires assigned to them.

**24. Assigning a later questionnaire sends the journey backwards**
- Screen: client Home. Affects: client.
- What is wrong: assigning a questionnaire to a client at Book feedback or Feedback moves them back to Questionnaires. A client who has read results and a formulation sees the ring retreat to "Step 3 of 7" and a tracker that reads "4 of 5" with the later steps done.
- Where: `functions/handlers.js:347`; `public/js/live/views-client.js:307` to `:325`.
- Fix: keep the stage where it is and treat a later questionnaire as a task, as check ins already are.

**25. Clinical terms reach the client**
- Screen: client Formulation. Affects: client.
- What is wrong: under each plain heading the client sees the clinical name (Presenting, Predisposing, Precipitating, Perpetuating, Protective). The code comment says the hint is the clinical name, meant for Sarah.
- Where: `public/js/live/views-client.js:530`.
- Fix: drop the hint from the client view, or ask Sarah whether she wants clients to learn the terms.

**26. Loading and error states are thin**
- Screen: all. Affects: both.
- What is wrong: a failed first load shows "Could not load your information" with the raw error and no Try again or Log out. Every busy button reads "Saving", including Log in, Search Splose and Next question. A page change waits about 1 second with no sign that anything is happening, because staff pages reload every collection in full each time.
- Where: `public/js/live/app.js:117` to `:124`, `:207` to `:222`, `:62` to `:75`; `public/js/live/data.js:71` to `:102`.
- Fix: add Try again and Log out to the error screen, let each button name its own busy label, show the mark loader or a busy state on the workspace during a page change, and load 1 client's records on that client's page as numbers grow.

**27. Number keys cannot reach options 10 and 11**
- Screen: questionnaire `des-ii` (11 options), and its test run. Affects: client and practitioner.
- What is wrong: the hint says "Press 1 to 11 to choose" but only single digits are handled.
- Where: `public/js/live/app.js:779` to `:787`; `public/js/live/views-client.js:483`.
- Fix: show the hint and key caps only for the first 9 options, or say "Press 1 to 9, or use the arrow keys".

**28. Tracker semantics and empty sections (earlier critique, not yet addressed)**
- Screen: client Home. Affects: client.
- What is wrong: both P2 issues from the 1 November critique remain. The report tracker has no `aria-current` and no words for done or to do. The empty resources panel and the report tracker take a third of the page at the Questionnaires stage.
- Where: `public/js/live/views-client.js:414` to `:426`.
- Fix: as the critique set out.

**29. Neutral states use the Needs attention pill**
- Screen: client Home and Questionnaires. Affects: client.
- What is wrong: "To do" and "Not started" are drawn as ochre pills with an exclamation mark. DESIGN.md says nothing urgent belongs in the client's room and that attention rows are Sarah's.
- Where: `public/js/live/views-client.js:63`, `:335` to `:346`.
- Fix: a neutral pill (empty ring icon, navy tint) for things not yet started.

### P3

**30.** After a keyboard action the focus ring is drawn round the whole workspace sheet, because the main region takes focus. Add `#workspace:focus-visible { outline: none; }` or an inset ring. `public/css/app.css:83`; `public/js/live/app.js:99`. Affects both.

**31.** On a phone the client record tabs run off the right edge and "All clients" wraps under them. `public/css/components.css:895` to `:912`. Affects practitioner.

**32.** Token drift, from the detector: `#8A3F34`, `#5E7A4F`, `#9A5A2E`, `#EEF2E8` and `#FFFFFF` are written into `components.css`; sizes of 11, 12 and 13px and radii of 3 and 6px sit off the documented scales. The selected fit pill sets white text on the accent, which the contrast script does not check (it passes today at 5.1:1 or better).

**33.** Documents out of step with the code: the `firestore.rules:72` comment says responses are never stored on assignments, but `functions/handlers.js:232` stores answers in progress there; DESIGN.md says the accent never carries text; `docs/client-journey.md` says the activation screen links to the Executive Frame intake, and it does not; the Profile panel says the retention date is set when the work ends while the journey document says a provisional date is set at activation.

**34.** Small markup points: the key cap number is read as part of each answer's name (`views-client.js:477`, add `aria-hidden`); "Answers to follow up" uses `role="alert"` on content that is not new (`views-staff.js:357`); the first paint in `public/index.html:19` has no `id="workspace"`, so the skip link has no target until the app draws; the hint "Year-month-day" (`views-staff.js:503`) breaks the no hyphen house style.

**35.** Dates from Splose are shown without a year ("Saturday, 31 October"), which will be ambiguous for last attended dates over time. The next session input uses the browser's time zone while display uses Auckland time, so they differ if Sarah works from another zone. `public/js/ui.js:19` to `:27`.

## 3. Accessibility against WCAG 2.1 AA

Fails, with the finding that carries the detail:

| Criterion | Level | Where | Finding |
|---|---|---|---|
| 1.4.1 Use of colour | A | Response dots in all 7 drawings | 7 |
| 1.4.3 Contrast (minimum) | AA | Muted menu link, tracker labels, focus mode menu, placeholders, map hints | 8 |
| 1.4.4 Resize text, 1.4.10 Reflow | AA | SVG drawings at 4.4px on phones; 2,082px table | 5, 19 |
| 2.1.1 Keyboard | A | Scrolling table wrappers; options 10 and 11 | 19, 27 |
| 2.4.3 Focus order | A | Focus sent to the top after every save; drawer | 4, 17 |
| 2.4.4 Link purpose | A | Several links named only "Start" or "Open" on 1 page | 12, 13 |
| 3.2.2 On input | A | Changing the drawing select moves focus and scroll | 4 |
| 3.3.1 Error identification | A | Intake and question errors not tied to their fields | 3 |
| 3.3.2 Labels or instructions | A | Placeholder is the only visible label on card comments and Splose search | 8 |
| 4.1.2 Name, role, value | A | Dialog has no name; drawer state stale | 17, 18 |
| 4.1.3 Status messages | AA | Intake errors not announced; new code panel has no status role | 3 |

Not a WCAG 2.1 AA failure, but below the project's own 44px rule: fit pills (36px high), card comment inputs (38px), small selects (38px), client record tabs (36px), library chips (32px), sort buttons (22px).

Passes worth keeping:
- Every input has a programmatic label. Sign up, log in, reset, activation and consent tie errors to fields with `aria-invalid` and `aria-describedby` and focus the first invalid field.
- A visible 2px focus ring on every control, a skip link, landmarks, `lang="en-NZ"`, and a page title that follows the heading.
- Status pills pair an icon with a word. Headings run in order on every screen checked.
- Questionnaires work fully by keyboard: number key, Enter, Back.
- Native `dialog` traps and returns focus. Reduced motion is honoured in CSS for the mark, transitions and drawings.
- No horizontal page scroll at 375, 768, 1024 or 1280px.

## 4. Conflicts with the rules in CLAUDE.md

Rule 2 (nothing shown before release): no conflict found. Before release, Results and Formulation show a holding message only, Home shows no result, and the data layer discards anything without `releasedAt`. The Firestore rules refuse a client read of `results` and `formulations` until release and never allow `scoring` or `formulationDrafts`. Scores are not drawn on any client screen. 3 things weaken the rule and are worth a decision:
- Release formulation has no confirmation and no withdraw (finding 9).
- Scoring rules and bands are readable by clients through a direct database read (finding 23).
- Sarah cannot edit or leave out a strength or area of focus before release; release is all or nothing for every pending draft. That limits "Sarah decides what the client sees". `public/js/live/app.js:560` to `:570`.

Rule 3 (Health Information Privacy Code): the consent notice omits Splose data, formulation responses, retention and who can see what (finding 20). Admin can see client names and emails (finding 21). No idle sign out (finding 22). An access request can be duplicated, which muddles the 20 working day record (finding 15).

Rule 4 (licences): the harness loads 31 cleared questionnaires and 2 samples, matching CLAUDE.md. 1 cleared questionnaire looks wrongly transcribed (finding 11). I did not check any licence.

Rule 5 (no third party scripts, strict policy): holds. No inline styles or `style=""` in the views; colours and widths are set from script or classes. No outside requests seen in the harness.

Rule 8 (launch steps): all 5 are still open as CLAUDE.md says. Seen directly: `bookingUrl` is empty; `public/preview/` and its links in `public/styleguide.html:37` and `scripts/serve.mjs` are still present. Not checked: live roles, live test clients and `ALLOW_SAMPLE_MEASURES` (see section 5).

House style: 1 hyphenated hint in staff copy (finding 34). No dashes found in client copy in the views.

DESIGN.md: more than 1 primary button on Home (finding 12); brick used outside form errors and status by colour alone (finding 7); text under 14px (finding 8); the attention pill in the client's room (finding 29).

## 5. What I could not check, and why

- The live site, the live Firebase project and any real record: out of bounds for this audit. Everything above is from the harness and the source.
- `npm run test:rules`: needs the Firestore emulator and Java; not run. The rules were read, not exercised.
- `functions/.env.ef-client-hub`, live roles and live test clients (rule 8 steps 1 to 3): not read.
- A real screen reader (VoiceOver, NVDA) and real phones or tablets: findings come from the accessibility tree, computed styles and an emulated viewport. Touch gestures were not synthesised.
- Text at 200 percent zoom and custom text spacing: not tested.
- Reduced motion: confirmed in CSS only, not with the system setting on.
- Check in schedules arriving at 7am, paused and ended schedules, and scores over time: read in code, not walked through in the browser.
- Expired and already used activation codes, the too many attempts message and the email restricted code: read in code only. A wrong code was tested.
- Password reset and all email: the harness sends none.
- The real Splose API, the error panel and the email mismatch path: only the fake Splose with patient 101 was used.
- Google and Microsoft sign in: switched off in config.
- The detector's rendered overlay: blocked by the Content Security Policy, which was left as it is.
- Results with strengths and areas of focus filled in: the test client's drafts all came out as typical, so the filled Results screen was read in code, not seen.
- The corporate, team and health wording and accents: only the neurodivergent type was walked through.

## 6. The 5 fixes I would do first

1. Put flagged answers at the top of the dashboard and in To review (finding 1).
2. Stop the admin crash and give `route` a plain error screen (finding 2).
3. Keep scroll and focus in place after a save, and make intake errors visible and announced (findings 3 and 4).
4. Make the phone experience hold: 1 screen per question with instructions shown once, and a readable formulation picture (findings 5 and 6).
5. Fix the contrast set and the colour only dots, and add the opacity pairs to the contrast script (findings 7 and 8).

Then confirm release of a formulation (finding 9), check the `jds` scale against the codebook (finding 11), and return to the 1 November critique of Home (findings 12 and 28).

## Status of the 1 November critique of Home

| Critique issue | Status |
|---|---|
| P1: 4 primary buttons, 5 rows | Open (finding 12) |
| P1: hero fills the first phone screen | Open (finding 12) |
| P1: Splose form said 3 times, no action | Open (finding 12) |
| P2: tracker unreadable to a screen reader, 11px labels | Open (findings 8 and 28) |
| P2: 2 empty sections | Open (finding 28) |

## Recommended commands, in order

1. P1: `/impeccable harden` for findings 1, 2, 3, 4, 7 and 9.
2. P1: `/impeccable adapt` for findings 5, 6 and 10.
3. P1: `/impeccable distill` for finding 12, then `/impeccable clarify` for the Splose wording.
4. P1 and P2: `/impeccable polish` for finding 8 and the small items in 29 to 35.
5. P2: `/impeccable harden` again for findings 13 to 19, 26 and 27.
6. Last: `/impeccable polish`, then run `/impeccable audit` again to see the score move.

Findings 11 and 20 to 25 need a decision from Charlotte or Sarah before any code.

## 7. Consistency with the Learning Hub

Added 10 November 2026 at Charlotte's request. Compared from source only. Client Hub (CH): `public/css/tokens.css`, `app.css`, `components.css` and the views. Learning Hub (LH), in `/Users/charlotteberry/eflearninghub`: `public/assets/css/tokens.css`, `base.css`, `hub.css`, `viewer.css`, and the pages `public/index.html`, `start/`, `join/`, `login/`, `account/`. Nothing was edited there. LH paths below are relative to `public/assets/css/` unless a page is named. The LH header and footer are drawn by `assets/js/layout.js`, which was outside the files I was asked to read, so the header is compared from its CSS only. The LH was not opened in a browser by this session.

In short: the 2 apps share the same kit values (palette, type sizes, spacing, radii, 180ms motion) but were built as 2 separate stylesheets with different token names and different component decisions. A person who uses both will see the same colours and typeface, and then different buttons, fields, weight of text, navigation and messages.

### 7.1 Differences ranked by how visible they are

| Rank | What differs | Verdict | Keep |
|---|---|---|---|
| 1 | Button shape and default width | Differ clearly | CH shape, LH pressed state |
| 2 | Body text weight (400 against 300) | Differ clearly | CH (400) |
| 3 | Fields: fill, corner, text size, hint position, error style | Differ clearly | CH field, LH state hook |
| 4 | Navigation, header and where the account sits | Differ clearly | CH frame, LH drawer parts |
| 5 | Brand mark, name and loading mark | Differ clearly | CH |
| 6 | Notices and form messages | Differ clearly | Neither as is; see 7.3 |
| 7 | Choice cards (same class name, different build) | Differ clearly | CH |
| 8 | Shadows, gradient and hover lift | Differ clearly | CH (flat) |
| 9 | Uppercase tracked labels | Differ clearly | CH (none) |
| 10 | Dialogs | Differ slightly | LH structure, CH flat surface |
| 11 | Tags and status pills | Differ slightly | CH `.status`, LH `.tag` as the neutral form |
| 12 | Focus ring offset and colour | Differ slightly | CH global ring |
| 13 | Panels and the `.stack-lg` gap | Differ slightly | CH values |
| 14 | Links, checkbox colour, icon stroke, display type, progress fill | Differ slightly | See 7.3 |
| 15 | Token names (not visible, but first for a shared guide) | Differ clearly | CH generated file |

### 7.2 Tokens

Values that match exactly:

| Group | Value | CH | LH |
|---|---|---|---|
| Sky | `#CFDAE8` | `--ef-sky`, `--ground` `tokens.css:14`, `:20` | `--sky`, `--ground` `tokens.css:60`, `:64` |
| Slate | `#3E5680` | `--ef-slate`, `--ink` `:15`, `:21` | `--slate`, `--ink` `:59`, `:65` |
| Navy | `#2E4062` | `--ef-navy`, `--inv-ground` `:16`, `:32` | `--navy`, `--cta-ground` `:58`, `:73` |
| Warm white | `#F5F3EE` | `--ef-warm-white`, `--panel` `:17`, `:22` | `--warm-white`, `--panel` `:61`, `:66` |
| Hairline | slate at 25 percent | `--hairline` `:26` | `--hairline` `:68` |
| Focus | `#3E5680` | `--focus` `:28` | `--focus` `:69` |
| Error | `#8A3F34` | `--error` `:29` | `--error` `:70` |
| Type sizes | 40/42, 28/32, 22/28, 17/26, 16/22, 14/20 | `--type-*-size`, `--type-*-line` `:47` to `:78` | same names `:89` to `:94` |
| Spacing | 4, 8, 12, 16, 24, 32, 48, 64 | `--space-1` to `--space-8` `:81` to `:88` | same `:97` to `:104` |
| Radius | 8, 12, 16, 999 | `--radius-sm`, `-md`, `-lg`, `-pill` `:91` to `:94` | same `:107` to `:110` |
| Focus ring width | 2px | `--focus-ring` `:103` | `--focus-ring` `:117` |
| Motion | 180ms, ease out, mark 1200ms | `:107` to `:109` | `:122` to `:124` |
| Typeface | Figtree 300, 400, 500, Latin and Latin Extended | `:5` to `:10` | `:7` to `:54` |

Same job, different name or value:

| Job | CH | LH | Note |
|---|---|---|---|
| Palette names | `--ef-sky`, `--ef-slate`, `--ef-navy`, `--ef-warm-white` | `--sky`, `--slate`, `--navy`, `--warm-white` | Prefix differs |
| Inverted theme | `--inv-ground`, `--inv-ink`, `--inv-panel`, `--inv-on-panel` and 6 more, plus `[data-theme="inverted"]` `tokens.css:32` to `:41`, `:113` | `--cta-ground`, `--cta-ink`, `--cta-panel`, `--cta-on-panel` `:73` to `:76` | CH set is fuller |
| Font stack | `--font-family` `:44` | `--font` `:82` (adds Helvetica Neue, Arial) | |
| Weights | `--type-body-weight` 300 in the kit, set to 400 in `app.css:11`; `--type-ui-strong-weight` 500 | `--weight-light`, `--weight-regular`, `--weight-medium`, `--body-weight` (300) `:83` to `:87` | Different model |
| Easing | `--motion-easing` | `--motion-ease` | |
| Mark timing | `--mark-draw-on` | `--mark-draw-duration` | |
| Control height | `--button-height`, `--input-height` (52px each) `:97`, `:99` | `--control-height` 52px `:113` | |
| Touch minimum | `--min-touch-target` 44px `:100` | `--touch-min` 44px `:114` | |
| Page margins | `--screen-margin-phone` 24, `--screen-margin-tablet` 48 | `--margin-phone` 24, `--margin-tablet` 48 | |
| Content width | `--content-max` 560px `app.css:26`; `--reading-max` 680px; `--workspace-max` 1040px `app.css:168` | `--content-max` 720px `:118`; `--wide-max` 1040px `:119` | `--content-max` is 1 name with 2 values |
| Field border | `--input-border` 2px `app.css:27`, colour written at use | `--field-border` `2px solid var(--slate)` `:79` | |

Only in the Client Hub: `--reading-ground`, `--on-reading`, `--underline` (`tokens.css:24` to `:27`), type weight and tracking tokens, the wordmark tokens (`:75` to `:78`), `--pill-height` 44px, `--icon-stroke` 1.5, the 6 status tokens `--status-done` `#2F5D3A`, `--status-done-tint` `#E3ECE2`, `--status-progress` `#2E4062`, `--status-progress-tint` `#E4E9F1`, `--status-attention` `#6E4A10`, `--status-attention-tint` `#F2E8D6` (`app.css:15` to `:20`), and `--accent` (`app.css:24`, set at run time to `#A65A1B`, `#2F6E68` or `#3E5680`).

Only in the Learning Hub: `--weight-*`, `--body-weight`, `--field-border`, and the viewer settings that change tokens on `:root` (`.text-regular`, `.text-large`, `.calm-motion`, `viewer.css:117` to `:119`).

Colours written outside the tokens. CH: `#FFFFFF` (`app.css:592`, `components.css:322`, `:446`, `:452`, `:930`), `#8A3F34` (`components.css:1023`, `:1072`, `:1168`), `#5E7A4F`, `#9A5A2E`, `#EEF2E8` (`components.css:1060` to `:1068`, `:1163`). LH: `#FFFFFF` for every field and card (`base.css:139`, `:163`, `:176`; `hub.css:89`, `:111`; `viewer.css:64`), `#F3E7E4` (`base.css:194`), and sky as raw `rgba(207, 218, 232, …)` (`base.css:211`, `hub.css:83`, `viewer.css:38`, `:58`).

Which to keep: the CH file. It is generated from `brand/tokens.json`, its header already says it is shared with the Learning Hub, and it carries the fuller set. Add the status tokens to it, then give LH the same names. Until then the 2 files will drift.

### 7.3 Shared components, side by side

**Buttons. Differ clearly.**
- CH `app.css:549` to `:617`: `.btn` is 52px, 12px corners, full width by default (`.btn-inline` or an `.actions` row makes it auto), 2px transparent border. `.btn-primary` navy fill, hover slate. `.btn-secondary` paper fill with a 2px slate border, hover white. `.btn-quiet` 44px, underlined, weight 400. Disabled 55 percent with a not allowed cursor. No pressed state.
- LH `base.css:112` to `:129`: `.btn` is 52px, a full pill (999px), auto width (`.btn-block` makes it full), transparent with a 2px slate border, so the plain `.btn` is the secondary; there is no `.btn-secondary`. Hover is a hairline tint. `.btn-primary` navy with a navy border, hover slate. `.btn-quiet` 44px with no underline. Pressed moves down 1px (`:122`). Disabled 55 percent with pointer events off.
- Keep: CH shape and names. The kit has separate `--button-height` and `--pill-height`, and CH keeps pills for status, so a button reads as a button. Take from LH the pressed state, `.btn-block`, and `.btn-row`.

**Body weight and type. Sizes match; weight and details differ clearly.**
- CH body and captions at 400 (`app.css:11` to `:12`); LH body at 300 with a viewer setting to switch (`tokens.css:87`, `viewer.css:117`).
- Display: CH 400 with tracking of minus 0.02em (`tokens.css:49` to `:50`), not used on live screens. LH 300 with minus 0.01em (`base.css:23`), used for "Your account" and Home.
- CH styles bare `h1`, `h2`, `h3` (`app.css:128` to `:152`); LH needs the `.t-*` classes.
- LH has uppercase labels with 0.04em tracking at 80 percent opacity (`.dash-h` `hub.css:7`, `.beat` `hub.css:99`). CH's DESIGN.md forbids uppercase labels.
- Keep: 400 for body in both (the readability reason in PRODUCT.md applies to both audiences), and no uppercase labels. Keep LH's text size setting as an idea for both.

**Fields. Differ clearly.**
- CH `app.css:621` to `:720`: paper fill, 2px slate border, 8px corners, 17px body type, padding 12px by 16px. The hint sits between label and input. Error: `.field-invalid` on the wrapper turns the border brick; `.field-error` is 16px with a round "!" badge.
- LH `base.css:132` to `:150`: white fill, 2px slate border, 12px corners, 16px type, padding 0 by 16px. The hint sits under the input. Error: `.input[aria-invalid="true"]` turns the border brick; `.field-err` is 14px at weight 500 with no icon; `.msg` is a form level line. `.input-with-button` holds a Show password button (CH has none).
- Keep: the CH field (paper fill is in the palette; the badge means the error is not colour alone) with 8px corners. Take from LH the `aria-invalid` selector, so the state comes from the attribute, and the Show password control.

**Checkboxes and radios. Check matches closely; choice cards differ clearly.**
- `.check`: same build in both (22px box, 12px gap, 44px row). The tick colour is navy in CH (`components.css:53`) and slate in LH (`base.css:152`).
- `.choice`: CH (`app.css:731` to `:788`) is a row with a 22px `.choice-dot`, a 2px slate border, and sky fill with a navy border when chosen. LH (`base.css:159` to `:170`) wraps a `.choice-body` with a 2px hairline border on white and no dot; chosen is a slate border plus a 1px inset. Same class name, different markup.
- Only in CH: `.fit` pills (`components.css:299`). Only in LH: `.seg` segmented control (`viewer.css:108` to `:114`), `.scen-opt` and `.sort-item` pressed buttons (`hub.css:109`, `:87`).
- Keep: the CH choice card. Its border is visible at rest (the LH hairline is 25 percent slate, under 3:1 for a control edge) and the dot shows what kind of control it is. Rename 1 of the 2 before a shared guide.

**Tags and status pills. Differ slightly.**
- CH `.status` (`app.css:792` to `:824`): 28px pill, caption at 500, a 16px icon and a word, 3 tinted kinds.
- LH `.tag` (`hub.css:41`) and `.claim` (`hub.css:100`): 28px pill, caption at 500, sky fill, no icon; the 2 are near copies. `.tag-preview` (`viewer.css:24`). Done in the lesson list is a tick character before the text (`viewer.css:47`).
- Keep: CH `.status` for any state, since it carries icon and word. Keep LH `.tag` as the neutral label; CH lacks one (finding 29).

**Cards and panels. Differ slightly.**
- `.panel`: paper, 16px corners, 24px padding in both (CH `app.css:524` to `:529`; LH `base.css:99` to `:106`). LH goes to 32px padding from 768px. Inside its workspace CH flips panels to sky (`app.css:370` to `:374`).
- `.stack` is 16px in both. `.stack-lg` is 32px in CH (`app.css:385`) and 24px in LH (`base.css:108`).
- Cards: CH `.client-row`, `.zone`, `.factor`, `.draft` are flat. LH `.lesson-card` lifts 2px on hover (`hub.css:34`); `.dash-card`, `.path` (`hub.css:5`, `base.css:174`).
- Keep: CH values; 1 value for `.stack-lg`.

**Navigation and headers. Differ clearly.**
- Frame: CH is a 248px sky sidebar and a 64px sky top bar with no rule, around a paper workspace (`app.css:165` to `:194`, `:282` to `:288`, `:345` to `:353`). LH viewer is an 88px sky header with a hairline under it, a 288px paper library on the left, a sky stage and a 340px paper reader on the right (`viewer.css:15`, `:27` to `:31`, `:68`, `:79`). LH public pages use a 72px `.site-header` with pill links (`base.css:65` to `:80`); CH has no site header, only the centred `.single-card`.
- Items: CH `.nav-link` (`app.css:228` to `:256`) and LH `.navbtn` (`viewer.css:37` to `:39`) are the same shape (44px, 12px corners, 16px type, weight 500 when current) with mirrored colours: CH current is paper on sky, LH current is sky on paper.
- Drawer under 900px: both `min(320px, 86vw)` with a navy 35 percent dimmer. CH dims with a spread shadow (`app.css:461`); LH uses a `.scrim` element and a soft shadow, and has a close button (`viewer.css:130` to `:135`; `index.html:49`). Menu button: CH 44px, no border, 12px corners (`app.css:472`); LH 44px circle with a 2px slate border (`viewer.css:22`).
- Account: CH is a link at the top right with a navy 36px `.avatar` (`app.css:312` to `:341`). LH is a button at the bottom left with a sky 36px `.acctav` and a white popup menu with a shadow (`viewer.css:56` to `:65`).
- Keep: the CH frame (sky room, paper desk) as the 1 shell, and 1 place for the account. Take the LH scrim element and close button, which fix finding 17.

**Brand mark. Differ clearly.**
- CH: `<img class="brand-mark">` at 32px from `mark-slate-small.svg`, with "Executive Frame" as live text at 20px, weight 500 (`ui.js:80` to `:81`; `app.css:206` to `:217`). The loader draws the mark once at 72px (`app.css:1079` to `:1113`; `mark.js`).
- LH: `.brand-mark` is a 36px inline SVG with a 16px name at 500 and 0.01em tracking, part of it at 300 (`base.css:68` to `:72`). The viewer header shows `lockup-slate.svg` as an image at 44px high (`index.html:39`; `viewer.css:21`). The loading mark is 56 or 64px and pulses without end (`base.css:197` to `:201`; `viewer.css:12`).
- The files `mark-slate.svg` and `lockup-slate.svg` are not byte identical between the 2 repos, and CH has `-small` variants that LH lacks.
- Keep: CH. 1 mark size and the 20px wordmark token in both, 1 copy of the brand files, and the draw once loader in place of the pulse.

**Dialogs. Differ slightly.**
- CH `.dialog` (`components.css:218` to `:229`): 480px, 16px corners, 32px padding, no shadow, backdrop navy 45 percent, built in script with no name.
- LH `dialog.vdialog` (`viewer.css:102` to `:106`): 560px, 16px corners, 32px inner padding, a large shadow, backdrop navy 35 percent, written in the page with `aria-labelledby` and `method="dialog"`.
- Keep: LH structure and naming (it fixes finding 18); CH flat surface; 1 backdrop value.

**Notices and messages. Differ clearly.**
- CH `.notice` (`app.css:1133` to `:1145`): 12px corners, 16px padding, a 4px slate left edge; the error form changes only the edge to brick.
- LH `.notice` (`base.css:193` to `:194`): 12px corners, 16px padding, sky fill, no edge; the error form is a pink fill `#F3E7E4` with brick text. `.msg` is inline text under a form (`base.css:148` to `:150`).
- Keep: neither as it stands. In CH an error notice differs from a plain one by edge colour alone, and in LH by colour alone too. Build 1 notice with an icon and a word, tinted from the status tokens, and keep `.msg` as the form level line.

**Focus rings. Differ slightly.**
- CH: 2px slate, 2px offset, everywhere (`app.css:83` to `:86`); navy on the primary button (`:581`); the accent colour on chips, fit pills and sort buttons (`components.css:325`, `:455`, `:493`).
- LH: 2px slate, 3px offset, and it forces 8px corners on the focused element (`base.css:37` to `:39`); 2px offset on inputs (`:142`); an inset ring on `.seg` (`viewer.css:114`).
- Keep: 2px slate at 2px offset on everything, navy on primary. Drop the accent rings in CH.

**Smaller differences.**
- Links: CH underline goes from 40 percent to full colour on hover (`app.css:72` to `:81`); LH underline goes from 1px to 2px (`base.css:33` to `:34`). Keep CH; the kit has an `--underline` token.
- Shadows: CH has none by rule. LH has 4 (`viewer.css:64`, `:102`, `:130`; `hub.css:94`) and 1 gradient (`viewer.css:71`). Decide once; the kit and DESIGN.md say flat.
- Icons: CH 20px at 1.5 stroke (`ui.js:63`); LH 22px at 1.8 (`viewer.css:23`).
- Progress bar: both 6px pills on a hairline track; CH fills with the accent (`app.css:1062` to `:1075`), LH with ink (`hub.css:46` to `:47`).
- Key and value rows: CH `.details` is a 2 column grid (`components.css:144` to `:162`); LH `.rows` is spread apart with hairlines (`base.css:204` to `:208`).
- Loading: CH `.loader` 60vh; LH `.loading` 40vh.
- Muted text: both use opacity (CH finding 8; LH `.muted` at 0.8, `base.css:109`), and both fall under 4.5:1. Fix once with a solid muted ink token.
- Inline styles: LH pages use `style=""` (for example `login/index.html:39`, `join/index.html:38`). CH forbids them under its Content Security Policy. A shared guide should not depend on them.
- Breakpoints: both switch to a drawer at 900px. CH also uses 768 and 1200px; LH uses 520, 640, 720 and 768px.

## 8. Component inventory

Every component in the live Client Hub. "Global focus" means the 2px slate ring at `app.css:83`. Line numbers are for `public/css/app.css` (A) and `public/css/components.css` (C) unless a script is named. States not listed do not exist.

### 8.1 Foundations and layout

| Component | Classes | Variants and sizes | States | Tokens | Defined |
|---|---|---|---|---|---|
| Type roles | `.t-display`; `.t-title`, `h1`; `.t-heading`, `h2`; `.t-ui`; `.t-ui-strong`, `h3`; `.t-caption` | 40/42, 28/32, 22/28, 16/22, 16/22 at 500, 14/20; body 17/26 on `body` | none | `--type-*-size`, `-line`, `-weight`, `-tracking` | A:49 to 61, A:121 to 158 |
| Link | `a` | 1 | hover: underline to full colour; global focus | `--underline` | A:72 to 81 |
| Focus ring | `:focus-visible` | 2px, offset 2px | focus | `--focus-ring`, `--focus` | A:83 to 86 |
| Skip link | `.skip-link` | 1 | focus: moves into view | `--panel`, `--on-panel`, `--radius-sm`, `--space-3`, `--space-4` | A:104 to 117 |
| Hidden text | `.visually-hidden` | 1 | none | none | A:92 to 102 |
| Stacks | `.stack`, `.stack-lg` | 16px, 32px | none | `--space-4`, `--space-6` | A:381 to 387 |
| Columns | `.split`; `.panel-flow` | 2 equal columns to 1 under 1200px; 2 CSS columns to 1 under 900px | none | `--space-6`, `--space-5` | A:389 to 394, A:441; C:863 to 877 |
| Action rows | `.actions`, `.actions-inline`, `.actions-end`, `.toolbar`, `.toolbar-top`, `.inline-add` | `.actions` buttons auto width, full width and primary first under 900px; `.inline-add` controls 44px | none | `--space-2`, `--space-3`, `--min-touch-target` | A:396 to 405, A:503 to 509, A:1014 to 1025; C:166 to 188, C:368 to 397, C:816, C:854 |
| Measures | `.reading`, `.focus-column`, `.workspace-inner`, `.workspace-wide` | 680px; 640px centred; 1040px; 1280px | none | `--reading-max`, `--workspace-max` | A:355 to 366, A:414 to 417 |

### 8.2 Shell and navigation

| Component | Classes | Variants and sizes | States | Tokens | Defined |
|---|---|---|---|---|---|
| Viewer frame | `.viewer` with `data-menu`, `data-mode` | Sidebar 248px, top bar 64px; 1 column under 900px; `data-mode="focus"` fades the menu to 0.45 | menu open, menu closed, focus mode | `--sidebar-width`, `--topbar-height`, `--ground` | A:165 to 182, A:409 to 412, A:447 to 453 |
| Sidebar and drawer | `.sidebar`, `.sidebar-foot` | Drawer `min(320px, 86vw)` under 900px, dimmer navy 35 percent | open (transform none), closed (hidden) | `--space-4` to `--space-6`, `--motion-duration`, `--motion-easing` | A:186 to 194, A:272 to 278, A:455 to 470 |
| Brand | `.brand`, `.brand-mark`, `.brand-name` | Mark 32px, name 20/20 at 500 | global focus | `--type-wordmark-*`, `--min-touch-target` | A:196 to 217; `ui.js:79` to 82, 151 |
| Menu link | `.nav`, `.nav-link`, `.nav-link-muted`, `.nav-count` | 44px, 12px corners, 20px icon; count is a 24px navy pill | hover: paper at 55 percent; current (`aria-current="page"`): paper fill, weight 500; muted: opacity 0.6; global focus | `--panel`, `--on-panel`, `--radius-md`, `--inv-ground`, `--inv-ink`, `--type-ui-*` | A:219 to 270; C:811 to 813; `ui.js:83` to 91 |
| Top bar | `.topbar`, `.topbar-title`, `.topbar-actions` | Title 22/28, 16/22 at 500 under 900px | none | `--type-heading-*`, `--space-6`, `--space-7` | A:282 to 306, A:486 to 488, A:511 to 515 |
| Menu button | `.menu-button` | 44px, shown under 900px | `aria-expanded`; global focus; no hover | `--min-touch-target`, `--radius-md` | A:308 to 310, A:472 to 484; `ui.js:95` |
| Account button and avatar | `.account-button`, `.account-name`, `.avatar`, `.avatar-lg` | Avatar 36px navy disc, 40px large; name hidden under 900px | hover: paper at 55 percent; global focus | `--inv-ground`, `--inv-ink`, `--radius-pill` | A:312 to 341, A:490 to 492; C:604 to 609 |
| Workspace | `.workspace` | Paper sheet, 16px top left corner, 1px inset hairline; square under 900px | focus (programmatic) | `--reading-ground`, `--on-reading`, `--radius-lg`, `--hairline` | A:345 to 353, A:494 to 497 |
| Single page card | `.single`, `.single-card` | 480px, padding 48 by 32px, 32 by 24px under 900px | none | `--reading-ground`, `--radius-lg`, `--screen-margin-phone` | A:421 to 437, A:517 to 519; `ui.js:148` to 155 |
| Client record tabs | `.subnav`, `.subnav-link`, `.subnav-back` | 36px pills, padding 4 by 14px, count pill inside | hover: paper; current: navy fill, white text; global focus | `--ef-navy`, `--panel`, `--radius-pill`, `--hairline` | C:895 to 940; `views-staff.js:405` to 413 |

### 8.3 Controls

| Component | Classes | Variants and sizes | States | Tokens | Defined |
|---|---|---|---|---|---|
| Button | `.btn` with `.btn-primary`, `.btn-secondary`, `.btn-quiet`, `.btn-inline` | 52px, 12px corners, full width by default; 44px inside `.task`, `.inline-add`; quiet is 44px with 12px side padding | primary hover: slate; secondary hover: white; quiet: no hover; focus: global, navy on primary; disabled: opacity 0.55; busy: label swapped to "Saving" in script; no pressed | `--button-height`, `--input-border`, `--radius-md`, `--inv-ground`, `--inv-ink`, `--ef-slate`, `--ef-navy`, `--panel`, `--underline`, `--type-ui-strong-*` | A:549 to 617, A:855 to 858; C:185 to 188; `app.js:207` |
| Field | `.field`, `.field-label`, `.field-hint`, `.field-invalid`, `.field-error` | Label 16/22 at 500, hint 14/20 above the input, error 16/22 with a 20px brick badge | error | `--error`, `--space-2`, `--type-caption-*` | A:621 to 637, A:691 to 720; `ui.js:157` |
| Text input, textarea, select | `.input`, `.textarea`, `.select` | 52px, 8px corners, 2px slate border, 17/26; textarea 156px; select draws a navy chevron | focus: 2px slate ring; error: brick border; placeholder: slate at 0.75; no hover; no disabled style | `--input-height`, `--input-border`, `--ef-slate`, `--radius-sm`, `--panel`, `--on-panel`, `--type-body-*` | A:639 to 695 |
| Small input and select | `.input-small`, `.select-small` | 36px, caption type | as above | `--type-caption-size` | C:272 to 278, C:330 to 336 |
| Activation code | `.code`, `.code-large`, `.code-input` | Code text: tabular numerals, 0.08em tracking, weight 500; large 28/32; input: uppercase, 0.12em tracking | input states as text input | `--type-title-*` | C:11 to 25; `views-client.js:229`; `views-staff.js:588`, 600 |
| Checkbox row | `.check` | 22px native box, 44px row | native checked and focus; error via `.field-invalid` class on the label (no rule matches it) | `--ef-navy`, `--min-touch-target` | C:40 to 54 |
| Choice card (answers, intake) | `.choices`, `.choice`, `.choice-dot`, `kbd`, `.key-hint` | 52px minimum, 12px corners, 2px slate border, 22px ring, 22px key cap at 12px type; key cap and hint hidden under 900px | selected: sky fill, navy border, dot scales in; focus: ring on the card; no hover | `--button-height`, `--radius-md`, `--ef-slate`, `--inv-panel`, `--inv-ground`, `--panel` | A:723 to 788, A:1027 to 1058 |
| Fit pill | `.fit-choice`, `.fit` | 32px minimum, 1px slate border, caption type | selected: accent fill, white text; focus: 2px accent ring; no hover. Script also writes `.fit-on`, which has no style | `--accent`, `--ef-slate`, `--radius-pill` | C:291 to 328; `views-client.js:540` |
| Filter chip | `.chips`, `.chip` | 32px, 1px slate border, caption type | hover: white; pressed (`aria-pressed="true"`): accent fill, white text; focus: 2px accent ring | `--accent`, `--ef-slate`, `--panel`, `--radius-pill` | C:425 to 458 |
| Sort heading | `th .sort` | Text button with an arrow | hover: underline; `aria-sort` ascending or descending; focus: 2px accent ring | `--accent`, `--space-2` | C:461 to 496 |
| Library filters | `.filters` | 4 columns, 2 under 900px | none | `--space-4` | C:411 to 422 |

### 8.4 Feedback and status

| Component | Classes | Variants and sizes | States | Tokens | Defined |
|---|---|---|---|---|---|
| Status pill | `.status` with `.status-done`, `.status-progress`, `.status-attention` | 28px, caption at 500, 16px icon, padding 4 by 12px with 8px on the icon side | none | `--status-done`, `--status-done-tint`, `--status-progress`, `--status-progress-tint`, `--status-attention`, `--status-attention-tint`, `--radius-pill` | A:792 to 824; icons `ui.js:65` to 71 |
| Target tag | `.target-tag` | Caption at 500, 1.5px accent border, padding 2 by 8px | none | `--accent`, `--radius-pill` | C:125 to 131 |
| Notice | `.notice`, `.notice-error` | 12px corners, 16px padding, 4px left edge; sky inside the workspace and the single card | error: brick edge | `--panel`, `--ground`, `--ef-slate`, `--error`, `--radius-md` | A:1133 to 1145, A:370 to 374; C:31 to 34 |
| Dialog | `.dialog` | `min(480px, 100vw - 32px)`, 32px padding, 16px corners, backdrop navy 45 percent | open (native) | `--reading-ground`, `--on-reading`, `--radius-lg`, `--space-6` | C:218 to 229; `app.js:504` to 515 |
| Loader and mark | `.loader`, `.mark-draw`, `.mark-ring`, `.mark-triangle`, `.done-mark` | 72px; ring stroke 6 at small sizes, 2.4 large | drawing, drawn; still under reduced motion | `--mark-draw-on`, `--motion-duration`, `--motion-easing` | A:1077 to 1129; C:58 to 62; `mark.js:12` |
| Progress bar | `.progress`, `.progress-fill` | 6px pill | width set from script | `--hairline`, `--accent`, `--radius-pill` | A:1060 to 1075; `app.js:91` |

### 8.5 Containers and data

| Component | Classes | Variants and sizes | States | Tokens | Defined |
|---|---|---|---|---|---|
| Panel | `.panel`; `.issued` (new code) | 16px corners, 24px padding; paper on sky, sky inside the workspace; `.issued` sky with navy text | none | `--panel`, `--on-panel`, `--ground`, `--inv-panel`, `--inv-on-panel`, `--radius-lg`, `--space-5` | A:524 to 529, A:370 to 374; C:211 to 214 |
| Task row | `.task-list`, `.task`, `.task-name`, `.task-meta` | 3 columns (text, pill, action), 72px minimum; 2 columns with the button below under 900px | none | `--hairline`, `--space-4`, `--space-5`, `--min-touch-target` | A:826 to 868 |
| Table | `.table-wrap`, `.table`, `.table-library`, `.table-clients`, `.type-dot`, `.type-dot-empty` | 16px cells, sky header; fixed column widths on the 2 named tables | row hover: sky at 35 percent | `--hairline`, `--ground`, `--radius-md`, `--type-ui-*` | A:964 to 1012; C:207 to 209, C:498 to 534 |
| Details list | `.details`, `.details-wide` | Label and value in 2 columns, stacked under 900px; hairline rows inside a panel | none | `--space-3`, `--space-4` | C:144 to 162, C:360 to 363, C:843 to 851, C:879 to 891 |
| Draft block | `.draft`, `.draft-head` | 16px corners, 1px hairline border, 24px padding | none | `--hairline`, `--radius-lg` | C:194 to 205 |

### 8.6 Client pieces

| Component | Classes | Variants and sizes | States | Tokens | Defined |
|---|---|---|---|---|---|
| Journey hero and ring | `.journey-hero`, `.journey-hero-compact`, `.journey-ring`, `.ring-track`, `.ring-fill`, `.ring-triangle`, `.journey-stage` | Full: 200px ring (not used live). Compact: 140px. 152px and centred under 900px | fill animates to the stage over 1200ms | `--accent`, `--hairline`, `--ink`, `--ground`, `--mark-draw-on`, `--radius-lg` | A:870 to 912, A:952 to 962; C:737 to 746, C:803 to 807; `journey-ring.js:8` |
| Home grid | `.home-grid`, `.home-report`, `.session-when`, `.resource-list` | 3:2 grid, 1 column under 900px; sky sections, 16px corners, 24px padding; session time at 20px, weight 500 | none | `--ground`, `--ink`, `--radius-lg`, `--space-5` | C:748 to 797, C:799 to 802; `views-client.js:402` to 427 |
| Report tracker | `.tracker`, `.tracker-5`, `.step`, `.step-done`, `.step-current`, `.step-todo`, `.step-dot`, `.step-label`, `.step-detail` | 16px dots, 2px lines; labels 14px, 11px under 900px | done: moss; current: accent dot with a 4px halo, label at 500; to do: label opacity 0.6 | `--status-done`, `--accent`, `--hairline`, `--ground` | C:652 to 733 |
| Questionnaire row | `.task` with `.status` and a secondary button | "Not started", "In progress", "Done" | as task row | as task row | `views-client.js:61` to 67 |
| Questionnaire item | `.focus-column`, `.progress`, `fieldset.choices`, `legend.t-title`, `.field-hint`, `.choice`, `kbd`, `.actions`, `.key-hint` | 640px column; question at 28/32; instructions as a caption under it; Back (secondary), Next or Finish (primary) | error line `.field-error`; selected answer | as choice card and progress bar | `views-client.js:450` to 488 |
| Answer scale | `.choice` list built from the questionnaire's response options | 4 to 11 options; a question may carry its own options; no separate scale component | as choice card | as choice card | `views-client.js:461`, 477 |
| All done | `.done-mark` in a `.focus-column` | 72px mark, title, 2 buttons | none | `--ink` | C:58 to 62; `views-client.js:490` to 502 |
| Result block | `.result-block`, `.result-list`, inside `.split` | Heading per questionnaire; items have a 3px accent left edge; hairline between blocks | none | `--accent`, `--hairline`, `--space-4`, `--space-6` | C:64 to 81; `views-client.js:504` to 520 |
| Formulation summary | `.formulation-summary` | Sky panel, 16px corners, padding 16 by 24px | none | `--ground`, `--radius-lg`, `--reading-max` | C:338 to 354 |
| Formulation zones and cards | `.zones`, `.zones-5`, `.zone`, `.zone[data-zone="perpetuating"]`, `.zone-edit`, `.zone-cards`, `.factor`, `.factor-body`, `.factor-respond`, `.factor-response`, `.factor-suggest`, `.suggestions` | 2 columns with the first zone full width, 1 column under 900px; zone 16px corners, 24px padding, 180px minimum; card 12px corners on paper; perpetuating zone has a 2px inset accent stroke | card response form: see fit pill; suggestion card: sky with a 1px inset hairline | `--ground`, `--reading-ground`, `--accent`, `--hairline`, `--radius-lg`, `--radius-md` | C:83 to 123, C:190 to 192, C:231 to 270, C:280 to 289; `views-client.js:526` to 553; `views-staff.js:378` to 403 |
| 5P map (drawing 1 of 7) | `.fv.map`, `.map-box[data-zone]`, `.map-arrow`, `.map-loop`, `.map-title`, `.map-hint`, `.map-empty`, `.map-list`, `.map-dot`, `.map-dot-fits`, `.map-dot-partly`, `.map-dot-no` | HTML grid of 5 boxes with arrows; 1 column under 900px; presenting box 2px navy border, perpetuating 2px accent, protective moss tint | dot: none, fits, partly, does not fit; boxes rise in | `--ground`, `--reading-ground`, `--ef-navy`, `--accent`, `--status-done`, `--status-done-tint`, `--status-attention`, `--hairline`; `#8A3F34` written in | C:942 to 1031; `formulation-views.js:125` to 137 |
| Layers (drawing 2 of 7) | `.fv.fv-layers`, `.fv-layer-stack`, `.fv-layer`, `.fv-layer-now`, `.fv-layer-deep`, `.fv-layer-side` (`.fv-layer-mid` is written but has no style) | HTML; stack plus a 220px side column, 1 column under 900px | dots as the map | `--panel`, `--inv-ground`, `--inv-ink`, `--radius-lg`; `#5E7A4F` written in | C:1142 to 1168, C:1177; `formulation-views.js:140` to 152 |
| Flower, river, balance, radial, loop (drawings 3 to 7) | `figure.fv` with an `svg`; shared classes `.fv-bg`, `.fv-card`, `.fv-navy`, `.fv-ink`, `.fv-inv`, `.fv-muted`, `.fv-line`, `.fv-dotted`, `.fv-stem`, `.fv-petal`, `.fv-leaf`, `.fv-bank`, `.fv-flow`, `.fv-water`, `.fv-eddy`, `.fv-circuit`, `.fv-exit`, `.fv-keep-edge`, `.fv-help-edge`, `.fv-sector`, `.fv-sector-help`, `.fv-node`, `.fv-faintbg`, `.fv-dot-fits`, `.fv-dot-partly`, `.fv-dot-no`, `.fv-dot-none`, `.fv-arrowhead`; motion `.fv-in`, `.fv-dl-0` to `.fv-dl-11`, `.fv-draw`, `.fv-beam`, `.fv-tilt-m8` to `.fv-tilt-8` | 960 unit canvas, 40 unit frame, cards with 12 unit corners, 13 unit text, frame corner 18; the per drawing classes `.fv-flower` and so on carry no style | dot states as the map; rise in 420ms, lines draw 900ms, beam settles 700ms; none under reduced motion | `--ground`, `--panel`, `--ink`, `--inv-ground`, `--inv-ink`, `--status-done`, `--status-attention`, `--hairline`; `#5E7A4F`, `#9A5A2E`, `#EEF2E8`, `#8A3F34` written in | C:1033 to 1140; `formulation-views.js:26` to 122, 155 to 396 |
| Drawing picker | `.fv-view-pick` with a `.select-small` | 7 options | change saves and redraws | none | C:1170 to 1175; `views-staff.js:538` to 542 |
| Consent step | `.single-card`, `.consent-text`, `.check` | 4 short sections with `h2.t-ui-strong`, 1 tick box, 1 primary button | error on the tick box | as single card and check | C:36 to 38; `views-client.js:239` to 264 |
| Intake step | `.single-card`, `fieldset.choices` with `legend.t-heading`, `.choice`, `.textarea` | Questions from `config/intake.json`; "(optional)" as a caption | error line per question | as choice card and field | `views-client.js:266` to 296 |
| Sign in divider | `.divider-text` | Centred caption; only when social sign in is on | none | `--type-caption-size` | C:6 to 9 |

### 8.7 Practitioner pieces

| Component | Classes | Variants and sizes | States | Tokens | Defined |
|---|---|---|---|---|---|
| Dashboard client row | `.client-rows`, `.client-row`, `.client-who`, `.client-stage`, `.segments` with `i.done` and `i.current`, `.client-next` | Paper card, 16px corners, padding 16 by 24px; 200px who column; 7 segments 6px high with 3px gaps and 3px corners; 1 column under 900px | segment: done (moss), current (accent), to do (hairline) | `--panel`, `--status-done`, `--accent`, `--hairline`, `--radius-lg` | C:571 to 650; `views-staff.js:204` to 240 |
| Today row | `.task` with a name, a line and a secondary button | No pill | as task row | as task row | `views-staff.js:259` |
| Client record tabs | see 8.2 | Overview, Questionnaires, Formulation, Requests | | | |
| Splose panel | No classes of its own: `.panel`, `.inline-add` (search), `.task-list` (results and forms), `.field`, `.check`, `.details`, `.notice-error`, `.actions-inline` | 2 forms: not linked (search, id, tick box) and linked (details, forms, Resync, Unlink) | error line `.field-error`; error notice | as its parts | `views-staff.js:28` to 72 |
| Check in schedule form and row | `.schedule-form`, `[data-cadence-fields]`; row is a `.task` | 720px; fields swap by cadence | row pills: next date, paused, ended | `--space-4` | C:378 to 388; `views-staff.js:74` to 83, 489 to 509 |
| Draft results | `.draft`, `.table`, `.split`, `.result-list`, `.notice-error` (answers to follow up) | 1 block per questionnaire | pills: Draft, Released, For you only | as its parts | `views-staff.js:349` to 370 |
| Questionnaire page header | `.measure-toolbar`, `.measure-actions` | Back link, Test run, Assign to | disabled Assign | `--space-2`, `--space-3` | C:820 to 841; `views-staff.js:757` to 771 |
| New code panel | `.panel.issued`, `.code.code-large` | Sky panel, code at 28/32 | copy button label changes to "Copied" | `--inv-panel`, `--inv-on-panel` | C:211 to 214; `views-staff.js:600` |

### 8.8 The same thing in 2 forms inside this app

1. Pills. 6 pill shapes with 5 heights: `.status` 28px, `.chip` 32px, `.fit` 32px, `.subnav-link` 36px, `.nav-count` 24px, `.target-tag` (about 24px). `.chip` and `.fit` are the same control written twice (C:299 and C:432).
2. Selected state. 4 answers to "this is chosen": `.choice` sky with a navy border; `.chip` and `.fit` accent with white text; `.subnav-link` navy with white text; `.nav-link` paper.
3. Progress. 5 ways to show steps: `.journey-ring`, `.progress`, `.tracker`, `.segments`, and `.journey-stages` (style guide and sample only).
4. Response dots. `.map-dot-*` (C:1021 to 1023) and `.fv-dot-*` (C:1070 to 1073) are the same 3 states; `.fv-layers .map-dot*` repeats the first set again (C:1165 to 1168).
5. Control heights by context, not by class. A button is 52px, or 44px inside `.task` or `.inline-add`. An input is 52px, 44px inside `.toolbar` or `.inline-add`, or 36px as `.input-small`. `.btn-small` exists only in `styleguide.css:9`.
6. Focus ring colour. Slate everywhere, navy on primary, accent on `.chip`, `.fit` and `.sort`.
7. Single sided edges. 3px on `.result-list li` (C:80), 4px on `.notice` (A:1140) and `.panel-accent` (A:532).
8. Border weights. 2px on inputs, choices and buttons; 1px on chips and fit pills; 1.5px on `.target-tag`, `.move` and `.type-dot-empty`.
9. Hairlines and tints written by hand. `rgba(46, 64, 98, 0.12)` (C:886) beside `--hairline`; paper at 55 percent twice (A:249, A:328); sky at 35 percent (A:998).
10. `.factor` sets its cursor 3 times (C:118 grab, C:191, C:243).
11. Key and value pairs. `.details` in panels and `.task` rows in lists carry the same kind of content (for example Splose details against Splose forms).

Classes the live app writes that have no style: `.fit-on`, `.factor-target`, `.factor-sourced`, `.table-questions`, `.home-tasks`, `.home-session`, `.home-resources`, `.fv-layer-mid`, and the per drawing classes `.fv-flower`, `.fv-river`, `.fv-balance`, `.fv-radial`, `.fv-loop`.

Styles the live app never uses (the sample, previews or style guide may): `.panel-accent`, `.panel-inverted`, `[data-theme="inverted"]`, `.hairline`, `.journey-stages`, `.stats` and `.stat`, `.sample-hint`, `.move`, `.dashboard-split`, `.intro-wide`, `.actions-end`, `.t-display`, and the full size `.journey-hero`.

### 8.9 Where DESIGN.md and the style guide do not match the live app

DESIGN.md:
- "The accent never carries text." Live: white text sits on the accent in `.fit` and `.chip` (C:319 to 323, C:449 to 453), and `.factor-response` sets caption text in the accent colour (C:257 to 259).
- "The only motion is a 180ms ease out and the mark." Live: the drawings rise in over 420ms, draw over 900ms and the beam settles over 700ms (C:1092 to 1118).
- "Single sided edges are never rounded on that side." Live: `.notice` has 12px corners on all 4 corners with its 4px left edge (A:1137 to 1140).
- "4 palette colours do every job." Live: white is used for hover and selected text, and 4 more colours are written into the drawings (finding 32).
- Radius roles of 8, 12, 16 and pill. Live also has 3px (`.segments i`, C:625), 6px (`kbd`, A:1034) and 18 units (drawing frame, `formulation-views.js:120`).
- Type ramp. Live also has 11px (C:731), 12px (A:1036), 13px (A:717), 20px (`.session-when`, C:775) and 24 and 28px arrows (C:976, C:982).
- "Controls have 2px slate strokes." Live: chips and fit pills use 1px.
- "The ring sits at 200px on the full hero." The full hero is not used on any live screen; only the compact 140px form is.
- The filter chip's pressed look (accent fill) and the `.subnav-link` hover are not described.
- Brick "for form errors only". Live: brick is the does not fit dot.

`public/styleguide.html`:
- It says it shows "every component the Client Hub uses", but it loads `tokens.css`, `app.css` and `styleguide.css` only (`:11` to `:13`), not `components.css`. So it cannot show the tick box, dialog, chips, fit pills, client record tabs, client rows, tracker, details list, formulation zones, the map or any drawing, and it does not show a table or the select.
- It shows 3 things the live app does not use: `.journey-stages` (`:102`), `.panel-accent` (`:111`) and `.panel-inverted` (`:172`).
- It uses `.btn-small` (`:98`), which exists only for that page.
- Its task rows have 2 parts (`:117` to `:124`); live rows have 3 (text, pill, action).
- Its question legend is `.t-heading` (`:133`); the live question is `.t-title`.
- Its main region is `#main` (`:48`); the live app uses `#workspace`.
- It has no hover, focus, pressed or selected examples beyond 1 disabled button and 1 invalid field.

For the shared guide: sections 7.2 and 8 give the exact names and values. The 3 decisions to make first are the button shape, body weight, and 1 token file with 1 set of names.
