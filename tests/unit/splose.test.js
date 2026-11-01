// Splose progress tracking: the API client, the mapping from Splose
// records to a progress document, and the link, resync and scheduled sync
// handlers against the in memory database and a fake Splose.

import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { makeHandlers } from '../../functions/handlers.js';
import { SploseError, buildProgress, cleanPatientId, createSploseClient, isStale, serviceStage } from '../../functions/splose.js';
import { createFakeSplose, sampleSplose } from '../support/fake-splose.js';
import { createMemoryFirestore } from '../support/memory-firestore.js';

const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 1, 2, 0);
const config = {
  enabled: true,
  services: { firstSession: [11], feedback: [12], intervention: [13], review: [14] },
  showForms: true,
  showAttendance: true,
  showCase: true,
  lookbackDays: 180,
  staleAfterMinutes: 120,
  clientsPerRun: 15,
  callsPerRun: 50,
};

describe('mapping', () => {
  test('serviceStage reads the stage map and ignores unknown services', () => {
    assert.equal(serviceStage(config, 12), 'feedback');
    assert.equal(serviceStage(config, '13'), 'intervention');
    assert.equal(serviceStage(config, 99), null);
    assert.equal(serviceStage({}, 11), null);
  });

  test('cleanPatientId accepts a positive whole number only', () => {
    assert.equal(cleanPatientId(' 101 '), 101);
    assert.equal(cleanPatientId('101.5'), null);
    assert.equal(cleanPatientId('-1'), null);
    assert.equal(cleanPatientId('abc'), null);
    assert.equal(cleanPatientId(''), null);
  });

  test('buildProgress keeps dates, statuses and counts only', async () => {
    const api = sampleSplose(NOW);
    const names = Object.fromEntries((await api.services()).map((s) => [s.id, s.name]));
    const p = buildProgress({
      patientId: 101,
      appointments: await api.appointments({ patientId: 101 }),
      forms: await api.patientForms({ patientId: 101 }),
      cases: await api.cases({ patientId: 101 }),
      serviceNames: names,
      config,
      client: { uid: 'client-1', bookingTriggeredAt: NOW - 12 * DAY },
      now: NOW,
    });
    assert.equal(p.uid, 'client-1');
    assert.equal(p.patientId, 101);
    assert.deepEqual(p.nextAppointment, { at: NOW + 4 * DAY, service: 'Coaching session', stage: 'intervention' });
    assert.deepEqual(p.lastAttended, { at: NOW - 10 * DAY, service: 'Assessment feedback', stage: 'feedback' });
    assert.equal(p.lastOutcome, 'Did not arrive');
    assert.equal(p.attended, 2);
    assert.equal(p.missed, 1);
    assert.equal(p.cancelled, 0);
    assert.equal(p.feedbackBookedAt, NOW - 10 * DAY);
    assert.equal(p.feedbackAttendedAt, NOW - 10 * DAY);
    assert.equal(p.forms.length, 2);
    assert.equal(p.forms[0].title, 'Sleep diary');
    assert.equal(p.forms[0].status, 'Incomplete');
    assert.equal(p.forms[1].status, 'Completed');
    assert.equal(p.forms[1].submittedAt, NOW - 29 * DAY, 'Splose\'s colon separated date is read');
    assert.deepEqual(p.case, { isOpen: true, trackType: 'Appointments', appointmentCount: 10, hours: null, expiryDate: null });
    assert.equal(p.syncedAt, NOW);
    assert.equal(p.error, null);
    const text = JSON.stringify(p);
    for (const word of ['pricing', 'total', 'note', 'cancellationReason', 'content', 'invoice']) assert.equal(text.includes(`"${word}"`), false, word);
  });

  test('a feedback appointment booked before the questionnaires finished does not count', async () => {
    const api = sampleSplose(NOW);
    const p = buildProgress({ patientId: 101, appointments: await api.appointments({ patientId: 101 }), config, client: { bookingTriggeredAt: NOW - 5 * DAY }, now: NOW });
    assert.equal(p.feedbackBookedAt, null);
    assert.equal(p.feedbackAttendedAt, null);
  });

  test('cancelled and archived appointments never become the next session', () => {
    const appt = (id, at, status, extra = {}) => ({ id, start: new Date(at).toISOString(), serviceId: 13, appointmentPatients: [{ patientId: 7, status }], ...extra });
    const p = buildProgress({
      patientId: 7,
      appointments: [appt(1, NOW + DAY, 'Cancelled'), appt(2, NOW + 2 * DAY, null, { archived: true }), appt(3, NOW + 3 * DAY, null), appt(4, NOW - DAY, 'Cancelled')],
      config,
      now: NOW,
    });
    assert.equal(p.nextAppointment.at, NOW + 3 * DAY);
    assert.equal(p.nextAppointment.service, 'Session', 'no names given');
    assert.equal(p.cancelled, 1);
    assert.equal(p.lastOutcome, null);
  });

  test('forms and case are left out when switched off', () => {
    const p = buildProgress({ patientId: 7, forms: [{ id: 1, title: 'x', status: 'Incomplete' }], cases: [{ id: 1, isOpen: true }], config: { ...config, showForms: false, showCase: false }, now: NOW });
    assert.deepEqual(p.forms, []);
    assert.equal(p.case, null);
  });

  test('isStale after the configured minutes', () => {
    assert.equal(isStale({ syncedAt: NOW - 60 * 60000 }, config, NOW), false);
    assert.equal(isStale({ syncedAt: NOW - 121 * 60000 }, config, NOW), true);
    assert.equal(isStale(null, config, NOW), true);
  });
});

