/**
 * A star flies from a student's desk (or face-up flip card) into the class goal, so every child
 * sees their point go to everyone. With the stars off the desks, this is the one place a
 * student's point shows on the board, and it shows going into the jar rather than staying with
 * them.
 *
 * Everything here is `element.animate`, run by the graphics chip: thirty stars from Pick All and +
 * are thirty small transforms, not thirty React renders. The meter waits for the stars
 * (`starsLandingIn`), so the coin moves and its sound plays as they land, not as they leave.
 */

/** How long one star takes from the desk to the coin. */
const FLIGHT_MS = 650
/** The gap between stars leaving, so a whole class pours in rather than moving as one block. */
const STAGGER_MS = 28
/** However many fly, the last leaves within this. */
const MAX_STAGGER_MS = 420

/** When the last star in the air lands, on the performance clock. */
let landingAt = 0

/** How long until every star in the air has landed: 0 when none are flying. */
export function starsLandingIn(): number {
  return Math.max(0, landingAt - performance.now())
}

const STAR_SVG =
  '<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true"><path d="M12 2.2l2.95 6.2 6.8.85-4.98 4.7 1.26 6.75L12 17.4l-6.03 3.3 1.26-6.75L2.25 9.25l6.8-.85z" fill="#fbbf24" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/></svg>'

