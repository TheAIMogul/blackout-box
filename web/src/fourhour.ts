// The 4-Hour Rule screen: photo → /api/vision/items → assess() → live countdown cards.
// "Apple meets Airbnb" (CONTRACT.md "Visual style"): hero summary + stacked status bar, a compact outage card
// that opens a bottom sheet, Airbnb category pills, and countdown cards with Apple Watch-style rings. Items, outage and indoor temp live in
// IndexedDB, so an offline reload still shows the clocks.
import { demoItems, openfdaLabel, visionItems } from './api'
import { itemsAll, itemsReplace, kvGet, kvSet } from './db'
import { runAssess, type NV, type Status, type WebEnv, type WebItem, type WebOutage } from './engine'
import { onLang, t } from './i18n'
import { emptyArt, iconHTML, onMedia } from './media'
import { openSamples } from './samples'
import { openSheet, type Sheet } from './sheet'
import { emit, esc, fmtClock, haptic, usText, on, state, toLocalInput, uid, withTransition } from './util'

type LastRead = { model: string; provider: string; latencyMs?: number; fallback?: boolean; unreadable?: number; at: string }

let items: WebItem[] = []
let outage: WebOutage = { startedAt: new Date().toISOString(), doorOpenedAt: [], freezerFull: true }
// Power is on until "The power just went out" (or the outage slider) says otherwise: clocks show their full time and don't tick.
let powerOn = true
const POWER_ON_ROOM_F = 75 // a cooled home while the power is on
let indoorTempF: number | null = null
let lastRead: LastRead | null = null
let busy = false
let note: { text: string; kind: 'info' | 'warn' | 'error' } | null = null
let verdicts: NV[] = []
let signature = ''
let root: HTMLElement

const OVER: Status[] = ['DISCARD', 'PAST_LIMIT', 'DO_NOT_USE']
const ICON: Record<Status, string> = { SAFE: 'check_circle', USE_NOW: 'warning', DISCARD: 'error', PAST_LIMIT: 'thermostat', DO_NOT_USE: 'block', UNKNOWN: 'help' }

export async function mountFourHour(host: HTMLElement): Promise<void> {
  root = host
  const [savedItems, savedOutage, savedEnv, savedRead] = await Promise.all([
    itemsAll<WebItem>(),
    kvGet<WebOutage>('outage'),
    kvGet<{ indoorTempF: number | null }>('env'),
    kvGet<LastRead>('lastRead'),
  ])
  items = savedItems
  state.items = items
  if (savedOutage?.value?.startedAt) outage = { startedAt: savedOutage.value.startedAt, doorOpenedAt: savedOutage.value.doorOpenedAt ?? [], freezerFull: savedOutage.value.freezerFull ?? true }
  else void kvSet('outage', { ...outage, powerOn }, 'user')
  // Older saves have no powerOn flag: treat them as power on, so clocks only run after "The power just went out".
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  powerOn = (savedOutage?.value as any)?.powerOn !== false
  indoorTempF = savedEnv?.value?.indoorTempF ?? null
  lastRead = savedRead?.value ?? null

  renderShell()
  onLang(() => renderShell())
  onMedia(() => { renderCats(); renderCards() })
  on('prep', () => { renderControls(); recompute(true) })
  setInterval(() => recompute(false), 1000)
}

// ---------- persistence ----------
function saveItems(): void { void itemsReplace(items); state.items = items; emit('items') }
function saveOutage(): void { void kvSet('outage', { ...outage, powerOn }, 'user') }
function saveEnv(): void { void kvSet('env', { indoorTempF }, 'user') }

// ---------- env / estimate ----------
function hoursOut(): number { return powerOn ? 0 : Math.max(0, (Date.now() - Date.parse(outage.startedAt)) / 36e5) }

/** Cold Chain heuristic (labeled estimate): <4 h out → max(78, outdoor−4); else max(80, outdoor). */
function estimateIndoor(): number | undefined {
  const out = state.prep?.nws?.tempF
  if (typeof out !== 'number') return undefined
  const h = hoursOut()
  return Math.round(h < 4 ? Math.max(78, out - 4) : Math.max(80, out))
}

function currentEnv(): WebEnv {
  const hourly = state.prep?.nws?.hourly // turns on the engine's forecast-aware estimate
  // A thermometer reading beats the outdoor forecast: without this, Miami's 89°F afternoon forecast
  // is read as the indoor temp and zeroes every 86°F label clock even when the room reads 84°F.
  if (indoorTempF != null) return { indoorTempF, outdoorTempF: state.prep?.nws?.tempF, estimated: false }
  return { indoorTempF: estimateIndoor(), outdoorTempF: state.prep?.nws?.tempF, estimated: true, hourly }
}

// ---------- rendering ----------
type Cat = 'all' | 'fridge' | 'freezer' | 'med' | 'pantry'
const CATS: { k: Cat; icon: string; label: string; media: string }[] = [
  { k: 'all', icon: 'apps', label: 'cat_all', media: 'all' },
  { k: 'fridge', icon: 'kitchen', label: 'cat_fridge', media: 'fridge' },
  { k: 'freezer', icon: 'ac_unit', label: 'cat_freezer', media: 'freezer' },
  { k: 'med', icon: 'medication', label: 'cat_meds', media: 'medicine' },
  { k: 'pantry', icon: 'shelves', label: 'cat_pantry', media: 'pantry' },
]
let cat: Cat = (() => { try { const v = localStorage.getItem('bb.cat') as Cat | null; return v && CATS.some((c) => c.k === v) ? v : 'all' } catch { return 'all' } })()

function catOf(it: WebItem): Cat {
  if (it.category === 'med') return 'med'
  const loc = String(it.location ?? '').toLowerCase()
  const fc = String(it.foodClass ?? '').toLowerCase()
  if (loc.includes('freezer') || it.frozen === true || fc.startsWith('frozen')) return 'freezer'
  if (/fridge|door|refrig/.test(loc)) return 'fridge'
  // Pantry only when the photo says so, or when there is no location and the food is shelf-stable.
  if (/shelf|cabinet|pantry|counter/.test(loc) || (!loc && /shelf|pantry/.test(fc))) return 'pantry'
  return 'fridge'
}

