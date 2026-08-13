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
export default function VerdictPanel({ decision, error, pending, settled }) {
  const held = decision?.outcome === 'HOLD'

  return (
    <aside
      className={[
        'border border-ink-200 bg-white font-sans lg:sticky lg:top-4',
        settled ? 'veto-settle' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 border-b border-ink-200 px-4 py-2">
        {/* The mark is the one thing in this panel that belongs to VETO rather
            than to the host, so it sits at the head of the panel where the
            handover from ERP to VETO happens. DESIGN.md §8 records why the
            brand blue is allowed to sit this close to the amber HOLD marker. */}
        <VetoMark className="h-3 w-auto" />
        <span className="font-mono text-mono-xs tracking-[0.14em] text-ink-400">VETO</span>
        {pending && <span className="font-mono text-mono-xs text-ink-500">memeriksa…</span>}
      </div>

      <div className="px-4 py-4">
        {!decision && !error && !pending && (
          <p className="text-label text-ink-400">
            Belum ada pemeriksaan. Isi data muatan lalu jalankan validasi.
          </p>
        )}

        {error && (
          <div>
            <p className="font-mono text-mono-xs text-hold-ink">{error.code}</p>
            <p className="mt-1 text-body text-ink-900">{error.message}</p>
          </div>
        )}

        {decision && (
          <div>
            {/* Both verdicts carry a marker and neither is written in colour.
                Green for PASS reverses DESIGN.md §4 knowingly — recorded there
                and in the dispatch flow spec, along with what it costs. */}
            <div className="flex items-baseline gap-2.5">
              <span
                aria-hidden
                className={`h-3 w-3 shrink-0 self-center ${held ? 'bg-hold' : 'bg-pass'}`}
              />
              <p className="text-display text-ink-900">{held ? 'TAHAN' : 'LOLOS'}</p>
            </div>
            <p className="mt-1 font-mono text-mono-xs text-ink-400">
              {decision.dispatch_ref} · {formatNumber(decision.latency_ms)} ms
            </p>

            {held ? (
              <ul className="mt-4 space-y-3 border-t border-ink-100 pt-3">
                {decision.violations.map((violation, index) => (
                  <li key={index}>
                    <p className="text-body text-ink-900">{violation.directive}</p>
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
              <p className="mt-3 border-t border-ink-100 pt-3 text-label text-ink-500">
                Muatan sesuai batas. Surat jalan dapat dicetak.
              </p>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
