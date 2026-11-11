// Runs every Cloud Function handler through the full pilot journey against
// an in memory database: issue a code, redeem it, consent, intake, assign,
// answer, finish, booking, release, formulation, privacy requests, and the
// refusals that protect clients.

import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { makeHandlers } from '../../functions/handlers.js';
import { createMemoryFirestore } from '../support/memory-firestore.js';

const intakeConfig = JSON.parse(readFileSync('public/config/intake.json', 'utf8'));
const clientTypes = JSON.parse(readFileSync('public/config/client-types.json', 'utf8'));
const { measures } = JSON.parse(readFileSync('public/sample/sample-measures.json', 'utf8'));

const sarah = { uid: 'sarah', token: { role: 'practitioner', email: 'sarah@example.com' } };
const admin = { uid: 'charlotte', token: { role: 'admin', email: 'charlotte@example.com' } };
const client = { uid: 'client-1', token: { email: 'alex@example.com', name: 'Alex' } };
const other = { uid: 'client-2', token: { email: 'sam@example.com', name: 'Sam' } };

let db;
let h;
let allowSample;
const as = (auth, data) => ({ auth, data });

async function rejects(promise, code) {
  await assert.rejects(promise, (e) => {
    assert.equal(e.code, code, e.message);
    return true;
  });
}

beforeEach(async () => {
  db = createMemoryFirestore();
  allowSample = true;
  h = makeHandlers({ db, intakeConfig, clientTypes, allowSample: () => allowSample });
  for (const m of measures) await db.doc(`measures/${m.id}`).set(m);
});

async function onboard(auth = client, type = 'neurodivergent') {
  const { code } = await h.issueActivationCode(as(sarah, { forName: auth.token.name, clientTypeOverride: type }));
  await h.redeemActivationCode(as(auth, { code, name: auth.token.name }));
  await h.recordConsent(as(auth, { version: 'test' }));
  await h.submitIntake(as(auth, { answers: { reason: 'health', arranged: 'self' } }));
  return code;
}

describe('activation', () => {
  test('a code works once, stores only its hash, and sets the code type', async () => {
    const { code } = await h.issueActivationCode(as(sarah, { forName: 'Alex', clientTypeOverride: 'neurodivergent' }));
    assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    const stored = db.list('activationCodes');
    assert.equal(stored.length, 1);
    assert.equal(JSON.stringify(stored).includes(code.replace(/-/g, '')), false);
    await h.redeemActivationCode(as(client, { code: code.toLowerCase(), name: 'Alex' }));
    assert.equal(db.read('clients/client-1').codeType, 'neurodivergent');
    await rejects(h.redeemActivationCode(as(other, { code })), 'failed-precondition');
  });
  test('admin can issue codes, clients cannot', async () => {
    await h.issueActivationCode(as(admin, { forName: 'X' }));
    await rejects(h.issueActivationCode(as(client, { forName: 'X' })), 'permission-denied');
  });
  test('an email bound code refuses other addresses', async () => {
    const { code } = await h.issueActivationCode(as(sarah, { forName: 'Alex', email: 'alex@example.com' }));
    await rejects(h.redeemActivationCode(as(other, { code })), 'failed-precondition');
    await h.redeemActivationCode(as(client, { code }));
  });
  test('attempts are limited', async () => {
    for (let i = 0; i < 10; i += 1) await rejects(h.redeemActivationCode(as(client, { code: 'AAAAAAAAAAAA' })), 'failed-precondition');
    await rejects(h.redeemActivationCode(as(client, { code: 'AAAAAAAAAAAA' })), 'resource-exhausted');
  });
  test('intake needs consent first, and the code type outranks the answers', async () => {
    const { code } = await h.issueActivationCode(as(sarah, { forName: 'Alex', clientTypeOverride: 'neurodivergent' }));
    await h.redeemActivationCode(as(client, { code }));
    await rejects(h.submitIntake(as(client, { answers: { reason: 'health', arranged: 'self' } })), 'failed-precondition');
    await h.recordConsent(as(client, { version: 'v1' }));
    await h.submitIntake(as(client, { answers: { reason: 'health', arranged: 'self' } }));
    const c = db.read('clients/client-1');
    assert.equal(c.clientType, 'neurodivergent');
    assert.equal(c.journeyStage, 'assessment');
    assert.ok(c.activatedAt);
  });
});