const ACTION: Status[] = ['USE_NOW', 'DISCARD', 'PAST_LIMIT', 'DO_NOT_USE']
const ORDER: Status[] = ['DISCARD', 'DO_NOT_USE', 'PAST_LIMIT', 'USE_NOW', 'SAFE', 'UNKNOWN']
const C = 2 * Math.PI * 50 // ring circumference (r = 50 in a 120 viewBox)

function renderShell(): void {
  root.innerHTML = `
    <div class="fh-top" id="fh-hero"></div>
    <input type="file" accept="image/*" capture="environment" id="fh-file" class="hidden">
    <input type="file" accept="image/*" capture="environment" id="fh-file-frz" class="hidden">
    <input type="file" accept="image/*" capture="environment" id="fh-file-med" class="hidden">
    <div id="fh-status" class="fh-status"></div>
    <div class="card outage" id="fh-outage" role="group" aria-label="${esc(t('outage_title'))}"></div>
    <nav class="cats" id="fh-cats" aria-label="${esc(t('items'))}"></nav>
    <div class="cards" id="fh-cards" aria-live="off"></div>
    <details class="list editor" id="fh-editor"><summary></summary><div class="ed-body" id="fh-ed-body"></div></details>`

  const file = root.querySelector<HTMLInputElement>('#fh-file')!
  file.addEventListener('change', () => { const f = file.files?.[0]; file.value = ''; if (f) void readPhoto(f) })
  const frz = root.querySelector<HTMLInputElement>('#fh-file-frz')!
  frz.addEventListener('change', () => { const f = frz.files?.[0]; frz.value = ''; if (f) void readPhoto(f, true) })
  const med = root.querySelector<HTMLInputElement>('#fh-file-med')!
  med.addEventListener('change', () => { const f = med.files?.[0]; med.value = ''; if (f) void readPhoto(f, false, true) })
  root.querySelector('#fh-cards')!.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('.cd')
    if (card?.dataset.id) openDetail(card.dataset.id)
  })
  root.querySelector('#fh-cards')!.addEventListener('keydown', (e) => {
    const ke = e as KeyboardEvent
    const card = (ke.target as HTMLElement).closest<HTMLElement>('.cd')
    if (card?.dataset.id && (ke.key === 'Enter' || ke.key === ' ') && ke.target === card) { ke.preventDefault(); openDetail(card.dataset.id) }
  })
  renderStatus()
  renderControls()
  renderCats()
  renderEditor()
  recompute(true)
}

function renderHero(): void {
  const el = root.querySelector('#fh-hero')
  if (!el) return
  const counts = new Map<Status, number>()
  verdicts.forEach((v) => counts.set(v.status, (counts.get(v.status) ?? 0) + 1))
  const need = verdicts.filter((v) => ACTION.includes(v.status)).length
  const head = !items.length ? esc(t('hero_none'))
    : need ? esc(t(need === 1 ? 'need_action_one' : 'need_action_other', { n: '\u0000' })).replace('\u0000', `<em>${need}</em>`) : esc(t('all_clear'))
  const stack = items.length ? `<div class="stack" role="img" aria-label="${esc(ORDER.filter((s) => counts.get(s)).map((s) => `${counts.get(s)} ${t('status.' + s)}`).join(', '))}">${ORDER.filter((s) => counts.get(s)).map((s) => `<i class="st-${s}" style="flex-grow:${counts.get(s)}"></i>`).join('')}</div>
    <div class="legend fh-legend">${ORDER.filter((s) => counts.get(s)).map((s) => `<span class="st-${s}"><i></i><b>${counts.get(s)}</b> ${esc(t('status.' + s).split(':')[0])}</span>`).join('')}</div>` : ''
  let model = ''
  if (items.length && lastRead) {
    model = lastRead.fallback
      ? `<div class="model-line"><span class="ms" aria-hidden="true">science</span><b>${esc(t('demo_items_fallback'))}</b></div>`
      : `<div class="model-line"><span class="ms fill" aria-hidden="true">${lastRead.model === 'demo' ? 'science' : 'photo_camera'}</span>${esc(lastRead.model === 'demo' ? t('demo_items') : t('read_from_photo'))}${lastRead.unreadable ? ` · ${lastRead.unreadable} ${esc(t('unreadable'))}` : ''}</div>`
  }
  const tile = (id: string, uses: string[], fb: string, lab: string) =>
    `<button type="button" class="fh-tile" id="${id}" ${busy ? 'disabled' : ''}>${iconHTML(uses, fb, 'mi fh-tile-mi')}<span class="fh-tile-l">${esc(t(lab))}</span><span class="fh-tile-cam"><span class="ms fill" aria-hidden="true">photo_camera</span></span></button>`
  el.innerHTML = `
    <section class="fh-sum">
      <div class="fh-eyebrow">${items.length ? (powerOn ? esc(t('hero_sub_on', { n: items.length })) : esc(t('hero_sub', { n: items.length, h: '\u0001' })).replace('\u0001', `<span data-hrs-h>${hoursOut().toFixed(1)}</span>`)) : esc(t('fh_sub'))}</div>
      <div class="big" aria-live="polite">${head}</div>
      ${stack}${model}
    </section>
    <div class="fh-label">${esc(t('scan_section'))}</div>
    <div class="fh-tiles scan-row" role="group" aria-label="${esc(t('scan_section'))}">
      ${tile('fh-photo', ['icon.fridge', 'icon.cat.fridge'], 'kitchen', 'cat_fridge')}
      ${tile('fh-photo-frz', ['icon.freezer', 'icon.cat.freezer'], 'ac_unit', 'cat_freezer')}
      ${tile('fh-photo-med', ['icon.medicine', 'icon.cat.medicine'], 'medication', 'cat_meds')}
    </div>
    <button type="button" class="btn text fh-demo demo-btn" id="fh-demo" ${busy ? 'disabled' : ''}>${busy ? '<span class="spinner" aria-hidden="true"></span>' : '<span class="ms" aria-hidden="true">photo_library</span>'}<span>${esc(t('fh_demo'))}</span></button>`
  el.querySelector('#fh-photo')!.addEventListener('click', () => { haptic(); root.querySelector<HTMLInputElement>('#fh-file')!.click() })
  el.querySelector('#fh-photo-frz')!.addEventListener('click', () => { haptic(); root.querySelector<HTMLInputElement>('#fh-file-frz')!.click() })
  el.querySelector('#fh-photo-med')!.addEventListener('click', () => { haptic(); root.querySelector<HTMLInputElement>('#fh-file-med')!.click() })
  el.querySelector('#fh-demo')!.addEventListener('click', () => { haptic(); openSamples() })
}

