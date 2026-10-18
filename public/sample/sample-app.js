// Clickable sample of the Executive Frame Client Hub pilot. Hash routed,
// sample data only, no Firebase. Client screens live here; Sarah's screens
// are in sample-practitioner.js.

import clientTypes from '../config/client-types.json' with { type: 'json' };
import intakeConfig from '../config/intake.json' with { type: 'json' };
import sampleMeasures from './sample-measures.json' with { type: 'json' };
import { applyAccent, stageCopy } from '../js/client-types.js';
import { createJourneyRing } from '../js/journey-ring.js';
import { createMark } from '../js/mark.js';
import * as store from './sample-store.js';
import { STAGE_LABELS, clientShell, esc, fieldError, fmtDate, single, status } from '../js/ui.js';
import { renderPractitioner } from './sample-practitioner.js';

export const MARK_SRC = '../assets/brand/mark-slate-small.svg';
const CONSENT_VERSION = 'sample-2026-10';

store.setMeasures(sampleMeasures.measures);
store.primeSampleScores();

const app = document.getElementById('app');
let flash = null;
let errors = {};
let formState = {};

export function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

export function setFlash(message) {
  flash = message;
}

function takeFlash() {
  const f = flash;
  flash = null;
  return f ? `<div class="notice" role="status"><p>${esc(f)}</p></div>` : '';
}

// ---------- client helpers ----------

const me = () => {
  const s = store.state();
  return s.session.uid ? s.clients[s.session.uid] : null;
};

function counts(uid) {
  const list = store.clientAssignments(uid);
  return { outstanding: list.filter((a) => a.status !== 'complete').length, list };
}

function shellFor(active, title, content, mode) {
  const client = me();
  const s = store.state();
  applyAccent(clientTypes, client?.clientType);
  return clientShell({
    title,
    active,
    content,
    client,
    mode,
    markSrc: MARK_SRC,
    counts: counts(client.uid),
    hasFormulation: Boolean(s.formulations[client.uid]?.releasedAt),
  });
}

function measureMeta(a) {
  const m = store.measure(a.measureId);
  const answered = Object.keys(store.responsesFor(a.id)).length;
  if (a.status === 'complete') return `${m.items.length} questions, finished ${fmtDate(a.completedAt)}`;
  if (a.status === 'inProgress') return `${m.items.length} questions, ${m.items.length - answered} left`;
  return `${m.items.length} questions, about ${Math.max(2, Math.round(m.items.length * 0.4))} minutes`;
}

function measureRow(a) {
  const m = store.measure(a.measureId);
  const chip = a.status === 'complete' ? status('done', 'Done') : a.status === 'inProgress' ? status('progress', 'In progress') : status('attention', 'Not started');
  const action = a.status === 'complete' ? '<span></span>' : `<a class="btn btn-secondary" href="#/q/${a.id}">${a.status === 'inProgress' ? 'Continue' : 'Start'}</a>`;
  return `<li class="task"><div><p class="task-name">${esc(m.name)}</p><p class="task-meta">${measureMeta(a)}</p></div>${chip}${action}</li>`;
}

function nextQuestionnaire(uid) {
  return store.clientAssignments(uid).find((a) => a.status !== 'complete');
}

// ---------- onboarding: sign up, log in, activate, consent, intake ----------

