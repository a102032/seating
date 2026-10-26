import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { GroupActivity } from '../components/GroupActivity'
import { GroupActivityModal } from '../components/GroupActivityModal'
import { GroupBuilder } from '../components/GroupBuilder'
import { GroupExitModal } from '../components/GroupExitModal'
import { SaveGroupsModal } from '../components/SaveGroupsModal'
import type { useClasses } from '../hooks/useClasses'
import { useGroupPicker } from '../hooks/useGroupPicker'
import {
  buildGroups,
  framesFor,
  groupsFromSaved,
  handMadeGroups,
  MAX_SAVED_GROUPS,
  pruneGroups,
  schemeLabel,
  summarizeGroupPoints,
  type GroupScheme,
} from '../lib/groups'
import type { LayoutPlan } from '../lib/layouts'
import { playGroupsDone } from '../lib/sound'
import type { ClassData, PointsMode, Student } from '../types'

type Store = ReturnType<typeof useClasses>

interface Options {
  cls: ClassData | undefined
  /** The seating as today's lesson sees it: absent students' desks count as empty. */
  presentSeating: (string | null)[]
  studentsById: Map<string, Student>
  absentIds: Set<string>
  plan: LayoutPlan
  pointsMode: PointsMode
  today: string
  /** The desk picker's settings, which the group picker shares. */
  pickerSettings: { allowRepeats: boolean; soundEnabled: boolean }
  chanceOf: (id: string) => number
  store: Pick<
    Store,
    | 'setGroups'
    | 'recordPick'
    | 'finishGroupActivity'
    | 'saveGroups'
    | 'removeSavedGroups'
    | 'adjustGroupPoints'
    | 'resetGroupPoints'
    | 'moveStudentToGroup'
    | 'setGroupStatus'
  >
  /** The group cards are coming up: the flip cards go, and a selection on the desks with them. */
  onOpening: () => void
  toast: (text: string) => void
}

/**
 * Group Activity: the window that makes the groups, "I'll choose", the cards over the board with
 * their own picker, Save, and the question on the way out. Its state is kept here.
 */
