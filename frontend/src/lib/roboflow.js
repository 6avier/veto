/**
 * Camera-side helpers for the /dispatch vision scanner.
 *
 * Frames are sent to the VETO backend (/api/v1/vision/detect), which holds the
 * vision model credentials server-side so no API key ever ships to the browser.
 */

import { http } from '@/api/client'

/** Used only when GET /rules has not supplied a ceiling. PP 55/2012. */
const FALLBACK_LIMITS = { length: 12000, width: 2500, height: 4200 }

/** True for the model's overload class, whatever its exact casing. */
export const isOverloadClass = (name) => /overload/i.test(String(name ?? ''))

/**
 * Draws the video's current frame onto an offscreen canvas no wider than
 * `maxWidth`. Smaller frames keep inference fast; prediction coordinates come
 * back in this canvas's pixel space.
 */
export function captureFrame(media, maxWidth = 640) {
  if (!media) return null
  const vw = media.videoWidth || media.naturalWidth || media.width || 0
  const vh = media.videoHeight || media.naturalHeight || media.height || 0
  if (!vw || !vh) return null
  const scale = Math.min(1, maxWidth / vw)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(vw * scale)
  canvas.height = Math.round(vh * scale)
  canvas.getContext('2d').drawImage(media, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * Sends a captured frame to the backend vision endpoint (/api/v1/vision/detect)
 * and returns the primary truck bounding box for over-dimension profiling.
 */
export async function inferVisionFrame(canvas, signal, includeAlpr = false) {
  const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
  const started = performance.now()

  const { data } = await http.post(
    '/vision/detect',
    { image_base64: base64, include_alpr: includeAlpr },
    { signal },
  )

  const rawPredictions = data?.predictions ?? []
  const best = pickPrimaryTruckBox(rawPredictions, canvas.width, canvas.height)

  return {
    source: 'api',
    predictions: best ? [best] : [],
    alpr: data?.alpr ?? null,
    fleetMatch: data?.fleet_match ?? null,
    imageWidth: canvas.width,
    imageHeight: canvas.height,
    latencyMs: Math.max(12, Math.round(performance.now() - started)),
  }
}

/**
 * Sends a captured frame to the dedicated ALPR endpoint (/api/v1/vision/alpr).
 */
export async function inferAlprFrame(canvas, signal) {
  // Use high clarity JPEG quality 0.88 so OCR can sharply read letters and numbers on the plate
  const base64 = canvas.toDataURL('image/jpeg', 0.88).split(',')[1]
  const started = performance.now()

  const { data } = await http.post(
    '/vision/alpr',
    { image_base64: base64 },
    { signal },
  )

  return {
    alpr: data?.alpr ?? null,
    fleetMatch: data?.fleet_match ?? null,
    latencyMs: Math.max(12, Math.round(performance.now() - started)),
  }
}

/**
 * Selects the single tightest, most confident truck bounding box and discards
 * outer background/sky boxes that enclose a tighter detection.
 */
function pickPrimaryTruckBox(predictions, imageW, imageH) {
  if (!predictions?.length) return null

  const frameArea = Math.max(1, imageW * imageH)
  const candidates = predictions
    .map((p) => ({
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      class: p.class,
      confidence: p.confidence,
      areaRatio: (p.width * p.height) / frameArea,
      topRatio: (p.y - p.height / 2) / imageH,
    }))
    // Drop boxes that are tiny specks or cover almost the entire frame/sky.
    .filter((p) => p.areaRatio >= 0.015 && p.areaRatio <= 0.72)

  if (!candidates.length) return null

  // Remove any outer box that encloses a smaller candidate box (like a giant
  // sky+truck box wrapping the real truck box).
  const nonEnclosing = candidates.filter((outer) => {
    const ox1 = outer.x - outer.width / 2
    const oy1 = outer.y - outer.height / 2
    const ox2 = outer.x + outer.width / 2
    const oy2 = outer.y + outer.height / 2

    const wrapsSmaller = candidates.some((inner) => {
      if (inner === outer) return false
      if (inner.areaRatio >= outer.areaRatio * 0.65) return false
      const ix1 = inner.x - inner.width / 2
      const iy1 = inner.y - inner.height / 2
      const ix2 = inner.x + inner.width / 2
      const iy2 = inner.y + inner.height / 2
      return ix1 >= ox1 - 12 && iy1 >= oy1 - 12 && ix2 <= ox2 + 12 && iy2 <= oy2 + 12
    })
    return !wrapsSmaller
  })

  const pool = nonEnclosing.length ? nonEnclosing : candidates

  // Score by model confidence, penalising boxes that hug the very top sky edge.
  pool.sort((a, b) => {
    const skyPenaltyA = a.topRatio < 0.06 && a.areaRatio > 0.35 ? 0.25 : 0
    const skyPenaltyB = b.topRatio < 0.06 && b.areaRatio > 0.35 ? 0.25 : 0
    return b.confidence - skyPenaltyB - (a.confidence - skyPenaltyA)
  })

  return pool[0]
}

/** Highest-confidence prediction in one frame's result, or null. */
export function topPrediction(result) {
  if (!result?.predictions?.length) return null
  return result.predictions.reduce((best, p) => (p.confidence > best.confidence ? p : best))
}

/**
 * Settles a class over the last few frames so a single noisy frame cannot
 * flip the verdict: whichever class carries the most summed confidence wins.
 */
export function stableClass(recentTops) {
  const totals = new Map()
  for (const p of recentTops) {
    if (!p) continue
    totals.set(p.class, (totals.get(p.class) ?? 0) + p.confidence)
  }
  let winner = null
  let best = 0
  for (const [name, total] of totals) {
    if (total > best) {
      best = total
      winner = name
    }
  }
  return winner
}

const roundTo = (value, step) => Math.round(value / step) * step

/**
 * Dimension estimate, in millimetres, for a detected class.
 */
export function estimateDimensions(className, limits = {}) {
  const L = limits.length?.threshold ?? FALLBACK_LIMITS.length
  const W = limits.width?.threshold ?? FALLBACK_LIMITS.width
  const H = limits.height?.threshold ?? FALLBACK_LIMITS.height

  if (isOverloadClass(className)) {
    return {
      length: roundTo(L * 0.95, 50),
      width: roundTo(W + 120, 10),
      height: roundTo(H + 250, 10),
    }
  }
  return {
    length: roundTo(L * 0.9, 50),
    width: roundTo(W * 0.96, 10),
    height: roundTo(H * 0.93, 10),
  }
}
