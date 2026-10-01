import type { ClassData, Student } from '../types'
import { dateKey } from './attendance'
import { planFor, type Gap } from './layouts'

/**
 * The seating chart as a picture: the room as it's laid out today, for a substitute or the
 * classroom door. Names and homeroom numbers, the class name and the date - and none of
 * the app's buttons. Settled with the teacher: no stars (it's not a scoreboard) and nothing to say
 * which end is the front of the room, which a teacher writes on and the app stays out of.
 *
 * Drawn on a white A4 page in landscape, so it prints edge to edge on a school printer, rather
 * than in the app's theme. Every layout comes from the class's own plan (lib/layouts), the same
 * one the board draws.
 */
const WIDTH = 2000
const HEIGHT = Math.round(WIDTH / Math.SQRT2)
const MARGIN = 70
const TITLE_HEIGHT = 120
const GAP: Record<Gap, number> = { even: 22, touch: 6, aisle: 50 }
/** Wider than this and a desk looks like a bench; the room is centred instead. */
const WIDEST_DESK = 1.45

const INK = '#2b2f3a'
const SOFT = '#7c8196'
const NAME = '#4a4468'
const LINE = '#cdc6e6'
const EMPTY_LINE = '#e1dcef'
const FACE = 'Andika, ui-sans-serif, system-ui, sans-serif'

/** The title can't run into the date, so a long class name shrinks to fit. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxWidth: number): number {
  ctx.font = `${weight} ${size}px ${FACE}`
  const width = ctx.measureText(text).width
  return width > maxWidth ? Math.floor((size * maxWidth) / width) : size
}

function deskPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Rounded top, square bottom, like the desks on the board.
  const r = Math.min(w, h) * 0.12
  ctx.beginPath()
  ctx.moveTo(x, y + h)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h)
  ctx.closePath()
}

export async function drawSeatingChart(cls: ClassData, date: Date = new Date()): Promise<HTMLCanvasElement> {
  // The names are Andika on the board; a picture drawn before the face arrives would be in
  // whatever the browser falls back to.
  await Promise.all([document.fonts.load(`700 48px Andika`), document.fonts.load(`400 32px Andika`)]).catch(() => undefined)

  const plan = planFor(cls)
  const byId = new Map(cls.students.map((s) => [s.id, s]))
  const seated: (Student | null)[] = plan.seats.map((_, i) => {
    const id = cls.seating[i]
    return (id && byId.get(id)) || null
  })

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // The class name and the date across the top.
  const when = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const baseline = MARGIN + 52
  ctx.textBaseline = 'alphabetic'
  ctx.font = `400 34px ${FACE}`
  const dateWidth = ctx.measureText(when).width
  ctx.fillStyle = SOFT
  ctx.textAlign = 'right'
  ctx.fillText(when, WIDTH - MARGIN, baseline)
  ctx.textAlign = 'left'
  const label = ' · Seating Chart'
  ctx.font = `400 34px ${FACE}`
  const labelWidth = ctx.measureText(label).width
  const titleSize = fitFont(ctx, cls.name, 700, 60, WIDTH - 2 * MARGIN - dateWidth - labelWidth - 40)
  ctx.font = `700 ${titleSize}px ${FACE}`
  ctx.fillStyle = INK
  ctx.fillText(cls.name, MARGIN, baseline)
  const titleWidth = ctx.measureText(cls.name).width
  ctx.font = `400 34px ${FACE}`
  ctx.fillStyle = SOFT
  ctx.fillText(label, MARGIN + titleWidth, baseline)

  // The room, in the same columns, rows, pairs, aisles and tables as the board.
  const top = MARGIN + TITLE_HEIGHT
  const areaW = WIDTH - 2 * MARGIN
  const areaH = HEIGHT - top - MARGIN
  const gapsX = plan.columnGaps.map((g) => GAP[g])
  const gapsY = plan.rowGaps.map((g) => GAP[g])
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
  const deskH = (areaH - sum(gapsY)) / plan.rows
  const deskW = Math.min((areaW - sum(gapsX)) / plan.columns, deskH * WIDEST_DESK)
  const roomW = deskW * plan.columns + sum(gapsX)
  const left = MARGIN + (areaW - roomW) / 2
  const xs: number[] = []
  for (let c = 0, x = left; c < plan.columns; c++) {
    xs.push(x)
    x += deskW + (gapsX[c] ?? 0)
  }
  const ys: number[] = []
  for (let r = 0, y = top; r < plan.rows; r++) {
    ys.push(y)
    y += deskH + (gapsY[r] ?? 0)
  }
  // A table of five's end desk sits halfway across its table: column 0.5 is midway between two.
  const xOf = (column: number) => {
    const whole = Math.floor(column)
    const part = column - whole
    return part === 0 ? xs[whole] : xs[whole] + (xs[whole + 1] - xs[whole]) * part
  }

  // One name size for the whole class, set by the widest name, as on the board.
  const pad = deskW * 0.06
  const maxName = deskH * 0.19
  ctx.font = `700 100px ${FACE}`
  const widest = Math.max(1, ...seated.map((s) => (s ? ctx.measureText(s.name).width : 0)))
  const nameSize = Math.min(maxName, ((deskW - 2 * pad) * 100) / widest)
  const homeroomSize = Math.min(deskH * 0.11, 30)

  plan.seats.forEach((seat, i) => {
    const x = xOf(seat.column)
    const y = ys[seat.row]
    const student = seated[i]
    deskPath(ctx, x, y, deskW, deskH)
    if (!student) {
      // Empty desks stay as outlines, so the room keeps its shape on paper.
      ctx.setLineDash([12, 10])
      ctx.strokeStyle = EMPTY_LINE
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.setLineDash([])
      return
    }
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = LINE
    ctx.lineWidth = 3
    ctx.stroke()

    if (student.homeroom) {
      ctx.font = `700 ${homeroomSize}px ${FACE}`
      ctx.fillStyle = SOFT
      ctx.textAlign = 'left'
      ctx.fillText(student.homeroom, x + pad * 0.8, y + homeroomSize * 1.15)
    }

    ctx.font = `700 ${nameSize}px ${FACE}`
    ctx.fillStyle = NAME
    ctx.textAlign = 'center'
    ctx.fillText(student.name, x + deskW / 2, y + deskH / 2 + nameSize * 0.35, deskW - 2 * pad)
  })
  ctx.textAlign = 'left'
  return canvas
}

export function pictureBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No picture'))), 'image/png'))
}

/** "Grade 4 English – Seating Chart – 2026-10-01.png", without the characters a file name can't hold. */
export function pictureName(cls: ClassData, date: Date = new Date()): string {
  return `${cls.name} – Seating Chart – ${dateKey(date)}.png`.replace(/[\\/:*?"<>|]/g, '')
}

/**
 * Saved to this computer, the way a browser saves any download. Plain hyphens in the file's name:
 * some browsers drop a name with a dash like "–" in it and save the file as "download".
 */
export function downloadPicture(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name.replace(/[–—]/g, '-')
  document.body.appendChild(a)
  a.click()
  a.remove()
  // The download has its own copy by now; the address is only needed for the click.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