function renderStatus(): void {
  const el = root.querySelector('#fh-status')
  if (!el) return
  const icon = (k: string) => (k === 'error' ? 'error' : k === 'warn' ? 'warning' : 'info')
  el.innerHTML = (busy ? `<div class="progress" role="progressbar" aria-label="${esc(t('fh_reading'))}"><i></i></div><div class="banner"><span class="ms" aria-hidden="true">photo_camera</span><span>${esc(t('fh_reading'))}</span></div>` : '') +
    (note ? `<div class="banner ${note.kind === 'info' ? '' : note.kind}"><span class="ms" aria-hidden="true">${icon(note.kind)}</span><span>${esc(note.text)}</span></div>` : '')
  renderHero()
}

function renderCats(): void {
  const el = root.querySelector('#fh-cats')
  if (!el) return
  const n = (k: Cat) => (k === 'all' ? items.length : items.filter((i) => catOf(i) === k).length)
  el.innerHTML = CATS.map((c) => `<button type="button" data-cat="${c.k}" aria-pressed="${cat === c.k}">${iconHTML([`icon.cat.${c.media}`, `icon.${c.media}`], c.icon, 'mi cat-mi')}<span>${esc(t(c.label))} <span class="n">${n(c.k) || ''}</span></span></button>`).join('')
  el.querySelectorAll<HTMLButtonElement>('[data-cat]').forEach((b) => b.addEventListener('click', () => {
    haptic()
    cat = b.dataset.cat as Cat
    try { localStorage.setItem('bb.cat', cat) } catch { /* ignore */ }
    withTransition(() => { renderCats(); renderCards() })
  }))
}

// ---------- outage controls: compact card + bottom sheet ----------
let ctlSheet: Sheet | null = null

function roomC(): { c: number | null; estimated: boolean } {
  const env = currentEnv()
  return { c: env.indoorTempF != null ? Math.round(env.indoorTempF) : null, estimated: env.estimated }
}

function renderControls(): void {
  const el = root.querySelector('#fh-outage')
  if (el && powerOn) {
    el.innerHTML = `
      <div class="o-head">
        <span class="o-ico on"><span class="ms fill" aria-hidden="true">power</span></span>
        <span class="o-label">${esc(t('power_on_title'))}</span>
      </div>
      <div class="o-wait">${esc(t('power_on_wait'))}</div>
      <button type="button" class="out-btn o-start" id="fh-start"><span class="ms fill" aria-hidden="true">power_off</span><span>${esc(t('power_went_out'))}</span><span class="ms" aria-hidden="true">chevron_right</span></button>`
    el.querySelector('#fh-start')!.addEventListener('click', () => { haptic(); powerOutNow() })
    if (ctlSheet) renderSheetControls(ctlSheet.body)
    return
  }
  if (el) {
    const h = hoursOut()
    const room = roomC()
    const v = Math.min(72, h)
    el.innerHTML = `
      <div class="o-head">
        <span class="o-ico"><span class="ms fill" aria-hidden="true">power_off</span></span>
        <span class="o-label">${esc(t('power_out'))}</span>
        <button type="button" class="o-adj" id="fh-adjust"><span class="ms" aria-hidden="true">tune</span>${esc(t('adjust'))}</button>
      </div>
      <button type="button" class="o-back" id="fh-back"><span class="ms" aria-hidden="true">power</span>${esc(t('power_back'))}</button>
      <div class="o-val" id="fh-hrs-val">${esc(t('power_out_for', { h: h.toFixed(1) }))}</div>
      <input type="range" class="o-range" id="fh-hrs" min="0" max="72" step="0.25" value="${v.toFixed(2)}" style="--p:${(v / 72 * 100).toFixed(2)}%" aria-label="${esc(t('power_out'))} · ${esc(t('hours_ago'))}">
      <div class="o-meta">
        <button type="button" class="pill" data-open><span class="ms" aria-hidden="true">door_open</span><span class="tnum">${esc(t('door_n', { n: outage.doorOpenedAt.length }))}</span></button>
        <button type="button" class="pill" data-open><span class="ms" aria-hidden="true">ac_unit</span>${esc(t('freezer'))} · ${esc(outage.freezerFull ? t('full') : t('half'))}</button>
        <button type="button" class="pill" data-open><span class="ms" aria-hidden="true">thermostat</span><span class="tnum">${esc(t('room', { t: room.c != null ? `${room.estimated ? '≈ ' : ''}${room.c} °F` : '—' }))}</span>${room.estimated && room.c != null ? ` <span class="est">${esc(t('estimated'))}</span>` : ''}</button>
      </div>`
    el.querySelector('#fh-adjust')!.addEventListener('click', openControls)
    el.querySelector('#fh-back')!.addEventListener('click', () => { haptic(); powerOn = true; saveOutage(); renderControls(); recompute(true) })
    el.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', openControls))
    bindSlider(el as HTMLElement)
  }
  if (ctlSheet) renderSheetControls(ctlSheet.body)
}

