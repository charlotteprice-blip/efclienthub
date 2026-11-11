---
name: Executive Frame Client Hub
description: A calm clinic room on screen, sky frame around warm paper, solid controls for tired thumbs
colors:
  winter-sky: "#CFDAE8"
  slate-ink: "#3E5680"
  deep-navy: "#2E4062"
  warm-paper: "#F5F3EE"
  hairline: "rgba(62,86,128,0.25)"
  underline: "rgba(62,86,128,0.40)"
  brick: "#8A3F34"
  rose: "#F2B8AD"
  paper-hairline: "rgba(245,243,238,0.25)"
  moss: "#2F5D3A"
  moss-tint: "#E3ECE2"
  navy-tint: "#E4E9F1"
  ochre: "#6E4A10"
  sand: "#F2E8D6"
  burnt-amber: "#A65A1B"
  deep-teal: "#2F6E68"
typography:
  display:
    fontFamily: "Figtree, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "40px"
    fontWeight: 400
    lineHeight: "42px"
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Figtree, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: "32px"
    letterSpacing: "-0.01em"
  heading:
    fontFamily: "Figtree, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: "28px"
    letterSpacing: "0em"
  body:
    fontFamily: "Figtree, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "26px"
    letterSpacing: "0em"
  ui:
    fontFamily: "Figtree, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "22px"
    letterSpacing: "0em"
  ui-strong:
    fontFamily: "Figtree, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: "22px"
    letterSpacing: "0em"
  caption:
    fontFamily: "Figtree, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "0em"
  wordmark:
    fontFamily: "Figtree, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: "20px"
    letterSpacing: "0em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
  "7": "48px"
  "8": "64px"
components:
  button-primary:
    backgroundColor: "{colors.deep-navy}"
    textColor: "{colors.warm-paper}"
    typography: "{typography.ui-strong}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.slate-ink}"
    textColor: "{colors.warm-paper}"
  button-secondary:
    backgroundColor: "{colors.warm-paper}"
    textColor: "{colors.slate-ink}"
    typography: "{typography.ui-strong}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "52px"
  button-secondary-hover:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.slate-ink}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.slate-ink}"
    typography: "{typography.ui}"
    padding: "0 12px"
    height: "44px"
  input:
    backgroundColor: "{colors.warm-paper}"
    textColor: "{colors.slate-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
    height: "52px"
  choice-card:
    backgroundColor: "{colors.warm-paper}"
    textColor: "{colors.slate-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "52px"
  choice-card-selected:
    backgroundColor: "{colors.winter-sky}"
    textColor: "{colors.deep-navy}"
  status-done:
    backgroundColor: "{colors.moss-tint}"
    textColor: "{colors.moss}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "4px 12px 4px 8px"
    height: "28px"
  status-progress:
    backgroundColor: "{colors.navy-tint}"
    textColor: "{colors.deep-navy}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "4px 12px 4px 8px"
    height: "28px"
  status-attention:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ochre}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "4px 12px 4px 8px"
    height: "28px"
  panel:
    backgroundColor: "{colors.warm-paper}"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  panel-on-paper:
    backgroundColor: "{colors.winter-sky}"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.slate-ink}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "44px"
  nav-link-active:
    backgroundColor: "{colors.warm-paper}"
    textColor: "{colors.slate-ink}"
    typography: "{typography.ui-strong}"
  nav-count:
    backgroundColor: "{colors.deep-navy}"
    textColor: "{colors.warm-paper}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "24px"
  subnav-link-active:
    backgroundColor: "{colors.deep-navy}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: "4px 14px"
    height: "36px"
  notice:
    backgroundColor: "{colors.warm-paper}"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: Executive Frame Client Hub

## Overview

**Creative North Star: "The Calm Clinic Room"**

The hub is a quiet, well lit consulting room on screen. The room is winter sky: the sidebar and top bar are a single flat field of pale blue that frames everything. On the desk sits warm paper, the workspace where the client and Sarah actually read and write, lifted from the room by nothing more than a rounded top corner and a 1px hairline. There are no shadows, no gradients, no pictures, no decoration. Depth is 2 tones of the same light, and the eye rests.

