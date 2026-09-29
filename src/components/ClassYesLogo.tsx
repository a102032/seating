/**
 * The Class? Yes! logo: the teacher's call and the room's answer, in chalk.
 *
 * Drawn here rather than shipped as a picture so it stays sharp on a big board, and so the
 * words are set in Andika - the single-storey `a` the students are taught to write. The
 * design came from a Gemini sketch; only the drawing was kept, the lettering is live text.
 */

const SLATE = '#3d4348'
const CHALK_WHITE = '#f4f1e8'
const CHALK_YELLOW = '#f7e3a1'
const CHALK_PINK = '#f4a6c0'
const INK = '#343a40'

/**
 * A speech bubble as one closed outline: an ellipse with a tail pulled out of it. One path
 * rather than an ellipse plus a triangle, so the chalk line runs unbroken round the tail.
 */
function bubblePath(cx: number, cy: number, rx: number, ry: number, from: number, to: number, tip: [number, number]) {
  const pts: string[] = []
  const steps = 72
  let tipDone = false
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    if (a > from && a < to) {
      if (!tipDone) pts.push(`${tip[0]} ${tip[1]}`)
      tipDone = true
      continue
    }
    pts.push(`${(cx + rx * Math.cos(a)).toFixed(1)} ${(cy + ry * Math.sin(a)).toFixed(1)}`)
  }
  return `M ${pts.join(' L ')} Z`
}

// Angles run clockwise from 3 o'clock (SVG's y points down), so ~2 rad is lower left.
const CALL = bubblePath(190, 150, 158, 84, 1.95, 2.35, [92, 262])
const ANSWER = bubblePath(452, 128, 150, 106, 0.72, 1.12, [566, 256])

export function ClassYesLogo({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 660 280" className={className} style={style} role="img" aria-label="Class? Yes!">
      <defs>
        {/* Chalk: a slight wobble on every edge, and a soft halo like dust round a line. */}
        <filter id="cy-chalk" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="wobble" />
          <feDisplacementMap in="SourceGraphic" in2="wobble" scale="4" xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feGaussianBlur in="rough" stdDeviation="5" result="halo" />
          <feColorMatrix in="halo" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.45 0" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="rough" />
          </feMerge>
        </filter>
        {/* Grain in the yellow fill, so it reads as chalk rubbed on rather than paint. */}
        <filter id="cy-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2" result="n" />
          <feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 0.62" result="holes" />
          <feComposite in="SourceGraphic" in2="holes" operator="in" />
        </filter>
      </defs>

      <g filter="url(#cy-chalk)">
        {/* The answer sits behind the call, the way the room's shout follows the teacher. */}
        <path d={ANSWER} fill={CHALK_YELLOW} />
        <path d={ANSWER} fill={SLATE} filter="url(#cy-grain)" opacity="0.12" />
        <path d={CALL} fill={SLATE} stroke={CHALK_WHITE} strokeWidth="9" strokeLinejoin="round" />

        {/* The shout: three strokes off the top right, and a pink sparkle. */}
        <g stroke={CHALK_YELLOW} strokeWidth="9" strokeLinecap="round">
          <path d="M 560 22 L 566 50" />
          <path d="M 604 34 L 586 62" />
          <path d="M 632 82 L 600 88" />
        </g>
        <path d="M 634 132 Q 636 146 648 148 Q 636 150 634 164 Q 632 150 620 148 Q 632 146 634 132 Z" fill={CHALK_PINK} />
      </g>

      <g fontFamily="Andika, ui-sans-serif, system-ui, sans-serif" fontWeight="700" textAnchor="middle">
        <text x="190" y="176" fontSize="76" fill={CHALK_WHITE}>
          Class?
        </text>
        <text x="456" y="166" fontSize="108" fill={INK}>
          Yes!
        </text>
      </g>
    </svg>
  )
}
