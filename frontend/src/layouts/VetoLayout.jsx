import { NavLink, Outlet } from 'react-router-dom'

import VetoMark from '@/components/VetoMark'

/**
 * Chrome for VETO's own surfaces.
 *
 * One light ground across every VETO surface. Graphite was tried for the
 * instrumentation surfaces and read as out of place; density, hairlines and
 * mono carry the instrument character instead of darkness. DESIGN.md §1.
 */

const LINKS = [
  { to: '/rule-studio', label: 'Rule Studio' },
  { to: '/audit', label: 'Jejak Audit' },
]

export default function VetoLayout() {
  return (
    <div className="min-h-[calc(100dvh-2.75rem)] bg-paper text-ink-900">
      <nav className="flex items-center gap-1 border-b border-ink-200 bg-white px-4 py-1.5">
        {/* Identity sits at the head of VETO's own chrome, ahead of the surface
            links, so both Rule Studio and Jejak Audit carry it without either
            page having to draw its own. Ink, not brand blue: DESIGN.md §8. */}
        <span className="mr-3 flex items-center gap-2">
          <VetoMark className="h-3.5 w-auto text-ink-900" title="VETO" />
          <span className="text-label font-semibold tracking-[-0.01em] text-ink-900">VETO</span>
        </span>
        <span aria-hidden className="mr-3 h-4 w-px bg-ink-200" />
        {LINKS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'rounded-veto px-2.5 py-1 text-label transition-colors',
                isActive ? 'bg-ink-100 text-ink-900' : 'text-ink-500 hover:text-ink-900',
              ].join(' ')
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}
