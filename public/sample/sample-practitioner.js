// Sarah's practitioner screens for the clickable sample: clients, client
// detail, to review, activation codes and the questionnaire library.

import clientTypes from '../config/client-types.json' with { type: 'json' };
import intakeConfig from '../config/intake.json' with { type: 'json' };
import * as store from './sample-store.js';
import { STAGE_LABELS, esc, fmtDate, practitionerShell, relative, status } from './sample-ui.js';
import { MARK_SRC, ZONES, closeDialog, go, openDialog, render, setFlash } from './sample-app.js';

let flash = null;
const takeFlash = () => {
  const f = flash;
  flash = null;
  return f ? `<div class="notice" role="status"><p>${f}</p></div>` : '';
};

const typeLabel = (t) => clientTypes.types[t]?.practitionerLabel ?? 'Not set';
const typeCell = (t) => `<span class="type-dot" data-type="${esc(t ?? 'none')}"></span>${esc(typeLabel(t))}`;

function reviewCount() {
  const s = store.state();
  const drafts = Object.keys(s.clients).filter((uid) => store.unreleasedCount(uid) > 0).length;
  const requests = s.requests.filter((r) => r.status === 'open').length;
  return drafts + requests;
}

function shell(active, title, content, wide = false) {
  return practitionerShell({ title, active, content, wide, markSrc: MARK_SRC, counts: { review: reviewCount() } });
}

function resultsStatus(uid) {
  const s = store.state();
  const pending = store.unreleasedCount(uid);
  if (pending > 0) return status('attention', 'Draft to review');
  if (s.results[uid]?.releasedAt) return status('done', 'Released');
  if (store.clientAssignments(uid).some((a) => a.status !== 'complete')) return status('progress', 'Waiting');
  return 'None yet';
}

function viewClients() {
  const s = store.state();
  const rows = Object.values(s.clients)
    .filter((c) => c.activatedAt)
    .sort((a, b) => (b.lastActive ?? 0) - (a.lastActive ?? 0))
    .map((c) => {
      const list = store.clientAssignments(c.uid);
      return `<tr>
        <td><a href="#/p/client/${esc(c.uid)}">${esc(c.name)}</a>${c.uid === store.DEMO_UID ? ' <span class="t-caption">(you, in client view)</span>' : ''}</td>
        <td>${typeCell(c.clientType)}</td>
        <td>${esc(STAGE_LABELS[c.journeyStage] ?? 'Not started')}</td>
        <td>${list.filter((a) => a.status === 'complete').length} of ${list.length}</td>
        <td>${resultsStatus(c.uid)}</td>
        <td>${relative(c.lastActive)}</td>
      </tr>`;
    })
    .join('');
  const waiting = s.codes.filter((c) => !c.redeemedByUid && c.expiresAt > Date.now());
  return shell(
    'clients',
    'Clients',
    `${takeFlash()}
    <div class="toolbar">
      <p class="reading">Everyone who has activated the Client Hub. Select a name to see their questionnaires, draft results and formulation.</p>
      <a class="btn btn-primary btn-inline" href="#/p/codes">Issue activation code</a>
    </div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th scope="col">Client</th><th scope="col">Type</th><th scope="col">Stage</th><th scope="col">Questionnaires</th><th scope="col">Results</th><th scope="col">Last active</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">No clients have activated yet.</td></tr>'}</tbody>
    </table></div>
    ${waiting.length ? `<p class="t-caption">${waiting.length} activation code${waiting.length === 1 ? '' : 's'} not yet used. <a href="#/p/codes">See codes</a></p>` : ''}`,
    true,
  );
}

