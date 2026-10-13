import type { ClassData } from '../types'

/**
 * A fixed, hand-picked list - deliberately not a GIPHY search box. A search field in a
 * classroom app makes the teacher responsible for whatever it returns in front of thirty
 * children; a curated set has no such surface.
 *
 * These are hotlinked from GIPHY's own CDN rather than copied into the repo, as several are
 * studio-owned. That is not a licence, though: GIPHY's terms don't allow commercial use without
 * permission, and nothing from GIPHY grants rights to the characters. Before the app goes out
 * widely this list gives way to the teacher's own G-rated search through GIPHY's official
 * service (DECISIONS, "Celebration GIFs").
 */
export interface CelebrationGif {
  id: string
  label: string
}

export const CELEBRATION_GIFS: CelebrationGif[] = [
  { id: 'HhiNLbR6vJTNCisfsX', label: 'Applause' },
  { id: 'YvhQMhj1Ovli66CFtD', label: 'Well Done' },
  { id: 'nROQ9rIABgzboTHS8c', label: 'Champion' },
  { id: 'XBlwFU4OJ0cgZVbNUl', label: 'High Five' },
  { id: 'Ov09jGgEThFKpxZ9eC', label: 'Grover' },
  { id: 'vmon3eAOp1WfK', label: 'Celebration' },
  { id: 'l0MYt5jPR6QX5pnqM', label: 'Party Hard' },
  { id: '1PMVNNKVIL8Ig', label: 'So Excited' },
  { id: 'iJgoGwkqb1mmH1mES3', label: 'Mighty Mops' },
  { id: 'Jp4dchTKX6BzGkZ5DL', label: 'Secret Agent' },
  { id: 'ktU8kAKsyIauRSOoZs', label: 'Cookie Monster' },
  { id: 'W6Lwg2xvTr6tJpuSTd', label: 'Minions' },
  { id: 'nDSlfqf0gn5g4', label: 'SpongeBob' },
  { id: 'cOvgh3VjLmeg8LLBtk', label: 'Donald Duck' },
  { id: 'l4q7VhGsL6BnXJrc4', label: 'Lego' },
  { id: 'BqMe4wpFLkQLWyXqwf', label: 'Woohoo' },
  { id: '8UGGp7rQvfhe63HrFq', label: 'Pokemon' },
  { id: 't3sZxY5zS5B0z5zMIz', label: 'Hockey Fan' },
  { id: 'T0pqYd3qK2XHQTXirw', label: 'Snoopy' },
]

/** Full size, for the celebration itself. */
export function gifUrl(id: string): string {
  return `https://i.giphy.com/media/${id}/giphy.gif`
}

/** Small and animated, for the picker - a grid of full-size gifs would be tens of megabytes. */
export function gifThumbUrl(id: string): string {
  return `https://i.giphy.com/media/${id}/200w.gif`
}

/** The class's favourites; a class from before the Quest has its one GIF as its only favourite. */
export function celebrationGifsOf(c: ClassData): string[] {
  const ids = c.celebrationGifIds ?? (c.celebrationGifId ? [c.celebrationGifId] : [])
  return ids.filter((id) => CELEBRATION_GIFS.some((g) => g.id === id))
}

/** The GIF for this chest: one of the favourites, never the one the last chest played (unless it is the only one). */
export function nextCelebrationGif(c: ClassData): string | null {
  const ids = celebrationGifsOf(c)
  if (ids.length === 0) return null
  const fresh = ids.length > 1 ? ids.filter((id) => id !== c.celebrationGifLast) : ids
  return fresh[Math.floor(Math.random() * fresh.length)]
}
