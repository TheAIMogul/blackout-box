# Blackout Box rules

Engine source: `modules/four-hour-rule/src` (bundled into `scripts/engine.mjs`). Full chart rows
with quotes: `data/food-rules.json` in the repo. Hours run from the moment the power went out.

## Food: FoodSafety.gov power-outage chart

Source: https://www.foodsafety.gov/food-safety-charts/food-safety-during-power-outage (reviewed
Aug 8, 2024; captured Oct 10, 2026 in a browser because the host returns HTTP 403 to curl).

> "your refrigerator will keep food safe for up to 4 hours during a power outage. Keep the door
> closed as much as possible. Discard refrigerated perishable food such as meat, poultry, fish,
> eggs, and leftovers after 4 hours without power."

| Class | Chart rows (trimmed) | Clock | Status |
| --- | --- | --- | --- |
| `discard_4h` | Meat, poultry, fish, seafood, lunchmeat, hot dogs, pizza, soups, soft and shredded cheese, milk, cream, yogurt, opened baby formula, eggs, custard, cut fruit and vegetables, cooked pasta/rice/potatoes, opened creamy dressing, spaghetti sauce, tofu, garlic in oil, potato salad | 4 h | USE_NOW in the last 2 h ("40°F (4°C) or above for more than 2 hours"), then DISCARD |
| `keep` | Hard cheese (cheddar, Swiss, Parmesan…), processed cheese, butter, margarine, uncut fruit and vegetables, opened fruit juice, peanut butter, jelly, mustard, catsup, pickles, soy/BBQ/hoisin sauce, vinegar dressings, bread, tortillas, fruit pies | none | SAFE |
| `mayo_8h_50f` | "Opened mayonnaise, tartar sauce, horseradish (if above 50°F (10°C) for more than 8 hrs)" | 4 h + 8 h | USE_NOW last 2 h |
| `frozen_refreeze` | Frozen meat, poultry, seafood, casseroles, breads; refreeze while ice crystals remain | 48 h full / 24 h half freezer | USE_NOW last 12 h |
| `frozen_discard` | Ice cream, frozen yogurt (discard once thawed) | 48 h / 24 h | USE_NOW last 12 h |
| `frozen_veg_6h` | Frozen vegetables: "Discard after held above 40°F (4°C) for 6 hours" | freezer window + 6 h | USE_NOW last 12 h |
| `shelf_stable` | Not on the chart: canned (unopened), dry goods, water, formula powder | none | SAFE |
| `unknown` | No keyword or FoodKeeper match, or vision confidence < 0.5 | same as `discard_4h` | "When in Doubt, Throw it Out!" |

Freezer: "A full freezer will hold a safe temperature for approximately 48 hours (24 hours if it
is half full and the door remains closed)."

Classification: our keyword lists (English, Spanish, Kreyòl) map names onto the chart rows; if
none match, the USDA FoodKeeper category gives a hint (FoodKeeper v128, CC0, 661 products,
https://catalog.data.gov/dataset/fsis-foodkeeper-data). FoodKeeper is a shelf-life table with no
outage fields; it supplies the card subtitle and that hint only.

## Medicines: FDA label text (openFDA)

Source: https://api.fda.gov/drug/label.json, field `storage_and_handling`, else the "Store…"
sentence of `how_supplied`. openFDA says not to rely on it for medical decisions.

| Label says | Parsed as | Clock |
| --- | --- | --- |
| Refrigerate; room temperature "up to 86°F" for "28 days" (Lantus, Humalog, Basaglar) | `days_at_room_temp`, days 28, max 86°F | 28 × 24 × 0.9 − hours since outage |
| "for a total of 14 days" / "10 days" (Trulicity, Humalog Mix KwikPen) | days 14 / 10 (shortest when one label lists several devices) | same |
| Opened / in-use days | `inUseDays` | also inUseDays × 24 × 0.9 − days opened × 24; the shorter wins |
| "Discard suspension after 14 days", refrigeration not required (amoxicillin) | in-use clock only, no heat max | 14 × 24 × 0.9 − days since mixed × 24, plus "ask your pharmacist" (heat may shorten it) |
| "Store reconstituted suspension under refrigeration. Discard … after 10 days." | refrigerated, in-use 10 d | same, plus "refrigeration required, ask your pharmacist" |
| Room-temperature drug, "excursions permitted … 86°F" (metformin) | `none`, max 86°F | no clock; SAFE unless the room is above the max |
| Nothing parseable | `null` | UNKNOWN: ask your pharmacist |

Statuses: room above the label max → PAST_LIMIT (never DISCARD). Allowance used up → PAST_LIMIT.
Under 48 h left, or the forecast passes the max sooner → USE_NOW. Frozen and the label says do not
freeze → DO_NOT_USE. FDA, Safe Drug Use After a Natural Disaster
(https://www.fda.gov/drugs/emergency-preparedness-drugs/safe-drug-use-after-natural-disaster):
"If the medicine is needed to sustain life (for example, insulin) and a replacement is not
readily available, it may be used until you can get a new supply."

## Our conservative choices (not USDA or FDA numbers)

| Constant | Value | Why |
| --- | --- | --- |
| Door penalty | 0.5 h per "I opened the fridge" tap, cap 2 h; fridge taps also count for the freezer unless freezer taps are tracked | Opening the door warms the box |
| Freezer USE NOW band | last 12 h | Time to cook or add ice |
| Mayo / frozen-vegetable warm start | the 8 h / 6 h counters start when the 4 h fridge / freezer window ends | When the box likely passes 50°F / 40°F |
| Medicine margin | 90% of the label allowance | Labels assume steady storage |
| Every outage hour | counts as room-temperature time for refrigerated medicine | The fridge warms from the first hour |
| Indoor estimate | under 4 h: max(78, outdoor − 4); after: max(80, outdoor, next 6 hourly °F) | Heuristic from the Cold Chain brief, not validated; always labeled "estimate" |

## Sort order

DO_NOT_USE, DISCARD and PAST_LIMIT first, then USE_NOW and SAFE by hours left, SAFE with no clock,
UNKNOWN last.
