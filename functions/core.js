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
    // Practitioner only measures (screeners) are never copied to the client.
    if (d.draft.clientFacing === false) continue;
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

// ---------- check in schedules ----------
//
// Dates on a schedule are calendar days in New Zealand, stored as
// YYYY-MM-DD strings, so "every 4 weeks from 3 November" means the same
// thing whatever the server's clock zone is.

export const TIME_ZONE = 'Pacific/Auckland';
export const CADENCES = {
  weekly: { label: 'Every week', days: 7 },
  fortnightly: { label: 'Every 2 weeks', days: 14 },
  fourWeekly: { label: 'Every 4 weeks', days: 28 },
  dates: { label: 'On chosen dates', days: 0 },
};
export const SCHEDULE_STATUSES = ['active', 'paused', 'ended'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const nzFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

// The calendar date in New Zealand for a moment in time.
export function nzDate(ms) {
  return nzFormat.format(new Date(ms));
}

export function validDate(s) {
  if (!DATE_RE.test(String(s ?? ''))) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addDays(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Validates what Sarah entered and returns a clean schedule, or a message.
export function scheduleProblem({ cadence, startsOn, endsOn, dates }) {
  if (!CADENCES[cadence]) return 'Choose how often the check in repeats.';
  if (cadence === 'dates') {
    const list = [...new Set((Array.isArray(dates) ? dates : String(dates ?? '').split(/[\s,]+/)).map((x) => String(x).trim()).filter(Boolean))].sort();
    if (!list.length || list.length > 52 || !list.every(validDate)) return 'Enter 1 or more dates as YYYY-MM-DD.';
    return { cadence, dates: list, startsOn: list[0], endsOn: list.at(-1) };
  }
  if (!validDate(startsOn)) return 'Enter the first check in date as YYYY-MM-DD.';
  if (endsOn && !validDate(endsOn)) return 'Enter the last check in date as YYYY-MM-DD, or leave it blank.';
  if (endsOn && endsOn < startsOn) return 'The last date must be on or after the first.';
  return { cadence, dates: null, startsOn, endsOn: endsOn || null };
}

// The due date after `due`, or null when the schedule has run its course.
export function nextDueAfter(schedule, due) {
  if (schedule.cadence === 'dates') return (schedule.dates ?? []).find((d) => d > due) ?? null;
  const next = addDays(due, CADENCES[schedule.cadence].days);
  return schedule.endsOn && next > schedule.endsOn ? null : next;
}

// Where a schedule stands after today's run: the next date still ahead of
// today (missed dates are skipped rather than stacked up), or ended.
export function advanceSchedule(schedule, today) {
  let next = nextDueAfter(schedule, schedule.nextDue);
  while (next && next <= today) next = nextDueAfter(schedule, next);
  return next ? { nextDue: next, status: 'active' } : { nextDue: null, status: 'ended' };
}

// On resume, a date that slipped past while paused comes due today.
export function resumedDue(schedule, today) {
  if (!schedule.nextDue) return null;
  return schedule.nextDue < today ? today : schedule.nextDue;
}
