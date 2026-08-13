import { NavLink, Outlet, useLocation } from 'react-router-dom'

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
