// The 7 ways a formulation can be drawn. Each takes the released or draft
// factors and the client's responses and returns markup: the map and the
// layers are HTML, the other 5 are inline SVG that scales with its container.
//
// Shared rules so the drawings feel like one set: a 40px frame, factors as
// cream cards with the response dot at the left and the same inner padding,
// card heights measured from the wrapped text so nothing overlaps, and
// positions computed from the number of factors rather than fixed slots.
// Colours and motion come from classes in components.css (no style
// attributes, so the strict CSP holds and both themes work).

import { FIT_LABELS, ZONES, zoneOf } from './live/views-client.js';

export const VIEW_OPTIONS = [
  { id: 'grid', label: 'Map (5 boxes)', blurb: 'The 5 areas as boxes with arrows between them.' },
  { id: 'flower', label: 'Flower', blurb: 'The problem at the centre, each maintaining pattern as a petal that loops back into it, what helps as leaves on the stem.' },
  { id: 'river', label: 'River', blurb: 'A timeline from background to trigger to now, with the maintaining patterns as an eddy and what helps as the banks.' },
  { id: 'layers', label: 'Layers', blurb: 'What is happening now on top, triggers and maintenance in the middle, long standing patterns underneath, strengths alongside.' },
  { id: 'balance', label: 'Balance', blurb: 'Maintaining patterns on one side, what helps on the other. The beam tilts by the client’s responses.' },
  { id: 'radial', label: 'Radial', blurb: 'The client at the centre, the 5 areas as sectors, each factor linked to its place on the ring and to the questionnaire it came from.' },
  { id: 'loop', label: 'Loop with exits', blurb: 'The maintaining patterns as one circuit, with each protective factor an exit off it.' },
];
export const viewOf = (v) => (VIEW_OPTIONS.some((o) => o.id === v) ? v : 'grid');

// ---------- shared ----------
const W = 960;
const PAD = 40;
const GAP = 16;
const CARD_PAD = 14;
const DOT = 7;
const TEXT = 13;
const LINE = TEXT + 5;
const CHAR = 0.52; // average glyph width as a share of the font size

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const titleOf = (z) => ZONES.find((x) => x.id === z)?.title ?? z;
const byZone = (factors) => Object.fromEntries(ZONES.map((z) => [z.id, factors.filter((f) => zoneOf(f) === z.id)]));
const fitOf = (responses, f) => responses?.[f.id]?.fit ?? null;
const deg = (d) => (d * Math.PI) / 180;
const r1 = (n) => Math.round(n * 10) / 10;

function wrap(str, widthPx, size = TEXT, maxLines = 3) {
  const perLine = Math.max(6, Math.floor(widthPx / (size * CHAR)));
  const words = String(str).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > perLine) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].slice(0, Math.max(0, perLine - 2)).replace(/\s*\S*$/, '') + ' …';
    return kept;
  }
  return lines.length ? lines : [''];
}

// A block of text. Returns the markup and its height. x is the left edge
// (anchor start), the centre (middle) or the right edge (end).
function textBlock(x, y, str, { width, size = TEXT, cls = 'fv-ink', anchor = 'start', weight = 400, max = 3 } = {}) {
  const lines = wrap(str, width, size, max);
  const lh = size + 5;
  const svg = lines.map((l, i) => `<text x="${r1(x)}" y="${r1(y + size + i * lh)}" font-size="${size}" class="${cls}" text-anchor="${anchor}" font-weight="${weight}">${esc(l)}</text>`).join('');
  return { svg, h: lines.length * lh };
}

const dot = (x, y, fit) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${DOT}" class="fv-dot fv-dot-${fit ?? 'none'}"><title>${esc(fit ? FIT_LABELS[fit] : 'Not answered yet')}</title></circle>`;
const rect = (x, y, w, h, cls = 'fv-card') => `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="12" class="${cls}"/>`;
const heading = (x, y, str, anchor = 'start', cls = 'fv-ink') => `<text x="${r1(x)}" y="${r1(y)}" font-size="13" class="${cls}" text-anchor="${anchor}" font-weight="500">${esc(str)}</text>`;
const DEFS = '<defs><marker id="fv-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="fv-arrowhead"/></marker></defs>';
let seq = 0;
const enter = (inner, i = seq++) => `<g class="fv-in fv-dl-${Math.min(i, 11)}">${inner}</g>`;

