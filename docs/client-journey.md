# Client journey

Adapted from the Themescape member journey (Notion: Integration Lab, Themescape, Membership Process, redrawn 12 October 2026). The Client Hub keeps the Themescape sign up, log in and log out pattern and removes the payment and billing steps, because clients pay Sarah through Splose and the hub sells nothing.

| Step | Themescape | Client Hub | System |
|---|---|---|---|
| 1 | Sign up, step 1: your details | Sign up, step 1: your details (name, email) | Firebase Hosting |
| 2 | Do you have an activation code? | Activation code is required. Without one, the page explains the hub is for Sarah's clients and links to the Executive Frame intake | Firebase Hosting |
| 3 | Step 2: create login (Google, Microsoft, email and password of 8 or more) | Same. Accounts are shared with the Learning Hub, so an existing Learning Hub member logs in instead | Firebase Authentication |
| 4 | saveProfile: details and consents, Sydney | saveProfile: details and the consent record with notice version, Sydney | Cloud Functions, Firestore |
| 5 | redeemCode: 12 characters, once, 30 days | redeemActivationCode: 12 characters, once, 30 days, limited attempts. Sets client type, activatedAt and the provisional retention date | Cloud Functions, Firestore |
| 6 | Plans, checkout, subscription | Removed. Replaced by the intake questionnaire and submitIntake | Cloud Functions, Firestore |
| 7 | Checking your membership (logo loader) | Checking your access (mark loader). Not logged in: Log in. Not activated: Activate. Activated: Dashboard | Firebase Hosting |
| 8 | Account: membership status, manage billing | Account: details, privacy notice, request access to or correction of my information, log out | Firebase Hosting, Cloud Functions |
| 9 | Log in, forgot your password, Firebase emails (reset, confirm email) | Same, with emails sent from executiveframe.co.nz | Firebase Authentication |
| 10 | Log out of Themescape? Exit with or without saving | Log out? Answers save as each item is completed, so there is no unsaved state. A tick box clears this browser for shared devices | Firebase Hosting |
| 11 | Sign out ends on Log in; Back stays out | Same | Firebase Hosting |

Sarah's side (stage 5): issue a code for a named client, send it herself, see type and stage, correct a type, assign measures, read the draft, release results.

## During treatment (stage 6)

Once the first results are released and Sarah moves the client to Working together, she can schedule check in questionnaires from the client's page: a questionnaire, how often (every week, every 2 weeks, every 4 weeks, or chosen dates), a first date and an optional last date. Each morning at 7am New Zealand time the hub assigns any check in due that day. The client sees it on Home as a check in with a Start button, in place of the stage's usual action, and a line under their questionnaires says when the next one is coming. Finishing a check in returns the client to Home with a thank you; it does not move their stage or ask them to book. Sarah sees the repeated scores side by side on the client's page and can pause, resume or end the schedule at any time.
