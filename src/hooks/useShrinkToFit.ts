import { useLayoutEffect, useRef } from 'react'

/**
 * Shrinks a one-line label a little when it doesn't fit, before it truncates.
 *
 * Sets `--fit` on the element (a scale, 1 when it fits), for its font-size to multiply by.
 * Measured in the DOM rather than with fitText's canvas, because the label may be in a
 * theme's own face - Chalkboard and Comic Book letter the class name in wider fonts than
 * Andika. The floor keeps a very long name from going tiny: past it, the ellipsis returns.
 *
 * It re-measures when the label's box changes, when the theme changes (a new face can be
 * wider in the same box), and when a web font finishes loading (it swaps in after paint).
 */
export function useShrinkToFit<T extends HTMLElement>(text: string | undefined, minScale: number) {
  const ref = useRef<T>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      // Measure at full size, then scale down by exactly how much it overflowed.
      el.style.removeProperty('--fit')
      // The widths are whole pixels and the text isn't, so a pixel is kept back or the
      // shrunken text can still be a fraction too wide and get its ellipsis anyway.
      const ratio = el.scrollWidth > el.clientWidth ? (el.clientWidth - 1) / el.scrollWidth : 1
      if (ratio < 1) el.style.setProperty('--fit', String(Math.max(minScale, ratio)))
    }
    fit()
    const resize = new ResizeObserver(fit)
    resize.observe(el)
    if (el.parentElement) resize.observe(el.parentElement)
    const theme = new MutationObserver(fit)
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    document.fonts?.addEventListener('loadingdone', fit)
    return () => {
      resize.disconnect()
      theme.disconnect()
      document.fonts?.removeEventListener('loadingdone', fit)
    }
  }, [text, minScale])

  return ref
}
