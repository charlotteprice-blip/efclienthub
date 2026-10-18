// Puts 5 fake clients into the live hub for testing, at different points of
// the journey, using the real Cloud Function logic against the real database
// so every record has exactly the shape the app expects. Removes them again.
//
//   npm run seed:test              create (or top up) the 5 test clients
//   npm run seed:test -- remove    delete them and everything they own
//
// All 5 log in with the password printed at the end. Emails end in
// @example.com, names end in "Test", and nothing here is a real person.
// Needs application default credentials for an owner of the project
// (gcloud auth application-default login) and ALLOW_SAMPLE_MEASURES is not
// required: only cleared questionnaires are assigned.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { makeHandlers } from '../functions/handlers.js';

const root = join(dirname(new URL(import.meta.url).pathname), '..');
const PROJECT = process.env.CLIENTHUB_PROJECT ?? 'ef-client-hub';
const PRACTITIONER_EMAIL = process.env.CLIENTHUB_PRACTITIONER ?? 'hello@charlotteprice.co.nz';
const PASSWORD = 'TestClient-2026';
const command = process.argv[2] ?? 'create';

const PEOPLE = [
  { email: 'aroha.test@example.com', name: 'Aroha Test', type: 'neurodivergent', plan: 'signedUp' },
  { email: 'ben.test@example.com', name: 'Ben Test', type: 'neurodivergent', plan: 'inProgress' },
  { email: 'chloe.test@example.com', name: 'Chloe Test', type: 'health', plan: 'readyForReview' },
  { email: 'dev.test@example.com', name: 'Dev Test', type: 'corporate', plan: 'inTreatment' },
  { email: 'ella.test@example.com', name: 'Ella Test', type: 'neurodivergent', plan: 'review' },
];

export const PASSWORD_FOR_TESTS = PASSWORD;
export const TEST_PEOPLE = PEOPLE;