describe('questionnaires, booking and release', () => {
  test('full journey', async () => {
    await onboard();
    for (const m of measures) await h.assignMeasure(as(sarah, { uid: 'client-1', measureId: m.id }));
    const assignments = db.list('assignments').filter((a) => a.uid === 'client-1');
    assert.equal(assignments.length, 2);

    // Another client cannot answer or finish this client's questionnaire.
    await onboard(other, 'health');
    await rejects(h.saveResponse(as(other, { assignmentId: assignments[0].id, itemId: 'r1', value: 1 })), 'not-found');

    // Answers must be real options; unfinished questionnaires cannot be submitted.
    const first = assignments.find((a) => a.measureId === 'sample-routines');
    await rejects(h.saveResponse(as(client, { assignmentId: first.id, itemId: 'r1', value: 9 })), 'invalid-argument');
    await h.saveResponse(as(client, { assignmentId: first.id, itemId: 'r1', value: 2 }));
    await rejects(h.submitMeasure(as(client, { assignmentId: first.id })), 'failed-precondition');

    let booking = null;
    for (const a of assignments) {
      const m = measures.find((x) => x.id === a.measureId);
      for (const it of m.items) await h.saveResponse(as(client, { assignmentId: a.id, itemId: it.id, value: 3 }));
      ({ booking } = await h.submitMeasure(as(client, { assignmentId: a.id })));
    }
    assert.equal(booking, true);
    assert.equal(db.read('clients/client-1').journeyStage, 'booking');

    // Draft is stored where clients cannot read it; responses leave the assignment.
    const scoring = db.list('scoring').filter((x) => x.uid === 'client-1');
    assert.equal(scoring.length, 2);
    assert.equal(scoring[0].draft.status, 'draft');
    assert.equal(db.read(`assignments/${first.id}`).responses, null);
    assert.equal(db.read('results/client-1'), undefined);

    // Only the practitioner releases.
    await rejects(h.releaseResults(as(client, { uid: 'client-1' })), 'permission-denied');
    await rejects(h.releaseResults(as(admin, { uid: 'client-1' })), 'permission-denied');
    await h.releaseResults(as(sarah, { uid: 'client-1' }));
    const results = db.read('results/client-1');
    assert.ok(results.releasedAt);
    assert.equal(results.items.length, 2);
    assert.equal(JSON.stringify(results).includes('"score"'), false);
    assert.equal(db.read('clients/client-1').journeyStage, 'feedback');
  });

  test('sample questionnaires are refused unless testing is switched on', async () => {
    await onboard();
    allowSample = false;
    await rejects(h.assignMeasure(as(sarah, { uid: 'client-1', measureId: 'sample-routines' })), 'failed-precondition');
  });

  test('practitioner can correct type and stage; clients cannot', async () => {
    await onboard();
    await h.setClientType(as(sarah, { uid: 'client-1', type: 'health' }));
    await h.setStage(as(sarah, { uid: 'client-1', stage: 'intervention' }));
    assert.equal(db.read('clients/client-1').clientType, 'health');
    assert.equal(db.read('intakeResponses/client-1').overriddenBy, 'sarah');
    await rejects(h.setStage(as(client, { uid: 'client-1', stage: 'review' })), 'permission-denied');
    await rejects(h.setStage(as(sarah, { uid: 'client-1', stage: 'nowhere' })), 'invalid-argument');
  });
});

