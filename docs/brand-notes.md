# Brand notes for Levi

Built from the interim app brand kit of 18 October 2026 (`brand/tokens.json`, mark and app icon SVGs in `public/assets/brand/`). The live reference is `/styleguide` on the Client Hub.

## How the tokens are shared

`public/css/tokens.css` is generated from `brand/tokens.json` by `scripts/build-tokens.mjs` and is never edited by hand. Running the same script against the same `tokens.json` in the Learning Hub produces an identical file. Anything specific to the Client Hub sits in `public/css/app.css`. When the kit changes, replace `brand/tokens.json` and run `npm run tokens`.

## Where the Client Hub departs from the kit

1. Body and caption text are set at weight 400, as the brief requires for readability. The kit's 300 can be restored by setting `data-weight="light"` on the page.
2. The lockup SVGs draw "Executive Frame" as live text. Inside an image the page's fonts are unavailable, so the wordmark falls back to a system font. The header therefore uses the small mark as an image and sets the wordmark as page text in Figtree. A lockup with the text converted to outlines would remove this workaround.
3. Figtree is served with the Latin Extended subset as well as Latin, so macrons in te reo Māori render in Figtree.
4. The kit marks sky and error as provisional. Both pass contrast as they stand.

## Status colours (added for the Client Hub)

| Status | Text and icon | Tint | On sky | On warm white | On own tint |
|---|---|---|---|---|---|
| Done | #2F5D3A | #E3ECE2 | 5.40:1 | 6.89:1 | 6.32:1 |
| In progress | #2E4062 (navy) | #E4E9F1 | 7.33:1 | 9.35:1 | 8.50:1 |
| Needs attention | #6E4A10 | #F2E8D6 | 5.60:1 | 7.15:1 | 6.52:1 |

Every status is shown with an icon and a word, never by colour alone. Needs attention is kept distinct from the error colour, which is reserved for form errors.

## Client type accents (placeholders, awaiting your values)

| Type | Placeholder | On sky | Use |
|---|---|---|---|
| Neurodivergent | #A65A1B | 3.62:1 | Accent bar, current journey step, measure progress |
| Health | #2F6E68 | 4.18:1 | As above |
| Corporate, team | slate #3E5680 | 5.21:1 | As above |

Accents are decorative and never carry text, so they need 3:1 rather than 4.5:1. They should stay clear of the status colours, which is why the health placeholder is teal rather than the green used for Done. Replace the values in `public/config/client-types.json`; `npm run contrast` checks them.

## Still needed

1. Final accent colours for each client type.
2. A PNG app icon (180 by 180) for the iOS home screen, which does not accept SVG.
3. Confirmation of the provisional sky and error values.