function bindSlider(scope: HTMLElement): void {
  const hrs = scope.querySelector<HTMLInputElement>('#fh-hrs, [data-hrs]')
  if (!hrs) return
  hrs.addEventListener('input', () => {
    const v = parseFloat(hrs.value)
    powerOn = false
    outage.startedAt = new Date(Date.now() - v * 36e5).toISOString()
    document.querySelectorAll<HTMLInputElement>('#fh-hrs, [data-hrs]').forEach((x) => { if (x !== hrs) x.value = hrs.value; x.style.setProperty('--p', `${(v / 72 * 100).toFixed(2)}%`) })
    paintHours()
    const st = document.querySelector<HTMLInputElement>('[data-start]')
    if (st) st.value = toLocalInput(Date.parse(outage.startedAt))
    recompute(true)
  })
  hrs.addEventListener('change', () => { saveOutage(); haptic() })
}

function openControls(): void {
  ctlSheet = openSheet(t('outage_title'), '', (body) => renderSheetControls(body), () => { ctlSheet = null })
}

function renderSheetControls(body: HTMLElement): void {
  const h = hoursOut()
  const env = currentEnv()
  const room = roomC()
  const opens = outage.doorOpenedAt.length
  const userC = indoorTempF != null ? Math.round(indoorTempF) : null
  const nwsC = state.prep?.nws?.tempF != null ? Math.round(state.prep.nws.tempF) : null
  body.innerHTML = `
    <div class="ctl">
      <div class="lab"><span class="ms" aria-hidden="true">power_off</span>${esc(t('power_out'))}<span class="v" data-hrs-val>${esc(t('power_out_for', { h: h.toFixed(1) }))}</span></div>
      <input type="range" data-hrs min="0" max="72" step="0.25" value="${Math.min(72, h).toFixed(2)}" aria-label="${esc(t('power_out'))}">
      <input type="datetime-local" class="input" data-start value="${toLocalInput(Date.parse(outage.startedAt))}" aria-label="${esc(t('power_out'))}" style="margin-top:8px">
    </div>
    <div class="ctl">
      <div class="lab"><span class="ms" aria-hidden="true">kitchen</span>${esc(t('fridge_door'))}</div>
      <div class="line">
        <button type="button" class="btn primary small" data-door><span class="ms" aria-hidden="true">door_open</span>${esc(t('opened_fridge'))}</button>
        <span class="door-count" aria-label="${opens} ${esc(t('door_opens'))}">${opens}×</span>
        ${opens ? `<button type="button" class="btn text" data-door-reset>${esc(t('reset'))}</button>` : ''}
      </div>
      <div class="note">${esc(t('door_penalty_note'))}</div>
    </div>
    <div class="ctl">
      <div class="lab"><span class="ms" aria-hidden="true">ac_unit</span>${esc(t('freezer'))}</div>
      <div class="seg" role="group" aria-label="${esc(t('freezer'))}">
        <button type="button" data-frz="full" aria-pressed="${outage.freezerFull}">${esc(t('full'))}</button>
        <button type="button" data-frz="half" aria-pressed="${!outage.freezerFull}">${esc(t('half'))}</button>
      </div>
    </div>
    <div class="ctl">
      <div class="lab"><span class="ms" aria-hidden="true">thermostat</span>${esc(t('indoor_temp'))}${room.c != null ? `<span class="v">${room.estimated ? '≈ ' : ''}${room.c} °F</span>` : ''}</div>
      <div class="line">
        <input type="number" inputmode="decimal" class="input" data-temp-in min="32" max="130" step="1" style="flex:1;min-width:110px" placeholder="${esc(env.estimated && room.c != null ? '≈ ' + room.c : t('temp_placeholder'))}" value="${userC ?? ''}" aria-label="${esc(t('indoor_temp'))}">
        <button type="button" class="chip" data-temp-c="84" aria-pressed="${userC === 84}">84 °F</button>
        <button type="button" class="chip" data-temp-c="91" aria-pressed="${userC === 91}">91 °F</button>
      </div>
      <div class="note">
        ${env.estimated ? `<span class="est">${esc(t('est_nws'))}</span>` : `<span class="est user">${esc(t('thermometer'))}</span>`}
        ${room.c != null ? '' : ` ${esc(t('no_reading'))}`}${env.estimated && nwsC != null ? ` · NWS ${nwsC} °F` : ''}
        ${indoorTempF != null ? ` · <button type="button" class="btn text" data-temp-c="" style="height:24px;padding:0 4px">${esc(t('reset'))}</button>` : ''}
      </div>
    </div>
    <button type="button" class="btn block" data-done style="margin-top:12px">${esc(t('done'))}</button>`

  bindSlider(body)
  const start = body.querySelector<HTMLInputElement>('[data-start]')!
  start.addEventListener('change', () => {
    const ms = Date.parse(start.value)
    if (Number.isFinite(ms)) { outage.startedAt = new Date(ms).toISOString(); saveOutage(); renderControls(); recompute(true) }
  })
  body.querySelector('[data-door]')!.addEventListener('click', () => {
    haptic()
    outage.doorOpenedAt = [...outage.doorOpenedAt, new Date().toISOString()]
    saveOutage(); renderControls(); recompute(true)
  })
  body.querySelector('[data-door-reset]')?.addEventListener('click', () => { outage.doorOpenedAt = []; saveOutage(); renderControls(); recompute(true) })
  body.querySelectorAll<HTMLButtonElement>('[data-frz]').forEach((b) => b.addEventListener('click', () => {
    haptic(); outage.freezerFull = b.dataset.frz === 'full'; saveOutage(); renderControls(); recompute(true)
  }))
  const temp = body.querySelector<HTMLInputElement>('[data-temp-in]')!
  temp.addEventListener('change', () => {
    const c = parseFloat(temp.value)
    indoorTempF = Number.isFinite(c) ? Math.round(c * 10) / 10 : null // the engine works in °F natively
    saveEnv(); renderControls(); recompute(true)
  })
  body.querySelectorAll<HTMLButtonElement>('[data-temp-c]').forEach((b) => b.addEventListener('click', () => {
    haptic()
    const c = parseFloat(b.dataset.tempC ?? '')
    indoorTempF = Number.isFinite(c) ? Math.round(c * 10) / 10 : null
    saveEnv(); renderControls(); recompute(true)
  }))
  body.querySelector('[data-done]')!.addEventListener('click', () => ctlSheet?.close())
}