function viewSignUp() {
  const v = formState.signup ?? {};
  return single(
    `<div class="stack">
      <h1>Create your account</h1>
      <p>Sarah will have sent you an activation code by email. You will need it in the next step.</p>
    </div>
    <div class="stack">
      <button type="button" class="btn btn-secondary" data-action="social">Continue with Google</button>
      <button type="button" class="btn btn-secondary" data-action="social">Continue with Microsoft</button>
    </div>
    <p class="divider-text">or use your email</p>
    <form class="stack-lg" data-form="signup" novalidate>
      <div class="field${errors.name ? ' field-invalid' : ''}">
        <label class="field-label" for="su-name">First name</label>
        <input class="input" id="su-name" name="name" autocomplete="given-name" value="${esc(v.name)}"${errors.name ? ' aria-invalid="true" aria-describedby="err-name"' : ''}>
        ${fieldError(errors, 'name')}
      </div>
      <div class="field${errors.email ? ' field-invalid' : ''}">
        <label class="field-label" for="su-email">Email</label>
        <input class="input" id="su-email" name="email" type="email" autocomplete="email" value="${esc(v.email)}"${errors.email ? ' aria-invalid="true" aria-describedby="err-email"' : ''}>
        ${fieldError(errors, 'email')}
      </div>
      <div class="field${errors.password ? ' field-invalid' : ''}">
        <label class="field-label" for="su-password">Password</label>
        <span class="field-hint" id="su-password-hint">8 or more characters.</span>
        <input class="input" id="su-password" name="password" type="password" autocomplete="new-password" aria-describedby="su-password-hint${errors.password ? ' err-password' : ''}"${errors.password ? ' aria-invalid="true"' : ''}>
        ${fieldError(errors, 'password')}
      </div>
      <button type="submit" class="btn btn-primary">Create account</button>
    </form>
    <p class="t-caption">Already have an account? <a href="#/login">Log in</a></p>`,
    MARK_SRC,
  );
}

function viewLogIn() {
  const exists = Boolean(store.state().clients[store.DEMO_UID]);
  return single(
    `${takeFlash()}<div class="stack">
      <h1>Log in</h1>
      <p>${exists ? 'Welcome back. In the sample, your account is remembered in this browser.' : 'There is no sample account in this browser yet.'}</p>
    </div>
    ${exists ? '<button type="button" class="btn btn-primary" data-action="login">Log in as your sample account</button>' : '<a class="btn btn-primary" href="#/signup">Create an account</a>'}
    <p class="t-caption">Forgotten your password? In the live app a reset link is emailed from executiveframe.co.nz.</p>`,
    MARK_SRC,
  );
}

function viewActivate() {
  const s = store.state();
  const demo = s.codes.find((c) => c.code === store.DEMO_CODE);
  return single(
    `<div class="stack">
      <h1>Enter your activation code</h1>
      <p>Your code is in the email from Sarah. It has 12 letters and numbers and can be used once.</p>
    </div>
    ${demo && !demo.redeemedByUid ? `<div class="notice sample-hint"><p>Sample code: <strong class="code">${store.formatCode(store.DEMO_CODE)}</strong></p></div>` : ''}
    <form class="stack-lg" data-form="activate" novalidate>
      <div class="field${errors.code ? ' field-invalid' : ''}">
        <label class="field-label" for="code">Activation code</label>
        <input class="input code-input" id="code" name="code" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" value="${esc(formState.code)}"${errors.code ? ' aria-invalid="true" aria-describedby="err-code"' : ''}>
        ${fieldError(errors, 'code')}
      </div>
      <button type="submit" class="btn btn-primary">Continue</button>
    </form>
    <p class="t-caption">No code? Contact Sarah, and she will send you one.</p>`,
    MARK_SRC,
  );
}

function viewConsent() {
  return single(
    `<div class="stack">
      <h1>Before you start</h1>
      <p>Here is what the Client Hub keeps about you and why.</p>
    </div>
    <div class="stack consent-text">
      <h2 class="t-ui-strong">What we collect</h2>
      <p>Your name and email, your answers to the intake and to the questionnaires Sarah asks you to complete, and the results Sarah shares with you.</p>
      <h2 class="t-ui-strong">Why</h2>
      <p>So Sarah can understand how things are for you and plan your sessions together. It is not used for anything else.</p>
      <h2 class="t-ui-strong">Where it is kept</h2>
      <p>Securely with Google Cloud in Sydney, Australia. Sarah, as your psychologist, is responsible for it.</p>
      <h2 class="t-ui-strong">Your rights</h2>
      <p>You can ask to see the information held about you, and ask for it to be corrected, from your Account page at any time.</p>
    </div>
    <form class="stack-lg" data-form="consent" novalidate>
      <label class="check${errors.consent ? ' field-invalid' : ''}">
        <input type="checkbox" name="agree"${errors.consent ? ' aria-invalid="true" aria-describedby="err-consent"' : ''}>
        <span>I have read this and agree to the Client Hub keeping my information as described.</span>
      </label>
      ${fieldError(errors, 'consent')}
      <button type="submit" class="btn btn-primary">Agree and continue</button>
    </form>
    <p class="t-caption">Sample wording for Sarah to approve.</p>`,
    MARK_SRC,
  );
}

