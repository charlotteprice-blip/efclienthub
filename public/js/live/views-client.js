// Live client screens. Each returns HTML for the current state; app.js
// wires the forms and buttons to the Cloud Functions.

import { stageCopy } from '../client-types.js';
import { STAGE_LABELS, clientShell, esc, fieldError, fmtDate, fmtDay, single, status } from '../ui.js';

export const MARK_SRC = '/assets/brand/mark-slate-small.svg';
export const ROUTES = {
  home: '/dashboard',
  questionnaires: '/questionnaires',
  results: '/results',
  formulation: '/formulation',
  account: '/account',
  dashboard: '/practitioner',
  clients: '/practitioner/clients',
  review: '/practitioner/review',
  codes: '/practitioner/codes',
  library: '/practitioner/library',
};

// 5P formulation. Client facing titles; the hint is the clinical name.
export const ZONES = [
  { id: 'presenting', title: 'What we are working on', hint: 'Presenting' },
  { id: 'predisposing', title: 'What made this more likely', hint: 'Predisposing' },
  { id: 'precipitating', title: 'What set it off', hint: 'Precipitating' },
  { id: 'perpetuating', title: 'What keeps it going', hint: 'Perpetuating' },
  { id: 'protective', title: 'What helps', hint: 'Protective' },
];
export const FIT_LABELS = { fits: 'Fits', partly: 'Partly', no: 'Does not fit' };
// Old drafts used 'maintaining' for the perpetuating zone.
export const zoneOf = (f) => (f.zone === 'maintaining' ? 'perpetuating' : f.zone);

const flashHtml = (flash) => (flash ? `<div class="notice${flash.error ? ' notice-error' : ''}" role="${flash.error ? 'alert' : 'status'}"><p>${esc(flash.text)}</p></div>` : '');

function shell(s, active, title, content, mode) {
  const { ctx } = s;
  return clientShell({
    title,
    active,
    content,
    mode,
    client: ctx.client,
    markSrc: MARK_SRC,
    routes: ROUTES,
    counts: { outstanding: ctx.assignments.filter((a) => a.status !== 'complete').length },
    hasFormulation: Boolean(ctx.formulation),
  });
}

const answeredCount = (a) => Object.keys(a.responses ?? {}).length;

function measureMeta(s, a) {
  const m = s.ctx.measures[a.measureId];
  const n = m?.items?.length ?? 0;
  if (a.status === 'complete') return `${n} questions, finished ${fmtDate(a.completedAt)}`;
  if (a.status === 'inProgress') return `${n} questions, ${n - answeredCount(a)} left`;
  return `${n} questions, about ${Math.max(2, Math.round(n * 0.4))} minutes`;
}

function measureRow(s, a) {
  const m = s.ctx.measures[a.measureId];
  const chip = a.status === 'complete' ? status('done', 'Done') : a.status === 'inProgress' ? status('progress', 'In progress') : status('attention', 'Not started');
  const action = a.status === 'complete' ? '<span></span>' : `<a class="btn btn-secondary" href="/measure/${esc(a.id)}">${a.status === 'inProgress' ? 'Continue' : 'Start'}</a>`;
  const kind = a.source === 'scheduled' ? 'Check in. ' : '';
  return `<li class="task"><div><p class="task-name">${esc(m?.name ?? 'Questionnaire')}</p><p class="task-meta">${kind}${measureMeta(s, a)}</p></div>${chip}${action}</li>`;
}

// The next check in Sarah has scheduled, if any.
function nextCheckIn(s) {
  const next = s.ctx.schedules.find((x) => x.status === 'active' && x.nextDue);
  if (!next) return '';
  const m = s.ctx.measures[next.measureId];
  return `<p class="t-caption">Next check in: ${esc(m?.name ?? 'questionnaire')} on ${esc(fmtDay(next.nextDue))}. It will appear here on the day.</p>`;
}

// ---------- signed out ----------

