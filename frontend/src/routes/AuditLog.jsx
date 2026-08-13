import { useCallback, useEffect, useState } from 'react'

import { ApiError, getDecision, listDecisions } from '@/api'
import { formatNumber, formatTimestamp } from '@/lib/format'
import { dayBoundary, latest, resetSession, sessionStart } from '@/lib/session'

/**
 * /audit — PRODUCT.md F4. Every decision the engine has made.
 *
 * Append-only is a property of the interface, not only the database: there is
 * deliberately no edit or delete affordance anywhere on this screen, and the
 * API exposes no path to one either. The screen says so out loud, because a
 * judge asking whether this is legally defensible needs to read the answer.
 */

const OUTCOMES = [
  { value: '', label: 'Semua' },
  { value: 'PASS', label: 'Lolos' },
  { value: 'HOLD', label: 'Tahan' },
]

export default function AuditLog() {
  const [outcome, setOutcome] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [scope, setScope] = useState('session')
  const [since, setSince] = useState(sessionStart)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  // Scoping happens server-side, through the `from` filter the API already
  // supports. That keeps every figure on this page a server total rather than
  // something counted on the client. DESIGN.md §8.
  const scopedFrom = latest(
    scope === 'session' ? since : null,
    dayBoundary(from, 'start'),
  )
  const scopedTo = dayBoundary(to, 'end')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // The server defaults to 50 and caps at 100. At the default the trail
      // silently rendered 50 of 56 records with nothing on screen admitting it,
      // which is the one thing an append-only log cannot do.
      const params = { limit: 100 }
      if (outcome) params.outcome = outcome
      if (scopedFrom) params.from = scopedFrom
      if (scopedTo) params.to = scopedTo
      setData(await listDecisions(params))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : ApiError.from(caught))
    } finally {
      setLoading(false)
    }
  }, [outcome, scopedFrom, scopedTo])

  useEffect(() => {
    load()
  }, [load])

  const rows = data?.results ?? []

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1">Jejak Audit</h1>
          <p className="mt-1 max-w-[65ch] text-body text-ink-500">
            Setiap keputusan pengiriman tercatat beserta versi aturan dan dasar hukum yang
            berlaku saat itu. Catatan tidak dapat diubah maupun dihapus.
          </p>
        </div>
        <Readout from={scopedFrom} to={scopedTo} />
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-4 border-y border-ink-200 py-3">
        {/*
          The scope, stated rather than implied. A trail that quietly showed a
          subset under a heading promising the complete record would be the one
          dishonest thing on the screen — so the filter is named, and switching
          to Semua catatan produces every record that was ever written, which is
          also the proof that scoping deleted nothing.
        */}
        <Filter label="Cakupan">
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value)}
            className="rounded-veto border border-ink-300 bg-white px-2 py-1.5 text-data"
          >
            <option value="session">Sesi ini</option>
            <option value="all">Semua catatan</option>
          </select>
        </Filter>
        <Filter label="Hasil">
          <select
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            className="rounded-veto border border-ink-300 bg-white px-2 py-1.5 text-data"
          >
            {OUTCOMES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Dari">
          <DateInput value={from} onChange={(event) => setFrom(event.target.value)} />
        </Filter>
        <Filter label="Sampai">
          <DateInput value={to} onChange={(event) => setTo(event.target.value)} />
        </Filter>
        {(outcome || from || to) && (
          <button
            type="button"
            onClick={() => {
              setOutcome('')
              setFrom('')
              setTo('')
            }}
            className="pb-1.5 text-label text-ink-500 underline underline-offset-4 hover:text-ink-900"
          >
            Bersihkan filter
          </button>
        )}
        {scope === 'session' && (
          <button
            type="button"
            onClick={() => {
              setSince(resetSession())
              setExpanded(null)
            }}
            className="pb-1.5 text-label text-ink-500 underline underline-offset-4 hover:text-ink-900"
          >
            Mulai sesi baru
          </button>
        )}
        <p className="ml-auto pb-1.5 font-mono text-mono-xs text-ink-500">
          HANYA-BACA · TIDAK DAPAT DIUBAH
        </p>
      </div>

      {loading && <RowSkeleton />}

      {error && !loading && (
        <div className="mt-6 border border-ink-200 bg-white px-4 py-5">
          <p className="font-mono text-mono-xs text-hold-ink">{error.code}</p>
          <p className="mt-1 text-body">{error.message}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 rounded-veto bg-ink-900 px-3 py-1.5 text-label text-white"
          >
            Coba lagi
          </button>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="mt-6 border border-dashed border-ink-300 px-4 py-10 text-center">
          <p className="text-body text-ink-500">
            {scope === 'session'
              ? 'Belum ada keputusan pada sesi ini.'
              : 'Belum ada keputusan yang tercatat.'}
          </p>
          <p className="mt-1 text-label text-ink-500">
            Jalankan validasi di Client ERP, lalu catatannya muncul di sini.
            {scope === 'session' && ' Pilih Semua catatan untuk melihat riwayat sebelumnya.'}
          </p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-ink-200 text-left">
              <Th>Waktu</Th>
              <Th>Surat Jalan</Th>
              <Th>Hasil</Th>
              <Th align="right">Pelanggaran</Th>
              <Th secondary>Override</Th>
              <Th align="right" secondary>
                Latensi
              </Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <DecisionRow
                key={row.decision_id}
                row={row}
                expanded={expanded === row.decision_id}
                onToggle={() =>
                  setExpanded(expanded === row.decision_id ? null : row.decision_id)
                }
              />
            ))}
          </tbody>
        </table>
        </div>
      )}

      {/*
        A closing boundary, and an honest one. The cap is 100 server-side, so a
        long enough trail still truncates — when it does this says so rather
        than letting the rows just stop.
      */}
      {!loading && !error && rows.length > 0 && (
        <p className="mt-3 border-t border-ink-200 pt-2 text-label text-ink-500">
          Menampilkan {formatNumber(rows.length)} dari {formatNumber(data.total)} keputusan
          {scope === 'session' ? ' pada sesi ini' : ''}
          {rows.length < data.total && ' · persempit rentang tanggal untuk melihat sisanya'}.
        </p>
      )}
    </div>
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
      <tr className="border-b border-ink-100 align-baseline">
        <Td className="font-mono text-mono-xs text-ink-500">{formatTimestamp(row.evaluated_at)}</Td>
        <Td className="font-mono text-mono">{row.dispatch_ref}</Td>
        <Td>
          <span className="inline-flex items-baseline gap-1.5">
            {held && <span aria-hidden className="h-2 w-2 self-center bg-hold" />}
            <span className={held ? 'text-label text-ink-900' : 'text-label text-ink-500'}>
              {held ? 'TAHAN' : 'LOLOS'}
            </span>
          </span>
        </Td>
        <Td align="right" className="tnum text-data">
          {formatNumber(row.violation_count)}
        </Td>
        <Td secondary className="text-label text-ink-500">
          {row.override ? row.override.overridden_by : ''}
        </Td>
        <Td align="right" secondary className="tnum text-data text-ink-500">
          {formatNumber(row.latency_ms)} ms
        </Td>
        <Td align="right">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="text-label text-ink-500 underline underline-offset-4 hover:text-ink-900"
          >
            {expanded ? 'Tutup' : 'Rincian'}
          </button>
        </Td>
      </tr>

      {expanded && (
        <tr className="border-b border-ink-200 bg-white">
          <td colSpan={7} className="px-3 py-4">
            {detailError && (
              <p className="text-label text-hold-ink">{detailError.message}</p>
            )}

            {!detail && !detailError && (
              <p className="font-mono text-mono-xs text-ink-400">memuat rincian…</p>
            )}

            {detail && (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div>
                  {detail.violations?.length > 0 ? (
                    <ul className="space-y-3">
                      {detail.violations.map((violation, index) => (
                        <li key={index} className="border-l border-hold pl-3">
                          <p className="text-body">{violation.directive}</p>
                          <p className="mt-1 tnum text-data text-ink-500">
                            {formatNumber(violation.actual_value)} / batas{' '}
                            {formatNumber(violation.limit_value)} {violation.unit}
                          </p>
                          <p className="mt-0.5 font-mono text-mono-xs text-ink-400">
                            {violation.rule_origin === 'CLIENT'
                              ? `[ SOP KLIEN ] ${violation.legal_citation}`
                              : violation.legal_citation}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-label text-ink-500">
                      Tidak ada pelanggaran. Muatan sesuai seluruh aturan aktif.
                    </p>
                  )}

                  {row.override && (
                    <div className="mt-4 border-t border-ink-100 pt-3">
                      <p className="font-mono text-mono-xs tracking-[0.12em] text-ink-400">
                        OVERRIDE
                      </p>
                      <p className="mt-1 text-body">{row.override.reason}</p>
                      <p className="mt-1 font-mono text-mono-xs text-ink-400">
                        {row.override.overridden_by} · {formatTimestamp(row.override.created_at)}
                      </p>
                      <p className="mt-1.5 text-label text-ink-500">
                        Keputusan tetap tercatat TAHAN. Override ditambahkan, bukan mengganti.
                      </p>
                    </div>
                  )}
                </div>

                <dl className="space-y-2 text-label">
                  <Meta label="ID Keputusan" value={detail.decision_id} mono />
                  {detail.rule_packs_applied?.map((pack) => (
                    <Meta
                      key={pack.id}
                      label={`Rule pack ${pack.origin}`}
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

/**
 * The trail's headline figures.
 *
 * The page had one small count and no focal point, so at booth distance it was
 * a grey grid. These three answer the only questions anyone asks of an audit
 * trail: how many decisions, how many were held, and how many were overridden.
 *
 * Not a stat-card row. Hairline-separated figures on one ruled line, sitting
 * where the lone count already sat, so it reads as an instrument readout rather
 * than a dashboard. DESIGN.md §8 bans dashboard card grids.
 *
 * Every figure is a `total` from a real filtered response. `limit=1` because
 * only the count is wanted; nothing here is computed on the client except PASS,
 * which is the difference of two server totals.
 */
function Readout({ from, to }) {
  const [counts, setCounts] = useState(null)

  useEffect(() => {
    let cancelled = false
    // The readout answers questions about whatever the trail is currently
    // scoped to, so it carries the same window as the table. A readout counting
    // every record ever written, above a table showing this session's four,
    // would just be two contradictory answers on one screen.
    const window = {}
    if (from) window.from = from
    if (to) window.to = to
    Promise.all([
      listDecisions({ ...window, limit: 1 }),
      listDecisions({ ...window, outcome: 'HOLD', limit: 1 }),
      listDecisions({ ...window, has_override: true, limit: 1 }),
    ])
      .then(([all, held, overridden]) => {
        if (cancelled) return
        setCounts({
          total: all.total,
          held: held.total,
          overridden: overridden.total,
        })
      })
      .catch(() => {
        // The trail itself still renders. A missing readout is a quiet
        // degradation, not an error worth a banner.
      })
    return () => {
      cancelled = true
    }
  }, [from, to])

  if (!counts) return null

  return (
    <dl className="flex items-baseline divide-x divide-ink-200">
      <Figure label="keputusan" value={counts.total} />
      <Figure label="ditahan" value={counts.held} marked={counts.held > 0} />
      <Figure label="override" value={counts.overridden} />
    </dl>
  )
}

function Figure({ label, value, marked = false }) {
  return (
    <div className="flex items-baseline gap-2 px-4 first:pl-0 last:pr-0">
      {marked && <span aria-hidden className="h-2 w-2 self-center bg-hold" />}
      <dd className="tnum text-data-lg text-ink-900">{formatNumber(value)}</dd>
      <dt className="text-label text-ink-500">{label}</dt>
    </div>
  )
}

function Meta({ label, value, mono }) {
  return (
    <div>
      <dt className="text-ink-400">{label}</dt>
      <dd className={mono ? 'font-mono text-mono-xs break-all text-ink-700' : 'text-ink-900'}>
        {value}
      </dd>
    </div>
  )
}

function Filter({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label text-ink-500">{label}</span>
      {children}
    </label>
  )
}

function DateInput(props) {
  return (
    <input
      type="date"
      {...props}
      className="tnum rounded-veto border border-ink-300 bg-white px-2 py-1.5 text-data"
    />
  )
}

/**
 * Seven columns need about 460px to stay comfortable, and phones start at 375.
 * Override and Latensi are the two a narrow screen can lose without losing the
 * record: one is empty until somebody overrides, the other repeats single-digit
 * milliseconds. They come back at `md`. The wrapper scrolls as a safety net so
 * nothing is ever unreachable, rather than clipped off the edge.
 */
function Th({ children, align = 'left', secondary = false }) {
  return (
    <th
      scope="col"
      className={[
        'py-2 pr-3 text-label font-medium text-ink-500',
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
        'py-2.5 pr-3',
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
    <div className="mt-4 space-y-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-8 animate-pulse rounded-veto bg-ink-100" />
      ))}
    </div>
  )
}
