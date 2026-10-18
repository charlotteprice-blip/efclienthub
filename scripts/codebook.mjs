// Builds the questionnaire library from the EF Client Hub Codebook.
//
//   npm run codebook                 reads measures/ef-client-hub-codebook.xlsx
//                                    writes measures/library.json (every included instrument)
//                                    and measures/cleared.json (only licence status cleared)
//   npm run measures -- check measures/library.json
//   npm run measures -- upload measures/cleared.json
//
// The workbook is the source of truth. Charlotte and Sarah edit the Hub
// Library and Hub Subscales sheets (names, licence status, wording, topics,
// band thresholds); item text, response options, reverse scoring and
// subscale membership come from the codebook's own sheets and are never
// retyped here. Nothing is uploaded by this script.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ExcelJS from 'exceljs';
import { problems } from './measures.mjs';

const root = join(dirname(new URL(import.meta.url).pathname), '..');
const source = join(root, 'measures/ef-client-hub-codebook.xlsx');
const LEARNING_HUB = 'https://app.executiveframe.co.nz/';

const text = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && v.richText) return v.richText.map((r) => r.text).join('');
  if (typeof v === 'object' && v.result !== undefined) return String(v.result);
  return String(v).trim();
};

function rows(ws) {
  const headers = [];
  const out = [];
  ws.eachRow((row, n) => {
    const values = row.values.slice(1).map(text);
    if (n === 1) {
      headers.push(...values);
      return;
    }
    if (values.every((v) => !v)) return;
    out.push(Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
  });
  return out;
}

const col = (row, prefix) => {
  const key = Object.keys(row).find((k) => k.toLowerCase().startsWith(prefix.toLowerCase()));
  return key ? row[key] : '';
};

// "6-7, 12-14, 16" -> [6, 7, 12, 13, 14, 16]
function numbers(spec) {
  const out = [];
  for (const part of String(spec).split(',')) {
    const m = part.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) for (let i = Number(m[1]); i <= Number(m[2]); i += 1) out.push(i);
    else if (part.trim()) out.push(Number(part.trim()));
  }
  return out.filter((n) => Number.isInteger(n));
}

// "Never = 0 | Sometimes = 1" -> [{ value: 0, label: "Never" }]
function options(spec) {
  return String(spec)
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = p.match(/^(.*?)\s*=\s*(-?\d+(?:\.\d+)?)$/);
      if (!m) throw new Error(`Cannot read response option "${p}"`);
      return { value: Number(m[2]), label: m[1].trim() };
    });
}

