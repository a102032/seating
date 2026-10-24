import clsx from 'clsx'
import { X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { assetUrl } from '../lib/assets'
import { CHESTS, MEGA, type QuestState } from '../lib/quest'
import { chestSVG, keySVG, prizeIconSVG } from '../lib/questArt'

/**
 * Our Quest (DECISIONS, "Treasure Quest"): a tap on the meter's chest slides the quest over the
 * board, drawn on an old treasure map. The chests zigzag (Wood low, Bronze high, Silver low, Gold
 * high, the Mega chest in the middle at the end) and a dotted ink trail winds between them, dark
 * for the way walked and faint ahead; the chests opened show what was inside, the class's
 * memories; the knight stands by the chest the class is on, and the dragon sleeps by the Mega
 * chest. The landmarks are the teacher's Flow pieces in faint ink, where the zigzag leaves room.
 * It never scrolls: everything is sized from the map's own box (container units). A tap on its X
 * closes it; nothing closes it on a clock.
 */

/** Where each chest stands, in shares of the map: across, and how far down its middle is. */
const STATIONS = [
  { x: 9, y: 64 },
  { x: 29, y: 36 },
  { x: 49, y: 64 },
  { x: 69, y: 36 },
  { x: 89, y: 50 },
]

/** The landmarks, in the room the zigzag leaves: above the low chests and below the high ones. */
const LANDMARKS = [
  { name: 'castle', left: 9, top: 5, h: 26 },
  { name: 'forest', left: 29, top: 70, h: 23 },
  { name: 'hills', left: 49, top: 12, h: 15 },
  { name: 'bridge', left: 63, top: 74, h: 16 },
  // The dragon's mountain, in the corner past the Mega chest: it sleeps at its foot (2026-10-24, the teacher).
  { name: 'mountain-cave', left: 89, top: 69, h: 27 },
  { name: 'windmill', left: 89, top: 4, h: 24 },
]

export function OurQuest({ quest, onClose }: { quest: QuestState; onClose: () => void }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    mapRef.current?.closest('[data-our-quest]')?.animate([{ transform: 'translateX(104%)' }, { transform: 'none' }], {
      duration: 350,
      easing: 'cubic-bezier(.2,.8,.2,1)',
    })
  }, [])

  // The trail is drawn from where the chests really are, so drawn again whenever the map changes size.
  useLayoutEffect(() => {
    const map = mapRef.current
    const svg = pathRef.current
    if (!map || !svg) return
    const draw = () => {
      const box = map.getBoundingClientRect()
      if (!box.width || !box.height) return
      const chests = [...map.querySelectorAll('[data-station] [data-art]')].map((e) => {
        const r = e.getBoundingClientRect()
        return { l: r.left - box.left, r: r.right - box.left, y: r.top - box.top + r.height * 0.55 }
      })
      const gap = Math.max(8, box.width * 0.012)
      svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`)
      svg.innerHTML = chests
        .slice(1)
        .map((b, i) => {
          const a = chests[i]
          const x1 = a.r + gap
          const x2 = b.l - gap
          if (x2 - x1 < 14) return ''
          const dx = (x2 - x1) * 0.5
          const walked = i < quest.chest
          return `<path fill="none" stroke="${walked ? '#7a4a1f' : '#cfb07a'}" stroke-width="5" stroke-dasharray="2 14" stroke-linecap="round" d="M${x1.toFixed(1)} ${a.y.toFixed(1)} C${(x1 + dx).toFixed(1)} ${a.y.toFixed(1)} ${(x2 - dx).toFixed(1)} ${b.y.toFixed(1)} ${x2.toFixed(1)} ${b.y.toFixed(1)}"/>`
        })
        .join('')
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(map)
    document.fonts?.ready.then(draw)
    return () => ro.disconnect()
  }, [quest.chest])

  return (
    <div
      data-our-quest=""
      className="our-quest absolute inset-0 z-20 flex flex-col overflow-hidden rounded-2xl px-[clamp(10px,1.6vw,22px)] pb-[clamp(8px,1.4vh,16px)] pt-[clamp(6px,1.2vh,14px)]"
    >
      <div className="relative z-[1] flex items-center gap-3">
        {/* The pictures say how far the class has come; the title only says which quest it is, from the second one on. */}
        <h2 className="m-0 font-bold text-[#3b2410]" style={{ fontSize: 'clamp(1.1rem, 3vmin, 1.7rem)' }}>
          {quest.number > 1 ? `Our Quest ${quest.number}` : 'Our Quest'}
        </h2>
        <button
          type="button"
          aria-label="Close Our Quest"
          title="Close"
          onClick={onClose}
          className="ml-auto grid h-11 w-11 place-items-center rounded-full bg-[#fff8e6] text-[#6b4a2b] shadow active:scale-90"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div ref={mapRef} className="relative min-h-0 flex-1" style={{ containerType: 'size' }}>
        {LANDMARKS.map((l) => (
          <img
            key={l.name}
            src={assetUrl(`/quest/landmark-${l.name}.webp`)}
            alt=""
            draggable={false}
            className="pointer-events-none absolute -translate-x-1/2 select-none opacity-55"
            style={{ left: `${l.left}%`, top: `${l.top}%`, height: `${l.h}cqh`, maxWidth: '17cqw', objectFit: 'contain' }}
          />
        ))}
        <svg ref={pathRef} className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden />

        {/* The dragon asleep at the foot of its mountain, most of the term: it wakes for the term's last goal (part 2). */}
        <img
          src={assetUrl('/quest/dragon-asleep.webp')}
          alt=""
          draggable={false}
          className="pointer-events-none absolute select-none"
          style={{ left: '83%', top: '81%', height: '18cqh', maxWidth: '18cqw', objectFit: 'contain', transform: 'translateX(-50%)' }}
        />

        {CHESTS.map((T, i) => {
          const done = i < quest.chest
          const now = i === quest.chest
          const opened = quest.opened.find((o) => o.chest === i)
          const keys = now ? Math.min(quest.keys, T.keys) : 0
          const mega = i === MEGA
          return (
            <div
              key={T.name}
              data-station={i}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[0.3em] text-center text-[#3b2410]"
              style={{ left: `${STATIONS[i].x}%`, top: `${STATIONS[i].y}%`, width: '19cqw' }}
            >
              {now && (
                <span
                  className="rounded-full bg-violet-500 px-[0.7em] py-[0.05em] font-bold text-white"
                  style={{ fontSize: 'clamp(0.7rem, 1.7vmin, 0.95rem)' }}
                >
                  Now
                </span>
              )}
              <div className="relative">
                {/* The knight on the trail, arriving at the chest the class is on. */}
                {now && (
                  <img
                    src={assetUrl('/quest/knight.webp')}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute bottom-0 right-[104%] max-w-none select-none"
                    style={{ height: `${mega ? 25 : 20}cqh` }}
                  />
                )}
                <div
                  data-art=""
                  className={clsx(
                    'relative [&>svg]:block [&>svg]:h-auto [&>svg]:w-full [&>svg]:overflow-visible',
                    !done && !now && 'opacity-50 saturate-[0.55]',
                    now && 'drop-shadow-[0_0_12px_rgba(251,191,36,0.9)]',
                  )}
                  style={{ width: mega ? 'min(26cqh, 15cqw)' : 'min(20cqh, 11.5cqw)' }}
                  dangerouslySetInnerHTML={{ __html: chestSVG(i, { open: done, keys: done ? T.keys : keys }) }}
                />
              </div>
              <div className="font-bold leading-tight" style={{ fontSize: 'clamp(0.85rem, 2vmin, 1.15rem)' }}>
                {T.name}
              </div>
              {done && opened ? (
                <span
                  className={clsx(
                    'inline-flex max-w-full items-center gap-[0.35em] text-balance rounded-full border-2 bg-white px-[0.7em] py-[0.1em] font-bold leading-tight',
                    opened.prize.size === 'b'
                      ? 'border-amber-400 bg-amber-50'
                      : opened.prize.size === 'm'
                        ? 'border-slate-300'
                        : 'border-sky-300',
                  )}
                  style={{ fontSize: 'clamp(0.72rem, 1.7vmin, 0.95rem)' }}
                >
                  <span
                    className="block h-[1.1em] w-[1.1em] shrink-0 [&>svg]:h-full [&>svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: prizeIconSVG(opened.prize.name) }}
                  />
                  {opened.prize.name}
                </span>
              ) : now ? (
                <>
                  <span className="flex h-[1.6vmin] min-h-2 gap-[3px]" aria-hidden>
                    {Array.from({ length: T.keys }, (_, k) => (
                      <span
                        key={k}
                        className="block h-full aspect-[2/1] [&>svg]:h-full [&>svg]:w-full"
                        dangerouslySetInnerHTML={{ __html: keySVG(k >= keys) }}
                      />
                    ))}
                  </span>
                  <span className="text-[#7a5a30]" style={{ fontSize: 'clamp(0.75rem, 1.7vmin, 0.95rem)' }}>
                    {keys} of {T.keys} {T.keys === 1 ? 'key' : 'keys'}
                  </span>
                </>
              ) : (
                <span className="text-[#7a5a30]" style={{ fontSize: 'clamp(0.75rem, 1.7vmin, 0.95rem)' }}>
                  {T.keys} {T.keys === 1 ? 'key' : 'keys'}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
