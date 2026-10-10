// Now: current conditions and warnings at a glance (Apple Weather × Airbnb). GET /api/now (metric; converted to °F/mph/ft here),
// cached in IndexedDB so it still shows offline with "Saved at 13:05". Refreshes every 5 min while online.
import { getNow, type NowData, type NowLevel, type NowWarning } from './api'
import { kvGet, kvSet } from './db'
import { getLang, onLang, t } from './i18n'
import { onTheme, isBlackout } from './theme'
import { backdropHTML, iconHTML, loadMedia, media, onMedia, playLightsOut, prefetch, prefetchClip } from './media'
import { paintOut, paintSnaps } from './capture'
import { paintShelter } from './shelter'
import { cToF, esc, haptic, kmhToMph, mToFt, on, state, usText } from './util'

const REFRESH_MS = 5 * 60_000
let heroEl: HTMLElement
let viewEl: HTMLElement
let stageEl: HTMLElement
let data: NowData | null = null
let savedAt: string | null = null
let live = false
let loading = false

export async function mountNow(hero: HTMLElement, view: HTMLElement, stage: HTMLElement): Promise<void> {
  heroEl = hero; viewEl = view; stageEl = stage
  // Mockup 1:52 PM, top to bottom: power-out pill → hero temp → snap cards (in the hero); mini map → warnings → tiles.
  // The slots are built once so the snap buttons and the MapLibre mini map survive every re-render.
  heroEl.innerHTML = '<div class="nh-intro"></div><div class="nh-out"></div><div class="now-hero nh-main"></div><div class="nh-snaps"></div>'
  heroEl.querySelector<HTMLElement>('.nh-intro')!.addEventListener('click', onIntroStep)
  viewEl.innerHTML = '<div class="mini-map" id="now-minimap"></div><div class="nv-shelter"></div><div class="nv-warn"></div><div class="nv-tiles"></div>'
  paintShelter(viewEl.querySelector<HTMLElement>('.nv-shelter')!)
  paintOut(heroEl.querySelector<HTMLElement>('.nh-out')!)
  paintSnaps(heroEl.querySelector<HTMLElement>('.nh-snaps')!)
  const rec = await kvGet<NowData>('now')
  if (rec?.value) { data = rec.value; savedAt = rec.fetchedAt }
  render()
  onLang(render)
  onTheme(paintStage)
  on('health', () => { if (!live && navigator.onLine && !state.health?._fallback) void refresh() })
  on('prep', render)
  on('items', renderClocksTile)
  setInterval(renderClocksTile, 5000)
  onMedia(() => { lastHero = '__'; render() })
  void loadMedia()
  setInterval(() => { paintDaylight() }, 60_000)
  window.addEventListener('offline', () => { live = false; render() })
  void refresh()
  setInterval(() => { if (navigator.onLine) void refresh() }, REFRESH_MS)
}

async function refresh(): Promise<void> {
  if (loading || !navigator.onLine) return
  loading = true
  const r = await getNow(state.lat, state.lon)
  loading = false
  if (r) {
    data = r; live = true; savedAt = new Date().toISOString()
    void kvSet('now', r, 'GET /api/now')
  } else live = false
  render()
}

// ---------- helpers ----------
const LOC = () => ({ en: 'en-GB', es: 'es-ES', ht: 'fr-FR' })[getLang()] // 24-hour clocks
function hhmm(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(String(iso).replace(' ', 'T'))
  return Number.isFinite(d.getTime()) ? d.toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit', hour12: false }) : ''
}
function dayTime(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(String(iso).replace(' ', 'T'))
  if (!Number.isFinite(d.getTime())) return ''
  const same = d.toDateString() === new Date().toDateString()
  return same ? hhmm(iso) : `${d.toLocaleDateString(LOC(), { weekday: 'short' })} ${hhmm(iso)}`
}
const r0 = (n?: number | null) => (n == null || !Number.isFinite(n) ? '—' : String(Math.round(n)))
/** °F from the server's °C, whole degrees */
const f0 = (c?: number | null) => (c == null || !Number.isFinite(c) ? '—' : String(Math.round(cToF(c))))
const mph0 = (k?: number | null) => (k == null || !Number.isFinite(k) ? '—' : String(Math.round(kmhToMph(k))))
const ft2 = (m?: number | null) => (m == null || !Number.isFinite(m) ? '—' : mToFt(m).toFixed(2))

