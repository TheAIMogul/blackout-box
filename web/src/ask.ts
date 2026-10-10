// Ask: grounded Q&A. POST /api/chat with the saved prep bundle as context; model text passes the
// banned-phrase filter before rendering. With no server, answer from the cached bundle and say so.
import { chat } from './api'
import { chatAdd, chatAll, type ChatRecord } from './db'
import { filterAnswer } from './filter'
import { getLang, onLang, t } from './i18n'
import { placeGroups, zoneOf } from './prep'
import { emit, esc, fmtWhen, modelMeta, state } from './util'

type Msg = { role: 'user' | 'assistant'; content: string; meta?: string; offline?: boolean; e911?: boolean; filtered?: boolean }
let log: Msg[] = []
let busy = false
let root: HTMLElement

export async function mountAsk(host: HTMLElement): Promise<void> {
  root = host
  const past = (await chatAll()).slice(-10)
  log = past.flatMap((r: ChatRecord): Msg[] => [
    { role: 'user', content: r.q },
    { role: 'assistant', content: r.a, meta: r.offline ? undefined : r.model ? modelMeta(r.model) : undefined, offline: r.offline, e911: r.call911, filtered: r.filtered },
  ])
  render()
  onLang(render)
}

function render(): void {
  if (!root) return
  root.innerHTML = `
    <div class="page-head"><h1>${esc(t('ask_title'))}</h1></div>
    <p class="page-sub">${esc(t('ask_sub'))}</p>
    ${!state.prep ? `<div class="banner"><span class="ms" aria-hidden="true">info</span><span>${esc(t('ask_need_prep'))}</span></div>` : ''}
    <div class="sugg">${['ask_q1', 'ask_q2', 'ask_q3'].map((k) => `<button type="button" class="chip" data-q="${esc(t(k))}"><span class="ms" aria-hidden="true">chat_bubble</span>${esc(t(k))}</button>`).join('')}</div>
    <div class="chat-log" id="ask-log" aria-live="polite"></div>
    <form class="ask-form" id="ask-form">
      <div class="field"><input type="text" id="ask-in" placeholder="${esc(t('ask_placeholder'))}" autocomplete="off" ${busy ? 'disabled' : ''}><label for="ask-in">${esc(t('ask_title'))}</label></div>
      <button class="btn primary" type="submit" ${busy ? 'disabled' : ''}><span class="ms" aria-hidden="true">send</span>${esc(t('ask_send'))}</button>
    </form>`
  renderLog()
  root.querySelectorAll<HTMLButtonElement>('[data-q]').forEach((b) => b.addEventListener('click', () => void ask(b.dataset.q ?? '')))
  root.querySelector<HTMLFormElement>('#ask-form')!.addEventListener('submit', (e) => {
    e.preventDefault()
    const inp = root.querySelector<HTMLInputElement>('#ask-in')!
    const q = inp.value.trim()
    if (q) { inp.value = ''; void ask(q) }
  })
}

function renderLog(): void {
  const el = root.querySelector('#ask-log')
  if (!el) return
  el.innerHTML = log.map((m) => m.role === 'user'
    ? `<div class="msg q">${esc(m.content)}</div>`
    : `<div class="msg a">${m.e911 ? `<div class="banner error" style="margin:0 0 10px"><span class="ms" aria-hidden="true">emergency</span><span><b>${esc(t('call_911'))}</b> ${esc(t('ask_911'))}</span></div>` : ''}${m.offline ? `<div class="banner warn" style="margin:0 0 10px"><span class="ms" aria-hidden="true">cloud_off</span><span>${esc(t('ask_offline'))}</span></div>` : ''}${esc(m.content)}${m.filtered ? `<span class="meta"><span class="ms" aria-hidden="true">shield</span>${esc(t('ask_filtered'))}</span>` : ''}${m.meta ? `<span class="meta"><span class="ms" aria-hidden="true">${m.offline ? 'inventory_2' : 'smart_toy'}</span>${esc(m.meta)}</span>` : ''}</div>`,
  ).join('') + (busy ? `<div class="msg a" style="padding:0;overflow:hidden"><div class="progress" style="margin:0;border-radius:0"><i></i></div><div style="padding:12px 16px" class="muted">${esc(t('ask_thinking'))}</div></div>` : '')
  el.lastElementChild?.scrollIntoView({ block: 'nearest' })
}

