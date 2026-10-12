import type { PrizeSize, QuestPrize } from '../types'
import type { Slice } from './quest'

/**
 * The Quest's chests, key and wheels, drawn in code as SVG text: sharp on a 4K board, a few KB,
 * and in parts that move. Built from the teacher's Treasure Quest Preview (a Claude artifact,
 * `chestSVG`, `keySVG`, `wheelSVG`), changed where the agreed plan differs: the wheel's slices
 * are plain for a small prize, silver for a medium one and gold for a big one, and the Mega
 * wheel is all gold. Strings rather than JSX because the same pictures go into the board, the
 * floating window and Our Quest, and the preview's drawing code ports as it is.
 */

interface Tier {
  body: string
  bodyDark: string
  lid: string
  lidLight: string
  inside: string
  band: string
  bandLight: string
  plate: string
  plateDark: string
  hole: string
  rim: string
  rimDark: string
  peg: string
  gems?: boolean
}

const TIERS: Tier[] = [
  {
    body: '#a8693f',
    bodyDark: '#7a4526',
    lid: '#b9794a',
    lidLight: '#dba67a',
    inside: '#4a2412',
    band: '#6b7280',
    bandLight: '#b6bcc6',
    plate: '#e8b647',
    plateDark: '#a97812',
    hole: '#3b2412',
    rim: '#9a6238',
    rimDark: '#6e3f20',
    peg: '#f1d19a',
  },
  {
    body: '#8f4a1f',
    bodyDark: '#5f2d10',
    lid: '#a05a2a',
    lidLight: '#d58c50',
    inside: '#3d1a08',
    band: '#cd7f32',
    bandLight: '#f0b27a',
    plate: '#e9a76a',
    plateDark: '#9c5a22',
    hole: '#3d1a08',
    rim: '#b8692c',
    rimDark: '#7a3f14',
    peg: '#f6c493',
  },
  {
    body: '#6f7d8c',
    bodyDark: '#4b5664',
    lid: '#8593a2',
    lidLight: '#c3ccd6',
    inside: '#2b3340',
    band: '#dbe2ea',
    bandLight: '#ffffff',
    plate: '#eef2f6',
    plateDark: '#8a97a6',
    hole: '#2b3340',
    rim: '#aab6c3',
    rimDark: '#6b7785',
    peg: '#ffffff',
  },
  {
    body: '#d4961c',
    bodyDark: '#9c6608',
    lid: '#e6ab2c',
    lidLight: '#ffe18a',
    inside: '#5c3a04',
    band: '#ffe07a',
    bandLight: '#fff7cf',
    plate: '#fff3b0',
    plateDark: '#c4880f',
    hole: '#5c3a04',
    rim: '#f2b632',
    rimDark: '#a8700a',
    peg: '#fff7cf',
  },
  {
    body: '#6d28d9',
    bodyDark: '#4c1d95',
    lid: '#7c3aed',
    lidLight: '#b79bff',
    inside: '#24104f',
    band: '#fbbf24',
    bandLight: '#fde68a',
    plate: '#fde68a',
    plateDark: '#d97706',
    hole: '#3b1a6e',
    rim: '#7c3aed',
    rimDark: '#4c1d95',
    peg: '#fde68a',
    gems: true,
  },
]

/** Ids inside each picture must be unique on the page, or one chest's gradient paints another's. */
let uid = 0
const LID = 'M12 54 V38 Q12 20 30 20 H90 Q108 20 108 38 V54 Z'

/** A gold key, on its side with its bow on the left. */
export function keySVG(): string {
  return `<svg viewBox="0 0 48 24" aria-hidden="true"><rect x="33" y="12" width="4.5" height="7" rx="1" fill="#fbbf24" stroke="#b45309" stroke-width="1.6"/><rect x="39.5" y="12" width="4.5" height="9" rx="1" fill="#fbbf24" stroke="#b45309" stroke-width="1.6"/><rect x="17" y="9.3" width="28" height="5.4" rx="2" fill="#fbbf24" stroke="#b45309" stroke-width="1.6"/><circle cx="11" cy="12" r="7.6" fill="none" stroke="#b45309" stroke-width="6.2"/><circle cx="11" cy="12" r="7.6" fill="none" stroke="#fbbf24" stroke-width="3.4"/><circle cx="8.4" cy="8.6" r="1.3" fill="#fff7cf"/></svg>`
}

