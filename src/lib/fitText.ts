/** Font size the desks use, expressed in cqi (percent of the desk's own width) so it scales with the board. */
const MIN_CQI = 10
const MAX_CQI = 16
/** Desk width left for the name once its padding is taken off. */
const AVAILABLE_CQI = 88
const REFERENCE_PX = 100

let measuringContext: CanvasRenderingContext2D | null | undefined

function widthAtReferenceSize(text: string): number {
  if (measuringContext === undefined) {
    measuringContext = document.createElement('canvas').getContext('2d')
  }
  if (!measuringContext) return text.length * REFERENCE_PX * 0.58
  measuringContext.font = `700 ${REFERENCE_PX}px Andika, system-ui, sans-serif`
  return measuringContext.measureText(text).width
}

/**
 * One name size for the whole class, chosen so the longest name fits.
 *
 * Sizing each name individually would leave one student's desk visibly smaller than
 * everyone else's, which singles them out. The floor stops a single pasted-in full
 * name from shrinking all thirty desks - past that point the one name truncates instead.
 */
export function fitClassNameSize(names: string[]): number {
  const widest = names.reduce((max, name) => Math.max(max, widthAtReferenceSize(name)), 0)
  if (widest <= 0) return MAX_CQI
  // Text width scales linearly with font size, so one measurement gives the fitting size.
  const fitted = (AVAILABLE_CQI * REFERENCE_PX) / widest
  return Math.min(MAX_CQI, Math.max(MIN_CQI, fitted))
}