function recompute(force: boolean): void {
  try {
    const now = new Date()
    verdicts = powerOn
      ? runAssess(items, { ...outage, startedAt: now.toISOString(), doorOpenedAt: [] }, { indoorTempF: POWER_ON_ROOM_F, estimated: false }, now)
      : runAssess(items, outage, currentEnv(), now)
  } catch (e) {
    console.error('assess failed', e)
    verdicts = items.map((it) => ({ itemId: it.id, status: 'UNKNOWN' as Status, deadlineMs: null, reason: 'engine error', source: '' }))
  }
  state.verdicts = verdicts
  const sig = verdicts.map((v) => v.itemId + ':' + v.status).join('|')
  if (force || sig !== signature) {
    const changed = sig !== signature
    signature = sig
    renderCards()
    if (changed || force) { renderHero(); renderCats() }
  } else {
    tickClocks()
  }
}

function pct(v: NV, now: number): number {
  if (OVER.includes(v.status)) return 100
  if (v.deadlineMs == null) return 100
  const total = v.allowanceH ? v.allowanceH * 36e5 : v.deadlineMs - Date.parse(outage.startedAt)
  if (!(total > 0)) return 100
  return Math.max(0, Math.min(100, (100 * (v.deadlineMs - now)) / total))
}

/** Text inside the ring: "03:14:09" (+ "2d"), "Over limit", or "No clock". */
function ringInner(v: NV, now: number): string {
  if (OVER.includes(v.status)) return `<span class="ms fill" aria-hidden="true">${ICON[v.status]}</span><span class="over">${esc(t('over_limit'))}</span>`
  if (v.deadlineMs == null) return `<span class="ms fill" aria-hidden="true">${ICON[v.status]}</span><span class="over" style="color:var(--text-2)">${esc(t('no_clock'))}</span>`
  const s = fmtClock(v.deadlineMs - now)
  const m = /^(\d+d) (.*)$/.exec(s)
  return `${m ? `<span class="dd">${m[1]}</span>` : ''}<span class="clk" data-clk>${m ? m[2] : s}</span><span class="lbl">${esc(t('time_left'))}</span>`
}

function ringHTML(v: NV, now: number, start = true, mini = false): string {
  const p = pct(v, now)
  const off = start ? C : C * (1 - p / 100)
  return `<div class="ring${mini ? ' mini' : ''}" data-ring="${esc(v.itemId)}" data-p="${p.toFixed(2)}">
    <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="trk" cx="60" cy="60" r="50" fill="none" stroke-width="11"/>
    <circle class="val" cx="60" cy="60" r="50" fill="none" stroke-width="11" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/></svg>
    <div class="in">${mini ? `<span class="ms fill" aria-hidden="true">${ICON[v.status]}</span>` : ringInner(v, now)}</div></div>`
}

/** Animate rings from empty to their value (Apple Watch style) on the next frames. */
function settleRings(scope: ParentNode): void {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    scope.querySelectorAll<HTMLElement>('.ring[data-p]').forEach((r) => {
      const c = r.querySelector<SVGCircleElement>('.val')
      if (c) c.style.strokeDashoffset = String(C * (1 - Number(r.dataset.p) / 100))
    })
  }))
}

const INSULIN = /insulin|insulina|ensilin|lantus|humalog|novolog|humulin|levemir|tresiba|basaglar|toujeo|admelog|apidra|fiasp|lyumjev/i
/** Insulin past its label limit gets the FDA life-sustaining copy; other medicines get the generic line. */
function actKey(it: WebItem, c: string, s: Status): string {
  if (c === 'med' && s === 'PAST_LIMIT' && INSULIN.test(`${it.name} ${it.brandText ?? ''}`)) return 'act.insulin.PAST_LIMIT'
  return `act.${c}.${s}`
}

const LOC_KEY: Record<string, string> = { fridge: 'cat_fridge', door: 'cat_fridge', freezer: 'cat_freezer', shelf: 'cat_pantry', cabinet: 'cat_pantry', pantry: 'cat_pantry', counter: 'cat_pantry' }
function kindLine(it: WebItem): string {
  const c = it.category === 'med' ? t('med') : t('food')
  const loc = it.location ? t(LOC_KEY[String(it.location)] ?? '') : ''
  return c + (loc && LOC_KEY[String(it.location)] ? ' · ' + loc : '')
}

function renderCards(): void {
  const el = root.querySelector('#fh-cards')
  if (!el) return
  const byId = new Map(items.map((i) => [i.id, i]))
  const now = Date.now()
  const shown = verdicts.filter((v) => { const it = byId.get(v.itemId); return it && (cat === 'all' || catOf(it) === cat) })
  if (!items.length) {
    el.innerHTML = `<div class="empty">${emptyArt('empty.clocks') || '<span class="ms" aria-hidden="true">kitchen</span>'}${esc(t('fh_empty'))}</div>`
  } else if (!shown.length) {
    const label = t(CATS.find((c) => c.k === cat)?.label ?? 'cat_all')
    el.innerHTML = `<div class="empty">${emptyArt('empty.clocks') || `<span class="ms" aria-hidden="true">${CATS.find((c) => c.k === cat)?.icon ?? 'apps'}</span>`}<b class="empty-h">${esc(t('cat_empty_h', { cat: label }))}</b><span>${esc(t('cat_empty'))}</span></div>`
  } else {
    el.innerHTML = shown.map((v, i) => {
      const it = byId.get(v.itemId)!
      const c = it.category === 'med' ? 'med' : 'food'
      const over = OVER.includes(v.status)
      const clk = v.deadlineMs == null ? '' : fmtClock(v.deadlineMs - now)
      const dm = /^(\d+d) (.*)$/.exec(clk)
      const big = over ? `<span class="cd-over">${esc(t('over_limit'))}</span>`
        : v.deadlineMs == null ? `<span class="cd-over muted">${esc(t('no_clock'))}</span>`
        : `${dm ? `<span class="cd-dd">${dm[1]}</span>` : ''}<span data-clk-id="${esc(v.itemId)}">${dm ? dm[2] : clk}</span><span class="cd-left">${esc(t('time_left'))}</span>`
      return `<article class="cd v8 s-${v.status}" data-id="${esc(v.itemId)}" tabindex="0" role="button" aria-label="${esc(it.name)}: ${esc(t('status.' + v.status))}" style="animation-delay:${Math.min(i, 8) * 40}ms">
        <div class="cd-main">
          ${ringHTML(v, now, true, true)}
          <div class="info">
            <div class="nm">${esc(it.name)}</div>
            <div class="kind">${esc(kindLine(it))}</div>
            <div class="cd-clock">${big}</div>
            <span class="stpill"><span class="ms" aria-hidden="true">${ICON[v.status]}</span><span>${esc(t('status.' + v.status))}</span></span>
          </div>
        </div>
        <div class="cd-foot"><span class="act">${esc(t(actKey(it, c, v.status)))}</span><span class="cd-why">${esc(t('why'))}<span class="ms" aria-hidden="true">chevron_right</span></span></div>
      </article>`
    }).join('')
    settleRings(el)
  }
}

