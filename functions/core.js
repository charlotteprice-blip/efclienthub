// Pure rules used by the Cloud Functions. No Firebase imports, so every
// decision here is unit tested in tests/unit/functions-core.test.js.

import { createHash, randomInt } from 'node:crypto';

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 12;
export const CODE_DAYS = 30;
export const ROLES = ['practitioner', 'admin'];
export const STAGES = ['enquiry', 'firstSession', 'assessment', 'booking', 'feedback', 'intervention', 'review'];
export const REQUEST_KINDS = ['access', 'correction'];
export const ZONES = ['predisposing', 'precipitating', 'maintaining', 'protective'];
export const REDEEM_LIMIT = { attempts: 10, windowMs: 60 * 60 * 1000 };
const DAY = 24 * 60 * 60 * 1000;

export function normaliseCode(input) {
  return String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hashCode(code) {
  return createHash('sha256').update(normaliseCode(code)).digest('hex');
}

export function generateCode(rand = randomInt) {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) code += CODE_ALPHABET[rand(CODE_ALPHABET.length)];
  return code;
}

export const formatCode = (code) => normaliseCode(code).replace(/(.{4})(?=.)/g, '$1-');

export function codeExpiry(now) {
  return now + CODE_DAYS * DAY;
}

// Checks a stored activation code against the person redeeming it.
// Returns null when the code may be redeemed, otherwise a client facing
// message.
export function codeProblem(record, { uid, email, now }) {
  if (!record) return 'That code was not recognised. Check it against Sarah\'s email.';
  if (record.redeemedByUid && record.redeemedByUid !== uid) return 'That code has already been used. Ask Sarah for a new one.';
  if (record.expiresAt <= now) return 'That code has expired. Ask Sarah for a new one.';
  if (record.email && String(record.email).toLowerCase() !== String(email ?? '').toLowerCase()) {
    return 'That code was issued for a different email address. Sign in with the address Sarah sent it to.';
  }
  return null;
}

// Simple sliding window: at most REDEEM_LIMIT.attempts per hour per account.
export function nextAttemptState(state, now) {
  const fresh = !state || now - state.windowStart > REDEEM_LIMIT.windowMs;
  const next = fresh ? { windowStart: now, count: 1 } : { windowStart: state.windowStart, count: state.count + 1 };
  return { next, blocked: next.count > REDEEM_LIMIT.attempts };
}

export function addWorkingDays(start, days) {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return d.getTime();
}

export function validResponse(measure, itemId, value) {
  if (!measure?.items?.some((i) => i.id === itemId)) return false;
  return measure.responseOptions.some((o) => Number(o.value) === Number(value));
}

// Who may assign a measure. Commercial or unlicensed instruments are never
// assignable; sample measures only when the project allows them for testing.
export function assignable(measure, { allowSample }) {
  if (!measure) return false;
  if (measure.licenceStatus === 'cleared') return true;
  return measure.licenceStatus === 'sample' && allowSample;
}

// Stage after release: clients still in assessment or booking move to
// feedback; later stages stay where Sarah put them.
export function stageAfterRelease(stage) {
  return ['assessment', 'booking'].includes(stage) ? 'feedback' : stage;
}

// Builds the released results document from the current drafts, keyed by
// assignment so later releases add to earlier ones.
export function buildRelease(drafts, existingItems = []) {
  const byAssignment = new Map(existingItems.map((i) => [i.assignmentId, i]));
  for (const d of drafts) {
    byAssignment.set(d.assignmentId, {
      assignmentId: d.assignmentId,
      measureId: d.draft.measureId,
      measureName: d.draft.measureName,
      strengths: d.draft.strengths.map(({ subscaleId, label, reason }) => ({ subscaleId, label, reason })),
      focus: d.draft.focus.map(({ subscaleId, label, reason, topic }) => ({ subscaleId, label, reason, topic: topic ?? null })),
    });
  }
  return [...byAssignment.values()];
}

export function cleanFactors(factors) {
  if (!Array.isArray(factors) || factors.length > 60) return null;
  const out = [];
  for (const f of factors) {
    const text = String(f?.text ?? '').trim().slice(0, 140);
    if (!text || !ZONES.includes(f?.zone)) return null;
    out.push({ id: String(f.id ?? '').slice(0, 40) || `f${out.length + 1}`, zone: f.zone, text });
  }
  return out;
}

export function cleanName(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
}
