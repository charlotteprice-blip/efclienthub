# Decisions and open questions

## Decided in stage 1 (18 October 2026)

1. Release gate. Drafts live in practitioner only collections and released content is copied out on release. Reason: rules cannot hide fields. See data-model.md.
2. Practitioner and admin roles are separate. Sarah holds `practitioner`. Charlotte holds `admin` on her own account and uses a separate test account for practitioner flows, unless Sarah decides otherwise. Reason: minimum necessary access to health information.
3. Isolation inside the shared Firebase project. Functions deploy under codebase `clienthub`, Firestore rules deploy only to the `clienthub` database, and Storage rules deploy only to the `clienthub` bucket target. Reason: a Learning Hub deployment must not delete or overwrite anything here.
4. Membership process mirrors Themescape: sign up before redemption, codes of 12 characters, single use, valid 30 days. See client-journey.md.
5. No third party scripts. The Firebase SDK and Figtree will be stored in `public/assets/vendor` and `public/assets/fonts`. A Content Security Policy in firebase.json enforces this.
6. Repository is `charlotteprice-blip/efclienthub` rather than the `executive-frame-client-hub` named in the brief.

## Open questions

1. Learning Hub access. Does activation grant clients a complimentary Learning Hub seat? Without one, results links reach a paywall. A sign in handover between the 2 subdomains also needs building, because Firebase sessions do not carry across origins.
2. Retention. Is the Client Hub part of Sarah's clinical record, or a working copy summarised into Splose? This sets retentionUntil, which the regulations require to run at least 10 years from the last service.
3. Pilot measures. Will commercial instruments be administered outside the hub? If so, an external assignment type is needed so that booking triggers correctly.
4. Client type. For the pilot, should Sarah set the type when issuing the code, with intake answers recorded but not acted on?
5. Age. Is the pilot limited to adults?
6. App Check. Its reCAPTCHA provider loads a Google script, which conflicts with the no third party scripts rule. Until decided, redeemActivationCode relies on attempt limits.
7. Accent colours for neurodivergent and health types, and their relationship to the status colours.
8. Firebase project access. Who else holds Owner or Editor on executiveframe-app?
