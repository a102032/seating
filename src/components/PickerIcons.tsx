/**
 * The side panel's picker icons, drawn here because lucide has no picture of a room. Pick Row
 * and Group Activity were both two people (Users, UsersRound) and looked the same. Now each
 * picker shows what it picks the way the board shows a pick: the picked desks lit and the rest
 * faded. Group Activity is three people, a team. Same 24-unit box as lucide, so they line up
 * with the lucide icons beside them.
 */
interface IconProps {
  size?: number
  className?: string
}

const FADED = 0.32

function Solid({ size = 24, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      {children}
    </svg>
  )
}

/** A room three desks across and three deep, its middle row (front to back) lit. */
export function PickRowIcon(props: IconProps) {
  return (
    <Solid {...props}>
      {[2, 9.5, 17].flatMap((x, column) =>
        [2.5, 9.75, 17].map((y) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={5} height={4.5} rx={1.2} fillOpacity={column === 1 ? 1 : FADED} />
        )),
      )}
    </Solid>
  )
}

/** Four tables of four desks, one lit. */
export function PickTableIcon(props: IconProps) {
  const tables: [number, number, boolean][] = [
    [2, 2, false],
    [13.75, 2, false],
    [2, 13.75, false],
    [13.75, 13.75, true],
  ]
  return (
    <Solid {...props}>
      {tables.flatMap(([x, y, lit]) =>
        [0, 1].flatMap((i) =>
          [0, 1].map((j) => (
            <rect
              key={`${x}-${y}-${i}-${j}`}
              x={x + i * 4.25}
              y={y + j * 4.25}
              width={3.75}
              height={3.75}
              rx={0.9}
              fillOpacity={lit ? 1 : FADED}
            />
          )),
        ),
      )}
    </Solid>
  )
}

/** Three group cards, the middle one lit. */
export function PickGroupIcon(props: IconProps) {
  return (
    <Solid {...props}>
      {[1.5, 9, 16.5].map((x, i) => (
        <rect key={x} x={x} y={4} width={6} height={16} rx={1.6} fillOpacity={i === 1 ? 1 : FADED} />
      ))}
    </Solid>
  )
}

/** Three people: a group working together. Drawn in lucide's own stroke, like Users. */
export function GroupActivityIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="7.5" r="3.25" />
      <path d="M6.5 20v-1.5a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4V20" />
      <path d="M5.5 5.6a2.6 2.6 0 0 0 0 5.2" />
      <path d="M2 18.5v-1a3.2 3.2 0 0 1 2.4-3.1" />
      <path d="M18.5 5.6a2.6 2.6 0 0 1 0 5.2" />
      <path d="M22 18.5v-1a3.2 3.2 0 0 0-2.4-3.1" />
    </svg>
  )
}
