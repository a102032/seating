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
