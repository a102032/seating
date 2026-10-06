// Class? Yes! Move. A page may never move its floating window (Document Picture-in-Picture): the
// browsers forbid it, so a site can't park an always-on-top window where it passes for part of
// another program. An extension may move Chrome's windows, so the app asks this one to, while
// the teacher slides the hand grip inside the window. On a Windows touch board that is the only
// way to move it by finger: its title bar is Windows', where a finger held still is a right-click.
//
// Only the app can ask (externally_connectable, in the manifest), and only to move a window it
// has just pointed out by where it is and its size - its own floating window.

/** The windows the app pointed out: nothing else is moved. */
const pointedOut = new Set()

chrome.runtime.onMessageExternal.addListener((msg, sender, reply) => {
  answer(msg).then(reply, (e) => reply({ error: String((e && e.message) || e) }))
  // The reply comes after the window is found or moved.
  return true
})

async function answer(msg) {
  if (msg.hello) return { version: chrome.runtime.getManifest().version }

  if (msg.find) {
    // The floating window is the Chrome window exactly where the page says it is, at its size.
    const { left, top, width, height } = msg.find
    let best = null
    let off = Infinity
    for (const w of await chrome.windows.getAll()) {
      const d = Math.abs(w.left - left) + Math.abs(w.top - top) + Math.abs(w.width - width) + Math.abs(w.height - height)
      if (d < off) {
        best = w
        off = d
      }
    }
    if (!best || off > 8) return { error: 'not found' }
    pointedOut.add(best.id)
    return { id: best.id, left: best.left, top: best.top }
  }

  if (msg.move) {
    const { id, left, top } = msg.move
    if (!pointedOut.has(id)) return { error: 'not found' }
    const w = await chrome.windows.update(id, { left: Math.round(left), top: Math.round(top) })
    return { left: w.left, top: w.top }
  }

  return { error: 'unknown' }
}
