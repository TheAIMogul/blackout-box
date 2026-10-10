// First-screen tour: a dimmed overlay with a spotlight cut out around the real UI element for each step,
// and a floating card (bottom sheet on phones) with Back / Next / Skip. Shown on EVERY page load by design
// (no "seen" flag). Bypassed with ?tour=0 and under automation (navigator.webdriver).
// Skip, Esc and Start remove it instantly and return to the tab the user was on at load.
import { onLang, t } from './i18n'
import { esc, haptic } from './util'

type Step = {
  key: string
  /** tab to show for this step; null keeps the current tab */
  tab: string | null
  /** selectors tried in order; the first that exists is spotlighted. Empty = centered card, no spotlight */
  sel: string[][]
}

// Each inner array is a group: the spotlight is the union of every match in the group (Map + Ask tab items).
const STEPS: Step[] = [
  { key: 'tour_1', tab: 'now', sel: [] },
  { key: 'tour_2', tab: 'now', sel: [['.nh-snaps .snaps'], ['.nh-snaps']] },
  { key: 'tour_3', tab: 'now', sel: [['.nh-out .out-btn'], ['.nh-out']] },
  { key: 'tour_4', tab: 'fourhour', sel: [['#fh-hero'], ['#fh-demo'], ['#fh-cards']] },
  { key: 'tour_5', tab: 'prep', sel: [['#prep-go']] },
  { key: 'tour_6', tab: null, sel: [['#tabbar [data-tab="map"]', '#tabbar [data-tab="ask"]'], ['#tabbar']] },
  { key: 'tour_7', tab: null, sel: [] },
]

const WAIT_MS = 2500
const PAD = 8

let root: HTMLElement | null = null

function shouldRun(): boolean {
  if (navigator.webdriver) return false
  const q = new URLSearchParams(location.search).get('tour')
  return q !== '0'
}

const curTab = () => location.hash.replace('#', '') || 'now'
function goTab(tab: string): void {
  if (curTab() === tab) return
  // replace(), not assign: the tour should not fill the back stack with tab hops
  location.replace('#' + tab)
}

function find(groups: string[][]): HTMLElement[] {
  for (const g of groups) {
    const els = g.map((s) => document.querySelector<HTMLElement>(s)).filter((e): e is HTMLElement => {
      if (!e || !e.isConnected) return false
      const r = e.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    })
    if (els.length) return els
  }
  return []
}

/** Poll each frame until the step's target exists (tabs mount async), or give up after WAIT_MS. */
function waitFor(groups: string[][]): Promise<HTMLElement[]> {
  return new Promise((resolve) => {
    if (!groups.length) { resolve([]); return }
    const t0 = performance.now()
    const tick = () => {
      if (!root) { resolve([]); return }
      const els = find(groups)
      if (els.length) { resolve(els); return }
      if (performance.now() - t0 > WAIT_MS) { resolve([]); return }
      requestAnimationFrame(tick)
    }
    tick()
  })
}

function union(els: HTMLElement[]): DOMRect | null {
  if (!els.length) return null
  let l = Infinity, tp = Infinity, r = -Infinity, b = -Infinity
  for (const e of els) {
    const q = e.getBoundingClientRect()
    l = Math.min(l, q.left); tp = Math.min(tp, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom)
  }
  return new DOMRect(l, tp, r - l, b - tp)
}

const isFixed = (el: HTMLElement) => !!el.closest('#tabbar, #topbar, .safety')

