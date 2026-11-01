import { useState } from 'react'

import { ApiError, overrideDecision } from '@/api'
import Dialog from '@/components/Dialog'
import VetoMark from '@/components/VetoMark'
import { formatNumber } from '@/lib/format'

/**
 * The HOLD announcement.
 *
 * DESIGN.md §8 bans a dialog that *dismisses* a compliance result. This one
 * announces it: the backdrop does not close it, the verdict word is the
 * dialog's accessible name, and closing clears nothing. The violations stay
 * under the offending fields, the header chip keeps the verdict in view, and
 * Cetak Surat Jalan stays locked until a fresh PASS or a logged override.
 *
 * An override needs a reason someone could check later, and is written to the
 * audit trail against the operator's name (PRODUCT.md F2).
 */

const OPERATOR = 'Budi Santoso'
const MIN_REASON = 15

export default function ViolationDialog({ decision, onClose, onOverridden }) {
  const [overriding, setOverriding] = useState(false)
  const [reason, setReason] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState(null)

  if (!decision) return null
  const count = decision.violations.length

  async function submitOverride() {
    if (reason.trim().length < MIN_REASON) {
      setInvalid(true)
      return
    }
    setPending(true)
    setFailure(null)
    try {
      const result = await overrideDecision(decision.decision_id, { reason: reason.trim(), overriddenBy: OPERATOR })
      onOverridden?.(result)
    } catch (caught) {
      setFailure((caught instanceof ApiError ? caught : ApiError.from(caught)).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy="veto-hold-title"
      describedBy="veto-hold-summary"
      dismissOnBackdrop={false}
      maxWidth="720px"
      header={
        <div className="flex items-center gap-2.5 font-mono text-[11.5px] text-ink-500">
          <VetoMark className="h-4 w-auto" />
          <b className="font-satoshi text-[15px] font-extrabold tracking-[-0.01em] text-ink-900">VETO</b>
          <span className="truncate">{decision.dispatch_ref}</span>
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="mr-auto max-w-[46ch] text-[12px] text-[#687385]">
            VETO memeriksa angka yang dideklarasikan di surat jalan, bukan hasil timbangan.
          </p>
          <div className="ml-auto flex flex-wrap gap-2">
          {!overriding ? (
            <button
              type="button"
              onClick={() => setOverriding(true)}
              className="min-h-[42px] rounded-[13px] border border-ink-200 bg-white px-4 text-[14px] font-bold text-ink-900 transition-[transform,border-color] hover:border-ink-400 motion-safe:enabled:active:scale-[0.96]"
            >
              Override dengan alasan
            </button>
          ) : (
            <button
              type="button"
              onClick={submitOverride}
              disabled={pending}
              className="min-h-[42px] rounded-[13px] border border-ink-200 bg-white px-4 text-[14px] font-bold text-ink-900 transition-[transform,border-color] hover:border-ink-400 motion-safe:enabled:active:scale-[0.96] disabled:opacity-50"
            >
              {pending ? 'Mencatat…' : 'Catat override'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] rounded-[13px] bg-accent px-4 text-[14px] font-bold text-white shadow-[0_8px_18px_-10px_rgba(36,87,245,0.9)] transition-[transform,background-color] hover:bg-accent-hi motion-safe:enabled:active:scale-[0.96]"
          >
            Perbaiki muatan
          </button>
          </div>
        </div>
      }
    >
      <div className="grid sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <div className="grid content-start gap-3 border-b border-ink-100 p-5 sm:border-b-0 sm:border-r">
          <h2
            id="veto-hold-title"
            className="veto-stamp justify-self-start -rotate-[5deg] rounded-xl border-[3px] border-hold bg-[#fdf2df] px-3 pb-0.5 pt-1 font-satoshi text-[44px] font-black leading-none tracking-[0.03em] text-hold-ink"
          >
            DITAHAN
          </h2>
          <p id="veto-hold-summary" className="mt-2 text-[14px] text-ink-600">
            Surat jalan tidak dapat dicetak. {count} ketentuan dilanggar oleh angka yang dideklarasikan.
          </p>
          <p className="font-mono text-[11px] text-[#687385]">
            {(decision.rule_packs_applied ?? [])
              .map((p) => `${p.origin === 'CLIENT' ? 'Perusahaan' : 'Pusat'} v${p.version}`)
              .join(', ')}
          </p>
        </div>

        <ul className="divide-y divide-ink-100 px-5">
          {decision.violations.map((violation, index) => (
            <li key={index} className="grid gap-1.5 py-4">
              <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-[15px] font-bold text-ink-900">{violation.directive}</span>
                <span className="whitespace-nowrap text-[14px] font-semibold tabular-nums">
                  {formatNumber(violation.actual_value)}{' '}
                  <small className="font-medium text-ink-500">
                    / {formatNumber(violation.limit_value)} {violation.unit}
                  </small>{' '}
                  <em className="not-italic text-hold-ink">+{formatNumber(violation.excess_value)}</em>
                </span>
              </p>
              <p className="flex flex-wrap items-center gap-2 font-mono text-[12px] text-ink-500">
                <span
                  className={`rounded-full px-2 py-0.5 font-satoshi text-[11.5px] font-extrabold ${
                    violation.rule_origin === 'CLIENT' ? 'bg-accent-soft text-accent-ink' : 'bg-ink-100 text-ink-700'
                  }`}
                >
                  {violation.rule_origin === 'CLIENT' ? 'Perusahaan' : 'Pusat'}
                </span>
                {violation.legal_citation}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {overriding && (
        <div className="grid gap-2 border-t border-ink-100 px-5 py-4">
          <label htmlFor="override-reason" className="text-[13px] font-bold text-ink-700">
            Alasan override, dicatat atas nama {OPERATOR}
          </label>
          <textarea
            id="override-reason"
            autoFocus
            value={reason}
            aria-invalid={invalid}
            aria-describedby="override-error"
            onChange={(event) => {
              setReason(event.target.value)
              if (invalid) setInvalid(false)
            }}
            placeholder="Contoh: muatan dibongkar sebagian di dok 2 dan ditimbang ulang 23.800 kg"
            className={`min-h-[72px] w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-[16px] sm:text-[14px] focus:border-transparent focus:outline-2 focus:outline-accent ${
              invalid ? 'border-hold' : 'border-ink-200'
            }`}
          />
          <p id="override-error" aria-live="polite" className="text-[13px] font-bold text-hold-ink">
            {invalid ? `Tulis alasan yang bisa diperiksa ulang, minimal ${MIN_REASON} karakter.` : failure}
          </p>
        </div>
      )}
    </Dialog>
  )
}