export function signUp(s) {
  const v = s.form.signup ?? {};
  const e = s.errors;
  return single(
    `${flashHtml(s.flash)}
    <div class="stack">
      <h1>Create your account</h1>
      <p>Sarah will have sent you an activation code by email. You will need it in the next step.</p>
    </div>
    ${s.config.socialSignIn ? '<div class="stack"><button type="button" class="btn btn-secondary" data-action="google">Continue with Google</button><button type="button" class="btn btn-secondary" data-action="microsoft">Continue with Microsoft</button></div><p class="divider-text">or use your email</p>' : ''}
    <form class="stack-lg" data-form="signup" novalidate>
      <div class="field${e.name ? ' field-invalid' : ''}">
        <label class="field-label" for="su-name">First name</label>
        <input class="input" id="su-name" name="name" autocomplete="given-name" value="${esc(v.name)}"${e.name ? ' aria-invalid="true" aria-describedby="err-name"' : ''}>
        ${fieldError(e, 'name')}
      </div>
      <div class="field${e.email ? ' field-invalid' : ''}">
        <label class="field-label" for="su-email">Email</label>
        <span class="field-hint" id="su-email-hint">Use the address Sarah emailed your code to.</span>
        <input class="input" id="su-email" name="email" type="email" autocomplete="email" value="${esc(v.email)}" aria-describedby="su-email-hint${e.email ? ' err-email' : ''}"${e.email ? ' aria-invalid="true"' : ''}>
        ${fieldError(e, 'email')}
      </div>
      <div class="field${e.password ? ' field-invalid' : ''}">
        <label class="field-label" for="su-password">Password</label>
        <span class="field-hint" id="su-password-hint">8 or more characters.</span>
        <input class="input" id="su-password" name="password" type="password" autocomplete="new-password" aria-describedby="su-password-hint${e.password ? ' err-password' : ''}"${e.password ? ' aria-invalid="true"' : ''}>
        ${fieldError(e, 'password')}
      </div>
      <button type="submit" class="btn btn-primary">Create account</button>
    </form>
    <p class="t-caption">Already have an Executive Frame account, including for the Learning Hub? <a href="/login">Log in</a></p>`,
    MARK_SRC,
  );
}

export function logIn(s) {
  const v = s.form.login ?? {};
  const e = s.errors;
  return single(
    `${flashHtml(s.flash)}
    <div class="stack"><h1>Log in</h1></div>
    ${s.config.socialSignIn ? '<div class="stack"><button type="button" class="btn btn-secondary" data-action="google">Continue with Google</button><button type="button" class="btn btn-secondary" data-action="microsoft">Continue with Microsoft</button></div><p class="divider-text">or use your email</p>' : ''}
    <form class="stack-lg" data-form="login" novalidate>
      <div class="field${e.email ? ' field-invalid' : ''}">
        <label class="field-label" for="li-email">Email</label>
        <input class="input" id="li-email" name="email" type="email" autocomplete="email" value="${esc(v.email)}"${e.email ? ' aria-invalid="true" aria-describedby="err-email"' : ''}>
        ${fieldError(e, 'email')}
      </div>
      <div class="field${e.password ? ' field-invalid' : ''}">
        <label class="field-label" for="li-password">Password</label>
        <input class="input" id="li-password" name="password" type="password" autocomplete="current-password"${e.password ? ' aria-invalid="true" aria-describedby="err-password"' : ''}>
        ${fieldError(e, 'password')}
      </div>
      <button type="submit" class="btn btn-primary">Log in</button>
    </form>
    <p class="t-caption"><a href="/reset">Forgotten your password?</a> · New here? <a href="/signup">Create an account</a></p>`,
    MARK_SRC,
  );
}