function bands(direction, method, lower, upper, range, count) {
  if (direction === 'none') return [];
  const [min, max] = range;
  const scale = method === 'sum' ? count : 1;
  let lo = lower === '' ? min * scale + ((max - min) * scale) / 3 : Number(lower);
  let hi = upper === '' ? min * scale + (2 * (max - min) * scale) / 3 : Number(upper);
  lo = Math.round(lo * 100) / 100;
  hi = Math.round(hi * 100) / 100;
  if (direction === 'difficulty') {
    const list = [];
    if (lower !== '' || upper === '') list.push({ upTo: lo, band: 'strength' });
    list.push({ upTo: hi, band: 'typical' }, { band: 'focus' });
    return list;
  }
  const list = [];
  if (lower !== '' || upper === '') list.push({ upTo: lo, band: 'focus' });
  list.push({ upTo: hi, band: 'typical' }, { band: 'strength' });
  return list;
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(source);
const library = rows(wb.getWorksheet('Hub Library'));
const hubSubs = rows(wb.getWorksheet('Hub Subscales'));
const summary = rows(wb.getWorksheet('Instrument Summary'));
const items = rows(wb.getWorksheet('Master Item List'));
const structure = rows(wb.getWorksheet('Structure and Subscales'));

const measures = [];
const skipped = [];
for (const lib of library) {
  const code = col(lib, 'Code');
  const include = col(lib, 'Include in hub').toLowerCase();
  const licence = col(lib, 'Hub licence status').toLowerCase() || 'review';
  if (include === 'no' || licence === 'excluded') {
    skipped.push(`${code} (${include === 'no' ? 'not included' : 'excluded'})`);
    continue;
  }
  const sum = summary.find((r) => col(r, 'Code') === code);
  if (!sum) throw new Error(`${code}: no row in Instrument Summary`);
  const id = col(lib, 'Hub id');
  const itemRows = items.filter((r) => col(r, 'Code') === code).sort((a, b) => Number(col(a, 'Item Number')) - Number(col(b, 'Item Number')));
  const itemId = (n) => `${id}-${n}`;
  const responseOptions = options(col(sum, 'Response options'));
  const sameOptions = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const measureItems = itemRows.map((r) => {
    const item = { id: itemId(col(r, 'Item Number')), text: col(r, 'Item Text') };
    // An item whose Response Options cell differs from the instrument's own
    // scale carries those options itself (AUDIT-C, CUDIT-R, PROMIS Global Health).
    const own = col(r, 'Response Options');
    if (own && own.includes('=')) {
      const parsed = options(own);
      if (!sameOptions(parsed, responseOptions)) item.responseOptions = parsed;
    }
    return item;
  });
  const reverseItems = itemRows.filter((r) => col(r, 'Reverse Scored').toUpperCase() === 'TRUE').map((r) => itemId(col(r, 'Item Number')));
  const fillers = new Set(itemRows.filter((r) => col(r, 'Filler').toUpperCase() === 'TRUE').map((r) => itemId(col(r, 'Item Number'))));
  const values = responseOptions.map((o) => o.value);
  const range = [Math.min(...values), Math.max(...values)];

  const subs = hubSubs.filter((r) => col(r, 'Code') === code);
  if (!subs.length) throw new Error(`${code}: no rows in Hub Subscales`);
  const subscales = subs.map((r) => {
    const name = col(r, 'Codebook subscale');
    const st = structure.find((x) => col(x, 'Code') === code && col(x, 'Subscale') === name);
    let subItems;
    if (st) subItems = numbers(col(st, 'Item Numbers')).map(itemId);
    else if (subs.length === 1) subItems = measureItems.map((i) => i.id).filter((i) => !fillers.has(i));
    else throw new Error(`${code}: subscale "${name}" not found in Structure and Subscales`);
    for (const i of subItems) if (!measureItems.some((x) => x.id === i)) throw new Error(`${code}: subscale "${name}" refers to item ${i} which is not in the item list`);
    const direction = col(r, 'Scoring direction').toLowerCase() || 'none';
    const method = col(r, 'Method').toLowerCase() === 'sum' ? 'sum' : 'mean';
    const topicLabel = col(r, 'Learning Hub topic');
    const topicUrl = col(r, 'Topic URL');
    const sub = {
      id: col(r, 'Hub subscale id'),
      label: col(r, 'Label shown to clients') || name,
      codebookName: name,
      items: subItems,
      method,
      direction,
      bands: bands(direction, method, col(r, 'Lower band'), col(r, 'Upper band'), range, subItems.length),
    };
    if (col(r, 'Strength wording')) sub.strengthReason = col(r, 'Strength wording');
    if (col(r, 'Focus wording')) sub.focusReason = col(r, 'Focus wording');
    if (topicLabel && topicUrl) sub.topic = { label: topicLabel, url: topicUrl.startsWith('http') ? topicUrl : `${LEARNING_HUB}${topicUrl}` };
    return sub;
  });

  const flagItems = [];
  const flagSpec = col(lib, 'Flag items');
  const fm = flagSpec.match(/^([\d,\s-]+)\s+at\s+(\d+)$/i);
  if (flagSpec && !fm) throw new Error(`${code}: flag items should read like "10,17,21 at 2"`);
  if (fm) for (const n of numbers(fm[1])) flagItems.push({ itemId: itemId(n), atLeast: Number(fm[2]), note: 'Follow up with the client directly.' });

  const measure = {
    id,
    code,
    name: col(lib, 'Name shown to clients') || col(sum, 'Instrument Name'),
    formalName: col(sum, 'Instrument Name'),
    domain: col(sum, 'Domain').replace(/^\d+\.\s*/, ''),
    description: col(sum, 'Construct measured').slice(0, 300),
    licenceStatus: licence,
    licenceNote: col(lib, 'Licence note'),
    instructions: /^not (stated|retrieved)/i.test(col(lib, 'Instructions shown')) ? '' : col(lib, 'Instructions shown'),
    minutes: Number(col(lib, 'Minutes')) || null,
    tags: col(lib, 'Conditions and topics').split('|').map((t) => t.trim()).filter(Boolean),
    responseOptions,
    items: measureItems,
    scoringRules: {
      minAnswered: 0.8,
      clientFacing: col(lib, 'Client sees strengths').toLowerCase() !== 'no',
      reverseItems,
      flagItems,
      subscales,
    },
    source: { codebook: 'EF Client Hub Codebook', citation: col(sum, 'Developer citation').slice(0, 400), url: col(sum, 'Source URL') },
  };
  measures.push(measure);
}

let bad = 0;
for (const m of measures) {
  const p = problems(m);
  if (p.length) {
    bad += 1;
    console.error(`${m.id}: ${p.join('; ')}`);
  }
}
if (bad) {
  console.error(`\n${bad} questionnaire${bad === 1 ? '' : 's'} failed validation; nothing written.\n`);
  process.exit(1);
}

mkdirSync(join(root, 'measures'), { recursive: true });
writeFileSync(join(root, 'measures/library.json'), `${JSON.stringify({ generated: new Date().toISOString().slice(0, 10), measures }, null, 2)}\n`);
// Only instruments Charlotte has marked Include = Yes AND cleared are uploadable;
// a row still marked Decide stays in library.json for review.
const included = new Set(library.filter((l) => col(l, 'Include in hub').toLowerCase() === 'yes').map((l) => col(l, 'Code')));
const cleared = measures.filter((m) => m.licenceStatus === 'cleared' && included.has(m.code));
writeFileSync(join(root, 'measures/cleared.json'), `${JSON.stringify({ generated: new Date().toISOString().slice(0, 10), measures: cleared }, null, 2)}\n`);

const byStatus = {};
for (const m of measures) (byStatus[m.licenceStatus] ??= []).push(m.code);
console.log(`\nmeasures/library.json: ${measures.length} questionnaires, ${measures.reduce((n, m) => n + m.items.length, 0)} items`);
for (const [status, codes] of Object.entries(byStatus)) console.log(`  ${status.padEnd(11)} ${codes.join(', ')}`);
if (skipped.length) console.log(`  left out    ${skipped.join(', ')}`);
console.log(`measures/cleared.json: ${cleared.length} ready to upload with npm run measures -- upload measures/cleared.json\n`);
