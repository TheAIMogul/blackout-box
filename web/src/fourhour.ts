// The 4-Hour Rule screen: photo → /api/vision/items → assess() → live countdown cards.
// Console-style layout (CONTRACT.md "Visual style"): page header with actions, a filter-like toolbar
// for the outage controls, then a grid of countdown cards. Items, outage and indoor temp live in
// IndexedDB, so an offline reload still shows the clocks.
import { demoItems, openfdaLabel, placeholderJpeg, visionItems } from './api'
import { itemsAll, itemsReplace, kvGet, kvSet } from './db'
import { runAssess, type NV, type Status, type WebEnv, type WebItem, type WebOutage } from './engine'
import { onLang, t } from './i18n'
import { emit, esc, fmtClock, modelMeta, on, state, toLocalInput, uid } from './util'

type LastRead = { model: string; provider: string; latencyMs?: number; fallback?: boolean; unreadable?: number; at: string }

let items: WebItem[] = []
let outage: WebOutage = { startedAt: new Date(Date.now() - 3 * 36e5).toISOString(), doorOpenedAt: [], freezerFull: true }
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
  else void kvSet('outage', outage, 'user')
  indoorTempF = savedEnv?.value?.indoorTempF ?? null
  lastRead = savedRead?.value ?? null

  renderShell()
  onLang(() => renderShell())
  on('prep', () => { renderControls(); recompute(true) })
  setInterval(() => recompute(false), 1000)
}

// ---------- persistence ----------
function saveItems(): void { void itemsReplace(items); state.items = items; emit('items') }
function saveOutage(): void { void kvSet('outage', outage, 'user') }
function saveEnv(): void { void kvSet('env', { indoorTempF }, 'user') }

// ---------- env / estimate ----------
function hoursOut(): number { return Math.max(0, (Date.now() - Date.parse(outage.startedAt)) / 36e5) }

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
function renderShell(): void {
  root.innerHTML = `
    <div class="page-head">
      <h1>${esc(t('fh_title'))}</h1>
      <div class="actions">
        <button type="button" class="btn primary" id="fh-photo"><span class="ms" aria-hidden="true">photo_camera</span>${esc(t('fh_photo'))}</button>
        <button type="button" class="btn" id="fh-demo"><span class="ms" aria-hidden="true">image</span>${esc(t('fh_demo'))}</button>
      </div>
      <input type="file" accept="image/*" capture="environment" id="fh-file" class="hidden">
    </div>
    <p class="page-sub">${esc(t('fh_sub'))}</p>
    <div id="fh-status"></div>
    <div class="toolbar" id="fh-ctrls" role="group" aria-label="${esc(t('power_out'))}"></div>
    <div class="cards" id="fh-cards" aria-live="off"></div>
    <div class="model-line" id="fh-model"></div>
    <details class="editor card" id="fh-editor"><summary></summary><div class="ed-body" id="fh-ed-body"></div></details>`

  const file = root.querySelector<HTMLInputElement>('#fh-file')!
  root.querySelector('#fh-photo')!.addEventListener('click', () => file.click())
  file.addEventListener('change', () => { const f = file.files?.[0]; file.value = ''; if (f) void readPhoto(f) })
  root.querySelector('#fh-demo')!.addEventListener('click', () => void demoPhoto())

  renderStatus()
  renderControls()
  renderEditor()
  recompute(true)
}

function renderStatus(): void {
  const el = root.querySelector('#fh-status')
  if (!el) return
  const icon = (k: string) => (k === 'error' ? 'error' : k === 'warn' ? 'warning' : 'info')
  el.innerHTML = (busy ? `<div class="progress" role="progressbar" aria-label="${esc(t('fh_reading'))}"><i></i></div><div class="banner"><span class="ms" aria-hidden="true">photo_camera</span><span>${esc(t('fh_reading'))}</span></div>` : '') +
    (note ? `<div class="banner ${note.kind === 'info' ? '' : note.kind}"><span class="ms" aria-hidden="true">${icon(note.kind)}</span><span>${esc(note.text)}</span></div>` : '')
  root.querySelectorAll<HTMLButtonElement>('#fh-photo, #fh-demo').forEach((b) => { b.disabled = busy })
}