function wxKey(code?: number): { key: string; icon: string } {
  const c = code ?? -1
  if (c === 0) return { key: 'wx_clear', icon: 'clear_day' }
  if (c === 1) return { key: 'wx_mainly_clear', icon: 'sunny' }
  if (c === 2) return { key: 'wx_partly', icon: 'partly_cloudy_day' }
  if (c === 3) return { key: 'wx_overcast', icon: 'cloud' }
  if (c === 45 || c === 48) return { key: 'wx_fog', icon: 'foggy' }
  if (c >= 51 && c <= 57) return { key: 'wx_drizzle', icon: 'rainy_light' }
  if (c >= 61 && c <= 67) return { key: 'wx_rain', icon: 'rainy' }
  if (c >= 71 && c <= 77) return { key: 'wx_snow', icon: 'weather_snowy' }
  if (c >= 80 && c <= 82) return { key: 'wx_showers', icon: 'rainy_heavy' }
  if (c >= 95) return { key: 'wx_storm', icon: 'thunderstorm' }
  return { key: '', icon: 'thermostat' }
}

function isDayNow(): boolean {
  const w = data?.weather
  const rise = w?.sunrise ? Date.parse(w.sunrise) : NaN
  const set = w?.sunset ? Date.parse(w.sunset) : NaN
  if (Number.isFinite(rise) && Number.isFinite(set) && new Date(rise).toDateString() === new Date().toDateString()) {
    const n = Date.now(); return n >= rise && n < set
  }
  return w?.isDay ?? true
}

function daylightLeftMin(): number | null {
  const set = data?.weather?.sunset ? Date.parse(data.weather.sunset) : NaN
  if (Number.isFinite(set) && new Date(set).toDateString() === new Date().toDateString()) return Math.max(0, Math.round((set - Date.now()) / 6e4))
  return typeof data?.weather?.daylightLeftMin === 'number' && !savedAt ? data.weather.daylightLeftMin : null
}

const HERO: Record<'day' | 'night', Record<NowLevel, string>> = {
  day: {
    green: 'linear-gradient(165deg, #FF6B5B 0%, #FF8E53 42%, #FFB347 100%)',
    blue: 'linear-gradient(165deg, #3A7BD5 0%, #5B8DEF 45%, #FF9E7A 100%)',
    yellow: 'linear-gradient(165deg, #FF5E62 0%, #FF8A3D 45%, #FFC145 100%)',
    orange: 'linear-gradient(165deg, #E8433A 0%, #FF6A00 50%, #FF9500 100%)',
    red: 'linear-gradient(165deg, #8E0E2B 0%, #D7263D 50%, #FF3B30 100%)',
  },
  night: {
    green: 'linear-gradient(170deg, #070B24 0%, #1E1B4B 55%, #312E81 100%)',
    blue: 'linear-gradient(170deg, #050A26 0%, #13235B 55%, #1E3A8A 100%)',
    yellow: 'linear-gradient(170deg, #0B0B2A 0%, #2A1F5C 55%, #6B3A3A 100%)',
    orange: 'linear-gradient(170deg, #0F0A24 0%, #3B1D4F 50%, #8A3A1A 100%)',
    red: 'linear-gradient(170deg, #12051A 0%, #4A0D2E 50%, #8E1B1B 100%)',
  },
}
const GLOW: Record<NowLevel, string> = { green: '52,199,89', blue: '0,122,255', yellow: '255,204,0', orange: '255,149,0', red: '255,59,48' }

