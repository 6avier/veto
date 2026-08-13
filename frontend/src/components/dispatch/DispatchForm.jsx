import { axleCountFor, formatKg, formatNumber, formatTonnes } from '@/lib/format'
import { deltaFromLimit } from '@/lib/limits'

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
      className="divide-y divide-[#c9ced4] border border-[#c9ced4] bg-white"
    >
      <Section title="1. Identifikasi Kendaraan">
        <Field label="Nomor Surat Jalan" error={errors.dispatchRef}>
          <TextInput
            value={value.dispatchRef}
            onChange={(e) => set({ dispatchRef: e.target.value })}
            className="font-mono"
          />
        </Field>
        <Field label="Konfigurasi Sumbu">
          <select
            value={value.axleConfig}
            onChange={(e) => setAxleConfig(e.target.value)}
            className={`${inputClass} appearance-none`}
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

      <Section title="2. Data Muatan">
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
          limit={limits.grossWeight}
          current={value.grossWeight}
          note="Dihitung dari jumlah beban sumbu."
        >
          <NumberInput value={value.grossWeight} readOnly maxDigits={MAX_DIGITS.weight} />
        </Field>
        {value.axleLoads.map((load, index) => (
          <Field
            key={index}
            label={axleLabel(index, axleCount)}
            unit="kg"
            error={errors[`axle${index}`]}
            violation={violations[`axle${index}`]}
            limit={limits[`axle${index}`]}
            current={load}
          >
            <NumberInput
              value={load}
              onChange={(e) => setAxle(index, e.target.value)}
              maxDigits={MAX_DIGITS.weight}
            />
          </Field>
        ))}
      </Section>

      <Section title="3. Dimensi Muatan">
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
            limit={limits[key]}
            current={value[key]}
          >
            <NumberInput
              value={value[key]}
              onChange={(e) => set({ [key]: e.target.value })}
              maxDigits={MAX_DIGITS.dimension}
            />
          </Field>
        ))}
      </Section>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-[#f4f6f7] px-[18px] py-3.5">
        <p className="text-label text-[#5a646e]">
          Total beban sumbu{' '}
          <span className="tnum text-data font-medium text-[#1f2933]">{formatKg(axleSum)}</span>
          <span className="text-[#8b949d]"> · {formatTonnes(axleSum)}</span>
        </p>
        {balanceWarning && (
          <p className="text-label text-[#8a5200]">
            Peringatan Keseimbangan: {balanceWarning}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="ml-auto rounded-veto bg-[#2d613b] px-4 py-2 text-label text-white transition-colors hover:bg-[#244f30] focus-visible:outline-offset-2 disabled:opacity-50"
        >
          {pending ? 'Memvalidasi…' : 'Validasi ke VETO'}
        </button>
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
function Section({ title, children }) {
  const id = `sec-${title.replace(/[^a-zA-Z]+/g, '-').toLowerCase()}`
  return (
    <fieldset aria-labelledby={id} className="px-[18px] pt-5 pb-[18px]">
      <p id={id} className="mb-3 text-label font-semibold text-[#1f2933]">
        {title}
      </p>
      <div className="grid gap-x-6 gap-y-[18px] sm:grid-cols-2 lg:grid-cols-3">{children}</div>
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
function Field({ label, unit, error, violation, limit, current, note, children }) {
  const gap = deltaFromLimit(current, limit)

  return (
    <label className="flex flex-col gap-1">
      <span className="text-label text-[#4a545e]">
        {label}
        {unit && <span className="text-[#98a0a9]"> ({unit})</span>}
      </span>

      <span className={violation ? 'block rounded-veto ring-2 ring-[#c0392b]/30' : 'block'}>
        {children}
      </span>

      {error ? (
        <span className="text-label text-[#a02a1f]">{error}</span>
      ) : violation ? (
        <span className="text-label text-[#a02a1f]">
          {violation.directive}
          <span className="mt-0.5 block font-mono text-mono-xs text-[#8b949d]">
            {violation.legal_citation}
          </span>
        </span>
      ) : gap?.over ? (
        <span className="tnum text-label font-medium text-[#a02a1f]">
          +{formatNumber(gap.delta)} {gap.unit}
          <span className="text-[#98a0a9]"> melebihi batas</span>
        </span>
      ) : note ? (
        <span className="text-label text-[#6b757f]">{note}</span>
      ) : null}
    </label>
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
  'w-full rounded-veto border px-2.5 py-1.5 text-data transition-colors'

const inputClass = `${inputBase} border-[#a9b1b9] bg-white text-[#1f2933] hover:border-[#8b949d] focus:border-[#2d613b]`

const inputLockedClass = `${inputBase} cursor-not-allowed border-[#c9ced4] bg-[#eef1f2] text-[#4a545e]`

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
      className={`${readOnly ? inputLockedClass : inputClass} tnum ${
        readOnly ? '[&::-webkit-inner-spin-button]:appearance-none' : ''
      }`}
    />
  )
}