function renderControls(): void {
  const el = root.querySelector('#fh-ctrls')
  if (!el) return
  const h = hoursOut()
  const env = currentEnv()
  const opens = outage.doorOpenedAt.length
  const c = env.indoorTempF != null ? Math.round(((env.indoorTempF - 32) * 5) / 9) : null
  el.innerHTML = `
    <div class="tgroup t-out">
      <div class="field">
        <input type="datetime-local" id="fh-start" value="${toLocalInput(Date.parse(outage.startedAt))}">
        <label for="fh-start">${esc(t('power_out'))}</label>
      </div>
      <input type="range" id="fh-hrs" min="0" max="72" step="0.25" value="${Math.min(72, h).toFixed(2)}" aria-label="${esc(t('power_out'))} · ${esc(t('hours_ago'))}">
      <div class="tval" id="fh-hrs-val">${h.toFixed(1)} <span class="small muted">${esc(t('hours_ago'))}</span></div>
    </div>
    <div class="tgroup">
      <div class="tlabel"><span class="ms" aria-hidden="true">kitchen</span>${esc(t('fridge_door'))}</div>
      <div class="trow">
        <button type="button" class="btn" id="fh-door"><span class="ms" aria-hidden="true">door_open</span>${esc(t('opened_fridge'))}</button>
        <span class="count" aria-label="${opens} ${esc(t('door_opens'))}">${opens}×</span>
        ${opens ? `<button type="button" class="btn text" id="fh-door-reset">${esc(t('reset'))}</button>` : ''}
      </div>
      <div class="tnote">${esc(t('door_penalty_note'))}</div>
    </div>
    <div class="tgroup">
      <div class="tlabel"><span class="ms" aria-hidden="true">ac_unit</span>${esc(t('freezer'))}</div>
      <div class="seg" role="group" aria-label="${esc(t('freezer'))}">
        <button type="button" data-frz="full" aria-pressed="${outage.freezerFull}"><span class="ms" aria-hidden="true">check</span>${esc(t('full'))}</button>
        <button type="button" data-frz="half" aria-pressed="${!outage.freezerFull}"><span class="ms" aria-hidden="true">check</span>${esc(t('half'))}</button>
      </div>
    </div>
    <div class="tgroup t-temp">
      <div class="trow" style="flex-wrap:nowrap">
        <div class="field" style="flex:1">
          <input type="number" inputmode="decimal" id="fh-temp" min="30" max="130" step="1" placeholder="${esc(env.estimated && env.indoorTempF != null ? '≈ ' + env.indoorTempF : t('temp_placeholder'))}" value="${indoorTempF ?? ''}">
          <label for="fh-temp">${esc(t('indoor_temp'))}</label>
        </div>
        <button type="button" class="chip" data-temp="84" aria-pressed="${indoorTempF === 84}">84°F</button>
        <button type="button" class="chip" data-temp="91" aria-pressed="${indoorTempF === 91}">91°F</button>
      </div>
      <div class="tnote">
        ${env.estimated ? `<span class="estimate">${esc(t('estimated'))}</span> ` : `<span class="estimate user">${esc(t('thermometer'))}</span> `}
        ${env.indoorTempF != null ? `${env.estimated ? '≈ ' : ''}${env.indoorTempF}°F (${c}°C)${env.estimated && state.prep?.nws?.tempF != null ? ` · NWS ${Math.round(state.prep.nws.tempF)}°F` : ''}` : esc(t('no_reading'))}
        ${indoorTempF != null ? ` · <button type="button" class="btn text" data-temp="" style="height:24px">${esc(t('reset'))}</button>` : ''}
      </div>
    </div>`

  const start = el.querySelector<HTMLInputElement>('#fh-start')!
  start.addEventListener('change', () => {
    const ms = Date.parse(start.value)
    if (Number.isFinite(ms)) { outage.startedAt = new Date(ms).toISOString(); saveOutage(); renderControls(); recompute(true) }
  })
  const hrs = el.querySelector<HTMLInputElement>('#fh-hrs')!
  hrs.addEventListener('input', () => {
    const v = parseFloat(hrs.value)
    outage.startedAt = new Date(Date.now() - v * 36e5).toISOString()
    start.value = toLocalInput(Date.parse(outage.startedAt))
    el.querySelector('#fh-hrs-val')!.innerHTML = `${v.toFixed(1)} <span class="small muted">${esc(t('hours_ago'))}</span>`
    recompute(true)
  })
  hrs.addEventListener('change', saveOutage)
  el.querySelector('#fh-door')!.addEventListener('click', () => {
    outage.doorOpenedAt = [...outage.doorOpenedAt, new Date().toISOString()]
    saveOutage(); renderControls(); recompute(true)
  })
  el.querySelector('#fh-door-reset')?.addEventListener('click', () => {
    outage.doorOpenedAt = []; saveOutage(); renderControls(); recompute(true)
  })
  el.querySelectorAll<HTMLButtonElement>('[data-frz]').forEach((b) => b.addEventListener('click', () => {
    outage.freezerFull = b.dataset.frz === 'full'; saveOutage(); renderControls(); recompute(true)
  }))
  const temp = el.querySelector<HTMLInputElement>('#fh-temp')!
  temp.addEventListener('change', () => {
    const v = parseFloat(temp.value)
    indoorTempF = Number.isFinite(v) ? v : null
    saveEnv(); renderControls(); recompute(true)
  })
  el.querySelectorAll<HTMLButtonElement>('[data-temp]').forEach((b) => b.addEventListener('click', () => {
    const v = parseFloat(b.dataset.temp ?? '')
    indoorTempF = Number.isFinite(v) ? v : null
    saveEnv(); renderControls(); recompute(true)
  }))
}

