import {
  ChartBarIcon,
  ClipboardTextIcon,
  HouseIcon,
  SignOutIcon,
  TruckIcon,
  WarehouseIcon,
} from '@phosphor-icons/react'
import { Outlet } from 'react-router-dom'

import nusantaraLogo from '@/assets/brand/nusantara-wms.png'

/**
 * Chrome for the client's warehouse system.
 *
 * DESIGN.md §1 — this is the host, not VETO. It gets its own identity: SAP 72,
 * the SAP Fiori typeface, over the forest green sampled from the proposal's WMS
 * mockup (#2d613b). Real enterprise typography, so the surface reads as
 * software someone already uses.
 *
 * No monospace anywhere in this chrome. Mono set in uppercase with wide
 * tracking is a terminal signature, and no shipping ERP uses it.
 *
 * That green is the documented exception to VETO's one-accent lock. It belongs
 * to NUSANTARA WMS, and it earns its place by making VETO's amber unmistakably
 * foreign to this system.
 *
 * The green used to be a top strip with a separate white tab row beneath it.
 * It is now a single left rail carrying both, which is the shape warehouse and
 * logistics consoles actually take, and buys back two horizontal bars of
 * vertical space on the surface where the dispatch form lives. DESIGN.md §1's
 * retired "green sidebar" note is about not distinguishing VETO from the ERP by
 * hue; this is the host's own chrome relocated, so that rule is untouched.
 */

const NAV = [
  { label: 'Beranda', Icon: HouseIcon },
  { label: 'Pesanan', Icon: ClipboardTextIcon },
  { label: 'Gudang', Icon: WarehouseIcon },
  { label: 'Pengiriman', Icon: TruckIcon },
  { label: 'Laporan', Icon: ChartBarIcon },
]
const ACTIVE = 'Pengiriman'

const OPERATOR = { name: 'Budi Santoso', role: 'Petugas Gudang', initials: 'BS' }

export default function ErpLayout() {
  return (
    <div className="flex min-h-[calc(100dvh-2.75rem)] bg-[#eef0f2] font-erp text-[#1f2933]">
      {/* The green is painted by this column, which stretches the full page,
          rather than by the sticky nav inside it. The nav is one viewport tall,
          so at the bottom of a long scroll it would otherwise leave a sliver of
          page ground showing under the rail. */}
      <div className="w-16 shrink-0 bg-[#2d613b]">
      <nav
        aria-label="Navigasi NUSANTARA WMS"
        className="sticky top-0 flex h-[calc(100dvh-2.75rem)] w-16 flex-col items-center gap-1 py-3"
      >
        <RailBrand />

        <span aria-hidden className="my-2 h-px w-8 bg-white/20" />

        {NAV.map(({ label, Icon }) => (
          <RailItem key={label} label={label} Icon={Icon} active={label === ACTIVE} />
        ))}

        <div className="mt-auto flex flex-col items-center gap-1">
          <RailItem label="Keluar" Icon={SignOutIcon} />
          <span aria-hidden className="my-1 h-px w-8 bg-white/20" />
          <RailOperator />
        </div>
      </nav>
      </div>

      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}

/**
 * The rail's items are not links. There is no Beranda or Laporan surface to
 * route to, and inventing dead routes would be worse than admitting it, so
 * these are inert `span`s: no `href`, no button role, and the default cursor
 * rather than a pointer that promises a destination.
 *
 * They still lift on hover. The host is meant to feel like live software rather
 * than a screenshot, and the lift plus the label flyout is what sells that
 * without claiming the item does something. Because the item is inert, the
 * flyout is the only way its name is ever legible, so it is also the reason the
 * icon-only rail stays readable at the booth.
 */
function RailItem({ label, Icon, active = false }) {
  return (
    <span className="group relative flex cursor-default items-center">
      <span
        aria-current={active ? 'page' : undefined}
        className={[
          'flex h-10 w-10 items-center justify-center rounded-veto transition-[transform,background-color,color] duration-150 ease-out',
          'group-hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none',
          active
            ? 'bg-white/15 text-white'
            : 'text-white/65 group-hover:bg-white/10 group-hover:text-white',
        ].join(' ')}
      >
        <Icon size={20} weight={active ? 'fill' : 'regular'} aria-hidden />
        <span className="sr-only">{label}</span>
      </span>

      {/* Flyout, not a tooltip attribute: `title` waits a second and renders in
          the OS font, which reads as an unstyled browser default rather than
          part of the product. DESIGN.md §8 bans pills, so this is a plain
          hairline plate at the rail's own radius. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-full z-20 ml-2 origin-left whitespace-nowrap rounded-veto border border-[#c9ced4] bg-white px-2 py-1 text-label text-[#1f2933] opacity-0 shadow-[0_2px_8px_rgba(31,41,51,0.14)] transition-opacity duration-150 ease-out group-hover:opacity-100"
      >
        {label}
      </span>
    </span>
  )
}

/**
 * Brand mark. The rail is too narrow for "NUSANTARA WMS", so the full name
 * rides the same flyout the nav items use. Version string goes with it: it is
 * the kind of detail real enterprise software always shows and no mockup ever
 * remembers.
 *
 * The host's own logo, placed whole at the owner's instruction rather than
 * cropped to its monogram. The artwork is a square lockup with its wordmark
 * underneath, so at 40px the wordmark is present but not readable; the flyout
 * and the screen-reader label carry the name. The plate stays white because
 * the artwork carries a white ground of its own.
 */
function RailBrand() {
  return (
    <span className="group relative flex cursor-default items-center">
      <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-veto bg-white">
        <img
          src={nusantaraLogo}
          width={256}
          height={256}
          alt=""
          aria-hidden
          className="h-full w-full object-contain"
          draggable={false}
        />
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute left-full z-20 ml-2 whitespace-nowrap rounded-veto border border-[#c9ced4] bg-white px-2 py-1 text-label text-[#1f2933] opacity-0 shadow-[0_2px_8px_rgba(31,41,51,0.14)] transition-opacity duration-150 ease-out group-hover:opacity-100"
      >
        NUSANTARA WMS <span className="text-[#6b757f]">v4.2.1</span>
      </span>
      <span className="sr-only">NUSANTARA WMS versi 4.2.1</span>
    </span>
  )
}

/**
 * Who is signed in. DESIGN.md §1 puts the operator in the host's chrome rather
 * than in the shell, and the rail is now that chrome. The warehouse is named
 * here too because the top strip used to carry it and the rail is the only
 * place left that belongs to the host rather than to a page.
 */
function RailOperator() {
  return (
    <span className="group relative flex cursor-default items-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-veto border border-white/25 bg-white/10 text-label font-semibold text-white transition-transform duration-150 ease-out group-hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none">
        {OPERATOR.initials}
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-full z-20 ml-2 whitespace-nowrap rounded-veto border border-[#c9ced4] bg-white px-2 py-1.5 text-label leading-tight text-[#1f2933] opacity-0 shadow-[0_2px_8px_rgba(31,41,51,0.14)] transition-opacity duration-150 ease-out group-hover:opacity-100"
      >
        <span className="block font-semibold">{OPERATOR.name}</span>
        <span className="block text-[#6b757f]">{OPERATOR.role}</span>
        <span className="mt-1 block border-t border-[#e3e6e9] pt-1 text-[#6b757f]">
          Gudang Cikarang 01
        </span>
      </span>
      <span className="sr-only">
        {OPERATOR.name}, {OPERATOR.role}, Gudang Cikarang 01
      </span>
    </span>
  )
}
