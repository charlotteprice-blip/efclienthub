// Live practitioner (Sarah) and admin screens.

import { CADENCE_LABELS, STAGE_LABELS, esc, fmtDate, fmtDateTime, fmtDay, practitionerShell, relative, status, toLocalInput } from '../ui.js';
import { FIT_LABELS, MARK_SRC, ROUTES, ZONES, zoneOf } from './views-client.js';
import { suggestFactors } from '../formulation.js';

const flashHtml = (flash) => (flash ? `<div class="notice${flash.error ? ' notice-error' : ''}" role="${flash.error ? 'alert' : 'status'}"><p>${esc(flash.text)}</p></div>` : '');

function typeLabel(s, t) {
  return s.clientTypes.types[t]?.practitionerLabel ?? 'Not set';
}
const typeCell = (s, t) => `<span class="type-dot" data-type="${esc(t ?? 'none')}"></span>${esc(typeLabel(s, t))}`;

const assignmentsFor = (s, uid) => s.ctx.assignments.filter((a) => a.uid === uid);
const draftsFor = (s, uid) => assignmentsFor(s, uid).filter((a) => a.status === 'complete' && s.ctx.scoring[a.id]?.draft).map((a) => ({ assignment: a, ...s.ctx.scoring[a.id] }));
const releasedIds = (s, uid) => new Set((s.ctx.results[uid]?.items ?? []).map((i) => i.assignmentId));
export const unreleased = (s, uid) => draftsFor(s, uid).filter((d) => d.draft.clientFacing !== false && !releasedIds(s, uid).has(d.assignment.id)).length;
const schedulesFor = (s, uid) => (s.ctx.schedules ?? []).filter((x) => x.uid === uid);

function scheduleRow(s, x) {
  const m = s.ctx.measures[x.measureId];
  const when = x.cadence === 'dates' ? `${x.dates.length} date${x.dates.length === 1 ? '' : 's'}, ${fmtDay(x.startsOn)} to ${fmtDay(x.endsOn)}` : `${CADENCE_LABELS[x.cadence]} from ${fmtDay(x.startsOn)}${x.endsOn ? ` to ${fmtDay(x.endsOn)}` : ''}`;
  const chip = x.status === 'ended' ? status('done', 'Ended') : x.status === 'paused' ? status('attention', 'Paused') : status('progress', `Next ${fmtDay(x.nextDue)}`);
  const buttons =
    x.status === 'ended'
      ? '<span></span>'
      : `<span class="actions-inline">${x.status === 'paused' ? `<button type="button" class="btn btn-secondary" data-action="schedule" data-do="resume" data-id="${esc(x.id)}">Resume</button>` : `<button type="button" class="btn btn-secondary" data-action="schedule" data-do="pause" data-id="${esc(x.id)}">Pause</button>`}<button type="button" class="btn btn-quiet" data-action="schedule" data-do="end" data-id="${esc(x.id)}">End</button></span>`;
  return `<li class="task"><div><p class="task-name">${esc(m?.name ?? x.measureId)}</p><p class="task-meta">${esc(when)}. Sent ${x.runs ?? 0} time${x.runs === 1 ? '' : 's'}.</p></div>${chip}${buttons}</li>`;
}

// Subscale scores for every completed copy of a questionnaire, by date,
// so Sarah can see change over repeated check ins. Shown only when a
// questionnaire has been completed more than once.
function scoresOverTime(s, uid) {
  const done = assignmentsFor(s, uid).filter((a) => a.status === 'complete' && s.ctx.scoring[a.id]?.scores);
  const byMeasure = new Map();
  for (const a of done) byMeasure.set(a.measureId, [...(byMeasure.get(a.measureId) ?? []), a]);
  const blocks = [...byMeasure.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([measureId, list]) => {
      const sorted = list.sort((a, b) => a.completedAt - b.completedAt);
      const m = s.ctx.measures[measureId];
      const subs = Object.entries(s.ctx.scoring[sorted[0].id].scores.subscales);
      return `<article class="draft stack">
        <h3>${esc(m?.name ?? measureId)}</h3>
        <div class="table-wrap"><table class="table"><thead><tr><th scope="col">Subscale</th>${sorted.map((a) => `<th scope="col">${esc(fmtDate(a.completedAt))}</th>`).join('')}</tr></thead>
        <tbody>${subs.map(([id, first]) => `<tr><td>${esc(first.label)}</td>${sorted.map((a) => `<td>${s.ctx.scoring[a.id].scores.subscales[id]?.score ?? 'Not scored'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      </article>`;
    });
  return blocks.join('');
}

function reviewCount(s) {
  if (s.role !== 'practitioner') return 0;
  return Object.keys(s.ctx.clients).filter((uid) => unreleased(s, uid) > 0).length + s.ctx.requests.filter((r) => r.status === 'open').length;
}

function shell(s, active, title, content, wide = false) {
  return practitionerShell({
    title,
    active,
    content: `${flashHtml(s.flash)}${content}`,
    wide,
    markSrc: MARK_SRC,
    routes: ROUTES,
    role: s.role,
    person: { name: s.user.displayName || s.user.email },
    accountHref: '/account',
    counts: { review: reviewCount(s) },
  });
}

function resultsStatus(s, uid) {
  if (unreleased(s, uid) > 0) return status('attention', 'Draft to review');
  if (s.ctx.results[uid]?.releasedAt) return status('done', 'Released');
  if (assignmentsFor(s, uid).some((a) => a.status !== 'complete')) return status('progress', 'Waiting');
  return 'None yet';
}

// ---------- dashboard ----------

const STAGE_ORDER = Object.keys(STAGE_LABELS);
const DAY = 86400000;

// Working days until a due date, Monday to Friday, ignoring public holidays.
function workingDaysUntil(ts) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  let days = 0;
  while (d.getTime() < ts) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) days += 1;
  }
  return days;
}

