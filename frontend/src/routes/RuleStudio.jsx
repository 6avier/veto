/**
 * /rule-studio — the register surface. Light ground, editorial measure.
 * DESIGN.md §3. Owned end to end by the Rule Studio lane.
 *
 * API helpers ready: uploadDocument, extractRules, listRuleCandidates,
 * approveCandidate, rejectCandidate from '@/api'.
 */
export default function RuleStudio() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
        <h1 className="text-h1">Rule Studio</h1>
        <p className="mt-2 max-w-[65ch] text-body text-ink-500">
          Unggah kebijakan internal, tinjau aturan yang diekstraksi berdampingan dengan
          sumbernya, lalu setujui atau tolak. Peraturan nasional sudah dipelihara VETO
          secara terpusat dan tidak perlu diunggah.
        </p>
        <p className="mt-6 font-mono text-mono-xs text-ink-400">
          Belum dibangun. Lihat docs/plans/2026-08-11-rule-studio.md
        </p>
    </div>
  )
}