describe('formulation and privacy requests', () => {
  test('formulation is drafted then released', async () => {
    await onboard();
    await rejects(h.releaseFormulation(as(sarah, { uid: 'client-1' })), 'failed-precondition');
    await rejects(h.saveFormulationDraft(as(sarah, { uid: 'client-1', factors: [{ zone: 'elsewhere', text: 'x' }] })), 'invalid-argument');
    await h.saveFormulationDraft(as(sarah, { uid: 'client-1', factors: [{ id: 'a', zone: 'maintaining', text: 'Working late' }], summary: '  A short picture.  ', view: 'flower' }));
    assert.equal(db.read('formulations/client-1'), undefined);
    assert.equal(db.read('formulationDrafts/client-1').view, 'flower');
    assert.equal(db.read('formulationDrafts/client-1').factors[0].zone, 'perpetuating', 'old zone name is mapped');
    await h.releaseFormulation(as(sarah, { uid: 'client-1' }));
    const released = db.read('formulations/client-1');
    assert.equal(released.factors[0].text, 'Working late');
    assert.equal(released.summary, 'A short picture.');
    assert.equal(released.view, 'flower', 'the chosen drawing is released with the factors');
    assert.equal(released.version, 1);
    await h.releaseFormulation(as(sarah, { uid: 'client-1' }));
    assert.equal(db.read('formulations/client-1').version, 2);
  });
  test('the client responds to released factors only', async () => {
    await onboard();
    await rejects(h.respondToFormulation(as(client, { factorId: 'a', fit: 'fits' })), 'failed-precondition');
    await h.saveFormulationDraft(as(sarah, { uid: 'client-1', factors: [{ id: 'a', zone: 'presenting', text: 'Deadlines slip' }, { id: 'b', zone: 'protective', text: 'Supportive manager' }] }));
    await h.releaseFormulation(as(sarah, { uid: 'client-1' }));
    await rejects(h.respondToFormulation(as(client, { factorId: 'zzz', fit: 'fits' })), 'invalid-argument');
    await rejects(h.respondToFormulation(as(client, { factorId: 'a', fit: 'maybe' })), 'invalid-argument');
    await h.respondToFormulation(as(client, { factorId: 'a', fit: 'partly', comment: 'Mostly at month end.' }));
    await h.respondToFormulation(as(client, { factorId: 'b', fit: 'fits' }));
    const r = db.read('formulationResponses/client-1');
    assert.equal(r.responses.a.fit, 'partly');
    assert.equal(r.responses.a.comment, 'Mostly at month end.');
    assert.equal(r.responses.b.fit, 'fits');
    assert.equal(r.responses.b.version, 1);
  });
  test('Sarah sets the next session and pins resources; the client reads them on their record', async () => {
    await onboard();
    await rejects(h.setNextSession(as(sarah, { uid: 'client-1', at: 'soon' })), 'invalid-argument');
    const at = Date.UTC(2026, 10, 3, 1, 0);
    await h.setNextSession(as(sarah, { uid: 'client-1', at, note: 'Online, link by email' }));
    assert.equal(db.read('clients/client-1').nextSessionAt, at);
    await h.setNextSession(as(sarah, { uid: 'client-1', at: null }));
    assert.equal(db.read('clients/client-1').nextSessionAt, null);
    await rejects(h.setResources(as(sarah, { uid: 'client-1', resources: [{ title: 'Bad', url: 'http://insecure.example' }] })), 'invalid-argument');
    await h.setResources(as(sarah, { uid: 'client-1', resources: [{ title: 'Planning', url: 'https://app.executiveframe.co.nz/hub/planning', note: 'Start here' }] }));
    assert.equal(db.read('clients/client-1').resources[0].title, 'Planning');
    await rejects(h.setResources(as(client, { uid: 'client-1', resources: [] })), 'permission-denied');
  });
  test('clients raise access and correction requests with a 20 working day due date', async () => {
    await onboard();
    await h.createRequest(as(client, { kind: 'access' }));
    await rejects(h.createRequest(as(client, { kind: 'correction', detail: '' })), 'invalid-argument');
    const [r] = db.list('requests');
    assert.ok(r.dueBy > r.createdAt + 20 * 86400000);
    await h.closeRequest(as(sarah, { requestId: r.id }));
    assert.equal(db.read(`requests/${r.id}`).status, 'done');
  });
  test('a second request for a copy while 1 is open does not start a second clock', async () => {
    await onboard();
    assert.deepEqual(await h.createRequest(as(client, { kind: 'access' })), { ok: true });
    assert.deepEqual(await h.createRequest(as(client, { kind: 'access' })), { ok: true, already: true });
    assert.equal(db.list('requests').length, 1);
    // A correction is a separate matter and is still accepted.
    await h.createRequest(as(client, { kind: 'correction', detail: 'My name is spelt wrongly.' }));
    assert.equal(db.list('requests').length, 2);
    // Another client's open request does not block this one.
    await onboard(other);
    assert.deepEqual(await h.createRequest(as(other, { kind: 'access' })), { ok: true });
    // Once answered, a new request for a copy can be made.
    const first = db.list('requests').find((r) => r.uid === 'client-1' && r.kind === 'access');
    await h.closeRequest(as(sarah, { requestId: first.id }));
    assert.deepEqual(await h.createRequest(as(client, { kind: 'access' })), { ok: true });
    assert.equal(db.list('requests').filter((r) => r.uid === 'client-1' && r.kind === 'access').length, 2);
  });
  test('every practitioner action is audited', async () => {
    await onboard();
    await h.setStage(as(sarah, { uid: 'client-1', stage: 'review' }));
    assert.ok(db.list('auditLog').some((e) => e.actorUid === 'sarah' && e.action === 'set stage review'));
  });
});

