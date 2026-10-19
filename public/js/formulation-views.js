// The 7 ways a formulation can be drawn. Each takes the released or draft
// factors and the client's responses and returns markup: the grid is HTML,
// the other 6 are inline SVG that scales with its container. Colours come
// from classes in components.css so both themes work and the CSP stays
// strict (no style attributes).

import { FIT_LABELS, ZONES, zoneOf } from './live/views-client.js';

export const VIEW_OPTIONS = [
  { id: 'grid', label: 'Map (5 boxes)', blurb: 'The 5 areas as boxes with arrows between them.' },
  { id: 'flower', label: 'Flower', blurb: 'The problem at the centre, each maintaining pattern as a petal that loops back into it, what helps as leaves on the stem.' },
  { id: 'river', label: 'River', blurb: 'A timeline from background to trigger to now, with the maintaining patterns as an eddy and what helps as the banks.' },
  { id: 'layers', label: 'Layers', blurb: 'What is happening now on top, triggers and maintenance in the middle, long standing patterns underneath, strengths alongside.' },
  { id: 'balance', label: 'Balance', blurb: 'Maintaining patterns on one side, what helps on the other. The beam tilts by the client’s responses.' },
  { id: 'radial', label: 'Radial', blurb: 'The client at the centre, the 5 areas as sectors, with lines to the questionnaire a factor came from.' },
  { id: 'loop', label: 'Loop with exits', blurb: 'The maintaining patterns as one circuit, with each protective factor an exit off it.' },
];
export const viewOf = (v) => (VIEW_OPTIONS.some((o) => o.id === v) ? v : 'grid');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const title = (z) => ZONES.find((x) => x.id === z)?.title ?? z;
const byZone = (factors) => Object.fromEntries(ZONES.map((z) => [z.id, factors.filter((f) => zoneOf(f) === z.id)]));
const fitOf = (responses, f) => responses?.[f.id]?.fit ?? null;

function wrapText(text, width, maxLines = 3) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > width) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, '') + ' …';
    return kept;
  }
  return lines;
}
// Text block centred on x (anchor middle) or starting at x. y is the first baseline.
function text(x, y, str, { width = 24, size = 13, cls = 'fv-ink', anchor = 'middle', weight = 400, max = 3 } = {}) {
  return wrapText(str, width, max)
    .map((l, i) => `<text x="${x}" y="${y + i * (size + 4)}" font-size="${size}" class="${cls}" text-anchor="${anchor}" font-weight="${weight}">${esc(l)}</text>`)
    .join('');
}
const dot = (x, y, fit, r = 6) => `<circle cx="${x}" cy="${y}" r="${r}" class="fv-dot fv-dot-${fit ?? 'none'}"><title>${esc(fit ? FIT_LABELS[fit] : 'Not answered yet')}</title></circle>`;
const card = (x, y, w, h, cls = 'fv-card') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" class="${cls}"/>`;
const heading = (x, y, str, anchor = 'start') => `<text x="${x}" y="${y}" font-size="13" class="fv-ink" text-anchor="${anchor}" font-weight="500">${esc(str)}</text>`;
const DEFS = '<defs><marker id="fv-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="fv-arrowhead"/></marker></defs>';
const deg = (d) => (d * Math.PI) / 180;
const wrapSvg = (view, h, body, factors) =>
  `<figure class="fv fv-${view}"><svg viewBox="0 0 960 ${h}" role="img" aria-label="${esc(`Formulation drawn as ${VIEW_OPTIONS.find((o) => o.id === view)?.label.toLowerCase()} with ${factors.length} factor${factors.length === 1 ? '' : 's'}`)}">${DEFS}<rect width="960" height="${h}" rx="18" class="fv-bg"/>${body}</svg></figure>`;
