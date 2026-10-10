/**
 * The side rail's picker icons, all drawn from the teacher's own grid (nine squares, 6 units across,
 * 3 apart) so they read as one family (2026-10-08): a filled square is picked, a faded one is "the
 * rest" of a random pick, an empty one is nobody picked, and a ring marks the row (or table, or
 * group) a pick is staying inside. Each picker shows what it picks the way the board lights a pick.
 * Drawn in the text colour, so they follow every theme and a lit button.
 */
interface IconProps {
  className?: string
}

type Mode = 'full' | 'faded' | 'hollow'

const FADED = 0.3

function Square({ x, y, size = 6, mode }: { x: number; y: number; size?: number; mode: Mode }) {
  if (mode === 'hollow') {
    return (
      <rect x={x + 0.45} y={y + 0.45} width={size - 0.9} height={size - 0.9} rx={0.8} fill="none" stroke="currentColor" strokeWidth={0.9} />
    )
  }
  return <rect x={x} y={y} width={size} height={size} rx={1} fill="currentColor" fillOpacity={mode === 'faded' ? FADED : 1} />
}

function Frame({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="-2.5 -2.5 29 29" className={className} aria-hidden="true">
      {children}
    </svg>
  )
}

/** The room three desks across and three deep; `modeAt(row, column)` says how each desk is drawn. */
function Grid({ className, modeAt, ring = false }: IconProps & { modeAt: (row: number, column: number) => Mode; ring?: boolean }) {
  return (
    <Frame className={className}>
      {[0, 9, 18].flatMap((y, r) => [0, 9, 18].map((x, c) => <Square key={`${r}-${c}`} x={x} y={y} mode={modeAt(r, c)} />))}
      {/* A row runs front to back, so on the board it is a column of desks. */}
      {ring && <rect x={7.2} y={-1.8} width={9.6} height={27.6} rx={2.6} fill="none" stroke="currentColor" strokeWidth={1.3} />}
    </Frame>
  )
}

/** Four tables of four desks; `modeOf(table, desk)` says how each is drawn. The bottom right is the one picked. */
function Tables({ className, modeOf, ring = false }: IconProps & { modeOf: (lit: boolean, desk: number) => Mode; ring?: boolean }) {
  const tables: [number, number][] = [
    [0, 0],
    [13.2, 0],
    [0, 13.2],
    [13.2, 13.2],
  ]
  return (
    <Frame className={className}>
      {tables.flatMap(([x, y], t) =>
        [0, 1, 2, 3].map((d) => (
          <Square key={`${t}-${d}`} x={x + (d % 2) * 6} y={y + Math.floor(d / 2) * 6} size={4.8} mode={modeOf(t === 3, d)} />
        )),
      )}
      {ring && <rect x={11.6} y={11.6} width={14} height={14} rx={2.6} fill="none" stroke="currentColor" strokeWidth={1.3} />}
    </Frame>
  )
}

/** Three group cards; the middle one is the one picked. */
function Cards({ className, middle, others, chip = false }: IconProps & { middle: Mode; others: Mode; chip?: boolean }) {
  return (
    <Frame className={className}>
      {[0, 9, 18].map((x, i) => {
        const mode = i === 1 ? middle : others
        return mode === 'hollow' ? (
          <rect key={x} x={x + 0.45} y={0.45} width={5.1} height={23.1} rx={1.4} fill="none" stroke="currentColor" strokeWidth={0.9} />
        ) : (
          <rect key={x} x={x} y={0} width={6} height={24} rx={1.4} fill="currentColor" fillOpacity={mode === 'faded' ? FADED : 1} />
        )
      })}
      {chip && <rect x={10.6} y={2} width={2.8} height={4} rx={0.7} fill="currentColor" />}
    </Frame>
  )
}

/** Pick a Random Student: one desk lit, the rest of the room faded. */
export const PickStudentIcon = (p: IconProps) => <Grid {...p} modeAt={(r, c) => (r === 0 && c === 0 ? 'full' : 'faded')} />
/** Pick a Random Row: one row lit. */
export const PickRowIcon = (p: IconProps) => <Grid {...p} modeAt={(_, c) => (c === 1 ? 'full' : 'faded')} />
/** Pick from This Row, after a row has landed: the row ringed, one student in it lit. */
export const FromRowIcon = (p: IconProps) => <Grid {...p} ring modeAt={(r, c) => (c === 1 && r === 0 ? 'full' : 'faded')} />
/** Pick Whole Row: the row filled in, nobody else. */
export const WholeRowIcon = (p: IconProps) => <Grid {...p} modeAt={(_, c) => (c === 1 ? 'full' : 'hollow')} />
/** Pick All: every desk. */
export const AllIcon = (p: IconProps) => <Grid {...p} modeAt={() => 'full'} />
/** Unpick All: no desk. */
export const NoneIcon = (p: IconProps) => <Grid {...p} modeAt={() => 'hollow'} />

/** Pick a Random Table: one table lit. */
export const PickTableIcon = (p: IconProps) => <Tables {...p} modeOf={(lit) => (lit ? 'full' : 'faded')} />
/** Pick from This Table: the table ringed, one desk at it lit. */
export const FromTableIcon = (p: IconProps) => <Tables {...p} ring modeOf={(lit, d) => (lit && d === 0 ? 'full' : 'faded')} />
/** Pick Whole Table: the table filled in, nobody else. */
export const WholeTableIcon = (p: IconProps) => <Tables {...p} modeOf={(lit) => (lit ? 'full' : 'hollow')} />

/** Pick a Random Group, during a group activity: one card lit. */
export const PickGroupIcon = (p: IconProps) => <Cards {...p} middle="full" others="faded" />
/** Pick from This Group: the picked card open, one name on it lit. */
export const FromGroupIcon = (p: IconProps) => <Cards {...p} middle="hollow" others="faded" chip />
