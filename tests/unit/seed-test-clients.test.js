import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { makeHandlers } from '../../functions/handlers.js';
import { createMemoryFirestore } from '../support/memory-firestore.js';
import { TEST_PEOPLE, create, remove } from '../../scripts/seed-test-clients.mjs';

const intakeConfig = JSON.parse(readFileSync('public/config/intake.json', 'utf8'));
const clientTypes = JSON.parse(readFileSync('public/config/client-types.json', 'utf8'));
const appConfig = JSON.parse(readFileSync('public/config/app.json', 'utf8'));
const { measures } = JSON.parse(readFileSync('measures/cleared.json', 'utf8'));

// A stand in for Firebase Authentication: users by email.
function fakeAuth() {
  const users = new Map([['hello@charlotteprice.co.nz', { uid: 'charlotte', email: 'hello@charlotteprice.co.nz', displayName: 'Charlotte' }]]);
  return {
    users,
    async getUserByEmail(email) {
      if (!users.has(email)) throw new Error('not found');
      return users.get(email);
    },
    async createUser({ email, displayName }) {
      const u = { uid: `u-${email.split('@')[0]}`, email, displayName };
      users.set(email, u);
      return u;
    },
    async deleteUser(uid) {
      for (const [k, v] of users) if (v.uid === uid) users.delete(k);
    },
  };
}

describe('test client seed', () => {
  test('creates 5 clients at different points of the journey and removes them cleanly', async () => {
    const db = createMemoryFirestore();
    const auth = fakeAuth();
    const h = makeHandlers({ db, intakeConfig, clientTypes, allowSample: () => false });
    for (const m of measures) await db.doc(`measures/${m.id}`).set(m);
    const lines = [];
    await create({ db, auth, h, appConfig, log: (l) => lines.push(l) });
    const clients = db.list('clients');
    assert.equal(clients.length, 5);
    const by = Object.fromEntries(clients.map((c) => [c.name, c]));
    assert.equal(by['Aroha Test'].activatedAt, null);
    assert.equal(by['Ben Test'].journeyStage, 'assessment');
    assert.equal(by['Chloe Test'].journeyStage, 'booking');
    assert.ok(by['Chloe Test'].nextSessionAt);
    assert.equal(by['Dev Test'].journeyStage, 'intervention');
    assert.equal(by['Ella Test'].journeyStage, 'review');
    assert.equal(db.list('results').length, 2);
    assert.equal(db.list('formulations').length, 2);
    assert.equal(db.list('formulationResponses').length, 2);
    assert.equal(db.list('schedules').length, 1);
    assert.equal(db.list('requests').length, 1);
    assert.equal(by['Dev Test'].resources.length, 2);
    // Running again leaves existing test clients alone.
    await create({ db, auth, h, appConfig, log: () => {} });
    assert.equal(db.list('clients').length, 5);
    await remove({ db, auth, log: () => {} });
    assert.equal(db.list('clients').length, 0);
    assert.equal(db.list('assignments').length, 0);
    assert.equal(db.list('scoring').length, 0);
    assert.equal(db.list('activationCodes').length, 0);
    assert.equal(auth.users.size, 1);
    assert.equal(TEST_PEOPLE.length, 5);
  });
});
