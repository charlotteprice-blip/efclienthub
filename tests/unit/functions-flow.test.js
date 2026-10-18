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
    await h.saveFormulationDraft(as(sarah, { uid: 'client-1', factors: [{ id: 'a', zone: 'maintaining', text: 'Working late' }] }));
    assert.equal(db.read('formulations/client-1'), undefined);
    await h.releaseFormulation(as(sarah, { uid: 'client-1' }));
    assert.equal(db.read('formulations/client-1').factors[0].text, 'Working late');
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
  test('every practitioner action is audited', async () => {
    await onboard();
    await h.setStage(as(sarah, { uid: 'client-1', stage: 'review' }));
    assert.ok(db.list('auditLog').some((e) => e.actorUid === 'sarah' && e.action === 'set stage review'));
  });
});
