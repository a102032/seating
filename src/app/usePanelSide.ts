import { useState } from 'react'

const PANEL_SIDE_KEY = 'seating-chart-panel-side-v1'

export type PanelSide = 'left' | 'right'

function loadPanelSide(): PanelSide {
  try {
    const raw = localStorage.getItem(PANEL_SIDE_KEY)
    return raw === 'right' ? 'right' : 'left'
  } catch {
    return 'left'
  }
}

/** Which side of the board the rail is on, kept on this board. */
export function usePanelSide(): [PanelSide, () => void] {
  const [side, setSide] = useState<PanelSide>(loadPanelSide)
  function toggle() {
    const next = side === 'left' ? 'right' : 'left'
    setSide(next)
    // A full or locked-down storage refuses a write by throwing. Unguarded, moving the panel
    // took the whole app down with it; now the choice just isn't remembered.
    try {
      localStorage.setItem(PANEL_SIDE_KEY, next)
    } catch {
      // ignore
    }
  }
  return [side, toggle]
}
