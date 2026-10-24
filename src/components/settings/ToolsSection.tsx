import { RotateCcw } from 'lucide-react'
import type { FlipDeckSettings } from '../../hooks/useFlipDeck'
import { GET_READY_PRIZES } from '../../lib/getReady'
import type { PointsMode } from '../../types'
import { PickStudentIcon } from '../PickerIcons'
import { DrumIcon, FlipIcon, GroupIcon } from '../RailIcons'
import { Btn, SwitchRow } from './parts'

export interface PickerSettingsValue {
  allowRepeats: boolean
  soundEnabled: boolean
}

interface ToolsSectionProps {
  pointsMode: PointsMode
  pickers: PickerSettingsValue
  onUpdatePickers: (patch: Partial<PickerSettingsValue>) => void
  /** How many students have been picked this round (with Allow Repeats off, everyone gets a turn first). */
  pickedThisRound: number
  /** A row has been picked this round, so there is a round to start over even with no student picked. */
  roundStarted: boolean
  onStartNewRound: () => void
  getReadyPrize: number
  onSetGetReadyPrize: (prize: number) => void
  flip: FlipDeckSettings
  onUpdateFlip: (patch: Partial<FlipDeckSettings>) => void
  groupChimes: boolean
  onSetGroupChimes: (on: boolean) => void
}

/**
 * Every rail tool's settings in one place (2026-10-11, the teacher's menus): the pickers, Get
 * Ready!'s prize, the flip cards (whose gear opens this) and Group Activity's chimes, which were
 * each tucked into their own window before. Every switch says what is true in the state it's in.
 */
export function ToolsSection({
  pointsMode,
  pickers,
  onUpdatePickers,
  pickedThisRound,
  roundStarted,
  onStartNewRound,
  getReadyPrize,
  onSetGetReadyPrize,
  flip,
  onUpdateFlip,
  groupChimes,
  onSetGroupChimes,
}: ToolsSectionProps) {
  const gifts = pointsMode !== 'none'
  return (
    <>
      <div className="cs-page-head">
        <p>Settings for the tools in the side bar.</p>
      </div>
      <div className="cs-tools">
        <div>
          <div className="cs-group cs-tool">
            <div className="cs-tool-head">
              <PickStudentIcon className="size-[22px]" /> Picking Students Randomly
            </div>
            <SwitchRow
              guide="repeats"
              label="Repeated picks"
              on={pickers.allowRepeats}
              onText="On: anyone can be picked more than once before everyone has had a turn."
              offText="Off: everyone has a turn first."
              onChange={(on) => onUpdatePickers({ allowRepeats: on })}
            />
            <SwitchRow
              guide="picker-sound"
              label="Picker sound"
              on={pickers.soundEnabled}
              onText="On: a sound plays as names flash by during a pick."
              offText="Off: picks happen with no sound."
              onChange={(on) => onUpdatePickers({ soundEnabled: on })}
            />
            <div className="cs-row" data-guide="new-round">
              <div className="cs-row-label">
                <b>This round</b>
                <small>
                  {pickedThisRound > 0
                    ? `${pickedThisRound} ${pickedThisRound === 1 ? 'student' : 'students'} picked so far.`
                    : roundStarted
                      ? 'Rows picked so far.'
                      : 'Nobody picked yet.'}
                </small>
              </div>
              <Btn small disabled={!roundStarted} onClick={onStartNewRound}>
                <RotateCcw /> Start a New Round
              </Btn>
            </div>
          </div>
          <div className="cs-group cs-tool">
            <div className="cs-tool-head">
              <DrumIcon className="size-[22px]" /> Get ready! Countdown
            </div>
            {/* A full star is the same prize on every drum, so a faster class keeps more of it and a
                shorter drum is harder without being worth less. */}
            {pointsMode === 'none' ? (
              <div className="cs-row">
                <div className="cs-row-label">
                  <small>No prize with no points. It is still a challenge.</small>
                </div>
              </div>
            ) : (
              <div className="cs-row cs-wrap" data-guide="prize" style={{ rowGap: 2 }}>
                <div className="cs-row-label">
                  <b>Prize for a full star</b>
                </div>
                <div className="cs-chips">
                  {GET_READY_PRIZES.map((p) => (
                    <button key={p} type="button" aria-pressed={getReadyPrize === p} onClick={() => onSetGetReadyPrize(p)}>
                      {p}
                    </button>
                  ))}
                </div>
                <small className="cs-hint cs-full">
                  {pointsMode === 'students'
                    ? 'Number of total possible stars each student can get before the time runs out.'
                    : 'Number of total possible stars a class can get before the time runs out.'}
                </small>
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="cs-group cs-tool">
            <div className="cs-tool-head">
              <FlipIcon className="size-[22px]" /> Flip Cards
            </div>
            {/* With student points a surprise card's stars go to every student here, as Get Ready!'s
                do; with no points they would have nowhere to go. */}
            <SwitchRow
              guide="gifts"
              label="Fun surprise cards"
              on={flip.bonusCards && gifts}
              disabled={!gifts}
              note={gifts ? undefined : 'Needs points: the extra stars have to go somewhere.'}
              onText={`On: three surprise cards in the deck that award 2 to 5 extra stars ${pointsMode === 'goal' || pointsMode === 'quest' ? 'to the class goal' : 'to student points'}.`}
              offText="Off: no surprise cards in the deck."
              onChange={(on) => onUpdateFlip({ bonusCards: on })}
            />
            <SwitchRow
              guide="backs"
              label="Flip cards are colored by gender"
              on={flip.genderColors}
              onText="On: blue for boys, pink for girls."
              offText="Off: every card back is the same color."
              onChange={(on) => onUpdateFlip({ genderColors: on })}
            />
            <SwitchRow
              guide="card-sounds"
              label="Card sounds"
              on={flip.soundEnabled}
              onText="On: shuffling, dealing and flipping make a sound."
              offText="Off: the cards make no sound."
              onChange={(on) => onUpdateFlip({ soundEnabled: on })}
            />
          </div>
          <div className="cs-group cs-tool">
            <div className="cs-tool-head">
              <GroupIcon className="size-[22px]" /> Group Activity
            </div>
            <SwitchRow
              guide="chimes"
              label="Status chimes"
              on={groupChimes}
              onText="On: a chime when a group taps Help, Ready or Done."
              offText="Off: the group cards change color with no sound."
              onChange={onSetGroupChimes}
            />
          </div>
        </div>
      </div>
    </>
  )
}
