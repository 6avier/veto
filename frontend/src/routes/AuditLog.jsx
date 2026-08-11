/**
 * /audit — PRODUCT.md F4, api-contract.md §3.
 *
 * API helpers are ready: listDecisions, getDecision from '@/api'.
 * Records are append-only; there is deliberately no edit or delete path.
 */
export default function AuditLog() {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
      <p className="mt-2 max-w-prose text-neutral-600">
        Placeholder. Append-only decision trail with rule versions, citations, and overrides.
      </p>
    </section>
  )
}
