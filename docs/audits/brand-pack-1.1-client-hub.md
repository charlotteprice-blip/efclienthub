# Brand pack 1.1 in the Client Hub

Date: 12 November 2026. Branch: `brand-pack-1.1`, in the working copy `~/efclienthub-brand-pack`, cut from `main` as it was live that morning. Not merged, not pushed, not deployed. Source: the Executive Frame brand pack, version 1.1 of 11 November 2026, and the designer's feedback as Charlotte passed it on. The same shared decisions are applied in the Learning Hub so the 2 apps come out alike. Checked on invented clients in the local harness only.

## 1. What changed, by decision

### Shared decisions (both apps)

| # | Decision | What was done |
|---|---|---|
| 1 | Buttons are pills, with a pressed state | Every `.btn` (primary, secondary, quiet) and the menu button use `--radius-pill`. `:active` moves the button down 1px with the 180ms transition, off under reduced motion. Class names, the warm white secondary with a white hover and full width on phones are unchanged. Fields stay 8px, navigation items and choice cards 12px, panels 16px. DESIGN.md's radius roles are updated. |
| 2 | The primary button stays navy | `--primary` is navy. The pack's tokens say slate; `primaryOverride` in `brand/app-tokens.json` holds the 1 value that does not follow the pack, with a comment in the CSS, and a unit test that fails once the pack itself says navy. |
| 3 | Body weight stays 400 | Unchanged, and covered by a unit test. |
| 4 | Tokens come from the pack | `brand/ef-tokens.json` is the pack's file, copied in unchanged. `scripts/build-tokens.mjs` joins it with `brand/app-tokens.json` (the app's type sizes and control sizes) and writes `brand/tokens.json`, `public/css/tokens.css` and `public/js/mark-paths.js`. Existing token names still work. The pack's type scale is not used. |
| 5 | Status and notice colours are the pack's application colours | Done is success (#285E44 on #E3EFE8), in progress is info (#3E5680 on #E6ECF4), attention is warning (#73540F on #F7EDD4), error is #8A3F34 with #F6E3DF. `brand/app-colours.json` and `docs/brand-notes.md` are updated. The contrast check covers every pair: 58 pairings, up from 35. |
| 6 | A notice is 1 component with an icon and a word | `notice(kind, html)` in `public/js/ui.js`, 4 kinds, each a 16px stroked icon and a word in the colour of its kind on that kind's tint. Every message in the live app, the sample and the style guide uses it. The old left edge bar is gone. |
| 7 | Status pills keep icon and word; Not started is neutral everywhere | Status icons are redrawn as 16px strokes with no colour written in. Not started and To do are the plain tag (`.tag`) on client and staff screens, including the practitioner's Today list. Attention stays for things that need action (Expired, a draft to review, a flagged answer, a request due soon). |
| 8 | No shadows anywhere | `box-shadow` is not used at all. The workspace edge and the focus zone are borders, the current step has an outline, and the drawer dims the page with a flat navy layer. The contrast check fails on any `box-shadow`, and on any colour written into a rule. |
| 9 | Mark and lockup from the pack | Every file in `public/assets/brand/` is replaced with the pack's `02-logo` SVGs and `03-app-icon` files. The header shows the supplied horizontal lockup at 150px wide (minimum 140px; the mark is 24px), with Client Hub beside it as interface text after a hairline and the lockup's clear space. The favicon set and web manifest from `04-favicon` are at the site root and the head snippet is in every page. The Content Security Policy is unchanged and still passes: everything is served from this origin, and the favicon's own inline style renders correctly under it (checked by drawing it to a canvas in the harness). |
| 10 | The mark is still, or draws on once | `public/js/mark.js` builds the inline mark from the pack's loop and triangle paths, stroke 5 on the 100 grid, each with `pathLength="100"`. It draws on once when the app opens and is still on every later loading screen. Nothing loops (a unit test checks for `infinite`). Reduced motion shows the finished mark. |
| 11 | No dark mode | None added. |

### Client Hub only

| # | Decision | What was done |
|---|---|---|
| 1 | Retire the journey ring | `public/js/journey-ring.js` is deleted, and the ring is gone from Home, the sample and the previews. Home's hero says the step in words. The tracker under Your steps shows the 7 stages and carries what the old report tracker said: questionnaires done, and when results and the formulation were shared. The practitioner's dashboard rows show the same tracker as dots in place of the 7 segment bar. Home's own progress bar and the sample's dotted stage list are removed, so steps are shown in 2 ways only: the tracker, and the progress bar inside a questionnaire. The first action is on the first phone screen at all 7 stages (measured at 375 by 812: the first button ends between 538px and 668px down). Decision 81 replaces decision 14. |
| 2 | Formulation drawings from tokens | Every colour in all 7 drawings is a palette token or a status token, read back from the rendered pictures in the harness. The client type accent is no longer used in any drawing. Each card's response is a mark with its own shape (tick, half, cross, empty ring), a tooltip in words, and a key in words under the picture, as built in `b4af5cf`. |
| 3 | Client type accents | Not removed. Listed in section 3. |
| 4 | Guidelines read against the app | Section 3. |

## 2. What was checked