const as = (user, data) => ({ auth: user, data });
const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
// Deterministic answer per item so reruns look the same: spreads across the
// scale with a lean towards the middle.
function answerFor(measure, item, salt) {
  const options = Array.isArray(item.responseOptions) && item.responseOptions.length ? item.responseOptions : measure.responseOptions;
  const seed = [...`${measure.id}:${item.id}:${salt}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
  const idx = Math.min(options.length - 1, Math.floor(((seed % 100) / 100) * options.length * 0.9));
  return options[idx].value;
}

// Everything below takes { db, auth, h, appConfig, log } so the same code runs
// against the real project and, in tests, against the in memory database.
export async function create({ db, auth, h, appConfig, practitionerEmail = PRACTITIONER_EMAIL, log = console.log }) {
  async function userFor(p) {
    try {
      return await auth.getUserByEmail(p.email);
    } catch {
      return auth.createUser({ email: p.email, password: PASSWORD, displayName: p.name, emailVerified: true });
    }
  }
  async function assignmentsOf(uid) {
    const snap = await db.collection('assignments').where('uid', '==', uid).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.order - b.order);
  }
  async function complete(user, a, salt) {
    const measure = (await db.doc(`measures/${a.measureId}`).get()).data();
    for (const item of measure.items) await h.saveResponse(as(user, { assignmentId: a.id, itemId: item.id, value: answerFor(measure, item, salt) }));
    await h.submitMeasure(as(user, { assignmentId: a.id }));
  }
  const console = { log };
  const practitionerUser = await auth.getUserByEmail(practitionerEmail);
  const sarah = { uid: practitionerUser.uid, token: { role: 'practitioner', email: practitionerEmail, name: practitionerUser.displayName ?? 'Practitioner' } };
  for (const p of PEOPLE) {
    const user = await userFor(p);
    const me = { uid: user.uid, token: { email: p.email, name: p.name } };
    const existing = (await db.doc(`clients/${user.uid}`).get()).data();
    if (existing?.codeHash) {
      console.log(`${p.name}: already in the hub, left as is`);
      continue;
    }
    const { code } = await h.issueActivationCode(as(sarah, { forName: p.name, clientTypeOverride: p.type }));
    await h.redeemActivationCode(as(me, { code, name: p.name }));
    if (p.plan === 'signedUp') {
      console.log(`${p.name}: signed up, has not finished setting up`);
      continue;
    }
    await h.recordConsent(as(me, { version: appConfig.consentVersion }));
    await h.submitIntake(as(me, { answers: { reason: p.type === 'health' ? 'health' : p.type === 'corporate' ? 'workplace' : 'focus', arranged: p.type === 'corporate' ? 'workplace' : 'self', previousAssessment: 'no', hope: 'To feel more on top of things at work and at home.' } }));
    const list = await assignmentsOf(user.uid);
    if (p.plan === 'inProgress') {
      const first = list[0];
      const measure = (await db.doc(`measures/${first.measureId}`).get()).data();
      for (const item of measure.items.slice(0, 3)) await h.saveResponse(as(me, { assignmentId: first.id, itemId: item.id, value: answerFor(measure, item, 'b') }));
      console.log(`${p.name}: questionnaires stage, 1 questionnaire part way through`);
      continue;
    }
    for (const a of list) await complete(me, a, p.name);
    if (p.plan === 'readyForReview') {
      await h.setNextSession(as(sarah, { uid: user.uid, at: new Date(`${day(5)}T14:00:00+13:00`).getTime(), note: 'Feedback session, online. The link is in your email.' }));
      console.log(`${p.name}: every questionnaire finished, drafts waiting for review, next session set`);
      continue;
    }
    await h.releaseResults(as(sarah, { uid: user.uid }));
    const released = (await db.doc(`results/${user.uid}`).get()).data();
    const suggestion = released.items.flatMap((i) => (i.focus ?? []).map((f) => ({ zone: 'perpetuating', text: f.label, source: { assignmentId: i.assignmentId, measureName: i.measureName, subscaleId: f.subscaleId, kind: 'focus' } })))[0];
    const factors = [
      { id: 'f1', zone: 'presenting', text: 'Deadlines slipping and evenings spent catching up' },
      { id: 'f2', zone: 'predisposing', text: 'Long standing difficulty with planning and sequencing' },
      { id: 'f3', zone: 'precipitating', text: 'New role with less structure' },
      ...(suggestion ? [{ id: 'f4', ...suggestion }] : []),
      { id: 'f5', zone: 'perpetuating', text: 'Late nights, then a slow start the next day' },
      { id: 'f6', zone: 'protective', text: 'A supportive manager and a clear reason to change' },
    ];
    await h.saveFormulationDraft(as(sarah, { uid: user.uid, factors, summary: 'You came to work on getting started on tasks and keeping to deadlines. The pattern seems to be kept going by late nights and by leaving the hardest job until last. You have a manager who backs you and a clear picture of what you want to be different, which is a strong place to start from.' }));
    await h.releaseFormulation(as(sarah, { uid: user.uid }));
    await h.respondToFormulation(as(me, { factorId: 'f5', fit: 'partly', comment: 'Mostly at the end of the month.' }));
    await h.setResources(as(sarah, { uid: user.uid, resources: [
      { id: 'r1', title: 'Planning and prioritising', url: `${appConfig.learningHubUrl}/hub/planning`, note: 'Start with the first 2 pages before our next session.' },
      { id: 'r2', title: 'Getting started', url: `${appConfig.learningHubUrl}/hub/starting`, note: '' },
    ] }));
    if (p.plan === 'inTreatment') {
      await h.setStage(as(sarah, { uid: user.uid, stage: 'intervention' }));
      const checkIn = list.find((a) => a.measureId === 'pps') ?? list[list.length - 1];
      await h.createSchedule(as(sarah, { uid: user.uid, measureId: checkIn.measureId, cadence: 'fortnightly', startsOn: day(3), endsOn: '' }));
      await h.setNextSession(as(sarah, { uid: user.uid, at: new Date(`${day(8)}T10:00:00+13:00`).getTime(), note: 'In person at the clinic.' }));
      console.log(`${p.name}: working together, results and formulation shared, fortnightly check in, next session set`);
    } else {
      await h.setStage(as(sarah, { uid: user.uid, stage: 'review' }));
      await h.createRequest(as(me, { kind: 'access' }));
      console.log(`${p.name}: review stage, results and formulation shared, 1 open access request`);
    }
  }
  console.log(`\nTest clients log in at /login with their email (listed above, all @example.com) and the password ${PASSWORD}.`);
  console.log('Remove them with: npm run seed:test -- remove\n');
}

export async function remove({ db, auth, log = console.log }) {
  const console = { log };
  for (const p of PEOPLE) {
    let user;
    try {
      user = await auth.getUserByEmail(p.email);
    } catch {
      console.log(`${p.name}: no account`);
      continue;
    }
    const uid = user.uid;
    const batch = db.batch();
    for (const col of ['clients', 'intakeResponses', 'results', 'formulations', 'formulationDrafts', 'formulationResponses', 'rateLimits']) batch.delete(db.doc(`${col}/${uid}`));
    for (const col of ['assignments', 'scoring', 'requests', 'schedules']) {
      const snap = await db.collection(col).where('uid', '==', uid).get();
      for (const d of snap.docs) batch.delete(d.ref);
    }
    const codes = await db.collection('activationCodes').where('redeemedByUid', '==', uid).get();
    for (const d of codes.docs) batch.delete(d.ref);
    await batch.commit();
    await auth.deleteUser(uid);
    console.log(`${p.name}: removed`);
  }
  for (const p of PEOPLE) {
    const unused = await db.collection('activationCodes').where('forName', '==', p.name).get();
    for (const d of unused.docs) if (!d.data().redeemedByUid) await d.ref.delete();
  }
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT });
  const auth = getAuth(app);
  const db = getFirestore(app, 'clienthub');
  const appConfig = JSON.parse(readFileSync(join(root, 'public/config/app.json'), 'utf8'));
  const intakeConfig = JSON.parse(readFileSync(join(root, 'public/config/intake.json'), 'utf8'));
  const clientTypes = JSON.parse(readFileSync(join(root, 'public/config/client-types.json'), 'utf8'));
  const h = makeHandlers({ db, intakeConfig, clientTypes, allowSample: () => false });
  try {
    if (command === 'remove') await remove({ db, auth });
    else if (command === 'create') await create({ db, auth, h, appConfig });
    else {
      console.error('Usage: npm run seed:test   or   npm run seed:test -- remove');
      process.exit(1);
    }
  } catch (e) {
    console.error(`\n${e.message}\n`);
    process.exit(1);
  }
}
