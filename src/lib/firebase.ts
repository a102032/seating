/**
 * The connection to the teacher's Google account: Firebase sign-in, and the classes kept in
 * Firestore. Nothing imports this file directly - lib/cloud.ts loads it the first time it is
 * needed, so a teacher who never signs in never downloads it.
 *
 * Firestore keeps its own copy of the classes on the device (persistentLocalCache), so a
 * change made with the Wi-Fi down is queued there and goes up when the connection comes back,
 * even if the page was closed in between.
 */
import { initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from 'firebase/auth'
import {
  clearIndexedDbPersistence,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDocsFromServer,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
  terminate,
  waitForPendingWrites,
  type Firestore,
} from 'firebase/firestore'
import type { ClassData } from '../types'

// Web settings for the class-yes project. They name the project; they are not a password.
// What keeps one teacher out of another's classes is the Firestore rules: a teacher can only
// read and write under /teachers/<their own id>.
const config = {
  apiKey: 'AIzaSyA-b0BzeT_d6FjWsbO35SipT04CrUBRcYc',
  authDomain: 'class-yes.firebaseapp.com',
  projectId: 'class-yes',
  storageBucket: 'class-yes.firebasestorage.app',
  messagingSenderId: '323152163178',
  appId: '1:323152163178:web:dc7fd18f61de4e52743513',
}

let services: { auth: Auth; db: Firestore } | null = null

/**
 * Started on first use rather than when the file loads: the splash fetches this file ahead of
 * time, and a teacher who never signs in shouldn't pay for Firebase starting up on a slow board.
 */
function connect() {
  if (services) return services
  const app = initializeApp(config)
  const auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  })
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
  // Tests run against Firebase's own emulators on this computer, never the real project.
  if (import.meta.env.VITE_FIREBASE_EMULATOR) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
  }
  services = { auth, db }
  return services
}

export interface Account {
  uid: string
  /** What the splash greets: the first word of the Google name, or the email before the @. */
  firstName: string
  email: string
}

function toAccount(user: User): Account {
  const email = user.email ?? ''
  const firstName = user.displayName?.trim().split(/\s+/)[0] || email.split('@')[0] || 'Teacher'
  return { uid: user.uid, firstName, email }
}

/** Google's own sign-in window. `select_account` so a shared board always asks who is signing in. */
export async function signIn(): Promise<Account> {
  const { auth } = connect()
  if (import.meta.env.VITE_FIREBASE_EMULATOR) {
    // Google's sign-in window can't load where the tests run, so a test names the Google account
    // it signs in as (or the error it wants), and the emulator takes it on trust.
    const test = (window as { __testGoogle?: { error?: string; sub?: string } }).__testGoogle
    if (test?.error) throw Object.assign(new Error(test.error), { code: test.error })
    if (test) return toAccount((await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify(test)))).user)
  }
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const result = await signInWithPopup(auth, provider)
  return toAccount(result.user)
}

const DRIVE_FILE = 'https://www.googleapis.com/auth/drive.file'
let drivePass: { token: string; until: number } | null = null

/**
 * A pass into the teacher's Google Drive that reaches only the files this app makes there
 * (Google's drive.file permission, which needs no review by Google and no school IT). Google
 * gives one for an hour. Asking opens Google's window for the same account; the first time it
 * asks the teacher to allow Drive, and after that it closes again by itself. Called straight
 * from a tap, because a browser only lets a page open a window then.
 */
export async function driveToken(): Promise<string> {
  if (drivePass && drivePass.until > Date.now()) return drivePass.token
  const user = connect().auth.currentUser
  if (!user) throw Object.assign(new Error('Not signed in'), { code: 'auth/no-current-user' })
  if (import.meta.env.VITE_FIREBASE_EMULATOR) {
    // Tests hand over a pass (or the error they want) and a stand-in for Google answers it.
    const test = (window as { __testGoogle?: { driveToken?: string; driveError?: string } }).__testGoogle
    if (test?.driveError) throw Object.assign(new Error(test.driveError), { code: test.driveError })
    if (test?.driveToken) return test.driveToken
  }
  const provider = new GoogleAuthProvider()
  provider.addScope(DRIVE_FILE)
  if (user.email) provider.setCustomParameters({ login_hint: user.email })
  const result = await reauthenticateWithPopup(user, provider)
  const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken
  if (!token) throw Object.assign(new Error('No Drive pass'), { code: 'drive/no-token' })
  // A little under the hour, so a pass never runs out halfway through a save.
  drivePass = { token, until: Date.now() + 50 * 60_000 }
  return token
}

