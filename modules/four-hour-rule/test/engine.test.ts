import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import {
  assess, classifyFood, estimateIndoorF, limitForMed, lookupFoodKeeper,
  type Env, type Item, type Limit, type Outage, type Verdict,
} from '../src/index'
import { foodRulesDoc } from '../scripts/build-food-rules'
import { LABELS } from './labels'

const NOW = new Date('2026-10-10T16:00:00Z') // noon ET
const ago = (h: number) => new Date(NOW.getTime() - h * 36e5).toISOString()
const outage = (h: number, extra: Partial<Outage> = {}): Outage => ({ startedAt: ago(h), doorOpenedAt: [], freezerFull: true, ...extra })
const env = (indoorTempF?: number, extra: Partial<Env> = {}): Env => ({ indoorTempF, estimated: false, ...extra })
const one = (item: Item, o: Outage, e: Env = env(84)): Verdict => assess([item], o, e, NOW)[0]
const near = (a: number | null | undefined, b: number) => assert.ok(a != null && Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`)

const milk: Item = { id: 'f1', name: '2% milk', category: 'food', foodClass: 'discard_4h' }
const cheddar: Item = { id: 'f2', name: 'cheddar', category: 'food', foodClass: 'keep' }
const frozenChicken: Item = { id: 'f3', name: 'frozen chicken', category: 'food', foodClass: 'frozen_refreeze', location: 'freezer' }
const iceCream: Item = { id: 'f4', name: 'ice cream', category: 'food', foodClass: 'frozen_discard', location: 'freezer' }
const med = (id: string, name: string, limit: Limit | null, extra: Partial<Item> = {}): Item => ({ id, name, category: 'med', limit, ...extra })
const lantusLimit = limitForMed(LABELS.lantus)
const humalogLimit = limitForMed(LABELS.humalog)
const hikmaLimit = limitForMed(LABELS.amoxicillinHikma)

describe('brief test cases (four-hour-rule-brief Part B)', () => {
  test('1. milk, outage 1 h, no opens → SAFE, 3 h left', () => {
    const v = one(milk, outage(1))
    assert.equal(v.status, 'SAFE')
    near(v.hoursLeft, 3)
    assert.equal(v.minutesLeft, 180)
    assert.equal(v.clock, 'fridge_4h')
  })

  test('2. milk, outage 2.5 h → USE_NOW, 1.5 h left', () => {
    const v = one(milk, outage(2.5))
    assert.equal(v.status, 'USE_NOW')
    near(v.hoursLeft, 1.5)
    assert.equal(v.minutesLeft, 90)
    assert.equal(v.deadline, new Date(NOW.getTime() + 1.5 * 36e5).toISOString())
  })

  test('3. milk, outage 3 h, 3 door opens → DISCARD (4 − 1.5 = 2.5 < 3), door_open_penalty', () => {
    const v = one(milk, outage(3, { doorOpenedAt: [ago(2.5), ago(2), ago(1)] }))
    assert.equal(v.status, 'DISCARD')
    near(v.allowanceHours, 2.5)
    assert.equal(v.hoursLeft, 0)
    assert.ok(v.assumptions.includes('door_open_penalty'))
  })

  test('4. cheddar (keep), outage 30 h → SAFE, no clock, limit kind none', () => {
    const v = one(cheddar, outage(30))
    assert.equal(v.status, 'SAFE')
    assert.equal(v.hoursLeft, null)
    assert.equal(v.clock, 'none')
    assert.equal(v.deadline, undefined)
    assert.equal(v.minutesLeft, undefined)
  })

  test('5. frozen chicken, full freezer, 30 h → SAFE 18 h; half freezer → DISCARD', () => {
    const full = one(frozenChicken, outage(30, { freezerFull: true }))
    assert.equal(full.status, 'SAFE')
    near(full.hoursLeft, 18)
    assert.ok(full.reasons.includes('check_ice_crystals_refreeze_ok'))
    const half = one(frozenChicken, outage(30, { freezerFull: false }))
    assert.equal(half.status, 'DISCARD')
  })

  test('6. ice cream, full freezer, 40 h → USE_NOW, 8 h left', () => {
    const v = one(iceCream, outage(40))
    assert.equal(v.status, 'USE_NOW')
    near(v.hoursLeft, 8)
    assert.ok(v.reasons.includes('ice_cream_discard_if_thawed'))
  })

  test('7. unknown "sauce?" at confidence 0.3 → treated as discard_4h, unknown_item_discard', () => {
    const v = one({ id: 'f5', name: 'sauce?', category: 'food', confidence: 0.3 }, outage(1))
    assert.equal(v.foodClass, 'unknown')
    assert.equal(v.clock, 'fridge_4h')
    near(v.hoursLeft, 3)
    assert.ok(v.assumptions.includes('unknown_item_discard'))
  })

  test('8. no outage start → every food DISCARD (no_outage_start), every med UNKNOWN', () => {
    const vs = assess([milk, cheddar, med('m1', 'Lantus', lantusLimit)], { startedAt: '' }, env(84), NOW)
    for (const v of vs.filter((x) => x.itemId.startsWith('f'))) {
      assert.equal(v.status, 'DISCARD')
      assert.ok(v.reasons.includes('no_outage_start'))
    }
    assert.equal(vs.find((x) => x.itemId === 'm1')?.status, 'UNKNOWN')
  })

  test('9. Lantus unopened, outage 30 h, indoor 84°F → SAFE, 574.8 h (28 × 24 × 0.9 − 30)', () => {
    const v = one(med('m1', 'Lantus SoloStar', lantusLimit), outage(30), env(84))
    assert.equal(v.status, 'SAFE')
    near(v.hoursLeft, 574.8)
    assert.ok(v.assumptions.includes('safety_margin_0_9'))
  })

  test('10. Lantus at 91°F → PAST_LIMIT, label_max_temp, never DISCARD', () => {
    const v = one(med('m1', 'Lantus SoloStar', lantusLimit), outage(30), env(91))
    assert.equal(v.status, 'PAST_LIMIT')
    assert.equal(v.clock, 'label_max_temp')
    assert.ok(v.reasons.includes('temp_above_label_max'))
    assert.doesNotMatch(v.reason, /discard|throw|do not use|stop taking/i)
  })

  test('11. amoxicillin suspension mixed 10 d ago at 84°F → SAFE 62.4 h; 12 d → USE_NOW; 13 d → PAST_LIMIT', () => {
    const v10 = one(med('m2', 'amoxicillin suspension', hikmaLimit, { openedDaysAgo: 10 }), outage(30), env(84))
    assert.equal(v10.status, 'SAFE')
    near(v10.hoursLeft, 62.4)
    assert.ok(v10.reasons.includes('no_heat_limit_on_label'))
    const v12 = one(med('m2', 'amoxicillin suspension', hikmaLimit, { openedDaysAgo: 12 }), outage(30), env(84))
    assert.equal(v12.status, 'USE_NOW')
    near(v12.hoursLeft, 14.4)
    // The brief lists "mixed 13 d ago → USE_NOW", but its own formula gives 14×24×0.9 − 312 = −9.6 h.
    const v13 = one(med('m2', 'amoxicillin suspension', hikmaLimit, { openedDaysAgo: 13 }), outage(30), env(84))
    assert.equal(v13.status, 'PAST_LIMIT')
    assert.ok(v13.reasons.includes('in_use_days_used_up'))
  })

  test('12. Humalog frozen → DO_NOT_USE', () => {
    const v = one(med('m3', 'Humalog KwikPen', humalogLimit, { frozen: true }), outage(30), env(84))
    assert.equal(v.status, 'DO_NOT_USE')
  })

  test('13. sort: DISCARD/PAST_LIMIT first, then ascending hours, SAFE no-clock, UNKNOWN last', () => {
    const vs = assess(
      [
        cheddar,
        med('m9', 'mystery drops', null),
        { ...frozenChicken, id: 'f3' },
        { ...milk, id: 'fA' },
        med('m1', 'Lantus', lantusLimit),
        { id: 'fB', name: 'eggs', category: 'food', foodClass: 'discard_4h' },
      ],
      outage(5),
      env(91),
      NOW,
    )
    // milk, Lantus (91°F), eggs at 0 h (input order kept); frozen chicken SAFE 43 h; cheddar SAFE no clock; unknown drops
    assert.deepEqual(vs.map((v) => `${v.itemId}:${v.status}`), ['fA:DISCARD', 'm1:PAST_LIMIT', 'fB:DISCARD', 'f3:SAFE', 'f2:SAFE', 'm9:UNKNOWN'])
    near(vs[3].hoursLeft, 43)
    assert.equal(vs[4].hoursLeft, null)
  })
})

describe('medication label parsing (real openFDA text)', () => {
  test('Lantus: refrigerated, 28 days, up to 86°F, do not freeze', () => {
    assert.ok(lantusLimit)
    assert.equal(lantusLimit.kind, 'days_at_room_temp')
    assert.equal(lantusLimit.days, 28)
    assert.equal(lantusLimit.maxTempF, 86)
    assert.equal(lantusLimit.storage, 'refrigerated')
    assert.equal(lantusLimit.doNotFreeze, true)
    assert.equal(lantusLimit.ref, 'd5e07a0c-7e14-4756-9152-9fea485d654a')
    assert.match(lantusLimit.quote ?? '', /28 days/)
    assert.match(lantusLimit.quote ?? '', /86°F/)
  })

  test('Humalog U-100: 28 days, not the 7-day pump rule or the 98.6°F pump limit', () => {
    assert.equal(humalogLimit?.days, 28)
    assert.equal(humalogLimit?.maxTempF, 86)
  })

  test('Humalog Mix75/25: one label, vial 28 d and KwikPen 10 d → shortest (10)', () => {
    assert.equal(limitForMed(LABELS.humalogMix7525)?.days, 10)
  })

  test('Trulicity: 14 days, not to exceed 86°F; 30 h at 84°F → 272.4 h', () => {
    const lim = limitForMed(LABELS.trulicity)
    assert.equal(lim?.days, 14)
    assert.equal(lim?.maxTempF, 86)
    near(one(med('m4', 'Trulicity', lim), outage(30), env(84)).hoursLeft, 272.4)
  })

  test('Humalog opened 20 d ago, 30 h at 84°F → min(574.8, 124.8) = 124.8 h (Cold Chain example)', () => {
    const v = one(med('m3', 'Humalog', humalogLimit, { openedDaysAgo: 20 }), outage(30), env(84))
    near(v.hoursLeft, 124.8)
    assert.equal(v.clock, 'label_in_use_days')
  })

  test('metformin-containing label: room temp, excursions to 86°F → SAFE at 84°F, PAST_LIMIT at 91°F', () => {
    const lim = limitForMed(LABELS.metformin)
    assert.equal(lim?.storage, 'room_temp')
    assert.equal(lim?.maxTempF, 86)
    assert.equal(lim?.days, undefined)
    const ok = one(med('m5', 'metformin', lim), outage(30), env(84))
    assert.equal(ok.status, 'SAFE')
    assert.equal(ok.hoursLeft, null)
    assert.equal(one(med('m5', 'metformin', lim), outage(30), env(91)).status, 'PAST_LIMIT')
  })

  test('Hikma suspension: 14 days after mixing, refrigeration not required, no heat max invented', () => {
    assert.equal(hikmaLimit?.inUseDays, 14)
    assert.equal(hikmaLimit?.storage, 'room_temp')
    assert.equal(hikmaLimit?.maxTempF, undefined)
  })

  test('Chartwell amox-clav: refrigerated suspension, 10 days → in-use clock + ask pharmacist', () => {
    const lim = limitForMed(LABELS.amoxClavChartwell)
    assert.equal(lim?.inUseDays, 10)
    assert.equal(lim?.storage, 'refrigerated')
    const v = one(med('m6', 'amox-clav', lim, { openedDaysAgo: 2 }), outage(30), env(84))
    near(v.hoursLeft, 10 * 24 * 0.9 - 48)
    assert.ok(v.reasons.includes('refrigeration_required_ask_pharmacist'))
  })

  test('repackager label with no storage text → null → UNKNOWN (ask pharmacist)', () => {
    assert.equal(limitForMed(LABELS.humalogRepackager), null)
    const v = one(med('m7', 'Humalog KwikPen', null), outage(30), env(84))
    assert.equal(v.status, 'UNKNOWN')
    assert.ok(v.reasons.includes('ask_pharmacist'))
  })

  test('every number in a parsed limit appears in its verbatim quote', () => {
    for (const [name, label] of Object.entries(LABELS)) {
      const lim = limitForMed(label)
      if (!lim) continue
      for (const n of [lim.days, lim.maxTempF, lim.inUseDays]) {
        if (n != null) assert.ok((lim.quote ?? '').includes(String(n)), `${name}: ${n} not in quote`)
      }
    }
  })
})

describe('environment, forecast, door taps, other food classes', () => {
  test('indoor estimate heuristic: < 4 h → max(78, outdoor − 4); ≥ 4 h → max(80, outdoor, next 6 h)', () => {
    assert.equal(estimateIndoorF(88, [], 2), 84)
    assert.equal(estimateIndoorF(70, [], 2), 78)
    assert.equal(estimateIndoorF(84, [86, 87, 90, 85, 84, 83, 99], 30), 90)
  })

  test('estimated indoor temp is labeled and drives the insulin verdict', () => {
    const hourly = [1, 2, 3, 4, 5, 6].map((h) => ({ t: new Date(NOW.getTime() + h * 36e5).toISOString(), tempF: 87 }))
    const v = one(med('m1', 'Lantus', lantusLimit), outage(30), { estimated: true, outdoorTempF: 85, hourly })
    assert.equal(v.status, 'PAST_LIMIT')
    assert.equal(v.indoorTempF, 87)
    assert.equal(v.indoorEstimated, true)
    assert.ok(v.assumptions.includes('indoor_estimate'))
  })

  test('outdoor forecast just above the label max does not zero the clock early in an outage', () => {
    // Miami 2026-10-10: 89.6 °F outside, 0.6 h after the outage. Indoor estimate is 85.6 °F (< 86), so the
    // forecast must cross the label max only when the heuristic says the room passes it (at 4 h), not now.
    const hourly = [0, 1, 2, 3, 4, 5, 6].map((h) => ({ t: new Date(NOW.getTime() + h * 36e5).toISOString(), tempF: 89.6 }))
    const v = one(med('m1', 'Lantus', lantusLimit), outage(0.6), { estimated: true, outdoorTempF: 89.6, hourly })
    assert.notEqual(v.status, 'PAST_LIMIT')
    assert.ok(v.hoursLeft != null && v.hoursLeft >= 3 && v.hoursLeft <= 4.5, `hourly forecast, hoursLeft ${v.hoursLeft}`)
    assert.equal(v.clock, 'label_max_temp')
  })

  test('forecast crossing the label max within the clock → USE_NOW with crossAt', () => {
    const forecastIndoorF = [{ t: new Date(NOW.getTime() + 3 * 36e5).toISOString(), tempF: 88 }]
    const v = one(med('m1', 'Lantus', lantusLimit), outage(30), env(84, { forecastIndoorF }))
    assert.equal(v.status, 'USE_NOW')
    near(v.hoursLeft, 3)
    assert.equal(v.crossAt, forecastIndoorF[0].t)
    assert.ok(v.reasons.includes('heat_forecast_crosses_label_max'))
  })

  test('fridge door taps also shorten the freezer clock unless freezer taps are tracked', () => {
    const shared = one(frozenChicken, outage(30, { doorOpenedAt: [ago(20), ago(10)] }))
    near(shared.hoursLeft, 17)
    const separate = one(frozenChicken, outage(30, { doorOpenedAt: [ago(20), ago(10)], freezerDoorOpenedAt: [] }))
    near(separate.hoursLeft, 18)
  })

  test('door penalty caps at 2 h and ignores taps before the outage started', () => {
    const taps = [ago(40), ...[1, 2, 3, 4, 5, 6].map((h) => ago(h / 4))]
    near(one(milk, outage(1, { doorOpenedAt: taps })).allowanceHours, 2)
    near(one(milk, outage(1, { doorOpenedAt: [ago(5)] })).allowanceHours, 4)
  })

  test('opened mayo: 4 h + 8 h → USE_NOW at 10 h; frozen vegetables in a half freezer: 24 + 6 h', () => {
    const mayo = one({ id: 'f6', name: 'mayonnaise', category: 'food' }, outage(10))
    assert.equal(mayo.foodClass, 'mayo_8h_50f')
    assert.equal(mayo.status, 'USE_NOW')
    near(mayo.hoursLeft, 2)
    const peas = one({ id: 'f7', name: 'frozen peas', category: 'food' }, outage(26, { freezerFull: false }))
    assert.equal(peas.foodClass, 'frozen_veg_6h')
    near(peas.hoursLeft, 4)
  })

  test('a supplied foodClass "unknown" still runs the classifier; raw "medication" category is a med', () => {
    assert.equal(one({ id: 'f8', name: 'cheddar', category: 'food', foodClass: 'unknown' }, outage(30)).status, 'SAFE')
    const raw = { id: 'm8', name: 'Lantus', category: 'medication', limit: lantusLimit } as unknown as Item
    near(one(raw, outage(30), env(84)).hoursLeft, 574.8)
  })

  test('deterministic for a given now', () => {
    const items = [milk, cheddar, frozenChicken, med('m1', 'Lantus', lantusLimit)]
    assert.deepEqual(assess(items, outage(3), env(84), NOW), assess(items, outage(3), env(84), NOW.getTime()))
  })
})

describe('classifyFood and FoodKeeper', () => {
  const cases: [string, string, object?][] = [
    ['2% milk', 'discard_4h'], ['eggs', 'discard_4h'], ['cooked chicken', 'discard_4h'], ['orange chicken', 'discard_4h'],
    ['cheddar', 'keep'], ['cheddar cheese', 'keep'], ['shredded cheddar', 'discard_4h'], ['butter', 'keep'],
    ['buttermilk', 'discard_4h'], ['peanut butter', 'keep'], ['ketchup', 'keep'], ['mustard', 'keep'],
    ['baby formula (opened)', 'discard_4h'], ['baby formula', 'discard_4h', { opened: true }], ['unopened formula powder', 'shelf_stable'],
    ['frozen chicken', 'frozen_refreeze'], ['chicken thighs', 'frozen_refreeze', { location: 'freezer' }], ['ice cream', 'frozen_discard'],
    ['frozen peas', 'frozen_veg_6h'], ['mayonnaise', 'mayo_8h_50f'], ['leche', 'discard_4h'], ['lèt', 'discard_4h'],
    ['huevos', 'discard_4h'], ['queso fresco', 'discard_4h'], ['canned tuna', 'shelf_stable'], ['opened canned tuna', 'discard_4h'],
    ['cut watermelon', 'discard_4h'], ['apples', 'keep'], ['sauce?', 'unknown'],
  ]
  for (const [name, cls, opts] of cases) {
    test(`${name} → ${cls}`, () => assert.equal(classifyFood(name, opts), cls))
  }

  test('lookupFoodKeeper gives refrigerator/freezer days as a subtitle hint', () => {
    const hit = lookupFoodKeeper('Cooked poultry dishes')
    assert.equal(hit?.id, 135)
    assert.deepEqual(hit?.refrigeratorDays, [3, 4])
    assert.equal(lookupFoodKeeper('2% milk')?.id, 27)
    assert.equal(lookupFoodKeeper('eggs')?.id, 21)
    assert.equal(lookupFoodKeeper('zzz'), null)
  })
})

describe('copy safety and data files', () => {
  const FOOD_DISCARD_BANNED = /probably (fine|ok)|should be (fine|ok)|smell|taste|sniff|still (good|safe)|huele|prueba|probablemente|pran sant|goute|toujou bon/i
  const MED_BANNED = /no (la |lo )?uses?|don'?t use|do not use|stop taking|throw (it )?away|discard|deseche|desechar|deja de|pa sèvi|jete/i
  const DOSING = /\d+\s?(units?|unidades|mg)\b/i

  test('fixed reason text never trips the banned-phrase filters from the brief', () => {
    const foods: Item[] = ['2% milk', 'cheddar', 'sauce?', 'mayonnaise', 'frozen peas', 'ice cream', 'frozen chicken'].map((name, i) => ({ id: `f${i}`, name, category: 'food' }))
    const meds: Item[] = [
      med('m1', 'Lantus', lantusLimit), med('m3', 'Humalog', humalogLimit, { openedDaysAgo: 27 }), med('m2', 'amox', hikmaLimit, { openedDaysAgo: 13 }),
      med('m5', 'metformin', limitForMed(LABELS.metformin)), med('m9', 'unknown', null), med('m2b', 'amox', hikmaLimit),
    ]
    for (const [h, t] of [[1, 84], [3, 84], [30, 84], [30, 91], [700, 84]] as const) {
      for (const v of assess([...foods, ...meds], outage(h), env(t), NOW)) {
        if (v.itemId.startsWith('f') && v.status === 'DISCARD') assert.doesNotMatch(v.reason, FOOD_DISCARD_BANNED, v.reason)
        if (v.itemId.startsWith('m') && v.status !== 'DO_NOT_USE') assert.doesNotMatch(v.reason, MED_BANNED, v.reason)
        assert.doesNotMatch(v.reason, DOSING, v.reason)
      }
    }
  })

  test('data/food-rules.json matches the rules the engine runs', () => {
    const onDisk = JSON.parse(readFileSync(new URL('../../../data/food-rules.json', import.meta.url), 'utf8'))
    assert.deepEqual(onDisk, JSON.parse(JSON.stringify(foodRulesDoc())))
  })
})