function viewClient(uid) {
  const s = store.state();
  const c = s.clients[uid];
  if (!c) return viewClients();
  const list = store.clientAssignments(uid);
  const drafts = store.draftsFor(uid);
  const released = s.results[uid];
  const pending = store.unreleasedCount(uid);
  const intake = s.intake[uid];
  const fd = s.formulationDrafts[uid]?.factors ?? [];
  const fr = s.formulations[uid];
  const requests = s.requests.filter((r) => r.uid === uid);
  const assignable = store.allMeasures().filter((m) => !list.some((a) => a.measureId === m.id && a.status !== 'complete'));

  const intakeAnswers = intake
    ? intakeConfig.questions
        .filter((q) => q.enabled && intake.answers[q.id])
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
      const isReleased = released?.items?.some((i) => i.measureId === d.measureId);
      return `<article class="draft stack">
        <div class="draft-head">
          <h3>${esc(d.draft.measureName)}</h3>
          ${isReleased ? status('done', 'Released') : status('attention', 'Draft')}
        </div>
        <p class="t-caption">Automated draft scoring for your review. Not a diagnosis. ${isReleased ? 'Shared with the client.' : 'Not visible to the client.'}</p>
        <div class="table-wrap"><table class="table"><thead><tr><th scope="col">Subscale</th><th scope="col">Mean</th><th scope="col">Band</th><th scope="col">Answered</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="split">
          <div class="stack"><p class="t-ui-strong">Strengths the client would see</p>${d.draft.strengths.length ? `<ul class="result-list">${d.draft.strengths.map((x) => `<li><p>${esc(x.label)}</p><p class="t-caption">${esc(x.reason)}</p></li>`).join('')}</ul>` : '<p class="t-caption">None.</p>'}</div>
          <div class="stack"><p class="t-ui-strong">Areas of focus the client would see</p>${d.draft.focus.length ? `<ul class="result-list">${d.draft.focus.map((x) => `<li><p>${esc(x.label)}</p><p class="t-caption">${esc(x.reason)} Links to ${esc(x.topic?.label ?? 'no topic')}.</p></li>`).join('')}</ul>` : '<p class="t-caption">None.</p>'}</div>
        </div>
      </article>`;
    })
    .join('');

  const zones = ZONES.map(
    (z) => `<div class="stack zone zone-edit">
      <p class="t-ui-strong">${esc(z.hint)}</p>
      <ul class="zone-cards">${fd
        .filter((f) => f.zone === z.id)
        .map((f) => `<li class="factor"><span>${esc(f.text)}</span><button type="button" class="btn btn-quiet" data-action="remove-factor" data-uid="${esc(uid)}" data-factor="${f.id}" aria-label="Remove ${esc(f.text)}">Remove</button></li>`)
        .join('')}</ul>
      <form class="inline-add" data-form="add-factor" data-uid="${esc(uid)}" data-zone="${z.id}" novalidate>
        <label class="visually-hidden" for="add-${z.id}">Add a ${esc(z.hint.toLowerCase())} factor</label>
        <input class="input" id="add-${z.id}" name="text" placeholder="Add a factor" maxlength="140">
        <button type="submit" class="btn btn-secondary">Add</button>
      </form>
    </div>`,
  ).join('');

  return shell(
    'clients',
    c.name,
    `${takeFlash()}
    <p><a href="#/p/clients">All clients</a></p>
    <div class="split">
      <section class="panel stack" aria-labelledby="h-profile">
        <h2 id="h-profile">Profile</h2>
        <dl class="details">
          <div><dt>Email</dt><dd>${esc(c.email)}</dd></div>
          <div><dt>Activated</dt><dd>${fmtDate(c.activatedAt)}</dd></div>
          <div><dt>Consent recorded</dt><dd>${fmtDate(c.consentAt)} (notice ${esc(c.consentVersion)})</dd></div>
          <div><dt>Retention date</dt><dd>${c.retentionUntil ? fmtDate(c.retentionUntil) : 'Set when the work ends'}</dd></div>
        </dl>
        <form class="inline-add" data-form="set-type" data-uid="${esc(uid)}" novalidate>
          <label class="field-label" for="type">Client type</label>
          <select class="select" id="type" name="type">
            <option value="">Not set</option>
            ${Object.keys(clientTypes.types).map((t) => `<option value="${t}"${c.clientType === t ? ' selected' : ''}>${esc(typeLabel(t))}</option>`).join('')}
          </select>
          <button type="submit" class="btn btn-secondary">Save type</button>
        </form>
        ${intake ? `<p class="t-caption">Set by ${intake.overriddenBy ? 'you' : intake.source === 'code' ? 'the activation code' : 'the intake answers'}.</p>` : ''}
        <form class="inline-add" data-form="set-stage" data-uid="${esc(uid)}" novalidate>
          <label class="field-label" for="stage">Journey stage</label>
          <select class="select" id="stage" name="stage">
            ${clientTypes.stages.map((st) => `<option value="${st}"${c.journeyStage === st ? ' selected' : ''}>${esc(STAGE_LABELS[st])}</option>`).join('')}
          </select>
          <button type="submit" class="btn btn-secondary">Save stage</button>
        </form>
      </section>
      <section class="panel stack" aria-labelledby="h-intake">
        <h2 id="h-intake">Intake answers</h2>
        ${intakeAnswers ? `<dl class="details">${intakeAnswers}</dl>` : '<p>Sample client created before the intake existed.</p>'}
      </section>
    </div>

    <section class="stack" aria-labelledby="h-assign">
      <h2 id="h-assign">Questionnaires</h2>
      <ul class="task-list">${list
        .map((a) => {
          const m = store.measure(a.measureId);
          const chip = a.status === 'complete' ? status('done', `Done ${fmtDate(a.completedAt)}`) : a.status === 'inProgress' ? status('progress', 'In progress') : status('attention', 'Not started');
          return `<li class="task"><div><p class="task-name">${esc(m.name)}</p><p class="task-meta">Assigned ${fmtDate(a.assignedAt)}</p></div>${chip}<span></span></li>`;
        })
        .join('')}</ul>
      ${
        assignable.length
          ? `<form class="inline-add" data-form="assign" data-uid="${esc(uid)}" novalidate>
              <label class="visually-hidden" for="assign">Questionnaire to assign</label>
              <select class="select" id="assign" name="measureId">${assignable.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select>
              <button type="submit" class="btn btn-secondary">Assign</button>
            </form>`
          : '<p class="t-caption">Every questionnaire in the library is assigned or in progress.</p>'
      }
    </section>

    <section class="stack" aria-labelledby="h-draft">
      <h2 id="h-draft">Draft results</h2>
      ${draftBlocks || '<p>Draft results appear here when the client finishes a questionnaire.</p>'}
      ${
        drafts.length
          ? `<div class="actions">
              ${pending > 0 ? `<button type="button" class="btn btn-primary" data-action="release" data-uid="${esc(uid)}">Release results to ${esc(c.name)}</button>` : ''}
              ${released?.releasedAt ? `<p class="t-caption">Last released ${fmtDate(released.releasedAt)}.</p>` : ''}
            </div>`
          : ''
      }
    </section>

    <section class="stack" aria-labelledby="h-form">
      <h2 id="h-form">Formulation</h2>
      <p class="reading t-caption">Predisposing, precipitating, maintaining and protective factors. Maintaining factors show to the client as the focus of your work together.</p>
      <div class="zones">${zones}</div>
      <div class="actions">
        ${fd.length ? `<button type="button" class="btn btn-secondary" data-action="release-formulation" data-uid="${esc(uid)}">${fr ? 'Release updated formulation' : 'Release formulation'}</button>` : ''}
        ${fr ? `<p class="t-caption">Released ${fmtDate(fr.releasedAt)}.</p>` : ''}
      </div>
    </section>

    ${
      requests.length
        ? `<section class="stack" aria-labelledby="h-req"><h2 id="h-req">Privacy requests</h2><ul class="task-list">${requests.map(requestRow).join('')}</ul></section>`
        : ''
    }`,
    true,
  );
}

