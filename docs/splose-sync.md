# Splose progress tracking: proposal

Drafted 1 November 2026 for Charlotte and Sarah to review, and built the same day (decision 59; the record and its rules are in data-model.md). Part 1 is the proposal in plain terms. Part 2 is how it is built, for Charlotte. What is live differs from Part 2 in 3 small ways: invoices are not read at all, the client's attendance count is a config switch (`showAttendance`), and the case shows open or closed, track type, appointment count and hours rather than a budget figure.

# Part 1: what it does

## The idea

Sarah books sessions, sends forms and tracks cases in Splose. Clients cannot see any of that; the hub tells them their stage and Sarah types the next session date in by hand. This proposal lets the hub read Sarah's Splose record for each client and show them, without Sarah entering anything twice:

- when their next appointment is
- how many sessions they have had
- whether a Splose form is waiting for them
- that their feedback session is booked once they have finished the questionnaires

Sarah keeps control of the journey stage. Splose only adds detail inside the stage the client is already at.

## What the client sees, stage by stage

The client's Home already shows a 7 step tracker. Each step would gain a line fed from Splose. Copy is draft for Sarah.

| Step | Line under the step |
|---|---|
| Getting started | "Sarah will be in touch to arrange your first session." Once booked: "Your first session is on Tuesday 11 November at 2pm." |
| Your first session | The date until it happens, then "You met Sarah on 11 November." |
| Your questionnaires | Hub questionnaires as now. If Sarah has sent a Splose form: "Sarah has sent you a form in Splose to complete before your next session" with a link. |
| Book your feedback session | "Book with Sarah" link as now. Once booked in Splose: "Your feedback session is on Monday 24 November at 10am." |
| Your feedback session | The date, then "You and Sarah went through your results on 24 November." |
| Working together | "Your next session is on 8 December at 2pm. You have had 4 sessions so far." |
| Review | "Your review session is on 2 February at 2pm." |

Also on Home, a short Your appointments panel: next appointment, sessions attended, and a "Last updated" time so a client never mistakes a stale line for current. Sarah's typed next session note stays and shows beside the Splose date; if Splose has a date the typed date is not shown, so there is 1 source of truth for the date and Sarah's note adds context ("bring your sleep diary").

What the client never sees: fees, invoices, cancellation reasons, Sarah's appointment notes, case budgets, or anything about other clients. Attendance counts and missed sessions are shown only if Sarah wants them (question 4 below).

## What Sarah sees

- On the client's Overview tab: next appointment, last attended, sessions attended, missed and cancelled in the last 6 months, Splose forms and their status, the case if she tracks one, and a Resync now button.
- On the dashboard, new Needs attention rows:
  - Feedback session attended in Splose but the client is still at the booking step (she moves the stage with the existing control).
  - Did not arrive at the last appointment.
  - Splose form still incomplete 7 days after it was sent.
  - Splose link needs attention (the key has stopped working).
- On the client table: a Next appointment column.
- Linking a client to Splose: on the client's page Sarah enters the Splose patient id (from the Splose URL) or picks from a search by name or email. The hub checks the email matches before it links, and records who linked and when.

## What stays with Sarah

1. The stage never moves on its own. Splose shows what has happened; Sarah decides what it means. This keeps decisions 2 and 33.
2. The hub shows dates, statuses and counts only. Nothing clinical comes from Splose, because Splose offers no notes, letters or reports through its API anyway.
3. "Live" means within about 15 minutes. Splose does not push changes, so the hub checks on a timer.
4. Sarah can switch any part off in config: Splose forms, case tracking, invoices, attendance counts.

## To confirm with Sarah

1. Request API access in Splose (account owner only) and generate a key for Charlotte.
2. Which Splose services are the first session, the feedback session, ongoing sessions and the review.
3. Whether any intake or consent forms live in Splose, or all in the hub (decision 30 says all questionnaires in the hub; forms may differ).
4. Whether clients should see attendance counts and missed sessions, or the next appointment only.
5. Whether to show case budget used or invoice status. Default off.
6. Whether a Splose signal may ever move the stage automatically. Default no.
7. Approve the client copy above and a line in the consent wording naming Splose as a source.

# Part 2: how it would be built

## What the Splose API offers

Checked on 1 November 2026.

- Read only, per patient: appointments (start, end, service, practitioner, per patient status Arrived, Did not arrive, Cancelled, Completed), patient forms (Incomplete, In progress, Completed, submitted time), screeners, cases (open or closed, appointments used against a budget or hours), invoices and payments.
- No clinical notes, letters, reports or treatment plans.
- No webhooks. The hub polls with `update_gt`.
- 60 calls a minute per key. The key belongs to the account owner.
- Base `https://api.splose.com/v1`, Bearer key plus a User-Agent header, HTTPS only.