function viewIntake() {
  const answers = formState.intake ?? {};
  const questions = intakeConfig.questions.filter((q) => q.enabled);
  const blocks = questions
    .map((q) => {
      const err = errors[q.id];
      if (q.type === 'single') {
        return `<fieldset class="choices${err ? ' field-invalid' : ''}">
          <legend class="t-heading">${esc(q.text)}${q.required ? '' : ' <span class="t-caption">(optional)</span>'}</legend>
          ${q.hint ? `<p class="field-hint">${esc(q.hint)}</p>` : ''}
          ${q.options
            .map((o) => `<label class="choice"><input type="radio" name="${q.id}" value="${esc(o.value)}"${answers[q.id] === o.value ? ' checked' : ''}><span class="choice-dot"></span><span>${esc(o.label)}</span></label>`)
            .join('')}
          ${err ? `<p class="field-error">${esc(err)}</p>` : ''}
        </fieldset>`;
      }
      return `<div class="field${err ? ' field-invalid' : ''}">
        <label class="field-label t-heading" for="iq-${q.id}">${esc(q.text)}${q.required ? '' : ' <span class="t-caption">(optional)</span>'}</label>
        ${q.hint ? `<span class="field-hint">${esc(q.hint)}</span>` : ''}
        <textarea class="textarea" id="iq-${q.id}" name="${q.id}" maxlength="1000">${esc(answers[q.id])}</textarea>
        ${err ? `<p class="field-error">${esc(err)}</p>` : ''}
      </div>`;
    })
    .join('');
  return single(
    `<div class="stack">
      <h1>A few questions to start</h1>
      <p>This helps Sarah set up the Client Hub for you. It takes about a minute.</p>
    </div>
    <form class="stack-lg" data-form="intake" novalidate>${blocks}
      <button type="submit" class="btn btn-primary">Finish setting up</button>
    </form>`,
    MARK_SRC,
  );
}

function viewLoader() {
  return `<main class="single" id="workspace" tabindex="-1"><div class="loader" id="loader"><span data-mark></span><p class="t-ui">Checking your access</p></div></main>`;
}

// ---------- signed in client screens ----------

function viewHome() {
  const c = me();
  const stage = c.journeyStage ?? 'assessment';
  const stages = clientTypes.stages;
  const index = stages.indexOf(stage);
  const copy = stageCopy(clientTypes, c.clientType, stage);
  const next = nextQuestionnaire(c.uid);
  const s = store.state();
  const released = s.results[c.uid]?.releasedAt;

  let action = '';
  if (copy.nextAction === 'measures' && next) action = `<a class="btn btn-primary" href="#/q/${next.id}">${Object.keys(store.responsesFor(next.id)).length ? 'Continue questionnaire' : 'Start questionnaire'}</a>`;
  if (copy.nextAction === 'booking') action = '<button type="button" class="btn btn-primary" data-action="book">Book a session</button>';
  if (copy.nextAction === 'results' || (released && stage === 'feedback')) action = '<a class="btn btn-primary" href="#/results">See your results</a>';

  const list = store.clientAssignments(c.uid);
  return shellFor(
    'home',
    'Home',
    `${takeFlash()}
    <section class="journey-hero" aria-labelledby="stage-title">
      <div data-ring data-stage="${index}" data-stages="${stages.length}" data-label="Step ${index + 1} of ${stages.length}: ${esc(STAGE_LABELS[stage])}"></div>
      <div class="stack">
        <p class="journey-stage">Step ${index + 1} of ${stages.length}</p>
        <h2 class="t-title" id="stage-title">${esc(copy.title)}</h2>
        <p class="reading">${esc(copy.body)}</p>
        ${action ? `<div class="actions">${action}</div>` : ''}
        <ol class="journey-stages" aria-label="Your journey">
          ${stages.map((st, i) => `<li data-state="${i < index ? 'done' : i === index ? 'current' : ''}"${i === index ? ' aria-current="step"' : ''}>${esc(STAGE_LABELS[st])}</li>`).join('')}
        </ol>
      </div>
    </section>
    <section class="stack" aria-labelledby="h-q">
      <h2 id="h-q">Questionnaires</h2>
      ${list.length ? `<ul class="task-list">${list.map(measureRow).join('')}</ul>` : '<p>Sarah has not asked you to complete any questionnaires yet.</p>'}
    </section>
    <section class="stack" aria-labelledby="h-r">
      <h2 id="h-r">Your results</h2>
      ${
        released
          ? `<div class="notice reading"><p>Sarah shared your results on ${fmtDate(released)}. <a href="#/results">See your results</a></p></div>`
          : '<div class="notice reading"><p>Your results will appear here after Sarah has gone through them with you in your feedback session.</p></div>'
      }
    </section>`,
  );
}

