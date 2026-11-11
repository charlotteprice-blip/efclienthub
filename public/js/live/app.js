// Executive Frame Client Hub: live app. Path routed single page app served
// from index.html for every route (firebase.json rewrites).

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from '/assets/vendor/firebase/firebase-auth.js';
import { auth } from '../firebase.js';
import { applyAccent } from '../client-types.js';
import { validateIntake } from '../intake-rules.js';
import { createIdleWatch } from '../idle.js';
import { createJourneyRing } from '../journey-ring.js';
import { createMark } from '../mark.js';
import { esc, fromLocalInput } from '../ui.js';
import { suggestFactors } from '../formulation.js';
import { VIEW_OPTIONS, renderFormulationView, viewOf } from '../formulation-views.js';
import { call, loadClient, loadStaff } from './data.js';
import * as cv from './views-client.js';
import * as sv from './views-staff.js';

const app = document.getElementById('app');
const fetchJson = (url) => fetch(url, { cache: 'no-cache' }).then((r) => r.json());
const [config, clientTypes, intakeConfig] = await Promise.all([fetchJson('/config/app.json'), fetchJson('/config/client-types.json'), fetchJson('/config/intake.json')]);

const S = {
  config,
  clientTypes,
  intakeConfig,
  user: null,
  role: null,
  ctx: null,
  ctxFor: null,
  flash: null,
  errors: {},
  form: {},
  lastIssued: null,
  draftFactors: {},
  draftSummary: {},
  draftView: {},
  testRun: null,
  responseDraft: {},
  sploseSearch: {},
  ready: false,
};

const PUBLIC = ['/signup', '/login', '/reset'];
const STAFF_ROLES = ['practitioner', 'admin'];

// ---------- navigation ----------

export function navigate(path, { replace = false } = {}) {
  if (location.pathname !== path) history[replace ? 'replaceState' : 'pushState']({}, '', path);
  return route();
}

function setFlash(text, error = false) {
  S.flash = { text, error };
}

async function reload() {
  if (!S.user) return;
  S.ctx = STAFF_ROLES.includes(S.role) ? await loadStaff(S.role) : await loadClient(S.user.uid);
  S.ctxFor = S.user.uid;
  S.loadedAt = Date.now();
}

// Fresh data on every page change, except while stepping through the
// questions of 1 questionnaire, where answers are already held locally.
function needsReload(path) {
  if (!S.ctx || S.ctxFor !== S.user.uid) return true;
  const stepping = path.startsWith('/measure/') && S.lastPath?.startsWith('/measure/') && path.split('/')[2] === S.lastPath.split('/')[2];
  return !stepping && Date.now() - (S.loadedAt ?? 0) > 1500;
}

// A page change that waits on fresh data shows a line under the top bar.
function setBusy(on) {
  const viewer = app.querySelector('.viewer');
  if (!viewer) return;
  viewer.toggleAttribute('data-busy', on);
  viewer.querySelector('#workspace')?.setAttribute('aria-busy', String(on));
}

