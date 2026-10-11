import { ArrowLeft, ArrowRight, Check, Minimize2, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { assetUrl } from '../lib/assets'
import { stickerSrc } from '../lib/stickers'
import { loadTourResume, saveTourResume, SHOT_H, SHOT_W, TOUR, TOUR_RECTS, type TourShot, type TourStop } from '../lib/tour'
import { PickStudentIcon } from './PickerIcons'
import { DrumIcon } from './RailIcons'

/** The helper's colours, the same as the guide's bubble, in every theme. */
const SKY = '#dcefff'
const NAVY = '#0c2d57'
const BLUE = '#0b74c4'

/** The bubble's own width, narrowed only to fit beside a tall thing. */
const BUBBLE_W = 'min(24rem, calc(100vw - 16px))'

const SHOTS: TourShot[] = ['board', 'flip', 'chooser', 'groups', 'timer', 'howlong', 'star']
const shotUrl = (shot: TourShot) => assetUrl(`/tour/${shot}.jpg`)

type Phase = { phase: 'start' | 'resume' | 'intro' | 'stop' | 'end'; part: number; stop: number }
type Box = { left: number; top: number; right: number; bottom: number }

/** The picture fitted to the screen whole, in the middle, as large as it goes. */
function fit() {
  const s = Math.min(innerWidth / SHOT_W, innerHeight / SHOT_H)
  return { s, ox: (innerWidth - SHOT_W * s) / 2, oy: (innerHeight - SHOT_H * s) / 2 }
}

/**
 * The lesson the floating class goal sits over: a slide, as PowerPoint or Google Slides would show
 * it, drawn at the pictures' size.
 */
function SlideMock() {
  return (
    <div
      className="absolute inset-0 flex flex-col items-start gap-[18px] bg-[#fffdf5] px-[70px] py-[46px] text-[#1f2a44]"
      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
    >
      <div className="absolute inset-x-0 top-0 h-[18px] bg-[#2f6fb3]" />
      <h4 className="m-0 mt-2.5 text-[46px] font-bold">Unit 5: Animals</h4>
      <p className="m-0 text-[26px]">Open your book to page 134.</p>
      <p className="m-0 text-[26px]">Which animal is it?</p>
      <div className="mt-[18px] flex gap-7">
        {['owl/owl', 'chameleon/chameleon', 'sheep/sheep', 'crocodile/crocodile'].map((id) => {
          const [theme, pose] = id.split('/')
          return <img key={id} src={stickerSrc(theme, pose)} alt="" className="h-[120px] w-[120px] object-contain" />
        })}
      </div>
      <div className="absolute inset-x-[70px] bottom-6 flex justify-between text-base text-[#6b7280]">
        <span>English 4B</span>
        <span>5</span>
      </div>
    </div>
  )
}

/** The floating class goal as the browser shows it: its own small window, with the app inside. */
function FloatMock() {
  const panel =
    'flex flex-1 items-center justify-center gap-1.5 rounded-[14px] bg-white text-base font-bold text-[#5b3fa0] shadow-[0_1px_3px_rgba(0,0,0,0.12)]'
  return (
    <div
      data-fl="window"
      className="absolute left-[860px] top-[74px] h-[196px] w-[360px] overflow-hidden rounded-[10px] bg-white shadow-[0_14px_34px_rgba(0,0,0,0.35)]"
    >
      <div
        className="flex h-[30px] items-center gap-2 bg-[#dee1e6] px-2.5 text-xs text-[#3c4043]"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        <span className="flex-1">a102032.github.io</span>
        <ArrowLeft size={16} />
        <X size={16} />
      </div>
      <div
        className="flex h-[166px] flex-col gap-2.5 bg-gradient-to-br from-[#6bd9f7] to-[#38bdf8] px-3 pb-3 pt-2.5"
        style={{ fontFamily: 'Andika, sans-serif' }}
      >
        <div className="flex items-center gap-2 rounded-xl bg-white px-2 py-1.5">
          <img src={assetUrl('/treasure/map.svg')} alt="" className="h-[26px] w-[26px]" />
          <div className="h-2.5 flex-1 overflow-hidden rounded-md bg-[#ede4ff]">
            <div className="h-full w-[36%] bg-gradient-to-r from-[#a3e635] to-[#22c55e]" />
          </div>
          <img src={assetUrl('/treasure/chest-closed.svg')} alt="" className="h-[26px] w-[26px]" />
          <span className="text-sm font-bold text-[#1e2a44]">18 / 50</span>
          <span data-fl="shrink" className="grid h-7 w-7 place-items-center rounded-lg bg-[#f6f1ff] text-[#5b3fa0]">
            <Minimize2 size={16} />
          </span>
        </div>
        <div className="flex flex-1 gap-2">
          <div data-fl="plus" className={`${panel} !bg-[#ffd84d]`}>
            <img src={assetUrl('/treasure/star-coin.svg')} alt="" className="h-10 w-10" />
          </div>
          <div data-fl="pick" className={panel}>
            <PickStudentIcon className="h-7 w-7" /> Pick
          </div>
          <div data-fl="ready" className={panel}>
            <DrumIcon className="h-7 w-7" />
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({ step, title, children, buttons }: { step: string; title: string; children?: ReactNode; buttons: ReactNode }) {
  return (
    <div
      role="dialog"
      aria-label="Tour"
      data-tour-card=""
      className="absolute left-1/2 top-1/2 flex w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-2.5 rounded-[22px] px-[22px] py-5 shadow-[0_20px_50px_rgba(12,45,87,0.25)]"
      style={{ background: SKY, color: NAVY }}
    >
      <span className="text-[13px] font-bold" style={{ color: BLUE }}>
        {step}
      </span>
      <h3 className="m-0 text-2xl font-bold leading-tight">{title}</h3>
      {children}
      <div className="mt-1 flex flex-wrap justify-end gap-2">{buttons}</div>
    </div>
  )
}

function Quiet({ children, onClick, data }: { children: ReactNode; onClick: () => void; data?: string }) {
  return (
    <button
      type="button"
      data-tour-action={data}
      onClick={onClick}
      className="rounded-xl px-3.5 py-2 font-bold hover:bg-white/60"
      style={{ color: NAVY, touchAction: 'manipulation' }}
    >
      {children}
    </button>
  )
}

function Go({ children, onClick, data }: { children: ReactNode; onClick: () => void; data?: string }) {
  return (
    <button
      type="button"
      data-tour-action={data}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2 font-bold text-white transition-[scale] duration-150 active:scale-[0.96]"
      style={{ background: BLUE, touchAction: 'manipulation' }}
    >
      {children}
    </button>
  )
}

/**
 * The tour: a picture of each screen over the whole app, one thing lit at a time with a bubble
 * saying what it does, and between parts a card saying what comes next, with Keep going, Skip this
 * part and Stop here. Stopped partway, it offers to pick up where it left off next time.
 */
export function Tour({ onClose }: { onClose: () => void }) {
  const [at, setAt] = useState<Phase>(() => ({ phase: loadTourResume() !== null ? 'resume' : 'start', part: 0, stop: 0 }))
  const [resume] = useState(loadTourResume)
  const [size, setSize] = useState(fit)
  const [hole, setHole] = useState<Box | null>(null)
  const [bubble, setBubble] = useState<{ left: number; top: number; width?: number } | null>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const picRef = useRef<HTMLDivElement>(null)

  // The pictures are fetched as the tour opens, so each part is there by the time it comes.
  useEffect(() => {
    SHOTS.forEach((shot) => {
      new Image().src = shotUrl(shot)
    })
  }, [])

  useEffect(() => {
    const onResize = () => setSize(fit())
    addEventListener('resize', onResize)
    return () => removeEventListener('resize', onResize)
  }, [])

  function stop() {
    // Next time: the part it was in, or the one it was about to start; finished, from the start.
    if (at.phase === 'end') saveTourResume(null)
    else if (at.phase === 'stop' || at.phase === 'intro') saveTourResume(at.part)
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && stop()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  const part = TOUR[at.part]
  const stopNow: TourStop | null = at.phase === 'stop' ? part.stops[at.stop] : null
  const shot: TourShot | 'slides' = stopNow ? stopNow.shot : at.phase === 'intro' ? part.stops[0].shot : 'board'

  // Where the lit thing is on the screen: from the picture's record, or measured in the drawing.
  useLayoutEffect(() => {
    if (!stopNow) {
      setHole(null)
      return
    }
    const { s, ox, oy } = size
    if (stopNow.shot === 'slides') {
      const el = picRef.current?.querySelector(`[data-fl="${stopNow.at}"]`)
      const r = el?.getBoundingClientRect()
      setHole(r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null)
    } else {
      const rect = TOUR_RECTS[stopNow.shot]?.[stopNow.at]
      setHole(rect ? { left: ox + rect[0] * s, top: oy + rect[1] * s, right: ox + rect[2] * s, bottom: oy + rect[3] * s } : null)
    }
  }, [stopNow, size])

  // The bubble beside it: beside a side button, so the buttons under it stay in view; else under
  // it, over it, or beside it a little narrower; else wherever covers least of it.
  useLayoutEffect(() => {
    const el = bubbleRef.current
    if (!el || !hole || !stopNow) {
      setBubble(null)
      return
    }
    const W = innerWidth
    const H = innerHeight
    const gap = 10
    const pad = 6
    const x = Math.max(4, hole.left - pad)
    const y = Math.max(4, hole.top - pad)
    const hw = Math.min(W - 4, hole.right + pad) - x
    const hh = Math.min(H - 4, hole.bottom + pad) - y
    el.style.width = BUBBLE_W
    let bw = el.offsetWidth
    let bh = el.offsetHeight
    const room = { right: W - 8 - (x + hw + gap), left: x - gap - 8 }
    const sideTop = () => Math.min(Math.max(8, y + hh / 2 - bh / 2), H - bh - 8)
    const beside = (side: 'left' | 'right'): { left: number; top: number; width?: number } | null => {
      if (room[side] < Math.min(bw, 240)) return null
      let width: number | undefined
      if (room[side] < bw) {
        width = room[side]
        el.style.width = `${width}px`
        bw = el.offsetWidth
        bh = el.offsetHeight
      }
      if (bh > H - 16) return null
      return { left: side === 'right' ? x + hw + gap : x - gap - bw, top: sideTop(), width }
    }
    const left = Math.min(Math.max(8, x), W - bw - 8)
    const onRail = stopNow.shot !== 'slides' && (TOUR_RECTS[stopNow.shot]?.[stopNow.at]?.[2] ?? 999) < 100
    const first = room.right >= room.left ? 'right' : 'left'
    const next =
      (onRail && beside('right')) ||
      (y + hh + gap + bh <= H - 8 ? { left, top: y + hh + gap } : null) ||
      (y - gap - bh >= 8 ? { left, top: y - gap - bh } : null) ||
      beside(first) ||
      beside(first === 'right' ? 'left' : 'right')
    if (next) {
      setBubble(next)
      return
    }
    el.style.width = BUBBLE_W
    bw = el.offsetWidth
    bh = el.offsetHeight
    const below = Math.min(y + hh + gap, H - bh - 8)
    const above = Math.max(8, y - gap - bh)
    const covers = (t: number) => Math.max(0, Math.min(t + bh, y + hh) - Math.max(t, y))
    setBubble({ left: Math.min(Math.max(8, x), W - bw - 8), top: covers(below) <= covers(above) ? below : above })
  }, [hole, stopNow])

  const begin = () => {
    saveTourResume(null)
    setAt({ phase: 'stop', part: 0, stop: 0 })
  }
  const next = () => {
    if (at.stop < part.stops.length - 1) setAt({ ...at, stop: at.stop + 1 })
    else if (at.part < TOUR.length - 1) setAt({ phase: 'intro', part: at.part + 1, stop: 0 })
    else setAt({ phase: 'end', part: 0, stop: 0 })
  }
  const back = () => {
    if (at.stop > 0) setAt({ ...at, stop: at.stop - 1 })
    else if (at.part > 0) setAt({ phase: 'intro', part: at.part, stop: 0 })
  }
  const skip = () => setAt(at.part + 1 < TOUR.length ? { phase: 'intro', part: at.part + 1, stop: 0 } : { phase: 'end', part: 0, stop: 0 })

  const { s, ox, oy } = size
  const lastStop = stopNow !== null && at.stop === part.stops.length - 1
  const lastPart = at.part === TOUR.length - 1
  const pad = 6
  const lit = hole && {
    left: Math.max(4, hole.left - pad),
    top: Math.max(4, hole.top - pad),
    width: Math.min(innerWidth - 4, hole.right + pad) - Math.max(4, hole.left - pad),
    height: Math.min(innerHeight - 4, hole.bottom + pad) - Math.max(4, hole.top - pad),
  }
  const bubbleStyle: CSSProperties = bubble
    ? { left: bubble.left, top: bubble.top, width: bubble.width ?? BUBBLE_W }
    : { left: 8, top: 8, width: BUBBLE_W, visibility: 'hidden' }

  return createPortal(
    // Over everything, the whole screen: the tour only shows, so nothing under it answers to a tap.
    <div
      data-tour=""
      className="fixed inset-0 z-[110] bg-gradient-to-br from-[#6bd9f7] to-[#38bdf8]"
      style={{ fontFamily: 'Andika, ui-rounded, sans-serif' }}
    >
      <div ref={picRef} className="absolute overflow-hidden" style={{ left: ox, top: oy, width: SHOT_W * s, height: SHOT_H * s }}>
        <div className="absolute left-0 top-0" style={{ width: SHOT_W, height: SHOT_H, transform: `scale(${s})`, transformOrigin: '0 0' }}>
          {shot === 'slides' ? (
            <>
              <SlideMock />
              <FloatMock />
            </>
          ) : (
            <img src={shotUrl(shot)} alt="" draggable={false} className="block select-none" style={{ width: SHOT_W, height: SHOT_H }} />
          )}
        </div>
      </div>
      {at.phase !== 'stop' && <div className="absolute inset-0 bg-white/[0.72]" />}
      {stopNow && lit && (
        <div
          data-tour-hole=""
          className="pointer-events-none absolute rounded-[14px] transition-[left,top,width,height] duration-200"
          style={{ ...lit, boxShadow: '0 0 0 3px #f59e0b, 0 0 0 4000px rgba(255, 255, 255, 0.72)' }}
        />
      )}
      {stopNow && (
        <div
          ref={bubbleRef}
          role="dialog"
          aria-label="Tour"
          data-tour-bubble=""
          className="absolute flex flex-col gap-1.5 rounded-2xl px-3.5 py-2.5 shadow-[0_8px_24px_rgba(12,45,87,0.2)]"
          style={{ ...bubbleStyle, background: SKY, color: NAVY }}
        >
          <div className="flex items-center justify-between gap-2 text-[13px] font-bold" style={{ color: BLUE }}>
            <span>
              {part.title} · {at.stop + 1} of {part.stops.length}
            </span>
            <button
              type="button"
              onClick={stop}
              data-tour-action="stop"
              className="rounded-lg px-2 py-0.5 opacity-75 hover:bg-white/60 hover:opacity-100"
              style={{ color: NAVY }}
            >
              Stop tour
            </button>
          </div>
          <p className="m-0 text-base font-bold leading-snug">{stopNow.text}</p>
          {stopNow.example && <ExampleBox />}
          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={back}
              disabled={at.part === 0 && at.stop === 0}
              data-tour-action="back"
              className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 font-bold disabled:opacity-35"
              style={{ color: NAVY, touchAction: 'manipulation' }}
            >
              <ArrowLeft size={18} /> Back
            </button>
            <Go onClick={next} data="next">
              {lastStop ? (lastPart ? 'Finish' : 'Next part') : 'Next'}{' '}
              {lastStop && lastPart ? <Check size={18} /> : <ArrowRight size={18} />}
            </Go>
          </div>
        </div>
      )}
      {at.phase === 'start' && (
        <Card
          step="A tour of Class? Yes!"
          title="Every screen, one part at a time"
          buttons={
            <>
              <Quiet onClick={stop} data="not-now">
                Not now
              </Quiet>
              <Go onClick={begin} data="begin">
                Start the tour <ArrowRight size={18} />
              </Go>
            </>
          }
        >
          <ol className="m-0 columns-2 gap-6 pl-[1.4em] text-[15px] leading-normal">
            {TOUR.map((p) => (
              <li key={p.title}>{p.title}</li>
            ))}
          </ol>
          <p className="m-0 text-base">You can stop after any part.</p>
        </Card>
      )}
      {at.phase === 'resume' && resume !== null && (
        <Card
          step="A tour of Class? Yes!"
          title="Start where you left off?"
          buttons={
            <>
              <Quiet onClick={begin} data="from-start">
                From the beginning
              </Quiet>
              <Go
                onClick={() => setAt(resume > 0 ? { phase: 'intro', part: resume, stop: 0 } : { phase: 'stop', part: 0, stop: 0 })}
                data="resume"
              >
                Where I left off <ArrowRight size={18} />
              </Go>
            </>
          }
        >
          <p className="m-0 text-base">
            You were up to <b>{TOUR[resume].title}</b>.
          </p>
        </Card>
      )}
      {at.phase === 'intro' && (
        <Card
          step={`Next, part ${at.part + 1} of ${TOUR.length}:`}
          title={part.title}
          buttons={
            <>
              <Quiet onClick={stop} data="stop-here">
                Stop here
              </Quiet>
              <Quiet onClick={skip} data="skip">
                Skip this part
              </Quiet>
              <Go onClick={() => setAt({ phase: 'stop', part: at.part, stop: 0 })} data="go">
                Keep going <ArrowRight size={18} />
              </Go>
            </>
          }
        >
          <p className="m-0 text-base">{part.intro}</p>
        </Card>
      )}
      {at.phase === 'end' && (
        <Card
          step="All six parts"
          title="That’s the tour!"
          buttons={
            <Go onClick={stop} data="done">
              Done <Check size={18} />
            </Go>
          }
        >
          <p className="m-0 text-base">
            Help in Class Settings can take you through it again, or guide you step by step through any section.
          </p>
        </Card>
      )}
    </div>,
    document.body,
  )
}

/**
 * The floating class goal over a lesson slide, the whole screen shrunk to the bubble's width. Its
 * height is held by its shape, so the bubble is measured at its full height before the drawing is in.
 */
function ExampleBox() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      role="img"
      aria-label="For example: the floating class goal over a lesson slide"
      className="relative aspect-[1280/559] w-full shrink-0 overflow-hidden rounded-[10px] shadow-[0_0_0_1px_rgba(12,45,87,0.18)]"
    >
      {width > 0 && (
        <div
          className="absolute left-0 top-0"
          style={{ width: SHOT_W, height: SHOT_H, transform: `scale(${width / SHOT_W})`, transformOrigin: '0 0' }}
        >
          <SlideMock />
          <FloatMock />
        </div>
      )}
    </div>
  )
}
