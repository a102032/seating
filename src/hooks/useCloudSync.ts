import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  loadAccount,
  loadCloud,
  saveAccount,
  signInProblem,
  stashBoard,
  takeBoardStash,
  type Account,
  type SavedAccount,
} from '../lib/cloud'
import type { Snapshot } from '../lib/firebase'
import { replaceLocalState } from '../lib/localStore'
import type { ClassData } from '../types'

/**
 * connecting: signed in, not yet heard from the account. saved: the account has everything.
 * offline: no connection; changes are kept here and go up when it's back. error: changes aren't
 * reaching the account (or the sign-in has to be done again).
 */
export type SyncStatus = 'connecting' | 'saved' | 'offline' | 'error'

/** A first sign-in on a board that already has classes of its own. */
export interface AccountQuestion {
  account: Account
  boardClasses: ClassData[]
  accountClasses: ClassData[]
  /** Both together fit under the class limit, so adding them is on offer. */
  fits: boolean
}

interface Options {
  classes: ClassData[]
  setClasses: Dispatch<SetStateAction<ClassData[]>>
  activeClassId: string | null
  setActiveClassId: (id: string | null) => void
  /** A fresh empty class, for a board left with none. */
  seed: () => ClassData
  /** A class as it arrives from the account, brought up to what this version of the app expects. */
  normalize: (cls: ClassData) => ClassData
  maxClasses: number
}

/** A burst of taps (+1, +1, +1) goes up as one write. */
const WRITE_DELAY_MS = 600

type Cloud = Awaited<ReturnType<typeof loadCloud>>

const byCreated = (a: ClassData, b: ClassData) => (a.createdAt ?? '￿').localeCompare(b.createdAt ?? '￿')

/**
 * First run: the one empty class the app makes for itself. It isn't anyone's class yet, so
 * signing in doesn't ask about it.
 */
const isBlankBoard = (classes: ClassData[]) => classes.length === 1 && classes[0].students.length === 0

/**
 * Signing in with Google, and keeping the board's classes and the teacher's account the same.
 *
 * The board keeps working from its own copy (localStorage, as before), so nothing ever waits on
 * the internet; every change also goes up to the account, and changes made on another computer
 * come down as they happen. Each class goes up whole, and the last one to reach the account is
 * the one it keeps - a teacher is at one computer at a time, so two computers changing the same
 * class at the same moment isn't worth more machinery than that.
 */
