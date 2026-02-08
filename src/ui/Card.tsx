import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-[#e5dccf] bg-[#fffdf9] p-4 ${className}`}>{children}</div>
}

