import clsx from 'clsx'

/**
 * The bar along the top (2026-10-10, the teacher's mock-ups): flush against the window's top edge
 * and its far side, square where it meets the window and rounded at its two bottom corners, which
 * face the desks, so it reads as part of the window rather than a card on the board. With no goal
 * it is the same bar holding only the class's name.
 */
export function barClass(side: 'left' | 'right') {
  return clsx(
    'relative flex h-14 shrink-0 items-center gap-2.5 overflow-visible rounded-b-[18px] border-b border-border bg-card/70 px-3 shadow-sm sm:gap-3 sm:px-4',
    side === 'left' ? 'border-l' : 'border-r',
  )
}
