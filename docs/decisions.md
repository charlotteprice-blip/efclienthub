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

## Open questions

1. Learning Hub access. Does activation grant clients a complimentary Learning Hub seat? Without one, results links reach a paywall. A sign in handover between the 2 subdomains also needs building, because Firebase sessions do not carry across origins.
2. Retention. Is the Client Hub part of Sarah's clinical record, or a working copy summarised into Splose? This sets retentionUntil, which the regulations require to run at least 10 years from the last service.
3. Pilot measures. Will commercial instruments be administered outside the hub? If so, an external assignment type is needed so that booking triggers correctly.
4. Client type. For the pilot, should Sarah set the type when issuing the code, with intake answers recorded but not acted on?
5. Age. Is the pilot limited to adults?
6. App Check. Its reCAPTCHA provider loads a Google script, which conflicts with the no third party scripts rule. Until decided, redeemActivationCode relies on attempt limits.
7. Accent colours for neurodivergent and health types, and their relationship to the status colours.
8. Firebase project access. Who else holds Owner or Editor on executiveframe-app?
9. Google and Microsoft sign in. Firebase Authentication loads `https://apis.google.com/js/api.js` into the page for the sign in window. The current Content Security Policy blocks it, so only email and password sign in would work. Options: allow that 1 Google script on the log in and sign up pages only (Google already processes the sign in), or offer email and password only in the Client Hub. Learning Hub members who signed up with Google would need the first option. To decide before stage 3.
10. Intake wording and rules are drafts for Sarah to approve.
