import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'min-h-12 w-full rounded-[10px] border border-[#3a3a3a] bg-ink px-3.5 text-base text-ivory placeholder:text-[#8a8a8a]',
        'aria-[invalid=true]:border-2 aria-[invalid=true]:border-[#f87171]',
        className,
      )}
      {...props}
    />
  )
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  // Composant générique : l'appelant fournit htmlFor (ou y place le champ), d'où la règle désactivée ICI seulement
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  return <label className={cn('text-sm font-semibold', className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn('w-full rounded-[10px] border border-[#3a3a3a] bg-ink px-3.5 py-3 text-base text-ivory', className)}
      {...props}
    />
  )
}
