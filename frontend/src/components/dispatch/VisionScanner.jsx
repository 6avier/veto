import {
  IdentificationCardIcon,
  ShieldCheckIcon,
  VideoCameraIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import VetoMark from '@/components/VetoMark'
import { axleCountFor, formatMm, formatNumber } from '@/lib/format'
import {
  captureFrame,
  estimateDimensions,
  inferAlprFrame,
  inferVisionFrame,
  isOverloadClass,
  stableClass,
  topPrediction,
} from '@/lib/roboflow'

const OVER_COLOUR = '#d92d20'
const NEUTRAL_COLOUR = '#2f8f4e'
const WINDOW = 5
const INTERVAL_MS = 700

export default function VisionScanner({ form, limits, onApply }) {
  // --- CAMERA 1 (OVER-DIMENSION) REFS & STATE ---
  const cam1MediaRef = useRef(null)
  const cam1OverlayRef = useRef(null)
  const cam1InFlight = useRef(false)
  const cam1Recent = useRef([])
  const cam1AbortRef = useRef(null)

  const [cam1Url, setCam1Url] = useState(null)
  const [cam1Type, setCam1Type] = useState('video') // 'video' | 'image'
  const [cam1FileName, setCam1FileName] = useState('')
  const [cam1Playing, setCam1Playing] = useState(false)
  const [cam1Result, setCam1Result] = useState(null)
  const [cam1Settled, setCam1Settled] = useState(null)
  const [cam1Frames, setCam1Frames] = useState(0)
  const [cam1Error, setCam1Error] = useState(null)

  // --- CAMERA 2 (ALPR & FLEET) REFS & STATE ---
  const cam2MediaRef = useRef(null)
  const cam2InFlight = useRef(false)
  const cam2AbortRef = useRef(null)

  const [cam2Url, setCam2Url] = useState(null)
  const [cam2Type, setCam2Type] = useState('image') // 'image' | 'video'
  const [cam2FileName, setCam2FileName] = useState('')
  const [cam2Alpr, setCam2Alpr] = useState(null)
  const [cam2Fleet, setCam2Fleet] = useState(null)
  const [cam2Latency, setCam2Latency] = useState(null)
  const [cam2Error, setCam2Error] = useState(null)

  // --- GLOBAL SETTINGS & SYNC ---
  const [autoSync, setAutoSync] = useState(true)
  const [fillWeights, setFillWeights] = useState(true)
  const [appliedNotice, setAppliedNotice] = useState(null)
  const lastAppliedRef = useRef({ odClass: null, plate: null, axleConfig: null, tareWeight: null })
  const cam1SettledRef = useRef(null)
  const cam2FleetRef = useRef(null)

  const latest = useRef({ form, limits, onApply })
  latest.current = { form, limits, onApply }

  const settings = useRef({ autoSync, fillWeights })
  settings.current = { autoSync, fillWeights }

  useEffect(() => () => {
    if (cam1Url) URL.revokeObjectURL(cam1Url)
  }, [cam1Url])

  useEffect(() => () => {
    if (cam2Url) URL.revokeObjectURL(cam2Url)
  }, [cam2Url])

  useEffect(() => () => {
    cam1AbortRef.current?.abort()
    cam2AbortRef.current?.abort()
  }, [])

  // Reset Camera 1
  const clearCam1 = () => {
    cam1AbortRef.current?.abort()
    setCam1Url(null)
    setCam1FileName('')
    setCam1Playing(false)
    setCam1Result(null)
    setCam1Settled(null)
    setCam1Frames(0)
    setCam1Error(null)
    setAppliedNotice(null)
    cam1Recent.current = []
    cam1SettledRef.current = null
    lastAppliedRef.current.odClass = null
    clearOverlay(cam1OverlayRef.current)
  }

  // Reset Camera 2
  const clearCam2 = () => {
    cam2AbortRef.current?.abort()
    setCam2Url(null)
    setCam2FileName('')
    setCam2Alpr(null)
    setCam2Fleet(null)
    setCam2Latency(null)
    setCam2Error(null)
    setAppliedNotice(null)
    cam2FleetRef.current = null
    lastAppliedRef.current.plate = null
    lastAppliedRef.current.axleConfig = null
    lastAppliedRef.current.tareWeight = null
  }

  // Handle Pick Camera 1 File (Over Dimension)
  const pickCam1File = (file) => {
    if (!file) return
    cam1AbortRef.current?.abort()
    const name = file.name || ''
    const isImg = file.type?.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(name)
    setCam1Type(isImg ? 'image' : 'video')
    setCam1Url(URL.createObjectURL(file))
    setCam1FileName(name)
    setCam1Playing(false)
    setCam1Result(null)
    setCam1Settled(null)
    setCam1Frames(0)
    setCam1Error(null)
    setAppliedNotice(null)
    cam1Recent.current = []
    cam1SettledRef.current = null
    lastAppliedRef.current.odClass = null
    clearOverlay(cam1OverlayRef.current)
  }

  // Handle Pick Camera 2 File (ALPR)
  const pickCam2File = (file) => {
    if (!file) return
    cam2AbortRef.current?.abort()
    const name = file.name || ''
    const isImg = file.type?.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(name)
    setCam2Type(isImg ? 'image' : 'video')
    setCam2Url(URL.createObjectURL(file))
    setCam2FileName(name)
    setCam2Alpr(null)
    setCam2Fleet(null)
    setCam2Latency(null)
    setCam2Error(null)
    setAppliedNotice(null)
    cam2FleetRef.current = null
    lastAppliedRef.current.plate = null
    lastAppliedRef.current.axleConfig = null
    lastAppliedRef.current.tareWeight = null
  }

  // Unified Apply to Dispatch Form - HANYA boleh mengisi form jika pelat terverifikasi (VERIFIED)!
  const applyDataToForm = useCallback((odClass, fleet, force = false) => {
    const isVerified = Boolean(
      fleet?.identity_status === 'VERIFIED' || fleet?.identity_verified === true
    )

    // Aturan ketat: Form HANYA boleh terisi setelah pelat nomor lolos verifikasi Master Armada!
    if (!isVerified) {
      if (fleet?.identity_status === 'MISMATCH_ALERT') {
        setAppliedNotice('Sinkronisasi ditolak: Terdeteksi ketidaksesuaian fisik armada (Indikasi Tukar Pelat).')
      } else if (fleet?.identity_status === 'UNREGISTERED_PLATE') {
        setAppliedNotice('Sinkronisasi ditolak: Pelat nomor belum terdaftar di Master Armada perusahaan.')
      } else if (odClass) {
        setAppliedNotice('Menunggu pelat nomor terverifikasi di CAM 02 sebelum dimensi dan spesifikasi truk disinkronkan ke form.')
      }
      return
    }

    const { form: currentForm, limits: currentLimits, onApply: push } = latest.current
    const patch = {}

    // 1. Data Truk Mentah Resmi (Konfigurasi Sumbu & Berat Kosong)
    patch.axleConfig = fleet.axle_config
    patch.tareWeight = String(fleet.tare_weight_kg || '')

    const count = axleCountFor(fleet.axle_config)
    let axleLoads = Array.from({ length: count }, (_, i) => currentForm.axleLoads?.[i] || '')
    let totalGross = ''

    // 2. Data Dimensi Muatan (dari CAM 01 jika sudah terdeteksi)
    if (odClass) {
      const dims = estimateDimensions(odClass, currentLimits)
      patch.length = String(dims.length)
      patch.width = String(dims.width)
      patch.height = String(dims.height)
    }

    // 3. Beban Muatan (jika opsi contoh muatan aktif dan dimensi muatan terdeteksi)
    if (settings.current.fillWeights && odClass) {
      const grossLimit = Number(fleet.max_jbi_kg) || currentLimits.grossWeight?.threshold || 24000
      const tare = Number(fleet.tare_weight_kg) || 8900
      const isOver = isOverloadClass(odClass)

      const targetGross = isOver ? Math.round(grossLimit * 1.15) : Math.round(grossLimit * 0.88)
      const payloadWeight = Math.max(1000, targetGross - tare)
      const perAxlePayload = Math.round(payloadWeight / count)

      axleLoads = Array.from({ length: count }, (_, i) => {
        const baseAxle = i === 0 ? Math.round(tare * 0.45) : Math.round((tare * 0.55) / (count - 1))
        const load = baseAxle + (i === 0 ? Math.round(perAxlePayload * 0.25) : Math.round((perAxlePayload * 1.75) / (count - 1)))
        return String(Math.round(load / 50) * 50)
      })
      totalGross = String(axleLoads.reduce((sum, a) => sum + Number(a), 0))
    } else {
      const sum = axleLoads.reduce((acc, a) => acc + (Number(a) || 0), 0)
      totalGross = sum > 0 ? String(sum) : ''
    }

    patch.axleLoads = axleLoads
    patch.grossWeight = totalGross

    // Prevent redundant repeated pushes on every video frame if values haven't changed
    const prev = lastAppliedRef.current
    const isUnchanged =
      !force &&
      prev.odClass === odClass &&
      prev.plate === (fleet?.license_plate ?? null) &&
      prev.axleConfig === (fleet?.axle_config ?? null) &&
      prev.tareWeight === (fleet?.tare_weight_kg ?? null)

    if (isUnchanged) return

    lastAppliedRef.current = {
      odClass,
      plate: fleet?.license_plate ?? null,
      axleConfig: fleet?.axle_config ?? null,
      tareWeight: fleet?.tare_weight_kg ?? null,
    }

    push(patch)
    const noticeParts = [
      `Pelat Terverifikasi: ${fleet.license_plate} (${fleet.axle_config}, Tare ${fleet.tare_weight_kg} kg)`
    ]
    if (odClass) {
      noticeParts.push(`Dimensi Muatan: ${isOverloadClass(odClass) ? 'Possible Overload' : 'Normal'}`)
    }
    setAppliedNotice(`Tersinkron ke form: ${noticeParts.join(' · ')}`)
  }, [])

  // Scan Camera 1 (Over Dimension)
  const scanCam1Once = useCallback(async () => {
    const media = cam1MediaRef.current
    if (!media || cam1InFlight.current) return
    const canvas = captureFrame(media, 640)
    if (!canvas) return

    cam1InFlight.current = true
    let next = null
    try {
      cam1AbortRef.current = new AbortController()
      next = await inferVisionFrame(canvas, cam1AbortRef.current.signal)
      setCam1Error(null)
    } catch (caught) {
      if (caught?.name === 'AbortError') {
        cam1InFlight.current = false
        return
      }
      setCam1Error(caught?.message || 'Gagal memproses visual dimensi.')
      return
    } finally {
      cam1InFlight.current = false
    }
    if (!next) return

    setCam1Frames((count) => count + 1)
    const top = topPrediction(next)
    if (top) {
      setCam1Result(next)
      drawOverlay(cam1OverlayRef.current, cam1MediaRef.current, next)
      cam1Recent.current = [...cam1Recent.current, top].slice(-WINDOW)
      const winner = stableClass(cam1Recent.current)
      setCam1Settled(winner)
      cam1SettledRef.current = winner
      if (winner && settings.current.autoSync) {
        applyDataToForm(winner, cam2FleetRef.current)
      }
    } else {
      setCam1Result((prev) => prev ?? next)
    }
  }, [applyDataToForm])

  // Scan Camera 2 (ALPR Plate & Fleet)
  const scanCam2Once = useCallback(async () => {
    const media = cam2MediaRef.current
    if (!media || cam2InFlight.current) return
    const canvas = captureFrame(media, 480)
    if (!canvas) return

    cam2InFlight.current = true
    let next = null
    try {
      cam2AbortRef.current = new AbortController()
      next = await inferAlprFrame(canvas, cam2AbortRef.current.signal)
      setCam2Error(null)
    } catch (caught) {
      if (caught?.name === 'AbortError') {
        cam2InFlight.current = false
        return
      }
      setCam2Error(caught?.message || 'Gagal membaca pelat nomor.')
      return
    } finally {
      cam2InFlight.current = false
    }
    if (!next) return

    setCam2Alpr(next.alpr)
    setCam2Fleet(next.fleetMatch)
    setCam2Latency(next.latencyMs)
    cam2FleetRef.current = next.fleetMatch

    if (next.fleetMatch && settings.current.autoSync) {
      applyDataToForm(cam1SettledRef.current, next.fleetMatch)
    }
  }, [applyDataToForm])

  // Cam 1 Auto tick when playing video
  useEffect(() => {
    if (cam1Type !== 'video' || !cam1Playing) return undefined
    let stopped = false
    let timer
    const tick = async () => {
      if (stopped) return
      await scanCam1Once()
      if (stopped) return
      timer = setTimeout(tick, INTERVAL_MS)
    }
    tick()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [cam1Type, cam1Playing, scanCam1Once])

  // Redraw Cam 1 overlay on resize
  useEffect(() => {
    const redraw = () => drawOverlay(cam1OverlayRef.current, cam1MediaRef.current, cam1Result)
    window.addEventListener('resize', redraw)
    return () => window.removeEventListener('resize', redraw)
  }, [cam1Result])

  const top = topPrediction(cam1Result)
  const overload = isOverloadClass(cam1Settled)
  const estimate = cam1Settled ? estimateDimensions(cam1Settled, limits) : null
  const colour = overload ? OVER_COLOUR : NEUTRAL_COLOUR

  return (
    <section className="mb-4 border border-ink-200 bg-white font-sans">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-ink-200 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <VetoMark className="h-3 w-auto" />
          <span className="font-mono text-mono-xs tracking-[0.14em] text-ink-400">VETO · VISION SYSTEM</span>
          <span className="font-medium text-label text-ink-900">Dual-Camera Gate Inspection (Dimensi + ALPR)</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 font-mono text-ink-500">
            <span className={`h-2 w-2 rounded-full ${cam1Result ? 'bg-[#2f8f4e]' : 'bg-ink-300'}`} />
            CAM-01 (Sisi)
          </span>
          <span className="flex items-center gap-1.5 font-mono text-ink-500">
            <span className={`h-2 w-2 rounded-full ${cam2Fleet ? 'bg-[#2f8f4e]' : 'bg-ink-300'}`} />
            CAM-02 (Depan)
          </span>
        </div>
      </div>

      {/* Main 2-Section Grid */}
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        {/* ========================================================= */}
        {/* SECTION 1: KAMERA 1 - DETEKSI OVER DIMENSION             */}
        {/* ========================================================= */}
        <div className="flex flex-col border border-ink-200 bg-ink-50/50 p-3.5">
          <div className="mb-2.5 flex items-center justify-between border-b border-ink-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="rounded bg-ink-900 px-1.5 py-0.5 font-mono text-mono-xs font-semibold text-white">
                CAM 01
              </span>
              <p className="font-medium text-label text-ink-900">Pemindai Dimensi Muatan (Samping)</p>
            </div>
            {cam1Settled && (
              <span
                className="rounded px-2 py-0.5 text-xs font-semibold text-white"
                style={{ background: colour }}
              >
                {overload ? 'POSSIBLE OVERLOAD' : 'NORMAL'}
              </span>
            )}
          </div>

          {/* Media Viewport */}
          <div>
            {cam1Url ? (
              <div className="relative aspect-video w-full overflow-hidden bg-ink-950">
                {cam1Type === 'video' ? (
                  <video
                    ref={cam1MediaRef}
                    src={cam1Url}
                    controls
                    autoPlay
                    muted
                    playsInline
                    onPlay={() => setCam1Playing(true)}
                    onPause={() => setCam1Playing(false)}
                    onEnded={() => setCam1Playing(false)}
                    onLoadedMetadata={() => clearOverlay(cam1OverlayRef.current)}
                    onLoadedData={() => scanCam1Once()}
                    onSeeked={() => !cam1Playing && scanCam1Once()}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                ) : (
                  <img
                    ref={cam1MediaRef}
                    src={cam1Url}
                    alt="Kamera 1: Profil Dimensi"
                    onLoad={() => scanCam1Once()}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                )}
                <canvas ref={cam1OverlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
              </div>
            ) : (
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  pickCam1File(e.dataTransfer.files?.[0])
                }}
                className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-ink-300 bg-white text-center transition-colors hover:bg-ink-100/70"
              >
                <VideoCameraIcon size={26} className="text-ink-400" aria-hidden />
                <span className="text-body font-medium text-ink-900">Foto / Video Sisi Truk</span>
                <span className="text-mono-xs text-ink-400">Deteksi siluet & over-dimension</span>
                <span className="mt-1 rounded-veto bg-ink-900 px-3 py-1 text-label text-white">
                  Pilih Media Dimensi
                </span>
                <input
                  type="file"
                  accept="video/*,image/*"
                  className="sr-only"
                  onChange={(e) => pickCam1File(e.target.files?.[0])}
                />
              </label>
            )}

            {cam1Url && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="truncate font-mono text-mono-xs text-ink-500">{cam1FileName}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={scanCam1Once}
                    className="rounded border border-ink-200 bg-white px-2 py-0.5 text-xs text-ink-800 hover:bg-ink-50"
                  >
                    Pindai Ulang
                  </button>
                  <button
                    type="button"
                    onClick={clearCam1}
                    className="text-xs text-ink-500 hover:text-ink-900"
                  >
                    Ganti
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Telemetry & Estimated Dimensions */}
          <div className="mt-3 space-y-2.5">
            <dl className="grid grid-cols-3 gap-2 border-y border-ink-200 py-1.5">
              <Telemetry label="Confidence" value={top ? `${formatNumber((top.confidence * 100).toFixed(1))}%` : '–'} />
              <Telemetry label="Frame" value={formatNumber(cam1Frames)} />
              <Telemetry label="Latensi" value={cam1Result ? `${formatNumber(cam1Result.latencyMs)} ms` : '–'} />
            </dl>

            {estimate && (
              <div className="rounded border border-ink-200 bg-white p-2">
                <p className="font-mono text-mono-xs font-semibold text-ink-600">ESTIMASI DIMENSI KAMERA</p>
                <ul className="mt-1 space-y-1 text-xs">
                  {[
                    ['Panjang', 'length'],
                    ['Lebar', 'width'],
                    ['Tinggi', 'height'],
                  ].map(([label, key]) => {
                    const ceiling = limits[key]?.threshold
                    const over = ceiling && estimate[key] > ceiling
                    return (
                      <li key={key} className="flex justify-between">
                        <span className="text-ink-500">{label}:</span>
                        <span className={`font-mono font-medium ${over ? 'text-[#d92d20]' : 'text-ink-900'}`}>
                          {formatMm(estimate[key])}
                          {over && <span className="text-ink-400"> (+{formatNumber(estimate[key] - ceiling)} mm)</span>}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {cam1Error && <p className="text-xs text-[#d92d20]">{cam1Error}</p>}
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 2: KAMERA 2 - ALPR PELAT NOMOR & MASTER ARMADA   */}
        {/* ========================================================= */}
        <div className="flex flex-col border border-ink-200 bg-ink-50/50 p-3.5">
          <div className="mb-2.5 flex items-center justify-between border-b border-ink-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="rounded bg-ink-900 px-1.5 py-0.5 font-mono text-mono-xs font-semibold text-white">
                CAM 02
              </span>
              <p className="font-medium text-label text-ink-900">Kamera ALPR Gerbang (Pelat & Kabin)</p>
            </div>
            {cam2Fleet && (
              <span
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs font-semibold ${
                  cam2Fleet.identity_status === 'VERIFIED'
                    ? 'bg-[#eaf5ea] text-[#1b7f3b]'
                    : cam2Fleet.identity_status === 'MISMATCH_ALERT'
                    ? 'bg-[#fef3f2] text-[#d92d20] animate-pulse'
                    : 'bg-ink-200 text-ink-800'
                }`}
              >
                {cam2Fleet.identity_status === 'VERIFIED' && <ShieldCheckIcon size={13} />}
                {cam2Fleet.identity_status === 'MISMATCH_ALERT' && <WarningCircleIcon size={13} />}
                {cam2Fleet.identity_status}
              </span>
            )}
          </div>

          {/* Media Viewport */}
          <div>
            {cam2Url ? (
              <div className="relative aspect-video w-full overflow-hidden bg-ink-950">
                {cam2Type === 'video' ? (
                  <video
                    ref={cam2MediaRef}
                    src={cam2Url}
                    controls
                    autoPlay
                    muted
                    playsInline
                    onLoadedData={() => scanCam2Once()}
                    onSeeked={() => scanCam2Once()}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                ) : (
                  <img
                    ref={cam2MediaRef}
                    src={cam2Url}
                    alt="Kamera 2: Pelat Nomor"
                    onLoad={() => scanCam2Once()}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                )}
              </div>
            ) : (
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  pickCam2File(e.dataTransfer.files?.[0])
                }}
                className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-ink-300 bg-white text-center transition-colors hover:bg-ink-100/70"
              >
                <IdentificationCardIcon size={26} className="text-ink-400" aria-hidden />
                <span className="text-body font-medium text-ink-900">Foto / Video Depan Truk (Pelat)</span>
                <span className="text-mono-xs text-ink-400">Automatic License Plate Recognition (ALPR)</span>
                <span className="mt-1 rounded-veto bg-ink-900 px-3 py-1 text-label text-white">
                  Pilih Media Pelat
                </span>
                <input
                  type="file"
                  accept="video/*,image/*"
                  className="sr-only"
                  onChange={(e) => pickCam2File(e.target.files?.[0])}
                />
              </label>
            )}

            {cam2Url && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="truncate font-mono text-mono-xs text-ink-500">{cam2FileName}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={scanCam2Once}
                    className="rounded border border-ink-200 bg-white px-2 py-0.5 text-xs text-ink-800 hover:bg-ink-50"
                  >
                    Pindai Ulang
                  </button>
                  <button
                    type="button"
                    onClick={clearCam2}
                    className="text-xs text-ink-500 hover:text-ink-900"
                  >
                    Ganti
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ALPR & Master Armada Identity Card */}
          <div className="mt-3 space-y-2.5">
            {cam2Fleet ? (
              <div className="rounded border border-ink-200 bg-white p-2.5">
                {/* Plate Badge & Vehicle Model */}
                <div className="flex items-center gap-3">
                  <div className="rounded border-2 border-ink-900 bg-black px-2.5 py-1 text-center font-mono font-bold tracking-wider text-white shadow-sm">
                    <span className="text-base text-yellow-400">
                      {cam2Alpr?.license_plate || cam2Fleet.license_plate || 'PELAT TERTUTUP'}
                    </span>
                  </div>
                  <div>
                    {cam2Fleet.vehicle_model ? (
                      <>
                        <p className="font-semibold text-ink-900">{cam2Fleet.vehicle_model}</p>
                        <p className="text-mono-xs text-ink-500">{cam2Fleet.vendor_name}</p>
                      </>
                    ) : cam2Fleet.license_plate ? (
                      <>
                        <p className="text-xs font-medium text-ink-600">Tidak Terdaftar di Master Armada</p>
                        <p className="text-mono-xs text-ink-400">Armada Luar / Belum Terdata</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-medium text-ink-600">Pelat Nomor Tidak Terbaca</p>
                        <p className="text-mono-xs text-ink-400">Arahkan kamera ke bagian depan & pelat nomor</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Fraud Alert Banner */}
                {cam2Fleet.fraud_warning && (
                  <div className="mt-2 rounded border border-[#fda29b] bg-[#fef3f2] p-2 text-label text-[#d92d20]">
                    <div className="flex items-start gap-1.5">
                      <WarningCircleIcon size={16} className="mt-0.5 shrink-0" />
                      <p className="text-xs font-medium leading-snug">{cam2Fleet.fraud_warning}</p>
                    </div>
                  </div>
                )}

                {/* Fleet Technical Data - Only show if vehicle is registered; hide body type if no plate detected */}
                {cam2Fleet.vehicle_model ? (
                  <div className="mt-2.5 grid grid-cols-2 gap-1.5 border-t border-ink-200 pt-2 text-xs">
                    <div>
                      <span className="text-ink-400">Bentuk Kamera:</span>{' '}
                      <span className="font-medium text-ink-800">{cam2Alpr?.detected_body_type || '–'}</span>
                    </div>
                    <div>
                      <span className="text-ink-400">Karoseri KIR:</span>{' '}
                      <span className="font-medium text-ink-800">{cam2Fleet.registered_body_type || '–'}</span>
                    </div>
                    <div>
                      <span className="text-ink-400">Sumbu Resmi:</span>{' '}
                      <span className="font-mono font-medium text-ink-900">{cam2Fleet.axle_config || '–'}</span>
                    </div>
                    <div>
                      <span className="text-ink-400">Berat Kosong:</span>{' '}
                      <span className="font-medium text-ink-900">
                        {cam2Fleet.tare_weight_kg ? `${formatNumber(cam2Fleet.tare_weight_kg)} kg` : '–'}
                      </span>
                    </div>
                  </div>
                ) : cam2Fleet.license_plate ? (
                  <div className="mt-2.5 border-t border-ink-200 pt-2 text-xs text-ink-500">
                    <span className="text-ink-400">Bentuk Kamera:</span>{' '}
                    <span className="font-medium text-ink-800">{cam2Alpr?.detected_body_type || '–'}</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center rounded border border-dashed border-ink-200 bg-white p-3 text-center">
                <p className="text-xs text-ink-400">
                  Upload foto/video depan truk untuk membaca pelat nomor (ALPR) dan menarik data Master Armada resmi.
                </p>
              </div>
            )}

            {cam2Latency && (
              <p className="font-mono text-mono-xs text-ink-400">
                Latensi ALPR: {cam2Latency} ms {cam2Alpr?.plate_confidence ? `· Keyakinan: ${(cam2Alpr.plate_confidence * 100).toFixed(0)}%` : ''}
              </p>
            )}
            {cam2Error && <p className="text-xs text-[#d92d20]">{cam2Error}</p>}
          </div>
        </div>
      </div>

      {/* Bottom Integration Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 bg-ink-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <Toggle checked={autoSync} onChange={setAutoSync}>
            Sinkron otomatis ke Form Dispatch
          </Toggle>
          <Toggle checked={fillWeights} onChange={setFillWeights}>
            Isi contoh beban muatan saat sinkron
          </Toggle>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!cam2Fleet || cam2Fleet.identity_status !== 'VERIFIED'}
            onClick={() => applyDataToForm(cam1Settled, cam2Fleet, true)}
            className="rounded-veto bg-ink-900 px-4 py-2 text-label font-medium text-white transition-colors hover:bg-ink-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {cam2Fleet?.identity_status === 'VERIFIED'
              ? cam1Settled
                ? 'Terapkan Data Truk & Dimensi ke Form'
                : 'Terapkan Spesifikasi Truk ke Form'
              : 'Menunggu Pelat Terverifikasi di CAM 02'}
          </button>
        </div>
      </div>

      {appliedNotice && (
        <div className="border-t border-ink-100 bg-white px-4 py-2">
          <p
            className={`text-xs font-medium ${
              appliedNotice.startsWith('Tersinkron') ? 'text-[#2f8f4e]' : 'text-[#b54708]'
            }`}
          >
            {appliedNotice.startsWith('Tersinkron') ? `✓ ${appliedNotice}` : `⚠ ${appliedNotice}`}
          </p>
        </div>
      )}
    </section>
  )
}

function Telemetry({ label, value }) {
  return (
    <div>
      <dt className="font-mono text-mono-xs text-ink-400">{label}</dt>
      <dd className="tnum text-xs font-semibold text-ink-900">{value}</dd>
    </div>
  )
}

function Toggle({ checked, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-700">
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

function drawOverlay(canvas, media, result) {
  if (!canvas || !media) return
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(rect.width * dpr)
  canvas.height = Math.round(rect.height * dpr)
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, rect.width, rect.height)
  if (!result?.predictions?.length) return

  const mediaWidth = media.videoWidth || media.naturalWidth || media.width || 0
  const mediaHeight = media.videoHeight || media.naturalHeight || media.height || 0
  if (!mediaWidth || !mediaHeight) return

  const fit = Math.min(rect.width / mediaWidth, rect.height / mediaHeight)
  const offsetX = (rect.width - mediaWidth * fit) / 2
  const offsetY = (rect.height - mediaHeight * fit) / 2
  const toDisplay = fit * (mediaWidth / result.imageWidth)

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