function viewQuestionnaires() {
  const c = me();
  const list = store.clientAssignments(c.uid);
  return shellFor(
    'questionnaires',
    'Questionnaires',
    `${takeFlash()}
    <p class="reading">There are no right or wrong answers. Your answers save as you go, so you can stop and come back at any time.</p>
    ${list.length ? `<ul class="task-list">${list.map(measureRow).join('')}</ul>` : '<p>Sarah has not asked you to complete any questionnaires yet.</p>'}`,
  );
}

function viewItem(assignmentId, n) {
  const c = me();
  const a = store.state().assignments.find((x) => x.id === assignmentId && x.uid === c.uid);
  if (!a) return viewQuestionnaires();
  if (a.status === 'complete') {
    setFlash('You have already finished that questionnaire.');
    return viewQuestionnaires();
  }
  const m = store.measure(a.measureId);
  const responses = store.responsesFor(a.id);
  const total = m.items.length;
  let index = Number.isInteger(n) ? n : m.items.findIndex((it) => responses[it.id] === undefined);
  if (index < 0) index = total - 1;
  index = Math.min(Math.max(index, 0), total - 1);
  const item = m.items[index];
  const last = index === total - 1;
  const current = responses[item.id];
  return shellFor(
    'questionnaires',
    m.name,
    `<form class="focus-column stack-lg" data-form="item" data-assignment="${a.id}" data-index="${index}" novalidate>
      <div class="stack">
        <div class="progress" role="progressbar" aria-label="Question ${index + 1} of ${total}" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${index + 1}"><div class="progress-fill" data-progress="${index}" data-total="${total}"></div></div>
        <p class="t-caption">Question ${index + 1} of ${total}</p>
      </div>
      <fieldset class="choices">
        <legend class="t-title">${esc(item.text)}</legend>
        ${m.instructions ? `<p class="field-hint">${esc(m.instructions)}</p>` : ''}
        ${m.responseOptions
          .map(
            (o, i) =>
              `<label class="choice"><input type="radio" name="answer" value="${o.value}"${String(current) === String(o.value) ? ' checked' : ''}><span class="choice-dot"></span><span>${esc(o.label)}</span><kbd>${i + 1}</kbd></label>`,
          )
          .join('')}
      </fieldset>
      ${errors.item ? `<p class="field-error">${esc(errors.item)}</p>` : ''}
      <div class="actions">
        ${index > 0 ? `<a class="btn btn-secondary" href="#/q/${a.id}/${index - 1}">Back</a>` : ''}
        <button type="submit" class="btn btn-primary">${last ? 'Finish questionnaire' : 'Next question'}</button>
        <p class="t-caption key-hint">Press 1 to ${m.responseOptions.length} to choose, then Enter.</p>
      </div>
      <p class="t-caption">Sample questions written for this demonstration. Not a validated questionnaire.</p>
    </form>`,
    'focus',
  );
}

function viewAllDone() {
  return shellFor(
    'questionnaires',
    'All done',
    `<section class="focus-column stack-lg">
      <div class="done-mark"><span data-mark="draw"></span></div>
      <h2 class="t-title">Thank you, that is everything</h2>
      <p class="reading">You have finished all your questionnaires. The next step is a session where Sarah talks you through what they show.</p>
      <div class="actions">
        <button type="button" class="btn btn-primary" data-action="book">Book your feedback session</button>
        <a class="btn btn-secondary" href="#/home">Go to Home</a>
      </div>
    </section>`,
  );
}

