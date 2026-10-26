import { useState } from 'react'
import { SECTIONS, type SettingsSection } from '../components/ClassSettingsModal'
import { SetupGuide } from '../components/SetupGuide'
import { GUIDE_STEPS, rememberGuideDone, stepBefore, stepFrom, stepPlace, type GuideScope } from '../lib/setupGuide'
import type { ClassData } from '../types'

/**
 * Class Settings, the guide through it (lib/setupGuide) and the tour of the app: which section is
 * open, the step the guide is on, and whether the tour is up.
 */
export function useSettingsWindow(cls: ClassData | undefined, accountUid: string | undefined) {
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<SettingsSection>('class')
  /** The tour of the app, from Help in Class Settings, or offered at the end of a new class's setup. */
  const [tourOpen, setTourOpen] = useState(false)
  /** The guide through Class Settings, while it runs: which sections it walks, and the step it is on (lib/setupGuide). */
  const [guide, setGuide] = useState<{ scope: GuideScope; index: number } | null>(null)

  /** Class Settings opens on Class every time (2026-10-26, the teacher), unless a button opens its own section: the meter's chest Points, the flip cards' gear Tools. */
  function openAt(at: SettingsSection = 'class') {
    setSection(at)
    setOpen(true)
  }

  const guideContext = { cls: cls!, signedIn: Boolean(accountUid) }

  /** To step `from`, or the next one after it that applies; past the end, the guide is done. */
  function guideTo(scope: GuideScope, from: number) {
    const index = cls ? stepFrom(from, scope, { ...guideContext, showing: () => false }) : null
    if (index === null) {
      endGuide()
      return
    }
    setGuide({ scope, index })
    const at = GUIDE_STEPS[index].section
    if (at) openAt(at)
  }

  /** Back to the step before that applies, in its own section; on the first step there is none. */
  function guideBack(scope: GuideScope, from: number) {
    const index = cls ? stepBefore(from, scope, { ...guideContext, showing: () => false }) : null
    if (index === null) return
    setGuide({ scope, index })
    const at = GUIDE_STEPS[index].section
    if (at) openAt(at)
  }

  /** Help's Guide me walks the section that is open; a new class walks the whole setup. */
  function startGuide(scope: GuideScope) {
    guideTo(scope, 0)
  }

  /** Done or stopped: a new teacher's first sign-in doesn't start it again on this board. */
  function endGuide() {
    setGuide(null)
    if (accountUid) rememberGuideDone(accountUid)
  }

  function openTour() {
    if (guide) endGuide()
    setOpen(false)
    setTourOpen(true)
  }

  return {
    open,
    section,
    setSection,
    openAt,
    /** Class Settings closes and the board shows, the guide carrying on if it was running (Tools' Go There). */
    hide: () => setOpen(false),
    /** Done, or a tap outside: closing the window ends the guide; its last word, at Done, ends it too. */
    close: () => {
      setOpen(false)
      if (guide) endGuide()
    },
    guide,
    guideContext,
    guideTo,
    guideBack,
    startGuide,
    endGuide,
    tourOpen,
    openTour,
    closeTour: () => setTourOpen(false),
  }
}

export type SettingsWindow = ReturnType<typeof useSettingsWindow>

/** The guide's bubble over Class Settings, while it runs. */
export function SettingsGuide({ settings: w }: { settings: SettingsWindow }) {
  const guide = w.guide
  if (!guide) return null
  const step = GUIDE_STEPS[guide.index]
  const context = { ...w.guideContext, showing: () => false }
  const place = stepPlace(guide.index, guide.scope, context)
  return (
    <SetupGuide
      step={step}
      where={step.section ? `${SECTIONS.find((sec) => sec.id === step.section)!.label} · ${place.label}` : 'All done'}
      finish={place.finish}
      context={w.guideContext}
      // Next (it's done) and Skip (leave it as it is) both move on to the next thing.
      onNext={() => w.guideTo(guide.scope, guide.index + 1)}
      onSkip={() => w.guideTo(guide.scope, guide.index + 1)}
      onBack={() => w.guideBack(guide.scope, guide.index)}
      canGoBack={stepBefore(guide.index, guide.scope, context) !== null}
      onStop={w.endGuide}
      onTour={w.openTour}
    />
  )
}
