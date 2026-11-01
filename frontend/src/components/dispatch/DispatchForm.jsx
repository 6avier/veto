import { ArrowRightIcon, CaretDownIcon } from '@phosphor-icons/react'

import { axleCountFor, formatKg, formatNumber, formatTonnes } from '@/lib/format'

/**
 * The dispatch entry form, inside the client's ERP.
 *
 * Controlled. The parent owns the value so input survives a HOLD and the
 * officer can correct one number and resubmit (PRODUCT.md F2).
 *
 * A field stays quiet while the value is plausible. It speaks only when the
 * value exceeds its ceiling, showing the excess as +N, so the officer sees a
 * load going out of bounds while typing rather than learning it from the
 * verdict. Ceilings themselves are not displayed; they govern what can be
 * typed and what counts as excess.
 */

/**
 * JBI axle notation, matching the values the seeded rule pack keys its
 * gross-weight limits on. A config not in the rule base silently misses its
 * JBI rule, so this list tracks the backend rather than being invented here.
 * Verify against GET /rules if the seed changes.
 */
const AXLE_CONFIGS = [
  { value: '1.1', label: '1.1 · dua sumbu, truk ringan' },
  { value: '1.2', label: '1.2 · dua sumbu, roda ganda' },
  { value: '1.2.2', label: '1.2.2 · tiga sumbu, tronton' },
  { value: '1.1-2.2', label: '1.1-2.2 · empat sumbu, truk dan gandengan' },
  { value: '1.2-2.2', label: '1.2-2.2 · empat sumbu, roda ganda dan gandengan' },
  { value: '1.2.2-2.2', label: '1.2.2-2.2 · lima sumbu' },
  { value: '1.2.2-2.2.2', label: '1.2.2-2.2.2 · enam sumbu, trailer' },
]

const AXLE_NAMES = ['Sumbu depan', 'Sumbu tengah', 'Sumbu belakang']

/**
 * How many digits a field will accept. This is a limit on magnitude, not on
 * value: six digits reaches 999.999 kg and five reaches 99.999 mm, both far
 * past anything on a road, so no plausible entry is ever refused. A value
 * ceiling would be wrong here, because the whole point of the screen is to let
 * an overloaded dispatch be entered and then caught.
 */
const MAX_DIGITS = { weight: 6, dimension: 5 }

function axleLabel(index, count) {
  if (index === 0) return AXLE_NAMES[0]
  if (index === count - 1) return AXLE_NAMES[2]
  return AXLE_NAMES[1]
}

/**
 * Known cases for the booth, on the 1.2 configuration. Plausible figures for a
 * two-axle box truck; whether each passes is the engine's call, not this list's.
 */
const SCENARIOS = [
  {
    label: 'Muatan aman',
    values: { axleConfig: '1.2', tareWeight: '5200', axleLoads: ['5000', '9000'], grossWeight: '14000', length: '8200', width: '2400', height: '3900' },
  },
  {
    label: 'Overload sumbu',
    values: { axleConfig: '1.2', tareWeight: '5200', axleLoads: ['5600', '10400'], grossWeight: '16000', length: '8200', width: '2400', height: '3900' },
  },
  {
    label: 'Terlalu tinggi',
    values: { axleConfig: '1.2', tareWeight: '5200', axleLoads: ['5000', '9000'], grossWeight: '14000', length: '8200', width: '2400', height: '4400' },
  },
]