// A selector that finds the same control again after a repaint, so focus
// can return to what the person was using.
const cssEsc = (v) => (window.CSS?.escape ? CSS.escape(v) : String(v).replace(/["\\]/g, '\\$&'));
const dataSel = (el, keys) => keys.filter((k) => el.dataset[k] !== undefined).map((k) => `[data-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="${cssEsc(el.dataset[k])}"]`).join('');
function focusKey(el) {
  if (!el || !app.contains(el)) return null;
  if (el.id) return `#${cssEsc(el.id)}`;
  if (el.dataset.action) return `[data-action="${cssEsc(el.dataset.action)}"]${dataSel(el, ['uid', 'factor', 'id', 'resource', 'index', 'do'])}`;
  const form = el.closest('[data-form]');
  if (!form) return null;
  const f = `[data-form="${cssEsc(form.dataset.form)}"]${dataSel(form, ['uid', 'factor', 'zone', 'measure', 'assignment'])}`;
  if (el.name) return `${f} [name="${cssEsc(el.name)}"]${el.type === 'radio' ? `[value="${cssEsc(el.value)}"]` : ''}`;
  return `${f} button[type="submit"]`;
}
// Called when a control is used, before any repaint that follows.
function noteUsed(el) {
  S.usedKey = focusKey(el);
}

// A repaint of the same page (after a save, an error, a change of drawing)
// keeps the scroll position and returns focus to the control that was
// used. Only a change of page starts again from the top.
function paint(html) {
  const path = location.pathname;
  const ws = app.querySelector('#workspace');
  const keep = S.paintedPath === path && ws ? { top: ws.scrollTop, y: window.scrollY, key: S.usedKey ?? focusKey(document.activeElement) } : null;
  app.innerHTML = html;
  S.paintedPath = path;
  S.usedKey = null;
  S.flash = null;
  S.errors = {};
  afterPaint(keep);
}

function afterPaint(keep) {
  document.documentElement.style.removeProperty('--accent');
  if (S.ctx?.client?.clientType) applyAccent(clientTypes, S.ctx.client.clientType);
  for (const h of app.querySelectorAll('[data-ring]')) {
    h.replaceWith(createJourneyRing({ stageIndex: Number(h.dataset.stage), stageCount: Number(h.dataset.stages), label: h.dataset.label }));
  }
  for (const h of app.querySelectorAll('[data-mark]')) h.replaceWith(createMark({ draw: true, small: false, label: 'Executive Frame' }));
  for (const bar of app.querySelectorAll('[data-progress]')) bar.style.width = `${((Number(bar.dataset.progress) + 1) / Number(bar.dataset.total)) * 100}%`;
  for (const dot of app.querySelectorAll('.type-dot')) {
    const accent = clientTypes.types?.[dot.dataset.type]?.accent;
    if (accent) dot.style.background = accent;
    else dot.classList.add('type-dot-empty');
  }
  const ws = app.querySelector('#workspace');
  if (keep) {
    if (ws) ws.scrollTop = keep.top;
    window.scrollTo(0, keep.y);
  } else {
    ws?.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
  }
  // An error takes focus and is brought into view; a radio group is
  // marked on its fieldset, so focus goes to its first choice.
  const invalid = app.querySelector('[aria-invalid="true"]');
  const invalidControl = invalid?.matches('input, textarea, select') ? invalid : invalid?.querySelector('input:checked, input, textarea, select');
  const used = keep?.key ? app.querySelector(keep.key) : null;
  if (invalidControl) {
    invalidControl.focus({ preventScroll: true });
    (invalidControl.closest('fieldset, .field, .check') ?? invalidControl).scrollIntoView({ block: 'center' });
  } else if (used && !used.disabled) used.focus({ preventScroll: true });
  else ws?.focus({ preventScroll: true });
  const title = app.querySelector('h1')?.textContent?.trim();
  document.title = title ? `${title} · Executive Frame` : 'Executive Frame Client Hub';
}

// Any error while loading or drawing a screen paints a plain message with a
// way forward, in place of a loader that never ends.
async function route() {
  try {
    return await draw();
  } catch (e) {
    console.error(e);
    S.loadedAt = 0;
    return paint(cv.problem(S.user ? 'This page could not be shown. Anything you have already saved is safe.' : 'This page could not be shown.', Boolean(S.user)));
  }
}

async function draw() {
  if (!S.ready) return paint(cv.loader('Loading'));
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const parts = path.split('/').filter(Boolean);

  if (!S.user) {
    if (PUBLIC.includes(path)) return paint({ '/signup': cv.signUp, '/login': cv.logIn, '/reset': cv.reset }[path](S));
    return navigate('/login', { replace: true });
  }
  if (PUBLIC.includes(path)) return navigate('/', { replace: true });

  if (needsReload(path)) {
    if (!S.ctx || S.ctxFor !== S.user.uid) paint(cv.loader());
    else setBusy(true);
    try {
      await reload();
    } catch (e) {
      console.error(e);
      setBusy(false);
      return paint(cv.problem('We could not load your information. Check your connection and try again.', true));
    }
  }
  S.lastPath = path;

  if (path === '/account') return paint(STAFF_ROLES.includes(S.role) ? sv.staffAccount(S) : S.ctx.client?.activatedAt ? cv.account(S) : cv.activate(S));

  // Staff
  if (STAFF_ROLES.includes(S.role)) {
    if (parts[0] !== 'practitioner') return navigate(S.role === 'practitioner' ? '/practitioner' : '/practitioner/codes', { replace: true });
    if (S.role !== 'practitioner' && !['codes', 'library'].includes(parts[1])) return navigate('/practitioner/codes', { replace: true });
    switch (parts[1]) {
      case 'client':
        return paint(sv.client(S, parts[2], parts[3] || 'overview'));
      case 'review':
        return paint(sv.review(S));
      case 'codes':
        return paint(sv.codes(S));
      case 'library':
        if (parts[2] && parts[3] === 'test') return paint(parts[4] === 'result' ? sv.measureTestResult(S, parts[2]) : sv.measureTest(S, parts[2], Number(parts[4] ?? 0)));
        if (parts[2]) return paint(sv.measurePage(S, parts[2]));
        return paint(sv.library(S));
      case 'clients':
        return paint(sv.clients(S));
      default:
        return paint(sv.dashboard(S));
    }
  }

  // Client onboarding gate, as Themescape's membership check.
  const c = S.ctx.client;
  if (parts[0] === 'practitioner') return navigate('/', { replace: true });
  if (!c?.codeHash) return path === '/activate' ? paint(cv.activate(S)) : navigate('/activate', { replace: true });
  if (!c.consentAt) return path === '/consent' ? paint(cv.consent(S)) : navigate('/consent', { replace: true });
  if (!c.activatedAt) return path === '/intake' ? paint(cv.intake(S)) : navigate('/intake', { replace: true });

  switch (parts[0]) {
    case 'questionnaires':
      return paint(cv.questionnaires(S));
    case 'measure':
      return paint(cv.item(S, parts[1], parts[2] !== undefined ? Number(parts[2]) : undefined));
    case 'done':
      return paint(cv.allDone(S));
    case 'results':
      return paint(cv.results(S));
    case 'formulation':
      return paint(cv.formulation(S));
    case 'dashboard':
      return paint(cv.home(S));
    default:
      return navigate('/dashboard', { replace: true });
  }
}

// ---------- auth ----------

// ---------- idle sign out ----------
//
// Clients and staff are logged out after 30 minutes with no activity
// (app.json `idle`), with a warning 1 minute before. The timing rules are
// in ../idle.js. Only the time of the last activity is stored.

const IDLE_KEY = 'ef-hub-last-activity';
function forgetActivity() {
  try {
    localStorage.removeItem(IDLE_KEY);
  } catch {
    // Storage is unavailable; the clock then runs in this tab only.
  }
}
let idleMemory = null;
const idle = createIdleWatch({
  limitMs: (config.idle?.minutes ?? 30) * 60000,
  warnMs: (config.idle?.warnSeconds ?? 60) * 1000,
  read() {
    try {
      return localStorage.getItem(IDLE_KEY) ?? idleMemory;
    } catch {
      return idleMemory;
    }
  },
  write(t) {
    idleMemory = t;
    try {
      localStorage.setItem(IDLE_KEY, String(t));
    } catch {
      // Kept in memory instead.
    }
  },
  onWarn() {
    dialog(`<div class="stack-lg"><h2>Are you still there?</h2><p>Nothing has happened here for a while, so you will be logged out in ${idleWarnText()} to keep your information private.</p><div class="actions"><button type="button" class="btn btn-primary" data-action="stay">Stay logged in</button><button type="button" class="btn btn-secondary" data-action="logout-now">Log out</button></div></div>`);
    const d = document.getElementById('dialog');
    d.setAttribute('role', 'alertdialog');
    S.idleWarning = true;
    // Closing the warning with Escape also means "I am here".
    d.addEventListener('close', () => {
      if (!S.idleWarning) return;
      S.idleWarning = false;
      idle.stay();
    }, { once: true });
  },
  onActive() {
    if (S.idleWarning) closeDialog();
    S.idleWarning = false;
  },
  onExpire() {
    idleLogout();
  },
});
function idleWarnText() {
  const seconds = config.idle?.warnSeconds ?? 60;
  return seconds % 60 === 0 ? `${seconds / 60} minute${seconds === 60 ? '' : 's'}` : `${seconds} seconds`;
}

// Before an idle log out the app saves only a person's own working state
// that it would save anyway: Sarah's formulation summary, which is her
// private draft and saves whenever she leaves the box. Questionnaire
// answers are already saved as they are chosen. Nothing is ever sent to
// the practitioner on a client's behalf: a comment typed on a formulation
// card but not sent is the client's to send or not, so it is let go, and
// it is not kept in the browser either, which may be a shared computer.
async function saveTyped() {
  if (!S.ctx || S.role !== 'practitioner') return;
  const summary = app.querySelector('[data-form="formulation-summary"] [name="summary"]');
  if (!summary) return;
  const form = summary.closest('form');
  const uid = form.dataset.uid;
  const saved = S.draftSummary[uid] ?? S.ctx.formulationDrafts?.[uid]?.summary ?? '';
  if (summary.value !== saved) await handlers['formulation-summary']({ summary: summary.value }, form);
}

async function idleLogout() {
  if (!S.user) return;
  const minutes = config.idle?.minutes ?? 30;
  try {
    await saveTyped();
  } catch {
    // Logging out matters more than a save that will not go through.
  }
  closeDialog();
  S.idleWarning = false;
  S.lastIssued = null;
  S.form = {};
  await signOut(auth);
  setFlash(`You were logged out after ${minutes} minutes of no activity, to keep your information private. Everything you saved is still here. Log in to carry on.`);
  navigate('/login');
}

for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) document.addEventListener(type, () => idle.activity(), { capture: true, passive: true });
document.addEventListener('scroll', () => idle.activity(), { capture: true, passive: true });
setInterval(() => idle.check(), 5000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) idle.check();
});
window.addEventListener('focus', () => idle.check());

