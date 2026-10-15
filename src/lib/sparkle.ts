/**
 * A small burst of gold stars from a desk: the Line's Done (2026-10-15), the student's own small
 * moment. Small on purpose, since the class goal is the one big celebration: eight little stars
 * out and gone in under a second, and the Done picture popping in. All `element.animate`, run by
 * the graphics chip, on a layer that takes no taps and is removed when the last star lands.
 */

const STAR_SVG =
  '<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true"><path d="M12 2.2l2.95 6.2 6.8.85-4.98 4.7 1.26 6.75L12 17.4l-6.03 3.3 1.26-6.75L2.25 9.25l6.8-.85z" fill="#fbbf24" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/></svg>'

const STARS = 8
const BURST_MS = 750

/** The desk of this student, while the board shows the desks. */
function deskOf(studentId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-ink^="desk"][data-star-from="${CSS.escape(studentId)}"]`)
}

/** Stars out from the student's desk, and their Done picture popping in. */
export function sparkleDesk(studentId: string) {
  const desk = deskOf(studentId)
  if (!desk) return
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  desk.querySelector('[data-done-mark]')?.animate(
    reduced
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          { scale: 0.4, opacity: 0 },
          { scale: 1.15, opacity: 1, offset: 0.6 },
          { scale: 1, opacity: 1 },
        ],
    { duration: 420, easing: 'ease-out' },
  )
  if (reduced) return

  const box = desk.getBoundingClientRect()
  const cx = box.left + box.width / 2
  const cy = box.top + box.height * 0.42
  const size = Math.max(14, Math.min(30, box.width * 0.13))
  const reach = Math.max(36, Math.min(110, box.width * 0.55))

  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden'
  document.body.appendChild(layer)

  let flying = STARS
  for (let i = 0; i < STARS; i++) {
    const angle = (i / STARS) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
    const distance = reach * (0.7 + Math.random() * 0.3)
    const star = document.createElement('div')
    star.innerHTML = STAR_SVG
    star.style.cssText = `position:absolute;left:${cx - size / 2}px;top:${cy - size / 2}px;width:${size}px;height:${size}px`
    layer.appendChild(star)
    star
      .animate(
        [
          { transform: 'translate(0, 0) scale(0.3) rotate(0deg)', opacity: 1 },
          {
            transform: `translate(${Math.cos(angle) * distance * 0.7}px, ${Math.sin(angle) * distance * 0.7}px) scale(1) rotate(90deg)`,
            opacity: 1,
            offset: 0.55,
          },
          {
            transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(0.6) rotate(160deg)`,
            opacity: 0,
          },
        ],
        { duration: BURST_MS, delay: i * 18, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', fill: 'forwards' },
      )
      .finished.catch(() => undefined)
      .finally(() => {
        flying -= 1
        if (flying === 0) layer.remove()
      })
  }
}