// Measures a factor card without drawing it.
const cardHeight = (f, w, { max = 3, withDot = true, size = TEXT } = {}) => CARD_PAD * 2 + wrap(f.text, w - CARD_PAD * 2 - (withDot ? DOT * 2 + 10 : 0), size, max).length * (size + 5);

// A factor as a card: dot at the left, text beside it, height from the text.
function card(x, y, w, f, fit, { cls = 'fv-card', textCls = 'fv-ink', max = 3, withDot = true, size = TEXT } = {}) {
  const inset = withDot ? DOT * 2 + 10 : 0;
  const tb = textBlock(x + CARD_PAD + inset, y + CARD_PAD, f.text, { width: w - CARD_PAD * 2 - inset, size, cls: textCls, max });
  const h = CARD_PAD * 2 + tb.h;
  const svg = `<g><title>${esc(f.text)}</title>${rect(x, y, w, h, cls)}${withDot ? dot(x + CARD_PAD + DOT, y + CARD_PAD + size / 2 + 1, fit) : ''}${tb.svg}</g>`;
  return { svg, h };
}

// A column of factor cards with an optional heading; returns the markup and
// the total height. Empty lists show a quiet placeholder.
function column(x, y, w, list, responses, { title, edge = '', max = 3, empty = 'Nothing here yet' } = {}) {
  let svg = '';
  let cy = y;
  if (title) {
    svg += heading(x, cy + 13, title);
    cy += 13 + GAP / 2 + 4;
  }
  if (!list.length) {
    const tb = textBlock(x, cy, empty, { width: w, cls: 'fv-muted', size: 12 });
    return { svg: svg + tb.svg, h: cy + tb.h - y };
  }
  list.forEach((f) => {
    const c = card(x, cy, w, f, fitOf(responses, f), { cls: `fv-card ${edge}`.trim(), max });
    svg += enter(c.svg);
    cy += c.h + GAP / 2;
  });
  return { svg, h: cy - GAP / 2 - y };
}

// Background and trigger as 2 equal cards across the bottom.
function footer(z, y, responses) {
  const w = (W - PAD * 2 - GAP) / 2;
  const left = column(PAD, y, w, z.predisposing, responses, { title: titleOf('predisposing'), max: 2 });
  const right = column(PAD + w + GAP, y, w, z.precipitating, responses, { title: titleOf('precipitating'), max: 2 });
  return { svg: left.svg + right.svg, h: Math.max(left.h, right.h) };
}

const frame = (view, h, body, factors) =>
  `<figure class="fv fv-${view}"><svg viewBox="0 0 ${W} ${r1(h)}" role="img" aria-label="${esc(`Formulation drawn as ${VIEW_OPTIONS.find((o) => o.id === view)?.label.toLowerCase()} with ${factors.length} factor${factors.length === 1 ? '' : 's'}`)}">${DEFS}<rect width="${W}" height="${r1(h)}" rx="18" class="fv-bg"/>${body}</svg></figure>`;

const problem = (z) => ({ id: 'presenting', text: z.presenting.map((f) => f.text).join('. ') || titleOf('presenting') });

// ---------- map: the 5 boxes (HTML) ----------
function grid(factors, responses) {
  const z = byZone(factors);
  const box = (id, hint, i) =>
    `<div class="map-box fv-in fv-dl-${i}" data-zone="${id}"><p class="map-title">${esc(titleOf(id))}</p><p class="map-hint">${esc(hint)}</p>${
      z[id].length ? `<ul class="map-list">${z[id].map((f) => `<li><i class="map-dot map-dot-${fitOf(responses, f) ?? 'none'}" title="${esc(fitOf(responses, f) ? FIT_LABELS[fitOf(responses, f)] : 'Not answered yet')}"></i>${esc(f.text)}</li>`).join('')}</ul>` : '<p class="map-empty">Nothing here yet</p>'
    }</div>`;
  return `<div class="fv map" role="img" aria-label="Formulation map with ${factors.length} factor${factors.length === 1 ? '' : 's'}">
    ${box('predisposing', 'Predisposing', 0)}<span class="map-arrow" aria-hidden="true">&#8594;</span>
    ${box('precipitating', 'Precipitating', 1)}<span class="map-arrow" aria-hidden="true">&#8594;</span>
    ${box('presenting', 'Presenting', 2)}<span class="map-loop" aria-hidden="true">&#8635;</span>
    ${box('perpetuating', 'Perpetuating', 3)}${box('protective', 'Protective', 4)}
  </div>`;
}

