// "Try demo photo" → a bottom sheet of the bundled sample photos (fridge, freezer, medicine). Pick one, see it full width,
// press "Scan this photo": a light sweep runs over the photo while /api/vision/items reads it for real, then the items it
// found pop in one by one as chips, the sheet closes and the Clocks cards update. A sample whose file 404s is hidden.
import { scanSample, type SampleKind } from './fourhour'
import { t } from './i18n'
import { openSheet, type Sheet } from './sheet'
import { esc, haptic, reducedMotion } from './util'

const SAMPLES: { k: SampleKind; src: string; label: string; icon: string }[] = [
  { k: 'fridge', src: '/demo/fridge.jpg', label: 'cat_fridge', icon: 'kitchen' },
  { k: 'freezer', src: '/demo/freezer.jpg', label: 'cat_freezer', icon: 'ac_unit' },
  { k: 'meds', src: '/demo/meds-label.png', label: 'cat_meds', icon: 'medication' },
]

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function openSamples(): void {
  openSheet(t('samples_title'), '', (body, sheet) => renderGrid(body, sheet))
}

function renderGrid(body: HTMLElement, sheet: Sheet): void {
  sheet.setTitle(t('samples_title'))
  body.innerHTML = `<p class="smp-lead">${esc(t('samples_lead'))}</p>
    <div class="smp-grid">${SAMPLES.map((s) => `
      <button type="button" class="smp-tile" data-k="${s.k}">
        <img src="${esc(s.src)}" alt="${esc(t(s.label))}" decoding="async">
        <span class="smp-lbl"><span class="ms" aria-hidden="true">${s.icon}</span>${esc(t(s.label))}</span>
      </button>`).join('')}</div>
    <p class="smp-none hidden">${esc(t('samples_none'))}</p>`
  const check = () => { if (!body.querySelector('.smp-tile')) body.querySelector('.smp-none')?.classList.remove('hidden') }
  body.querySelectorAll<HTMLButtonElement>('.smp-tile').forEach((b) => {
    const img = b.querySelector('img')!
    img.addEventListener('error', () => { b.remove(); check() })
    b.addEventListener('click', () => { haptic(); renderOne(body, sheet, SAMPLES.find((s) => s.k === b.dataset.k)!) })
  })
}

function renderOne(body: HTMLElement, sheet: Sheet, s: (typeof SAMPLES)[number]): void {
  sheet.setTitle(t(s.label))
  body.innerHTML = `
    <div class="smp-stage" id="smp-stage">
      <img src="${esc(s.src)}" alt="${esc(t(s.label))}">
      <div class="smp-sweep" aria-hidden="true"><i></i></div>
      <div class="smp-reading" aria-hidden="true"><span class="spinner"></span>${esc(t('snap_reading'))}</div>
    </div>
    <div class="smp-found hidden" aria-live="polite"><div class="smp-found-h"></div><div class="smp-chips"></div></div>
    <button type="button" class="btn primary block smp-go" id="smp-go"><span class="ms" aria-hidden="true">document_scanner</span>${esc(t('scan_this'))}</button>
    <button type="button" class="btn text block smp-back" id="smp-back"><span class="ms" aria-hidden="true">chevron_left</span>${esc(t('samples_back'))}</button>`
  body.scrollTop = 0
  body.querySelector('#smp-back')!.addEventListener('click', () => renderGrid(body, sheet))
  body.querySelector('#smp-go')!.addEventListener('click', () => { haptic(); void run(body, sheet, s) })
}

async function run(body: HTMLElement, sheet: Sheet, s: (typeof SAMPLES)[number]): Promise<void> {
  const stage = body.querySelector<HTMLElement>('#smp-stage')!
  const go = body.querySelector<HTMLButtonElement>('#smp-go')!
  const back = body.querySelector<HTMLButtonElement>('#smp-back')!
  go.disabled = true; back.classList.add('hidden')
  go.innerHTML = `<span class="spinner" aria-hidden="true"></span>${esc(t('snap_reading'))}`
  stage.classList.add('scanning')
  const started = Date.now()
  let res: { names: string[]; fallback: boolean } | null = null
  try {
    const { base64, mime } = await loadAsJpeg(s.src)
    res = await scanSample(s.k, base64, mime)
  } catch (e) {
    console.error('sample scan failed', e)
  }
  const minMs = reducedMotion() ? 0 : 1800 // let the sweep read on stage even when the answer is instant
  if (Date.now() - started < minMs) await wait(minMs - (Date.now() - started))
  if (!sheet.el.isConnected) return
  stage.classList.remove('scanning')
  stage.classList.add('scanned')
  const found = body.querySelector<HTMLElement>('.smp-found')!
  const chips = found.querySelector<HTMLElement>('.smp-chips')!
  found.classList.remove('hidden')
  requestAnimationFrame(() => body.scrollTo({ top: body.scrollHeight, behavior: reducedMotion() ? 'auto' : 'smooth' }))
  if (!res || !res.names.length) {
    found.querySelector('.smp-found-h')!.textContent = t(res ? 'fh_none_found' : 'fh_read_fail')
    go.disabled = false
    go.innerHTML = `<span class="ms" aria-hidden="true">refresh</span>${esc(t('scan_again'))}`
    back.classList.remove('hidden')
    return
  }
  const n = res.names.length
  found.querySelector('.smp-found-h')!.textContent = n === 1 ? t('item_saved') : t('items_saved', { n })
  go.classList.add('hidden')
  const step = reducedMotion() ? 0 : Math.max(140, Math.min(320, 2400 / n))
  for (const name of res.names) {
    const c = document.createElement('span')
    c.className = 'smp-chip'
    c.innerHTML = `<span>${esc(name)}</span><span class="ms fill" aria-hidden="true">check_circle</span>`
    chips.appendChild(c)
    chips.scrollTop = chips.scrollHeight
    body.scrollTop = body.scrollHeight
    if (step) { haptic(); await wait(step) }
  }
  await wait(reducedMotion() ? 600 : 1600)
  if (!sheet.el.isConnected) return
  sheet.close()
  if (location.hash !== '#fourhour') location.hash = 'fourhour'
  setTimeout(() => document.getElementById('fh-cats')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }), 450)
}

/** Fetch a bundled sample and re-encode it as JPEG, long edge ≤ 1280 px, base64 without the data: prefix. */
async function loadAsJpeg(src: string): Promise<{ base64: string; mime: string }> {
  const blob = await fetch(src).then((r) => { if (!r.ok) throw new Error(`${src} ${r.status}`); return r.blob() })
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('decode')); i.src = url })
    const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(img.naturalWidth * scale)); c.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0, c.width, c.height)
    const d = c.toDataURL('image/jpeg', 0.88)
    return { base64: d.slice(d.indexOf(',') + 1), mime: 'image/jpeg' }
  } finally { URL.revokeObjectURL(url) }
}