export function reset(s) {
  const e = s.errors;
  return single(
    `${flashHtml(s.flash)}
    <div class="stack"><h1>Reset your password</h1><p>Enter your email and we will send you a link to choose a new password.</p></div>
    <form class="stack-lg" data-form="reset" novalidate>
      <div class="field${e.email ? ' field-invalid' : ''}">
        <label class="field-label" for="rs-email">Email</label>
        <input class="input" id="rs-email" name="email" type="email" autocomplete="email"${e.email ? ' aria-invalid="true" aria-describedby="err-email"' : ''}>
        ${fieldError(e, 'email')}
      </div>
      <button type="submit" class="btn btn-primary">Send reset link</button>
    </form>
    <p class="t-caption"><a href="/login">Back to log in</a></p>`,
    MARK_SRC,
  );
}

// ---------- onboarding ----------

export function activate(s) {
  const e = s.errors;
  return single(
    `${flashHtml(s.flash)}
    <div class="stack">
      <h1>Enter your activation code</h1>
      <p>Your code is in the email from Sarah. It has 12 letters and numbers and can be used once.</p>
    </div>
    <form class="stack-lg" data-form="activate" novalidate>
      <div class="field${e.code ? ' field-invalid' : ''}">
        <label class="field-label" for="code">Activation code</label>
        <input class="input code-input" id="code" name="code" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" value="${esc(s.form.code)}"${e.code ? ' aria-invalid="true" aria-describedby="err-code"' : ''}>
        ${fieldError(e, 'code')}
      </div>
      <button type="submit" class="btn btn-primary">Continue</button>
    </form>
    <p class="t-caption">No code? The Client Hub is for clients working with Sarah. Contact her and she will send you one. <button type="button" class="btn btn-quiet" data-action="logout-now">Log out</button></p>`,
    MARK_SRC,
  );
}

export function consent(s) {
  const e = s.errors;
  return single(
    `${flashHtml(s.flash)}
    <div class="stack"><h1>Before you start</h1><p>Here is what the Client Hub keeps about you and why.</p></div>
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
      <label class="check${e.consent ? ' field-invalid' : ''}">
        <input type="checkbox" name="agree"${e.consent ? ' aria-invalid="true" aria-describedby="err-consent"' : ''}>
        <span>I have read this and agree to the Client Hub keeping my information as described.</span>
      </label>
      ${fieldError(e, 'consent')}
      <button type="submit" class="btn btn-primary">Agree and continue</button>
    </form>`,
    MARK_SRC,
  );
}

export function intake(s) {
  const answers = s.form.intake ?? {};
  const blocks = s.intakeConfig.questions
    .filter((q) => q.enabled)
    .map((q) => {
      const err = s.errors[q.id];
      if (q.type === 'single') {
        return `<fieldset class="choices${err ? ' field-invalid' : ''}">
          <legend class="t-heading">${esc(q.text)}${q.required ? '' : ' <span class="t-caption">(optional)</span>'}</legend>
          ${q.hint ? `<p class="field-hint">${esc(q.hint)}</p>` : ''}
          ${q.options.map((o) => `<label class="choice"><input type="radio" name="${esc(q.id)}" value="${esc(o.value)}"${answers[q.id] === o.value ? ' checked' : ''}><span class="choice-dot"></span><span>${esc(o.label)}</span></label>`).join('')}
          ${err ? `<p class="field-error">${esc(err)}</p>` : ''}
        </fieldset>`;
      }
      return `<div class="field${err ? ' field-invalid' : ''}">
        <label class="field-label t-heading" for="iq-${esc(q.id)}">${esc(q.text)}${q.required ? '' : ' <span class="t-caption">(optional)</span>'}</label>
        ${q.hint ? `<span class="field-hint">${esc(q.hint)}</span>` : ''}
        <textarea class="textarea" id="iq-${esc(q.id)}" name="${esc(q.id)}" maxlength="1000">${esc(answers[q.id])}</textarea>
        ${err ? `<p class="field-error">${esc(err)}</p>` : ''}
      </div>`;
    })
    .join('');
  return single(
    `${flashHtml(s.flash)}
    <div class="stack"><h1>A few questions to start</h1><p>This helps Sarah set up the Client Hub for you. It takes about a minute.</p></div>
    <form class="stack-lg" data-form="intake" novalidate>${blocks}
      <button type="submit" class="btn btn-primary">Finish setting up</button>
    </form>`,
    MARK_SRC,
  );
}