function viewResults() {
  const c = me();
  const r = store.state().results[c.uid];
  if (!r?.releasedAt) {
    return shellFor(
      'results',
      'Results',
      `<div class="notice reading"><p>Your results will appear here after Sarah has gone through them with you in your feedback session.</p></div>`,
    );
  }
  const sections = r.items
    .map(
      (item) => `<section class="stack result-block" aria-labelledby="res-${item.measureId}">
        <h2 id="res-${item.measureId}">${esc(item.measureName)}</h2>
        <div class="split">
          <div class="stack">
            <h3>Areas of strength</h3>
            ${item.strengths.length ? `<ul class="result-list">${item.strengths.map((x) => `<li><p class="t-ui-strong">${esc(x.label)}</p><p>${esc(x.reason)}</p></li>`).join('')}</ul>` : '<p>Sarah will talk these through with you.</p>'}
          </div>
          <div class="stack">
            <h3>Areas of focus</h3>
            ${item.focus.length ? `<ul class="result-list">${item.focus.map((x) => `<li><p class="t-ui-strong">${esc(x.label)}</p><p>${esc(x.reason)}</p>${x.topic ? `<p><a href="${esc(x.topic.url)}" target="_blank" rel="noopener">${esc(x.topic.label)} in the Learning Hub</a></p>` : ''}</li>`).join('')}</ul>` : '<p>Nothing stood out as an area of focus here.</p>'}
          </div>
        </div>
      </section>`,
    )
    .join('');
  return shellFor(
    'results',
    'Results',
    `<p class="reading">Sarah shared these on ${fmtDate(r.releasedAt)}, after going through them with you. They describe how things were for you when you answered, and they are not a diagnosis.</p>
    ${sections}`,
  );
}

const ZONES = [
  { id: 'predisposing', title: 'What made this more likely', hint: 'Predisposing' },
  { id: 'precipitating', title: 'What set it off', hint: 'Precipitating' },
  { id: 'maintaining', title: 'What keeps it going', hint: 'Maintaining' },
  { id: 'protective', title: 'What helps', hint: 'Protective' },
];
export { ZONES };

let arrangement = null;

function viewFormulation() {
  const c = me();
  const f = store.state().formulations[c.uid];
  if (!f?.releasedAt) return viewResults();
  if (!arrangement || arrangement.uid !== c.uid) arrangement = { uid: c.uid, factors: f.factors.map((x) => ({ ...x })) };
  const zones = ZONES.map(
    (z) => `<section class="zone" data-zone="${z.id}" aria-labelledby="z-${z.id}">
      <h2 class="t-ui-strong" id="z-${z.id}">${esc(z.title)}</h2>
      <p class="t-caption">${esc(z.hint)}${z.id === 'maintaining' ? ', what we will work on together' : ''}</p>
      <ul class="zone-cards">
        ${arrangement.factors
          .filter((x) => x.zone === z.id)
          .map(
            (x) => `<li class="factor${z.id === 'maintaining' ? ' factor-target' : ''}" draggable="true" data-factor="${x.id}">
              <span>${esc(x.text)}</span>
              ${z.id === 'maintaining' ? '<span class="target-tag">Focus of our work</span>' : ''}
              <label class="visually-hidden" for="mv-${x.id}">Move "${esc(x.text)}" to</label>
              <select class="move" id="mv-${x.id}" data-move="${x.id}">
                ${ZONES.map((o) => `<option value="${o.id}"${o.id === z.id ? ' selected' : ''}>${esc(o.title)}</option>`).join('')}
              </select>
            </li>`,
          )
          .join('')}
      </ul>
    </section>`,
  ).join('');
  return shellFor(
    'formulation',
    'Formulation',
    `<p class="reading">This is the picture you and Sarah built together, shared on ${fmtDate(f.releasedAt)}. You can drag the cards or use the menus to explore it. Moving them here does not change Sarah's copy.</p>
    <div class="zones">${zones}</div>
    <p class="t-caption">Prototype for the pilot.</p>`,
  );
}

