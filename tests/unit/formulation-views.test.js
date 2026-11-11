import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { VIEW_OPTIONS, renderFormulationView, viewOf } from '../../public/js/formulation-views.js';

const factors = [
  { id: 'p1', zone: 'presenting', text: 'Deadlines slipping and evenings spent catching up' },
  { id: 'd1', zone: 'predisposing', text: 'Long standing difficulty with planning' },
  { id: 't1', zone: 'precipitating', text: 'New role with less structure' },
  { id: 'k1', zone: 'maintaining', text: 'Leaving the hardest job until last', source: { measureName: 'Procrastination scale', subscaleId: 'x' } },
  { id: 'k2', zone: 'perpetuating', text: 'Late nights, then a slow start <b>the next day</b>' },
  { id: 'h1', zone: 'protective', text: 'A supportive manager' },
];
const responses = { k1: { fit: 'fits' }, k2: { fit: 'partly' } };

describe('formulation views', () => {
  test('every option draws the factors and the responses', () => {
    for (const { id } of VIEW_OPTIONS) {
      const html = renderFormulationView(id, factors, responses);
      assert.ok(html.includes('A supportive manager'), `${id} shows a protective factor`);
      assert.ok(html.includes('fits'), `${id} shows a response`);
      assert.ok(!html.includes('<b>'), `${id} escapes factor text`);
      assert.ok(html.includes('role="img"'), `${id} is labelled for screen readers`);
      assert.ok(!/style="/.test(html), `${id} uses no style attributes`);
    }
  });
  test('an empty formulation and an unknown view still draw', () => {
    for (const { id } of VIEW_OPTIONS) assert.ok(renderFormulationView(id, [], {}).length > 100, id);
    assert.equal(viewOf('spiral'), 'grid');
    assert.ok(renderFormulationView('spiral', factors).includes('class="fv map"'));
  });
  test('each response has its own shape and words, never colour alone', () => {
    const all = { k1: { fit: 'fits' }, k2: { fit: 'partly' }, h1: { fit: 'no' } };
    for (const { id } of VIEW_OPTIONS) {
      const html = renderFormulationView(id, factors, all);
      for (const kind of ['fits', 'partly', 'no', 'none']) assert.ok(html.includes(`fv-mark-${kind}`), `${id} draws the ${kind} mark`);
      assert.ok(html.includes('class="fv-key"'), `${id} has a key`);
      for (const word of ['Fits', 'Partly', 'Does not fit', 'Not answered yet']) assert.ok(html.includes(`</svg>${word}</li>`), `${id} key says ${word}`);
      assert.ok(html.includes('1 marked fits, 1 partly, 1 does not fit, 3 not answered yet'), `${id} counts the responses in its text alternative`);
      assert.ok(!html.includes('#8A3F34'), `${id} does not use the error colour`);
    }
  });
  test('an SVG drawing carries the map for narrow screens; the map and layers do not need one', () => {
    for (const { id } of VIEW_OPTIONS) {
      const html = renderFormulationView(id, factors, responses);
      assert.equal(html.includes('class="fv-narrow"'), !['grid', 'layers'].includes(id), id);
    }
  });
  test('a long factor is not cut short in a measured column', () => {
    const long = 'A sentence long enough to need more than 3 lines in a narrow card so that the old limit would have cut it short with an ellipsis here';
    const list = [...factors, { id: 'h2', zone: 'protective', text: long }, { id: 'd2', zone: 'predisposing', text: long }];
    for (const id of ['river', 'balance', 'radial']) {
      const svg = renderFormulationView(id, list, {}).split('class="fv-narrow"')[0];
      assert.ok(!svg.includes('…'), `${id} has no ellipsis`);
      assert.ok(svg.includes('ellipsis here'), `${id} draws the last words`);
    }
  });
  test('no text in a drawing is smaller than 12 units', () => {
    for (const { id } of VIEW_OPTIONS) {
      const sizes = [...renderFormulationView(id, factors, responses).matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
      assert.ok(sizes.every((n) => n >= 12), `${id}: ${Math.min(...sizes)}`);
    }
  });
  test('the radial view names the questionnaire a factor came from', () => {
    assert.ok(renderFormulationView('radial', factors).includes('Procrastination scale'));
  });
});
