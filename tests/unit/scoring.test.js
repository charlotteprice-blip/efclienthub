import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { bandFor, buildDraft, scoreMeasure } from '../../public/js/scoring.js';

const { measures } = JSON.parse(readFileSync('public/sample/sample-measures.json', 'utf8'));
const routines = measures.find((m) => m.id === 'sample-routines');
const focus = measures.find((m) => m.id === 'sample-focus');

describe('sample measures are well formed', () => {
  for (const m of measures) {
    test(`${m.id}: every subscale item exists and every item is scored once`, () => {
      const ids = new Set(m.items.map((i) => i.id));
      const used = m.scoringRules.subscales.flatMap((s) => s.items);
      for (const id of used) assert.ok(ids.has(id), `${id} missing`);
      assert.equal(new Set(used).size, used.length);
      for (const id of m.scoringRules.reverseItems) assert.ok(ids.has(id));
    });
    test(`${m.id}: marked as sample, never licensed`, () => {
      assert.equal(m.licenceStatus, 'sample');
    });
  }
});

describe('scoreMeasure', () => {
  test('reverse scores and averages', () => {
    // structure items r1, r3, r5 are reverse scored: answering 3 gives 0.
    const r = { r1: 3, r3: 3, r5: 3, r2: 3, r4: 3, r6: 3 };
    const s = scoreMeasure(routines, r);
    assert.equal(s.subscales.structure.score, 0);
    assert.equal(s.subscales.structure.band, 'strength');
    assert.equal(s.subscales.momentum.score, 3);
    assert.equal(s.subscales.momentum.band, 'focus');
    assert.equal(s.complete, true);
  });
  test('does not score a subscale with too few answers', () => {
    const s = scoreMeasure(routines, { r1: 1 });
    assert.equal(s.subscales.structure.band, 'notScored');
    assert.equal(s.complete, false);
  });
  test('ignores answers that are not offered options', () => {
    const s = scoreMeasure(routines, { r1: 9, r3: 'x', r5: 1, r2: 1, r4: 1, r6: 1 });
    assert.equal(s.answeredItems, 4);
  });
  test('bands use the first threshold met', () => {
    const bands = [{ upTo: 1, band: 'strength' }, { upTo: 1.9, band: 'typical' }, { band: 'focus' }];
    assert.equal(bandFor(bands, 1), 'strength');
    assert.equal(bandFor(bands, 1.5), 'typical');
    assert.equal(bandFor(bands, 2.5), 'focus');
  });
});

describe('buildDraft', () => {
  test('lists strengths and areas of focus with reasons and topics', () => {
    const r = { f1: 3, f3: 0, f5: 0, f6: 3, f2: 3, f4: 0, f7: 3, f8: 0 };
    const draft = buildDraft(focus, scoreMeasure(focus, r));
    assert.equal(draft.status, 'draft');
    assert.equal(draft.notADiagnosis, true);
    assert.deepEqual(draft.strengths.map((x) => x.subscaleId), ['planning']);
    assert.deepEqual(draft.focus.map((x) => x.subscaleId), ['attention']);
    assert.match(draft.focus[0].topic.url, /^https:\/\/app\.executiveframe\.co\.nz\/hub\//);
  });
  test('reports subscales that could not be scored', () => {
    const draft = buildDraft(focus, scoreMeasure(focus, { f1: 1 }));
    assert.equal(draft.notScored.length, 2);
  });
});

describe('scales that start at 1, flags and practitioner only measures', () => {
  const seven = {
    id: 'seven',
    name: 'Seven point',
    responseOptions: [1, 2, 3, 4, 5, 6, 7].map((v) => ({ value: v, label: String(v) })),
    items: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }],
    scoringRules: {
      reverseItems: ['b'],
      flagItems: [{ itemId: 'c', atLeast: 6, note: 'Follow up' }],
      subscales: [{ id: 't', label: 'Total', items: ['a', 'b'], method: 'mean', bands: [{ upTo: 3, band: 'focus' }, { upTo: 5, band: 'typical' }, { band: 'strength' }], strengthReason: 's', focusReason: 'f' }],
    },
  };
  test('a reversed item on a 1 to 7 scale maps 7 to 1, not 7 to 0', () => {
    const s = scoreMeasure(seven, { a: 7, b: 7, c: 1 });
    assert.equal(s.subscales.t.score, 4); // (7 + 1) / 2
    assert.deepEqual(s.flags, []);
  });
  test('flagged answers use the raw value and carry the item text', () => {
    const s = scoreMeasure(seven, { a: 1, b: 1, c: 6 });
    assert.equal(s.flags.length, 1);
    assert.equal(s.flags[0].text, 'C');
    assert.equal(s.flags[0].value, 6);
    assert.equal(buildDraft(seven, s).flags[0].note, 'Follow up');
  });
  test('a practitioner only measure produces scores but no client facing items', () => {
    const m = { ...seven, scoringRules: { ...seven.scoringRules, clientFacing: false } };
    const s = scoreMeasure(m, { a: 7, b: 1, c: 1 });
    assert.equal(s.subscales.t.band, 'strength');
    const d = buildDraft(m, s);
    assert.equal(d.clientFacing, false);
    assert.deepEqual(d.strengths, []);
    assert.deepEqual(d.focus, []);
  });
});