export function attentionItems(s) {
  const t = { codeDays: 7, intakeDays: 3, questionnaireDays: 7, requestWorkingDays: 5, ...(s.config.attention ?? {}) };
  const now = Date.now();
  const items = [];
  for (const c of s.ctx.codes) {
    if (!c.redeemedByUid && c.expiresAt > now && now - c.issuedAt > t.codeDays * DAY) {
      items.push({ kind: 'code', who: c.forName, text: `Activation code issued ${relative(c.issuedAt)} and not yet used`, href: '/practitioner/codes' });
    }
  }
  for (const c of Object.values(s.ctx.clients)) {
    const uid = c.uid ?? c.id;
    if (!c.codeHash) continue;
    const href = `/practitioner/client/${uid}`;
    if (!c.activatedAt && now - (c.createdAt ?? now) > t.intakeDays * DAY) {
      items.push({ kind: 'intake', who: c.name || c.email, text: `Signed up ${relative(c.createdAt)} and has not finished setting up`, href });
    }
    const stale = assignmentsFor(s, uid).filter((a) => a.status === 'notStarted' && now - (a.assignedAt ?? now) > t.questionnaireDays * DAY);
    if (stale.length) {
      items.push({ kind: 'questionnaire', who: c.name || c.email, text: `${stale.length} questionnaire${stale.length === 1 ? '' : 's'} assigned ${relative(Math.min(...stale.map((a) => a.assignedAt)))} and not started`, href });
    }
  }
  for (const r of s.ctx.requests) {
    if (r.status === 'open' && workingDaysUntil(r.dueBy) <= t.requestWorkingDays) {
      items.push({ kind: 'request', who: s.ctx.clients[r.uid]?.name ?? 'Client', text: `${r.kind === 'access' ? 'Access' : 'Correction'} request due ${fmtDate(r.dueBy)}`, href: '/practitioner/review' });
    }
  }
  return items;
}

function checkInsThisWeek(s) {
  const end = new Date();
  end.setDate(end.getDate() + 7);
  const limit = end.toISOString().slice(0, 10);
  return s.ctx.schedules.filter((x) => x.status === 'active' && x.nextDue && x.nextDue <= limit).sort((a, b) => a.nextDue.localeCompare(b.nextDue));
}

// 1 compact row per client: who, where they are in words with a 7 segment
// bar, and what Sarah can do next.
function clientRow(s, c) {
  const uid = c.uid ?? c.id;
  const list = assignmentsFor(s, uid);
  const initial = list.filter((a) => a.source !== 'scheduled');
  const done = initial.filter((a) => a.status === 'complete').length;
  const current = c.activatedAt ? STAGE_ORDER.indexOf(c.journeyStage) : -1;
  const drafts = unreleased(s, uid);
  const results = s.ctx.results[uid];
  const formulation = s.ctx.formulations[uid];
  const responses = s.ctx.formulationResponses?.[uid]?.responses ?? {};
  const schedule = schedulesFor(s, uid).find((x) => x.status === 'active' && x.nextDue);
  const facts = [];
  if (!c.activatedAt) facts.push(`Signed up ${relative(c.createdAt).toLowerCase()}, consent and intake not yet done`);
  if (initial.length) facts.push(`${done} of ${initial.length} questionnaire${initial.length === 1 ? '' : 's'} done`);
  if (c.nextSessionAt) facts.push(`Next session ${fmtDateTime(c.nextSessionAt)}`);
  if (schedule) facts.push(`Check in due ${fmtDay(schedule.nextDue)}`);
  if (formulation?.releasedAt) facts.push(`Formulation shared, ${formulation.factors.filter((f) => responses[f.id]).length} of ${formulation.factors.length} cards answered`);
  else if (results?.releasedAt) facts.push(`Results shared ${fmtDate(results.releasedAt)}`);
  const button = drafts > 0
    ? `<a class="btn btn-primary btn-inline" href="/practitioner/client/${esc(uid)}">Review ${drafts} draft${drafts === 1 ? '' : 's'}</a>`
    : `<a class="btn btn-secondary btn-inline" href="/practitioner/client/${esc(uid)}">Open</a>`;
  const segments = STAGE_ORDER.map((_, i) => `<i class="${i < current ? 'done' : i === current ? 'current' : ''}"></i>`).join('');
  const stageName = current < 0 ? 'Setting up' : `${STAGE_LABELS[c.journeyStage]} <span class="t-caption">(step ${current + 1} of ${STAGE_ORDER.length})</span>`;
  return `<li class="client-row">
    <div class="client-who">
      <span class="avatar avatar-lg" aria-hidden="true">${esc(String(c.name || c.email || 'C').trim().charAt(0).toUpperCase())}</span>
      <div><a class="t-ui-strong" href="/practitioner/client/${esc(uid)}">${esc(c.name || c.email || 'Unnamed')}</a><p class="t-caption">${c.clientType ? esc(typeLabel(s, c.clientType)) : 'Type not set'}</p><p class="t-caption">${c.lastActive ? `Active ${esc(relative(c.lastActive).toLowerCase())}` : 'Not yet active'}</p></div>
    </div>
    <div class="client-stage">
      <p class="t-ui-strong">${stageName}</p>
      <div class="segments" role="img" aria-label="${esc(current < 0 ? 'Setting up' : `Step ${current + 1} of ${STAGE_ORDER.length}`)}">${segments}</div>
      <p class="t-caption">${esc(facts.join('. '))}${facts.length ? '.' : ''}</p>
    </div>
    <div class="client-next">${button}</div>
  </li>`;
}

