import { useEffect, useRef, useState } from 'react'

import { axleCountFor, formatNumber } from '@/lib/format'

/**
 * The declared load, drawn on the truck it is going out on.
 *
 * Side view of a cab-over rigid truck facing left, in millimetres at one
 * uniform scale, so heights and lengths keep their real proportion (Hino
 * Ranger / Fuso Fighter class: ~1.2 m front overhang, a 1.3 m tandem spread).
 *
 * The box is the JBI for the configuration. Before VETO has answered the
 * drawing is neutral: the fill shows the declared gross against that box and
 * may rise past the rim when it is heavier, but nothing is coloured as a
 * violation. Limit lines, hatching and amber tags appear only with a HOLD, and
 * only for the limits that HOLD actually names. A PASS leaves the truck clean.
 */

const S = 0.0705
const OX = 40
const GROUND = 404
const R = 520
const X = (mm) => OX + mm * S
const Y = (mm) => GROUND - mm * S
const MAXOVER = 70

const COLORS = {
  body: '#ffffff',
  shade: '#e3e8ef',
  trim: '#b9c3cf',
  glassA: '#a9d6fa',
  glassB: '#4c93de',
  fillA: '#38c3f2',
  fillB: '#2a8bea',
  tire: '#1d232b',
  hub: '#c7cfd9',
  line: '#cdd5e0',
  muted: '#5b6676',
  hold: '#f2a93b',
  holdInk: '#8a5200',
  holdSoft: '#fdf2df',
  tag: '#f7f9fc',
  tagLine: '#e2e7ee',
}

/** Axle positions for a configuration, from its digits: 1 = single, 2 = dual. */
function geometry(config) {
  const digits = (config || '1.2').replace(/\D/g, '').split('')
  const n = digits.length
  if (n <= 2) {
    const single = digits[1] !== '2'
    return single
      ? { axles: [1150, 4450], dual: [false, false], end: 6300, cabH: 2450, cabL: 1850 }
      : { axles: [1250, 6150], dual: [false, true], end: 8700, cabH: 2850, cabL: 2150 }
  }
  const axles = [1250, 5750]
  for (let i = 2; i < n; i += 1) axles.push(axles[i - 1] + 1300)
  return {
    axles,
    dual: digits.map((d) => d === '2'),
    end: Math.min(axles[n - 1] + 1450, 10400),
    cabH: 2900,
    cabL: 2150,
  }
}

function useAnimatedNumber(target, reducedMotion) {
  const [value, setValue] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    if (reducedMotion) {
      from.current = target
      setValue(target)
      return undefined
    }
    const start = from.current
    const t0 = performance.now()
    let raf = 0
    const step = (now) => {
      const k = Math.min((now - t0) / 480, 1)
      const e = 1 - Math.pow(1 - k, 3)
      const v = start + (target - start) * e
      from.current = v
      setValue(v)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, reducedMotion])
  return value
}

