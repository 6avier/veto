import { ArrowRightIcon, FilePdfIcon, UploadSimpleIcon } from '@phosphor-icons/react'
import { useRef, useState } from 'react'

import { BTN_PRIMARY, PANEL } from './ui'

/** PDF only, 10 MB. Mirrors the backend limit in api-contract.md §4. */
const MAX_BYTES = 10 * 1024 * 1024

/**
 * A real SOP shipped with the app, so a booth visitor can run the whole flow
 * without bringing a document. It goes through the same upload as a dropped
 * file; nothing about it is pre-processed.
 */
const SAMPLE = {
  url: '/samples/NLI-TRK-COMP-2026-01.pdf',
  name: 'NLI-TRK-COMP-2026-01.pdf',
  label: 'Kebijakan armada NLI Logistics',
}

export default function DropZone({ onFile, disabled }) {
  const inputRef = useRef(null)
  const [over, setOver] = useState(false)
  const [rejected, setRejected] = useState(null)
  const [loadingSample, setLoadingSample] = useState(false)

  const accept = (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setRejected('Hanya berkas PDF yang diterima.')
      return
    }
    if (file.size > MAX_BYTES) {
      setRejected('Ukuran berkas melebihi 10 MB.')
      return
    }
    setRejected(null)
    onFile(file)
  }

  async function useSample() {
    setLoadingSample(true)
    try {
      const response = await fetch(SAMPLE.url)
      if (!response.ok) throw new Error('sample missing')
      const blob = await response.blob()
      accept(new File([blob], SAMPLE.name, { type: 'application/pdf' }))
    } catch {
      setRejected('Dokumen contoh tidak dapat dimuat.')
    } finally {
      setLoadingSample(false)
    }
  }

  return (
    <section className={`${PANEL} grid grid-cols-[minmax(0,1fr)] gap-4 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]`}>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          accept(e.dataTransfer.files?.[0])
        }}
        className={[
          'group grid min-h-[260px] place-items-center rounded-2xl border-[1.5px] border-dashed px-6 py-10 text-center transition-colors',
          over ? 'border-accent bg-accent-soft' : 'border-ink-200 bg-console',
          disabled ? 'opacity-50' : '',
        ].join(' ')}
      >
        <div>
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[18px] bg-accent text-white transition-transform duration-200 motion-safe:group-hover:-translate-y-0.5">
            <UploadSimpleIcon size={26} aria-hidden />
          </span>
          <p className="text-[19px] font-bold tracking-[-0.02em]">Seret PDF ke sini</p>
          <p className="mt-1 text-[14px] text-ink-500">SOP, syarat kontrak, atau batas internal</p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className={`${BTN_PRIMARY} mt-5`}
          >
            Pilih PDF
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            // Opened by the Pilih PDF button; a second, invisible tab stop
            // would only lose keyboard users.
            tabIndex={-1}
            className="sr-only"
            onChange={(e) => accept(e.target.files?.[0])}
          />
          {rejected && <p className="mt-3 text-[13px] font-bold text-hold-ink">{rejected}</p>}
        </div>
      </div>

      <div className="self-center px-1 py-2">
        <p className="text-[15px] font-bold">Dokumen contoh</p>
        <button
          type="button"
          disabled={disabled || loadingSample}
          onClick={useSample}
          className="mt-2 flex w-full items-center gap-3.5 rounded-2xl border border-ink-100 bg-white p-3 text-left transition-[border-color,box-shadow,transform] duration-200 motion-safe:hover:-translate-y-px hover:border-accent hover:shadow-[0_16px_36px_-16px_rgba(36,87,245,0.3)] disabled:opacity-50"
        >
          <span className="grid h-12 w-10 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent">
            <FilePdfIcon size={22} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-bold">{SAMPLE.name}</span>
            <span className="block text-[12px] text-ink-400">
              {loadingSample ? 'Memuat…' : SAMPLE.label}
            </span>
          </span>
          <ArrowRightIcon size={18} className="shrink-0 text-ink-300" aria-hidden />
        </button>
      </div>
    </section>
  )
}
