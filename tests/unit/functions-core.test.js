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
  test('an item with its own response options is checked against those', () => {
    const mixed = { items: [{ id: 'i1' }, { id: 'i2', responseOptions: [{ value: 0 }, { value: 2 }, { value: 4 }] }], responseOptions: [{ value: 0 }, { value: 1 }] };
    assert.equal(core.validResponse(mixed, 'i2', 4), true);
    assert.equal(core.validResponse(mixed, 'i2', 1), false);
    assert.equal(core.validResponse(mixed, 'i1', 4), false);
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

describe('check in schedules', () => {
  test('New Zealand calendar date, including across the UTC midnight', () => {
    // 11:30pm UTC on 18 October is 12:30pm on 19 October in Auckland (NZDT).
    assert.equal(core.nzDate(Date.UTC(2026, 9, 18, 23, 30)), '2026-10-19');
    assert.equal(core.nzDate(Date.UTC(2026, 9, 18, 9, 0)), '2026-10-18');
  });
  test('dates are validated and added without time zone drift', () => {
    assert.equal(core.validDate('2026-02-29'), false);
    assert.equal(core.validDate('2028-02-29'), true);
    assert.equal(core.validDate('2026-1-5'), false);
    assert.equal(core.addDays('2026-12-30', 7), '2027-01-06');
  });
  test('schedule input is cleaned or refused', () => {
    assert.equal(typeof core.scheduleProblem({ cadence: 'monthly' }), 'string');
    assert.equal(typeof core.scheduleProblem({ cadence: 'weekly', startsOn: 'soon' }), 'string');
    assert.equal(typeof core.scheduleProblem({ cadence: 'weekly', startsOn: '2026-11-02', endsOn: '2026-10-01' }), 'string');
    assert.deepEqual(core.scheduleProblem({ cadence: 'fortnightly', startsOn: '2026-11-02', endsOn: '' }), { cadence: 'fortnightly', dates: null, startsOn: '2026-11-02', endsOn: null });
    assert.deepEqual(core.scheduleProblem({ cadence: 'dates', dates: '2026-12-01, 2026-11-03 2026-11-03' }), { cadence: 'dates', dates: ['2026-11-03', '2026-12-01'], startsOn: '2026-11-03', endsOn: '2026-12-01' });
  });
  test('next due follows the cadence and stops at the end date', () => {
    const weekly = { cadence: 'weekly', endsOn: '2026-11-20' };
    assert.equal(core.nextDueAfter(weekly, '2026-11-02'), '2026-11-09');
    assert.equal(core.nextDueAfter(weekly, '2026-11-16'), null);
    const dates = { cadence: 'dates', dates: ['2026-11-03', '2026-12-01'] };
    assert.equal(core.nextDueAfter(dates, '2026-11-03'), '2026-12-01');
    assert.equal(core.nextDueAfter(dates, '2026-12-01'), null);
  });
  test('advancing skips dates that were missed while the scheduler was down', () => {
    const s = { cadence: 'weekly', endsOn: null, nextDue: '2026-11-02' };
    assert.deepEqual(core.advanceSchedule(s, '2026-11-17'), { nextDue: '2026-11-23', status: 'active' });
    assert.deepEqual(core.advanceSchedule({ cadence: 'fourWeekly', endsOn: '2026-11-20', nextDue: '2026-11-02' }, '2026-11-02'), { nextDue: null, status: 'ended' });
  });
  test('a date that slipped past while paused comes due today', () => {
    assert.equal(core.resumedDue({ nextDue: '2026-11-02' }, '2026-11-10'), '2026-11-10');
    assert.equal(core.resumedDue({ nextDue: '2026-11-12' }, '2026-11-10'), '2026-11-12');
    assert.equal(core.resumedDue({ nextDue: null }, '2026-11-10'), null);
  });
});

describe('formulation suggestions', () => {
  const results = { items: [{ assignmentId: 'a1', measureName: 'Everyday executive skills', focus: [{ subscaleId: 'time', label: 'Managing time', reason: '' }], strengths: [{ subscaleId: 'plan', label: 'Planning', reason: '' }] }] };
  test('areas of focus suggest perpetuating factors and strengths suggest protective ones', () => {
    const s = core.suggestFactors(results, []);
    assert.deepEqual(s.map((x) => [x.zone, x.text]), [['perpetuating', 'Managing time'], ['protective', 'Planning']]);
    assert.equal(s[0].source.assignmentId, 'a1');
  });
  test('a suggestion already on the draft is not repeated', () => {
    const placed = core.cleanFactors([{ id: 'f1', zone: 'perpetuating', text: 'Managing time', source: { assignmentId: 'a1', subscaleId: 'time', measureName: 'x', kind: 'focus' } }]);
    assert.equal(core.suggestFactors(results, placed).length, 1);
  });
  test('factor ids are made unique and the summary is bounded', () => {
    const f = core.cleanFactors([{ id: 'a', zone: 'presenting', text: 'x' }, { id: 'a', zone: 'presenting', text: 'y' }]);
    assert.notEqual(f[0].id, f[1].id);
    assert.equal(core.cleanSummary('a'.repeat(2000)).length, core.SUMMARY_MAX);
  });
  test('an unknown drawing falls back to the grid', () => {
    assert.equal(core.cleanView('river'), 'river');
    assert.equal(core.cleanView('spiral'), 'grid');
    assert.equal(core.cleanView(undefined), 'grid');
  });
});
