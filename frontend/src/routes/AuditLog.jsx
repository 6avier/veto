import { useCallback, useEffect, useState } from 'react'

import { ApiError, getDecision, listDecisions } from '@/api'
import { BTN_DARK, BTN_QUIET, PANEL } from '@/components/rulestudio/ui'
import { formatNumber, formatTimestamp } from '@/lib/format'
import { resetSession, sessionStart } from '@/lib/session'

/**
 * /audit — PRODUCT.md F4. Every decision the engine has made, and every
 * override written against one.
 *
 * Append-only is a property of the interface, not only the database: there is
 * deliberately no edit or delete affordance anywhere on this screen, and the
 * API exposes no path to one either. The screen says so out loud, because a
 * judge asking whether this is legally defensible needs to read the answer.
 *
 * An override is shown as its own event, after the decision it was written
 * against, because that is what it is: an addition, never a replacement.
 */

const TABS = [
  { value: 'all', label: 'Semua', params: {} },
  { value: 'pass', label: 'Lolos', params: { outcome: 'PASS' } },
  { value: 'hold', label: 'Ditahan', params: { outcome: 'HOLD' } },
  { value: 'override', label: 'Override', params: { has_override: true } },
]

export default function AuditLog() {
  const [tab, setTab] = useState('all')
  const [scope, setScope] = useState('session')
  const [since, setSince] = useState(sessionStart)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  // Scoping happens server-side, through the `from` filter the API already
  // supports, so every figure here is a server total. DESIGN.md §8.
  const scopedFrom = scope === 'session' ? since : null

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // The server defaults to 50 and caps at 100; the footer admits the cap.
      const params = { limit: 100, ...TABS.find((t) => t.value === tab).params }
      if (scopedFrom) params.from = scopedFrom
      setData(await listDecisions(params))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : ApiError.from(caught))
    } finally {
      setLoading(false)
    }
  }, [tab, scopedFrom])

  useEffect(() => {
    load()
  }, [load])

  const rows = data?.results ?? []

  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-4 px-4 py-5">
      <h1 className="px-1 text-[32px] font-bold leading-tight tracking-[-0.02em]">Jejak Audit</h1>

      <section className={PANEL} aria-labelledby="audit-title">
        <div className="flex flex-wrap items-center gap-3 px-5 pb-2.5 pt-[18px]">
          <h2 id="audit-title" className="text-[19px] font-bold tracking-[-0.01em]">
            {scope === 'session' ? 'Keputusan sesi ini' : 'Semua keputusan'}
          </h2>
          <div role="group" aria-label="Saring jenis catatan" className="flex flex-wrap gap-1 rounded-xl bg-console p-1">
            {TABS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={tab === option.value}
                onClick={() => {
                  setTab(option.value)
                  setExpanded(null)
                }}
                className="rounded-[9px] px-3 py-1.5 text-[13px] font-bold text-ink-500 transition-colors hover:text-ink-900 aria-pressed:bg-white aria-pressed:text-ink-900 aria-pressed:shadow-[0_1px_2px_rgba(13,21,38,0.08)]"
              >
                {option.label}
              </button>
            ))}
          </div>
          {/*
            The scope, stated rather than implied. Switching to Semua catatan
            produces every record ever written, which is also the proof that
            scoping deleted nothing.
          */}
          <div className="ml-auto flex items-center gap-1">
            {scope === 'session' && (
              <button
                type="button"
                onClick={() => {
                  setSince(resetSession())
                  setExpanded(null)
                }}
                className={BTN_QUIET}
              >
                Mulai sesi baru
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setScope(scope === 'session' ? 'all' : 'session')
                setExpanded(null)
              }}
              className={BTN_QUIET}
            >
              {scope === 'session' ? 'Lihat semua catatan' : 'Hanya sesi ini'}
            </button>
          </div>
        </div>
        <p className="px-5 pb-1.5 text-[13px] text-ink-500">
          Catatan hanya bertambah. Tidak ada yang bisa diubah atau dihapus.
        </p>

        {loading && <RowSkeleton />}

        {error && !loading && (
          <div role="alert" className="px-5 py-5">
            <p className="text-[15px] font-bold">Jejak audit tidak dapat dimuat</p>
            <p className="mt-1 text-[14px] text-ink-600">{error.message}</p>
            <button type="button" onClick={load} className={`${BTN_DARK} mt-3`}>
              Coba lagi
            </button>
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-[16px] font-bold text-ink-900">Belum ada catatan untuk saringan ini.</p>
            <p className="mt-1 text-[14px] text-ink-500">
              Jalankan validasi di Client ERP, lalu catatannya muncul di sini.
            </p>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[740px] border-collapse text-[14px]">
                <thead>
                  <tr className="text-left">
                    <Th>Waktu</Th>
                    <Th>Jenis</Th>
                    <Th>Rujukan</Th>
                    <Th>Detail</Th>
                    <Th>Oleh</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {rows.flatMap((row) => {
                    const events = []
                    if (row.override && tab !== 'pass') {
                      events.push(<OverrideRow key={`${row.decision_id}-o`} row={row} />)
                    }
                    if (tab !== 'override') {
                      events.push(
                        <DecisionRow
                          key={row.decision_id}
                          row={row}
                          expanded={expanded === row.decision_id}
                          onToggle={() => setExpanded(expanded === row.decision_id ? null : row.decision_id)}
                        />,
                      )
                    }
                    return events
                  })}
                </tbody>
              </table>
            </div>
            <p className="border-t border-ink-100 px-5 py-3 text-[13px] text-ink-500">
              Menampilkan {formatNumber(rows.length)} dari {formatNumber(data.total)} keputusan
              {scope === 'session' ? ' pada sesi ini' : ''}
              {rows.length < data.total && ' · sisanya tersimpan, hanya tidak ditampilkan'}.
            </p>
          </>
        )}
      </section>
    </div>
  )
}

