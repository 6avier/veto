/**
 * VETO's logo mark: three stacked bars tucked against a forward slash.
 *
 * Drawn in `currentColor`, never in the brand blue, so it takes the ink of
 * whatever surface it sits on. DESIGN.md §8 bans a second accent anywhere in
 * the product because the one-accent lock is what makes amber read as HOLD,
 * and a blue mark beside an amber HOLD marker would spend that. The brand blue
 * lives in `public/favicon.svg`, which is outside the interface. The shape
 * carries the identity on its own.
 *
 * The viewBox is the mark's own bounding box, so it can be sized by height
 * alone and sits on a text baseline without extra padding to trim.
 */
export default function VetoMark({ className = '', title }) {
  return (
    <svg
      viewBox="0 0 368 254"
      fill="currentColor"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect x="0" y="0" width="229" height="47" rx="23.5" />
      <rect x="43" y="87" width="177" height="45" rx="22.5" />
      <rect x="88" y="159" width="90" height="43" rx="21.5" />
      <path d="M286,0 L368,0 L236,254 L154,254 Z" />
    </svg>
  )
}