const group = (f, inner) => `<g><title>${esc(f.text)}</title>${inner}</g>`;
const presentingText = (z) => z.presenting.map((f) => f.text).join('. ') || 'What we are working on';
const footer = (z, y) => {
  const parts = [z.predisposing.length ? `Background: ${z.predisposing.map((f) => f.text).join('; ')}` : '', z.precipitating.length ? `Trigger: ${z.precipitating.map((f) => f.text).join('; ')}` : ''].filter(Boolean);
  return parts.length ? `<rect x="20" y="${y - 24}" width="920" height="36" rx="8" class="fv-card fv-faint"/>` + text(480, y, parts.join('. '), { width: 120, size: 12.5, max: 1 }) : '';
};

// ---------- grid: the 5 box map (HTML) ----------
function grid(factors, responses) {
  const z = byZone(factors);
  const box = (id, hint) =>
    `<div class="map-box" data-zone="${id}"><p class="map-title">${esc(title(id))}</p><p class="map-hint">${esc(hint)}</p>${
      z[id].length ? `<ul class="map-list">${z[id].map((f) => `<li>${fitOf(responses, f) ? `<i class="map-dot map-dot-${fitOf(responses, f)}" title="${esc(FIT_LABELS[fitOf(responses, f)])}"></i>` : ''}${esc(f.text)}</li>`).join('')}</ul>` : '<p class="map-empty">Nothing yet</p>'
    }</div>`;
  return `<div class="map" role="img" aria-label="Formulation map with ${factors.length} factor${factors.length === 1 ? '' : 's'}">
    ${box('predisposing', 'Predisposing')}<span class="map-arrow" aria-hidden="true">&#8594;</span>
    ${box('precipitating', 'Precipitating')}<span class="map-arrow" aria-hidden="true">&#8594;</span>
    ${box('presenting', 'Presenting')}<span class="map-loop" aria-hidden="true">&#8635;</span>
    ${box('perpetuating', 'Perpetuating')}${box('protective', 'Protective')}
  </div>`;
}

// ---------- flower ----------
function flower(factors, responses) {
  const z = byZone(factors);
  const petals = z.perpetuating;
  const leaves = z.protective;
  const cx = 480, cy = 330;
  const h = 600 + Math.max(0, leaves.length - 2) * 45;
  let b = heading(cx, 40, title('perpetuating'), 'middle');
  const n = petals.length;
  const step = n > 1 ? Math.min(78, 230 / (n - 1)) : 0;
  petals.forEach((f, i) => {
    const ang = -90 + (i - (n - 1) / 2) * step;
    const a1 = deg(ang - 30), a2 = deg(ang + 30), am = deg(ang);
    const px = cx + Math.cos(am) * 225, py = cy + Math.sin(am) * 200;
    b += group(f, `<path d="M${cx + Math.cos(a1) * 80},${cy + Math.sin(a1) * 80} C${cx + Math.cos(a1) * 380},${cy + Math.sin(a1) * 340} ${cx + Math.cos(a2) * 380},${cy + Math.sin(a2) * 340} ${cx + Math.cos(a2) * 80},${cy + Math.sin(a2) * 80}" class="fv-petal" marker-end="url(#fv-arrow)"/>${text(px, py - 10, f.text, { width: 15, size: 12.5 })}${dot(px, py + 40, fitOf(responses, f))}`);
  });
  if (!n) b += text(cx, 150, 'Nothing here yet', { cls: 'fv-muted' });
  b += `<circle cx="${cx}" cy="${cy}" r="82" class="fv-navy"/>` + text(cx, cy - 12, presentingText(z), { width: 18, size: 13.5, cls: 'fv-inv', weight: 500, max: 4 });
  b += `<path d="M${cx},${cy + 82} L${cx},${h - 40}" class="fv-stem"/>` + heading(cx + 10, 440, title('protective'));
  leaves.forEach((f, i) => {
    const side = i % 2 ? 1 : -1, y = 470 + i * 45;
    b += group(f, `<path d="M${cx},${y} Q${cx + side * 60},${y - 40} ${cx + side * 120},${y - 10} Q${cx + side * 60},${y + 25} ${cx},${y}" class="fv-leaf"/>${text(cx + side * 150, y - 4, f.text, { width: 22, size: 12.5, anchor: side > 0 ? 'start' : 'end', max: 2 })}${dot(cx + side * 135, y - 8, fitOf(responses, f))}`);
  });
  b += footer(z, h - 16);
  return wrapSvg('flower', h, b, factors);
}