/** What fills an open chest: a heap of coins that grows with the rank, then a gem, pearls, a goblet, a crown. */
const PEAK = [41, 35, 29, 22, 13]
function treasure(t: number, id: string) {
  const peak = PEAK[t]
  const hill = (x: number) => peak + (54 - peak) * Math.pow((x - 60) / 46, 2)
  let mound = 'M14 56'
  for (let x = 14; x <= 106; x += 4) mound += ` L${x} ${hill(x).toFixed(1)}`
  mound += ' L106 56 Z'
  const coin = (x: number, y: number, deep: boolean) =>
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${deep ? '#f59e0b' : '#fbbf24'}" stroke="#c2410c" stroke-opacity=".5" stroke-width="1.2"/>` +
    (deep
      ? ''
      : `<path d="M${(x - 2.6).toFixed(1)} ${(y - 1.2).toFixed(1)} a3 3 0 0 1 3.2 -2.3" stroke="#fff7cf" stroke-width="1.2" fill="none" stroke-linecap="round"/>`)
  const edgeCoin = (x: number, y: number) =>
    `<ellipse cx="${x}" cy="${y.toFixed(1)}" rx="2.3" ry="5.4" fill="#fbbf24" stroke="#c2410c" stroke-opacity=".5" stroke-width="1.1"/>`
  const gem = (x: number, y: number, c: string, k = 1) =>
    `<g transform="translate(${x} ${y.toFixed(1)}) scale(${k})"><path d="M0 -5.5 L5.5 -1.5 L3.4 4.5 L-3.4 4.5 L-5.5 -1.5 Z" fill="${c}" stroke="#fff" stroke-opacity=".7" stroke-width="1"/><path d="M-2.4 -2 L0 -4 L1.4 -2.6" stroke="#fff" stroke-width="1.1" fill="none" opacity=".85"/></g>`
  const sparkle = (x: number, y: number, k = 1) =>
    `<path transform="translate(${x} ${y}) scale(${k})" d="M0 -5 Q0.8 -0.8 5 0 Q0.8 0.8 0 5 Q-0.8 0.8 -5 0 Q-0.8 -0.8 0 -5 Z" fill="#fffbe6"/>`
  let behind = `<path d="${mound}" fill="url(#${id}m)"/>`
  const rows = [1, 2, 2, 3, 3][t]
  for (let r = rows - 1; r >= 0; r--) {
    for (let x = 19 + (r % 2) * 4.5; x <= 101; x += 9) {
      const y = hill(x) + 1.5 + r * 6.5
      if (y < 52) behind += coin(x, y, r > 0)
    }
  }
  if (t >= 1) behind += edgeCoin(44, hill(44) - 2) + edgeCoin(78, hill(78) - 2)
  const gems: [number, string][][] = [
    [],
    [[70, '#ef4444']],
    [
      [46, '#3b82f6'],
      [74, '#ef4444'],
    ],
    [
      [36, '#22c55e'],
      [56, '#3b82f6'],
      [92, '#ef4444'],
    ],
    [
      [28, '#a855f7'],
      [42, '#22c55e'],
      [78, '#3b82f6'],
      [92, '#ef4444'],
    ],
  ]
  behind += gems[t].map(([x, c]) => gem(x, hill(x) - 1.5, c, t === 4 ? 1.15 : 1)).join('')
  if (t >= 3) {
    // A goblet standing in the heap.
    const gx = t === 4 ? 66 : 76
    const gy = hill(gx) + 2
    behind += `<g transform="translate(${gx} ${gy.toFixed(1)})"><path d="M-6 -15 H6 Q6 -7 0 -6 Q-6 -7 -6 -15 Z" fill="#fbbf24" stroke="#b45309" stroke-width="1.2"/><rect x="-1" y="-6.5" width="2" height="5" fill="#f59e0b"/><rect x="-4" y="-2" width="8" height="2.4" rx="1" fill="#fbbf24" stroke="#b45309" stroke-width="1"/><circle cx="0" cy="-11" r="1.8" fill="#ef4444"/></g>`
  }
  if (t === 4) {
    // The crown on top of the Mega heap.
    const y0 = peak + 3
    behind += `<g><path d="M47 ${y0} L46 ${y0 - 9} L53 ${y0 - 4.5} L60 ${y0 - 13} L67 ${y0 - 4.5} L74 ${y0 - 9} L73 ${y0} Z" fill="#fbbf24" stroke="#b45309" stroke-width="1.3" stroke-linejoin="round"/><rect x="47" y="${y0 - 3}" width="26" height="4" rx="1" fill="#f59e0b" stroke="#b45309" stroke-width="1"/>${(
      [
        [52, '#ef4444'],
        [60, '#3b82f6'],
        [68, '#22c55e'],
      ] as [number, string][]
    )
      .map(([x, c]) => `<circle cx="${x}" cy="${y0 - 1}" r="1.6" fill="${c}"/>`)
      .join('')}${[
      [46, y0 - 9],
      [60, y0 - 13],
      [74, y0 - 9],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.7" fill="#fde68a" stroke="#b45309" stroke-width=".8"/>`)
      .join('')}</g>`
  }
  let front = ''
  if (t >= 2) {
    // A string of pearls hung over the front edge, longer as the chests get richer.
    const [a, b, dip] = t === 2 ? [32, 52, 60] : t === 3 ? [28, 56, 64] : [24, 62, 70]
    for (let i = 0; i <= 12; i++) {
      const u = i / 12
      const x = a + (b - a) * u
      const y = (1 - u) * (1 - u) * 51 + 2 * u * (1 - u) * (dip + 6) + u * u * 51
      front += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.9" fill="#fff" stroke="#cbd5e1" stroke-width=".7"/>`
    }
  }
  if (t === 4) {
    // Overflowing: coins over the rim, down the front and onto the floor.
    front += coin(17, 52, false) + coin(103, 51, false) + coin(108, 58, false) + coin(12, 62, true)
    front += [
      [3, 97],
      [11, 99.5],
      [19, 100],
      [104, 100],
      [112, 98.5],
      [118, 96],
    ]
      .map(([x, y]) => coin(x, y, false))
      .join('')
    front += gem(1, 94, '#ef4444', 0.9) + gem(115, 92, '#22c55e', 0.9)
  }
  const sparkles = [
    [],
    [[30, 40]],
    [
      [26, 38],
      [96, 36],
    ],
    [
      [24, 30],
      [98, 28],
      [86, 16],
    ],
    [
      [20, 22],
      [100, 20],
      [86, 6],
      [34, 8],
      [112, 44],
      [6, 48],
    ],
  ][t]
  front += sparkles.map(([x, y], i) => sparkle(x, y, i % 2 ? 0.8 : 1.1)).join('')
  return { behind, front }
}

