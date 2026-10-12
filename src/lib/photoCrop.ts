import wasmLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryUrl from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import type { FaceDetector } from '@mediapipe/tasks-vision'
import { assetUrl } from './assets'

/**
 * A student's photo, from a phone's picture to the small square that goes to Drive, all on the
 * teacher's own computer: nothing is sent anywhere to find the face, and the picture itself never
 * leaves the computer - only the square does, without the background, the other children in it,
 * or the place it was taken (a phone hides that in every photo, and redrawing it leaves it out).
 *
 * The face is found, never recognised: the app knows where a face is in a picture, never whose
 * it is. Telling who a face belongs to is biometric data about children, and a line the app
 * doesn't cross; the teacher says whose photo it is.
 */

/** The square that goes to Drive: sharp on a desk on a 4K board, and about 30 KB. */
export const PHOTO_SIZE = 400
/**
 * A picture is shrunk to this as it is opened, so a phone's 50-megapixel photo is never held
 * whole for longer than it takes to open; big enough to move the crop in to one face of many.
 */
const OPENED_MAX = 2000

export interface OpenedPhoto {
  bitmap: ImageBitmap
  /** The file's own name, which may be the student's ("Kevin.jpg"). */
  name: string
  /** When the camera took it, from the photo's own record of it, if it has one. */
  takenAt: number | null
}

/** A square of the opened picture: its centre and its side, in the picture's pixels. */
export interface Crop {
  cx: number
  cy: number
  size: number
}

export interface Framed {
  crop: Crop
  /** A face was found. When not, the crop is a guess, and the teacher is asked to check it. */
  found: boolean
}

/** A photo the browser can't open (not a picture, or broken). */
export class PhotoError extends Error {}

/**
 * iPhones save photos as HEIC, which Chrome and Edge on Windows can't open. A reader for it comes
 * with the first one chosen, and only then: a teacher with an Android phone never downloads it.
 */
async function isHeic(file: Blob): Promise<boolean> {
  const brand = new TextDecoder().decode(await file.slice(8, 12).arrayBuffer())
  return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand.replace(/\0/g, ' ').trim())
}

export async function openPhoto(file: File): Promise<OpenedPhoto> {
  let full: ImageBitmap
  try {
    full = await createImageBitmap(file)
  } catch {
    if (!(await isHeic(file))) throw new PhotoError(`Can't open ${file.name}`)
    try {
      const { heicTo } = await import('heic-to')
      full = await heicTo({ blob: file, type: 'bitmap' })
    } catch {
      throw new PhotoError(`Can't open ${file.name}`)
    }
  }
  const scale = Math.min(1, OPENED_MAX / Math.max(full.width, full.height))
  let bitmap = full
  if (scale < 1) {
    bitmap = await createImageBitmap(full, {
      resizeWidth: Math.round(full.width * scale),
      resizeHeight: Math.round(full.height * scale),
      resizeQuality: 'high',
    })
    full.close()
  }
  const takenAt = await exifTakenAt(file).catch(() => null)
  return { bitmap, name: file.name, takenAt }
}

let detector: Promise<FaceDetector> | null = null

/**
 * Google's own face finder (MediaPipe's BlazeFace), served from the app's address and loaded the
 * first time a photo is added - a few megabytes, once, on the computer photos are added on.
 */
function loadDetector(): Promise<FaceDetector> {
  detector ??= (async () => {
    const { FaceDetector } = await import('@mediapipe/tasks-vision')
    return FaceDetector.createFromOptions(
      { wasmLoaderPath: wasmLoaderUrl, wasmBinaryPath: wasmBinaryUrl },
      {
        baseOptions: { modelAssetPath: assetUrl('/face/blaze_face_short_range.tflite'), delegate: 'CPU' },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.5,
      },
    )
  })().catch((error: unknown) => {
    detector = null
    throw error
  })
  return detector
}

/** Starts the face finder downloading while the teacher is still choosing photos. */
export function warmUpFaceFinder(): void {
  void loadDetector().catch(() => undefined)
}

const SURE_IN_A_SQUARE = 0.75

interface Face {
  x: number
  y: number
  w: number
  h: number
  score: number
}

/**
 * Faces in the picture. The finder looks at the picture shrunk to a small square, where a child
 * photographed from across the room is only a few dots, so a picture with no face found is looked
 * at again in closer squares, overlapping, until one turns up.
 */
async function findFaces(bitmap: ImageBitmap): Promise<Face[]> {
  const finder = await loadDetector()
  const { width: W, height: H } = bitmap
  const short = Math.min(W, H)
  for (const share of [1, 0.6, 0.36]) {
    const side = Math.round(short * share)
    const stride = side / 2
    const xs = steps(W - side, stride)
    const ys = steps(H - side, stride)
    const found: Face[] = []
    for (const y of ys) {
      for (const x of xs) {
        // The whole picture first, as it is; then squares of it.
        const tile = share === 1 ? bitmap : await createImageBitmap(bitmap, x, y, side, side)
        const ox = share === 1 ? 0 : x
        const oy = share === 1 ? 0 : y
        try {
          for (const d of finder.detect(tile).detections) {
            const box = d.boundingBox
            const score = d.categories[0]?.score ?? 0
            // A close-up square sees faces in clouds and leaves: there, only a sure find counts
            // (a real face scored 0.84 to 0.92 in the tests, a mountainside up to 0.57).
            if (!box || (share < 1 && score < SURE_IN_A_SQUARE)) continue
            found.push({ x: box.originX + ox, y: box.originY + oy, w: box.width, h: box.height, score })
          }
        } finally {
          if (tile !== bitmap) tile.close()
        }
      }
      if (share === 1) break
    }
    if (found.length > 0) return withoutRepeats(found)
  }
  return []
}

