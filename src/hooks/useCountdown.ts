import { useCallback, useEffect, useRef, useState } from 'react'

const MAX_MINUTES = 99
const MAX_SECONDS_DIGIT = 59

export type WarningLevel = 'none' | 'yellow' | 'orange' | 'red'

export function useCountdown(onComplete: () => void) {
  const [configuredSeconds, setConfiguredSeconds] = useState(5 * 60)
  const [remainingSeconds, setRemainingSeconds] = useState(5 * 60)
  const [running, setRunning] = useState(false)

  const endTimestampRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const clearTick = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
  }, [])

  useEffect(() => clearTick, [clearTick])

  const adjustMinutes = useCallback(
    (delta: number) => {
      if (running) return
      setConfiguredSeconds((prev) => {
        const minutes = Math.floor(prev / 60)
        const seconds = prev % 60
        const nextMinutes = Math.min(MAX_MINUTES, Math.max(0, minutes + delta))
        const next = nextMinutes * 60 + seconds
        setRemainingSeconds(next)
        return next
      })
    },
    [running],
  )

  const adjustSeconds = useCallback(
    (delta: number) => {
      if (running) return
      setConfiguredSeconds((prev) => {
        const minutes = Math.floor(prev / 60)
        const seconds = prev % 60
        const nextSeconds = Math.min(MAX_SECONDS_DIGIT, Math.max(0, seconds + delta))
        const next = Math.min(MAX_MINUTES, minutes) * 60 + nextSeconds
        setRemainingSeconds(next)
        return next
      })
    },
    [running],
  )

  const start = useCallback(() => {
    if (remainingSeconds <= 0) return
    setRunning(true)
    endTimestampRef.current = Date.now() + remainingSeconds * 1000
    clearTick()
    intervalRef.current = setInterval(() => {
      if (!endTimestampRef.current) return
      const secondsLeft = Math.max(0, Math.round((endTimestampRef.current - Date.now()) / 1000))
      setRemainingSeconds(secondsLeft)
      if (secondsLeft <= 0) {
        clearTick()
        setRunning(false)
        onCompleteRef.current()
      }
    }, 250)
  }, [remainingSeconds, clearTick])

  const pause = useCallback(() => {
    setRunning(false)
    clearTick()
  }, [clearTick])

  const stop = useCallback(() => {
    setRunning(false)
    clearTick()
    setConfiguredSeconds(0)
    setRemainingSeconds(0)
  }, [clearTick])

  const percentRemaining = configuredSeconds > 0 ? remainingSeconds / configuredSeconds : 1
  let warningLevel: WarningLevel = 'none'
  if (remainingSeconds > 0) {
    if (percentRemaining <= 0.25) warningLevel = 'red'
    else if (percentRemaining <= 0.35) warningLevel = 'orange'
    else if (percentRemaining <= 0.45) warningLevel = 'yellow'
  }

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60

  return {
    minutes,
    seconds,
    running,
    warningLevel,
    adjustMinutes,
    adjustSeconds,
    start,
    pause,
    stop,
  }
}
