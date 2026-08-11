/**
 * /audit — instrumentation. Dark ground, dense mono rows. DESIGN.md §3.
 *
 * Append-only: there is deliberately no edit or delete affordance here, and
 * none in the API either. API helpers ready: listDecisions, getDecision.
 */
export default function AuditLog() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <h1 className="text-h1 on-dark text-ink-100">Jejak Audit</h1>
      <p className="mt-2 max-w-[65ch] text-body on-dark text-ink-300">
        Setiap keputusan pengiriman, lolos maupun tahan, tercatat permanen beserta versi
        aturan dan dasar hukumnya. Catatan tidak dapat diubah atau dihapus.
      </p>
      <p className="mt-6 font-mono text-mono-xs text-ink-400">
        Belum dibangun. Lihat docs/plans/2026-08-11-validation-engine-and-dispatch.md
      </p>
    </div>
  )
}
