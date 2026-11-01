import { BuildingsIcon, LockSimpleIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'

import { listRuleCandidates, listRules, resetClientRules } from '@/api'
import { axleCountFor, formatNumber, formatTimestamp } from '@/lib/format'

import { dimensionOf } from './dimensions'
import { BTN_DARK, BTN_QUIET, PANEL } from './ui'

/**
 * The rule base, on screen: Konsep UI v3's "Aturan aktif" table.
 *
 * The compliance officer's question is "which rules are live right now, whose
 * are they, and which one actually decides". So central and company rules sit
 * in one table rather than two columns, and every row says whether it is in
 * force. A central ceiling a stricter company rule overrides stays listed,
 * marked as replaced; it is still the law, it just is not the binding number.
 *
 * It stays mounted through the upload flow, because the useful moment to see
 * the existing thresholds is while judging a proposed one.
 */

const TABS = [
  { value: 'all', label: 'Semua' },
  { value: 'CENTRAL', label: 'Pusat' },
  { value: 'CLIENT', label: 'Perusahaan' },
]

const OPERATOR_SHORT = { LTE: 'maks.', GTE: 'min.', EQ: 'tepat' }

const DIMENSION_ORDER = [
  'GROSS_WEIGHT',
  'AXLE_LOAD',
  'DIMENSION_LENGTH',
  'DIMENSION_WIDTH',
  'DIMENSION_HEIGHT',
  'AXLE_CONFIG',
]

const configsOf = (rule) => {
  const config = rule.applies_to?.axle_config
  if (!config) return []
  return Array.isArray(config) ? config : [config]
}

const axleIndexOf = (rule) => {
  const index = rule.applies_to?.axle_index
  return index === undefined || index === null ? null : index
}

/** What a rule applies to, in the operator's words rather than the payload's. */
function scopeOf(rule) {
  const configs = configsOf(rule)
  const index = axleIndexOf(rule)
  const parts = []
  if (index !== null) parts.push(`Sumbu ${index + 1}`)
  if (configs.length) parts.push(`Konfigurasi ${configs.join(', ')}`)
  if (parts.length) return parts.join(' · ')
  if (rule.dimension === 'AXLE_LOAD') return 'Semua sumbu'
  if (rule.dimension.startsWith('DIMENSION_')) return 'Kendaraan dan muatan'
  return 'Semua kendaraan'
}

/**
 * Whether a company rule reaches the case a central rule governs. The engine
 * pairs the applicable central and company rule for each check, and a company
 * rule with no configuration or axle named applies to all of them.
 */
function covers(client, central) {
  if (client.dimension !== central.dimension || client.unit !== central.unit) return false
  const clientConfigs = configsOf(client)
  const centralConfigs = configsOf(central)
  if (clientConfigs.length && !centralConfigs.some((config) => clientConfigs.includes(config))) return false
  const clientIndex = axleIndexOf(client)
  if (clientIndex !== null && clientIndex !== axleIndexOf(central)) return false
  return true
}

/**
 * Stricter wins, as in engine.py `_find_stricter_rule`: a company ceiling only
 * replaces a central one when it is strictly lower. A tie keeps the central rule.
 */
const stricter = (client, central) =>
  client.operator === 'LTE' && central.operator === 'LTE' && client.threshold < central.threshold

function statusOf(rule, rules) {
  if (rule.origin === 'CENTRAL') {
    const winner = rules.find((other) => other.origin === 'CLIENT' && covers(other, rule) && stricter(other, rule))
    // A company citation can run to a whole filename, so the status names the
    // binding number and leaves the citation to its own row.
    return winner
      ? {
          inForce: false,
          text: 'Diganti aturan Perusahaan',
          note: `${formatNumber(winner.threshold)} ${winner.unit} berlaku`,
          title: winner.legal_citation,
        }
      : { inForce: true, text: 'Berlaku' }
  }
  const counterparts = rules.filter((other) => other.origin === 'CENTRAL' && covers(rule, other))
  if (!counterparts.length || counterparts.some((central) => stricter(rule, central))) {
    return { inForce: true, text: 'Berlaku' }
  }
  const tie = counterparts.every((central) => central.threshold === rule.threshold)
  return { inForce: false, text: tie ? 'Tidak dipakai, sama dengan pusat' : 'Tidak dipakai, pusat lebih ketat' }
}

/**
 * Central first, then company. Within each: gross weight by axle count (the
 * order the dispatch form's dropdown uses; sorting the strings would put
 * `1.1-2.2` before `1.2`), then axle loads by position, then dimensions.
 */
function sortRules(rules) {
  const rank = (rule) => [
    rule.origin === 'CENTRAL' ? 0 : 1,
    DIMENSION_ORDER.indexOf(rule.dimension),
    // A rule for every axle reads after the ones naming a position.
    axleIndexOf(rule) ?? 99,
    configsOf(rule)[0] ? axleCountFor(configsOf(rule)[0]) : 0,
  ]
  return [...rules].sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    for (let i = 0; i < ra.length; i += 1) if (ra[i] !== rb[i]) return ra[i] - rb[i]
    return 0
  })
}

