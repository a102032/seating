/**
 * A fixed, hand-picked list - deliberately not a GIPHY search box. A search field in a
 * classroom app makes the teacher responsible for whatever it returns in front of thirty
 * children; a curated set has no such surface.
 *
 * These are hotlinked from GIPHY's own CDN rather than copied into the repo: several are
 * studio-owned, and using the platform's delivery is the licensed path.
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
]

/** Full size, for the celebration itself. */
export function gifUrl(id: string): string {
  return `https://i.giphy.com/media/${id}/giphy.gif`
}

/** Small and animated, for the picker - a grid of full-size gifs would be tens of megabytes. */
export function gifThumbUrl(id: string): string {
  return `https://i.giphy.com/media/${id}/200w.gif`
}
