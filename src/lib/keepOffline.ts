import type { ClassData } from '../types'
import { resolveAvatarSrc } from './stickers'

/**
 * The characters on this board's desks, kept for the offline app (src/sw/serviceWorker.js keeps the
 * rest). The worker keeps a picture as it is first fetched, but a board's first visit draws its
 * desks before the worker has started, so they would be missing the first morning with no wifi.
 * Once it is ready, every character the classes use is fetched into its picture cache, the ones
 * not there yet only. Only in the built app, as the worker is.
 */
export function keepPicturesOffline(classes: ClassData[]): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !('caches' in window)) return
  const urls = [...new Set(classes.flatMap((c) => c.students.map(resolveAvatarSrc)).filter((u): u is string => !!u))]
  navigator.serviceWorker.ready
    .then(async () => {
      const cache = await caches.open('classyes-pictures')
      for (const url of urls) {
        const full = new URL(url, location.href).href
        if (!(await cache.match(full, { ignoreVary: true }))) await cache.add(full).catch(() => {})
      }
    })
    .catch(() => {})
}