function paintStage(): void {
  if (!stageEl) return
  const lvl: NowLevel = data?.overall ?? 'green'
  const bg = isBlackout()
    ? `radial-gradient(120% 70% at 20% 0%, rgba(${GLOW[lvl]},.38) 0%, rgba(${GLOW[lvl]},.10) 45%, transparent 75%), #000`
    : HERO[isDayNow() ? 'day' : 'night'][lvl]
  stageEl.style.setProperty('--hero-bg', bg)
  paintBackdrop()
}

/** Which hero clip fits right now: Blackout, storm (red/orange or a cyclone), king tide, heat, else day/night. */
function heroUse(): string[] {
  const day = isDayNow() ? 'now.hero.day' : 'now.hero.night'
  if (isBlackout()) return ['now.hero.blackout', 'now.hero.night']
  const warns = data?.warnings ?? []
  const lvl = data?.overall ?? 'green'
  if (lvl === 'red' || lvl === 'orange' || warns.some((w) => w.icon === 'cyclone' && (w.level === 'red' || w.level === 'orange'))) return ['now.hero.storm', day]
  if (data?.tide?.kingTide) return ['now.hero.kingtide', day]
  if (isDayNow() && warns.some((w) => w.icon === 'thermostat' && w.level !== 'green')) return ['now.hero.heat', day]
  return [day]
}

let lastHero = ''
let wasBlackout = isBlackout()
function paintBackdrop(): void {
  const host = stageEl?.querySelector<HTMLElement>('#hero-media')
  if (!host) return
  const m = data ? media(...heroUse()) : null
  const key = m ? m.use + '|' + m.src + '|' + isBlackout() : ''
  if (key === lastHero) return
  lastHero = key
  host.innerHTML = m ? backdropHTML(m) + '<i class="hero-scrim"></i>' : ''
  host.style.backgroundColor = m?.color ?? ''
  host.classList.toggle('has-media', !!m)
  prefetch(media('now.hero.blackout')) // the offline moment must have its picture cached already
  prefetchClip(media('now.transition.lightsout'))
  host.querySelector('video')?.play?.().catch(() => {})
  // Switching INTO Blackout: the lights-out clip plays once over the hero, then fades to the Blackout still.
  const nowBlackout = isBlackout()
  if (nowBlackout && !wasBlackout && m) playLightsOut(host)
  wasBlackout = nowBlackout
}

// ---------- what this app is for (replaces the Now subtitle) ----------
const STEPS: Array<[string, string]> = [['photo_camera', '1'], ['power_off', '2'], ['timer', '3']]
let lastIntro = ''
function paintIntro(): void {
  const el = heroEl?.querySelector<HTMLElement>('.nh-intro')
  if (!el || lastIntro === getLang()) return
  lastIntro = getLang()
  el.innerHTML = `<h2 class="ni-head">${esc(t('intro_head'))}</h2>
    <ol class="ni-steps">${STEPS.map(([icon, n]) => `<li><button type="button" class="ni-step" data-step="${n}">
      <span class="ni-ic"><span class="ms fill" aria-hidden="true">${icon}</span><b class="ni-n">${n}</b></span>
      <span class="ni-t">${esc(t('intro_' + n + 't'))}</span><span class="ni-b">${esc(t('intro_' + n + 'b'))}</span>
    </button></li>`).join('')}</ol>`
}
function onIntroStep(e: Event): void {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-step]')
  if (!b) return
  haptic()
  const n = b.dataset.step
  if (n === '1') heroEl.querySelector('.nh-snaps')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  else if (n === '2') {
    const out = heroEl.querySelector<HTMLButtonElement>('[data-out]')
    if (out) out.click(); else location.hash = 'fourhour'
  } else location.hash = 'fourhour'
}

