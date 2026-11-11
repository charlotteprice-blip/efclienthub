// The practitioner's Today list, To review count and dashboard: flagged
// answers must reach Sarah without her opening a client's record.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { attentionItems, dashboard, openFlags, review, toReview } from '../../public/js/live/views-staff.js';

const flag = { itemId: 'i1', text: 'Question text', value: 3, note: 'Follow up' };
function state({ flags = [], clientFacing = true, followedUp = false, released = false, requests = [] } = {}) {
  return {
    role: 'practitioner',
    user: { displayName: 'Practitioner', email: 'p@example.com' },
    config: { attention: {}, splose: { enabled: false } },
    clientTypes: { types: {}, stages: [] },
    flash: null,
    ctx: {
      codes: [],
      measures: { m1: { id: 'm1', name: 'Sample questionnaire' } },
      clients: { c1: { uid: 'c1', name: 'Test Person', codeHash: 'x', activatedAt: 1, journeyStage: 'assessment', createdAt: Date.now() } },
      assignments: [{ id: 'a1', uid: 'c1', measureId: 'm1', status: 'complete', completedAt: Date.now(), assignedAt: Date.now() }],
      scoring: { a1: { id: 'a1', uid: 'c1', measureId: 'm1', scores: { subscales: {} }, draft: { measureName: 'Sample questionnaire', clientFacing, flags, strengths: [], focus: [] }, ...(followedUp ? { flagsFollowedUpAt: Date.now() } : {}) } },
      results: released ? { c1: { releasedAt: Date.now(), items: [{ assignmentId: 'a1' }] } } : {},
      requests,
      schedules: [],
      formulations: {},
      formulationResponses: {},
      splose: {},
    },
  };
}

describe('flagged answers on the dashboard', () => {
  test('a flagged answer leads Today and links to the Questionnaires tab', () => {
    const s = state({ flags: [flag], clientFacing: false });
    const [first] = attentionItems(s);
    assert.equal(first.kind, 'flag');
    assert.equal(first.href, '/practitioner/client/c1/questionnaires');
    const html = dashboard(s);
    assert.ok(html.includes('Answers to follow up'));
    assert.ok(!html.includes('Nothing waiting on you'));
  });
  test('a questionnaire for the practitioner only still counts in To review when flagged', () => {
    const s = state({ flags: [flag], clientFacing: false });
    assert.equal(toReview(s, 'c1'), 1);
    assert.ok(review(s).includes('aria-label="1 to review"'));
  });
  test('a flagged draft that is also unreleased is counted once', () => {
    assert.equal(toReview(state({ flags: [flag] }), 'c1'), 1);
  });
  test('marking as followed up clears it from Today and the count', () => {
    const s = state({ flags: [flag], clientFacing: false, followedUp: true });
    assert.equal(openFlags(s, 'c1').length, 0);
    assert.equal(toReview(s, 'c1'), 0);
    assert.ok(dashboard(s).includes('Nothing waiting on you'));
  });
  test('a flag on results already released still shows until followed up', () => {
    const s = state({ flags: [flag], released: true });
    assert.equal(attentionItems(s)[0].kind, 'flag');
  });
  test('the flagged answer itself is not written on the dashboard', () => {
    assert.ok(!dashboard(state({ flags: [flag], clientFacing: false })).includes('Question text'));
  });
});

describe('Today lists work that is waiting', () => {
  test('drafts to review and every open privacy request are listed with a named link', () => {
    const s = state({ requests: [{ id: 'r1', uid: 'c1', kind: 'access', status: 'open', createdAt: Date.now(), dueBy: Date.now() + 40 * 86400000 }] });
    const kinds = attentionItems(s).map((x) => x.kind);
    assert.ok(kinds.includes('draft') && kinds.includes('request'));
    const html = dashboard(s);
    assert.ok(html.includes('href="/practitioner/client/c1/requests"'));
    assert.ok(html.includes('aria-label="Open Test Person:'));
  });
});
