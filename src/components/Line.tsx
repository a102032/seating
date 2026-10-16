import clsx from 'clsx'
import { useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { ChevronDown, Minus, Pencil, Plus, Trash2 } from 'lucide-react'
import { checkedOf, LINE_NAME_MAX, lineCount, MAX_SAVED_LINES, MAX_STEPS, STEP_NAME_MAX, type ClassLine } from '../lib/line'
import type { SavedLine, Student } from '../types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SoundButton } from './GetReady'
import { Modal } from './Modal'
import { PointIcon, QueueIcon } from './RailIcons'
import { StudentPicture } from './StudentPicture'
import { TactileButton } from './TactileButton'
import { useLingerWhileClosing } from '../hooks/useLingerWhileClosing'

/**
 * The board reads one touch as two. Done and Skip change who is under the finger, so a second
 * touch would finish two students; a window's buttons appear under the finger that opened it.
 */
const TAP_GUARD_MS = 700
/** The star only adds, so a second star a moment later is the board's ghost touch, not the teacher. */
const STAR_GUARD_MS = 250

interface LinePanelProps {
  line: ClassLine
  studentsById: Map<string, Student>
  /** Students whose homeroom number shows after their name: two sharing a name, as on the desks. */
  homerooms: Set<string>
  /** The class runs points, so the student with the teacher can be given a star. */
  points: boolean
  onStar: () => void
  onDone: () => void
  onSkip: () => void
  /** A name in the line was tapped: ask whether to take them out. */
  onAskLeave: (studentId: string) => void
  onClear: () => void
  /** No sound for the Line, set by the speaker by "In line", as Get Ready!'s is on "How long?". */
  silent: boolean
  onSetSilent: (silent: boolean) => void
  /** How many steps the task has (each one checked; all of them is Done). */
  steps: number
  /** Each step's name, from a saved line ('' for one with none). */
  stepNames: string[]
  /** The saved line in use, by name, or null for a quick line. */
  lineName: string | null
  /** The button at the top ("Writing", or "Steps: 5"): "Start the Line" again, to change it partway through. */
  onAskSteps: () => void
  /** Change Steps is on: a tap on a desk, or on the student with the teacher, moves them a step. */
  changing: boolean
  onToggleChanging: () => void
  onCycle: (studentId: string) => void
}

/**
 * The Line's column, on the right of the board (2026-10-15, the teacher: he sits with the board
 * behind him and needs his buttons in reach without standing). The top is for the class to read
 * from their seats: who is with the teacher, big, and the line in order under it. The bottom is the
 * teacher's: Skip, then the star and Done, where a seated hand lands when he turns round, and Clear
 * Line under them, which asks first. The list never scrolls: as many names as fit, then "+3 more", since every
 * child's number is on their own desk anyway.
 */
export function LinePanel({
  line,
  studentsById,
  homerooms,
  points,
  onStar,
  onDone,
  onSkip,
  onAskLeave,
  onClear,
  silent,
  onSetSilent,
  steps,
  stepNames,
  lineName,
  onAskSteps,
  changing,
  onToggleChanging,
  onCycle,
}: LinePanelProps) {
  // The step the student with the teacher brought, and what Done will do, said on the button itself.
  const nowChecked = line.now ? checkedOf(line, line.now, steps) : 0
  const nowStep = stepNames[nowChecked] ?? ''
  const doneLabel =
    steps === 1 ? 'Done' : nowChecked + 1 >= steps ? 'All Done' : nowStep ? `${nowStep} Done` : `Step ${nowChecked + 1} Done`
  const now = line.now ? studentsById.get(line.now) : undefined
  const lastTap = useRef(0)
  const lastStar = useRef(0)
  const guarded = (e: MouseEvent, ms: number, last: { current: number }, run: () => void) => {
    if (e.timeStamp >= last.current && e.timeStamp - last.current < ms) return
    last.current = e.timeStamp
    run()
  }

  // How many names fit: measured from the room the list has and one row's height, so a short
  // screen shows fewer names rather than a list that scrolls.
  const listRef = useRef<HTMLDivElement>(null)
  const probeRef = useRef<HTMLDivElement>(null)
  const [fits, setFits] = useState(99)
  useLayoutEffect(() => {
    const list = listRef.current
    const probe = probeRef.current
    if (!list || !probe) return
    const measure = () => {
      const gap = parseFloat(getComputedStyle(list).rowGap) || 0
      const row = probe.offsetHeight
      if (row > 0) setFits(Math.max(1, Math.floor((list.clientHeight + gap) / (row + gap))))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [])
  const overflow = line.waiting.length > fits
  const shown = overflow ? line.waiting.slice(0, fits - 1) : line.waiting
  // The places the desks show: the one with the teacher is 1, so the first waiting is 2.
  const firstPlace = now ? 2 : 1

  const nameOf = (id: string) => {
    const s = studentsById.get(id)
    if (!s) return ''
    return homerooms.has(id) && s.homeroom.trim() ? `${s.name} ${s.homeroom.trim()}` : s.name
  }

  return (
    <aside
      data-ink="panel"
      data-line-panel=""
      aria-label="Line"
      className="flex h-full w-[clamp(10.5rem,15vw,15rem)] shrink-0 flex-col gap-[clamp(0.35rem,1.2vh,0.75rem)] overflow-hidden rounded-2xl border border-border bg-card/80 p-[clamp(0.4rem,1.2vh,0.75rem)] text-card-foreground shadow-sm"
    >
      {/* Which line this is (a saved one by its name) and how many steps: tap to change it partway through. */}
      <button
        type="button"
        data-line-steps-button=""
        onClick={onAskSteps}
        className="flex shrink-0 items-center justify-center gap-1 rounded-lg bg-black/[0.04] px-2 py-0.5 font-bold text-muted-foreground transition-transform active:scale-95 dark:bg-white/[0.06]"
        style={{ fontSize: 'clamp(0.75rem, 1.7vmin, 1rem)' }}
      >
        <span className="min-w-0 truncate">{lineName ? `${lineName} · ${steps}` : `Steps: ${steps}`}</span>
        {/* It opens the list of lines, where each can be changed or deleted. */}
        <ChevronDown className="size-[1.1em] shrink-0" />
      </button>

      {/* With the teacher: the class reads it from their seats. While Change Steps is on, a tap here
          moves them a step, so the student at the teacher's side is in reach from the chair. */}
      <section
        onClick={changing && now ? () => onCycle(now.id) : undefined}
        data-line-now-card=""
        className={clsx(
          'flex shrink-0 flex-col items-center gap-1 rounded-xl bg-emerald-500/15 px-1.5 py-[clamp(0.25rem,1vh,0.6rem)] text-center',
          changing && now && 'cursor-pointer outline-2 outline-dashed outline-emerald-600',
        )}
      >
        <span className="font-bold text-emerald-800 dark:text-emerald-200" style={{ fontSize: 'clamp(0.75rem, 1.7vmin, 1rem)' }}>
          With the teacher
        </span>
        {now ? (
          <>
            <StudentPicture
              student={now}
              className="pointer-events-none h-[clamp(2.5rem,11vh,5.5rem)] w-[clamp(2.5rem,11vh,5.5rem)] select-none object-contain"
            />
            {/* Number 1, as on their desk, until they are done or back in their seat. */}
            <span className="flex w-full min-w-0 items-center justify-center gap-1.5" style={{ fontSize: 'clamp(1rem, 3vmin, 1.9rem)' }}>
              <span
                className="grid min-w-[1.5em] shrink-0 place-items-center rounded-full bg-emerald-600 px-[0.25em] text-[0.7em] font-bold leading-[1.45] text-white tabular-nums"
                aria-hidden
              >
                1
              </span>
              <span data-line-now="" className="block min-w-0 truncate font-bold leading-tight">
                {nameOf(now.id)}
              </span>
            </span>
            {steps > 1 && (
              <span
                className="block w-full truncate font-bold text-emerald-800 dark:text-emerald-200"
                style={{ fontSize: 'clamp(0.75rem, 1.7vmin, 1rem)' }}
              >
                {nowChecked >= steps
                  ? 'All done'
                  : nowStep
                    ? `${nowStep} · ${nowChecked + 1} of ${steps}`
                    : `Step ${nowChecked + 1} of ${steps}`}
              </span>
            )}
          </>
        ) : (
          <>
            <QueueIcon className="h-[clamp(2.5rem,11vh,5.5rem)] w-[clamp(2.5rem,11vh,5.5rem)] p-[8%] opacity-25" />
            <span className="block font-bold leading-tight text-muted-foreground" style={{ fontSize: 'clamp(0.9rem, 2.4vmin, 1.4rem)' }}>
              Nobody yet
            </span>
          </>
        )}
      </section>

      {/* The line, in order. A tap on a name asks whether to take them out. */}
      <section className="flex min-h-0 flex-1 flex-col gap-1">
        <div className="flex shrink-0 items-center justify-between gap-1">
          <span className="font-bold text-muted-foreground" style={{ fontSize: 'clamp(0.75rem, 1.7vmin, 1rem)' }}>
            In line{line.waiting.length > 0 ? ` · ${line.waiting.length}` : ''}
          </span>
          {/* No sound, for a quiet writing lesson: beside the list rather than a switch in Class
              Settings, as Get Ready!'s speaker is on "How long?", and kept with the class. */}
          <SoundButton silent={silent} onTap={() => onSetSilent(!silent)} className="!size-8 [&_svg]:!size-[18px]" />
        </div>
        <div ref={listRef} className="relative flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
          {/* One row, unseen, to measure how tall a row is on this screen. */}
          <div ref={probeRef} aria-hidden className="invisible absolute inset-x-0 top-0">
            <Row number={1}>Probe</Row>
          </div>
          {shown.map((id, i) => (
            <button
              key={id}
              type="button"
              data-line-row={id}
              onClick={() => onAskLeave(id)}
              className="shrink-0 rounded-lg text-left transition-transform active:scale-[0.97]"
            >
              <Row number={firstPlace + i}>{nameOf(id)}</Row>
            </button>
          ))}
          {overflow && (
            <div className="shrink-0">
              <Row number={null}>+{line.waiting.length - shown.length} more</Row>
            </div>
          )}
        </div>
      </section>

      {/* The teacher's: in the bottom corner, where a seated hand lands. */}
      <section className="flex shrink-0 flex-col gap-[clamp(0.3rem,1vh,0.5rem)]">
        <TactileButton
          disabled={!now || line.waiting.length === 0}
          title={line.waiting.length === 0 ? 'Nobody else is waiting' : 'Back to the end of the line'}
          onClick={(e) => guarded(e, TAP_GUARD_MS, lastTap, onSkip)}
          className={panelButton('w-full')}
        >
          Skip
        </TactileButton>
        <div className="flex gap-[clamp(0.25rem,0.8vh,0.4rem)]">
          {points && (
            <TactileButton
              aria-label="Give a Star"
              title="A star for the student with you"
              data-points="award"
              disabled={!now}
              onClick={(e) => guarded(e, STAR_GUARD_MS, lastStar, onStar)}
              className={panelButton('w-[30%] shrink-0 !px-0')}
            >
              <PointIcon className="size-[clamp(1.25rem,4vh,2rem)]" />
            </TactileButton>
          )}
          <TactileButton
            variant="primary"
            disabled={!now}
            onClick={(e) => guarded(e, TAP_GUARD_MS, lastTap, onDone)}
            className={panelButton('min-w-0 flex-1 whitespace-normal !leading-tight !bg-emerald-600 !text-white hover:!bg-emerald-700')}
          >
            {nowStep && doneLabel !== 'All Done' ? (
              // A step's name over Done, smaller, so a long one stays inside the button.
              <span className="flex min-w-0 flex-col items-center">
                <span className="block max-w-full truncate text-[0.7em]">{nowStep}</span>
                <span>Done</span>
              </span>
            ) : (
              doneLabel
            )}
          </TactileButton>
        </div>
        <div className="flex items-center justify-between gap-1" style={{ fontSize: 'clamp(0.75rem, 1.6vmin, 0.95rem)' }}>
          {/* Change Steps: on, a tap on any desk moves that student a step, through Done and back to
              none; tapped again, off. For two steps brought at once, a Done pressed by mistake, a
              student who finished early, or one checked at their seat. */}
          <button
            type="button"
            aria-pressed={changing}
            onClick={onToggleChanging}
            className={clsx(
              'rounded-lg px-2 py-0.5 font-semibold transition-transform active:scale-95',
              changing ? 'bg-primary text-primary-foreground' : 'text-foreground',
            )}
          >
            Change Steps
          </button>
          <button
            type="button"
            disabled={lineCount(line) === 0 && Object.keys(line.checks).length === 0}
            onClick={onClear}
            className="rounded-lg px-2 py-0.5 font-semibold text-destructive transition-transform active:scale-95 disabled:pointer-events-none disabled:opacity-30"
          >
            Clear Line
          </button>
        </div>
      </section>
    </aside>
  )
}

/** The teacher's buttons: a finger's size on every board, and bigger words than the app's everyday buttons. */
function panelButton(extra: string) {
  return clsx('!h-[clamp(2.6rem,7.5vh,3.75rem)] !rounded-xl !py-0 justify-center !text-[clamp(1rem,2.6vmin,1.4rem)] !font-bold', extra)
}

/** One name in the line: its number, as on the desk, and the name. */
function Row({ number, children }: { number: number | null; children: ReactNode }) {
  return (
    <div className="flex h-[clamp(1.85rem,5.4vh,2.6rem)] items-center gap-2 rounded-lg bg-black/[0.04] px-1.5 dark:bg-white/[0.06]">
      {number !== null ? (
        <span
          className="grid min-w-[1.6em] shrink-0 place-items-center rounded-full bg-primary px-[0.3em] font-bold leading-[1.5] text-primary-foreground tabular-nums"
          style={{ fontSize: 'clamp(0.75rem, 1.9vmin, 1.1rem)' }}
        >
          {number}
        </span>
      ) : null}
      <span
        className={clsx('min-w-0 flex-1 truncate font-bold', number === null && 'text-center text-muted-foreground')}
        style={{ fontSize: 'clamp(0.85rem, 2.3vmin, 1.3rem)' }}
      >
        {children}
      </span>
    </div>
  )
}

/**
 * "Kevin, get out of line?" A child who tapped the wrong desk, or changed their mind, taps it
 * again; the teacher taps a name in the line. Both buttons wait a moment before they answer, since
 * the window opens under the finger that tapped, and a tap outside means stay.
 */
export function LineLeaveModal({ student, onLeave, onStay }: { student: Student | null; onLeave: () => void; onStay: () => void }) {
  const open = student !== null
  const [who, setWho] = useState<Student | null>(student)
  if (student && student !== who) setWho(student)
  const openedAt = useRef(0)
  useLayoutEffect(() => {
    if (open) openedAt.current = performance.now()
  }, [open, student?.id])
  const shown = useLingerWhileClosing(open)
  if (!shown || !who) return null
  const tooSoon = (e: MouseEvent) => e.timeStamp - openedAt.current < TAP_GUARD_MS

  return (
    <Modal open={open} onClose={onStay} title={`${who.name}, get out of line?`}>
      <div className="flex flex-col items-center gap-4">
        <StudentPicture student={who} className="pointer-events-none size-[clamp(5rem,20vh,9rem)] select-none object-contain" />
        <div className="grid w-full grid-cols-2 gap-3">
          <TactileButton variant="danger" onClick={(e) => !tooSoon(e) && onLeave()} className={panelButton('')}>
            Get out
          </TactileButton>
          <TactileButton variant="primary" onClick={(e) => !tooSoon(e) && onStay()} className={panelButton('')}>
            Stay in line
          </TactileButton>
        </div>
      </div>
    </Modal>
  )
}

/** What "Start the Line" starts: one of the class's saved lines. */
export type LineChoice = { savedId: string }

/**
 * "Start the Line" (2026-10-15, "How many steps?"; saved lines 2026-10-16, the teacher): asked as a
 * fresh line opens, as Get Ready! asks "How long?", since the start of the activity is when the
 * teacher knows. The class's lines, four at most, one to a row: a tap on its name starts it,
 * carrying on where everyone was in its steps, and Edit and Delete sit beside it, in words, where a
 * teacher looks for them (Delete asks once, in the row). Under them New Line. Every line is named,
 * with its steps (the teacher: no line without a name), so a class with none opens straight on New
 * Line. Names are typed (a board brings up its own keyboard, and a line is mostly set up ahead at
 * a laptop), and kept short enough for a desk.
 */
export function LineStartModal({
  open,
  savedLines,
  activeId,
  onChoose,
  onSave,
  onDelete,
  onClose,
}: {
  open: boolean
  savedLines: SavedLine[]
  /** The saved line in use, outlined. */
  activeId: string | null
  onChoose: (choice: LineChoice) => void
  /** Save a line, new or changed; `start` for a new one, which starts as it is saved. */
  onSave: (line: { id: string; name: string; steps: string[] }, start: boolean) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  // Choosing, or editing a saved line (an id) or a new one ('new').
  const [editing, setEditing] = useState<string | null>(null)
  const [askDelete, setAskDelete] = useState<string | null>(null)
  const openedAt = useRef(0)
  const none = savedLines.length === 0
  useLayoutEffect(() => {
    if (open) {
      openedAt.current = performance.now()
      setEditing(none ? 'new' : null)
      setAskDelete(null)
    }
    // Only as it opens: a line saved inside it doesn't send it back to the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const shown = useLingerWhileClosing(open)
  if (!shown) return null
  // The board's second touch of the rail's button lands in here, and so does the touch that opened the editor or came back.
  const ready = (e: MouseEvent) => e.timeStamp - openedAt.current >= TAP_GUARD_MS
  const switchTo = (next: string | null) => {
    openedAt.current = performance.now()
    setAskDelete(null)
    setEditing(next)
  }
  const edited = editing && editing !== 'new' ? savedLines.find((s) => s.id === editing) : undefined

  if (editing) {
    return (
      <Modal open={open} onClose={onClose} title={edited ? `Edit ${edited.name}` : 'New Line'}>
        <LineEditor
          key={editing}
          saved={edited}
          // With no lines yet there is no list to go back to.
          onBack={none ? onClose : () => switchTo(null)}
          backLabel={none ? 'Cancel' : 'Back'}
          onSave={(line) => {
            onSave(line, !edited)
            if (edited) switchTo(null)
          }}
        />
      </Modal>
    )
  }

  const full = savedLines.length >= MAX_SAVED_LINES
  return (
    <Modal open={open} onClose={onClose} title="Start the Line">
      <div className="flex flex-col gap-2">
        {savedLines.map((saved) =>
          askDelete === saved.id ? (
            <div key={saved.id} className="flex min-h-[clamp(3rem,10vh,4rem)] items-center gap-2 rounded-xl bg-destructive/10 px-3">
              <span className="mr-auto min-w-0 truncate font-bold">Delete {saved.name}?</span>
              <TactileButton type="button" onClick={() => setAskDelete(null)}>
                Keep
              </TactileButton>
              <TactileButton
                type="button"
                variant="danger"
                data-confirm-delete-line={saved.name}
                onClick={() => {
                  onDelete(saved.id)
                  setAskDelete(null)
                }}
              >
                Delete
              </TactileButton>
            </div>
          ) : (
            <div key={saved.id} className="flex items-stretch gap-2">
              <TactileButton
                data-saved-line={saved.name}
                onClick={(e) => ready(e) && onChoose({ savedId: saved.id })}
                className={clsx(
                  panelButton('min-w-0 flex-1 flex-col !items-start !gap-0 !px-3 text-left'),
                  '!h-[clamp(3rem,10vh,4rem)]',
                  saved.id === activeId && 'ring-4 ring-primary',
                )}
              >
                <span className="block w-full truncate">{saved.name}</span>
                <span className="block w-full truncate text-[0.6em] font-semibold text-muted-foreground">{stepsSummary(saved.steps)}</span>
              </TactileButton>
              <TactileButton
                type="button"
                data-edit-line={saved.name}
                onClick={(e) => ready(e) && switchTo(saved.id)}
                className="!h-auto shrink-0"
              >
                <Pencil className="size-4" />
                Edit
              </TactileButton>
              <TactileButton
                type="button"
                data-delete-line={saved.name}
                onClick={(e) => ready(e) && setAskDelete(saved.id)}
                className="!h-auto shrink-0 !text-destructive"
              >
                <Trash2 className="size-4" />
                Delete
              </TactileButton>
            </div>
          ),
        )}
        <TactileButton
          data-new-line=""
          disabled={full}
          title={full ? `${MAX_SAVED_LINES} lines at most` : undefined}
          onClick={(e) => ready(e) && switchTo('new')}
          className="mt-2 self-start"
        >
          <Plus className="size-5" />
          {full ? `New Line (${MAX_SAVED_LINES} at most)` : 'New Line'}
        </TactileButton>
      </div>
    </Modal>
  )
}

/** "4 steps: Prewriting, Sentences..." under a line's name. */
function stepsSummary(steps: string[]) {
  const count = steps.length === 1 ? '1 step' : `${steps.length} steps`
  const named = steps.filter((n) => n.trim())
  return named.length > 0 ? `${count}: ${named.join(', ')}` : count
}

/**
 * A saved line's name and its steps' names, typed. The number of steps is − and + (one to six);
 * a step's name is optional and short enough to fit on a desk ("Prewriting", "Sentences").
 */
function LineEditor({
  saved,
  onBack,
  backLabel,
  onSave,
}: {
  saved?: SavedLine
  onBack: () => void
  backLabel: string
  onSave: (line: { id: string; name: string; steps: string[] }) => void
}) {
  const [name, setName] = useState(saved?.name ?? '')
  const [names, setNames] = useState<string[]>(saved?.steps ?? ['', '', ''])
  const count = names.length
  const setCount = (n: number) => setNames((list) => Array.from({ length: n }, (_, i) => list[i] ?? ''))
  const canSave = name.trim().length > 0
  const save = () => canSave && onSave({ id: saved?.id ?? crypto.randomUUID(), name, steps: names })

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <Label htmlFor="line-name" className="mb-1.5">
            Name
          </Label>
          <Input
            id="line-name"
            value={name}
            maxLength={LINE_NAME_MAX}
            autoFocus={!saved}
            autoComplete="off"
            placeholder="Writing"
            onChange={(e) => setName(e.target.value)}
            className="h-11 text-lg"
          />
        </div>
        <div className="shrink-0">
          <Label className="mb-1.5">Steps</Label>
          <div className="flex h-11 items-center gap-1">
            <TactileButton
              type="button"
              aria-label="One step fewer"
              disabled={count <= 1}
              onClick={() => setCount(count - 1)}
              className="!size-11 !p-0"
            >
              <Minus className="size-5" />
            </TactileButton>
            <span data-line-step-count={count} className="w-8 text-center text-xl font-bold tabular-nums">
              {count}
            </span>
            <TactileButton
              type="button"
              aria-label="One step more"
              disabled={count >= MAX_STEPS}
              onClick={() => setCount(count + 1)}
              className="!size-11 !p-0"
            >
              <Plus className="size-5" />
            </TactileButton>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {names.map((step, i) => (
          <label key={i} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right font-bold text-muted-foreground tabular-nums">{i + 1}</span>
            <Input
              value={step}
              data-step-name={i + 1}
              maxLength={STEP_NAME_MAX}
              autoComplete="off"
              placeholder={`Step ${i + 1}`}
              onChange={(e) => setNames((list) => list.map((n, j) => (j === i ? e.target.value : n)))}
              className="h-10"
            />
          </label>
        ))}
      </div>
      <p className="m-0 text-sm text-muted-foreground">Step names are short, to fit on a desk ({STEP_NAME_MAX} letters).</p>
      <div className="flex items-center justify-end gap-2">
        <TactileButton type="button" onClick={onBack}>
          {backLabel}
        </TactileButton>
        <TactileButton type="submit" variant="primary" disabled={!canSave}>
          {saved ? 'Save' : 'Save and Start'}
        </TactileButton>
      </div>
    </form>
  )
}
