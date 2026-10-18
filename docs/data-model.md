# Data model

Named Firestore database `clienthub` in project `ef-client-hub`, location australia-southeast1. Every write is made by a Cloud Function through the Admin SDK. The read column below is enforced by `firestore.rules` and proved by `tests/rules.test.js`.

Roles are custom claims set with the Admin SDK: `role: "practitioner"` reads clinical content; `role: "admin"` operates the system without reading clinical content. A client has no role claim.

| Collection | Document id | Fields | Client reads | Practitioner | Admin |
|---|---|---|---|---|---|
| `clients` | uid | uid, name, email, clientType, journeyStage, activatedAt, consentAt, consentVersion, sploseClientId, retentionUntil, closedAt | own | all | none |
| `intakeResponses` | uid | uid, answers, derivedType, overriddenBy, submittedAt | own | all | none |
| `assignments` | generated | uid, measureId, status, order, assignedAt, completedAt, responses (only while in progress) | own (query must filter on uid) | all | none |
| `scoring` | assignment id | uid, assignmentId, measureId, responses, scores, scoredAt, reportDraft | never | all | none |
| `results` | uid | uid, releasedAt, releasedBy, items (strengths, areas of focus, reasons, Learning Hub topic links) | own, only once releasedAt is set | all | none |
| `formulationDrafts` | uid | uid, factors, updatedAt | never | all | none |
| `formulations` | uid | uid, factors, releasedAt, releasedBy | own, only once releasedAt is set | all | none |
| `requests` | generated | uid, kind (access or correction), detail, createdAt, dueBy, status | own | all | none |
| `activationCodes` | SHA 256 of code | forName, email (optional binding), clientTypeOverride, last4, issuedBy, issuedAt, expiresAt, redeemedByUid, redeemedAt | never | all | all |
| `rateLimits` | uid | windowStart, count (code attempts) | never | never | never |
| `measures` | measure id | id, name, items, responseOptions, scoringRules, topicMap, licenceStatus | activated clients | all | all |
| `config` | e.g. `intake` | editable questionnaire and copy | any signed in user | all | all |
| `auditLog` | generated | actorUid, action, targetUid, at | never | all | all |

## Departures from the brief

The brief placed `responses`, `scores` and `reportDraft` on the assignment, and factors beside `releasedAt` on the formulation. Firestore rules grant or refuse whole documents, so a client able to read their assignment could read their draft scores from a browser console. Drafts therefore sit in `scoring` and `formulationDrafts`, which no client can read, and `releaseResults` copies the released content into `results` and `formulations`.

Results are held in 1 document per client, read by id, so the client page needs no query and the rule can test `releasedAt` directly.

`requests`, `config`, `auditLog` and `consentVersion` are additions supporting the Health Information Privacy Code 2020 obligations and Sarah's ability to edit the intake without code.

Storage is closed to all browsers. Any later file is delivered through a function that checks release and issues a short lived signed link.

## Answers in progress

While a client works through a questionnaire, each answer is saved on their assignment so they can stop and resume. When they finish, submitMeasure copies the answers into `scoring` with the draft and clears them from the assignment, so a finished questionnaire's answers are visible only to Sarah.
