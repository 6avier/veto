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

/**
 * GET /documents/{id}/pages/{n} — the source half of the split screen.
 *
 * Returns the page as an inline PNG plus the rectangles each candidate clause
 * occupies, given as percentages of the page box so the overlay stays aligned
 * at any rendered width. Mocks have no PDF to render, so they return null and
 * the plate simply does not appear.
 */
export async function getDocumentPage(documentId, pageNumber) {
  if (USE_MOCKS) {
    await delay(400)
    return mocks.documentPage?.(pageNumber) ?? null
  }
  try {
    const { data } = await http.get(`/documents/${documentId}/pages/${pageNumber}`, {
      timeout: 30000,
    })
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

/**
 * POST /rules/reset-client — drops rules approved out of uploaded documents so
 * the Rule Studio walkthrough can be run again. Leaves the central ODOL pack
 * alone; that pack is what makes the dispatch screen return HOLD.
 */
export async function resetClientRules() {
  if (USE_MOCKS) {
    await delay(400)
    return { rules_removed: 0, rule_packs_removed: 0, central_rules_retained: 0 }
  }
  try {
    const { data } = await http.post('/rules/reset-client')
    return data
  } catch (error) {
    throw ApiError.from(error)
  }
}
