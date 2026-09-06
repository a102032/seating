import type { Gender, Student } from '../types'

export interface LibraryAvatar {
  id: string
  gender: 'boy' | 'girl'
  label: string
  src: string
  isDefault: boolean
  isHoliday: boolean
}

// Base name -> friendly label overrides for filenames that don't title-case cleanly.
const LABEL_OVERRIDES: Record<string, string> = {
  '': 'Classic Uniform',
  at_desk: 'At Desk',
  pe_uniform: 'PE Uniform',
  kpop_demon_hunters: 'K-Pop Demon Hunters',
  bowser_from_mario: 'Bowser',
  toad_from_mario: 'Toad',
  monkey_king_goddess: 'Monkey King',
  sanrio_cinnamoroll: 'Cinnamoroll',
  sanrio_kuromi: 'Kuromi',
  sanrio_my_melody: 'My Melody',
  taekwando: 'Taekwondo',
  harry_potter_gryffindor: 'Harry Potter (Gryffindor)',
  harry_potter_hufflepuff: 'Harry Potter (Hufflepuff)',
  harry_potter_ravenclaw: 'Harry Potter (Ravenclaw)',
  harry_potter_slytherin: 'Harry Potter (Slytherin)',
  // Holidays: strip the trailing month, use a clean seasonal name.
  christmas_december: 'Christmas',
  dragonboat_festival_june: 'Dragon Boat Festival',
  easter_april: 'Easter',
  halloween_october: 'Halloween',
  lunar_new_year_january: 'Lunar New Year',
  midautumn_festival_september: 'Mid-Autumn Festival',
  thanksgiving_november: 'Thanksgiving',
  valentines_day_february: "Valentine's Day",
}

const HOLIDAY_BASE_NAMES = new Set([
  'christmas_december',
  'dragonboat_festival_june',
  'easter_april',
  'halloween_october',
  'lunar_new_year_january',
  'midautumn_festival_september',
  'thanksgiving_november',
  'valentines_day_february',
])

// The 71 files currently in public/avatars/library/, named `yuteh_<gender>[_<base>].jpeg`.
const LIBRARY_FILES = [
  'yuteh_boy.jpeg',
  'yuteh_boy_at_desk.jpeg',
  'yuteh_boy_baseball.jpeg',
  'yuteh_boy_batman.jpeg',
  'yuteh_boy_bowser_from_mario.jpeg',
  'yuteh_boy_bubble_tea.jpeg',
  'yuteh_boy_capybara.jpeg',
  'yuteh_boy_christmas_december.jpeg',
  'yuteh_boy_doraemon.jpeg',
  'yuteh_boy_dragonboat_festival_june.jpeg',
  'yuteh_boy_easter_april.jpeg',
  'yuteh_boy_gamer.jpeg',
  'yuteh_boy_graduation.jpeg',
  'yuteh_boy_gundam.jpeg',
  'yuteh_boy_halloween_october.jpeg',
  'yuteh_boy_harry_potter_gryffindor.jpeg',
  'yuteh_boy_harry_potter_hufflepuff.jpeg',
  'yuteh_boy_harry_potter_ravenclaw.jpeg',
  'yuteh_boy_harry_potter_slytherin.jpeg',
  'yuteh_boy_knight.jpeg',
  'yuteh_boy_kpop_demon_hunters.jpeg',
  'yuteh_boy_lego.jpeg',
  'yuteh_boy_lunar_new_year_january.jpeg',
  'yuteh_boy_mario.jpeg',
  'yuteh_boy_midautumn_festival_september.jpeg',
  'yuteh_boy_minecraft.jpeg',
  'yuteh_boy_monkey_king.jpeg',
  'yuteh_boy_ninja.jpeg',
  'yuteh_boy_pe_uniform.jpeg',
  'yuteh_boy_pikachu.jpeg',
  'yuteh_boy_shark.jpeg',
  'yuteh_boy_taekwando.jpeg',
  'yuteh_boy_thanksgiving_november.jpeg',
  'yuteh_boy_ultraman.jpeg',
  'yuteh_boy_valentines_day_february.jpeg',
  'yuteh_girl.jpeg',
  'yuteh_girl_at_desk.jpeg',
  'yuteh_girl_bubble_tea.jpeg',
  'yuteh_girl_capybara.jpeg',
  'yuteh_girl_christmas_december.jpeg',
  'yuteh_girl_doraemon.jpeg',
  'yuteh_girl_dragonboat_festival_june.jpeg',
  'yuteh_girl_easter_april.jpeg',
  'yuteh_girl_gamer.jpeg',
  'yuteh_girl_graduation.jpeg',
  'yuteh_girl_gundam.jpeg',
  'yuteh_girl_halloween_october.jpeg',
  'yuteh_girl_harry_potter_gryffindor.jpeg',
  'yuteh_girl_harry_potter_hufflepuff.jpeg',
  'yuteh_girl_harry_potter_ravenclaw.jpeg',
  'yuteh_girl_harry_potter_slytherin.jpeg',
  'yuteh_girl_kpop_demon_hunters.jpeg',
  'yuteh_girl_lego.jpeg',
  'yuteh_girl_lunar_new_year_january.jpeg',
  'yuteh_girl_midautumn_festival_september.jpeg',
  'yuteh_girl_minecraft.jpeg',
  'yuteh_girl_monkey_king_goddess.jpeg',
  'yuteh_girl_ninja.jpeg',
  'yuteh_girl_pe_uniform.jpeg',
  'yuteh_girl_pikachu.jpeg',
  'yuteh_girl_princess.jpeg',
  'yuteh_girl_princess_peach.jpeg',
  'yuteh_girl_sanrio_cinnamoroll.jpeg',
  'yuteh_girl_sanrio_kuromi.jpeg',
  'yuteh_girl_sanrio_my_melody.jpeg',
  'yuteh_girl_shark.jpeg',
  'yuteh_girl_taekwando.jpeg',
  'yuteh_girl_thanksgiving_november.jpeg',
  'yuteh_girl_toad_from_mario.jpeg',
  'yuteh_girl_valentines_day_february.jpeg',
  'yuteh_girl_volleyball.jpeg',
]

