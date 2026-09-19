import { STICKER_THEMES, type StickerTheme } from './stickerLibrary'
import { assetUrl } from './assets'
import type { Student } from '../types'

export { STICKER_THEMES, type StickerTheme }

/** An avatar is identified as "theme/pose", e.g. "frog/happy". */
export function stickerId(theme: string, pose: string): string {
  return `${theme}/${pose}`
}

const THEMES_BY_ID = new Map(STICKER_THEMES.map((t) => [t.id, t]))

export function getTheme(id: string | undefined): StickerTheme | undefined {
  return id ? THEMES_BY_ID.get(id) : undefined
}

function parse(avatarId: string | undefined): { theme: StickerTheme; pose: string } | undefined {
  if (!avatarId) return undefined
  const [themeId, pose] = avatarId.split('/')
  const theme = THEMES_BY_ID.get(themeId)
  if (!theme || !pose || !theme.poses.includes(pose)) return undefined
  return { theme, pose }
}

/**
 * A student with no avatar chosen still gets a consistent character of their own,
 * picked from their id - so a freshly imported class looks varied straight away
 * instead of thirty identical frogs.
 */
function fallbackTheme(studentId: string): StickerTheme {
  let hash = 0
  for (let i = 0; i < studentId.length; i++) hash = (hash * 31 + studentId.charCodeAt(i)) >>> 0
  return STICKER_THEMES[hash % STICKER_THEMES.length]
}

export function stickerSrc(theme: string, pose: string): string {
  return assetUrl(`/avatars/stickers/${theme}/${pose}.svg`)
}

/** The image to show for a student right now. */
export function resolveAvatarSrc(student: Pick<Student, 'id' | 'avatarId'>): string {
  const picked = parse(student.avatarId)
  if (picked) return stickerSrc(picked.theme.id, picked.pose)
  const theme = fallbackTheme(student.id)
  return stickerSrc(theme.id, theme.idle)
}

/**
 * Poses that would be odd as a student's everyday face on the chart. Only the packs
 * with descriptive filenames can be filtered this way - the rest are numbered, so
 * nothing matches and the whole set stays in play.
 */
const NEGATIVE_POSES = new Set([
  'angry',
  'broken-heart',
  'confused',
  'disbelief',
  'evil',
  'injury',
  'puzzled',
  'sad',
  'shock',
  'shocked',
  'sick',
  'stress',
  'tired',
  'yawn',
])

/** Poses fit to hand out in bulk: nothing glum, and not the sleeping pose reserved for absences. */
export function friendlyPoses(theme: StickerTheme): string[] {
  const kept = theme.poses.filter((pose) => {
    if (pose === theme.absent) return false
    // import-stickers.py suffixes repeated names ("happy-021"), so test the base word.
    return !NEGATIVE_POSES.has(pose.replace(/-\d{3}$/, ''))
  })
  // A pack whose every pose looked negative would otherwise leave nothing to assign.
  return kept.length > 0 ? kept : theme.poses
}

/** A random friendly pose, steering away from `avoid` so re-rolling visibly changes something. */
export function randomPose(theme: StickerTheme, avoid?: string): string {
  const poses = friendlyPoses(theme)
  const choices = avoid && poses.length > 1 ? poses.filter((p) => p !== avoid) : poses
  return choices[Math.floor(Math.random() * choices.length)]
}
