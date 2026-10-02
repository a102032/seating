import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'

/**
 * How many steps a box has had to tighten to fit the height it was given: 0 when it fits as
 * drawn, up to `steps`. The box reads the step (a data attribute, CSS variables) and gives up a
 * little room at each one.
 *
 * Boards come in every size, and Windows' own scaling and Chrome's bars decide how much of the
 * screen a page gets - a 4K board at 300% gives 1280x559. Rather than tuning the panel for a
 * list of screens, it measures itself: drawn, overflowing, one step tighter, measured again,
 * all before the screen is painted, so nobody sees the steps. It starts again from 0 whenever
 * `resetKey` changes (something appeared or went in the box), the window is resized, or the
 * fonts arrive, since a box that needed a step before may not need it now.
 */
export function useFitToHeight(ref: RefObject<HTMLElement | null>, steps: number, resetKey: string): number {
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
  // A new key starts from the roomiest step, decided during render so the stale step is never
  // drawn (React re-renders straight away, before anything reaches the screen).
  let step = state.step
  if (state.key !== key) {
    setState({ key, step: 0 })
    step = 0
  }

  // After every render, on purpose: anything drawn may have pushed the box over. It can only
  // step `steps` times per key, so it can't run away.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || step >= steps) return
    if (el.scrollHeight > el.clientHeight) setState((s) => (s.key === key ? { key, step: s.step + 1 } : s))
  })

  return step
}
