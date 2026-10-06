/**
 * The Class? Yes! Move extension (`tools/move-extension`), which moves the floating window as the
 * teacher slides the hand grip in it. A page may never move that window itself (the browsers'
 * rule for Document Picture-in-Picture), but an extension may move Chrome's windows. Without the
 * extension nothing changes: there is no grip, and the window moves by its title bar as before.
 */

/** The extension's id: fixed by the key in its manifest, so the test copy loaded by hand is always this one. */
const EXTENSION_IDS = ['glcgfniglahecgobfgjgdmbjnmakdpom']

interface ChromeRuntime {
  sendMessage(id: string, message: unknown, reply: (answer: unknown) => void): void
  lastError?: { message?: string }
}

/** Chrome puts `chrome.runtime` on the page only when an extension has said it may be asked from here. */
function runtime(): ChromeRuntime | null {
  const chrome = (window as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome
  return chrome?.runtime?.sendMessage ? chrome.runtime : null
}

/** One question to the extension; null if it isn't there or doesn't answer within a second. */
function ask<T>(id: string, message: unknown): Promise<T | null> {
  const rt = runtime()
  if (!rt) return Promise.resolve(null)
  return new Promise((resolve) => {
    const late = setTimeout(() => resolve(null), 1000)
    try {
      rt.sendMessage(id, message, (answer) => {
        clearTimeout(late)
        // Reading lastError is what tells Chrome the missing extension was expected.
        const failed = rt.lastError
        resolve(failed || !answer || (answer as { error?: string }).error ? null : (answer as T))
      })
    } catch {
      clearTimeout(late)
      resolve(null)
    }
  })
}

/** A window's place and size, in Chrome's own count (the screen's scaling taken off). */
export interface Bounds {
  left: number
  top: number
  width: number
  height: number
}

export interface Mover {
  /** Where the floating window is and its size, by the extension's count, with its id to move it by. */
  find(win: Window): Promise<(Bounds & { id: number }) | null>
  /** Put it here, at this size; what Chrome made of it comes back, or null if the move failed. */
  move(id: number, to: Bounds): Promise<Bounds | null>
}

let found: Promise<Mover | null> | null = null

/** The extension, if this Chrome has it. Asked once a page: installing it means reloading the app. */
export function findMover(): Promise<Mover | null> {
  if (found) return found
  found = (async () => {
    for (const id of EXTENSION_IDS) {
      if (!(await ask<{ version: string }>(id, { hello: true }))) continue
      return {
        find: (win) => ask(id, { find: { left: win.screenX, top: win.screenY, width: win.outerWidth, height: win.outerHeight } }),
        move: (windowId, to) => ask<Bounds>(id, { move: { id: windowId, ...to } }),
      }
    }
    return null
  })()
  return found
}
