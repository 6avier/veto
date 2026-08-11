import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { USE_MOCKS } from '@/api'

/**
 * The shell. Two products share it: the client's ERP and VETO.
 *
 * DESIGN.md §1 — the segmented control is visible at all times so nobody has to
 * be told there are two systems. The chrome stays constant while the content
 * changes completely, which is what makes the switch legible.
 */

const VETO_PATHS = ['/rule-studio', '/audit']

// The shell switches products and does nothing else. Who is signed in belongs
// to the system they are signed into, so the operator's name lives in the ERP
// chrome. DESIGN.md §1.

export default function App() {
  const { pathname } = useLocation()
  const inVeto = VETO_PATHS.some((path) => pathname.startsWith(path))

  return (
    <div className="min-h-[100dvh] bg-ink-950 font-sans text-ink-100">
      <header className="flex h-11 items-center gap-4 border-b border-ink-800 px-4">
        <div className="flex" role="group" aria-label="Pilih sistem">
          <SystemTab to="/dispatch" active={!inVeto}>
            Client ERP
          </SystemTab>
          <SystemTab to="/rule-studio" active={inVeto}>
            VETO
          </SystemTab>
        </div>

        {USE_MOCKS && (
          <span
            className="ml-auto rounded-veto border border-ink-700 px-1.5 py-0.5 font-mono text-mono-xs text-ink-400"
            title="Berjalan dengan data contoh, tanpa backend"
          >
            MOCKS
          </span>
        )}
      </header>

      <Outlet />
    </div>
  )
}

function SystemTab({ to, active, children }) {
  return (
    <NavLink
      to={to}
      aria-current={active ? 'page' : undefined}
      className={[
        'rounded-veto px-3 py-1 text-label transition-colors',
        active ? 'bg-ink-100 text-ink-950' : 'text-ink-400 hover:text-ink-200',
      ].join(' ')}
    >
      {children}
    </NavLink>
  )
}
