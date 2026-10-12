import clsx from 'clsx'
import { X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { assetUrl } from '../../lib/assets'
import { chestNow, CHESTS } from '../../lib/quest'
import type { QuestState } from '../../types'
import { ChestPicture, KeyPips, PrizeIcon } from './QuestPictures'

interface OurQuestProps {
  quest: QuestState
  /** The chest is full: a tap on it opens it. */
  onOpenChest: () => void
  onClose: () => void
}

const art = (name: string) => assetUrl(`/quest/${name}`)

/** Low, high, low, high, and the Mega chest in the middle at the end. */
const ROW = ['low', 'high', 'low', 'high', 'mega'] as const

/**
 * The landmarks, where the zigzag leaves room (design/quest/STYLE.md): the castle over the first
 * chest, the forest under the second, the hills over the third, the bridge under the fourth, and
 * the mountain with its cave just behind the Mega chest, so the chest sits at the cave's mouth.
 */
const LANDMARKS = ['landmark-castle.png', 'landmark-forest.png', 'landmark-hills.png', 'landmark-bridge.png', 'landmark-mountain-cave.png']

/**
 * Our Quest (DECISIONS, "Treasure Quest"): a tap on the meter's chest slides the quest over the
 * board, on an old treasure map - the chests opened so far with what was inside, the one now with
 * its keys, and the Mega chest at the end. The chests zigzag and a dotted trail winds between
 * them, dark ink for the way walked and faint ahead; the knight stands by the chest the class is
 * on and the dragon sleeps by the Mega chest. It never scrolls: everything is a share of the map,
 * and it stays until it is tapped closed.
 */
export function OurQuest({ quest, onOpenChest, onClose }: OurQuestProps) {
  const now = chestNow(quest)
  const trail = useRef<HTMLDivElement>(null)
  const path = useRef<SVGSVGElement>(null)

  // The trail is drawn from where the chests really are, so again whenever the map changes size.
  useLayoutEffect(() => {
    const box = trail.current
    const svg = path.current
    if (!box || !svg) return
    const draw = () => {
      const tb = box.getBoundingClientRect()
      if (!tb.width) return
      const chests = [...box.querySelectorAll('[data-quest-station] .quest-sc')].map((e) => {
        const r = e.getBoundingClientRect()
        return { l: r.left - tb.left, r: r.right - tb.left, y: r.top - tb.top + r.height * 0.55 }
      })
      const gap = Math.max(8, tb.width * 0.012)
      svg.setAttribute('viewBox', `0 0 ${tb.width} ${tb.height}`)
      svg.innerHTML = chests
        .slice(1)
        .map((b, i) => {
          const a = chests[i]
          const x1 = a.r + gap
          const x2 = b.l - gap
          if (x2 - x1 < 14) return ''
          const dx = (x2 - x1) * 0.5
          const walked = i + 1 <= now.chest
          return `<path d="M${x1.toFixed(1)} ${a.y.toFixed(1)} C${(x1 + dx).toFixed(1)} ${a.y.toFixed(1)} ${(x2 - dx).toFixed(1)} ${b.y.toFixed(1)} ${x2.toFixed(1)} ${b.y.toFixed(1)}" fill="none" stroke="${walked ? '#7a4a1f' : '#cfb07a'}" stroke-width="5" stroke-dasharray="2 14" stroke-linecap="round"/>`
        })
        .join('')
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(box)
    void document.fonts?.ready.then(draw)
    return () => ro.disconnect()
  }, [now.chest, quest])

  // Slides in from the side, as the flip cards do.
  const sheet = useRef<HTMLDivElement>(null)
  useEffect(() => {
    sheet.current?.animate([{ transform: 'translateX(104%)' }, { transform: 'none' }], {
      duration: 350,
      easing: 'cubic-bezier(.2,.8,.2,1)',
    })
  }, [])

  return (
    <div
      ref={sheet}
      data-our-quest=""
      className="our-quest absolute inset-0 z-[20] flex flex-col overflow-hidden rounded-[22px] px-[18px] pb-[14px] pt-3 text-[#3b2410] shadow-[-6px_0_24px_rgba(30,42,68,0.15)]"
      onClick={onClose}
    >
      <div className="relative z-[1] flex items-center gap-3">
        <h2 className="m-0 font-bold" style={{ fontSize: 'clamp(1.1rem, 3vmin, 1.7rem)' }}>
          {quest.number > 1 ? `Our Quest ${quest.number}` : 'Our Quest'}
        </h2>
        <button
          type="button"
          aria-label="Close Our Quest"
          title="Close"
          className="ml-auto flex items-center gap-1 rounded-xl border border-[#c9a46a] bg-[#fff8e6] px-3 py-1.5 font-bold text-[#6b4a2b]"
          onClick={onClose}
        >
          <X className="size-5" /> Close
        </button>
      </div>
      <div ref={trail} className="our-quest-trail relative flex min-h-0 flex-1 items-center justify-between gap-[0.6vw] px-[0.6vw]">
        <svg ref={path} className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden />
        {CHESTS.map((tier, i) => {
          const done = i < now.chest
          const here = i === now.chest
          const opened = quest.opened[i]
          const ready = here && now.ready
          return (
            <div
              key={i}
              data-quest-station={i}
              className={clsx(
                'our-quest-station relative z-[1] flex min-w-0 flex-col items-center gap-[0.35em] text-center',
                ROW[i],
                done ? 'done' : here ? 'now' : 'future',
              )}
            >
              {/* The landmark, in faint map ink, in the room the zigzag leaves. */}
              <img
                src={art(LANDMARKS[i])}
                alt=""
                draggable={false}
                className={clsx('our-quest-landmark pointer-events-none select-none', `lm-${i}`)}
              />
              {i === 4 && (
                <img src={art('dragon-asleep.svg')} alt="" draggable={false} className="our-quest-dragon pointer-events-none select-none" />
              )}
              <div className="quest-sc relative">
                {here && (
                  <img src={art('knight.svg')} alt="" draggable={false} className="our-quest-knight pointer-events-none select-none" />
                )}
                {ready ? (
                  <button
                    type="button"
                    title={`Open the ${tier.name} chest`}
                    className="meter-chest-rattle block w-full"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenChest()
                    }}
                  >
                    <ChestPicture chest={i} keys={tier.keys} className="[&>svg]:h-auto [&>svg]:w-full" />
                  </button>
                ) : (
                  <ChestPicture
                    chest={i}
                    keys={done ? tier.keys : here ? now.have : 0}
                    open={done}
                    className="[&>svg]:h-auto [&>svg]:w-full"
                  />
                )}
              </div>
              <div className="font-bold" style={{ fontSize: 'clamp(0.85rem, 2vmin, 1.15rem)' }}>
                {tier.name}
              </div>
              {done && opened ? (
                <span className={clsx('our-quest-chip', `size-${opened.prize.size}`)}>
                  <PrizeIcon name={opened.prize.name} size={16} />
                  {opened.prize.name}
                </span>
              ) : here ? (
                <>
                  <KeyPips need={tier.keys} have={now.have} className="our-quest-pips" />
                  <span className="our-quest-note">{ready ? 'Tap to open!' : `${now.have} of ${tier.keys} keys`}</span>
                </>
              ) : (
                <span className="our-quest-note">{tier.keys} keys</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
