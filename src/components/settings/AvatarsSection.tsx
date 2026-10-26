import { CircleAlert, CircleCheck, CircleUserRound, CloudDownload, ImagePlus, Pointer, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { AvatarScope } from '../../hooks/useClasses'
import { warmUpFaceFinder } from '../../lib/photoCrop'
import { STICKER_THEMES, deskPicturesOf, stickerSrc, type DeskPictures } from '../../lib/stickers'
import type { ClassData } from '../../types'
import { NoAvatarPicture } from '../NoAvatarPicture'
import { Btn, Group, MoreRow, SubHead, Tick } from './parts'

interface AvatarsSectionProps {
  activeClass: ClassData
  /** Signed in with Google: photos live in the teacher's own Drive, so they need it. */
  signedIn: boolean
  onSetDeskPictures: (shows: DeskPictures) => void
  /** Students come up to the board and choose their own (Choose Your Avatar); the window closes. */
  onStudentsChoose: () => void
  /** The group cards cover the desks: choosing waits until the activity is over. */
  studentsChooseBlocked: boolean
  onAssignAvatars: (themeId: string, options: { scope: AvatarScope; poses: 'mixed' | 'same' }) => void
  /** Photos chosen with Add Photos: Add Photos' window takes them from here. */
  onPhotosChosen: (files: File[]) => void
  onAskRemoveAllPhotos: () => void
  /** Photos this computer hasn't got yet, Get Photos to bring them down, and how that went. */
  photosNotHere: number
  onGetPhotos: () => void
  gettingPhotos: boolean
  photosProblem: string | null
}

const SHOWS: { shows: DeskPictures; label: string; says: string }[] = [
  { shows: 'characters', label: 'Characters', says: "Each student's own character." },
  { shows: 'photos', label: 'Photos', says: 'A photo, or their character if none.' },
  { shows: 'names', label: 'Names', says: 'Names only. Pictures are kept.' },
]

/**
 * Avatars, all in one place: what the desks show - characters, photos or names, each student's
 * character and photo kept whichever it is - a character for the whole class in one tap, the
 * children choosing their own at the board, and the class's photos. One student's own avatar or
 * photo is chosen from their picture in Students.
 */
export function AvatarsSection({
  activeClass,
  signedIn,
  onSetDeskPictures,
  onStudentsChoose,
  studentsChooseBlocked,
  onAssignAvatars,
  onPhotosChosen,
  onAskRemoveAllPhotos,
  photosNotHere,
  onGetPhotos,
  gettingPhotos,
  photosProblem,
}: AvatarsSectionProps) {
  const [scope, setScope] = useState<AvatarScope>('all')
  const [poses, setPoses] = useState<'mixed' | 'same'>('mixed')
  const [given, setGiven] = useState<number | null>(null)
  // More options: a character for every student, and the photos' Get and Remove All (2026-10-26).
  const [more, setMore] = useState(false)
  const files = useRef<HTMLInputElement>(null)
  const shows = deskPicturesOf(activeClass)
  const students = activeClass.students
  const boys = students.filter((s) => s.gender === 'boy').length
  const girls = students.filter((s) => s.gender === 'girl').length
  const none = students.length === 0
  const seated = activeClass.seating.some(Boolean)
  const withPhoto = students.filter((s) => s.photo).length
  const firstTheme = STICKER_THEMES[0]

  function give(themeId: string) {
    onAssignAvatars(themeId, { scope, poses })
    setGiven(scope === 'all' ? students.length : scope === 'boy' ? boys : girls)
  }

  const fileInput = (
    <input
      ref={files}
      type="file"
      multiple
      accept="image/*,.heic,.heif"
      className="hidden"
      onChange={(e) => {
        const chosen = Array.from(e.target.files ?? [])
        e.target.value = ''
        if (chosen.length > 0) onPhotosChosen(chosen)
      }}
    />
  )
  const photosLine = photosProblem ? (
    <span className="inline-flex items-center gap-1 text-destructive">
      <CircleAlert size={14} /> {photosProblem}
    </span>
  ) : photosNotHere > 0 ? (
    `${photosNotHere} ${photosNotHere === 1 ? "isn't" : "aren't"} on this computer yet.`
  ) : (
    `${withPhoto} of ${students.length} have a photo.`
  )

  if (more) {
    return (
      <>
        <SubHead back="Avatars" title="More options" onBack={() => setMore(false)} />
        <Group head="Teacher gives every student a character" guide="give-character">
          <div className="cs-row cs-stack" style={shows === 'names' || none ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="cs-row-label">
                {given !== null ? (
                  <span className="cs-note text-emerald-700">
                    <CircleCheck size={16} /> Given to {given} {given === 1 ? 'student' : 'students'}.
                  </span>
                ) : (
                  <small>Choose who, then tap a character.</small>
                )}
              </div>
              <div className="cs-seg" role="group" aria-label="Who">
                <button type="button" aria-pressed={scope === 'all'} onClick={() => (setScope('all'), setGiven(null))}>
                  Everyone ({students.length})
                </button>
                <button
                  type="button"
                  aria-pressed={scope === 'boy'}
                  disabled={boys === 0}
                  onClick={() => (setScope('boy'), setGiven(null))}
                >
                  Boys ({boys})
                </button>
                <button
                  type="button"
                  aria-pressed={scope === 'girl'}
                  disabled={girls === 0}
                  onClick={() => (setScope('girl'), setGiven(null))}
                >
                  Girls ({girls})
                </button>
              </div>
              <div className="cs-seg" role="group" aria-label="Poses">
                <button type="button" aria-pressed={poses === 'mixed'} onClick={() => (setPoses('mixed'), setGiven(null))}>
                  Mixed poses
                </button>
                <button type="button" aria-pressed={poses === 'same'} onClick={() => (setPoses('same'), setGiven(null))}>
                  Same pose
                </button>
              </div>
            </div>
            <div className="cs-pics cs-chars">
              {STICKER_THEMES.map((theme) => (
                <button key={theme.id} type="button" className="cs-pic" onClick={() => give(theme.id)}>
                  <img src={stickerSrc(theme.id, theme.idle)} alt="" draggable={false} loading="lazy" />
                  <span className="w-full truncate">{theme.label}</span>
                </button>
              ))}
            </div>
            <span className="cs-hint cs-hide-short">
              {given !== null
                ? 'Tap the same one again for new poses.'
                : shows === 'photos'
                  ? 'For students with no photo. To choose for one student, tap their picture in Students.'
                  : 'To choose for one student, tap their picture in Students.'}
            </span>
          </div>
        </Group>
        {shows === 'photos' && (
          <Group head="Photos">
            <div className="cs-row">
              <div className="cs-row-label">
                <b>Get Photos</b>
                <small>{photosNotHere > 0 ? photosLine : 'Photos another computer added come down by themselves.'}</small>
              </div>
              <Btn small disabled={gettingPhotos || photosNotHere === 0} onClick={onGetPhotos} data-guide="get-photos">
                <CloudDownload /> {gettingPhotos ? 'Getting…' : 'Get Photos'}
              </Btn>
            </div>
            <div className="cs-row">
              <div className="cs-row-label">
                <b>Remove All photos</b>
                <small>Every photo goes to the bin in your Google Drive. It asks first.</small>
              </div>
              <Btn kind="red" small disabled={withPhoto === 0} onClick={onAskRemoveAllPhotos} data-guide="remove-photos">
                <Trash2 /> Remove All
              </Btn>
            </div>
          </Group>
        )}
      </>
    )
  }

  return (
    <>
      <Group head="On the desks" guide="desk-pictures">
        <div className="cs-row cs-stack">
          <div className="cs-choices">
            {SHOWS.map((s) => {
              const needsSignIn = s.shows === 'photos' && !signedIn
              return (
                <button
                  key={s.shows}
                  type="button"
                  className="cs-choice"
                  aria-pressed={shows === s.shows}
                  disabled={needsSignIn}
                  title={needsSignIn ? 'Sign in with Google to use photos' : undefined}
                  onClick={() => {
                    onSetDeskPictures(s.shows)
                    setGiven(null)
                  }}
                >
                  {s.shows === 'characters' ? (
                    <img src={stickerSrc(firstTheme.id, firstTheme.idle)} alt="" className="h-6 w-6 shrink-0" />
                  ) : s.shows === 'photos' ? (
                    <CircleUserRound className="h-6 w-6 shrink-0" />
                  ) : (
                    <NoAvatarPicture className="h-6 w-6 shrink-0" />
                  )}
                  {s.label}
                  {shows === s.shows && <Tick />}
                </button>
              )
            })}
          </div>
          <span className="cs-hint">{SHOWS.find((s) => s.shows === shows)?.says}</span>
        </div>
      </Group>
      {shows === 'photos' && (
        <div className="cs-group">
          <div className="cs-row" data-guide="add-photos">
            <div className="cs-row-label">
              <b>Add Photos</b>
              <small>Choose a whole class of photos at once. They stay in your Google Drive. {photosLine}</small>
            </div>
            <Btn
              kind="primary"
              disabled={none}
              onClick={() => {
                warmUpFaceFinder()
                files.current?.click()
              }}
            >
              <ImagePlus /> Add Photos
            </Btn>
            {fileInput}
          </div>
        </div>
      )}
      {shows === 'characters' && (
        <div className="cs-group">
          <div className="cs-row" data-guide="let-choose">
            <div className="cs-row-label">
              <b>Let Students Choose</b>
              <small>Each child taps their desk at the board and picks a character.</small>
            </div>
            <Btn
              kind="primary"
              aria-label="Let Students Choose"
              disabled={!seated || studentsChooseBlocked}
              title={studentsChooseBlocked ? 'Finish the group activity first' : undefined}
              onClick={onStudentsChoose}
            >
              <Pointer /> Start
            </Btn>
          </div>
        </div>
      )}
      {shows !== 'names' && (
        <MoreRow
          inside={
            shows === 'photos'
              ? 'Teacher gives every student a character, Get Photos, Remove All photos'
              : 'Teacher gives every student a character'
          }
          onClick={() => setMore(true)}
        />
      )}
    </>
  )
}