export function startTour(): void {
  if (root || !shouldRun()) return
  const startTab = curTab()
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

  root = document.createElement('div')
  root.className = 'tour' + (reduce ? ' reduce' : '')
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  root.setAttribute('aria-labelledby', 'tour-title')
  root.innerHTML = `<div class="tour-dim" aria-hidden="true"></div><div class="tour-hole" aria-hidden="true"></div><div class="tour-card" tabindex="-1"></div>`
  // Outside <body>: body carries `zoom: 0.9`, and the spotlight math uses getBoundingClientRect in unzoomed viewport px.
  document.documentElement.append(root)
  document.documentElement.classList.add('touring')
  const dim = root.querySelector<HTMLElement>('.tour-dim')!
  const hole = root.querySelector<HTMLElement>('.tour-hole')!
  let lastKey = ''
  const card = root.querySelector<HTMLElement>('.tour-card')!

  let idx = 0
  let targets: HTMLElement[] = []
  let token = 0
  let raf = 0

  const close = () => {
    if (!root) return
    cancelAnimationFrame(raf)
    document.removeEventListener('keydown', onKey, true)
    offLang()
    root.remove(); root = null
    document.documentElement.classList.remove('touring')
    goTab(startTab)
    window.scrollTo({ top: 0 })
  }

  // Keep the spotlight glued to its element through scroll, resize, view transitions and late layout shifts.
  const place = () => {
    if (!root) return
    const r = union(targets.filter((e) => e.isConnected))
    const vh = window.innerHeight, vw = window.innerWidth
    if (r) {
      const top = Math.max(0, r.top - PAD), left = Math.max(0, r.left - PAD)
      const bottom = Math.min(vh, r.bottom + PAD), right = Math.min(vw, r.right + PAD)
      const w = Math.max(0, right - left), h = Math.max(0, bottom - top)
      const key = `${top}|${left}|${w}|${h}|${vw}|${vh}`
      if (key !== lastKey) {
        lastKey = key
        hole.style.cssText = `top:${top}px;left:${left}px;width:${w}px;height:${h}px`
        // Full-screen dim with a rounded-rect cut-out (even-odd fill), so the real element shows through.
        const rr = Math.min(22, w / 2, h / 2)
        dim.style.clipPath = `path(evenodd, "M0 0H${vw}V${vh}H0Z M${left + rr} ${top}H${right - rr}A${rr} ${rr} 0 0 1 ${right} ${top + rr}V${bottom - rr}A${rr} ${rr} 0 0 1 ${right - rr} ${bottom}H${left + rr}A${rr} ${rr} 0 0 1 ${left} ${bottom - rr}V${top + rr}A${rr} ${rr} 0 0 1 ${left + rr} ${top}Z")`
      }
      hole.classList.add('on')
      // Card goes on the side away from the target: low targets (the tab bar) push it to the top.
      const low = (r.top + r.bottom) / 2 > vh * 0.55
      card.classList.toggle('top', low)
      card.classList.remove('center')
    } else {
      if (lastKey) { lastKey = ''; dim.style.clipPath = 'none' }
      hole.classList.remove('on')
      card.classList.remove('top')
      card.classList.add('center')
    }
    raf = requestAnimationFrame(place)
  }

  const paint = () => {
    const s = STEPS[idx]
    const n = idx + 1, total = STEPS.length
    const last = idx === total - 1
    card.innerHTML = `
      <div class="tour-head">
        <div class="tour-dots" aria-hidden="true">${STEPS.map((_, i) => `<i class="${i === idx ? 'on' : i < idx ? 'done' : ''}"></i>`).join('')}</div>
        <span class="tour-count" aria-live="polite">${esc(t('tour_of', { n, total }))}</span>
        ${last ? '' : `<button type="button" class="tour-skip" data-skip>${esc(t('tour_skip'))}</button>`}
      </div>
      <h2 class="tour-title" id="tour-title">${esc(t(s.key + '_t'))}</h2>
      <p class="tour-body">${esc(t(s.key + '_b'))}</p>
      <div class="tour-actions">
        ${idx > 0 ? `<button type="button" class="btn tour-back" data-back><span class="ms" aria-hidden="true">chevron_left</span>${esc(t('tour_back'))}</button>` : '<span></span>'}
        ${last
          ? `<button type="button" class="btn primary tour-next" data-start>${esc(t('tour_start'))}<span class="ms" aria-hidden="true">arrow_forward</span></button>`
          : `<button type="button" class="btn primary tour-next" data-next>${esc(t('tour_next'))}<span class="ms" aria-hidden="true">chevron_right</span></button>`}
      </div>`
    card.querySelector('[data-skip]')?.addEventListener('click', () => { haptic(); close() })
    card.querySelector('[data-back]')?.addEventListener('click', () => { haptic(); void show(idx - 1, -1) })
    card.querySelector('[data-next]')?.addEventListener('click', () => { haptic(); void show(idx + 1, 1) })
    card.querySelector('[data-start]')?.addEventListener('click', () => { haptic(); close() })
    card.classList.remove('in'); void card.offsetWidth; card.classList.add('in')
    card.querySelector<HTMLElement>('.tour-next')?.focus({ preventScroll: true })
  }

  const show = async (i: number, dir: 1 | -1): Promise<void> => {
    if (!root) return
    if (i < 0) i = 0
    if (i >= STEPS.length) { close(); return }
    const my = ++token
    idx = i
    const s = STEPS[i]
    if (s.tab) goTab(s.tab)
    else if (i === STEPS.length - 1) goTab(startTab)
    targets = []
    paint()
    const els = await waitFor(s.sel)
    if (my !== token || !root) return
    if (s.sel.length && !els.length) {
      // Target never showed up: skip this step instead of blocking the app.
      void show(i + dir, dir)
      return
    }
    if (els.length && !els.some(isFixed)) {
      // Bring the target near the top so the bottom sheet card doesn't cover it.
      const r = union(els)!
      const offset = (document.getElementById('topbar')?.getBoundingClientRect().bottom ?? 80) + 24
      window.scrollTo({ top: Math.max(0, window.scrollY + r.top - offset), behavior: reduce ? 'auto' : 'smooth' })
    }
    targets = els
  }

  function onKey(e: KeyboardEvent): void {
    if (!root) return
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
    else if (e.key === 'ArrowRight') { e.preventDefault(); void show(idx + 1, 1) }
    else if (e.key === 'ArrowLeft' && idx > 0) { e.preventDefault(); void show(idx - 1, -1) }
    else if (e.key === 'Tab') {
      // keep focus inside the card
      const f = Array.from(card.querySelectorAll<HTMLElement>('button'))
      if (!f.length) return
      const a = document.activeElement
      if (e.shiftKey && a === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
      else if (!e.shiftKey && a === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
      else if (!card.contains(a)) { e.preventDefault(); f[0].focus() }
    }
  }
  document.addEventListener('keydown', onKey, true)
  const offLang = onLang(paint)

  raf = requestAnimationFrame(place)
  void show(0, 1)
}
