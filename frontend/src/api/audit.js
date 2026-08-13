import { ApiError, http } from './client'

/** GET /decisions — api-contract.md §3. */
export async function listDecisions(params = {}) {
  try {
    const { data } = await http.get('/decisions', { params })
    return data
  } catch (error) {
    throw ApiError.from(error)
  }
}

/** GET /decisions/{id} — always 200 when found, even for a HOLD. */
export async function getDecision(decisionId) {
  try {
    const { data } = await http.get(`/decisions/${decisionId}`)
    return data
  } catch (error) {
    throw ApiError.from(error)
  }
}
