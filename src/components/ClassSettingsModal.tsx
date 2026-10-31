import type { MarbleExtras } from '../lib/marbles'
import type { QuestPrize } from '../lib/quest'
import {
  Check,
  CircleQuestionMark,
  CircleUserRound,
  ClipboardCheck,
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
import { notePhotoCaution, photoCautionSeen } from '../lib/photos'
import type { DeskPictures } from '../lib/stickers'
import type { ClassData, PointsMode, Student } from '../types'
import { DialogContent, DialogTitle } from '@/components/ui/dialog'
import { AddPhotosModal, type PhotoRequest } from './AddPhotosModal'
import { ConfirmModal } from './ConfirmModal'
import { PickStudentIcon } from './PickerIcons'
import { AttendanceSection } from './settings/AttendanceSection'
import { AvatarsSection } from './settings/AvatarsSection'
import { ClassSection } from './settings/ClassSection'
import { GoogleSection } from './settings/GoogleSection'
import { ParticipationSection } from './settings/ParticipationSection'
import { PointsSection } from './settings/PointsSection'
import { StudentsSection } from './settings/StudentsSection'
import { ToolsSection, type ToolPlace } from './settings/ToolsSection'
import type { FlipDeckSettings } from '../hooks/useFlipDeck'

export type SettingsSection = 'class' | 'students' | 'avatars' | 'points' | 'tools' | 'attendance' | 'participation' | 'google'

/** Every page of Class Settings by name, as the guide's bubble says where it is ("Attendance · 2 of 4"). */
export const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'class', label: 'Class' },
  { id: 'students', label: 'Students' },
  { id: 'avatars', label: 'Avatars' },
  { id: 'points', label: 'Points' },
  { id: 'tools', label: 'Tools' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'participation', label: 'Participation' },
  { id: 'google', label: 'Account' },
]

/**
 * The list down the left (2026-10-26, the teacher's testers: everything looked the same, with
 * faint differences between items and sections). Each section has its own coloured square, the
 * only bright colour in the window, the way Apple's and Windows' Settings mark theirs; gaps rather
 * than headings set the kinds apart: setting up, the tools, looking back, the account. Records is
 * Attendance and Participation, one page each behind a switch at its top.
 */
const NAV: {
  id: SettingsSection
  pages?: SettingsSection[]
  label: string
  color: string
  icon: ComponentType<{ className?: string; size?: number }>
  gapBefore?: boolean
}[] = [
  { id: 'class', label: 'Class', color: '#4f86e8', icon: School },
  { id: 'students', label: 'Students', color: '#2e9e9e', icon: Users },
  { id: 'avatars', label: 'Avatars', color: '#e6820b', icon: Smile },
  { id: 'points', label: 'Points', color: '#d4a10a', icon: Star },
  { id: 'tools', label: 'Tools', color: '#8a62d6', icon: PickStudentIcon, gapBefore: true },
  { id: 'attendance', pages: ['attendance', 'participation'], label: 'Records', color: '#2f9e5a', icon: ClipboardCheck, gapBefore: true },
  { id: 'google', label: 'Account', color: '#55708f', icon: CircleUserRound, gapBefore: true },
]

/** The setup sections, which a new class's guide walks through in order and whose feet lead on. */
export const SETUP_SECTIONS: SettingsSection[] = ['class', 'students', 'avatars', 'points']

