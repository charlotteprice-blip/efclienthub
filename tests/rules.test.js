// Security rules tests for the Executive Frame Client Hub.
//
// Run with:  npm run test:rules
// This starts the Firestore and Storage emulators with firebase.test.json
// and runs this file with the Node test runner. Requires Java 21 or later.
//
// The emulator applies the same firestore.rules file that firebase.json
// deploys to the named database `clienthub`. The rules are written against
// `/databases/{database}/documents`, so testing them on the emulator's
// default database exercises identical logic.
//
// Fixtures use invented identifiers only. No client data or sample health
// information appears in this file.

import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';

const PROJECT_ID = 'demo-clienthub';

const CLIENT_A = 'client-a';
const CLIENT_B = 'client-b';
const NOT_ACTIVATED = 'client-not-activated';
const PRACTITIONER = 'practitioner-1';
const ADMIN = 'admin-1';

let env;

const as = {
  anon: () => env.unauthenticatedContext().firestore(),
  user: (uid) => env.authenticatedContext(uid).firestore(),
  practitioner: () => env.authenticatedContext(PRACTITIONER, { role: 'practitioner' }).firestore(),
  admin: () => env.authenticatedContext(ADMIN, { role: 'admin' }).firestore(),
  // A client who tries to grant themselves a role claim cannot: claims are
  // signed by Firebase Auth and set only through the Admin SDK. This
  // context simulates an unrecognised claim value to confirm it confers
  // nothing.
  spoofed: (uid) => env.authenticatedContext(uid, { role: 'client' }).firestore(),
};

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const ts = new Date('2026-10-18T00:00:00Z');

    for (const uid of [CLIENT_A, CLIENT_B]) {
      await db.doc(`clients/${uid}`).set({
        uid,
        clientType: 'neurodivergent',
        journeyStage: 'assessment',
        activatedAt: ts,
        consentAt: ts,
        consentVersion: 'test-1',
        retentionUntil: null,
      });
      await db.doc(`intakeResponses/${uid}`).set({ uid, answers: { q1: 'x' } });
      await db.doc(`assignments/${uid}-m1`).set({
        uid,
        measureId: 'sample-measure',
        status: 'complete',
        order: 1,
      });
      await db.doc(`scoring/${uid}-m1`).set({
        uid,
        assignmentId: `${uid}-m1`,
        responses: { i1: 2 },
        scores: { total: 2 },
        reportDraft: 'draft text',
      });
      await db.doc(`formulationDrafts/${uid}`).set({ uid, factors: [] });
      await db.doc(`requests/${uid}-r1`).set({ uid, kind: 'access', createdAt: ts });
      await db.doc(`schedules/${uid}-s1`).set({ uid, measureId: 'sample-measure', cadence: 'weekly', nextDue: '2099-01-05', status: 'active' });
    }

    await db.doc(`clients/${NOT_ACTIVATED}`).set({
      uid: NOT_ACTIVATED,
      activatedAt: null,
    });

    // Client A has released results and formulation; client B does not.
    await db.doc(`results/${CLIENT_A}`).set({ uid: CLIENT_A, releasedAt: ts, items: {} });
    await db.doc(`results/${CLIENT_B}`).set({ uid: CLIENT_B, releasedAt: null, items: {} });
    await db.doc(`formulations/${CLIENT_A}`).set({ uid: CLIENT_A, releasedAt: ts, factors: [] });
    await db.doc(`formulationResponses/${CLIENT_A}`).set({ uid: CLIENT_A, responses: {} });
    await db.doc(`formulations/${CLIENT_B}`).set({ uid: CLIENT_B, releasedAt: null, factors: [] });

    await db.doc('activationCodes/hash-1').set({ clientTypeOverride: 'neurodivergent' });
    await db.doc('measures/sample-measure').set({ name: 'Sample', items: [] });
    await db.doc('config/intake').set({ version: 1 });
    await db.doc('auditLog/e1').set({ action: 'release', at: ts });
    await db.doc('somethingElse/x').set({ a: 1 });
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

after(async () => {
  await env.cleanup();
});

describe('signed out', () => {
  const paths = [
    `clients/${CLIENT_A}`,
    `assignments/${CLIENT_A}-m1`,
    `results/${CLIENT_A}`,
    'measures/sample-measure',
    'config/intake',
  ];
  for (const path of paths) {
    test(`cannot read ${path}`, async () => {
      await assertFails(as.anon().doc(path).get());
    });
  }
});

