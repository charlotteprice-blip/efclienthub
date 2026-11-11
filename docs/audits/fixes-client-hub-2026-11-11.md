# Fix log: Client Hub audit of 10 November 2026

Date: 11 November 2026. Branch: `audit-fixes-2026-11-10`, cut from `main`, not merged and not pushed. Audit: `docs/audits/impeccable-client-hub-2026-11-10.md`. Every fix was made and checked on invented clients in the local harness only. Nothing here comes from the live site or a real record.

Counts: 25 fixed, 6 partly fixed, 4 left. 35 findings in all.

## How fixes were checked

- `npm run check` after each group: 146 unit tests pass (102 before this work) and all 35 colour pairings pass (25 before), with a new guard that fails if text is muted with opacity.
- `npm run test:rules` on the local Firestore and Storage emulators (project `demo-clienthub`, Java 21): 89 tests pass (81 before).
- The local harness at localhost:5174, as a client, the practitioner and admin, at 375, 768 and 1280px wide, plus 1024px for the layout findings. "Harness" below means seen there. Measured in the page where a number matters (scroll position, focus, widths).
- Not checked: the live site, a real phone or tablet, a real screen reader, 200 percent zoom, and the clickable sample in `public/sample/` (see the review list at the end).

## Deploy notes

1. Order matters for commit `9348abb`: deploy functions, then hosting, then rules. The new rules stop clients reading the questionnaire library. If they go live before the pages and functions that match them, clients find no questionnaires. `README.md` says the same.
2. `markFlagsFollowedUp` is already live. Charlotte ran `npm run deploy:functions` from this branch part way through, so the live functions include it (and `hasClientHub`) ahead of the pages that call it. The live pages are still the 1 November version, so nothing calls it yet. It is practitioner only and audited, so this is harmless.
3. Functions added after that deploy and not yet live: `myQuestionnaires`, `listActivationCodes`, and the changes to `createRequest` and `issueActivationCode`.

## The 35 findings