Every client screen asks for 1 thing. Type is set large (17px body on a 26px line), controls are tall (52px) and full width on a phone, and the whole page is finishable in a single sitting by someone who is tired, distracted or anxious. Sarah's screens keep the same materials but pack more in: panels flow in 2 columns, tables and task rows carry the day's work, and status is always an icon plus a word in a tinted pill. The one spark of colour in the room is the client type accent, a decorative stroke on the journey ring, the progress bar and the current step; it never carries meaning on its own, and the only text it carries is the white label on a selected fit pill or pressed filter chip, which `npm run contrast` checks at 4.5:1.

The mood is calm, unhurried and clinical in the good sense: orderly, precise, with nothing on the surfaces that does not need to be there. The only motion is a 180ms ease out on state changes and the mark drawing itself in once on load.

**Key Characteristics:**
- 4 palette colours do almost everything: winter sky, slate ink, deep navy, warm paper
- Flat by rule: tonal layering and hairlines, never box shadows
- Figtree at 3 weights; body and captions at 400 for readability (the kit's 300 is opt in)
- 52px controls, 44px minimum touch targets, 2px slate strokes, 8 to 16px corners
- Status by icon and word in a tinted pill, never by colour alone
- One accent per client type, decorative only, 3:1 against its grounds

## Colors

A 4 colour kit of pale blue and warm off white with 2 blues for ink, plus a small status set and a decorative accent per client type; every text pairing passes WCAG AA and is checked by `npm run contrast`.

### Primary
- **Deep Navy** (`deep-navy`): the inverted ground. Primary buttons, the nav count pill, the active sub navigation pill, the avatar disc, the checked radio dot. The darkest thing on any screen, used sparingly so a primary action is always findable.
- **Slate Ink** (`slate-ink`): all text and strokes on sky and paper. Input borders (2px), secondary button borders, the focus ring, icons at 1.5 stroke. Primary button hover. The kit's "ink" in the light theme.

### Neutral
- **Winter Sky** (`winter-sky`): the room. The page ground behind the viewer frame, the sidebar and top bar, and the panel colour for anything that sits on the paper workspace (Home sections, the journey hero, practitioner panels, table headers, the selected choice card).
- **Warm Paper** (`warm-paper`): the desk. The workspace reading ground, panels and notices that sit on sky, inputs, secondary buttons, the active nav link, the sign in card, the client row on the dashboard. Also the inverted theme's ink.
- **Hairline** (`hairline`): slate at 25 percent. Dividers under task rows and table rows, the workspace inset edge, the progress track, step connectors, the journey ring track.
- **Underline** (`underline`): slate at 40 percent for link underlines at rest; they go to full ink on hover.

### Tertiary (status and feedback)
- **Moss** (`moss`) on **Moss Tint** (`moss-tint`): Done. Also the done segments of the dashboard bar and done steps of the tracker.
- **Deep Navy** on **Navy Tint** (`navy-tint`): In progress.
- **Ochre** (`ochre`) on **Sand** (`sand`): Needs attention. Deliberately an earth tone so it never reads as error.
- **Brick** (`brick`): form errors only. Invalid input borders, the error message and its 20px badge, the error notice edge. **Rose** (`rose`) is its inverted counterpart on navy.

### Accents (decorative, per client type, placeholders until Levi confirms)
- **Burnt Amber** (`burnt-amber`): neurodivergent clients.
- **Deep Teal** (`deep-teal`): health clients, kept away from moss so it never reads as Done.
- Slate Ink doubles as the accent for corporate and team.
The accent paints the journey ring fill, the progress fill, the current step dot and its 25 percent halo, the left edge of result items and the accent panel, the perpetuating zone's inset stroke, and the selected fit pill. As a stroke or fill it needs 3:1 against sky and paper; where white text sits on it (the selected fit pill, a pressed chip) the pair needs 4.5:1, and both are checked by `npm run contrast`.

### Named Rules
**The Four Colour Rule.** Sky, slate, navy and paper do every job on every screen. A new colour is a status, an error or a client accent, and each of those already has a value.

**The Icon and Word Rule.** A status is a pill with a 16px icon and a label. Colour is the third cue, never the only one.

**The Earth Not Red Rule.** Needs attention is ochre on sand. Brick red is reserved for a form that cannot be submitted.

## Typography

**Display Font:** Figtree (with system-ui, -apple-system, Segoe UI, Roboto, sans-serif)
**Body Font:** Figtree (same)
**Label/Mono Font:** none; activation codes use Figtree with tabular numerals and 0.08em tracking

**Character:** One humanist sans at 3 weights, set calm and large. Headings are regular weight, not bold; emphasis comes from size and the 500 weight on UI labels and strong text. Latin Extended is served so te reo Māori macrons render in Figtree.

### Hierarchy
- **Display** (400, 40px/42px, -0.02em): reserved; not used on live screens yet.
- **Title** (400, 28px/32px, -0.01em): `h1` and `.t-title`. The sign in and onboarding headings, the question text in a questionnaire, the stage title on Home ("Book your feedback session").
- **Heading** (400, 22px/28px): `h2` and `.t-heading`. Section headings on every page, the top bar title on desktop.
- **UI Strong** (500, 16px/22px): `h3`, `.t-ui-strong`, field labels, button labels, task names, table headings, the active nav link, client names.
- **Body** (400, 17px/26px): paragraphs, inputs, choice cards. Reading copy is held to 680px (`.reading`), about 70 characters.
- **UI** (400, 16px/22px): nav links, tables, quiet buttons, error messages.
- **Caption** (400, 14px/20px): hints, metadata, status pills, step labels, the sidebar foot, chips and small inputs.
- **Wordmark** (500, 20px/20px): "Executive Frame" beside the mark, set as live text because the lockup SVG cannot carry the font.

### Named Rules
**The Regular Heading Rule.** Headings are weight 400. The only 500 is UI strong: labels, buttons, names. Nothing is ever 600 or 700, and the kit's 300 body is opt in via `data-weight="light"`.

**The Seventeen Rule.** Body copy is 17px on a 26px line everywhere a client reads. Do not drop to 14px to fit more in; cut words instead.

## Layout

Desktop is a fixed viewer: a 248px sidebar and a 64px top bar on sky, with the workspace in the remaining cell, scrolling independently. The workspace is warm paper with a 16px top left radius and a 1px inset hairline, so it reads as a sheet laid on the room rather than a bordered box. Content inside is capped at 1040px (`.workspace-inner`), or 1280px for the practitioner's wide pages, with 32px top, 48px side and 64px bottom padding. Reading copy is further capped at 680px; the questionnaire's focus column at 640px, centred.

Below 900px the sidebar becomes a drawer: fixed, 320px or 86vw, slid in from the left with a 180ms transform, dimming the page behind with navy at 35 percent, opened from a 44px menu button in the top bar. The workspace loses its radius and inset, side padding drops to the 24px phone margin, buttons in an actions row go full width with the primary first, and the top bar title steps down to UI strong. Between 900 and 1199px the 2 column split collapses to 1. Keyboard hints (number keys for answers) hide on phones.

Rhythm comes from an 8 point spacing scale (4, 8, 12, 16, 24, 32, 48, 64) applied through owl selectors: `.stack` puts 16px between siblings, `.stack-lg` 32px. Panels pad 24px. Task rows are a 3 column grid (text, status, action) with a 72px minimum height and 16px vertical padding, collapsing to 2 columns on phones with the button spanning the row. The practitioner's Overview flows panels into 2 CSS columns with a 24px gutter. Home is a 3:2 grid of sky sections with the report tracker spanning both columns.

Single screen pages (sign in, activation, consent, intake) centre a 480px warm paper card on the sky ground with 16px corners and 48px by 32px padding.

## Elevation & Depth

Flat by rule. There are no drop shadows on any surface at rest or on hover. Depth is tonal: paper on sky, sky on paper, navy for the one thing that must come forward. The workspace sheet is lifted from the room by its top left radius and a 1px inset hairline on the top and left edges; panels and the sign in card are lifted only by their change of tone and 16px corners.

The 3 exceptions are functional, not decorative: the drawer's page dimmer (a 100vmax navy spread at 35 percent), the dialog backdrop (navy at 45 percent), and the current tracker step's 4px halo of the accent at 25 percent. Inset strokes of 1 to 2px mark the perpetuating zone and suggested factors.

### Named Rules
**The No Shadow Rule.** Surfaces never cast shadows. If something needs to come forward, change its tone (paper, sky, navy) or give it a hairline.

**The Hairline Rule.** Dividers are 1px of slate at 25 percent, never a full stroke of ink and never a change of background.

## Shapes

Softly rounded, one family. Corners come from a 3 step radius scale plus a pill: 8px for inputs and the skip link, 12px for buttons, nav links, choice cards, notices, factor cards and table wraps, 16px for panels, cards, zones, the journey hero and Home sections, and 999px for status pills, chips, the nav count, sub navigation links and fit choices. Circles are reserved for the avatar, the radio dot, the step dot and the error badge.

Strokes are 2px slate on inputs, choice cards and secondary buttons, so a control is readable as a control at arm's length; the same 2px in brick marks an invalid field. Single sided edges are 3 to 4px bars of the accent or error colour on result items, the accent panel and notices, never rounded on that side. Nothing is clipped, skewed or masked; the only geometry with character is the mark, an incomplete circle with a triangle at its centre, which doubles as the journey ring.

## Components

### Buttons
Solid and easy to hit: tall, full width on phones, 2px strokes, no shadows.
- **Shape:** gently rounded (12px), 52px tall, 24px side padding, UI strong label, 2px transparent border so every variant is the same size.
- **Primary:** deep navy on warm paper text; one per view where possible. Hover goes to slate ink; focus ring is 2px navy offset 2px.
- **Secondary:** warm paper with a 2px slate stroke and slate text; hover goes to pure white.
- **Quiet:** transparent, slate text at weight 400, underlined with the 40 percent underline, 44px tall and 12px side padding; for Clear, Remove, End, Log out.
- **Inline (`.btn-inline`):** width auto from 768px; `.actions` rows set every button to auto width on desktop and full width on phones with the primary first.
- **Disabled:** 55 percent opacity, not allowed cursor.

### Inputs / Fields
- **Style:** warm paper field, 2px slate stroke, 8px corners, 52px tall, 12px by 16px padding, body type. Placeholder is a solid softened slate (`--placeholder`, 4.66:1 on paper); text is never muted with opacity, because the contrast check cannot see it. Selects draw their own navy chevron in a 20px slot on the right. Textareas start at 3 input heights and resize vertically.
- **Label:** UI strong above, with an optional caption hint between label and field.
- **Focus:** 2px slate outline offset 2px (the global ring).
- **Error:** border turns brick; a brick message below in UI type, led by a 20px round brick badge with a white exclamation mark. Focus moves to the first invalid field on paint.
- **Small (`.input-small`, `.select-small`):** 36px tall, caption type, for inline practitioner forms.

### Choice cards
The questionnaire answer and the intake radio: a full width warm paper card with a 2px slate stroke, 12px corners, 52px minimum height, a 22px ring on the left whose navy dot scales in on selection, and a keyboard number in a `kbd` chip on the right (hidden on phones). Selected: sky fill and navy stroke. Focus: the global ring on the whole card.

### Status pills
- **Style:** 28px pill, caption size at weight 500, 16px icon then word, 4px by 12px padding with 8px on the icon side, never wrapping.
- **Done:** moss on moss tint, tick in a filled circle. **In progress:** navy on navy tint, half filled circle. **Needs attention:** ochre on sand, exclamation in a filled circle.

### Chips and fit pills
- **Filter chip:** 32px pill, 1px slate stroke, paper fill, caption type; hover white; `aria-pressed` carries the state.
- **Fit choice** (the client's response to a formulation card): 32px pill, 1px slate stroke; checked fills with the accent and white text.

### Cards / Containers
- **Panel:** 16px corners, 24px padding, warm paper on sky; inside the workspace it flips to sky on paper so it stays visible. `.panel-accent` adds a 4px accent left edge; `.panel-inverted` is navy with paper text.
- **Notice:** 12px corners, 16px padding, a 4px slate left edge (brick for `.notice-error`), paper on sky or sky on paper like the panel.
- **Home section and journey hero:** sky on the paper workspace, 16px corners, 24px padding; the hero pairs a 140px ring with the stage title.
- **Client row (dashboard):** paper, 16px corners, 16px by 24px padding, a 200px who column, the stage column with a 7 segment bar (6px tall, 3px gaps, done segments moss, current segment accent), and the action on the right.
- **Dialog:** paper, 16px corners, 32px padding, navy backdrop at 45 percent.

### Task rows
The list pattern on Home, Questionnaires and every practitioner panel: a hairline above the list and below each row, 72px minimum height, name in UI strong with caption metadata beneath, a status pill, and an action button at touch target height. Empty states are a caption sentence, not an illustration.

### Navigation
- **Sidebar:** on sky, 32px between the brand, the list and the foot. Links are 44px tall with 12px side padding, 12px corners, a 20px line icon and UI type; hover is paper at 55 percent; the current page is paper fill, slate text and weight 500. A count sits at the right as a 24px navy pill. In the questionnaire's focus mode the list keeps full strength (its links still work) and the top bar swaps the account button for Save and exit.
- **Top bar:** 64px, heading type title (ellipsised), menu button on phones, the account button (36px navy avatar disc with the initial, name hidden on phones) on the right.
- **Sub navigation (client record tabs):** 36px pills, 4px by 14px padding; hover paper, current navy with white text and a count pill; a quiet "All clients" link pushed to the right.
- **Tables:** 12px rounded wrap with a hairline border, UI type, 16px cells, sky header row, hairline row dividers, sky at 35 percent on row hover, links in UI strong. Sortable headings are buttons with `aria-sort`.

### Journey ring and trackers (signature)
The mark's incomplete circle is the journey indicator: a hairline track, an accent stroke that fills stage by stage with a 1200ms ease out, and the slate triangle at the centre. It sits at 200px on the full hero and 140px on Home, 152px on phones. Beside it a caption line gives "Step n of 7" and a title in the stage copy. The 5 step report tracker below is a row of 16px dots joined by 2px hairlines: done dots and lines are moss, the current dot is the accent with a 4px 25 percent halo, every label is full strength at caption size, and on a phone the 5 steps run down the page. A 6px progress bar (hairline track, accent fill) tops each questionnaire.

## Do's and Don'ts

### Do:
- **Do** build every surface from the 4 palette colours and the tokens in `public/css/tokens.css`; put anything Client Hub specific in `app.css` or `components.css` and never edit the generated file.
- **Do** keep controls 52px tall with 2px slate strokes and 12px corners, full width on phones, with the primary action first.
- **Do** set client copy at 17px/26px and headings at weight 400; use weight 500 only for labels, buttons and names.
- **Do** show status as a pill with an icon and a word, using moss, navy or ochre on their tints.
- **Do** lift surfaces by tone and hairline: paper on sky, sky on paper, 1px slate at 25 percent.
- **Do** keep the client type accent decorative (ring, progress, current step, left edges, selected fit) at 3:1 or better.
- **Do** honour reduced motion: the mark draws instantly and transitions drop to 0ms.
- **Do** style from classes or script only; the Content Security Policy blocks inline styles and `style=""`.

### Don't:
- **Don't** add box shadows, gradients, textures, illustrations or photography; the only decoration is the mark.
- **Don't** use brick red for anything but a form error, and never colour alone for a status.
- **Don't** introduce a fifth colour, a second typeface, weight 600 or 700, or uppercase labels (the activation code input is the one tracked uppercase exception).
- **Don't** put a second primary button on a view, shrink body text below 17px to fit, or let a client screen need scrolling past 1 clear next action.
- **Don't** round a single sided edge, clip a surface, or mix the 8, 12, 16px radius roles (inputs 8, buttons and cards 12, panels 16, pills 999).
- **Don't** show scores, bold warnings or anything urgent in the client's room; the dashboard's attention rows belong to Sarah.