export function useGroupActivityScreen(o: Options) {
  const { cls, plan, studentsById, store } = o
  const classId = cls?.id ?? null
  const seating = cls?.seating ?? []
  const [modalOpen, setModalOpen] = useState(false)
  /** "I'll choose": the teacher taps the names into this many groups. */
  const [builder, setBuilder] = useState<{ scheme: GroupScheme; count: number } | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [open, setOpen] = useState(false)
  /** How the current groups were made, so Shuffle can deal the same shape again. Null for saved groups. */
  const [scheme, setScheme] = useState<GroupScheme | null>(null)
  /** Non-zero asks the activity to deal; bumped for every deal, and set back to 0 when saved groups are picked up. */
  const [dealTick, setDealTick] = useState(0)
  /** Whether the current deal came from Shuffle, which is the only thing that riffles. */
  const [dealWasShuffle, setDealWasShuffle] = useState(false)
  /** Exit was tapped with points still on the board, and the teacher is being asked what to do with them. */
  const [exitPromptOpen, setExitPromptOpen] = useState(false)
  /** Students are at the board: only the status lights answer to a tap. Cleared by a new deal or a class switch. */
  const [locked, setLocked] = useState(false)

  /** The saved groups as they stand today - anyone who has left their desk since is out. */
  const groups = useMemo(() => pruneGroups(cls?.groups ?? [], cls?.seating ?? []), [cls])
  /**
   * The pickers, while the group cards are up. The seating chart's picker lights up desks,
   * which are behind the cards and so invisible here, which is why the panel's two picker
   * buttons hand over to this one instead of being greyed out.
   */
  const pickableGroups = useMemo(
    () => groups.map((g) => ({ ...g, studentIds: g.studentIds.filter((id) => !o.absentIds.has(id)) })),
    [groups, o.absentIds],
  )
  const picker = useGroupPicker(pickableGroups, {
    allowRepeats: o.pickerSettings.allowRepeats,
    soundEnabled: o.pickerSettings.soundEnabled,
    resetKey: dealTick,
    chanceOf: o.chanceOf,
    onStudentPicked: (id) => {
      if (classId) store.recordPick(classId, id, o.today)
    },
  })

  function openActivity() {
    o.onOpening()
    setOpen(true)
  }

  function start(next: GroupScheme) {
    if (!classId) return
    store.setGroups(classId, buildGroups(next, o.presentSeating, studentsById, groups, plan), next)
    setScheme(next)
    setDealWasShuffle(false)
    setDealTick((t) => t + 1)
    setLocked(false)
    openActivity()
  }

  /** "I'll choose": the class's desks small on one side, the groups on the other, the names tapped in. */
  function choose(next: GroupScheme) {
    if (!cls) return
    setBuilder({ scheme: next, count: framesFor(next, seating, plan) })
  }

  /** The groups the teacher chose by hand, on the board as they were tapped in. Shuffle still mixes them, into as many cards. */
  function startChosen(members: string[][]) {
    if (!classId || !builder) return
    store.setGroups(classId, handMadeGroups(members), builder.scheme)
    setScheme(builder.scheme)
    setBuilder(null)
    setDealWasShuffle(false)
    setDealTick(0)
    setLocked(false)
    openActivity()
  }

  /** Saved groups, brought back for today: anyone new joins the smallest group, and the teacher is told. */
  function startSaved(savedId: string) {
    const saved = cls?.savedGroups?.find((s) => s.id === savedId)
    if (!classId || !cls || !saved) return
    const { groups: fresh, joined } = groupsFromSaved(saved, seating)
    if (fresh.length === 0) {
      o.toast(`Nobody in "${saved.name}" has a desk in this class now.`)
      return
    }
    const madeBy: GroupScheme = saved.madeBy ?? { kind: 'count', count: fresh.length }
    store.setGroups(classId, fresh, madeBy, saved.id)
    setScheme(madeBy)
    setDealWasShuffle(false)
    setDealTick(0)
    setLocked(false)
    openActivity()
    if (joined.length === 1) {
      const who = studentsById.get(joined[0].studentId)?.name ?? 'A new student'
      o.toast(`${who} joined ${joined[0].groupName}.`)
    } else if (joined.length > 1) {
      o.toast(`${joined.length} new students joined the smallest groups.`)
    }
  }

  function continueLast() {
    if (!classId) return
    store.setGroups(classId, groups)
    // Remembered with the class, so Shuffle works after Continue too.
    setScheme(cls?.groupsMadeBy ?? null)
    setDealTick(0)
    openActivity()
  }

  function shuffle() {
    if (!classId || !scheme) return
    // Shuffle mixes everyone at random, into the same number of cards: the seats made the first deal.
    store.setGroups(classId, buildGroups(scheme, o.presentSeating, studentsById, groups, plan, { mix: true }))
    setDealWasShuffle(true)
    setDealTick((t) => t + 1)
  }

  /**
   * One way out. With nothing on the scoreboard it just closes; with points, the teacher is
   * asked whether they go out now or wait with the groups - handing thirty students their
   * stars is not something that should happen as a side effect of leaving a screen.
   */
  function requestExit() {
    picker.dismiss()
    // With no points the cards carry no score, so there is nothing to ask about.
    if (o.pointsMode !== 'none' && summarizeGroupPoints(groups).totalPoints > 0) setExitPromptOpen(true)
    else setOpen(false)
  }

  /** The points go out - onto the class goal, or to each student in a group - and the board comes back. */
  function giveOutPoints() {
    if (!cls) return
    const { totalPoints } = summarizeGroupPoints(groups)
    store.finishGroupActivity(cls.id)
    setExitPromptOpen(false)
    setOpen(false)
    playGroupsDone()
    o.toast(
      o.pointsMode === 'students' ? "Everyone got their group's points." : `${totalPoints} point${totalPoints === 1 ? '' : 's'} added to the class goal.`,
    )
  }

  /** Another class is another set of groups; the activity closes rather than showing them. */
  function closeForAnotherClass() {
    setOpen(false)
    setScheme(null)
    setLocked(false)
  }

  return {
    open,
    locked,
    groups,
    picker,
    modalOpen,
    openModal: () => setModalOpen(true),
    closeModal: () => setModalOpen(false),
    builder,
    closeBuilder: () => setBuilder(null),
    saveOpen,
    openSave: () => setSaveOpen(true),
    closeSave: () => setSaveOpen(false),
    exitPromptOpen,
    closeExitPrompt: () => setExitPromptOpen(false),
    /** Keep the points with the groups, and the board comes back. */
    keepPoints: () => {
      setExitPromptOpen(false)
      setOpen(false)
    },
    scheme,
    dealTick,
    dealWasShuffle,
    toggleLock: () => setLocked((v) => !v),
    start,
    choose,
    startChosen,
    startSaved,
    continueLast,
    shuffle,
    requestExit,
    giveOutPoints,
    closeForAnotherClass,
  }
}

