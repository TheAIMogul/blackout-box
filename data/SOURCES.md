# Data sources

| File | Source | License | How it got here |
| --- | --- | --- | --- |
| `foodkeeper.json` | USDA FSIS FoodKeeper, English JSON: https://www.fsis.usda.gov/shared/data/EN/foodkeeper.json. Catalog: https://catalog.data.gov/dataset/fsis-foodkeeper-data | CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/), stated in the catalog page's JSON-LD | `FMA-Data-v128.xlsx`, data version 128, modified 09-06-2018 (old). fsis.usda.gov returned HTTP 403 to curl on Oct 10, 2026, including with a browser User-Agent, so the file was opened in a browser tab the same day and its text saved unchanged: 631,732 characters, valid JSON, 6 sheets, 661 products. Not byte-compared against the server copy. |
| `food-rules.json` | FoodSafety.gov, Food Safety During Power Outage: https://www.foodsafety.gov/food-safety-charts/food-safety-during-power-outage ("Date Last Reviewed August 8, 2024"). FoodSafety.gov attributes the 4-hour line to USDA's Keeping Food Safe During an Emergency. | U.S. federal government content (HHS site). I did not find or check a separate license statement on the page. | Chart rows typed from a browser capture on Oct 10, 2026 (the host returns HTTP 403 to curl). Generated from `modules/four-hour-rule/src/rules.ts` by `npm run build:data`; a test checks the JSON matches the engine. Rows marked `verbatim: false` are trimmed summaries, not chart text. |

Medication rules are not bundled as data: the engine parses label text at run time from

- openFDA Drug Label API, https://api.fda.gov/drug/label.json. Terms (https://open.fda.gov/terms/): openFDA content "is public domain and made available with a Creative Commons CC0 1.0 Universal dedication", unless otherwise noted. openFDA responses carry a disclaimer not to rely on openFDA for medical-care decisions; show it.
- FDA, Safe Drug Use After a Natural Disaster: https://www.fda.gov/drugs/emergency-preparedness-drugs/safe-drug-use-after-natural-disaster (content current as of 09/01/2026).
- FDA, Information Regarding Insulin Storage and Switching Between Products in an Emergency: https://www.fda.gov/drugs/emergency-preparedness-drugs/information-regarding-insulin-storage-and-switching-between-products-emergency.

Our own conservative numbers (door penalty, freezer USE NOW band, 90% medication margin, indoor
heat estimate) are not from any source above; they are listed in `skills/blackout-box/references/rules.md`.

Regenerate the derived files after editing rules or replacing `foodkeeper.json`:
`cd modules/four-hour-rule && npm run build:data && npm run build:skill`.
