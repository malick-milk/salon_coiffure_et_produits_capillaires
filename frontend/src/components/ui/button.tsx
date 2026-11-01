/**
 * Bouton du design system, écrit à la manière de shadcn/ui :
 * le code du composant vit DANS le projet (on le possède et on l'adapte), il n'est pas
 * caché dans une bibliothèque. cva (class-variance-authority) déclare les variantes.
 */
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:bg-[#2a2a2a] disabled:text-[#8a8a8a] [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        gold: 'bg-gold text-ink hover:bg-[#e2c050]', // action principale : UNE seule par zone
        outline: 'border border-gold text-gold hover:bg-gold-soft',
        ghost: 'text-ivory hover:bg-ink-soft',
        dark: 'bg-ink text-ivory hover:bg-ink-soft', // sur fond clair
        link: 'text-ivory underline underline-offset-4 hover:text-gold',
      },
      size: {
        md: 'min-h-12 px-7 text-[15px]', // 48 px : cible tactile confortable
        sm: 'min-h-11 px-5 text-sm', // 44 px : minimum recommandé
        icon: 'size-11', // bouton carré à icône seule (aria-label obligatoire)
      },
    },
    defaultVariants: { variant: 'gold', size: 'md' },
  },
)

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** asChild : applique le style à l'enfant (ex. un <Link>) au lieu de créer un <button> */
    asChild?: boolean
  }

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