onAuthStateChanged(auth, async (user) => {
  S.user = user;
  S.role = null;
  S.ctx = null;
  if (user) {
    const token = await user.getIdTokenResult();
    S.role = token.claims.role ?? null;
  }
  S.ready = true;
  // The idle clock runs only while someone is signed in. A fresh log in
  // starts it; a session the browser kept is judged by its last activity.
  if (user) {
    const fresh = S.freshLogin;
    S.freshLogin = false;
    if (idle.start({ fresh }) === 'expired') return;
  } else {
    idle.stop();
    forgetActivity();
  }
  route();
});

const AUTH_MESSAGES = {
  'auth/email-already-in-use': ['email', 'An account already uses this email, perhaps for the Learning Hub. Log in instead.'],
  'auth/invalid-email': ['email', 'Enter an email address in the format name@example.com'],
  'auth/weak-password': ['password', 'Use 8 or more characters.'],
  'auth/invalid-credential': ['password', 'That email and password do not match.'],
  'auth/wrong-password': ['password', 'That email and password do not match.'],
  'auth/user-not-found': ['password', 'That email and password do not match.'],
  'auth/too-many-requests': ['password', 'Too many attempts. Wait a few minutes, or reset your password.'],
  'auth/network-request-failed': ['email', 'Could not reach the server. Check your connection.'],
};
function authError(e) {
  const [field, text] = AUTH_MESSAGES[e?.code] ?? ['email', 'Something went wrong. Please try again.'];
  return { [field]: text };
}

// ---------- busy buttons ----------

// What a button says while its work is under way, by form or action name.
const BUSY_LABELS = {
  login: 'Logging in',
  signup: 'Creating your account',
  reset: 'Sending',
  activate: 'Checking your code',
  consent: 'Saving',
  correction: 'Sending',
  'request-access': 'Sending',
  'issue-code': 'Issuing',
  'search-splose': 'Searching',
  'link-splose': 'Linking',
  'splose-pick': 'Linking',
  'splose-sync': 'Refreshing',
  'splose-unlink-confirm': 'Unlinking',
  'assign-to': 'Assigning',
  assign: 'Assigning',
  schedule: 'Saving',
  'release-confirm': 'Releasing',
  'release-formulation-confirm': 'Releasing',
  'remove-factor': 'Removing',
  'remove-resource': 'Removing',
  'add-factor': 'Adding',
  'add-suggestion': 'Adding',
  'add-resource': 'Adding',
};

