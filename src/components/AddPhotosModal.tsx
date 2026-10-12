import clsx from 'clsx'
import { ArrowLeft, Check, CircleAlert, LoaderCircle, Minus, Plus, RotateCcw, Save, X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useLingerWhileClosing } from '../hooks/useLingerWhileClosing'
import { driveProblem, uploadPhoto, withDrive } from '../lib/drive'
import { clampCrop, exifTakenAt, framePhoto, openPhoto, renderCrop, type Crop } from '../lib/photoCrop'
import { keepPhoto } from '../lib/photos'
import { homeroomsToShow } from '../lib/sameNames'
import type { ClassData, Student } from '../types'
import { ConfirmModal } from './ConfirmModal'
import { Btn } from './settings/parts'

/** Photos the teacher chose, and the one student they are for when chosen from that student's picture. */
export interface PhotoRequest {
  files: File[]
  only?: Student
}

interface AddPhotosModalProps {
  request: PhotoRequest | null
  activeClass: ClassData
  onClose: () => void
  /** Saved to Drive: each student's new photo, by the file's id. Called as each one lands. */
  onSaved: (photos: Record<string, string>) => void
}

interface Item {
  key: string
  file: File
  state: 'waiting' | 'ready' | 'failed'
  /** The square that will be saved, and a picture of it to show. */
  jpeg?: Blob
  url?: string
  crop?: Crop
  /** The opened picture's size, which the crop is measured in. */
  W?: number
  H?: number
  /** A face was found; when not, the crop is a guess and the photo says Check. */
  found?: boolean
  studentId?: string
  /** Matched by its file's name ("Kevin.jpg"), so it was never asked about. */
  byFileName?: boolean
  /** Left out by the teacher (blurry, the wrong child, a second try). */
  left?: boolean
  saved?: boolean
}

/** The board reads one touch as two: a name tapped twice must not name the next photo too. */
const NAME_GUARD_MS = 500
const ZOOM = 0.85

const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9㐀-鿿]+/)
    .filter(Boolean)

/**
 * The student a photo's file is named after ("Kevin.jpg", "05 Amy Lin.jpg"), as a school's own ID
 * photos often are; only a sure match counts. Two students sharing a name are told apart by the
 * homeroom number in the file's name; otherwise the teacher is asked.
 */
function matchFileName(fileName: string, students: Student[]): string | undefined {
  const inFile = words(fileName.replace(/\.[^.]+$/, ''))
  const hits = students.filter((s) => {
    const name = words(s.name)
    return name.length > 0 && name.every((w) => inFile.includes(w))
  })
  if (hits.length === 0) return undefined
  // "Amy Chen.jpg" is Amy Chen, not Amy.
  const most = Math.max(...hits.map((s) => words(s.name).length))
  const best = hits.filter((s) => words(s.name).length === most)
  if (best.length === 1) return best[0].id
  const byRoom = best.filter((s) => s.homeroom.trim() && inFile.includes(s.homeroom.trim().toLowerCase()))
  return byRoom.length === 1 ? byRoom[0].id : undefined
}

/**
 * Whose photo is next, a guess the teacher confirms with one tap: the next student in the class
 * list after the last photo's, who hasn't been given one in this pile - so a class photographed in
 * the list's order is one tap a photo. A skipped child just means tapping the right name, and the
 * guesses carry on from there. Students with no photo yet come first, for a pile of new students.
 */
function suggestion(students: Student[], items: Item[], index: number): string | undefined {
  const own = items[index]?.studentId
  if (own) return own
  const named = new Set(items.map((i) => (i.left ? undefined : i.studentId)).filter(Boolean))
  const free = students.filter((s) => !named.has(s.id))
  const pool = free.some((s) => !s.photo) ? free.filter((s) => !s.photo) : free
  if (pool.length === 0) return undefined
  const before = items
    .slice(0, index)
    .reverse()
    .find((i) => i.studentId && !i.left)?.studentId
  const start = before ? students.findIndex((s) => s.id === before) + 1 : 0
  const inPool = new Set(pool.map((s) => s.id))
  return [...students.slice(start), ...students.slice(0, start)].find((s) => inPool.has(s.id))?.id
}