export type GroupActivityScreen = ReturnType<typeof useGroupActivityScreen>

/**
 * The group cards. Group Activity slides in from the side the way a class turns to face its
 * teams - and back out the same way when the board returns.
 */
export function GroupActivityBoard({
  screen: g,
  cls,
  studentsById,
  absentIds,
  points,
  store,
}: {
  screen: GroupActivityScreen
  cls: ClassData
  studentsById: Map<string, Student>
  absentIds: Set<string>
  points: boolean
  store: Options['store']
}) {
  return (
    <AnimatePresence>
      {g.open && (
        <motion.div
          initial={{ x: '100%', opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.6 }}
          transition={{ type: 'spring', stiffness: 260, damping: 32 }}
          data-ink="board"
          className="absolute inset-0 z-10 rounded-2xl bg-gradient-to-br from-[var(--app-bg-from)] to-[var(--app-bg-to)]"
        >
          <GroupActivity
            groups={g.groups}
            studentsById={studentsById}
            absentIds={absentIds}
            dealTick={g.dealTick}
            dealWasShuffle={g.dealWasShuffle}
            canShuffle={g.scheme !== null}
            points={points}
            onResetPoints={() => store.resetGroupPoints(cls.id)}
            onAdjustPoints={(groupId, delta) => store.adjustGroupPoints(cls.id, groupId, delta)}
            onMove={(studentId, groupId) => store.moveStudentToGroup(cls.id, studentId, groupId)}
            onNewGroups={g.openModal}
            onShuffle={g.shuffle}
            onSave={g.openSave}
            onExit={g.requestExit}
            onSetStatus={(groupId, status) => store.setGroupStatus(cls.id, groupId, status)}
            locked={g.locked}
            onToggleLock={g.toggleLock}
            pick={g.picker.pick}
            lockedGroupId={g.picker.lockedGroupId}
            onDismissPick={g.picker.dismiss}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Group Activity's windows: making the groups, I'll choose, Save, and the question on the way out. */
export function GroupActivityWindows({
  screen: g,
  cls,
  presentSeating,
  studentsById,
  absentIds,
  homerooms,
  plan,
  pointsMode,
  store,
  toast,
}: {
  screen: GroupActivityScreen
  cls: ClassData
  presentSeating: (string | null)[]
  studentsById: Map<string, Student>
  absentIds: Set<string>
  homerooms: Set<string>
  plan: LayoutPlan
  pointsMode: PointsMode
  store: Options['store']
  toast: (text: string) => void
}) {
  return (
    <>
      <GroupActivityModal
        open={g.modalOpen}
        onClose={g.closeModal}
        seating={presentSeating}
        studentsById={studentsById}
        plan={plan}
        setName={plan.setName}
        lastGroups={g.groups}
        lastMadeBy={cls.groupsMadeBy}
        savedGroups={cls.savedGroups ?? []}
        onStart={g.start}
        onChoose={g.choose}
        onContinue={g.continueLast}
        onStartSaved={g.startSaved}
        onRemoveSaved={(savedId) => store.removeSavedGroups(cls.id, savedId)}
      />

      {g.builder && (
        <GroupBuilder
          plan={plan}
          seating={cls.seating}
          studentsById={studentsById}
          absentIds={absentIds}
          homerooms={homerooms}
          groupCount={g.builder.count}
          pairs={g.builder.scheme.kind === 'size'}
          title={schemeLabel(g.builder.scheme, g.builder.count, plan.setName)}
          onStart={g.startChosen}
          onCancel={g.closeBuilder}
        />
      )}

      <SaveGroupsModal
        open={g.saveOpen}
        onClose={g.closeSave}
        savedName={cls.savedGroups?.find((s) => s.id === cls.groupsSavedAs)?.name ?? null}
        full={(cls.savedGroups?.length ?? 0) >= MAX_SAVED_GROUPS}
        onSave={(name) => {
          store.saveGroups(cls.id, name)
          toast(`Saved as "${name}".`)
        }}
      />

      <GroupExitModal
        open={g.exitPromptOpen}
        onClose={g.closeExitPrompt}
        groups={g.groups}
        onGiveOut={g.giveOutPoints}
        toStudents={pointsMode === 'students'}
        onKeep={g.keepPoints}
      />
    </>
  )
}