async function busy(el, fn) {
  const button = el?.matches?.('form') ? el.querySelector('button[type="submit"]') : el;
  const label = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = BUSY_LABELS[el.dataset.form ?? el.dataset.action] ?? 'Saving';
  }
  try {
    return await fn();
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
      button.textContent = label;
    }
  }
}

// ---------- forms ----------

const handlers = {
  async signup(data) {
    S.form.signup = { name: data.name, email: data.email };
    const errors = {};
    if (!String(data.name ?? '').trim()) errors.name = 'Enter your first name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email ?? ''))) errors.email = 'Enter an email address in the format name@example.com';
    if (String(data.password ?? '').length < 8) errors.password = 'Use 8 or more characters.';
    if (Object.keys(errors).length) {
      S.errors = errors;
      return route();
    }
    try {
      S.freshLogin = true;
      const cred = await createUserWithEmailAndPassword(auth, data.email.trim(), data.password);
      await updateProfile(cred.user, { displayName: data.name.trim() });
      S.form = {};
    } catch (e) {
      S.freshLogin = false;
      S.errors = authError(e);
      return route();
    }
    return undefined; // onAuthStateChanged routes on
  },
  async login(data) {
    S.form.login = { email: data.email };
    try {
      S.freshLogin = true;
      await signInWithEmailAndPassword(auth, String(data.email ?? '').trim(), String(data.password ?? ''));
      S.form = {};
    } catch (e) {
      S.freshLogin = false;
      S.errors = authError(e);
      return route();
    }
    return undefined;
  },
  async reset(data) {
    try {
      await sendPasswordResetEmail(auth, String(data.email ?? '').trim());
    } catch {
      // Same message either way, so the form does not reveal who has an account.
    }
    setFlash('If an account uses that email, a reset link is on its way. Check your inbox and spam folder.');
    return navigate('/login');
  },
  async activate(data) {
    S.form.code = data.code;
    try {
      await call('redeemActivationCode', { code: data.code, name: S.user.displayName ?? '' });
    } catch (e) {
      S.errors = { code: e.message };
      return route();
    }
    S.form = {};
    await reload();
    return navigate('/consent');
  },
  async consent(data) {
    if (!data.agree) {
      S.errors = { consent: 'Tick the box to agree before you continue.' };
      return route();
    }
    await call('recordConsent', { version: config.consentVersion });
    await reload();
    return navigate('/intake');
  },
  async intake(data) {
    S.form.intake = data;
    const errors = validateIntake(intakeConfig, data);
    if (Object.keys(errors).length) {
      S.errors = errors;
      return route();
    }
    paint(cv.loader('Setting up your Client Hub'));
    await call('submitIntake', { answers: data });
    S.form = {};
    await reload();
    return navigate('/dashboard');
  },
  async item(data, form) {
    const a = S.ctx.assignments.find((x) => x.id === form.dataset.assignment);
    const m = S.ctx.measures[a.measureId];
    const index = Number(form.dataset.index);
    if (data.answer === undefined) {
      S.errors = { item: 'Choose an answer to continue.' };
      return route();
    }
    await saveAnswer(a, m.items[index].id, Number(data.answer));
    if (index < m.items.length - 1) return navigate(`/measure/${a.id}/${index + 1}`);
    const r = await call('submitMeasure', { assignmentId: a.id });
    await reload();
    if (r.booking) return navigate('/done');
    setFlash(`${m.name} is finished. Thank you.`);
    return navigate('/dashboard');
  },
  async correction(data) {
    if (!String(data.detail ?? '').trim()) {
      S.errors = { detail: 'Tell Sarah what is wrong and what it should say.' };
      return route();
    }
    await call('createRequest', { kind: 'correction', detail: data.detail });
    setFlash('Your correction request has been sent to Sarah.');
    await reload();
    return route();
  },
  async 'issue-code'(data) {
    const r = await call('issueActivationCode', data);
    S.lastIssued = { ...r, forName: S.role === 'practitioner' ? data.forName || 'Unnamed' : '' };
    await reload();
    return route();
  },
  async 'next-session'(data, form) {
    const uid = form.dataset.uid;
    const at = fromLocalInput(data.at);
    if (data.at && !Number.isFinite(at)) {
      S.errors.session = 'Enter a date and time.';
      return route();
    }
    await call('setNextSession', { uid, at, note: data.note ?? '' });
    setFlash(at ? 'Next session saved. The client sees it on their Home.' : 'Next session cleared.');
    await reload();
    return route();
  },
  async 'link-splose'(data, form) {
    return linkSplose(form.dataset.uid, data.patientId, Boolean(data.confirm));
  },
  // Search Splose by name or email; results are held in memory for this page only.
  async 'search-splose'(data, form) {
    const uid = form.dataset.uid;
    const query = String(data.query ?? '').trim();
    if (!query) return undefined;
    try {
      S.sploseSearch[uid] = await call('searchSplosePatients', { query });
    } catch (e) {
      S.sploseSearch[uid] = { query, results: [] };
      S.errors.splose = e.message;
    }
    return route();
  },
  async 'add-resource'(data, form) {
    const uid = form.dataset.uid;
    const title = String(data.title ?? '').trim();
    const url = String(data.url ?? '').trim();
    if (!title || !/^https:\/\/\S+$/.test(url)) {
      S.errors.resource = 'A title and an https link are needed.';
      return route();
    }
    const current = S.ctx.clients[uid]?.resources ?? [];
    await call('setResources', { uid, resources: [...current, { id: `r${Date.now().toString(36)}`, title, url, note: data.note ?? '' }] });
    setFlash('Resource added.');
    await reload();
    return route();
  },
  async 'set-type'(data, form) {
    await call('setClientType', { uid: form.dataset.uid, type: data.type });
    setFlash('Client type saved. The client now sees the matching wording and accent.');
    await reload();
    return route();
  },
  async 'set-stage'(data, form) {
    await call('setStage', { uid: form.dataset.uid, stage: data.stage });
    setFlash('Journey stage saved.');
    await reload();
    return route();
  },
  async 'assign-to'(data, form) {
    if (!data.uid) return undefined;
    await call('assignMeasure', { uid: data.uid, measureId: form.dataset.measure });
    const who = S.ctx.clients[data.uid]?.name ?? 'the client';
    setFlash(`Assigned to ${who}. It now shows on their Home.`);
    await reload();
    return route();
  },
  // Test run answers live only in memory.
  'test-item'(data, form) {
    const id = form.dataset.measure;
    const m = S.ctx.measures[id];
    const index = Number(form.dataset.index);
    if (data.answer === undefined) {
      S.errors = { item: 'Choose an answer to continue.' };
      return route();
    }
    if (S.testRun?.measureId !== id) S.testRun = { measureId: id, responses: {} };
    S.testRun.responses[m.items[index].id] = Number(data.answer);
    if (index < m.items.length - 1) return navigate(`/practitioner/library/${id}/test/${index + 1}`);
    return navigate(`/practitioner/library/${id}/test/result`);
  },
  async assign(data, form) {
    await call('assignMeasure', { uid: form.dataset.uid, measureId: data.measureId });
    setFlash('Questionnaire assigned. It now shows on the client\'s Home.');
    await reload();
    return route();
  },
  async schedule(data, form) {
    S.form.schedule = data;
    try {
      await call('createSchedule', { uid: form.dataset.uid, measureId: data.measureId, cadence: data.cadence, startsOn: data.startsOn, endsOn: data.endsOn, dates: data.dates });
    } catch (e) {
      S.errors = { schedule: e.message };
      return route();
    }
    S.form = {};
    setFlash('Check in scheduled. The questionnaire will reach the client on each date.');
    await reload();
    return route();
  },
  async 'add-factor'(data, form) {
    const text = String(data.text ?? '').trim();
    if (!text) return undefined;
    const uid = form.dataset.uid;
    const current = S.draftFactors[uid] ?? S.ctx.formulationDrafts[uid]?.factors ?? [];
    const factors = [...current, { id: `f${Date.now().toString(36)}`, zone: form.dataset.zone, text }];
    await saveFormulation(uid, factors);
    return route();
  },
  async 'formulation-summary'(data, form) {
    const uid = form.dataset.uid;
    const current = S.draftFactors[uid] ?? S.ctx.formulationDrafts[uid]?.factors ?? [];
    await saveFormulation(uid, current, String(data.summary ?? ''));
    return undefined;
  },
  // The client's response to 1 factor on their released formulation. Save
  // sends the comment; the fit choice has already saved itself on change.
  'factor-response'(_data, form) {
    return saveFactorResponse(form);
  },
};

