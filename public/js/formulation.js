// Formulation helpers shared by the browser and the Cloud Functions
// (copied into functions/shared by scripts/sync-functions.mjs).

// Suggestions for the formulation from released results: each area of focus
// becomes a candidate perpetuating factor and each strength a candidate
// protective factor, skipping any already placed on the draft.
export function suggestFactors(results, factors = []) {
  const placed = new Set(factors.filter((f) => f.source).map((f) => `${f.source.assignmentId}:${f.source.subscaleId}`));
  const out = [];
  for (const item of results?.items ?? []) {
    for (const [kind, list, zone] of [['focus', item.focus ?? [], 'perpetuating'], ['strength', item.strengths ?? [], 'protective']]) {
      for (const x of list) {
        if (placed.has(`${item.assignmentId}:${x.subscaleId}`)) continue;
        out.push({ zone, text: x.label, kind, source: { assignmentId: item.assignmentId, measureName: item.measureName, subscaleId: x.subscaleId, kind } });
      }
    }
  }
  return out;
}