function tickClocks(): void {
  const now = Date.now()
  const byId = new Map(verdicts.map((v) => [v.itemId, v]))
  document.querySelectorAll<HTMLElement>('.ring[data-ring]').forEach((r) => {
    const v = byId.get(r.dataset.ring ?? '')
    if (!v) return
    const p = pct(v, now)
    r.dataset.p = p.toFixed(2)
    const c = r.querySelector<SVGCircleElement>('.val')
    if (c && c.style.strokeDashoffset) c.style.strokeDashoffset = String(C * (1 - p / 100))
    const ck = r.querySelector<HTMLElement>('[data-clk]')
    if (ck && v.deadlineMs != null) {
      const s = fmtClock(v.deadlineMs - now).replace(/^\d+d /, '')
      if (ck.textContent !== s) ck.textContent = s
    }
  })
  document.querySelectorAll<HTMLElement>('[data-clk-id]').forEach((x) => {
    const v = byId.get(x.dataset.clkId ?? '')
    if (!v || v.deadlineMs == null) return
    const s = fmtClock(v.deadlineMs - now).replace(/^\d+d /, '')
    if (x.textContent !== s) x.textContent = s
  })
  paintHours()
  if (Math.floor(now / 1000) % 30 === 0) {
    const h = hoursOut()
    const active = document.activeElement
    document.querySelectorAll<HTMLInputElement>('#fh-hrs, [data-hrs]').forEach((x) => { if (x !== active) { x.value = Math.min(72, h).toFixed(2); x.style.setProperty('--p', `${(Math.min(72, h) / 72 * 100).toFixed(2)}%`) } })
  }
}

/** One value, every place: the hero summary and the outage control both read hoursOut() each second. */
function paintHours(): void {
  const h = hoursOut().toFixed(1)
  document.querySelectorAll<HTMLElement>('[data-hrs-h]').forEach((x) => { if (x.textContent !== h) x.textContent = h })
  const txt = t('power_out_for', { h })
  document.querySelectorAll<HTMLElement>('#fh-hrs-val, [data-hrs-val]').forEach((x) => { if (x.textContent !== txt) x.textContent = txt })
}

// ---------- item detail sheet (ring, what to do, why in metric, verbatim source) ----------
function openDetail(id: string): void {
  const it = items.find((x) => x.id === id)
  const v = verdicts.find((x) => x.itemId === id)
  if (!it || !v) return
  const c = it.category === 'med' ? 'med' : 'food'
  const why = usText(v.reason)
  openSheet(it.name, `
    <div class="det-top s-${v.status} cd" style="box-shadow:none;border:0;background:transparent;animation:none;cursor:default">
      ${ringHTML(v, Date.now())}
      <div class="info"><div class="kind">${esc(kindLine(it))}</div>
        <span class="stpill"><span class="ms" aria-hidden="true">${ICON[v.status]}</span><span>${esc(t('status.' + v.status))}</span></span>
        ${v.hint ? `<div class="kind" style="white-space:normal;margin-top:8px">${esc(v.hint)}</div>` : ''}</div>
    </div>
    <div class="det-h">${esc(t('what_to_do'))}</div><p class="det-p">${esc(t(actKey(it, c, v.status)))}</p>
    ${why ? `<div class="det-h">${esc(t('why'))}</div><p class="det-p">${esc(why)}</p>` : ''}
    <div class="det-h">${esc(t('source_quote'))}</div>
    ${v.quote ? `<div class="quote-box"><p>${esc(v.quote)}</p></div>` : ''}
    <p class="det-p" style="margin-top:10px"><b>${esc(usText(v.source) || '—')}</b></p>
    ${v.url ? `<a class="btn outline block" style="margin-top:14px" href="${esc(v.url)}" target="_blank" rel="noopener"><span class="ms" aria-hidden="true">open_in_new</span>${esc(t('open_source'))}</a>` : ''}`,
  (body) => settleRings(body))
}