export default function TruckLoad({ axleConfig, axleLoads = [], grossWeight, height, limits = {}, decision, focusAxle = -1 }) {
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const geo = geometry(axleConfig)
  const n = axleCountFor(axleConfig)
  const gross = Number(grossWeight) || 0
  const capacity = limits.grossWeight?.threshold || 0
  const pct = capacity ? gross / capacity : 0
  const heightMm = Number(height) || 0

  const hold = decision?.outcome === 'HOLD' ? decision.violations : []
  const grossV = hold.find((v) => v.dimension === 'GROSS_WEIGHT')
  const heightV = hold.find((v) => v.dimension === 'DIMENSION_HEIGHT')
  const axleV = new Set(hold.filter((v) => v.dimension === 'AXLE_LOAD').map((v) => v.axle_index))

  const boxX0 = geo.cabL + 140
  const boxX1 = geo.end
  const floorMm = 1180
  const h = Math.max(floorMm + 900, Math.min(heightMm || 3600, 5200))
  const bx = X(boxX0)
  const bw = (boxX1 - boxX0) * S
  const by = Y(h)
  const bh = (h - floorMm) * S
  const inner = bh - 10
  const base = by + bh - 5

  const targetFill = Math.min(inner * pct, inner + MAXOVER)
  const fill = useAnimatedNumber(targetFill, reducedMotion)
  const inBox = Math.min(fill, inner)
  const over = Math.max(0, fill - inner)
  const topY = base - targetFill

  // Space above the box is only drawn when something lives there.
  let top = Math.min(topY, by)
  const tags = []
  if (grossV) {
    const lineY = base - Math.min(inner * (grossV.limit_value / (capacity || grossV.limit_value)), inner + MAXOVER)
    tags.push({
      kind: 'gross',
      lineY,
      fromY: topY,
      text: `+${formatNumber(grossV.excess_value)} kg di atas batas ${formatNumber(grossV.limit_value)} kg`,
      x: bx + bw - 4,
      y: topY - 30,
      right: true,
    })
    top = Math.min(top, topY - 30)
  }
  let heightLineY = null
  if (heightV) {
    heightLineY = Y(heightV.limit_value)
    const ty = Math.min(top, heightLineY) - 30
    tags.push({
      kind: 'height',
      text: `Tinggi +${formatNumber(heightV.excess_value)} mm di atas batas ${formatNumber(heightV.limit_value)} mm`,
      x: bx + 4,
      y: ty,
      right: false,
    })
    top = Math.min(top, ty)
  }
  const vbTop = Math.max(0, Math.min(96, Math.floor(top - 12)))

  const L = geo.cabL
  const H = geo.cabH
  const fw = geo.axles[0]
  const arch = 640
  const cabPath = [
    `M${X(0)} ${Y(560)}`,
    `L${X(40)} ${Y(1250)}`,
    `L${X(150)} ${Y(H - 160)}`,
    `Q${X(170)} ${Y(H)} ${X(360)} ${Y(H)}`,
    `L${X(L - 60)} ${Y(H)}`,
    `Q${X(L)} ${Y(H)} ${X(L)} ${Y(H - 60)}`,
    `L${X(L)} ${Y(620)}`,
    `L${X(fw + arch)} ${Y(620)}`,
    `A${arch * S} ${arch * S} 0 0 0 ${X(fw - arch)} ${Y(620)}`,
    `L${X(0)} ${Y(560)} Z`,
  ].join(' ')

  // Axle tags, spread so tandem tags never overlap.
  const TW = 104
  const GAP = 8
  const xs = geo.axles.map((mm) => X(mm) - TW / 2)
  for (let i = 1; i < xs.length; i += 1) xs[i] = Math.max(xs[i], xs[i - 1] + TW + GAP)
  const shift = Math.max(0, xs[xs.length - 1] + TW - 792)

  const label = `Truk konfigurasi ${axleConfig}, berat kotor ${formatNumber(gross)} kg${capacity ? ` dari JBI ${formatNumber(capacity)} kg` : ''}${decision?.outcome === 'HOLD' ? ', ditahan VETO' : ''}`

  return (
    <svg viewBox={`0 ${vbTop} 800 ${472 - vbTop}`} role="img" aria-label={label} className="block h-auto w-full">
      <defs>
        <linearGradient id="tl-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={COLORS.body} />
          <stop offset="1" stopColor={COLORS.shade} />
        </linearGradient>
        <linearGradient id="tl-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={COLORS.glassA} />
          <stop offset="1" stopColor={COLORS.glassB} />
        </linearGradient>
        <linearGradient id="tl-fill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={COLORS.fillA} />
          <stop offset="1" stopColor={COLORS.fillB} />
        </linearGradient>
        <pattern id="tl-stripe" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="6" height="14" fill="#fff" opacity=".16" />
        </pattern>
        <pattern id="tl-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="10" height="10" fill={COLORS.hold} opacity=".3" />
          <rect width="4" height="10" fill={COLORS.hold} />
        </pattern>
        <radialGradient id="tl-shadow">
          <stop offset="0" stopColor="#0b1220" stopOpacity=".2" />
          <stop offset="1" stopColor="#0b1220" stopOpacity="0" />
        </radialGradient>
        <clipPath id="tl-box">
          <rect x={bx + 5} y={by + 5} width={bw - 10} height={bh - 10} rx="3" />
        </clipPath>
      </defs>

      <ellipse cx={X(geo.end / 2)} cy={GROUND + 4} rx={geo.end * S * 0.56} ry="12" fill="url(#tl-shadow)" />
      <line x1="16" y1={GROUND + 0.5} x2="784" y2={GROUND + 0.5} stroke={COLORS.line} />
      <rect x={X(250)} y={Y(1120)} width={(geo.end - 450) * S} height={260 * S} rx="2" fill={COLORS.tire} />
      <rect x={X(geo.axles[0] + 1250)} y={Y(1000)} width={1300 * S} height={520 * S} rx="6" fill={COLORS.trim} />

      <rect x={bx} y={by} width={bw} height={bh} rx="5" fill="url(#tl-body)" stroke={COLORS.trim} strokeWidth="1.2" />
      <g clipPath="url(#tl-box)">
        <rect x={bx + 5} y={base - inBox} width={bw - 10} height={inBox} fill="url(#tl-fill)" />
        <rect x={bx + 5} y={base - inBox} width={bw - 10} height={inBox} fill="url(#tl-stripe)" />
      </g>
      {over > 0 && (
        <g>
          <rect x={bx + 16} y={by + 5 - over} width={bw - 32} height={over + 6} rx="8" fill="url(#tl-fill)" stroke={COLORS.fillB} strokeWidth="1.5" />
          <rect x={bx + 16} y={by + 5 - over} width={bw - 32} height={over + 6} rx="8" fill="url(#tl-stripe)" />
          <rect x={bx - 2} y={by - 2} width={bw + 4} height="7" rx="3" fill={COLORS.trim} />
        </g>
      )}
      {Array.from({ length: Math.max(0, Math.floor((boxX1 - 300 - (boxX0 + 1000)) / 1000) + 1) }, (_, i) => boxX0 + 1000 + i * 1000).map((x) => (
        <line key={x} x1={X(x)} y1={by + 5} x2={X(x)} y2={base} stroke="#fff" strokeOpacity=".35" />
      ))}
      <line x1={X(boxX1 - 60)} y1={by + 6} x2={X(boxX1 - 60)} y2={base} stroke={COLORS.trim} />
      <rect x={X(boxX1 - 120)} y={Y(1080)} width="7" height="12" rx="1.5" fill="#e5484d" />

      <g>
        <path d={cabPath} fill="url(#tl-body)" stroke={COLORS.trim} strokeWidth="1.2" strokeLinejoin="round" />
        <path d={`M${X(70)} ${Y(1700)} L${X(140)} ${Y(H - 220)} L${X(380)} ${Y(H - 220)} L${X(380)} ${Y(1700)} Z`} fill="url(#tl-glass)" opacity=".9" />
        <path d={`M${X(520)} ${Y(1700)} L${X(520)} ${Y(H - 220)} L${X(L - 260)} ${Y(H - 220)} L${X(L - 160)} ${Y(1700)} Z`} fill="url(#tl-glass)" />
        <path d={`M${X(470)} ${Y(H - 150)} L${X(470)} ${Y(700)} M${X(L - 120)} ${Y(H - 150)} L${X(L - 120)} ${Y(700)}`} stroke={COLORS.trim} fill="none" />
        <rect x={X(L - 420)} y={Y(1560)} width={220 * S} height={50 * S} rx="1.5" fill={COLORS.trim} />
        <rect x={X(560)} y={Y(760)} width={700 * S} height={90 * S} rx="2" fill={COLORS.tire} opacity=".7" />
        <rect x={X(-30)} y={Y(780)} width={380 * S} height={260 * S} rx="3" fill={COLORS.tire} opacity=".85" />
        <rect x={X(20)} y={Y(1180)} width={230 * S} height={130 * S} rx="2" fill="#f2c14e" />
        <path d={`M${X(110)} ${Y(H - 300)} L${X(-120)} ${Y(H - 380)} L${X(-120)} ${Y(1950)}`} stroke={COLORS.tire} strokeWidth="2" fill="none" strokeLinecap="round" />
        <rect x={X(-170)} y={Y(2300)} width={90 * S} height={420 * S} rx="2" fill={COLORS.tire} />
      </g>

      {/* VETO's marks: only the limits this HOLD names. */}
      {grossV && (
        <>
          <rect x={bx + 5} y={topY} width={bw - 10} height={Math.max(0, tags[0].lineY - topY)} rx="3" fill="url(#tl-hatch)" />
          <line x1={bx - 6} y1={tags[0].lineY} x2={bx + bw + 6} y2={tags[0].lineY} stroke={COLORS.holdInk} strokeWidth="1.6" strokeDasharray="7 5" />
        </>
      )}
      {heightV && (
        <>
          <rect x={bx + 5} y={by} width={bw - 10} height={Math.max(0, heightLineY - by)} fill="url(#tl-hatch)" opacity=".8" />
          <line x1={bx - 6} y1={heightLineY} x2={bx + bw + 6} y2={heightLineY} stroke={COLORS.holdInk} strokeWidth="1.6" strokeDasharray="7 5" />
        </>
      )}
      {tags.map((t) => {
        const tw = t.text.length * 7 + 20
        const tx = t.right ? t.x - tw : t.x
        return (
          <g key={t.kind}>
            <rect x={tx} y={t.y} width={tw} height="24" rx="6" fill={COLORS.hold} />
            <text x={tx + tw / 2} y={t.y + 16.5} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#2a1a00">
              {t.text}
            </text>
          </g>
        )
      })}

      {/* Height ruler beside the box. */}
      <path
        d={`M${Math.min(X(boxX1) + 22, 778)} ${by} V${GROUND} M${Math.min(X(boxX1) + 22, 778) - 5} ${by} H${Math.min(X(boxX1) + 22, 778) + 5} M${Math.min(X(boxX1) + 22, 778) - 5} ${GROUND} H${Math.min(X(boxX1) + 22, 778) + 5}`}
        stroke={heightV ? COLORS.hold : COLORS.muted}
        strokeWidth="1.2"
        fill="none"
      />

      {geo.axles.map((mm, i) => {
        const cx = X(mm)
        const cy = Y(R)
        const r = R * S
        return (
          <g key={`w${i}`}>
            {i > 0 && (
              <path d={`M${cx - r - 6} ${cy - 2} A${r + 6} ${r + 6} 0 0 1 ${cx + r + 6} ${cy - 2}`} fill="none" stroke={COLORS.tire} strokeWidth="4" opacity=".55" />
            )}
            <circle cx={cx} cy={cy} r={r} fill={COLORS.tire} />
            <circle cx={cx} cy={cy} r={r * 0.56} fill={COLORS.hub} />
            {geo.dual[i] && <circle cx={cx} cy={cy} r={r * 0.42} fill="none" stroke={COLORS.tire} strokeWidth="1.6" opacity=".55" />}
            <circle cx={cx} cy={cy} r={r * 0.17} fill={COLORS.tire} />
          </g>
        )
      })}

      {geo.axles.slice(0, n).map((mm, i) => {
        const kg = Number(axleLoads[i]) || 0
        const overA = axleV.has(i)
        const active = focusAxle === i
        const tx = Math.max(xs[i] - shift, 8)
        const ty = GROUND + 16
        const cx = X(mm)
        const lim = limits[`axle${i}`] ?? limits.axle_generic
        const v = hold.find((x) => x.dimension === 'AXLE_LOAD' && x.axle_index === i)
        const t = (kgv) => (kgv / 1000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        return (
          <g key={`t${i}`}>
            <line x1={cx} y1={GROUND + 2} x2={Math.min(Math.max(cx, tx + 12), tx + TW - 12)} y2={ty} stroke={overA ? COLORS.hold : active ? '#1f74e0' : COLORS.line} />
            <rect x={tx} y={ty} width={TW} height="46" rx="8" fill={overA ? COLORS.holdSoft : COLORS.tag} stroke={overA ? COLORS.hold : active ? '#1f74e0' : COLORS.tagLine} strokeWidth={active ? 1.6 : 1} />
            <text x={tx + 10} y={ty + 18} fontSize="12" fontWeight="600" fill={COLORS.muted}>
              Sumbu {i + 1}
            </text>
            <text x={tx + 10} y={ty + 36} fontSize="14" fontWeight="700" fill={overA ? COLORS.holdInk : '#111827'}>
              {decision && lim ? `${t(kg)} / ${t(v ? v.limit_value : lim.threshold)} t` : `${t(kg)} t`}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
