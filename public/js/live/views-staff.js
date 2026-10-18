// Live practitioner (Sarah) and admin screens.

import { CADENCE_LABELS, STAGE_LABELS, esc, fmtDate, fmtDay, practitionerShell, relative, status } from '../ui.js';
import { MARK_SRC, ROUTES, ZONES } from './views-client.js';

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
    <div class="table-wrap"><table class="table">
      <thead><tr><th scope="col">Client</th><th scope="col">Type</th><th scope="col">Stage</th><th scope="col">Questionnaires</th><th scope="col">Results</th><th scope="col">Last active</th></tr></thead>
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
  const fd = s.draftFactors?.[uid] ?? s.ctx.formulationDrafts[uid]?.factors ?? [];
  const fr = s.ctx.formulations[uid];
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

  const zones = ZONES.map(
    (z) => `<div class="stack zone zone-edit">
      <p class="t-ui-strong">${esc(z.hint)}</p>
      <ul class="zone-cards">${fd
        .filter((f) => f.zone === z.id)
        .map((f) => `<li class="factor"><span>${esc(f.text)}</span><button type="button" class="btn btn-quiet" data-action="remove-factor" data-uid="${esc(uid)}" data-factor="${esc(f.id)}" aria-label="Remove ${esc(f.text)}">Remove</button></li>`)
        .join('')}</ul>
      <form class="inline-add" data-form="add-factor" data-uid="${esc(uid)}" data-zone="${z.id}" novalidate>
        <label class="visually-hidden" for="add-${z.id}">Add a ${esc(z.hint.toLowerCase())} factor</label>
        <input class="input" id="add-${z.id}" name="text" placeholder="Add a factor" maxlength="140">
        <button type="submit" class="btn btn-secondary">Add</button>
      </form>
    </div>`,
  ).join('');

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
      <p class="reading t-caption">Predisposing, precipitating, maintaining and protective factors. Maintaining factors show to the client as the focus of your work together. Changes save as you make them; the client sees nothing until you release.</p>
      <div class="zones">${zones}</div>
      <div class="actions">
        ${fd.length ? `<button type="button" class="btn btn-secondary" data-action="release-formulation" data-uid="${esc(uid)}">${fr ? 'Release updated formulation' : 'Release formulation'}</button>` : ''}
        ${fr ? `<p class="t-caption">Released ${fmtDate(fr.releasedAt)}.</p>` : ''}
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
  const rows = measures
    .map((m) => {
      const staffOnly = m.scoringRules?.clientFacing === false;
      const search = [m.name, m.formalName, m.code, m.domain, m.description, (m.scoringRules?.subscales ?? []).map((x) => x.label).join(' ')].filter(Boolean).join(' ').toLowerCase();
      return `<tr data-row data-search="${esc(search)}" data-domain="${esc(m.domain ?? '')}" data-audience="${staffOnly ? 'staff' : 'client'}" data-licence="${esc(m.licenceStatus)}">
        <td><p class="t-ui-strong">${esc(m.name)}</p>${m.formalName ? `<p class="t-caption">${esc(m.formalName)}${m.code && !m.formalName.includes(m.code) ? ` (${esc(m.code)})` : ''}${staffOnly ? '. For you only; never summarised to the client' : ''}</p>` : ''}</td>
        <td>${esc(m.domain ?? '')}</td>
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
    `<p class="reading">Questionnaires available to assign. They come from the EF Client Hub Codebook; Charlotte adds each one from the terminal once its licence status is cleared. Commercial instruments are never reproduced in the hub.</p>
    <form class="filters" data-filters="library" role="search" aria-label="Filter the library" novalidate>
      <div class="field"><label class="field-label" for="lib-q">Search</label><input class="input" id="lib-q" name="q" type="search" placeholder="Name, code, subscale or topic" autocomplete="off"></div>
      <div class="field"><label class="field-label" for="lib-domain">Domain</label><select class="select" id="lib-domain" name="domain"><option value="">All domains</option>${domains.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join('')}</select></div>
      <div class="field"><label class="field-label" for="lib-audience">Results shown to</label><select class="select" id="lib-audience" name="audience"><option value="">Anyone</option><option value="client">Client and you</option><option value="staff">You only</option></select></div>
      <div class="field"><label class="field-label" for="lib-licence">Licence</label><select class="select" id="lib-licence" name="licence"><option value="">Any</option><option value="cleared">Cleared</option><option value="sample">Sample</option></select></div>
    </form>
    <p class="t-caption" data-filter-count>${measures.length} questionnaire${measures.length === 1 ? '' : 's'}</p>
    <div class="table-wrap"><table class="table table-library">
      <thead><tr><th scope="col">Questionnaire</th><th scope="col">Domain</th><th scope="col">Questions</th><th scope="col">Subscales</th><th scope="col">Licence</th></tr></thead>
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