function viewAccount() {
  const c = me();
  const s = store.state();
  const mine = s.requests.filter((r) => r.uid === c.uid);
  return shellFor(
    'account',
    'Account',
    `${takeFlash()}
    <section class="stack reading" aria-labelledby="h-details">
      <h2 id="h-details">Your details</h2>
      <dl class="details">
        <div><dt>Name</dt><dd>${esc(c.name)}</dd></div>
        <div><dt>Email</dt><dd>${esc(c.email)}</dd></div>
        <div><dt>Joined</dt><dd>${fmtDate(c.activatedAt)}</dd></div>
      </dl>
    </section>
    <section class="stack reading" aria-labelledby="h-privacy">
      <h2 id="h-privacy">Your information</h2>
      <p>Your information is stored securely in Sydney, Australia, and Sarah is responsible for it. You can ask to see it or ask for it to be corrected at any time. Sarah will reply within 20 working days.</p>
      <div class="actions"><button type="button" class="btn btn-secondary" data-action="request-access">Request a copy of my information</button></div>
      <form class="stack" data-form="correction" novalidate>
        <div class="field">
          <label class="field-label" for="corr">Ask for a correction</label>
          <span class="field-hint" id="corr-hint">Tell Sarah what is wrong and what it should say.</span>
          <textarea class="textarea" id="corr" name="detail" aria-describedby="corr-hint" maxlength="1000"></textarea>
        </div>
        <div class="actions"><button type="submit" class="btn btn-secondary">Send correction request</button></div>
      </form>
      ${
        mine.length
          ? `<ul class="task-list">${mine
              .map((r) => `<li class="task"><div><p class="task-name">${r.kind === 'access' ? 'Copy of my information' : 'Correction'}</p><p class="task-meta">Sent ${fmtDate(r.createdAt)}, reply due by ${fmtDate(r.dueBy)}</p></div>${r.status === 'done' ? status('done', 'Answered') : status('progress', 'With Sarah')}<span></span></li>`)
              .join('')}</ul>`
          : ''
      }
    </section>
    <section class="stack reading" aria-labelledby="h-out">
      <h2 id="h-out">Log out</h2>
      <div class="actions"><button type="button" class="btn btn-secondary" data-action="logout">Log out</button></div>
    </section>`,
  );
}

// ---------- dialogs ----------

function openDialog(html) {
  let d = document.getElementById('dialog');
  if (!d) {
    d = document.createElement('dialog');
    d.id = 'dialog';
    d.className = 'dialog';
    document.body.append(d);
  }
  d.innerHTML = html;
  d.showModal();
  return d;
}

export function closeDialog() {
  document.getElementById('dialog')?.close();
}

export { openDialog };

// ---------- render and routing ----------

function clientRoute(parts) {
  const s = store.state();
  const c = me();
  const route = parts[0] ?? '';
  if (['signup', 'login'].includes(route)) return route === 'signup' ? viewSignUp() : viewLogIn();
  if (!s.session.signedIn || !c) return s.clients[store.DEMO_UID] ? viewLogIn() : viewSignUp();
  // Onboarding gate, as the "checking your access" step in Themescape.
  const redeemed = s.codes.some((x) => x.redeemedByUid === c.uid);
  if (!redeemed && !c.activatedAt) return viewActivate();
  if (!c.consentAt) return viewConsent();
  if (!c.activatedAt) return viewIntake();
  switch (route) {
    case 'loading':
      return viewLoader();
    case 'questionnaires':
      return viewQuestionnaires();
    case 'q':
      return viewItem(parts[1], parts[2] !== undefined ? Number(parts[2]) : undefined);
    case 'done':
      return viewAllDone();
    case 'results':
      return viewResults();
    case 'formulation':
      return viewFormulation();
    case 'account':
      return viewAccount();
    default:
      return viewHome();
  }
}

export function render() {
  const s = store.state();
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const practitioner = parts[0] === 'p';
  if (practitioner !== (s.role === 'practitioner')) store.setRole(practitioner ? 'practitioner' : 'client');
  document.documentElement.style.removeProperty('--accent');
  app.innerHTML = practitioner ? renderPractitioner(parts.slice(1), { errors, formState }) : clientRoute(parts);
  errors = {};
  afterRender();
  updateSampleBar();
}

