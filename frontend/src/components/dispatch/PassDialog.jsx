import Dialog from '@/components/Dialog'
import { formatNumber } from '@/lib/format'

/**
 * The PASS announcement, and the counterpart to ViolationDialog.
 *
 * It exists because the gate it unlocks sits about 1,180px from where the
 * operator is looking after a submit, and announced itself with a background
 * swap on one small button. A booth visitor who does not already know the rule
 * never saw it happen. The verdict now arrives in the middle of the screen and
 * carries the way forward in its own footer.
 *
 * Both verdicts are the same component shape on purpose: two faces of one
 * instrument, not a warning and an afterthought.
 *
 * Every figure here is either what the operator typed or a ceiling read from
 * GET /rules. Nothing is computed for display — DESIGN.md §8 — which is why
 * there is no "sisa ruang" column: the PASS response carries no such field and
 * inventing one on the client is the exact habit the critique penalised.
 */

/** Rows of the actual-against-limit table, in the order the form asks for them. */
const ROWS = [
  { key: 'grossWeight', label: 'Berat kotor', unit: 'kg' },
  { key: 'length', label: 'Panjang', unit: 'mm' },
  { key: 'width', label: 'Lebar', unit: 'mm' },
  { key: 'height', label: 'Tinggi', unit: 'mm' },
]

export default function PassDialog({ decision, form, limits = {}, onClose, onPrint }) {
  if (!decision) return null

  const packs = decision.rule_packs_applied ?? []

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy="veto-pass-title"
      header={
        <div className="flex items-center gap-3.5">
          {/* A marker, never text. The word stays graphite, exactly as TAHAN
              does beside the amber one. */}
          <span aria-hidden className="h-3 w-3 shrink-0 bg-pass" />
          <div className="min-w-0">
            <h2 id="veto-pass-title" className="text-h1 text-ink-900">
              Muatan lolos
            </h2>
            <p className="mt-0.5 text-label text-ink-500">
              Surat jalan dapat dicetak
            </p>
          </div>
          <span className="ml-auto shrink-0 self-start text-right font-mono text-mono-xs text-ink-400">
            {decision.dispatch_ref}
            <span className="block">{formatNumber(decision.latency_ms)} ms</span>
          </span>
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-veto border border-ink-200 px-4 py-2 text-label text-ink-700 transition-colors hover:bg-ink-50"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="min-h-[44px] rounded-veto bg-ink-900 px-4 py-2 text-label text-white transition-colors hover:bg-ink-950"
          >
            Cetak Surat Jalan
          </button>
        </div>
      }
    >
      <div className="px-5 py-4">
        <p className="text-body text-ink-900">
          Muatan berada di dalam seluruh batas yang berlaku untuk konfigurasi{' '}
          <span className="font-mono text-mono">{form?.axleConfig}</span>.
        </p>

        <table className="mt-4 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-ink-200">
              <th className="py-2 pr-3 text-label font-medium text-ink-500">Ketentuan</th>
              <th className="py-2 pr-3 text-right text-label font-medium text-ink-500">
                Dideklarasikan
              </th>
              <th className="py-2 text-right text-label font-medium text-ink-500">Batas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {ROWS.map((row) => {
              const limit = limits[row.key]
              return (
                <tr key={row.key}>
                  <td className="py-2 pr-3 text-data text-ink-700">{row.label}</td>
                  <td className="tnum py-2 pr-3 text-right text-data text-ink-900">
                    {formatNumber(form?.[row.key])} {row.unit}
                  </td>
                  {/* A regular hyphen, not an em-dash. DESIGN.md §7. */}
                  <td className="tnum py-2 text-right text-data text-ink-500">
                    {limit ? `${formatNumber(limit.threshold)} ${limit.unit}` : '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <p className="mt-3 text-label text-ink-400">
          Batas yang belum diketahui ditandai dengan tanda hubung. Mesin VETO
          tetap memeriksa seluruh ketentuan aktif, termasuk beban tiap sumbu.
        </p>
      </div>

      {/* The audit line. A verdict a warehouse can act on has to be a verdict a
          warehouse can later look up. */}
      <div className="border-t border-ink-100 bg-ink-50 px-5 py-3">
        <p className="font-mono text-mono-xs text-ink-500">
          {packs.length > 0
            ? packs.map((pack) => `${pack.domain} v${pack.version} · ${pack.origin}`).join('  |  ')
            : 'Tidak ada paket aturan tercatat'}
        </p>
        <p className="mt-1 break-all font-mono text-mono-xs text-ink-400">
          {decision.decision_id}
        </p>
      </div>
    </Dialog>
  )
}
