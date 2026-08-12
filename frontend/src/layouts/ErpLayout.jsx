import { Outlet } from 'react-router-dom'

/**
 * Chrome for the client's warehouse system.
 *
 * DESIGN.md §1 — this is the host, not VETO. It gets its own identity: the
 * forest green sampled from the proposal's WMS mockup (#2d613b), a real product
 * bar and a live tab row, so it reads as software someone actually uses rather
 * than a grey placeholder.
 *
 * That green is the documented exception to VETO's one-accent lock. It belongs
 * to NUSANTARA WMS, and it earns its place by making VETO's amber unmistakably
 * foreign to this system.
 */

const TABS = ['Beranda', 'Pesanan', 'Gudang', 'Pengiriman', 'Laporan']
const ACTIVE = 'Pengiriman'

export default function ErpLayout() {
  return (
    <div className="min-h-[calc(100dvh-2.75rem)] bg-[#eef0f2] text-[#1f2933]">
      <div className="bg-[#2d613b] text-white">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
          <span className="text-label font-semibold tracking-tight">NUSANTARA WMS</span>
          <span className="font-mono text-mono-xs text-white/60">v4.2.1</span>
          <span className="ml-auto font-mono text-mono-xs text-white/60">
            GUDANG CIKARANG 01
          </span>
          <span aria-hidden className="h-3.5 w-px bg-white/25" />
          <span className="text-label">Budi Santoso</span>
          <span className="font-mono text-mono-xs text-white/60">PETUGAS GUDANG</span>
        </div>
      </div>

      <div className="border-b border-[#c9ced4] bg-white">
        <nav className="flex gap-0 px-2">
          {TABS.map((tab) => {
            const active = tab === ACTIVE
            return (
              <span
                key={tab}
                aria-current={active ? 'page' : undefined}
                className={[
                  'border-b-2 px-3.5 py-2 text-label transition-colors',
                  active
                    ? 'border-[#2d613b] font-medium text-[#1f4a2a]'
                    : 'border-transparent text-[#5a646e] hover:border-[#c9ced4] hover:text-[#1f2933]',
                ].join(' ')}
              >
                {tab}
              </span>
            )
          })}
        </nav>
      </div>

      <Outlet />
    </div>
  )
}
