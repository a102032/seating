import { PictureInPicture2 } from 'lucide-react'
import { useState, type ComponentType, type ReactNode } from 'react'
import { GET_READY_PRIZES } from '../../lib/getReady'
import type { FlipDeckSettings } from '../../hooks/useFlipDeck'
import type { PointsMode } from '../../types'
import { AllIcon, PickRowIcon, PickStudentIcon, PickTableIcon } from '../PickerIcons'
import { AttendanceIcon, DrumIcon, FlipIcon, GroupIcon, HourglassIcon, PointIcon, QueueIcon, SwapIcon } from '../RailIcons'
import { Btn, Group, SubHead, SwitchRow } from './parts'

/** The tools whose own choices live on the tool itself: Go There closes Class Settings and opens it. */
export type ToolPlace = 'timer' | 'attendance' | 'group' | 'line'

interface ToolsSectionProps {
  pointsMode: PointsMode
  /** Float is on the rail only with a goal, where the browser can float a window. */
  showFloat: boolean
  /** Rows, or tables in a room of tables: what Pick a Random Row picks. */
  setName: 'row' | 'table'
  getReadyPrize: number
  onSetGetReadyPrize: (prize: number) => void
  flip: FlipDeckSettings
  onUpdateFlip: (patch: Partial<FlipDeckSettings>) => void
  onGoTo: (place: ToolPlace) => void
}

interface Tool {
  key: string
  name: string
  icon: ComponentType<{ className?: string }>
  what: string
  /** Its settings, on a page of their own behind Settings. */
  settings?: { intro: string; body: ReactNode }
  goTo?: ToolPlace
}

/**
 * Every button on the side rail, top to bottom, and what it does (2026-10-26, the teacher: the rail
 * has no words, and Class Settings is where a new teacher looks). The two tools with settings that
 * can't live on the tool itself, Get Ready!'s prize and the flip cards', open them with Settings;
 * the ones whose choices are on the tool go there. Only this list scrolls.
 */
