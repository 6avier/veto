import { useEffect, useRef, useState } from 'react'

import {
  ApiError,
  approveCandidate,
  extractRules,
  getDocumentPage,
  rejectCandidate,
  uploadDocument,
} from '@/api'
import CandidateReview from '@/components/rulestudio/CandidateReview'
import DropZone from '@/components/rulestudio/DropZone'
import ExtractionStages from '@/components/rulestudio/ExtractionStages'
import RuleRegister from '@/components/rulestudio/RuleRegister'
import SourcePlate from '@/components/rulestudio/SourcePlate'
import TriageResult from '@/components/rulestudio/TriageResult'

/**
 * /rule-studio — PRODUCT.md F3. The register surface: light ground, editorial
 * measure, citations set as legal references.
 *
 * For client policy documents only. National ODOL regulations are maintained
 * centrally by VETO and are never uploaded here (PRODUCT.md §4), which is why
 * a government regulation is a rejection at triage rather than a happy path.
 *
 * Flow: idle -> uploading -> triaged -> extracting -> reviewing
 */

const REVIEWER = 'Sari Wulandari'

export default function RuleStudio() {
  const [stage, setStage] = useState('idle')
  const [document, setDocument] = useState(null)
  // Extraction returns every clause it found, not one. A live 26-page SOP
  // yielded 32 candidates across three pages, and all of them are laid out at
  // once: stepping through with prev/next reduced that haul to a "1 / 32"
  // counter, which hid both the scale of what was read and any candidate the
  // reviewer might otherwise have skipped straight to.
  const [candidates, setCandidates] = useState([])
  // Which candidate the source plate is showing. It follows the list rather
  // than a selection, so it tracks whatever the reviewer has scrolled to.
  const [activeId, setActiveId] = useState(null)
  // candidate_id -> approve/reject response. Per candidate, because each is
  // decided separately and every decided one stays on screen showing its
  // outcome while the reviewer works down the rest of the list.
  const [outcomes, setOutcomes] = useState({})
  // Only the candidate being submitted is disabled. A single global flag would
  // freeze all 32 cards while one of them was in flight.
  const [submittingId, setSubmittingId] = useState(null)
  // { id, message } for the one decision that failed, shown on its own card.
  const [submitError, setSubmitError] = useState(null)
  const [usedFallback, setUsedFallback] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(null)
  const [pageLoading, setPageLoading] = useState(false)
  const [pageError, setPageError] = useState(false)
  // Pages are expensive to render and heavily shared: 17 of those 32 candidates
  // cited page 1. Re-fetching a full-page PNG on every step would make the
  // plate flicker through a skeleton it does not need.
  const pageCache = useRef(new Map())
  // candidate_id -> the card's element, registered by callback ref so the
  // observer can be pointed at cards that mount and unmount with the list.
  const cardNodes = useRef(new Map())
  const visibleIds = useRef(new Set())
  // The observer callback needs the current active id without re-subscribing
  // every time it changes.
  const activeIdRef = useRef(null)

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const reset = () => {
    setStage('idle')
    setDocument(null)
    setCandidates([])
    setActiveId(null)
    setOutcomes({})
    setSubmittingId(null)
    setSubmitError(null)
    setUsedFallback(false)
    setError(null)
    setPage(null)
    setPageLoading(false)
    setPageError(false)
    pageCache.current.clear()
    cardNodes.current.clear()
    visibleIds.current.clear()
    activeIdRef.current = null
  }

  const fail = (caught) => setError(caught instanceof ApiError ? caught : ApiError.from(caught))

  async function handleFile(file) {
    setStage('uploading')
    setError(null)
    try {
      const result = await uploadDocument(file)
      setDocument(result)
      setStage('triaged')
    } catch (caught) {
      fail(caught)
      setStage('idle')
    }
  }

  async function handleExtract(force) {
    setStage('extracting')
    setError(null)
    try {
      const result = await extractRules(document.document_id, { force })
      setUsedFallback(Boolean(result.used_fallback))
      const found = result.candidates ?? []
      setCandidates(found)
      setOutcomes({})
      setActiveId(found[0]?.candidate_id ?? null)
      activeIdRef.current = found[0]?.candidate_id ?? null
      visibleIds.current.clear()
      setStage('reviewing')
      // The page is fetched after the verdict is on screen, not before. It is
      // the evidence for a rule that already exists, and a slow render must
      // never hold up the review itself.
      if (found[0]?.source_page && !result.used_fallback) {
        loadPage(document.document_id, found[0].source_page)
      }
    } catch (caught) {
      fail(caught)
      setStage('triaged')
    }
  }

  async function loadPage(documentId, pageNumber) {
    const cached = pageCache.current.get(pageNumber)
    if (cached) {
      setPage(cached)
      setPageError(false)
      setPageLoading(false)
      return
    }
    setPageLoading(true)
    setPageError(false)
    try {
      const fetched = await getDocumentPage(documentId, pageNumber)
      pageCache.current.set(pageNumber, fetched)
      setPage(fetched)
    } catch {
      // A missing page plate is a degraded view, not a failed review. The
      // extracted rule and its citation stand on their own.
      setPageError(true)
    } finally {
      setPageLoading(false)
    }
  }

  /**
   * The plate follows the list rather than a selection. Every card is on screen
   * at once, so the rule the reviewer is reading is the topmost one in view,
   * and the observer names it. DESIGN.md §8 rules out a scroll listener, and
   * this needs no measuring anyway.
   *
   * The band is the upper third of the viewport, not the whole of it: with
   * three cards visible, the one being read is the one at the top.
   *
   * Decided cards are skipped. A decided one collapses to a single row but
   * stays in the list and stays observed, so it went on winning this selection
   * from the top of the band: approving the first candidate left the plate on
   * its page while the card actually filling the screen cited another. The
   * reviewer is only ever on a rule that is still open, so only those count.
   *
   * `outcomes` is a dependency for the same reason. Deciding a card collapses
   * it, which moves everything below it, and the observer has to be re-asked
   * which card the reviewer landed on. Re-observing replays each target's
   * current state, so `visibleIds` refills on its own.
   */
  useEffect(() => {
    if (stage !== 'reviewing' || candidates.length === 0) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.dataset.candidateId
          if (entry.isIntersecting) visibleIds.current.add(id)
          else visibleIds.current.delete(id)
        }

        const open = candidates.filter(
          (item) => visibleIds.current.has(item.candidate_id) && !outcomes[item.candidate_id],
        )
        // Nothing open on screen — mid-flick, or every visible rule is decided.
        // Hold the last one rather than blanking the plate.
        if (open.length === 0) return

        // Whichever open card fills most of the reading band, not merely the
        // first to touch it: the tail of the card above reaches perhaps 30px
        // past the band's top edge, and taking the first match handed the plate
        // to that sliver instead of the card covering the rest of the band.
        //
        // The band is a preference, not a requirement. Everything above the
        // list — heading, triage panel, extraction stages, summary strip — runs
        // to roughly 570px, so at the top of the page nothing reaches the band
        // at all. There, the topmost card on screen is the one being read.
        const bandTop = window.innerHeight * 0.1
        const bandBottom = window.innerHeight * 0.45
        let best = null
        let bestOverlap = 0
        for (const item of open) {
          const node = cardNodes.current.get(item.candidate_id)
          if (!node) continue
          const rect = node.getBoundingClientRect()
          const overlap = Math.min(rect.bottom, bandBottom) - Math.max(rect.top, bandTop)
          if (overlap > bestOverlap) {
            bestOverlap = overlap
            best = item
          }
        }

        const first = best ?? open[0]
        if (first.candidate_id === activeIdRef.current) return
        activeIdRef.current = first.candidate_id
        setActiveId(first.candidate_id)
        if (first.source_page && !usedFallback) {
          loadPage(document.document_id, first.source_page)
        }
      },
      // Visibility only. The reading band is applied above, against live rects,
      // because it has to be able to find nothing and say so.
      { rootMargin: '0px' },
    )

    for (const node of cardNodes.current.values()) observer.observe(node)
    return () => {
      observer.disconnect()
      visibleIds.current.clear()
    }
  }, [candidates, stage, usedFallback, document, outcomes])

  const registerCard = (id) => (node) => {
    if (node) cardNodes.current.set(id, node)
    else cardNodes.current.delete(id)
  }

  /**
   * A failed decision reports inside the card that failed, not in the page's
   * error slot. That slot sits under the list, and with ten candidates on
   * screen it landed 269px below the fold: the reviewer pressed confirm, saw
   * the card sit there unchanged, and had no reason to think anything had
   * happened. Only one decision is ever in flight, so one slot is enough.
   */
  async function submitDecision(id, send) {
    setSubmittingId(id)
    setSubmitError(null)
    try {
      const outcome = await send()
      setOutcomes((prev) => ({ ...prev, [id]: outcome }))
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : ApiError.from(caught)
      setSubmitError({ id, message: apiError.message })
    } finally {
      setSubmittingId(null)
    }
  }

  const handleApprove = (id) => submitDecision(id, () => approveCandidate(id, REVIEWER))
  const handleReject = (id, note) => submitDecision(id, () => rejectCandidate(id, REVIEWER, note))

  const busy = stage === 'uploading' || stage === 'extracting' || Boolean(submittingId)
  // Mocks have no PDF to render and the fallback candidate quotes no document,
  // so in both cases the review stays single-column rather than reserving a
  // gap for a plate that is never coming.
  const showPlate = Boolean(page || pageLoading || pageError)

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1">Rule Studio</h1>
          <p className="mt-1 max-w-[65ch] text-body text-ink-500">
            Unggah kebijakan internal, tinjau aturan yang diekstraksi berdampingan dengan
            kalimat sumbernya, lalu setujui atau tolak. Peraturan nasional sudah dipelihara
            VETO secara terpusat dan tidak perlu diunggah.
          </p>
        </div>
        {stage !== 'idle' && (
          <button
            type="button"
            onClick={reset}
            className="text-label text-ink-500 underline underline-offset-4 hover:text-ink-900"
          >
            Mulai dari awal
          </button>
        )}
      </header>

      <div className="mt-6 space-y-4">
        {stage === 'idle' && <DropZone onFile={handleFile} disabled={busy} />}

        {stage === 'uploading' && (
          <section className="border border-ink-200 bg-white px-5 py-4">
            <p className="font-mono text-mono-xs tracking-[0.12em] text-ink-400">TRIASE</p>
            <p className="mt-2 text-body text-ink-700">
              Mengklasifikasikan dokumen dari cuplikan awal…
            </p>
            <p className="mt-1 text-label text-ink-500">
              Satu panggilan singkat. Ekstraksi penuh hanya berjalan jika dokumen ini memang
              berisi kebijakan.
            </p>
          </section>
        )}

        {document && stage !== 'uploading' && stage !== 'idle' && (
          <TriageResult
            document={document}
            onExtract={handleExtract}
            onReset={reset}
            busy={busy}
            extracted={stage !== 'triaged'}
          />
        )}

        {(stage === 'extracting' || stage === 'reviewing') &&
          document?.accepted !== false && (
            <ExtractionStages
              done={stage !== 'extracting'}
              reducedMotion={reducedMotion}
              document={document}
            />
          )}

        {usedFallback && stage !== 'extracting' && (
          <p className="text-label text-ink-500">
            <span className="font-mono text-mono-xs tracking-[0.1em] text-ink-500">
              HASIL PRA-PROSES ·{' '}
            </span>
            Layanan model tidak dapat dihubungi, jadi hasil ekstraksi yang tersimpan
            sebelumnya yang ditampilkan.
          </p>
        )}

        {candidates.length > 0 && stage === 'reviewing' && (
          <div
            className={[
              'grid gap-4 lg:items-start',
              showPlate ? 'lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]' : '',
            ].join(' ')}
          >
            {showPlate && (
              /* Sticky only from lg up. On a narrow screen the plate stacks
                 above the list and pinning it there would eat the viewport the
                 cards need. */
              <div className="lg:sticky lg:top-4 lg:self-start">
                <SourcePlate
                  page={page}
                  loading={pageLoading}
                  error={pageError}
                  activeCandidateId={activeId}
                />
              </div>
            )}

            <div>
              <CandidateSummary
                total={candidates.length}
                decided={Object.keys(outcomes).length}
              />
              <ol>
                {candidates.map((item, index) => (
                  <li
                    key={item.candidate_id}
                    ref={registerCard(item.candidate_id)}
                    data-candidate-id={item.candidate_id}
                    className="mt-4 scroll-mt-4 first:mt-0"
                  >
                    <CandidateReview
                      candidate={item}
                      onApprove={() => handleApprove(item.candidate_id)}
                      onReject={(note) => handleReject(item.candidate_id, note)}
                      busy={submittingId === item.candidate_id}
                      error={
                        submitError?.id === item.candidate_id ? submitError.message : null
                      }
                      result={outcomes[item.candidate_id] ?? null}
                      position={index + 1}
                      total={candidates.length}
                    />
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {stage === 'reviewing' && candidates.length === 0 && (
          <section className="border border-dashed border-ink-300 px-5 py-8 text-center">
            <p className="text-body text-ink-500">
              Tidak ada ketentuan muatan yang dapat diekstraksi dari dokumen ini.
            </p>
          </section>
        )}

        {error && (
          <div className="border border-ink-200 bg-white px-5 py-4">
            <p className="font-mono text-mono-xs text-hold-ink">{error.code}</p>
            <p className="mt-1 text-body">{error.message}</p>
          </div>
        )}
      </div>

      {/* The page's floor. It is mounted in every stage, not only at rest,
          because the useful moment to see the thresholds already in force is
          while judging a proposed one. `key` remounts it after a review so a
          newly approved rule appears in the register that follows it. */}
      <RuleRegister key={Object.keys(outcomes).length} />
    </div>
  )
}

/**
 * The scale of the haul, stated once and kept in view. A 26-page SOP yields
 * candidates in the dozens, and the count is the point: it says how much of the
 * document the extractor actually read.
 *
 * DESIGN.md §3 and §8: a ruled strip, not a card and not a pill. The counts are
 * mono and tabular because they are positions in a machine-generated list, and
 * because the reviewed figure changes under the reader as they work.
 */
function CandidateSummary({ total, decided }) {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-ink-200 bg-paper pb-3 pt-4">
      <span className="font-mono text-mono-xs tracking-[0.12em] text-ink-500">USULAN</span>
      <span className="tnum font-mono text-mono-xs text-ink-700">{total}</span>
      <span aria-live="polite" className="tnum ml-auto text-label text-ink-500">
        {decided} dari {total} sudah ditinjau
      </span>
    </div>
  )
}
