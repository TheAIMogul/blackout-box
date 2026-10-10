import { OPENFDA_URL } from './rules'
import type { Limit, OpenFdaLabel } from './types'

// Regex-first parser for openFDA storage text. It never invents a °F number: every number
// in the returned Limit appears in `quote`, which is verbatim text from the label.

const F = String.raw`(\d{2,3}(?:\.\d)?)\s*(?:°|º|˚|degrees?\s*)\s*F\b`

export function storageTextOf(label: OpenFdaLabel): { text: string; field: string } | null {
  if (label.storageText?.trim()) return { text: label.storageText, field: 'storageText' }
  const sh = label.storage_and_handling?.[0]
  if (sh?.trim()) return { text: sh, field: 'storage_and_handling' }
  for (const field of ['how_supplied', 'package_label_principal_display_panel'] as const) {
    const t = label[field]?.[0] ?? ''
    const i = t.search(/\bStor(e|age)\b/)
    if (i >= 0) return { text: t.slice(i), field }
  }
  return null
}

function sentenceAround(text: string, index: number, max = 240): string {
  const prev = text.lastIndexOf('. ', index)
  const start = prev < 0 ? 0 : prev + 2
  let end = text.indexOf('. ', index)
  end = end < 0 ? text.length : end + 1
  if (end - start <= max) return text.slice(start, end).trim()
  return text.slice(Math.max(start, index - max / 2), Math.min(end, index + max / 2)).trim()
}

export function limitForMed(label: OpenFdaLabel): Limit | null {
  const found = storageTextOf(label)
  if (!found) return null
  const text = found.text.replace(/\s+/g, ' ')
  // Insulin labels append pump and dilution rules (7 days, 98.6°F) that are not the pen/vial limit.
  const core = text.split(/use in an external (?:insulin )?pump|storage of diluted|diluted \w+ (?:for|may)/i)[0]
  const quotes: number[] = []
  const hit = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(core)
    if (m) quotes.push(m.index)
    return m
  }

  const notRequired = /refrigeration is (?:preferable but )?not required|(?:does|do) not (?:need|require) refrigeration/i.test(core)
  const refrigerated =
    !notRequired &&
    /in (?:a|the) refrigerator|under refrigeration|refrigerated \(|36\s*°\s*F?\s*(?:to|and|–|-)\s*46\s*°\s*F|2\s*°\s*C?\s*(?:to|and|–|-)\s*8\s*°\s*C/i.test(core)
  const doNotFreeze = !!hit(/do not freeze|(?:if|been) (?:it has been )?frozen|never freeze|should not be frozen/i)

  // Suspensions: "Discard suspension after 14 days", "Discard unused suspension after 10 days".
  const susp = hit(/discard (?:any )?(?:unused )?(?:portion of (?:the )?)?(?:reconstituted )?(?:oral )?suspension[^.]{0,40}?after (\d{1,3}) days/i)
  const inUseSusp = susp ? Number(susp[1]) : undefined

  // Room-temperature days. "total of N days" rows first (shortest wins when one label lists
  // several devices, e.g. Humalog Mix75/25 vial 28 d vs KwikPen 10 d), then any "N days".
  let days: number | undefined
  if (!inUseSusp) {
    const totals = [...core.matchAll(/total of (\d{1,3}) days/gi)]
    const any = totals.length ? totals : [...core.matchAll(/(\d{1,3})\s*days/gi)]
    if (any.length) {
      const min = any.reduce((a, b) => (Number(b[1]) < Number(a[1]) ? b : a))
      days = Number(min[1])
      quotes.push(min.index ?? 0)
    }
  }

  // Max temperature: explicit room-temp ceiling, then excursion range, then (room-temp drugs only)
  // the upper bound of the "Store at" range. Suspension labels' "Store dry powder at…" is not a
  // limit for the mixed liquid, so it is skipped.
  let maxTempF: number | undefined
  const ceiling = hit(new RegExp(String.raw`(?:up to|not to exceed|not exceeding|no (?:higher|warmer) than|maximum (?:temperature )?of)\s*(?:a\s+)?(?:maximum (?:temperature )?(?:of\s+)?)?` + F, 'i'))
  if (ceiling) maxTempF = Number(ceiling[1])
  if (maxTempF == null) {
    const exc = /excursions?[^.;]*/i.exec(core)
    const temps = exc ? [...exc[0].matchAll(new RegExp(F, 'gi'))].map((m) => Number(m[1])) : []
    if (exc && temps.length) {
      maxTempF = Math.max(...temps)
      quotes.push(exc.index)
    }
  }
  if (maxTempF == null && !refrigerated && !inUseSusp) {
    const store = /\bstore\b[^.]*/i.exec(core)
    const temps = store ? [...store[0].matchAll(new RegExp(F, 'gi'))].map((m) => Number(m[1])) : []
    if (store && temps.length) {
      maxTempF = Math.max(...temps)
      quotes.push(store.index)
    }
  }

  if (days == null && inUseSusp == null && maxTempF == null && !refrigerated) return null

  const setId = label.setId ?? label.set_id
  const brand = label.brand ?? label.openfda?.brand_name?.[0] ?? label.name ?? label.generic ?? label.openfda?.generic_name?.[0]
  const quote = [...new Set(quotes.sort((a, b) => a - b).map((i) => sentenceAround(core, i)))].join(' … ')

  const limit: Limit = {
    kind: 'none',
    source: `FDA label via openFDA${brand ? `: ${brand}` : ''}${setId ? `, set_id ${setId}` : ''}`,
    quote,
    url: OPENFDA_URL,
    storage: refrigerated ? 'refrigerated' : 'room_temp',
    field: found.field,
  }
  if (setId) limit.ref = setId
  const eff = label.effectiveTime ?? label.effective_time
  if (eff) limit.effectiveTime = eff
  if (doNotFreeze) limit.doNotFreeze = true
  if (maxTempF != null) limit.maxTempF = maxTempF

  if (inUseSusp != null) {
    limit.inUseDays = inUseSusp
    if (!refrigerated) {
      limit.kind = 'days_at_room_temp'
      limit.days = inUseSusp
    }
  } else if (days != null && refrigerated) {
    limit.kind = 'days_at_room_temp'
    limit.days = days
    // Insulin tables give the same N days for in-use (opened) pens and vials.
    if (/in-use|in use|opened/i.test(core)) limit.inUseDays = days
  } else if (days != null) {
    limit.inUseDays = days
  }
  return limit
}
