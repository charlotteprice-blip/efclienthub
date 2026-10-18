import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as core from '../../functions/core.js';

const NOW = Date.UTC(2026, 9, 18, 0, 0, 0);

describe('activation codes', () => {
  test('normalise ignores case, spaces and dashes', () => {
    assert.equal(core.normaliseCode(' ktwx-7q4m pr9d '), 'KTWX7Q4MPR9D');
  });
  test('hash is stable across formatting', () => {
    assert.equal(core.hashCode('KTWX-7Q4M-PR9D'), core.hashCode('ktwx7q4mpr9d'));
  });
  test('generated codes are 12 characters from the safe alphabet', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = core.generateCode();
      assert.equal(code.length, 12);
      assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
    }
  });
  test('format groups in fours', () => {
    assert.equal(core.formatCode('KTWX7Q4MPR9D'), 'KTWX-7Q4M-PR9D');
  });
  test('expiry is 30 days', () => {
    assert.equal(core.codeExpiry(NOW) - NOW, 30 * 86400000);
  });
  test('problems: missing, used by someone else, expired, wrong email', () => {
    const ok = { expiresAt: NOW + 1, redeemedByUid: null };
    assert.match(core.codeProblem(null, { uid: 'a', now: NOW }), /not recognised/);
    assert.match(core.codeProblem({ ...ok, redeemedByUid: 'b' }, { uid: 'a', now: NOW }), /already been used/);
    assert.match(core.codeProblem({ ...ok, expiresAt: NOW }, { uid: 'a', now: NOW }), /expired/);
    assert.match(core.codeProblem({ ...ok, email: 'x@example.com' }, { uid: 'a', email: 'y@example.com', now: NOW }), /different email/);
    assert.equal(core.codeProblem({ ...ok, email: 'X@Example.com' }, { uid: 'a', email: 'x@example.com', now: NOW }), null);
    assert.equal(core.codeProblem({ ...ok, redeemedByUid: 'a' }, { uid: 'a', now: NOW }), null);
  });
  test('redeem attempts are limited per hour', () => {
    let state = null;
    let blocked = false;
    for (let i = 0; i < 11; i += 1) ({ next: state, blocked } = core.nextAttemptState(state, NOW + i));
    assert.equal(blocked, true);
    assert.equal(core.nextAttemptState(state, NOW + 2 * 3600000).blocked, false);
  });
});

describe('questionnaires and release', () => {
  const measure = { items: [{ id: 'i1' }], responseOptions: [{ value: 0 }, { value: 1 }] };
  test('responses must be a real item and option', () => {
    assert.equal(core.validResponse(measure, 'i1', 1), true);
    assert.equal(core.validResponse(measure, 'i1', 5), false);
    assert.equal(core.validResponse(measure, 'i9', 1), false);
  });
  test('only cleared measures are assignable, sample ones only in test mode', () => {
    assert.equal(core.assignable({ licenceStatus: 'cleared' }, { allowSample: false }), true);
    assert.equal(core.assignable({ licenceStatus: 'sample' }, { allowSample: false }), false);
    assert.equal(core.assignable({ licenceStatus: 'sample' }, { allowSample: true }), true);
    assert.equal(core.assignable({ licenceStatus: 'unlicensed' }, { allowSample: true }), false);
  });
  test('release moves assessment and booking to feedback only', () => {
    assert.equal(core.stageAfterRelease('booking'), 'feedback');
    assert.equal(core.stageAfterRelease('intervention'), 'intervention');
  });
  test('release keeps earlier items and never copies scores', () => {
    const drafts = [{ assignmentId: 'a2', draft: { measureId: 'm2', measureName: 'Two', strengths: [], focus: [{ subscaleId: 's', label: 'L', reason: 'R', topic: null, score: 3 }] } }];
    const items = core.buildRelease(drafts, [{ assignmentId: 'a1', measureId: 'm1' }]);
    assert.deepEqual(items.map((i) => i.assignmentId), ['a1', 'a2']);
    assert.equal('score' in items[1].focus[0], false);
  });
});

describe('formulation and misc', () => {
  test('factors are cleaned and must use a real zone', () => {
    assert.deepEqual(core.cleanFactors([{ id: 'x', zone: 'protective', text: '  Support ' }]), [{ id: 'x', zone: 'protective', text: 'Support' }]);
    assert.equal(core.cleanFactors([{ zone: 'nowhere', text: 'x' }]), null);
  });
  test('20 working days skips weekends', () => {
    const due = core.addWorkingDays(Date.UTC(2026, 9, 19), 20); // Monday
    assert.equal(new Date(due).toISOString().slice(0, 10), '2026-11-16');
  });
});