export function useCloudSync({ classes, setClasses, activeClassId, setActiveClassId, seed, normalize, maxClasses }: Options) {
  const [saved] = useState(loadAccount)
  const record = useRef<SavedAccount | null>(saved)
  const [account, setAccount] = useState<Account | null>(saved && { uid: saved.uid, firstName: saved.firstName, email: saved.email })
  /** Firebase agrees this browser is signed in as `account`. */
  const [verified, setVerified] = useState(false)
  const [status, setStatus] = useState<SyncStatus>('connecting')
  const [needsSignIn, setNeedsSignIn] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [signInError, setSignInError] = useState<string | null>(null)
  const [question, setQuestion] = useState<AccountQuestion | null>(null)

  const cloud = useRef<Cloud | null>(null)
  const connected = useRef(false)
  const unwatch = useRef<(() => void) | null>(null)
  /** The classes as the last commit left them, by id: what the next commit is compared with. */
  const seen = useRef<Map<string, ClassData> | null>(null)
  /** Class objects that came from the account, so seeing them arrive isn't a change to send back. */
  const fromAccount = useRef(new WeakSet<ClassData>())
  /** Classes leaving this board without leaving the account (put aside, or deleted elsewhere). */
  const quiet = useRef(new Set<string>())
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const versions = useRef(new Map<string, number>())
  const heardFromServer = useRef(false)
  /** The account has been checked against the board, once per connection. */
  const checked = useRef(false)
  const activeRef = useRef(activeClassId)

  useEffect(() => {
    activeRef.current = activeClassId
  }, [activeClassId])

  const clearDirty = useCallback((id: string) => {
    const r = record.current
    if (!r || !r.dirty.includes(id)) return
    r.dirty = r.dirty.filter((d) => d !== id)
    saveAccount(r)
  }, [])

  const push = useCallback(
    (id: string) => {
      const r = record.current
      const cls = seen.current?.get(id)
      if (!r || !cls || !cloud.current || !connected.current) return // still dirty: it goes up once connected
      const version = versions.current.get(id)
      cloud.current.writeClass(r.uid, cls).then(
        () => {
          if (versions.current.get(id) === version && record.current?.uid === r.uid) clearDirty(id)
        },
        () => setStatus('error'),
      )
    },
    [clearDirty],
  )

  const sendRemoval = useCallback((id: string) => {
    const r = record.current
    if (!r || !cloud.current || !connected.current) return
    cloud.current.removeClass(r.uid, id).then(
      () => {
        if (record.current !== r) return
        r.deleted = r.deleted.filter((d) => d !== id)
        saveAccount(r)
      },
      () => setStatus('error'),
    )
  }, [])

  const flush = useCallback(() => {
    for (const [id, timer] of timers.current) {
      clearTimeout(timer)
      timers.current.delete(id)
      push(id)
    }
  }, [push])

  // Every commit: whatever changed here goes up, and whatever went away is removed.
  useEffect(() => {
    const before = seen.current
    seen.current = new Map(classes.map((c) => [c.id, c]))
    const r = record.current
    if (!before || !r) return
    for (const c of classes) {
      if (before.get(c.id) === c || fromAccount.current.has(c)) continue
      if (!r.dirty.includes(c.id)) r.dirty.push(c.id)
      versions.current.set(c.id, (versions.current.get(c.id) ?? 0) + 1)
      clearTimeout(timers.current.get(c.id))
      timers.current.set(
        c.id,
        setTimeout(() => {
          timers.current.delete(c.id)
          push(c.id)
        }, WRITE_DELAY_MS),
      )
    }
    for (const id of before.keys()) {
      if (seen.current.has(id) || quiet.current.delete(id)) continue
      clearTimeout(timers.current.get(id))
      timers.current.delete(id)
      r.dirty = r.dirty.filter((d) => d !== id)
      if (!r.deleted.includes(id)) r.deleted.push(id)
      sendRemoval(id)
    }
    saveAccount(r)
  }, [classes, push, sendRemoval])

  /**
   * What the account says, laid over the board. A class changed here and not yet sent is left
   * alone - it's about to go up and replace what the account has. On the first word from the
   * server the whole account is checked against the board, which is where a change made just
   * before the board was switched off gets sent, and a class deleted on another computer goes.
   */
  const receive = useCallback(
    (snap: Snapshot) => {
      if (snap.fromServer) heardFromServer.current = true
      setStatus(snap.fromServer ? 'saved' : heardFromServer.current || !navigator.onLine ? 'offline' : 'connecting')
      const r = record.current
      if (!r || !seen.current) return

      const firstFromServer = snap.fromServer && !checked.current
      if (snap.fromServer) checked.current = true
      const incoming = new Map<string, ClassData>()
      const gone = new Set<string>()
      const docs = firstFromServer ? snap.all() : snap.changes

      for (const change of docs) {
        const { id } = change
        if (timers.current.has(id) || r.deleted.includes(id)) continue
        if (change.kind === 'removed') {
          gone.add(id)
          continue
        }
        if (!change.cls) continue
        const local = seen.current.get(id)
        if (local && local.updatedAt === change.cls.updatedAt) {
          if (snap.fromServer) clearDirty(id)
          continue
        }
        if (local && r.dirty.includes(id)) {
          // Changed here and never confirmed. Wait for the server's word, then the later
          // change wins.
          if (!snap.fromServer) continue
          if (change.cls.updatedAt < local.updatedAt) {
            push(id)
            continue
          }
          clearDirty(id)
        }
        incoming.set(id, change.cls)
      }

      if (firstFromServer) {
        for (const id of seen.current.keys()) {
          if (snap.ids.includes(id) || timers.current.has(id)) continue
          if (r.dirty.includes(id)) push(id)
          else gone.add(id)
        }
      }

      if (incoming.size === 0 && gone.size === 0) return
      setClasses((prev) => {
        const next: ClassData[] = []
        for (const c of prev) {
          // Changed here since the last commit: that change goes up next, so it stays. (One that
          // came from the account a moment ago, and hasn't been drawn yet, can be replaced.)
          const unseen = seen.current?.get(c.id) !== c && !fromAccount.current.has(c)
          if (gone.has(c.id) && !unseen) {
            quiet.current.add(c.id)
            continue
          }
          const theirs = incoming.get(c.id)
          if (!theirs || unseen) {
            next.push(c)
            continue
          }
          const cls = normalize(theirs)
          fromAccount.current.add(cls)
          next.push(cls)
        }
        for (const [id, theirs] of incoming) {
          if (prev.some((c) => c.id === id)) continue
          const cls = normalize(theirs)
          fromAccount.current.add(cls)
          next.push(cls)
        }
        // A board is never left with no class at all; the fresh one goes up like any new class.
        return next.length > 0 ? next.sort(byCreated) : [seed()]
      })
    },
    [clearDirty, normalize, push, seed, setClasses],
  )

  // Once Firebase agrees who is signed in, start listening, and send anything left from before.
  useEffect(() => {
    if (!account || !verified || connected.current || !cloud.current) return
    connected.current = true
    heardFromServer.current = false
    checked.current = false
    const r = record.current
    if (!r) return
    r.deleted.forEach(sendRemoval)
    unwatch.current = cloud.current.watchClasses(r.uid, receive, (error) => {
      setStatus('error')
      console.warn('Class sync stopped', error)
    })
  }, [account, verified, receive, sendRemoval])

  // Opening the app already signed in: load Firebase and check the sign-in is still good. With
  // no internet this waits, and tries again when the connection comes back.
  useEffect(() => {
    if (!record.current) return
    let cancelled = false
    const start = async () => {
      try {
        const api = await loadCloud()
        const who = await api.currentAccount()
        if (cancelled) return
        cloud.current = api
        if (!who || who.uid !== record.current?.uid) {
          setNeedsSignIn(true)
          setStatus('error')
          return
        }
        setVerified(true)
      } catch {
        if (!cancelled) setStatus('offline')
      }
    }
    void start()
    const retry = () => {
      if (!cloud.current && record.current) void start()
    }
    window.addEventListener('online', retry)
    return () => {
      cancelled = true
      window.removeEventListener('online', retry)
    }
  }, [])

  useEffect(
    () => () => {
      unwatch.current?.()
    },
    [],
  )

  // The Wi-Fi dropping shows at once, rather than when Firestore next notices.
  useEffect(() => {
    const offline = () => setStatus((s) => (s === 'error' ? s : 'offline'))
    window.addEventListener('offline', offline)
    return () => window.removeEventListener('offline', offline)
  }, [])

  // The board going to sleep, or the tab closing, sends what's waiting rather than losing it.
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', flush)
    }
  }, [flush])

  /**
   * The board's classes become the account's. `upload` go up (they are marked as changed here,
   * so the first word from the server sends them); the rest came from the account.
   */
  const adopt = useCallback(
    (who: Account, list: ClassData[], upload: ClassData[]) => {
      const uploading = new Set(upload.map((c) => c.id))
      const now = Date.now()
      // Classes from before sign-in have no created time; they keep the board's order.
      const stamped = list.map((c, i) => (c.createdAt ? c : { ...c, createdAt: new Date(now + i).toISOString() }))
      const ordered = stamped.map(normalize).sort(byCreated)
      for (const c of ordered) fromAccount.current.add(c)
      for (const id of seen.current?.keys() ?? []) if (!ordered.some((c) => c.id === id)) quiet.current.add(id)

      record.current = { ...who, dirty: ordered.filter((c) => uploading.has(c.id)).map((c) => c.id), deleted: [] }
      saveAccount(record.current)
      const current = activeRef.current
      setClasses(ordered.length > 0 ? ordered : [seed()])
      setActiveClassId(ordered.some((c) => c.id === current) ? current : (ordered[0]?.id ?? null))
      setAccount(who)
      setVerified(true)
      setStatus('connecting')
    },
    [normalize, seed, setActiveClassId, setClasses],
  )

  /** A first sign-in: whose classes, and does the board have any of its own to ask about. */
  const arrange = useCallback(
    (who: Account, fetched: ClassData[]) => {
      const accountClasses = [...fetched].sort(byCreated)
      const onBoard = [...(seen.current?.values() ?? [])]
      const board = isBlankBoard(onBoard) ? [] : onBoard
      const accountIds = new Set(accountClasses.map((c) => c.id))
      const boardOnly = board.filter((c) => !accountIds.has(c.id))

      if (accountClasses.length === 0) {
        // A new account: everything here goes up, even a blank first class, so the board and
        // the account start out the same.
        adopt(who, onBoard, onBoard)
        return
      }
      // Classes both have (a board that was signed in before): the later copy of each.
      const shared = board.filter((c) => accountIds.has(c.id))
      const merged = accountClasses.map((mine) => {
        const here = shared.find((c) => c.id === mine.id)
        return here && here.updatedAt > mine.updatedAt ? here : mine
      })
      const newerHere = merged.filter((c) => shared.includes(c))
      if (boardOnly.length === 0) {
        adopt(who, merged, newerHere)
        return
      }
      setQuestion({ account: who, boardClasses: boardOnly, accountClasses: merged, fits: merged.length + boardOnly.length <= maxClasses })
    },
    [adopt, maxClasses],
  )

  const signIn = useCallback(async () => {
    if (signingIn) return
    setSigningIn(true)
    setSignInError(null)
    let api: Cloud | null = null
    try {
      api = await loadCloud()
      cloud.current = api
      const who = await api.signIn()
      const r = record.current
      if (r) {
        // Signing in again on a board whose classes are already someone's.
        if (who.uid === r.uid) {
          setNeedsSignIn(false)
          setVerified(true)
          setStatus('connecting')
        } else {
          await api.signOutOnly()
          setSignInError(`This board has ${r.firstName}'s classes. Use Switch teacher first.`)
        }
        return
      }
      arrange(who, await api.fetchClasses(who.uid))
    } catch (error) {
      // Signed in to Google but the classes couldn't be read: don't leave half a sign-in behind.
      if (api && !record.current) await api.signOutOnly().catch(() => {})
      const problem = signInProblem(error)
      if (problem) console.warn('Sign-in failed', error)
      setSignInError(problem)
    } finally {
      setSigningIn(false)
    }
  }, [arrange, signingIn])

  /** Add the board's own classes to the account, or put them aside until this teacher leaves. */
  const answerQuestion = useCallback(
    (add: boolean) => {
      const q = question
      if (!q) return
      setQuestion(null)
      if (add && q.fits) {
        adopt(q.account, [...q.accountClasses, ...q.boardClasses], q.boardClasses)
      } else {
        stashBoard({ classes: q.boardClasses, activeClassId: activeRef.current })
        adopt(q.account, q.accountClasses, [])
      }
    },
    [adopt, question],
  )

  /**
   * The next teacher is taking the board. This teacher's classes are in their account; the board
   * forgets them (here and in Firestore's copy), gets back any classes of its own that were put
   * aside, and starts again at the splash.
   */
  const switchTeacher = useCallback(async () => {
    flush()
    unwatch.current?.()
    try {
      const api = cloud.current ?? (await loadCloud())
      await api.signOutAndForget()
    } catch (error) {
      console.warn('Sign-out did not finish cleanly', error)
    }
    record.current = null
    saveAccount(null)
    replaceLocalState(takeBoardStash())
    location.reload()
  }, [flush])

  /** Changes here that the account doesn't have yet. Switching teacher now would lose them. */
  const unsent = useCallback(() => (record.current?.dirty.length ?? 0) > 0 || timers.current.size > 0, [])

  return {
    account,
    status,
    needsSignIn,
    signingIn,
    signInError,
    question,
    signIn,
    answerQuestion,
    switchTeacher,
    unsent,
  }
}
