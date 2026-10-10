import { FK_ROWS, FK_VERSION, type FkRange, type FkRow } from './foodkeeper-data'
import type { FoodClass, FoodKeeperHit } from './types'

// USDA FoodKeeper is a normal shelf-life table with no power-outage fields. It is used only
// for the card subtitle and as a last-resort class hint; outage clocks come from FoodSafety.gov.
export const FOODKEEPER_SOURCE = `USDA FSIS FoodKeeper v${FK_VERSION.version} (${FK_VERSION.modified}), CC0`
export const FOODKEEPER_URL = 'https://catalog.data.gov/dataset/fsis-foodkeeper-data'

const METRIC_DAYS: Record<string, number> = { day: 1, days: 1, week: 7, weeks: 7, month: 30, months: 30, year: 365, years: 365 }

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

function toDays(r: FkRange): { days?: [number, number]; note?: string } {
  if (!r) return {}
  const [min, max, metric] = r
  const mult = metric ? METRIC_DAYS[metric.toLowerCase()] : undefined
  const lo = min ?? max
  const hi = max ?? min
  if (mult && lo != null && hi != null) return { days: [lo * mult, hi * mult] }
  return metric ? { note: metric } : {}
}

type Entry = { row: FkRow; name: string; terms: string[] }

// Generic FoodKeeper keywords that would match unrelated rows ("sauce" → herring in wine sauce).
const STOP = new Set(
  ('sauce meat fresh frozen cooked canned whole sliced ground pieces dried plain flavored flavor commercial prepared opened ' +
    'unopened shell hard soft mixed stew sweet powder bottled bulk purchased dish dishes leftover leftovers').split(' '),
)

let index: Entry[] | null = null
function getIndex(): Entry[] {
  if (index) return index
  index = FK_ROWS.map((row) => {
    const name = norm(row[2])
    const terms = new Set([name])
    for (const k of row[4].split(',')) {
      const t = norm(k)
      if (t.length >= 4 && !STOP.has(t)) terms.add(t)
    }
    return { row, name, terms: [...terms] }
  })
  return index
}

// Simple fuzzy match: lowercase, word-padded "includes", longest matching name/keyword wins.
export function lookupFoodKeeper(name: string): FoodKeeperHit | null {
  const q = ` ${norm(name)} `
  if (q.trim() === '') return null
  let best: Entry | null = null
  let bestScore = 0
  for (const e of getIndex()) {
    for (const t of e.terms) {
      if (!q.includes(` ${t} `) && !q.includes(` ${t}s `) && !q.includes(` ${t}es `)) continue
      const score = t.length + (t === e.name ? 0.5 : 0)
      if (score > bestScore) {
        best = e
        bestScore = score
      }
    }
  }
  if (!best) return null
  const [id, categoryId, rowName, subtitle, , fridge, freezer] = best.row
  const f = toDays(fridge)
  const z = toDays(freezer)
  const hit: FoodKeeperHit = { id, name: rowName, categoryId }
  if (subtitle) hit.subtitle = subtitle
  if (f.days) hit.refrigeratorDays = f.days
  if (f.note) hit.refrigeratorNote = f.note
  if (z.days) hit.freezerDays = z.days
  if (z.note) hit.freezerNote = z.note
  return hit
}

// FoodKeeper Category_ID → FoodSafety.gov class, used only when no keyword matched.
// Produce (18, 19), beverages (5), condiments (6) and grains (9) stay unknown on purpose:
// cut vs uncut and cooked vs dry decide their class, and unknown biases to discard.
const PERISHABLE = new Set([1, 4, 7, 10, 12, 13, 14, 15, 17, 20, 21, 22, 24, 25])
export function foodKeeperClassHint(hit: FoodKeeperHit): FoodClass | null {
  if (hit.categoryId === 8) return 'frozen_refreeze'
  if (hit.categoryId === 2) return 'keep'
  if ([11, 16, 23].includes(hit.categoryId)) return 'shelf_stable'
  if (PERISHABLE.has(hit.categoryId)) return 'discard_4h'
  return null
}