export default function DispatchForm({
  value,
  onChange,
  onSubmit,
  pending,
  errors = {},
  violations = {},
  limits = {},
}) {
  const axleCount = axleCountFor(value.axleConfig)

  const set = (patch) => onChange({ ...value, ...patch })

  const setAxleConfig = (axleConfig) => {
    const count = axleCountFor(axleConfig)
    const newAxles = Array.from({ length: count }, (_, i) => value.axleLoads[i] ?? '')
    const newAxleSum = newAxles.reduce((total, load) => total + (Number(load) || 0), 0)
    set({
      axleConfig,
      axleLoads: newAxles,
      grossWeight: newAxleSum > 0 ? String(newAxleSum) : value.grossWeight
    })
  }

  const setAxle = (index, next) => {
    const axles = [...value.axleLoads]
    axles[index] = next
    const newAxleSum = axles.reduce((total, load) => total + (Number(load) || 0), 0)
    set({ 
      axleLoads: axles,
      grossWeight: newAxleSum > 0 ? String(newAxleSum) : value.grossWeight
    })
  }

  const axleSum = value.axleLoads.reduce((total, load) => total + (Number(load) || 0), 0)
  // By load, not by closeness to a limit, so the answer does not change when
  // a verdict arrives.
  const heaviest = value.axleLoads
    .map((load, index) => ({ index, kg: Number(load) || 0 }))
    .reduce((top, axle) => (axle.kg > (top?.kg ?? 0) ? axle : top), null)
  const gross = Number(value.grossWeight) || 0

  // Balance Check (Proportional Distribution)
  let balanceWarning = null
  if (gross > 0 && value.axleLoads.length > 1) {
    const count = value.axleLoads.length
    const axleLimits = []
    let totalLimit = 0
    let hasAllLimits = true
    for (let i = 0; i < count; i++) {
      const limitObj = limits[`axle${i}`] || limits['axle_generic']
      if (limitObj && limitObj.threshold) {
        axleLimits.push(limitObj.threshold)
        totalLimit += limitObj.threshold
      } else {
        hasAllLimits = false
        break
      }
    }
    
    if (hasAllLimits && totalLimit > 0) {
      let maxDeviation = 0
      let unbalancedAxle = -1
      
      for (let i = 0; i < count; i++) {
        const ratio = axleLimits[i] / totalLimit
        const ideal = gross * ratio
        const actual = Number(value.axleLoads[i]) || 0
        const deviation = actual - ideal
        
        // Threshold: 1500 kg deviation from ideal proportion
        if (deviation > 1500 && deviation > maxDeviation) {
          maxDeviation = deviation
          unbalancedAxle = i
        }
      }
      
      if (unbalancedAxle !== -1) {
        const subject = unbalancedAxle === 0 ? "depan" : (unbalancedAxle === count - 1 ? "belakang" : "tengah")
        const shiftTo = unbalancedAxle === 0 ? "belakang" : "depan"
        balanceWarning = `Muatan terlalu berat di ${subject}. Pertimbangkan menggeser muatan sekitar ${formatKg(Math.round(maxDeviation))} ke sumbu ${shiftTo} agar lebih seimbang.`
      }
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      // Our own validation owns this form. Without noValidate the browser's
      // constraint check (min/max on the number inputs) blocks submission
      // before onSubmit fires, so the button goes dead and no message renders.
      // min/max stay for the steppers and for clamping.
      noValidate
      className="rounded-2xl border border-[#e2e7ee] bg-white shadow-[0_1px_2px_rgba(17,24,39,0.04),0_8px_24px_-12px_rgba(17,24,39,0.12)]"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-[18px] pt-4">
        <h2 className="text-[16px] font-bold text-[#111827]">Data muatan</h2>
        {/* One tap to a known case, for whoever walks up to the booth. Each
            fills the form the same way typing does; nothing is submitted. */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] text-[#5b6676]">Coba skenario:</span>
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.label}
              type="button"
              onClick={() => onChange({ ...value, ...scenario.values })}
              className="h-8 rounded-full border border-[#cdd5e0] bg-white px-3 text-[12.5px] font-semibold text-[#111827] transition-[background-color,transform] hover:bg-[#f7f9fc] active:scale-[.97]"
            >
              {scenario.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1fr)] lg:divide-x lg:divide-[#eef1f5]">
      <Section n={1} title="Kendaraan" cols="grid-cols-1">
        <Field label="Nomor Surat Jalan" error={errors.dispatchRef}>
          <TextInput
            value={value.dispatchRef}
            onChange={(e) => set({ dispatchRef: e.target.value })}
            className="font-mono"
          />
        </Field>
        <Field label="Konfigurasi Sumbu" unit={<CaretDownIcon size={14} weight="bold" aria-hidden />}>
          <select
            value={value.axleConfig}
            onChange={(e) => setAxleConfig(e.target.value)}
            className={`${inputClass} cursor-pointer appearance-none`}
          >
            {AXLE_CONFIGS.map((config) => (
              <option key={config.value} value={config.value}>
                {config.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Berat Kosong" unit="kg" error={errors.tareWeight}>
          <NumberInput
            value={value.tareWeight}
            onChange={(e) => set({ tareWeight: e.target.value })}
            maxDigits={MAX_DIGITS.weight}
          />
        </Field>
      </Section>

      <Section n={2} title="Berat per sumbu" cols="grid-cols-2 sm:grid-cols-3">
        {value.axleLoads.map((load, index) => (
          <Field
            key={index}
            label={axleLabel(index, axleCount)}
            unit="kg"
            error={errors[`axle${index}`]}
            violation={violations[`axle${index}`]}
          >
            <NumberInput
              value={load}
              onChange={(e) => setAxle(index, e.target.value)}
              maxDigits={MAX_DIGITS.weight}
              aria-invalid={Boolean(errors[`axle${index}`] || violations[`axle${index}`])}
            />
          </Field>
        ))}
        {/*
          Derived, not typed. A vehicle's gross weight *is* what its axles
          carry, so the field reports the axle sum instead of inviting a second,
          contradictable version of the same number. It stays an <input> rather
          than becoming text so the form's rhythm and the violation and excess
          affordances it already carries keep working.
        */}
        <Field
          label="Berat Kotor"
          unit="kg"
          error={errors.grossWeight}
          violation={violations.grossWeight}
          note="Jumlah beban sumbu."
        >
          <NumberInput
            value={value.grossWeight}
            readOnly
            maxDigits={MAX_DIGITS.weight}
            aria-invalid={Boolean(errors.grossWeight || violations.grossWeight)}
          />
        </Field>
      </Section>

      <Section n={3} title="Dimensi" cols="grid-cols-2 sm:grid-cols-3">
        {[
          ['Panjang', 'length'],
          ['Lebar', 'width'],
          ['Tinggi', 'height'],
        ].map(([label, key]) => (
          <Field
            key={key}
            label={label}
            unit="mm"
            error={errors[key]}
            violation={violations[key]}
          >
            <NumberInput
              value={value[key]}
              onChange={(e) => set({ [key]: e.target.value })}
              maxDigits={MAX_DIGITS.dimension}
              aria-invalid={Boolean(errors[key] || violations[key])}
            />
          </Field>
        ))}
      </Section>

      </div>

      {balanceWarning && (
        <p className="mx-[18px] mb-4 rounded-[10px] bg-[#fdf2df] px-3 py-2 text-[13px] text-[#8a5200]">
          Peringatan keseimbangan: {balanceWarning}
        </p>
      )}

      {/* The check bar stays on screen, so the one action that matters is
          always one tap away while the officer reads the truck above. */}
      <div className="fixed inset-x-0 bottom-0 z-20 sm:left-20 border-t border-[#e2e7ee] bg-white/90 px-4 py-3 backdrop-blur-md print:hidden">
        <div className="mx-auto grid max-w-[1400px] grid-cols-3 items-center gap-x-4 gap-y-2.5 sm:flex sm:flex-wrap sm:gap-x-8">
          <Readout
            label="Berat kotor"
            value={formatKg(axleSum)}
            hint={formatTonnes(axleSum)}
            share={axleSum && limits.grossWeight?.threshold ? axleSum / limits.grossWeight.threshold : 0}
          />
          <Readout
            label="Sumbu terberat"
            value={heaviest ? `Sumbu ${heaviest.index + 1}, ${formatTonnes(heaviest.kg)}` : '-'}
            share={heaviest ? heaviest.kg / ((limits[`axle${heaviest.index}`] || limits.axle_generic)?.threshold || Infinity) : 0}
          />
          <Readout
            label="Tinggi"
            value={value.height ? `${formatNumber(value.height)} mm` : '-'}
            share={value.height && limits.height?.threshold ? Number(value.height) / limits.height.threshold : 0}
          />
          <button
            type="submit"
            disabled={pending}
            className="col-span-3 inline-flex min-h-[46px] items-center justify-center gap-2 sm:ml-auto rounded-xl bg-[#1f74e0] px-6 text-[15px] font-bold text-white shadow-[0_8px_18px_-10px_rgba(31,116,224,0.9)] transition-[background-color,transform] hover:bg-[#165bb4] active:scale-[.97] disabled:opacity-50"
          >
            {pending ? 'Mengirim ke VETO…' : 'Validasi ke VETO'}
            <ArrowRightIcon size={16} weight="bold" aria-hidden />
          </button>
        </div>
      </div>
    </form>
  )
}

/**
 * Section spacing follows the craft floor: more room above a heading than
 * below it, so the title belongs to the group it introduces rather than
 * colliding with the rule above. 20 above, 12 below, 18 to the closing edge.
 *
 * The title is a plain element, not a <legend>. A legend is lifted out of flow
 * and painted on the fieldset's top border, so padding-top cannot move it and
 * it sits welded to the divider no matter what the value is. The grouping stays
 * accessible through aria-labelledby.
 */
function Section({ n, title, cols, children }) {
  const id = `sec-${title.replace(/[^a-zA-Z]+/g, '-').toLowerCase()}`
  return (
    <fieldset aria-labelledby={id} className="min-w-0 border-b border-[#eef1f5] px-[18px] pb-[18px] pt-4 lg:border-b-0">
      <p id={id} className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#687385]">
        <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full border border-[#cdd5e0] text-[11px] tracking-normal">
          {n}
        </span>
        {title}
      </p>
      <div className={`grid gap-x-3 gap-y-4 ${cols}`}>{children}</div>
    </fieldset>
  )
}

/**
 * Label, input, then at most one line beneath it: a validation error, or the
 * violation directive pinned to the field that caused it (PRODUCT.md F2), or
 * the excess over the ceiling, or a standing note. Nothing when the value is
 * fine and there is nothing to explain.
 *
 * The note sits last because it is the only one of the four that is never news.
 */
function Field({ label, unit, error, violation, note, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold text-[#111827]">{label}</span>

      <span className="relative block">
        {children}
        {unit && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-[#687385]">
            {unit}
          </span>
        )}
      </span>

      {error ? (
        <span className="text-[12.5px] font-semibold text-[#a02a1f]">{error}</span>
      ) : violation ? (
        <span className="text-[12.5px] font-bold text-[#8a5200]">
          Lebih {formatNumber(violation.excess_value)} {violation.unit} dari batas{' '}
          {formatNumber(violation.limit_value)} {violation.unit}
          <span className="mt-0.5 block font-mono text-[11.5px] font-normal text-[#687385]">
            {violation.legal_citation}
          </span>
        </span>
      ) : note ? (
        <span className="text-[12px] text-[#687385]">{note}</span>
      ) : null}
    </label>
  )
}

/** A figure and how much of its limit it uses. The bar is a guide; the
    engine's verdict is the answer. */
function Readout({ label, value, hint, share = 0 }) {
  const over = share > 1
  return (
    <div className="min-w-0 sm:min-w-[150px]">
      <div className="text-[12px] text-[#5b6676]">{label}</div>
      <div className="truncate text-[13px] font-bold tabular-nums text-[#111827] sm:text-[14px]">
        {value}
        {hint && <span className="ml-1 hidden font-medium text-[#687385] sm:inline">{hint}</span>}
      </div>
      <div aria-hidden className="mt-1 h-1 overflow-hidden rounded-full bg-[#eef1f5]">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${over ? 'bg-[#f2a93b]' : 'bg-[#1f74e0]'}`}
          style={{ width: `${Math.min(share, 1) * 100}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Two complete strings rather than a base plus overrides. Tailwind resolves
 * competing utilities by their order in the generated stylesheet, not by their
 * order in the class attribute, so appending `bg-[#eef1f2]` after `bg-white`
 * silently lost — the locked field rendered white and looked editable. Whole
 * strings cannot conflict with each other.
 */
const inputBase =
  'h-10 w-full rounded-[10px] border px-3 pr-10 text-[16px] font-semibold transition-[border-color,box-shadow] sm:text-[14px]'

const inputClass = `${inputBase} border-[#cdd5e0] bg-white text-[#111827] hover:border-[#8a95a5] focus:border-[#1f74e0] focus:outline-none focus:ring-[3px] focus:ring-[#e7f0fc] aria-[invalid=true]:border-[#f2a93b] aria-[invalid=true]:ring-[3px] aria-[invalid=true]:ring-[#fdf2df]`

const inputLockedClass = `${inputBase} cursor-not-allowed border-[#e2e7ee] bg-[#f7f9fc] text-[#5b6676] aria-[invalid=true]:border-[#f2a93b]`

function TextInput({ className = '', ...props }) {
  return <input type="text" {...props} className={`${inputClass} ${className}`} />
}

function NumberInput({ onChange, maxDigits, readOnly, ...props }) {
  const limitDigits = (event) => {
    const raw = event.target.value
    // type=number ignores maxLength, so the digit cap is enforced here. An
    // empty field is allowed through so the input can be cleared while editing.
    if (raw !== '' && maxDigits && raw.replace(/\D/g, '').length > maxDigits) return
    onChange(event)
  }
  return (
    <input
      type="number"
      inputMode="numeric"
      min="1"
      step="1"
      readOnly={readOnly}
      // readOnly, not disabled: a disabled field is skipped by Tab and ignored
      // by screen readers, and this one carries a figure the operator needs to
      // read. The steppers go with it, since there is nothing to step.
      onChange={readOnly ? undefined : limitDigits}
      {...props}
      // Steppers are hidden everywhere: the unit sits where they would be.
      className={`${readOnly ? inputLockedClass : inputClass} tnum [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
    />
  )
}
