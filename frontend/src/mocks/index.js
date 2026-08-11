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

/**
 * Thresholds the mock uses to decide PASS vs HOLD.
 *
 * The two that appear in the HOLD fixture are read straight out of it, so they
 * can never disagree with the contract the backend is tested against. This
 * previously drifted: the mock kept 16100 kg after the seeded rule pack moved
 * to 16000, which made a 16050 kg load pass on mocks and hold live.
 *
 * The rest are not in any fixture, so they mirror the seeded CENTRAL pack in
 * backend/apps/rules/migrations/0002_seed_odol_central_rules.py. If that
 * migration changes, change these in the same commit.
 */
const limitFromFixture = (dimension, fallback) =>
  validateHold.violations.find((v) => v.dimension === dimension)?.limit_value ?? fallback

const GROSS_LIMIT_KG = limitFromFixture('GROSS_WEIGHT', 24000)
const REAR_AXLE_LIMIT_KG = limitFromFixture('AXLE_LOAD', 16000)
const FRONT_AXLE_LIMIT_KG = 10000 // seeded: PM 18/2021 Pasal 4 ayat (1) huruf a
const DIMENSION_LIMITS_MM = { length: 18000, width: 2500, height: 4200 }

function isCompliant(payload) {
  const load = payload?.load ?? {}
  const axles = load.axle_loads_kg ?? []
  const dimensions = load.dimensions_mm ?? {}

  if ((load.gross_weight_kg ?? 0) > GROSS_LIMIT_KG) return false

  const axleLimit = (index) => (index === 0 ? FRONT_AXLE_LIMIT_KG : REAR_AXLE_LIMIT_KG)
  if (!axles.every((value, index) => value <= axleLimit(index))) return false

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
