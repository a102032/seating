import clsx from 'clsx'
import { useMemo } from 'react'
import { assetUrl } from '../../lib/assets'
import { LAND_SPEED, TRAIL_SPEED, stretchItems, trailPath } from '../../lib/questRoad'

/** Where things are in the goal bar, in its own pixels. */
export interface RoadGeometry {
  /** The bar's width. */
  width: number
  /** The knight's walk: the middle of the knight at the start of a stretch, and at the key. */
  x0: number
  x1: number
  /** The middle of the map button, and the span of the chest and the count, which sit on clearings. */
  mapX: number
  endL: number
  endR: number
}

/** The knight's walk and the land rolling on to the next stretch, as the CSS classes that time them. */
export type RoadMotion = 'none' | 'move' | 'roll'

const art = (name: string) => assetUrl(`/quest/${name}`)
const INK = '#8a5a2b'

/**
 * The goal bar's parchment and everything drawn on it (lib/questRoad): the land and the trail,
 * each a layer slid by a transform at its own speed, and the way walked in dark ink, cut off at the
 * knight by two opposite transforms rather than a width, so the graphics chip moves all of it and
 * nothing is measured again. Only the stretches either side of the one the class is on are drawn.
 */
export function QuestRoad({ k, p, geo, motion }: { k: number; p: number; geo: RoadGeometry | null; motion: RoadMotion }) {
  const walk = geo ? Math.max(40, geo.x1 - geo.x0) : 0
  const items = useMemo(() => (walk ? [k - 1, k, k + 1].flatMap((j) => stretchItems(j, walk)) : []), [k, walk])
  const trailStretch = walk * (1 + TRAIL_SPEED)
  const from = Math.floor((k - 1) * trailStretch - (geo?.width ?? 0))
  const to = Math.ceil((k + 2) * trailStretch + (geo?.width ?? 0))
  const d = useMemo(() => (walk ? trailPath(from, to) : ''), [walk, from, to])
  if (!geo) return <div className="quest-road" aria-hidden="true" />

  const landX = geo.x0 - (k * walk * (1 + LAND_SPEED) + p * walk * LAND_SPEED)
  const trailX = geo.x0 - (k * trailStretch + p * walk * TRAIL_SPEED)
  const knightX = geo.x0 + p * walk
  const timing = motion === 'move' ? 'quest-road-move' : motion === 'roll' ? 'quest-road-roll' : undefined
  const trail = (ink: string, opacity: number, width: number) => (
    <svg
      className="absolute top-0 h-full"
      style={{ left: from, width: to - from }}
      viewBox={`${from} 0 ${to - from} 56`}
      preserveAspectRatio="none"
    >
      <path d={d} fill="none" stroke={ink} strokeOpacity={opacity} strokeWidth={width} strokeDasharray="6 6" strokeLinecap="round" />
    </svg>
  )

  return (
    <div className="quest-road" aria-hidden="true">
      <div className={clsx('quest-road-layer', timing)} style={{ transform: `translateX(${landX.toFixed(1)}px)` }}>
        {items.map((it, i) =>
          it.kind === 'ink' ? (
            <span
              key={i}
              className="quest-road-ink"
              style={{
                left: it.x,
                bottom: it.bottom,
                width: it.w,
                height: it.h,
                opacity: it.opacity,
                background: INK,
                WebkitMaskImage: `url('${art(it.file)}')`,
                maskImage: `url('${art(it.file)}')`,
              }}
            />
          ) : (
            <img
              key={i}
              src={art(it.file)}
              alt=""
              draggable={false}
              className="quest-road-ink"
              style={{ left: it.x, bottom: it.bottom, height: it.h, width: 'auto', opacity: it.opacity }}
            />
          ),
        )}
      </div>
      <div className={clsx('quest-road-layer', timing)} style={{ transform: `translateX(${trailX.toFixed(1)}px)` }}>
        {trail(INK, 0.32, 2.4)}
      </div>
      {/* The way walked: dark ink and a little gold, up to the knight. */}
      <div className={clsx('quest-road-walked', timing)} style={{ transform: `translateX(${(knightX - geo.width).toFixed(1)}px)` }}>
        <div className={clsx('quest-road-walked', timing)} style={{ transform: `translateX(${(geo.width - knightX).toFixed(1)}px)` }}>
          <div className="absolute inset-0 bg-[rgba(250,196,30,0.18)]" />
          <div className={clsx('quest-road-layer', timing)} style={{ transform: `translateX(${trailX.toFixed(1)}px)` }}>
            {trail('#6b3f17', 0.95, 3)}
          </div>
        </div>
      </div>
      {/* Clearings, so the map button, the chest and the count sit on calm ground. */}
      <div className="quest-road-clearing" style={{ left: geo.mapX - 34, width: 68 }} />
      <div className="quest-road-clearing" style={{ left: geo.endL - 16, width: geo.endR - geo.endL + 32 }} />
    </div>
  )
}
