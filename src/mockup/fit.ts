import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'

/**
 * How many steps a box has had to tighten to fit, like hooks/useFitToHeight: drawn, measured,
 * one step tighter if it runs over, all before anything is painted, and again when `resetKey`
 * changes, the window is resized or the fonts arrive. `overflows` says what running over means.
 */
function useFit(ref: RefObject<HTMLElement | null>, steps: number, resetKey: string, overflows: (el: HTMLElement) => boolean): number {
  const [epoch, setEpoch] = useState(0)
  useEffect(() => {
    const again = () => setEpoch((n) => n + 1)
    window.addEventListener('resize', again)
    document.fonts?.addEventListener('loadingdone', again)
    return () => {
      window.removeEventListener('resize', again)
      document.fonts?.removeEventListener('loadingdone', again)
    }
  }, [])

  const key = `${resetKey}|${epoch}`
  const [state, setState] = useState({ key, step: 0 })
  let step = state.step
  if (state.key !== key) {
    setState({ key, step: 0 })
    step = 0
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || step >= steps) return
    if (overflows(el)) setState((s) => (s.key === key ? { key, step: s.step + 1 } : s))
  })

  return step
}

/** A row that has to fit its width (the shelf). */
export function useFitToWidth(ref: RefObject<HTMLElement | null>, steps: number, resetKey: string): number {
  return useFit(ref, steps, resetKey, (el) => el.scrollWidth > el.clientWidth + 1)
}

/**
 * A column that has to fit its height, counting only what is laid out in it: the timer's drawer
 * hangs below the clock out of the flow, and must not make the column tighten for room it never
 * takes up. Gaps are counted from the column's own row gap.
 */
export function useFitByFlow(ref: RefObject<HTMLElement | null>, steps: number, resetKey: string): number {
  return useFit(ref, steps, resetKey, (el) => {
    const kids = [...el.children].filter((c) => !['absolute', 'fixed'].includes(getComputedStyle(c).position)) as HTMLElement[]
    const gap = parseFloat(getComputedStyle(el).rowGap) || 0
    const used = kids.reduce((n, c) => n + c.offsetHeight, 0) + gap * Math.max(0, kids.length - 1)
    return used > el.clientHeight + 1
  })
}
