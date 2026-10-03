import { Save, Star, Target } from 'lucide-react'
import { summarizeGroupPoints } from '../lib/groups'
import type { StudentGroup } from '../types'
import { Modal } from './Modal'
import { TactileButton } from './TactileButton'
import { useLingerWhileClosing } from '../hooks/useLingerWhileClosing'

interface GroupExitModalProps {
  open: boolean
  onClose: () => void
  groups: StudentGroup[]
  onGiveOut: () => void
  onKeep: () => void
}

/**
 * Leaving with points on the board. Two honest answers and a way back; the default is the
 * one a teacher means at the end of an activity, and "keep" is for the teacher who is only
 * stepping out to the seating chart mid-lesson.
 */
export function GroupExitModal({ open, onClose, groups, onGiveOut, onKeep }: GroupExitModalProps) {
  const { totalPoints } = summarizeGroupPoints(groups)
  const scoring = groups.filter((g) => g.points > 0)

  // Nothing to build while closed - see useLingerWhileClosing.
  const shown = useLingerWhileClosing(open)
  if (!shown) return null

  return (
    <Modal open={open} onClose={onClose} title="Points Are on the Board">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {scoring.map((g, i) => (
            <span key={g.id} className="whitespace-nowrap">
              {i > 0 && <span className="mx-1.5 opacity-50">·</span>}
              <span className="font-bold" style={{ color: g.color }}>
                {g.name}
              </span>
              <Star size={12} className="mx-0.5 inline-block fill-amber-500 align-[-1px] text-amber-500" strokeWidth={0} />
              <span className="font-bold text-foreground">{g.points}</span>
            </span>
          ))}
          <br />
          {totalPoints} point{totalPoints === 1 ? '' : 's'} in all. What should happen to them?
        </p>

        <button
          type="button"
          onClick={onGiveOut}
          data-slot="button"
          className="flex items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-left text-primary-foreground shadow-sm transition-transform active:scale-[0.99]"
        >
          <Target size={22} className="shrink-0" />
          <span>
            <span className="block font-bold">Give Out the Points</span>
            <span className="block text-sm opacity-85">They go onto the class goal, one class point each.</span>
          </span>
        </button>

        <button
          type="button"
          onClick={onKeep}
          data-slot="button"
          className="flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3 text-left text-secondary-foreground shadow-sm transition-colors hover:bg-accent active:scale-[0.99]"
        >
          <Save size={22} className="shrink-0" />
          <span>
            <span className="block font-bold">Keep Them for Next Time</span>
            <span className="block text-sm opacity-80">
              The groups and their scores are saved. Continue with Last Groups picks up right here.
            </span>
          </span>
        </button>

        <TactileButton onClick={onClose} className="justify-center">
          Cancel
        </TactileButton>
      </div>
    </Modal>
  )
}