export function dashboard(s) {
  const clients = Object.values(s.ctx.clients).filter((c) => c.codeHash);
  const attention = attentionItems(s);
  const checkIns = checkInsThisWeek(s);
  const byStage = (a, b) => STAGE_ORDER.indexOf(a.journeyStage) - STAGE_ORDER.indexOf(b.journeyStage) || (b.lastActive ?? 0) - (a.lastActive ?? 0);
  const rows = clients.sort(byStage).map((c) => clientRow(s, c)).join('');
  const total = clients.length;
  const today = [
    ...attention.map((x) => ({ who: x.who, text: x.text, href: x.href, label: 'Open' })),
    ...checkIns.map((x) => ({ who: s.ctx.clients[x.uid]?.name ?? 'Client', text: `Check in: ${s.ctx.measures[x.measureId]?.name ?? x.measureId}, ${fmtDay(x.nextDue)}`, href: `/practitioner/client/${x.uid}`, label: 'Open' })),
  ];
  return shell(
    s,
    'dashboard',
    'Dashboard',
    `<section class="stack" aria-labelledby="h-today">
      <h2 id="h-today">Today</h2>
      ${today.length ? `<ul class="task-list">${today.map((x) => `<li class="task"><div><p class="task-name">${esc(x.who)}</p><p class="task-meta">${esc(x.text)}</p></div><span></span><a class="btn btn-secondary" href="${esc(x.href)}">${esc(x.label)}</a></li>`).join('')}</ul>` : '<p class="t-caption">Nothing waiting on you, and no check ins due in the next 7 days.</p>'}
    </section>
    <section class="stack" aria-labelledby="h-prog">
      <div class="toolbar"><h2 id="h-prog">Clients${total ? ` <span class="t-caption">${total}</span>` : ''}</h2><a class="btn btn-quiet" href="/practitioner/clients">Table view</a></div>
      ${rows ? `<ul class="client-rows">${rows}</ul>` : '<p>No clients yet. <a href="/practitioner/codes">Issue an activation code</a> to invite the first one.</p>'}
    </section>`,
    true,
  );
}

export function clients(s) {
  const rows = Object.values(s.ctx.clients)
    .filter((c) => c.codeHash)
    .sort((a, b) => (b.lastActive ?? 0) - (a.lastActive ?? 0))
    .map((c) => {
      const list = assignmentsFor(s, c.uid ?? c.id);
      const uid = c.uid ?? c.id;
      return `<tr>
        <td><a href="/practitioner/client/${esc(uid)}">${esc(c.name || c.email || 'Unnamed')}</a>${c.activatedAt ? '' : ' <span class="t-caption">(setting up)</span>'}</td>
        <td>${typeCell(s, c.clientType)}</td>
        <td>${esc(STAGE_LABELS[c.journeyStage] ?? 'Setting up')}</td>
        <td>${list.filter((a) => a.status === 'complete').length} of ${list.length}</td>
        <td>${resultsStatus(s, uid)}</td>
        <td>${relative(c.lastActive)}</td>
      </tr>`;
    })
    .join('');
  const waiting = s.ctx.codes.filter((c) => !c.redeemedByUid && c.expiresAt > Date.now()).length;
  return shell(
    s,
    'clients',
    'Clients',
    `<div class="toolbar">
      <p class="reading">Everyone who has used an activation code. Select a name to see their questionnaires, draft results and formulation.</p>
      <a class="btn btn-primary btn-inline" href="/practitioner/codes">Issue activation code</a>
    </div>
    <div class="table-wrap"><table class="table table-clients">
      <thead><tr><th scope="col">Client</th><th scope="col">Type</th><th scope="col">Stage</th><th scope="col">Done</th><th scope="col">Results</th><th scope="col">Last active</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">No clients yet. Issue an activation code to invite the first one.</td></tr>'}</tbody>
    </table></div>
    ${waiting ? `<p class="t-caption">${waiting} activation code${waiting === 1 ? '' : 's'} not yet used. <a href="/practitioner/codes">See codes</a></p>` : ''}`,
    true,
  );
}

function requestRow(s, r) {
  const who = s.ctx.clients[r.uid]?.name ?? 'Client';
  return `<li class="task"><div><p class="task-name">${esc(who)}: ${r.kind === 'access' ? 'copy of their information' : 'correction'}</p><p class="task-meta">${r.detail ? `"${esc(r.detail)}". ` : ''}Received ${fmtDate(r.createdAt)}, reply due by ${fmtDate(r.dueBy)}</p></div>${
    r.status === 'done' ? status('done', 'Answered') : status('attention', 'Open')
  }${r.status === 'done' ? '<span></span>' : `<button type="button" class="btn btn-secondary" data-action="close-request" data-id="${esc(r.id)}">Mark answered</button>`}</li>`;
}

