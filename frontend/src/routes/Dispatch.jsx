import { useEffect, useState } from 'react'
import { PrinterIcon } from '@phosphor-icons/react'

import { ApiError, listRules, validateDispatch } from '@/api'
import DispatchForm from '@/components/dispatch/DispatchForm'
import TruckLoad from '@/components/dispatch/TruckLoad'
import ViolationDialog from '@/components/dispatch/ViolationDialog'
import PassDialog from '@/components/dispatch/PassDialog'
import WaybillDialog from '@/components/dispatch/WaybillDialog'
import PrintableWaybill from '@/components/dispatch/PrintableWaybill'
import VisionScanner from '@/components/dispatch/VisionScanner'
import { axleCountFor, formatNumber } from '@/lib/format'
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

/**
 * Today's date, so a slip never opens showing a stale one at the booth. The
 * sequence starts at the minute of the day, so a reload for the next visitor
 * does not reissue a number the audit trail already holds.
 */
function todayDispatchRef() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const seq = String(now.getHours() * 60 + now.getMinutes() + 1).padStart(4, '0')
  return `DO-${now.getFullYear()}-${month}-${day}-${seq}`
}

/** The next slip's number: the trailing sequence plus one. */
function nextDispatchRef(ref) {
  const match = ref.match(/^(.*?)(\d+)$/)
  if (!match) return todayDispatchRef()
  return match[1] + String(Number(match[2]) + 1).padStart(match[2].length, '0')
}

/**
 * Only the document number is pre-filled. Every figure starts empty so the
 * numbers on screen are the ones the operator just typed — a form that opens
 * already holding a weight reads as a rigged demo, and it hides the one thing
 * worth watching: the verdict changing because the input changed.
 *
 * `axleConfig` keeps a value because it is a select, and because
 * `axleLoads.length` has to match `axleCountFor(axleConfig)` for validate() to
 * agree with the form it is checking.
 */