// ---------- layers (HTML) ----------
function layers(factors, responses) {
  const z = byZone(factors);
  const item = (f) => `<li><i class="map-dot map-dot-${fitOf(responses, f) ?? 'none'}" title="${esc(fitOf(responses, f) ? FIT_LABELS[fitOf(responses, f)] : 'Not answered yet')}"></i>${esc(f.text)}</li>`;
  const block = (cls, hd, list, i) => `<div class="fv-layer ${cls} fv-in fv-dl-${i}"><p class="map-title">${esc(hd)}</p>${list.length ? `<ul class="map-list">${list.map(item).join('')}</ul>` : '<p class="map-empty">Nothing here yet</p>'}</div>`;
  return `<div class="fv fv-layers" role="img" aria-label="Formulation drawn as layers with ${factors.length} factor${factors.length === 1 ? '' : 's'}">
    <div class="fv-layer-stack">
      ${block('fv-layer-now', 'What is happening now', z.presenting, 0)}
      ${block('fv-layer-mid', 'Triggers and what keeps it going', [...z.precipitating, ...z.perpetuating], 1)}
      ${block('fv-layer-deep', 'Long standing patterns', z.predisposing, 2)}
    </div>
    ${block('fv-layer-side', 'Strengths', z.protective, 3)}
  </div>`;
}

// ---------- flower ----------
function flower(factors, responses) {
  const z = byZone(factors);
  const petals = z.perpetuating;
  const leaves = z.protective;
  const cx = W / 2;
  const R = 84; // centre
  const TIP = 250; // distance from centre to the middle of a petal card
  const CW = 172; // petal card width
  const petalH = petals.length ? Math.max(...petals.map((f) => cardHeight(f, CW))) : 0;
  const cy = PAD + 13 + GAP + (petals.length ? TIP + petalH / 2 + 34 : R + 20);
  let b = heading(cx, PAD + 13, titleOf('perpetuating'), 'middle');
  const n = petals.length;
  const spread = n > 1 ? Math.min(200, (n - 1) * 56) : 0;
  petals.forEach((f, i) => {
    const ang = -90 - spread / 2 + (n > 1 ? (i * spread) / (n - 1) : 0);
    const am = deg(ang), a1 = deg(ang - 26), a2 = deg(ang + 26);
    const tx = cx + Math.cos(am) * TIP, ty = cy + Math.sin(am) * TIP;
    const reach = TIP + 70;
    const loop = `<path d="M${r1(cx + Math.cos(a1) * R)},${r1(cy + Math.sin(a1) * R)} C${r1(cx + Math.cos(a1) * reach * 1.35)},${r1(cy + Math.sin(a1) * reach * 1.35)} ${r1(cx + Math.cos(a2) * reach * 1.35)},${r1(cy + Math.sin(a2) * reach * 1.35)} ${r1(cx + Math.cos(a2) * R)},${r1(cy + Math.sin(a2) * R)}" class="fv-petal fv-draw" marker-end="url(#fv-arrow)"/>`;
    const c = card(tx - CW / 2, ty - cardHeight(f, CW) / 2, CW, f, fitOf(responses, f), { cls: 'fv-card fv-keep-edge' });
    b += enter(loop + c.svg, i);
  });
  if (!n) b += textBlock(cx, cy - R - 40, 'Nothing here yet', { width: 300, anchor: 'middle', cls: 'fv-muted', size: 12 }).svg;
  const core = textBlock(cx, 0, problem(z).text, { width: R * 2 - 24, anchor: 'middle', cls: 'fv-inv', weight: 500, max: 4 });
  b += enter(`<g><title>${esc(problem(z).text)}</title><circle cx="${cx}" cy="${r1(cy)}" r="${R}" class="fv-navy"/>${textBlock(cx, cy - core.h / 2, problem(z).text, { width: R * 2 - 24, anchor: 'middle', cls: 'fv-inv', weight: 500, max: 4 }).svg}</g>`, n);
  // stem and leaves
  let ly = cy + R + GAP;
  b += heading(cx + 14, ly + 13, titleOf('protective'));
  ly += 13 + GAP;
  const LW = 220;
  const leafSvg = [];
  leaves.forEach((f, i) => {
    const side = i % 2 ? 1 : -1;
    const h = cardHeight(f, LW);
    const mid = ly + h / 2;
    const leaf = `<path d="M${cx},${r1(mid)} Q${r1(cx + side * 40)},${r1(mid - 34)} ${r1(cx + side * 78)},${r1(mid - 6)} Q${r1(cx + side * 40)},${r1(mid + 22)} ${cx},${r1(mid)}" class="fv-leaf fv-draw"/>`;
    const x = side > 0 ? cx + 86 : cx - 86 - LW;
    leafSvg.push(enter(leaf + card(x, ly, LW, f, fitOf(responses, f), { cls: 'fv-card fv-help-edge' }).svg, n + 1 + i));
    ly += h + GAP / 2;
  });
  if (!leaves.length) {
    const tb = textBlock(cx + 14, ly, 'Nothing here yet', { width: 300, cls: 'fv-muted', size: 12 });
    b += tb.svg;
    ly += tb.h;
  }
  const stemEnd = ly + GAP;
  b += `<path d="M${cx},${r1(cy + R)} L${cx},${r1(stemEnd)}" class="fv-stem fv-draw"/>` + leafSvg.join('');
  const foot = footer(z, stemEnd + GAP, responses);
  b += foot.svg;
  return frame('flower', stemEnd + GAP + foot.h + PAD, b, factors);
}