export function client(s, uid) {
  const c = s.ctx.clients[uid];
  if (!c) return clients({ ...s, flash: { text: 'Client not found.', error: true } });
  const list = assignmentsFor(s, uid);
  const drafts = draftsFor(s, uid);
  const released = s.ctx.results[uid];
  const pending = unreleased(s, uid);
  const intake = s.ctx.intake[uid];
  const fdoc = s.ctx.formulationDrafts[uid];
  const fd = s.draftFactors?.[uid] ?? fdoc?.factors ?? [];
  const fSummary = s.draftSummary?.[uid] ?? fdoc?.summary ?? '';
  const fr = s.ctx.formulations[uid];
  const fResponses = s.ctx.formulationResponses?.[uid]?.responses ?? {};
  const suggestions = suggestFactors(released, fd);
  const draftChanged = fr && fdoc?.updatedAt && fdoc.updatedAt > fr.releasedAt;
  const requests = s.ctx.requests.filter((r) => r.uid === uid);
  const measures = Object.values(s.ctx.measures);
  const assignable = measures.filter((m) => (m.licenceStatus === 'cleared' || m.licenceStatus === 'sample') && !list.some((a) => a.measureId === m.id && a.status !== 'complete'));
  const released_ = releasedIds(s, uid);
  const schedules = schedulesFor(s, uid);
  const schedulable = measures.filter((m) => (m.licenceStatus === 'cleared' || m.licenceStatus === 'sample') && !schedules.some((x) => x.measureId === m.id && x.status !== 'ended'));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const overTime = scoresOverTime(s, uid);

  const intakeAnswers = intake
    ? s.intakeConfig.questions
        .filter((q) => intake.answers?.[q.id])
        .map((q) => {
          const v = intake.answers[q.id];
          const shown = q.type === 'single' ? q.options.find((o) => o.value === v)?.label ?? v : v;
          return `<div><dt>${esc(q.text)}</dt><dd>${esc(shown)}</dd></div>`;
        })
        .join('')
    : '';

  const draftBlocks = drafts
    .map((d) => {
      const rows = Object.values(d.scores.subscales)
        .map((sub) => `<tr><td>${esc(sub.label)}</td><td>${sub.score ?? 'Not scored'}</td><td>${esc({ strength: 'Strength', typical: 'Typical', focus: 'Area of focus', notScored: 'Too few answers' }[sub.band])}</td><td>${sub.answered} of ${sub.of}</td></tr>`)
        .join('');
      const isReleased = released_.has(d.assignment.id);
      const staffOnly = d.draft.clientFacing === false;
      const flags = (d.draft.flags ?? []).length
        ? `<div class="notice notice-error" role="alert"><p class="t-ui-strong">Answers to follow up</p><ul class="result-list">${d.draft.flags.map((f) => `<li><p>${esc(f.text)}</p><p class="t-caption">Answered ${f.value}. ${esc(f.note)}</p></li>`).join('')}</ul></div>`
        : '';
      return `<article class="draft stack">
        <div class="draft-head"><h3>${esc(d.draft.measureName)}</h3>${staffOnly ? status('progress', 'For you only') : isReleased ? status('done', 'Released') : status('attention', 'Draft')}</div>
        <p class="t-caption">Automated draft scoring for your review. Not a diagnosis. ${staffOnly ? 'This questionnaire is never summarised to the client.' : isReleased ? 'Shared with the client.' : 'Not visible to the client.'} Completed ${fmtDate(d.assignment.completedAt)}.</p>
        ${flags}
        <div class="table-wrap"><table class="table"><thead><tr><th scope="col">Subscale</th><th scope="col">Score</th><th scope="col">Band</th><th scope="col">Answered</th></tr></thead><tbody>${rows}</tbody></table></div>
        ${staffOnly ? '' : `<div class="split">
          <div class="stack"><p class="t-ui-strong">Strengths the client would see</p>${d.draft.strengths.length ? `<ul class="result-list">${d.draft.strengths.map((x) => `<li><p>${esc(x.label)}</p><p class="t-caption">${esc(x.reason)}</p></li>`).join('')}</ul>` : '<p class="t-caption">None.</p>'}</div>
          <div class="stack"><p class="t-ui-strong">Areas of focus the client would see</p>${d.draft.focus.length ? `<ul class="result-list">${d.draft.focus.map((x) => `<li><p>${esc(x.label)}</p><p class="t-caption">${esc(x.reason)} Links to ${esc(x.topic?.label ?? 'no topic')}.</p></li>`).join('')}</ul>` : '<p class="t-caption">None.</p>'}</div>
        </div>`}
      </article>`;
    })
    .join('');

  const responseLine = (f) => {
    const r = fResponses[f.id];
    if (!r) return '';
    const stale = fr && r.version && fr.version && r.version < fr.version;
    return `<p class="t-caption factor-response">${esc(c.name || 'Client')}: ${esc(r.fit ? FIT_LABELS[r.fit] : 'commented')}${r.comment ? ` "${esc(r.comment)}"` : ''}${stale ? ' (on an earlier version)' : ''}</p>`;
  };
  const zones = ZONES.map(
    (z) => `<div class="stack zone zone-edit" data-zone="${z.id}">
      <p class="t-ui-strong">${esc(z.hint)}</p>
      <p class="t-caption">${esc(z.title)}${z.id === 'perpetuating' ? '. Shown to the client as the focus of your work together' : ''}.</p>
      <ul class="zone-cards">${fd
        .filter((f) => zoneOf(f) === z.id)
        .map(
          (f) => `<li class="factor${f.source ? ' factor-sourced' : ''}"><div class="factor-body"><span>${esc(f.text)}</span>${f.source ? `<p class="t-caption">From ${esc(f.source.measureName)}</p>` : ''}${responseLine(f)}</div>
            <label class="visually-hidden" for="mv-${esc(f.id)}">Move "${esc(f.text)}" to</label>
            <select class="select select-small" id="mv-${esc(f.id)}" data-move-factor="${esc(f.id)}" data-uid="${esc(uid)}">${ZONES.map((o) => `<option value="${o.id}"${o.id === z.id ? ' selected' : ''}>${esc(o.hint)}</option>`).join('')}</select>
            <button type="button" class="btn btn-quiet" data-action="remove-factor" data-uid="${esc(uid)}" data-factor="${esc(f.id)}" aria-label="Remove ${esc(f.text)}">Remove</button></li>`,
        )
        .join('')}</ul>
      <form class="inline-add" data-form="add-factor" data-uid="${esc(uid)}" data-zone="${z.id}" novalidate>
        <label class="visually-hidden" for="add-${z.id}">Add a ${esc(z.hint.toLowerCase())} factor</label>
        <input class="input" id="add-${z.id}" name="text" placeholder="Add a factor" maxlength="140">
        <button type="submit" class="btn btn-secondary">Add</button>
      </form>
    </div>`,
  ).join('');
  const suggestionList = suggestions.length
    ? `<div class="stack suggestions"><p class="t-ui-strong">From the released results</p><p class="t-caption">Areas of focus can be placed as perpetuating factors and strengths as protective factors. Each shows its source on the card; edit the wording after adding if you wish.</p>
      <ul class="zone-cards">${suggestions
        .map((x, i) => `<li class="factor factor-suggest"><div class="factor-body"><span>${esc(x.text)}</span><p class="t-caption">${x.kind === 'focus' ? 'Area of focus' : 'Strength'} in ${esc(x.source.measureName)}</p></div><button type="button" class="btn btn-secondary btn-inline" data-action="add-suggestion" data-uid="${esc(uid)}" data-index="${i}">Add as ${esc(x.zone)}</button></li>`)
        .join('')}</ul></div>`
    : '';

  return shell(
    s,
    'clients',
    c.name || c.email || 'Client',
    `<p><a href="/practitioner">All clients</a></p>
    <div class="split">
      <section class="panel stack" aria-labelledby="h-profile">
        <h2 id="h-profile">Profile</h2>
        <dl class="details">
          <div><dt>Email</dt><dd>${esc(c.email)}</dd></div>
          <div><dt>Activated</dt><dd>${c.activatedAt ? fmtDate(c.activatedAt) : 'Still setting up'}</dd></div>
          <div><dt>Consent recorded</dt><dd>${c.consentAt ? `${fmtDate(c.consentAt)} (notice ${esc(c.consentVersion)})` : 'Not yet'}</dd></div>
          <div><dt>Retention date</dt><dd>${c.retentionUntil ? fmtDate(c.retentionUntil) : 'Set when the work ends'}</dd></div>
        </dl>
        <form class="inline-add" data-form="set-type" data-uid="${esc(uid)}" novalidate>
          <label class="field-label" for="type">Client type</label>
          <select class="select" id="type" name="type"><option value="">Not set</option>${Object.keys(s.clientTypes.types).map((t) => `<option value="${t}"${c.clientType === t ? ' selected' : ''}>${esc(typeLabel(s, t))}</option>`).join('')}</select>
          <button type="submit" class="btn btn-secondary">Save type</button>
        </form>
        ${intake ? `<p class="t-caption">Set by ${intake.overriddenBy ? 'you' : intake.source === 'code' ? 'the activation code' : intake.source === 'rule' ? 'the intake answers' : 'no rule; please choose'}.</p>` : ''}
        <form class="inline-add" data-form="set-stage" data-uid="${esc(uid)}" novalidate>
          <label class="field-label" for="stage">Journey stage</label>
          <select class="select" id="stage" name="stage">${s.clientTypes.stages.map((st) => `<option value="${st}"${c.journeyStage === st ? ' selected' : ''}>${esc(STAGE_LABELS[st])}</option>`).join('')}</select>
          <button type="submit" class="btn btn-secondary">Save stage</button>
        </form>
      </section>
      <section class="panel stack" aria-labelledby="h-intake">
        <h2 id="h-intake">Intake answers</h2>
        ${intakeAnswers ? `<dl class="details">${intakeAnswers}</dl>` : '<p>Not completed yet.</p>'}
      </section>
    </div>

    <div class="split">
      <section class="panel stack" aria-labelledby="h-session">
        <h2 id="h-session">Next session</h2>
        <p class="t-caption">Shown on the client's Home. Sessions are still booked in Splose; this is the reminder.</p>
        ${c.nextSessionAt ? `<p class="t-ui-strong">${esc(fmtDateTime(c.nextSessionAt))}</p>${c.nextSessionNote ? `<p class="t-caption">${esc(c.nextSessionNote)}</p>` : ''}` : '<p>No session recorded.</p>'}
        <form class="stack" data-form="next-session" data-uid="${esc(uid)}" novalidate>
          <div class="split">
            <div class="field"><label class="field-label" for="ns-at">Date and time</label><input class="input" id="ns-at" name="at" type="datetime-local" value="${esc(toLocalInput(c.nextSessionAt))}"></div>
            <div class="field"><label class="field-label" for="ns-note">Note (optional)</label><input class="input" id="ns-note" name="note" maxlength="160" placeholder="Online, link by email" value="${esc(c.nextSessionNote ?? '')}"></div>
          </div>
          ${s.errors.session ? `<p class="field-error">${esc(s.errors.session)}</p>` : ''}
          <div class="actions-inline"><button type="submit" class="btn btn-secondary">Save session</button>${c.nextSessionAt ? `<button type="button" class="btn btn-quiet" data-action="clear-session" data-uid="${esc(uid)}">Clear</button>` : ''}</div>
        </form>
      </section>
      <section class="panel stack" aria-labelledby="h-res">
        <h2 id="h-res">Resources for ${esc(c.name || 'the client')}</h2>
        <p class="t-caption">Links the client sees under Your resources: Learning Hub pages, handouts hosted elsewhere, recordings. Areas of focus from released results link to their Learning Hub topics automatically.</p>
        ${(c.resources ?? []).length ? `<ul class="task-list">${c.resources.map((r) => `<li class="task"><div><p class="task-name"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a></p>${r.note ? `<p class="task-meta">${esc(r.note)}</p>` : ''}</div><span></span><button type="button" class="btn btn-quiet" data-action="remove-resource" data-uid="${esc(uid)}" data-resource="${esc(r.id)}">Remove</button></li>`).join('')}</ul>` : '<p>None yet.</p>'}
        <form class="stack" data-form="add-resource" data-uid="${esc(uid)}" novalidate>
          <div class="split">
            <div class="field"><label class="field-label" for="rs-title">Title</label><input class="input" id="rs-title" name="title" maxlength="80"></div>
            <div class="field"><label class="field-label" for="rs-url">Link (https)</label><input class="input" id="rs-url" name="url" type="url" maxlength="300" placeholder="https://"></div>
          </div>
          <div class="field"><label class="field-label" for="rs-note">Note (optional)</label><input class="input" id="rs-note" name="note" maxlength="200" placeholder="Why this one, or what to look at first"></div>
          ${s.errors.resource ? `<p class="field-error">${esc(s.errors.resource)}</p>` : ''}
          <div class="actions-inline"><button type="submit" class="btn btn-secondary">Add resource</button></div>
        </form>
      </section>
    </div>

    <section class="stack" aria-labelledby="h-assign">
      <h2 id="h-assign">Questionnaires</h2>
      ${list.length ? `<ul class="task-list">${list.map((a) => {
        const m = s.ctx.measures[a.measureId];
        const chip = a.status === 'complete' ? status('done', `Done ${fmtDate(a.completedAt)}`) : a.status === 'inProgress' ? status('progress', 'In progress') : status('attention', 'Not started');
        return `<li class="task"><div><p class="task-name">${esc(m?.name ?? a.measureId)}</p><p class="task-meta">Assigned ${fmtDate(a.assignedAt)}</p></div>${chip}<span></span></li>`;
      }).join('')}</ul>` : '<p>No questionnaires assigned yet.</p>'}
      ${
        c.activatedAt && assignable.length
          ? `<form class="inline-add" data-form="assign" data-uid="${esc(uid)}" novalidate>
              <label class="visually-hidden" for="assign">Questionnaire to assign</label>
              <select class="select" id="assign" name="measureId">${measureOptions(assignable)}</select>
              <button type="submit" class="btn btn-secondary">Assign</button>
            </form>`
          : `<p class="t-caption">${c.activatedAt ? 'Every questionnaire in the library is assigned or in progress.' : 'Questionnaires can be assigned once the client has finished setting up.'}</p>`
      }
    </section>

    <section class="stack" aria-labelledby="h-checkin">
      <h2 id="h-checkin">Check ins</h2>
      <p class="reading t-caption">Questionnaires sent again on a schedule during your work together. Each one arrives on the client's Home on the morning of its date, New Zealand time. Finishing a check in does not move the client's stage.</p>
      ${schedules.length ? `<ul class="task-list">${schedules.map((x) => scheduleRow(s, x)).join('')}</ul>` : '<p>No check ins scheduled.</p>'}
      ${
        c.activatedAt && schedulable.length
          ? `<form class="schedule-form stack" data-form="schedule" data-uid="${esc(uid)}" novalidate>
              <div class="split">
                <div class="field"><label class="field-label" for="sch-measure">Questionnaire</label><select class="select" id="sch-measure" name="measureId">${measureOptions(schedulable)}</select></div>
                <div class="field"><label class="field-label" for="sch-cadence">How often</label><select class="select" id="sch-cadence" name="cadence">${Object.entries(CADENCE_LABELS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
              </div>
              <div class="split" data-cadence-fields="interval">
                <div class="field"><label class="field-label" for="sch-start">First check in</label><input class="input" id="sch-start" name="startsOn" type="date" min="${esc(today)}"><p class="field-hint">The client sees it on this date.</p></div>
                <div class="field"><label class="field-label" for="sch-end">Last check in (optional)</label><input class="input" id="sch-end" name="endsOn" type="date" min="${esc(today)}"><p class="field-hint">Leave blank to continue until you end it.</p></div>
              </div>
              <div class="field" data-cadence-fields="dates" hidden><label class="field-label" for="sch-dates">Dates</label><input class="input" id="sch-dates" name="dates" placeholder="2026-11-03, 2026-12-01"><p class="field-hint">Year-month-day, separated by commas.</p></div>
              ${s.errors.schedule ? `<p class="field-error">${esc(s.errors.schedule)}</p>` : ''}
              <div class="actions"><button type="submit" class="btn btn-secondary">Schedule check in</button></div>
            </form>`
          : `<p class="t-caption">${c.activatedAt ? 'Every cleared questionnaire already has a schedule.' : 'Check ins can be scheduled once the client has finished setting up.'}</p>`
      }
    </section>

    <section class="stack" aria-labelledby="h-draft">
      <h2 id="h-draft">Draft results</h2>
      ${overTime ? `<h3 class="t-ui-strong">Scores over time</h3>${overTime}` : ''}
      ${draftBlocks || '<p>Draft results appear here when the client finishes a questionnaire.</p>'}
      ${drafts.length ? `<div class="actions">${pending > 0 ? `<button type="button" class="btn btn-primary" data-action="release" data-uid="${esc(uid)}">Release results to ${esc(c.name || 'client')}</button>` : ''}${released?.releasedAt ? `<p class="t-caption">Last released ${fmtDate(released.releasedAt)}.</p>` : ''}</div>` : ''}
    </section>

    <section class="stack" aria-labelledby="h-form">
      <h2 id="h-form">Formulation</h2>
      <p class="t-caption">5P formulation: presenting, predisposing, precipitating, perpetuating and protective. Changes save as you make them; the client sees nothing until you release, and then sees the latest release only. The client can mark each card as fits, partly or does not fit and leave a comment, which appears under the card here.</p>
      <form class="stack" data-form="formulation-summary" data-uid="${esc(uid)}" novalidate>
        <div class="field">
          <label class="field-label" for="f-summary">Summary the client reads</label>
          <p class="field-hint">A short paragraph in plain language above the cards. Saves when you leave the box.</p>
          <textarea class="input textarea" id="f-summary" name="summary" rows="5" maxlength="1500">${esc(fSummary)}</textarea>
        </div>
      </form>
      ${suggestionList}
      <div class="zones zones-5">${zones}</div>
      <div class="actions">
        ${fd.length ? `<button type="button" class="btn ${draftChanged || !fr ? 'btn-primary' : 'btn-secondary'}" data-action="release-formulation" data-uid="${esc(uid)}">${fr ? 'Release updated formulation' : 'Release formulation'}</button>` : ''}
        ${fr ? `<p class="t-caption">Version ${fr.version ?? 1} released ${fmtDate(fr.releasedAt)}.${draftChanged ? ' The draft has changed since.' : ''}</p>` : '<p class="t-caption">Not yet released.</p>'}
      </div>
    </section>

    ${requests.length ? `<section class="stack" aria-labelledby="h-req"><h2 id="h-req">Privacy requests</h2><ul class="task-list">${requests.map((r) => requestRow(s, r)).join('')}</ul></section>` : ''}`,
    true,
  );
}

export function review(s) {
  const drafts = Object.values(s.ctx.clients).filter((c) => unreleased(s, c.uid ?? c.id) > 0);
  const open = s.ctx.requests.filter((r) => r.status === 'open');
  return shell(
    s,
    'review',
    'To review',
    `<section class="stack" aria-labelledby="h-d">
      <h2 id="h-d">Draft results waiting for release</h2>
      ${drafts.length ? `<ul class="task-list">${drafts.map((c) => {
        const uid = c.uid ?? c.id;
        const n = unreleased(s, uid);
        return `<li class="task"><div><p class="task-name">${esc(c.name || c.email)}</p><p class="task-meta">${n} questionnaire draft${n === 1 ? '' : 's'}</p></div>${status('attention', 'Draft')}<a class="btn btn-secondary" href="/practitioner/client/${esc(uid)}">Review</a></li>`;
      }).join('')}</ul>` : '<p>Nothing waiting. Drafts appear here when a client finishes a questionnaire.</p>'}
    </section>
    <section class="stack" aria-labelledby="h-p">
      <h2 id="h-p">Privacy requests</h2>
      ${open.length ? `<ul class="task-list">${open.map((r) => requestRow(s, r)).join('')}</ul>` : '<p>No open requests.</p>'}
    </section>`,
  );
}

export function codes(s) {
  const rows = s.ctx.codes
    .map((c) => {
      const used = c.redeemedByUid;
      const expired = !used && c.expiresAt < Date.now();
      return `<tr>
        <td>${esc(c.forName)}${c.email ? `<br><span class="t-caption">${esc(c.email)}</span>` : ''}</td>
        <td><span class="code">····-····-${esc(c.last4)}</span></td>
        <td>${c.clientTypeOverride ? typeCell(s, c.clientTypeOverride) : 'From intake'}</td>
        <td>${used ? status('done', `Used ${fmtDate(c.redeemedAt)}`) : expired ? status('attention', 'Expired') : status('progress', 'Not used yet')}</td>
        <td>${fmtDate(c.expiresAt)}</td>
      </tr>`;
    })
    .join('');
  const issued = s.lastIssued;
  return shell(
    s,
    'codes',
    'Activation codes',
    `${issued ? `<div class="panel stack issued"><p class="t-ui-strong">New code for ${esc(issued.forName)}</p><p class="code code-large">${esc(issued.code)}</p><p class="t-caption">Copy it now and send it to the client in your usual email. For security it is not shown again. It works once and expires ${fmtDate(issued.expiresAt)}.</p><div class="actions"><button type="button" class="btn btn-secondary" data-action="copy-code" data-code="${esc(issued.code)}">Copy code</button></div></div>` : ''}
    <section class="panel stack" aria-labelledby="h-issue">
      <h2 id="h-issue">Issue a code</h2>
      <form class="stack" data-form="issue-code" novalidate>
        <div class="split">
          <div class="field">
            <label class="field-label" for="for">Client name</label>
            <span class="field-hint" id="for-hint">For your list only.</span>
            <input class="input" id="for" name="forName" aria-describedby="for-hint" maxlength="80">
          </div>
          <div class="field">
            <label class="field-label" for="code-email">Client email (optional)</label>
            <span class="field-hint" id="ce-hint">If given, only this email can use the code.</span>
            <input class="input" id="code-email" name="email" type="email" aria-describedby="ce-hint" maxlength="120">
          </div>
          <div class="field">
            <label class="field-label" for="override">Client type</label>
            <span class="field-hint" id="ov-hint">Leave as intake to let the client's answers decide.</span>
            <select class="select" id="override" name="clientTypeOverride" aria-describedby="ov-hint">
              <option value="">Decide from intake answers</option>
              ${Object.keys(s.clientTypes.types).map((t) => `<option value="${t}">${esc(typeLabel(s, t))}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="actions"><button type="submit" class="btn btn-primary">Issue code</button></div>
      </form>
    </section>
    <div class="table-wrap"><table class="table">
      <thead><tr><th scope="col">For</th><th scope="col">Code</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Expires</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">No codes issued yet.</td></tr>'}</tbody>
    </table></div>`,
    true,
  );
}

// Options for a questionnaire select, grouped by domain and sorted by name.
export function measureOptions(list) {
  const groups = new Map();
  for (const m of [...list].sort((a, b) => a.name.localeCompare(b.name))) {
    const key = m.domain || (m.licenceStatus === 'sample' ? 'Sample questionnaires' : 'Other');
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  const option = (m) => `<option value="${esc(m.id)}">${esc(m.name)}${m.code ? ` (${esc(m.code)})` : ''}${m.licenceStatus === 'sample' ? ' (sample, testing only)' : ''}</option>`;
  if (groups.size === 1) return [...groups.values()][0].map(option).join('');
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([domain, ms]) => `<optgroup label="${esc(domain)}">${ms.map(option).join('')}</optgroup>`)
    .join('');
}

export function library(s) {
  const measures = Object.values(s.ctx.measures).sort((a, b) => a.name.localeCompare(b.name));
  const domains = [...new Set(measures.map((m) => m.domain).filter(Boolean))].sort();
  const tags = [...new Set(measures.flatMap((m) => m.tags ?? []))].sort((a, b) => a.localeCompare(b));
  const rows = measures
    .map((m) => {
      const staffOnly = m.scoringRules?.clientFacing === false;
      const search = [m.name, m.formalName, m.code, m.domain, m.description, (m.scoringRules?.subscales ?? []).map((x) => x.label).join(' ')].filter(Boolean).join(' ').toLowerCase();
      return `<tr data-row data-search="${esc(search)}" data-domain="${esc(m.domain ?? '')}" data-audience="${staffOnly ? 'staff' : 'client'}" data-licence="${esc(m.licenceStatus)}" data-tags="|${esc((m.tags ?? []).join('|'))}|" data-name="${esc(m.name.toLowerCase())}" data-questions="${m.items?.length ?? 0}" data-minutes="${m.minutes ?? 0}" data-subscales="${(m.scoringRules?.subscales ?? []).length}">
        <td><p class="t-ui-strong">${esc(m.name)}</p>${m.formalName ? `<p class="t-caption">${esc(m.formalName)}${m.code && !m.formalName.includes(m.code) ? ` (${esc(m.code)})` : ''}${staffOnly ? '. For you only; never summarised to the client' : ''}</p>` : ''}</td>
        <td>${esc(m.domain ?? '')}${m.tags?.length ? `<p class="t-caption">${esc(m.tags.join(', '))}</p>` : ''}</td>
        <td>${m.items?.length ?? 0}${m.minutes ? `<p class="t-caption">${m.minutes} min</p>` : ''}</td>
        <td>${esc((m.scoringRules?.subscales ?? []).map((x) => x.label).join(', '))}</td>
        <td>${m.licenceStatus === 'cleared' ? status('done', 'Cleared') : status('attention', 'Sample')}</td>
      </tr>`;
    })
    .join('');
  return shell(
    s,
    'library',
    'Questionnaire library',
    `<form class="filters" data-filters="library" role="search" aria-label="Filter the library" novalidate>
      <div class="field"><label class="field-label" for="lib-q">Search</label><input class="input" id="lib-q" name="q" type="search" placeholder="Name, code, subscale or topic" autocomplete="off"></div>
      <div class="field"><label class="field-label" for="lib-domain">Domain</label><select class="select" id="lib-domain" name="domain"><option value="">All domains</option>${domains.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join('')}</select></div>
      <div class="field"><label class="field-label" for="lib-audience">Results shown to</label><select class="select" id="lib-audience" name="audience"><option value="">Anyone</option><option value="client">Client and you</option><option value="staff">You only</option></select></div>
      <div class="field"><label class="field-label" for="lib-licence">Licence</label><select class="select" id="lib-licence" name="licence"><option value="">Any</option><option value="cleared">Cleared</option><option value="sample">Sample</option></select></div>
      <input type="hidden" name="tag" value="">
      ${tags.length ? `<div class="chips" role="group" aria-label="Condition or topic">
        <button type="button" class="chip" data-tag="" aria-pressed="true">All</button>
        ${tags.map((t) => `<button type="button" class="chip" data-tag="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join('')}
      </div>` : ''}
    </form>
    <p class="t-caption" data-filter-count>${measures.length} questionnaire${measures.length === 1 ? '' : 's'}</p>
    <div class="table-wrap"><table class="table table-library">
      <thead><tr>
        <th scope="col" aria-sort="ascending"><button type="button" class="sort" data-sort="name" data-kind="text">Questionnaire</button></th>
        <th scope="col"><button type="button" class="sort" data-sort="domain" data-kind="text">Domain</button></th>
        <th scope="col"><button type="button" class="sort" data-sort="questions" data-kind="number">Questions</button></th>
        <th scope="col"><button type="button" class="sort" data-sort="subscales" data-kind="number">Subscales</button></th>
        <th scope="col"><button type="button" class="sort" data-sort="licence" data-kind="text">Licence</button></th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="5">The library is empty. Charlotte adds questionnaires with npm run measures.</td></tr>'}</tbody>
    </table></div>`,
    true,
  );
}

export function staffAccount(s) {
  return shell(
    s,
    '',
    'Account',
    `<section class="stack reading">
      <dl class="details">
        <div><dt>Name</dt><dd>${esc(s.user.displayName || 'Not set')}</dd></div>
        <div><dt>Email</dt><dd>${esc(s.user.email)}</dd></div>
        <div><dt>Role</dt><dd>${s.role === 'practitioner' ? 'Practitioner' : 'Admin'}</dd></div>
      </dl>
      <div class="actions"><button type="button" class="btn btn-secondary" data-action="logout">Log out</button></div>
    </section>`,
  );
}
