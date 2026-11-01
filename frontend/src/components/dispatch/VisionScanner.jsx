import {
  IdentificationCardIcon,
  ShieldCheckIcon,
  VideoCameraIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'

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

export default function VisionScanner({ form, limits, onApply, aside }) {
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
      // A single-axle config would divide by zero and write NaN into the form.
      const rear = Math.max(1, count - 1)

      axleLoads = Array.from({ length: count }, (_, i) => {
        if (count === 1) return String(Math.round((tare + payloadWeight) / 50) * 50)
        const baseAxle = i === 0 ? Math.round(tare * 0.45) : Math.round((tare * 0.55) / rear)
        const load = baseAxle + (i === 0 ? Math.round(perAxlePayload * 0.25) : Math.round((perAxlePayload * 1.75) / rear))
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
    const canvas = captureFrame(media, 800)
    if (!canvas) return

    cam1InFlight.current = true
    let next = null
    try {
      cam1AbortRef.current = new AbortController()
      // If CAM 02 doesn't have a verified plate yet and this is an image or user trigger, attempt ALPR from CAM 01 as well
      const shouldCheckAlpr = !cam2FleetRef.current
      next = await inferVisionFrame(canvas, cam1AbortRef.current.signal, shouldCheckAlpr)
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

    // If ALPR plate was detected from CAM 01 and CAM 02 was empty, sync to CAM 02 state
    if (!cam2FleetRef.current && next.fleetMatch?.license_plate) {
      setCam2Alpr(next.alpr)
      setCam2Fleet(next.fleetMatch)
      cam2FleetRef.current = next.fleetMatch
    }

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
    // Capture at high resolution (1024px) so small license plate text remains crisp and readable by OCR
    const canvas = captureFrame(media, 1024)
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

  const plate = cam2Alpr?.license_plate || cam2Fleet?.license_plate

  // Laid out like a dock: CAM-01's side view on the left; on the right, the
  // declared load the page passes in as `aside`, with the gate camera's plate
  // read as a strip beneath it. Detection logic is unchanged.
  return (
    <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* ===================== CAM-01: SIDE / DIMENSION ===================== */}
      <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl bg-[#0b0e12] text-[#d6dee8] shadow-[0_1px_2px_rgba(17,24,39,0.04),0_8px_24px_-12px_rgba(17,24,39,0.12)]">
        <div className="flex items-center gap-2 px-4 py-2.5 font-mono text-[12px]">
          <span className={`h-2 w-2 rounded-full ${cam1Result ? 'bg-[#2f8f4e]' : 'bg-white/25'}`} aria-hidden />
          <b className="font-semibold text-white">CAM-01 Sisi</b>
          <span className="text-white/45">Dimensi muatan</span>
          {cam1Settled && (
            <span
              className="ml-auto rounded-md px-2 py-0.5 font-sans text-[12px] font-bold text-white"
              style={{ background: colour }}
            >
              {overload ? 'Kemungkinan overload' : 'Normal'}
            </span>
          )}
        </div>

        {cam1Url ? (
          <div className="relative min-h-[240px] w-full flex-1 overflow-hidden bg-black">
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
            className="mx-3 flex min-h-[220px] flex-1 cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 text-center transition-colors hover:bg-white/5"
          >
            <VideoCameraIcon size={26} className="text-white/50" aria-hidden />
            <span className="font-sans text-[14px] font-semibold text-white">Foto atau video sisi truk</span>
            <span className="text-[12px] text-white/50">Deteksi siluet dan over-dimension</span>
            <span className="mt-1 rounded-lg bg-white px-3 py-1.5 font-sans text-[13px] font-semibold text-[#111827]">
              Pilih media
            </span>
            <input
              type="file"
              accept="video/*,image/*"
              className="sr-only"
              onChange={(e) => pickCam1File(e.target.files?.[0])}
            />
          </label>
        )}

        <div className="grid gap-2 px-4 py-3 font-mono text-[12px]">
          <dl className="flex flex-wrap items-end gap-x-6 gap-y-1">
            <Telemetry label="KEYAKINAN" value={top ? `${formatNumber((top.confidence * 100).toFixed(1))}%` : '–'} />
            <Telemetry label="FRAME" value={formatNumber(cam1Frames)} />
            <Telemetry label="LATENSI" value={cam1Result ? `${formatNumber(cam1Result.latencyMs)} ms` : '–'} />
            {cam1Url && (
              <div className="ml-auto flex items-center gap-3 font-sans text-[12px]">
                <span className="max-w-[16ch] truncate text-white/45">{cam1FileName}</span>
                <button type="button" onClick={scanCam1Once} className="font-semibold text-white hover:underline">
                  Pindai ulang
                </button>
                <button type="button" onClick={clearCam1} className="font-semibold text-white/60 hover:text-white">
                  Ganti
                </button>
              </div>
            )}
          </dl>

          {estimate && (
            <ul className="flex flex-wrap gap-x-5 gap-y-1 border-t border-white/10 pt-2">
              {[
                ['Panjang', 'length'],
                ['Lebar', 'width'],
                ['Tinggi', 'height'],
              ].map(([label, key]) => {
                const ceiling = limits[key]?.threshold
                const over = ceiling && estimate[key] > ceiling
                return (
                  <li key={key}>
                    <span className="text-white/45">{label} </span>
                    <span className={over ? 'font-semibold text-[#ff8a7a]' : 'text-white'}>
                      {formatMm(estimate[key])}
                      {over && ` (+${formatNumber(estimate[key] - ceiling)})`}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          {cam1Error && <p className="font-sans text-[12px] text-[#ff8a7a]">{cam1Error}</p>}
        </div>

        {/* Sync to the form */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 px-4 py-3">
          <Toggle checked={autoSync} onChange={setAutoSync}>
            Sinkron otomatis
          </Toggle>
          <Toggle checked={fillWeights} onChange={setFillWeights}>
            Isi contoh beban
          </Toggle>
          <button
            type="button"
            disabled={!cam2Fleet || cam2Fleet.identity_status !== 'VERIFIED'}
            onClick={() => applyDataToForm(cam1Settled, cam2Fleet, true)}
            className="ml-auto h-9 rounded-[10px] border border-white/20 px-3 text-[13px] font-semibold text-white transition-[background-color,transform] hover:bg-white/10 motion-safe:enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {cam2Fleet?.identity_status === 'VERIFIED'
              ? cam1Settled
                ? 'Terapkan truk & dimensi'
                : 'Terapkan data truk'
              : 'Menunggu pelat terverifikasi'}
          </button>
          {appliedNotice && (
            <p
              className={`w-full text-[12px] font-medium ${
                appliedNotice.startsWith('Tersinkron') ? 'text-[#7fdc9b]' : 'text-[#f2a93b]'
              }`}
            >
              {appliedNotice.startsWith('Tersinkron') ? `✓ ${appliedNotice}` : `⚠ ${appliedNotice}`}
            </p>
          )}
        </div>
      </section>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-1 flex-col [&>*]:flex-1">{aside}</div>

        {/* ===================== CAM-02: GATE / PLATE ===================== */}
        <section className="flex min-w-0 items-stretch overflow-hidden rounded-2xl bg-[#0b0e12] text-[#d6dee8]">
          <div className="w-32 shrink-0 border-r border-white/10 bg-black sm:w-40">
            {cam2Url ? (
              <div className="relative h-full min-h-[112px] w-full overflow-hidden">
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
                className="flex h-full min-h-[112px] w-full cursor-pointer focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-accent flex-col items-center justify-center gap-1.5 text-center transition-colors hover:bg-white/5"
              >
                <IdentificationCardIcon size={22} className="text-white/50" aria-hidden />
                <span className="text-[12.5px] font-semibold text-white">Foto depan truk</span>
                <span className="rounded-md bg-white px-2 py-1 text-[12px] font-semibold text-[#111827]">Pilih media</span>
                <input
                  type="file"
                  accept="video/*,image/*"
                  className="sr-only"
                  onChange={(e) => pickCam2File(e.target.files?.[0])}
                />
              </label>
            )}
          </div>

          <div className="grid min-w-0 flex-1 content-center gap-1.5 px-4 py-3">
            <p className="flex items-center gap-2 font-mono text-[12px] text-white/45">
              <span className={`h-2 w-2 rounded-full ${cam2Fleet ? 'bg-[#2f8f4e]' : 'bg-white/25'}`} aria-hidden />
              CAM-02 Gerbang
              {cam2Latency && (
                <span>
                  · {cam2Latency} ms
                  {cam2Alpr?.plate_confidence ? ` · ${(cam2Alpr.plate_confidence * 100).toFixed(0)}%` : ''}
                </span>
              )}
            </p>

            {cam2Fleet ? (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <b className="font-mono text-[22px] font-semibold tracking-[0.06em] text-white">
                    {plate || 'Pelat tidak terbaca'}
                  </b>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-bold ${
                      cam2Fleet.identity_status === 'VERIFIED'
                        ? 'bg-[#2f8f4e]/20 text-[#7fdc9b]'
                        : cam2Fleet.identity_status === 'MISMATCH_ALERT'
                        ? 'bg-[#d92d20]/25 text-[#ff8a7a]'
                        : 'bg-white/10 text-white/70'
                    }`}
                  >
                    {cam2Fleet.identity_status === 'VERIFIED' && <ShieldCheckIcon size={13} aria-hidden />}
                    {cam2Fleet.identity_status === 'MISMATCH_ALERT' && <WarningCircleIcon size={13} aria-hidden />}
                    {cam2Fleet.identity_status === 'VERIFIED'
                      ? 'Terdaftar di Master Armada'
                      : cam2Fleet.identity_status === 'MISMATCH_ALERT'
                      ? 'Tidak cocok'
                      : cam2Fleet.license_plate
                      ? 'Belum terdaftar'
                      : 'Tidak terbaca'}
                  </span>
                </div>
                {cam2Fleet.vehicle_model && (
                  <p className="text-[12.5px] text-white/70">
                    {cam2Fleet.vehicle_model} · {cam2Fleet.axle_config || '–'} · kosong{' '}
                    {cam2Fleet.tare_weight_kg ? `${formatNumber(cam2Fleet.tare_weight_kg)} kg` : '–'}
                    {cam2Alpr?.detected_body_type && ` · kamera: ${cam2Alpr.detected_body_type}`}
                  </p>
                )}
                {cam2Fleet.fraud_warning && (
                  <p className="text-[12.5px] font-semibold text-[#ff8a7a]">{cam2Fleet.fraud_warning}</p>
                )}
              </>
            ) : (
              <p className="text-[13px] text-white/60">Pelat dibaca dari kamera gerbang, lalu dicocokkan ke Master Armada.</p>
            )}

            {cam2Url && (
              <p className="flex items-center gap-3 text-[12px]">
                <span className="max-w-[18ch] truncate text-white/45">{cam2FileName}</span>
                <button type="button" onClick={scanCam2Once} className="font-semibold text-white hover:underline">
                  Pindai ulang
                </button>
                <button type="button" onClick={clearCam2} className="font-semibold text-white/60 hover:text-white">
                  Ganti
                </button>
              </p>
            )}
            {cam2Error && <p className="text-[12px] text-[#ff8a7a]">{cam2Error}</p>}
          </div>
        </section>
      </div>
    </div>
  )
}

function Telemetry({ label, value }) {
  return (
    <div>
      <dt className="text-white/45">{label}</dt>
      <dd className="font-semibold tabular-nums text-white">{value}</dd>
    </div>
  )
}

function Toggle({ checked, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-white/70">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-[#1f74e0]"
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
