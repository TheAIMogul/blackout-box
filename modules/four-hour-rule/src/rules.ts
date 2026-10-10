import type { FoodClass } from './types'

// Clock constants from the brief's build-spec. FoodSafety.gov numbers: 4 h fridge,
// last 2 h as USE NOW ("40°F or above for more than 2 hours"), 48 h full / 24 h half freezer,
// mayo 8 h above 50°F, frozen vegetables 6 h above 40°F. Our own conservative choices:
// door penalty, freezer USE NOW band, the 0.9 medication margin and the 48 h med USE NOW band.
export const FRIDGE_H = 4
export const FRIDGE_USE_NOW_H = 2
export const FREEZER_FULL_H = 48
export const FREEZER_HALF_H = 24
export const FREEZER_USE_NOW_H = 12 // ours
export const DOOR_OPEN_PENALTY_H = 0.5 // ours: each "I opened the fridge" tap
export const DOOR_OPEN_CAP_H = 2 // ours
export const MAYO_AFTER_WARM_H = 8
export const FROZEN_VEG_AFTER_WARM_H = 6
export const MED_SAFETY_MARGIN = 0.9 // ours (Cold Chain brief)
export const MED_USE_NOW_H = 48 // ours (Cold Chain brief USE_SOON_HOURS)
export const LOW_CONFIDENCE = 0.5

export const FOODSAFETY_URL = 'https://www.foodsafety.gov/food-safety-charts/food-safety-during-power-outage'
export const FOODSAFETY_SOURCE = 'FoodSafety.gov (USDA), Food Safety During Power Outage, reviewed Aug 8, 2024'
export const OPENFDA_URL = 'https://api.fda.gov/drug/label.json'
export const FDA_DISASTER_URL = 'https://www.fda.gov/drugs/emergency-preparedness-drugs/safe-drug-use-after-natural-disaster'

// Verbatim FoodSafety.gov sentences (captured 2026-10-10 in a browser; the host 403s curl).
export const QUOTES = {
  fridge:
    'Discard refrigerated perishable food such as meat, poultry, fish, eggs, and leftovers after 4 hours without power.',
  fridgeHeadline:
    'your refrigerator will keep food safe for up to 4 hours during a power outage. Keep the door closed as much as possible.',
  chartColumn: 'Exposed to temperatures of 40°F (4°C) or above for more than 2 hours',
  freezer:
    'A full freezer will hold a safe temperature for approximately 48 hours (24 hours if it is half full and the door remains closed).',
  refreeze:
    'Food may be safely refrozen if it still contains ice crystals or is at 40°F (4°C) or below, however, its quality may suffer.',
  mayo: 'Opened mayonnaise, tartar sauce, horseradish (if above 50°F (10°C) for more than 8 hrs)',
  frozenVeg: 'Discard after held above 40°F (4°C) for 6 hours',
  doubt: 'When in Doubt, Throw it Out!',
  neverTaste: 'After a power outage never taste food to determine its safety.',
} as const

export type FoodRuleRow = {
  name: string
  class: FoodClass
  verdict: 'Keep' | 'Discard' | 'Refreeze' | 'No clock'
  hours: number | null // allowance from outage start before door penalty; null = no clock
  useNowHours: number | null
  quote: string
  verbatim: boolean // false = trimmed summary from the brief, not a verbatim chart row
  url: string
}

const keep = (name: string): FoodRuleRow => ({
  name, class: 'keep', verdict: 'Keep', hours: null, useNowHours: null, quote: name, verbatim: true, url: FOODSAFETY_URL,
})
const discard = (name: string): FoodRuleRow => ({
  name, class: 'discard_4h', verdict: 'Discard', hours: FRIDGE_H, useNowHours: FRIDGE_USE_NOW_H, quote: name, verbatim: true, url: FOODSAFETY_URL,
})

