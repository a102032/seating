import clsx from 'clsx'

/**
 * The row along the top (2026-10-10, the teacher's mock-ups): flush against the window's top edge,
 * each piece square where it meets the window and rounded at its bottom corners, which face the
 * desks, so it reads as part of the window rather than cards on the board.
 *
 * Since 2026-10-11 (the teacher's mock-up) it is two pieces with an aisle between them: the goal
 * meter by the rail, the class's progress, and the class's name and gear as a tab in the far
 * corner, the teacher's controls. They shared one bar, and the name read as part of the meter.
 */
const PIECE = 'relative flex h-14 items-center overflow-visible rounded-b-[18px] border-b border-border bg-card/70 shadow-sm'

/** The goal meter: beside the rail, with the board showing on its other side. */
export function barClass() {
  return clsx(PIECE, 'min-w-0 flex-1 gap-2.5 border-x px-3 sm:gap-3 sm:px-4')
}

/** The class's tab in the corner, against the window's far edge: an edge only on the side facing the board. */
export function tabClass(side: 'left' | 'right') {
  return clsx(PIECE, 'min-w-0 max-w-[45%] shrink-0 px-2 sm:px-3', side === 'left' ? 'border-l' : 'border-r')
}

/** With no goal, the timer put away is a piece of its own beside the rail. */
export const clockPieceClass = clsx(PIECE, 'shrink-0 border-x px-2')

/** The gap between the pieces: the width of an aisle between the desks (DeskGrid's --aisle). */
export const ROW_GAP = 'gap-4 sm:gap-6'
