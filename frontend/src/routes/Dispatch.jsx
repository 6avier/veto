import { useEffect, useState } from 'react'

import { ApiError, listRules, validateDispatch } from '@/api'
import DispatchForm from '@/components/dispatch/DispatchForm'
import VerdictPanel from '@/components/dispatch/VerdictPanel'
import ViolationDialog from '@/components/dispatch/ViolationDialog'
import { axleCountFor } from '@/lib/format'
import { limitsFromRules } from '@/lib/limits'

/**
 * /dispatch — the client's dispatch screen, with VETO intervening inline.
 *
 * PRODUCT.md F2. A HOLD announces itself in a dialog, then settles into the
 * side panel while each violation stays pinned under the field that caused it.
 * The gate is real: Cetak Surat Jalan stays locked until the engine returns
 * PASS, and editing any figure re-locks it, because a verdict about numbers
 * that have since changed is not a verdict.
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

/** Which form field each violation belongs under. PRODUCT.md F2. */
const FIELD_FOR_DIMENSION = {
  GROSS_WEIGHT: 'grossWeight',
  DIMENSION_LENGTH: 'length',
  DIMENSION_WIDTH: 'width',
  DIMENSION_HEIGHT: 'height',
}

function violationsByField(decision) {
  if (decision?.outcome !== 'HOLD') return {}
  return decision.violations.reduce((map, violation) => {
    const key =
      violation.dimension === 'AXLE_LOAD'
        ? `axle${violation.axle_index}`
        : FIELD_FOR_DIMENSION[violation.dimension]
    if (key) map[key] = violation
    return map
  }, {})
}

function validate(form) {
  const errors = {}
  if (!form.dispatchRef.trim()) errors.dispatchRef = 'Nomor surat jalan wajib diisi.'

  // Zero is not a dispatch. An empty trailer is not a shipment, and a load with
  // no height is not a load, so every numeric field must be a positive integer.
  const positive = (raw) =>
    raw !== '' && Number.isInteger(Number(raw)) && Number(raw) > 0
  const REQUIRED = 'Isi bilangan bulat lebih dari nol.'

  if (!positive(form.grossWeight)) errors.grossWeight = REQUIRED
  if (!positive(form.tareWeight)) errors.tareWeight = REQUIRED
  for (const key of ['length', 'width', 'height']) {
    if (!positive(form[key])) errors[key] = REQUIRED
  }

  const expected = axleCountFor(form.axleConfig)
  if (form.axleLoads.length !== expected) {
    errors.axle0 = `Konfigurasi ${form.axleConfig} butuh ${expected} nilai sumbu.`
  }
  form.axleLoads.forEach((load, index) => {
    if (!positive(load)) errors[`axle${index}`] = REQUIRED
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
  const [dialogOpen, setDialogOpen] = useState(false)
  const [limits, setLimits] = useState({})

  // The form reads its ceilings from the active rule base rather than
  // hardcoding them, so a change to the seeded pack shows up here unedited.
  // A failure is silent: limits are an aid, and the engine is the authority.
  useEffect(() => {
    let cancelled = false
    listRules({ origin: 'CENTRAL' })
      .then((data) => !cancelled && setLimits(limitsFromRules(data.results)))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const passed = decision?.outcome === 'PASS'
  const fieldViolations = violationsByField(decision)

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
      const result = await validateDispatch(toPayload(form))
      setDecision(result)
      if (result.outcome === 'HOLD') setDialogOpen(true)
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
          <h1 className="text-h1 font-bold tracking-[-0.02em] text-[#1f2933]">Buat Surat Jalan</h1>
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
          violations={fieldViolations}
          limits={limits}
        />

        <VerdictPanel
          decision={decision}
          error={error}
          pending={pending}
          settled={Boolean(decision) && !dialogOpen}
        />
      </div>

      <p className="mt-4 max-w-[65ch] text-label text-[#6b757f]">
        VETO memeriksa angka yang dideklarasikan pada surat jalan, bukan hasil timbangan.
        Data masukan yang keliru tetap dapat lolos.
      </p>

      {dialogOpen && (
        <ViolationDialog decision={decision} onClose={() => setDialogOpen(false)} />
      )}
    </div>
  )
}
