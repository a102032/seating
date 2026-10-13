import clsx from 'clsx'
import { User } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { buildWheel, CHESTS, type Slice } from '../../lib/quest'
import { pointerSVG, wheelSVG } from '../../lib/questArt'
import { gifUrl } from '../../lib/celebrationGifs'
import {
  playBonus,
  playChestKnocks,
  playGiftGold,
  playGoalCelebration,
  playKeyClick,
  playPickerLand,
  playPickerTick,
  playWheelPeg,
} from '../../lib/sound'
import type { QuestPrize } from '../../types'
import { ChestPicture, PrizeIcon } from './QuestPictures'

interface ChestMomentProps {
  /** Which chest: 0 Wood to 4 Mega. */
  chest: number
  prizes: QuestPrize[]
  /** Who is here today, for Pick a Spinner. */
  spinners: { id: string; name: string }[]
  /** A student was picked to spin: a pick, for the participation record. */
  onSpinnerPicked: (id: string) => void
  /** The wheel landed: the prize is won on the spot, and the chest counts as opened. */
  onWon: (prize: QuestPrize) => void
  /** The teacher (or a student) tapped the moment away. */
  onClose: () => void
  /** Where the chest flies in from: the meter's chest. */
  from: () => HTMLElement | null
  /** The celebration GIF that joins the prize card: one of the class's favourites, or none. */
  gifId: string | null
}

const SPIN_MS = 6000
/** The board's second touch: a button that has just appeared ignores taps this long. */
const TAP_GUARD_MS = 700

