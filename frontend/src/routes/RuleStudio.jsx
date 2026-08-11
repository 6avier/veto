/**
 * /rule-studio — PRODUCT.md F3, api-contract.md §4.
 *
 * Owned end to end (UI + apps/rules) by the Rule Studio lane.
 * API helpers are ready: uploadDocument, extractRules, listRuleCandidates,
 * approveCandidate, rejectCandidate from '@/api'.
 */
export default function RuleStudio() {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Rule Studio</h1>
      <p className="mt-2 max-w-prose text-neutral-600">
        Placeholder. Split-screen source document versus extracted rule, with Approve and Reject.
        Owned by the Rule Studio lane.
      </p>
    </section>
  )
}
