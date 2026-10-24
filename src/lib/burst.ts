/**
 * Bursts for the Quest's moments: confetti, stars and fireworks, each a few dozen spans moved by
 * the graphics chip with element.animate ("Smooth on the board"), gone when they land. Nothing
 * waits on them: they are only to be seen.
 */

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

const GOLD = ['#fbbf24', '#fde68a', '#f59e0b', '#fff7cc', '#ffffff']
const PARTY = ['#38bdf8', '#a3e635', '#f472b6', '#a78bfa', '#fbbf24', '#2dd4bf']
const STAR = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'

function layer(): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'pointer-events-none fixed inset-0 z-[70]'
  document.body.append(el)
  return el
}

/** A burst from a point that arcs up and falls: confetti, or gold stars with `stars`. */
export function burst(x: number, y: number, count: number, gold: boolean, spread = 1, stars = false) {
  if (reduceMotion()) count = Math.min(count, 12)
  const box = layer()
  const colours = gold ? GOLD : PARTY
  let left = count
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span')
    const size = stars ? 14 + Math.random() * 12 : 10
    s.style.cssText = stars
      ? `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;clip-path:${STAR};background:${colours[i % colours.length]}`
      : `position:absolute;left:${x}px;top:${y}px;width:10px;height:14px;border-radius:${i % 3 ? 2 : 7}px;background:${colours[i % colours.length]}`
    box.append(s)
    const a = Math.random() * Math.PI * 2
    const v = (120 + Math.random() * 300) * spread
    const dx = Math.cos(a) * v
    const dy = Math.sin(a) * v * 0.7 - 120 * spread
    s.animate(
      [
        { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.35 },
        {
          transform: `translate(calc(-50% + ${dx * 1.2}px), calc(-50% + ${dy + 420 * spread}px)) rotate(${Math.random() * 900}deg)`,
          opacity: 0,
        },
      ],
      { duration: 1500 + Math.random() * 1100, easing: 'cubic-bezier(.2,.65,.45,1)' },
    ).onfinish = () => {
      s.remove()
      if (--left === 0) box.remove()
    }
  }
}

/**
 * A firework: a spark climbs from (x, y) to (tx, ty) and bursts into a ring of sparks that drift
 * down and fade. onBurst is told the moment it bursts, for its pop.
 */
export function firework(x: number, y: number, tx: number, ty: number, colour: string, onBurst?: () => void) {
  const box = layer()
  const rocket = document.createElement('span')
  rocket.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:8px;height:18px;border-radius:4px;background:linear-gradient(${colour},#fff7cc)`
  box.append(rocket)
  const climb = reduceMotion() ? 1 : 520
  rocket.animate(
    [
      { transform: 'translate(-50%,-50%)', opacity: 1 },
      { transform: `translate(calc(-50% + ${tx - x}px), calc(-50% + ${ty - y}px))`, opacity: 1 },
    ],
    { duration: climb, easing: 'cubic-bezier(.3,.8,.5,1)', fill: 'forwards' },
  ).onfinish = () => {
    rocket.remove()
    onBurst?.()
    const n = reduceMotion() ? 10 : 22
    let left = n
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span')
      const c = i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#fde68a' : colour
      s.style.cssText = `position:absolute;left:${tx}px;top:${ty}px;width:9px;height:9px;border-radius:50%;background:${c}`
      box.append(s)
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.2
      const r = 110 + Math.random() * 70
      const dx = Math.cos(a) * r
      const dy = Math.sin(a) * r
      s.animate(
        [
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`, opacity: 1, offset: 0.45 },
          { transform: `translate(calc(-50% + ${dx * 1.1}px), calc(-50% + ${dy + 90}px)) scale(.4)`, opacity: 0 },
        ],
        { duration: 1300 + Math.random() * 400, easing: 'cubic-bezier(.15,.7,.4,1)' },
      ).onfinish = () => {
        s.remove()
        if (--left === 0) box.remove()
      }
    }
  }
}
