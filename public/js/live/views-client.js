// Live client screens. Each returns HTML for the current state; app.js
// wires the forms and buttons to the Cloud Functions.

import { stageCopy } from '../client-types.js';
import { renderFormulationView } from '../formulation-views.js';
import { STAGE_LABELS, clientShell, esc, fieldError, flashNotice, fmtDate, fmtDateTime, fmtDay, journeySteps, notice, single, status, stepTracker } from '../ui.js';

// The header lockup from the brand pack (the name is kept from when the
// header drew the mark and set the wordmark as text).
export const MARK_SRC = '/assets/brand/ef-lockup-slate.svg';
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

// The practice contact address from app.json, as a link.
export const contactLink = (s) => (s.config.contactEmail ? `<a href="mailto:${esc(s.config.contactEmail)}">${esc(s.config.contactEmail)}</a>` : '');

const flashHtml = flashNotice;

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
  const chip = a.status === 'complete' ? status('done', 'Done') : a.status === 'inProgress' ? status('progress', 'In progress') : status('todo', 'Not started');
  const label = a.status === 'inProgress' ? 'Continue' : 'Start';
  const action = a.status === 'complete' ? '<span></span>' : `<a class="btn btn-secondary" href="/measure/${esc(a.id)}" aria-label="${label} ${esc(m?.name ?? 'questionnaire')}">${label}</a>`;
  const kind = a.source === 'scheduled' ? 'Check in. ' : '';
  return `<li class="task"><div><p class="task-name">${esc(m?.name ?? 'Questionnaire')}</p><p class="task-meta">${kind}${measureMeta(s, a)}</p></div>${chip}${action}</li>`;
}

// ---------- Splose: what Sarah's booking system shows ----------

// The progress record runSploseSync wrote, when Splose tracking is on and
// Sarah has linked this client. Dates, statuses and counts only.
const sploseOf = (s) => (s.config.splose?.enabled && s.ctx.splose?.patientId ? s.ctx.splose : null);
const sploseStale = (s, p) => !p?.syncedAt || Date.now() - p.syncedAt > (s.config.splose?.staleAfterMinutes ?? 120) * 60000;
const openForms = (p) => (p?.forms ?? []).filter((f) => f.status !== 'Completed');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// 1 line under the journey step, fed from Splose. Copy is draft for Sarah.
export function sploseStageLine(s) {
  const p = sploseOf(s);
  if (!p) return '';
  const stage = s.ctx.client.journeyStage ?? 'assessment';
  const next = p.nextAppointment;
  const last = p.lastAttended;
  const nextLine = next ? `Your next session with Sarah is on ${fmtDateTime(next.at)}.` : '';
  const sessions = s.config.splose.showAttendance !== false && p.attended > 0 ? ` You have had ${plural(p.attended, 'session')} so far.` : '';
  switch (stage) {
    case 'enquiry':
      return next ? `Your first session with Sarah is on ${fmtDateTime(next.at)}.` : 'Sarah will be in touch to arrange your first session.';
    case 'firstSession':
      if (next?.stage === 'firstSession') return `Your first session with Sarah is on ${fmtDateTime(next.at)}.`;
      if (last?.stage === 'firstSession') return `You met Sarah on ${fmtDate(last.at)}.${next ? ` ${nextLine}` : ''}`;
      return nextLine;
    case 'assessment':
      // A form Sarah has sent is said once, as a row in To do.
      return '';
    case 'booking':
      if (p.feedbackAttendedAt) return `You and Sarah went through your results on ${fmtDate(p.feedbackAttendedAt)}.`;
      return p.feedbackBookedAt ? `Your feedback session is on ${fmtDateTime(p.feedbackBookedAt)}.` : '';
    case 'feedback':
      if (p.feedbackAttendedAt) return `You and Sarah went through your results on ${fmtDate(p.feedbackAttendedAt)}.`;
      return p.feedbackBookedAt ? `Your feedback session is on ${fmtDateTime(p.feedbackBookedAt)}.` : '';
    default:
      return nextLine ? `${nextLine}${sessions}` : sessions.trim();
  }
}

