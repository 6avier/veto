/**
 * Display formatting. The wire carries integer kilograms and integer
 * millimetres; the screen shows Indonesian separators. api-contract.md §0.
 *
 * Parsing and formatting both live here so a payload can never leave with a
 * formatted string in a numeric field.
 */

const id = new Intl.NumberFormat('id-ID')

/** 24500 -> "24.500" */
export const formatNumber = (value) =>
  Number.isFinite(Number(value)) ? id.format(Number(value)) : '-'

/** 24500 -> "24.500 kg" */
export const formatKg = (value) => `${formatNumber(value)} kg`

/** 4100 -> "4.100 mm" */
export const formatMm = (value) => `${formatNumber(value)} mm`

/** 24500 -> "24,5 t". For headline readouts only; never for a payload. */
export const formatTonnes = (kg) => {
  const n = Number(kg)
  if (!Number.isFinite(n)) return '-'
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(n / 1000)} t`
}

/**
 * "24.500" or "24500" -> 24500. Returns null when the field is empty or not a
 * number, so callers can tell "blank" from "zero".
 */
export const parseInteger = (input) => {
  if (input === null || input === undefined) return null
  const cleaned = String(input).replace(/[.\s]/g, '').replace(',', '.')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? Math.round(n) : null
}

/** "2026-08-11T14:32:10+07:00" -> "11 Agu 2026, 14:32" */
export const formatTimestamp = (iso) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** How many axle-load inputs an axle configuration implies. */
export const axleCountFor = (axleConfig) => {
  const digits = String(axleConfig ?? '').replace(/\./g, '')
  return Math.max(1, digits.length)
}
