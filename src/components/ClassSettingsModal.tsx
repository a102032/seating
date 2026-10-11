import {
  Check,
  CircleCheck,
  CircleQuestionMark,
  ClipboardCheck,
  Hand,
  Map as MapIcon,
  School,
  Signpost,
  Smile,
  Star,
  Users,
} from 'lucide-react'
import { Dialog as DialogPrimitive, Popover } from 'radix-ui'
import { useState, type ComponentType } from 'react'
import type { useCloudSync } from '../hooks/useCloudSync'
import { pointsModeOf, type AvatarScope } from '../hooks/useClasses'
import { useLingerWhileClosing } from '../hooks/useLingerWhileClosing'
import type { RoomLayout } from '../lib/layouts'
import type { DayCount } from '../lib/participation'
import type { Theme } from '../lib/theme'
import type { ClassData, PointsMode, Student } from '../types'
import { DialogContent, DialogTitle } from '@/components/ui/dialog'
import { GoogleG } from './Account'
import { ConfirmModal } from './ConfirmModal'
import { PickStudentIcon } from './PickerIcons'
import { AttendanceSection } from './settings/AttendanceSection'
import { AvatarsSection } from './settings/AvatarsSection'
import { ClassSection } from './settings/ClassSection'
import { GoogleSection } from './settings/GoogleSection'
import { ParticipationSection } from './settings/ParticipationSection'
import { PointsSection } from './settings/PointsSection'
import { StudentsSection } from './settings/StudentsSection'
import { ToolsSection, type PickerSettingsValue } from './settings/ToolsSection'
import type { FlipDeckSettings } from '../hooks/useFlipDeck'

export type SettingsSection = 'class' | 'students' | 'avatars' | 'points' | 'tools' | 'attendance' | 'participation' | 'google'

/**
 * The sections down the left, in the order a class is set up (2026-10-11, the teacher: setting up
 * didn't go in a logical order, and meant jumping between menus): the four Set up sections, then
 * the tools' settings, then what looks back over lessons, then Google. A `group` starts a heading
 * ('' is a gap with no heading).
 */
export const SECTIONS: {
  id: SettingsSection
  label: string
  icon: ComponentType<{ className?: string; size?: number }>
  group?: string
}[] = [
  { id: 'class', label: 'Class', icon: School, group: 'Set up' },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'avatars', label: 'Avatars', icon: Smile },
  { id: 'points', label: 'Points', icon: Star },
  { id: 'tools', label: 'Tools', icon: PickStudentIcon, group: 'In class' },
  { id: 'attendance', label: 'Attendance', icon: ClipboardCheck, group: 'Look back' },
  { id: 'participation', label: 'Participation', icon: Hand },
  { id: 'google', label: 'Google', icon: GoogleG, group: '' },
]

/** The setup sections, which a new class's guide walks through in order and whose feet lead on. */
export const SETUP_SECTIONS: SettingsSection[] = ['class', 'students', 'avatars', 'points']

export interface ToolsProps {
  pickers: PickerSettingsValue
  onUpdatePickers: (patch: Partial<PickerSettingsValue>) => void
  pickedThisRound: number
  roundStarted: boolean
  onStartNewRound: () => void
  getReadyPrize: number
  onSetGetReadyPrize: (prize: number) => void
  flip: FlipDeckSettings
  onUpdateFlip: (patch: Partial<FlipDeckSettings>) => void
  groupChimes: boolean
  onSetGroupChimes: (on: boolean) => void
}

interface ClassSettingsModalProps {
  open: boolean
  onClose: () => void
  section: SettingsSection
  onSection: (section: SettingsSection) => void
  activeClass: ClassData
  classes: ClassData[]
  cloud: ReturnType<typeof useCloudSync>
  onSwitchTeacher: () => void
  /** Help: the guide through the section that is open, or the tour of the whole app. */
  onGuide: () => void
  onTour: () => void
  // Class
  onRename: (name: string) => void
  onSetRoom: (room: string) => void
  onSetLayout: (layout: RoomLayout) => void
  onSetShowAllHomerooms: (show: boolean) => void
  theme: Theme
  onSetTheme: (theme: Theme) => void
  onDeleteClass: () => void
  // Students
  onAddStudents: (students: Omit<Student, 'id'>[]) => string[]
  onRemoveStudents: (studentIds: string[]) => void
  onReplaceStudents: (students: Omit<Student, 'id'>[]) => string[]
  onUpdateStudent: (studentId: string, patch: Partial<Omit<Student, 'id'>>) => void
  onDeleteStudent: (studentId: string) => void
  onUnseatStudent: (studentId: string) => void
  onUnseatAll: () => void
  onSeatClass: () => void
  onMixUpSeats: () => void
  // Avatars
  onSetAvatarsOff: (off: boolean) => void
  onStudentsChoose: () => void
  studentsChooseBlocked: boolean
  onAssignAvatars: (themeId: string, options: { scope: AvatarScope; poses: 'mixed' | 'same' }) => void
  // Points
  onSetPointsMode: (mode: PointsMode) => void
  onSetStarsOnDesks: (on: boolean) => void
  onSetGoal: (goal: number) => void
  onSetCelebrationGif: (gifId: string) => void
  onSetClassPoints: (points: number) => void
  onResetClassGoal: () => void
  onClearDeskStars: () => void
  // Tools
  tools: ToolsProps
  // Attendance and participation
  onToggleAbsentInRecord: (studentId: string, day: string) => void
  onSetParticipation: (day: string, studentId: string, count: DayCount) => void
  onClearParticipationDay: (day: string) => void
  onClearParticipation: () => void
}

