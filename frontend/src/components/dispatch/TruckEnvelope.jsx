import { formatMm } from '@/lib/format'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect } from 'react'

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
const WHEEL_RADIUS_MM = 500
const WHEEL_HUB_RADIUS_MM = 200
/** Distance from the box's back edge to each wheel centre — the back ~15%. */
const REAR_WHEEL_OFFSETS_MM = [1350, 500]

/**
 * Height of the cargo deck above the ground. The body rides on it; the wheels
 * hang below it. Without this the box bottom IS the ground line, which leaves
 * the wheels nowhere to sit but inside the cargo body.
 *
 * This is also the physically correct reading of the measurement: the 4200mm
 * limit (PP 55/2012 Pasal 7 ayat (3)) is total vehicle height measured from
 * the ground, so the body occupies deck-height up to the declared figure —
 * not the full span from the ground.
 */
const DECK_HEIGHT_MM = 900

/**
 * The side-view cab is drawn in the SAME millimetre space as the cargo box,
 * inside the box's own SVG, occupying negative x in front of it.
 *
 * It used to be a separate SVG with its own small local viewBox. That was
 * fine while the cab was pure decoration, but it has three real geometric
 * relationships now — the ground line, the deck line, and wheel size — and
 * two SVGs scaled independently cannot be relied on to agree about any of
 * them. The cab's floor ran to the ground while the body's floor sat on the
 * deck, and no constant in the cab's local units could fix that, because the
 * two viewBoxes resolve to different pixel scales. Sharing one coordinate
 * system makes the alignment structural instead of a coincidence to re-tune.
 */
const CAB_LENGTH_MM = 2400
const CAB_HEIGHT_MM = 2900
/** Left edge of the viewBox: cab length plus clearance for the mirror. */
const CAB_VIEW_LEFT_MM = -3000
/** Cab track width, drawn in the plan view. The legal maximum, so a
 *  full-width load reads as exactly as wide as its own truck. */
const CAB_WIDTH_MM = 2500
/**
 * Brighter than the #a02a1f used for excess text in DispatchForm. This is the
 * lightest red that still clears WCAG AA for normal text (4.83:1 on white),
 * which it has to, because EnvelopeReadout renders the measurement in it.
 */
const OVER_COLOUR = '#d92d20'
const NEUTRAL_COLOUR = '#2f8f4e'
const OUTER_STROKE = '#98a0a9'
const OUTER_FILL = '#f4f6f7'
const SPRING = { type: 'spring', stiffness: 90, damping: 12 }

/**
 * A spring-animated rect whose width/height can never render negative.
 *
 * Every property rides the SAME spring, which is what keeps geometric
 * invariants true mid-flight rather than only at rest: the side view's body
 * bottom stays pinned to the deck because `y` and `height` bounce in lockstep,
 * and the plan view's body stays centred for the same reason. Damping `height`
 * separately to stop it going negative broke exactly that — `y` bounced while
 * `height` settled, so the body dipped below its own floor on every change.
 *
 * The negative is clamped at render instead, via useTransform. SPRING is
 * underdamped by design, so animating a size to 0 overshoots past it, and SVG
 * rejects a negative width/height on every frame of that bounce.
 */
