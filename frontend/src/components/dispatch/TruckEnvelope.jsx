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
/**
 * The side view's horizontal extent is decorative — length is not re-shown
 * here, only height is data-driven (design doc §5). It was 3000, which made
 * the box taller than wide: with `meet` scaling that fits by height and
 * rendered the whole truck ~100px into ~320px of frame, stranding half the
 * panel empty. 9000 is a realistic cargo-body length and fills the row.
 */
const SIDE_VIEW_NOMINAL_WIDTH_MM = 9000
const WHEEL_RADIUS_MM = 450
const WHEEL_HUB_RADIUS_MM = 180
/** Distance from the box's back edge to each wheel centre — the back ~15%. */
const REAR_WHEEL_OFFSETS_MM = [1350, 500]
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

const PANEL_LINE_COUNT = 8

/**
 * How far in front of the box's back edge the rear door seam sits. The plan
 * put it exactly on the back edge, where it renders underneath the 3px
 * outline and is invisible — a door frame has to be inset to read as one.
 */
const REAR_DOOR_INSET_MM = 350

const REAR_WHEEL_LENGTH_MM = 900
const REAR_WHEEL_POKE_MM = 300
/** Offsets from the live box's back edge; negative pokes past it. Rearmost first. */
const REAR_WHEEL_RIGHT_OFFSETS_MM = [-100, 1300]

/** Evenly spaced positions strictly inside [start, start+size], excluding the edges. */
function panelLines(start, size, count = PANEL_LINE_COUNT) {
  const lines = []
  for (let i = 1; i <= count; i++) {
    lines.push(start + (size * i) / (count + 1))
  }
  return lines
}

/**
 * Length is LEFT-anchored, width stays centred.
 *
 * The illustrated redesign's plan specified both axes stay centred, which was
 * right for two plain rectangles but wrong once a cab is drawn at the front:
 * a load under the legal max rendered its body floating a metre behind the
 * cab, and the gap opened and closed as the operator typed. This is the same
 * correction the side view needed for height once wheels sat on a ground
 * line. Width genuinely is centred — a body sits centred on its chassis — so
 * that axis is untouched.
 *
 * The viewBox also starts at `outerOffset` rather than 0, dropping the
 * canvas's leading 20% padding. That padding only exists to give overflow
 * somewhere to render, which is only ever needed at the back.
 */
