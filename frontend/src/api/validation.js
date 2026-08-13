import { ApiError, http } from './client'

/**
 * POST /validate — api-contract.md §1.
 *
 * A HOLD comes back as HTTP 403, which axios throws on. That is *not* an error:
 * it is the most important success path in the product. This function absorbs
 * that quirk so no caller ever has to know about it.
 *
 * @returns the decision object for both PASS and HOLD.
 * @throws {ApiError} only for genuine failures — bad payload, network, server.
 */
export async function validateDispatch(payload) {
  try {
    const { data } = await http.post('/validate', payload)
    return data
  } catch (error) {
    const body = error.response?.data
    if (error.response?.status === 403 && body?.outcome === 'HOLD') {
      return body
    }
    throw ApiError.from(error)
  }
}

/** POST /decisions/{id}/override — api-contract.md §2. */
export async function overrideDecision(decisionId, { reason, overriddenBy }) {
  try {
    const { data } = await http.post(`/decisions/${decisionId}/override`, {
      reason,
      overridden_by: overriddenBy,
    })
    return data
  } catch (error) {
    throw ApiError.from(error)
  }
}
