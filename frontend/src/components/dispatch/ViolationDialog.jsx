import { WarningIcon } from '@phosphor-icons/react'

import Dialog from '@/components/Dialog'
import { formatNumber } from '@/lib/format'

/**
 * The HOLD announcement.
 *
 * DESIGN.md §8 bans a dialog that *dismisses* a compliance result. This one
 * announces it. Closing it clears nothing: the violations stay inline under the
 * offending fields, the verdict stays in the side panel, and Cetak Surat Jalan
 * stays locked until a fresh evaluation returns PASS.
 *
 * The shell — focus trap, focus restore, scroll lock, Escape — belongs to
 * Dialog. This file is the HOLD's content and nothing else.
 */
export default function ViolationDialog({ decision, onClose }) {
  if (!decision) return null

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy="veto-hold-title"
      header={
        <div className="flex items-center gap-3.5">
          <WarningIcon aria-hidden weight="fill" size={30} className="shrink-0 text-hold" />
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
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-label text-ink-500">
            Surat jalan tetap terkunci sampai muatan diperbaiki.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto min-h-[44px] rounded-veto bg-ink-900 px-4 py-2 text-label text-white transition-colors hover:bg-ink-950"
          >
            Perbaiki muatan
          </button>
        </div>
      }
    >
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
    </Dialog>
  )
}