// Saves 1 card's fit and comment and says so beside the card. The page is
// not repainted, so the client keeps their place; only the picture above
// is redrawn with the new mark.
async function saveFactorResponse(form) {
  const factorId = form.dataset.factor;
  const fit = form.querySelector('input[name="fit"]:checked')?.value ?? null;
  const comment = String(form.querySelector('[name="comment"]')?.value ?? '').trim();
  const note = form.querySelector('[data-saved]');
  if (!fit && !comment) {
    if (note) note.textContent = 'Choose an answer or write a comment first.';
    return undefined;
  }
  try {
    await call('respondToFormulation', { factorId, fit, comment });
  } catch (e) {
    if (note) note.textContent = `Not saved. ${e.message}`;
    return undefined;
  }
  S.ctx.formulationResponses[factorId] = { fit, comment, at: Date.now() };
  if (note) note.textContent = 'Saved. Sarah will see this.';
  const picture = app.querySelector('[data-formulation-picture]');
  const f = S.ctx.formulation;
  if (picture && f) picture.innerHTML = renderFormulationView(f.view, f.factors, S.ctx.formulationResponses);
  return undefined;
}

// Links a hub client to a Splose patient. On an email mismatch the id stays
// in the form so Sarah can tick Link anyway.
async function linkSplose(uid, patientId, confirm) {
  try {
    await call('linkSplosePatient', { uid, patientId, confirm });
  } catch (e) {
    S.form.splosePatientId = patientId;
    S.errors.splose = e.message;
    return route();
  }
  S.form.splosePatientId = '';
  delete S.sploseSearch[uid];
  setFlash('Linked to Splose. Progress refreshes every 15 minutes, or sooner with Resync now.');
  await reload();
  return route();
}

async function saveFormulation(uid, factors, summary, view) {
  const text = summary ?? S.draftSummary[uid] ?? S.ctx.formulationDrafts[uid]?.summary ?? '';
  const pick = view ?? S.draftView[uid] ?? S.ctx.formulationDrafts[uid]?.view ?? 'grid';
  await call('saveFormulationDraft', { uid, factors, summary: text, view: pick });
  S.draftFactors[uid] = factors;
  S.draftSummary[uid] = text;
  S.draftView[uid] = pick;
  if (S.ctx.formulationDrafts[uid]) Object.assign(S.ctx.formulationDrafts[uid], { view: pick, updatedAt: Date.now() });
  else S.ctx.formulationDrafts[uid] = { uid, factors, summary: text, view: pick, updatedAt: Date.now() };
}