describe('a client reads only their own records', () => {
  test('reads own client record', async () => {
    await assertSucceeds(as.user(CLIENT_A).doc(`clients/${CLIENT_A}`).get());
  });
  test("cannot read another client's record", async () => {
    await assertFails(as.user(CLIENT_A).doc(`clients/${CLIENT_B}`).get());
  });
  test('cannot list all client records', async () => {
    await assertFails(as.user(CLIENT_A).collection('clients').get());
  });
  test('reads own intake answers, not another client\'s', async () => {
    await assertSucceeds(as.user(CLIENT_A).doc(`intakeResponses/${CLIENT_A}`).get());
    await assertFails(as.user(CLIENT_A).doc(`intakeResponses/${CLIENT_B}`).get());
  });
  test('reads own assignment, not another client\'s', async () => {
    await assertSucceeds(as.user(CLIENT_A).doc(`assignments/${CLIENT_A}-m1`).get());
    await assertFails(as.user(CLIENT_A).doc(`assignments/${CLIENT_B}-m1`).get());
  });
  test('can query assignments filtered to own uid', async () => {
    const db = as.user(CLIENT_A);
    await assertSucceeds(db.collection('assignments').where('uid', '==', CLIENT_A).get());
  });
  test('cannot query assignments without the uid filter', async () => {
    await assertFails(as.user(CLIENT_A).collection('assignments').get());
  });
  test('cannot query assignments for another uid', async () => {
    const db = as.user(CLIENT_A);
    await assertFails(db.collection('assignments').where('uid', '==', CLIENT_B).get());
  });
  test('reads own requests, not another client\'s', async () => {
    await assertSucceeds(as.user(CLIENT_A).doc(`requests/${CLIENT_A}-r1`).get());
    await assertFails(as.user(CLIENT_A).doc(`requests/${CLIENT_B}-r1`).get());
  });
  test('reads own check in schedules, not another client\'s, and not unfiltered', async () => {
    await assertSucceeds(as.user(CLIENT_A).doc(`schedules/${CLIENT_A}-s1`).get());
    await assertSucceeds(as.user(CLIENT_A).collection('schedules').where('uid', '==', CLIENT_A).get());
    await assertFails(as.user(CLIENT_A).doc(`schedules/${CLIENT_B}-s1`).get());
    await assertFails(as.user(CLIENT_A).collection('schedules').get());
  });
  test('an unrecognised role claim grants nothing extra', async () => {
    await assertFails(as.spoofed(CLIENT_A).doc(`clients/${CLIENT_B}`).get());
    await assertFails(as.spoofed(CLIENT_A).doc(`scoring/${CLIENT_A}-m1`).get());
  });
});

describe('nothing reaches a client before release', () => {
  test('client cannot read draft scoring, even for their own assignment', async () => {
    await assertFails(as.user(CLIENT_A).doc(`scoring/${CLIENT_A}-m1`).get());
  });
  test('client cannot list scoring filtered to own uid', async () => {
    const db = as.user(CLIENT_A);
    await assertFails(db.collection('scoring').where('uid', '==', CLIENT_A).get());
  });
  test('client cannot read own formulation draft', async () => {
    await assertFails(as.user(CLIENT_A).doc(`formulationDrafts/${CLIENT_A}`).get());
  });
  test('client reads own formulation responses but cannot write them or read another client\'s', async () => {
    await assertSucceeds(as.user(CLIENT_A).doc(`formulationResponses/${CLIENT_A}`).get());
    await assertFails(as.user(CLIENT_A).doc(`formulationResponses/${CLIENT_A}`).set({ uid: CLIENT_A, responses: { x: { fit: 'fits' } } }));
    await assertFails(as.user(CLIENT_B).doc(`formulationResponses/${CLIENT_A}`).get());
  });
  test('practitioner reads formulation responses', async () => {
    await assertSucceeds(as.practitioner().doc(`formulationResponses/${CLIENT_A}`).get());
  });
  test('client cannot read own unreleased results', async () => {
    await assertFails(as.user(CLIENT_B).doc(`results/${CLIENT_B}`).get());
  });
  test('client reads own released results', async () => {
    await assertSucceeds(as.user(CLIENT_A).doc(`results/${CLIENT_A}`).get());
  });
  test("client cannot read another client's released results", async () => {
    await assertFails(as.user(CLIENT_B).doc(`results/${CLIENT_A}`).get());
  });
  test('client cannot read own unreleased formulation', async () => {
    await assertFails(as.user(CLIENT_B).doc(`formulations/${CLIENT_B}`).get());
  });
  test('client reads own released formulation', async () => {
    await assertSucceeds(as.user(CLIENT_A).doc(`formulations/${CLIENT_A}`).get());
  });
});