// ---------- river ----------
function river(factors, responses) {
  const z = byZone(factors);
  const colW = (W - PAD * 2 - GAP * 2) / 3;
  const cols = [
    ['Where it started', z.predisposing, ''],
    ['What set it off', z.precipitating, ''],
    ['Now', z.presenting, 'fv-navy'],
  ];
  let b = '';
  let top = 0;
  cols.forEach(([hd, list, cls], i) => {
    const x = PAD + i * (colW + GAP);
    if (cls) {
      b += heading(x, PAD + 13, hd);
      const y = PAD + 13 + GAP / 2 + 4;
      const c = card(x, y, colW, problem(z), null, { cls: 'fv-navy', textCls: 'fv-inv', withDot: false });
      b += enter(c.svg, i);
      top = Math.max(top, y + c.h);
    } else {
      const col = column(x, PAD, colW, list, responses, { title: hd, max: 2 });
      b += col.svg;
      top = Math.max(top, PAD + col.h);
    }
  });
  // the river band
  const ry = top + GAP * 2;
  const bandH = 120;
  const x0 = PAD, x1 = W - PAD;
  const path = (dy) => `M${x0},${ry + dy + 18} C${x0 + 200},${ry + dy + 8} ${x0 + 320},${ry + dy - 12} ${x0 + 460},${ry + dy - 12} C${x0 + 600},${ry + dy - 12} ${x0 + 700},${ry + dy + 10} ${x1},${ry + dy + 4}`;
  b += `<path d="${path(0)} L${x1},${ry + bandH + 4} C${x0 + 700},${ry + bandH + 10} ${x0 + 600},${ry + bandH - 12} ${x0 + 460},${ry + bandH - 12} C${x0 + 320},${ry + bandH - 12} ${x0 + 200},${ry + bandH + 8} ${x0},${ry + bandH + 18} Z" class="fv-water"/>`;
  b += `<path d="${path(0)}" class="fv-bank fv-draw"/><path d="${path(bandH)}" class="fv-bank fv-draw"/>`;
  const my = ry + bandH / 2 + 4;
  b += `<path d="M${x0 + 30},${my + 8} C${x0 + 300},${my + 4} ${x0 + 560},${my - 8} ${x1 - 60},${my - 4}" class="fv-flow" marker-end="url(#fv-arrow)"/>`;
  // stations under each column, and the eddy
  cols.forEach(([, , cls], i) => {
    const x = PAD + i * (colW + GAP) + colW / 2;
    const sy = my + 6 - i * 4;
    b += `<path d="M${r1(x)},${r1(top + 4)} L${r1(x)},${r1(sy - 14)}" class="fv-dotted"/><circle cx="${r1(x)}" cy="${r1(sy)}" r="8" class="${cls ? 'fv-navy' : 'fv-ink'}"/>`;
  });
  const ex = x1 - 70, ey = my - 2;
  b += `<path d="M${ex},${ey + 24} a24,22 0 1,1 -1,-2" class="fv-eddy fv-draw" marker-end="url(#fv-arrow)"/>`;
  b += heading(x1, ry - 6, 'Future', 'end');
  // below the river: the banks (protective) and the eddy list (perpetuating)
  const by = ry + bandH + GAP * 2;
  const half = (W - PAD * 2 - GAP) / 2;
  const banks = column(PAD, by, half, z.protective, responses, { title: `${titleOf('protective')}: the banks`, edge: 'fv-help-edge', max: 2 });
  const keep = column(PAD + half + GAP, by, half, z.perpetuating, responses, { title: `${titleOf('perpetuating')}: the eddy`, edge: 'fv-keep-edge', max: 2 });
  b += `<path d="M${ex},${ey + 46} L${ex},${by - 6}" class="fv-dotted"/>`;
  b += banks.svg + keep.svg;
  return frame('river', by + Math.max(banks.h, keep.h) + PAD, b, factors);
}