async function saveAnswer(a, itemId, value) {
  a.responses = { ...(a.responses ?? {}), [itemId]: value };
  a.status = 'inProgress';
  await call('saveResponse', { assignmentId: a.id, itemId, value });
}

document.addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
  const handler = handlers[form.dataset.form];
  if (!handler) return;
  noteUsed(form.contains(document.activeElement) && document.activeElement.matches('input, textarea, select') ? document.activeElement : event.submitter ?? form.querySelector('button[type="submit"]'));
  const data = Object.fromEntries(new FormData(form));
  try {
    await busy(form, () => handler(data, form));
  } catch (e) {
    setFlash(e.message || 'Something went wrong. Please try again.', true);
    route();
  }
});

// ---------- buttons and links ----------

function dialog(html) {
  let d = document.getElementById('dialog');
  if (!d) {
    d = document.createElement('dialog');
    d.id = 'dialog';
    d.className = 'dialog';
    document.body.append(d);
  }
  d.innerHTML = html;
  d.removeAttribute('role');
  // The heading names the dialog for a screen reader.
  const heading = d.querySelector('h2');
  if (heading) {
    heading.id = 'dialog-title';
    d.setAttribute('aria-labelledby', 'dialog-title');
  } else d.removeAttribute('aria-labelledby');
  if (!d.open) d.showModal();
}
const closeDialog = () => document.getElementById('dialog')?.close();

// The phone menu drawer. 1 place opens and closes it, so its state, its
// name and focus always agree: open moves focus into the drawer and takes
// the page behind out of reach; close hands focus back to the menu button.
function setMenu(open, { returnFocus = true } = {}) {
  const viewer = app.querySelector('.viewer');
  if (!viewer || (viewer.dataset.menu === 'open') === open) return;
  const button = viewer.querySelector('.menu-button');
  viewer.dataset.menu = open ? 'open' : 'closed';
  button?.setAttribute('aria-expanded', String(open));
  button?.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  for (const el of viewer.querySelectorAll('.topbar, .workspace')) el.inert = open;
  if (open) viewer.querySelector('.sidebar .nav-link[aria-current="page"], .sidebar .nav-link')?.focus();
  else if (returnFocus) button?.focus();
}