/**
 * A chest, 0 Wood to 4 Mega, in the flat style of the app's own. Its lock plate has a keyhole for
 * each key it needs; `keys` of them are filled gold. An open chest has no lid: the treasure is
 * the picture (the teacher, 2026-10-07).
 */
export function chestSVG(t: number, { open = false, keys = 0 }: { open?: boolean; keys?: number } = {}): string {
  const T = TIERS[t]
  const id = `qc${uid++}`
  const need = t + 1
  const pw = 12 + need * 10
  const px = 60 - pw / 2
  let holes = ''
  for (let i = 0; i < need; i++) {
    const cx = px + 11 + i * 10
    const cy = 67
    holes +=
      i < keys
        ? `<circle cx="${cx}" cy="${cy}" r="4.4" fill="#fbbf24" stroke="#b45309" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="1.5" fill="${T.plate}"/>`
        : `<circle cx="${cx}" cy="${cy - 1.4}" r="2.5" fill="${T.hole}"/><path d="M${cx - 1.4} ${cy - 0.6} h2.8 l0.9 5.2 h-4.6 z" fill="${T.hole}"/>`
  }
  const bands = (clip: string) =>
    `<g clip-path="url(#${clip})">${[19, 93].map((x) => `<rect x="${x}" y="0" width="8" height="100" fill="${T.band}"/><rect x="${x + 1}" y="0" width="2" height="100" fill="${T.bandLight}" opacity=".7"/>`).join('')}</g>`
  const rivets = [19, 93]
    .map((x) => [62, 90].map((y) => `<circle cx="${x + 4}" cy="${y}" r="1.7" fill="${T.bandLight}"/>`).join(''))
    .join('')
  const plate = `<rect x="${px}" y="57" width="${pw}" height="20" rx="4" fill="${T.plate}" stroke="${T.plateDark}" stroke-width="1.6"/>${holes}`
  const defs = `<defs>
    <clipPath id="${id}b"><path d="${LID}"/><rect x="12" y="50" width="96" height="47" rx="6"/></clipPath>
    <clipPath id="${id}o"><rect x="12" y="50" width="96" height="47" rx="6"/></clipPath>
    <radialGradient id="${id}g"><stop offset="0" stop-color="#fff6c4" stop-opacity=".95"/><stop offset=".55" stop-color="#ffd54a" stop-opacity=".45"/><stop offset="1" stop-color="#ffd54a" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset="1" stop-color="#f59e0b"/></linearGradient>
  </defs>`
  const shadow = `<ellipse cx="60" cy="99" rx="48" ry="4.5" fill="rgba(0,0,0,.2)"/>`
  const box = `<rect x="12" y="50" width="96" height="47" rx="6" fill="${T.body}"/><path d="M12 84 H108 V91 Q108 97 102 97 H18 Q12 97 12 91 Z" fill="${T.bodyDark}"/>`
  if (open) {
    const tr = treasure(t, id)
    return `<svg viewBox="0 0 120 104" aria-hidden="true">${defs}
      <circle cx="60" cy="${44 - t * 3}" r="${50 + t * 7}" fill="url(#${id}g)"/>
      ${shadow}
      <path d="M12 56 V51 Q12 46 17 46 H103 Q108 46 108 51 V56 Z" fill="${T.inside}"/>
      ${tr.behind}
      ${box}${bands(`${id}o`)}${rivets}
      <rect x="11" y="48.5" width="98" height="5.5" rx="2.5" fill="${T.lid}"/>
      ${[19, 93].map((x) => `<rect x="${x}" y="48.5" width="8" height="5.5" fill="${T.band}"/>`).join('')}
      ${plate}
      ${tr.front}
    </svg>`
  }
  const gems = T.gems
    ? (
        [
          [38, 33, '#ef4444'],
          [60, 29, '#38bdf8'],
          [82, 33, '#22c55e'],
        ] as [number, number, string][]
      )
        .map(
          ([x, y, c]) =>
            `<path d="M${x} ${y - 6} L${x + 6} ${y} L${x} ${y + 6} L${x - 6} ${y} Z" fill="${c}" stroke="#fde68a" stroke-width="1.6"/><path d="M${x - 2} ${y - 2} L${x} ${y - 4} L${x + 1} ${y - 3}" stroke="#fff" stroke-width="1.2" fill="none" opacity=".8"/>`,
        )
        .join('')
    : ''
  return `<svg viewBox="0 0 120 104" aria-hidden="true">${defs}
    ${shadow}
    <path d="${LID}" fill="${T.lid}"/>
    <path d="M20 30 Q24 25 33 25 H87 Q96 25 100 30" stroke="${T.lidLight}" stroke-width="3" fill="none" opacity=".55" stroke-linecap="round"/>
    ${gems}
    ${box}${bands(`${id}b`)}${rivets}
    ${plate}
    <rect x="12" y="50" width="96" height="5" fill="${T.bodyDark}"/>
    ${[19, 93].map((x) => `<rect x="${x}" y="50" width="8" height="5" fill="${T.band}"/>`).join('')}
  </svg>`
}

