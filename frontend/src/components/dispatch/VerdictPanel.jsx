import VetoMark from '@/components/VetoMark'
import { formatNumber } from '@/lib/format'

/**
 * VETO speaking inside the client's ERP.
 *
 * White, not graphite. DESIGN.md §1: a dark block dropped into a light
 * enterprise page read as a foreign widget rather than an intervention. VETO is
 * distinguished from the host by being cleaner than it, not darker: the ERP is
 * grey and boxy, this is white, quiet and hairline-ruled.
 *
 * Amber never appears as text on white (1.9:1). It is a marker and a rule only.
 */
export default function VerdictPanel({ decision, error, pending, settled, overridden = false }) {
  const held = decision?.outcome === 'HOLD'

  return (
    <aside
      className={[
        'overflow-hidden rounded-2xl border border-ink-200 bg-white font-satoshi shadow-[0_1px_2px_rgba(17,24,39,0.04),0_8px_24px_-12px_rgba(17,24,39,0.12)] lg:sticky lg:top-4',
        settled ? 'veto-settle' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-2.5">
        {/* The mark is the one thing in this panel that belongs to VETO rather
            than to the host, so it sits where the handover from ERP to VETO
            happens. */}
        <VetoMark className="h-3.5 w-auto" />
        <b className="text-[14px] font-extrabold tracking-[-0.01em] text-ink-900">VETO</b>
        {pending && <span className="ml-auto text-[12px] font-bold text-accent">memeriksa…</span>}
      </div>

      <div className="px-4 py-4">
        {!decision && !error && !pending && (
          <p className="text-[14px] text-ink-500">Belum ada pemeriksaan.</p>
        )}

        {error && (
          <div role="alert">
            <p className="font-mono text-[12px] text-hold-ink">{error.code}</p>
            <p className="mt-1 text-[14px] text-ink-900">{error.message}</p>
          </div>
        )}

        {decision && (
          <div>
            <p
              className={`text-[30px] font-black leading-none tracking-[0.02em] ${
                held ? 'text-hold-ink' : 'text-[#11692f]'
              }`}
            >
              {held ? 'DITAHAN' : 'LOLOS'}
            </p>
            <p className="mt-1.5 font-mono text-[11.5px] text-ink-400">
              {decision.dispatch_ref} · {formatNumber(decision.latency_ms)} ms
            </p>
            {held && overridden && (
              <p className="mt-2 text-[13px] font-bold text-ink-700">Di-override dengan alasan tercatat.</p>
            )}

            {held ? (
              <ul className="mt-3 divide-y divide-ink-100 border-t border-ink-100">
                {decision.violations.map((violation, index) => (
                  <li key={index} className="grid gap-1 py-3">
                    <p className="text-[14px] font-bold text-ink-900">{violation.directive}</p>
                    <p className="text-[13px] tabular-nums text-ink-500">
                      {formatNumber(violation.actual_value)} / batas {formatNumber(violation.limit_value)}{' '}
                      {violation.unit}
                    </p>
                    <p className="flex flex-wrap items-center gap-1.5 font-mono text-[11.5px] text-ink-400">
                      <span
                        className={`rounded-full px-2 py-0.5 font-satoshi text-[11px] font-extrabold ${
                          violation.rule_origin === 'CLIENT'
                            ? 'bg-accent-soft text-accent-ink'
                            : 'bg-ink-100 text-ink-700'
                        }`}
                      >
                        {violation.rule_origin === 'CLIENT' ? 'Perusahaan' : 'Pusat'}
                      </span>
                      {violation.legal_citation}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 border-t border-ink-100 pt-3 text-[14px] text-ink-600">
                Muatan sesuai batas. Surat jalan dapat dicetak.
              </p>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
