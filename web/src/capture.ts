// Capture-first cards in the Now hero (redline 1:45 PM, mockup 1:52 PM): "Snap your fridge" / "Snap your medicine" / "Snap your freezer" (freezer: fridge hint, location forced to freezer).
// Each opens the camera, reads the photo through /api/vision/items (hint fridge / meds), saves the items to the same
// IndexedDB store the Clocks screen uses, then shows "12 items saved" + "Open Clocks". A downscaled thumbnail of the
// photo is kept in IndexedDB kv. Under them: "The power just went out" starts the clocks and opens Clocks.
// now.ts re-renders its hero often, so the file inputs live on <body> and this module re-paints into each new slot.
import { kvGet } from './db'
import { captureFromHome, powerOutNow, type Snap } from './fourhour'
import { onLang, t } from './i18n'
import { iconHTML, onMedia } from './media'
import { esc, haptic } from './util'

type Kind = 'fridge' | 'meds' | 'freezer'
const KINDS: Kind[] = ['fridge', 'meds', 'freezer']
const snaps: Record<Kind, Snap | null> = { fridge: null, meds: null, freezer: null }
const busy: Record<Kind, boolean> = { fridge: false, meds: false, freezer: false }
const TITLE: Record<Kind, string> = { fridge: 'snap_fridge', meds: 'snap_meds', freezer: 'snap_freezer' }
const ART: Record<Kind, [string, string]> = { fridge: ['icon.fridge', 'kitchen'], meds: ['icon.medicine', 'medication'], freezer: ['icon.freezer', 'ac_unit'] }
let err = ''
let slot: HTMLElement | null = null
let outSlot: HTMLElement | null = null
let inited = false

function init(): void {
  if (inited) return
  inited = true
  ;KINDS.forEach((k) => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'; input.setAttribute('capture', 'environment')
    input.id = `snap-file-${k}`; input.className = 'hidden'
    input.addEventListener('change', () => { const f = input.files?.[0]; input.value = ''; if (f) void capture(k, f) })
    document.body.appendChild(input)
  })
  void Promise.all(KINDS.map((k) => kvGet<Snap>('snap.' + k))).then(([f, m, z]) => {
    snaps.fridge = f?.value ?? null; snaps.meds = m?.value ?? null; snaps.freezer = z?.value ?? null; render()
  })
  onLang(render)
  onMedia(render)
}

/** Paint the two snap cards into their hero slot. */
export function paintSnaps(el: HTMLElement): void {
  init()
  slot = el
  render()
}

/** Paint "The power just went out ›" (frosted full-width pill under the Now subtitle). */
export function paintOut(el: HTMLElement): void {
  init()
  outSlot = el
  render()
}

async function capture(k: Kind, file: File): Promise<void> {
  busy[k] = true; err = ''; render()
  try { snaps[k] = await captureFromHome(file, k) } catch (e) { console.error(e); err = t('fh_read_fail') }
  busy[k] = false; render()
}

function button(k: Kind, reserve: boolean): string {
  const s = snaps[k]
  const title = t(TITLE[k])
  const art = s?.thumb
    ? `<img class="snap-thumb" src="${esc(s.thumb)}" alt="">`
    : iconHTML([ART[k][0]], ART[k][1], 'mi snap-mi')
  const foot = busy[k]
    ? `<span class="spinner" aria-hidden="true"></span>${esc(t('snap_reading'))}`
    : s
      ? `<span class="ms fill ok" aria-hidden="true">check_circle</span>${esc(s.count === 1 ? t('item_saved') : t('items_saved', { n: s.count }))}`
      : `<span class="ms" aria-hidden="true">photo_camera</span>${esc(t('snap_hint'))}`
  return `<div class="snap snap-${k}">
    <button type="button" class="snap-btn${s ? ' done' : ''}" data-snap="${k}" ${busy[k] ? 'aria-busy="true"' : ''}>
      <span class="snap-art">${art}</span>
      <span class="snap-title">${esc(title)}</span>
      <span class="snap-foot">${foot}</span>
    </button>
    ${s && !busy[k] ? `<a class="snap-open" href="#fourhour">${esc(t('open_clocks'))}<span class="ms" aria-hidden="true">chevron_right</span></a>` : reserve ? '<span class="snap-open ph" aria-hidden="true">&nbsp;</span>' : ''}
  </div>`
}

function render(): void {
  if (outSlot?.isConnected) {
    outSlot.innerHTML = `<button type="button" class="out-btn" data-out><span class="ms fill" aria-hidden="true">power_off</span><span>${esc(t('power_went_out'))}</span><span class="ms" aria-hidden="true">chevron_right</span></button>`
    outSlot.querySelector('[data-out]')!.addEventListener('click', () => { haptic(); powerOutNow(); location.hash = 'fourhour' })
  }
  if (!slot || !slot.isConnected) return
  slot.innerHTML = `
    <div class="snaps">${button('fridge', !!snaps.meds)}${button('meds', !!snaps.fridge)}${button('freezer', false)}</div>
    ${err ? `<div class="banner error snap-err"><span class="ms" aria-hidden="true">error</span><span>${esc(err)}</span></div>` : ''}`
  slot.querySelectorAll<HTMLButtonElement>('[data-snap]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.snap as Kind
    if (busy[k]) return
    haptic()
    document.getElementById(`snap-file-${k}`)?.click()
  }))
}