export interface ToolsProps {
  showFloat: boolean
  setName: 'row' | 'table'
  getReadyPrize: number
  onSetGetReadyPrize: (prize: number) => void
  flip: FlipDeckSettings
  onUpdateFlip: (patch: Partial<FlipDeckSettings>) => void
  onGoTo: (place: ToolPlace) => void
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
  /** Another class, made and opened on Class with the whole setup walked through; greyed at the most a teacher keeps. */
  onNewClass: () => void
  canAddClass: boolean
  /** Help: the guide through the section that is open, or the tour of the whole app. */
  onGuide: () => void
  onTour: () => void
  // Class
  onRename: (name: string) => void
  /** Rows also takes how many rows; leaving it out keeps the class's own. */
  onSetLayout: (layout: RoomLayout, rows?: number) => void
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
  onSetDeskPictures: (shows: DeskPictures) => void
  /** New photos saved in Drive, by student; the students' old ones go to Drive's bin. */
  onPhotosSaved: (photos: Record<string, string>) => void
  /** These students' photos taken away, to Drive's bin. */
  onRemovePhotos: (studentIds: string[]) => void
  /** Photos this computer hasn't got yet, and Get Photos to bring them down from Drive. */
  photosNotHere: number
  onGetPhotos: () => void
  gettingPhotos: boolean
  photosProblem: string | null
  onSetChartPhotos: (on: boolean) => void
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
  onSetQuestPrizes: (prizes: QuestPrize[]) => void
  onSetMarbleExtras: (extras: MarbleExtras) => void
  onRestartQuest: () => void
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
  const [confirming, setConfirming] = useState<
    'delete' | 'empty' | 'clear' | 'restart-quest' | 'photos' | 'remove-photos' | PointsMode | null
  >(null)
  const [photoRequest, setPhotoRequest] = useState<PhotoRequest | null>(null)

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
  const label = (id: SettingsSection) => SECTIONS.find((s) => s.id === id)!.label