export function loader(text = 'Checking your access') {
  return `<main class="single" id="workspace" tabindex="-1"><div class="loader"><span data-mark></span><p class="t-ui">${esc(text)}</p></div></main>`;
}

// ---------- signed in ----------

export function home(s) {
  const { ctx, clientTypes } = s;
  const c = ctx.client;
  const stage = c.journeyStage ?? 'assessment';
  const stages = clientTypes.stages;
  const index = Math.max(0, stages.indexOf(stage));
  const copy = stageCopy(clientTypes, c.clientType, stage);
  const next = ctx.assignments.find((a) => a.status !== 'complete');
  const released = ctx.results?.releasedAt;
  let action = '';
  if (copy.nextAction === 'measures' && next) action = `<a class="btn btn-primary" href="/measure/${esc(next.id)}">${answeredCount(next) ? 'Continue questionnaire' : 'Start questionnaire'}</a>`;
  if (copy.nextAction === 'booking') action = bookingButton(s, 'Book a session');
  if (copy.nextAction === 'results' || (released && stage === 'feedback')) action = '<a class="btn btn-primary" href="/results">See your results</a>';
  // A check in due during treatment takes precedence over the stage's usual action.
  if (copy.nextAction !== 'measures' && next) action = `<a class="btn btn-primary" href="/measure/${esc(next.id)}">${answeredCount(next) ? 'Continue check in' : 'Start check in'}</a>`;
  return shell(
    s,
    'home',
    'Home',
    `${flashHtml(s.flash)}
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
      ${ctx.assignments.length ? `<ul class="task-list">${ctx.assignments.map((a) => measureRow(s, a)).join('')}</ul>` : '<p>Sarah has not asked you to complete any questionnaires yet.</p>'}
      ${nextCheckIn(s)}
    </section>
    <section class="stack" aria-labelledby="h-r">
      <h2 id="h-r">Your results</h2>
      ${released ? `<div class="notice reading"><p>Sarah shared your results on ${fmtDate(released)}. <a href="/results">See your results</a></p></div>` : '<div class="notice reading"><p>Your results will appear here after Sarah has gone through them with you in your feedback session.</p></div>'}
    </section>`,
  );
}

export function bookingButton(s, label) {
  return s.config.bookingUrl
    ? `<a class="btn btn-primary" href="${esc(s.config.bookingUrl)}" target="_blank" rel="noopener">${esc(label)}</a>`
    : `<button type="button" class="btn btn-primary" data-action="book">${esc(label)}</button>`;
}

export function questionnaires(s) {
  const list = s.ctx.assignments;
  return shell(
    s,
    'questionnaires',
    'Questionnaires',
    `${flashHtml(s.flash)}
    <p class="reading">There are no right or wrong answers. Your answers save as you go, so you can stop and come back at any time.</p>
    ${list.length ? `<ul class="task-list">${list.map((a) => measureRow(s, a)).join('')}</ul>` : '<p>Sarah has not asked you to complete any questionnaires yet.</p>'}
    ${nextCheckIn(s)}`,
  );
}