describe('an admin account never learns who the clients are', () => {
  test('the codes list for admin has no name, email or uid', async () => {
    const code = await onboard();
    await h.issueActivationCode(as(sarah, { forName: 'Sam', email: 'sam@example.com' }));
    const { codes } = await h.listActivationCodes(as(admin, {}));
    assert.equal(codes.length, 2);
    for (const c of codes) assert.deepEqual(Object.keys(c).sort(), ['clientTypeOverride', 'expiresAt', 'issuedAt', 'last4', 'redeemedAt', 'used']);
    const text = JSON.stringify(codes);
    for (const secret of ['Alex', 'Sam', 'example.com', 'client-1']) assert.ok(!text.includes(secret), secret);
    assert.equal(codes.filter((c) => c.used).length, 1);
    assert.ok(codes.some((c) => c.last4 === code.replace(/-/g, '').slice(-4)));
  });
  test('clients and signed out callers cannot list codes', async () => {
    await rejects(h.listActivationCodes(as(client, {})), 'permission-denied');
    await rejects(h.listActivationCodes(as(null, {})), 'unauthenticated');
  });
  test('a code issued by admin stores no name or email, whatever is sent', async () => {
    await h.issueActivationCode(as(admin, { forName: 'Alex', email: 'alex@example.com' }));
    const [stored] = db.list('activationCodes');
    assert.equal(stored.forName, 'Issued by admin');
    assert.equal(stored.email, null);
  });
  test('the audit entry for an issued code names the code, not the client', async () => {
    await h.issueActivationCode(as(sarah, { forName: 'Alex' }));
    const entry = db.list('auditLog').find((e) => e.action === 'issued activation code');
    assert.equal(entry.forName, undefined);
    assert.match(entry.last4, /^[A-Z0-9]{4}$/);
    assert.ok(!JSON.stringify(entry).includes('Alex'));
  });
  test('admin still cannot do what only the practitioner can', async () => {
    await onboard();
    await rejects(h.assignMeasure(as(admin, { uid: 'client-1', measureId: measures[0].id })), 'permission-denied');
    await rejects(h.releaseResults(as(admin, { uid: 'client-1' })), 'permission-denied');
  });
});