// ---------- render ----------
function render(): void {
  if (!heroEl) return
  paintStage()
  paintIntro()
  const w = data?.weather
  const warns = (data?.warnings ?? []).filter((x) => x && x.title)
  const watch = warns.filter((x) => x.level !== 'green')
  const z = data?.zone?.zone ?? null
  const wx = wxKey(w?.weatherCode)

  const main = heroEl.querySelector<HTMLElement>('.nh-main')!
  const warnEl = viewEl.querySelector<HTMLElement>('.nv-warn')!
  const tilesEl = viewEl.querySelector<HTMLElement>('.nv-tiles')!
  if (!data) {
    main.innerHTML = `<div class="h-temp" aria-hidden="true">--°</div><div class="h-line">${esc(loading || navigator.onLine ? t('now_loading') : t('now_none'))}</div>`
    warnEl.innerHTML = ''
    tilesEl.innerHTML = ''
    return
  }
  const summary = watch.length
    ? (z ? t(watch.length === 1 ? 'now_watch_one' : 'now_watch_other', { n: watch.length, z }) : t('now_watch_nozone', { n: watch.length }))
    : t('now_clear')
  main.innerHTML = `
      <div class="h-temp tnum" aria-label="${esc(f0(w?.tempC))} °F">${esc(f0(w?.tempC))}<span>°F</span></div>
      <div class="h-cond">${wx.key ? `<span class="ms fill" aria-hidden="true">${wx.icon}</span>${esc(t(wx.key))}` : ''}${w?.highC != null ? ` · ${esc(t('hi_lo', { h: f0(w.highC), l: f0(w.lowC) }))}` : ''}</div>
      <div class="h-feels">${w?.feelsLikeC != null ? esc(t('feels_like', { t: `${f0(w.feelsLikeC)} °F` })) : ''}</div>`
  warnEl.innerHTML = `<div class="warn-row" role="list" aria-label="${esc(summary)}">${(watch.length ? watch : warns).map(warnCard).join('')}</div>`

  tilesEl.innerHTML = `
    <div class="tiles">
      ${tileHeat()}${tileUv()}${tileWind()}${tileRain()}${tileAir()}${tileTide()}${tileDaylight()}${tileZone()}
      <button type="button" class="tile tile-btn" id="tile-clocks"></button>
    </div>
    <p class="src-line">${esc(data._source ?? '')}${w?.station ? ` · ${esc(w.station)}` : ''}</p>`
  renderClocksTile()
  viewEl.querySelector('#tile-clocks')?.addEventListener('click', () => { haptic(); location.hash = 'fourhour' })
  viewEl.querySelector('#tile-zone')?.addEventListener('click', () => { haptic(); location.hash = 'prep' })
}

function warnCard(w: NowWarning): string {
  // Cards end after the detail text (redline 1:45 PM): no source / "until" row.
  const inner = `<div class="wc-top"><span class="ms fill" aria-hidden="true">${esc(w.icon || 'warning')}</span><span class="wc-lvl">${esc(t('lvl_' + w.level))}</span></div>
    <div class="wc-title">${esc(usText(w.title))}</div>
    ${w.detail ? `<div class="wc-detail">${esc(usText(w.detail))}</div>` : ''}`
  return w.url
    ? `<a class="wc lvl-${esc(w.level)}" role="listitem" href="${esc(w.url)}" target="_blank" rel="noopener">${inner}</a>`
    : `<div class="wc lvl-${esc(w.level)}" role="listitem">${inner}</div>`
}

const TILE_ICON: Record<string, string> = { thermostat: 'heat', wb_sunny: 'uv', air: 'wind', water_drop: 'rain', airwave: 'air', waves: 'tide', wb_twilight: 'daylight', flood: 'zone', timer: 'clock' }
const tileIcon = (icon: string) => iconHTML([`icon.tile.${TILE_ICON[icon] ?? icon}`, `icon.${TILE_ICON[icon] ?? icon}`], icon, 'mi tile-mi')
const tile = (icon: string, label: string, body: string, cls = '', id = '') =>
  `<div class="tile ${cls}"${id ? ` id="${id}"` : ''}><div class="tl">${tileIcon(icon)}${esc(label)}</div>${body}</div>`

