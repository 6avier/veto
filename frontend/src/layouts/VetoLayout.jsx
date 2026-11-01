import { ClipboardTextIcon, ListChecksIcon } from '@phosphor-icons/react'
import { NavLink, Outlet } from 'react-router-dom'

import VetoMark from '@/components/VetoMark'

/**
 * Chrome for VETO's own surfaces.
 *
 * VETO's console: Satoshi, white panels on a near-white ground, one blue for
 * action and focus. The ERP keeps 72 and its green, so the two systems still
 * read as two products when the demo switches between them. DESIGN.md §1.
 */

const LINKS = [
  { to: '/rule-studio', label: 'Rule Studio', Icon: ListChecksIcon },
  { to: '/audit', label: 'Jejak Audit', Icon: ClipboardTextIcon },
]

export default function VetoLayout() {
  return (
    <div className="min-h-[calc(100dvh-2.75rem)] bg-console font-satoshi font-medium text-ink-900">
      <div className="mx-auto max-w-[1400px] px-4 pt-4">
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[22px] border border-ink-100 bg-white px-4 py-2.5 shadow-[0_1px_2px_rgba(13,21,38,0.04),0_6px_20px_-10px_rgba(13,21,38,0.1)]">
          <span className="flex items-center gap-2 pl-1">
            <VetoMark className="h-5 w-auto" title="VETO" />
            <span className="text-[19px] font-extrabold tracking-[-0.02em]">VETO</span>
          </span>
          <span className="flex gap-1">
            {LINKS.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2 rounded-[13px] px-3.5 py-2 text-[14px] font-bold transition-colors',
                    isActive
                      ? 'bg-accent text-white'
                      : 'text-ink-500 hover:bg-console hover:text-ink-900',
                  ].join(' ')
                }
              >
                <Icon size={18} aria-hidden />
                {label}
              </NavLink>
            ))}
          </span>
        </nav>
      </div>

      <Outlet />
    </div>
  )
}
