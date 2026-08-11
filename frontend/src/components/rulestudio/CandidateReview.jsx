import { useState } from 'react'

import { formatNumber } from '@/lib/format'

/**
 * The human-in-the-loop gate. PRODUCT.md F3b.
 *
 * Split screen so the officer can verify the extracted threshold against the
 * sentence it came from. The point is verification, so the excerpt and the
 * value sit side by side rather than merely on the same page.
 */

const DIMENSION_LABELS = {
  GROSS_WEIGHT: 'Berat kotor',
  AXLE_LOAD: 'Muatan sumbu',
  DIMENSION_LENGTH: 'Panjang',
  DIMENSION_WIDTH: 'Lebar',
  DIMENSION_HEIGHT: 'Tinggi',
  AXLE_CONFIG: 'Konfigurasi sumbu',
}

const OPERATOR_LABELS = { LTE: 'maksimum', GTE: 'minimum', EQ: 'tepat' }

export default function CandidateReview({ candidate, onApprove, onReject, busy, result }) {
  const [note, setNote] = useState('')
  const [rejecting, setRejecting] = useState(false)

  if (result) {
    const approved = result.status === 'APPROVED'
    return (
      <section className="border border-ink-200 bg-white px-5 py-5">
        <div className="flex items-baseline gap-3">
          {approved && <span aria-hidden className="h-3 w-3 self-center bg-ink-900" />}
          <h2 className="text-h2">{approved ? 'Aturan disetujui' : 'Usulan ditolak'}</h2>
        </div>
        {approved ? (
          <>
            <p className="mt-2 max-w-[65ch] text-body text-ink-700">
              Aturan ini kini aktif dan ikut dievaluasi pada setiap pengiriman berikutnya.
              Versi lama tidak ditimpa, melainkan disimpan sebagai riwayat.
            </p>
            <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-2">
              <Meta label="Rule pack" value={`v${result.rule_pack_version}`} />
              <Meta label="Ditinjau oleh" value={result.reviewed_by} />
              <Meta label="ID aturan" value={result.rule_id} mono />
            </dl>
          </>
        ) : (
          <p className="mt-2 max-w-[65ch] text-body text-ink-700">
            Usulan ini tidak pernah mencapai mesin validasi. Penolakan ikut tercatat.
          </p>
        )}
      </section>
    )
  }

  const unit = candidate.unit
  const value = `${formatNumber(candidate.threshold)} ${unit}`

  return (
    <section className="border border-ink-200 bg-white">
      <header className="flex flex-wrap items-baseline gap-3 border-b border-ink-200 px-5 py-3">
        <h2 className="text-h2">Tinjau usulan aturan</h2>
        <span className="font-mono text-mono-xs text-ink-400">
          {candidate.status} · 1 dari 1
        </span>
      </header>

      <div className="grid divide-ink-200 md:grid-cols-2 md:divide-x">
        <div className="px-5 py-4">
          <p className="font-mono text-mono-xs tracking-[0.12em] text-ink-400">
            SUMBER · HALAMAN {candidate.source_page}
          </p>
          <blockquote className="mt-3 border-l-2 border-ink-300 pl-4">
            <p className="max-w-[52ch] text-body text-ink-900">
              {candidate.source_text_excerpt}
            </p>
          </blockquote>
          <p className="mt-3 font-mono text-mono-xs text-ink-500">
            {candidate.source_reference}
          </p>
        </div>

        <div className="px-5 py-4">
          <p className="font-mono text-mono-xs tracking-[0.12em] text-ink-400">
            ATURAN YANG DIEKSTRAKSI
          </p>
          <p className="mt-3 text-body text-ink-700">
            {DIMENSION_LABELS[candidate.dimension] ?? candidate.dimension}{' '}
            {OPERATOR_LABELS[candidate.operator] ?? candidate.operator}
          </p>
          <p className="tnum mt-0.5 text-display text-ink-900">{value}</p>

          <dl className="mt-4 space-y-2 border-t border-ink-100 pt-3">
            <Meta label="Dimensi" value={candidate.dimension} mono />
            {candidate.applies_to?.axle_config && (
              <Meta
                label="Berlaku untuk konfigurasi"
                value={candidate.applies_to.axle_config.join(', ')}
                mono
              />
            )}
            {candidate.tags?.length > 0 && (
              <Meta label="Tanda" value={candidate.tags.join(' · ')} mono />
            )}
          </dl>
        </div>
      </div>

      <div className="border-t border-ink-200 px-5 py-4">
        {!rejecting ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onApprove}
              disabled={busy}
              className="rounded-veto bg-ink-900 px-4 py-2 text-label text-white disabled:opacity-50"
            >
              Setujui aturan
            </button>
            <button
              type="button"
              onClick={() => setRejecting(true)}
              disabled={busy}
              className="rounded-veto border border-ink-300 px-4 py-2 text-label text-ink-900 disabled:opacity-50"
            >
              Tolak
            </button>
            <p className="text-label text-ink-500">
              Hanya aturan yang disetujui yang memengaruhi keputusan pengiriman.
            </p>
          </div>
        ) : (
          <div>
            <label className="flex flex-col gap-1">
              <span className="text-label text-ink-500">Alasan penolakan</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                className="w-full max-w-[52ch] rounded-veto border border-ink-300 px-2 py-1.5 text-data"
                placeholder="mis. ambang batas tidak jelas pada sumber"
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onReject(note)}
                disabled={busy || note.trim().length < 5}
                className="rounded-veto bg-ink-900 px-4 py-2 text-label text-white disabled:opacity-50"
              >
                Konfirmasi penolakan
              </button>
              <button
                type="button"
                onClick={() => setRejecting(false)}
                className="text-label text-ink-500 underline underline-offset-4 hover:text-ink-900"
              >
                Batal
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function Meta({ label, value, mono }) {
  return (
    <div>
      <dt className="text-label text-ink-400">{label}</dt>
      <dd className={mono ? 'font-mono text-mono-xs break-all text-ink-700' : 'text-label text-ink-900'}>
        {value}
      </dd>
    </div>
  )
}
