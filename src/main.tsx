import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { keepLongPressMenuOut } from './lib/noLongPressMenu'
import { MOCKUP, seedMockup } from './mockup/mockup'

keepLongPressMenuOut(document)
if (MOCKUP) seedMockup()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