function recompute(force: boolean): void {
  try {
    verdicts = runAssess(items, outage, currentEnv(), new Date())
  } catch (e) {
    console.error('assess failed', e)
    verdicts = items.map((it) => ({ itemId: it.id, status: 'UNKNOWN' as Status, deadlineMs: null, reason: 'engine error', source: '' }))
  }
  state.verdicts = verdicts
  const sig = verdicts.map((v) => v.itemId + ':' + v.status).join('|')
  if (force || sig !== signature) {
    signature = sig
    renderCards()
  } else {
    tickClocks()
  }
}

function clockText(v: NV, now: number): { text: string; none: boolean } {
  if (OVER.includes(v.status)) return { text: t('over_limit'), none: false }
  if (v.deadlineMs == null) return { text: t('no_clock'), none: true }
  return { text: fmtClock(v.deadlineMs - now), none: false }
}

function pct(v: NV, now: number): number {
  if (OVER.includes(v.status)) return 100
  if (v.deadlineMs == null) return 100
  const total = v.allowanceH ? v.allowanceH * 36e5 : v.deadlineMs - Date.parse(outage.startedAt)
  if (!(total > 0)) return 100
  return Math.max(0, Math.min(100, (100 * (v.deadlineMs - now)) / total))
}

const INSULIN = /insulin|insulina|ensilin|lantus|humalog|novolog|humulin|levemir|tresiba|basaglar|toujeo|admelog|apidra|fiasp|lyumjev/i
/** Insulin past its label limit gets the FDA life-sustaining copy; other medicines get the generic line. */
function actKey(it: WebItem, cat: string, s: Status): string {
  if (cat === 'med' && s === 'PAST_LIMIT' && INSULIN.test(`${it.name} ${it.brandText ?? ''}`)) return 'act.insulin.PAST_LIMIT'
  return `act.${cat}.${s}`
}

function renderCards(): void {
  const el = root.querySelector('#fh-cards')
  if (!el) return
  const byId = new Map(items.map((i) => [i.id, i]))
  const now = Date.now()
  if (!items.length) {
    el.innerHTML = `<div class="empty" style="grid-column:1/-1"><span class="ms" aria-hidden="true">kitchen</span>${esc(t('fh_empty'))}</div>`
  } else {
    el.innerHTML = verdicts.map((v) => {
      const it = byId.get(v.itemId)
      if (!it) return ''
      const cat = it.category === 'med' ? 'med' : 'food'
      const c = clockText(v, now)
      const kind = (cat === 'med' ? t('med') : t('food')) + (it.location ? ' · ' + it.location : '') + (v.hint ? ' · ' + v.hint : '')
      const cite = v.url ? `<a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.source || t('cite'))}</a>` : esc(v.source)
      return `<article class="cd s-${v.status}" data-id="${esc(v.itemId)}">
        <div class="hd"><span class="ms" aria-hidden="true">${ICON[v.status]}</span><div><div class="nm">${esc(it.name)}</div><div class="kind">${esc(kind)}</div></div></div>
        <div class="clock${c.none ? ' none' : ''}" data-clock>${esc(c.text)}</div>
        <div class="bar"><i data-bar style="width:${pct(v, now).toFixed(1)}%"></i></div>
        <span class="stchip"><span class="ms" aria-hidden="true">${ICON[v.status]}</span>${esc(t('status.' + v.status))}</span>
        <div class="act">${esc(t(actKey(it, cat, v.status)))}</div>
        ${v.quote ? `<div class="quote">“${esc(v.quote.length > 180 ? v.quote.slice(0, 177).trimEnd() + '…' : v.quote)}”</div>` : ''}
        <div class="src">${esc(t('cite'))}: ${cite}${v.reason ? ` · ${esc(v.reason)}` : ''}</div>
      </article>`
    }).join('')
  }
  const ml = root.querySelector('#fh-model')
  if (ml) {
    if (!items.length || !lastRead) ml.innerHTML = ''
    else if (lastRead.model === 'demo' && lastRead.fallback) ml.innerHTML = `<span class="ms" aria-hidden="true">science</span><b>${esc(t('demo_items_fallback'))}</b>`
    else ml.innerHTML = `<span class="ms" aria-hidden="true">smart_toy</span>${esc(t('read_by'))} <b>${esc(modelMeta(lastRead.model, lastRead.latencyMs))}</b>${lastRead.unreadable ? ` · ${lastRead.unreadable} unreadable` : ''}`
  }
}