/** Lucide's pictures for the prizes (the app's icon set), as path text for the wheel. */
const ICONS: Record<string, string> = {
  palette:
    '<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>',
  'book-open':
    '<path d="M12 5v16"/><path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"/>',
  dices:
    '<rect width="12" height="12" x="2" y="10" rx="2" ry="2"/><path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6"/><path d="M6 18h.01"/><path d="M10 14h.01"/><path d="M15 6h.01"/><path d="M18 9h.01"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  clapperboard:
    '<path d="m12.296 3.464 3.02 3.956"/><path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="m6.18 5.276 3.1 3.899"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  gift: '<path d="M12 7v14"/><path d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"/><path d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5"/><rect x="3" y="7" width="18" height="4" rx="1"/>',
  'party-popper':
    '<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/>',
  library: '<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>',
  'package-open':
    '<path d="M12 22v-9"/><path d="M15.17 2.21a1.67 1.67 0 0 1 1.63 0L21 4.57a1.93 1.93 0 0 1 0 3.36L8.82 14.79a1.655 1.655 0 0 1-1.64 0L3 12.43a1.93 1.93 0 0 1 0-3.36z"/><path d="M20 13v3.87a2.06 2.06 0 0 1-1.11 1.83l-6 3.08a1.93 1.93 0 0 1-1.78 0l-6-3.08A2.06 2.06 0 0 1 4 16.87V13"/><path d="M21 12.43a1.93 1.93 0 0 0 0-3.36L8.83 2.2a1.64 1.64 0 0 0-1.63 0L3 4.57a1.93 1.93 0 0 0 0 3.36l12.18 6.86a1.636 1.636 0 0 0 1.63 0z"/>',
  trophy:
    '<path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2"/><path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2"/><path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"/>',
  candy:
    '<path d="M10 7v10.9"/><path d="M14 6.1V17"/><path d="M16 7V3a1 1 0 0 1 1.707-.707 2.5 2.5 0 0 0 2.152.717 1 1 0 0 1 1.131 1.131 2.5 2.5 0 0 0 .717 2.152A1 1 0 0 1 21 8h-4"/><path d="M16.536 7.465a5 5 0 0 0-7.072 0l-2 2a5 5 0 0 0 0 7.07 5 5 0 0 0 7.072 0l2-2a5 5 0 0 0 0-7.07"/><path d="M8 17v4a1 1 0 0 1-1.707.707 2.5 2.5 0 0 0-2.152-.717 1 1 0 0 1-1.131-1.131 2.5 2.5 0 0 0-.717-2.152A1 1 0 0 1 3 16h4"/>',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
}

