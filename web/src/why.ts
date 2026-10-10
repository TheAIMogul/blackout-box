// "Why" tab: a keynote-style story page (Apple product page × Airbnb warmth). Full-bleed photo cards for the problem,
// who it helps, what it does, why Miami, and a closing line + the safety statement. Every number comes from why-data.ts
// (verified, cited, linked) and counts up when it scrolls into view; reduced motion shows the final value at once.
import { getLang, onLang, t } from './i18n'
import { iconHTML, media, onMedia, stillSrc } from './media'
import { esc, reducedMotion } from './util'
import { STATS, type WhyStat } from './why-data'

let host: HTMLElement
let io: IntersectionObserver | null = null

export function mountWhy(el: HTMLElement): void {
  host = el
  render()
  onLang(render)
  onMedia(render)
}

function bg(use: string): string {
  const m = media(use)
  return m ? `<img class="why-bg" src="${esc(stillSrc(m))}" alt="" aria-hidden="true" loading="lazy" decoding="async" onerror="this.remove()">` : ''
}

const locale = () => (getLang() === 'es' ? 'es-US' : 'en-US')
function fmt(s: WhyStat, v: number): string {
  const d = s.decimals ?? 0
  return (s.prefix ?? '') + new Intl.NumberFormat(locale(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(v) + (s.suffix ?? '')
}

function stat(id: keyof typeof STATS, size = ''): string {
  const s = STATS[id]
  return `<figure class="why-stat ${size}">
    <div class="why-num" data-stat="${s.id}" aria-label="${esc(fmt(s, s.value))}">${esc(fmt(s, reducedMotion() ? s.value : 0))}</div>
    <figcaption><span class="why-lbl">${esc(t(s.label))}</span>
    <a class="why-src" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(t('why_src'))}: ${esc(s.source)}<span class="ms" aria-hidden="true">north_east</span></a></figcaption>
  </figure>`
}

function render(): void {
  if (!host) return
  const who: [string, string][] = [['elderly', 'why_w1'], ['vaccines', 'why_w2'], ['child_care', 'why_w3'], ['translate', 'why_w4'], ['home_pin', 'why_w5']]
  const feats: [string[], string, string, string][] = [
    [['icon.fridge'], 'photo_camera', 'why_f1', 'why_f1s'],
    [[], 'wifi_off', 'why_f2', 'why_f2s'],
    [['icon.wind', 'icon.rain'], 'cyclone', 'why_f3', 'why_f3s'],
    [['icon.zone'], 'home_pin', 'why_f4', 'why_f4s'],
    [['icon.map'], 'bolt', 'why_f5', 'why_f5s'],
    [['icon.tide'], 'water', 'why_f6', 'why_f6s'],
    [['icon.chat'], 'translate', 'why_f7', 'why_f7s'],
  ]
  host.innerHTML = `<div class="why">
    <section class="why-sec dark">
      ${bg('now.hero.storm')}<div class="why-in">
        <p class="why-k">${esc(t('why_k1'))}</p>
        <h2 class="why-h">${esc(t('why_h1'))}</h2>
        <p class="why-p">${esc(t('why_p1a'))}</p><p class="why-p">${esc(t('why_p1b'))}</p><p class="why-p">${esc(t('why_p1c'))}</p>
        <div class="why-stats">${stat('irmaFlorida', 'xl')}${stat('irmaMiamiDade')}</div>
      </div>
    </section>
    <section class="why-sec dark">
      ${bg('now.hero.heat')}<div class="why-in">
        <p class="why-k">${esc(t('why_k2'))}</p>
        <h2 class="why-h">${esc(t('why_h2'))}</h2>
        <ul class="why-who">${who.map(([ic, k]) => `<li><span class="ms" aria-hidden="true">${ic}</span>${esc(t(k))}</li>`).join('')}</ul>
        <div class="why-stats two">${stat('language')}${stat('diabetes')}</div>
      </div>
    </section>
    <section class="why-sec light">
      <div class="why-in">
        <p class="why-k">${esc(t('why_k3'))}</p>
        <h2 class="why-h">${esc(t('why_h3'))}</h2>
        <div class="why-snap">${iconHTML(['icon.fridge'], 'kitchen', 'mi why-mi')}${iconHTML(['icon.freezer'], 'ac_unit', 'mi why-mi')}${iconHTML(['icon.medicine'], 'medication', 'mi why-mi')}</div>
        <div class="why-feats">${feats.map(([uses, fb, h, sub]) => `<div class="why-feat">${iconHTML(uses, fb, 'mi why-fi')}<div><b>${esc(t(h))}</b><span>${esc(t(sub))}</span></div></div>`).join('')}</div>
      </div>
    </section>
    <section class="why-sec dark">
      ${bg('now.hero.kingtide')}<div class="why-in">
        <p class="why-k">${esc(t('why_k4'))}</p>
        <h2 class="why-h">${esc(t('why_h4'))}</h2>
        <div class="why-stats grid">${stat('population')}${stat('evacIrma')}${stat('heatDays')}${stat('heatStreak')}${stat('heatDeaths')}</div>
      </div>
    </section>
    <section class="why-sec dark end">
      ${bg('now.hero.blackout')}<div class="why-in">
        <p class="why-k">${esc(t('why_k5'))}</p>
        <h2 class="why-h big">${esc(t('why_h5'))}</h2>
        <p class="why-p lead">${esc(t('why_p5'))}</p>
        <p class="why-safety"><span class="ms" aria-hidden="true">health_and_safety</span><span>${esc(t('footer'))}</span></p>
      </div>
    </section>
  </div>`
  observe()
}

function observe(): void {
  io?.disconnect()
  const nums = host.querySelectorAll<HTMLElement>('[data-stat]')
  if (reducedMotion() || typeof IntersectionObserver !== 'function') {
    nums.forEach((n) => { const s = STATS[n.dataset.stat!]; if (s) n.textContent = fmt(s, s.value) })
    return
  }
  io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      io?.unobserve(e.target)
      countUp(e.target as HTMLElement)
    }
  }, { threshold: 0.5 })
  nums.forEach((n) => io!.observe(n))
}

function countUp(el: HTMLElement): void {
  const s = STATS[el.dataset.stat!]
  if (!s) return
  const dur = 1400
  const t0 = performance.now()
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / dur)
    const eased = 1 - Math.pow(1 - p, 3)
    const v = p >= 1 ? s.value : s.value * eased
    el.textContent = fmt(s, (s.decimals ?? 0) ? v : Math.round(v))
    if (p < 1 && el.isConnected) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
