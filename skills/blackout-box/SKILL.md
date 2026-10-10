---
name: blackout-box
description: Gives every food and medication in a home its own power-outage countdown (SAFE, USE_NOW, DISCARD, PAST_LIMIT, DO_NOT_USE, UNKNOWN) from the USDA / FoodSafety.gov power-outage chart and FDA label storage text from openFDA. Runs offline with no AI model, as a deterministic rules engine with a bundled USDA FoodKeeper table. Use when someone asks whether fridge or freezer food, baby formula, insulin, or another refrigerated medicine is still safe after a hurricane, blackout, or heat wave, or how long it has left.
license: MIT
compatibility: Requires Node 20+. No network, API key, or model needed. Medication rules need the label's storage text, which the caller looks up on openFDA.
metadata:
  author: blackout-box-team
  version: "0.1.0"
  event: "Hack for Humanity Miami 2026"
---

# Blackout Box: the 4-Hour Rule

Every number comes from a rules table with a citation, never from a model. The engine is
`scripts/engine.mjs`, built from `modules/four-hour-rule/src` in the Blackout Box repo; the app
imports the same code.

## 1. Collect the inputs

Ask for these, in this order. Do not guess any of them.

1. **When the power went out** (ISO time). Without it every food is DISCARD and every
   refrigerated medicine is UNKNOWN.
2. **Each item**: name as printed, `food` or `med`, where it is (`fridge`, `freezer`, `shelf`),
   whether it is opened. For medicines: days since opened (or since a liquid antibiotic was
   mixed) and whether it froze.
3. **Indoor temperature in °F.** Ask for a thermometer reading first. If there is none, pass
   the outdoor temperature with `estimated: true`; the engine estimates indoor heat and labels
   the result as an estimate.
4. **Each time the fridge door was opened**, and whether the freezer is full or half full.
5. **Medicines**: the label's storage text (openFDA `storage_and_handling`, or the "Store…"
   sentence of `how_supplied`). Pass the openFDA record or `{ "storageText": "…" }` as `label`.
   No text means UNKNOWN.

## 2. Run the engine

```bash
node scripts/assess.mjs assets/example-input.json     # or pipe the JSON on stdin
node scripts/assess.mjs --classify "queso fresco"      # food → FoodSafety.gov class
node scripts/assess.mjs --label openfda-record.json    # label text → Limit
```

Input: `{ "now"?: ISO, "outage": { "startedAt", "doorOpenedAt": [], "freezerFull" }, "env": { "indoorTempF"?, "outdoorTempF"?, "estimated", "hourly"? }, "items": [...] }`.
Output: a list of verdicts sorted by what dies first, each with `status`, `hoursLeft`,
`deadline`, `minutesLeft`, `reason`, `quote`, `source`, `url`, `reasons` (i18n keys) and
`assumptions` (our conservative choices that applied). From code:
`import { assess, classifyFood, limitForMed } from './scripts/engine.mjs'`.

## 3. Report the result

| Status | Meaning | Say |
| --- | --- | --- |
| SAFE | Inside the rule; may have a clock | Time left, the quote, the source |
| USE_NOW | Food: last 2 h of the fridge window (12 h freezer). Med: under 48 h left or heat forecast | Cook or eat now, or move to a cooler with ice. Med: plan a replacement |
| DISCARD | Food only. Time is up, or no outage time | Discard it. When in doubt, throw it out |
| PAST_LIMIT | Med only. Room above the label max, or label days used up | Keep it cool, get a replacement; if it sustains life (insulin) and there is no replacement, FDA says it may be used until a new supply |
| DO_NOT_USE | Med froze and its label says do not freeze | Do not use it; get a replacement now |
| UNKNOWN | Med with no label limit, or a missing input | Ask your pharmacist (or give the missing input) |

## Safety rules (must follow)

- Use the engine's status and numbers exactly. Never round differently or contradict them.
- Food that is DISCARD: say discard. Never say "probably fine", never suggest smelling or tasting it.
- Medicines: never say stop, skip, throw away, discard, or do not use unless the status is DO_NOT_USE.
- Never give dosing numbers or product-switching advice. Say "ask your pharmacist".
- Show the source sentence (`quote`) and where it came from (`source`, `url`) with every answer.
- Say when the indoor temperature is an estimate.
- End every answer with the fixed footer in the user's language:
  - EN: Food guidance from USDA and FoodSafety.gov. Medication information from FDA drug labeling. Not medical advice. When in doubt, throw food out. Ask your pharmacist about medicine. In an emergency, call 911.
  - ES: Guía de alimentos del USDA y FoodSafety.gov. Información de medicamentos del etiquetado de la FDA. No es consejo médico. Ante la duda, deseche la comida. Consulte a su farmacéutico sobre los medicamentos. En una emergencia, llame al 911.
  - HT: Konsèy sou manje soti nan USDA ak FoodSafety.gov. Enfòmasyon sou medikaman soti nan etikèt FDA a. Se pa konsèy medikal. Si ou pa sèten, jete manje a. Mande famasyen ou pou medikaman. Si se yon ijans, rele 911.

## Optional: reading items from a photo

Any vision model that returns the Item JSON (`id`, `name`, `category`, `location`, `opened`,
`brandText`, `confidence`) can feed this skill. The model only lists items; it never sets a
food class or a limit, and food below 0.5 confidence is treated as unknown (4-hour rule). The
Blackout Box app uses `anthropic/claude-sonnet-5.5` for vision and `anthropic/claude-fable-5.1`
for explanations, through Cloudflare AI Gateway. The skill itself needs neither.

## Details

See [references/rules.md](references/rules.md) for the full rules table, constants, and sources.
