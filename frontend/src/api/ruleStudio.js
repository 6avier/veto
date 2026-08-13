import { ApiError, http } from './client'

/** POST /documents — multipart upload plus triage. api-contract.md §4. */
export async function uploadDocument(file) {
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
 * at any rendered width.
 */
export async function getDocumentPage(documentId, pageNumber) {
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
  try {
    const { data } = await http.get('/rule-candidates', { params: { status } })
    return data
  } catch (error) {
    throw ApiError.from(error)
  }
}

export async function approveCandidate(candidateId, reviewedBy) {
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

/** GET /rules — api-contract.md §5. */
export async function listRules(params = {}) {
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
  try {
    const { data } = await http.post('/rules/reset-client')
    return data
  } catch (error) {
    throw ApiError.from(error)
  }
}
