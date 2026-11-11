import { useState } from 'react'

/**
 * The boxed clause, cut out of its page and enlarged.
 *
 * On the full page at sidebar width a table row renders at ~6px and the box
 * marks a cell the eye has to hunt for. This shows only the region around the
 * marks, scaled to the container, so the figure being approved is readable
 * beside the card that proposes it. Everything is in page percentages, as
 * /documents/{id}/pages/{n} returns them, so no pixel measuring is needed; the
 * page's aspect ratio comes from the image itself once it loads.
 */

// Context kept around the marks, in % of the page, and the narrowest crop
// allowed. MIN_W caps the zoom: at 50 a table row filled the plate at 2x and
// read as a blow-up rather than a reference; 75 keeps it near 1.3x with the
// rows either side still legible.
const PAD_X = 12
const PAD_Y = 5
const MIN_W = 75

function cropAround(rects) {
  if (!rects?.length) return null
  const left = Math.min(...rects.map((r) => r.x))
  const top = Math.min(...rects.map((r) => r.y))
  const right = Math.max(...rects.map((r) => r.x + r.w))
  const bottom = Math.max(...rects.map((r) => r.y + r.h))

  let x = Math.max(0, left - PAD_X)
  let w = Math.min(100, right + PAD_X) - x
  if (w < MIN_W) {
    x = Math.max(0, Math.min(100 - MIN_W, x - (MIN_W - w) / 2))
    w = MIN_W
  }
  const y = Math.max(0, top - PAD_Y)
  const h = Math.min(100, bottom + PAD_Y) - y
  return { x, y, w, h }
}

export default function ClauseCrop({ image, rects, alt }) {
  // Height over width of the rendered page; A4 until the image says otherwise.
  const [aspect, setAspect] = useState(1.414)
  const crop = cropAround(rects)
  if (!image || !crop) return null

  const { x, y, w, h } = crop
  return (
    <div
      className="relative w-full overflow-hidden rounded-md bg-white ring-1 ring-ink-100"
      style={{ aspectRatio: `${w} / ${h * aspect}` }}
    >
      <img
        src={image}
        alt={alt}
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget
          if (naturalWidth) setAspect(naturalHeight / naturalWidth)
        }}
        className="absolute max-w-none"
        style={{ width: `${10000 / w}%`, left: `${(-x / w) * 100}%`, top: `${(-y / h) * 100}%` }}
      />
      {rects.map((rect, index) => (
        <span
          key={`${rect.x}-${rect.y}-${index}`}
          aria-hidden
          className="pointer-events-none absolute rounded-[3px] bg-accent/15 ring-2 ring-accent"
          style={{
            left: `${((rect.x - x) / w) * 100}%`,
            top: `${((rect.y - y) / h) * 100}%`,
            width: `${(rect.w / w) * 100}%`,
            height: `${(rect.h / h) * 100}%`,
          }}
        />
      ))}
    </div>
  )
}
