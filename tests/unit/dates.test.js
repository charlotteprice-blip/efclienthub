// The next session input is read and shown in New Zealand time, whatever
// time zone the browser is in.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fmtDateTime, fromLocalInput, toLocalInput } from '../../public/js/ui.js';

describe('next session times are New Zealand time', () => {
  test('summer (NZDT, 13 hours ahead of UTC)', () => {
    assert.equal(fromLocalInput('2026-12-01T14:30'), Date.UTC(2026, 11, 1, 1, 30));
    assert.equal(toLocalInput(Date.UTC(2026, 11, 1, 1, 30)), '2026-12-01T14:30');
  });
  test('winter (NZST, 12 hours ahead of UTC)', () => {
    assert.equal(fromLocalInput('2026-07-01T09:00'), Date.UTC(2026, 5, 30, 21, 0));
    assert.equal(toLocalInput(Date.UTC(2026, 5, 30, 21, 0)), '2026-07-01T09:00');
  });
  test('the hours each side of a daylight saving change round trip', () => {
    for (const v of ['2026-09-27T01:30', '2026-09-27T03:30', '2026-04-05T01:30', '2026-04-05T04:00', '2027-01-01T00:00']) assert.equal(toLocalInput(fromLocalInput(v)), v, v);
  });
  test('empty is null and nonsense is not a number', () => {
    assert.equal(fromLocalInput(''), null);
    assert.ok(Number.isNaN(fromLocalInput('tomorrow')));
    assert.equal(toLocalInput(null), '');
  });
  test('a date with a time shows its year', () => {
    assert.ok(fmtDateTime(Date.UTC(2026, 11, 1, 1, 30)).includes('2026'));
  });
});
