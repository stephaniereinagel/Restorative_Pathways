import { forwardRef, type TextareaHTMLAttributes } from 'react'

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea({ className = '', ...props }, ref) {
  return (
    <textarea
      {...props}
      ref={ref}
      className={`w-full rounded-xl border border-[#e5dccf] bg-[#fffdf9] px-3 py-2 text-sm text-[#2b2a28] placeholder:text-[#9a9287] focus:outline-none focus:ring-2 focus:ring-[#2e4a5c]/25 ${className}`}
    />
  )
})