## Config

`public/config/app.json` gains:

```json
"splose": {
  "enabled": false,
  "services": {
    "firstSession": [],
    "feedback": [],
    "intervention": [],
    "review": []
  },
  "showForms": true,
  "showAttendance": true,
  "showCase": false,
  "showInvoices": false,
  "lookbackDays": 180,
  "staleAfterMinutes": 120
}
```

`services` holds Splose service ids. Sarah picks them in the stage 9 Settings area from a list the function fetches with `GET /services`, or Charlotte fills them in for the pilot. An appointment whose service is not listed shows as "Session" with no stage meaning.

## Data

New collection `sploseProgress`, 1 document per client, id = uid.

| Field | Type | Notes |
|---|---|---|
| uid | string | |
| patientId | number | copied from `clients.sploseClientId` at link time |
| nextAppointment | object or null | `at` (ms), `service` (name), `stage` (mapped stage or null) |
| lastAttended | object or null | same shape, most recent Arrived or Completed |
| attended | number | Arrived or Completed within `lookbackDays` |
| missed | number | Did not arrive within `lookbackDays` |
| cancelled | number | Cancelled within `lookbackDays` |
| feedbackBookedAt | ms or null | first feedback service appointment after `bookingTriggeredAt` |
| forms | array | `title`, `status`, `submittedAt` per Splose patient form, titles only |
| case | object or null | `isOpen`, `appointmentCount`, budget type and used, only when `showCase` |
| invoicesOutstanding | number or null | count only, only when `showInvoices` |
| syncedAt | ms | |
| error | string or null | last failure, cleared on success |

Rules: client reads own, practitioner reads all, admin none, no browser writes. `tests/rules.test.js` gains the 3 cases.

`clients` gains `sploseSyncedAt` so the sync can pick the oldest first without a join. `sploseClientId` already exists. `linkSplosePatient` (uid, patientId) validates with `GET /patients/{id}`, refuses an email mismatch unless Sarah confirms, writes the id and an audit entry. Unlinking clears the id and deletes the progress document.

## Function

`syncSplose`, `onSchedule` every 15 minutes 7am to 9pm Pacific/Auckland, hourly overnight. Key from `defineSecret('SPLOSE_API_KEY')`, set with `firebase functions:secrets:set`, never in `.env` or git.

Each run:

1. Query `clients` where `sploseClientId` is set and `closedAt` is null, ordered by `sploseSyncedAt` oldest first, at most 15.
2. Per client: `GET /appointments?patientId=&start_gt=<now minus lookbackDays>`, `GET /patient-forms?patientId=`, plus `GET /cases?patientId=` when `showCase` and invoices when `showInvoices`. Follow `links.nextPage`.
3. Build the progress document and write it with `syncedAt`; write `sploseSyncedAt` on the client.
4. Stop the run at 50 calls and leave the rest for next time, so the limit is never hit.

`syncSploseClient` runs the same logic for 1 client from the Resync now button, once a minute per client at most.

Failure handling:

- 429: wait and retry once, then stop the run.
- 401 or 403: write `error` on every client touched, log at error level, show "Splose link needs attention" on the dashboard.
- Any other error on 1 client: record it on that client, continue.
- A record older than `staleAfterMinutes` shows its "Last updated" time prominently.

Cost: 15 clients, 3 calls each, 60 runs a day is under 3,000 calls a day, inside the limit and the free function tier.

## Privacy

- Health Information Privacy Code 2020. Appointment dates and attendance add no new class of information to a hub that already holds clinical content, but the consent copy names Splose as a source. Bump `consentVersion`; existing clients see the updated consent at next sign in.
- Data stays in the `clienthub` database in Sydney. Splose serves from Australia.
- The audit log records "synced" with a count only. No client data in logs (rule 6).
- Closing a client stops the sync; the progress document is kept until `retentionUntil` like everything else.

## Build order

1. Sarah requests API access and generates a key. Charlotte stores it as a secret.
2. `linkSplosePatient`, `sploseProgress` rules, tests.
3. `syncSplose` against fixtures of the 3 responses in `tests/`, run in the harness with a stub Splose route in `scripts/serve.mjs`.
4. Client Home lines and panel, Overview tab, copy to Sarah.
5. Dashboard attention rows and the Next appointment column.
6. Enable for Charlotte's own test record first, then Sarah's pilot clients.

Tests: status to count mapping, feedback detection after `bookingTriggeredAt`, stale marking, call budget per run, rules for the 3 roles, contrast on the new panel. Fixture data is made up, never a real patient.