function Chip({ tone, children }) {
  const tones = {
    pass: 'bg-[#e6f4ea] text-[#11692f]',
    hold: 'bg-[#fdf2df] text-hold-ink',
    override: 'border border-hold bg-white text-hold-ink',
  }
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-extrabold ${tones[tone]}`}>
      {children}
    </span>
  )
}

function OverrideRow({ row }) {
  return (
    <tr className="border-t border-ink-100 align-middle">
      <Td className="whitespace-nowrap font-mono text-[12px] text-ink-500">
        {formatTimestamp(row.override.created_at)}
      </Td>
      <Td>
        <Chip tone="override">Override</Chip>
      </Td>
      <Td className="whitespace-nowrap font-mono text-[13px] text-ink-700">{row.dispatch_ref}</Td>
      <Td className="max-w-[52ch] text-[13.5px]">
        “{row.override.reason}”
        <small className="block font-mono text-[12px] text-ink-400">Atas keputusan DITAHAN, tetap tercatat</small>
      </Td>
      <Td className="text-[13px] text-ink-600">{row.override.overridden_by}</Td>
      <Td />
    </tr>
  )
}

function DecisionRow({ row, expanded, onToggle }) {
  const [detail, setDetail] = useState(null)
  const [detailError, setDetailError] = useState(null)
  const held = row.outcome === 'HOLD'

  useEffect(() => {
    if (!expanded || detail) return
    let cancelled = false
    getDecision(row.decision_id)
      .then((result) => !cancelled && setDetail(result))
      .catch((caught) => !cancelled && setDetailError(ApiError.from(caught)))
    return () => {
      cancelled = true
    }
  }, [expanded, detail, row.decision_id])

  return (
    <>
      <tr className={`border-t border-ink-100 align-middle ${expanded ? 'bg-console' : ''}`}>
        <Td className="whitespace-nowrap font-mono text-[12px] text-ink-500">{formatTimestamp(row.evaluated_at)}</Td>
        <Td>
          <Chip tone={held ? 'hold' : 'pass'}>{held ? 'Ditahan' : 'Lolos'}</Chip>
        </Td>
        <Td className="whitespace-nowrap font-mono text-[13px] text-ink-700">
          {row.dispatch_ref}
          <small className="block text-[12px] text-ink-400">{row.decision_id.slice(0, 8)}</small>
        </Td>
        <Td className="max-w-[52ch] text-[13.5px]">
          {row.violation_count
            ? `${formatNumber(row.violation_count)} ketentuan dilanggar`
            : 'Semua ketentuan terpenuhi'}
          <small className="block font-mono text-[12px] text-ink-400">{formatNumber(row.latency_ms)} ms</small>
        </Td>
        <Td className="text-[13px] text-ink-600">Mesin VETO</Td>
        <Td align="right">
          <button type="button" onClick={onToggle} aria-expanded={expanded} className={`${BTN_QUIET} ml-auto`}>
            {expanded ? 'Tutup' : 'Rincian'}
          </button>
        </Td>
      </tr>

      {expanded && (
        <tr className="bg-console">
          <td colSpan={6} className="px-3 pb-4 pt-1">
            {detailError && (
              <p className="text-[13px] font-bold text-hold-ink">{detailError.message}</p>
            )}

            {!detail && !detailError && (
              <p className="text-[13px] text-ink-400">Memuat rincian…</p>
            )}

            {detail && (
              <div className="grid gap-5 rounded-2xl bg-white p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div>
                  {detail.violations?.length > 0 ? (
                    <ul className="divide-y divide-ink-100">
                      {detail.violations.map((violation, index) => (
                        <li key={index} className="grid gap-1 py-2.5 first:pt-0">
                          <p className="text-[14px] font-bold">{violation.directive}</p>
                          <p className="text-[13px] tabular-nums text-ink-500">
                            {formatNumber(violation.actual_value)} / batas{' '}
                            {formatNumber(violation.limit_value)} {violation.unit}
                          </p>
                          <p className="flex flex-wrap items-center gap-1.5 font-mono text-[12px] text-ink-400">
                            <OriginChip origin={violation.rule_origin} />
                            {violation.legal_citation}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[14px] text-ink-500">
                      Tidak ada pelanggaran. Muatan sesuai seluruh aturan aktif.
                    </p>
                  )}

                </div>

                <dl className="space-y-2 text-[13px]">
                  <Meta label="ID Keputusan" value={detail.decision_id} mono />
                  {detail.rule_packs_applied?.map((pack) => (
                    <Meta
                      key={pack.id}
                      label={`Aturan ${pack.origin === 'CLIENT' ? 'Perusahaan' : 'Pusat'}`}
                      value={`${pack.domain} v${pack.version}`}
                      mono
                    />
                  ))}
                </dl>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function OriginChip({ origin }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-satoshi text-[12px] font-extrabold ${
        origin === 'CLIENT' ? 'bg-accent-soft text-accent-ink' : 'bg-ink-100 text-ink-700'
      }`}
    >
      {origin === 'CLIENT' ? 'Perusahaan' : 'Pusat'}
    </span>
  )
}

function Meta({ label, value, mono }) {
  return (
    <div>
      <dt className="text-ink-400">{label}</dt>
      <dd className={mono ? 'font-mono text-[12px] break-all text-ink-700' : 'text-ink-900'}>
        {value}
      </dd>
    </div>
  )
}

/** The table scrolls sideways under 740px rather than clipping a column. */
function Th({ children, align = 'left', secondary = false }) {
  return (
    <th
      scope="col"
      className={[
        'px-3 py-3 text-[12px] font-bold text-ink-500',
        align === 'right' ? 'text-right' : '',
        secondary ? 'hidden md:table-cell' : '',
      ].join(' ')}
    >
      {children}
    </th>
  )
}

function Td({ children, align = 'left', className = '', secondary = false }) {
  return (
    <td
      className={[
        'px-3 py-2.5',
        align === 'right' ? 'text-right' : '',
        secondary ? 'hidden md:table-cell' : '',
        className,
      ].join(' ')}
    >
      {children}
    </td>
  )
}

function RowSkeleton() {
  return (
    <div className="space-y-2 px-5 pb-5 pt-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-11 animate-pulse rounded-xl bg-console" />
      ))}
    </div>
  )
}
