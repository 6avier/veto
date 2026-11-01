import {
  ChartBarIcon,
  ClipboardTextIcon,
  SquaresFourIcon,
  TruckIcon,
  VanIcon,
  WarehouseIcon,
} from '@phosphor-icons/react'
import { Outlet } from 'react-router-dom'

import nusantaraLogo from '@/assets/brand/nusantara-wms.png'

/**
 * Chrome for the client's warehouse system.
 *
 * DESIGN.md §1 — this is the host, not VETO, so it keeps an identity of its
 * own: Plus Jakarta Sans and a sky blue, a different blue from VETO's royal
 * accent so the verdict still reads as a second system arriving inside the
 * first.
 *
 * A white, labelled left rail, which is the shape warehouse consoles take,
 * leaving the full height to the dispatch screen.
 *
 * The items are not links. There is no Beranda or Laporan surface to route to,
 * and inventing dead routes would be worse than admitting it, so they are
 * inert `span`s with the default cursor.
 */

const NAV = [
  { label: 'Beranda', Icon: SquaresFourIcon },
  { label: 'Pesanan', Icon: ClipboardTextIcon },
  { label: 'Inventori', Icon: WarehouseIcon },
  { label: 'Pengiriman', Icon: TruckIcon },
  { label: 'Armada', Icon: VanIcon },
  { label: 'Laporan', Icon: ChartBarIcon },
]
const ACTIVE = 'Pengiriman'

export default function ErpLayout() {
  return (
    <div className="flex min-h-[calc(100dvh-2.75rem)] bg-[#f1f4f8] font-erp text-[#111827]">
      {/*
        The white column stretches the full page height; only the nav inside
        it is sticky. The nav is sized to the viewport less the system bar,
        so once that bar scrolls away it ends 2.75rem short, and without this
        column that strip showed the page grey under the rail.
      */}
      <div className="hidden w-20 shrink-0 border-r border-[#e2e7ee] bg-white sm:block">
        <nav
          aria-label="Navigasi NUSANTARA WMS"
          className="sticky top-0 flex h-[calc(100dvh-2.75rem)] flex-col items-center gap-1 px-1 pb-3.5 pt-4"
        >
          <span className="mb-1.5 grid w-full place-items-center border-b border-[#e2e7ee] pb-3">
            <img
              src={nusantaraLogo}
              width={256}
              height={256}
              alt="NUSANTARA WMS"
              className="h-[38px] w-[38px] rounded-[10px] object-contain"
              draggable={false}
            />
          </span>

          {NAV.map(({ label, Icon }) => {
            const active = label === ACTIVE
            return (
              <span
                key={label}
                aria-current={active ? 'page' : undefined}
                className={[
                  'grid w-full cursor-default justify-items-center gap-1 rounded-[10px] pb-[7px] pt-[9px] text-[12px] font-semibold tracking-[-0.01em] transition-colors',
                  active ? 'bg-[#e7f0fc] text-[#165bb4]' : 'text-[#5b6676] hover:bg-[#f7f9fc] hover:text-[#111827]',
                ].join(' ')}
              >
                <Icon size={20} weight={active ? 'fill' : 'regular'} aria-hidden />
                {label}
              </span>
            )
          })}

          <span
            className="mt-auto grid w-full place-items-center border-t border-[#e2e7ee] pt-3"
            title="Budi Santoso · Petugas Dispatch"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#e7f0fc] text-[12px] font-bold text-[#165bb4]">
              BS
            </span>
            <span className="sr-only">Budi Santoso, Petugas Dispatch, Gudang Cikarang 01</span>
          </span>
        </nav>
      </div>

      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