  function setDeskPictures(shows: DeskPictures) {
    // The first time a teacher turns photos on here, the caution comes first.
    if (shows === 'photos' && !photoCautionSeen(cloud.account?.uid)) setConfirming('photos')
    else props.onSetDeskPictures(shows)
  }

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
          onSetLayout={props.onSetLayout}
          onSetShowAllHomerooms={props.onSetShowAllHomerooms}
          theme={props.theme}
          onSetTheme={props.onSetTheme}
          onAskDelete={() => setConfirming('delete')}
          onNewClass={props.onNewClass}
          canAddClass={props.canAddClass}
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
          onPhotoChosen={(file, student) => setPhotoRequest({ files: [file], only: student })}
          onRemovePhoto={(studentId) => props.onRemovePhotos([studentId])}
        />
      )
      break
    case 'avatars':
      page = (
        <AvatarsSection
          key={activeClass.id}
          activeClass={activeClass}
          signedIn={cloud.account !== null}
          onSetDeskPictures={setDeskPictures}
          onPhotosChosen={(files) => setPhotoRequest({ files })}
          onAskRemoveAllPhotos={() => setConfirming('remove-photos')}
          photosNotHere={props.photosNotHere}
          onGetPhotos={props.onGetPhotos}
          gettingPhotos={props.gettingPhotos}
          photosProblem={props.photosProblem}
          onStudentsChoose={() => {
            props.onStudentsChoose()
            onClose()
          }}
          studentsChooseBlocked={props.studentsChooseBlocked}
          onAssignAvatars={props.onAssignAvatars}
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
          onSetQuestPrizes={props.onSetQuestPrizes}
          onSetMarbleExtras={props.onSetMarbleExtras}
          onAskRestartQuest={() => setConfirming('restart-quest')}
        />
      )
      break
    case 'tools':
      page = <ToolsSection pointsMode={pointsModeOf(activeClass)} {...props.tools} />
      break
    case 'attendance':
      page = (
        <AttendanceSection
          records={<RecordsSwitch section={section} onSection={go} />}
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
          records={<RecordsSwitch section={section} onSection={go} />}
          key={activeClass.id}
          activeClass={activeClass}
          onSetCount={props.onSetParticipation}
          onClearDay={props.onClearParticipationDay}
          onClearAll={props.onClearParticipation}
          uid={cloud.account?.uid}
        />
      )
      break
    case 'google':
      page = (
        <GoogleSection
          activeClass={activeClass}
          cloud={cloud}
          onSwitchTeacher={props.onSwitchTeacher}
          onSetChartPhotos={props.onSetChartPhotos}
        />
      )
      break
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="cs-window h-[min(calc(100dvh-2rem),52rem)] max-h-[calc(100dvh-2rem)] w-[min(64rem,calc(100vw-2rem))] max-w-none grid-rows-[auto_minmax(0,1fr)]"
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
          <button type="button" data-slot="button" className="cs-btn cs-primary cs-done" data-guide="done" onClick={onClose}>
            <Check /> Done
          </button>
        </header>
        <div className="cs-main">
          <nav className="cs-nav" aria-label="Sections">
            {NAV.map((s) => (
              <SectionLink key={s.id} section={s} current={(s.pages ?? [s.id]).includes(section)} onClick={() => go(s.id)} />
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
        {/* Shown once, as a real stop: every school's rules differ, so the app reminds rather than decides. */}
        <ConfirmModal
          open={confirming === 'photos'}
          title="Using student photos"
          message="Check your school's rules before adding photos of students. Photos stay in your own Google Drive and only show in this app. Please don't share them anywhere else."
          confirmLabel="I've checked, go on"
          cancelLabel="Not now"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            notePhotoCaution(cloud.account?.uid)
            props.onSetDeskPictures('photos')
            setConfirming(null)
          }}
        />
        <ConfirmModal
          open={confirming === 'remove-photos'}
          title="Remove All Photos?"
          message={`Every photo in "${activeClass.name}" goes to the bin in your Google Drive. Each student's character stays.`}
          confirmLabel="Yes, Remove All"
          cancelLabel="No"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            props.onRemovePhotos(activeClass.students.filter((s) => s.photo).map((s) => s.id))
            setConfirming(null)
          }}
        />
        <AddPhotosModal
          request={photoRequest}
          activeClass={activeClass}
          onClose={() => setPhotoRequest(null)}
          onSaved={props.onPhotosSaved}
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
          open={confirming === 'restart-quest'}
          title="Start a new jar?"
          message={`"${activeClass.name}" starts again with an empty jar and no spins waiting. The stars on the meter stay.`}
          confirmLabel="Yes, Start Over"
          cancelLabel="No"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            props.onRestartQuest()
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
          open={confirming === 'goal' || confirming === 'quest' || confirming === 'none'}
          title="Clear the students' stars?"
          message={`Switching to ${confirming === 'goal' ? 'a class goal' : confirming === 'quest' ? 'the Marble Jar' : 'no points'} clears the stars on every desk in "${activeClass.name}". This can't be undone.`}
          confirmLabel="Yes, Switch"
          cancelLabel="No"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            if (confirming === 'goal' || confirming === 'quest' || confirming === 'none') props.onSetPointsMode(confirming)
            setConfirming(null)
          }}
        />
      </DialogContent>
    </DialogPrimitive.Root>
  )
}

function SectionLink({ section, current, onClick }: { section: (typeof NAV)[number]; current: boolean; onClick: () => void }) {
  const Icon = section.icon
  return (
    <>
      {section.gapBefore && <div className="cs-nav-gap" />}
      <button
        type="button"
        className="cs-nav-item"
        data-section-link={section.id}
        aria-current={current ? 'page' : undefined}
        onClick={onClick}
      >
        <span className="cs-ic" style={{ background: section.color }}>
          <Icon size={18} />
        </span>
        {section.label}
      </button>
    </>
  )
}

/** Records' two pages, Attendance and Participation, as a switch at its top. */
function RecordsSwitch({ section, onSection }: { section: SettingsSection; onSection: (to: SettingsSection) => void }) {
  return (
    <div className="cs-seg cs-records" role="group" aria-label="Records">
      {(['attendance', 'participation'] as const).map((page) => (
        <button key={page} type="button" aria-pressed={section === page} onClick={() => onSection(page)}>
          {page === 'attendance' ? 'Attendance' : 'Participation'}
        </button>
      ))}
    </div>
  )
}