| # | Severity | Finding | Status | Commit and check |
|---|---|---|---|---|
| 1 | P1 | Flagged answers never reach the dashboard | Fixed | `fc1acf3`. Flagged answers lead Today, show on the client row and every tab of the record, and count in To review (including questionnaires for Sarah only) until she presses Mark as followed up. New function `markFlagsFollowedUp`, practitioner only, audited. Unit tests for the function and the dashboard; harness at 1280. |
| 2 | P1 | Admin cannot open a questionnaire page | Fixed | `24469bd`. Harness as admin: the page and its test run open. Any error while loading or drawing a screen now paints a message with Try again and Log out; checked by cutting the network in the harness. |
| 3 | P1 | Intake errors off screen and not announced | Fixed | `5227aa7`. Harness at 375: focus lands on the first unanswered question, it is scrolled into view, the group carries `aria-invalid` and `aria-describedby`, and a summary is announced. Same for Choose an answer on the question screen. |
| 4 | P1 | Every save jumps to the top and drops focus | Fixed | `5227aa7`. Harness: changing the drawing and moving a factor keep scroll (measured, unchanged) and focus returns to the control used. The message after a save stays in view. |
| 5 | P1 | Drawings unreadable on a phone and clip text | Partly fixed | `b4af5cf`. Below 800px of container width the 5 SVG drawings give way to the map; text is 14 units with a 12 unit minimum; factors in measured columns are no longer cut short. Harness at 375, 768 and 1280, all 7 drawings. Left: petals on the flower, cards on the loop and the flower's centre keep a line limit, because their neighbours are at fixed points and longer text would overlap. The full words are always on the cards below. Removing the limit needs those 2 drawings laid out again. |
| 6 | P1 | Question screen needs scrolling on a phone | Fixed | `20c6c14`. Long instructions (over 140 characters) are read once before question 1 and sit behind Show instructions; long questions step down a size; Back and Next stay in view. Harness at 375 with the longest questionnaire: Next is on screen on every question. |
| 7 | P1 | Client responses shown by colour alone | Fixed | `b4af5cf`. Each response has its own shape, a key in words sits under every drawing, and the text alternative counts the responses. The brick error colour is no longer used. Unit tests and harness. |
| 8 | P1 | 5 kinds of text below 4.5:1 | Fixed | `4fdbd53`. Full ink or a solid checked colour in each place; the tracker runs down the page on a phone so labels stay at 14px. The contrast script checks the new pairs and text on the accent, and fails on any new opacity on text (proved by adding 1 and seeing it fail). The card comment and the Splose search have visible labels. |
| 9 | P1 | Releasing a formulation in 1 click | Fixed | `ba8e191`. A dialog names the client, the number of cards and the drawing before anything is shared. Harness: nothing is released until Confirm. No withdraw, by Charlotte's decision of 11 November. |
| 10 | P1 | Task rows collapse at 900 to 1150px | Fixed | `6bd5499`. Rows wrap by the room they have (container query) and Home goes to 1 column below 1200px. Harness at 1024 (text column 417px, was 55 to 130px) and 375. |
| 11 | P1 | `jds` answer scale may not match its questions | Left | Charlotte's to check against the instrument and the codebook. Questionnaire content was out of bounds. |
| 12 | P1 | Home does not offer 1 clear next action | Partly fixed | `50cf09b`. 1 primary button, the rest secondary, each link named; a small ring beside the title on phones so the first Start is on the first screen (measured at 375); a Splose form is said once, as a To do row. Left for Charlotte and Sarah: folding later tasks into 1 line, an action inside the hero, and the wording that names Splose. |
| 13 | P2 | Today leaves out waiting work | Fixed | `fc1acf3`. Drafts and every open privacy request are in Today; each row has a status pill and a named link to the right tab; the To review count matches what is listed. Unit test and harness. |
| 14 | P2 | A fit answer is lost unless Save is pressed | Fixed | `5227aa7`. The fit choice saves as it is chosen, the card says Saved, and the picture redraws its mark without repainting the page. Harness at 375: scroll unchanged at the ninth card. |
| 15 | P2 | Privacy requests fail silently or twice | Fixed | `50cf09b`. An empty correction shows a field error. A second request for a copy while 1 is open is not created (function and unit test) and Account shows the dates in place of the button. |
| 16 | P2 | Booking button is a dead end, no way to reach Sarah | Partly fixed | `50cf09b`. `contactEmail` in `app.json` (consultant@sarahanticich.co.nz, from Charlotte) shows in the booking dialog, on the activation screen and on Account. Left: `bookingUrl` is still empty, which is launch step 5. |
| 17 | P2 | Phone menu loses state and focus | Fixed | `6bd5499`. 1 function opens and closes it: state, name, focus, the page behind out of reach, and a Close menu button. Harness at 375 with the button, Escape, the close button and a tap outside. |
| 18 | P2 | Dialogs have no accessible name | Fixed | `ba8e191`. Named by their heading. Checked in the harness. |
| 19 | P2 | Wide tables not reachable by keyboard | Fixed | `6bd5499`. Every scrolling table is a named, focusable region; the Questions table now fits its frame (678 of 678px, was 2,082). |
| 20 | P2 | Consent notice leaves things out; no way out of onboarding | Left | Sarah approves this wording. The Log out button on consent and intake is small and can follow her wording. |
| 21 | P2 | Admin can see who the clients are | Fixed | `9348abb`. Charlotte's decision of 11 November. Rules: activation codes and the audit log are practitioner only. Functions: admin's codes list has no name, email or uid; a code issued by admin stores none. Unit tests, rules tests, and the harness as admin. |
| 22 | P2 | A signed in browser stays signed in for ever | Fixed | `3107a4c`. Charlotte's decision: 30 minutes, a warning 1 minute before, clients and staff. Timing rules are a pure module with 14 unit tests, and 3 more guard that an idle log out never sends anything on a client's behalf (a typed but unsent comment is let go). Harness: the warning, Stay logged in, the log out with its message, a fresh log in, and a kept session reopened after hours. |
| 23 | P2 | Scoring rules readable by any activated client | Fixed | `9348abb`. Charlotte's decision. Rules: the measure library is staff only. A client is handed questions and answer options by `myQuestionnaires`, for their own questionnaires only. Unit tests, rules tests, and the harness as a client (Home, Questionnaires and a questionnaire all load). |
| 24 | P2 | Assigning a later questionnaire sends the journey backwards | Left | Charlotte and Sarah. It changes what the journey means; 1 line in `functions/handlers.js` once decided. |
| 25 | P2 | Clinical terms reach the client | Left | Sarah: whether clients should see the clinical names. |
| 26 | P2 | Loading and error states are thin | Partly fixed | `24469bd`. Error screen with Try again and Log out, buttons name their own work, a line under the top bar while a page waits on data. Left: staff pages still reload every collection on each page change. |
| 27 | P2 | Number keys cannot reach options 10 and 11 | Fixed | `20c6c14`. Key caps and the hint cover the first 9 answers and name the arrow keys for the rest. |
| 28 | P2 | Tracker semantics and empty sections | Partly fixed | `50cf09b`. The tracker marks the current step and says done or still to come in words. Left for Charlotte: whether to hide the empty resources panel and the tracker early in the journey (decision 55 sets what Home shows). |
| 29 | P2 | Neutral states use the Needs attention pill | Fixed | `50cf09b`. To do and Not started on client screens are a neutral pill with an empty ring. |
| 30 | P3 | Focus ring round the whole workspace | Fixed | `6bd5499`. |
| 31 | P3 | Client record tabs run off a phone | Fixed | `6bd5499`. Harness at 375: nothing past the right edge. |
| 32 | P3 | Token drift | Partly fixed | `b4af5cf`, `4fdbd53`, `eb4a4c7`. The hard coded greens, amber and brick in the drawings use tokens; off scale radii and sizes use tokens; white text on the accent is a token and is checked. Left: `#FFFFFF` on button and chip hover, which DESIGN.md documents, and the 13px mark inside the error badge. |
| 33 | P3 | Documents out of step with the code | Fixed | `eb4a4c7`, `9348abb`. DESIGN.md, `docs/client-journey.md` and the comment in `firestore.rules`. |
| 34 | P3 | Small markup points | Fixed | `20c6c14`, `eb4a4c7`. |
| 35 | P3 | Dates without a year; next session time zone | Fixed | `eb4a4c7`. Dates with a time show the year. The next session box is read and written in New Zealand time, with unit tests each side of a daylight saving change. |

