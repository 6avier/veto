import { formatMm } from '@/lib/format'
import { motion, useReducedMotion } from 'motion/react'

/**
 * A booth gimmick on /dispatch (CLAUDE.md §4, P2 polish): a translucent
 * outline of the truck's legal footprint, with the live form input drawn
 * inside it, and the excess coloured when a dimension goes over.
 *
 * Dimension limits are flat in the current rule base — unlike weight, they
 * do not vary by axle configuration (backend/apps/rules/migrations/
 * 0002_seed_odol_central_rules.py). This component never reads axleConfig.
 */
export default function TruckEnvelope({ length, width, height, limits }) {
  return (
    <section className="mt-4 border border-[#c9ced4] bg-white p-4">
      <p className="mb-3 text-label font-semibold text-[#1f2933]">Envelope Muatan</p>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <PlanView length={length} width={width} limits={limits} />
        <SideView height={height} limits={limits} />
      </div>
    </section>
  )
}

const CANVAS_PADDING = 1.2
const SIDE_VIEW_NOMINAL_WIDTH_MM = 3000
const OVER_COLOUR = '#a02a1f'
const NEUTRAL_COLOUR = '#2f8f4e'
const OUTER_STROKE = '#98a0a9'
const OUTER_FILL = '#f4f6f7'
const SPRING = { type: 'spring', stiffness: 90, damping: 12 }

/**
 * Geometry for one axis, in a fixed viewBox padded 20% past the legal limit
 * so overflow up to that much stays visible without the canvas growing
 * unbounded. Returns null when there is no limit to draw against yet
 * (limits still loading, or GET /rules failed and the fetch was swallowed
 * the same way Dispatch.jsx's own useEffect already swallows it).
 */
function axisGeometry(actualMm, legalMm) {
  if (!Number.isFinite(legalMm) || legalMm <= 0) return null
  const canvas = legalMm * CANVAS_PADDING
  const actual = Number.isFinite(actualMm) && actualMm > 0 ? actualMm : 0
  const innerSize = Math.min(actual, canvas)
  return {
    canvas,
    legalSize: legalMm,
    outerOffset: (canvas - legalMm) / 2,
    innerSize,
    innerOffset: (canvas - innerSize) / 2,
    over: actual > legalMm,
  }
}

function PlanView({ length, width, limits }) {
  const reduceMotion = useReducedMotion()
  const lengthGeo = axisGeometry(Number(length), limits.length?.threshold)
  const widthGeo = axisGeometry(Number(width), limits.width?.threshold)

  if (!lengthGeo || !widthGeo) return <EnvelopePlaceholder label="Tampak Atas" />

  const over = lengthGeo.over || widthGeo.over

  return (
    <EnvelopeFrame label="Tampak Atas">
      <svg
        viewBox={`0 0 ${lengthGeo.canvas} ${widthGeo.canvas}`}
        className="min-h-0 w-full flex-1"
      >
        <rect
          x={lengthGeo.outerOffset}
          y={widthGeo.outerOffset}
          width={lengthGeo.legalSize}
          height={widthGeo.legalSize}
          fill={OUTER_FILL}
          stroke={OUTER_STROKE}
          strokeWidth={2}
          strokeDasharray="8 6"
          vectorEffect="non-scaling-stroke"
        />
        <motion.rect
          initial={{
            x: lengthGeo.innerOffset,
            y: widthGeo.innerOffset,
            width: lengthGeo.innerSize,
            height: widthGeo.innerSize,
          }}
          animate={{
            x: lengthGeo.innerOffset,
            y: widthGeo.innerOffset,
            width: lengthGeo.innerSize,
            height: widthGeo.innerSize,
          }}
          transition={reduceMotion ? { duration: 0 } : SPRING}
          fill="none"
          stroke={over ? OVER_COLOUR : NEUTRAL_COLOUR}
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <EnvelopeReadout
        primary={`${formatMm(length)} × ${formatMm(width)}`}
        secondary={`Batas ${formatMm(limits.length?.threshold)} × ${formatMm(limits.width?.threshold)}`}
        over={over}
      />
    </EnvelopeFrame>
  )
}

