import { useEffect, useRef } from 'react'
import { drawMiniJar } from '../lib/marbleArt'
import type { SavedMarble, Season } from '../lib/marbles'

/** The class's jar, small, at the meter's end: its own marbles where they settled. */
export function MiniJar({
  marbles,
  full,
  season = 'none',
  className = 'block h-[44px] w-8',
}: {
  marbles: SavedMarble[]
  full: boolean
  /** The season's touch on the jar (snow, the New Year's ribbon), as on its own screen. */
  season?: Season
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) drawMiniJar(ref.current, marbles, full, season)
  }, [marbles, full, season])
  return <canvas ref={ref} width={64} height={88} className={className} aria-hidden />
}