function tickClocks(): void {
  const now = Date.now()
  const byId = new Map(verdicts.map((v) => [v.itemId, v]))
  root.querySelectorAll<HTMLElement>('#fh-cards .cd').forEach((card) => {
    const v = byId.get(card.dataset.id ?? '')
    if (!v) return
    const c = clockText(v, now)
    const ck = card.querySelector<HTMLElement>('[data-clock]')
    if (ck && ck.textContent !== c.text) ck.textContent = c.text
    const bar = card.querySelector<HTMLElement>('[data-bar]')
    if (bar) bar.style.width = pct(v, now).toFixed(1) + '%'
  })
  const hv = root.querySelector('#fh-hrs-val')
  const slider = root.querySelector<HTMLInputElement>('#fh-hrs')
  if (hv && slider && document.activeElement !== slider && Math.floor(now / 1000) % 30 === 0) {
    const h = hoursOut()
    slider.value = Math.min(72, h).toFixed(2)
    hv.innerHTML = `${h.toFixed(1)} <span class="small muted">${esc(t('hours_ago'))}</span>`
  }
}

// ---------- item editor ----------
function renderEditor(): void {
  const det = root.querySelector('#fh-editor')
  if (!det) return
  det.querySelector('summary')!.innerHTML = `<span class="ms" aria-hidden="true">list</span>${esc(t('items'))} <span class="count">${items.length}</span><span class="grow" style="flex:1"></span><span class="ms chev" aria-hidden="true">expand_more</span>`
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
      <button class="btn primary" type="submit"><span class="ms" aria-hidden="true">add</span>${esc(t('add_item'))}</button>
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
async function readPhoto(file: File): Promise<void> {
  busy = true; note = null; renderStatus()
  try {
    const { base64, mime } = await downscale(file, 1280, 0.85)
    await ingest([await visionItems(base64, mime, 'any')])
  } catch (e) {
    console.error(e)
    note = { text: t('fh_read_fail'), kind: 'error' }
  } finally {
    busy = false
    renderStatus(); renderEditor(); recompute(true)
  }
}

/** "Try demo photo". Demo server: placeholder image, answered by hint. Live server: Claude reads the bundled
 *  pharmacy-label photo for real, and the sample fridge items fill in the food side. */
async function demoPhoto(): Promise<void> {
  busy = true; note = null; renderStatus()
  try {
    if (state.health?.provider && state.health.provider !== 'demo') {
      const label = await fetch('/demo/meds-label.png').then((r) => r.blob()).then(blobToBase64).catch(() => null)
      if (label) {
        const meds = await visionItems(label, 'image/png', 'meds')
        if (!meds._fallback && meds.items.length) {
          const fridge = { items: demoItems().filter((x) => x.category === 'food'), _model: meds._model, _provider: meds._provider }
          await ingest([fridge, meds], true)
          return
        }
      }
    }
    const img = placeholderJpeg()
    const fridge = await visionItems(img, 'image/jpeg', 'fridge')
    if (fridge._fallback) { await ingest([fridge], true); return } // offline: local demo list already has fridge + meds
    const meds = await visionItems(img, 'image/jpeg', 'meds')
    await ingest([fridge, meds], true)
  } finally {
    busy = false
    renderStatus(); renderEditor(); recompute(true)
  }
}

function blobToBase64(blob: Blob): Promise<string> {
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
  items = replace ? fresh : [...items, ...fresh]
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
