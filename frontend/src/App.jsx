import { NavLink, Outlet } from 'react-router-dom'
import { USE_MOCKS } from '@/api'

const NAV = [
  { to: '/dispatch', label: 'Dispatch', owner: 'frontend lane' },
  { to: '/rule-studio', label: 'Rule Studio', owner: 'rule studio lane' },
  { to: '/audit', label: 'Audit Log', owner: 'frontend lane' },
]

export default function App() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="border-b border-neutral-200">
        <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
          <span className="font-semibold tracking-tight">VETO</span>
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                isActive ? 'text-neutral-900 underline underline-offset-4' : 'text-neutral-500 hover:text-neutral-900'
              }
            >
              {label}
            </NavLink>
          ))}
          {USE_MOCKS && (
            <span className="ml-auto rounded bg-amber-100 px-2 py-1 font-mono text-xs text-amber-900">
              MOCKS ON
            </span>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
