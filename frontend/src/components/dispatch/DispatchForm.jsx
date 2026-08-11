import { axleCountFor, formatKg, formatTonnes } from '@/lib/format'

/**
 * The dispatch entry form, inside the client's ERP.
 *
 * Controlled. The parent owns the value so input survives a HOLD and the
 * officer can correct one number and resubmit (PRODUCT.md F2).
 *
 * Number inputs hold raw digits while editing. DESIGN.md's "never render a raw
 * 24500" rule governs display, not an editable numeric field, where separators
 * fight the person typing. Formatted values appear in the computed readout.
 */

const AXLE_CONFIGS = [
  { value: '1.1', label: '1.1 · dua sumbu, truk ringan' },
  { value: '1.2', label: '1.2 · dua sumbu, roda ganda' },
  { value: '1.22', label: '1.22 · tiga sumbu, tronton' },
]

const AXLE_NAMES = ['Sumbu depan', 'Sumbu tengah', 'Sumbu belakang']

function axleLabel(index, count) {
  if (index === 0) return AXLE_NAMES[0]
  if (index === count - 1) return AXLE_NAMES[2]
  return AXLE_NAMES[1]
}

export default function DispatchForm({ value, onChange, onSubmit, pending, errors = {} }) {
  const axleCount = axleCountFor(value.axleConfig)

  const set = (patch) => onChange({ ...value, ...patch })

  const setAxleConfig = (axleConfig) => {
    const count = axleCountFor(axleConfig)
    const axles = Array.from({ length: count }, (_, i) => value.axleLoads[i] ?? '')
    set({ axleConfig, axleLoads: axles })
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
            className="w-full rounded-veto border border-[#a9b1b9] bg-white px-2 py-1.5 text-data"
          >
            {AXLE_CONFIGS.map((config) => (
              <option key={config.value} value={config.value}>
                {config.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Berat Kosong (kg)" error={errors.tareWeight}>
          <NumberInput
            value={value.tareWeight}
            onChange={(e) => set({ tareWeight: e.target.value })}
          />
        </Field>
      </Section>

      <Section title="2. Data Muatan">
        <Field label="Berat Kotor (kg)" error={errors.grossWeight} hint="Berat total kendaraan bermuatan">
          <NumberInput
            value={value.grossWeight}
            onChange={(e) => set({ grossWeight: e.target.value })}
          />
        </Field>
        {value.axleLoads.map((load, index) => (
          <Field
            key={index}
            label={`${axleLabel(index, axleCount)} (kg)`}
            error={errors[`axle${index}`]}
          >
            <NumberInput value={load} onChange={(e) => setAxle(index, e.target.value)} />
          </Field>
        ))}
      </Section>

      <Section title="3. Dimensi Muatan">
        <Field label="Panjang (mm)">
          <NumberInput value={value.length} onChange={(e) => set({ length: e.target.value })} />
        </Field>
        <Field label="Lebar (mm)">
          <NumberInput value={value.width} onChange={(e) => set({ width: e.target.value })} />
        </Field>
        <Field label="Tinggi (mm)">
          <NumberInput value={value.height} onChange={(e) => set({ height: e.target.value })} />
        </Field>
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
          className="ml-auto rounded-veto bg-[#2c5d8f] px-4 py-2 text-label text-white transition-colors hover:bg-[#24507c] disabled:opacity-50"
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
      <legend className="mb-2 text-label font-semibold text-[#1f2933]">{title}</legend>
      <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  )
}

function Field({ label, hint, error, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label text-[#4a545e]">{label}</span>
      {children}
      {error ? (
        <span className="text-label text-[#a02a1f]">{error}</span>
      ) : hint ? (
        <span className="text-label text-[#8b949d]">{hint}</span>
      ) : null}
    </label>
  )
}

const inputClass =
  'w-full rounded-veto border border-[#a9b1b9] bg-white px-2 py-1.5 text-data text-[#1f2933] focus:border-[#2c5d8f]'

function TextInput({ className = '', ...props }) {
  return <input type="text" {...props} className={`${inputClass} ${className}`} />
}

function NumberInput(props) {
  return <input type="number" inputMode="numeric" min="0" step="1" {...props} className={`${inputClass} tnum`} />
}