// The Next session panel on Home: Splose's date when there is one, with
// Sarah's note beside it; otherwise what Sarah typed in.
function nextSessionPanel(s) {
  const c = s.ctx.client;
  const p = sploseOf(s);
  const next = p?.nextAppointment;
  if (!next) {
    return c.nextSessionAt
      ? `<p class="session-when">${esc(fmtDateTime(c.nextSessionAt))}</p>${c.nextSessionNote ? `<p>${esc(c.nextSessionNote)}</p>` : ''}`
      : `<p>No session booked yet.</p>${s.config.bookingUrl ? `<div class="actions">${bookingButton(s, 'Book a session')}</div>` : '<p class="t-caption">Sarah will add your next session here once it is arranged.</p>'}`;
  }
  // Forms Sarah has sent are listed once, in To do, not again here.
  const lines = [];
  if (s.config.splose.showAttendance !== false && p.attended > 0) lines.push(`You have had ${plural(p.attended, 'session')} so far.`);
  return `<p class="session-when">${esc(fmtDateTime(next.at))}</p>
    ${c.nextSessionNote ? `<p>${esc(c.nextSessionNote)}</p>` : ''}
    ${lines.map((l) => `<p>${esc(l)}</p>`).join('')}
    <p class="t-caption">From Sarah's booking system${sploseStale(s, p) ? `, last updated ${esc(fmtDateTime(p.syncedAt))}` : ''}.</p>`;
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
    <p class="t-caption">No code? The Client Hub is for clients working with Sarah. Contact her${contactLink(s) ? ` at ${contactLink(s)}` : ''} and she will send you one. <button type="button" class="btn btn-quiet" data-action="logout-now">Log out</button></p>`,
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
      const id = esc(q.id);
      const described = [q.hint ? `iq-hint-${id}` : '', err ? `err-${id}` : ''].filter(Boolean).join(' ');
      if (q.type === 'single') {
        return `<fieldset class="choices${err ? ' field-invalid' : ''}" role="radiogroup" aria-labelledby="iq-legend-${id}"${described ? ` aria-describedby="${described}"` : ''}${err ? ' aria-invalid="true"' : ''}>
          <legend class="t-heading" id="iq-legend-${id}">${esc(q.text)}${q.required ? '' : ' <span class="t-caption">(optional)</span>'}</legend>
          ${q.hint ? `<p class="field-hint" id="iq-hint-${id}">${esc(q.hint)}</p>` : ''}
          ${q.options.map((o) => `<label class="choice"><input type="radio" name="${esc(q.id)}" value="${esc(o.value)}"${answers[q.id] === o.value ? ' checked' : ''}><span class="choice-dot"></span><span>${esc(o.label)}</span></label>`).join('')}
          ${err ? `<p class="field-error" id="err-${id}">${esc(err)}</p>` : ''}
        </fieldset>`;
      }
      return `<div class="field${err ? ' field-invalid' : ''}">
        <label class="field-label t-heading" for="iq-${esc(q.id)}">${esc(q.text)}${q.required ? '' : ' <span class="t-caption">(optional)</span>'}</label>
        ${q.hint ? `<span class="field-hint" id="iq-hint-${id}">${esc(q.hint)}</span>` : ''}
        <textarea class="textarea" id="iq-${id}" name="${id}" maxlength="1000"${described ? ` aria-describedby="${described}"` : ''}${err ? ' aria-invalid="true"' : ''}>${esc(answers[q.id])}</textarea>
        ${err ? `<p class="field-error" id="err-${id}">${esc(err)}</p>` : ''}
      </div>`;
    })
    .join('');
  const missing = s.intakeConfig.questions.filter((q) => q.enabled && s.errors[q.id]).length;
  return single(
    `${flashHtml(s.flash)}
    <div class="stack"><h1>A few questions to start</h1><p>This helps Sarah set up the Client Hub for you. It takes about a minute.</p></div>
    ${missing ? notice('error', `<p>${missing === 1 ? '1 question still needs an answer.' : `${missing} questions still need an answer.`} We have taken you to the first.</p>`, { role: 'alert', word: 'Not finished yet' }) : ''}
    <form class="stack-lg" data-form="intake" novalidate>${blocks}
      <button type="submit" class="btn btn-primary">Finish setting up</button>
    </form>`,
    MARK_SRC,
  );
}

export function loader(text = 'Checking your access') {
  return `<main class="single" id="workspace" tabindex="-1"><div class="loader"><span data-mark></span><p class="t-ui">${esc(text)}</p></div></main>`;
}

// A plain message when a screen cannot be loaded or drawn, with a way on.
export function problem(text, signedIn = false) {
  return single(
    `<div class="stack"><h1>Something went wrong</h1><p role="alert">${esc(text)}</p></div>
    <div class="stack"><button type="button" class="btn btn-primary" data-action="retry">Try again</button>${signedIn ? '<button type="button" class="btn btn-secondary" data-action="logout-now">Log out</button>' : ''}</div>`,
    MARK_SRC,
  );
}

// ---------- signed in ----------

// ---------- Home: what to do, report progress, next session, resources ----------

// What the journey tracker on Home says under its steps, carried over from
// the old report tracker: how many questionnaires of the initial assessment
// are done, and when results and the formulation were shared.
export function journeyDetails(s) {
  const { ctx } = s;
  const stages = s.clientTypes.stages;
  const stageIndex = Math.max(0, stages.indexOf(ctx.client.journeyStage ?? 'assessment'));
  // The journey never moves back, so once the client is past the
  // Questionnaires step a questionnaire Sarah assigns later is a task in To
  // do and is not counted here. Later ones are those assigned after the
  // booking step was reached.
  const past = stageIndex > stages.indexOf('assessment');
  const cutOff = ctx.client.bookingTriggeredAt;
  const initial = ctx.assignments.filter((a) => a.source !== 'scheduled' && !(past && cutOff && (a.assignedAt ?? 0) > cutOff));
  const done = initial.filter((a) => a.status === 'complete').length;
  const details = {};
  if (initial.length) details.assessment = `${done} of ${initial.length}`;
  if (ctx.results?.releasedAt) details.feedback = `Results shared ${fmtDate(ctx.results.releasedAt)}`;
  if (ctx.formulation) details.intervention = `Formulation shared ${fmtDate(ctx.formulation.releasedAt)}`;
  return details;
}

function tasks(s) {
  const { ctx, clientTypes } = s;
  const c = ctx.client;
  const stage = c.journeyStage ?? 'assessment';
  const list = [];
  for (const a of ctx.assignments.filter((x) => x.status !== 'complete')) {
    const m = ctx.measures[a.measureId];
    const label = a.status === 'inProgress' ? 'Continue' : 'Start';
    list.push({ name: `${a.source === 'scheduled' ? 'Check in: ' : ''}${m?.name ?? 'Questionnaire'}`, meta: measureMeta(s, a), chip: a.status === 'inProgress' ? status('progress', 'In progress') : status('todo', 'To do'), link: { href: `/measure/${a.id}`, label, name: m?.name ?? 'questionnaire' } });
  }
  const splose = sploseOf(s);
  if (stage === 'booking' && !c.nextSessionAt && !splose?.feedbackBookedAt) {
    list.push({ name: 'Book your feedback session', meta: 'Sarah goes through your results with you before anything is shared here.', chip: status('todo', 'To do'), book: true });
  }
  for (const f of openForms(splose)) {
    list.push({ name: `Complete ${f.title} in Splose`, meta: `Sarah sent this ${f.sentAt ? `on ${fmtDate(f.sentAt)}` : 'from her booking system'}. The link is in the email from Splose.`, chip: status(f.status === 'In progress' ? 'progress' : 'todo', f.status === 'In progress' ? 'In progress' : 'To do') });
  }
  if (ctx.formulation) {
    const waiting = ctx.formulation.factors.filter((f) => !ctx.formulationResponses?.[f.id]).length;
    if (waiting) list.push({ name: 'Tell Sarah whether your formulation fits', meta: `${waiting} card${waiting === 1 ? '' : 's'} still to answer`, chip: status('todo', 'To do'), link: { href: '/formulation', label: 'Open', name: 'your formulation' } });
  }
  if (ctx.results?.releasedAt && Date.now() - ctx.results.releasedAt < 14 * 86400000) {
    list.push({ name: 'Read your results', meta: `Shared by Sarah on ${fmtDate(ctx.results.releasedAt)}.`, chip: status('done', 'New'), link: { href: '/results', label: 'Open', name: 'your results' } });
  }
  // 1 clear next action: only the first thing that can be pressed is a
  // primary button; the rest are secondary. Each link says what it opens.
  let primaryGiven = false;
  for (const t of list) {
    const primary = !primaryGiven && Boolean(t.link || t.book);
    if (primary) primaryGiven = true;
    if (t.book) t.action = bookingButton(s, 'Book a session', primary);
    else if (t.link) t.action = `<a class="btn ${primary ? 'btn-primary' : 'btn-secondary'}" href="${esc(t.link.href)}" aria-label="${esc(t.link.label)} ${esc(t.link.name)}">${esc(t.link.label)}</a>`;
    else t.action = '<span></span>';
  }
  const copy = stageCopy(clientTypes, c.clientType, stage);
  return { list, copy };
}

function resources(s) {
  const { ctx } = s;
  const hub = s.config.learningHubUrl;
  const seen = new Set();
  const out = [];
  for (const r of ctx.client.resources ?? []) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    out.push({ title: r.title, url: r.url, note: r.note, from: 'Sarah' });
  }
  for (const item of ctx.results?.items ?? []) {
    for (const f of item.focus ?? []) {
      if (!f.topic?.url?.startsWith(hub) || seen.has(f.topic.url)) continue;
      seen.add(f.topic.url);
      out.push({ title: f.topic.label, url: f.topic.url, note: `Learning Hub topic for ${f.label.toLowerCase()}, an area of focus in ${item.measureName}.`, from: 'results' });
    }
  }
  return out;
}

export function home(s) {
  const { ctx, clientTypes } = s;
  const c = ctx.client;
  const stage = c.journeyStage ?? 'assessment';
  const stages = clientTypes.stages;
  const index = Math.max(0, stages.indexOf(stage));
  const { list, copy } = tasks(s);
  const res = resources(s);
  const nextCheck = ctx.schedules.find((x) => x.status === 'active' && x.nextDue);
  const stageLine = sploseStageLine(s);
  return shell(
    s,
    'home',
    'Home',
    `${flashHtml(s.flash)}
    <section class="journey-hero" aria-labelledby="stage-title">
      <div class="stack">
        <p class="journey-stage">Step ${index + 1} of ${stages.length}: ${esc(STAGE_LABELS[stage])}</p>
        <h2 class="t-title" id="stage-title">${esc(copy.title)}</h2>
        <p class="reading">${esc(copy.body)}</p>
        ${stageLine ? `<p class="reading">${esc(stageLine)}</p>` : ''}
      </div>
    </section>

    <div class="home-grid">
      <section class="stack home-tasks" aria-labelledby="h-todo">
        <h2 id="h-todo">To do</h2>
        ${list.length ? `<ul class="task-list">${list.map((t) => `<li class="task"><div><p class="task-name">${esc(t.name)}</p><p class="task-meta">${esc(t.meta)}</p></div>${t.chip}${t.action}</li>`).join('')}</ul>` : '<p>Nothing to do right now. Anything Sarah asks of you will appear here.</p>'}
        ${nextCheck ? `<p class="t-caption">Next check in: ${esc(ctx.measures[nextCheck.measureId]?.name ?? 'questionnaire')} on ${esc(fmtDay(nextCheck.nextDue))}. It will appear here on the day.</p>` : ''}
      </section>

      <section class="stack home-session" aria-labelledby="h-next">
        <h2 id="h-next">Next session</h2>
        ${nextSessionPanel(s)}
      </section>

      <section class="stack home-report" aria-labelledby="h-rep">
        <h2 id="h-rep">Your steps</h2>
        ${stepTracker(journeySteps(stages, index, journeyDetails(s)), { label: `Step ${index + 1} of ${stages.length}: ${STAGE_LABELS[stage]}` })}
        ${ctx.results?.releasedAt ? `<p><a href="/results">See your results</a>${ctx.formulation ? ' or <a href="/formulation">your formulation</a>' : ''}.</p>` : '<p class="t-caption">Nothing is shared here until Sarah has gone through it with you. Scores are never shown on their own.</p>'}
      </section>

      ${res.length ? `<section class="stack home-resources" aria-labelledby="h-res">
        <h2 id="h-res">Your resources</h2>
        <ul class="resource-list">${res.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>${r.note ? `<p class="t-caption">${esc(r.note)}</p>` : ''}</li>`).join('')}</ul>
      </section>` : ''}
    </div>`,
  );
}

