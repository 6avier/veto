import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'

import {
  ApiError,
  approveCandidate,
  extractRules,
  getDocumentPage,
  listRules,
  rejectCandidate,
  uploadDocument,
} from '@/api'
import CandidateReview from '@/components/rulestudio/CandidateReview'
import DropZone from '@/components/rulestudio/DropZone'
import ParseView from '@/components/rulestudio/ParseView'
import RuleRegister from '@/components/rulestudio/RuleRegister'
import SourcePlate from '@/components/rulestudio/SourcePlate'
import TriageResult from '@/components/rulestudio/TriageResult'
import { BTN_QUIET, PANEL } from '@/components/rulestudio/ui'

/**
 * /rule-studio — PRODUCT.md F3.
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
  const [filename, setFilename] = useState('')
  const [cover, setCover] = useState(null)
  const [central, setCentral] = useState([])
  // The extraction request's own clock and answer. The parse view paces
  // itself by these, so the animation lasts exactly as long as the model does.
  const [startedAt, setStartedAt] = useState(0)
  const [extraction, setExtraction] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [activeId, setActiveId] = useState(null)
  // candidate_id -> approve/reject response, kept on screen as a decided row.
  const [outcomes, setOutcomes] = useState({})
  const [submittingId, setSubmittingId] = useState(null)
  const [submitError, setSubmitError] = useState(null)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(null)
  const [pageLoading, setPageLoading] = useState(false)
  const [pageError, setPageError] = useState(false)
  // Pages are expensive to render and shared between candidates.
  const pageCache = useRef(new Map())
  // Guards against a slow upload or extraction landing after "Mulai dari awal".
  const run = useRef(0)

  // The central pack, for the "lebih ketat / lebih longgar" comparison. A
  // failure only drops the comparison; the review still works.
  useEffect(() => {
    listRules({ origin: 'CENTRAL' })
      .then((data) => setCentral(data.results ?? []))
      .catch(() => {})
  }, [])

  const reset = () => {
    run.current += 1
    setStage('idle')
    setDocument(null)
    setFilename('')
    setCover(null)
    setExtraction(null)
    setCandidates([])
    setActiveId(null)
    setOutcomes({})
    setSubmittingId(null)
    setSubmitError(null)
    setError(null)
    setPage(null)
    setPageLoading(false)
    setPageError(false)
    pageCache.current.clear()
  }

  const fail = (caught) => setError(caught instanceof ApiError ? caught : ApiError.from(caught))

  async function handleFile(file) {
    const id = ++run.current
    setStage('uploading')
    setFilename(file.name)
    setDocument(null)
    setCover(null)
    setError(null)
    try {
      const result = await uploadDocument(file)
      if (id !== run.current) return
      setDocument(result)
      setStage('triaged')
      // The first page arrives after the verdict; a slow render never holds
      // up triage.
      getDocumentPage(result.document_id, 1)
        .then((p) => id === run.current && setCover(p))
        .catch(() => {})
    } catch (caught) {
      if (id !== run.current) return
      fail(caught)
      setStage('idle')
    }
  }

  async function handleExtract(force) {
    const id = run.current
    setStage('extracting')
    setStartedAt(Date.now())
    setExtraction(null)
    setError(null)
    pageCache.current.clear()
    try {
      const result = await extractRules(document.document_id, { force })
      if (id !== run.current) return
      setExtraction(result)
      setCandidates(result.candidates ?? [])
      setOutcomes({})
    } catch (caught) {
      if (id !== run.current) return
      fail(caught)
      setStage('triaged')
    }
  }

  async function loadPage(pageNumber) {
    if (!pageNumber || !document) return
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
      // Fetched after extraction, so the page carries the candidates' regions.
      const fetched = await getDocumentPage(document.document_id, pageNumber)
      pageCache.current.set(pageNumber, fetched)
      setPage(fetched)
    } catch {
      // A missing page is a degraded view, not a failed review.
      setPageError(true)
    } finally {
      setPageLoading(false)
    }
  }

  function activate(candidate) {
    if (!candidate || candidate.candidate_id === activeId) return
    setActiveId(candidate.candidate_id)
    if (!extraction?.used_fallback) loadPage(candidate.source_page)
  }

  function startReview() {
    setStage('reviewing')
    const first = candidates[0]
    setActiveId(null)
    if (first) {
      setActiveId(first.candidate_id)
      if (!extraction?.used_fallback) loadPage(first.source_page)
    }
  }

  /**
   * A failed decision reports inside the card that failed. Only one decision is
   * in flight, so one slot is enough. After a decision the next open rule
   * becomes active, so the reviewer works down the list without hunting.
   */
  async function submitDecision(id, send) {
    setSubmittingId(id)
    setSubmitError(null)
    try {
      const outcome = await send()
      const next = { ...outcomes, [id]: outcome }
      setOutcomes(next)
      const open = candidates.find((c) => !next[c.candidate_id])
      if (open) {
        setActiveId(open.candidate_id)
        if (!extraction?.used_fallback) loadPage(open.source_page)
      }
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : ApiError.from(caught)
      setSubmitError({ id, message: apiError.message })
    } finally {
      setSubmittingId(null)
    }
  }

  const decided = Object.keys(outcomes).length
  const waiting = candidates.length - decided
  const approvedVersion = Object.values(outcomes)
    .filter((o) => o.status === 'APPROVED')
    .map((o) => o.rule_pack_version)
    .filter(Boolean)
    .pop()
  const showPlate = Boolean(page || pageLoading || pageError)

  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-4 px-4 py-5">
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <h1 className="text-[32px] font-bold leading-tight tracking-[-0.02em]">Rule Studio</h1>
        {stage !== 'idle' && (
          <button type="button" onClick={reset} className={BTN_QUIET}>
            <ArrowCounterClockwiseIcon size={16} aria-hidden />
            Mulai dari awal
          </button>
        )}
      </header>

      {stage === 'idle' && <DropZone onFile={handleFile} disabled={false} />}

      {(stage === 'uploading' || stage === 'triaged') && (
        <TriageResult
          document={document}
          cover={cover}
          filename={filename}
          onExtract={handleExtract}
          onReset={reset}
          busy={false}
        />
      )}

      {stage === 'extracting' && document && (
        <ParseView
          document={document}
          result={extraction}
          startedAt={startedAt}
          central={central}
          onReview={startReview}
        />
      )}

      {stage === 'reviewing' && (
        <div className={`grid gap-4 lg:items-start ${showPlate ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]' : ''}`}>
          <div className="grid min-w-0 gap-3">
            <div className="flex flex-wrap items-center gap-3 px-1">
              <h2 className="text-[20px] font-bold tracking-[-0.02em]">
                {waiting ? `${waiting} usulan menunggu` : 'Semua sudah diputuskan'}
              </h2>
              <span className="ml-auto font-mono text-[12px] tabular-nums text-ink-500" aria-live="polite">
                {decided} dari {candidates.length} ditinjau
              </span>
            </div>

            {!waiting && candidates.length > 0 && (
              <div className="veto-rise-in flex flex-wrap items-center gap-3 rounded-2xl bg-accent px-4 py-3.5 text-white">
                <b className="text-[16px]">
                  {approvedVersion ? `Aturan Perusahaan v${approvedVersion} aktif` : 'Tidak ada aturan baru'}
                </b>
                {approvedVersion && (
                  <span className="text-[14px] text-white/85">Dipakai untuk dispatch berikutnya.</span>
                )}
              </div>
            )}

            {extraction?.used_fallback && (
              <p className="rounded-xl bg-hold/15 px-3 py-2 text-[13px] text-hold-ink">
                Layanan model tidak dapat dihubungi, jadi yang ditampilkan adalah angka cadangan.
              </p>
            )}

            {candidates.map((item, index) => (
              <CandidateReview
                key={item.candidate_id}
                candidate={item}
                central={central}
                index={index}
                active={item.candidate_id === activeId}
                onActivate={() => activate(item)}
                onApprove={() => submitDecision(item.candidate_id, () => approveCandidate(item.candidate_id, REVIEWER))}
                onReject={(note) =>
                  submitDecision(item.candidate_id, () => rejectCandidate(item.candidate_id, REVIEWER, note))
                }
                busy={submittingId === item.candidate_id}
                error={submitError?.id === item.candidate_id ? submitError.message : null}
                result={outcomes[item.candidate_id] ?? null}
              />
            ))}

            {candidates.length === 0 && (
              <p className={`${PANEL} px-5 py-8 text-center text-[14px] text-ink-500`}>
                Tidak ada ketentuan muatan yang dapat diekstraksi dari dokumen ini.
              </p>
            )}
          </div>

          {showPlate && (
            <div className="lg:sticky lg:top-4 lg:self-start">
              <SourcePlate page={page} loading={pageLoading} error={pageError} activeCandidateId={activeId} />
            </div>
          )}
        </div>
      )}

      {error && (
        <div role="alert" className={`${PANEL} px-5 py-4`}>
          <p className="text-[15px] font-bold">Permintaan gagal</p>
          <p className="mt-1 text-[14px] text-ink-600">{error.message}</p>
        </div>
      )}

      {/* Remounted after each decision so a newly approved rule appears. */}
      <RuleRegister key={decided} />
    </div>
  )
}