function context(): unknown {
  const byId = new Map(state.items.map((i) => [i.id, i]))
  return {
    ...(state.prep ?? {}),
    fourHourRule: state.verdicts.length ? {
      verdicts: state.verdicts.map((v) => ({ item: byId.get(v.itemId)?.name, category: byId.get(v.itemId)?.category, status: v.status, deadline: v.deadlineMs ? new Date(v.deadlineMs).toISOString() : null, source: v.source })),
      source: 'Blackout Box 4-Hour Rule engine (runs in this browser)',
    } : undefined,
  }
}

async function ask(q: string): Promise<void> {
  if (busy || !q) return
  const lang = getLang()
  log.push({ role: 'user', content: q })
  busy = true; render()
  const history = log.filter((m) => !m.offline).slice(-7).map((m) => ({ role: m.role, content: m.content }))
  const r = await chat(history, lang, state.prep ? context() : undefined)
  let msg: Msg
  if (r) {
    const meds = state.items.filter((i) => i.category === 'med').map((i) => i.name)
    const anyDnu = state.verdicts.some((v) => v.status === 'DO_NOT_USE')
    const f = filterAnswer(r.text, q, meds, anyDnu, t('act.med.UNKNOWN'))
    if (r._model && r._model !== 'demo') { state.lastModel = r._model; emit('health') }
    msg = {
      role: 'assistant', content: f.text, e911: !!r.call911, filtered: f.filtered || r.serverFiltered,
      meta: `${modelMeta(r._model, r._latencyMs)}${r.sources?.length ? ' · ' + r.sources.join(', ') : ''}`,
    }
  } else {
    msg = { role: 'assistant', content: offlineAnswer(q), offline: true, meta: state.prepAt ? `${t('prep_cached')} · ${fmtWhen(state.prepAt)}` : undefined, e911: EMERGENCY.test(q) }
  }
  log.push(msg)
  busy = false
  render()
  void chatAdd({ ts: new Date().toISOString(), lang, q, a: msg.content, model: r?._model, offline: msg.offline, filtered: msg.filtered, call911: msg.e911 })
  root.querySelector<HTMLInputElement>('#ask-in')?.focus()
}

const EMERGENCY = /downed (power )?line|downed wire|wire down|gas smell|smell gas|chest pain|can'?t breathe|trouble breathing|cable caído|olor a gas|dolor de pecho|no puedo respirar|fil kouran|sant gaz|doulè nan pwatrin|pa ka respire/i
const R_ZONE = /zone|zona|zòn|evac/i
const R_PLACES = /power|electric|charge|library|fire station|kouran|elektrik|luz|corriente|electricidad|biblioteca|bibliyotèk|bomberos|ponpye|where|dónde|donde|ki kote/i
const R_INSULIN = /insulin|insulina|ensilin|medic|lantus|humalog|refill|252|resurt|preskripsyon/i
const R_FOOD = /food|fridge|freezer|milk|comida|refri|nevera|congelador|manje|frijidè|frizè|4[ -]?hour|4 horas|4 èdtan/i
const R_FEMA = /fema|insurance|seguro|asirans|claim|reclam/i

/** Deterministic answer from the saved box, used when no AI is reachable. The offline banner is rendered separately. */
function offlineAnswer(q: string): string {
  const b = state.prep
  const parts: string[] = []
  if (!b) { parts.push(t('ask_not_saved')); return parts.join('\n\n') }
  let hit = false
  if (R_ZONE.test(q)) {
    hit = true
    const z = zoneOf(b)
    parts.push(z.letter ? t('ans_zone', { z: z.letter }) : t('ans_zone_none'))
  }
  if (R_PLACES.test(q) && !R_ZONE.test(q)) {
    hit = true
    const lines = placeGroups(b).flatMap((g) => g.items.slice(0, 2).map((p) => `• ${p.name}${p.distanceMi != null ? ` (${Number(p.distanceMi).toFixed(2)} mi)` : ''}`))
    parts.push(t('ans_places', { t: fmtWhen(state.prepAt) }) + '\n' + (lines.length ? lines.join('\n') : '—'))
  }
  if (R_INSULIN.test(q)) {
    hit = true
    parts.push(t('ans_insulin'))
    if (/refill|252|resurt|preskripsyon/i.test(q) && b.statute?.summary) parts.push(`${b.statute.number}: ${b.statute.summary}`)
  }
  if (R_FOOD.test(q)) { hit = true; parts.push(t('ans_food')) }
  if (R_FEMA.test(q)) { hit = true; parts.push(t('fema_register')) }
  if (!hit) parts.push(t('ask_not_saved'))
  return parts.join('\n\n')
}
