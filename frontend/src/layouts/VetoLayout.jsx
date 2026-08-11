import { NavLink, Outlet } from 'react-router-dom'

/**
 * Chrome for VETO's own surfaces.
 *
 * Rule Studio is the register (light); the audit trail is instrumentation
 * (dark). Each route owns its ground; this layout only carries the sub-nav.
 */

const LINKS = [
  { to: '/rule-studio', label: 'Rule Studio' },
  { to: '/audit', label: 'Jejak Audit' },
]

export default function VetoLayout() {
  return (
    <div className="min-h-[calc(100dvh-2.75rem)] bg-ink-900">
      <nav className="flex gap-1 border-b border-ink-800 px-4 py-1.5">
        {LINKS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'rounded-veto px-2.5 py-1 text-label transition-colors',
                isActive ? 'text-ink-100' : 'text-ink-400 hover:text-ink-200',
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