// ---------- river ----------
function river(factors, responses) {
  const z = byZone(factors);
  const keep = z.perpetuating, banks = z.protective;
  const h = 480 + Math.max(keep.length, banks.length) * 32 + 20;
  let b = '';
  const top = 'M0,300 C200,280 300,250 460,250 C600,250 700,290 960,280', bot = 'M0,440 C200,420 300,390 460,390 C600,390 700,430 960,420';
  b += `<path d="${top} L960,420 C700,430 600,390 460,390 C300,390 200,420 0,440 Z" class="fv-card"/><path d="${top}" class="fv-bank"/><path d="${bot}" class="fv-bank"/>`;
  b += `<path d="M30,375 C300,360 560,335 900,345" class="fv-flow" marker-end="url(#fv-arrow)"/>`;
  const st = [[150, 'Where it started', z.predisposing], [430, 'What set it off', z.precipitating], [660, 'Now', z.presenting]];
  st.forEach(([x, hd, list], i) => {
    const sy = [368, 352, 340][i];
    const txt = list.map((f) => f.text).join('. ') || 'Nothing yet';
    b += `<circle cx="${x}" cy="${sy}" r="9" class="${i === 2 ? 'fv-navy' : 'fv-ink'}"/>` + heading(x, 70, hd, 'middle') + card(x - 100, 85, 200, 76, i === 2 ? 'fv-navy' : 'fv-card') + text(x, 110, txt, { width: 26, size: 12.5, cls: i === 2 ? 'fv-inv' : 'fv-ink', max: 3 });
    b += `<path d="M${x},161 L${x},${sy - 12}" class="fv-dotted"/>`;
  });
  b += `<path d="M790,352 a40,34 0 1,1 -1,-2" class="fv-eddy" marker-end="url(#fv-arrow)"/><path d="M790,392 L790,470" class="fv-dotted"/>`;
  b += heading(790, 480, title('perpetuating'), 'middle');
  keep.forEach((f, i) => {
    const y = 492 + i * 32;
    b += group(f, card(600, y, 340, 28, 'fv-card fv-keep-edge') + dot(614, y + 14, fitOf(responses, f)) + text(770, y + 18, f.text, { width: 48, size: 11.5, max: 1 }));
  });
  b += heading(60, 232, 'The banks: what holds you') + heading(170, 480, title('protective'), 'middle');
  banks.forEach((f, i) => {
    const y = 492 + i * 32;
    b += group(f, card(20, y, 300, 28, 'fv-card fv-help-edge') + dot(34, y + 14, fitOf(responses, f)) + text(176, y + 18, f.text, { width: 42, size: 11.5, max: 1 }));
  });
  b += heading(930, 300, 'Future', 'end');
  return wrapSvg('river', h, b, factors);
}

// ---------- layers (HTML) ----------
function layers(factors, responses) {
  const z = byZone(factors);
  const item = (f) => `<li>${fitOf(responses, f) ? `<i class="map-dot map-dot-${fitOf(responses, f)}" title="${esc(FIT_LABELS[fitOf(responses, f)])}"></i>` : '<i class="map-dot" title="Not answered yet"></i>'}${esc(f.text)}</li>`;
  const block = (cls, hd, list) => `<div class="fv-layer ${cls}"><p class="map-title">${esc(hd)}</p>${list.length ? `<ul class="map-list">${list.map(item).join('')}</ul>` : '<p class="map-empty">Nothing yet</p>'}</div>`;
  return `<div class="fv fv-layers" role="img" aria-label="Formulation drawn as layers with ${factors.length} factor${factors.length === 1 ? '' : 's'}">
    <div class="fv-layer-stack">
      ${block('fv-layer-now', 'What is happening now', z.presenting)}
      ${block('fv-layer-mid', 'Triggers and what keeps it going', [...z.precipitating, ...z.perpetuating])}
      ${block('fv-layer-deep', 'Long standing patterns', z.predisposing)}
    </div>
    ${block('fv-layer-side', 'Strengths', z.protective)}
  </div>`;
}

