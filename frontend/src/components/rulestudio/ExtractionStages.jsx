import { useEffect, useState } from 'react'

/**
 * PRODUCT.md F3b: "Extraction progress is shown as discrete stages, not a
 * spinner. The reveal of the AI working is the point."
 *
 * Stages advance on their own schedule while one real request is in flight.
 * A fast response must not skip the reveal entirely, and a slow one must not
 * strand a stage forever, so the last stage holds until the response lands.
 *
 * The stage in flight is the only large thing here. An earlier version set all
 * four lines at one weight, which made the most active moment in the product
 * read as a static bulleted list. Done work recedes to a label, pending work
 * stays quiet, and exactly one line speaks at a time.
 */
const STAGES = [
  'Membaca dokumen',
  'Menemukan klausa ketentuan',
  'Menyusun ambang batas',
  'Membandingkan dengan basis aturan VETO',
]

export default function ExtractionStages({ done, reducedMotion, document: doc }) {
  const [reached, setReached] = useState(0)

  useEffect(() => {
    if (reducedMotion) return undefined
    if (reached >= STAGES.length - 1) return undefined
    const timer = setTimeout(() => setReached((n) => n + 1), 700)
    return () => clearTimeout(timer)
  }, [reached, reducedMotion])

  const complete = (index) => (done ? true : index < reached)
  const active = (index) => !done && index === reached
  const progress = done ? 1 : (reached + 1) / STAGES.length

  return (
    <section className="border border-ink-200 bg-white px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-mono text-mono-xs tracking-[0.12em] text-ink-500">EKSTRAKSI</p>
        {doc && (
          <p className="truncate font-mono text-mono-xs text-ink-500">
            {doc.filename} · {doc.page_count} hal
          </p>
        )}
        <p className="tnum ml-auto font-mono text-mono-xs text-ink-500">
          {done ? STAGES.length : Math.min(reached + 1, STAGES.length)}/{STAGES.length}
        </p>
      </div>

      {/* One hairline carrying progress. A bar, not a spinner: DESIGN.md §8
          bans spinners, and this reads as an instrument rather than a wait. */}
      <div aria-hidden className="mt-2.5 h-px w-full bg-ink-100">
        <div
          className="h-px bg-ink-900 transition-[width] duration-500 ease-out"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <ol className="mt-3.5 space-y-1.5">
        {STAGES.map((stage, index) => (
          <li key={stage} className="flex items-baseline gap-2.5">
            <span
              aria-hidden
              className={[
                'shrink-0 self-center',
                active(index) ? 'h-2 w-2' : 'h-1.5 w-1.5',
                complete(index) ? 'bg-ink-900' : active(index) ? 'bg-hold' : 'bg-ink-200',
              ].join(' ')}
            />
            <span
              className={[
                active(index) ? 'text-h2 text-ink-900' : 'text-label',
                complete(index) ? 'text-ink-500' : active(index) ? '' : 'text-ink-400',
              ].join(' ')}
            >
              {stage}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
