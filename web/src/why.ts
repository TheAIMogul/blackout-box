// "Why" tab: a keynote-style story page (Apple product page × Airbnb warmth). Full-bleed photo cards for the problem,
// who it helps, what it does, why Miami, and a closing line + the safety statement. Every number comes from why-data.ts
// (verified, cited, linked) and counts up when it scrolls into view; reduced motion shows the final value at once.
import { getLang, onLang, t } from './i18n'
import { iconHTML, media, onMedia, stillSrc } from './media'
import { esc, reducedMotion } from './util'
import { SOURCE_COUNT, SOURCES, STATS as BASE, type WhyStat } from './why-data'

const STATS: Record<string, WhyStat> = {
  ...BASE,
  sources: { id: 'sources', value: SOURCE_COUNT, label: 'why_data_lbl', source: '', url: '' },
}
const REPO = 'https://github.com/TheAIMogul/blackout-box'

let host: HTMLElement
let io: IntersectionObserver | null = null
let revealIo: IntersectionObserver | null = null

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

function howItWorks(): string {
  const steps: [string, string, string][] = [
    ['photo_camera', 'why_st1', 'why_st1s'],
    ['auto_awesome', 'why_st2', 'why_st2s'],
    ['rule', 'why_st3', 'why_st3s'],
    ['timer', 'why_st4', 'why_st4s'],
  ]
  const tiles: [string, string, string][] = [
    ['wifi_off', 'why_t1', 'why_t1s'],
    ['cloud', 'why_t2', 'why_t2s'],
    ['document_scanner', 'why_t3', 'why_t3s'],
    ['forum', 'why_t4', 'why_t4s'],
    ['calculate', 'why_t5', 'why_t5s'],
    ['palette', 'why_t6', 'why_t6s'],
  ]
  return `<section class="why-sec dark how">
    <div class="why-in">
      <p class="why-k">${esc(t('why_k6'))}</p>
      <h2 class="why-h">${esc(t('why_h6'))}</h2>
      <ol class="why-pipe" data-reveal>${steps.map(([ic, h, sub], i) => `<li class="why-step" style="--i:${i}">
        <span class="why-dot"><span class="ms" aria-hidden="true">${ic}</span></span>
        <div><b>${esc(t(h))}</b><span>${esc(t(sub))}</span></div></li>`).join('')}</ol>
      <div class="why-tiles">${tiles.map(([ic, h, sub]) => `<div class="why-tile"><span class="ms" aria-hidden="true">${ic}</span><b>${esc(t(h))}</b><span>${esc(t(sub))}</span></div>`).join('')}</div>
      <a class="why-repo" href="${REPO}" target="_blank" rel="noopener"><span class="ms" aria-hidden="true">code</span>${esc(t('why_oss'))} · github.com/TheAIMogul/blackout-box<span class="ms" aria-hidden="true">north_east</span></a>
    </div>
  </section>`
}

function builtOnData(): string {
  let i = 0
  return `<section class="why-sec light data">
    <div class="why-in">
      <p class="why-k">${esc(t('why_k7'))}</p>
      <h2 class="why-h">${esc(t('why_h7'))}</h2>
      <figure class="why-stat xl"><div class="why-num" data-stat="sources" aria-label="${SOURCE_COUNT}">${reducedMotion() ? SOURCE_COUNT : 0}</div>
        <figcaption><span class="why-lbl">${esc(t('why_data_lbl'))}</span></figcaption></figure>
      <div class="why-grps" data-reveal>${SOURCES.map((g) => `<div class="why-grp">
        <h3><span class="ms" aria-hidden="true">${esc(g.icon)}</span>${esc(t(g.group))}</h3>
        <div class="why-chips">${g.items.map((s) => `<a class="why-chip" style="--i:${i++}" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}<span class="ms" aria-hidden="true">north_east</span></a>`).join('')}</div>
      </div>`).join('')}</div>
    </div>
  </section>`
}

function render(): void {
  if (!host) return
  const who: [string, string][] = [['elderly', 'why_w1'], ['vaccines', 'why_w2'], ['child_care', 'why_w3'], ['translate', 'why_w4'], ['home_pin', 'why_w5']]
  const feats: [string[], string, string, string][] = [
    [['icon.fridge'], 'photo_camera', 'why_f1', 'why_f1s'],
    [[], 'wifi_off', 'why_f2', 'why_f2s'],
    [['icon.wind', 'icon.rain'], 'cyclone', 'why_f3', 'why_f3s'],
    [['icon.zone'], 'home_pin', 'why_f4', 'why_f4s'],
    [['icon.map'], 'local_hospital', 'why_f5', 'why_f5s'],
    [['icon.tide'], 'water', 'why_f6', 'why_f6s'],
    [['icon.chat'], 'translate', 'why_f7', 'why_f7s'],
  ]
  host.innerHTML = `<div class="why">
    <a class="why-qr" href="https://blackoutbox.micahberkley.com" target="_blank" rel="noopener">
      <img src="/qr.svg" width="148" height="148" alt="QR code for blackoutbox.micahberkley.com">
      <span class="why-qr-t"><span class="why-qr-k">${esc(t('try_it'))}</span><span class="why-qr-u">blackoutbox.<wbr>micahberkley.com</span><span class="why-qr-s">${esc(t('try_it_sub'))}</span></span>
    </a>
    <section class="why-models" aria-label="AI models">
      <p class="why-models-k">The AI behind Blackout Box</p>
      <div class="why-model gemma"><span class="why-model-n">Gemma 4 <em>26B A4B</em></span><span class="why-model-b">Open weights</span><span class="why-model-d">Translates every answer into Spanish and Haitian Creole. Google DeepMind, on Cloudflare Workers AI.</span></div>
      <div class="why-model"><span class="why-model-n">Gemini 3.8 Flash</span><span class="why-model-d">Reads your fridge, freezer and medicine photos in about 3 seconds.</span></div>
      <div class="why-model"><span class="why-model-n">Claude Fable 5.1</span><span class="why-model-d">Answers questions from your saved data, with Claude Sonnet 5.5 as backup.</span></div>
      <div class="why-model"><span class="why-model-n">Grok Imagine</span><span class="why-model-d">Painted every image in the app.</span></div>
      <div class="why-model rules"><span class="why-model-n">Open rules engine</span><span class="why-model-b">No AI</span><span class="why-model-d">Every countdown comes from FDA and USDA rules, never a model. 77 tests.</span></div>
      <p class="why-models-s">All model calls run through Cloudflare AI Gateway.</p>
    </section>
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
    ${howItWorks()}
    ${builtOnData()}
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
  const reveals = host.querySelectorAll<HTMLElement>('[data-reveal]')
  if (reducedMotion() || typeof IntersectionObserver !== 'function') {
    reveals.forEach((r) => r.classList.add('in'))
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
  // Tall blocks (pipeline, chip wall): light up as soon as their top clears the lower fifth of the screen.
  revealIo?.disconnect()
  revealIo = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { revealIo?.unobserve(e.target); e.target.classList.add('in') }
  }, { threshold: 0, rootMargin: '0px 0px -20% 0px' })
  reveals.forEach((r) => revealIo!.observe(r))
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
