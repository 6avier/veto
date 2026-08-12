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

const AXLE_CONFIGS = [
  { value: '1.1', label: '1.1 · dua sumbu, truk ringan' },
  { value: '1.2', label: '1.2 · dua sumbu, roda ganda' },
  { value: '1.22', label: '1.22 · tiga sumbu, tronton' },
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
    set({
      axleConfig,
      axleLoads: Array.from({ length: count }, (_, i) => value.axleLoads[i] ?? ''),
    })
  }

  const setAxle = (index, next) => {
    const axles = [...value.axleLoads]
    axles[index] = next
    set({ axleLoads: axles })
  }

  const axleSum = value.axleLoads.reduce((total, load) => total + (Number(load) || 0), 0)
  const gross = Number(value.grossWeight) || 0
  const mismatch = gross > 0 && axleSum > 0 && Math.abs(axleSum - gross) > 500

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
        <Field
          label="Berat Kotor"
          unit="kg"
          error={errors.grossWeight}
          violation={violations.grossWeight}
          limit={limits.grossWeight}
          current={value.grossWeight}
        >
          <NumberInput
            value={value.grossWeight}
            onChange={(e) => set({ grossWeight: e.target.value })}
            maxDigits={MAX_DIGITS.weight}
          />
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
        {mismatch && (
          <p className="text-label text-[#8a5200]">
            Selisih {formatKg(Math.abs(axleSum - gross))} dari berat kotor. Periksa kembali.
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
 * the excess over the ceiling. Nothing when the value is fine.
 */
function Field({ label, unit, error, violation, limit, current, children }) {
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
      ) : null}
    </label>
  )
}

const inputClass =
  'w-full rounded-veto border border-[#a9b1b9] bg-white px-2.5 py-1.5 text-data text-[#1f2933] transition-colors hover:border-[#8b949d] focus:border-[#2d613b]'

function TextInput({ className = '', ...props }) {
  return <input type="text" {...props} className={`${inputClass} ${className}`} />
}

function NumberInput({ onChange, maxDigits, ...props }) {
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
      onChange={limitDigits}
      {...props}
      className={`${inputClass} tnum`}
    />
  )
}