const actions = {
  menu() {
    setMenu(app.querySelector('.viewer')?.dataset.menu !== 'open');
  },
  book() {
    const contact = cv.contactLink(S);
    dialog(`<div class="stack-lg"><h2>Book your feedback session</h2><p>Sarah's online booking page is not connected yet. To book your feedback session, ${contact ? `email Sarah at ${contact}` : 'contact Sarah'}.</p><div class="actions"><button type="button" class="btn btn-primary" data-action="close">Close</button></div></div>`);
  },
  close: closeDialog,
  stay() {
    idle.stay();
  },
  retry() {
    S.loadedAt = 0;
    return route();
  },
  async 'request-access'(t) {
    const r = await busy(t, () => call('createRequest', { kind: 'access' }));
    setFlash(r?.already ? 'You have already asked for a copy. Sarah will reply by the date shown.' : 'Your request has been sent. Sarah will reply within 20 working days.');
    await reload();
    return route();
  },
  logout() {
    dialog(`<div class="stack-lg"><h2>Log out of the Client Hub?</h2>
      <label class="check"><input type="checkbox" id="clear-browser"><span>This is a shared computer. Clear the Client Hub from this browser.</span></label>
      <div class="actions"><button type="button" class="btn btn-primary" data-action="logout-confirm">Log out</button><button type="button" class="btn btn-secondary" data-action="close">Cancel</button></div></div>`);
  },
  async 'logout-confirm'() {
    const clear = document.getElementById('clear-browser')?.checked;
    closeDialog();
    await signOut(auth);
    if (clear) {
      try {
        localStorage.clear();
        sessionStorage.clear();
        indexedDB.deleteDatabase('firebaseLocalStorageDb');
      } catch {
        // Nothing more to clear.
      }
    }
    S.lastIssued = null;
    setFlash(clear ? 'Logged out and cleared from this browser.' : 'Logged out.');
    return navigate('/login');
  },
  async 'logout-now'() {
    S.idleWarning = false;
    closeDialog();
    await signOut(auth);
    return navigate('/login');
  },
  release(t) {
    const name = S.ctx.clients[t.dataset.uid]?.name || 'the client';
    dialog(`<div class="stack-lg"><h2>Release results to ${esc(name)}?</h2><p>They will see the strengths and areas of focus listed in the draft, with links to the Learning Hub. Scores are not shown to clients. You can release again after later questionnaires.</p><div class="actions"><button type="button" class="btn btn-primary" data-action="release-confirm" data-uid="${esc(t.dataset.uid)}">Release results</button><button type="button" class="btn btn-secondary" data-action="close">Cancel</button></div></div>`);
  },
  async 'release-confirm'(t) {
    await busy(t, () => call('releaseResults', { uid: t.dataset.uid }));
    closeDialog();
    setFlash('Results released. The client can see them now.');
    await reload();
    return route();
  },
  // Release is deliberate: a dialog says who will see it, how many cards
  // and which drawing, before anything is shared (rule 2).
  'release-formulation'(t) {
    const uid = t.dataset.uid;
    const name = S.ctx.clients[uid]?.name || 'the client';
    const draft = S.ctx.formulationDrafts[uid];
    const factors = S.draftFactors[uid] ?? draft?.factors ?? [];
    const view = VIEW_OPTIONS.find((o) => o.id === viewOf(S.draftView[uid] ?? draft?.view));
    const again = Boolean(S.ctx.formulations[uid]?.releasedAt);
    dialog(`<div class="stack-lg"><h2>${again ? 'Release the updated formulation' : 'Release the formulation'} to ${esc(name)}?</h2>
      <p>${esc(name)} will see ${factors.length} card${factors.length === 1 ? '' : 's'}${(S.draftSummary[uid] ?? draft?.summary) ? ' and your summary' : ''}, drawn as ${esc(view.label)}. It appears in their menu straight away${again ? ' and replaces the version they have now' : ''}.</p>
      <p class="t-caption">A released formulation cannot be withdrawn from the hub. You can release a corrected version at any time.</p>
      <div class="actions"><button type="button" class="btn btn-primary" data-action="release-formulation-confirm" data-uid="${esc(uid)}">Release formulation</button><button type="button" class="btn btn-secondary" data-action="close">Cancel</button></div></div>`);
  },
  async 'release-formulation-confirm'(t) {
    await busy(t, () => call('releaseFormulation', { uid: t.dataset.uid }));
    closeDialog();
    setFlash('Formulation released. It now appears in the client\'s menu.');
    await reload();
    delete S.draftFactors[t.dataset.uid];
    return route();
  },
  async 'remove-factor'(t) {
    const uid = t.dataset.uid;
    const current = S.draftFactors[uid] ?? S.ctx.formulationDrafts[uid]?.factors ?? [];
    const factors = current.filter((f) => f.id !== t.dataset.factor);
    await busy(t, () => saveFormulation(uid, factors));
    return route();
  },
  async 'clear-session'(t) {
    await busy(t, () => call('setNextSession', { uid: t.dataset.uid, at: null }));
    setFlash('Next session cleared.');
    await reload();
    return route();
  },
  'splose-pick'(t) {
    return busy(t, () => linkSplose(t.dataset.uid, t.dataset.id, false));
  },
  async 'splose-sync'(t) {
    const r = await busy(t, () => call('syncSploseClient', { uid: t.dataset.uid }));
    setFlash(r.already ? 'Refreshed from Splose less than a minute ago.' : 'Refreshed from Splose.');
    await reload();
    return route();
  },
  'splose-unlink'(t) {
    const name = S.ctx.clients[t.dataset.uid]?.name || 'the client';
    dialog(`<div class="stack-lg"><h2>Unlink ${esc(name)} from Splose?</h2><p>The appointment and form details read from Splose are removed from the hub. Nothing changes in Splose. You can link again later.</p><div class="actions"><button type="button" class="btn btn-primary" data-action="splose-unlink-confirm" data-uid="${esc(t.dataset.uid)}">Unlink</button><button type="button" class="btn btn-secondary" data-action="close">Cancel</button></div></div>`);
  },
  async 'splose-unlink-confirm'(t) {
    await busy(t, () => call('unlinkSplosePatient', { uid: t.dataset.uid }));
    closeDialog();
    setFlash('Unlinked from Splose.');
    await reload();
    return route();
  },
  async 'remove-resource'(t) {
    const uid = t.dataset.uid;
    const current = (S.ctx.clients[uid]?.resources ?? []).filter((r) => r.id !== t.dataset.resource);
    await busy(t, () => call('setResources', { uid, resources: current }));
    await reload();
    return route();
  },
  async 'add-suggestion'(t) {
    const uid = t.dataset.uid;
    const current = S.draftFactors[uid] ?? S.ctx.formulationDrafts[uid]?.factors ?? [];
    const pick = suggestFactors(S.ctx.results[uid], current)[Number(t.dataset.index)];
    if (!pick) return route();
    const factors = [...current, { id: `f${Date.now().toString(36)}`, zone: pick.zone, text: pick.text, source: pick.source }];
    await busy(t, () => saveFormulation(uid, factors));
    return route();
  },
  async schedule(t) {
    const verbs = { pause: 'Schedule paused.', resume: 'Schedule resumed.', end: 'Schedule ended.' };
    await busy(t, () => call('updateSchedule', { scheduleId: t.dataset.id, action: t.dataset.do }));
    setFlash(verbs[t.dataset.do]);
    await reload();
    return route();
  },
  async 'flags-followed-up'(t) {
    await busy(t, () => call('markFlagsFollowedUp', { assignmentId: t.dataset.id }));
    setFlash('Marked as followed up. The answers stay on the draft.');
    await reload();
    return route();
  },
  async 'close-request'(t) {
    await busy(t, () => call('closeRequest', { requestId: t.dataset.id }));
    await reload();
    return route();
  },
  async 'copy-code'(t) {
    try {
      await navigator.clipboard.writeText(t.dataset.code);
      t.textContent = 'Copied';
    } catch {
      t.textContent = 'Select the code above to copy it';
    }
  },
};

document.addEventListener('click', async (event) => {
  if (app.querySelector('.viewer[data-menu="open"]') && !event.target.closest('.sidebar, .menu-button')) setMenu(false);

  const link = event.target.closest('a[href^="/"]');
  if (link && !link.target && !event.metaKey && !event.ctrlKey && !/^\/(sample|preview|styleguide|assets)/.test(link.getAttribute('href'))) {
    event.preventDefault();
    return navigate(link.getAttribute('href'));
  }
  const t = event.target.closest('[data-action]');
  if (!t || !actions[t.dataset.action]) return undefined;
  if (app.contains(t)) noteUsed(t);
  try {
    return await actions[t.dataset.action](t);
  } catch (e) {
    closeDialog();
    setFlash(e.message || 'Something went wrong. Please try again.', true);
    return route();
  }
});