function tileHeat(): string {
  const w = data?.weather
  const heat = (data?.warnings ?? []).find((x) => x.icon === 'thermostat' || /heat|calor|chal/i.test(x.title))
  return tile('thermostat', t('tile_heat'), `<div class="tv tnum">${esc(f0(w?.feelsLikeC))}°F</div>
    <div class="tc">${heat ? esc(usText(heat.title)) : ''}</div><div class="tf">${w?.humidity != null ? esc(t('humidity', { n: r0(w.humidity) })) : ''}</div>`)
}

function uvLabel(u: number): string { return u < 3 ? 'uv_low' : u < 6 ? 'uv_moderate' : u < 8 ? 'uv_high' : u < 11 ? 'uv_very_high' : 'uv_extreme' }
function tileUv(): string {
  const u = data?.weather?.uvIndex
  if (u == null) return ''
  const pos = Math.min(100, Math.max(0, (u / 11) * 100))
  return tile('wb_sunny', 'UV', `<div class="tv tnum">${esc(r0(u))}</div><div class="tc">${esc(t(uvLabel(u)))}</div>
    <div class="scale uv" aria-hidden="true"><i style="left:${pos.toFixed(1)}%"></i></div>
    <div class="tf">${data?.weather?.uvMax != null ? esc(t('uv_max', { n: r0(data.weather.uvMax) })) : ''}</div>`)
}

function tileWind(): string {
  const w = data?.weather
  if (w?.windKmh == null) return ''
  return tile('air', t('tile_wind'), `<div class="tv tnum">${esc(mph0(w.windKmh))}<small> mph</small></div>
    <div class="tc">${w.gustKmh != null ? esc(t('gusts', { v: `${mph0(w.gustKmh)} mph` })) : ''}</div>`)
}

function tileRain(): string {
  const r = data?.weather?.rainChanceNext6h
  if (!Array.isArray(r) || !r.length) return ''
  const max = Math.max(...r)
  const now = new Date()
  return tile('water_drop', t('tile_rain'), `<div class="tv tnum">${esc(r0(max))}<small>%</small></div>
    <div class="bars" aria-label="${esc(r.map((v) => r0(v) + '%').join(', '))}">${r.map((v, i) => `<div class="b"><i style="height:${Math.max(4, Math.min(100, v)).toFixed(0)}%"></i><span>${String((now.getHours() + i) % 24).padStart(2, '0')}</span></div>`).join('')}</div>`)
}

function aqiLabel(a: number): string { return a <= 50 ? 'aqi_good' : a <= 100 ? 'aqi_moderate' : a <= 150 ? 'aqi_usg' : a <= 200 ? 'aqi_unhealthy' : a <= 300 ? 'aqi_very' : 'aqi_hazardous' }
function tileAir(): string {
  const a = data?.air?.usAqi
  if (a == null) return ''
  const pos = Math.min(100, Math.max(0, (a / 300) * 100))
  return tile('airwave', t('tile_air'), `<div class="tv tnum">${esc(r0(a))}</div><div class="tc">${esc(t(aqiLabel(a)))}</div>
    <div class="scale aqi" aria-hidden="true"><i style="left:${pos.toFixed(1)}%"></i></div>
    <div class="tf">${data?.air?.pm25 != null ? `PM2.5 ${esc(data.air.pm25)} µg/m³` : ''}</div>`)
}

