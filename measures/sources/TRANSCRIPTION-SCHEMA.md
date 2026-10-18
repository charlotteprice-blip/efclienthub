Write 1 JSON file per instrument to /tmp/novopsych/transcribed/<code-slug>.json with exactly this shape:
{
  "code": "PHQ-9",
  "name": "Patient Health Questionnaire 9",
  "domain": one of "Executive functioning and attention" | "Procrastination, time and habits" | "Work and motivation" | "Wellbeing and life satisfaction" | "Self talk, thinking patterns and personality" | "Clinical screening" | "Functioning and health",
  "developer": "Kroenke, Spitzer and Williams (2001)",
  "construct": "1 sentence",
  "respondent": "Self report",
  "ageRange": "18+",
  "minutes": 2,
  "availability": copy from the target record,
  "licence": "exact licence or permission statement, quoted",
  "licenceUrl": "...",
  "sourceUrl": "the page or PDF the items were transcribed from",
  "instructions": "the respondent instructions verbatim from the source",
  "responseOptions": [ { "value": 0, "label": "Not at all" }, ... ],
  "items": [ { "n": 1, "text": "verbatim item text", "subscale": "subscale name or Total", "reverse": false, "filler": false, "note": "" }, ... ],
  "subscales": [ { "name": "Total", "items": "1-9", "count": 9, "range": "0-27", "description": "" } ],
  "scoring": "method, direction (higher = ?), published cut offs or bands with their source",
  "citation": "APA 7 developer citation",
  "transcriptionNote": "anything uncertain: items you could not read, alternative wordings between sources, which source you used when 2 differed"
}
Rules: item text verbatim including original spelling (US spelling stays), one item per object, numbered as in the source. If a source gives the response scale per item differently, say so in transcriptionNote. If the items cannot be retrieved from any open access source reachable with WebFetch, write the file with "items": [] and explain in transcriptionNote. Never invent or reconstruct an item from memory.