describe('a client is handed questions, never scoring rules', () => {
  test('myQuestionnaires returns only what is needed to answer', async () => {
    await onboard();
    await h.assignMeasure(as(sarah, { uid: 'client-1', measureId: measures[0].id }));
    const { measures: mine } = await h.myQuestionnaires(as(client, {}));
    const assigned = db.list('assignments').filter((a) => a.uid === 'client-1').map((a) => a.measureId);
    assert.deepEqual(Object.keys(mine).sort(), [...new Set(assigned)].sort());
    for (const m of Object.values(mine)) {
      assert.deepEqual(Object.keys(m).sort(), ['id', 'instructions', 'items', 'name', 'responseOptions']);
      for (const item of m.items) assert.ok(Object.keys(item).every((k) => ['id', 'text', 'responseOptions'].includes(k)));
      const full = db.read(`measures/${m.id}`);
      assert.equal(m.items.length, full.items.length);
      assert.deepEqual(m.items.map((i) => i.text), full.items.map((i) => i.text));
    }
    const text = JSON.stringify(mine);
    for (const word of ['scoringRules', 'subscales', 'bands', 'flagItems', 'reverseItems', 'strengthReason', 'focusReason', 'licence', 'clientFacing', 'upTo']) assert.ok(!text.includes(word), word);
  });
  test('a questionnaire that was not assigned is not handed over', async () => {
    await onboard();
    await db.doc('measures/not-mine').set({ id: 'not-mine', name: 'Other', items: [{ id: 'a', text: 'A' }], responseOptions: [{ value: 0, label: 'No' }], licenceStatus: 'cleared', scoringRules: { subscales: [] } });
    const { measures: mine } = await h.myQuestionnaires(as(client, {}));
    assert.equal(mine['not-mine'], undefined);
  });
  test('1 client is not handed another client\'s questionnaires, and signed out callers get nothing', async () => {
    await onboard();
    await onboard(other, 'health');
    await db.doc('measures/only-other').set({ id: 'only-other', name: 'Other', items: [{ id: 'a', text: 'A' }], responseOptions: [{ value: 0, label: 'No' }], licenceStatus: 'cleared' });
    await h.assignMeasure(as(sarah, { uid: 'client-2', measureId: 'only-other' }));
    assert.equal((await h.myQuestionnaires(as(client, {}))).measures['only-other'], undefined);
    assert.ok((await h.myQuestionnaires(as(other, {}))).measures['only-other']);
    await rejects(h.myQuestionnaires(as(null, {})), 'unauthenticated');
  });
  test('an item with its own answer scale keeps it', async () => {
    await onboard();
    await db.doc('measures/mixed').set({ id: 'mixed', name: 'Mixed', licenceStatus: 'cleared', responseOptions: [{ value: 0, label: 'No' }, { value: 1, label: 'Yes' }], items: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B', responseOptions: [{ value: 1, label: 'Low' }, { value: 5, label: 'High' }], subscale: 'x' }], scoringRules: { subscales: [{ id: 'x', label: 'X', items: ['b'] }] } });
    await h.assignMeasure(as(sarah, { uid: 'client-1', measureId: 'mixed' }));
    const m = (await h.myQuestionnaires(as(client, {}))).measures.mixed;
    assert.deepEqual(m.items[1], { id: 'b', text: 'B', responseOptions: [{ value: 1, label: 'Low' }, { value: 5, label: 'High' }] });
    assert.deepEqual(m.items[0], { id: 'a', text: 'A' });
  });
});

describe('hasClientHub, the signal for the Learning Hub start page', () => {
  test('a client with an open record has a hub, from the moment the code is redeemed', async () => {
    const { code } = await h.issueActivationCode(as(sarah, { forName: 'Alex' }));
    await h.redeemActivationCode(as(client, { code, name: 'Alex' }));
    assert.deepEqual(await h.hasClientHub(as(client, {})), { hasHub: true });
    await onboard(other);
    assert.deepEqual(await h.hasClientHub(as(other, {})), { hasHub: true });
  });
  test('a closed client does not', async () => {
    await onboard();
    await db.doc('clients/client-1').update({ closedAt: Date.now() });
    assert.deepEqual(await h.hasClientHub(as(client, {})), { hasHub: false });
  });
  test('staff do, with or without a client record', async () => {
    assert.deepEqual(await h.hasClientHub(as(sarah, {})), { hasHub: true });
    assert.deepEqual(await h.hasClientHub(as(admin, {})), { hasHub: true });
  });
  test('a login with no record does not, and learns nothing else', async () => {
    await onboard();
    assert.deepEqual(await h.hasClientHub(as(other, {})), { hasHub: false });
  });
  test('a signed out call is refused', async () => {
    await rejects(h.hasClientHub({ data: {} }), 'unauthenticated');
  });
});

describe('check in schedules', () => {
  const measureId = 'sample-routines';
  async function finishOpen(auth = client) {
    const open = db.list('assignments').filter((a) => a.uid === auth.uid && a.status !== 'complete');
    for (const a of open) {
      const m = measures.find((x) => x.id === a.measureId);
      for (const it of m.items) await h.saveResponse(as(auth, { assignmentId: a.id, itemId: it.id, value: 2 }));
      await h.submitMeasure(as(auth, { assignmentId: a.id }));
    }
  }

  test('a schedule assigns on its dates, skips an open copy, and ends', async () => {
    await onboard();
    await h.setStage(as(sarah, { uid: 'client-1', stage: 'intervention' }));
    const future = '2099-01-05';
    await rejects(h.createSchedule(as(client, { uid: 'client-1', measureId, cadence: 'weekly', startsOn: future })), 'permission-denied');
    await rejects(h.createSchedule(as(sarah, { uid: 'client-1', measureId, cadence: 'weekly', startsOn: '2020-01-01' })), 'invalid-argument');
    const { scheduleId } = await h.createSchedule(as(sarah, { uid: 'client-1', measureId, cadence: 'weekly', startsOn: future, endsOn: '2099-01-19' }));
    await rejects(h.createSchedule(as(sarah, { uid: 'client-1', measureId, cadence: 'weekly', startsOn: future })), 'failed-precondition');

    // Not due yet.
    let r = await h.runDueSchedules({ data: { today: '2099-01-04' } });
    assert.deepEqual(r, { today: '2099-01-04', assigned: 0, skipped: 0, ended: 0 });

    // Due: assigned once, stage untouched, audited as the system.
    r = await h.runDueSchedules({ data: { today: future } });
    assert.equal(r.assigned, 1);
    let open = db.list('assignments').filter((a) => a.uid === 'client-1' && a.status !== 'complete');
    assert.equal(open.length, 1);
    assert.equal(open[0].source, 'scheduled');
    assert.equal(open[0].dueOn, future);
    assert.equal(db.read(`schedules/${scheduleId}`).nextDue, '2099-01-12');
    assert.equal(db.read('clients/client-1').journeyStage, 'intervention');
    assert.ok(db.list('auditLog').some((e) => e.actorUid === 'system' && e.action === 'scheduled check in assigned'));

    // Still open a week later: skipped, but the schedule moves on.
    r = await h.runDueSchedules({ data: { today: '2099-01-12' } });
    assert.equal(r.skipped, 1);
    assert.equal(db.list('assignments').filter((a) => a.uid === 'client-1').length, 1);

    // Finishing a check in during treatment does not trigger booking.
    await finishOpen();
    assert.equal(db.read('clients/client-1').journeyStage, 'intervention');

    // Last date: assigned, then the schedule ends itself.
    r = await h.runDueSchedules({ data: { today: '2099-01-19' } });
    assert.equal(r.assigned, 1);
    assert.equal(r.ended, 1);
    assert.equal(db.read(`schedules/${scheduleId}`).status, 'ended');
    r = await h.runDueSchedules({ data: { today: '2099-02-01' } });
    assert.equal(r.assigned + r.skipped, 0);
  });

  test('pause holds a schedule, resume continues it, end stops it', async () => {
    await onboard();
    const { scheduleId } = await h.createSchedule(as(sarah, { uid: 'client-1', measureId, cadence: 'fortnightly', startsOn: '2099-03-01' }));
    await h.updateSchedule(as(sarah, { scheduleId, action: 'pause' }));
    let r = await h.runDueSchedules({ data: { today: '2099-03-01' } });
    assert.equal(r.assigned, 0);
    await h.updateSchedule(as(sarah, { scheduleId, action: 'resume' }));
    assert.equal(db.read(`schedules/${scheduleId}`).nextDue, '2099-03-01');
    await h.runDueSchedules({ data: { today: '2099-03-05' } });
    assert.equal(db.list('assignments').filter((a) => a.uid === 'client-1').length, 1);
    assert.equal(db.read(`schedules/${scheduleId}`).nextDue, '2099-03-15');
    await h.updateSchedule(as(sarah, { scheduleId, action: 'end' }));
    assert.equal(db.read(`schedules/${scheduleId}`).status, 'ended');
    await rejects(h.updateSchedule(as(sarah, { scheduleId, action: 'resume' })), 'failed-precondition');
    await rejects(h.updateSchedule(as(admin, { scheduleId, action: 'pause' })), 'permission-denied');
  });

  test('the journey never moves back: a questionnaire assigned later leaves the stage where it is', async () => {
    await onboard();
    await h.assignMeasure(as(sarah, { uid: 'client-1', measureId }));
    await finishOpen();
    assert.equal(db.read('clients/client-1').journeyStage, 'booking');
    for (const stage of ['booking', 'feedback', 'intervention', 'review']) {
      await h.setStage(as(sarah, { uid: 'client-1', stage }));
      await h.assignMeasure(as(sarah, { uid: 'client-1', measureId }));
      assert.equal(db.read('clients/client-1').journeyStage, stage, `assigned at ${stage}`);
      assert.ok(db.list('assignments').some((a) => a.uid === 'client-1' && a.status === 'notStarted'), 'the questionnaire is there as a task');
      await finishOpen();
      assert.equal(db.read('clients/client-1').journeyStage, stage, `finished at ${stage}`);
    }
  });

  test('the initial assessment still triggers booking', async () => {
    await onboard();
    await h.assignMeasure(as(sarah, { uid: 'client-1', measureId }));
    await finishOpen();
    assert.equal(db.read('clients/client-1').journeyStage, 'booking');
  });
});

describe('codebook questionnaires', () => {
  const { measures: library } = JSON.parse(readFileSync('measures/library.json', 'utf8'));
  test('every questionnaire in the library validates and scores a full set of answers', async () => {
    const { problems } = await import('../../scripts/measures.mjs');
    for (const m of library) assert.deepEqual(problems(m), [], m.id);
  });
  test('a practitioner only questionnaire flags answers for Sarah and is never released to the client', async () => {
    const dass = library.find((m) => m.id === 'dass-21');
    await db.doc('measures/dass-21').set(dass);
    await onboard();
    await h.assignMeasure(as(sarah, { uid: 'client-1', measureId: 'dass-21' }));
    const a = db.list('assignments').find((x) => x.uid === 'client-1');
    for (const it of dass.items) await h.saveResponse(as(client, { assignmentId: a.id, itemId: it.id, value: it.id === 'dass-21-17' ? 3 : 0 }));
    await h.submitMeasure(as(client, { assignmentId: a.id }));
    const scoring = db.read(`scoring/${a.id}`);
    assert.equal(scoring.draft.clientFacing, false);
    assert.equal(scoring.draft.flags.length, 1);
    assert.equal(scoring.draft.flags[0].itemId, 'dass-21-17');
    assert.deepEqual(scoring.draft.strengths, []);
    await rejects(h.releaseResults(as(sarah, { uid: 'client-1' })), 'failed-precondition');
    assert.equal(db.read('results/client-1'), undefined);
  });
  test('Sarah marks flagged answers as followed up; clients and admin cannot, and it is audited', async () => {
    const dass = library.find((m) => m.id === 'dass-21');
    await db.doc('measures/dass-21').set(dass);
    await onboard();
    await h.assignMeasure(as(sarah, { uid: 'client-1', measureId: 'dass-21' }));
    const a = db.list('assignments').find((x) => x.uid === 'client-1' && x.measureId === 'dass-21');
    for (const it of dass.items) await h.saveResponse(as(client, { assignmentId: a.id, itemId: it.id, value: it.id === 'dass-21-17' ? 3 : 0 }));
    await h.submitMeasure(as(client, { assignmentId: a.id }));
    await rejects(h.markFlagsFollowedUp(as(client, { assignmentId: a.id })), 'permission-denied');
    await rejects(h.markFlagsFollowedUp(as(admin, { assignmentId: a.id })), 'permission-denied');
    await rejects(h.markFlagsFollowedUp(as(sarah, { assignmentId: 'missing' })), 'not-found');
    assert.equal(db.read(`scoring/${a.id}`).flagsFollowedUpAt, undefined);
    await h.markFlagsFollowedUp(as(sarah, { assignmentId: a.id }));
    const after = db.read(`scoring/${a.id}`);
    assert.ok(after.flagsFollowedUpAt);
    assert.equal(after.flagsFollowedUpBy, 'sarah');
    assert.equal(after.draft.flags.length, 1, 'the flagged answers stay on the draft');
    assert.deepEqual(await h.markFlagsFollowedUp(as(sarah, { assignmentId: a.id })), { ok: true, already: true });
    assert.equal(db.list('auditLog').filter((e) => e.action === 'followed up flagged answers' && e.targetUid === 'client-1').length, 1);
  });
});
