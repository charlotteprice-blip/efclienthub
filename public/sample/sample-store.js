// In browser stand in for Firestore and the Cloud Functions, used only by
// the clickable sample. Each action here mirrors a function the live app
// will have (named in the comment), so the sample doubles as a working
// specification. Everything is sample data; nothing leaves the browser.

import { buildDraft, scoreMeasure } from '../js/scoring.js';
import { deriveClientType, validateIntake } from '../js/intake-rules.js';

const KEY = 'efch-sample-v1';
const DAY = 24 * 60 * 60 * 1000;
export const DEMO_CODE = 'KTWX7Q4MPR9D';
export const DEMO_UID = 'you';

let memory = null;
const listeners = new Set();

export const formatCode = (code) => code.replace(/(.{4})(?=.)/g, '$1-');
const normaliseCode = (input) => String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const now = () => Date.now();
const id = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

function addWorkingDays(start, days) {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return d.getTime();
}

function seed() {
  const t = now();
  const s = {
    version: 1,
    role: 'client',
    session: { signedIn: false, uid: null, attempts: 0 },
    codes: [
      { code: DEMO_CODE, clientTypeOverride: 'neurodivergent', forName: 'You (sample)', issuedBy: 'sarah', issuedAt: t - DAY, expiresAt: t + 29 * DAY, redeemedByUid: null, redeemedAt: null },
      { code: 'H3RN8VQ2LC5T', clientTypeOverride: null, forName: 'Sample client four', issuedBy: 'sarah', issuedAt: t - 2 * DAY, expiresAt: t + 28 * DAY, redeemedByUid: null, redeemedAt: null },
    ],
    clients: {
      'sample-1': { uid: 'sample-1', name: 'Sample client one', email: 'one@example.com', clientType: 'neurodivergent', journeyStage: 'assessment', activatedAt: t - 6 * DAY, consentAt: t - 6 * DAY, consentVersion: 'sample-1', retentionUntil: null, lastActive: t - 2 * 60 * 60 * 1000 },
      'sample-2': { uid: 'sample-2', name: 'Sample client two', email: 'two@example.com', clientType: 'neurodivergent', journeyStage: 'booking', activatedAt: t - 12 * DAY, consentAt: t - 12 * DAY, consentVersion: 'sample-1', retentionUntil: null, lastActive: t - DAY },
      'sample-3': { uid: 'sample-3', name: 'Sample client three', email: 'three@example.com', clientType: 'health', journeyStage: 'intervention', activatedAt: t - 30 * DAY, consentAt: t - 30 * DAY, consentVersion: 'sample-1', retentionUntil: null, lastActive: t - 6 * DAY },
    },
    intake: {},
    assignments: [
      { id: 'a-s1-1', uid: 'sample-1', measureId: 'sample-routines', status: 'complete', order: 1, assignedAt: t - 6 * DAY, completedAt: t - 5 * DAY },
      { id: 'a-s1-2', uid: 'sample-1', measureId: 'sample-focus', status: 'inProgress', order: 2, assignedAt: t - 6 * DAY, completedAt: null },
      { id: 'a-s2-1', uid: 'sample-2', measureId: 'sample-routines', status: 'complete', order: 1, assignedAt: t - 12 * DAY, completedAt: t - 10 * DAY },
      { id: 'a-s2-2', uid: 'sample-2', measureId: 'sample-focus', status: 'complete', order: 2, assignedAt: t - 12 * DAY, completedAt: t - DAY },
      { id: 'a-s3-1', uid: 'sample-3', measureId: 'sample-routines', status: 'complete', order: 1, assignedAt: t - 30 * DAY, completedAt: t - 28 * DAY },
    ],
    scoring: {},
    results: {},
    formulationDrafts: {},
    formulations: {},
    requests: [],
    booking: {},
    audit: [],
  };
  return s;
}

function read() {
  if (memory) return memory;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) memory = JSON.parse(raw);
  } catch {
    memory = null;
  }
  if (!memory || memory.version !== 1) memory = seed();
  return memory;
}

function write() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // Storage unavailable: the sample keeps working in memory.
  }
  for (const fn of listeners) fn(memory);
}

