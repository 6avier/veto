import { useRef, useState } from 'react'

/** PDF only, 10 MB. Mirrors the backend limit in api-contract.md §4. */
const MAX_BYTES = 10 * 1024 * 1024

export default function DropZone({ onFile, disabled }) {
  const inputRef = useRef(null)
  const [over, setOver] = useState(false)
  const [rejected, setRejected] = useState(null)

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

  return (
    <div>
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
          'border border-dashed px-6 py-10 text-center transition-colors',
          over ? 'border-ink-500 bg-white' : 'border-ink-300',
          disabled ? 'opacity-50' : '',
        ].join(' ')}
      >
        <p className="text-body text-ink-700">
          Letakkan dokumen kebijakan internal di sini
        </p>
        <p className="mx-auto mt-1 max-w-[46ch] text-label text-ink-500">
          SOP gudang, ketentuan kontrak, atau kebijakan keselamatan. Peraturan pemerintah
          tidak perlu diunggah.
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="mt-4 rounded-veto bg-ink-900 px-4 py-2 text-label text-white disabled:opacity-50"
        >
          Pilih berkas PDF
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(e) => accept(e.target.files?.[0])}
        />
      </div>
      {rejected && <p className="mt-2 text-label text-[#a02a1f]">{rejected}</p>}
    </div>
  )
}
