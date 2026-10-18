// Shared building blocks for the live Client Hub and the clickable sample:
// escaping, dates, icons, status chips and the viewer shells. Links come
// from a routes map so the sample (hash links) and the live app (paths)
// share the same markup.

export const HASH_ROUTES = {
  home: '#/home', questionnaires: '#/questionnaires', results: '#/results', formulation: '#/formulation', account: '#/account',
  dashboard: '#/p/clients', clients: '#/p/clients', review: '#/p/review', codes: '#/p/codes', library: '#/p/library',
};

export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const dateFmt = new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDate = (t) => (t ? dateFmt.format(new Date(t)) : '');
// A calendar day stored as YYYY-MM-DD (check in dates), shown without any
// time zone shift.
export const fmtDay = (d) => (d ? dateFmt.format(new Date(`${d}T12:00:00`)) : '');
const dateTimeFmt = new Intl.DateTimeFormat('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Auckland' });
export const fmtDateTime = (t) => (t ? dateTimeFmt.format(new Date(t)) : '');
// Value for a datetime-local input, in the browser's own time zone.
export const toLocalInput = (t) => {
  if (!t) return '';
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const CADENCE_LABELS = { weekly: 'Every week', fortnightly: 'Every 2 weeks', fourWeekly: 'Every 4 weeks', dates: 'On chosen dates' };

export function relative(t) {
  if (!t) return '';
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (t >= start.getTime()) return 'Today';
  if (t >= start.getTime() - 86400000) return 'Yesterday';
  return new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short' }).format(new Date(t));
}

export const STAGE_LABELS = {
  enquiry: 'Getting started',
  firstSession: 'First session',
  assessment: 'Questionnaires',
  booking: 'Book feedback',
  feedback: 'Feedback',
  intervention: 'Working together',
  review: 'Review',
};

const ICONS = {
  home: '<path d="M3 9.2 10 3.5l7 5.7V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1z"/>',
  list: '<rect x="4" y="3" width="12" height="14.5" rx="2"/><path d="M7.5 7.5h5M7.5 10.5h5M7.5 13.5h3"/>',
  results: '<circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 2.5"/>',
  formulation: '<rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="11" y="3" width="6" height="6" rx="1.5"/><rect x="3" y="11" width="6" height="6" rx="1.5"/><rect x="11" y="11" width="6" height="6" rx="1.5"/>',
  dashboard: '<path d="M3.5 16.5V9M8 16.5V5M12.5 16.5v-6M17 16.5V7.5"/><path d="M2.5 17h15"/>',
  account: '<circle cx="10" cy="7" r="3.25"/><path d="M4 17c.7-3 3-4.75 6-4.75S15.3 14 16 17"/>',
  clients: '<circle cx="7.5" cy="7" r="2.75"/><path d="M2.5 16.5c.6-2.6 2.6-4 5-4s4.4 1.4 5 4"/><circle cx="14" cy="7.5" r="2.25"/><path d="M14 12.5c1.9 0 3.2 1.2 3.6 3.5"/>',
  review: '<rect x="4" y="3" width="12" height="14.5" rx="2"/><path d="M7.5 10.5l1.8 1.8 3.2-3.6"/>',
  codes: '<circle cx="7" cy="10" r="3.25"/><path d="M10.25 10H17.5M14.5 10v3M16.5 10v2"/>',
  library: '<path d="M4 4.5h3.5v12H4zM8.5 4.5H12v12H8.5zM13 5.2l3.2-.8 2.6 11.6-3.2.8z"/>',
};

export const icon = (name) =>
  `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

const STATUS_ICON = {
  done: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M4.8 8.2l2.1 2.1 4.3-4.6" stroke="#E3ECE2" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  progress: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor"/></svg>',
  attention: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M8 4.2v4.6" stroke="#F2E8D6" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="11.4" r="1" fill="#F2E8D6"/></svg>',
};

export const status = (kind, label) => `<span class="status status-${kind}">${STATUS_ICON[kind]}${esc(label)}</span>`;

const MENU = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

function shell({ nav, title, content, foot, account, mode, wide }) {
  return `
  <div class="viewer" data-menu="closed"${mode ? ` data-mode="${mode}"` : ''}>
    <nav class="sidebar" id="sidebar" aria-label="Main">
      <a class="brand" href="${nav.home}">
        <img class="brand-mark" src="${nav.markSrc}" alt="" width="32" height="32">
        <span class="brand-name">Executive Frame</span>
      </a>
      <ul class="nav">
        ${nav.items
          .map(
            (i) => `<li><a class="nav-link${i.muted ? ' nav-link-muted' : ''}" href="${i.href}"${i.active ? ' aria-current="page"' : ''}>${icon(i.icon)}${esc(i.label)}${
              i.count ? `<span class="nav-count" aria-label="${i.count} ${esc(i.countLabel)}">${i.count}</span>` : ''
            }</a></li>`,
          )
          .join('')}
      </ul>
      <div class="sidebar-foot"><p class="t-caption">${foot}</p></div>
    </nav>
    <header class="topbar">
      <button type="button" class="menu-button" data-action="menu" aria-controls="sidebar" aria-expanded="false" aria-label="Open menu">${MENU}</button>
      <h1 class="topbar-title${nav.items.some((i) => i.active && i.label === title) ? ' visually-hidden' : ''}">${esc(title)}</h1>
      <div class="topbar-actions">${account}</div>
    </header>
    <main class="workspace" id="workspace" tabindex="-1">
      <div class="workspace-inner${wide ? ' workspace-wide' : ''} stack-lg">${content}</div>
    </main>
  </div>`;
}

export function clientShell({ title, active, content, client, counts, hasFormulation, mode, markSrc, routes = HASH_ROUTES }) {
  const initial = esc((client?.name ?? 'A').trim().charAt(0).toUpperCase());
  const items = [
    { href: routes.home, label: 'Home', icon: 'home', active: active === 'home' },
    { href: routes.questionnaires, label: 'Questionnaires', icon: 'list', active: active === 'questionnaires', count: counts.outstanding, countLabel: 'to complete' },
    { href: routes.results, label: 'Results', icon: 'results', active: active === 'results' },
  ];
  items.push({ href: routes.formulation, label: 'Formulation', icon: 'formulation', active: active === 'formulation', muted: !hasFormulation });
  items.push({ href: routes.account, label: 'Account and privacy', icon: 'account', active: active === 'account' });
  return shell({
    nav: { home: routes.home, items, markSrc },
    title,
    content,
    mode,
    foot: mode === 'focus' ? 'Your answers save as you go.' : 'Your information is stored securely in Sydney, Australia.',
    account: mode === 'focus'
      ? `<a class="btn btn-quiet" href="${routes.questionnaires}">Save and exit</a>`
      : `<a class="account-button" href="${routes.account}"${active === 'account' ? ' aria-current="page"' : ''}><span class="avatar" aria-hidden="true">${initial}</span><span class="account-name">${esc(client?.name ?? 'Account')}</span></a>`,
  });
}

export function practitionerShell({ title, active, content, counts, wide, markSrc, routes = HASH_ROUTES, role = 'practitioner', person = { name: 'Sarah' }, accountHref = null }) {
  const all = [
    ...(routes.dashboard && routes.dashboard !== routes.clients ? [{ key: 'dashboard', href: routes.dashboard, label: 'Dashboard', icon: 'dashboard', active: active === 'dashboard', practitionerOnly: true }] : []),
    { key: 'clients', href: routes.clients, label: 'Clients', icon: 'clients', active: active === 'clients', practitionerOnly: true },
    { key: 'review', href: routes.review, label: 'To review', icon: 'review', active: active === 'review', count: counts.review, countLabel: 'to review', practitionerOnly: true },
    { key: 'library', href: routes.library, label: 'Questionnaire library', icon: 'library', active: active === 'library' },
    ...(accountHref ? [{ key: 'account', href: accountHref, label: 'Account', icon: 'account', active: active === 'account' }] : []),
    { key: 'codes', href: routes.codes, label: 'Activation codes', icon: 'codes', active: active === 'codes' },
  ];
  const items = all.filter((i) => role === 'practitioner' || !i.practitionerOnly);
  const initial = esc(String(person.name ?? 'S').trim().charAt(0).toUpperCase() || 'S');
  const badge = `<span class="avatar" aria-hidden="true">${initial}</span><span class="account-name">${esc(person.name)}</span>`;
  return shell({
    nav: { home: items[0].href, items, markSrc },
    title,
    content,
    wide,
    foot: role === 'practitioner' ? 'Practitioner view. Drafts are never shown to clients until you release them.' : 'Admin view. Client records are not shown to admin accounts.',
    account: accountHref ? `<a class="account-button" href="${accountHref}">${badge}</a>` : `<span class="account-button">${badge}</span>`,
  });
}

export function single(content, markSrc) {
  return `<main class="single" id="workspace" tabindex="-1">
    <div class="single-card stack-lg">
      <span class="brand"><img class="brand-mark" src="${markSrc}" alt="" width="32" height="32"><span class="brand-name">Executive Frame</span></span>
      ${content}
    </div>
  </main>`;
}

export function fieldError(errors, key) {
  return errors?.[key] ? `<p class="field-error" id="err-${key}">${esc(errors[key])}</p>` : '';
}
