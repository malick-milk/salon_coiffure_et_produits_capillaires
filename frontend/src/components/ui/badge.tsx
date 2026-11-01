import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** Étiquette de statut : la couleur ne suffit jamais, le libellé est toujours présent */
const badgeVariants = cva('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', {
  variants: {
    tone: {
      gold: 'bg-gold text-ink',
      warning: 'bg-[#fff4d6] text-gold-text',
      neutral: 'bg-[#e4e4e7] text-[#3f3f46]',
      success: 'bg-[#dff3e4] text-[#14532d]',
      info: 'bg-[#dcebff] text-[#0b3d91]',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

export function Badge({ className, tone, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