const DEFAULTS = {
  dispatchRef: todayDispatchRef(),
  axleConfig: '1.2',
  tareWeight: '',
  grossWeight: '',
  axleLoads: ['', ''],
  length: '',
  width: '',
  height: '',
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

  // grossWeight is not checked here. It is the sum of the axle loads and no
  // longer typed, so a positive axle set makes it positive by construction —
  // and a "wajib diisi" message under a field the operator cannot type into
  // reads as a broken form rather than an instruction. The axle errors carry it.
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
  const [passOpen, setPassOpen] = useState(false)
  const [waybillOpen, setWaybillOpen] = useState(false)
  // Whether Kembali should hand the operator back to the verdict they came
  // from, or simply close. The waybill has two entrances and the word has to
  // mean the same thing at both.
  const [waybillFromPass, setWaybillFromPass] = useState(false)
  const [rules, setRules] = useState([])
  // A logged override releases the slip for this one decision.
  const [override, setOverride] = useState(null)

  // The form reads its ceilings from the active rule base rather than
  // hardcoding them, so a change to the seeded pack shows up here unedited.
  // A failure is silent: limits are an aid, and the engine is the authority.
  useEffect(() => {
    let cancelled = false
    listRules()
      .then((data) => !cancelled && setRules(data.results))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const limits = limitsFromRules(rules, form.axleConfig)

  const passed = decision?.outcome === 'PASS'
  const released = passed || Boolean(override)
  const fieldViolations = violationsByField(decision)

  // Editing invalidates the verdict. Otherwise the gate could be opened by a
  // PASS for figures that are no longer on screen.
  // Once a slip is released it is done, so the next edit starts a new slip
  // with its own number. A HOLD keeps its number while the load is fixed,
  // which is how the audit trail shows a HOLD and its later PASS as one slip.
  const handleChange = (next) => {
    const fresh = released && next.dispatchRef === form.dispatchRef
    setForm(fresh ? { ...next, dispatchRef: nextDispatchRef(form.dispatchRef) } : next)
    setOverride(null)
    if (decision) setDecision(null)
    if (error) setError(null)
    // A verdict dialog must not outlive the verdict that opened it.
    setPassOpen(false)
    setWaybillOpen(false)
  }

  // The camera writes into the form the same way typing does, so it carries
  // the same consequence: any verdict on the old figures is withdrawn. A
  // functional update, because the scanner calls this from its own loop and
  // must not overwrite a field the operator typed a moment earlier.
  const applyDetection = (patch) => {
    setForm((current) => ({
      ...current,
      ...patch,
      ...(released && { dispatchRef: nextDispatchRef(current.dispatchRef) }),
    }))
    setDecision(null)
    setOverride(null)
    setError(null)
    setPassOpen(false)
    setWaybillOpen(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setPending(true)
    setError(null)
    setDecision(null)
    setOverride(null)
    try {
      const result = await validateDispatch(toPayload(form))
      setDecision(result)
      // Both verdicts announce themselves the same way. The PASS gate sits far
      // enough from the submit button that a background swap on it was not a
      // signal anyone reliably saw.
      if (result.outcome === 'HOLD') setDialogOpen(true)
      else setPassOpen(true)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : ApiError.from(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
    <div className="mx-auto max-w-[1400px] px-4 pt-5 pb-28 print:hidden">
      <header className="mb-[18px] flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <p className="flex items-center gap-1.5 text-[13px] text-[#5b6676]">
            Gudang Cikarang 01 <span aria-hidden>›</span> Pengiriman <span aria-hidden>›</span> Surat Jalan
          </p>
          <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-[-0.02em] text-[#111827]">
            Buat Surat Jalan
          </h1>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <span className="flex items-center gap-2 text-[12.5px] text-[#5b6676]">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-[#e7f0fc] text-[12px] font-bold text-[#165bb4]">
              BS
            </span>
            <span>
              <b className="font-semibold text-[#111827]">Budi Santoso</b> · Petugas Dispatch
            </span>
          </span>
          {decision && (
            // The verdict stays in view after its dialog closes, and reopens it.
            <button
              type="button"
              key={`${decision.decision_id}-${override ? 'o' : ''}`}
              onClick={() => (passed ? setPassOpen(true) : setDialogOpen(true))}
              className={[
                'veto-chip-in rounded-[10px] border px-3 py-1.5 text-[12.5px] font-bold transition-transform motion-safe:enabled:active:scale-[0.96]',
                passed
                  ? 'border-transparent bg-[#e6f4ea] text-[#11692f]'
                  : 'border-hold bg-[#fdf2df] text-hold-ink',
              ].join(' ')}
            >
              {passed ? 'LOLOS' : override ? 'DITAHAN, di-override' : 'DITAHAN'}
            </button>
          )}
          <span className="rounded-lg border border-[#e2e7ee] bg-white px-2.5 py-1.5 font-mono text-[12px] text-[#5b6676]">
            {form.dispatchRef || 'DO-…'}
          </span>
          {/* The way back in, once the PASS dialog has been dismissed. */}
          <button
            type="button"
            disabled={!released}
            onClick={() => {
              setWaybillFromPass(false)
              setWaybillOpen(true)
            }}
            title={released ? undefined : 'Terbuka setelah VETO meloloskan muatan'}
            className={[
              'inline-flex h-10 items-center gap-2 rounded-[10px] border px-4 text-[14px] font-semibold transition-[background-color,transform] motion-safe:enabled:active:scale-[0.96]',
              released
                ? 'border-[#1f74e0] bg-[#1f74e0] text-white hover:bg-[#165bb4]'
                : 'cursor-not-allowed border-[#cdd5e0] bg-white text-[#111827] opacity-45',
            ].join(' ')}
          >
            <PrinterIcon size={16} aria-hidden />
            Cetak Surat Jalan
          </button>
        </div>
      </header>

      {/* Cameras on the left, the declared load on the right: what the dock
          sees beside what the slip says. */}
      <div className="mb-4">
        <VisionScanner
          form={form}
          limits={limits}
          onApply={applyDetection}
          aside={(seen) => <DeclaredLoad form={form} limits={limits} decision={decision} seen={seen} />}
        />
      </div>

      {/* The verdict itself lives in the header chip and its dialogs; this is
          only for a request that never got one. */}
      {error && (
        <div role="alert" className="mb-4 rounded-2xl border border-[#f2a93b] bg-[#fdf2df] px-4 py-3">
          <p className="text-[14px] font-bold text-[#8a5200]">VETO tidak dapat dihubungi</p>
          <p className="mt-0.5 text-[13px] text-[#8a5200]">{error.message}</p>
        </div>
      )}

      <DispatchForm
        value={form}
        onChange={handleChange}
        onSubmit={handleSubmit}
        pending={pending}
        errors={errors}
        violations={fieldViolations}
        limits={limits}
      />

      <p className="mt-3 max-w-[65ch] px-1 text-[12.5px] text-[#5b6676]">
        VETO memeriksa angka yang dideklarasikan pada surat jalan, bukan hasil timbangan.
        Data masukan yang keliru tetap dapat lolos.
      </p>

      {/*
        One dialog at a time. Stacking two would mean two scrims, two focus
        traps and two Escape handlers competing, so moving between them is a
        swap rather than a push.
      */}
      {dialogOpen && (
        <ViolationDialog
          decision={decision}
          onClose={() => setDialogOpen(false)}
          onOverridden={(result) => {
            setOverride(result)
            setDialogOpen(false)
          }}
        />
      )}

      {passOpen && passed && !waybillOpen && (
        <PassDialog
          decision={decision}
          form={form}
          limits={limits}
          onClose={() => setPassOpen(false)}
          onPrint={() => {
            setWaybillFromPass(true)
            setWaybillOpen(true)
          }}
        />
      )}

      {waybillOpen && released && (
        <WaybillDialog
          form={form}
          // Kembali, Escape and the backdrop all do the same thing, because
          // three ways out that land in different places is how a dialog
          // starts feeling untrustworthy.
          onClose={() => {
            setWaybillOpen(false)
            setPassOpen(waybillFromPass)
            setWaybillFromPass(false)
          }}
        />
      )}
    </div>
    {/*
      Gated on the verdict, not just on the button. Disabling the button locks
      the click; it does not lock Cmd/Ctrl+P, and without this condition the
      browser's own print shortcut renders a valid-looking surat jalan for a
      load VETO just held — the exact thing the gate exists to prevent.
    */}
    {released && (
      <div className="hidden print:block">
        <PrintableWaybill form={form} />
      </div>
    )}
    </>
  )
}

/**
 * The declared load against the configuration's JBI, as a figure and on the
 * truck. Neutral until VETO answers; the truck draws VETO's marks only for the
 * limits a HOLD names. `seen` is CAM-01's current class: the drawing follows
 * it, but the figures stay the declared ones, because the camera classifies
 * and does not weigh.
 */
function DeclaredLoad({ form, limits, decision, seen }) {
  const gross = Number(form.grossWeight) || 0
  const capacity = limits.grossWeight?.threshold
  const pct = capacity ? Math.round((gross / capacity) * 100) : null
  const grossHeld = decision?.outcome === 'HOLD' && decision.violations.some((v) => v.dimension === 'GROSS_WEIGHT')
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-[#e2e7ee] bg-white shadow-[0_1px_2px_rgba(17,24,39,0.04),0_8px_24px_-12px_rgba(17,24,39,0.12)]">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 pt-4">
        <div>
          <h2 className="text-[15px] font-bold tracking-[-0.01em] text-[#111827]">Muatan yang dideklarasikan</h2>
          <p className="mt-0.5 text-[12px] text-[#5b6676]">Konfigurasi {form.axleConfig}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span
            className={`text-[44px] font-extrabold leading-none tracking-[-0.04em] tabular-nums ${grossHeld ? 'text-[#8a5200]' : 'text-[#1f74e0]'}`}
          >
            {pct ?? '-'}
            <small className="ml-1 text-[18px] font-bold tracking-normal text-[#5b6676]">%</small>
          </span>
          <span className="text-[12.5px] leading-snug text-[#5b6676]">
            dari JBI
            <br />
            <b className="tabular-nums text-[#111827]">
              {formatNumber(gross)} / {capacity ? formatNumber(capacity) : '-'} kg
            </b>
          </span>
        </div>
      </div>
      <div className="flex flex-1 items-end px-2 pb-1 pt-2">
        <TruckLoad
          axleConfig={form.axleConfig}
          axleLoads={form.axleLoads}
          grossWeight={form.grossWeight}
          height={form.height}
          limits={limits}
          decision={decision}
          seen={seen}
        />
      </div>
    </section>
  )
}
