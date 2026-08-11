/**
 * Mock responses for every endpoint in api-contract.md.
 *
 * These import the canonical fixtures from /contract, which the backend's test
 * suite also asserts against. Do not hand-edit response shapes here — change the
 * fixture, and the backend tests will tell that lane immediately.
 *
 * Enabled with VITE_USE_MOCKS=true.
 */

import validatePass from '@contract/validate.response.pass.json'
import validateHold from '@contract/validate.response.hold.json'
import overrideResponse from '@contract/override.response.json'
import decisionsList from '@contract/decisions.list.json'
import triageAccepted from '@contract/documents.triage.accepted.json'
import triageRejected from '@contract/documents.triage.rejected.json'
import extractResponse from '@contract/documents.extract.json'
import candidatesList from '@contract/rule-candidates.list.json'
import candidateApprove from '@contract/rule-candidate.approve.json'
import rulesList from '@contract/rules.list.json'
import vehicleProfiles from '@contract/vehicle-profiles.list.json'

const clone = (value) => structuredClone(value)

// Mirrors the stub thresholds in backend/apps/validation/views.py so mocked and
// live behaviour agree on which payloads HOLD.
const CLIENT_GROSS_LIMIT_KG = 24000
const AXLE_LIMITS_KG = [10000, 16100]
const DIMENSION_LIMITS_MM = { length: 18000, width: 2500, height: 4200 }

function isCompliant(payload) {
  const load = payload?.load ?? {}
  const axles = load.axle_loads_kg ?? []
  const dimensions = load.dimensions_mm ?? {}

  if ((load.gross_weight_kg ?? 0) > CLIENT_GROSS_LIMIT_KG) return false
  if (!axles.every((value, index) => value <= (AXLE_LIMITS_KG[index] ?? AXLE_LIMITS_KG.at(-1)))) return false
  return Object.entries(DIMENSION_LIMITS_MM).every(
    ([axis, limit]) => (dimensions[axis] ?? 0) <= limit,
  )
}

export const mocks = {
  validate(payload) {
    const template = isCompliant(payload) ? validatePass : validateHold
    const body = clone(template)
    body.dispatch_ref = payload?.dispatch_ref ?? body.dispatch_ref
    body.evaluated_at = new Date().toISOString()
    return body
  },
  override: () => clone(overrideResponse),
  decisions: () => clone(decisionsList),
  decisionDetail: () => ({ ...clone(validateHold), override: null, payload: null }),
  uploadDocument: (file) =>
    clone(/packing|invoice|manifest/i.test(file?.name ?? '') ? triageRejected : triageAccepted),
  extract: () => clone(extractResponse),
  ruleCandidates: () => clone(candidatesList),
  approveCandidate: () => clone(candidateApprove),
  rejectCandidate: () => ({ ...clone(candidateApprove), status: 'REJECTED', rule_id: null }),
  rules: () => clone(rulesList),
  vehicleProfiles: () => clone(vehicleProfiles),
}