// ---------- balance ----------
function balance(factors, responses) {
  const z = byZone(factors);
  const weight = (list) => list.reduce((a, f) => a + ({ fits: 1, partly: 0.5 }[fitOf(responses, f)] ?? 0), 0);
  const tilt = Math.max(-8, Math.min(8, Math.round((weight(z.perpetuating) - weight(z.protective)) * 4)));
  const cx = W / 2;
  // the problem at the top
  let b = '';
  const pw = 440;
  const p = card(cx - pw / 2, PAD, pw, problem(z), null, { cls: 'fv-navy', textCls: 'fv-inv', withDot: false, max: 2 });
  b += enter(p.svg, 0);
  const beamY = PAD + p.h + GAP * 3;
  const half = 330, panW = 300;
  // pans hang level from the tilted beam ends
  const sides = [[-1, z.perpetuating, titleOf('perpetuating'), 'fv-keep-edge'], [1, z.protective, titleOf('protective'), 'fv-help-edge']];
  let bottom = beamY;
  const panSvg = sides.map(([side, list, hd, edge], i) => {
    const ex = cx + side * half, ey = beamY + Math.sin(deg(tilt)) * side * half;
    const py = ey + 70;
    const x = ex - panW / 2;
    const col = column(x + CARD_PAD, py + CARD_PAD, panW - CARD_PAD * 2, list, responses, { title: hd, edge, max: 2 });
    const h = col.h + CARD_PAD * 2;
    bottom = Math.max(bottom, py + h);
    return enter(`<path d="M${r1(ex)},${r1(ey)} L${r1(x + 20)},${r1(py)} M${r1(ex)},${r1(ey)} L${r1(x + panW - 20)},${r1(py)}" class="fv-line fv-draw"/>${rect(x, py, panW, h, `fv-card fv-faintbg ${edge}`)}${col.svg}`, 1 + i);
  });
  const baseY = bottom + GAP * 2;
  b += `<rect x="${cx - 4}" y="${beamY}" width="8" height="${r1(baseY - beamY)}" class="fv-ink"/><path d="M${cx},${r1(baseY - 36)} L${cx - 40},${r1(baseY)} L${cx + 40},${r1(baseY)} Z" class="fv-ink"/>`;
  b += `<g class="fv-beam fv-tilt-${tilt < 0 ? 'm' : ''}${Math.abs(tilt)}"><rect x="${cx - half - 10}" y="${beamY - 4}" width="${(half + 10) * 2}" height="8" rx="4" class="fv-ink"/></g>`;
  b += panSvg.join('') + `<circle cx="${cx}" cy="${beamY}" r="10" class="fv-navy"/>`;
  const fy = baseY + GAP * 2;
  const foot = footer(z, fy, responses);
  b += foot.svg;
  const noteY = fy + foot.h + GAP;
  b += textBlock(cx, noteY, 'The beam tilts towards whichever side has more marked as fitting.', { width: 600, anchor: 'middle', cls: 'fv-muted', size: 12, max: 1 }).svg;
  return frame('balance', noteY + 17 + PAD, b, factors);
}