export function item(s, assignmentId, n) {
  const a = s.ctx.assignments.find((x) => x.id === assignmentId);
  if (!a) return questionnaires({ ...s, flash: { text: 'That questionnaire was not found.', error: true } });
  if (a.status === 'complete') return questionnaires({ ...s, flash: { text: 'You have already finished that questionnaire.' } });
  const m = s.ctx.measures[a.measureId];
  const responses = a.responses ?? {};
  const total = m.items.length;
  let index = Number.isInteger(n) ? n : m.items.findIndex((it) => responses[it.id] === undefined);
  if (index < 0) index = total - 1;
  index = Math.min(Math.max(index, 0), total - 1);
  const it = m.items[index];
  const options = Array.isArray(it.responseOptions) && it.responseOptions.length ? it.responseOptions : m.responseOptions;
  const last = index === total - 1;
  const current = responses[it.id];
  return shell(
    s,
    'questionnaires',
    m.name,
    `<form class="focus-column stack-lg" data-form="item" data-assignment="${esc(a.id)}" data-index="${index}" novalidate>
      ${flashHtml(s.flash)}
      <div class="stack">
        <div class="progress" role="progressbar" aria-label="Question ${index + 1} of ${total}" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${index + 1}"><div class="progress-fill" data-progress="${index}" data-total="${total}"></div></div>
        <p class="t-caption">Question ${index + 1} of ${total}</p>
      </div>
      <fieldset class="choices">
        <legend class="t-title">${esc(it.text)}</legend>
        ${m.instructions ? `<p class="field-hint">${esc(m.instructions)}</p>` : ''}
        ${options.map((o, i) => `<label class="choice"><input type="radio" name="answer" value="${esc(o.value)}"${String(current) === String(o.value) ? ' checked' : ''}><span class="choice-dot"></span><span>${esc(o.label)}</span><kbd>${i + 1}</kbd></label>`).join('')}
      </fieldset>
      ${s.errors.item ? `<p class="field-error">${esc(s.errors.item)}</p>` : ''}
      <div class="actions">
        ${index > 0 ? `<a class="btn btn-secondary" href="/measure/${esc(a.id)}/${index - 1}">Back</a>` : ''}
        <button type="submit" class="btn btn-primary">${last ? 'Finish questionnaire' : 'Next question'}</button>
        <p class="t-caption key-hint">Press 1 to ${options.length} to choose, then Enter.</p>
      </div>
    </form>`,
    'focus',
  );
}

export function allDone(s) {
  return shell(
    s,
    'questionnaires',
    'All done',
    `<section class="focus-column stack-lg">
      <div class="done-mark"><span data-mark></span></div>
      <h2 class="t-title">Thank you, that is everything</h2>
      <p class="reading">You have finished all your questionnaires. The next step is a session where Sarah talks you through what they show.</p>
      <div class="actions">${bookingButton(s, 'Book your feedback session')}<a class="btn btn-secondary" href="/dashboard">Go to Home</a></div>
    </section>`,
  );
}

export function results(s) {
  const r = s.ctx.results;
  if (!r) return shell(s, 'results', 'Results', '<div class="notice reading"><p>Your results will appear here after Sarah has gone through them with you in your feedback session.</p></div>');
  const hub = s.config.learningHubUrl;
  const sections = r.items
    .map(
      (item) => `<section class="stack result-block" aria-labelledby="res-${esc(item.assignmentId)}">
        <h2 id="res-${esc(item.assignmentId)}">${esc(item.measureName)}</h2>
        <div class="split">
          <div class="stack"><h3>Areas of strength</h3>${item.strengths.length ? `<ul class="result-list">${item.strengths.map((x) => `<li><p class="t-ui-strong">${esc(x.label)}</p><p>${esc(x.reason)}</p></li>`).join('')}</ul>` : '<p>Sarah will talk these through with you.</p>'}</div>
          <div class="stack"><h3>Areas of focus</h3>${item.focus.length ? `<ul class="result-list">${item.focus.map((x) => `<li><p class="t-ui-strong">${esc(x.label)}</p><p>${esc(x.reason)}</p>${x.topic?.url?.startsWith(hub) ? `<p><a href="${esc(x.topic.url)}" target="_blank" rel="noopener">${esc(x.topic.label)} in the Learning Hub</a></p>` : ''}</li>`).join('')}</ul>` : '<p>Nothing stood out as an area of focus here.</p>'}</div>
        </div>
      </section>`,
    )
    .join('');
  return shell(s, 'results', 'Results', `<p class="reading">Sarah shared these on ${fmtDate(r.releasedAt)}, after going through them with you. They describe how things were for you when you answered, and they are not a diagnosis.</p>${sections}`);
}