describe('clients never write directly', () => {
  const writes = [
    [`clients/${CLIENT_A}`, { journeyStage: 'review' }],
    [`intakeResponses/${CLIENT_A}`, { answers: {} }],
    [`assignments/${CLIENT_A}-m1`, { status: 'complete' }],
    [`scoring/${CLIENT_A}-m1`, { scores: {} }],
    [`results/${CLIENT_B}`, { releasedAt: new Date() }],
    [`formulations/${CLIENT_B}`, { releasedAt: new Date() }],
    [`requests/${CLIENT_A}-r2`, { uid: CLIENT_A, kind: 'access' }],
    [`schedules/${CLIENT_A}-s1`, { status: 'ended' }],
    ['activationCodes/new', { clientTypeOverride: 'health' }],
    ['measures/new', { name: 'x' }],
    ['config/intake', { version: 2 }],
    ['auditLog/e2', { action: 'x' }],
  ];
  for (const [path, data] of writes) {
    test(`cannot write ${path}`, async () => {
      await assertFails(as.user(CLIENT_A).doc(path).set(data, { merge: true }));
    });
  }
  test('cannot delete own client record', async () => {
    await assertFails(as.user(CLIENT_A).doc(`clients/${CLIENT_A}`).delete());
  });
});

describe('operational records', () => {
  test('clients cannot read activation codes', async () => {
    await assertFails(as.user(CLIENT_A).doc('activationCodes/hash-1').get());
  });
  test('activated client reads the measure library', async () => {
    await assertSucceeds(as.user(CLIENT_A).doc('measures/sample-measure').get());
  });
  test('signed in user who has not activated cannot read measures', async () => {
    await assertFails(as.user(NOT_ACTIVATED).doc('measures/sample-measure').get());
  });
  test('signed in user with no client record cannot read measures', async () => {
    await assertFails(as.user('stranger').doc('measures/sample-measure').get());
  });
  test('any signed in user reads config', async () => {
    await assertSucceeds(as.user('stranger').doc('config/intake').get());
  });
  test('clients cannot read the audit log', async () => {
    await assertFails(as.user(CLIENT_A).doc('auditLog/e1').get());
  });
  test('unnamed collections are closed to everyone', async () => {
    await assertFails(as.user(CLIENT_A).doc('somethingElse/x').get());
    await assertFails(as.practitioner().doc('somethingElse/x').get());
  });
});

describe('practitioner role', () => {
  const paths = [
    `clients/${CLIENT_B}`,
    `intakeResponses/${CLIENT_B}`,
    `assignments/${CLIENT_B}-m1`,
    `scoring/${CLIENT_B}-m1`,
    `results/${CLIENT_B}`,
    `formulationDrafts/${CLIENT_B}`,
    `formulations/${CLIENT_B}`,
    `formulationResponses/${CLIENT_B}`,
    `requests/${CLIENT_B}-r1`,
    `schedules/${CLIENT_B}-s1`,
    'activationCodes/hash-1',
    'measures/sample-measure',
    'auditLog/e1',
  ];
  for (const path of paths) {
    test(`reads ${path}`, async () => {
      await assertSucceeds(as.practitioner().doc(path).get());
    });
  }
  test('lists all clients', async () => {
    await assertSucceeds(as.practitioner().collection('clients').get());
  });
  test('still cannot write directly', async () => {
    await assertFails(as.practitioner().doc(`results/${CLIENT_B}`).set({ releasedAt: new Date() }, { merge: true }));
    await assertFails(as.practitioner().doc('activationCodes/new').set({ a: 1 }));
  });
});

describe('admin role operates the system without reading clinical content', () => {
  const clinical = [
    `clients/${CLIENT_A}`,
    `intakeResponses/${CLIENT_A}`,
    `assignments/${CLIENT_A}-m1`,
    `scoring/${CLIENT_A}-m1`,
    `results/${CLIENT_A}`,
    `formulationDrafts/${CLIENT_A}`,
    `formulations/${CLIENT_A}`,
    `requests/${CLIENT_A}-r1`,
    `schedules/${CLIENT_A}-s1`,
  ];
  for (const path of clinical) {
    test(`cannot read ${path}`, async () => {
      await assertFails(as.admin().doc(path).get());
    });
  }
  for (const path of ['activationCodes/hash-1', 'measures/sample-measure', 'config/intake', 'auditLog/e1']) {
    test(`reads ${path}`, async () => {
      await assertSucceeds(as.admin().doc(path).get());
    });
  }
  test('cannot write directly', async () => {
    await assertFails(as.admin().doc('measures/new').set({ name: 'x' }));
  });
});

describe('storage bucket is closed to browsers', () => {
  test('client cannot read or write', async () => {
    const ref = env.authenticatedContext(CLIENT_A).storage().ref(`clients/${CLIENT_A}/report.pdf`);
    await assertFails(ref.getDownloadURL());
    await assertFails(ref.putString('x'));
  });
  test('practitioner cannot read or write', async () => {
    const ref = env.authenticatedContext(PRACTITIONER, { role: 'practitioner' }).storage().ref(`clients/${CLIENT_A}/report.pdf`);
    await assertFails(ref.getDownloadURL());
    await assertFails(ref.putString('x'));
  });
});