// ---------- radial ----------
// The ring in the middle with a node for every factor on its rim, and the
// factor cards in 2 columns beside it, each joined to its node by a line.
function radial(factors, responses) {
  const z = byZone(factors);
  const colW = 240;
  const cx = W / 2, R1 = 70, R2 = 190;
  const left = [['protective', 198, 270], ['perpetuating', 126, 198]];
  const right = [['presenting', -90, -18], ['predisposing', -18, 54], ['precipitating', 54, 126]];
  const start = { presenting: -90, predisposing: -18, precipitating: 54, perpetuating: 126, protective: 198 };
  // measure both columns first so the ring can sit in the middle of them
  const measure = (zones) => zones.reduce((a, [id]) => a + 13 + GAP / 2 + 4 + (z[id].length ? z[id].reduce((s, f) => s + cardHeight(f, colW) + (f.source?.measureName ? 16 : 0) + GAP / 2, 0) - GAP / 2 : 17) + GAP, 0) - GAP;
  const hL = measure(left), hR = measure(right);
  const colH = Math.max(hL, hR, R2 * 2 + 40);
  const cy = PAD + colH / 2;
  let b = '';
  ZONES.forEach((zone) => {
    const a0 = deg(start[zone.id]), a1 = deg(start[zone.id] + 72), am = (a0 + a1) / 2;
    b += `<path d="M${r1(cx + Math.cos(a0) * R1)},${r1(cy + Math.sin(a0) * R1)} A${R1},${R1} 0 0,1 ${r1(cx + Math.cos(a1) * R1)},${r1(cy + Math.sin(a1) * R1)} L${r1(cx + Math.cos(a1) * R2)},${r1(cy + Math.sin(a1) * R2)} A${R2},${R2} 0 0,0 ${r1(cx + Math.cos(a0) * R2)},${r1(cy + Math.sin(a0) * R2)} Z" class="fv-sector${zone.id === 'protective' ? ' fv-sector-help' : ''}"/>`;
    const lbl = wrap(zone.title, 104, 11, 2);
    lbl.forEach((l, i) => { b += `<text x="${r1(cx + Math.cos(am) * 132)}" y="${r1(cy + Math.sin(am) * 132 + 4 + (i - (lbl.length - 1) / 2) * 14)}" font-size="11" class="fv-ink" text-anchor="middle" font-weight="500">${esc(l)}</text>`; });
  });
  b += `<circle cx="${cx}" cy="${r1(cy)}" r="40" class="fv-navy"/><text x="${cx}" y="${r1(cy + 5)}" font-size="14" class="fv-inv" text-anchor="middle" font-weight="500">You</text>`;
  const drawColumn = (zones, x, anchorX) => {
    let y = PAD + (colH - (zones === left ? hL : hR)) / 2;
    zones.forEach(([id, a0, a1]) => {
      b += heading(x, y + 13, titleOf(id));
      y += 13 + GAP / 2 + 4;
      const list = z[id];
      if (!list.length) {
        b += textBlock(x, y, 'Nothing here yet', { width: colW, cls: 'fv-muted', size: 12 }).svg;
        y += 17 + GAP;
        return;
      }
      list.forEach((f, k) => {
        const a = deg(a0 + ((a1 - a0) * (k + 1)) / (list.length + 1));
        const nx = cx + Math.cos(a) * R2, ny = cy + Math.sin(a) * R2;
        const h = cardHeight(f, colW);
        const c = card(x, y, colW, f, fitOf(responses, f));
        const src = f.source?.measureName ? `<text x="${r1(x + CARD_PAD)}" y="${r1(y + h + 12)}" font-size="10.5" class="fv-muted">${esc(`From ${f.source.measureName}`)}</text>` : '';
        b += enter(`<path d="M${r1(nx)},${r1(ny)} L${r1(anchorX)},${r1(y + h / 2)}" class="fv-dotted"/><circle cx="${r1(nx)}" cy="${r1(ny)}" r="8" class="fv-node fv-dot-${fitOf(responses, f) ?? 'none'}"/>${c.svg}${src}`);
        y += h + (src ? 16 : 0) + GAP / 2;
      });
      y += GAP - GAP / 2;
    });
  };
  seq = 0;
  drawColumn(left, PAD, PAD + colW);
  drawColumn(right, W - PAD - colW, W - PAD - colW);
  return frame('radial', PAD + colH + PAD, b, factors);
}