export function bookingButton(s, label, primary = true) {
  const cls = primary ? 'btn-primary' : 'btn-secondary';
  return s.config.bookingUrl
    ? `<a class="btn ${cls}" href="${esc(s.config.bookingUrl)}" target="_blank" rel="noopener">${esc(label)}</a>`
    : `<button type="button" class="btn ${cls}" data-action="book">${esc(label)}</button>`;
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
  // Long instructions are read once, on their own screen before question 1,
  // and stay behind Show instructions on every question after that.
  if (longInstructions(m) && n === undefined && answeredCount(a) === 0) {
    return shell(
      s,
      'questionnaires',
      m.name,
      `<section class="focus-column stack-lg">
        <div class="stack">
          <p class="t-caption">${esc(measureMeta(s, a))}</p>
          <h2 class="t-title">Before you start</h2>
          <p class="reading">${esc(m.instructions)}</p>
          <p class="t-caption">Your answers save as you go, and you can read this again on any question.</p>
        </div>
        <div class="actions"><a class="btn btn-primary" href="/measure/${esc(a.id)}/0">Start</a></div>
      </section>`,
      'focus',
    );
  }
  return shell(
    s,
    'questionnaires',
    m.name,
    questionForm({
      attrs: `data-form="item" data-assignment="${esc(a.id)}" data-index="${index}"`,
      measure: m,
      index,
      current: responses[m.items[index].id],
      error: s.errors.item,
      flash: flashHtml(s.flash),
      backHref: index > 0 ? `/measure/${esc(a.id)}/${index - 1}` : '',
      submitLabel: index === total - 1 ? 'Finish questionnaire' : 'Next question',
    }),
    'focus',
  );
}

