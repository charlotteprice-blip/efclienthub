# Questionnaire library

`ef-client-hub-codebook.xlsx` is the source of every questionnaire in the Client Hub. It is a copy of the Charlotte Price Consulting Psychometric Codebook (26 September 2026) with 2 sheets added at the front:

- Hub Library: 1 row per instrument. The hub id, the name clients see, whether it is included, its licence status for the hub, whether clients ever see strengths and areas of focus from it, which items Sarah is alerted to, and the instructions shown on screen.
- Hub Subscales: 1 row per subscale. The label clients see, the scoring direction, the method, optional band thresholds, the strength and focus wording clients read once released, and the Learning Hub topic each area of focus links to.

Item text, response options, reverse scoring and subscale membership are read from the codebook's own sheets and are never retyped.

A third sheet, NovoPsych Catalogue, lists all 150 assessments on novopsych.com (18 October 2026) with metadata only, a suggested hub relevance, and 2 columns to fill in: licence confirmed and decision. An instrument moves into the hub by being added to the codebook's own sheets (Instrument Summary, Master Item List, Structure and Subscales) and then to Hub Library and Hub Subscales; the catalogue is the shopping list, not a source of items.

A fourth sheet, Other open instruments, lists 153 free or open licence instruments found beyond NovoPsych (executive functioning, work, wellbeing, the open repositories and clinical practice in New Zealand), each with the licence statement as found, whether open access items exist, NZ use where known, a hub suggestion and a caution where digital use may need its own licence. Clinical screeners and any risk measure are Sarah only in the hub.

## Open licence instruments (18 October 2026)

50 instruments were transcribed from open access sources and merged into the codebook sheets, each with its own tab: 8 domains now, 70 instruments, 1,018 items (the BTQ and WFIRS-S are in the codebook but not built, see their Hub Library notes). Every item was transcribed word for word from the source named in References and then checked by an independent second pass; the verdict for each instrument is on its tab and in the References sheet. The transcriptions and the check reports are kept in `sources/transcribed/` and `sources/verified/` as provenance; the workbook is still the only input to `npm run codebook`. 3 transcriptions duplicated instruments already in the codebook (ASRS, PPS, IPS) and were used to confirm the existing items rather than merged. Held back for Sarah: IPIP-NEO-120, BFAS and the C-SSRS Screener.

An item whose answer scale differs from the rest of its questionnaire (AUDIT-C, CUDIT-R, CBI, PROMIS Global Health, GAD-7 item 8) carries its own options in the Master Item List Response Options column, and the hub shows and scores that item on its own scale.

## Workflow

```
npm run codebook                                   rebuild library.json and cleared.json from the workbook
npm run measures -- check measures/library.json    validate every included questionnaire
npm run measures -- upload measures/cleared.json   put the cleared ones in the hub
```

`library.json` holds every included instrument whatever its status; `cleared.json` holds only those marked cleared, and upload refuses anything else. The hub itself refuses to assign a questionnaire that is not cleared, so a status of review or permission keeps an instrument out of use until the licence is settled.

## Licence status

cleared: public domain, an explicit grant from the authors, or a Creative Commons licence. review: free to access but no explicit statement covering practice use; confirm with the authors before clearing. permission: the rights holder requires written permission for commercial use. excluded: left out.

The statuses in the workbook are Charlotte's reading of the sources in the codebook, to be confirmed with Sarah. Nothing moves to cleared by itself.

## Scoring conventions

Scoring direction difficulty means a higher score is more difficulty, so low scores become strengths and high scores areas of focus. positive is the reverse. none means the subscale is scored for Sarah only. Bands default to thirds of the response range on the item mean; set the 2 thresholds in the sheet to use published cut offs (DASS-21 uses the raw sums below which the doubled score is in the normal range).

Questionnaires marked "Client sees strengths and focus: No" (ASRS, DASS-21, PHQ-2, PHQ-9, GAD-7, CES-D, PSWQ, AUDIT-C, CAGE, CUDIT-R, DES-II, RAADS-14, CAPE-42) are screeners. Sarah sees their scores and flagged answers; nothing from them is ever released to the client, and release skips them.

Reverse scored items are reversed as minimum plus maximum minus the answer, so scales that start at 1 reverse correctly.
