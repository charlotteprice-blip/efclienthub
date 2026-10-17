// Checks the client type and intake configs, and the rules that turn intake
// answers into a client type. Runs without emulators:  npm run test:unit

import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { deriveClientType, ruleMatches, validateIntake } from '../../public/js/intake-rules.js';

const intake = JSON.parse(readFileSync('public/config/intake.json', 'utf8'));
const types = JSON.parse(readFileSync('public/config/client-types.json', 'utf8'));
const typeNames = Object.keys(types.types);

describe('client-types.json', () => {
  test('has default copy for every stage', () => {
    for (const stage of types.stages) {
      const copy = types.defaultCopy[stage];
      assert.ok(copy, `missing default copy for ${stage}`);
      assert.ok(copy.title && copy.body, `${stage} needs a title and body`);
      assert.ok(['none', 'measures', 'booking', 'results'].includes(copy.nextAction), `${stage} has an unknown nextAction`);
    }
  });
  test('type copy only names known stages', () => {
    for (const [name, t] of Object.entries(types.types)) {
      for (const stage of Object.keys(t.copy ?? {})) {
        assert.ok(types.stages.includes(stage), `${name} has copy for unknown stage ${stage}`);
      }
    }
  });
  test('every type has a valid accent colour', () => {
    for (const [name, t] of Object.entries(types.types)) {
      assert.match(t.accent, /^#[0-9A-Fa-f]{6}$/, `${name} accent`);
    }
  });
  test('client facing copy uses no em or en dashes', () => {
    const text = JSON.stringify(types);
    assert.ok(!/[–—]/.test(text));
  });
});

describe('intake.json', () => {
  test('question ids are unique', () => {
    const ids = intake.questions.map((q) => q.id);
    assert.equal(new Set(ids).size, ids.length);
  });
  test('every rule names enabled questions and real answers', () => {
    for (const rule of intake.rules) {
      for (const [qid, expected] of Object.entries(rule.when)) {
        const q = intake.questions.find((x) => x.id === qid);
        assert.ok(q, `rule refers to unknown question ${qid}`);
        assert.ok(q.enabled, `rule refers to switched off question ${qid}`);
        for (const value of [].concat(expected)) {
          assert.ok(q.options.some((o) => o.value === value), `${qid} has no option ${value}`);
        }
      }
    }
  });
  test('every rule sets a known client type', () => {
    for (const rule of intake.rules) assert.ok(typeNames.includes(rule.type), rule.type);
  });
  test('fallback type is null or known', () => {
    assert.ok(intake.fallbackType === null || typeNames.includes(intake.fallbackType));
  });
  test('client facing copy uses no em or en dashes', () => {
    assert.ok(!/[–—]/.test(JSON.stringify(intake)));
  });
});

describe('deriveClientType', () => {
  test('type on the activation code takes priority', () => {
    assert.deepEqual(deriveClientType(intake, { reason: 'health' }, 'neurodivergent'), { type: 'neurodivergent', source: 'code' });
  });
  test('focus answers give neurodivergent', () => {
    assert.equal(deriveClientType(intake, { reason: 'focus', arranged: 'self' }).type, 'neurodivergent');
  });
  test('health answers give health', () => {
    assert.equal(deriveClientType(intake, { reason: 'health', arranged: 'referral' }).type, 'health');
  });
  test('workplace programme gives corporate', () => {
    assert.equal(deriveClientType(intake, { reason: 'workplace', arranged: 'workplace' }).type, 'corporate');
  });
  test('team gives team', () => {
    assert.equal(deriveClientType(intake, { reason: 'team' }).type, 'team');
  });
  test('not sure falls back for Sarah to assign', () => {
    assert.deepEqual(deriveClientType(intake, { reason: 'unsure' }), { type: null, source: 'fallback' });
  });
  test('an empty rule never matches', () => {
    assert.equal(ruleMatches({}, { reason: 'focus' }), false);
  });
  test('array conditions match any listed answer', () => {
    assert.equal(ruleMatches({ reason: ['focus', 'health'] }, { reason: 'health' }), true);
  });
});

describe('validateIntake', () => {
  test('flags missing required answers', () => {
    const errors = validateIntake(intake, {});
    assert.ok(errors.reason && errors.arranged);
    assert.equal(errors.hope, undefined);
  });
  test('ignores switched off questions', () => {
    assert.equal(validateIntake(intake, {}).previousAssessment, undefined);
  });
  test('rejects an answer that is not an option', () => {
    assert.ok(validateIntake(intake, { reason: 'other', arranged: 'self' }).reason);
  });
  test('accepts a complete set of answers', () => {
    assert.deepEqual(validateIntake(intake, { reason: 'focus', arranged: 'self', hope: 'More calm.' }), {});
  });
});
