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
import { createJourneyRing } from '../journey-ring.js';
import { createMark } from '../mark.js';
import { esc } from '../ui.js';
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
  arrangement: null,
  lastIssued: null,
  draftFactors: {},
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

function paint(html) {
  app.innerHTML = html;
  S.flash = null;
  S.errors = {};
  afterPaint();
}

function afterPaint() {
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
  const invalid = app.querySelector('[aria-invalid="true"]');
  if (invalid) invalid.focus();
  else app.querySelector('#workspace')?.focus({ preventScroll: true });
  app.querySelector('#workspace')?.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
  const title = app.querySelector('h1')?.textContent?.trim();
  document.title = title ? `${title} · Executive Frame` : 'Executive Frame Client Hub';
}

async function route() {
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
    try {
      await reload();
    } catch (e) {
      return paint(cv.loader(`Could not load your information. ${e.message}`));
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
        return paint(sv.client(S, parts[2]));
      case 'review':
        return paint(sv.review(S));
      case 'codes':
        return paint(sv.codes(S));
      case 'library':
        return paint(sv.library(S));
      default:
        return paint(sv.clients(S));
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

onAuthStateChanged(auth, async (user) => {
  S.user = user;
  S.role = null;
  S.ctx = null;
  if (user) {
    const token = await user.getIdTokenResult();
    S.role = token.claims.role ?? null;
  }
  S.ready = true;
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

async function busy(el, fn) {
  const button = el?.matches?.('form') ? el.querySelector('button[type="submit"]') : el;
  const label = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = 'Saving';
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
      const cred = await createUserWithEmailAndPassword(auth, data.email.trim(), data.password);
      await updateProfile(cred.user, { displayName: data.name.trim() });
      S.form = {};
    } catch (e) {
      S.errors = authError(e);
      return route();
    }
    return undefined; // onAuthStateChanged routes on
  },
  async login(data) {
    S.form.login = { email: data.email };
    try {
      await signInWithEmailAndPassword(auth, String(data.email ?? '').trim(), String(data.password ?? ''));
      S.form = {};
    } catch (e) {
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
    if (!String(data.detail ?? '').trim()) return undefined;
    await call('createRequest', { kind: 'correction', detail: data.detail });
    setFlash('Your correction request has been sent to Sarah.');
    await reload();
    return route();
  },
  async 'issue-code'(data) {
    const r = await call('issueActivationCode', data);
    S.lastIssued = { ...r, forName: data.forName || 'Unnamed' };
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
    await call('saveFormulationDraft', { uid, factors });
    S.draftFactors[uid] = factors;
    return route();
  },
};

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
  d.showModal();
}
const closeDialog = () => document.getElementById('dialog')?.close();

const actions = {
  menu(t) {
    const viewer = app.querySelector('.viewer');
    const open = viewer.dataset.menu !== 'open';
    viewer.dataset.menu = open ? 'open' : 'closed';
    t.setAttribute('aria-expanded', String(open));
  },
  book() {
    dialog('<div class="stack-lg"><h2>Book your feedback session</h2><p>Sarah\'s online booking page is not connected yet. Contact Sarah to book your feedback session.</p><div class="actions"><button type="button" class="btn btn-primary" data-action="close">Close</button></div></div>');
  },
  close: closeDialog,
  async 'request-access'(t) {
    await busy(t, () => call('createRequest', { kind: 'access' }));
    setFlash('Your request has been sent. Sarah will reply within 20 working days.');
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
    S.arrangement = null;
    S.lastIssued = null;
    setFlash(clear ? 'Logged out and cleared from this browser.' : 'Logged out.');
    return navigate('/login');
  },
  async 'logout-now'() {
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
  async 'release-formulation'(t) {
    await busy(t, () => call('releaseFormulation', { uid: t.dataset.uid }));
    setFlash('Formulation released. It now appears in the client\'s menu.');
    await reload();
    delete S.draftFactors[t.dataset.uid];
    return route();
  },
  async 'remove-factor'(t) {
    const uid = t.dataset.uid;
    const current = S.draftFactors[uid] ?? S.ctx.formulationDrafts[uid]?.factors ?? [];
    const factors = current.filter((f) => f.id !== t.dataset.factor);
    await busy(t, () => call('saveFormulationDraft', { uid, factors }));
    S.draftFactors[uid] = factors;
    return route();
  },
  async schedule(t) {
    const verbs = { pause: 'Schedule paused.', resume: 'Schedule resumed.', end: 'Schedule ended.' };
    await busy(t, () => call('updateSchedule', { scheduleId: t.dataset.id, action: t.dataset.do }));
    setFlash(verbs[t.dataset.do]);
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
  const openViewer = app.querySelector('.viewer[data-menu="open"]');
  if (openViewer && !event.target.closest('.sidebar, .menu-button')) openViewer.dataset.menu = 'closed';

  const link = event.target.closest('a[href^="/"]');
  if (link && !link.target && !event.metaKey && !event.ctrlKey && !/^\/(sample|preview|styleguide|assets)/.test(link.getAttribute('href'))) {
    event.preventDefault();
    return navigate(link.getAttribute('href'));
  }
  const t = event.target.closest('[data-action]');
  if (!t || !actions[t.dataset.action]) return undefined;
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
  let shown = 0;
  for (const row of app.querySelectorAll('[data-row]')) {
    const ok = (!q || row.dataset.search.includes(q)) && (!domain || row.dataset.domain === domain) && (!audience || row.dataset.audience === audience) && (!licence || row.dataset.licence === licence);
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

// Answers save the moment they are chosen; formulation cards move locally.
document.addEventListener('change', async (event) => {
  const el = event.target;
  if (el.name === 'answer') {
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
  if (el.dataset.move && S.arrangement) {
    const f = S.arrangement.factors.find((x) => x.id === el.dataset.move);
    f.zone = el.value;
    route();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    const viewer = app.querySelector('.viewer[data-menu="open"]');
    if (viewer) viewer.dataset.menu = 'closed';
  }
  const form = app.querySelector('[data-form="item"]');
  if (!form || event.target.matches('input[type="text"], input[type="email"], textarea, select')) return;
  const n = Number(event.key);
  const radios = [...form.querySelectorAll('input[name="answer"]')];
  if (n >= 1 && n <= radios.length) {
    radios[n - 1].checked = true;
    radios[n - 1].focus();
    radios[n - 1].dispatchEvent(new Event('change', { bubbles: true }));
  }
});

document.addEventListener('dragstart', (event) => {
  const card = event.target.closest('[data-factor]');
  if (card && S.arrangement) event.dataTransfer.setData('text/plain', card.dataset.factor);
});
document.addEventListener('dragover', (event) => {
  if (event.target.closest('[data-zone]') && S.arrangement) event.preventDefault();
});
document.addEventListener('drop', (event) => {
  const zone = event.target.closest('[data-zone]');
  if (!zone || !S.arrangement) return;
  event.preventDefault();
  const f = S.arrangement.factors.find((x) => x.id === event.dataTransfer.getData('text/plain'));
  if (f) {
    f.zone = zone.dataset.zone;
    route();
  }
});

window.addEventListener('popstate', route);
route();
