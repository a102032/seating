import type { ClassData, PointsMode } from '../types'

/**
 * How the class runs points (2026-10-11, the teacher): a class goal the whole class fills
 * together, each student's own stars on their desk, or no points at all. A class saved before
 * the choice is read from the old Class Goal switch: on is the goal; off gave stars that went
 * nowhere the class could see, which is no points in all but name.
 */
export function pointsModeOf(c: ClassData): PointsMode {
  if (c.pointsMode) return c.pointsMode
  return (c.pointsGoal ?? 0) > 0 && c.goalEnabled !== false ? 'goal' : 'none'
}

/** The class goal is on, with a number to fill: the meter is on the board and stars can go into it. */
export function goalIsLive(c: ClassData): boolean {
  return pointsModeOf(c) === 'goal' && (c.pointsGoal ?? 0) > 0
}

/**
 * Stars stay on the desks, where the class can see them and − can take one back: a student's own,
 * with student points; or this lesson's, waiting for All Stars In!, in a class goal whose stars go
 * on the desks first.
 */
export function starsWaitOnDesks(c: ClassData): boolean {
  return pointsModeOf(c) === 'students' || (c.starsOnDesks === true && goalIsLive(c))
}