export function ToolsSection({
  pointsMode,
  showFloat,
  setName,
  getReadyPrize,
  onSetGetReadyPrize,
  flip,
  onUpdateFlip,
  onGoTo,
}: ToolsSectionProps) {
  const [open, setOpen] = useState<string | null>(null)
  const points = pointsMode !== 'none'
  const goal = pointsMode === 'goal' || pointsMode === 'quest'
  const set = setName === 'table' ? 'Table' : 'Row'

  // A full star is the same prize on every drum, so a faster class keeps more of it and a shorter
  // drum is harder without being worth less.
  const prizeBody = points ? (
    <div className="cs-row cs-wrap" data-guide="prize" style={{ rowGap: 4 }}>
      <div className="cs-row-label">
        <b>Number of points for a full star</b>
        <small>
          {pointsMode === 'students'
            ? 'The most stars each student can win before time runs out.'
            : 'The most stars the class can win before time runs out.'}
        </small>
      </div>
      <div className="cs-chips">
        {GET_READY_PRIZES.map((p) => (
          <button key={p} type="button" aria-pressed={getReadyPrize === p} onClick={() => onSetGetReadyPrize(p)}>
            {p}
          </button>
        ))}
      </div>
    </div>
  ) : (
    <div className="cs-row">
      <div className="cs-row-label">
        <small>No prize with no points. It is still a challenge.</small>
      </div>
    </div>
  )

  // With student points a surprise card's stars go to every student here, as Get Ready!'s do; with
  // no points they would have nowhere to go.
  const flipBody = (
    <>
      <SwitchRow
        guide="gifts"
        label="Surprise cards"
        on={flip.bonusCards && points}
        disabled={!points}
        note={points ? undefined : 'Needs points: the extra stars have to go somewhere.'}
        onText={`On: three Mystery Gifts in the deck, 2 to 5 stars each, ${goal ? 'to the class goal' : 'to every student'}.`}
        offText="Off: no surprise cards in the deck."
        onChange={(on) => onUpdateFlip({ bonusCards: on })}
      />
      <SwitchRow
        guide="backs"
        label="Card colors by Boy or Girl"
        on={flip.genderColors}
        onText="On: blue for boys, pink for girls."
        offText="Off: every card back the same color."
        onChange={(on) => onUpdateFlip({ genderColors: on })}
      />
    </>
  )

  const tools: Tool[] = [
    ...(showFloat
      ? [
          {
            key: 'float',
            name: 'Float',
            icon: PictureInPicture2,
            what: 'Shrinks the class goal into a small window that stays on top of your lesson, with +1, Pick and Get Ready!.',
          },
        ]
      : []),
    {
      key: 'get-ready',
      name: 'Get Ready!',
      icon: DrumIcon,
      what: 'A short countdown for getting ready, with a big star that shrinks to each drum beat.',
      settings: {
        intro:
          pointsMode === 'none'
            ? 'A short countdown for getting ready. A big star shrinks with each drum beat. Tap Ready! when the class is ready. There is no prize; it is a challenge.'
            : `A short countdown for getting ready. A big star shrinks with each drum beat. Tap Ready! when the class is ready, and the stars that remain go to ${goal ? 'the class goal' : 'every student'}.`,
        body: prizeBody,
      },
    },
    {
      key: 'timer',
      name: 'Timer',
      icon: HourglassIcon,
      what: 'A big timer over the board. Put it away and it keeps counting at the top.',
      goTo: 'timer',
    },
    {
      key: 'attendance',
      name: 'Attendance',
      icon: AttendanceIcon,
      what: 'Tap the desks of students who are away. Every picker skips them for the day.',
      goTo: 'attendance',
    },
    { key: 'swap', name: 'Swap Seats', icon: SwapIcon, what: 'Tap two desks to swap the students.' },
    {
      key: 'pick-student',
      name: 'Pick a Random Student',
      icon: PickStudentIcon,
      what: 'Picks one student. Everyone has a turn before anyone has a second.',
    },
    {
      key: 'pick-row',
      name: `Pick a Random ${set}`,
      icon: setName === 'table' ? PickTableIcon : PickRowIcon,
      what: `Picks one ${set.toLowerCase()}. With desks tapped, it picks their whole ${set.toLowerCase()}s.`,
    },
    ...(points
      ? [
          {
            key: 'pick-all',
            name: 'Pick All',
            icon: AllIcon,
            what: 'Picks every student here, to give them all a star. Tap again to unpick.',
          },
        ]
      : []),
    {
      key: 'flip',
      name: 'Flip Cards',
      icon: FlipIcon,
      what: 'Every student is a face-down card. A student taps a card to see whose turn it is.',
      settings: {
        intro: 'Every student is a face-down card. A student taps a card to see whose turn it is, until everyone has had a turn.',
        body: flipBody,
      },
    },
    {
      key: 'group',
      name: 'Group Activity',
      icon: GroupIcon,
      what: 'Puts the class into groups, from where they sit or chosen by you.',
      goTo: 'group',
    },
    {
      key: 'line',
      name: 'The Line',
      icon: QueueIcon,
      what: 'Students tap their desk to get in line to have their work checked.',
      goTo: 'line',
    },
    ...(points
      ? [
          {
            key: 'star',
            name: 'Star',
            icon: PointIcon,
            what: goal
              ? 'Gives a star to every student you tapped. It flies into the class goal.'
              : 'Gives a star to every student you tapped.',
          },
        ]
      : []),
  ]

  const shown = tools.find((t) => t.key === open && t.settings)
  if (shown?.settings) {
    return (
      <>
        <SubHead back="Tools" title={shown.name} onBack={() => setOpen(null)} />
        <Group intro={shown.settings.intro}>{shown.settings.body}</Group>
      </>
    )
  }

  return (
    <>
      <div className="cs-gi">Every button on the side rail, top to bottom, and what it does.</div>
      <div className="cs-list" data-guide="tools-list">
        {tools.map((t) => (
          <div key={t.key} className="cs-row cs-tool-row" data-tool={t.key}>
            <span className="cs-tool-ic">
              <t.icon />
            </span>
            <span className="cs-row-label">
              <b>{t.name}</b>
              <small>{t.what}</small>
            </span>
            {t.settings ? (
              <Btn small className="cs-tool-btn" data-guide={`${t.key}-settings`} onClick={() => setOpen(t.key)}>
                Settings
              </Btn>
            ) : t.goTo ? (
              <Btn small className="cs-tool-btn" onClick={() => onGoTo(t.goTo!)}>
                Go There
              </Btn>
            ) : null}
          </div>
        ))}
      </div>
    </>
  )
}
