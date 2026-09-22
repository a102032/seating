import clsx from 'clsx'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { Check, Minus, Pencil, Plus, Shuffle, Star, Target, Users, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { groupTextColor } from '../lib/groups'
import { playCardDeal, playCardFlip, playPointAward, playPointDeduct } from '../lib/sound'
import type { GroupPointsMode, Student, StudentGroup } from '../types'
import { Input } from '@/components/ui/input'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'

interface GroupActivityProps {
  groups: StudentGroup[]
  studentsById: Map<string, Student>
  pointsMode: GroupPointsMode
  /** Bumped on every deal, so the chips fly in again. Unchanged when picking up saved groups. */
  dealTick: number
  canShuffle: boolean
  onAdjustPoints: (groupId: string, delta: number) => void
  onMove: (studentId: string, groupId: string) => void
  onRename: (groupId: string, name: string) => void
  onNewGroups: () => void
  onShuffle: () => void
  onHide: () => void
  onDone: () => void
}

/** Card intro before the first chip lands, then one chip every DEAL_STAGGER_MS. */
const CARDS_INTRO_MS = 220
export const DEAL_STAGGER_MS = 45

/** Columns for a given number of cards, chosen so the grid is always full - no half-empty last row. */
function columnsFor(count: number): number {
  if (count <= 3) return count
  if (count === 4) return 2
  if (count <= 6) return 3
  if (count <= 8) return 4
  if (count <= 10) return 5
  if (count <= 12) return 4
  return 5
}

/**
 * The activity itself: one card per group, each with its members and its own score.
 *
 * Moving a student is tap, then tap - lift a chip, tap the card it belongs in - or a drag,
 * for teachers who reach for that first. Both are for the one or two fix-ups a teacher makes
 * after a deal; building groups by hand is deliberately not a mode, since with thirty
 * students that's sixty taps before the lesson can start.
 */
export function GroupActivity({
  groups,
  studentsById,
  pointsMode,
  dealTick,
  canShuffle,
  onAdjustPoints,
  onMove,
  onRename,
  onNewGroups,
  onShuffle,
  onHide,
  onDone,
}: GroupActivityProps) {
  /** The chip that's been picked up and is waiting for a card to be tapped. */
  const [lifted, setLifted] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<StudentGroup | null>(null)
  const dealtRef = useRef(0)

  // Deal sounds for a fresh deal only. Picking up saved groups mounts with dealTick
  // unchanged, and the chips appear without the flourish - they aren't news.
  useEffect(() => {
    if (dealTick === dealtRef.current) return
    dealtRef.current = dealTick
    const total = groups.reduce((n, g) => n + g.studentIds.length, 0)
    for (let i = 0; i < total; i++) playCardDeal((CARDS_INTRO_MS + i * DEAL_STAGGER_MS) / 1000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealTick])

  // A lifted chip that leaves the board (shuffle, new groups) mustn't stay lifted.
  useEffect(() => setLifted(null), [dealTick, groups.length])

  function move(studentId: string, groupId: string) {
    const from = groups.find((g) => g.studentIds.includes(studentId))
    setLifted(null)
    if (!from || from.id === groupId) return
    onMove(studentId, groupId)
    playCardFlip()
  }

  function dropAt(studentId: string, event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    // The drop point is where the pointer is, not where the chip's origin was.
    const point = 'clientX' in event ? { x: event.clientX, y: event.clientY } : info.point
    const target = document
      .elementsFromPoint(point.x, point.y)
      .map((el) => (el as HTMLElement).closest<HTMLElement>('[data-group-id]'))
      .find(Boolean)
    if (target?.dataset.groupId) move(studentId, target.dataset.groupId)
  }

  const columns = columnsFor(groups.length)
  const rows = Math.ceil(groups.length / columns)
  const animate = dealTick !== 0
  let chipIndex = 0

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card/70 px-3 py-2 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-1.5">
          <TactileButton onClick={onNewGroups} className="!px-3 !py-2">
            <Users size={16} /> New Groups
          </TactileButton>
          <TactileButton
            onClick={onShuffle}
            disabled={!canShuffle}
            className="!px-3 !py-2"
            title={canShuffle ? 'Deal these groups again' : 'Tap New Groups to shuffle'}
          >
            <Shuffle size={16} /> Shuffle
          </TactileButton>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-bold text-secondary-foreground"
            title={
              pointsMode === 'students'
                ? 'When you tap Done, every student gets a star for each of their group’s points'
                : 'When you tap Done, each group point becomes one class point on the goal meter'
            }
          >
            {pointsMode === 'students' ? <Users size={15} /> : <Target size={15} />}
            <span className="hidden sm:inline">{pointsMode === 'students' ? 'Stars to each student' : 'Points to class goal'}</span>
          </span>
          <TactileButton active onClick={onDone} className="!px-4 !py-2">
            <Check size={18} strokeWidth={3} /> Done
          </TactileButton>
          <button
            type="button"
            onClick={onHide}
            title="Back to the seating chart - your groups are kept"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent active:scale-95"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div
        key={dealTick}
        className="grid min-h-0 flex-1 gap-2 sm:gap-3"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {groups.map((group, groupIndex) => {
          const fg = groupTextColor(group.color)
          const liftedHere = lifted !== null && group.studentIds.includes(lifted)
          const dropTarget = lifted !== null && !liftedHere
          return (
            <motion.section
              key={group.id}
              data-group-id={group.id}
              data-ink="group-card"
              initial={animate ? { opacity: 0, scale: 0.85, y: 24 } : false}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 24,
                delay: animate ? groupIndex * 0.05 : 0,
              }}
              onClick={() => lifted && move(lifted, group.id)}
              className={clsx(
                'relative flex min-h-0 flex-col overflow-hidden rounded-2xl bg-card text-card-foreground shadow-md',
                dropTarget && 'cursor-pointer',
              )}
              // A container, so the chips can size from the card: two big teams get big
              // names, fifteen pairs get small ones, without a breakpoint for each count.
              style={{ boxShadow: `0 0 0 3px ${group.color}, 0 4px 14px rgba(0,0,0,0.12)`, containerType: 'inline-size' }}
            >
              {/* The colour band is the group's name tag - it's what the class will call them. */}
              <header
                className="flex shrink-0 items-center justify-between gap-2 px-3 py-1.5"
                style={{ background: group.color, color: fg }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    if (lifted) return
                    e.stopPropagation()
                    setRenaming(group)
                  }}
                  title="Rename this group"
                  className="flex min-w-0 items-center gap-1.5 rounded-lg px-1 py-0.5 text-left font-extrabold leading-tight hover:bg-white/15 active:scale-[0.98]"
                  style={{ fontSize: 'clamp(0.95rem, 2.2vmin, 1.4rem)' }}
                >
                  <span className="truncate">{group.name}</span>
                  <Pencil size={13} className="shrink-0 opacity-60" />
                </button>
                <span className="shrink-0 text-xs font-bold opacity-80">{group.studentIds.length}</span>
              </header>

              <div className="relative min-h-0 flex-1 overflow-y-auto p-2">
                {dropTarget && (
                  <div
                    className="pointer-events-none absolute inset-1 animate-pulse rounded-xl border-2 border-dashed"
                    style={{ borderColor: group.color }}
                  />
                )}
                <div className="flex flex-wrap content-start" style={{ gap: 'clamp(0.3rem, 1cqi, 0.6rem)' }}>
                  {group.studentIds.length === 0 && (
                    <span className="w-full py-3 text-center text-sm font-medium text-muted-foreground">
                      Empty - tap here to move someone in
                    </span>
                  )}
                  <AnimatePresence initial={animate}>
                    {group.studentIds.map((studentId) => {
                      const student = studentsById.get(studentId)
                      if (!student) return null
                      const i = chipIndex++
                      const isLifted = lifted === studentId
                      return (
                        <motion.button
                          key={studentId}
                          type="button"
                          layout
                          initial={{
                            opacity: 0,
                            y: -60,
                            scale: 0.5,
                            rotate: -8,
                          }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            scale: isLifted ? 1.08 : 1,
                            rotate: 0,
                          }}
                          exit={{
                            opacity: 0,
                            scale: 0.5,
                            transition: { duration: 0.15 },
                          }}
                          transition={{
                            type: 'spring',
                            stiffness: 320,
                            damping: 22,
                            delay: animate ? (CARDS_INTRO_MS + i * DEAL_STAGGER_MS) / 1000 : 0,
                          }}
                          drag
                          dragSnapToOrigin
                          dragElastic={0.6}
                          dragMomentum={false}
                          whileDrag={{
                            scale: 1.1,
                            zIndex: 50,
                            boxShadow: '0 12px 24px rgba(0,0,0,0.25)',
                          }}
                          onDragStart={() => setLifted(null)}
                          onDragEnd={(event, info) => dropAt(studentId, event, info)}
                          onTap={() => setLifted(isLifted ? null : studentId)}
                          onClick={(e) => e.stopPropagation()}
                          title={isLifted ? 'Now tap the group to move them to' : 'Tap, then tap another group to move them'}
                          className={clsx(
                            'relative flex max-w-full cursor-grab items-baseline gap-[0.35em] rounded-full px-[0.75em] py-[0.3em] font-bold leading-tight text-card-foreground shadow-sm select-none active:cursor-grabbing',
                            isLifted && 'z-20 ring-[3px] ring-amber-400',
                          )}
                          style={{
                            background: `${group.color}22`,
                            fontSize: 'clamp(0.85rem, 4.4cqi, 1.9rem)',
                            touchAction: 'none',
                          }}
                        >
                          <span className="shrink-0 text-[0.72em] font-semibold opacity-50">{student.homeroom}</span>
                          <span className="truncate">{student.name}</span>
                        </motion.button>
                      )
                    })}
                  </AnimatePresence>
                </div>
              </div>

              <footer className="flex shrink-0 items-stretch gap-1.5 border-t border-black/5 p-1.5 dark:border-white/10">
                <TactileButton
                  onClick={(e) => {
                    e.stopPropagation()
                    if (group.points === 0) return
                    onAdjustPoints(group.id, -1)
                    playPointDeduct()
                  }}
                  disabled={group.points === 0}
                  title="Take a point away"
                  className="h-10 flex-1 !px-0 justify-center"
                >
                  <Minus size={20} strokeWidth={2.75} />
                </TactileButton>
                <span className="flex min-w-[3.5rem] items-center justify-center gap-1 px-1 text-2xl font-extrabold tabular-nums">
                  <Star size={20} className="fill-amber-500 text-amber-500" strokeWidth={0} />
                  <motion.span
                    key={group.points}
                    initial={{ scale: 1.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 12 }}
                  >
                    {group.points}
                  </motion.span>
                </span>
                <TactileButton
                  onClick={(e) => {
                    e.stopPropagation()
                    onAdjustPoints(group.id, 1)
                    playPointAward()
                  }}
                  title="Give a point"
                  className="h-10 flex-1 !px-0 justify-center"
                >
                  <Plus size={20} strokeWidth={2.75} />
                </TactileButton>
              </footer>
            </motion.section>
          )
        })}
      </div>

      <RenameGroupModal
        group={renaming}
        onClose={() => setRenaming(null)}
        onSave={(name) => {
          if (renaming) onRename(renaming.id, name)
          setRenaming(null)
        }}
      />
    </div>
  )
}

/** The one place typing is allowed, and it's optional: "Group 3" is a fine name. */
function RenameGroupModal({ group, onClose, onSave }: { group: StudentGroup | null; onClose: () => void; onSave: (name: string) => void }) {
  return (
    <Modal open={group !== null} onClose={onClose} title="Rename Group">
      {/* Keyed so each group opens with its own name, without an effect to copy it in. */}
      <RenameForm key={group?.id ?? 'none'} group={group} onClose={onClose} onSave={onSave} />
    </Modal>
  )
}

function RenameForm({ group, onClose, onSave }: { group: StudentGroup | null; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(group?.name ?? '')
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(name)
      }}
    >
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={24}
        autoFocus
        placeholder={group?.name}
        className="text-lg font-bold"
      />
      <div className="flex gap-2">
        <TactileButton type="button" onClick={onClose} className="flex-1 justify-center">
          Cancel
        </TactileButton>
        <TactileButton type="submit" active className="flex-1 justify-center">
          Save
        </TactileButton>
      </div>
    </form>
  )
}
