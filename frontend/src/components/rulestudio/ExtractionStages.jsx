import { useEffect, useState } from 'react'

import { listRules } from '@/api'

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

/**
 * The fields the extractor is constrained to emit (docs/ENGINEERING.md §2). Shown as the
 * ticker under "Menyusun ambang batas" because they are what assembling a
 * threshold actually consists of.
 *
 * These are real payload keys, not decoration. Nothing here invents a figure or
 * a citation — docs/ENGINEERING.md §5 — which is why the ticker reads out field names it
 * is filling rather than values it has supposedly found.
 */
const FIELD_TOKENS = [
  'dimension',
  'operator',
  'threshold',
  'unit',
  'applies_to.axle_config',
  'applies_to.axle_index',
  'legal_citation',
  'tags',
]

export default function ExtractionStages({ done, reducedMotion, document: doc }) {
  const [reached, setReached] = useState(0)
  const [citations, setCitations] = useState([])

  useEffect(() => {
    if (reducedMotion) return undefined
    if (reached >= STAGES.length - 1) return undefined
    const timer = setTimeout(() => setReached((n) => n + 1), 700)
    return () => clearTimeout(timer)
  }, [reached, reducedMotion])

  // The comparison stage reads out the rule base it is comparing against, so
  // the text scrolling past is the real active rule set rather than invented
  // filler. A failure just leaves the ticker empty; it is an accompaniment to
  // the stage label, never the thing carrying the meaning.
  useEffect(() => {
    let cancelled = false
    listRules()
      .then((data) => {
        if (cancelled) return
        setCitations((data.results ?? []).map((rule) => rule.legal_citation).filter(Boolean))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

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
            <span className="min-w-0">
              <span
                className={[
                  'block',
                  active(index) ? 'text-h2 text-ink-900' : 'text-label',
                  complete(index) ? 'text-ink-500' : active(index) ? '' : 'text-ink-400',
                ].join(' ')}
              >
                {stage}
              </span>

              {/* The two stages that are doing work worth watching get a readout
                  of what is passing through them. The first two are I/O; there
                  is nothing to show. */}
              {active(index) && index === 2 && (
                <Ticker lines={FIELD_TOKENS} prefix="susun" reducedMotion={reducedMotion} />
              )}
              {active(index) && index === 3 && (
                <Ticker lines={citations} prefix="cocok" reducedMotion={reducedMotion} />
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * A fast readout of what the active stage is chewing through.
 *
 * `aria-hidden`: this is motion accompanying a stage label that already says
 * what is happening. A screen reader announcing eight field names a second
 * would be noise, and the label carries the whole meaning without it.
 *
 * Reserved height and truncation, so a long citation cannot reflow the panel
 * mid-extraction — the stages must not jump while the reveal is running.
 */
function Ticker({ lines, prefix, reducedMotion }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (reducedMotion || lines.length === 0) return undefined
    const id = setInterval(() => setIndex((n) => (n + 1) % lines.length), 90)
    return () => clearInterval(id)
  }, [lines, reducedMotion])

  if (lines.length === 0) return null

  return (
    <span
      aria-hidden
      className="mt-1 block h-4 truncate font-mono text-mono-xs text-ink-400"
    >
      {prefix} · {lines[reducedMotion ? 0 : index % lines.length]}
    </span>
  )
}
