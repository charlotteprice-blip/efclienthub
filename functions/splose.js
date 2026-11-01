// Splose: the practice management system Sarah books sessions, sends forms
// and tracks cases in. Two parts, both free of Firebase imports so they are
// unit tested in tests/unit/splose.test.js:
//
// 1. createSploseClient: a small read only client for the Splose API
//    (https://docs.splose.com). The key is a Cloud Functions secret and the
//    browser never calls Splose. The same interface is implemented by
//    tests/support/fake-splose.js for tests and the harness.
// 2. buildProgress: turns a client's appointments, forms and case into the
//    sploseProgress record the client's Home and Sarah's dashboard read.
//    Dates, statuses and counts only. Never pricing, notes or form answers.

const DAY = 24 * 60 * 60 * 1000;
export const ATTENDED = ['Arrived', 'Completed'];
export const MISSED = 'Did not arrive';
export const CANCELLED = 'Cancelled';
export const FORM_STATUSES = ['Incomplete', 'In progress', 'Completed'];
// Journey stages a Splose service can stand for (app.json splose.services).
export const SERVICE_STAGES = ['firstSession', 'feedback', 'intervention', 'review'];
export const USER_AGENT = 'ExecutiveFrameClientHub/1';
export const DEFAULT_BASE_URL = 'https://api.splose.com/v1';
export const MAX_PAGES = 10;

export class SploseError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'SploseError';
    this.status = status;
  }
}