// ---------- item editor ----------
function renderEditor(): void {
  const det = root.querySelector('#fh-editor')
  if (!det) return
  det.querySelector('summary')!.innerHTML = `<span class="ms" aria-hidden="true">edit_note</span>${esc(t('items'))} <span class="count">${items.length}</span><span style="flex:1"></span><span class="ms x" aria-hidden="true">chevron_right</span>`
  const body = det.querySelector('#fh-ed-body')!
  const opt = (v: string, sel: boolean) => `<option value="${v}"${sel ? ' selected' : ''}>${esc(t(v))}</option>`
  body.innerHTML = items.map((it) => `
    <div class="ed-row" data-id="${esc(it.id)}">
      <input type="text" value="${esc(it.name)}" aria-label="${esc(t('item_name'))}" data-f="name">
      <select data-f="cat" aria-label="${esc(t('food'))} / ${esc(t('med'))}">${opt('food', it.category !== 'med')}${opt('med', it.category === 'med')}</select>
      <button type="button" class="icon-btn" data-f="del" aria-label="${esc(t('delete'))} ${esc(it.name)}"><span class="ms" aria-hidden="true">delete</span></button>
    </div>`).join('') + `
    <form class="ed-add" id="fh-add">
      <input type="text" name="name" placeholder="${esc(t('item_name'))}" aria-label="${esc(t('item_name'))}" required>
      <select name="cat" aria-label="${esc(t('food'))} / ${esc(t('med'))}">${opt('food', true)}${opt('med', false)}</select>
      <button class="btn primary small" type="submit"><span class="ms" aria-hidden="true">add</span>${esc(t('add_item'))}</button>
    </form>
    <div class="trow" style="margin-top:12px">
      <button type="button" class="btn text" id="fh-local-demo"><span class="ms" aria-hidden="true">science</span>${esc(t('demo_local'))}</button>
      ${items.length ? `<button type="button" class="btn text danger" id="fh-clear"><span class="ms" aria-hidden="true">delete_sweep</span>${esc(t('clear_all'))}</button>` : ''}
    </div>`

  body.querySelectorAll<HTMLElement>('.ed-row').forEach((row) => {
    const id = row.dataset.id!
    const it = () => items.find((x) => x.id === id)
    row.querySelector<HTMLInputElement>('[data-f=name]')!.addEventListener('change', (e) => {
      const cur = it(); if (!cur) return
      const name = (e.target as HTMLInputElement).value.trim()
      if (!name) return
      cur.name = name
      if (cur.category === 'food') { delete cur.foodClass } // re-classify from the new name
      saveItems(); renderEditor(); recompute(true)
      if (cur.category === 'med' && !cur.limit) void lookupMed(cur)
    })
    row.querySelector<HTMLSelectElement>('[data-f=cat]')!.addEventListener('change', (e) => {
      const cur = it(); if (!cur) return
      cur.category = (e.target as HTMLSelectElement).value === 'med' ? 'med' : 'food'
      delete cur.foodClass; delete cur.limit
      saveItems(); renderEditor(); recompute(true)
      if (cur.category === 'med') void lookupMed(cur)
    })
    row.querySelector('[data-f=del]')!.addEventListener('click', () => {
      items = items.filter((x) => x.id !== id)
      saveItems(); renderEditor(); recompute(true)
    })
  })
  body.querySelector<HTMLFormElement>('#fh-add')!.addEventListener('submit', (e) => {
    e.preventDefault()
    const f = e.target as HTMLFormElement
    const name = (f.elements.namedItem('name') as HTMLInputElement).value.trim()
    const cat = (f.elements.namedItem('cat') as HTMLSelectElement).value === 'med' ? 'med' : 'food'
    if (!name) return
    const it: WebItem = { id: uid(cat === 'med' ? 'm' : 'f'), name, category: cat, source: 'user' }
    items = [...items, it]
    saveItems(); renderEditor(); recompute(true)
    ;(det as HTMLDetailsElement).open = true
    if (cat === 'med') void lookupMed(it)
  })
  body.querySelector('#fh-local-demo')!.addEventListener('click', () => {
    items = demoItems()
    lastRead = { model: 'demo', provider: 'demo', fallback: false, at: new Date().toISOString() }
    void kvSet('lastRead', lastRead)
    note = null
    saveItems(); renderStatus(); renderEditor(); recompute(true)
  })
  body.querySelector('#fh-clear')?.addEventListener('click', () => {
    items = []; lastRead = null; saveItems(); renderEditor(); recompute(true)
  })
}

/** Manually added medicine: ask the server for the openFDA storage rule (online only; found:false → stays UNKNOWN). */
async function lookupMed(it: WebItem): Promise<void> {
  const r = await openfdaLabel(it.brandText || it.name)
  if (!r?.limit || r.found === false) return
  const cur = items.find((x) => x.id === it.id)
  if (!cur || cur.category !== 'med') return
  cur.limit = r.limit
  cur.source = r._source ?? 'openFDA'
  saveItems(); recompute(true)
}

// ---------- photo → items ----------
async function readPhoto(file: File, freezer = false, meds = false): Promise<void> {
  busy = true; note = null; renderStatus()
  try {
    const { base64, mime } = await downscale(file, 1280, 0.85)
    const r = await visionItems(base64, mime, freezer ? 'fridge' : meds ? 'meds' : 'any')
    await ingest([freezer ? toFreezer(r) : r])
  } catch (e) {
    console.error(e)
    note = { text: t('fh_read_fail'), kind: 'error' }
  } finally {
    busy = false
    renderStatus(); renderEditor(); recompute(true)
  }
}

export type SampleKind = 'fridge' | 'freezer' | 'meds'

/** Every food item read from a freezer photo is in the freezer: the engine then runs the freezer clock (48 h full / 24 h half).
 *  Fridge-style food classes are dropped so the engine re-classifies the name with location = freezer. */
function toFreezer(r: Awaited<ReturnType<typeof visionItems>>): Awaited<ReturnType<typeof visionItems>> {
  return {
    ...r,
    items: r.items.map((it) => {
      if (it.category === 'med' || /med/i.test(String(it.category))) return it
      const fc = String(it.foodClass ?? '')
      const out: WebItem = { ...it, location: 'freezer', frozen: true }
      if (!fc.startsWith('frozen')) delete out.foodClass
      return out
    }),
  }
}

/** Everything in a fridge photo is in the fridge: the vision model says "shelf" for a fridge shelf, which would land in Pantry. */
function toFridge(r: Awaited<ReturnType<typeof visionItems>>): Awaited<ReturnType<typeof visionItems>> {
  return { ...r, items: r.items.map((it) => (it.category === 'med' || /med/i.test(String(it.category)) || it.location === 'door' || it.location === 'freezer' ? it : { ...it, location: 'fridge' })) }
}

