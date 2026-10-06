/**
 * A long press anywhere in the app opens no menu (2026-10-06, the teacher). On a Windows touch
 * board a finger held still is a right-click, so a child holding a desk, or the teacher holding +1
 * in the floating window, got Chrome's menu (Back, Reload, Print...) over the lesson. Other apps
 * the teacher uses keep that menu out of their own area, and so does this one now. Text boxes keep
 * it, for pasting a name, and so do links, for copying one.
 *
 * It can't reach the floating window's title bar, which belongs to Windows and Chrome: holding it
 * still is still a right-click there, and a page isn't allowed to move that window itself, so a
 * drag handle of our own can't be built in the browser (see DECISIONS, "Floating class goal").
 */
export function keepLongPressMenuOut(doc: Document): () => void {
  const block = (e: Event) => {
    const target = e.target as Element | null
    if (target?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"], a[href]')) return
    e.preventDefault()
  }
  doc.addEventListener('contextmenu', block)
  return () => doc.removeEventListener('contextmenu', block)
}
