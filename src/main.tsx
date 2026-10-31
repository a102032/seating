import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SafetyNet } from './components/SafetyScreen'
import { keepLongPressMenuOut } from './lib/noLongPressMenu'

keepLongPressMenuOut(document)

// The app kept on the computer, so it opens with no internet (src/sw/serviceWorker.js). Only in the
// built app: the dev server's files change under it, and a kept copy would hide every edit.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* If anything on screen breaks, the board says the classes are safe, and a tap reloads. */}
    <SafetyNet>
      <App />
    </SafetyNet>
  </StrictMode>,
)
