// iOS-style bottom sheet: grabber, title, close button, drag down to dismiss, Esc to close, scrim tap to close.
import { esc, haptic } from './util'

export type Sheet = { el: HTMLElement; body: HTMLElement; setTitle(s: string): void; close(): void }

let current: Sheet | null = null

export function openSheet(title: string, html: string, onMount?: (body: HTMLElement, sheet: Sheet) => void, onClose?: () => void): Sheet {
  current?.close()
  haptic()
  const scrim = document.createElement('div')
  scrim.className = 'sheet-scrim'
  const el = document.createElement('div')
  el.className = 'sheet'
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-modal', 'true')
  el.innerHTML = `<div class="grab" aria-hidden="true"><i></i></div>
    <div class="sh-head"><h2 id="sh-title">${esc(title)}</h2><button type="button" class="round-btn" data-close aria-label="Close"><span class="ms" aria-hidden="true">close</span></button></div>
    <div class="sh-body"></div>`
  el.setAttribute('aria-labelledby', 'sh-title')
  const body = el.querySelector<HTMLElement>('.sh-body')!
  body.innerHTML = html
  document.body.append(scrim, el)
  const prevFocus = document.activeElement as HTMLElement | null
  let closed = false
  const sheet: Sheet = {
    el, body,
    setTitle(s) { el.querySelector('#sh-title')!.textContent = s },
    close() {
      if (closed) return
      closed = true
      el.classList.remove('open'); scrim.classList.remove('open')
      document.removeEventListener('keydown', onKey)
      setTimeout(() => { el.remove(); scrim.remove() }, 420)
      if (current === sheet) current = null
      prevFocus?.focus?.()
      onClose?.()
    },
  }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') sheet.close() }
  document.addEventListener('keydown', onKey)
  scrim.addEventListener('click', () => sheet.close())
  el.querySelector('[data-close]')!.addEventListener('click', () => sheet.close())

  // drag down to dismiss (grabber + header)
  let y0 = 0, dy = 0, dragging = false
  const start = (e: PointerEvent) => { if ((e.target as HTMLElement).closest('button')) return; dragging = true; y0 = e.clientY; dy = 0; el.classList.add('dragging'); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }
  const move = (e: PointerEvent) => { if (!dragging) return; dy = Math.max(0, e.clientY - y0); el.style.transform = `translateY(${dy}px)` }
  const end = () => { if (!dragging) return; dragging = false; el.classList.remove('dragging'); el.style.transform = ''; if (dy > 90) sheet.close() }
  el.querySelectorAll<HTMLElement>('.grab, .sh-head').forEach((h) => {
    h.addEventListener('pointerdown', start); h.addEventListener('pointermove', move)
    h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end)
  })

  current = sheet
  onMount?.(body, sheet)
  requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('open'); scrim.classList.add('open'); el.tabIndex = -1; el.focus({ preventScroll: true }) }))
  return sheet
}

export function currentSheet(): Sheet | null { return current }
