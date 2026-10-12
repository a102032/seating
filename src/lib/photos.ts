import { useEffect, useSyncExternalStore } from 'react'
import { downloadPhoto } from './drive'

/**
 * Each computer's own copy of the students' photos, so the board shows them at once and with no
 * internet, and asks Google only for a photo it has never had. The photos themselves live in the
 * teacher's Google Drive (lib/drive); a class keeps only each file's id, and an id is never reused,
 * so a copy kept here never goes stale.
 *
 * Kept in the browser's IndexedDB: localStorage holds a few megabytes of text, and five classes
 * of photos are about five megabytes of pictures. Switch Teacher wipes it (forgetAllPhotos), so the
 * next teacher at a shared board never sees this teacher's students.
 */
const DB_NAME = 'seating-chart-photos-v1'
const STORE = 'photos'

let opening: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }).catch((error: unknown) => {
    opening = null
    throw error
  })
  return opening
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const store = (await db()).transaction(STORE, mode).objectStore(STORE)
  return new Promise<T>((resolve, reject) => {
    const req = work(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** What this page knows of each photo: its picture, or that it is being looked for, or not here. */
type Known = { url: string } | 'loading' | 'missing'
const known = new Map<string, Known>()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

function set(id: string, value: Known) {
  const was = known.get(id)
  if (was && typeof was === 'object') URL.revokeObjectURL(was.url)
  known.set(id, value)
  notify()
}

/** Looks for a photo on this computer, once; `missing` if it has never been brought down here. */
function load(id: string): Promise<Known> {
  const now = known.get(id)
  if (now && now !== 'loading') return Promise.resolve(now)
  if (!now) {
    known.set(id, 'loading')
    void run<Blob | undefined>('readonly', (s) => s.get(id))
      .then((blob) => set(id, blob ? { url: URL.createObjectURL(blob) } : 'missing'))
      .catch(() => set(id, 'missing'))
  }
  return new Promise((resolve) => {
    const check = () => {
      const k = known.get(id)
      if (k && k !== 'loading') {
        listeners.delete(check)
        resolve(k)
      }
    }
    listeners.add(check)
    check()
  })
}

/**
 * The photo's picture to show, or `loading` while this computer looks for its copy (a moment,
 * shown as nothing rather than a flash of the cartoon), or `missing` when it has none yet: the
 * desk shows the student's character until the photo is brought down.
 */
export function usePhoto(id: string | undefined): string | 'loading' | 'missing' | undefined {
  const value = useSyncExternalStore(subscribe, () => (id ? known.get(id) : undefined))
  useEffect(() => {
    if (id) void load(id)
  }, [id])
  if (!id) return undefined
  if (!value || value === 'loading') return 'loading'
  return value === 'missing' ? 'missing' : value.url
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** A photo's picture now, if this page has it: for drawing the seating chart. */
export async function photoUrl(id: string): Promise<string | null> {
  const k = await load(id)
  return typeof k === 'object' ? k.url : null
}

/** Photos kept in the last minute, which their class may not list yet: never let go of by keepOnly. */
const justKept = new Map<string, number>()

/** A photo just made here goes straight into this computer's copy, so it shows with no download. */
export async function keepPhoto(id: string, jpeg: Blob): Promise<void> {
  justKept.set(id, Date.now())
  await run('readwrite', (s) => s.put(jpeg, id)).catch(() => undefined)
  set(id, { url: URL.createObjectURL(jpeg) })
}

/** The photos among these that this computer has never had. */
export async function missingPhotos(ids: string[]): Promise<string[]> {
  const found = await Promise.all(ids.map(async (id) => ((await load(id)) === 'missing' ? id : null)))
  return found.filter((id): id is string => id !== null)
}

/**
 * Brings these photos down from Drive into this computer's copy, a few at a time. A photo gone
 * from Drive (binned by hand) is skipped: the desk keeps the student's character.
 */
export async function bringDown(token: string, ids: string[]): Promise<number> {
  let brought = 0
  const queue = [...ids]
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      try {
        await keepPhoto(id, await downloadPhoto(token, id))
        brought++
      } catch (error) {
        if ((error as { reason?: string }).reason !== 'gone') throw error
      }
    }
  }
  await Promise.all([worker(), worker(), worker()])
  return brought
}

/**
 * Lets go of copies no class here uses any more: a photo replaced or removed on any computer, or a
 * student or class deleted. Run once the classes are in, never with an empty list by mistake.
 */
export async function keepOnly(ids: Set<string>): Promise<void> {
  const kept = await run<IDBValidKey[]>('readonly', (s) => s.getAllKeys()).catch(() => [])
  const recent = (id: string) => Date.now() - (justKept.get(id) ?? 0) < 60_000
  const gone = kept.map(String).filter((id) => !ids.has(id) && !recent(id))
  for (const id of gone) {
    await run('readwrite', (s) => s.delete(id)).catch(() => undefined)
    known.delete(id)
  }
  if (gone.length > 0) notify()
}

/** Switch Teacher: this computer forgets every photo, before the next teacher's classes arrive. */
export async function forgetAllPhotos(): Promise<void> {
  for (const k of known.values()) if (typeof k === 'object') URL.revokeObjectURL(k.url)
  known.clear()
  justKept.clear()
  await run('readwrite', (s) => s.clear()).catch(() => undefined)
  notify()
}

const CAUTION_KEY = 'seating-chart-photo-caution-v1'

/**
 * The caution before a class first shows photos (every school's rules differ, so the app reminds
 * rather than decides) is a real stop, once for each teacher on each computer.
 */
export function photoCautionSeen(uid: string | undefined): boolean {
  try {
    return (JSON.parse(localStorage.getItem(CAUTION_KEY) ?? '[]') as string[]).includes(uid ?? '')
  } catch {
    return false
  }
}

export function notePhotoCaution(uid: string | undefined): void {
  try {
    const seen = JSON.parse(localStorage.getItem(CAUTION_KEY) ?? '[]') as string[]
    localStorage.setItem(CAUTION_KEY, JSON.stringify([...new Set([...seen, uid ?? ''])]))
  } catch {
    // Asked again next time: no harm.
  }
}
