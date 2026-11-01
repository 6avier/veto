/**
 * The boxes to draw for one candidate on a page from /documents/{id}/pages/{n}.
 * Only that candidate's clause is marked; drawing every region lit most of a
 * table at once. Falls back to every region when the candidate has none, and
 * collapses identical rectangles, since a phrase repeated inside an excerpt
 * otherwise stacks several boxes in one place.
 */
export function rectsFor(page, candidateId) {
  const regions = page?.regions ?? []
  const own = candidateId ? regions.filter((region) => region.candidate_id === candidateId) : regions
  const seen = new Set()
  return (own.length > 0 ? own : regions)
    .flatMap((region) => region.rects ?? [])
    .filter((rect) => {
      const key = `${rect.x}:${rect.y}:${rect.w}:${rect.h}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}
