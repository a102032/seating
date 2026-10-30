import { HOMEROOM_TAG_SCALE } from '../lib/fitText'

/** A student as Pick a Spinner shows them: the name, and the homeroom number where two share it. */
export type SpinnerPick = { name: string; homeroom: string }

/** The name, with the homeroom number small and quiet after it, as on the desks (lib/sameNames). */
export function SpinnerName({ who, spin }: { who: SpinnerPick; spin?: boolean }) {
  return (
    <>
      {who.name}
      {who.homeroom && (
        <span data-spinner-homeroom="" className="ml-[0.25em] font-semibold opacity-60" style={{ fontSize: `${HOMEROOM_TAG_SCALE}em` }}>
          {who.homeroom}
        </span>
      )}
      {spin && ', spin!'}
    </>
  )
}
