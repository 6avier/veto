import { useRef, useState } from 'react'

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
 * Flow: idle -> uploading -> triaged -> extracting -> reviewing -> reviewed
 */

const REVIEWER = 'Sari Wulandari'

export default function RuleStudio() {
  const [stage, setStage] = useState('idle')
  const [document, setDocument] = useState(null)
  // Extraction returns every clause it found, not one. A live 26-page SOP
  // yielded 32 candidates across three pages, so the reviewer steps through
  // them and the source plate follows whichever one is under review.
  const [candidates, setCandidates] = useState([])
  const [activeIndex, setActiveIndex] = useState(0)
  // candidate_id -> approve/reject response. Per candidate, because each is
  // decided separately and a decided one must keep showing its outcome when
  // the reviewer navigates back to it.
  const [outcomes, setOutcomes] = useState({})
  const [usedFallback, setUsedFallback] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(null)
  const [pageLoading, setPageLoading] = useState(false)
  const [pageError, setPageError] = useState(false)
  // Pages are expensive to render and heavily shared: 17 of those 32 candidates
  // cited page 1. Re-fetching a full-page PNG on every step would make the
  // plate flicker through a skeleton it does not need.
  const pageCache = useRef(new Map())

  const candidate = candidates[activeIndex] ?? null
  const reviewResult = candidate ? (outcomes[candidate.candidate_id] ?? null) : null

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const reset = () => {
    setStage('idle')
    setDocument(null)
    setCandidates([])
    setActiveIndex(0)
    setOutcomes({})
    setUsedFallback(false)
    setError(null)
    setPage(null)
    setPageLoading(false)
    setPageError(false)
    pageCache.current.clear()
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
      setActiveIndex(0)
      setOutcomes({})
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
   * Move to another candidate. The plate follows it, so the reviewer is always
   * looking at the page the rule in front of them was read from, and the stage
   * follows whether that candidate has already been decided so its approve and
   * reject controls come back only when they are still available.
   */
  function goToCandidate(index) {
    if (index < 0 || index >= candidates.length) return
    setActiveIndex(index)
    setError(null)
    const next = candidates[index]
    setStage(outcomes[next.candidate_id] ? 'reviewed' : 'reviewing')
    if (next?.source_page && !usedFallback) {
      loadPage(document.document_id, next.source_page)
    }
  }

  function recordOutcome(id, outcome) {
    setOutcomes((prev) => ({ ...prev, [id]: outcome }))
    setStage('reviewed')
  }

  async function handleApprove() {
    const id = candidate.candidate_id
    setStage('submitting')
    try {
      recordOutcome(id, await approveCandidate(id, REVIEWER))
    } catch (caught) {
      fail(caught)
      setStage('reviewing')
    }
  }

  async function handleReject(note) {
    const id = candidate.candidate_id
    setStage('submitting')
    try {
      recordOutcome(id, await rejectCandidate(id, REVIEWER, note))
    } catch (caught) {
      fail(caught)
      setStage('reviewing')
    }
  }

  const busy = stage === 'uploading' || stage === 'extracting' || stage === 'submitting'
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

        {(stage === 'extracting' || stage === 'reviewing' || stage === 'submitting' || stage === 'reviewed') &&
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

        {candidate && (stage === 'reviewing' || stage === 'submitting' || stage === 'reviewed') && (
          <>
            {candidates.length > 1 && (
              <CandidateNav
                index={activeIndex}
                total={candidates.length}
                decided={Object.keys(outcomes).length}
                page={candidate.source_page}
                busy={stage === 'submitting'}
                onGo={goToCandidate}
              />
            )}
            <div
              className={[
                'grid gap-4 lg:items-start',
                showPlate ? 'lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]' : '',
              ].join(' ')}
            >
              {showPlate && (
                <SourcePlate
                  page={page}
                  loading={pageLoading}
                  error={pageError}
                  activeCandidateId={candidate.candidate_id}
                />
              )}
              <CandidateReview
                candidate={candidate}
                onApprove={handleApprove}
                onReject={handleReject}
                busy={stage === 'submitting'}
                result={reviewResult}
                position={activeIndex + 1}
                total={candidates.length}
              />
            </div>
          </>
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
 * Steps through the extracted candidates. Extraction is one call that returns
 * every clause it found, so this is the only way to reach any rule past the
 * first, and the only way to reach the pages those rules came from.
 *
 * DESIGN.md §3 and §8: a ruled strip, not a card and not a pill. The counter is
 * mono because it is a position in a machine-generated list, and it carries the
 * source page so the reviewer can tell that moving the selection also moved the
 * plate beside it.
 */
function CandidateNav({ index, total, decided, page, busy, onGo }) {
  return (
    <nav
      aria-label="Navigasi usulan aturan"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ink-200 pb-3"
    >
      <span className="font-mono text-mono-xs tracking-[0.12em] text-ink-500">USULAN</span>
      <span className="tnum font-mono text-mono-xs text-ink-700">
        {index + 1} / {total}
      </span>
      {page ? (
        <span className="tnum font-mono text-mono-xs text-ink-500">halaman {page}</span>
      ) : null}

      <span className="tnum ml-auto text-label text-ink-500">
        {decided} dari {total} sudah ditinjau
      </span>

      <span className="flex gap-2">
        <NavStep
          onClick={() => onGo(index - 1)}
          disabled={busy || index === 0}
          label="Usulan sebelumnya"
        >
          Sebelumnya
        </NavStep>
        <NavStep
          onClick={() => onGo(index + 1)}
          disabled={busy || index >= total - 1}
          label="Usulan berikutnya"
        >
          Berikutnya
        </NavStep>
      </span>
    </nav>
  )
}

function NavStep({ onClick, disabled, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-veto border border-ink-300 px-2.5 py-1 text-label text-ink-700 transition-colors hover:border-ink-500 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-200 disabled:text-ink-300"
    >
      {children}
    </button>
  )
}
