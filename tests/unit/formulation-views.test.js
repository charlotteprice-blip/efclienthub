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
  test('the radial view names the questionnaire a factor came from', () => {
    assert.ok(renderFormulationView('radial', factors).includes('Procrastination scale'));
  });
});