describe('API client', () => {
  function fakeFetch(routes) {
    const seen = [];
    const fetch = async (url, init) => {
      seen.push({ url, init });
      const r = routes.shift();
      return { ok: r.status === 200, status: r.status, json: async () => r.body };
    };
    return { fetch, seen };
  }

  test('sends the key and user agent, and follows pages', async () => {
    const { fetch, seen } = fakeFetch([
      { status: 200, body: { data: [{ id: 1 }], links: { nextPage: 'https://api.splose.com/v1/appointments?id_gt=1' } } },
      { status: 200, body: { data: [{ id: 2 }], links: { nextPage: '' } } },
    ]);
    const api = createSploseClient({ apiKey: 'k', fetch });
    const list = await api.appointments({ patientId: 101, start_gt: '2026-01-01' });
    assert.deepEqual(list.map((x) => x.id), [1, 2]);
    assert.equal(api.calls, 2);
    assert.equal(seen[0].url, 'https://api.splose.com/v1/appointments?patientId=101&start_gt=2026-01-01');
    assert.equal(seen[0].init.headers.Authorization, 'Bearer k');
    assert.equal(seen[0].init.headers['User-Agent'], 'ExecutiveFrameClientHub/1');
    assert.equal(seen[1].url, 'https://api.splose.com/v1/appointments?id_gt=1');
  });

  test('a refused key, a rate limit and a missing key are named', async () => {
    await assert.rejects(createSploseClient({ apiKey: 'k', fetch: fakeFetch([{ status: 401 }]).fetch }).services(), (e) => e instanceof SploseError && e.status === 401);
    const waits = [];
    const limited = createSploseClient({ apiKey: 'k', fetch: fakeFetch([{ status: 429 }, { status: 429 }]).fetch, wait: async (ms) => waits.push(ms) });
    await assert.rejects(limited.services(), (e) => e.status === 429);
    assert.equal(waits.length, 1, 'retried once');
    assert.throws(() => createSploseClient({ apiKey: '' }), (e) => e.status === 0);
  });
});