// ---------- balance ----------
function balance(factors, responses) {
  const z = byZone(factors);
  const weight = (list) => list.reduce((a, f) => a + ({ fits: 1, partly: 0.5 }[fitOf(responses, f)] ?? 0), 0);
  const tilt = Math.max(-8, Math.min(8, (weight(z.perpetuating) - weight(z.protective)) * 5));
  const rows = Math.max(z.perpetuating.length, z.protective.length, 1);
  const h = 460 + rows * 34;
  let b = card(260, 50, 440, 90, 'fv-navy') + `<text x="480" y="80" font-size="13" class="fv-inv fv-faint" text-anchor="middle" font-weight="500">The problem</text>` + text(480, 108, presentingText(z), { width: 44, size: 13.5, cls: 'fv-inv', max: 2 });
  b += `<path d="M480,${h - 80} L440,${h - 40} L520,${h - 40} Z" class="fv-ink"/><rect x="476" y="280" width="8" height="${h - 360}" class="fv-ink"/>`;
  b += `<rect x="140" y="276" width="680" height="8" rx="4" class="fv-ink" transform="rotate(${tilt} 480 280)"/>`;
  [[-1, z.perpetuating, title('perpetuating'), 'fv-keep-edge'], [1, z.protective, title('protective'), 'fv-help-edge']].forEach(([side, items, hd, edge]) => {
    const ex = 480 + side * 330, ey = 280 + Math.sin(deg(tilt)) * side * 330, py = ey + 90, x = ex;
    b += `<path d="M${ex},${ey} L${x - 110},${py} M${ex},${ey} L${x + 110},${py}" class="fv-line"/>`;
    b += card(x - 130, py, 260, 44 + Math.max(items.length, 1) * 34, `fv-card ${edge}`) + heading(x, py + 26, hd, 'middle');
    if (!items.length) b += text(x, py + 54, 'Nothing yet', { cls: 'fv-muted', size: 12 });
    items.forEach((f, i) => { b += group(f, dot(x - 112, py + 50 + i * 34, fitOf(responses, f)) + text(x - 96, py + 54 + i * 34, f.text, { width: 34, size: 12, anchor: 'start', max: 2 })); });
  });
  b += `<circle cx="480" cy="280" r="10" class="fv-navy"/>`;
  b += footer(z, 190);
  b += text(480, h - 14, 'The beam tilts by what has been marked as fitting', { cls: 'fv-muted', size: 12, width: 80, max: 1 });
  return wrapSvg('balance', h, b, factors);
}

