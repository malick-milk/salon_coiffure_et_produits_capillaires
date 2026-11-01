import { useId, type ReactNode } from 'react'
import { Label } from '@/components/ui/input'

/** Champ accessible : libellé, aide et erreur reliés au champ (aria-describedby) */
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId()
  const hintId = hint && !error ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children(id, describedBy)}
      {hint && !error && <p id={hintId} className="text-[13px] text-[#a3a3a3]">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-sm font-medium text-[#f87171]">{error}</p>}
    </div>
  )
}

/** Applique les erreurs 422 du serveur (« customer.phone ») sur les champs du formulaire */
export function applyServerErrors(errors: Record<string, string[]> | undefined, setError: (field: never, e: { message: string }) => void, prefix = '') {
  for (const [key, messages] of Object.entries(errors ?? {})) {
    setError(key.replace(prefix, '') as never, { message: messages[0] ?? 'Valeur invalide.' })
  }
}