/** Google turned the pass down (it ran out, or the teacher didn't allow Drive): ask again next time. */
export function forgetDriveToken() {
  drivePass = null
}

/** Who Firebase has signed in on this browser, once it has checked. */
export function currentAccount(): Promise<Account | null> {
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(connect().auth, (user) => {
      stop()
      resolve(user ? toAccount(user) : null)
    })
  })
}

const classesOf = (uid: string) => collection(connect().db, 'teachers', uid, 'classes')

/**
 * A class is stored as its JSON, beside the few fields worth reading at a glance. As JSON it
 * comes back exactly as it went up: Firestore refuses some shapes a class could take (an
 * unset field, a list inside a list) and would otherwise turn a new feature into a failed save.
 */
interface ClassDoc {
  json: string
  name: string
  updatedAt: string
  createdAt: string
}

function fromDoc(data: ClassDoc): ClassData | null {
  try {
    return JSON.parse(data.json) as ClassData
  } catch {
    return null
  }
}

/** The account's classes as the server has them now. Fails while offline. */
export async function fetchClasses(uid: string): Promise<ClassData[]> {
  const snap = await getDocsFromServer(classesOf(uid))
  return snap.docs.map((d) => fromDoc(d.data() as ClassDoc)).filter((c): c is ClassData => c !== null)
}

export function writeClass(uid: string, cls: ClassData): Promise<void> {
  const data: ClassDoc = { json: JSON.stringify(cls), name: cls.name, updatedAt: cls.updatedAt, createdAt: cls.createdAt ?? cls.updatedAt }
  return setDoc(doc(classesOf(uid), cls.id), data)
}

export function removeClass(uid: string, id: string): Promise<void> {
  return deleteDoc(doc(classesOf(uid), id))
}

export interface ClassChange {
  kind: 'set' | 'removed'
  id: string
  cls: ClassData | null
}

export interface Snapshot {
  /** What changed since the last snapshot. */
  changes: ClassChange[]
  /** Every class in the account, for checking the whole board against it. */
  all: () => ClassChange[]
  /** Every class id in the account right now, as far as this device knows. */
  ids: string[]
  /** The server has confirmed this picture; false while it is only this device's copy. */
  fromServer: boolean
  /** Changes made here that the server hasn't taken yet. */
  pending: boolean
}

/**
 * Every change to the account's classes, as it happens. Changes this device made itself come
 * back too (Firestore shows them at once, before the server has them); those are left out of
 * `changes`, since the class already looks like that here.
 */
export function watchClasses(uid: string, onSnap: (snap: Snapshot) => void, onError: (error: unknown) => void): () => void {
  return onSnapshot(
    classesOf(uid),
    { includeMetadataChanges: true },
    (snap) => {
      const changes: ClassChange[] = snap
        .docChanges()
        .filter((c) => !c.doc.metadata.hasPendingWrites)
        .map((c) =>
          c.type === 'removed'
            ? { kind: 'removed', id: c.doc.id, cls: null }
            : { kind: 'set', id: c.doc.id, cls: fromDoc(c.doc.data() as ClassDoc) },
        )
      const all = () =>
        snap.docs
          .filter((d) => !d.metadata.hasPendingWrites)
          .map((d): ClassChange => ({ kind: 'set', id: d.id, cls: fromDoc(d.data() as ClassDoc) }))
      onSnap({
        changes,
        all,
        ids: snap.docs.map((d) => d.id),
        fromServer: !snap.metadata.fromCache,
        pending: snap.metadata.hasPendingWrites,
      })
    },
    onError,
  )
}

/** Undo a sign-in that couldn't finish (the classes couldn't be read, or it was the wrong account). */
export function signOutOnly(): Promise<void> {
  return firebaseSignOut(connect().auth)
}

/**
 * The next teacher is taking the board: wait for anything still going up (briefly - a board
 * that has lost its connection can't wait forever), then sign out and wipe Firestore's copy,
 * so none of this teacher's students are left on the device.
 */
export async function signOutAndForget(): Promise<void> {
  const { auth, db } = connect()
  await Promise.race([waitForPendingWrites(db), new Promise((resolve) => setTimeout(resolve, 5000))])
  await firebaseSignOut(auth)
  await terminate(db)
  await clearIndexedDbPersistence(db)
}
