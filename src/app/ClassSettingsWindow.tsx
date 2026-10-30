import type { ComponentProps } from 'react'
import { ClassSettingsModal } from '../components/ClassSettingsModal'
import type { useClasses } from '../hooks/useClasses'
import { MAX_CLASSES } from '../hooks/useClasses'
import type { useClassPhotos } from '../hooks/useClassPhotos'
import { binPhotos } from '../lib/drive'
import { playShuffle } from '../lib/sound'
import type { Theme } from '../lib/theme'
import type { ClassData } from '../types'
import type { SettingsWindow } from './useSettingsWindow'

type Store = ReturnType<typeof useClasses>

/** Class Settings for the class that is open, each change going straight to the class (useClasses). */
export function ClassSettingsWindow({
  settings: w,
  cls,
  store,
  theme,
  photos,
  onSwitchTeacher,
  onNewClass,
  onMixUpSeats,
  onStudentsChoose,
  studentsChooseBlocked,
  tools,
}: {
  settings: SettingsWindow
  cls: ClassData
  store: Store
  theme: Theme
  photos: ReturnType<typeof useClassPhotos>
  onSwitchTeacher: () => void
  onNewClass: () => void
  /** Before the seats are mixed up: a pick is ringed by desk, and that desk now holds somebody else. */
  onMixUpSeats: () => void
  onStudentsChoose: () => void
  studentsChooseBlocked: boolean
  tools: ComponentProps<typeof ClassSettingsModal>['tools']
}) {
  const { cloud } = store
  const uid = cloud.account?.uid
  /**
   * A photo the teacher took out - removed, replaced, its student or class deleted - goes to the
   * bin in their Drive, so a child's photo never stays behind after the child has left the class.
   */
  const binStudentPhotos = (studentIds: string[]) => {
    if (!uid) return
    const ids = new Set(studentIds)
    binPhotos(
      uid,
      cls.students.flatMap((s) => (ids.has(s.id) && s.photo ? [{ file: s.photo }] : [])),
    )
  }

  return (
    <ClassSettingsModal
      open={w.open}
      onClose={w.close}
      section={w.section}
      onSection={w.setSection}
      activeClass={cls}
      classes={store.classes}
      cloud={cloud}
      onSwitchTeacher={onSwitchTeacher}
      onNewClass={onNewClass}
      canAddClass={store.classes.length < MAX_CLASSES}
      onGuide={() => w.startGuide(w.section)}
      onTour={w.openTour}
      onRename={(name) => store.renameClass(cls.id, name)}
      onSetLayout={(layout, rows) => store.setLayout(cls.id, layout, rows)}
      onSetShowAllHomerooms={(show) => store.setShowAllHomerooms(cls.id, show)}
      theme={theme}
      onSetTheme={(next) => store.setClassTheme(cls.id, next)}
      onDeleteClass={() => {
        // The class's photo folder goes to Drive's bin with it, if it ever had one.
        if (uid) binPhotos(uid, [{ classId: cls.id }])
        store.deleteClass(cls.id)
      }}
      onAddStudents={(students) => store.addStudents(cls.id, students)}
      onRemoveStudents={(studentIds) => {
        binStudentPhotos(studentIds)
        store.deleteStudents(cls.id, studentIds)
      }}
      onReplaceStudents={(students) => {
        binStudentPhotos(cls.students.map((s) => s.id))
        return store.replaceStudents(cls.id, students)
      }}
      onUpdateStudent={(studentId, patch) => store.updateStudent(cls.id, studentId, patch)}
      onDeleteStudent={(studentId) => {
        binStudentPhotos([studentId])
        store.deleteStudent(cls.id, studentId)
      }}
      onUnseatStudent={(studentId) => store.unseatStudent(cls.id, studentId)}
      onUnseatAll={() => store.unseatAll(cls.id)}
      onSeatClass={() => store.seatClass(cls.id)}
      onMixUpSeats={() => {
        onMixUpSeats()
        store.mixUpSeats(cls.id)
        playShuffle()
      }}
      onSetDeskPictures={(shows) => store.setDeskPictures(cls.id, shows)}
      onPhotosSaved={(saved) => {
        binStudentPhotos(Object.keys(saved).filter((id) => cls.students.some((s) => s.id === id && s.photo && s.photo !== saved[id])))
        store.setStudentPhotos(cls.id, saved)
      }}
      onRemovePhotos={(studentIds) => {
        binStudentPhotos(studentIds)
        store.setStudentPhotos(cls.id, Object.fromEntries(studentIds.map((id) => [id, undefined])))
      }}
      photosNotHere={photos.notHere}
      onGetPhotos={() => void photos.getPhotos(cls)}
      gettingPhotos={photos.getting}
      photosProblem={photos.problem}
      onSetChartPhotos={(on) => store.setChartPhotos(cls.id, on)}
      onStudentsChoose={onStudentsChoose}
      studentsChooseBlocked={studentsChooseBlocked}
      onAssignAvatars={(themeId, options) => store.assignAvatars(cls.id, themeId, options)}
      onSetPointsMode={(mode) => store.setPointsMode(cls.id, mode)}
      onSetStarsOnDesks={(on) => store.setStarsOnDesks(cls.id, on)}
      onSetGoal={(goal) => store.setGoal(cls.id, goal)}
      onSetCelebrationGif={(gifId) => store.setCelebrationGif(cls.id, gifId)}
      onSetQuestPrizes={(prizes) => store.setQuestPrizes(cls.id, prizes)}
      onRestartQuest={() => store.restartMarbleJar(cls.id)}
      onSetClassPoints={(points) => store.setClassPoints(cls.id, points)}
      onResetClassGoal={() => store.resetClassGoal(cls.id)}
      onClearDeskStars={() => store.clearDeskStars(cls.id)}
      tools={tools}
      onToggleAbsentInRecord={(studentId, day) => store.toggleAbsentInRecord(cls.id, studentId, day)}
      onSetParticipation={(day, studentId, count) => store.setParticipation(cls.id, day, studentId, count)}
      onClearParticipationDay={(day) => store.clearParticipationDay(cls.id, day)}
      onClearParticipation={() => store.clearParticipation(cls.id)}
    />
  )
}