// Instructions longer than this are too much to repeat under every question.
const LONG_INSTRUCTIONS = 140;
const longInstructions = (m) => (m.instructions ?? '').length > LONG_INSTRUCTIONS;
// A question longer than this steps down from title to heading size.
const LONG_QUESTION = 90;

// 1 question on 1 screen, shared by the client and Sarah's test run. Short
// instructions (a stem such as "Over the last 2 weeks...") stay under the
// question; long ones sit behind Show instructions. The buttons stay in
// view at the bottom of the screen. Number keys reach the first 9 answers.
export function questionForm({ attrs, measure: m, index, current, error, flash = '', backHref, submitLabel }) {
  const total = m.items.length;
  const it = m.items[index];
  const options = Array.isArray(it.responseOptions) && it.responseOptions.length ? it.responseOptions : m.responseOptions;
  const instructions = !m.instructions ? '' : longInstructions(m) ? `<details class="instructions"><summary>Show instructions</summary><p>${esc(m.instructions)}</p></details>` : `<p class="field-hint">${esc(m.instructions)}</p>`;
  return `<form class="focus-column question stack-lg" ${attrs} novalidate>
      ${flash}
      <div class="stack">
        <div class="progress" role="progressbar" aria-label="Question ${index + 1} of ${total}" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${index + 1}"><div class="progress-fill" data-progress="${index}" data-total="${total}"></div></div>
        <p class="t-caption">Question ${index + 1} of ${total}</p>
      </div>
      <fieldset class="choices${error ? ' field-invalid' : ''}" role="radiogroup" aria-labelledby="q-legend"${error ? ' aria-invalid="true" aria-describedby="err-item"' : ''}>
        <legend class="${it.text.length > LONG_QUESTION ? 't-heading' : 't-title'}" id="q-legend">${esc(it.text)}</legend>
        ${instructions}
        ${options.map((o, i) => `<label class="choice"><input type="radio" name="answer" value="${esc(o.value)}"${String(current) === String(o.value) ? ' checked' : ''}><span class="choice-dot"></span><span>${esc(o.label)}</span>${i < 9 ? `<kbd aria-hidden="true">${i + 1}</kbd>` : ''}</label>`).join('')}
      </fieldset>
      ${error ? `<p class="field-error" id="err-item" role="alert">${esc(error)}</p>` : ''}
      <div class="actions question-actions">
        ${backHref ? `<a class="btn btn-secondary" href="${backHref}">Back</a>` : ''}
        <button type="submit" class="btn btn-primary">${esc(submitLabel)}</button>
        <p class="t-caption key-hint">${options.length > 9 ? 'Press 1 to 9 to choose, or use the arrow keys, then Enter.' : `Press 1 to ${options.length} to choose, then Enter.`}</p>
      </div>
    </form>`;
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
  if (!r) return shell(s, 'results', 'Results', notice('info', '<p>Your results will appear here after Sarah has gone through them with you in your feedback session.</p>', { cls: 'reading', word: 'Not shared yet' }));
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
  return shell(s, 'results', 'Results', `<p class="t-caption">Shared by Sarah on ${fmtDate(r.releasedAt)}. A description of how things were when you answered, not a diagnosis.</p>${sections}`);
}

