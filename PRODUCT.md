# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: adult clients of Sarah Anticich, a clinical psychologist, seen 1 to 1 during the pilot. Many have ADHD or other executive function difficulties, and many arrive stressed, burnt out or in a hard patch. They use the hub in 2 scenes: short visits on a phone between sessions (finish a questionnaire, see when the next session is, answer a formulation card) and longer sits on a laptop to read their results and formulation. In both scenes the job is to do the 1 thing Sarah has asked of them and know where they stand, without having to hold anything in their head. Low friction outranks everything else: every screen is short, calm and finishable in one go, and warmth and reassurance matter as much as clarity.

Practitioner: Sarah, working at a desk between and around sessions. Her job is to see who needs attention, review draft scoring, release results and the formulation deliberately, and keep each client's record in order.

Admin: Charlotte, who runs the system (codes, library, config) and never sees clinical content.

## Product Purpose

The Executive Frame Client Hub is the in treatment web app for Sarah's clients. It carries the journey from activation code to closure: consent, intake, the questionnaires Sarah assigns (and scheduled check ins later), booking the feedback session in Splose, released results framed as strengths and areas of focus, a 5P formulation the client responds to card by card, next session and resources, and privacy requests. Success for a client is finishing what Sarah asked with no confusion and feeling held between sessions. Success for Sarah is fewer loose ends: everything about a client in 1 place, drafts never leaking, and a dashboard that says who needs her today.

## Positioning

Sarah releases, never software. Automated scoring is only ever a draft for Sarah; nothing clinical reaches a client until she has gone through it with them in a session. A generic patient portal or questionnaire tool shows scores on completion. The hub is also 1 calm place for the whole journey, where a portal shows appointments and a survey tool shows forms.

## Operating Context

- Sarah runs 5 kinds of work, tracked in her Google Sheet "Assessment Trackers - ACC and ADHD" (1 tab per kind, a Key tab of statuses, and Splose and email logs): ADHD assessments (adult, and child or adolescent with a parent), ACC SCU and ACC MICPI assessments (referral, purchase order, report submitted to ACC, hours approved and invoiced), ACC funded therapy (sessions approved and used, reports due), and private therapy (next task, next session, frequency, funding). The hub pilot covers adults seen 1 to 1; children, ACC reporting and invoicing stay in the tracker and Splose.
- The ADHD assessment is a numbered 6 step journey the client already sees in Sarah's Splose emails ("Step 1 of 6" to "Step 6 of 6"): enquiry; referral and intake (Form 1, registration and consent); screening (a $500 invoice, then NovoPsych questionnaires); screening summary (proceed with a $1,600 invoice, or not); booking (the client books online, with Form 2 clinical history, Form 3 developmental history from an observer, and the MHS CAARS 2 questionnaires); assessment, then a 30 minute report feedback appointment; report and next steps (diagnosis or not, GP letter with consent, psychiatrist referral, support options); and a 2 week check in. Splose sends the booking confirmation, a session guide 5 days before and a 24 hour reminder itself; Sarah sends the rest from templates. The ADHD tab already carries Splose ID and Hub stage columns, so the hub is expected to sit inside this process, not replace it.
- Tracker statuses (the Key tab) are Sarah's working vocabulary: Set up, Follow up, Book appointment, Appointment booked, Waiting for psychometrics, Waiting for client to respond, Waiting for feedback, Waiting on others, Write report, Finalise / send, Invoice, In progress, On hold, Completed. Colours there mean urgency (red do now, orange soon, blue underway, green booked, yellow waiting, grey parked); the hub never shows status by colour alone.
- Psychometrics run in NovoPsych (screening bundles) and MHS (CAARS 2, Conners CBRS); a morning task reads their completion emails into the tracker. These commercial instruments are never embedded in the hub (see Capabilities).
- Sessions are booked and billed in Splose, Sarah's practice management system. The hub reads appointment dates, attendance and form status from Splose every 15 minutes and shows them beside the journey stage; it never writes to Splose and never moves the stage on its own.
- Results link to topics in the Executive Frame Learning Hub (app.executiveframe.co.nz), a separate product with separate accounts.
- Emails at key moments (code issued, questionnaire assigned, results released) are planned, from an Executive Frame address.
- The pilot runs with Sarah reviewing the live app; a formal launch list is in CLAUDE.md rule 8.
- Client types (neurodivergent, health, corporate, team) exist in config and change wording and accent colour; the pilot journey is the same for all. Type names are never shown to clients.
- 7 journey stages: Getting started, First session, Questionnaires, Book feedback, Feedback, Working together, Review. Sarah sets the stage; the hub moves it only when the initial questionnaires finish (to Book feedback) and on release (to Feedback).

