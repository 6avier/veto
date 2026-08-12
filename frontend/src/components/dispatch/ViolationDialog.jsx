import { WarningIcon } from '@phosphor-icons/react'
import { useEffect, useRef } from 'react'

import { formatNumber } from '@/lib/format'

/**
 * The HOLD announcement.
 *
 * DESIGN.md §8 bans a dialog that *dismisses* a compliance result. This one
 * announces it. Closing it clears nothing: the violations stay inline under the
 * offending fields, the verdict stays in the side panel, and Cetak Surat Jalan
 * stays locked until a fresh evaluation returns PASS.
 */
export default function ViolationDialog({ decision, onClose }) {
  const closeRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!decision) return null

  return (
    <div
      className="veto-scrim fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="veto-hold-title"
        className="veto-dialog w-full max-w-[560px] rounded-veto bg-white shadow-[0_24px_60px_rgba(20,23,26,0.28)]"
      >
        <div className="flex items-center gap-3.5 border-b border-ink-200 px-5 py-4">
          <WarningIcon
            aria-hidden
            weight="fill"
            size={30}
            className="shrink-0 text-hold"
          />
          <div className="min-w-0">
            <h2 id="veto-hold-title" className="text-h1 text-ink-900">
              Pengiriman ditahan
            </h2>
            <p className="mt-0.5 text-label text-ink-500">
              {decision.violations.length} ketentuan muatan terlampaui
            </p>
          </div>
          <span className="ml-auto shrink-0 self-start font-mono text-mono-xs text-ink-400">
            {decision.dispatch_ref}
          </span>
        </div>

        <ul className="divide-y divide-ink-100">
          {decision.violations.map((violation, index) => (
            <li key={index} className="px-5 py-4">
              <p className="text-body text-ink-900">{violation.directive}</p>
              <p className="mt-1.5 tnum text-data text-ink-500">
                {formatNumber(violation.actual_value)} {violation.unit} · batas{' '}
                {formatNumber(violation.limit_value)} {violation.unit} · lebih{' '}
                {formatNumber(violation.excess_value)} {violation.unit}
              </p>
              <p className="mt-1 font-mono text-mono-xs text-ink-400">
                {violation.rule_origin === 'CLIENT'
                  ? `[ SOP KLIEN ] ${violation.legal_citation}`
                  : violation.legal_citation}
              </p>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-4 border-t border-ink-200 px-5 py-4">
          <p className="text-label text-ink-500">
            Surat jalan tetap terkunci sampai muatan diperbaiki.
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="ml-auto rounded-veto bg-ink-900 px-4 py-2 text-label text-white transition-colors hover:bg-ink-950"
          >
            Perbaiki muatan
          </button>
        </div>
      </div>
    </div>
  )
}
