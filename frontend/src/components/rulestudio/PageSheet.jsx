/**
 * One rendered PDF page, as the backend drew it.
 *
 * `sweep` is how far down the page the reader has got, 0 to 100. Everything
 * below it sits under a pale veil, so the part already read is the part that
 * looks crisp. It is driven by real page fetches during extraction, never by a
 * loop that runs on its own.
 *
 * `rects` are percentages of the page box, as /documents/{id}/pages/{n} returns
 * them, so they stay aligned at any rendered width.
 */
export default function PageSheet({ image, alt, sweep = null, sweepMs = 0, rects = [], className = '' }) {
  const transition = `top ${sweepMs}ms linear`
  return (
    <div
      className={`relative mx-auto w-full max-w-[560px] overflow-hidden rounded-md bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_32px_-16px_rgba(13,21,38,0.28)] ${className}`}
    >
      {image ? (
        <img src={image} alt={alt} className="block w-full" />
      ) : (
        <div aria-hidden className="aspect-[1/1.414] w-full animate-pulse bg-ink-50" />
      )}

      {rects.map((rect, index) => (
        <span
          key={`${rect.x}-${rect.y}-${index}`}
          aria-hidden
          className="pointer-events-none absolute rounded-[3px] bg-accent/15 ring-[1.5px] ring-accent"
          style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }}
        />
      ))}

      {image && sweep !== null && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 bg-white/70"
            style={{ top: `${sweep}%`, transition }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 h-14 border-b-2 border-accent bg-gradient-to-b from-accent/0 to-accent/10"
            style={{ top: `calc(${sweep}% - 3.5rem)`, transition }}
          />
        </>
      )}
    </div>
  )
}
