import clsx from 'clsx'
import { LayoutTemplate, X } from 'lucide-react'
import { useState } from 'react'
import type { MockLayout } from './mockup'

interface MockupSwitcherProps {
  layout: MockLayout
  onLayout: (layout: MockLayout) => void
  reachLine: boolean
  onReachLine: (on: boolean) => void
}

const OPTIONS: { id: MockLayout; name: string; who: string; line: string }[] = [
  { id: 'today', name: 'Today', who: 'As it is', line: 'The side panel as the app has it now.' },
  {
    id: 'rail',
    name: 'Rail + Frame',
    who: 'Your idea',
    line: 'A narrow rail says what the board is showing. A frame beside it holds the clock and points.',
  },
  {
    id: 'shelf',
    name: "Teacher's Shelf",
    who: "Claude's idea",
    line: 'Every control in one shelf along the top, the clock in the corner, the desks the full width.',
  },
]

/** The preview's own controls: which layout, and the line a 2nd grader can reach up to. */
export function MockupSwitcher({ layout, onLayout, reachLine, onReachLine }: MockupSwitcherProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {reachLine && (
        // Half the screen's height: a 2nd grader at the teacher's board reaches this far (2026-10-08).
        <div className="pointer-events-none fixed inset-x-0 top-1/2 z-[55]" aria-hidden>
          <div className="border-t-[3px] border-dashed border-rose-500/80" />
          <span className="absolute right-3 top-1 rounded-full bg-rose-600/90 px-2.5 py-0.5 text-xs font-bold text-white shadow">
            A 2nd grader reaches below this line
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-2 right-2 z-[60] flex items-center gap-1.5 rounded-full bg-neutral-900/80 px-3 py-1.5 text-sm font-bold text-white shadow-lg active:scale-95"
        style={{ touchAction: 'manipulation' }}
      >
        <LayoutTemplate size={16} /> Layouts
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3" onClick={() => setOpen(false)}>
          <div
            className="flex max-h-full w-[min(56rem,100%)] flex-col gap-3 overflow-y-auto rounded-3xl bg-card p-4 text-card-foreground shadow-2xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Try a layout</h2>
                <p className="text-sm text-muted-foreground">A preview with an example class. Nothing here touches your real classes.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-accent"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onLayout(o.id)
                    setOpen(false)
                  }}
                  className={clsx(
                    'flex flex-col gap-2 rounded-2xl border-2 p-3 text-left transition-colors',
                    layout === o.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent',
                  )}
                  style={{ touchAction: 'manipulation' }}
                >
                  <Thumb layout={o.id} />
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-base font-bold">{o.name}</span>
                    <span className="text-xs font-semibold text-muted-foreground">{o.who}</span>
                  </div>
                  <span className="text-sm leading-snug text-muted-foreground">{o.line}</span>
                </button>
              ))}
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-border p-3 text-sm font-semibold">
              <input
                type="checkbox"
                className="size-5 accent-rose-600"
                checked={reachLine}
                onChange={(e) => onReachLine(e.target.checked)}
              />
              Show the reach line: half the screen&rsquo;s height, as far up as a 2nd grader can reach
            </label>
          </div>
        </div>
      )}
    </>
  )
}

/** A small drawing of each layout, in the theme's colours. */
function Thumb({ layout }: { layout: MockLayout }) {
  const desk = (x: number, y: number, w: number, h: number, key: string) => (
    <rect key={key} x={x} y={y} width={w} height={h} rx={1.5} className="fill-card stroke-border" strokeWidth={0.6} />
  )
  const grid = (x0: number, y0: number, w: number, h: number) => {
    const cells = []
    const cw = (w - 5 * 2) / 6
    const ch = (h - 4 * 2) / 5
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) cells.push(desk(x0 + c * (cw + 2), y0 + r * (ch + 2), cw, ch, `${r}-${c}`))
    return cells
  }
  const box = 'fill-secondary'
  const lit = 'fill-primary'
  return (
    <svg viewBox="0 0 160 90" className="w-full rounded-xl bg-gradient-to-br from-[var(--app-bg-from)] to-[var(--app-bg-to)]">
      {layout === 'today' && (
        <>
          <rect x={3} y={3} width={34} height={84} rx={4} className={box} />
          <rect x={7} y={14} width={26} height={12} rx={2} className={lit} />
          <rect x={41} y={3} width={116} height={9} rx={3} className={box} />
          {grid(41, 15, 116, 72)}
        </>
      )}
      {layout === 'rail' && (
        <>
          <rect x={3} y={3} width={10} height={84} rx={3} className={box} />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={5} y={6 + i * 8} width={6} height={6} rx={1.5} className={i === 0 ? lit : 'fill-card'} />
          ))}
          <rect x={16} y={3} width={23} height={84} rx={4} className={box} />
          <rect x={18} y={13} width={19} height={11} rx={2} className={lit} />
          <rect x={43} y={3} width={114} height={9} rx={3} className={box} />
          {grid(43, 15, 114, 72)}
        </>
      )}
      {layout === 'shelf' && (
        <>
          <rect x={3} y={3} width={124} height={9} rx={3} className={box} />
          <rect x={3} y={14} width={124} height={9} rx={3} className={box} />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <rect key={i} x={6 + i * 12} y={15.5} width={9} height={6} rx={1.5} className={i === 0 ? lit : 'fill-card'} />
          ))}
          <rect x={130} y={3} width={27} height={20} rx={3} className={lit} />
          {grid(3, 26, 154, 61)}
        </>
      )}
    </svg>
  )
}
