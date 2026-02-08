import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  children: ReactNode
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#2e4a5c]/30'

const variants: Record<NonNullable<Props['variant']>, string> = {
  // Brand direction: calm, soft contrast, muted accent (use sparingly).
  primary: 'bg-[#2e4a5c] text-white hover:bg-[#355a70]',
  secondary: 'bg-[#f2ebe0] text-[#2b2a28] hover:bg-[#eadfce] border border-[#e5dccf]',
  danger: 'bg-[#b84a4a] text-white hover:bg-[#c65a5a]',
  ghost: 'bg-transparent text-[#2b2a28] hover:bg-[#f2ebe0]',
}

export function Button({ variant = 'primary', className = '', ...props }: Props) {
  return <button {...props} className={`${base} ${variants[variant]} ${className}`} />
}