// The self-contained demo artifact embeds a compressed copy of the library and injects this
// global to redirect asset URLs to inline data URIs - a no-op in the real deployed app.
declare global {
  interface Window {
    __DEMO_AVATAR_OVERRIDES__?: Record<string, string>
  }
}

function libraryAssetUrl(file: string): string {
  const override = typeof window !== 'undefined' ? window.__DEMO_AVATAR_OVERRIDES__?.[file] : undefined
  return override ?? `/avatars/library/${file}`
}

function titleCase(slug: string): string {
  return slug
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function parseFile(file: string): LibraryAvatar {
  const withoutExt = file.replace(/\.jpeg$/, '')
  const gender: 'boy' | 'girl' = withoutExt.startsWith('yuteh_boy') ? 'boy' : 'girl'
  const prefix = gender === 'boy' ? 'yuteh_boy' : 'yuteh_girl'
  const base = withoutExt.slice(prefix.length).replace(/^_/, '')
  const label = LABEL_OVERRIDES[base] ?? titleCase(base)
  return {
    id: `${gender}-${base || 'default'}`,
    gender,
    label,
    src: libraryAssetUrl(file),
    isDefault: base === '',
    isHoliday: HOLIDAY_BASE_NAMES.has(base),
  }
}

export const AVATAR_LIBRARY: LibraryAvatar[] = LIBRARY_FILES.map(parseFile)

const AVATAR_BY_ID = new Map(AVATAR_LIBRARY.map((a) => [a.id, a]))

export function getLibraryAvatar(id: string | undefined): LibraryAvatar | undefined {
  return id ? AVATAR_BY_ID.get(id) : undefined
}

const DEFAULT_AVATAR_SRC: Partial<Record<Gender, string>> = {
  boy: '/avatars/boy.png',
  girl: '/avatars/girl.png',
}

/** The avatar image to actually show for a student: their picked library avatar if set, else the plain gender default. */
export function resolveAvatarSrc(student: Pick<Student, 'gender' | 'avatarId'>): string | undefined {
  const picked = getLibraryAvatar(student.avatarId)
  if (picked) return picked.src
  return DEFAULT_AVATAR_SRC[student.gender]
}
