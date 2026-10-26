import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SafetyNet } from './components/SafetyScreen'
import { keepLongPressMenuOut } from './lib/noLongPressMenu'

keepLongPressMenuOut(document)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* If anything on screen breaks, the board says the classes are safe, and a tap reloads. */}
    <SafetyNet>
      <App />
    </SafetyNet>
  </StrictMode>,
)
