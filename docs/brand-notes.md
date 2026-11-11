# Brand notes

The Client Hub is built from the Executive Frame brand pack, version 1.1 of 11 November 2026, by Levi Wilson. The live reference is `/styleguide` on the Client Hub. What was applied from the pack, and what still conflicts with its guidelines, is in `docs/audits/brand-pack-1.1-client-hub.md`.

## Where the brand lives in the repo

| What | Where | Source |
|---|---|---|
| The pack's tokens, unchanged | `brand/ef-tokens.json` | pack, `05-tokens/ef-tokens.json` |
| What the app adds (its type sizes, control sizes, the navy primary) | `brand/app-tokens.json` | this repo |
| Joined tokens, CSS variables, the mark's paths (generated) | `brand/tokens.json`, `public/css/tokens.css`, `public/js/mark-paths.js` | `npm run tokens` |
| How the app's statuses map onto the pack's application colours | `brand/app-colours.json` | this repo |
| Mark, wordmark and lockup SVGs | `public/assets/brand/` | pack, `02-logo` |
| App icons | `public/assets/brand/app-icon/` | pack, `03-app-icon` |
| Favicons, touch icon, web manifest | `public/` (site root) | pack, `04-favicon` |

When the pack changes: replace `brand/ef-tokens.json` and the files copied from `02-logo`, `03-app-icon` and `04-favicon`, run `npm run tokens`, then `npm run check`. Nothing generated is edited by hand.

## Where the Client Hub does not follow the pack

1. The primary button is navy. The pack's tokens give slate; the designer is changing the pack to navy, so both hubs use navy now. The value is `primaryOverride` in `brand/app-tokens.json`, and a unit test fails when the pack itself says navy so the override can be removed.
2. Body and caption text are weight 400, for readability. The pack's 300 can be seen by setting `data-weight="light"` on the page.
3. The app keeps its own type sizes (17px body, 28px title and so on). The pack's scale is for the website.
4. Figtree is self hosted with the Latin Extended subset as well as Latin, so macrons in te reo Māori render in Figtree. Nothing loads from Google Fonts or any other origin.
5. There is no dark mode in this release.

## Status and message colours

These are the pack's application colours. Each is text and icon on its own tint, always with an icon and a word.

| App status | Pack colour | Text and icon | Tint | On its tint | On sky | On warm white |
|---|---|---|---|---|---|---|
| Done | success | #285E44 | #E3EFE8 | 6.41:1 | 5.35:1 | 6.82:1 |
| In progress | info | #3E5680 | #E6ECF4 | 6.20:1 | 5.21:1 | 6.65:1 |
| Needs attention | warning | #73540F | #F7EDD4 | 6.00:1 | 4.94:1 | 6.30:1 |
| Error | error | #8A3F34 | #F6E3DF | 5.97:1 | 5.23:1 | 6.67:1 |

Not started and To do are not a status colour: they are the plain tag, warm white with a hairline and no icon. `npm run contrast` checks every pair above.

## Client type accents (an open decision)

| Type | Value | On sky | On warm white |
|---|---|---|---|
| Neurodivergent | #A65A1B | 3.62:1 | 4.62:1 |
| Health | #2F6E68 | 4.18:1 | 5.33:1 |
| Corporate, team | slate #3E5680 | 5.21:1 | 6.65:1 |

The brand guidelines list a colour per pathway as not part of the brand. The accents are kept for now and are not used in the formulation drawings. Where they are used, and whose decision it is, is in the audit record.