/** The wheel slows as a cubic: the last two seconds crawl over a slice or two, so the class can cheer it on. */
const ease = (t: number) => 1 - Math.pow(1 - t, 3)
const unease = (x: number) => 1 - Math.cbrt(1 - x)

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** A short burst of paper, one element each, moved by element.animate (the graphics chip's work). */
function confetti(layer: HTMLElement, x: number, y: number, count: number, gold: boolean) {
  if (reduceMotion()) return
  const colours = gold
    ? ['#fbbf24', '#fde68a', '#f59e0b', '#fff7cc', '#ffffff']
    : ['#38bdf8', '#a3e635', '#f472b6', '#a78bfa', '#fbbf24', '#2dd4bf']
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span')
    Object.assign(s.style, {
      position: 'absolute',
      left: `${x}px`,
      top: `${y}px`,
      width: '10px',
      height: '14px',
      borderRadius: Math.random() < 0.3 ? '50%' : '2px',
      background: colours[i % colours.length],
    })
    layer.append(s)
    const ang = Math.random() * Math.PI * 2
    const v = 120 + Math.random() * 300
    const dx = Math.cos(ang) * v
    const dy = Math.sin(ang) * v * 0.7 - 120
    s.animate(
      [
        { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(calc(-50% + ${dx * 1.2}px), calc(-50% + ${dy + 420}px)) rotate(${Math.random() * 900}deg)`, opacity: 0 },
      ],
      { duration: 1500 + Math.random() * 1100, easing: 'cubic-bezier(.2,.65,.45,1)' },
    ).finished.then(() => s.remove())
  }
}

/**
 * The big moment (DECISIONS, "The plan, agreed"): a chest with all its keys, opened on a tap.
 * It fills the screen, strains, bursts open with the fanfare, and a wheel of eight prizes rises
 * out of it. Pick a Spinner chooses a student, or the teacher taps Spin; the wheel turns for about
 * six seconds, popping over each slice and crawling through the last two, and only the slice it
 * lands on turns over. Everything that moves is element.animate or CSS.
 */
export function ChestMoment({ chest, prizes, spinners, onSpinnerPicked, onWon, onClose, from, gifId }: ChestMomentProps) {
  const slices: Slice[] = useMemo(() => buildWheel(chest, prizes), [chest, prizes])
  const [win, setWin] = useState<number | null>(null)
  const wheelSvg = useMemo(() => wheelSVG(chest, slices, win), [chest, slices, win])
  const pointerSvg = useMemo(() => pointerSVG(), [])
  const stageChest = useRef<HTMLDivElement>(null)
  const wheelWrap = useRef<HTMLDivElement>(null)
  const wheel = useRef<HTMLDivElement>(null)
  const pointer = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const dim = useRef<HTMLDivElement>(null)
  const rays = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<'arriving' | 'wheel' | 'picking' | 'spinning' | 'won' | 'prize'>('arriving')
  /** The GIF, once it has loaded (fetched as the chest opens, so it is ready by the prize). */
  const [gifReady, setGifReady] = useState<string | null>(null)
  /** The prize has had its moment: the card may turn over to the GIF. */
  const [flipTime, setFlipTime] = useState(false)

  useEffect(() => {
    if (!gifId) return
    const url = gifUrl(gifId)
    const img = new Image()
    let live = true
    img.onload = () => live && setGifReady(url)
    img.src = url
    return () => {
      live = false
    }
  }, [gifId])
  const [open, setOpen] = useState(false)
  const [spinner, setSpinner] = useState<{ name: string; landed: boolean } | null>(null)
  const stepAt = useRef(performance.now())
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const stopFanfare = useRef<(() => void) | null>(null)
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms))

  useEffect(() => {
    stepAt.current = performance.now()
  }, [step])

  useEffect(() => {
    const live = timers.current
    let cancelled = false
    async function arrive() {
      const c = stageChest.current
      if (!c) return
      dim.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450 })
      const m = from()?.getBoundingClientRect()
      const r = c.getBoundingClientRect()
      const fast = reduceMotion()
      if (m && r.width) {
        await c.animate(
          [
            {
              transform: `translate(${m.left + m.width / 2 - (r.left + r.width / 2)}px, ${m.top + m.height / 2 - (r.top + r.height / 2)}px) scale(${m.width / r.width})`,
            },
            { transform: 'none' },
          ],
          { duration: fast ? 200 : 850, easing: 'cubic-bezier(.3,1.25,.5,1)' },
        ).finished
      }
      if (cancelled) return
      playChestKnocks()
      await c.animate(
        [0, -7, 6, -8, 7, -5, 4, 0].map((d, i) => ({ transform: `rotate(${d}deg) scale(${1 + i * 0.012})` })),
        { duration: fast ? 150 : 950 },
      ).finished
      if (cancelled) return
      setOpen(true)
      playKeyClick()
      stopFanfare.current = playGoalCelebration()
      rays.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, fill: 'forwards' })
      const box = c.getBoundingClientRect()
      if (layer.current) confetti(layer.current, box.left + box.width / 2, box.top + box.height * 0.35, chest === 4 ? 140 : 80, chest >= 3)
      setStep('wheel')
      wheelWrap.current?.animate(
        [
          { transform: 'translateY(55%) scale(.1)', opacity: 0 },
          { transform: 'translateY(-4%) scale(1.04)', opacity: 1, offset: 0.75 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: fast ? 200 : 950, easing: 'cubic-bezier(.3,.9,.4,1)', fill: 'backwards' },
      )
    }
    void arrive()
    return () => {
      cancelled = true
      live.forEach(clearTimeout)
      stopFanfare.current?.()
    }
    // Once, as it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const guarded = () => performance.now() - stepAt.current < TAP_GUARD_MS

  /** Pick a Spinner: names flicker past at the picker's pace, then one lands. */
  function pickSpinner() {
    if (guarded() || step !== 'wheel' || spinners.length === 0) return
    setStep('picking')
    const steps = 24
    let last = -1
    let at = 0
    for (let s = 0; s < steps; s++) {
      at += 90 + Math.max(0, s - 14) * 18
      const final = s === steps - 1
      later(() => {
        let n = Math.floor(Math.random() * spinners.length)
        if (spinners.length > 1) while (n === last) n = Math.floor(Math.random() * spinners.length)
        last = n
        if (final) {
          setSpinner({ name: spinners[n].name, landed: true })
          playPickerLand()
          onSpinnerPicked(spinners[n].id)
          setStep('wheel')
        } else {
          setSpinner({ name: spinners[n].name, landed: false })
          playPickerTick()
        }
      }, at)
    }
  }

  function spin() {
    if (guarded() || step !== 'wheel') return
    setStep('spinning')
    const chosen = Math.floor(Math.random() * 8)
    const jitter = (Math.random() - 0.5) * 30
    const turns = 5
    const base = (((-chosen * 45) % 360) + 360) % 360
    const target = turns * 360 + base + jitter
    const fast = reduceMotion()
    const dur = fast ? 1500 : SPIN_MS
    // Sampled keyframes of the ease, run by the graphics chip; the pegs' pops are set ahead from the same curve.
    const frames = Array.from({ length: 41 }, (_, i) => ({ transform: `rotate(${(target * ease(i / 40)).toFixed(2)}deg)` }))
    wheel.current?.animate(frames, { duration: dur, easing: 'linear', fill: 'forwards' })
    for (let k = 1; k * 45 - 22.5 < target; k++) {
      const t = unease((k * 45 - 22.5) / target) * dur
      later(() => {
        playWheelPeg()
        pointer.current?.animate([{ transform: 'rotate(-24deg)' }, { transform: 'rotate(0)' }], { duration: 140, easing: 'ease-out' })
      }, t)
    }
    later(() => land(chosen), dur + 80)
  }

  function land(i: number) {
    playPickerLand()
    setWin(i)
    setStep('won')
    onWon(slices[i].prize)
    // The slice turns over; then the prize fills the screen, alone (2026-10-13, the teacher).
    later(() => showPrize(i), 1100)
  }

  function showPrize(i: number) {
    const { size } = slices[i]
    setStep('prize')
    if (size === 'b') playGiftGold()
    else playBonus()
    if (layer.current) confetti(layer.current, innerWidth / 2, innerHeight * 0.42, size === 'b' ? 150 : 90, size === 'b')
    // A few seconds of the prize alone, then the card turns over to the class's GIF, the prize's
    // name under it (2026-10-13, the teacher): the prize lands first, then the party.
    later(() => setFlipTime(true), 2600)
  }

  function close() {
    if (step !== 'prize' || guarded()) return
    stopFanfare.current?.()
    stopFanfare.current = null
    onClose()
  }

  const won = win !== null ? slices[win] : null
  const tier = CHESTS[chest]
  const buttonStyle = { fontSize: 'clamp(1rem, 3vmin, 1.6rem)', minWidth: 'min(22vw, 13rem)' }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden"
      onPointerDown={close}
      data-chest-moment=""
    >
      <div ref={dim} className="absolute inset-0 bg-[rgba(17,12,44,0.88)]" />
      <div
        ref={rays}
        className="quest-rays pointer-events-none absolute left-1/2 top-[46%] h-[150vmax] w-[150vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ opacity: 0 }}
      />
      {spinner && (
        <div
          className="absolute left-1/2 top-[max(1.5vh,8px)] z-[3] -translate-x-1/2 whitespace-nowrap rounded-full border-[3px] px-[0.9em] py-[0.1em] font-bold text-white"
          style={{
            fontSize: 'clamp(1.2rem, 5vmin, 2.8rem)',
            borderColor: spinner.landed ? '#f59e0b' : 'transparent',
            background: spinner.landed ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.12)',
          }}
        >
          {spinner.landed ? `${spinner.name}, spin!` : spinner.name}
        </div>
      )}
      <div className="relative flex flex-col items-center">
        <div
          ref={wheelWrap}
          className="relative z-[1] aspect-square"
          style={{ width: 'min(54vh, 78vw)', visibility: step === 'arriving' ? 'hidden' : undefined }}
        >
          <div
            ref={pointer}
            className="absolute left-1/2 top-[-3.5%] z-[2] ml-[-5.5%] aspect-[0.8] w-[11%] origin-[50%_20%]"
            dangerouslySetInnerHTML={{ __html: pointerSvg }}
          />
          <div
            ref={wheel}
            className="h-full w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: wheelSvg }}
          />
        </div>
        <div className="relative z-[2] mt-[-4vh] flex items-end justify-center gap-[clamp(12px,3vw,48px)]">
          <button
            type="button"
            className="mb-[2vh] flex items-center justify-center gap-2 rounded-[18px] border border-violet-300/40 bg-[#f6f1ff] px-4 py-[0.6em] font-bold text-[#5b3fa0]"
            style={{ ...buttonStyle, visibility: step === 'wheel' && !spinner?.landed && spinners.length > 0 ? 'visible' : 'hidden' }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={pickSpinner}
          >
            <User className="size-[1.1em]" /> Pick a Spinner
          </button>
          <div ref={stageChest} style={{ width: 'min(26vh, 34vw)' }} title={`${tier.name} chest`}>
            <ChestPicture chest={chest} keys={tier.keys} open={open} className="[&>svg]:h-auto [&>svg]:w-full" />
          </div>
          <button
            type="button"
            className="mb-[2vh] rounded-[18px] border border-[#e9b800] bg-[#ffd84d] px-4 py-[0.6em] font-bold text-[#6b3f00]"
            style={{ ...buttonStyle, fontSize: 'clamp(1.3rem, 4.2vmin, 2.3rem)', visibility: step === 'wheel' ? 'visible' : 'hidden' }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={spin}
          >
            Spin!
          </button>
        </div>
      </div>
      {/* The prize fills the screen until it is tapped: the card, then, turned over, the class's
          GIF with the prize's name under it. With no GIF (none chosen, or not loaded) it stays as it is. */}
      {won && step === 'prize' && (
        <div className="absolute inset-0 z-[3] flex items-center justify-center bg-[rgba(17,12,44,0.6)] px-[3vw]" data-prize="">
          <div className="quest-prize-in" style={{ perspective: '1600px' }}>
            <div className={clsx('quest-flip grid', flipTime && gifReady && 'quest-flipped')} data-prize-card="">
              {(['front', 'back'] as const).map((face) => (
                <div
                  key={face}
                  className={clsx(
                    'quest-face flex flex-col items-center justify-center gap-[clamp(6px,1.5vh,14px)] rounded-[32px] border-8 px-5 py-[clamp(12px,2.5vh,26px)] text-center shadow-[0_24px_60px_rgba(0,0,0,0.45)]',
                    face === 'back' && 'quest-face-back',
                  )}
                  style={{
                    width: 'min(62vw, 34rem)',
                    borderColor: won.size === 'b' ? '#f59e0b' : won.size === 'm' ? '#94a3b8' : '#a78bfa',
                    background:
                      won.size === 'b'
                        ? 'radial-gradient(circle at 50% 30%, #fffbe6 0%, #fde68a 60%, #fbbf24 100%)'
                        : won.size === 'm'
                          ? 'linear-gradient(160deg, #ffffff, #e2e8f0)'
                          : '#ffffff',
                  }}
                  data-prize-gif={face === 'back' ? '' : undefined}
                >
                  {face === 'front' ? (
                    <div
                      className="grid aspect-square place-items-center rounded-full"
                      style={{
                        width: 'clamp(80px, 24vh, 190px)',
                        background: won.size === 'b' ? '#ffffff' : won.size === 'm' ? '#f1f5f9' : '#f3ecff',
                        color: won.size === 'b' ? '#d97706' : won.size === 'm' ? '#475569' : '#7c3aed',
                      }}
                    >
                      <PrizeIcon
                        name={won.prize.name}
                        size={80}
                        className="[&>svg]:h-[clamp(46px,13vh,110px)] [&>svg]:w-[clamp(46px,13vh,110px)]"
                      />
                    </div>
                  ) : (
                    gifReady && (
                      <img
                        src={gifReady}
                        alt=""
                        className="block min-h-0 rounded-2xl object-contain"
                        style={{ maxHeight: '46vh', maxWidth: '100%' }}
                      />
                    )
                  )}
                  <div
                    className="font-bold leading-[1.05] [text-wrap:balance]"
                    style={{
                      fontSize: face === 'front' ? 'clamp(1.8rem, 7vmin, 4rem)' : 'clamp(1.4rem, 5vmin, 3rem)',
                      color: won.size === 'b' ? '#7c2d12' : '#2e2350',
                    }}
                  >
                    {won.prize.name}!
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div ref={layer} className="pointer-events-none fixed inset-0 z-[4]" />
    </div>,
    document.body,
  )
}