function requestRow(r) {
  const s = store.state();
  const who = s.clients[r.uid]?.name ?? 'Client';
  return `<li class="task"><div><p class="task-name">${esc(who)}: ${r.kind === 'access' ? 'copy of their information' : 'correction'}</p><p class="task-meta">${r.detail ? `"${esc(r.detail)}". ` : ''}Received ${fmtDate(r.createdAt)}, reply due by ${fmtDate(r.dueBy)}</p></div>${
    r.status === 'done' ? status('done', 'Answered') : status('attention', 'Open')
  }${r.status === 'done' ? '<span></span>' : `<button type="button" class="btn btn-secondary" data-action="close-request" data-id="${r.id}">Mark answered</button>`}</li>`;
}

function viewReview() {
  const s = store.state();
  const drafts = Object.values(s.clients).filter((c) => store.unreleasedCount(c.uid) > 0);
  const open = s.requests.filter((r) => r.status === 'open');
  return shell(
    'review',
    'To review',
    `${takeFlash()}
    <section class="stack" aria-labelledby="h-d">
      <h2 id="h-d">Draft results waiting for release</h2>
      ${
        drafts.length
          ? `<ul class="task-list">${drafts
              .map((c) => `<li class="task"><div><p class="task-name">${esc(c.name)}</p><p class="task-meta">${store.unreleasedCount(c.uid)} questionnaire draft${store.unreleasedCount(c.uid) === 1 ? '' : 's'}</p></div>${status('attention', 'Draft')}<a class="btn btn-secondary" href="#/p/client/${esc(c.uid)}">Review</a></li>`)
              .join('')}</ul>`
          : '<p>Nothing waiting. Drafts appear here when a client finishes a questionnaire.</p>'
      }
    </section>
    <section class="stack" aria-labelledby="h-p">
      <h2 id="h-p">Privacy requests</h2>
      ${open.length ? `<ul class="task-list">${open.map(requestRow).join('')}</ul>` : '<p>No open requests.</p>'}
    </section>`,
  );
}

