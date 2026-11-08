/**
 * Page du PARTENAIRE (étape 14) : /retrait/:jeton, ouverte depuis le lien reçu par SMS.
 * Il saisit le code à 4 chiffres que la cliente a reçu : sans ce code, la commande ne peut pas être remise.
 * Pensée pour un téléphone : gros champ numérique, une seule action.
 */
import { CheckCircle2, PackageCheck } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { EmptyState, QueryError } from '@/components/common/States'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice } from '@/lib/format'
import { apiErrorMessage, apiErrorStatus } from '@/lib/http'
import { useConfirmHandover, useHandover } from '../api'

export function HandoverPage() {
  const { token = '' } = useParams()
  const info = useHandover(token)
  const confirm = useConfirmHandover(token)
  const [code, setCode] = useState('')

  const shell = (children: React.ReactNode) => (
    <section className="px-4 py-12 sm:px-6">
      <Seo title="Remise d’une commande" />
      <div className="mx-auto flex max-w-md flex-col gap-6">{children}</div>
    </section>
  )

  if (info.isPending) return shell(<Skeleton className="h-80" />)
  if (info.isError) {
    return shell(apiErrorStatus(info.error) === 404
      ? <EmptyState title="Lien introuvable"><p className="text-muted">Vérifiez que le lien du SMS a été ouvert en entier, ou appelez Dabo Hair.</p></EmptyState>
      : <QueryError message={apiErrorMessage(info.error)} onRetry={() => info.refetch()} />)
  }
  const d = info.data
  if (confirm.isSuccess || d.state === 'handed_over') {
    return shell(
      <div role="status" className="flex flex-col items-center gap-3 rounded-3xl border border-gold-dark bg-ink-soft px-6 py-12 text-center">
        <CheckCircle2 className="size-12 text-gold" aria-hidden="true" />
        <h1 className="font-display text-3xl font-semibold">Commande remise</h1>
        <p className="text-muted">{d.reference} · {formatPrice(d.total)} encaissés. Ce montant sera repris dans votre relevé du mois.</p>
      </div>,
    )
  }
  if (d.state === 'unavailable') {
    return shell(<EmptyState title="Commande non disponible"><p className="text-muted">Cette commande a été annulée ou n’est pas encore prête. Appelez Dabo Hair en cas de doute.</p></EmptyState>)
  }

  return shell(
    <>
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-[13px] font-semibold tracking-[0.2em] text-gold uppercase"><PackageCheck className="size-4" aria-hidden="true" />{d.pickup_point}</p>
        <h1 className="font-display text-3xl font-semibold">Remettre la commande de {d.customer_first_name}</h1>
        <p className="text-muted">{d.reference}</p>
      </div>
      <ul className="flex flex-col gap-2 rounded-2xl border border-ink-line bg-ink-soft p-5">
        {d.items.map((i) => <li key={i.name} className="flex justify-between gap-3"><span>{i.name}</span><strong>× {i.quantity}</strong></li>)}
        <li className="mt-2 flex justify-between border-t border-ink-line pt-3 text-lg"><span>À encaisser (prix du site)</span><strong className="text-gold">{formatPrice(d.total)}</strong></li>
      </ul>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (code.length === 4) confirm.mutate(code) }}>
        <label htmlFor="code" className="text-lg font-semibold">Code de retrait donné par la cliente</label>
        <input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4}" maxLength={4} value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          aria-invalid={confirm.isError} aria-describedby="code-aide"
          className="min-h-16 rounded-2xl border border-ink-line bg-ink text-center text-3xl tracking-[0.5em] focus:border-gold focus:outline-none" />
        <p id="code-aide" className="text-sm text-muted">4 chiffres, reçus par SMS par la cliente. Ne remettez pas la commande sans ce code.</p>
        {confirm.isError && <p role="alert" className="text-sm text-[#f87171]">{apiErrorMessage(confirm.error)}</p>}
        <Button type="submit" className="min-h-[52px]" disabled={code.length !== 4 || confirm.isPending}>{confirm.isPending ? 'Vérification…' : 'Confirmer la remise'}</Button>
      </form>
    </>,
  )
}
