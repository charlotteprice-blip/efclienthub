// Scores a completed questionnaire from the scoringRules held on its
// measure document, and builds the draft that Sarah reads before release.
// Pure functions with no browser or Firebase dependencies, so the
// scoreMeasure Cloud Function uses this file unchanged.
//
// Output is always a DRAFT for the practitioner. Nothing here is a
// diagnosis and nothing here is shown to a client until releaseResults.
//
// scoringRules shape:
// {
//   "minAnswered": 0.8,                      share of a subscale's items needed to score it
//   "reverseItems": ["i3"],                  items scored max minus value
//   "subscales": [{
//     "id": "planning", "label": "Planning ahead",
//     "items": ["i1", "i2"], "method": "mean" | "sum",
//     "bands": [ { "upTo": 1.25, "band": "strength" },
//                { "upTo": 2.0,  "band": "typical" },
//                { "band": "focus" } ],
//     "strengthReason": "client facing sentence",
//     "focusReason": "client facing sentence",
//     "topic": { "label": "Planning", "url": "https://app.executiveframe.co.nz/hub/planning" }
//   }]
// }

export function scoreMeasure(measure, responses) {
  const rules = measure.scoringRules ?? {};
  const values = measure.responseOptions.map((o) => Number(o.value));
  const maxValue = Math.max(...values);
  const minAnswered = rules.minAnswered ?? 0.8;
  const reverse = new Set(rules.reverseItems ?? []);

  const itemValue = (itemId) => {
    const raw = responses?.[itemId];
    if (raw === undefined || raw === null || raw === '') return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || !values.includes(n)) return null;
    return reverse.has(itemId) ? maxValue - n : n;
  };

  const subscales = {};
  for (const sub of rules.subscales ?? []) {
    const answered = sub.items.map(itemValue).filter((v) => v !== null);
    const share = sub.items.length ? answered.length / sub.items.length : 0;
    if (share < minAnswered) {
      subscales[sub.id] = { label: sub.label, score: null, band: 'notScored', answered: answered.length, of: sub.items.length };
      continue;
    }
    const sum = answered.reduce((a, b) => a + b, 0);
    const score = sub.method === 'sum' ? sum : sum / answered.length;
    subscales[sub.id] = {
      label: sub.label,
      score: Math.round(score * 100) / 100,
      band: bandFor(sub.bands ?? [], score),
      answered: answered.length,
      of: sub.items.length,
    };
  }

  const answeredItems = measure.items.filter((item) => itemValue(item.id) !== null).length;
  return {
    measureId: measure.id,
    complete: answeredItems === measure.items.length,
    answeredItems,
    totalItems: measure.items.length,
    subscales,
  };
}

export function bandFor(bands, score) {
  for (const b of bands) {
    if (b.upTo === undefined || score <= b.upTo) return b.band;
  }
  return 'typical';
}

// Turns scores into the draft content: areas of strength and areas of focus
// with the reason for each and the matching Learning Hub topic. Sarah edits
// or approves this; releaseResults copies the approved version to the client.
export function buildDraft(measure, scores) {
  const strengths = [];
  const focus = [];
  for (const sub of measure.scoringRules?.subscales ?? []) {
    const s = scores.subscales[sub.id];
    if (!s) continue;
    if (s.band === 'strength') {
      strengths.push({ subscaleId: sub.id, label: sub.label, reason: sub.strengthReason ?? '' });
    } else if (s.band === 'focus') {
      focus.push({ subscaleId: sub.id, label: sub.label, reason: sub.focusReason ?? '', topic: sub.topic ?? null });
    }
  }
  const notScored = Object.values(scores.subscales).filter((s) => s.band === 'notScored').map((s) => s.label);
  return {
    measureId: measure.id,
    measureName: measure.name,
    status: 'draft',
    notADiagnosis: true,
    strengths,
    focus,
    notScored,
  };
}