// Reads the whole of a paged endpoint (data plus links.nextPage), counting
// every call so a run can stop inside the 60 a minute limit.
export function createSploseClient({ apiKey, baseUrl = DEFAULT_BASE_URL, fetch = globalThis.fetch, wait = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  if (!apiKey) throw new SploseError('Splose is not connected. The SPLOSE_API_KEY secret is not set.', 0);
  const state = { calls: 0 };

  async function get(path, params = {}) {
    const url = new URL(path.startsWith('http') ? path : `${baseUrl}${path}`);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    let res;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      state.calls += 1;
      res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${apiKey}`, 'User-Agent': USER_AGENT, Accept: 'application/json' } });
      if (res.status !== 429 || attempt === 1) break;
      await wait(2000);
    }
    if (res.status === 401 || res.status === 403) throw new SploseError('Splose refused the API key. Check the key in Splose and the SPLOSE_API_KEY secret.', res.status);
    if (res.status === 429) throw new SploseError('Splose rate limit reached. The next run will continue.', 429);
    if (res.status === 404) throw new SploseError('Not found in Splose.', 404);
    if (!res.ok) throw new SploseError(`Splose returned ${res.status}.`, res.status);
    return res.json();
  }

  async function list(path, params = {}) {
    const out = [];
    let next = null;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const body = await get(next ?? path, next ? {} : params);
      out.push(...(body?.data ?? []));
      next = body?.links?.nextPage || null;
      if (!next) break;
    }
    return out;
  }

  return {
    get calls() {
      return state.calls;
    },
    patient: (id) => get(`/patients/${Number(id)}`),
    appointments: (params) => list('/appointments', params),
    patientForms: (params) => list('/patient-forms', params),
    cases: (params) => list('/cases', params),
    services: () => list('/services'),
  };
}

// ---------- mapping ----------

const ms = (s) => {
  if (!s) return null;
  // Splose times are UTC. submittedAt comes as "YYYY:MM:DD HH:mm:ss" with
  // no zone marker; everything else is ISO.
  let text = String(s).replace(/^(\d{4}):(\d{2}):(\d{2}) /, '$1-$2-$3T');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(text)) text += 'Z';
  const t = Date.parse(text);
  return Number.isFinite(t) ? t : null;
};

export function cleanPatientId(value) {
  const id = Number(String(value ?? '').trim());
  return Number.isInteger(id) && id > 0 && id < 1e12 ? id : null;
}

// Which journey stage a Splose service stands for, or null.
export function serviceStage(config, serviceId) {
  const map = config?.services ?? {};
  for (const stage of SERVICE_STAGES) if ((map[stage] ?? []).map(Number).includes(Number(serviceId))) return stage;
  return null;
}

function summary(a, serviceNames, config) {
  return { at: ms(a.start), service: serviceNames?.[a.serviceId] ?? 'Session', stage: serviceStage(config, a.serviceId) };
}

// The progress record for 1 client. `appointments`, `forms` and `cases`
// are the Splose records for that patient; `serviceNames` maps service id
// to name; `client` is the hub's client document.
export function buildProgress({ patientId, appointments = [], forms = [], cases = [], serviceNames = {}, config = {}, client = {}, now = Date.now() }) {
  const lookback = now - (config.lookbackDays ?? 180) * DAY;
  const mine = [];
  for (const a of appointments) {
    if (a.archived || a.deletedAt) continue;
    const ap = (a.appointmentPatients ?? []).find((p) => Number(p.patientId) === Number(patientId));
    if (!ap) continue;
    const at = ms(a.start);
    if (at === null) continue;
    mine.push({ at, serviceId: a.serviceId, status: ap.status ?? null, stage: serviceStage(config, a.serviceId), raw: a });
  }
  mine.sort((x, y) => x.at - y.at);

  const live = mine.filter((x) => x.status !== CANCELLED);
  const upcoming = live.filter((x) => x.at > now && x.status !== MISSED);
  const attendedList = mine.filter((x) => ATTENDED.includes(x.status));
  const recent = mine.filter((x) => x.at >= lookback && x.at <= now);
  const past = live.filter((x) => x.at <= now);

  const next = upcoming[0] ?? null;
  const last = attendedList.at(-1) ?? null;
  const lastPast = past.at(-1) ?? null;
  const since = client.bookingTriggeredAt ?? 0;
  const feedback = mine.filter((x) => x.stage === 'feedback' && x.status !== CANCELLED && x.at > since);
  const feedbackAttended = feedback.find((x) => ATTENDED.includes(x.status)) ?? null;

  const progress = {
    uid: client.uid ?? null,
    patientId: Number(patientId),
    nextAppointment: next ? summary(next.raw, serviceNames, config) : null,
    lastAttended: last ? summary(last.raw, serviceNames, config) : null,
    lastOutcome: lastPast ? lastPast.status : null,
    attended: recent.filter((x) => ATTENDED.includes(x.status)).length,
    missed: recent.filter((x) => x.status === MISSED).length,
    cancelled: recent.filter((x) => x.status === CANCELLED).length,
    feedbackBookedAt: feedback[0]?.at ?? null,
    feedbackAttendedAt: feedbackAttended?.at ?? null,
    forms: [],
    case: null,
    syncedAt: now,
    error: null,
  };

  if (config.showForms !== false) {
    progress.forms = forms
      .filter((f) => !f.archived)
      .map((f) => ({
        id: Number(f.id),
        title: String(f.title ?? 'Form').slice(0, 120),
        status: FORM_STATUSES.includes(f.status) ? f.status : f.submittedAt ? 'Completed' : 'Incomplete',
        sentAt: ms(f.createdAt),
        submittedAt: ms(f.submittedAt),
      }))
      .sort((a, b) => (b.sentAt ?? 0) - (a.sentAt ?? 0))
      .slice(0, 20);
  }

  if (config.showCase) {
    const open = cases.find((c) => c.isOpen) ?? cases[0];
    if (open) {
      progress.case = {
        isOpen: Boolean(open.isOpen),
        trackType: open.trackType ?? null,
        appointmentCount: open.appointmentCount ?? null,
        hours: open.hours ?? null,
        expiryDate: open.expiryDate ?? null,
      };
    }
  }

  return progress;
}

// A record older than this is shown with its time, never as current.
export function isStale(progress, config = {}, now = Date.now()) {
  if (!progress?.syncedAt) return true;
  return now - progress.syncedAt > (config.staleAfterMinutes ?? 120) * 60 * 1000;
}
