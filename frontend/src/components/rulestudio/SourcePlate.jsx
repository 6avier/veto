import PageSheet from './PageSheet'
import { PANEL } from './ui'

/**
 * The source half of Rule Studio's split screen (docs/ENGINEERING.md §3).
 *
 * The overlay is the argument. A citation alone asks the reviewer to trust that
 * the extractor read the document; a box drawn on the page shows them the
 * clause it read. Rectangles arrive as percentages of the page box, so the
 * overlay tracks the image at any width without measuring it.
 *
 * Only the clause behind the rule under review is marked. The endpoint returns
 * every candidate on the page, and drawing all of them lit most of a table at
 * once. Identical rectangles are collapsed because a phrase repeated inside an
 * excerpt otherwise stacks several boxes in the same place.
 */
export default function SourcePlate({ page, loading, error, activeCandidateId }) {
  const regions = page?.regions ?? []
  const active = activeCandidateId
    ? regions.filter((region) => region.candidate_id === activeCandidateId)
    : regions
  const shown = active.length > 0 ? active : regions

  const seen = new Set()
  const rects = shown
    .flatMap((region) => region.rects ?? [])
    .filter((rect) => {
      const key = `${rect.x}:${rect.y}:${rect.w}:${rect.h}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  return (
    <figure className={`${PANEL} m-0 flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden`}>
      <figcaption className="flex items-center gap-2.5 border-b border-ink-100 px-4 py-3">
        <b className="min-w-0 truncate text-[14px]" title={page?.filename}>
          {page?.filename ?? 'Halaman sumber'}
        </b>
        {page && (
          <span className="ml-auto shrink-0 font-mono text-[12px] tabular-nums text-ink-400">
            hal. {page.page_number} / {page.page_count}
          </span>
        )}
      </figcaption>

      <div className="flex-1 overflow-auto bg-console p-4">
        {error ? (
          <p className="text-[14px] text-ink-500">
            Halaman dokumen tidak dapat ditampilkan. Aturan di samping tetap bisa ditinjau.
          </p>
        ) : (
          <PageSheet
            image={loading ? null : page?.image}
            alt={page ? `Halaman ${page.page_number} dari ${page.filename}` : 'Memuat halaman'}
            rects={rects}
          />
        )}
        {/* Does not claim a mark is the clause itself: a rule read out of a
            table is located by its row label and its figure. */}
        {page && !loading && !error && rects.length === 0 && (
          <p className="mt-3 text-[13px] text-ink-500">
            Klausa sumber tidak ditemukan di halaman ini, jadi tidak ada bagian yang ditandai.
          </p>
        )}
      </div>
    </figure>
  )
}
