// Idle sign out timing: 30 minutes with no activity, a warning 1 minute
// before, and a way to stay.

import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { IDLE_DEFAULTS, createIdleWatch, idleState } from '../../public/js/idle.js';

const MIN = 60 * 1000;

describe('idleState', () => {
  test('defaults are 30 minutes with a 1 minute warning', () => {
    assert.deepEqual(IDLE_DEFAULTS, { limitMs: 30 * MIN, warnMs: MIN });
  });
  test('active until 29 minutes, warning from 29, expired at 30', () => {
    const t0 = 1_000_000_000_000;
    assert.equal(idleState(t0, t0), 'active');
    assert.equal(idleState(t0, t0 + 29 * MIN - 1), 'active');
    assert.equal(idleState(t0, t0 + 29 * MIN), 'warn');
    assert.equal(idleState(t0, t0 + 30 * MIN - 1), 'warn');
    assert.equal(idleState(t0, t0 + 30 * MIN), 'expired');
    assert.equal(idleState(t0, t0 + 8 * 60 * MIN), 'expired');
  });
  test('a missing, unreadable or future time never logs anyone out', () => {
    const now = 1_000_000_000_000;
    for (const last of [null, undefined, '', 'x', 0, now + 5 * MIN]) assert.equal(idleState(last, now), 'active', String(last));
  });
  test('reads a time stored as text', () => {
    assert.equal(idleState(String(1_000_000_000_000), 1_000_000_000_000 + 31 * MIN), 'expired');
  });
});

function harness(opts = {}) {
  const c = { time: 1_000_000_000_000, stored: opts.stored ?? null, events: [] };
  const watch = createIdleWatch({
    read: () => c.stored,
    write: (t) => {
      c.stored = t;
    },
    now: () => c.time,
    onWarn: () => c.events.push('warn'),
    onActive: () => c.events.push('active'),
    onExpire: () => c.events.push('expire'),
  });
  return { c, watch };
}

describe('idle watch', () => {
  test('warns at 29 minutes and logs out at 30, once', () => {
    const { c, watch } = harness();
    watch.start({ fresh: true });
    c.time += 28 * MIN;
    assert.equal(watch.check(), 'active');
    c.time += MIN;
    assert.equal(watch.check(), 'warn');
    watch.check();
    c.time += MIN;
    assert.equal(watch.check(), 'expired');
    watch.check();
    assert.deepEqual(c.events, ['warn', 'expire']);
  });
  test('activity keeps the session going', () => {
    const { c, watch } = harness();
    watch.start({ fresh: true });
    for (let i = 0; i < 10; i += 1) {
      c.time += 20 * MIN;
      watch.activity();
      assert.equal(watch.check(), 'active');
    }
    assert.deepEqual(c.events, []);
  });
  test('Stay logged in closes the warning and starts the clock again', () => {
    const { c, watch } = harness();
    watch.start({ fresh: true });
    c.time += 29 * MIN + 10_000;
    watch.check();
    watch.stay();
    assert.equal(watch.state, 'active');
    c.time += 28 * MIN;
    assert.equal(watch.check(), 'active');
    c.time += 2 * MIN;
    assert.equal(watch.check(), 'expired');
    assert.deepEqual(c.events, ['warn', 'active', 'expire']);
  });
  test('a stray touch while the warning is up does not dismiss it', () => {
    const { c, watch } = harness();
    watch.start({ fresh: true });
    c.time += 29 * MIN + 10_000;
    watch.check();
    watch.activity();
    assert.equal(watch.check(), 'warn');
    c.time += MIN;
    assert.equal(watch.check(), 'expired');
  });
  test('activity in another tab closes the warning here', () => {
    const { c, watch } = harness();
    watch.start({ fresh: true });
    c.time += 29 * MIN + 10_000;
    watch.check();
    c.stored = c.time; // the other tab wrote the time
    assert.equal(watch.check(), 'active');
    assert.deepEqual(c.events, ['warn', 'active']);
  });
  test('a kept session reopened after a long absence is logged out at once', () => {
    const { c, watch } = harness({ stored: 1_000_000_000_000 - 3 * 60 * MIN });
    assert.equal(watch.start(), 'expired');
    assert.deepEqual(c.events, ['expire']);
  });
  test('a fresh log in starts the clock, whatever old time is stored', () => {
    const { c, watch } = harness({ stored: 1_000_000_000_000 - 3 * 60 * MIN });
    assert.equal(watch.start({ fresh: true }), 'active');
    assert.equal(c.stored, c.time);
  });
  test('a kept session with no stored time starts the clock and is not logged out', () => {
    const { c, watch } = harness();
    assert.equal(watch.start(), 'active');
    assert.equal(c.stored, c.time);
  });
  test('nothing happens while stopped or after logging out', () => {
    const { c, watch } = harness();
    c.time += 60 * MIN;
    assert.equal(watch.check(), 'stopped');
    watch.start({ fresh: true });
    c.time += 31 * MIN;
    watch.check();
    watch.activity();
    watch.stay();
    assert.equal(watch.check(), 'expired');
    assert.deepEqual(c.events, ['expire']);
    watch.stop();
    assert.equal(watch.check(), 'stopped');
  });
  test('writes are throttled so input does not flood storage', () => {
    const { c, watch } = harness();
    watch.start({ fresh: true });
    const first = c.stored;
    c.time += 1000;
    watch.activity();
    assert.equal(c.stored, first);
    c.time += 5000;
    watch.activity();
    assert.equal(c.stored, c.time);
  });
});

// Sending something to the practitioner is the client's choice. The idle
// log out must never do it for them. saveTyped lives in the page script,
// so this reads its source and checks what it may call.
describe('idle log out never sends on a client\'s behalf', () => {
  const app = readFileSync('public/js/live/app.js', 'utf8');
  const start = app.indexOf('async function saveTyped()');
  const body = app.slice(start, app.indexOf('async function idleLogout()'));
  test('saveTyped exists and is what idleLogout calls', () => {
    assert.ok(start > 0 && body.length > 50);
    assert.ok(app.includes('await saveTyped();'));
  });
  test('it does not send a formulation comment, a request or an answer', () => {
    for (const call of ['saveFactorResponse', 'respondToFormulation', 'factor-response', 'createRequest', 'submitMeasure', 'submitIntake', 'localStorage', 'sessionStorage']) assert.ok(!body.includes(call), call);
  });
  test('it acts for the practitioner only, and only on her own draft summary', () => {
    assert.ok(body.includes("S.role !== 'practitioner'"));
    assert.ok(body.includes("handlers['formulation-summary']"));
  });
});
