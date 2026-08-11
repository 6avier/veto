import { classificationLabel, rejectionReason } from '@/copy/rejectionReasons'

/**
 * PRODUCT.md F3a. Three outcomes, not two.
 *
 * A low-confidence classification is surfaced to the human rather than
 * auto-rejected: the model narrows the decision, it does not make it. So the
 * third state must offer a way through, never a wall.
 */
export default function TriageResult({ document: doc, onExtract, onReset, busy, extracted }) {
  const confidence = Math.round((doc.classification_confidence ?? 0) * 100)
  const uncertain = doc.needs_human_review

  return (
    <section className="border border-ink-200 bg-white">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-ink-200 px-5 py-3">
        <h2 className="text-h2">{doc.filename}</h2>
        <span className="font-mono text-mono-xs text-ink-400">
          {doc.page_count} halaman
        </span>
        <span className="ml-auto font-mono text-mono-xs text-ink-400">
          {classificationLabel(doc.classification)} · keyakinan {confidence}%
        </span>
      </header>

      <div className="px-5 py-4">
        {doc.accepted && !extracted && (
          <>
            <p className="max-w-[65ch] text-body">
              Dokumen ini berisi ketentuan muatan. Lanjutkan ke ekstraksi untuk menarik
              aturannya, lalu tinjau setiap usulan sebelum disetujui.
            </p>
            <button
              type="button"
              onClick={() => onExtract(false)}
              disabled={busy}
              className="mt-4 rounded-veto bg-ink-900 px-4 py-2 text-label text-white disabled:opacity-50"
            >
              Ekstrak aturan
            </button>
          </>
        )}

        {doc.accepted && extracted && (
          <p className="max-w-[65ch] text-body text-ink-500">
            Ekstraksi sudah dijalankan untuk dokumen ini.
          </p>
        )}

        {!doc.accepted && !uncertain && (
          <>
            <div className="flex gap-3">
              <span aria-hidden className="mt-1.5 h-3 w-3 shrink-0 bg-hold" />
              <p className="max-w-[65ch] text-body">
                {rejectionReason(doc.rejection_reason_code)}
              </p>
            </div>
            <p className="mt-3 text-label text-ink-500">
              Tidak ada panggilan ekstraksi yang dijalankan untuk dokumen ini.
            </p>
            <button
              type="button"
              onClick={onReset}
              className="mt-4 text-label text-ink-500 underline underline-offset-4 hover:text-ink-900"
            >
              Unggah dokumen lain
            </button>
          </>
        )}

        {uncertain && !extracted && (
          <>
            <div className="flex gap-3">
              <span aria-hidden className="mt-1.5 h-3 w-3 shrink-0 bg-hold" />
              <p className="max-w-[65ch] text-body">
                Model tidak cukup yakin untuk memutuskan sendiri. Keputusan ada pada Anda.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onExtract(true)}
                disabled={busy}
                className="rounded-veto border border-ink-900 px-4 py-2 text-label text-ink-900 disabled:opacity-50"
              >
                Tinjau tetap
              </button>
              <button
                type="button"
                onClick={onReset}
                className="text-label text-ink-500 underline underline-offset-4 hover:text-ink-900"
              >
                Unggah dokumen lain
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