function SpringRect({ x, y, width, height, reduceMotion, ...rest }) {
  const mx = useMotionValue(x)
  const my = useMotionValue(y)
  const mw = useMotionValue(width)
  const mh = useMotionValue(height)

  useEffect(() => {
    const transition = reduceMotion ? { duration: 0 } : SPRING
    const running = [
      animate(mx, x, transition),
      animate(my, y, transition),
      animate(mw, width, transition),
      animate(mh, height, transition),
    ]
    return () => running.forEach((control) => control.stop())
  }, [x, y, width, height, reduceMotion, mx, my, mw, mh])

  const safeWidth = useTransform(mw, (v) => Math.max(0, v))
  const safeHeight = useTransform(mh, (v) => Math.max(0, v))

  return <motion.rect x={mx} y={my} width={safeWidth} height={safeHeight} {...rest} />
}

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
/** Offsets forward from the legal envelope's rear. Negative pokes past it. */
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
  const colour = over ? OVER_COLOUR : NEUTRAL_COLOUR

  return (
    <EnvelopeFrame label="Tampak Atas">
      <div className="flex min-h-0 w-full flex-1 items-stretch gap-0">
        <svg
          viewBox={`${lengthGeo.outerOffset - CAB_LENGTH_MM} 0 ${lengthGeo.canvas - lengthGeo.outerOffset + CAB_LENGTH_MM} ${widthGeo.canvas}`}
          preserveAspectRatio="xMinYMid meet"
          className="min-h-0 w-full flex-1"
        >
        <PlanCab boxFront={lengthGeo.outerOffset} centreY={widthGeo.canvas / 2} colour={colour} />
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
        <SpringRect
          x={lengthGeo.outerOffset}
          y={widthGeo.innerOffset}
          width={lengthGeo.innerSize}
          height={widthGeo.innerSize}
          reduceMotion={reduceMotion}
          fill="none"
          stroke={colour}
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />
        {/* Same guard as SideView: a zero length would collapse all eight
            lines onto one x, and a zero width would draw them as dots. */}
        {lengthGeo.innerSize > 0 && widthGeo.innerSize > 0 &&
          panelLines(lengthGeo.outerOffset, lengthGeo.innerSize).map((x) => (
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
            stroke={colour}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {REAR_WHEEL_RIGHT_OFFSETS_MM.map((offset) => {
          // Parked at the rear of the LEGAL envelope, and static on both axes.
          //
          // These used to track the live box's back edge and spring with it,
          // which made the axles slide fore and aft as the operator typed a
          // length. The axles are part of the truck; only the load changes. So
          // they sit at the fixed rear and the track is the vehicle's own,
          // matching the side view, whose wheels were always fixed for exactly
          // this reason. A short load now shows bare chassis between the cargo
          // and the wheels, which is what a half-loaded truck looks like.
          //
          // Being fixed also retires the two floors these needed while they
          // moved: nothing can reverse them into the cab or collapse the rows.
          const wheelRear = lengthGeo.outerOffset + lengthGeo.legalSize
          const trackTop = (widthGeo.canvas - CAB_WIDTH_MM) / 2
          const rectX = wheelRear - offset - REAR_WHEEL_LENGTH_MM
          const topY = trackTop - REAR_WHEEL_POKE_MM + 60
          const bottomY = trackTop + CAB_WIDTH_MM - 60
          return (
            <g key={offset}>
              <rect
                x={rectX}
                y={topY}
                width={REAR_WHEEL_LENGTH_MM}
                height={REAR_WHEEL_POKE_MM}
                fill="#fff"
                stroke={colour}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              <rect
                x={rectX}
                y={bottomY}
                width={REAR_WHEEL_LENGTH_MM}
                height={REAR_WHEEL_POKE_MM}
                fill="#fff"
                stroke={colour}
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

  // Declared height is measured from the ground, so the body's top sits at
  // canvas - height while its floor rests on the deck. The gap underneath is
  // where the wheels live.
  const deckY = heightGeo.canvas - DECK_HEIGHT_MM
  // Never below the deck. An input under the deck height would otherwise put
  // the body's top edge down among the wheels, so it grew up out from under
  // the truck instead of off its floor.
  const bodyTop = Math.min(deckY, heightGeo.canvas - heightGeo.innerSize)
  const bodyHeight = Math.max(0, heightGeo.innerSize - DECK_HEIGHT_MM)
  const legalTop = heightGeo.canvas - heightGeo.legalSize
  const colour = heightGeo.over ? OVER_COLOUR : NEUTRAL_COLOUR

  return (
    <EnvelopeFrame label="Tampak Samping">
      <div className="flex min-h-0 w-full flex-1 items-stretch gap-0">
        <svg
          viewBox={`${CAB_VIEW_LEFT_MM} 0 ${SIDE_VIEW_NOMINAL_WIDTH_MM - CAB_VIEW_LEFT_MM} ${heightGeo.canvas}`}
          preserveAspectRatio="xMinYMax meet"
          className="min-h-0 w-full flex-1"
        >
        <SideCab groundY={heightGeo.canvas} colour={colour} />
        <rect
          x={0}
          y={legalTop}
          width={SIDE_VIEW_NOMINAL_WIDTH_MM}
          height={heightGeo.legalSize - DECK_HEIGHT_MM}
          fill={OUTER_FILL}
          stroke={OUTER_STROKE}
          strokeWidth={2}
          strokeDasharray="8 6"
          vectorEffect="non-scaling-stroke"
        />
        <SpringRect
          x={0}
          y={bodyTop}
          width={SIDE_VIEW_NOMINAL_WIDTH_MM}
          height={bodyHeight}
          reduceMotion={reduceMotion}
          fill="none"
          stroke={colour}
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />
        {/* Only when there is a body to draw them on. An empty or below-deck
            input leaves bodyHeight at 0, and these would otherwise streak
            across the bare deck gap between the chassis and the ground. */}
        {bodyHeight > 0 && (
          <>
            {panelLines(0, SIDE_VIEW_NOMINAL_WIDTH_MM).map((x) => (
              <line
                key={x}
                x1={x}
                y1={bodyTop}
                x2={x}
                y2={deckY}
                stroke="#c4cad0"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <line
              x1={SIDE_VIEW_NOMINAL_WIDTH_MM - REAR_DOOR_INSET_MM}
              y1={bodyTop}
              x2={SIDE_VIEW_NOMINAL_WIDTH_MM - REAR_DOOR_INSET_MM}
              y2={deckY}
              stroke={colour}
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
        {/* One ground line under the whole vehicle, cab included. */}
        <line
          x1={CAB_VIEW_LEFT_MM}
          y1={heightGeo.canvas}
          x2={SIDE_VIEW_NOMINAL_WIDTH_MM}
          y2={heightGeo.canvas}
          stroke="#1f2933"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        {REAR_WHEEL_OFFSETS_MM.map((offset) => {
          const cx = SIDE_VIEW_NOMINAL_WIDTH_MM - offset
          const cy = heightGeo.canvas - WHEEL_RADIUS_MM
          return (
            <g key={offset}>
              <circle cx={cx} cy={cy} r={WHEEL_RADIUS_MM} fill="#fff" stroke={colour} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
              <circle cx={cx} cy={cy} r={WHEEL_HUB_RADIUS_MM} fill="none" stroke={colour} strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
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
function PlanCab({ boxFront, centreY, colour }) {
  const front = boxFront - CAB_LENGTH_MM
  const half = CAB_WIDTH_MM / 2
  const top = centreY - half
  const bottom = centreY + half
  const poke = 180
  return (
    <g>
      {/* Tapered nose: straight facets with one rounded curve at the tip. */}
      <path
        d={`M${boxFront},${top} L${front + 800},${top} L${front + 200},${top + 500} Q${front},${centreY} ${front + 200},${bottom - 500} L${front + 800},${bottom} L${boxFront},${bottom} Z`}
        fill="#fff"
        stroke={colour}
        strokeWidth="2.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <rect x={front + 950} y={top + 300} width="850" height={CAB_WIDTH_MM - 600} rx="60" fill="#c4cad0" stroke={colour} strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {/* Mirrors overlap the body edge directly — a connecting stalk line is
          near-invisible at render scale and reads as floating debris. */}
      <rect x={front + 650} y={top - poke} width="480" height={poke} fill="#fff" stroke={colour} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <rect x={front + 650} y={bottom} width="480" height={poke} fill="#fff" stroke={colour} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <rect x={front + 1500} y={top - poke} width="700" height={poke} fill="#fff" stroke={colour} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <rect x={front + 1500} y={bottom} width="700" height={poke} fill="#fff" stroke={colour} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </g>
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
function SideCab({ groundY, colour }) {
  const g = groundY
  const front = -CAB_LENGTH_MM
  return (
    <g>
      {/* Cab-over profile: the floor sits on the deck line, exactly like the
          cargo body's, so the two read as one vehicle. */}
      <path
        d={`M${front},${g - DECK_HEIGHT_MM} L${front},${g - 1700} L${front + 150},${g - 2050} L${front + 400},${g - CAB_HEIGHT_MM} L0,${g - CAB_HEIGHT_MM} L0,${g - DECK_HEIGHT_MM} Z`}
        fill="#fff"
        stroke={colour}
        strokeWidth="2.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={`M${front + 220},${g - 2300} L${front + 430},${g - 2820} L${front + 1150},${g - 2820} L${front + 1150},${g - 2350} Z`}
        fill="#c4cad0"
        stroke={colour}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <line x1={front + 1400} y1={g - 2780} x2={front + 1400} y2={g - 950} stroke="#98a0a9" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
      <rect x={front + 1250} y={g - 1850} width="180" height="70" fill="#1f2933" />
      <line x1={front + 50} y1={g - 2450} x2={front - 250} y2={g - 2550} stroke={colour} strokeWidth="1.75" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <rect x={front - 420} y={g - 2700} width="170" height="330" rx="40" fill="#fff" stroke={colour} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <circle cx={front + 1000} cy={g - WHEEL_RADIUS_MM} r={WHEEL_RADIUS_MM} fill="#fff" stroke={colour} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      <circle cx={front + 1000} cy={g - WHEEL_RADIUS_MM} r={WHEEL_HUB_RADIUS_MM} fill="none" stroke={colour} strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
    </g>
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
      <span className={`tnum font-medium ${over ? 'text-[#d92d20]' : 'text-[#1f2933]'}`}>
        {primary}
      </span>
      <span className="text-[#98a0a9]"> · {secondary}</span>
    </p>
  )
}
