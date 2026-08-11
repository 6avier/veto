import { Outlet } from 'react-router-dom'

/**
 * Chrome for the client's warehouse system.
 *
 * DESIGN.md §1 — deliberately unremarkable. Plain, boxy, unfashionable
 * enterprise software. This is not laziness: PRODUCT.md F2 says the officer
 * must not have to learn a new interface, and the only way to show that is to
 * make the host look like software they already put up with.
 *
 * The dull institutional blue below belongs to the ERP, not to VETO. It is the
 * documented exception to the one-accent lock in DESIGN.md §4, and it earns its
 * place by making VETO's amber unmistakably foreign to this system.
 */

const TABS = ['Beranda', 'Pesanan', 'Gudang', 'Pengiriman', 'Laporan']

export default function ErpLayout() {
  return (
    <div className="min-h-[calc(100dvh-2.75rem)] bg-[#eef0f2] text-[#1f2933]">
      <div className="border-b border-[#c9ced4] bg-[#dfe3e7]">
        <div className="flex items-center gap-3 px-4 py-2">
          <span className="text-label font-semibold tracking-tight text-[#2c5d8f]">
            NUSANTARA WMS
          </span>
          <span className="font-mono text-mono-xs text-[#6b757f]">v4.2.1</span>
          <span className="ml-auto font-mono text-mono-xs text-[#6b757f]">
            GUDANG CIKARANG 01
          </span>
          <span className="text-[#c9ced4]">|</span>
          <span className="text-label text-[#4a545e]">Budi Santoso</span>
          <span className="font-mono text-mono-xs text-[#6b757f]">PETUGAS GUDANG</span>
        </div>
        <nav className="flex gap-0 px-2">
          {TABS.map((tab) => (
            <span
              key={tab}
              aria-current={tab === 'Pengiriman' ? 'page' : undefined}
              className={[
                'border-b-2 px-3 py-1.5 text-label',
                tab === 'Pengiriman'
                  ? 'border-[#2c5d8f] text-[#2c5d8f]'
                  : 'border-transparent text-[#5a646e]',
              ].join(' ')}
            >
              {tab}
            </span>
          ))}
        </nav>
      </div>

      <Outlet />
    </div>
  )
}