## The 1 November critique of Home

| Critique issue | Where it stands |
|---|---|
| P1: 4 primary buttons, 5 rows | Fixed: 1 primary button. The 5 rows remain; folding them is a design decision. |
| P1: hero fills the first phone screen | Fixed: a small ring beside the title, and the first Start is on the first screen at 375px. |
| P1: Splose form said 3 times, no action | Partly: said once, in To do. It still names Splose and has nothing to press, because the link is in Splose's own email; the wording is Sarah's. |
| P2: tracker unreadable to a screen reader, 11px labels | Fixed: states in words, the current step marked, labels at 14px and full strength. |
| P2: 2 empty sections | Open: a decision for Charlotte (decision 55). |

## Decisions still waiting

For Sarah:
1. The consent notice wording (finding 20). If she wants them there, it now also needs a line that an admin account cannot see client names, and a line about being logged out after 30 minutes.
2. Whether clients see the clinical names on the formulation (finding 25).
3. Whether a client with a flagged answer should see a calm line on where to get urgent help (finding 1; decision 42 still says no client message).
4. The wording that names Splose on Home (finding 12).

For Charlotte:
5. The `jds` answer scale against the instrument (finding 11).
6. Whether assigning a later questionnaire should move the journey back (finding 24), with Sarah.
7. Hiding empty sections on Home and folding later tasks (findings 12 and 28).
8. `bookingUrl`, launch step 5 (finding 16).
9. Whether a withdraw for released results or a formulation is wanted later (finding 9).

## New things noticed

1. A long questionnaire title widened the phone layout past the screen (497px at 375). Fixed in `20c6c14`.
2. Audit entries written before this branch for issued codes carry the client's name (`forName`). New entries do not, and the audit log is now practitioner only, but the old entries are still in the live database. Charlotte may want them cleared.
3. On the balance drawing the 2 pans touch the edges of the frame. Not changed.
4. On the question screen Enter moves on only when an answer has focus. After a number key it works; from a fresh page with nothing chosen it does nothing. Not changed.
5. Sarah cannot edit or leave out a strength or area of focus before release (audit section 4). Not in the 35 findings; not changed.
6. An admin account can still see a code's client type beside its last 4 characters. A type without a name does not say who a client is, but it is worth knowing.
7. The owner of the Firebase project can read everything in the Google console whatever the app's roles say (open question 8).

## For review before this is merged

1. `markFlagsFollowedUp` is new behaviour, not only a fix: without it a flag would stay on the dashboard for ever. Sarah should see it.
2. Resolved on review, 11 November: at an idle log out a client's typed but unsent comment on a formulation card is no longer sent to Sarah. Sending is the client's choice. The comment is let go and is not kept in the browser, which may be a shared computer; the client types it again after logging back in. Only Sarah's own draft summary is saved at an idle log out. A unit test guards this.
3. A code issued by an admin account has no name and no email, so it cannot be tied to 1 email address.
4. The menu no longer fades during a questionnaire (it failed contrast and its links still worked). This changes decision 15.
5. Removing the 2 repeated Splose lines on Home takes out draft copy that Sarah may have seen.
6. The clickable sample shares `public/js/ui.js`, which gained a Close menu button, a To do pill and the year on dates. The sample was not opened.
7. The Notion work log entry for this session has not been written.
