import { ScanIcon, UploadSimpleIcon, VideoCameraIcon, XIcon } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import VetoMark from '@/components/VetoMark'
import { formatMm, formatNumber } from '@/lib/format'
import {
  captureFrame,
  estimateDimensions,
  inferVisionFrame,
  isOverloadClass,

  sampleWeights,
  stableClass,
  topPrediction,
} from '@/lib/roboflow'

const OVER_COLOUR = '#d92d20'
const NEUTRAL_COLOUR = '#2f8f4e'
const WINDOW = 5
const INTERVAL_MS = 700

export default function VisionScanner({ form, limits, onApply }) {
  const videoRef = useRef(null)
  const overlayRef = useRef(null)
  const inFlight = useRef(false)
  const recent = useRef([])
  const lastApplied = useRef(null)
  const abortRef = useRef(null)

  // The scan loop runs outside React's render cycle, so it reads the latest
  // props through refs rather than closing over a stale form.
  const latest = useRef({ form, limits, onApply })
  latest.current = { form, limits, onApply }

  const [videoUrl, setVideoUrl] = useState(null)
  const [fileName, setFileName] = useState('')
  const [playing, setPlaying] = useState(false)
  const [config] = useState({})
  const [autoSync, setAutoSync] = useState(true)
  const [fillWeights, setFillWeights] = useState(true)
  const [result, setResult] = useState(null)
  const [settled, setSettled] = useState(null)
  const [frames, setFrames] = useState(0)
  const [apiError, setApiError] = useState(null)
  const [appliedAt, setAppliedAt] = useState(null)

  const settings = useRef({ config, autoSync, fillWeights })
  settings.current = { config, autoSync, fillWeights }

  useEffect(() => () => videoUrl && URL.revokeObjectURL(videoUrl), [videoUrl])

  const resetScan = () => {
    recent.current = []
    lastApplied.current = null
    setResult(null)
    setSettled(null)
    setFrames(0)
    setApiError(null)
    setAppliedAt(null)
    clearOverlay(overlayRef.current)
  }

  const pickFile = (file) => {
    if (!file) return
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(URL.createObjectURL(file))
    setFileName(file.name)
    setPlaying(false)
    resetScan()
  }

  const clearVideo = () => {
    abortRef.current?.abort()
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(null)
    setFileName('')
    setPlaying(false)
    resetScan()
  }

  const apply = useCallback((className) => {
    const { form: currentForm, limits: currentLimits, onApply: push } = latest.current
    const dims = estimateDimensions(className, currentLimits)
    const patch = {
      length: String(dims.length),
      width: String(dims.width),
      height: String(dims.height),
    }
    if (settings.current.fillWeights) {
      const weights = sampleWeights(currentForm, currentLimits)
      if (weights) Object.assign(patch, weights)
    }
    lastApplied.current = className
    setAppliedAt(className)
    push(patch)
  }, [])

  const scanOnce = useCallback(async () => {
    const video = videoRef.current
    if (!video || inFlight.current) return
    const canvas = captureFrame(video)
    if (!canvas) return

    const { config: cfg } = settings.current
    if (false && !cfg.apiKey) {
      setApiError('Layanan VETO Vision belum terkonfigurasi.')
      return
    }

    inFlight.current = true
    let next = null
    try {
      abortRef.current = new AbortController()
      next = await inferVisionFrame(canvas, abortRef.current.signal)
      setApiError(null)
    } catch (caught) {
      if (caught?.name === 'AbortError') {
        inFlight.current = false
        return
      }
      setApiError(caught?.message || 'Layanan VETO Vision tidak dapat dihubungi.')
      return
    } finally {
      inFlight.current = false
    }
    if (!next) return

    setFrames((count) => count + 1)

    const top = topPrediction(next)
    if (top) {
      setResult(next)
      drawOverlay(overlayRef.current, videoRef.current, next)
      recent.current = [...recent.current, top].slice(-WINDOW)
      const winner = stableClass(recent.current)
      setSettled(winner)
      if (winner && settings.current.autoSync && winner !== lastApplied.current) {
        apply(winner)
      }
    } else {
      setResult((prev) => prev ?? next)
    }
  }, [apply])

  // Scan while the video plays. One request at a time; the interval is the
  // gap between the end of one scan and the start of the next.
  useEffect(() => {
    if (!playing) return undefined
    let stopped = false
    let timer
    const tick = async () => {
      if (stopped) return
      await scanOnce()
      if (stopped) return
      timer = setTimeout(tick, INTERVAL_MS)
    }
    tick()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [playing, scanOnce])

  // Boxes are drawn in display pixels, so a resize has to redraw them.
  useEffect(() => {
    const redraw = () => drawOverlay(overlayRef.current, videoRef.current, result)
    window.addEventListener('resize', redraw)
    return () => window.removeEventListener('resize', redraw)
  }, [result])

  const top = topPrediction(result)
  const overload = isOverloadClass(settled)
  const estimate = settled ? estimateDimensions(settled, limits) : null
  const colour = overload ? OVER_COLOUR : NEUTRAL_COLOUR

  return (
    <section className="mb-4 border border-ink-200 bg-white font-sans">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 px-4 py-2">
        <VetoMark className="h-3 w-auto" />
        <span className="font-mono text-mono-xs tracking-[0.14em] text-ink-400">VETO · VISION</span>
        <span className="text-label text-ink-900">Pemindai Dimensi Kamera</span>
      </div>

      <div className="grid items-start gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {videoUrl ? (
            <div className="relative aspect-video w-full overflow-hidden bg-ink-950">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                autoPlay
                muted
                playsInline
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                onLoadedMetadata={() => clearOverlay(overlayRef.current)}
                onLoadedData={() => scanOnce()}
                onSeeked={() => !playing && scanOnce()}
                className="absolute inset-0 h-full w-full object-contain"
              />
              <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
            </div>
          ) : (
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                pickFile(e.dataTransfer.files?.[0])
              }}
              className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-ink-300 bg-ink-50 text-center transition-colors hover:bg-ink-100"
            >
              <VideoCameraIcon size={28} className="text-ink-400" aria-hidden />
              <span className="text-body text-ink-900">Pilih atau tarik video truk ke sini</span>
              <span className="text-label text-ink-400">.mp4 · .webm · .mov — diproses di browser</span>
              <span className="mt-1 flex items-center gap-1.5 rounded-veto bg-ink-900 px-3 py-1.5 text-label text-white">
                <UploadSimpleIcon size={14} aria-hidden />
                Pilih Video
              </span>
              <input
                type="file"
                accept="video/*"
                className="sr-only"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </label>
          )}

          {videoUrl && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="truncate font-mono text-mono-xs text-ink-500">{fileName}</span>
              <button
                type="button"
                onClick={scanOnce}
                className="flex items-center gap-1.5 rounded-veto border border-ink-200 px-2.5 py-1 text-label text-ink-900 transition-colors hover:bg-ink-50"
              >
                <ScanIcon size={14} aria-hidden />
                Pindai frame ini
              </button>
              <button
                type="button"
                onClick={clearVideo}
                className="ml-auto flex items-center gap-1.5 rounded-veto px-2 py-1 text-label text-ink-500 transition-colors hover:text-ink-900"
              >
                <XIcon size={14} aria-hidden />
                Ganti video
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <p className="font-mono text-mono-xs text-ink-400">STATUS DETEKSI</p>
            {settled ? (
              <div className="mt-1 flex items-baseline gap-2.5">
                <span
                  aria-hidden
                  className="h-3 w-3 shrink-0 self-center"
                  style={{ background: colour }}
                />
                <p className="text-h1 text-ink-900">{overload ? 'POSSIBLE OVERLOAD' : 'NORMAL'}</p>
              </div>
            ) : (
              <p className="mt-1 text-label text-ink-400">
                {videoUrl
                  ? playing
                    ? 'Memindai… belum ada truk terdeteksi.'
                    : 'Putar video atau pindai frame untuk mulai.'
                  : 'Belum ada video.'}
              </p>
            )}
          </div>

          <dl className="grid grid-cols-3 gap-2 border-y border-ink-100 py-2">
            <Telemetry label="Confidence" value={top ? `${formatNumber((top.confidence * 100).toFixed(1))}%` : '–'} />
            <Telemetry label="Frame" value={formatNumber(frames)} />
            <Telemetry label="Latensi" value={result ? `${formatNumber(result.latencyMs)} ms` : '–'} />
          </dl>

          {apiError && (
            <p className="text-label text-[#a02a1f]">
              {apiError}
            </p>
          )}

          {estimate && (
            <div>
              <p className="font-mono text-mono-xs text-ink-400">ESTIMASI DIMENSI KAMERA</p>
              <ul className="mt-1 space-y-0.5">
                {[
                  ['Panjang', 'length'],
                  ['Lebar', 'width'],
                  ['Tinggi', 'height'],
                ].map(([label, key]) => {
                  const ceiling = limits[key]?.threshold
                  const over = ceiling && estimate[key] > ceiling
                  return (
                    <li key={key} className="flex items-baseline justify-between text-label">
                      <span className="text-ink-500">{label}</span>
                      <span className={`tnum ${over ? 'text-[#d92d20]' : 'text-ink-900'}`}>
                        {formatMm(estimate[key])}
                        {over && (
                          <span className="text-ink-400"> · +{formatNumber(estimate[key] - ceiling)}</span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Toggle checked={autoSync} onChange={setAutoSync}>
              Sinkron otomatis ke form
            </Toggle>
            <Toggle checked={fillWeights} onChange={setFillWeights}>
              Isi contoh berat sumbu bila form masih kosong
            </Toggle>
          </div>

          <button
            type="button"
            disabled={!settled}
            onClick={() => settled && apply(settled)}
            className="rounded-veto bg-ink-900 px-4 py-2 text-label text-white transition-colors hover:bg-ink-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Terapkan Dimensi ke Form
          </button>
          {appliedAt && (
            <p className="text-label text-ink-500">
              Diterapkan: {isOverloadClass(appliedAt) ? 'Possible Overload' : 'Normal'}. Lanjutkan
              dengan Validasi ke VETO.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function Telemetry({ label, value }) {
  return (
    <div>
      <dt className="font-mono text-mono-xs text-ink-400">{label}</dt>
      <dd className="tnum text-data text-ink-900">{value}</dd>
    </div>
  )
}

function Toggle({ checked, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-label text-ink-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-[#1b1f23]"
      />
      {children}
    </label>
  )
}

function clearOverlay(canvas) {
  if (!canvas) return
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
}

/**
 * Maps prediction boxes from capture-canvas pixels onto the displayed video,
 * accounting for the letterboxing that `object-contain` adds.
 */
function drawOverlay(canvas, video, result) {
  if (!canvas || !video) return
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(rect.width * dpr)
  canvas.height = Math.round(rect.height * dpr)
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, rect.width, rect.height)
  if (!result?.predictions?.length || !video.videoWidth) return

  const fit = Math.min(rect.width / video.videoWidth, rect.height / video.videoHeight)
  const offsetX = (rect.width - video.videoWidth * fit) / 2
  const offsetY = (rect.height - video.videoHeight * fit) / 2
  const toDisplay = fit * (video.videoWidth / result.imageWidth)

  ctx.font = '600 12px "JetBrains Mono Variable", ui-monospace, monospace'
  for (const p of result.predictions) {
    const colour = isOverloadClass(p.class) ? OVER_COLOUR : NEUTRAL_COLOUR
    const x = offsetX + (p.x - p.width / 2) * toDisplay
    const y = offsetY + (p.y - p.height / 2) * toDisplay
    const w = p.width * toDisplay
    const h = p.height * toDisplay

    ctx.strokeStyle = colour
    ctx.lineWidth = 2.5
    ctx.strokeRect(x, y, w, h)

    const label = `${p.class} ${(p.confidence * 100).toFixed(0)}%`
    const textWidth = ctx.measureText(label).width + 10
    const labelY = y > 20 ? y - 20 : y
    ctx.fillStyle = colour
    ctx.fillRect(x, labelY, textWidth, 20)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(label, x + 5, labelY + 14)
  }
}
