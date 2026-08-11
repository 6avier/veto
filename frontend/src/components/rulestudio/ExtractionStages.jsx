import { useEffect, useState } from 'react'

/**
 * PRODUCT.md F3b: "Extraction progress is shown as discrete stages, not a
 * spinner. The reveal of the AI working is the point."
 *
 * Stages advance on their own schedule while one real request is in flight.
 * A fast response must not skip the reveal entirely, and a slow one must not
 * strand a stage forever, so the last stage holds until the response lands.
 */
const STAGES = [
  'Membaca dokumen',
  'Menemukan klausa ketentuan',
  'Menyusun ambang batas',
  'Membandingkan dengan basis aturan VETO',
]

export default function ExtractionStages({ done, reducedMotion }) {
  const [reached, setReached] = useState(0)

  useEffect(() => {
    if (reducedMotion) return undefined
    if (reached >= STAGES.length - 1) return undefined
    const timer = setTimeout(() => setReached((n) => n + 1), 700)
    return () => clearTimeout(timer)
  }, [reached, reducedMotion])

  const complete = (index) => (done ? true : index < reached)
  const active = (index) => !done && index === reached

  return (
    <section className="border border-ink-200 bg-white px-5 py-4">
      <p className="font-mono text-mono-xs tracking-[0.12em] text-ink-400">EKSTRAKSI</p>
      <ol className="mt-3 space-y-2">
        {STAGES.map((stage, index) => (
          <li key={stage} className="flex items-baseline gap-3">
            <span
              aria-hidden
              className={[
                'h-1.5 w-1.5 shrink-0 self-center',
                complete(index) ? 'bg-ink-900' : active(index) ? 'bg-hold' : 'bg-ink-200',
              ].join(' ')}
            />
            <span
              className={[
                'text-body',
                complete(index) ? 'text-ink-900' : active(index) ? 'text-ink-700' : 'text-ink-400',
              ].join(' ')}
            >
              {stage}
            </span>
            {active(index) && (
              <span className="font-mono text-mono-xs text-ink-400">berjalan…</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
