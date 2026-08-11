import { ApiError, delay, http, USE_MOCKS } from './client'
import { mocks } from '@/mocks'

/** POST /documents — multipart upload plus triage. api-contract.md §4. */
export async function uploadDocument(file) {
  if (USE_MOCKS) {
    await delay(900)
    return mocks.uploadDocument(file)
  }
  const form = new FormData()
  form.append('file', file)
  try {
    const { data } = await http.post('/documents', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  } catch (error) {
    throw ApiError.from(error)
  }
}

/** POST /documents/{id}/extract — the slow one. Show discrete stages, not a spinner. */
export async function extractRules(documentId, { force = false } = {}) {
  if (USE_MOCKS) {
    await delay(2500)
    return mocks.extract()
  }
  try {
    const { data } = await http.post(`/documents/${documentId}/extract`, { force }, { timeout: 60000 })
    return data
  } catch (error) {
    throw ApiError.from(error)
  }
}

/** GET /rule-candidates — the human-in-the-loop staging queue. */
export async function listRuleCandidates(status = 'PENDING') {
  if (USE_MOCKS) {
    await delay()
    return mocks.ruleCandidates()
  }
  try {
    const { data } = await http.get('/rule-candidates', { params: { status } })
    return data
  } catch (error) {
    throw ApiError.from(error)
  }
}

export async function approveCandidate(candidateId, reviewedBy) {
  if (USE_MOCKS) {
    await delay()
    return mocks.approveCandidate()
  }
  try {
    const { data } = await http.post(`/rule-candidates/${candidateId}/approve`, {
      reviewed_by: reviewedBy,
    })
    return data
  } catch (error) {
    throw ApiError.from(error)
  }
}

export async function rejectCandidate(candidateId, reviewedBy, note) {
  if (USE_MOCKS) {
    await delay()
    return mocks.rejectCandidate()
  }
  try {
    const { data } = await http.post(`/rule-candidates/${candidateId}/reject`, {
      reviewed_by: reviewedBy,
      note,
    })
    return data
  } catch (error) {
    throw ApiError.from(error)
  }
}

/** GET /rules — read-only in MVP. api-contract.md §5. */
export async function listRules(params = {}) {
  if (USE_MOCKS) {
    await delay()
    return mocks.rules()
  }
  try {
    const { data } = await http.get('/rules', { params })
    return data
  } catch (error) {
    throw ApiError.from(error)
  }
}
