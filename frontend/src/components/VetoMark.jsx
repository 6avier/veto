import markUrl from '@/assets/brand/veto-mark.png'

/**
 * VETO's logo mark: the real brand asset, not a redraw.
 *
 * An earlier pass rebuilt the mark as hand-written SVG geometry in
 * `currentColor`. It was close, but it was an approximation of the brand file
 * rather than the brand file, and it dropped the gradient. This renders the
 * artwork itself, cropped out of `assets/brand/` at the mark's own bounds so it
 * can be sized by height alone and sits on a text baseline without padding.
 *
 * Because it is artwork rather than a glyph, it does not take the ink of its
 * surface. Call sites should not pass text-colour classes to it.
 *
 * `width`/`height` carry the intrinsic ratio so the row does not reflow while
 * the image decodes; CSS still does the sizing.
 */
export default function VetoMark({ className = '', title }) {
  return (
    <img
      src={markUrl}
      width={365}
      height={251}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      className={className}
      draggable={false}
    />
  )
}