const needsName = (i: Item) => !i.studentId && !i.left && i.state !== 'failed'

/**
 * Add Photos (2026-10-12): a pile of photos becomes the class's photos in a few minutes. Each photo
 * is opened on this computer, its face found and framed (lib/photoCrop), then "Who is this?" with
 * the class's names and the next one already lit, then one screen of every face to check - a tap
 * on any to move or zoom its circle - and Save puts the small squares in the teacher's own Drive.
 * Nothing is saved until Save, and the photos themselves never leave the computer.
 *
 * For one student, from their own picture in Students, it is the same without the names: the
 * photo, its circle to check, and Save.
 */
export function AddPhotosModal({ request, activeClass, onClose, onSaved }: AddPhotosModalProps) {
  const open = request !== null
  const only = request?.only
  const students = activeClass.students
  const [items, setItems] = useState<Item[]>([])
  const [stage, setStage] = useState<'naming' | 'check' | 'saving' | 'done'>('naming')
  const [at, setAt] = useState(0)
  /**
   * Naming one photo out of turn: from the check screen (then straight back to it), or gone Back
   * to while naming (then on with the photos still to name).
   */
  const [renaming, setRenaming] = useState<'check' | 'back' | null>(null)
  const [fixing, setFixing] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const lastTap = useRef(0)
  const urls = useRef<string[]>([])

  const update = (key: string, patch: Partial<Item>) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  const show = (blob: Blob) => {
    const url = URL.createObjectURL(blob)
    urls.current.push(url)
    return url
  }

  // A new pile: put in the order the photos were taken, matched by file name where that is sure,
  // then opened and framed one at a time, so the naming can start as soon as the first is ready.
  const [shownRequest, setShownRequest] = useState(request)
  if (shownRequest !== request) {
    setShownRequest(request)
    setItems([])
    setStage(request?.only ? 'check' : 'naming')
    setAt(0)
    setRenaming(null)
    setFixing(null)
    setProblem(null)
    setLeaving(false)
  }
  useEffect(() => {
    if (!request) return
    let stopped = false
    void (async () => {
      const dated = await Promise.all(request.files.map(async (file) => ({ file, at: await exifTakenAt(file).catch(() => null) })))
      // By when they were taken, if every photo says; otherwise by name, which on a phone is the same.
      const byDate = dated.every((d) => d.at !== null)
      dated.sort((a, b) => (byDate ? a.at! - b.at! : a.file.name.localeCompare(b.file.name, undefined, { numeric: true })))
      const claimed = new Set<string>()
      const first: Item[] = (request.only ? dated.slice(0, 1) : dated).map(({ file }, i) => {
        if (request.only) return { key: String(i), file, state: 'waiting', studentId: request.only.id }
        const match = matchFileName(file.name, students)
        if (match && !claimed.has(match)) {
          claimed.add(match)
          return { key: String(i), file, state: 'waiting', studentId: match, byFileName: true }
        }
        return { key: String(i), file, state: 'waiting' }
      })
      if (stopped) return
      setItems(first)
      if (request.only) setFixing('0')
      for (const item of first) {
        if (stopped) return
        try {
          const photo = await openPhoto(item.file)
          try {
            const framed = await framePhoto(photo.bitmap)
            const jpeg = await renderCrop(photo.bitmap, framed.crop)
            if (stopped) return
            update(item.key, {
              state: 'ready',
              jpeg,
              url: show(jpeg),
              crop: framed.crop,
              W: photo.bitmap.width,
              H: photo.bitmap.height,
              found: framed.found,
            })
          } finally {
            photo.bitmap.close()
          }
        } catch {
          if (!stopped) update(item.key, { state: 'failed' })
        }
      }
    })()
    return () => {
      stopped = true
    }
    // The class list is read once, as the pile arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request])
  useEffect(
    () => () => {
      urls.current.forEach((u) => URL.revokeObjectURL(u))
      urls.current = []
    },
    [request],
  )

  const sameName = useMemo(() => homeroomsToShow(students), [students])
  const nameOf = (id: string | undefined) => {
    const s = students.find((x) => x.id === id)
    return s ? `${s.name}${sameName.has(s.id) ? ` ${s.homeroom}` : ''}` : undefined
  }

  // Naming: the photo at `at`, or the next one after it still without a name.
  const index = renaming ? at : items.findIndex((i, n) => n >= at && needsName(i))
  const allOpened = items.length > 0 && items.every((i) => i.state !== 'waiting')
  useEffect(() => {
    if (stage === 'naming' && !renaming && index === -1 && (allOpened || items.length > 0)) {
      // Nothing left to name: every photo named, or the rest are named by their files.
      if (allOpened || !items.some(needsName)) setStage('check')
    }
  }, [stage, renaming, index, allOpened, items])

  const shown = useLingerWhileClosing(open)
  if (!shown) return null

  const toSave = items.filter((i) => i.state === 'ready' && i.studentId && !i.left && !i.saved)
  const unsaved = items.some((i) => i.studentId && !i.left && !i.saved)

  /** A second touch straight after the first is the board's, not the teacher's. */
  function guard(): boolean {
    const now = performance.now()
    if (now - lastTap.current < NAME_GUARD_MS) return false
    lastTap.current = now
    return true
  }

  function name(studentId: string) {
    if (!guard()) return
    const item = items[index]
    if (!item) return
    // A name already given to another photo in the pile moves to this one.
    setItems((prev) =>
      prev.map((i) =>
        i.key === item.key ? { ...i, studentId, left: false } : i.studentId === studentId ? { ...i, studentId: undefined } : i,
      ),
    )
    moveOn()
  }

  /** On to the next photo still to name, or back to the check screen it was opened from. */
  function moveOn() {
    if (renaming === 'check') setStage('check')
    else setAt(index + 1)
    setRenaming(null)
  }

  function back() {
    if (!guard()) return
    const before = items.slice(0, index === -1 ? items.length : index).findLastIndex((i) => i.state === 'ready')
    if (before === -1) return
    setAt(before)
    setRenaming('back')
  }

  async function save() {
    setProblem(null)
    setStage('saving')
    try {
      await withDrive(async (token) => {
        for (const item of toSave) {
          const student = students.find((s) => s.id === item.studentId)
          if (!student || !item.jpeg) continue
          const id = await uploadPhoto(token, activeClass, student, item.jpeg)
          await keepPhoto(id, item.jpeg)
          update(item.key, { saved: true })
          onSaved({ [student.id]: id })
        }
      })
      if (only) onClose()
      else setStage('done')
    } catch (error) {
      setProblem(driveProblem(error) ?? null)
      setStage('check')
    }
  }

  function close() {
    if (stage === 'saving') return
    if (unsaved && stage !== 'done') setLeaving(true)
    else onClose()
  }

  const fixItem = items.find((i) => i.key === fixing)
  const saved = items.filter((i) => i.saved).length
  const title = only ? `A Photo of ${only.name}` : 'Add Photos'

  let body
  if (stage === 'done') {
    body = (
      <div className="cs-empty">
        <span className="ph-done">
          <Check strokeWidth={3} />
        </span>
        <span className="cs-big">
          {saved} {saved === 1 ? 'photo' : 'photos'} saved to your Google Drive.
        </span>
        <span className="cs-hint">They are on the desks while the class shows photos.</span>
        <Btn kind="primary" onClick={onClose}>
          <Check /> Done
        </Btn>
      </div>
    )
  } else if (stage === 'saving') {
    body = (
      <div className="cs-empty">
        <LoaderCircle className="animate-spin" size={40} />
        <span className="cs-big">
          Saving to your Google Drive… {Math.min(saved + 1, toSave.length + saved)} of {toSave.length + saved}
        </span>
      </div>
    )
  } else if (fixItem) {
    body = (
      <FixPhoto
        key={fixItem.key}
        item={fixItem}
        name={nameOf(fixItem.studentId)}
        only={only !== undefined}
        problem={problem}
        onChange={(patch) => {
          if (patch.jpeg) patch.url = show(patch.jpeg)
          update(fixItem.key, patch)
        }}
        onRename={() => {
          setFixing(null)
          setAt(items.indexOf(fixItem))
          setRenaming('check')
          setStage('naming')
        }}
        onDone={() => setFixing(null)}
        onSave={() => void save()}
        onCancel={onClose}
      />
    )
  } else if (stage === 'naming') {
    const item = items[index]
    const suggested = item ? suggestion(students, items, index) : undefined
    const named = new Set(items.filter((i) => !i.left && i.key !== item?.key).map((i) => i.studentId))
    const toName = items.filter((i) => !i.byFileName && i.state !== 'failed').length
    const position = item ? items.filter((i, n) => n <= index && !i.byFileName && i.state !== 'failed').length : 0
    body = (
      <div className="ph-naming">
        <div className="ph-photo">
          <div className="ph-step">
            <b>Who is this?</b>
            {item && (
              <span>
                Photo {position} of {toName}
              </span>
            )}
          </div>
          {!item || item.state === 'waiting' ? (
            <div className="ph-circle ph-wait">
              <LoaderCircle className="animate-spin" size={40} />
              <span>{items.some((i) => i.state === 'ready') ? 'Finding the face…' : 'Getting ready…'}</span>
            </div>
          ) : (
            <img src={item.url} alt="" className="ph-circle" draggable={false} />
          )}
          {suggested && item?.state === 'ready' && (
            <Btn kind="primary" className="ph-yes" onClick={() => name(suggested)}>
              <Check /> {nameOf(suggested)}
            </Btn>
          )}
          <div className="ph-row">
            <Btn
              small
              kind="quiet"
              disabled={items.slice(0, index === -1 ? items.length : index).every((i) => i.state !== 'ready')}
              onClick={back}
            >
              <ArrowLeft /> Back
            </Btn>
            <Btn
              small
              kind="quiet"
              disabled={item?.state !== 'ready'}
              onClick={() => {
                if (!item || !guard()) return
                update(item.key, { left: true, studentId: undefined })
                moveOn()
              }}
            >
              <X /> Leave it out
            </Btn>
            {items.some((i) => i.state === 'ready') && (
              <Btn small kind="quiet" onClick={() => (setRenaming(null), setStage('check'))}>
                See all
              </Btn>
            )}
          </div>
        </div>
        <div className="ph-names" role="group" aria-label="Students">
          {students.map((s) => (
            <button
              key={s.id}
              type="button"
              className="ph-name"
              data-suggested={s.id === suggested || undefined}
              data-used={named.has(s.id) || undefined}
              disabled={item?.state !== 'ready'}
              onClick={() => name(s.id)}
            >
              <span className="truncate">{nameOf(s.id)}</span>
              {named.has(s.id) && <Check size={16} strokeWidth={3} className="ml-auto shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    )
  } else {
    const shownItems = [...items.filter((i) => !i.left && i.state !== 'failed'), ...items.filter((i) => i.left || i.state === 'failed')]
    const nameless = items.filter(needsName).length
    body = (
      <>
        <div className="cs-page-head">
          <p>Tap a photo to move or zoom its circle, or to change who it is.</p>
        </div>
        <div className="ph-grid">
          {shownItems.map((i) => (
            <button
              key={i.key}
              type="button"
              className={clsx('ph-tile', (i.left || i.state === 'failed') && 'ph-out')}
              disabled={i.state !== 'ready'}
              onClick={() => setFixing(i.key)}
            >
              {i.state === 'ready' ? (
                <img src={i.url} alt="" draggable={false} />
              ) : i.state === 'waiting' ? (
                <span className="ph-tile-wait">
                  <LoaderCircle className="animate-spin" />
                </span>
              ) : (
                <span className="ph-tile-wait">
                  <CircleAlert />
                </span>
              )}
              {i.state === 'ready' && !i.found && !i.left && <span className="ph-badge">Check</span>}
              {i.saved && (
                <span className="ph-saved">
                  <Check strokeWidth={3} />
                </span>
              )}
              <span className={clsx('w-full truncate', needsName(i) && 'ph-who')}>
                {i.state === 'failed'
                  ? "Can't open"
                  : i.left
                    ? 'Left out'
                    : i.state === 'waiting'
                      ? '…'
                      : (nameOf(i.studentId) ?? 'Who is this?')}
              </span>
            </button>
          ))}
        </div>
        <div className="cs-foot">
          {problem ? (
            <span className="cs-note text-destructive">
              <CircleAlert size={16} /> {problem}
            </span>
          ) : (
            nameless > 0 && (
              <span className="cs-hint">
                {nameless} {nameless === 1 ? 'photo has' : 'photos have'} no name and won&rsquo;t be saved.
              </span>
            )
          )}
          <div className="cs-right">
            {nameless > 0 && (
              <Btn
                onClick={() => {
                  setAt(0)
                  setRenaming(null)
                  setStage('naming')
                }}
              >
                Name them
              </Btn>
            )}
            <Btn kind="primary" disabled={toSave.length === 0 || !allOpened} onClick={() => void save()}>
              <Save /> Save {toSave.length} {toSave.length === 1 ? 'Photo' : 'Photos'}
            </Btn>
          </div>
        </div>
      </>
    )
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="h-[min(calc(100dvh-2rem),52rem)] max-h-[calc(100dvh-2rem)] w-[min(64rem,calc(100vw-2rem))] max-w-none grid-rows-[auto_minmax(0,1fr)]"
        // A stray tap beside the window must not throw away a pile of named photos.
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <header className="cs-head">
          <DialogTitle>{title}</DialogTitle>
          <span className="cs-class">{activeClass.name}</span>
          <span className="cs-saved text-muted-foreground">
            <span className="hidden sm:inline">Only the circle goes to your Google Drive</span>
          </span>
          <button type="button" className="cs-icon-btn" aria-label="Close" disabled={stage === 'saving'} onClick={close}>
            <X />
          </button>
        </header>
        <div className="cs-page ph-page">{body}</div>
        <ConfirmModal
          open={leaving}
          title="Leave without saving?"
          message="The photos you named aren't saved yet."
          confirmLabel="Leave"
          cancelLabel="Stay"
          onCancel={() => setLeaving(false)}
          onConfirm={() => {
            setLeaving(false)
            onClose()
          }}
        />
      </DialogContent>
    </DialogPrimitive.Root>
  )
}

/**
 * One photo whole, with its circle: a tap on the picture moves the circle there (on the face the
 * finder missed, or the right child of two), and − and + make it smaller or bigger. Taps, never a
 * drag: the board reads a held finger as a right-click, and one touch as two.
 */
function FixPhoto({
  item,
  name,
  only,
  problem,
  onChange,
  onRename,
  onDone,
  onSave,
  onCancel,
}: {
  item: Item
  name: string | undefined
  only: boolean
  problem: string | null
  onChange: (patch: Partial<Item>) => void
  onRename: () => void
  onDone: () => void
  onSave: () => void
  onCancel: () => void
}) {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [failed, setFailed] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const crop = item.crop

  // The picture again, from the file: only the small square is kept between fixes.
  useEffect(() => {
    if (item.state !== 'ready') return
    let opened: ImageBitmap | null = null
    let stopped = false
    openPhoto(item.file)
      .then((p) => {
        opened = p.bitmap
        if (stopped) p.bitmap.close()
        else setBitmap(p.bitmap)
      })
      .catch(() => setFailed(true))
    return () => {
      stopped = true
      opened?.close()
    }
  }, [item.file, item.state])

  useEffect(() => {
    const c = canvas.current
    if (!c || !bitmap || !crop) return
    const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height))
    c.width = Math.round(bitmap.width * scale)
    c.height = Math.round(bitmap.height * scale)
    const ctx = c.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0, c.width, c.height)
    // The rest of the picture darkened, the circle clear, as the desk will show it.
    const r = (crop.size / 2) * scale
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
    ctx.beginPath()
    ctx.rect(0, 0, c.width, c.height)
    ctx.arc(crop.cx * scale, crop.cy * scale, r, 0, Math.PI * 2)
    ctx.fill('evenodd')
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = Math.max(2, c.width / 250)
    ctx.beginPath()
    ctx.arc(crop.cx * scale, crop.cy * scale, r, 0, Math.PI * 2)
    ctx.stroke()
  }, [bitmap, crop])

  async function move(next: Crop) {
    if (!bitmap) return
    const held = clampCrop(next, bitmap.width, bitmap.height)
    onChange({ crop: held, found: true, jpeg: await renderCrop(bitmap, held) })
  }

  const ready = bitmap !== null && crop !== undefined
  const smallest = bitmap ? Math.min(64, bitmap.width, bitmap.height) : 0
  const biggest = bitmap ? Math.min(bitmap.width, bitmap.height) : 0

  return (
    <>
      <div className="ph-fix">
        <div className="ph-canvas">
          {failed || item.state === 'failed' ? (
            <span className="cs-hint">This photo can&rsquo;t be opened. Choose another one.</span>
          ) : !ready ? (
            <LoaderCircle className="animate-spin" size={40} />
          ) : (
            <canvas
              ref={canvas}
              aria-label="Tap the face"
              onClick={(e) => {
                if (!bitmap || !crop) return
                const rect = e.currentTarget.getBoundingClientRect()
                const x = ((e.clientX - rect.left) / rect.width) * bitmap.width
                const y = ((e.clientY - rect.top) / rect.height) * bitmap.height
                void move({ ...crop, cx: x, cy: y })
              }}
            />
          )}
        </div>
        <div className="ph-side">
          {item.url && <img src={item.url} alt="" className="ph-circle ph-preview" draggable={false} />}
          <b className="ph-who-name">{name ?? 'Who is this?'}</b>
          {!only && (
            <Btn small onClick={onRename}>
              {name ? 'Change who it is' : 'Who is this?'}
            </Btn>
          )}
          <span className="cs-hint text-center">Tap the face to move the circle there.</span>
          <div className="cs-stepper" role="group" aria-label="Size">
            <button
              type="button"
              aria-label="Smaller circle"
              disabled={!ready || crop.size <= smallest + 1}
              onClick={() => crop && void move({ ...crop, size: crop.size * ZOOM })}
            >
              <Minus size={20} strokeWidth={2.75} />
            </button>
            <span className="ph-zoom-label">Size</span>
            <button
              type="button"
              aria-label="Bigger circle"
              disabled={!ready || crop.size >= biggest - 1}
              onClick={() => crop && void move({ ...crop, size: crop.size / ZOOM })}
            >
              <Plus size={20} strokeWidth={2.75} />
            </button>
          </div>
          {!only && (
            <Btn small kind="quiet" onClick={() => (onChange({ left: !item.left }), onDone())}>
              {item.left ? (
                <>
                  <RotateCcw /> Put it back
                </>
              ) : (
                <>
                  <X /> Leave it out
                </>
              )}
            </Btn>
          )}
        </div>
      </div>
      <div className="cs-foot">
        {problem && (
          <span className="cs-note text-destructive">
            <CircleAlert size={16} /> {problem}
          </span>
        )}
        <div className="cs-right">
          {only ? (
            <>
              <Btn onClick={onCancel}>Cancel</Btn>
              <Btn kind="primary" disabled={!ready} onClick={onSave}>
                <Save /> Save Photo
              </Btn>
            </>
          ) : (
            <Btn kind="primary" onClick={onDone}>
              <Check /> Done
            </Btn>
          )}
        </div>
      </div>
    </>
  )
}