export default function RuleRegister() {
  const [rules, setRules] = useState(null)
  const [reviews, setReviews] = useState({})
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [tab, setTab] = useState('all')

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    listRules()
      .then((data) => !cancelled && setRules(data.results ?? []))
      .catch(() => !cancelled && setFailed(true))
    // Who approved each company rule lives on the candidate it came from. If
    // this call fails the table still renders; the column says so instead.
    listRuleCandidates('APPROVED')
      .then((data) => {
        if (cancelled) return
        const byRule = {}
        for (const candidate of data.results ?? []) {
          if (candidate.rule_id) byRule[candidate.rule_id] = candidate
        }
        setReviews(byRule)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const all = rules ?? []
  const client = all.filter((rule) => rule.origin === 'CLIENT')
  const shown = sortRules(tab === 'all' ? all : all.filter((rule) => rule.origin === tab))

  return (
    <section className={PANEL} aria-labelledby="register-title">
      <div className="flex flex-wrap items-center gap-3 px-5 pb-2.5 pt-[18px]">
        <h2 id="register-title" className="text-[19px] font-bold tracking-[-0.01em]">
          Aturan aktif
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {client.length > 0 && (
            <ResetClient count={client.length} onDone={() => setReloadKey((n) => n + 1)} />
          )}
          <div role="group" aria-label="Saring asal aturan" className="flex gap-1 rounded-xl bg-console p-1">
            {TABS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={tab === option.value}
                onClick={() => setTab(option.value)}
                className="rounded-[9px] px-3 py-1.5 text-[13px] font-bold text-ink-500 transition-colors hover:text-ink-900 aria-pressed:bg-white aria-pressed:text-ink-900 aria-pressed:shadow-[0_1px_2px_rgba(13,21,38,0.08)]"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!rules && !failed && (
        <div className="space-y-2 px-5 pb-5 pt-2" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-11 animate-pulse rounded-xl bg-console" />
          ))}
        </div>
      )}

      {/* It used to hide itself on failure, which made a backend with a pending
          migration look like a page with no rule base at all. */}
      {failed && (
        <div role="alert" className="px-5 pb-5 pt-2">
          <p className="text-[15px] font-bold">Daftar aturan tidak dapat dimuat</p>
          <p className="mt-1 text-[14px] text-ink-600">Server VETO tidak menjawab. Coba muat ulang.</p>
          <button type="button" onClick={() => setReloadKey((n) => n + 1)} className={`${BTN_DARK} mt-3`}>
            Coba lagi
          </button>
        </div>
      )}

      {rules && shown.length === 0 && (
        <p className="px-5 pb-8 pt-4 text-center text-[14px] text-ink-500">
          Belum ada aturan perusahaan. Unggah SOP di atas untuk menambahkannya.
        </p>
      )}

      {rules && shown.length > 0 && (
        <div className="overflow-x-auto px-2.5 pb-2.5">
          <table className="w-full min-w-[740px] border-collapse text-[14px]">
            <thead>
              <tr className="text-left">
                <Th>Aturan</Th>
                <Th>Batas</Th>
                <Th>Asal</Th>
                <Th>Sumber</Th>
                <Th>Disetujui</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((rule) => (
                <RuleRow key={rule.rule_id} rule={rule} status={statusOf(rule, all)} review={reviews[rule.rule_id]} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function RuleRow({ rule, status, review }) {
  const { label, Icon } = dimensionOf(rule.dimension)
  const central = rule.origin === 'CENTRAL'
  return (
    <tr className="border-t border-ink-100 align-middle">
      <td className="px-3 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-console text-ink-600">
            <Icon size={16} aria-hidden />
          </span>
          <div>
            {label} {OPERATOR_SHORT[rule.operator] ?? rule.operator}
            <small className="block text-[12px] text-ink-500">{scopeOf(rule)}</small>
          </div>
        </div>
      </td>
      <td className="tnum whitespace-nowrap px-3 py-3 font-extrabold">
        {formatNumber(rule.threshold)} {rule.unit}
      </td>
      <td className="px-3 py-3">
        <span
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-bold ${
            central ? 'bg-ink-900 text-white' : 'bg-accent-soft text-accent-ink'
          }`}
        >
          {central ? <LockSimpleIcon size={12} weight="bold" aria-hidden /> : <BuildingsIcon size={12} weight="bold" aria-hidden />}
          {central ? 'Pusat' : 'Perusahaan'}
        </span>
      </td>
      <td className="max-w-[30ch] px-3 py-3 font-mono text-[12.5px] text-ink-600">
        <span className="line-clamp-2" title={rule.legal_citation}>
          {rule.legal_citation}
        </span>
      </td>
      <td className="px-3 py-3 text-[13px] text-ink-600">
        {central ? 'VETO' : review?.reviewed_by || 'Tim Anda'}
        <small className="block font-mono text-[11px] text-ink-400">
          v{rule.rule_pack_version}
          {!central && review?.reviewed_at && ` · ${formatTimestamp(review.reviewed_at)}`}
        </small>
      </td>
      <td
        title={status.title}
        className={`px-3 py-3 text-[12.5px] font-bold ${status.inForce ? 'text-[#1f6b39]' : 'text-ink-400'}`}
      >
        {status.text}
        {status.note && <small className="tnum block font-mono text-[11px] font-normal">{status.note}</small>}
      </td>
    </tr>
  )
}

/**
 * Puts the company half of the register back to empty so the Rule Studio
 * walkthrough can be run again at the booth.
 *
 * Two steps, because it deletes approved rules: the first click arms the button
 * and names the count, the second deletes. It disarms itself after four seconds
 * so a stray tap later does nothing. The text says plainly what survives, since
 * the honest worry on seeing a reset next to a rule base is what else it takes.
 */
function ResetClient({ count, onDone }) {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(timer)
  }, [armed])

  async function run() {
    setBusy(true)
    setFailed(false)
    try {
      await resetClientRules()
      setArmed(false)
      onDone()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2" aria-live="polite">
      <button
        type="button"
        onClick={() => (armed ? run() : setArmed(true))}
        disabled={busy}
        className={`${BTN_QUIET} ${armed ? 'text-hold-ink hover:text-hold-ink' : ''}`}
      >
        {busy
          ? 'Menghapus…'
          : armed
            ? `Hapus ${formatNumber(count)} aturan perusahaan? Klik lagi. Aturan pusat tetap berlaku.`
            : 'Reset aturan perusahaan'}
      </button>
      {failed && <span className="text-[13px] font-bold text-hold-ink">Gagal menghapus. Coba lagi.</span>}
    </span>
  )
}

function Th({ children }) {
  return (
    <th scope="col" className="px-3 py-2.5 text-left text-[12px] font-bold text-ink-500">
      {children}
    </th>
  )
}
