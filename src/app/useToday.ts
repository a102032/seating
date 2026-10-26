import { useEffect, useState } from 'react'
import { dateKey } from '../lib/attendance'

/**
 * Today, for the attendance record, the participation record and the Line. Re-read every minute and
 * whenever the app comes back into view, so a board left open overnight starts the morning with
 * everyone present rather than showing yesterday's absences until something happens to redraw it.
 */
export function useToday(): string {
  const [today, setToday] = useState(dateKey)
  useEffect(() => {
    const refresh = () => setToday(dateKey())
    const interval = setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return today
}