function tileTide(): string {
  const td = data?.tide
  if (!td || td.latestM == null) return ''
  const king = td.kingTideM, flood = td.minorFloodM
  const top = Math.max(1.2, (flood ?? 0) + 0.15, (td.nextHigh?.m ?? 0) + 0.2)
  const y = (m: number) => (60 - (m / top) * 56).toFixed(1)
  // a gentle sine through now → next high (shape only; labels are in feet)
  const now = td.latestM, hi = td.nextHigh?.m ?? now
  const pts = Array.from({ length: 41 }, (_, i) => { const x = i * 4; const m = now + (hi - now) * (0.5 - 0.5 * Math.cos((Math.PI * i) / 40)); return `${x},${y(m)}` }).join(' ')
  return tile('waves', t('tile_tide'), `<div class="tv tnum">${esc(ft2(td.latestM))}<small> ft</small></div>
    <svg class="wave" viewBox="0 0 160 62" preserveAspectRatio="none" aria-hidden="true">
      <polygon points="0,62 ${pts} 160,62" class="wfill"/><polyline points="${pts}" class="wline"/>
      ${king != null ? `<line x1="0" x2="160" y1="${y(king)}" y2="${y(king)}" class="king"/>` : ''}
      ${flood != null ? `<line x1="0" x2="160" y1="${y(flood)}" y2="${y(flood)}" class="flood"/>` : ''}
    </svg>
    <div class="tf">${td.nextHigh ? esc(t('tide_next', { m: `${ft2(td.nextHigh.m)} ft`, t: dayTime(td.nextHigh.t) })) : ''}${king != null ? `<br>${esc(t('king_tide', { m: `${ft2(king)} ft` }))}${td.kingTide ? ' ⚠' : ''}` : ''}</div>`, 'wide-sm')
}

function tileDaylight(): string {
  const set = data?.weather?.sunset
  if (!set) return ''
  return tile('wb_twilight', t('tile_daylight'), `<div id="daylight-body">${daylightBody()}</div>`)
}
function daylightBody(): string {
  const left = daylightLeftMin()
  const set = data?.weather?.sunset
  const v = left == null ? '—' : left === 0 ? esc(t('dark_now_short')) : `${Math.floor(left / 60)}<small> h </small>${String(left % 60).padStart(2, '0')}<small> min</small>`
  return `<div class="tv tnum ${left === 0 ? 'smallv' : ''}">${v}</div><div class="tc">${left ? esc(t('daylight_left_short')) : esc(t('dark_now'))}</div><div class="tf">${esc(t('sunset_at', { t: hhmm(set) }))}${data?.weather?.sunrise ? ` · ${esc(t('sunrise_at', { t: hhmm(data.weather.sunrise) }))}` : ''}</div>`
}
function paintDaylight(): void { const el = viewEl?.querySelector('#daylight-body'); if (el) el.innerHTML = daylightBody(); paintStage() }

function tileZone(): string {
  const z = data?.zone?.zone ?? null
  return `<button type="button" class="tile tile-btn" id="tile-zone"><div class="tl">${tileIcon('flood')}${esc(t('zone'))}</div>
    <div class="zl ${z ? '' : 'none'}">${esc(z ?? '—')}</div><div class="tf">${esc(z ? t('zone_check_short') : t('zone_none'))}</div></button>`
}

const ACTION = ['USE_NOW', 'DISCARD', 'PAST_LIMIT', 'DO_NOT_USE']
let lastClocks = ''
function renderClocksTile(): void {
  const el = viewEl?.querySelector<HTMLElement>('#tile-clocks')
  if (!el) return
  const n = state.verdicts.filter((v) => ACTION.includes(v.status)).length
  const total = state.items.length
  const key = `${n}/${total}/${getLang()}`
  if (key === lastClocks && el.innerHTML) return
  lastClocks = key
  el.innerHTML = `<div class="tl">${tileIcon('timer')}${esc(t('tile_clocks'))}</div>
    <div class="tv tnum ${n ? 'hot' : ''}">${total ? n : '—'}</div>
    <div class="tc">${esc(!total ? t('clocks_none') : n ? t('clocks_need', { n }) : t('clocks_ok'))}</div>
    <div class="tf link">${esc(t('clocks_open'))} <span class="ms" aria-hidden="true">chevron_right</span></div>`
}
