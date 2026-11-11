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

// ---------- the client's Home ----------

const { home, journeyDetails } = await import('../../public/js/live/views-client.js');

function clientState({ stage = 'assessment', assignments = [], bookingTriggeredAt, resources = [] } = {}) {
  return {
    flash: null,
    errors: {},
    config: { splose: { enabled: false }, learningHubUrl: 'https://hub.example', bookingUrl: '' },
    clientTypes: { stages: ['enquiry', 'firstSession', 'assessment', 'booking', 'feedback', 'intervention', 'review'], types: {}, defaultCopy: Object.fromEntries(['enquiry', 'firstSession', 'assessment', 'booking', 'feedback', 'intervention', 'review'].map((s) => [s, { title: 'Title', body: 'Body', nextAction: 'none' }])) },
    ctx: {
      client: { uid: 'c1', name: 'Test Person', journeyStage: stage, bookingTriggeredAt, resources },
      assignments,
      measures: { m1: { id: 'm1', name: 'Sample questionnaire', items: [{ id: 'a', text: 'A' }] } },
      results: null,
      formulation: null,
      formulationResponses: {},
      requests: [],
      schedules: [],
      splose: null,
    },
  };
}

describe('the journey never moves back on the client\'s Home', () => {
  const first = { id: 'a1', measureId: 'm1', status: 'complete', assignedAt: 100, completedAt: 150 };
  const later = { id: 'a2', measureId: 'm1', status: 'notStarted', assignedAt: 500 };
  test('a questionnaire assigned after booking is a task, and the first step stays done', () => {
    const s = clientState({ stage: 'feedback', assignments: [first, later], bookingTriggeredAt: 200 });
    assert.equal(journeyDetails(s).assessment, '1 of 1');
    const html = home(s);
    assert.ok(html.includes('href="/measure/a2"'), 'it is in To do');
    assert.ok(html.includes('Step 5 of 7'));
    assert.match(html, /<li class="step step-done"><span class="step-dot" aria-hidden="true"><\/span><span class="step-label">Questionnaires<span class="visually-hidden">, done<\/span><span class="step-detail">1 of 1<\/span>/);
    assert.match(html, /<li class="step step-current" aria-current="step">.*?Feedback/);
  });
  test('during the assessment every questionnaire still counts', () => {
    const s = clientState({ stage: 'assessment', assignments: [first, later] });
    assert.equal(journeyDetails(s).assessment, '1 of 2');
    assert.match(home(s), /<li class="step step-current" aria-current="step">.*?Questionnaires/);
  });
});

describe('empty sections on Home', () => {
  test('Your resources appears only once there is a resource; the tracker always shows', () => {
    const empty = home(clientState());
    assert.ok(!empty.includes('Your resources'));
    assert.ok(empty.includes('class="tracker'));
    const withOne = home(clientState({ resources: [{ id: 'r1', title: 'A link', url: 'https://example.com/a', note: '' }] }));
    assert.ok(withOne.includes('Your resources') && withOne.includes('https://example.com/a'));
  });
});

describe('the journey ring is retired', () => {
  test('Home has no ring and no mark used as a meter; the tracker carries the step', () => {
    const html = home(clientState({ stage: 'booking' }));
    assert.ok(!html.includes('data-ring') && !html.includes('journey-ring'));
    assert.equal((html.match(/class="tracker/g) ?? []).length, 1, '1 step tracker');
    assert.equal((html.match(/class="step /g) ?? []).length, 7, '7 journey steps');
    assert.ok(html.includes('aria-label="Step 4 of 7: Book feedback"'));
    assert.ok(!html.includes('role="progressbar"'), 'no second step display on Home');
  });
  test('the practitioner dashboard shows the journey with the same tracker', () => {
    const html = dashboard(state());
    assert.ok(html.includes('class="tracker tracker-dots"'));
    assert.ok(!html.includes('class="segments"'));
  });
});

describe('status and notices follow the brand pack', () => {
  test('Not started is the plain tag, with no icon and no attention style, on staff screens too', async () => {
    const { client } = await import('../../public/js/live/views-staff.js');
    const s = state();
    s.ctx.assignments.push({ id: 'a2', uid: 'c1', measureId: 'm1', status: 'notStarted', assignedAt: Date.now() });
    Object.assign(s.ctx, { intake: {}, formulationDrafts: {}, requests: [] });
    s.intakeConfig = { questions: [] };
    s.clientTypes = { types: {}, stages: ['assessment'] };
    s.errors = {};
    s.form = {};
    const html = client(s, 'c1', 'questionnaires');
    assert.ok(html.includes('<span class="tag">Not started</span>'));
    assert.ok(!/status-attention[^<]*<svg[^>]*>.*?<\/svg>Not started/.test(html));
  });
  test('a notice always has an icon and a word', async () => {
    const { notice } = await import('../../public/js/ui.js');
    for (const [kind, word] of [['info', 'Note'], ['success', 'Done'], ['warning', 'Attention'], ['error', 'Problem']]) {
      const html = notice(kind, '<p>Text</p>');
      assert.ok(html.includes(`class="notice notice-${kind}"`));
      assert.ok(html.includes('class="notice-icon"') && html.includes(`<p class="notice-word">${word}</p>`));
    }
  });
});
