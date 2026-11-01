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
        <div className="flex items-center gap-2.5 font-mono text-[11.5px] text-ink-500">
          <span className="truncate">{decision.dispatch_ref}</span>
          <span className="ml-auto">{formatNumber(decision.latency_ms)} ms</span>
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] rounded-[13px] border border-ink-200 bg-white px-4 text-[14px] font-bold text-ink-900 transition-[transform,border-color] hover:border-ink-400 active:scale-[.97]"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="min-h-[42px] rounded-[13px] bg-accent px-4 text-[14px] font-bold text-white shadow-[0_8px_18px_-10px_rgba(36,87,245,0.9)] transition-[transform,background-color] hover:bg-accent-hi active:scale-[.97]"
          >
            Cetak Surat Jalan
          </button>
        </div>
      }
    >
      <div className="px-5 py-4">
        <h2 id="veto-pass-title" className="flex items-center gap-4 font-satoshi text-[44px] font-black leading-none tracking-[0.03em] text-pass">
          <span aria-hidden className="h-[0.42em] w-[0.42em] rounded-md bg-pass" />
          LOLOS
        </h2>
        <p className="mt-3 text-body text-ink-900">
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