export function formulation(s) {
  const f = s.ctx.formulation;
  if (!f) return shell(s, 'formulation', 'Formulation', notice('info', '<p>Your formulation is the shared picture of what you are working on, what shaped it, what keeps it going and what helps. Sarah builds it with you and shares it here once you have been through it together.</p>', { cls: 'reading', word: 'Not shared yet' }));
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
              <label class="t-caption factor-comment-label" for="cm-${esc(x.id)}">Comment for Sarah (optional)</label>
              <input class="input input-small" id="cm-${esc(x.id)}" name="comment" maxlength="500" value="${esc(r.comment ?? '')}">
              <button type="submit" class="btn btn-secondary btn-inline">Save comment</button>
              <p class="t-caption factor-saved" data-saved role="status">${r.at ? `Saved ${fmtDate(r.at)}.` : ''}</p>
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
    <p class="t-caption">Shared by Sarah on ${fmtDate(f.releasedAt)}. On each card, say whether it fits and add a comment if you like. Your choice saves as you make it, and Sarah sees your answers.</p>
    ${f.summary ? `<section class="formulation-summary" aria-labelledby="h-sum"><h2 id="h-sum" class="t-ui-strong">From Sarah</h2>${f.summary.split('\n').filter(Boolean).map((para) => `<p>${esc(para)}</p>`).join('')}</section>` : ''}
    <div data-formulation-picture>${renderFormulationView(f.view, f.factors, responses)}</div>
    <div class="zones zones-5">${zones}</div>`,
  );
}

export function account(s) {
  const c = s.ctx.client;
  const mine = s.ctx.requests;
  const e = s.errors;
  // 1 open request for a copy at a time, so there is 1 clear due date.
  const openAccess = mine.find((r) => r.kind === 'access' && r.status !== 'done');
  return shell(
    s,
    'account',
    'Account',
    `${flashHtml(s.flash)}
    <div class="toolbar toolbar-top">
      <section class="stack reading" aria-labelledby="h-details">
        <h2 id="h-details">Your details</h2>
        <dl class="details">
          <div><dt>Name</dt><dd>${esc(c.name)}</dd></div>
          <div><dt>Email</dt><dd>${esc(c.email)}</dd></div>
          <div><dt>Joined</dt><dd>${fmtDate(c.activatedAt)}</dd></div>
        </dl>
      </section>
      <button type="button" class="btn btn-secondary btn-inline" data-action="logout">Log out</button>
    </div>
    <section class="stack reading" aria-labelledby="h-privacy">
      <h2 id="h-privacy">Your information</h2>
      <p>Your information is stored securely in Sydney, Australia, and Sarah is responsible for it. You can ask to see it or ask for it to be corrected at any time. Sarah will reply within 20 working days.</p>
      ${
        openAccess
          ? `<p>You asked for a copy of your information on ${fmtDate(openAccess.createdAt)}. Sarah will reply by ${fmtDate(openAccess.dueBy)}.</p>`
          : '<div class="actions"><button type="button" class="btn btn-secondary" data-action="request-access">Request a copy of my information</button></div>'
      }
      <form class="stack" data-form="correction" novalidate>
        <div class="field${e.detail ? ' field-invalid' : ''}">
          <label class="field-label" for="corr">Ask for a correction</label>
          <span class="field-hint" id="corr-hint">Tell Sarah what is wrong and what it should say.</span>
          <textarea class="textarea" id="corr" name="detail" aria-describedby="corr-hint${e.detail ? ' err-detail' : ''}"${e.detail ? ' aria-invalid="true"' : ''} maxlength="1000"></textarea>
          ${fieldError(e, 'detail')}
        </div>
        <div class="actions"><button type="submit" class="btn btn-secondary">Send correction request</button></div>
      </form>
      ${mine.length ? `<ul class="task-list">${mine.map((r) => `<li class="task"><div><p class="task-name">${r.kind === 'access' ? 'Copy of my information' : 'Correction'}</p><p class="task-meta">Sent ${fmtDate(r.createdAt)}, reply due by ${fmtDate(r.dueBy)}</p></div>${r.status === 'done' ? status('done', 'Answered') : status('progress', 'With Sarah')}<span></span></li>`).join('')}</ul>` : ''}
    </section>
    ${contactLink(s) ? `<section class="stack reading" aria-labelledby="h-contact"><h2 id="h-contact">Contact Sarah</h2><p>For anything about your sessions or the Client Hub, email ${contactLink(s)}.</p></section>` : ''}
`,
  );
}
