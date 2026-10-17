// Works out a client type from intake answers using the rules in
// config/intake.json. Pure function with no browser or Firebase
// dependencies, so the submitIntake Cloud Function uses the same logic.
//
// Rules are checked in order and the first match wins. A rule matches when
// every question it names has the listed answer, or one of the listed
// answers when an array is given. A type set on the activation code takes
// priority when codeTypeTakesPriority is true. If nothing matches, the
// result is fallbackType, which may be null so that Sarah assigns the type.

export function deriveClientType(config, answers, codeType = null) {
  if (codeType && config.codeTypeTakesPriority) {
    return { type: codeType, source: 'code' };
  }
  for (const rule of config.rules ?? []) {
    if (ruleMatches(rule.when ?? {}, answers ?? {})) {
      return { type: rule.type, source: 'rule' };
    }
  }
  if (codeType) {
    return { type: codeType, source: 'code' };
  }
  return { type: config.fallbackType ?? null, source: 'fallback' };
}

export function ruleMatches(when, answers) {
  const keys = Object.keys(when);
  if (keys.length === 0) return false;
  return keys.every((questionId) => {
    const expected = when[questionId];
    const given = answers[questionId];
    return Array.isArray(expected) ? expected.includes(given) : given === expected;
  });
}

// Checks answers against the questionnaire before anything is submitted.
// Returns an object keyed by question id with an error message, empty when
// all is well.
export function validateIntake(config, answers) {
  const errors = {};
  for (const q of config.questions ?? []) {
    if (!q.enabled) continue;
    const value = answers?.[q.id];
    const empty = value === undefined || value === null || String(value).trim() === '';
    if (q.required && empty) {
      errors[q.id] = 'Please answer this question.';
      continue;
    }
    if (!empty && q.type === 'single' && !q.options.some((o) => o.value === value)) {
      errors[q.id] = 'Please choose one of the options.';
    }
    if (!empty && q.type === 'text' && String(value).length > 1000) {
      errors[q.id] = 'Please keep this to 1000 characters.';
    }
  }
  return errors;
}
