import { NavLink, Outlet } from 'react-router-dom'

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
      <nav className="flex gap-1 border-b border-ink-200 bg-white px-4 py-1.5">
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