/** A picture for a prize from its name, so a teacher who types a prize never has to choose one. */
export function prizeIcon(name: string): string {
  const n = name.toLowerCase()
  const table: [RegExp, string][] = [
    [/video|movie|film|cartoon/, 'clapperboard'],
    [/draw|colou?r|art|paint|origami|craft/, 'palette'],
    [/read|book|story/, 'book-open'],
    [/library/, 'library'],
    [/music|song|dance|sing/, 'music'],
    [/friend|partner|sit/, 'users'],
    [/party|toy/, 'party-popper'],
    [/candy|sweet|snack|treat/, 'candy'],
    [/box|treasure|chest/, 'package-open'],
    [/pick|choose|vote/, 'trophy'],
    [/game|play/, 'dices'],
  ]
  return (table.find(([re]) => re.test(n)) ?? [null, 'gift'])[1]
}

/** A prize's picture on its own, for the prize card and Our Quest's chips. */
export function prizeIconSVG(name: string, size = 24): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[prizeIcon(name)]}</svg>`
}

function pt(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [r * Math.sin(a), -r * Math.cos(a)]
}

/** The colours of a small prize's plain slices, bright like the preview's. */
const PLAIN = ['#38bdf8', '#a3e635', '#f472b6', '#a78bfa', '#2dd4bf', '#fb7185']

export const SLICE_INK: Record<PrizeSize, string> = { s: '#5b3fa0', m: '#475569', b: '#b45309' }

/** A slice's face once it has turned over: the prize's picture in a white circle. */
export function prizeFaceSVG(prize: QuestPrize, size: PrizeSize, i: number): string {
  const [tx, ty] = pt(57, i * 45)
  return `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) rotate(${i * 45})"><circle r="21" fill="#fff" opacity=".95"/><g transform="translate(-13 -13) scale(1.08)" fill="none" stroke="${SLICE_INK[size]}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[prizeIcon(prize.name)]}</g></g>`
}

/**
 * A chest's wheel: question marks on every slice while it spins, so the class roots for gold
 * without knowing which prize is where. Plain slices for small prizes, silver for medium and
 * gold, with a star, for big. Once it has `landed`, only that slice turns over, and the rest fade.
 */
