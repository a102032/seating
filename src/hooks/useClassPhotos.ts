import { useCallback, useEffect, useState } from 'react'
import { driveProblem, withDrive, withDriveIfPassed } from '../lib/drive'
import { bringDown, keepOnly, missingPhotos } from '../lib/photos'
import { deskPicturesOf } from '../lib/stickers'
import type { ClassData } from '../types'

const shownPhotos = (cls: ClassData | undefined): string[] =>
  cls && deskPicturesOf(cls) === 'photos' ? cls.students.flatMap((s) => (s.photo ? [s.photo] : [])) : []

/**
 * The class's photos on this computer. A photo added on another computer arrives as a file's id
 * and is brought down from the teacher's Drive: straight away while a Drive pass is in hand (the
 * hour after any Drive action), or else with the tap that opens the class from the splash - the
 * one moment Google's window may open by itself, and only when there is a photo to bring down.
 * Get Photos, in Class Settings' Avatars, does the same from a tap whenever it is wanted. Until a
 * photo arrives the desk shows the student's character.
 */
export function useClassPhotos(classes: ClassData[], activeClass: ClassData | undefined, uid: string | undefined) {
  const [notHere, setNotHere] = useState(0)
  const [getting, setGetting] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const ids = shownPhotos(activeClass)
  const key = ids.join(',')

  useEffect(() => {
    let stopped = false
    setProblem(null)
    if (ids.length === 0) {
      setNotHere(0)
      return
    }
    void (async () => {
      const missing = await missingPhotos(ids)
      if (stopped) return
      setNotHere(missing.length)
      if (missing.length === 0) return
      try {
        if ((await withDriveIfPassed((token) => bringDown(token, missing))) !== null && !stopped) {
          setNotHere((await missingPhotos(ids)).length)
        }
      } catch {
        // Quietly: Get Photos, or the next class tap, tries again.
      }
    })()
    return () => {
      stopped = true
    }
    // The ids, by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  /**
   * From a tap: bring down what this computer hasn't got, opening Google's window if the hour's
   * pass has run out. `quiet` (the class tap) says nothing when it can't; Get Photos says why.
   */
  const getPhotos = useCallback(async (cls: ClassData | undefined, quiet = false) => {
    const wanted = shownPhotos(cls)
    const missing = await missingPhotos(wanted)
    if (missing.length === 0) return
    setGetting(true)
    setProblem(null)
    try {
      await withDrive((token) => bringDown(token, missing))
    } catch (error) {
      if (!quiet) setProblem(driveProblem(error))
    } finally {
      setGetting(false)
      setNotHere((await missingPhotos(wanted)).length)
    }
  }, [])

  // This computer lets go of copies no class uses any more: a photo replaced or removed anywhere,
  // a student or a class deleted. A moment after the classes settle, and only with some to go by.
  useEffect(() => {
    if (!uid || classes.length === 0) return
    const timer = setTimeout(
      () => void keepOnly(new Set(classes.flatMap((c) => c.students.flatMap((s) => (s.photo ? [s.photo] : []))))),
      5000,
    )
    return () => clearTimeout(timer)
  }, [classes, uid])

  return { notHere, getting, problem, getPhotos }
}