/** Where squares of `side` start along a length, `stride` apart, the last one flush with the end. */
function steps(room: number, stride: number): number[] {
  if (room <= 0) return [0]
  const at: number[] = []
  for (let p = 0; p < room; p += stride) at.push(Math.round(p))
  at.push(Math.round(room))
  return at
}

/** Overlapping squares find the same face more than once: keep the surest of each. */
function withoutRepeats(faces: Face[]): Face[] {
  const kept: Face[] = []
  for (const f of [...faces].sort((a, b) => b.score - a.score)) {
    const same = kept.some((k) => {
      const ix = Math.max(0, Math.min(f.x + f.w, k.x + k.w) - Math.max(f.x, k.x))
      const iy = Math.max(0, Math.min(f.y + f.h, k.y + k.h) - Math.max(f.y, k.y))
      return ix * iy > 0.3 * Math.min(f.w * f.h, k.w * k.h)
    })
    if (!same) kept.push(f)
  }
  return kept
}

/**
 * Every child framed alike, so the class looks even on the board: head and shoulders, the face a
 * little above the middle (the hair takes the room above it). With two faces in a picture - a
 * classmate behind - the biggest one nearest the middle is the one the photo was taken of.
 */
export async function framePhoto(bitmap: ImageBitmap): Promise<Framed> {
  // No face finder (no internet the first time, say) is no face found: a guess, to check.
  const faces = await findFaces(bitmap).catch(() => [])
  const { width: W, height: H } = bitmap
  if (faces.length === 0) return guessFrame(W, H)
  const diagonal = Math.hypot(W, H)
  const weight = (f: Face) => f.w * f.h * f.score * (1 - 0.6 * (Math.hypot(f.x + f.w / 2 - W / 2, f.y + f.h / 2 - H / 2) / diagonal))
  const face = faces.reduce((best, f) => (weight(f) > weight(best) ? f : best))
  const side = Math.max(face.w, face.h)
  return {
    crop: clampCrop({ cx: face.x + face.w / 2, cy: face.y + face.h / 2 - side * 0.12, size: side * 2.3 }, W, H),
    found: true,
  }
}

/** A guess where a portrait's face usually is - across the middle, in the upper part - for the teacher to check. */
export function guessFrame(W: number, H: number): Framed {
  const size = Math.min(W, H) * (H > W ? 0.8 : 0.7)
  return { crop: clampCrop({ cx: W / 2, cy: H * (H > W ? 0.38 : 0.45), size }, W, H), found: false }
}

/** A crop held inside the picture: no bigger than its short side, and never past an edge. */
export function clampCrop(crop: Crop, W: number, H: number): Crop {
  const size = Math.max(Math.min(crop.size, W, H), Math.min(64, W, H))
  const half = size / 2
  return {
    size,
    cx: Math.min(Math.max(crop.cx, half), W - half),
    cy: Math.min(Math.max(crop.cy, half), H - half),
  }
}

/** The square, drawn small, as the JPEG that goes to Drive. */
export async function renderCrop(bitmap: ImageBitmap, crop: Crop, size = PHOTO_SIZE): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, crop.cx - crop.size / 2, crop.cy - crop.size / 2, crop.size, crop.size, 0, 0, size, size)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86))
  canvas.width = canvas.height = 0
  if (!blob) throw new PhotoError("Couldn't make the photo")
  return blob
}

/**
 * When the camera took the photo (EXIF's DateTimeOriginal), so a pile of photos comes up in the
 * order they were taken - the order a teacher walks the class in. Read from the first part of a
 * JPEG only; anything else has no date, and the photos fall back to the order of their names.
 */
export async function exifTakenAt(file: Blob): Promise<number | null> {
  const view = new DataView(await file.slice(0, 256 * 1024).arrayBuffer())
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null
  let at = 2
  while (at + 4 < view.byteLength) {
    const marker = view.getUint16(at)
    const length = view.getUint16(at + 2)
    if (marker === 0xffe1 && view.getUint32(at + 4) === 0x45786966) return readExifDate(view, at + 10)
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return null
    at += 2 + length
  }
  return null
}

function readExifDate(view: DataView, tiff: number): number | null {
  const little = view.getUint16(tiff) === 0x4949
  const u16 = (p: number) => view.getUint16(p, little)
  const u32 = (p: number) => view.getUint32(p, little)
  const entries = (ifd: number) => Array.from({ length: u16(ifd) }, (_, i) => ifd + 2 + i * 12)
  const first = tiff + u32(tiff + 4)
  const pointer = entries(first).find((e) => u16(e) === 0x8769)
  if (pointer === undefined) return null
  const date = entries(tiff + u32(pointer + 8)).find((e) => u16(e) === 0x9003)
  if (date === undefined) return null
  const start = tiff + u32(date + 8)
  const text = Array.from({ length: 19 }, (_, i) => String.fromCharCode(view.getUint8(start + i))).join('')
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(text)
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : null
}