- `npm run check`: 164 unit tests pass (150 before), including new tests that the tokens, the mark's paths and the logo files are the pack's. All 58 colour pairings pass.
- `npm run test:rules`: 89 pass on the local emulator. The rules are unchanged.
- The local harness, run from the working copy on port 5176 (`PORT=5176 npm run harness`, then http://127.0.0.1:5176), as client, practitioner and admin at 375, 768 and 1280, plus 920 for the wider sidebar:
  - Home without the ring at each of the 7 stages; a questionnaire; Results before release; Formulation with all 7 drawings; the practitioner's dashboard, client record and flagged answers; admin's codes page.
  - No sideways overflow on any main route. The library filters overflowed between 900 and about 1040px beside the wider sidebar; fixed.
  - No element on any page checked has a computed box shadow.
  - The header lockup measures 150 by 24px and Client Hub sits inside the 280px sidebar. The tab icon, manifest and touch icon load from this origin.
- Not checked: a real phone, a real screen reader, the favicon in a real browser tab in dark mode, the installed app icon on a phone, the clickable sample and the 3 preview pages in a browser (their code was updated and the unit tests pass), and the live site.

## 3. What still conflicts with the guidelines

Nothing here was changed. Each needs a decision.

| # | Guideline | In the Client Hub | Whose decision |
|---|---|---|---|
| 1 | No colour per pathway; no fifth colour | The client type accents (neurodivergent #A65A1B, health #2F6E68; corporate and team are slate) in `public/config/client-types.json`. Used for: the progress bar inside a questionnaire; the current step dot and its outline on the tracker; the left edge of result items and the accent panel; the border of the Focus of our work tag and of that zone on the formulation; the selected fit pill; the pressed filter chip and 3 focus outlines in the library; and the type dot in the Clients and Activation codes tables. | Charlotte and the designer |
| 2 | Primary button is slate | Navy, by shared decision 2. | The designer, who is changing the pack |
| 3 | Body and captions are Light 300 | 400, by shared decision 3. | Charlotte, already decided |
| 4 | There is no muted text colour | Placeholder text in fields is a softened slate, #596E91 (4.66:1 on warm white). | The designer |
| 5 | In the app the inverted theme follows the device's dark mode | No dark mode in this release, by shared decision 11. The pack's `favicon.svg` does switch to warm white in dark mode, as supplied. | Charlotte |
| 6 | Application colours appear only on forms and messages | The success green also marks done steps on the tracker and what helps in the formulation drawings, as Client Hub decision 2 allows. | The designer |
| 7 | Progress is a thin hairline bar | The questionnaire's progress bar is 6px tall with an accent fill. | The designer |
| 8 | One primary action per screen | Client screens keep to it. The practitioner's dashboard can show a primary button on more than 1 client row. | Charlotte |
| 9 | Icon sets are not part of the brand on brand surfaces | The app's menu uses 10 small line icons, and status and notices use 5. They are interface, not brand surfaces, but the designer has not seen them. | The designer |
| 10 | Never use an exclamation mark | Copy has none. The warning icon and the form error badge draw one as a symbol. | The designer |
| 11 | Nothing is set in capitals | The activation code box shows what is typed in capitals with wide tracking, because codes are capitals. No label, heading or button is in capitals. | The designer |
| 12 | Theme colour | The head snippet sets `theme-color` to navy, so a phone browser's bar is navy above a sky page. Followed as supplied. | The designer |
| 13 | Use the supplied files | The web manifest names the app Executive Frame, not Client Hub, as supplied. Both hubs would install under the same name. | Charlotte and the designer |
| 14 | Four colours | Pure white is used for the hover of a warm white button or chip and for text on the selected fit pill. The select arrow is an inline image with navy written in, because an image cannot read a token. | The designer |
| 15 | Sky is provisional | Still #CFDAE8. Changing it is 1 value in `brand/ef-tokens.json`. | The designer |

## 4. Choices made where the shared decisions were silent

The Learning Hub needs to match these.

1. Notice words: info is Note, success is Done, warning is Attention, error is Problem. A view can set its own word for the case (Not shared yet, Answers to follow up, Not finished yet).
2. Notice shape: no edge bar; tint fill, 12px corners, 16px padding; the icon and the word take the colour of the kind and the text stays slate.
3. Icons, on a 16 unit box at the icon stroke token: success is a tick in a circle, info an i in a circle, warning an exclamation in a triangle, error a cross in a circle, in progress a half filled circle.
4. The plain tag: warm white fill, a 1px hairline border so it also shows on the warm white workspace, caption type at 500, 28px tall, no icon.
5. The lockup is 150px wide, not the 140px minimum, so the mark is 24px, the smallest size for its standard stroke. The sidebar grew from 248px to 280px to hold it with the app's name.
6. `theme-color` follows the pack's head snippet (navy).
7. The mark draws on once per visit, on the first loading screen; later loading screens show it still.
8. The pack's SVGs are copied in exactly as supplied, including the content credentials each carries.

## 5. Before this is merged

1. Sarah has not seen Home without the ring, or the new Your steps heading and its wording (Results shared, Formulation shared, with dates).
2. The 3 launch steps that touch these files still stand: the preview pages are deleted before launch, and they were updated here only so they do not break.
3. Deploy needs hosting only. No function, rule or config that the functions read was changed.
