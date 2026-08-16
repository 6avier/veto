import { useEffect, useRef, useState } from 'react'

/**
 * The source half of Rule Studio's split screen (docs/ENGINEERING.md §3).
 *
 * DESIGN.md §3: on the register surface the source document page is treated as
 * a plate — bordered, captioned, given room. So it is a figure with a caption,
 * not a card: one hairline border, no shadow, no nested container.
 *
 * The overlay is the argument. A citation alone asks the reviewer to trust that
 * the extractor read the document; a box drawn on the page shows them the
 * clause it read. Rectangles arrive as percentages of the page box, so the
 * overlay tracks the image at any width without measuring it.
 *
 * Amber is used here as a marker, never as text — DESIGN.md §4 puts amber at
 * 1.9:1 on light ground, which fails for type but is exactly what a highlight
 * wash wants.
 */
export default function SourcePlate({ page, loading, error, activeCandidateId }) {
  const [revealed, setRevealed] = useState(false)
  const timer = useRef(null)

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  // The highlights land a beat after the page does, so the reviewer sees the
  // document first and then sees what was found in it. Two separate facts,
  // delivered in the order they happened.
  useEffect(() => {
    if (!page) {
      setRevealed(false)
      return undefined
    }
    if (reducedMotion) {
      setRevealed(true)
      return undefined
    }
    setRevealed(false)
    timer.current = setTimeout(() => setRevealed(true), 420)
    return () => clearTimeout(timer.current)
  }, [page, reducedMotion])

  if (error) {
    return (
      <figure className="border border-ink-200 bg-white px-5 py-4">
        <figcaption className="font-mono text-mono-xs tracking-[0.12em] text-ink-400">
          HALAMAN SUMBER
        </figcaption>
        <p className="mt-2 text-body text-ink-500">
          Halaman dokumen tidak dapat ditampilkan. Aturan yang diekstraksi di samping tetap
          berlaku.
        </p>
      </figure>
    )
  }

  if (loading || !page) {
    return (
      <figure className="border border-ink-200 bg-white px-5 py-4">
        <figcaption className="font-mono text-mono-xs tracking-[0.12em] text-ink-400">
          HALAMAN SUMBER
        </figcaption>
        <div
          aria-hidden
          className="mt-3 aspect-[1/1.414] w-full animate-pulse bg-ink-50"
        />
        <p className="mt-3 text-label text-ink-400">
          {loading ? 'Memuat halaman dokumen…' : 'Belum ada halaman untuk ditampilkan.'}
        </p>
      </figure>
    )
  }

  // Only the clause behind the rule under review is marked. The endpoint returns
  // every candidate on the page, and drawing all of them lit most of a table at
  // once, which is the opposite of pointing at something: 106 marks on one page
  // read as decoration. The reviewer is judging one rule, so one clause is
  // marked. Identical rectangles are collapsed because a phrase repeated inside
  // an excerpt otherwise stacks several boxes in the same place.
  const regions = page.regions ?? []
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
    <figure className="border border-ink-200 bg-white">
      <figcaption className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-ink-200 px-5 py-3">
        <span className="font-mono text-mono-xs tracking-[0.12em] text-ink-400">
          HALAMAN SUMBER
        </span>
        <span className="tnum font-mono text-mono-xs text-ink-500">
          {page.page_number} / {page.page_count}
        </span>
        <span className="ml-auto truncate font-mono text-mono-xs text-ink-400">
          {page.filename}
        </span>
      </figcaption>

      <div className="px-5 py-4">
        <div className="relative mx-auto w-full max-w-[520px]">
          <img
            src={page.image}
            alt={`Halaman ${page.page_number} dari ${page.filename}`}
            className="block w-full border border-ink-100"
          />

          {rects.map((rect, index) => (
            <span
              key={`${rect.x}-${rect.y}-${index}`}
              aria-hidden
              className="pointer-events-none absolute border border-hold-ink bg-hold/35 transition-opacity duration-500"
              style={{
                left: `${rect.x}%`,
                top: `${rect.y}%`,
                width: `${rect.w}%`,
                height: `${rect.h}%`,
                opacity: revealed ? 1 : 0,
                transitionDelay: revealed ? `${Math.min(index, 8) * 45}ms` : '0ms',
              }}
            />
          ))}
        </div>

        {/* Deliberately does not claim a mark is the clause itself. A rule read
            out of a table is located by its row label and its figure, a rule
            read out of prose by the sentence text, and a figure repeated within
            a row is marked twice. "Bagian halaman" is true of all three. */}
        <p className="mt-3 text-label text-ink-500">
          {rects.length > 0
            ? `${rects.length} bagian halaman yang menjadi dasar aturan ini ditandai.`
            : 'Klausa sumber tidak dapat ditemukan pada halaman ini, jadi tidak ada bagian yang ditandai.'}
        </p>
      </div>
    </figure>
  )
}
