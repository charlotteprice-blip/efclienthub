# Functionality plan

Agreed with Charlotte on 18 October 2026, subject to Sarah's confirmation where marked. The pilot build (stages 1 to 5) is live. This plan covers what comes next, in the order it should be built.

## Decisions that shape the plan

1. Pilot clients are adults Sarah sees 1 to 1. Workplace, team and under 18 journeys are out of scope; the client type config stays but no journey differs yet.
2. Sarah chooses when each client sees results. The release button stays; nothing releases automatically.
3. Between sessions the hub carries check in questionnaires on a schedule Sarah sets per client, and Sarah's formulation drafts. The formulation is 5P with a written summary; factors can be drawn from released results; the client sees only the latest released formulation and responds to each card (fits, partly, does not fit, comment), which Sarah reads on the client's record. Built 18 October 2026.
4. Booking is a link to Splose. The hub records that the client reached the booking step and nothing more.
5. All questionnaires run in the hub as JSON Charlotte or Sarah loads. No external marker is needed.
6. At completion the client's account becomes read only. Sarah closes it later; closure sets a retention date 10 years from the last service, since the hub is part of the clinical record. Nothing is deleted before that date.
7. Sarah gets a dashboard: who needs attention, check ins due this week, counts by stage.
8. Sign in stays email and password. The no third party script rule holds.
9. Activation includes Learning Hub access at a discounted rate, delivered as a discount code shown in the hub. To confirm with Sarah: the rate, and whether 1 shared code or 1 per client.
10. The hub sends email at key moments only: code issued, questionnaire assigned (including scheduled check ins), results released, formulation released, request answered. Sender is an Executive Frame address; DNS records for sending will be needed.
11. Sarah can edit the intake questions and wording, the journey copy per client type, and the questionnaire library herself, from the hub.

## Stage 6: check in schedules (built 18 October 2026)

Sarah sets a schedule on a client's page: a questionnaire, an interval (weekly, fortnightly, every 4 weeks) or a list of dates, and a start date. A scheduled Cloud Function runs each morning (Pacific/Auckland), creates the assignment when a date arrives, moves the client back to the assessment stage if they were past it, and sends the assignment email. Sarah can pause or end a schedule. The client's Home shows the next check in and its date.

Data: `schedules/{id}` with uid, measureId, cadence, nextDue, endsAt, pausedAt. Assignments gain `source: scheduled`. Results from repeated questionnaires are kept per assignment so Sarah can see change over time on the client page (a simple table of subscale scores by date; no chart until Sarah asks).

## Stage 7: email

Transactional email through an email API called from Cloud Functions, never from the browser, with the sender on an Executive Frame address. Templates in UK English, plain text and simple HTML, no tracking pixels. Each email names the event and links to the hub; none contains results or clinical content. Delivery failures are logged, not retried indefinitely. Provider to confirm with Charlotte (Postmark or Resend fit the no tracking requirement); DNS records for SPF and DKIM go in the Site Changes Log.

## Stage 8: Sarah's dashboard

A Dashboard page as the practitioner landing page: counts by stage; a Needs attention list (code issued but not redeemed after 7 days, intake not completed after 3 days, questionnaire assigned but not started after 7 days, privacy request due within 5 working days); and Check ins due this week. Each row links to the client page. Thresholds live in config so Sarah can adjust them.

## Stage 9: Sarah edits config in the hub

An Settings area for the practitioner role with 3 editors: intake questions (text, hint, options, on or off, and the type rules), journey copy per client type, and questionnaire upload with the same validation as `npm run measures -- check`. Edits write to `config/*` and `measures/*` in Firestore through functions; the JSON files in the repo become the defaults for a fresh project. Every edit is audited and the previous version kept, so a mistake can be reverted.

## Stage 10: completion and closure

Sarah marks a client complete: the stage becomes complete, the client sees a closing message, and the account is read only (no new questionnaires, no requests beyond access and correction). Later Sarah closes the account: `closedAt` and `retentionUntil` (10 years from the last service) are set, sign in is disabled, and the record stays for the retention period. A yearly report lists records past retention for Sarah to decide on. The client can ask for an export at any time; the export is a PDF of released results and formulation, produced by a function and delivered as a short lived link.

## Stage 11: Learning Hub discount

A discount code field in config, shown on the Results page beside the Learning Hub links and on the Account page, with a line explaining it. If Sarah wants 1 code per client, codes are generated at activation and recorded on the client. The Learning Hub side (honouring the code) is a Learning Hub change.

## Already decided and unchanged

Release gate, hashed activation codes, audit log, 20 working day privacy requests, no analytics, self hosted assets, desktop viewer layout.

## Before stage 6 starts

1. Sarah confirms decisions 9, 10 and 11 and the thresholds in stage 8.
2. Real questionnaires loaded with cleared licences; `ALLOW_SAMPLE_MEASURES=false`.
3. DNS for clients.executiveframe.co.nz and the Splose booking link in `app.json`.