let lastIssued = null;

function viewCodes() {
  const s = store.state();
  const rows = s.codes
    .map((c) => {
      const used = c.redeemedByUid;
      const expired = !used && c.expiresAt < Date.now();
      return `<tr>
        <td>${esc(c.forName)}</td>
        <td><span class="code">${esc(store.formatCode(c.code))}</span></td>
        <td>${c.clientTypeOverride ? typeCell(c.clientTypeOverride) : 'From intake'}</td>
        <td>${used ? status('done', `Used ${fmtDate(c.redeemedAt)}`) : expired ? status('attention', 'Expired') : status('progress', 'Not used yet')}</td>
        <td>${fmtDate(c.expiresAt)}</td>
      </tr>`;
    })
    .join('');
  return shell(
    'codes',
    'Activation codes',
    `${takeFlash()}
    ${lastIssued ? `<div class="panel stack issued"><p class="t-ui-strong">New code for ${esc(lastIssued.forName)}</p><p class="code code-large">${esc(store.formatCode(lastIssued.code))}</p><p class="t-caption">Send this to the client in your usual email. It works once and expires in 30 days.</p><div class="actions"><button type="button" class="btn btn-secondary" data-action="copy-code" data-code="${esc(store.formatCode(lastIssued.code))}">Copy code</button></div></div>` : ''}
    <section class="panel stack" aria-labelledby="h-issue">
      <h2 id="h-issue">Issue a code</h2>
      <form class="stack" data-form="issue-code" novalidate>
        <div class="split">
          <div class="field">
            <label class="field-label" for="for">Client name</label>
            <span class="field-hint" id="for-hint">For your list only. The client enters their own details.</span>
            <input class="input" id="for" name="forName" aria-describedby="for-hint" maxlength="80">
          </div>
          <div class="field">
            <label class="field-label" for="override">Client type</label>
            <span class="field-hint" id="ov-hint">Leave as intake to let the client's answers decide.</span>
            <select class="select" id="override" name="clientTypeOverride" aria-describedby="ov-hint">
              <option value="">Decide from intake answers</option>
              ${Object.keys(clientTypes.types).map((t) => `<option value="${t}">${esc(typeLabel(t))}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="actions"><button type="submit" class="btn btn-primary">Issue code</button></div>
      </form>
    </section>
    <div class="table-wrap"><table class="table">
      <thead><tr><th scope="col">For</th><th scope="col">Code</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Expires</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`,
    true,
  );
}

function viewLibrary() {
  const rows = store
    .allMeasures()
    .map((m) => {
      const subs = m.scoringRules.subscales.map((x) => x.label).join(', ');
      return `<tr><td>${esc(m.name)}</td><td>${m.items.length}</td><td>${esc(subs)}</td><td>${status('attention', 'Sample only')}</td></tr>`;
    })
    .join('');
  return shell(
    'library',
    'Questionnaire library',
    `<p class="reading">Questionnaires available to assign. In the live app only questionnaires Charlotte adds, with their licence confirmed, appear here. Commercial instruments are never reproduced in the hub.</p>
    <div class="table-wrap"><table class="table">
      <thead><tr><th scope="col">Questionnaire</th><th scope="col">Questions</th><th scope="col">Subscales</th><th scope="col">Licence</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`,
    true,
  );
}

export function renderPractitioner(parts) {
  switch (parts[0]) {
    case 'client':
      return viewClient(parts[1]);
    case 'review':
      return viewReview();
    case 'codes':
      return viewCodes();
    case 'library':
      return viewLibrary();
    default:
      return viewClients();
  }
}

// ---------- events ----------

document.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  const data = Object.fromEntries(new FormData(form));
  const uid = form.dataset.uid;
  switch (form.dataset.form) {
    case 'issue-code': {
      const code = store.issueCode(data);
      lastIssued = store.state().codes.find((c) => c.code === code);
      return render();
    }
    case 'set-type':
      store.setClientType(uid, data.type);
      flash = 'Client type saved. The client now sees the matching copy and accent.';
      return render();
    case 'set-stage':
      store.setStage(uid, data.stage);
      flash = 'Journey stage saved.';
      return render();
    case 'assign':
      store.assignMeasure(uid, data.measureId);
      flash = 'Questionnaire assigned. It now shows on the client\'s Home.';
      return render();
    case 'add-factor':
      if (!String(data.text ?? '').trim()) return undefined;
      store.addFactor(uid, form.dataset.zone, data.text);
      return render();
    default:
      return undefined;
  }
});

document.addEventListener('click', (event) => {
  const t = event.target.closest('[data-action]');
  if (!t) return;
  const uid = t.dataset.uid;
  switch (t.dataset.action) {
    case 'release': {
      const name = store.state().clients[uid].name;
      openDialog(`<div class="stack-lg"><h2>Release results to ${esc(name)}?</h2><p>${esc(name)} will see the strengths and areas of focus listed in the draft, with links to the Learning Hub. Scores are not shown to clients. You can release again after later questionnaires.</p><div class="actions"><button type="button" class="btn btn-primary" data-action="release-confirm" data-uid="${esc(uid)}">Release results</button><button type="button" class="btn btn-secondary" data-action="close">Cancel</button></div></div>`);
      return undefined;
    }
    case 'release-confirm':
      closeDialog();
      store.releaseResults(uid);
      flash = 'Results released. Switch to the client view to see them.';
      return render();
    case 'release-formulation':
      store.releaseFormulation(uid);
      flash = 'Formulation released. It now appears in the client\'s menu.';
      return render();
    case 'remove-factor':
      store.removeFactor(uid, t.dataset.factor);
      return render();
    case 'close-request':
      store.closeRequest(t.dataset.id);
      return render();
    case 'copy-code':
      navigator.clipboard?.writeText(t.dataset.code).catch(() => {});
      t.textContent = 'Copied';
      return undefined;
    default:
      return undefined;
  }
});

export { go, setFlash };
