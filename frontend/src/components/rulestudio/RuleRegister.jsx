import { CaretRightIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'

import { listRules, resetClientRules } from '@/api'
import { axleCountFor, formatNumber } from '@/lib/format'

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
  if (applies?.axle_config) return `konfigurasi ${applies.axle_config}`
  if (applies?.axle_index !== undefined && applies?.axle_index !== null) {
    return AXLE_POSITION[applies.axle_index] ?? `sumbu ${applies.axle_index + 1}`
  }
  // An axle-load rule with no index is a ceiling every axle has to meet. Saying
  // "semua kendaraan" for it was misleading: the scope is the axles, not the
  // fleet, and it sits under a heading that already says so.
  if (rule.dimension === 'AXLE_LOAD') return 'semua sumbu'
  return 'semua kendaraan'
}

/**
 * Which collapsed section a rule belongs in.
 *
 * The register ran as one flat list per origin, so reading it meant scrolling
 * past every axle configuration to reach the dimensions. Grouping by what a
 * rule *applies to* matches how an officer actually asks the question — "what
 * governs a tronton?" — and collapsing the groups turns thirteen rows into nine
 * headers.
 *
 * `axle_config` may arrive as a string or an array; the engine treats an array
 * as "any of these", so a rule covering several configurations gets its own
 * group rather than being duplicated into each.
 */
function bucketOf(rule) {
  const config = rule.applies_to?.axle_config
  if (config) {
    const list = Array.isArray(config) ? config : [config]
    if (list.length === 1) {
      return { key: `config:${list[0]}`, label: `Konfigurasi ${list[0]}`, config: list[0] }
    }
    return {
      key: `config:${list.join(',')}`,
      label: `Konfigurasi ${list.join(', ')}`,
      config: list[0],
    }
  }
  if (rule.dimension === 'AXLE_LOAD') {
    return { key: 'axle', label: 'Beban per sumbu', config: null }
  }
  return { key: 'all', label: 'Berlaku semua kendaraan', config: null }
}

/**
 * Groups that always apply come first, then configurations by axle count
 * ascending, which is the order the dispatch form's own dropdown uses. Sorting
 * the configuration strings directly would put `1.1-2.2` before `1.2`.
 */
const FIXED_ORDER = { all: 0, axle: 1 }

function groupRules(rules) {
  const groups = new Map()
  for (const rule of rules) {
    const bucket = bucketOf(rule)
    if (!groups.has(bucket.key)) groups.set(bucket.key, { ...bucket, rules: [] })
    groups.get(bucket.key).rules.push(rule)
  }
  return [...groups.values()].sort((a, b) => {
    const rankA = FIXED_ORDER[a.key] ?? 2
    const rankB = FIXED_ORDER[b.key] ?? 2
    if (rankA !== rankB) return rankA - rankB
    if (a.config && b.config) {
      const byAxles = axleCountFor(a.config) - axleCountFor(b.config)
      if (byAxles !== 0) return byAxles
      return a.config.localeCompare(b.config)
    }
    return 0
  })
}

export default function RuleRegister() {
  const [rules, setRules] = useState(null)
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    listRules()
      .then((data) => !cancelled && setRules(data.results ?? []))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [reloadKey])

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
            action={
              client.length > 0 && (
                <ResetClient count={client.length} onDone={() => setReloadKey((n) => n + 1)} />
              )
            }
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
function Group({ title, note, version, rules, client = false, action = null }) {
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
      <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-label text-ink-500">{note}</p>
        {action}
      </div>

      {rules.length === 0 ? (
        <p className="mt-3 text-label text-ink-500">
          Belum ada aturan klien. Unggah kebijakan internal untuk menambahkannya.
        </p>
      ) : (
        <div className="mt-1 divide-y divide-ink-100">
          {groupRules(rules).map((group) => (
            <Bucket key={group.key} group={group} client={client} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Puts the client half of the register back to empty so the Rule Studio
 * walkthrough can be run again at the booth.
 *
 * Two steps, because it deletes approved rules and the register sits at the
 * foot of a page people scroll through — a single click here would be one
 * mis-aimed tap away from wiping the demo mid-session. The confirmation names
 * the count and says plainly what survives, since the honest worry on seeing a
 * reset control next to a compliance rule base is what else it takes with it.
 */
function ResetClient({ count, onDone }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function run() {
    setBusy(true)
    setFailed(false)
    try {
      await resetClientRules()
      setConfirming(false)
      onDone()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-label text-ink-500 underline underline-offset-4 hover:text-ink-900"
      >
        Reset aturan klien
      </button>
    )
  }

  return (
    <div className="w-full">
      <p className="max-w-[58ch] text-label text-ink-900">
        Hapus {formatNumber(count)} aturan klien? Aturan pusat tetap berlaku, jadi layar
        pengiriman tetap bisa menahan muatan berlebih.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="rounded-veto bg-ink-900 px-3 py-1.5 text-label text-white disabled:opacity-50"
        >
          {busy ? 'Menghapus…' : 'Konfirmasi reset'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-label text-ink-500 underline underline-offset-4 hover:text-ink-900"
        >
          Batal
        </button>
        {failed && (
          <span className="text-label text-hold-ink">Gagal menghapus. Coba lagi.</span>
        )}
      </div>
    </div>
  )
}

/**
 * One collapsed section of the register.
 *
 * Native `<details>`, not a hand-rolled disclosure. It is keyboard-operable and
 * announced correctly by a screen reader without any of it being written here,
 * which matters on a product whose accessibility findings are still open. The
 * marker is suppressed and replaced so the caret matches the rest of the
 * interface; `group-open` rotates it.
 *
 * Closed by default. The register's job on arrival is to say what exists, not
 * to recite it.
 */
function Bucket({ group, client }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-baseline gap-2 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
        <CaretRightIcon
          aria-hidden
          size={12}
          weight="bold"
          className="shrink-0 self-center text-ink-400 transition-transform duration-150 group-open:rotate-90"
        />
        <span className="min-w-0 flex-1 truncate text-label text-ink-900">{group.label}</span>
        <span className="tnum shrink-0 font-mono text-mono-xs text-ink-500">
          {formatNumber(group.rules.length)}
        </span>
      </summary>

      <ul className="mb-1 divide-y divide-ink-100 border-l border-ink-200 pl-3">
        {group.rules.map((rule) => (
          <li key={rule.rule_id} className="flex items-baseline gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-body text-ink-900">
                {DIMENSION_LABELS[rule.dimension] ?? rule.dimension}{' '}
                <span className="text-ink-500">
                  {OPERATOR_LABELS[rule.operator] ?? rule.operator}
                  {/* Only a scope the heading does not already state earns the
                      words. "Konfigurasi 1.1" and "Berlaku semua kendaraan" both
                      say it already; "Beban per sumbu" does not say *which*
                      axle, so that group keeps its scope text. */}
                  {group.key === 'axle' ? ` · ${scopeOf(rule)}` : ''}
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
    </details>
  )
}