function afterRender() {
  for (const holder of app.querySelectorAll('[data-ring]')) {
    holder.replaceWith(createJourneyRing({ stageIndex: Number(holder.dataset.stage), stageCount: Number(holder.dataset.stages), label: holder.dataset.label }));
  }
  for (const holder of app.querySelectorAll('[data-mark]')) {
    const svg = createMark({ draw: true, small: false, label: 'Executive Frame' });
    holder.replaceWith(svg);
  }
  for (const bar of app.querySelectorAll('[data-progress]')) {
    bar.style.width = `${((Number(bar.dataset.progress) + 1) / Number(bar.dataset.total)) * 100}%`;
  }
  for (const dot of app.querySelectorAll('.type-dot')) {
    const accent = clientTypes.types?.[dot.dataset.type]?.accent;
    if (accent) dot.style.background = accent;
    else dot.classList.add('type-dot-empty');
  }
  const invalid = app.querySelector('[aria-invalid="true"], .field-invalid input');
  if (invalid) invalid.focus();
  else app.querySelector('#workspace')?.focus({ preventScroll: true });
  app.querySelector('#workspace')?.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
}

function updateSampleBar() {
  const role = store.state().role;
  for (const b of document.querySelectorAll('[data-role]')) b.setAttribute('aria-pressed', String(b.dataset.role === role));
}

// ---------- events ----------

document.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  switch (form.dataset.form) {
    case 'signup': {
      formState.signup = { name: data.name, email: data.email };
      const r = store.signUp(data);
      if (!r.ok) {
        errors = r.errors;
        return render();
      }
      formState = {};
      return go('#/activate');
    }
    case 'activate': {
      formState.code = data.code;
      const r = store.redeemCode(data.code);
      if (!r.ok) {
        errors = { code: r.error };
        return render();
      }
      formState = {};
      return go('#/consent');
    }
    case 'consent': {
      if (!data.agree) {
        errors = { consent: 'Tick the box to agree before you continue.' };
        return render();
      }
      store.recordConsent(CONSENT_VERSION);
      return go('#/intake');
    }
    case 'intake': {
      formState.intake = data;
      const r = store.submitIntake(intakeConfig, data);
      if (!r.ok) {
        errors = r.errors;
        return render();
      }
      formState = {};
      go('#/loading');
      setTimeout(() => go('#/home'), 1500);
      return undefined;
    }
    case 'item': {
      const assignmentId = form.dataset.assignment;
      const index = Number(form.dataset.index);
      const a = store.state().assignments.find((x) => x.id === assignmentId);
      const m = store.measure(a.measureId);
      const item = m.items[index];
      if (data.answer === undefined) {
        errors = { item: 'Choose an answer to continue.' };
        return render();
      }
      store.saveResponse(assignmentId, item.id, Number(data.answer));
      if (index < m.items.length - 1) return go(`#/q/${assignmentId}/${index + 1}`);
      const r = store.completeAssignment(assignmentId);
      if (!r.ok) {
        errors = { item: r.error };
        return render();
      }
      if (r.booking) return go('#/done');
      setFlash(`${m.name} is finished. Thank you.`);
      return go('#/home');
    }
    case 'correction': {
      if (!String(data.detail ?? '').trim()) return undefined;
      store.createRequest('correction', data.detail);
      setFlash('Your correction request has been sent to Sarah.');
      return render();
    }
    default:
      return undefined;
  }
});

document.addEventListener('change', (event) => {
  const el = event.target;
  // Save each answer the moment it is chosen.
  if (el.name === 'answer') {
    const form = el.closest('[data-form="item"]');
    const a = store.state().assignments.find((x) => x.id === form.dataset.assignment);
    const item = store.measure(a.measureId).items[Number(form.dataset.index)];
    store.saveResponse(a.id, item.id, Number(el.value));
  }
  if (el.dataset.move && arrangement) {
    const f = arrangement.factors.find((x) => x.id === el.dataset.move);
    f.zone = el.value;
    render();
  }
});

