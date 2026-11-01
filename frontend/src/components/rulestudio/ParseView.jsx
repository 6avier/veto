import { ArrowRightIcon, CheckIcon, WarningIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'

import { getDocumentPage } from '@/api'
import { formatNumber } from '@/lib/format'

import CompareChip from './CompareChip'
import PageSheet from './PageSheet'
import { rectsFor } from './regions'
import { Spinner } from './TriageResult'
import { centralCounterpart, compareToCentral, dimensionOf } from './dimensions'
import { BTN_PRIMARY, PANEL } from './ui'

/**
 * Extraction, in three beats (PRODUCT.md F3b: discrete stages, not a spinner).
 *
 * 1. Membaca: the page strip is swept quickly, in a few seconds whatever the
 *    page count, over the cover page triage already fetched. It used to fetch
 *    and sweep every page in turn, which on a 26-page SOP and a slow API took
 *    minutes and rendered 26 PNGs nobody needed.
 * 2. Menyusun: if the model is still working, the view holds here with a real
 *    elapsed counter. This is the one wait the reviewer sees, and it is honest:
 *    nothing is known until the answer exists.
 * 3. Menandai: each finding is revealed on its own page with its clause boxed,
 *    so the reviewer sees where every rule came from before reviewing it. The
 *    pages are fetched once the answer is in, because only then do they carry
 *    the candidates' regions, and they are handed up so review opens instantly.
 */

const SCAN_PAGE_MS = 110
const SCAN_MIN_MS = 1200
const SCAN_MAX_MS = 3200
const REVEAL_MAX_MS = 900
const REVEAL_TOTAL_MS = 7000
// How long the reveal waits for the first finding's page before going ahead
// without it. A slow page never holds the findings back for long.
const PAGE_WAIT_MS = 1500

export default function ParseView({ document: doc, cover, result, startedAt, central, onPageLoaded, onReview }) {
  const pageCount = doc.page_count || 1
  const [scanned, setScanned] = useState(0)
  const [phase, setPhase] = useState('scan')
  const [shown, setShown] = useState(0)
  const [pages, setPages] = useState({})
  const [now, setNow] = useState(() => Date.now())
  const onPageLoadedRef = useRef(onPageLoaded)
  onPageLoadedRef.current = onPageLoaded

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const scanMs = Math.min(SCAN_MAX_MS, Math.max(SCAN_MIN_MS, pageCount * SCAN_PAGE_MS))
  const stepMs = scanMs / pageCount
  const candidates = result?.candidates ?? []
  const fallback = result?.used_fallback

  // 1. Sweep the strip.
  useEffect(() => {
    if (reducedMotion) {
      setScanned(pageCount)
      setPhase('wait')
      return undefined
    }
    let n = 0
    const id = setInterval(() => {
      n += 1
      setScanned(n)
      if (n >= pageCount) {
        clearInterval(id)
        setPhase('wait')
      }
    }, stepMs)
    return () => clearInterval(id)
  }, [pageCount, stepMs, reducedMotion])

  // The elapsed counter runs until the model has answered.
  useEffect(() => {
    if (result) return undefined
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [result])

  // Fetch the pages the findings sit on, in parallel, as soon as the answer
  // lands. A fallback answer has no regions to show, so it fetches nothing.
  useEffect(() => {
    if (!result || result.used_fallback) return undefined
    let alive = true
    const wanted = [...new Set((result.candidates ?? []).map((c) => c.source_page).filter(Boolean))]
    for (const n of wanted) {
      getDocumentPage(doc.document_id, n)
        .then((page) => {
          // Cached upstream even after this view has gone, so review is instant.
          onPageLoadedRef.current?.(n, page)
          if (alive) setPages((prev) => ({ ...prev, [n]: page }))
        })
        .catch(() => {})
    }
    return () => {
      alive = false
    }
  }, [result, doc.document_id])

  // 2 -> 3. Start revealing once the first finding's page is here, or after a
  // short wait without it.
  const firstPage = candidates[0]?.source_page
  const firstReady = Boolean(fallback || !firstPage || pages[firstPage])
  useEffect(() => {
    if (phase !== 'wait' || !result) return undefined
    if (firstReady || reducedMotion) {
      setPhase('reveal')
      return undefined
    }
    const id = setTimeout(() => setPhase('reveal'), PAGE_WAIT_MS)
    return () => clearTimeout(id)
  }, [phase, result, firstReady, reducedMotion])

  // 3. One finding at a time, each held long enough to see where it is.
  useEffect(() => {
    if (phase !== 'reveal') return undefined
    if (shown >= candidates.length) {
      setPhase('done')
      return undefined
    }
    const dwell = reducedMotion ? 0 : Math.min(REVEAL_MAX_MS, REVEAL_TOTAL_MS / candidates.length)
    // The first one appears at once; each later one waits out the previous dwell.
    const id = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 0 : dwell)
    return () => clearTimeout(id)
  }, [phase, shown, candidates.length, reducedMotion])

  const elapsed = Math.max(0, Math.floor(((result ? startedAt + (result.extraction_ms ?? 0) : now) - startedAt) / 1000))
  const visible = candidates.slice(0, shown)
  const spot = visible[visible.length - 1] ?? null
  const perPage = visible.reduce((acc, c) => ({ ...acc, [c.source_page]: (acc[c.source_page] ?? 0) + 1 }), {})

  // What the sheet shows: the cover while reading, then each finding's page.
  const spotPage = spot && !fallback ? pages[spot.source_page] ?? null : null
  const sheet = spot && !fallback ? spotPage : cover
  const sheetNumber = spot && !fallback ? spot.source_page : 1
  const scanning = phase === 'scan'
  const currentStrip = scanning ? Math.min(scanned + 1, pageCount) : spot && !fallback ? spot.source_page : null

  let status
  if (phase === 'scan') status = `Membaca ${pageCount} halaman`
  else if (phase === 'wait') status = `Menyusun aturan dari ${pageCount} halaman`
  else if (phase === 'reveal') status = spot ? `Menandai ketentuan di hal. ${spot.source_page}` : 'Menandai ketentuan'
  else status = null

  return (
    <section className={`${PANEL} grid items-start gap-5 p-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]`}>
      <div className="min-w-0 rounded-2xl bg-console p-4">
        <ol className="mb-3 flex flex-wrap gap-1.5" aria-label="Halaman dokumen">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => {
            const done = n <= scanned
            const here = n === currentStrip
            const found = perPage[n]
            return (
              <li
                key={n}
                className={[
                  'relative grid h-9 w-7 place-items-center rounded-md border-[1.5px] text-[12px] font-extrabold transition-colors duration-150',
                  here
                    ? 'border-accent bg-white text-accent ring-4 ring-accent/15'
                    : done
                      ? 'border-accent-soft bg-accent-soft text-accent-ink'
                      : 'border-ink-200 bg-white text-ink-400',
                ].join(' ')}
              >
                {n}
                {found && (
                  <span className="veto-chip-in absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] text-white">
                    {found}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
        <PageSheet
          key={sheetNumber}
          image={sheet?.image ?? null}
          alt={`Halaman ${sheetNumber} dari ${doc.filename}`}
          sweep={scanning ? (scanned / pageCount) * 100 : null}
          sweepMs={stepMs}
          rects={spot && spotPage ? rectsFor(spotPage, spot.candidate_id) : []}
          className="veto-page-in"
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
            const lit = phase === 'reveal' && c === spot
            return (
              <li
                key={c.candidate_id}
                className={`veto-slide-in flex flex-wrap items-center gap-3 rounded-xl border bg-white p-2.5 transition-colors duration-200 ${
                  lit ? 'border-accent' : 'border-ink-100'
                }`}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent">
                  <Icon size={17} aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] text-ink-500">{label}</div>
                  <div className="text-[15px] font-extrabold tabular-nums">
                    {formatNumber(c.threshold)} {c.unit}
                  </div>
                </div>
                <span className="font-mono text-[12px] text-ink-400">hal. {c.source_page}</span>
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