// ---------- radial ----------
function radial(factors, responses) {
  const z = byZone(factors);
  const cx = 560, cy = 305, R1 = 90, R2 = 262;
  const sources = [];
  for (const f of factors) if (f.source?.measureName && !sources.includes(f.source.measureName)) sources.push(f.source.measureName);
  let b = '';
  ZONES.forEach((zone, i) => {
    const a0 = deg(-90 + i * 72), a1 = deg(-90 + (i + 1) * 72), am = (a0 + a1) / 2;
    b += `<path d="M${cx + Math.cos(a0) * R1},${cy + Math.sin(a0) * R1} A${R1},${R1} 0 0,1 ${cx + Math.cos(a1) * R1},${cy + Math.sin(a1) * R1} L${cx + Math.cos(a1) * R2},${cy + Math.sin(a1) * R2} A${R2},${R2} 0 0,0 ${cx + Math.cos(a0) * R2},${cy + Math.sin(a0) * R2} Z" class="fv-sector${zone.id === 'protective' ? ' fv-sector-help' : ''}"/>`;
    b += `<text x="${cx + Math.cos(am) * 282}" y="${cy + Math.sin(am) * 282 + 4}" font-size="12" class="fv-ink" text-anchor="middle" font-weight="500">${esc(zone.title)}</text>`;
    const items = z[zone.id];
    items.forEach((f, k) => {
      const a = a0 + (a1 - a0) * ((k + 1) / (items.length + 1));
      const r = items.length > 1 ? 118 + (k % 3) * 52 : 170;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      const si = f.source?.measureName ? sources.indexOf(f.source.measureName) : -1;
      b += group(f, `<circle cx="${x}" cy="${y}" r="9" class="fv-node fv-dot-${fitOf(responses, f) ?? 'none'}"/>${text(x, y + 22, f.text, { width: 16, size: 10.5, max: 3 })}${si >= 0 ? `<path d="M${x - 9},${y} L200,${420 + si * 52}" class="fv-dotted"/>` : ''}`);
    });
  });
  b += `<circle cx="${cx}" cy="${cy}" r="42" class="fv-navy"/><text x="${cx}" y="${cy + 5}" font-size="14" class="fv-inv" text-anchor="middle" font-weight="500">You</text>`;
  if (sources.length) {
    b += heading(110, 395, 'From your results', 'middle');
    sources.forEach((s, i) => { b += card(20, 402 + i * 52, 180, 40, 'fv-card fv-outline') + text(110, 427 + i * 52, s, { width: 26, size: 11.5, max: 1 }); });
  }
  const h = Math.max(600, 420 + sources.length * 52 + 20);
  return wrapSvg('radial', h, b, factors);
}

// ---------- loop with exits ----------
function loop(factors, responses) {
  const z = byZone(factors);
  const items = [{ id: 'presenting', text: presentingText(z), presenting: true }, ...z.perpetuating];
  const exits = z.protective;
  const n = items.length;
  const r = Math.max(160, n * 42);
  const cx = r + 150, cy = r + 110;
  const h = Math.max(cy + r + 110, 160 + exits.length * 80);
  let b = `<circle cx="${cx}" cy="${cy}" r="${r}" class="fv-circuit"/>`;
  items.forEach((f, i) => {
    const a = deg(-90 + i * (360 / n)), am = deg(-90 + (i + 0.5) * (360 / n));
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (n > 1) b += `<path d="M${cx + Math.cos(am - 0.06) * r},${cy + Math.sin(am - 0.06) * r} L${cx + Math.cos(am + 0.06) * r},${cy + Math.sin(am + 0.06) * r}" class="fv-circuit" marker-end="url(#fv-arrow)"/>`;
    b += group(f, card(x - 90, y - 30, 180, 60, f.presenting ? 'fv-navy' : 'fv-card fv-keep-edge') + text(x, y - 4, f.text, { width: 22, size: 12, cls: f.presenting ? 'fv-inv' : 'fv-ink', max: 3 }) + (f.presenting ? '' : dot(x - 76, y - 16, fitOf(responses, f))));
  });
  b += heading(cx + r + 110, 70, `Exits: ${title('protective').toLowerCase()}`);
  exits.forEach((f, i) => {
    const a = deg(-40 + i * (80 / Math.max(exits.length - 1, 1)) * (exits.length > 1 ? 1 : 0));
    const x1 = cx + Math.cos(a) * r, y1 = cy + Math.sin(a) * r;
    const x2 = cx + r + 110, y2 = 100 + i * 80;
    b += group(f, `<path d="M${x1},${y1} L${x2 - 6},${y2 + 24}" class="fv-exit" marker-end="url(#fv-arrow)"/>` + card(x2, y2, 200, 52, 'fv-card fv-help-edge') + dot(x2 + 16, y2 + 16, fitOf(responses, f)) + text(x2 + 110, y2 + 20, f.text, { width: 24, size: 11.5, max: 2 }));
  });
  if (!exits.length) b += text(cx + r + 210, 110, 'Nothing here yet', { cls: 'fv-muted', size: 12 });
  b += footer(z, h - 16);
  return wrapSvg('loop', h, b, factors);
}

const RENDER = { grid, flower, river, layers, balance, radial, loop };

export function renderFormulationView(view, factors, responses = {}) {
  return RENDER[viewOf(view)](factors ?? [], responses ?? {});
}