document.addEventListener('click', (event) => {
  const openViewer = app.querySelector('.viewer[data-menu="open"]');
  if (openViewer && !event.target.closest('.sidebar, .menu-button')) {
    openViewer.dataset.menu = 'closed';
    openViewer.querySelector('.menu-button')?.setAttribute('aria-expanded', 'false');
  }
  const target = event.target.closest('[data-action], [data-role]');
  if (!target) return;
  if (target.dataset.role) {
    return go(target.dataset.role === 'practitioner' ? '#/p/clients' : '#/home');
  }
  switch (target.dataset.action) {
    case 'menu': {
      const viewer = app.querySelector('.viewer');
      const open = viewer.dataset.menu !== 'open';
      viewer.dataset.menu = open ? 'open' : 'closed';
      target.setAttribute('aria-expanded', String(open));
      return undefined;
    }
    case 'social':
      openDialog(`<div class="stack-lg"><h2>Not in the sample</h2><p>In the live app this signs you in with your Google or Microsoft account. For the sample, use your email instead.</p><div class="actions"><button type="button" class="btn btn-primary" data-action="close">Close</button></div></div>`);
      return undefined;
    case 'login':
      store.signIn();
      return go('#/home');
    case 'book':
      openDialog(`<div class="stack-lg"><h2>Book your feedback session</h2><p>In the live app this opens Sarah's online booking page in Splose in a new tab, where you choose a time.</p><div class="actions"><button type="button" class="btn btn-primary" data-action="close">Close</button></div></div>`);
      return undefined;
    case 'close':
      return closeDialog();
    case 'request-access':
      store.createRequest('access', '');
      setFlash('Your request has been sent. Sarah will reply within 20 working days.');
      return render();
    case 'logout':
      openDialog(`<form class="stack-lg" data-form="logout-confirm" method="dialog"><h2>Log out of the Client Hub?</h2>
        <label class="check"><input type="checkbox" name="clear"><span>This is a shared computer. Clear the Client Hub from this browser.</span></label>
        <div class="actions"><button type="button" class="btn btn-primary" data-action="logout-confirm">Log out</button><button type="button" class="btn btn-secondary" data-action="close">Cancel</button></div></form>`);
      return undefined;
    case 'logout-confirm': {
      const clear = document.querySelector('#dialog input[name="clear"]')?.checked;
      closeDialog();
      store.signOut();
      arrangement = null;
      setFlash(clear ? 'Logged out and cleared from this browser.' : 'Logged out.');
      return go('#/login');
    }
    case 'reset':
      store.reset();
      store.primeSampleScores();
      formState = {};
      arrangement = null;
      return go('#/signup');
    default:
      return undefined;
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    const viewer = app.querySelector('.viewer[data-menu="open"]');
    if (viewer) viewer.dataset.menu = 'closed';
  }
  const form = app.querySelector('[data-form="item"]');
  if (!form || event.target.matches('input[type="text"], textarea, select')) return;
  const n = Number(event.key);
  const radios = [...form.querySelectorAll('input[name="answer"]')];
  if (n >= 1 && n <= radios.length) {
    radios[n - 1].checked = true;
    radios[n - 1].focus();
    radios[n - 1].dispatchEvent(new Event('change', { bubbles: true }));
  }
});

// Drag and drop for formulation cards (pointer users; menus cover keyboard
// and touch).
document.addEventListener('dragstart', (event) => {
  const card = event.target.closest('[data-factor]');
  if (card) event.dataTransfer.setData('text/plain', card.dataset.factor);
});
document.addEventListener('dragover', (event) => {
  if (event.target.closest('[data-zone]')) event.preventDefault();
});
document.addEventListener('drop', (event) => {
  const zone = event.target.closest('[data-zone]');
  if (!zone || !arrangement) return;
  event.preventDefault();
  const fid = event.dataTransfer.getData('text/plain');
  const f = arrangement.factors.find((x) => x.id === fid);
  if (f) {
    f.zone = zone.dataset.zone;
    render();
  }
});

window.addEventListener('hashchange', render);
if (!location.hash) location.hash = store.state().role === 'practitioner' ? '#/p/clients' : '#/home';
render();
