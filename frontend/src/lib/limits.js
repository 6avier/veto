/**
 * Turns the active rule base into per-field limits for the dispatch form.
 *
 * The form reads its ceilings from GET /rules rather than hardcoding them, so
 * a change to the seeded rule pack shows up in the UI without a frontend edit.
 * Fields with no matching rule simply have no ceiling.
 */

const FIELD_FOR_DIMENSION = {
  GROSS_WEIGHT: 'grossWeight',
  DIMENSION_LENGTH: 'length',
  DIMENSION_WIDTH: 'width',
  DIMENSION_HEIGHT: 'height',
}

/** rules[] -> { grossWeight: {threshold, unit, citation, origin}, axle0: {...}, ... } */
export function limitsFromRules(rules = [], currentAxleConfig = null) {
  const limits = {}
  for (const rule of rules) {
    if (rule.operator !== 'LTE' || rule.status !== 'ACTIVE') continue

    if (currentAxleConfig && rule.applies_to?.axle_config) {
      const allowedConfigs = Array.isArray(rule.applies_to.axle_config) 
        ? rule.applies_to.axle_config 
        : [rule.applies_to.axle_config];
      if (!allowedConfigs.includes(currentAxleConfig)) continue;
    }

    const key =
      rule.dimension === 'AXLE_LOAD'
        ? (rule.applies_to?.axle_index !== null && rule.applies_to?.axle_index !== undefined)
          ? `axle${rule.applies_to.axle_index}`
          : 'axle_generic'
        : FIELD_FOR_DIMENSION[rule.dimension]
    if (!key) continue

    // Where several rules cover one field, the strictest is the one that binds,
    // which mirrors how the engine resolves them.
    const incumbent = limits[key]
    if (incumbent && incumbent.threshold <= rule.threshold) continue

    limits[key] = {
      threshold: rule.threshold,
      unit: rule.unit,
      citation: rule.legal_citation,
      origin: rule.origin,
    }
  }
  return limits
}

/**
 * How far a value sits from its ceiling.
 * Negative is headroom, positive is excess, which is the sign an operator reads.
 */
export function deltaFromLimit(value, limit) {
  if (!limit) return null
  const n = Number(value)
  if (!Number.isFinite(n) || value === '' || value === null) return null
  const delta = n - limit.threshold
  return { delta, over: delta > 0, unit: limit.unit, threshold: limit.threshold }
}