/** "Try demo photo" sheet: send one bundled sample photo through /api/vision/items for real. Scanning a sample replaces only
 *  that sample's own category (fridge items, freezer items, or medicines); everything else stays. Returns the item names. */
export async function scanSample(kind: SampleKind, base64: string, mime: string): Promise<{ names: string[]; fallback: boolean }> {
  busy = true; note = null; if (root) renderStatus()
  try {
    let r = await visionItems(base64, mime, kind === 'meds' ? 'meds' : 'fridge')
    if (r._fallback) {
      // offline / no server: the bundled demo list, cut to this sample's category
      const all = demoItems()
      const pick = all.filter((x) => kind === 'meds' ? x.category === 'med' : x.category === 'food' && (kind === 'freezer') === (catOf(x) === 'freezer'))
      r = { ...r, items: pick }
    }
    if (kind === 'freezer') r = toFreezer(r)
    if (kind === 'fridge' && !r._fallback) r = toFridge(r)
    const drop = (it: WebItem) => kind === 'meds' ? it.category === 'med' : kind === 'freezer' ? catOf(it) === 'freezer' : it.category !== 'med' && catOf(it) === 'fridge'
    items = items.filter((x) => !drop(x) && (x as WebItem & { capture?: string }).capture !== kind)
    const before = new Set(items.map((x) => x.id))
    await ingest([r])
    for (const it of items) if (!before.has(it.id)) (it as WebItem & { capture?: string }).capture = kind
    saveItems()
    if (r._fallback) note = { text: t('demo_items_fallback'), kind: 'warn' }
    const names = items.filter((x) => !before.has(x.id)).map((x) => x.name)
    return { names, fallback: !!r._fallback }
  } finally {
    busy = false
    if (root) { renderStatus(); renderEditor(); recompute(true) }
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] ?? '')
    r.onerror = () => rej(r.error)
    r.readAsDataURL(blob)
  })
}

async function ingest(results: Awaited<ReturnType<typeof visionItems>>[], replace = false): Promise<void> {
  const fresh = results.flatMap((r) => r.items.map(normalizeVisionItem).filter((x): x is WebItem => !!x))
  const last = results[results.length - 1]
  const fallback = results.some((r) => r._fallback)
  if (fallback) note = { text: t('demo_items_fallback'), kind: 'warn' }
  else if (!fresh.length) note = { text: t('fh_none_found'), kind: 'info' }
  // Same product + category + location from a new scan replaces the old card instead of adding a second one.
  const key = (x: WebItem) => `${x.category}|${String(x.location ?? '').toLowerCase()}|${String(x.name).toLowerCase().replace(/\s+/g, ' ').trim()}`
  const freshKeys = new Set(fresh.map(key))
  items = replace ? fresh : [...items.filter((x) => !freshKeys.has(key(x))), ...fresh]
  const latency = results.reduce((a, r) => a + (r._latencyMs ?? 0), 0)
  lastRead = { model: last._model, provider: last._provider ?? state.health?.provider ?? '', latencyMs: latency || undefined, fallback, unreadable: results.reduce((a, r) => a + (r.unreadableCount ?? 0), 0) || undefined, at: new Date().toISOString() }
  if (!fallback && last._model && last._model !== 'demo') { state.lastModel = last._model; emit('health') }
  void kvSet('lastRead', lastRead)
  saveItems()
  // meds without a rule: try openFDA in the background
  fresh.filter((x) => x.category === 'med' && !x.limit).forEach((x) => void lookupMed(x))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeVisionItem(raw: any): WebItem | null {
  if (!raw || typeof raw !== 'object') return null
  const name = String(raw.name ?? raw.brand_name ?? raw.generic_name ?? raw.label_text ?? '').trim()
  if (!name) return null
  const catRaw = String(raw.category ?? raw.kind ?? '').toLowerCase()
  const category: 'food' | 'med' = /med/.test(catRaw) ? 'med' : 'food'
  return { ...raw, id: uid(category === 'med' ? 'm' : 'f'), name, category }
}

/** Long edge ≤ maxPx, JPEG, base64 without the data: prefix. */
async function downscale(file: File, maxPx: number, quality: number): Promise<{ base64: string; mime: string }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('image decode failed'))
      i.src = url
    })
    const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    c.getContext('2d')!.drawImage(img, 0, 0, w, h)
    const dataUrl = c.toDataURL('image/jpeg', quality)
    return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mime: 'image/jpeg' }
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ---------- Home screen hooks (capture-first): the Home cards feed this same item list + IndexedDB store ----------
export type Snap = { thumb: string | null; count: number; at: string }

/** Read one Home-card photo with the fridge/meds hint. Items from an earlier photo of the same card are replaced. */
export async function captureFromHome(file: File, hint: 'fridge' | 'meds' | 'freezer'): Promise<Snap> {
  busy = true; note = null; if (root) renderStatus()
  try {
    const [{ base64, mime }, small] = await Promise.all([downscale(file, 1280, 0.85), downscale(file, 360, 0.7)])
    const raw = await visionItems(base64, mime, hint === 'freezer' ? 'fridge' : hint)
    const r = hint === 'freezer' ? toFreezer(raw) : hint === 'fridge' && !raw._fallback ? toFridge(raw) : raw
    const before = new Set(items.map((x) => x.id))
    items = items.filter((x) => (x as WebItem & { capture?: string }).capture !== hint)
    await ingest([r])
    let count = 0
    for (const it of items) if (!before.has(it.id)) { (it as WebItem & { capture?: string }).capture = hint; count++ }
    saveItems()
    const snap: Snap = { thumb: `data:image/jpeg;base64,${small.base64}`, count, at: new Date().toISOString() }
    void kvSet('snap.' + hint, snap, 'user')
    return snap
  } finally {
    busy = false
    if (root) { renderStatus(); renderEditor(); recompute(true) }
  }
}

/** "The power just went out": outage starts now, door count resets. */
export function powerOutNow(): void {
  powerOn = false
  outage = { ...outage, startedAt: new Date().toISOString(), doorOpenedAt: [] }
  saveOutage()
  if (root) { renderControls(); recompute(true) }
}