export function state() {
  return read();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function reset() {
  memory = seed();
  write();
}

export function setRole(role) {
  read().role = role;
  write();
}

let measuresById = {};
export function setMeasures(list) {
  measuresById = Object.fromEntries(list.map((m) => [m.id, m]));
}
export const measure = (measureId) => measuresById[measureId];
export const allMeasures = () => Object.values(measuresById);

function audit(actor, action, target) {
  read().audit.unshift({ at: now(), actor, action, target });
}

// Seeds draft scores for the pre made sample clients so Sarah's view has
// something to review. Called once measures are loaded.
export function primeSampleScores() {
  const s = read();
  const answersFor = (m, pattern) => Object.fromEntries(m.items.map((it, i) => [it.id, pattern[i % pattern.length]]));
  for (const a of s.assignments) {
    if (a.status !== 'complete' || s.scoring[a.id]) continue;
    const m = measure(a.measureId);
    if (!m) continue;
    const responses = answersFor(m, a.uid === 'sample-3' ? [1, 0, 1, 1] : [0, 3, 1, 2, 0, 3, 2, 1]);
    const scores = scoreMeasure(m, responses);
    s.scoring[a.id] = { uid: a.uid, assignmentId: a.id, measureId: m.id, responses, scores, draft: buildDraft(m, scores), scoredAt: a.completedAt };
  }
  if (!s.results['sample-3']) {
    const items = s.assignments.filter((a) => a.uid === 'sample-3' && s.scoring[a.id]).map((a) => s.scoring[a.id].draft);
    s.results['sample-3'] = { uid: 'sample-3', releasedAt: now() - 7 * 24 * 60 * 60 * 1000, releasedBy: 'sarah', items };
  }
  write();
}

// ---------- client actions ----------

// Firebase Authentication: create the login.
export function signUp({ name, email, password }) {
  const errors = {};
  if (!String(name ?? '').trim()) errors.name = 'Enter your first name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? ''))) errors.email = 'Enter an email address in the format name@example.com';
  if (String(password ?? '').length < 8) errors.password = 'Use 8 or more characters.';
  if (Object.keys(errors).length) return { ok: false, errors };
  const s = read();
  s.session = { signedIn: true, uid: DEMO_UID, attempts: 0 };
  s.clients[DEMO_UID] = { uid: DEMO_UID, name: name.trim(), email: email.trim(), clientType: null, journeyStage: null, activatedAt: null, consentAt: null, consentVersion: null, retentionUntil: null, lastActive: now() };
  write();
  return { ok: true };
}

// redeemActivationCode: 12 characters, single use, valid for 30 days,
// limited attempts.
export function redeemCode(input) {
  const s = read();
  if (s.session.attempts >= 5) return { ok: false, error: 'Too many attempts. Ask Sarah to check your code, then try again later.' };
  const code = normaliseCode(input);
  if (code.length !== 12) return { ok: false, error: 'Activation codes have 12 letters and numbers. Check the code in Sarah\'s email.' };
  const record = s.codes.find((c) => c.code === code);
  s.session.attempts += 1;
  if (!record) {
    write();
    return { ok: false, error: 'That code was not recognised. Check it against Sarah\'s email.' };
  }
  if (record.redeemedByUid && record.redeemedByUid !== s.session.uid) return { ok: false, error: 'That code has already been used. Ask Sarah for a new one.' };
  if (record.expiresAt < now()) return { ok: false, error: 'That code has expired. Ask Sarah for a new one.' };
  record.redeemedByUid = s.session.uid;
  record.redeemedAt = now();
  const client = s.clients[s.session.uid];
  client.pendingType = record.clientTypeOverride;
  s.session.attempts = 0;
  audit(s.session.uid, 'redeemed code', s.session.uid);
  write();
  return { ok: true };
}

// saveProfile: consent record with the version of the notice shown.
export function recordConsent(version) {
  const s = read();
  const c = s.clients[s.session.uid];
  c.consentAt = now();
  c.consentVersion = version;
  write();
}

// submitIntake: stores answers and sets the client type.
export function submitIntake(intakeConfig, answers) {
  const errors = validateIntake(intakeConfig, answers);
  if (Object.keys(errors).length) return { ok: false, errors };
  const s = read();
  const uid = s.session.uid;
  const c = s.clients[uid];
  const derived = deriveClientType(intakeConfig, answers, c.pendingType ?? null);
  s.intake[uid] = { uid, answers, derivedType: derived.type, source: derived.source, submittedAt: now() };
  c.clientType = derived.type;
  c.journeyStage = 'assessment';
  c.activatedAt = now();
  delete c.pendingType;
  // The pilot assigns both sample questionnaires on activation.
  let order = 1;
  for (const m of allMeasures()) {
    s.assignments.push({ id: id('a'), uid, measureId: m.id, status: 'notStarted', order: order++, assignedAt: now(), completedAt: null });
  }
  write();
  return { ok: true, type: derived.type };
}

export function clientAssignments(uid) {
  return read().assignments.filter((a) => a.uid === uid).sort((a, b) => a.order - b.order);
}

export function responsesFor(assignmentId) {
  return read().scoring[assignmentId]?.responses ?? {};
}

// submitMeasure: saves each answer as it is given.
export function saveResponse(assignmentId, itemId, value) {
  const s = read();
  const a = s.assignments.find((x) => x.id === assignmentId);
  if (!a || a.status === 'complete') return;
  const record = (s.scoring[assignmentId] ??= { uid: a.uid, assignmentId, measureId: a.measureId, responses: {}, scores: null, draft: null, scoredAt: null });
  record.responses[itemId] = value;
  a.status = 'inProgress';
  s.clients[a.uid].lastActive = now();
  write();
}

// scoreMeasure and triggerBooking: scores the finished questionnaire as a
// draft, and moves the client to booking when the last one is done.
export function completeAssignment(assignmentId) {
  const s = read();
  const a = s.assignments.find((x) => x.id === assignmentId);
  const m = measure(a.measureId);
  const record = s.scoring[assignmentId];
  const scores = scoreMeasure(m, record.responses);
  if (!scores.complete) return { ok: false, error: 'Please answer every question before finishing.' };
  record.scores = scores;
  record.draft = buildDraft(m, scores);
  record.scoredAt = now();
  a.status = 'complete';
  a.completedAt = now();
  const remaining = s.assignments.filter((x) => x.uid === a.uid && x.status !== 'complete');
  let booking = false;
  if (remaining.length === 0) {
    s.clients[a.uid].journeyStage = 'booking';
    s.booking[a.uid] = { triggeredAt: now() };
    booking = true;
  }
  write();
  return { ok: true, booking };
}

// Access and correction requests under the Health Information Privacy
// Code 2020, rules 6 and 7. Sarah has 20 working days to respond.
export function createRequest(kind, detail) {
  const s = read();
  s.requests.unshift({ id: id('req'), uid: s.session.uid, kind, detail: String(detail ?? '').slice(0, 1000), createdAt: now(), dueBy: addWorkingDays(now(), 20), status: 'open' });
  write();
}

export function signOut() {
  const s = read();
  s.session.signedIn = false;
  write();
}

export function signIn() {
  const s = read();
  if (!s.clients[DEMO_UID]) return false;
  s.session = { signedIn: true, uid: DEMO_UID, attempts: 0 };
  write();
  return true;
}

// ---------- practitioner actions ----------

// issueActivationCode
export function issueCode({ forName, clientTypeOverride }) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 12; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  const s = read();
  s.codes.unshift({ code, clientTypeOverride: clientTypeOverride || null, forName: String(forName ?? '').trim() || 'Unnamed', issuedBy: 'sarah', issuedAt: now(), expiresAt: now() + 30 * DAY, redeemedByUid: null, redeemedAt: null });
  audit('sarah', 'issued code', null);
  write();
  return code;
}