function PlanView({ length, width, limits }) {
  const reduceMotion = useReducedMotion()
  const lengthGeo = axisGeometry(Number(length), limits.length?.threshold)
  const widthGeo = axisGeometry(Number(width), limits.width?.threshold)

  if (!lengthGeo || !widthGeo) return <EnvelopePlaceholder label="Tampak Atas" />

  const over = lengthGeo.over || widthGeo.over

  return (
    <EnvelopeFrame label="Tampak Atas">
      <div className="flex min-h-0 w-full flex-1 items-stretch gap-0">
        <PlanCab />
        <svg
          viewBox={`${lengthGeo.outerOffset} 0 ${lengthGeo.canvas - lengthGeo.outerOffset} ${widthGeo.canvas}`}
          preserveAspectRatio="xMinYMid meet"
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
            x: lengthGeo.outerOffset,
            y: widthGeo.innerOffset,
            width: lengthGeo.innerSize,
            height: widthGeo.innerSize,
          }}
          animate={{
            x: lengthGeo.outerOffset,
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
        {panelLines(lengthGeo.outerOffset, lengthGeo.innerSize).map((x) => (
          <line
            key={x}
            x1={x}
            y1={widthGeo.innerOffset}
            x2={x}
            y2={widthGeo.innerOffset + widthGeo.innerSize}
            stroke="#c4cad0"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {lengthGeo.innerSize > REAR_DOOR_INSET_MM * 2 && (
          <line
            x1={lengthGeo.outerOffset + lengthGeo.innerSize - REAR_DOOR_INSET_MM}
            y1={widthGeo.innerOffset}
            x2={lengthGeo.outerOffset + lengthGeo.innerSize - REAR_DOOR_INSET_MM}
            y2={widthGeo.innerOffset + widthGeo.innerSize}
            stroke={over ? OVER_COLOUR : NEUTRAL_COLOUR}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {REAR_WHEEL_RIGHT_OFFSETS_MM.map((offset) => {
          // Anchored to the live input box's own back edge on both axes, never
          // the fixed legal-max line. Length is left-anchored, so the back edge
          // is outerOffset + innerSize (design doc §5, plan amendment Task 4).
          const boxRight = lengthGeo.outerOffset + lengthGeo.innerSize
          const rectX = boxRight - offset - REAR_WHEEL_LENGTH_MM
          const topY = widthGeo.innerOffset - REAR_WHEEL_POKE_MM + 60
          const bottomY = widthGeo.innerOffset + widthGeo.innerSize - 60
          return (
            <g key={offset}>
              <motion.rect
                initial={{ x: rectX, y: topY }}
                animate={{ x: rectX, y: topY }}
                transition={reduceMotion ? { duration: 0 } : SPRING}
                width={REAR_WHEEL_LENGTH_MM}
                height={REAR_WHEEL_POKE_MM}
                fill="#fff"
                stroke="#1f2933"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              <motion.rect
                initial={{ x: rectX, y: bottomY }}
                animate={{ x: rectX, y: bottomY }}
                transition={reduceMotion ? { duration: 0 } : SPRING}
                width={REAR_WHEEL_LENGTH_MM}
                height={REAR_WHEEL_POKE_MM}
                fill="#fff"
                stroke="#1f2933"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )
        })}
        </svg>
      </div>
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
        {panelLines(0, SIDE_VIEW_NOMINAL_WIDTH_MM).map((x) => (
          <line
            key={x}
            x1={x}
            y1={heightGeo.canvas - heightGeo.innerSize}
            x2={x}
            y2={heightGeo.canvas}
            stroke="#c4cad0"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <line
          x1={SIDE_VIEW_NOMINAL_WIDTH_MM - REAR_DOOR_INSET_MM}
          y1={heightGeo.canvas - heightGeo.innerSize}
          x2={SIDE_VIEW_NOMINAL_WIDTH_MM - REAR_DOOR_INSET_MM}
          y2={heightGeo.canvas}
          stroke={heightGeo.over ? OVER_COLOUR : NEUTRAL_COLOUR}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        {REAR_WHEEL_OFFSETS_MM.map((offset) => {
          const cx = SIDE_VIEW_NOMINAL_WIDTH_MM - offset
          const cy = heightGeo.canvas - WHEEL_RADIUS_MM
          return (
            <g key={offset}>
              <circle cx={cx} cy={cy} r={WHEEL_RADIUS_MM} fill="#fff" stroke="#1f2933" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
              <circle cx={cx} cy={cy} r={WHEEL_HUB_RADIUS_MM} fill="none" stroke="#1f2933" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
            </g>
          )
        })}
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
 * Fixed, decorative, own small local viewBox — see SideCab's comment for
 * why this doesn't need transform math against the mm-scale box SVG, and
 * why the preserveAspectRatio here is load-bearing rather than decoration.
 * Centred vertically (`YMid` on both SVGs) rather than bottom-anchored,
 * because axisGeometry always centres PlanView's outer envelope at
 * canvas/2 regardless of state.
 */
function PlanCab() {
  return (
    <svg viewBox="28 19 65 62" preserveAspectRatio="xMaxYMid meet" className="h-full w-32 shrink-0">
      <path
        d="M92,28 L52,28 L34,40 Q30,50 34,60 L52,72 L92,72 Z"
        fill="#fff"
        stroke="#1f2933"
        strokeWidth="2.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <rect x="54" y="37" width="26" height="26" rx="2" fill="#c4cad0" stroke="#1f2933" strokeWidth="1" />
      <rect x="44" y="23" width="10" height="7" rx="1.5" fill="#fff" stroke="#1f2933" strokeWidth="1.5" />
      <rect x="44" y="70" width="10" height="7" rx="1.5" fill="#fff" stroke="#1f2933" strokeWidth="1.5" />
      <rect x="68" y="26" width="14" height="6" fill="#fff" stroke="#1f2933" strokeWidth="1.5" />
      <rect x="68" y="68" width="14" height="6" fill="#fff" stroke="#1f2933" strokeWidth="1.5" />
    </svg>
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
      {/* cy is 112 - r, not 112: the wheel's bottom edge touches the chassis
          line. Centring it on the line clips half the wheel out of the viewBox. */}
      <circle cx="55" cy="99" r="13" fill="#fff" stroke="#1f2933" strokeWidth="2.5" />
      <circle cx="55" cy="99" r="5" fill="none" stroke="#1f2933" strokeWidth="1.25" />
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
