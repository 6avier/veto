import { useState } from 'react'

import {
  ApiError,
  approveCandidate,
  extractRules,
  rejectCandidate,
  uploadDocument,
} from '@/api'
import CandidateReview from '@/components/rulestudio/CandidateReview'
import DropZone from '@/components/rulestudio/DropZone'
import ExtractionStages from '@/components/rulestudio/ExtractionStages'
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
  const [candidate, setCandidate] = useState(null)
  const [usedFallback, setUsedFallback] = useState(false)
  const [reviewResult, setReviewResult] = useState(null)
  const [error, setError] = useState(null)

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const reset = () => {
    setStage('idle')
    setDocument(null)
    setCandidate(null)
    setReviewResult(null)
    setUsedFallback(false)
    setError(null)
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
      setCandidate(result.candidates?.[0] ?? null)
      setStage('reviewing')
    } catch (caught) {
      fail(caught)
      setStage('triaged')
    }
  }

  async function handleApprove() {
    setStage('submitting')
    try {
      setReviewResult(await approveCandidate(candidate.candidate_id, REVIEWER))
      setStage('reviewed')
    } catch (caught) {
      fail(caught)
      setStage('reviewing')
    }
  }

  async function handleReject(note) {
    setStage('submitting')
    try {
      setReviewResult(await rejectCandidate(candidate.candidate_id, REVIEWER, note))
      setStage('reviewed')
    } catch (caught) {
      fail(caught)
      setStage('reviewing')
    }
  }

  const busy = stage === 'uploading' || stage === 'extracting' || stage === 'submitting'

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
            <ExtractionStages done={stage !== 'extracting'} reducedMotion={reducedMotion} />
          )}

        {usedFallback && stage !== 'extracting' && (
          <p className="text-label text-ink-500">
            <span className="font-mono text-mono-xs tracking-[0.1em] text-ink-400">
              HASIL PRA-PROSES ·{' '}
            </span>
            Layanan model tidak dapat dihubungi, jadi hasil ekstraksi yang tersimpan
            sebelumnya yang ditampilkan.
          </p>
        )}

        {candidate && (stage === 'reviewing' || stage === 'submitting' || stage === 'reviewed') && (
          <CandidateReview
            candidate={candidate}
            onApprove={handleApprove}
            onReject={handleReject}
            busy={stage === 'submitting'}
            result={reviewResult}
          />
        )}

        {stage === 'reviewing' && !candidate && (
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
    </div>
  )
}
