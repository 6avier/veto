import {
  ArrowsHorizontalIcon,
  ArrowsVerticalIcon,
  PackageIcon,
  RulerIcon,
  TireIcon,
  TruckIcon,
} from '@phosphor-icons/react'

/** What each extracted dimension is called on screen, and the glyph it carries. */
export const DIMENSIONS = {
  GROSS_WEIGHT: { label: 'Berat kotor', Icon: PackageIcon },
  AXLE_LOAD: { label: 'Muatan sumbu', Icon: TireIcon },
  DIMENSION_LENGTH: { label: 'Panjang', Icon: RulerIcon },
  DIMENSION_WIDTH: { label: 'Lebar', Icon: ArrowsHorizontalIcon },
  DIMENSION_HEIGHT: { label: 'Tinggi', Icon: ArrowsVerticalIcon },
  AXLE_CONFIG: { label: 'Konfigurasi sumbu', Icon: TruckIcon },
}

export const OPERATOR_LABELS = { LTE: 'maksimum', GTE: 'minimum', EQ: 'tepat' }

export const dimensionOf = (code) => DIMENSIONS[code] ?? { label: code, Icon: TruckIcon }

/**
 * A fallback candidate carries a placeholder threshold, not a figure read out of
 * the document, and must never pass for an extraction.
 */
export const isUnverified = (candidate) =>
  Boolean(candidate?.tags?.some((tag) => tag === 'cadangan' || tag === 'belum-diverifikasi'))

const configsOf = (appliesTo) => {
  const config = appliesTo?.axle_config
  if (!config) return []
  return Array.isArray(config) ? config : [config]
}

/**
 * The central rule a candidate would sit on top of, or null when there is no
 * single one to compare against. Gross weight is set per axle configuration, so
 * a candidate naming no configuration, or several, has no one counterpart and
 * gets no comparison rather than a guessed one.
 */
export function centralCounterpart(candidate, central) {
  if (!candidate || !central?.length) return null
  const same = central.filter(
    (rule) => rule.dimension === candidate.dimension && rule.unit === candidate.unit,
  )

  if (candidate.dimension === 'GROSS_WEIGHT') {
    const configs = configsOf(candidate.applies_to)
    if (configs.length !== 1) return null
    return same.find((rule) => configsOf(rule.applies_to)[0] === configs[0]) ?? null
  }

  if (candidate.dimension === 'AXLE_LOAD') {
    const index = candidate.applies_to?.axle_index
    if (index !== undefined && index !== null) {
      const exact = same.find((rule) => rule.applies_to?.axle_index === index)
      if (exact) return exact
    }
    return same.find((rule) => !rule.applies_to) ?? null
  }

  return same.find((rule) => !rule.applies_to) ?? null
}

/**
 * 'stricter' | 'looser' | 'same' | null. Only ceilings compare: the stricter
 * threshold is the one enforced (PRODUCT.md §4), so a looser client rule is
 * worth flagging before anyone approves it.
 */
export function compareToCentral(candidate, counterpart) {
  if (!counterpart || candidate.operator !== 'LTE' || counterpart.operator !== 'LTE') return null
  if (candidate.threshold < counterpart.threshold) return 'stricter'
  if (candidate.threshold > counterpart.threshold) return 'looser'
  return 'same'
}

/**
 * Vehicle classes the backend can turn into axle configurations on approval.
 * Mirrors VEHICLE_CLASS_AXLE_CONFIGS in backend/apps/rules/candidates.py; keep
 * the two in step. Only the names are needed here, to know in advance which
 * candidates the server will refuse.
 */
const MAPPED_CLASSES = ['tronton', 'trailer', 'trailer combination', 'truk gandeng', 'gandengan']

const classOf = (candidate) => {
  const name = candidate?.applies_to?.vehicle_class
  return typeof name === 'string' && name.trim() ? name.trim() : null
}

/**
 * The vehicle class a candidate names when the backend cannot map it to axle
 * configurations ("Medium Truck", "Pickup"), else null. Approved as-is, such a
 * rule would bind every truck, so approval answers 409 and the only decision
 * left is to reject it.
 */
export function unmappedClass(candidate) {
  const name = classOf(candidate)
  if (!name || configsOf(candidate.applies_to).length) return null
  return MAPPED_CLASSES.includes(name.toLowerCase()) ? null : name
}

/** What a candidate applies to, in the reviewer's words. */
export function scopeOf(candidate) {
  const configs = configsOf(candidate.applies_to)
  if (configs.length) return `Konfigurasi ${configs.join(', ')}`
  // "Semua kendaraan" for a rule written for one class was wrong on its face.
  const name = classOf(candidate)
  if (name) return `Kelas ${name}`
  const index = candidate.applies_to?.axle_index
  if (index !== undefined && index !== null) return `Sumbu ${index + 1}`
  if (candidate.dimension === 'AXLE_LOAD') return 'Semua sumbu'
  return 'Semua kendaraan'
}