// setClientType
export function setClientType(uid, type) {
  const s = read();
  s.clients[uid].clientType = type || null;
  if (s.intake[uid]) s.intake[uid].overriddenBy = 'sarah';
  audit('sarah', 'corrected client type', uid);
  write();
}

export function setStage(uid, stage) {
  const s = read();
  s.clients[uid].journeyStage = stage;
  audit('sarah', `moved stage to ${stage}`, uid);
  write();
}

// assignMeasure
export function assignMeasure(uid, measureId) {
  const s = read();
  const current = s.assignments.filter((a) => a.uid === uid);
  if (current.some((a) => a.measureId === measureId && a.status !== 'complete')) return;
  s.assignments.push({ id: id('a'), uid, measureId, status: 'notStarted', order: current.length + 1, assignedAt: now(), completedAt: null });
  if (['booking', 'feedback'].includes(s.clients[uid].journeyStage)) s.clients[uid].journeyStage = 'assessment';
  audit('sarah', 'assigned questionnaire', uid);
  write();
}

export function draftsFor(uid) {
  const s = read();
  return s.assignments
    .filter((a) => a.uid === uid && a.status === 'complete' && s.scoring[a.id]?.draft)
    .map((a) => ({ assignment: a, ...s.scoring[a.id] }));
}

// releaseResults: copies the drafts into the client's results document.
export function releaseResults(uid) {
  const s = read();
  const items = draftsFor(uid).map((d) => ({ ...d.draft, status: 'released' }));
  s.results[uid] = { uid, releasedAt: now(), releasedBy: 'sarah', items };
  if (['assessment', 'booking'].includes(s.clients[uid].journeyStage)) s.clients[uid].journeyStage = 'feedback';
  audit('sarah', 'released results', uid);
  write();
}

export function unreleasedCount(uid) {
  const s = read();
  const released = s.results[uid]?.items?.map((i) => i.measureId) ?? [];
  return draftsFor(uid).filter((d) => !released.includes(d.measureId)).length;
}

// Formulation drafts and release.
export function addFactor(uid, zone, text) {
  const s = read();
  const d = (s.formulationDrafts[uid] ??= { uid, factors: [] });
  d.factors.push({ id: id('f'), zone, text: String(text).trim() });
  write();
}

export function removeFactor(uid, factorId) {
  const s = read();
  const d = s.formulationDrafts[uid];
  if (!d) return;
  d.factors = d.factors.filter((f) => f.id !== factorId);
  write();
}

export function releaseFormulation(uid) {
  const s = read();
  const d = s.formulationDrafts[uid];
  if (!d?.factors.length) return;
  s.formulations[uid] = { uid, releasedAt: now(), releasedBy: 'sarah', factors: d.factors.map((f) => ({ ...f })) };
  audit('sarah', 'released formulation', uid);
  write();
}

export function closeRequest(requestId) {
  const s = read();
  const r = s.requests.find((x) => x.id === requestId);
  if (r) r.status = 'done';
  write();
}