function SideView({ height, limits }) {
  const reduceMotion = useReducedMotion()
  const heightGeo = axisGeometry(Number(height), limits.height?.threshold)

  if (!heightGeo) return <EnvelopePlaceholder label="Tampak Samping" />

  return (
    <EnvelopeFrame label="Tampak Samping">
      <div className="flex min-h-0 w-full flex-1 items-stretch gap-0">
        <SideCab />
        <svg
          viewBox={`0 0 ${SIDE_VIEW_NOMINAL_WIDTH_MM} ${heightGeo.canvas}`}
          preserveAspectRatio="xMinYMax meet"
          className="min-h-0 w-full flex-1"
        >
        <rect
          x={0}
          y={heightGeo.canvas - heightGeo.legalSize}
          width={SIDE_VIEW_NOMINAL_WIDTH_MM}
          height={heightGeo.legalSize}
          fill={OUTER_FILL}
          stroke={OUTER_STROKE}
          strokeWidth={2}
          strokeDasharray="8 6"
          vectorEffect="non-scaling-stroke"
        />
        <motion.rect
          x={0}
          width={SIDE_VIEW_NOMINAL_WIDTH_MM}
          initial={{ y: heightGeo.canvas - heightGeo.innerSize, height: heightGeo.innerSize }}
          animate={{ y: heightGeo.canvas - heightGeo.innerSize, height: heightGeo.innerSize }}
          transition={reduceMotion ? { duration: 0 } : SPRING}
          fill="none"
          stroke={heightGeo.over ? OVER_COLOUR : NEUTRAL_COLOUR}
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />
        </svg>
      </div>
      <EnvelopeReadout
        primary={formatMm(height)}
        secondary={`Batas ${formatMm(limits.height?.threshold)}`}
        over={heightGeo.over}
      />
    </EnvelopeFrame>
  )
}

/**
 * Fixed, decorative — never reads form values, never animates. Its own
 * small local viewBox rather than the mm-scale canvas the box uses, so it
 * needs no scaling/transform math to sit next to it: a plain flex row
 * keeps them visually adjacent. viewBox height (112) is cropped exactly to
 * the chassis line, so "the ground" is the literal bottom edge of this SVG,
 * matching how SideView's box is bottom-anchored.
 *
 * The `preserveAspectRatio` on both this SVG and SideView's box SVG is
 * load-bearing, not decoration. The default (`xMidYMid meet`) letterboxes
 * each viewBox independently — this one vertically, the box's horizontally
 * — which put the cab's ground line ~28px above the box's and opened a wide
 * gap between them. Anchoring this one bottom-RIGHT and the box bottom-LEFT
 * pins both to the seam they share. Verified by screenshot; it is not
 * visible from reading the coordinates.
 */
function SideCab() {
  return (
    <svg viewBox="0 0 100 112" preserveAspectRatio="xMaxYMax meet" className="h-full w-24 shrink-0">
      <line x1="0" y1="112" x2="100" y2="112" stroke="#1f2933" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <path
        d="M39,112 L39,92 L46,70 L58,46 L92,46 L92,112 Z"
        fill="#fff"
        stroke="#1f2933"
        strokeWidth="2.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M52,63 L61,50 L88,50 L88,58 Z"
        fill="#c4cad0"
        stroke="#1f2933"
        strokeWidth="1"
      />
      <line x1="76" y1="60" x2="76" y2="108" stroke="#98a0a9" strokeWidth="1.25" />
      <rect x="79" y="82" width="5" height="2.5" rx="1" fill="#1f2933" />
      <line x1="40" y1="88" x2="26" y2="78" stroke="#1f2933" strokeWidth="1.75" strokeLinecap="round" />
      <rect x="20" y="72" width="8" height="11" rx="2" fill="#fff" stroke="#1f2933" strokeWidth="1.5" />
    </svg>
  )
}

function EnvelopeFrame({ label, children }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-label text-[#5a646e]">{label}</p>
      <div className="flex h-56 w-full flex-col border border-[#c9ced4] p-3">{children}</div>
    </div>
  )
}

function EnvelopePlaceholder({ label }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-label text-[#5a646e]">{label}</p>
      <div className="flex h-56 w-full items-center justify-center border border-[#c9ced4] bg-[#f4f6f7]">
        <p className="text-label text-[#98a0a9]">Menunggu batas legal…</p>
      </div>
    </div>
  )
}

function EnvelopeReadout({ primary, secondary, over }) {
  return (
    <p className="mt-2 text-label">
      <span className={`tnum font-medium ${over ? 'text-[#a02a1f]' : 'text-[#1f2933]'}`}>
        {primary}
      </span>
      <span className="text-[#98a0a9]"> · {secondary}</span>
    </p>
  )
}
