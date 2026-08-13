import { useEffect, useState } from 'react'

import { listRules } from '@/api'
import { formatNumber } from '@/lib/format'

/**
 * The rule base, on screen.
 *
 * Rule Studio used to open on an empty dashed rectangle, which said nothing
 * about the thing it exists to edit. The page copy claims national regulations
 * are already maintained centrally, and this is where that claim stops being a
 * sentence and becomes a list the officer can read.
 *
 * It is also the register PRODUCT.md §2 implies but never had a home for: the
 * compliance officer's actual question is "which rules are live right now, and
 * whose are they". It stays mounted through the upload flow, because the useful
 * moment to see the existing thresholds is while judging a proposed one.
 *
 * Ruled rows, not cards. The origin split is the product's core distinction, so
 * it is the grouping; nothing else here earns a container.
 */

const DIMENSION_LABELS = {
  GROSS_WEIGHT: 'Berat kotor',
  AXLE_LOAD: 'Muatan sumbu',
  DIMENSION_LENGTH: 'Panjang',
  DIMENSION_WIDTH: 'Lebar',
  DIMENSION_HEIGHT: 'Tinggi',
  AXLE_CONFIG: 'Konfigurasi sumbu',
}

const OPERATOR_LABELS = { LTE: 'maks', GTE: 'min', EQ: 'tepat' }

const AXLE_POSITION = ['sumbu depan', 'sumbu kedua', 'sumbu ketiga']

/** What a rule applies to, in the operator's words rather than the payload's. */
function scopeOf(rule) {
  const applies = rule.applies_to
  if (!applies) return 'semua kendaraan'
  if (applies.axle_config) return `konfigurasi ${applies.axle_config}`
  if (applies.axle_index !== undefined && applies.axle_index !== null) {
    return AXLE_POSITION[applies.axle_index] ?? `sumbu ${applies.axle_index + 1}`
  }
  return 'semua kendaraan'
}

export default function RuleRegister() {
  const [rules, setRules] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    listRules()
      .then((data) => !cancelled && setRules(data.results ?? []))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])

  if (failed) return null

  const central = (rules ?? []).filter((rule) => rule.origin === 'CENTRAL')
  const client = (rules ?? []).filter((rule) => rule.origin === 'CLIENT')
  const packVersion = (list) => list[0]?.rule_pack_version

  return (
    <section className="mt-10 border-t border-ink-300 pt-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-h2 text-ink-900">Aturan yang berlaku</h2>
        {rules && (
          <p className="tnum text-data text-ink-500">
            {formatNumber(rules.length)} aktif
          </p>
        )}
        <p className="ml-auto max-w-[52ch] text-label text-ink-500">
          Aturan klien berlaku di atas aturan pusat. Bila keduanya mengatur hal yang sama,
          ambang yang lebih ketat yang dipakai.
        </p>
      </div>

      {!rules && (
        <div className="mt-4 space-y-2" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-7 animate-pulse rounded-veto bg-ink-100" />
          ))}
        </div>
      )}

      {rules && (
        <div className="mt-5 grid gap-x-10 gap-y-6 lg:grid-cols-2">
          <Group
            title="Pusat"
            note="Dipelihara VETO. Tidak perlu diunggah."
            version={packVersion(central)}
            rules={central}
          />
          <Group
            title="Klien"
            note="Berasal dari kebijakan internal yang sudah disetujui."
            version={packVersion(client)}
            rules={client}
            client
          />
        </div>
      )}
    </section>
  )
}

/**
 * `min-w-0` is load-bearing. As a grid item this defaults to `min-width: auto`,
 * so the truncated citation below — which is `white-space: nowrap` — sets its
 * own min-content width as the floor and pushes it to ~432px. On a phone that
 * clipped the threshold column off the right edge, and because the overflow was
 * on a grid item rather than a scroll container it could not be scrolled back.
 */
function Group({ title, note, version, rules, client = false }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-2 border-b border-ink-200 pb-1.5">
        <h3 className="text-label text-ink-900">{title}</h3>
        {version !== undefined && (
          <span className="font-mono text-mono-xs text-ink-500">ODOL v{version}</span>
        )}
        <span className="tnum ml-auto font-mono text-mono-xs text-ink-500">
          {formatNumber(rules.length)}
        </span>
      </div>
      <p className="mt-1.5 text-label text-ink-500">{note}</p>

      {rules.length === 0 ? (
        <p className="mt-3 text-label text-ink-500">
          Belum ada aturan klien. Unggah kebijakan internal untuk menambahkannya.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-ink-100">
          {rules.map((rule) => (
            <li key={rule.rule_id} className="flex items-baseline gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-body text-ink-900">
                  {DIMENSION_LABELS[rule.dimension] ?? rule.dimension}{' '}
                  <span className="text-ink-500">
                    {OPERATOR_LABELS[rule.operator] ?? rule.operator} · {scopeOf(rule)}
                  </span>
                </p>
                <p className="mt-0.5 truncate font-mono text-mono-xs text-ink-500">
                  {client ? `[ SOP KLIEN ] ${rule.legal_citation}` : rule.legal_citation}
                </p>
              </div>
              <p className="tnum shrink-0 text-data-lg text-ink-900">
                {formatNumber(rule.threshold)}
                <span className="ml-1 text-data text-ink-500">{rule.unit}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