// Library filters narrow the table in place; nothing is sent anywhere.
function applyFilters(form) {
  const q = form.q.value.trim().toLowerCase();
  const domain = form.domain.value;
  const audience = form.audience.value;
  const licence = form.licence.value;
  const tag = form.tag ? form.tag.value : '';
  let shown = 0;
  for (const row of app.querySelectorAll('[data-row]')) {
    const ok = (!q || row.dataset.search.includes(q)) && (!domain || row.dataset.domain === domain) && (!audience || row.dataset.audience === audience) && (!licence || row.dataset.licence === licence) && (!tag || (row.dataset.tags ?? '').includes(`|${tag}|`));
    row.hidden = !ok;
    if (ok) shown += 1;
  }
  const count = app.querySelector('[data-filter-count]');
  if (count) count.textContent = `${shown} questionnaire${shown === 1 ? '' : 's'}`;
}
document.addEventListener('input', (event) => {
  const form = event.target.closest('[data-filters]');
  if (form) applyFilters(form);
});
document.addEventListener('submit', (event) => {
  if (event.target.closest('[data-filters]')) event.preventDefault();
});
// Column sort: press a heading to sort, press again to reverse.
document.addEventListener('click', (event) => {
  const btn = event.target.closest('button.sort[data-sort]');
  if (!btn) return;
  const th = btn.closest('th');
  const table = btn.closest('table');
  const dir = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
  for (const h of table.querySelectorAll('th')) h.removeAttribute('aria-sort');
  th.setAttribute('aria-sort', dir);
  const key = btn.dataset.sort;
  const numeric = btn.dataset.kind === 'number';
  const body = table.tBodies[0];
  const rows = [...body.querySelectorAll('tr[data-row]')];
  rows.sort((a, b) => {
    const x = a.dataset[key] ?? '';
    const y = b.dataset[key] ?? '';
    const r = numeric ? Number(x) - Number(y) : x.localeCompare(y);
    return dir === 'ascending' ? r : -r;
  });
  for (const row of rows) body.appendChild(row);
});

// Condition and topic buttons: 1 active at a time; pressing the active one returns to All.
document.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip[data-tag]');
  const form = chip?.closest('[data-filters]');
  if (!chip || !form) return;
  const next = chip.getAttribute('aria-pressed') === 'true' && chip.dataset.tag ? '' : chip.dataset.tag;
  for (const c of form.querySelectorAll('.chip[data-tag]')) c.setAttribute('aria-pressed', String(c.dataset.tag === next));
  form.tag.value = next;
  applyFilters(form);
});

// Answers save the moment they are chosen.
document.addEventListener('change', async (event) => {
  const el = event.target;
  if (app.contains(el)) noteUsed(el);
  // A fit choice on a formulation card saves the moment it is chosen.
  if (el.name === 'fit' && el.closest('[data-form="factor-response"]')) {
    saveFactorResponse(el.closest('form'));
    return;
  }
  if (el.name === 'answer' && el.closest('[data-form="item"]')) {
    const form = el.closest('[data-form="item"]');
    const a = S.ctx.assignments.find((x) => x.id === form.dataset.assignment);
    const itemId = S.ctx.measures[a.measureId].items[Number(form.dataset.index)].id;
    saveAnswer(a, itemId, Number(el.value)).catch((e) => {
      setFlash(`Your answer was not saved. ${e.message}`, true);
      route();
    });
  }
  if (el.closest('[data-filters]')) applyFilters(el.closest('[data-filters]'));
  if (el.name === 'cadence' && el.closest('[data-form="schedule"]')) {
    const form = el.closest('form');
    const dates = el.value === 'dates';
    for (const block of form.querySelectorAll('[data-cadence-fields]')) block.hidden = (block.dataset.cadenceFields === 'dates') !== dates;
  }
  // Sarah moves a draft factor to another zone.
  if (el.dataset.moveFactor) {
    const uid = el.dataset.uid;
    const current = S.draftFactors[uid] ?? S.ctx.formulationDrafts[uid]?.factors ?? [];
    const factors = current.map((f) => (f.id === el.dataset.moveFactor ? { ...f, zone: el.value } : f));
    saveFormulation(uid, factors)
      .then(route)
      .catch((e) => {
        setFlash(`The move was not saved. ${e.message}`, true);
        route();
      });
  }
  // Picking a different drawing saves straight away and redraws.
  if (el.dataset.formulationView !== undefined) {
    const uid = el.dataset.uid;
    const factors = S.draftFactors[uid] ?? S.ctx.formulationDrafts[uid]?.factors ?? [];
    saveFormulation(uid, factors, undefined, el.value)
      .then(() => route())
      .catch((e) => setFlash(`The picture was not saved. ${e.message}`, true));
    return;
  }
  // The summary saves when Sarah leaves the box.
  if (el.name === 'summary' && el.closest('[data-form="formulation-summary"]')) {
    const form = el.closest('form');
    handlers['formulation-summary']({ summary: el.value }, form).catch((e) => {
      setFlash(`The summary was not saved. ${e.message}`, true);
      route();
    });
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenu(false);
  const form = app.querySelector('[data-form="item"], [data-form="test-item"]');
  if (!form || event.target.matches('input[type="text"], input[type="email"], textarea, select')) return;
  const n = Number(event.key);
  const radios = [...form.querySelectorAll('input[name="answer"]')];
  if (n >= 1 && n <= radios.length) {
    radios[n - 1].checked = true;
    radios[n - 1].focus();
    radios[n - 1].dispatchEvent(new Event('change', { bubbles: true }));
  }
});

window.addEventListener('popstate', route);
route();