// ---------- loop with exits ----------
function loop(factors, responses) {
  const z = byZone(factors);
  const items = [{ ...problem(z), presenting: true }, ...z.perpetuating];
  const exits = z.protective;
  const CW = 180;
  const n = items.length;
  const hs = items.map((f) => cardHeight(f, CW, { withDot: !f.presenting }));
  const maxH = Math.max(...hs);
  const r = Math.max(150, (n * (CW + 36)) / (2 * Math.PI));
  const cx = PAD + CW / 2 + r + 10;
  const cy = PAD + 13 + GAP + maxH / 2 + r;
  const colX = cx + r + CW / 2 + GAP * 2, colW = W - PAD - colX;
  let b = heading(cx, PAD + 13, titleOf('perpetuating'), 'middle');
  // exits: a column to the right, each joined to the circuit
  let ey = PAD;
  let ex = heading(colX, ey + 13, `Exits: ${titleOf('protective').toLowerCase()}`);
  ey += 13 + GAP / 2 + 4;
  if (!exits.length) {
    ex += textBlock(colX, ey, 'Nothing here yet', { width: colW, cls: 'fv-muted', size: 12 }).svg;
    ey += 17;
  }
  exits.forEach((f, i) => {
    const h = cardHeight(f, colW, { max: 2 });
    const a = deg(-60 + (exits.length > 1 ? (i * 120) / (exits.length - 1) : 0));
    ex += enter(`<path d="M${r1(cx + Math.cos(a) * r)},${r1(cy + Math.sin(a) * r)} L${r1(colX - 8)},${r1(ey + h / 2)}" class="fv-exit fv-draw" marker-end="url(#fv-arrow)"/>${card(colX, ey, colW, f, fitOf(responses, f), { cls: 'fv-card fv-help-edge', max: 2 }).svg}`, n + i);
    ey += h + GAP / 2;
  });
  b += ex + `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" class="fv-circuit fv-draw"/>`;
  items.forEach((f, i) => {
    const a = deg(-90 + (i * 360) / n), am = deg(-90 + ((i + 0.5) * 360) / n);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (n > 1) b += `<path d="M${r1(cx + Math.cos(am - 0.05) * r)},${r1(cy + Math.sin(am - 0.05) * r)} L${r1(cx + Math.cos(am + 0.05) * r)},${r1(cy + Math.sin(am + 0.05) * r)}" class="fv-circuit" marker-end="url(#fv-arrow)"/>`;
    const c = card(x - CW / 2, y - hs[i] / 2, CW, f, fitOf(responses, f), f.presenting ? { cls: 'fv-navy', textCls: 'fv-inv', withDot: false } : { cls: 'fv-card fv-keep-edge' });
    b += enter(c.svg, i);
  });
  const bottom = Math.max(cy + r + maxH / 2, ey) + GAP * 2;
  const foot = footer(z, bottom, responses);
  b += foot.svg;
  return frame('loop', bottom + foot.h + PAD, b, factors);
}

const RENDER = { grid, flower, river, layers, balance, radial, loop };

export function renderFormulationView(view, factors, responses = {}) {
  seq = 0;
  return RENDER[viewOf(view)](factors ?? [], responses ?? {});
}
