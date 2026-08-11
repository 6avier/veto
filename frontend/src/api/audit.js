import { ApiError, delay, http, USE_MOCKS } from './client'
import { mocks } from '@/mocks'

/** GET /decisions — api-contract.md §3. */
export async function listDecisions(params = {}) {
  if (USE_MOCKS) {
    await delay()
    return mocks.decisions()
  }
  try {
    const { data } = await http.get('/decisions', { params })
    return data
  } catch (error) {
    throw ApiError.from(error)
  }
}

/** GET /decisions/{id} — always 200 when found, even for a HOLD. */
export async function getDecision(decisionId) {
  if (USE_MOCKS) {
    await delay()
    return mocks.decisionDetail()
  }
  try {
    const { data } = await http.get(`/decisions/${decisionId}`)
    return data
  } catch (error) {
    throw ApiError.from(error)
  }
}
