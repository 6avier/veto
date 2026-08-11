import { useState } from 'react'

import holdRequest from '@contract/validate.request.hold.json'
import { ApiError, USE_MOCKS, validateDispatch } from '@/api'

/**
 * /dispatch — PRODUCT.md F2, api-contract.md §1.
 *
 * SCAFFOLD, not the design. This exists to prove the frontend/backend seam works
 * end to end on day 1: it posts a real payload and renders PASS or HOLD, including
 * the axios-throws-on-403 case.
 *
 * The frontend lane replaces this wholesale. Read CLAUDE.md §7 and DESIGN.md before
 * styling — the ERP simulation must read at a glance from ~1.5 m, and must keep the
 * operator's input after a HOLD so they can correct and resubmit.
 */
export default function Dispatch() {
  const [grossWeight, setGrossWeight] = useState(holdRequest.load.gross_weight_kg)
  const [rearAxle, setRearAxle] = useState(holdRequest.load.axle_loads_kg[1])
  const [decision, setDecision] = useState(null)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setDecision(null)

    const payload = structuredClone(holdRequest)
    payload.load.gross_weight_kg = Number(grossWeight)
    payload.load.axle_loads_kg = [holdRequest.load.axle_loads_kg[0], Number(rearAxle)]

    try {
      setDecision(await validateDispatch(payload))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : ApiError.from(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">ERP Dispatch</h1>
      <p className="mt-2 max-w-prose text-neutral-600">
        Scaffold. Proves the API seam works — {USE_MOCKS ? 'running on contract fixtures' : 'talking to the live API'}.
        The frontend lane replaces this screen.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Gross weight (kg)</span>
          <input
            type="number"
            value={grossWeight}
            onChange={(event) => setGrossWeight(event.target.value)}
            className="w-40 border border-neutral-300 px-3 py-2 font-mono tabular-nums"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Rear axle load (kg)</span>
          <input
            type="number"
            value={rearAxle}
            onChange={(event) => setRearAxle(event.target.value)}
            className="w-40 border border-neutral-300 px-3 py-2 font-mono tabular-nums"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {pending ? 'Validating…' : 'Validate dispatch'}
        </button>
      </form>

      <p className="mt-2 text-sm text-neutral-500">
        Try 22,400 / 15,600 for PASS, or 24,500 / 17,300 for HOLD.
      </p>

      {error && (
        <div className="mt-6 border border-red-300 bg-red-50 p-4">
          <p className="font-mono text-xs text-red-700">{error.code}</p>
          <p className="text-red-900">{error.message}</p>
        </div>
      )}

      {decision && (
        <div className="mt-6 border border-neutral-300 p-4">
          <p className="font-mono text-lg">{decision.outcome}</p>
          <p className="font-mono text-xs text-neutral-500">
            {decision.dispatch_ref} · {decision.latency_ms} ms · decision {decision.decision_id}
          </p>
          <ul className="mt-3 space-y-2">
            {decision.violations.map((violation, index) => (
              <li key={index} className="border-l-2 border-amber-500 pl-3">
                <p>{violation.directive}</p>
                <p className="font-mono text-xs text-neutral-500">
                  {violation.dimension} · {violation.actual_value.toLocaleString()} {violation.unit} vs limit{' '}
                  {violation.limit_value.toLocaleString()} · {violation.rule_origin} ·{' '}
                  {violation.legal_citation}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
