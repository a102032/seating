import clsx from 'clsx'
import { Cloud, CloudAlert, CloudCheck, CloudOff } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useState } from 'react'
import type { Account } from '../lib/cloud'
import { initialOf } from '../lib/teacherName'
import type { AccountQuestion, SyncStatus } from '../hooks/useCloudSync'
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

/** Google's G, in its own colours, as Google asks its sign-in buttons to show it. */
export function GoogleG({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={clsx('shrink-0', className)} aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/** The teacher's initial in a circle: whose classes these are, at a glance. */
export function Initial({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={clsx('flex shrink-0 items-center justify-center rounded-full bg-[#7c4ddf] font-bold text-white', className)}
      aria-hidden
    >
      {initialOf(name)}
    </span>
  )
}

// Both windows here can open over the splash screen, which sits above the app's usual windows.
const ABOVE_SPLASH = 'z-[90]'

/**
 * Switch teacher asks first, and says what happens: the classes are safe in the account, and the
 * board forgets them. If this board has changes the account hasn't got yet (no internet), it
 * says so, because switching now would lose them.
 */
export function SwitchTeacherModal({
  account,
  open,
  unsent,
  onCancel,
  onConfirm,
}: {
  account: Account
  open: boolean
  unsent: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const [leaving, setLeaving] = useState(false)
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && !leaving && onCancel()}>
      <AlertDialogContent className={ABOVE_SPLASH} overlayClassName={ABOVE_SPLASH}>
        <div className="flex items-start gap-3">
          <Initial name={account.firstName} className="mt-0.5 size-9" />
          <div className="flex flex-col gap-2 pt-1">
            <AlertDialogTitle>Switch teacher?</AlertDialogTitle>
            <AlertDialogDescription>
              {account.firstName}'s classes are safe in the Google account. This board forgets them until {account.firstName} signs in
              again, so the next teacher sees only their own.
            </AlertDialogDescription>
            {unsent && (
              <p className="font-semibold text-amber-700 dark:text-amber-400">
                This board has changes that haven't reached the account yet. Switching now loses them.
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" size="lg" onClick={onCancel} disabled={leaving}>
            No
          </Button>
          <Button
            size="lg"
            disabled={leaving}
            onClick={() => {
              setLeaving(true)
              onConfirm()
            }}
          >
            {leaving ? 'Switching…' : 'Yes, Switch'}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 'es'}`

function ClassChips({ classes }: { classes: AccountQuestion['boardClasses'] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {classes.map((c) => (
        <span key={c.id} className="rounded-xl bg-secondary px-3 py-1.5 font-bold text-secondary-foreground">
          {c.name} · {c.students.length}
        </span>
      ))}
    </div>
  )
}

/**
 * The first sign-in on a computer that already has classes: add them to the account, once. Saying
 * no puts them aside on this board, and they come back when this teacher switches out. If the
 * two together would pass the class limit, adding isn't offered.
 */
export function AccountQuestionModal({ question, onAnswer }: { question: AccountQuestion | null; onAnswer: (add: boolean) => void }) {
  if (!question) return null
  const { boardClasses, accountClasses, fits } = question
  const total = boardClasses.length + accountClasses.length
  return (
    <AlertDialog open>
      <AlertDialogContent className={clsx(ABOVE_SPLASH, 'max-w-xl')} overlayClassName={ABOVE_SPLASH}>
        <AlertDialogTitle>{fits ? "Add this board's classes to your account?" : 'This board has classes of its own'}</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="flex flex-col gap-3">
            <p>
              This board has {plural(boardClasses.length, 'class')} that {boardClasses.length === 1 ? "isn't" : "aren't"} in your Google
              account yet:
            </p>
            <ClassChips classes={boardClasses} />
            <p>
              Your account has {plural(accountClasses.length, 'class')}
              {accountClasses.length <= 3 && (
                <>
                  : <span className="font-bold text-foreground">{accountClasses.map((c) => c.name).join(', ')}</span>
                </>
              )}
              .{' '}
              {fits
                ? `Add them, and you'll have all ${total}, here and everywhere you sign in.`
                : `A teacher can have 5 classes, so these can't be added.`}
            </p>
            <p className="text-sm">
              {fits
                ? 'If you say no, they stay on this board, and come back when you switch teacher.'
                : 'They stay on this board, and come back when you switch teacher.'}
            </p>
          </div>
        </AlertDialogDescription>
        <div className="flex justify-end gap-2 pt-1">
          {fits ? (
            <>
              <Button variant="secondary" size="lg" onClick={() => onAnswer(false)}>
                No, only my account's
              </Button>
              <Button size="lg" onClick={() => onAnswer(true)}>
                Yes, add them
              </Button>
            </>
          ) : (
            <Button size="lg" onClick={() => onAnswer(false)}>
              OK
            </Button>
          )}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}

const MARKS: Record<SyncStatus, { Icon: typeof Cloud; label: string; className: string }> = {
  saved: { Icon: CloudCheck, label: 'Saved', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' },
  connecting: { Icon: Cloud, label: 'Connecting', className: 'bg-muted text-muted-foreground' },
  offline: {
    Icon: CloudOff,
    label: 'Offline · will catch up',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  },
  error: { Icon: CloudAlert, label: 'Not saving', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' },
}

/** The same mark, only to read: in Class Settings' Google tab, beside the account. */
export function SyncBadge({ status, needsSignIn }: { status: SyncStatus; needsSignIn: boolean }) {
  const mark = MARKS[needsSignIn ? 'error' : status]
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold', mark.className)}>
      <mark.Icon size={14} />
      {mark.label}
    </span>
  )
}

function statusSentence(status: SyncStatus, needsSignIn: boolean): string {
  if (needsSignIn) return 'Sign in again to keep saving to your account.'
  switch (status) {
    case 'saved':
      return 'Everything is saved to your account.'
    case 'connecting':
      return 'Connecting to your account.'
    case 'offline':
      return "No internet. Changes are kept on this board, and go to your account when it's back."
    case 'error':
      return "Changes aren't reaching your account right now. They're kept on this board."
  }
}

/**
 * Where "Not saving" sits at the foot of the side panel: Saved, or catching up. A tap shows whose
 * account the classes are in, and Switch teacher. Nothing else on the panel moves for it.
 */
export function SyncMark({
  account,
  status,
  needsSignIn,
  signingIn,
  signInError,
  disabled,
  side,
  onSignIn,
  onSwitchTeacher,
}: {
  account: Account
  status: SyncStatus
  needsSignIn: boolean
  signingIn: boolean
  signInError: string | null
  disabled: boolean
  side: 'left' | 'right'
  onSignIn: () => void
  onSwitchTeacher: () => void
}) {
  const [open, setOpen] = useState(false)
  const mark = MARKS[needsSignIn ? 'error' : status]
  return (
    <Popover.Root open={open && !disabled} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          data-sync={needsSignIn ? 'error' : status}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold active:scale-95 disabled:pointer-events-none disabled:opacity-30',
            mark.className,
          )}
        >
          <mark.Icon size={14} />
          {mark.label}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align={side === 'left' ? 'start' : 'end'}
          sideOffset={8}
          className="z-50 flex w-64 flex-col gap-3 rounded-2xl border border-black/5 bg-card p-3.5 text-card-foreground shadow-xl dark:border-white/10"
        >
          <div className="flex items-center gap-2.5">
            <Initial name={account.firstName} className="size-9" />
            <div className="min-w-0">
              <div className="truncate font-bold">{account.firstName}</div>
              <div className="truncate text-xs text-muted-foreground">{account.email}</div>
            </div>
          </div>
          <p
            className={clsx(
              'text-sm font-semibold',
              status === 'saved' && !needsSignIn ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400',
            )}
          >
            {statusSentence(status, needsSignIn)}
          </p>
          {signInError && <p className="text-sm text-destructive">{signInError}</p>}
          {needsSignIn && (
            <Button variant="outline" onClick={onSignIn} disabled={signingIn}>
              <GoogleG size={18} /> {signingIn ? 'Signing in…' : 'Sign in again'}
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setOpen(false)
              onSwitchTeacher()
            }}
          >
            Switch teacher
          </Button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
