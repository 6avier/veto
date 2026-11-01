import { UploadSimpleIcon, WarningIcon } from '@phosphor-icons/react'

import { classificationLabel, rejectionReason } from '@/copy/rejectionReasons'

import PageSheet from './PageSheet'
import { BTN_GHOST, BTN_PRIMARY, BTN_QUIET, PANEL } from './ui'

/**
 * The document stage: the PDF's first page on the left, what VETO made of it
 * on the right. PRODUCT.md F3a, three outcomes, not two.
 *
 * A low-confidence classification is surfaced to the human rather than
 * auto-rejected: the model narrows the decision, it does not make it. So the
 * third state must offer a way through, never a wall.
 *
 * With no `document` yet it is the upload in flight.
 */
export default function TriageResult({ document: doc, cover, filename, onExtract, onReset, busy }) {
  const uploading = !doc
  const confidence = Math.round((doc?.classification_confidence ?? 0) * 100)
  const uncertain = doc?.needs_human_review

  return (
    <section className={`${PANEL} grid items-start gap-5 p-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]`}>
      <div className="rounded-2xl bg-console p-4">
        <PageSheet
          image={cover?.image}
          alt={`Halaman 1 dari ${doc?.filename ?? filename}`}
          className="veto-page-in"
        />
      </div>

      <div className="grid content-start gap-5 px-1 py-2">
        <div className="min-w-0">
          <h2 className="break-words text-[22px] font-bold leading-tight tracking-[-0.02em]">
            {doc?.filename ?? filename}
          </h2>
          {doc && <p className="mt-1 text-[13px] text-ink-400">{doc.page_count} halaman</p>}
        </div>

        {uploading && (
          <p className="flex items-center gap-2.5 text-[14px] font-bold text-ink-500">
            <Spinner />
            Mengunggah dan memeriksa jenis dokumen
          </p>
        )}

        {doc && (
          <span
            className={`justify-self-start rounded-full px-2.5 py-1 text-[12px] font-bold ${
              doc.accepted ? 'bg-accent-soft text-accent-ink' : 'bg-hold/15 text-hold-ink'
            }`}
          >
            {classificationLabel(doc.classification)}, keyakinan {confidence}%
          </span>
        )}

        {doc?.accepted && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => onExtract(false)} disabled={busy} className={BTN_PRIMARY}>
              Ekstrak aturan
            </button>
            <button type="button" onClick={onReset} className={BTN_QUIET}>
              Ganti dokumen
            </button>
          </div>
        )}

        {doc && !doc.accepted && !uncertain && (
          <>
            <Verdict title="Tidak diproses" body={rejectionReason(doc.rejection_reason_code)} />
            <div>
              <button type="button" onClick={onReset} className={BTN_GHOST}>
                <UploadSimpleIcon size={18} aria-hidden />
                Unggah dokumen lain
              </button>
            </div>
          </>
        )}

        {uncertain && (
          <>
            <Verdict
              title="Perlu keputusan Anda"
              body="Model tidak cukup yakin untuk memutuskan sendiri jenis dokumen ini."
            />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => onExtract(true)} disabled={busy} className={BTN_GHOST}>
                Tinjau tetap
              </button>
              <button type="button" onClick={onReset} className={BTN_QUIET}>
                Unggah dokumen lain
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function Verdict({ title, body }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-hold text-[#3a2300]">
        <WarningIcon size={18} aria-hidden />
      </span>
      <div>
        <p className="text-[15px] font-bold">{title}</p>
        <p className="mt-0.5 max-w-[46ch] text-[14px] text-ink-500">{body}</p>
      </div>
    </div>
  )
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-accent-soft border-t-accent"
    />
  )
}
