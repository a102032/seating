/**
 * Done, on a desk whose work the teacher has checked and finished (the Line, 2026-10-15): the
 * teacher's own picture (a tick in a circle, two sparks either side, and DONE), drawn in strokes so
 * it stays sharp on any board. Coloured here: the tick and circle green, the sparks gold, the word a
 * deeper green, over a faint green disc so it reads as a badge on a faint desk. Lighter in the dark
 * themes (Dark and Chalkboard), where the deep greens would sink into the desk.
 */
export function DoneIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 512 512"
      aria-label="Done"
      role="img"
      data-done-mark=""
      className={className}
      style={style}
      fill="none"
      strokeWidth={40}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="256" cy="160" r="128" className="fill-emerald-400/20 dark:fill-emerald-300/20" stroke="none" />
      <g className="stroke-emerald-600 dark:stroke-emerald-300">
        <polyline points="208.527,163.814 249.17,198.149 303.473,119.36" />
        <path d="M383.05 220.007c8.519-18.109 13.29-38.329 13.29-59.667C396.34 82.832 333.508 20 256 20S115.66 82.832 115.66 160.34 178.492 300.68 256 300.68c19.551 0 38.166-4.003 55.077-11.226" />
      </g>
      <g className="stroke-amber-400 dark:stroke-amber-300">
        <line x1="452.477" y1="43.78" x2="442.886" y2="54.983" />
        <line x1="492" y1="113.219" x2="473.226" y2="115.008" />
        <line x1="59.523" y1="43.78" x2="69.114" y2="54.983" />
        <line x1="20" y1="113.219" x2="38.774" y2="115.008" />
      </g>
      <g className="stroke-emerald-700 dark:stroke-emerald-200">
        <path d="M92.964 438.053c0 29.728-16.24 53.252-42.006 53.709C42.381 491.915 20.215 492 20.215 492L20 384.106s19.942 0 30.078 0C78.338 384.106 92.964 408.325 92.964 438.053z" />
        <ellipse cx="199.441" cy="436.409" rx="54.718" ry="55.591" />
        <path d="M310.983 492V381.025l73.85 108.647c1.369 2.01 2.836 1.025 2.836-1.419l-1.023-107.436" />
        <polyline points="492,381.832 446.309,381.832 446.309,492 492,492" />
        <line x1="488.631" y1="436.916" x2="446.309" y2="436.916" />
      </g>
    </svg>
  )
}
