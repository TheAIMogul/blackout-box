// Hand-copied, cited static content (no runtime fetch). Wording from specs/blackout-box-brief.html Part B and
// reports/four-hour-rule-research/foodsafety_gov_power_outage_verbatim.txt (captured 10:55 ET Oct 10 2026).
export const STATUTE = {
  number: 'F.S. 252.358',
  url: 'https://www.flsenate.gov/Laws/Statutes/2025/252.358',
  summary:
    'Florida early-refill law: during a hurricane warning, a Governor-declared state of emergency, or an activated county emergency operations center, insurers must waive "refill too soon" limits and cover at least a 30-day supply of a prescription that still has refills. It likely applies during a declared emergency; ask your pharmacy.',
};

export const FDA_EMERGENCY_INSULIN = {
  url: 'https://www.fda.gov/drugs/emergency-preparedness-drugs/information-regarding-insulin-storage-and-switching-between-products-emergency',
  summary:
    'FDA: in an emergency, insulin kept between 59°F and 86°F (15°C to 30°C) can be used for up to 28 days. Above 86°F it may still need to be used if there is no replacement. Never use insulin that has been frozen. Replace it when proper storage is available. No dosing changes without your doctor or pharmacist.',
  safeDrugUseUrl: 'https://www.fda.gov/drugs/emergency-preparedness-drugs/safe-drug-use-after-natural-disaster',
};

export const FOOD_RULES = {
  url: 'https://www.foodsafety.gov/food-safety-charts/food-safety-during-power-outage',
  usdaUrl: 'https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/emergencies/keep-your-food-safe-during-emergencies',
  reviewed: '2024-08-08',
  headline:
    'Your refrigerator will keep food safe for up to 4 hours during a power outage. Keep the door closed as much as possible. Discard refrigerated perishable food such as meat, poultry, fish, eggs, and leftovers after 4 hours without power.',
  freezer:
    'A full freezer will hold a safe temperature for approximately 48 hours (24 hours if it is half full and the door remains closed).',
  doubt: 'After a power outage never taste food to determine its safety. When in Doubt, Throw it Out!',
  rule: { fridgeHours: 4, maxSafeF: 40, freezerFullHours: 48, freezerHalfHours: 24 },
};

export const FEMA_REGISTER = { text: 'Register for FEMA help at DisasterAssistance.gov or 1-800-621-3362.', url: 'https://www.disasterassistance.gov' };
