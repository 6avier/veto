/** How a proposed rule sits against the central one. Absent when nothing compares. */
export default function CompareChip({ verdict }) {
  if (!verdict) return null
  const styles = {
    stricter: ['bg-accent-soft text-accent-ink', 'Lebih ketat dari pusat'],
    looser: ['bg-hold/15 text-hold-ink', 'Lebih longgar dari pusat'],
    same: ['bg-console text-ink-500', 'Sama dengan pusat'],
  }
  const [tone, label] = styles[verdict]
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-bold ${tone}`}
    >
      {label}
    </span>
  )
}