## Capabilities and Constraints

- Static HTML, CSS and vanilla JavaScript on Firebase Hosting, no framework and no build step; Cloud Functions make every write; Firestore rules allow reads only. Data stays in Sydney (australia-southeast1).
- A strict Content Security Policy: no inline styles, no `style=""`, no third party scripts, no analytics. Widths and colours come from classes or script. Drawings are inline SVG built from classes.
- New Zealand Health Information Privacy Code 2020 applies: consent with a notice version, access and correction requests answered within 20 working days, 10 year retention after the last service, no client data in commits, logs or chat.
- Only questionnaires with a cleared licence go live (31 of 68 so far). Commercial instruments and DSM text are never embedded. Scores are never shown to clients; results are strengths and areas of focus with reasons and Learning Hub links.
- Sign in is email and password only; Google and Microsoft sign in are off until the CSP question is decided.
- UK English. No em dashes, en dashes or hyphens in prose or client facing copy (tests enforce this in config). Digits for numbers. Client facing copy is short, plain and warm; Sarah approves consent, intake and journey wording.
- Terminology: client (never patient, except when naming Splose's record), Sarah (first name throughout), questionnaire (never measure or instrument in client copy), check in, results, formulation, release, journey stage, activation code.
- Undecided: the Learning Hub discount (1 code or 1 per client, and the rate), the email provider, whether Google sign in is allowed, final client type accent colours, and which Splose services map to which stage. The ADHD comms tab names the services (ADHD | Adult Diagnostic Assessment & Report, ADHD | Child & Adolescent Diagnostic Assessment & Report, ADHD | Report Feedback, ADHD | Screening Follow-up, ADHD | Optional Check-in), so the mapping can be filled from names once their Splose ids are read.
- Open question for product truth: the hub's 7 journey stages were designed before the ADHD 6 step process was written down. Whether the hub shows the client Sarah's numbered steps, the 7 stages, or 1 reconciled list is undecided and should be settled with Sarah before client copy is finalised.

## Brand Commitments

Executive Frame, Sarah's practice brand. The interim brand kit from Levi (18 October 2026) is binding as the identity: Figtree (weights 300, 400, 500, Latin and Latin Extended for macrons), navy, slate, sky, warm white, the mark and lockup SVGs in `public/assets/brand/`, tokens generated from `brand/tokens.json` into `public/css/tokens.css` and never edited by hand. Still provisional within the kit: the client type accents, sky and error values. Body text is set at weight 400 for readability, departing from the kit's 300. Status is always shown with an icon and a word, never colour alone; the 3 status colours and their tints are in `docs/brand-notes.md`. Needs attention is kept distinct from the form error colour.

## Evidence on Hand

- Real questionnaires from the EF Client Hub Codebook (`measures/`), with licence status per instrument.
- Sample questionnaires and 5 invented test clients for the harness and live testing; nothing in them is a real person.
- Sarah's own review of the live app is in progress; no client testimonials, usage data or outcomes exist yet and none should be implied.
- Sarah's tracker spreadsheet (Google Sheets, "Assessment Trackers - ACC and ADHD") holds the real processes, statuses and Splose email templates. It also holds client names and records: read its header, Key and comms tabs for process facts, never its client rows, and never copy anything from it into the repo.
- A clickable sample on invented data at `/sample` and static previews at `/preview` (deleted before launch).

## Product Principles

1. Sarah decides what the client sees and when; the hub never pre-empts her.
2. One thing at a time: each client screen has 1 clear next action and can be finished in a single short visit.
3. Warm and plain: copy sounds like Sarah, says what happens next, and never alarms.
4. Nothing by colour alone, nothing clinical in the browser's reach, nothing stored that is not needed.
5. Sarah's screens optimise for scanning: who needs attention today comes first.

## Accessibility & Inclusion

Clients with ADHD and executive function difficulties are the core audience, so attention cost is the main constraint: short pages, saved progress, no unsaved state, 1 question per screen in questionnaires with number keys to answer, and no time pressure. Contrast is checked by `npm run contrast` against WCAG AA for text and 3:1 for accents. Focus moves to the main region or the first invalid field on each page. Te reo Māori macrons render in the brand face.
