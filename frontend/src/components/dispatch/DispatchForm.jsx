import { axleCountFor, formatKg, formatNumber, formatTonnes } from '@/lib/format'
import { deltaFromLimit } from '@/lib/limits'

/**
 * The dispatch entry form, inside the client's ERP.
 *
 * Controlled. The parent owns the value so input survives a HOLD and the
 * officer can correct one number and resubmit (PRODUCT.md F2).
 *
 * Each field shows its legal ceiling and the signed distance to it, so the
 * officer can see a load going out of bounds while typing rather than learning
 * it from the verdict.
 */

const AXLE_CONFIGS = [
  { value: '1.1', label: '1.1 · dua sumbu, truk ringan' },
  { value: '1.2', label: '1.2 · dua sumbu, roda ganda' },
  { value: '1.22', label: '1.22 · tiga sumbu, tronton' },
]

const AXLE_NAMES = ['Sumbu depan', 'Sumbu tengah', 'Sumbu belakang']

/**
 * Physical-plausibility ceilings for the inputs. Deliberately far above any
 * legal limit: capping at the legal value would make it impossible to enter an
 * overloaded dispatch, which is the entire thing this screen exists to catch.
 */
const SANITY_MAX = { weight: 100000, dimension: 30000 }

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
    <form onSubmit={onSubmit} className="divide-y divide-[#c9ced4] border border-[#c9ced4] bg-white">
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
            max={SANITY_MAX.weight}
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
            max={SANITY_MAX.weight}
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
              max={SANITY_MAX.weight}
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
            violation={violations[key]}
            limit={limits[key]}
            current={value[key]}
          >
            <NumberInput
              value={value[key]}
              onChange={(e) => set({ [key]: e.target.value })}
              max={SANITY_MAX.dimension}
            />
          </Field>
        ))}
      </Section>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-[#f4f6f7] px-4 py-3">
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
          className="ml-auto rounded-veto bg-[#2c5d8f] px-4 py-2 text-label text-white transition-colors hover:bg-[#24507c] focus-visible:outline-offset-2 disabled:opacity-50"
        >
          {pending ? 'Memvalidasi…' : 'Validasi ke VETO'}
        </button>
      </div>
    </form>
  )
}

function Section({ title, children }) {
  return (
    <fieldset className="px-4 py-3">
      <legend className="mb-2.5 text-label font-semibold text-[#1f2933]">{title}</legend>
      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  )
}

/**
 * Label, input, then the field's ceiling and how far the current value sits
 * from it. A violation replaces the neutral readout with the directive, pinned
 * to the field that caused it (PRODUCT.md F2).
 */
function Field({ label, unit, error, violation, limit, current, children }) {
  const gap = deltaFromLimit(current, limit)

  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-label text-[#4a545e]">
          {label}
          {unit && <span className="text-[#98a0a9]"> ({unit})</span>}
        </span>
        {limit && (
          <span className="tnum font-mono text-mono-xs text-[#8b949d]">
            batas {formatNumber(limit.threshold)}
          </span>
        )}
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
      ) : gap && gap.delta === 0 ? (
        // Exactly at the ceiling is its own state, and a signed zero says nothing.
        <span className="text-label text-[#8a5200]">Tepat di batas</span>
      ) : gap ? (
        <span
          className={[
            'tnum text-label',
            gap.over ? 'font-medium text-[#a02a1f]' : 'text-[#6b757f]',
          ].join(' ')}
        >
          {gap.over ? '+' : '−'}
          {formatNumber(Math.abs(gap.delta))} {gap.unit}
          <span className="text-[#98a0a9]">
            {gap.over ? ' melebihi batas' : ' di bawah batas'}
          </span>
        </span>
      ) : null}
    </label>
  )
}

const inputClass =
  'w-full rounded-veto border border-[#a9b1b9] bg-white px-2.5 py-1.5 text-data text-[#1f2933] transition-colors hover:border-[#8b949d] focus:border-[#2c5d8f]'

function TextInput({ className = '', ...props }) {
  return <input type="text" {...props} className={`${inputClass} ${className}`} />
}

function NumberInput(props) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min="0"
      step="1"
      {...props}
      className={`${inputClass} tnum`}
    />
  )
}
