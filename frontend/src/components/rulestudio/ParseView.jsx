import { ArrowRightIcon, CheckIcon, WarningIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'

import { getDocumentPage } from '@/api'
import { formatNumber } from '@/lib/format'

import CompareChip from './CompareChip'
import PageSheet from './PageSheet'
import { Spinner } from './TriageResult'
import { centralCounterpart, compareToCentral, dimensionOf } from './dimensions'
import { BTN_PRIMARY, PANEL } from './ui'

/**
 * Extraction, paced by the real request (PRODUCT.md F3b: discrete stages, not
 * a spinner). Every page is fetched and swept while POST /extract is in flight,
 * because reading the pages is genuinely what the server does first. If the
 * model answers early, the remaining pages go by quickly. If it is still
 * working when the last page is read, the view holds on "Menyusun aturan" with
 * a real elapsed counter instead of inventing progress. Findings appear only
 * once the answer exists, because that is the first moment anything is known.
 */

const SWEEP_MS = 900
const FAST_MS = 120
const REVEAL_MS = 260

export default function ParseView({ document: doc, result, startedAt, central, onReview }) {
  const pageCount = doc.page_count || 1
  const [current, setCurrent] = useState(1)
  const [scanned, setScanned] = useState(0)
  const [image, setImage] = useState(null)
  const [sweep, setSweep] = useState({ at: 0, ms: 0 })
  const [phase, setPhase] = useState('scan')
  const [shown, setShown] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const resultRef = useRef(result)
  resultRef.current = result

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  // Read the pages. Each page is fetched, shown, then swept; the next one is
  // fetched while the current one sweeps.
  useEffect(() => {
    let alive = true
    const wait = (ms) => new Promise((r) => setTimeout(r, reducedMotion ? 0 : ms))
    const fetchPage = (n) => getDocumentPage(doc.document_id, n).catch(() => null)

    async function run() {
      let next = fetchPage(1)
      for (let n = 1; n <= pageCount; n += 1) {
        if (!alive) return
        if (resultRef.current) {
          // The answer is in, so the server has read every page already. The
          // rest still pass by on the strip, quickly, so the read stays visible.
          const shownPage = await next
          if (!alive) return
          if (shownPage?.image) setImage((prev) => prev ?? shownPage.image)
          for (let m = n; m <= pageCount; m += 1) {
            if (!alive) return
            setCurrent(m)
            setScanned(m)
            await wait(70)
          }
          break
        }
        const fetched = await next
        if (!alive) return
        if (n < pageCount) next = fetchPage(n + 1)
        setCurrent(n)
        setImage(fetched?.image ?? null)
        setSweep({ at: 0, ms: 0 })
        await wait(40)
        const ms = resultRef.current ? FAST_MS : SWEEP_MS
        setSweep({ at: 100, ms })
        await wait(ms + 60)
        setScanned(n)
      }
      if (alive) setPhase('wait')
    }
    run()
    return () => {
      alive = false
    }
  }, [doc.document_id, pageCount, reducedMotion])

  // The elapsed counter runs until the model has answered.
  useEffect(() => {
    if (result) return undefined
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [result])

  useEffect(() => {
    if (phase === 'wait' && result) setPhase('reveal')
  }, [phase, result])

  const candidates = result?.candidates ?? []

  // Reveal the findings one by one, faster when there are many.
  useEffect(() => {
    if (phase !== 'reveal') return undefined
    if (shown >= candidates.length) {
      setPhase('done')
      return undefined
    }
    const step = Math.min(REVEAL_MS, 3000 / Math.max(candidates.length, 1))
    const id = setTimeout(() => setShown((n) => n + 1), reducedMotion ? 0 : step)
    return () => clearTimeout(id)
  }, [phase, shown, candidates.length, reducedMotion])

  const elapsed = Math.max(0, Math.floor(((result ? startedAt + (result.extraction_ms ?? 0) : now) - startedAt) / 1000))
  const visible = candidates.slice(0, shown)
  const perPage = visible.reduce((acc, c) => ({ ...acc, [c.source_page]: (acc[c.source_page] ?? 0) + 1 }), {})
  const fallback = result?.used_fallback

  let status
  if (phase === 'scan') status = `Membaca halaman ${current} dari ${pageCount}`
  else if (phase === 'wait') status = `Menyusun aturan dari ${pageCount} halaman`
  else if (phase === 'reveal') status = 'Menandai ketentuan'
  else status = null

  return (
    <section className={`${PANEL} grid items-start gap-5 p-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]`}>
      <div className="min-w-0 rounded-2xl bg-console p-4">
        <ol className="mb-3 flex flex-wrap gap-1.5" aria-label="Halaman dokumen">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => {
            const done = n <= scanned
            const now_ = phase === 'scan' && n === current
            const found = perPage[n]
            return (
              <li
                key={n}
                className={[
                  'relative grid h-9 w-7 place-items-center rounded-md border-[1.5px] text-[11px] font-extrabold transition-colors',
                  now_ ? 'border-accent text-accent ring-4 ring-accent/15' : done ? 'border-accent-soft bg-accent-soft text-accent-ink' : 'border-ink-200 bg-white text-ink-400',
                ].join(' ')}
              >
                {n}
                {found && (
                  <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] text-white">
                    {found}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
        <PageSheet
          image={image}
          alt={`Halaman ${current} dari ${doc.filename}`}
          sweep={phase === 'scan' ? sweep.at : null}
          sweepMs={sweep.ms}
        />
      </div>

      <div className="grid min-w-0 content-start gap-4 px-1 py-2">
        <div role="status" aria-live="polite" className="flex items-center gap-2.5 text-[14px] font-bold text-ink-500">
          {status ? (
            <>
              <Spinner />
              <span>{status}</span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] text-accent-ink">
              <CheckIcon size={13} aria-hidden />
              Selesai
            </span>
          )}
          <span className="ml-auto font-mono text-[12px] font-normal tabular-nums text-ink-400">{elapsed} dtk</span>
        </div>

        <div className="flex items-baseline gap-2.5">
          <b className="text-[44px] font-extrabold leading-none tracking-[-0.03em] text-accent tabular-nums">{visible.length}</b>
          <span className="text-[14px] font-bold text-ink-500">ketentuan ditemukan</span>
        </div>

        {fallback && phase === 'done' && (
          <div className="flex items-start gap-3 rounded-xl bg-hold/15 p-3 text-[13px] text-hold-ink">
            <WarningIcon size={18} className="mt-0.5 shrink-0" aria-hidden />
            <span>Layanan model tidak dapat dihubungi. Usulan di bawah adalah angka cadangan, bukan hasil baca dokumen.</span>
          </div>
        )}

        <ul className="grid max-h-[420px] gap-2 overflow-y-auto pr-1">
          {visible.map((c) => {
            const { label, Icon } = dimensionOf(c.dimension)
            const verdict = compareToCentral(c, centralCounterpart(c, central))
            return (
              <li key={c.candidate_id} className="veto-slide-in flex flex-wrap items-center gap-3 rounded-xl border border-ink-100 bg-white p-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent">
                  <Icon size={17} aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] text-ink-500">{label}</div>
                  <div className="text-[15px] font-extrabold tabular-nums">
                    {formatNumber(c.threshold)} {c.unit}
                  </div>
                </div>
                <span className="font-mono text-[11px] text-ink-400">hal. {c.source_page}</span>
                <span className="ml-auto">
                  <CompareChip verdict={verdict} />
                </span>
              </li>
            )
          })}
        </ul>

        {phase === 'done' && (
          <div>
            {candidates.length > 0 ? (
              <button type="button" onClick={onReview} className={BTN_PRIMARY}>
                Tinjau {candidates.length} usulan
                <ArrowRightIcon size={16} aria-hidden />
              </button>
            ) : (
              <p className="text-[14px] text-ink-500">Tidak ada ketentuan muatan yang dapat diekstraksi dari dokumen ini.</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