/** The guide's layer sits outside the window it points into: a tap on it is not a tap outside the window. */
function keepOpenForGuide(e: Event) {
  if ((e.target as Element | null)?.closest?.('[data-guide-layer]')) e.preventDefault()
}

/**
 * Class Settings: one window, the sections down the left, one section at a time on the right, all
 * of it on screen (2026-10-11, the teacher's menus: too much everywhere, the order didn't follow
 * setup, and things hid below the edge). Every change saves the moment it is made, as a phone's
 * Settings does, so the title bar says so, and Done closes it - there is nothing to forget to save.
 */
export function ClassSettingsModal(props: ClassSettingsModalProps) {
  const { open, onClose, section, onSection, activeClass, classes, cloud } = props
  const [helpOpen, setHelpOpen] = useState(false)
  const [choosingGif, setChoosingGif] = useState(false)
  const [confirming, setConfirming] = useState<'delete' | 'empty' | 'clear' | PointsMode | null>(null)

  // Opening, or another section, starts with the celebration's pictures put away.
  const [shownSection, setShownSection] = useState(section)
  if (shownSection !== section) {
    setShownSection(section)
    setChoosingGif(false)
  }
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    setChoosingGif(false)
    setHelpOpen(false)
  }

  // Nothing to build while closed - see useLingerWhileClosing.
  const shown = useLingerWhileClosing(open)
  if (!shown) return null

  const go = (to: SettingsSection) => onSection(to)
  const next = (from: SettingsSection) => SETUP_SECTIONS[SETUP_SECTIONS.indexOf(from) + 1]
  const label = (id: SettingsSection) => SECTIONS.find((s) => s.id === id)!.label

  function setPointsMode(mode: PointsMode) {
    // Leaving student points clears every desk's stars, so the teacher is asked first.
    const starsOnDesks = activeClass.students.some((s) => (s.points ?? 0) > 0)
    if (pointsModeOf(activeClass) === 'students' && mode !== 'students' && starsOnDesks) setConfirming(mode)
    else props.onSetPointsMode(mode)
  }

  let page
  switch (section) {
    case 'class':
      page = (
        <ClassSection
          activeClass={activeClass}
          classes={classes}
          onRename={props.onRename}
          onSetRoom={props.onSetRoom}
          onSetLayout={props.onSetLayout}
          onSetShowAllHomerooms={props.onSetShowAllHomerooms}
          theme={props.theme}
          onSetTheme={props.onSetTheme}
          onAskDelete={() => setConfirming('delete')}
          onNext={() => go(next('class'))}
        />
      )
      break
    case 'students':
      page = (
        <StudentsSection
          // Another class is another list: nothing half-done carries over.
          key={activeClass.id}
          activeClass={activeClass}
          cloud={cloud}
          onAddStudents={props.onAddStudents}
          onRemoveStudents={props.onRemoveStudents}
          onReplaceStudents={props.onReplaceStudents}
          onUpdateStudent={props.onUpdateStudent}
          onDeleteStudent={props.onDeleteStudent}
          onUnseatStudent={props.onUnseatStudent}
          onUnseatAll={props.onUnseatAll}
          onSeatClass={props.onSeatClass}
          onMixUpSeats={props.onMixUpSeats}
          onNext={() => go(next('students'))}
        />
      )
      break
    case 'avatars':
      page = (
        <AvatarsSection
          key={activeClass.id}
          activeClass={activeClass}
          onSetAvatarsOff={props.onSetAvatarsOff}
          onStudentsChoose={() => {
            props.onStudentsChoose()
            onClose()
          }}
          studentsChooseBlocked={props.studentsChooseBlocked}
          onAssignAvatars={props.onAssignAvatars}
          onNext={() => go(next('avatars'))}
        />
      )
      break
    case 'points':
      page = (
        <PointsSection
          activeClass={activeClass}
          onSetPointsMode={setPointsMode}
          onSetStarsOnDesks={props.onSetStarsOnDesks}
          onSetGoal={props.onSetGoal}
          onSetCelebrationGif={props.onSetCelebrationGif}
          onSetClassPoints={props.onSetClassPoints}
          onAskEmptyMeter={() => setConfirming('empty')}
          onAskClearStars={() => setConfirming('clear')}
          choosingGif={choosingGif}
          onChoosingGif={setChoosingGif}
        />
      )
      break
    case 'tools':
      page = <ToolsSection pointsMode={pointsModeOf(activeClass)} {...props.tools} />
      break
    case 'attendance':
      page = (
        <AttendanceSection
          key={activeClass.id}
          activeClass={activeClass}
          onToggleAbsent={props.onToggleAbsentInRecord}
          uid={cloud.account?.uid}
        />
      )
      break
    case 'participation':
      page = (
        <ParticipationSection
          key={activeClass.id}
          activeClass={activeClass}
          onSetCount={props.onSetParticipation}
          onClearDay={props.onClearParticipationDay}
          onClearAll={props.onClearParticipation}
        />
      )
      break
    case 'google':
      page = <GoogleSection activeClass={activeClass} cloud={cloud} onSwitchTeacher={props.onSwitchTeacher} />
      break
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="h-[min(calc(100dvh-2rem),52rem)] max-h-[calc(100dvh-2rem)] w-[min(64rem,calc(100vw-2rem))] max-w-none grid-rows-[auto_minmax(0,1fr)]"
        onPointerDownOutside={keepOpenForGuide}
        onInteractOutside={keepOpenForGuide}
        onFocusOutside={keepOpenForGuide}
        // The class name box gets the cursor from the guide's first step, not from opening.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <header className="cs-head">
          <DialogTitle>Class Settings</DialogTitle>
          <span className="cs-class">{activeClass.name}</span>
          {/* Help, in the teacher's corner rather than on the board: the guide through this section,
              or the tour of the whole app. One button with two plain choices. */}
          <Popover.Root open={helpOpen} onOpenChange={setHelpOpen}>
            <Popover.Trigger asChild>
              <button type="button" className="cs-help" data-guide="help">
                <CircleQuestionMark /> Help
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="start" sideOffset={6} className="cs-menu cs-help-menu" data-help-menu="">
                <button
                  type="button"
                  data-help="guide"
                  onClick={() => {
                    setHelpOpen(false)
                    setChoosingGif(false)
                    props.onGuide()
                  }}
                >
                  <span className="cs-hm-ic">
                    <Signpost />
                  </span>
                  <span>
                    <b>Guide me through this section</b>
                    <small>Step by step: {label(section)}</small>
                  </span>
                </button>
                <button
                  type="button"
                  data-help="tour"
                  onClick={() => {
                    setHelpOpen(false)
                    props.onTour()
                  }}
                >
                  <span className="cs-hm-ic">
                    <MapIcon />
                  </span>
                  <span>
                    <b>Take a tour of the app</b>
                    <small>Every screen, one part at a time</small>
                  </span>
                </button>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          <span className="cs-saved text-emerald-700 dark:text-emerald-400">
            <CircleCheck size={16} />
            <span className="hidden sm:inline">Changes save by themselves</span>
          </span>
          <button type="button" data-slot="button" className="cs-btn cs-primary cs-done" data-guide="done" onClick={onClose}>
            <Check /> Done
          </button>
        </header>
        <div className="cs-main">
          <nav className="cs-nav" aria-label="Sections">
            {SECTIONS.map((s) => (
              <SectionLink key={s.id} section={s} current={section === s.id} onClick={() => go(s.id)} />
            ))}
          </nav>
          <div className="cs-page" data-section={section}>
            {page}
          </div>
        </div>

        <ConfirmModal
          open={confirming === 'delete'}
          title="Delete Class?"
          message={`This deletes "${activeClass.name}", its students and its seating chart. This can't be undone.`}
          confirmLabel="Delete Class"
          requireTypedText={activeClass.name}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            setConfirming(null)
            props.onDeleteClass()
            onClose()
          }}
        />
        <ConfirmModal
          open={confirming === 'empty'}
          title="Empty the meter?"
          message={`"${activeClass.name}"'s class goal meter goes back to 0.`}
          confirmLabel="Yes, Empty It"
          cancelLabel="No"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            props.onResetClassGoal()
            setConfirming(null)
          }}
        />
        <ConfirmModal
          open={confirming === 'clear'}
          title="Clear All Stars?"
          message={`Every student in "${activeClass.name}" goes back to 0 stars. This can't be undone.`}
          confirmLabel="Yes, Clear Them"
          cancelLabel="No"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            props.onClearDeskStars()
            setConfirming(null)
          }}
        />
        <ConfirmModal
          open={confirming === 'goal' || confirming === 'none'}
          title="Clear the students' stars?"
          message={`Switching to ${confirming === 'goal' ? 'a class goal' : 'no points'} clears the stars on every desk in "${activeClass.name}". This can't be undone.`}
          confirmLabel="Yes, Switch"
          cancelLabel="No"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            if (confirming === 'goal' || confirming === 'none') props.onSetPointsMode(confirming)
            setConfirming(null)
          }}
        />
      </DialogContent>
    </DialogPrimitive.Root>
  )
}

function SectionLink({ section, current, onClick }: { section: (typeof SECTIONS)[number]; current: boolean; onClick: () => void }) {
  const Icon = section.icon
  return (
    <>
      {section.group !== undefined &&
        (section.group ? <div className="cs-nav-label">{section.group}</div> : <div className="cs-nav-gap" />)}
      <button
        type="button"
        className="cs-nav-item"
        data-section-link={section.id}
        aria-current={current ? 'page' : undefined}
        onClick={onClick}
      >
        <span className="cs-ic">
          <Icon size={20} />
        </span>
        {section.label}
      </button>
    </>
  )
}