function ease(t: number) {
  // Starts gently and speeds into the jar, as a thing falls into a pocket.
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

/** Where to fly from: the face-up card while the flip cards are up, otherwise the desk. */
function sourceFor(studentId: string, cardsUp: boolean): HTMLElement | null {
  const id = CSS.escape(studentId)
  return document.querySelector<HTMLElement>(
    cardsUp ? `[data-flip-card][data-star-from="${id}"]` : `[data-ink^="desk"][data-star-from="${id}"]`,
  )
}

/**
 * Send a star from each of these students to the class goal's coin. Students with nothing on
 * screen to fly from (a face-down card, the goal switched off) send none.
 */
export function flyStarsToGoal(studentIds: string[]) {
  const coin = document.querySelector<HTMLElement>('[data-goal-coin]')
  if (!coin || studentIds.length === 0) return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const cardsUp = document.querySelector('[data-flip-card]') !== null

  const to = coin.getBoundingClientRect()
  const tx = to.left + to.width / 2
  const ty = to.top + to.height / 2

  const sources = studentIds
    .map((id) => sourceFor(id, cardsUp)?.getBoundingClientRect())
    .filter((r): r is DOMRect => r !== undefined && r.width > 0)
  if (sources.length === 0) return

  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden'
  document.body.appendChild(layer)

  const stagger = Math.min(STAGGER_MS, MAX_STAGGER_MS / Math.max(1, sources.length - 1))
  const now = performance.now()
  landingAt = Math.max(landingAt, now + (sources.length - 1) * stagger + FLIGHT_MS)

  let flying = sources.length
  sources.forEach((from, i) => {
    // About a third of the desk, so it reads from the back of the room, and never smaller
    // than the coin it lands on.
    const size = Math.max(to.width, Math.min(64, from.width * 0.36))
    const fx = from.left + from.width / 2
    const fy = from.top + from.height / 2
    // An arc rather than a straight line: up and over, the way a thrown marble goes. The
    // bend is a quadratic curve through a point above the midpoint.
    const cx = (fx + tx) / 2
    const cy = Math.min(fy, ty) - Math.max(60, Math.abs(fx - tx) * 0.18)
    const endScale = to.width / size

    const keyframes: Keyframe[] = []
    const steps = 12
    for (let s = 0; s <= steps; s++) {
      const t = ease(s / steps)
      const x = (1 - t) * (1 - t) * fx + 2 * (1 - t) * t * cx + t * t * tx
      const y = (1 - t) * (1 - t) * fy + 2 * (1 - t) * t * cy + t * t * ty
      const scale = s === 0 ? 0.4 : 1 + (endScale - 1) * t
      keyframes.push({
        offset: s / steps,
        transform: `translate(${x - size / 2}px, ${y - size / 2}px) scale(${scale})`,
        opacity: s === 0 ? 0 : s === steps ? 0.2 : 1,
      })
    }

    const star = document.createElement('div')
    star.style.cssText = `position:absolute;left:0;top:0;width:${size}px;height:${size}px;will-change:transform,opacity;opacity:0;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.25))`
    star.innerHTML = STAR_SVG
    layer.appendChild(star)

    const flight = star.animate(keyframes, { duration: FLIGHT_MS, delay: i * stagger, easing: 'linear', fill: 'forwards' })
    const done = () => {
      star.remove()
      bump(coin)
      flying -= 1
      if (flying === 0) layer.remove()
    }
    flight.onfinish = done
    flight.oncancel = done
  })
}

/** When the last of Get Ready!'s stars lands: the coin rings louder for them. */
let loudLandingAt = -Infinity

/** Whether the stars landing now are Get Ready!'s, so the meter rings the coin louder for them. */
export function landingIsLoud(): boolean {
  return Math.abs(performance.now() - loudLandingAt) < 400
}

/** How long Get Ready!'s stars take from the big star to the coin: longer than a desk's, as they come further. */
const GET_READY_FLIGHT_MS = 900

/**
 * Get Ready!'s stars: `count` of them from one point - the middle of the big star - fanned out
 * as they rise and gathered into the coin, a little apart, so the class can count them in.
 * Returns how long until the last one lands. The meter waits for them, as it does for a desk's.
 * A Mystery Gift's stars fly the same way from its card, with the everyday coin (`loud: false`):
 * the loud one is for Get Ready!, over a faded board.
 */
export function flyStarsFrom(x: number, y: number, count: number, size: number, { loud = true } = {}): number {
  const coin = document.querySelector<HTMLElement>('[data-goal-coin]')
  if (!coin || count <= 0) return 0
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 0
  const to = coin.getBoundingClientRect()
  const tx = to.left + to.width / 2
  const ty = to.top + to.height / 2

  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden'
  document.body.appendChild(layer)

  const stagger = Math.min(90, 500 / Math.max(1, count - 1))
  const lands = (count - 1) * stagger + GET_READY_FLIGHT_MS
  landingAt = Math.max(landingAt, performance.now() + lands)
  if (loud) loudLandingAt = performance.now() + lands
  const gap = size * 0.85

  let flying = count
  for (let i = 0; i < count; i++) {
    const spread = (i - (count - 1) / 2) * gap
    const cx = (x + tx) / 2 + spread
    const cy = Math.min(y, ty) - size * 2.3
    const endScale = to.width / size
    const keyframes: Keyframe[] = []
    const steps = 14
    for (let s = 0; s <= steps; s++) {
      const t = ease(s / steps)
      const px = (1 - t) * (1 - t) * (x + spread * 0.6) + 2 * (1 - t) * t * cx + t * t * tx
      const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy + t * t * ty
      const scale = s === 0 ? 0.6 : 1 + (endScale - 1) * t
      keyframes.push({
        offset: s / steps,
        transform: `translate(${px - size / 2}px, ${py - size / 2}px) scale(${scale})`,
        opacity: s === steps ? 0.3 : 1,
      })
    }
    const star = document.createElement('div')
    star.style.cssText = `position:absolute;left:0;top:0;width:${size}px;height:${size}px;will-change:transform,opacity;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.25))`
    star.innerHTML = STAR_SVG
    layer.appendChild(star)
    const flight = star.animate(keyframes, { duration: GET_READY_FLIGHT_MS, delay: i * stagger, easing: 'linear', fill: 'both' })
    const done = () => {
      star.remove()
      bump(coin)
      flying -= 1
      if (flying === 0) layer.remove()
    }
    flight.onfinish = done
    flight.oncancel = done
  }
  return lands
}

let bumping: Animation | null = null

/** The coin swells as a star lands in it, so a star that only banks toward a point still lands somewhere. */
function bump(coin: HTMLElement) {
  if (!coin.isConnected) return
  bumping?.cancel()
  bumping = coin.animate([{ scale: '1' }, { scale: '1.35' }, { scale: '1' }], { duration: 240, easing: 'ease-out' })
}
