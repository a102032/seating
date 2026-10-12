import { memo } from 'react'
import { chestSVG, keySVG, prizeIconSVG } from '../../lib/questArt'

/**
 * The Quest's pictures as elements. Each is drawn once for what it shows (memo), since the SVG
 * text is rebuilt with fresh ids every time it is asked for.
 */
export const ChestPicture = memo(function ChestPicture({
  chest,
  keys = 0,
  open = false,
  className,
}: {
  chest: number
  keys?: number
  open?: boolean
  className?: string
}) {
  return <span className={className} style={{ display: 'block' }} dangerouslySetInnerHTML={{ __html: chestSVG(chest, { keys, open }) }} />
})

const KEY = keySVG()

export function KeyPicture({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <span className={className} style={{ display: 'block', ...style }} dangerouslySetInnerHTML={{ __html: KEY }} />
}

/** A row of little keys, one per lock: gold for each key in, faded for each still to win. */
export function KeyPips({ need, have, className }: { need: number; have: number; className?: string }) {
  return (
    <span className={className} style={{ display: 'flex', gap: '2px' }} aria-hidden>
      {Array.from({ length: need }, (_, i) => (
        <KeyPicture key={i} className={i < have ? 'quest-pip quest-pip-in' : 'quest-pip'} />
      ))}
    </span>
  )
}

export const PrizeIcon = memo(function PrizeIcon({ name, size = 24, className }: { name: string; size?: number; className?: string }) {
  return <span className={className} style={{ display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: prizeIconSVG(name, size) }} />
})