export const FOOD_RULES: FoodRuleRow[] = [
  // Refrigerated chart, "Keep" column
  keep('Hard cheeses (Cheddar, Colby, Swiss, Parmesan, provolone, Romano)'),
  keep('Processed cheeses'),
  keep('Grated Parmesan/Romano (can or jar)'),
  keep('Butter, margarine'),
  keep('Fresh fruits, uncut'),
  keep('Fruit juices, opened'),
  keep('Canned fruits, opened'),
  keep('Dried fruits'),
  keep('Peanut butter'),
  keep('Jelly, relish, taco sauce, mustard, catsup, olives, pickles'),
  keep('Worcestershire, soy, barbecue, hoisin sauces'),
  keep('Opened vinegar-based dressings'),
  keep('Bread, rolls, cakes, muffins, quick breads, tortillas'),
  keep('Breakfast foods: waffles, pancakes, bagels'),
  keep('Fruit pies'),
  keep('Fresh vegetables, uncut'),
  keep('Fresh mushrooms, herbs, spices'),
  // Refrigerated chart, "Discard" column
  discard('Raw or leftover cooked meat, poultry, fish, seafood, soy meat substitutes'),
  discard('Thawing meat or poultry'),
  discard('Meat/tuna/shrimp/chicken/egg salads'),
  discard('Gravy, stuffing, broth'),
  discard('Lunchmeats, hot dogs, bacon, sausage, dried beef'),
  discard('Pizza with any topping'),
  discard('Canned hams "Keep Refrigerated"'),
  discard('Canned meats and fish, opened'),
  discard('Casseroles, soups, stews'),
  discard('Soft cheeses (blue, Brie, Camembert, cottage, cream, Edam, Monterey Jack, ricotta, mozzarella, Muenster, Neufchatel, queso blanco, queso fresco)'),
  discard('Shredded cheeses'),
  discard('Low-fat cheeses'),
  discard('Milk, cream, sour cream, buttermilk, evaporated milk, yogurt, eggnog, soy milk'),
  discard('Baby formula, opened'),
  discard('Fresh shell eggs, hard-cooked eggs, egg dishes, egg products'),
  discard('Custards, puddings, quiche'),
  discard('Fresh fruits, cut'),
  discard('Sliced or shredded coconut'),
  {
    name: 'Opened mayonnaise, tartar sauce, horseradish', class: 'mayo_8h_50f', verdict: 'Discard',
    hours: FRIDGE_H + MAYO_AFTER_WARM_H, useNowHours: FRIDGE_USE_NOW_H, quote: QUOTES.mayo, verbatim: true, url: FOODSAFETY_URL,
  },
  discard('Fish sauces, oyster sauce'),
  discard('Opened creamy-based dressings'),
  discard('Spaghetti sauce, opened'),
  discard('Refrigerator biscuits, rolls, cookie dough'),
  discard('Cooked pasta, rice, potatoes'),
  discard('Pasta salads'),
  discard('Fresh pasta'),
  discard('Cheesecake'),
  discard('Cream filled pastries'),
  discard('Pies with egg/milk filling'),
  discard('Fresh vegetables, cut'),
  discard('Greens pre-cut/pre-washed'),
  discard('Vegetables, cooked'),
  discard('Tofu, cooked'),
  discard('Vegetable juice, opened'),
  discard('Baked potatoes'),
  discard('Commercial garlic in oil'),
  discard('Potato salad'),
  // Frozen chart (hours shown for a full freezer; half freezer is 24 h)
  {
    name: 'Ice cream, frozen yogurt', class: 'frozen_discard', verdict: 'Discard',
    hours: FREEZER_FULL_H, useNowHours: FREEZER_USE_NOW_H, quote: 'Ice cream/frozen yogurt: Discard even with ice crystals', verbatim: false, url: FOODSAFETY_URL,
  },
  {
    name: 'Frozen vegetables', class: 'frozen_veg_6h', verdict: 'Discard',
    hours: FREEZER_FULL_H + FROZEN_VEG_AFTER_WARM_H, useNowHours: FREEZER_USE_NOW_H, quote: QUOTES.frozenVeg, verbatim: true, url: FOODSAFETY_URL,
  },
  {
    name: 'Frozen meat, poultry, seafood, stews, milk, eggs, cheeses, juices, breads, flour, casseroles, frozen meals', class: 'frozen_refreeze', verdict: 'Refreeze',
    hours: FREEZER_FULL_H, useNowHours: FREEZER_USE_NOW_H, quote: QUOTES.refreeze, verbatim: false, url: FOODSAFETY_URL,
  },
  {
    name: 'Hard cheeses; flour, cornmeal, nuts; breads (frozen)', class: 'frozen_refreeze', verdict: 'Refreeze',
    hours: FREEZER_FULL_H, useNowHours: FREEZER_USE_NOW_H, quote: 'Refreeze', verbatim: false, url: FOODSAFETY_URL,
  },
  // Not on the refrigerated chart
  {
    name: 'Shelf-stable food (canned, dry goods, unopened shelf-stable formula, water)', class: 'shelf_stable', verdict: 'No clock',
    hours: null, useNowHours: null, quote: 'Not on the FoodSafety.gov refrigerated chart', verbatim: false, url: FOODSAFETY_URL,
  },
]