export function wheelSVG(t: number, slices: Slice[], landed: number | null = null): string {
  const T = TIERS[t]
  const id = `qw${uid++}`
  const mega = t === 4
  let plainAt = 0
  const paths = slices
    .map((sl, i) => {
      const [x0, y0] = pt(92, i * 45 - 22.5)
      const [x1, y1] = pt(92, i * 45 + 22.5)
      const fill = sl.size === 'b' ? `url(#${id}gold)` : sl.size === 'm' ? `url(#${id}silver)` : PLAIN[plainAt++ % PLAIN.length]
      const [tx, ty] = pt(58, i * 45)
      const ink = sl.size === 'b' ? '#7c2d12' : sl.size === 'm' ? '#334155' : '#fff'
      const face =
        i === landed
          ? `<g class="quest-face-in">${prizeFaceSVG(sl.prize, sl.size, i)}</g>`
          : `<text x="0" y="0" transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) rotate(${i * 45})" text-anchor="middle" dominant-baseline="central" font-family="Andika, sans-serif" font-weight="700" font-size="34" fill="${ink}" stroke="${sl.size === 's' ? 'rgba(0,0,0,.18)' : 'none'}" stroke-width="1">?</text>`
      const [sx, sy] = pt(81, i * 45)
      const star =
        sl.size === 'b'
          ? `<path transform="translate(${sx.toFixed(2)} ${sy.toFixed(2)}) rotate(${i * 45}) scale(.42)" d="M0 -12 L3.5 -3.7 L12 -3.7 L5 1.6 L7.6 10.4 L0 5 L-7.6 10.4 L-5 1.6 L-12 -3.7 L-3.5 -3.7 Z" fill="#fff7cf"/>`
          : ''
      const dim = landed !== null && i !== landed ? ' opacity=".32"' : ''
      return `<g data-slice="${i}"${dim}><path d="M0 0 L${x0.toFixed(2)} ${y0.toFixed(2)} A92 92 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z" fill="${fill}" stroke="rgba(255,255,255,.75)" stroke-width="1.5"/>${star}<g data-face="${i}">${face}</g></g>`
    })
    .join('')
  const pegs = Array.from({ length: 16 }, (_, i) => {
    const [x, y] = pt(99, i * 22.5 + 11.25)
    return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3" fill="${T.peg}" stroke="${T.rimDark}" stroke-width="1"/>`
  }).join('')
  const gems = mega
    ? Array.from({ length: 8 }, (_, i) => {
        const [x, y] = pt(99, i * 45)
        const c = ['#ef4444', '#38bdf8', '#22c55e', '#fbbf24'][i % 4]
        return `<path transform="translate(${x.toFixed(2)} ${y.toFixed(2)})" d="M0 -6 L6 0 L0 6 L-6 0 Z" fill="${c}" stroke="#fde68a" stroke-width="1.5"/>`
      }).join('')
    : ''
  return `<svg viewBox="-112 -112 224 224" aria-hidden="true"><defs>
      <linearGradient id="${id}gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset=".5" stop-color="#fbbf24"/><stop offset="1" stop-color="#e08a0b"/></linearGradient>
      <linearGradient id="${id}silver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8fafc"/><stop offset=".5" stop-color="#cbd5e1"/><stop offset="1" stop-color="#94a3b8"/></linearGradient>
      <linearGradient id="${id}rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.peg}"/><stop offset=".25" stop-color="${T.rim}"/><stop offset="1" stop-color="${T.rimDark}"/></linearGradient>
    </defs>
    <circle r="108" fill="url(#${id}rim)"/>
    <circle r="94" fill="${T.rimDark}"/>
    ${paths}
    ${pegs}${gems}
    <circle r="17" fill="url(#${id}rim)" stroke="${T.rimDark}" stroke-width="2"/>
    <circle r="7" fill="${mega ? '#fbbf24' : T.peg}"/>
  </svg>`
}

/** The red pointer at the wheel's top, which flicks back as each peg goes past. */
export function pointerSVG(): string {
  return `<svg viewBox="0 0 40 50" aria-hidden="true"><path d="M20 48 L4 14 Q2 2 20 2 Q38 2 36 14 Z" fill="#ef4444" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><circle cx="20" cy="15" r="5" fill="#fff"/></svg>`
}
