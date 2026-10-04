/**
 * "No Avatar", drawn as what it gives: a desk with just a name in the middle and the homeroom
 * number under it. Used for the choice in both avatar windows and for such a student in the
 * roster, so the picture a teacher taps is the desk they'll get. An SVG, so it reads the same
 * at roster size and at tile size, in the theme's own desk and name colours.
 */
export function NoAvatarPicture({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path
        d="M14 30 Q14 16 28 16 H72 Q86 16 86 30 V86 H14 Z"
        fill="var(--card)"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* The name, then the homeroom number under it. */}
      <rect x="27" y="45" width="46" height="11" rx="5.5" fill="var(--desk-name, var(--card-foreground))" />
      <rect x="40" y="62" width="20" height="7" rx="3.5" fill="var(--desk-name, var(--card-foreground))" opacity="0.45" />
    </svg>
  )
}