export function formulation(s) {
  const f = s.ctx.formulation;
  if (!f) return results(s);
  const responses = s.ctx.formulationResponses ?? {};
  const zones = ZONES.map((z) => {
    const cards = f.factors.filter((x) => zoneOf(x) === z.id);
    return `<section class="zone" data-zone="${z.id}" aria-labelledby="z-${z.id}">
      <h2 class="t-ui-strong" id="z-${z.id}">${esc(z.title)}</h2>
      <p class="t-caption">${esc(z.hint)}${z.id === 'perpetuating' ? ', what we will work on together' : ''}</p>
      ${
        cards.length
          ? `<ul class="zone-cards">${cards
              .map((x) => {
                const r = responses[x.id] ?? {};
                return `<li class="factor${z.id === 'perpetuating' ? ' factor-target' : ''}" data-factor="${esc(x.id)}">
            <div class="factor-body"><span>${esc(x.text)}</span>${z.id === 'perpetuating' ? '<span class="target-tag">Focus of our work</span>' : ''}</div>
            <form class="factor-respond" data-form="factor-response" data-factor="${esc(x.id)}" novalidate>
              <fieldset class="fit-choice"><legend class="visually-hidden">Does "${esc(x.text)}" fit?</legend>
                ${Object.entries(FIT_LABELS).map(([v, label]) => `<label class="fit${r.fit === v ? ' fit-on' : ''}"><input type="radio" name="fit" value="${v}"${r.fit === v ? ' checked' : ''}><span>${esc(label)}</span></label>`).join('')}
              </fieldset>
              <label class="visually-hidden" for="cm-${esc(x.id)}">Comment for Sarah</label>
              <input class="input input-small" id="cm-${esc(x.id)}" name="comment" maxlength="500" placeholder="Add a comment for Sarah (optional)" value="${esc(r.comment ?? '')}">
              <button type="submit" class="btn btn-secondary btn-inline">Save</button>
              ${r.at ? `<p class="t-caption">Saved ${fmtDate(r.at)}.</p>` : ''}
            </form>
          </li>`;
              })
              .join('')}</ul>`
          : '<p class="t-caption">Nothing here yet.</p>'
      }
    </section>`;
  }).join('');
  return shell(
    s,
    'formulation',
    'Formulation',
    `${flashHtml(s.flash)}
    <p class="reading">This is the picture you and Sarah built together, shared on ${fmtDate(f.releasedAt)}. For each card, tell Sarah whether it fits, partly fits or does not fit, and add a comment if you like. Sarah sees your answers and can update the picture with you.</p>
    ${f.summary ? `<div class="reading formulation-summary">${f.summary.split('\n').filter(Boolean).map((para) => `<p>${esc(para)}</p>`).join('')}</div>` : ''}
    <div class="zones zones-5">${zones}</div>`,
  );
}

export function account(s) {
  const c = s.ctx.client;
  const mine = s.ctx.requests;
  return shell(
    s,
    'account',
    'Account',
    `${flashHtml(s.flash)}
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
      ${mine.length ? `<ul class="task-list">${mine.map((r) => `<li class="task"><div><p class="task-name">${r.kind === 'access' ? 'Copy of my information' : 'Correction'}</p><p class="task-meta">Sent ${fmtDate(r.createdAt)}, reply due by ${fmtDate(r.dueBy)}</p></div>${r.status === 'done' ? status('done', 'Answered') : status('progress', 'With Sarah')}<span></span></li>`).join('')}</ul>` : ''}
    </section>
    <section class="stack reading" aria-labelledby="h-out">
      <h2 id="h-out">Log out</h2>
      <div class="actions"><button type="button" class="btn btn-secondary" data-action="logout">Log out</button></div>
    </section>`,
  );
}
