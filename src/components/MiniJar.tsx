import { useEffect, useRef } from 'react'
import { drawMiniJar } from '../lib/marbleArt'
import type { SavedMarble } from '../lib/marbles'

/** The class's jar, small, at the meter's end: its own marbles where they settled. */
export function MiniJar({
  marbles,
  full,
  className = 'block h-[44px] w-8',
}: {
  marbles: SavedMarble[]
  full: boolean
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) drawMiniJar(ref.current, marbles, full)
  }, [marbles, full])
  return <canvas ref={ref} width={64} height={88} className={className} aria-hidden />
}
