import { ArrowCounterClockwiseIcon, CheckIcon, WarningIcon, XIcon } from '@phosphor-icons/react'
import { useState } from 'react'

import { formatNumber } from '@/lib/format'

import CompareChip from './CompareChip'
import {
  OPERATOR_LABELS,
  centralCounterpart,
  compareToCentral,
  dimensionOf,
  isUnverified,
  scopeOf,
} from './dimensions'
import { BTN_DARK, BTN_GHOST, BTN_PRIMARY } from './ui'

/**
 * The human-in-the-loop gate, one proposed rule at a time. PRODUCT.md F3b.
 *
 * The card states the rule, what it would sit on top of in the central pack,
 * and where it came from; the source page beside the list shows the clause.
 * Approving writes straight into the live rule base, so approval takes a
 * second, explicit step that restates the consequence.
 */
export default function CandidateReview({
  candidate,
  central,
  active,
  onActivate,
  onApprove,
  onReject,
  busy,
  error,
  result,
  index,
}) {
  const [note, setNote] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  const { label, Icon } = dimensionOf(candidate.dimension)
  const op = OPERATOR_LABELS[candidate.operator] ?? candidate.operator
  const value = `${formatNumber(candidate.threshold)} ${candidate.unit}`
  const counterpart = centralCounterpart(candidate, central)
  const verdict = compareToCentral(candidate, counterpart)
  /**
   * A fallback candidate carries a placeholder threshold, not a figure read out
   * of the document. One was once approved into the live rule base and was
   * indistinguishable from a real extraction, so the card changes and approval
   * needs a deliberate acknowledgement.
   */
  const unverified = isUnverified(candidate)

  // A decided candidate shrinks to one row: the outcome, the figure it settled
  // and where it landed.
  if (result) {
    const approved = result.status === 'APPROVED'
    return (
      <div className="veto-rise-in flex flex-wrap items-center gap-3 rounded-2xl border border-ink-100 bg-white px-3.5 py-2.5 text-[14px]">
        <span
          className={`grid h-6 w-6 place-items-center rounded-lg ${approved ? 'bg-accent text-white' : 'bg-console text-ink-400'}`}
        >
          {approved ? <CheckIcon size={14} aria-hidden /> : <XIcon size={14} aria-hidden />}
        </span>
        <span>
          <b>{approved ? 'Disetujui' : 'Ditolak'}</b>{' '}
          <span className="tabular-nums text-ink-500">
            {label} {op} {value}
          </span>
        </span>
        <span className="ml-auto font-mono text-[11.5px] text-ink-400">
          {approved && result.rule_pack_version ? `Perusahaan v${result.rule_pack_version}, ` : ''}hal. {candidate.source_page}
        </span>
      </div>
    )
  }

  const warns = [
    unverified && 'Angka cadangan, bukan hasil baca dokumen. Belum diverifikasi.',
    verdict === 'looser' &&
      `Lebih longgar dari pusat. Saat validasi, batas pusat ${formatNumber(counterpart.threshold)} ${counterpart.unit} yang dipakai.`,
  ].filter(Boolean)

  return (
    <article
      tabIndex={0}
      onFocus={onActivate}
      onClick={(e) => {
        if (!e.target.closest('button, textarea, input, label')) onActivate()
      }}
      aria-label={`Usulan ${index + 1}: ${label} ${op} ${value}`}
      className={[
        'veto-rise-in grid cursor-pointer gap-3 rounded-2xl border-[1.5px] bg-white p-4 transition-[border-color,box-shadow] sm:px-5',
        active
          ? 'border-accent shadow-[0_2px_4px_rgba(13,21,38,0.04),0_16px_36px_-16px_rgba(36,87,245,0.3)]'
          : 'border-ink-100 hover:border-ink-200',
      ].join(' ')}
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
    >
      <div className="flex items-start gap-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-accent-soft text-accent">
          <Icon size={20} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-ink-400">
            {label} {op}
          </p>
          <p className="text-[28px] font-extrabold leading-tight tracking-[-0.025em] tabular-nums">
            {formatNumber(candidate.threshold)}
            <small className="ml-1 text-[15px] font-bold tracking-normal text-ink-500">{candidate.unit}</small>
          </p>
        </div>
        <span className="ml-auto">
          <CompareChip verdict={verdict} />
        </span>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-600">
        <span>{scopeOf(candidate)}</span>
        {counterpart && (
          <span>
            Pusat {formatNumber(counterpart.threshold)} {counterpart.unit}{' '}
            <span className="font-mono text-[11.5px] text-ink-400">{counterpart.legal_citation}</span>
          </span>
        )}
      </div>

      {candidate.source_text_excerpt && !unverified && (
        <p className="line-clamp-3 text-[13px] text-ink-500">“{candidate.source_text_excerpt}”</p>
      )}

      {warns.map((w) => (
        <div key={w} className="flex items-start gap-2 rounded-[10px] bg-hold/15 px-2.5 py-2 text-[13px] text-hold-ink">
          <WarningIcon size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>{w}</span>
        </div>
      ))}

      {error && (
        <p role="alert" className="rounded-[10px] bg-hold/15 px-2.5 py-2 text-[13px] text-hold-ink">
          {error} Aturan ini belum tersimpan. Coba lagi.
        </p>
      )}

      {!rejecting && !confirming && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-auto font-mono text-[11.5px] text-ink-400">hal. {candidate.source_page}</span>
          <button type="button" onClick={() => setRejecting(true)} disabled={busy} className={BTN_GHOST}>
            <XIcon size={16} aria-hidden />
            Tolak
          </button>
          <button type="button" onClick={() => setConfirming(true)} disabled={busy} className={BTN_PRIMARY}>
            <CheckIcon size={16} aria-hidden />
            Setujui
          </button>
        </div>
      )}

      {confirming && (
        <div className="grid gap-2.5 rounded-xl bg-accent-soft px-3.5 py-3">
          <p className="text-[14px] font-bold text-accent-ink">
            Setujui {label.toLowerCase()} {op} {value}? Langsung dipakai untuk dispatch berikutnya.
          </p>
          {unverified && (
            <label className="flex items-start gap-2.5 text-[13px] text-ink-900">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#8a5200]"
              />
              Saya paham angka ini contoh cadangan, bukan hasil baca dokumen.
            </label>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirming(false)
                setAcknowledged(false)
              }}
              className={BTN_GHOST}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={onApprove}
              disabled={busy || (unverified && !acknowledged)}
              className={BTN_PRIMARY}
            >
              <CheckIcon size={16} aria-hidden />
              {busy ? 'Menyimpan…' : 'Konfirmasi'}
            </button>
          </div>
        </div>
      )}

      {rejecting && (
        <div className="grid gap-2">
          <label htmlFor={`why-${candidate.candidate_id}`} className="text-[13px] font-bold">
            Alasan penolakan
          </label>
          <textarea
            id={`why-${candidate.candidate_id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            autoFocus
            placeholder="mis. ambang batas tidak jelas pada sumber"
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-[16px] sm:text-[14px] focus:border-transparent focus:outline-2 focus:outline-accent"
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto font-mono text-[11.5px] text-ink-400">Dicatat di jejak audit</span>
            <button type="button" onClick={() => setRejecting(false)} className={BTN_GHOST}>
              <ArrowCounterClockwiseIcon size={16} aria-hidden />
              Batal
            </button>
            <button
              type="button"
              onClick={() => onReject(note)}
              disabled={busy || note.trim().length < 5}
              className={BTN_DARK}
            >
              Tolak
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
