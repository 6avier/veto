import { useState } from 'react'

import { ApiError, validateDispatch } from '@/api'
import DispatchForm from '@/components/dispatch/DispatchForm'
import { axleCountFor, formatNumber } from '@/lib/format'

/**
 * /dispatch — the client's dispatch screen, with VETO intervening inline.
 *
 * PRODUCT.md F2. The gate is real: "Cetak Surat Jalan" stays locked until the
 * engine returns PASS, and editing any figure re-locks it, because a verdict
 * about numbers that have since changed is not a verdict.
 *
 * The verdict panel is deliberately minimal here. F2 of the plan makes it the
 * moment that lands.
 */

const DEFAULTS = {
  dispatchRef: 'DO-2026-08-11-0043',
  axleConfig: '1.2',
  tareWeight: '8500',
  grossWeight: '22400',
  axleLoads: ['6800', '15600'],
  length: '12000',
  width: '2500',
  height: '4100',
}

function validate(form) {
  const errors = {}
  if (!form.dispatchRef.trim()) errors.dispatchRef = 'Nomor surat jalan wajib diisi.'

  const positive = (raw) => Number.isInteger(Number(raw)) && Number(raw) > 0
  if (!positive(form.grossWeight)) errors.grossWeight = 'Isi bilangan bulat lebih dari nol.'
  if (!positive(form.tareWeight)) errors.tareWeight = 'Isi bilangan bulat lebih dari nol.'

  const expected = axleCountFor(form.axleConfig)
  if (form.axleLoads.length !== expected) {
    errors.axle0 = `Konfigurasi ${form.axleConfig} butuh ${expected} nilai sumbu.`
  }
  form.axleLoads.forEach((load, index) => {
    if (!positive(load)) errors[`axle${index}`] = 'Isi bilangan bulat lebih dari nol.'
  })
  return errors
}

function toPayload(form) {
  return {
    dispatch_ref: form.dispatchRef.trim(),
    vehicle: {
      axle_config: form.axleConfig,
      tare_weight_kg: Number(form.tareWeight),
    },
    load: {
      gross_weight_kg: Number(form.grossWeight),
      axle_loads_kg: form.axleLoads.map(Number),
      dimensions_mm: {
        length: Number(form.length),
        width: Number(form.width),
        height: Number(form.height),
      },
    },
    loading_point_id: 'LP-CIKARANG-01',
  }
}

export default function Dispatch() {
  const [form, setForm] = useState(DEFAULTS)
  const [decision, setDecision] = useState(null)
  const [error, setError] = useState(null)
  const [errors, setErrors] = useState({})
  const [pending, setPending] = useState(false)

  const passed = decision?.outcome === 'PASS'

  // Editing invalidates the verdict. Otherwise the gate could be opened by a
  // PASS for figures that are no longer on screen.
  const handleChange = (next) => {
    setForm(next)
    if (decision) setDecision(null)
    if (error) setError(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setPending(true)
    setError(null)
    setDecision(null)
    try {
      setDecision(await validateDispatch(toPayload(form)))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : ApiError.from(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 text-[#1f2933]">Buat Surat Jalan</h1>
          <p className="mt-0.5 text-label text-[#5a646e]">
            Gudang Cikarang 01 · Pengiriman keluar
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!passed && (
            <p className="max-w-[22ch] text-label text-[#6b757f]">
              Surat jalan terkunci sampai VETO meloloskan muatan.
            </p>
          )}
          <button
            type="button"
            disabled={!passed}
            className={[
              'rounded-veto px-4 py-2 text-label transition-colors',
              passed
                ? 'bg-[#1f2933] text-white hover:bg-[#111820]'
                : 'cursor-not-allowed border border-[#c9ced4] bg-[#e3e7ea] text-[#98a0a9]',
            ].join(' ')}
          >
            Cetak Surat Jalan
          </button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <DispatchForm
          value={form}
          onChange={handleChange}
          onSubmit={handleSubmit}
          pending={pending}
          errors={errors}
        />

        <VerdictPanel decision={decision} error={error} pending={pending} />
      </div>

      <p className="mt-4 max-w-[65ch] text-label text-[#6b757f]">
        VETO memeriksa angka yang dideklarasikan pada surat jalan, bukan hasil timbangan.
        Data masukan yang keliru tetap dapat lolos.
      </p>
    </div>
  )
}

/**
 * VETO speaking inside someone else's software. It does not adopt the ERP's
 * styling: the graphite ground is how you can tell the two systems apart.
 */
function VerdictPanel({ decision, error, pending }) {
  return (
    <aside className="bg-ink-900 text-ink-100 lg:sticky lg:top-4">
      <div className="flex items-center gap-2 border-b border-ink-800 px-4 py-2">
        <span className="font-mono text-mono-xs tracking-[0.14em] text-ink-400">VETO</span>
        {pending && <span className="font-mono text-mono-xs text-ink-300">memeriksa…</span>}
      </div>

      <div className="px-4 py-4">
        {!decision && !error && !pending && (
          <p className="text-label text-ink-400">
            Belum ada pemeriksaan. Isi data muatan lalu jalankan validasi.
          </p>
        )}

        {error && (
          <div>
            <p className="font-mono text-mono-xs text-hold">{error.code}</p>
            <p className="mt-1 text-body on-dark text-ink-100">{error.message}</p>
          </div>
        )}

        {decision && (
          <div>
            <p
              className={[
                'text-display on-dark',
                decision.outcome === 'HOLD' ? 'text-hold' : 'text-ink-100',
              ].join(' ')}
            >
              {decision.outcome === 'HOLD' ? 'TAHAN' : 'LOLOS'}
            </p>
            <p className="mt-1 font-mono text-mono-xs text-ink-400">
              {decision.dispatch_ref} · {formatNumber(decision.latency_ms)} ms
            </p>

            <ul className="mt-4 space-y-3">
              {decision.violations.map((violation, index) => (
                <li key={index} className="border-l-2 border-hold pl-3">
                  <p className="text-body on-dark text-ink-100">{violation.directive}</p>
                  <p className="mt-1 tnum text-data on-dark text-ink-300">
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
          </div>
        )}
      </div>
    </aside>
  )
}
