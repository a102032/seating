/*
 * Class? Yes! kept on the computer, so it opens with no internet (2026-10-31: school wifi failing at
 * the bell). Written out by the build (vite.config.ts, `offlineApp`), which fills in the version and
 * the files to keep. Not bundled: it runs on its own, beside the page.
 *
 * - Opening the app tries the internet first, for up to 4 seconds, so a teacher online always gets
 *   the newest version; with no answer it opens the copy kept here.
 * - The app's own files (named by their contents, so a name never changes meaning) come from here.
 * - Pictures (the characters, the tour) and the fonts are kept as they are first used, and freshened
 *   in the background, in caches that outlast an update.
 * - Everything else of Google's (sign-in, saving to the account, Drive) is left alone: Firebase
 *   keeps its own offline copy and catches up.
 */
const VERSION = '__VERSION__'
const PRECACHE = __PRECACHE__
const APP = `classyes-app-${VERSION}`
const PICTURES = 'classyes-pictures'
const FONTS = 'classyes-fonts'
const SCOPE = self.registration.scope
const INDEX = new URL('index.html', SCOPE).href
// A kept file is the same file whoever asks: the page's own requests carry headers (Origin) the
// keeping didn't, and a server that marks its answers "Vary" would otherwise miss every one.
const MATCH = { ignoreVary: true }

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP)
      .then((cache) => cache.addAll(PRECACHE.map((path) => new Request(new URL(path, SCOPE).href, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('classyes-app-') && k !== APP).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

/** The internet first, for a few seconds; the kept copy if it doesn't answer. */
async function networkFirst(request) {
  const cache = await caches.open(APP)
  try {
    const response = await Promise.race([fetch(request), new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), 4000))])
    if (response.ok) cache.put(INDEX, response.clone())
    return response
  } catch {
    return (await cache.match(INDEX, MATCH)) || (await cache.match(request, MATCH)) || Response.error()
  }
}

async function cacheFirst(request, name) {
  const cache = await caches.open(name)
  const kept = await cache.match(request, MATCH)
  if (kept) return kept
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

/** The kept copy at once, freshened in the background for next time. */
async function keptThenFresh(request, name) {
  const cache = await caches.open(name)
  const kept = await cache.match(request, MATCH)
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone())
      return response
    })
    .catch(() => kept)
  return kept || fresh
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(keptThenFresh(request, FONTS))
    return
  }
  if (!request.url.startsWith(SCOPE)) return
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }
  const path = url.pathname.slice(new URL(SCOPE).pathname.length)
  if (path.startsWith('assets/')) event.respondWith(cacheFirst(request, APP))
  else if (path.startsWith('avatars/') || path.startsWith('tour/')) event.respondWith(keptThenFresh(request, PICTURES))
  else event.respondWith(keptThenFresh(request, APP))
})
