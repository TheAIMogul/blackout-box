#!/usr/bin/env node
// Blackout Box rules CLI. Node 20+, no dependencies, no network, no model.
//   node scripts/assess.mjs input.json            (or pipe JSON on stdin)
//   node scripts/assess.mjs --classify "2% milk"
//   node scripts/assess.mjs --label openfda-record.json
// input.json: { "items": Item[], "outage": Outage, "env": Env, "now"?: ISO string }
// A med item may carry "label" (an openFDA record or { storageText }) instead of "limit".
import { readFileSync } from 'node:fs'
import { assess, classifyFood, limitForMed } from './engine.mjs'

const args = process.argv.slice(2)
const readJson = (path) => JSON.parse(readFileSync(path ?? 0, 'utf8'))
const print = (x) => process.stdout.write(JSON.stringify(x, null, 2) + '\n')

if (args[0] === '--classify') {
  print({ name: args[1], foodClass: classifyFood(args[1] ?? '') })
} else if (args[0] === '--label') {
  const raw = readJson(args[1])
  print(limitForMed(raw.results?.[0] ?? raw))
} else {
  const input = readJson(args[0])
  const items = (input.items ?? []).map(({ label, ...it }) =>
    it.category === 'med' && it.limit == null && label ? { ...it, limit: limitForMed(label.results?.[0] ?? label) } : it,
  )
  const now = input.now ? new Date(input.now) : new Date()
  print(assess(items, input.outage ?? { startedAt: '' }, input.env ?? { estimated: false }, now))
}
