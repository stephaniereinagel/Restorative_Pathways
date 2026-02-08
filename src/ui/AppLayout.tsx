import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

function Tab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex-1 rounded-2xl px-3 py-2 text-center text-sm font-semibold transition ${
          isActive ? 'bg-[#e7efe8] text-[#24312a]' : 'text-[#5b554d] hover:bg-[#f2ebe0]'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

export function AppLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-full bg-gradient-to-b from-[#fbf7ef] to-[#f6efe3] text-[#2b2a28]">
      <header className="sticky top-0 z-10 border-b border-[#e5dccf] bg-[#fbf7ef]/90 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-4">
          <img src="/icons/icon-192.png" alt="Restorative Pathways" className="h-8 w-8 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#6b645c]">Restorative Pathways</div>
            <div className="truncate text-base font-extrabold tracking-tight">{title}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-4 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-[#e5dccf] bg-[#fbf7ef]/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-2 px-3 py-3">
          <Tab to="/" label="People" />
          <Tab to="/guide" label="Guide" />
          <Tab to="/settings" label="Settings" />
        </div>
      </nav>
    </div>
  )
}