describe('handlers', () => {
  const sarah = { uid: 'sarah', token: { role: 'practitioner', email: 'sarah@example.com' } };
  const client = { uid: 'client-1', token: { email: 'alex@example.com' } };
  const as = (auth, data) => ({ auth, data });
  let db;
  let api;
  let h;
  let now;

  async function rejects(promise, code) {
    await assert.rejects(promise, (e) => {
      assert.equal(e.code, code, e.message);
      return true;
    });
  }

  beforeEach(async () => {
    db = createMemoryFirestore();
    api = sampleSplose(NOW);
    now = NOW;
    h = makeHandlers({ db, intakeConfig: { questions: [], rules: [] }, clientTypes: { types: {}, stages: [] }, appConfig: { splose: config }, splose: () => api, now: () => now });
    await db.doc('clients/client-1').set({ uid: 'client-1', email: 'alex@example.com', journeyStage: 'booking', bookingTriggeredAt: NOW - 12 * DAY, activatedAt: NOW - 40 * DAY, closedAt: null });
    await db.doc('clients/client-2').set({ uid: 'client-2', email: 'sam@example.com', journeyStage: 'enquiry', activatedAt: NOW - DAY, closedAt: null });
  });

  test('linking checks the id and the email, then syncs at once', async () => {
    await rejects(h.linkSplosePatient(as(client, { uid: 'client-1', patientId: 101 })), 'permission-denied');
    await rejects(h.linkSplosePatient(as(sarah, { uid: 'client-1', patientId: 'x' })), 'invalid-argument');
    await rejects(h.linkSplosePatient(as(sarah, { uid: 'client-1', patientId: 999 })), 'not-found');
    await rejects(h.linkSplosePatient(as(sarah, { uid: 'client-1', patientId: 102 })), 'failed-precondition');
    assert.equal(db.read('clients/client-1').sploseClientId, undefined);
    await h.linkSplosePatient(as(sarah, { uid: 'client-1', patientId: 101 }));
    assert.equal(db.read('clients/client-1').sploseClientId, 101);
    const p = db.read('sploseProgress/client-1');
    assert.equal(p.nextAppointment.service, 'Coaching session');
    assert.equal(p.attended, 2);
    assert.ok(db.list('auditLog').some((e) => e.action === 'linked Splose patient' && e.emailMatched === true));
    // A different email can be linked when Sarah confirms.
    await h.linkSplosePatient(as(sarah, { uid: 'client-2', patientId: 101, confirm: true }));
    assert.equal(db.read('clients/client-2').sploseClientId, 101);
  });

  test('search finds Splose patients by name or email and stores nothing', async () => {
    await rejects(h.searchSplosePatients(as(client, { query: 'Alex' })), 'permission-denied');
    await rejects(h.searchSplosePatients(as(sarah, { query: 'A' })), 'invalid-argument');
    let r = await h.searchSplosePatients(as(sarah, { query: '  sample ' }));
    assert.deepEqual(r.results.map((x) => x.id), [101, 102]);
    assert.equal(r.results[0].name, 'Alex Sample');
    assert.equal(r.results[1].name, 'Sammy Sample', 'preferred name first');
    r = await h.searchSplosePatients(as(sarah, { query: 'Alex Sample' }));
    assert.deepEqual(r.results.map((x) => x.id), [101]);
    r = await h.searchSplosePatients(as(sarah, { query: 'dev.test@example.com' }));
    assert.deepEqual(r.results.map((x) => x.id), [103]);
    r = await h.searchSplosePatients(as(sarah, { query: 'nobody' }));
    assert.deepEqual(r.results, []);
    assert.equal(db.list('sploseProgress').length, 0);
    assert.equal(db.list('auditLog').length, 0);
  });

  test('resync runs once a minute per client and unlink removes the record', async () => {
    await rejects(h.syncSploseClient(as(sarah, { uid: 'client-1' })), 'failed-precondition');
    await h.linkSplosePatient(as(sarah, { uid: 'client-1', patientId: 101 }));
    const before = api.calls;
    assert.deepEqual(await h.syncSploseClient(as(sarah, { uid: 'client-1' })), { ok: true, already: true });
    assert.equal(api.calls, before);
    now = NOW + 2 * 60000;
    await h.syncSploseClient(as(sarah, { uid: 'client-1' }));
    assert.equal(db.read('sploseProgress/client-1').syncedAt, now);
    await h.unlinkSplosePatient(as(sarah, { uid: 'client-1' }));
    assert.equal(db.read('clients/client-1').sploseClientId, null);
    assert.equal(db.read('sploseProgress/client-1'), undefined);
    await rejects(h.unlinkSplosePatient(as(client, { uid: 'client-1' })), 'permission-denied');
  });

  test('the scheduled run takes the oldest first and stops inside the call budget', async () => {
    await h.linkSplosePatient(as(sarah, { uid: 'client-1', patientId: 101 }));
    await h.linkSplosePatient(as(sarah, { uid: 'client-2', patientId: 102, confirm: true }));
    await db.doc('clients/client-3').set({ uid: 'client-3', email: 'c@example.com', sploseClientId: 103, closedAt: NOW });
    await db.doc('clients/client-1').update({ sploseSyncedAt: NOW - 3 * 60000 });
    await db.doc('clients/client-2').update({ sploseSyncedAt: NOW - 9 * 60000 });
    now = NOW + 60000;
    api = createFakeSplose({ services: [], patients: [], appointments: [], forms: [], cases: [] });
    h = makeHandlers({ db, intakeConfig: {}, clientTypes: {}, appConfig: { splose: { ...config, callsPerRun: 4 } }, splose: () => api, now: () => now });
    // 1 call for services, 3 per client: the second client waits for the next run.
    const r = await h.runSploseSync();
    assert.equal(r.synced, 1);
    assert.equal(r.deferred, 1);
    assert.equal(r.calls, 4);
    assert.equal(db.read('clients/client-2').sploseSyncedAt, now, 'oldest first');
    assert.equal(db.read('clients/client-1').sploseSyncedAt, NOW - 3 * 60000);
    assert.equal(db.read('sploseProgress/client-3'), undefined, 'closed clients are skipped');
  });

  test('a refused key stops the run and is recorded on the client', async () => {
    await h.linkSplosePatient(as(sarah, { uid: 'client-1', patientId: 101 }));
    api.fail = Object.assign(new SploseError('Splose refused the API key.', 401), {});
    const r = await h.runSploseSync();
    assert.match(r.error, /refused/);
    assert.equal(r.failed, 0, 'the services call failed before any client');
    api.fail = null;
    await h.runSploseSync();
    assert.equal(db.read('sploseProgress/client-1').error, null);
    // A failure mid run keeps the last good record and notes the error.
    const flaky = createFakeSplose({ services: [] });
    let calls = 0;
    flaky.appointments = async () => {
      calls += 1;
      throw new SploseError('Splose returned 500.', 500);
    };
    h = makeHandlers({ db, intakeConfig: {}, clientTypes: {}, appConfig: { splose: config }, splose: () => flaky, now: () => now });
    const r2 = await h.runSploseSync();
    assert.equal(r2.failed, 1);
    assert.equal(calls, 1);
    const p = db.read('sploseProgress/client-1');
    assert.match(p.error, /500/);
    assert.equal(p.attended, 2, 'last good record kept');
  });

  test('switched off or unconnected, the run does nothing', async () => {
    const off = makeHandlers({ db, intakeConfig: {}, clientTypes: {}, appConfig: { splose: { ...config, enabled: false } }, splose: () => api });
    assert.equal((await off.runSploseSync()).skipped, 'disabled');
    await rejects(off.linkSplosePatient(as(sarah, { uid: 'client-1', patientId: 101 })), 'failed-precondition');
    const unset = makeHandlers({ db, intakeConfig: {}, clientTypes: {}, appConfig: { splose: config }, splose: () => createSploseClient({ apiKey: '' }) });
    assert.match((await unset.runSploseSync()).error, /not connected/);
    await rejects(unset.linkSplosePatient(as(sarah, { uid: 'client-1', patientId: 101 })), 'failed-precondition');
  });
});
