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

export default function CandidateReview({
  candidate,
  onApprove,
  onReject,
  busy,
  error,
  result,
  position = 1,
  total = 1,
}) {
  const [note, setNote] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  /**
   * A fallback candidate carries a placeholder threshold, not a figure read out
   * of the document. One was approved into the live rule base once, where it
   * then rendered with the document's filename as its source and was
   * indistinguishable from a real extraction. A tag in a metadata list was not
   * enough, so the panel itself changes and approval needs a deliberate
   * acknowledgement rather than the same single click.
   */
  const unverified = Boolean(
    candidate?.tags?.some((tag) => tag === 'cadangan' || tag === 'belum-diverifikasi'),
  )

  const unit = candidate.unit
  const value = `${formatNumber(candidate.threshold)} ${unit}`

  /**
   * A decided candidate keeps its place in the list but stops taking a card's
   * worth of room. The full panel existed to support a judgement that has
   * already been made; what is left to say is the outcome, the figure it
   * settled, and where it landed. One ruled row says all three, and the list
   * shortens as the reviewer works down it.
   */
  if (result) {
    const approved = result.status === 'APPROVED'
    return (
      <section className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-ink-200 py-3">
        <span className="flex items-baseline gap-2 text-label text-ink-900">
          {approved && <span aria-hidden className="h-2 w-2 self-center bg-ink-900" />}
          {approved ? 'Disetujui' : 'Ditolak'}
        </span>
        <span className="tnum text-label text-ink-700">
          {DIMENSION_LABELS[candidate.dimension] ?? candidate.dimension}{' '}
          {OPERATOR_LABELS[candidate.operator] ?? candidate.operator} {value}
        </span>
        <span className="tnum ml-auto font-mono text-mono-xs text-ink-400">
          {approved ? `rule pack v${result.rule_pack_version} · ` : ''}
          halaman {candidate.source_page}
        </span>
      </section>
    )
  }

  return (
    <section className="border border-ink-200 bg-white">
      <header className="flex flex-wrap items-baseline gap-3 border-b border-ink-200 px-5 py-3">
        <h2 className="text-h2">Tinjau usulan aturan</h2>
        <span className="tnum font-mono text-mono-xs text-ink-400">
          {candidate.status} · {position} dari {total}
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

          {unverified && (
            /* The figure above is a placeholder. Amber as a marker and a rule,
               never as text: DESIGN.md §4 puts --hold at 1.9:1 on light ground,
               so the wording carries in ink and the colour only locates it. */
            <p className="mt-2 border-l-2 border-hold py-0.5 pl-2.5 text-label text-ink-900">
              Angka cadangan, bukan hasil baca dokumen. Belum diverifikasi.
            </p>
          )}

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
        {/* Reported here rather than in the page's error slot, which sits below
            the whole list and is off screen for any card but the last. The
            controls stay as they are, so the same button retries. */}
        {error && (
          <p
            role="alert"
            className="mb-3 border-l-2 border-hold-ink py-0.5 pl-2.5 text-label text-ink-900"
          >
            {error} Aturan ini belum tersimpan — coba lagi.
          </p>
        )}

        {!rejecting && !confirming && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setConfirming(true)}
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
        )}

        {confirming && (
          /* Approving writes straight into the live rule base, so the step
             restates the threshold and where it came from. Same two-step shape
             as rejection, which already worked. */
          <div>
            <p className="max-w-[62ch] text-body text-ink-900">
              Setujui{' '}
              <span className="tnum font-medium">
                {DIMENSION_LABELS[candidate.dimension] ?? candidate.dimension}{' '}
                {OPERATOR_LABELS[candidate.operator] ?? candidate.operator} {value}
              </span>{' '}
              dari {candidate.source_reference}?
            </p>
            <p className="mt-1 max-w-[62ch] text-label text-ink-500">
              Aturan ini langsung memengaruhi keputusan pengiriman berikutnya. Aturan yang
              sudah disetujui tidak dapat dibatalkan dari layar ini.
            </p>

            {unverified && (
              <label className="mt-3 flex max-w-[62ch] items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#8a5200]"
                />
                <span className="text-label text-ink-900">
                  Saya paham angka ini adalah contoh cadangan, bukan hasil baca dokumen, dan
                  belum diverifikasi.
                </span>
              </label>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onApprove}
                disabled={busy || (unverified && !acknowledged)}
                className="rounded-veto bg-ink-900 px-4 py-2 text-label text-white disabled:opacity-50"
              >
                Konfirmasi persetujuan
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false)
                  setAcknowledged(false)
                }}
                className="text-label text-ink-500 underline underline-offset-4 hover:text-ink-900"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {rejecting && (
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
