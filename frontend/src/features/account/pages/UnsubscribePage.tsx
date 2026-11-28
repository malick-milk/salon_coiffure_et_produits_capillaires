/**
 * « Ne plus recevoir les rappels de resserrage » ou « … les nouveautés et offres » (28 novembre 2026) :
 * page ouverte depuis le lien d'un e-mail.
 * Le lien est SIGNÉ par le serveur : changer le numéro de la cliente dans l'adresse le rend invalide.
 * On demande une confirmation (un bouton) : un simple aperçu du lien par la messagerie ne désinscrit personne.
 */
import { useMutation } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { Button } from '@/components/ui/button'
import { apiErrorStatus, http } from '@/lib/http'

const TEXTS = {
  reminders: {
    api: 'reminders', seo: 'Rappels de resserrage', title: 'Ne plus recevoir les rappels de resserrage ?',
    body: 'Nous ne vous enverrons plus de rappel, ni par e-mail, ni dans votre espace client. Les confirmations de rendez-vous continuent.',
    confirm: 'Ne plus recevoir ces rappels', keep: 'Garder les rappels', done: 'Vous ne recevrez plus de rappels de resserrage. Vous pouvez toujours réserver quand vous le souhaitez.',
  },
  offers: {
    api: 'offers', seo: 'Nouveautés et offres', title: 'Ne plus recevoir nos nouveautés et offres ?',
    body: 'Nous ne vous enverrons plus d’offres par e-mail. Les confirmations de commande et de rendez-vous, les codes de retrait et les factures continuent.',
    confirm: 'Ne plus recevoir les offres', keep: 'Garder les offres', done: 'Vous ne recevrez plus nos nouveautés et offres par e-mail. Vous pouvez changer d’avis dans votre espace client.',
  },
} as const

export function UnsubscribePage({ kind = 'reminders' }: { kind?: keyof typeof TEXTS }) {
  const t = TEXTS[kind]
  const { customer = '' } = useParams()
  const [params] = useSearchParams()
  const unsubscribe = useMutation({
    mutationFn: async () => (await http.post(`/${t.api}/unsubscribe/${encodeURIComponent(customer)}`, null, { params: { signature: params.get('signature') ?? '' } })).data,
  })

  return (
    <div className="px-4 py-16 sm:px-6">
      <Seo title={t.seo} />
      <div className="mx-auto flex max-w-lg flex-col items-center gap-5 text-center">
        {unsubscribe.isSuccess ? (
          <>
            <span className="grid size-14 place-items-center rounded-full bg-[#163a22]"><Check className="size-7 text-[#7fc99a]" aria-hidden="true" /></span>
            <h1 className="font-display text-3xl font-semibold">C’est noté</h1>
            <p className="text-muted">{t.done}</p>
            {kind === 'reminders' ? <Button asChild><Link to="/reserver">Réserver une prestation</Link></Button> : <Button asChild><Link to="/gammes">Voir les gammes</Link></Button>}
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl font-semibold">{t.title}</h1>
            <p className="text-muted">{t.body}</p>
            {unsubscribe.isError && (
              <p role="alert" className="text-[#f87171]">
                {[403, 404].includes(apiErrorStatus(unsubscribe.error) ?? 0) ? 'Ce lien n’est pas valide. Utilisez le lien reçu dans l’e-mail, sans le modifier.' : 'Une erreur est survenue. Veuillez réessayer.'}
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              <Button disabled={unsubscribe.isPending} onClick={() => unsubscribe.mutate()}>{t.confirm}</Button>
              <Button asChild variant="outline"><Link to="/">{t.keep}</Link></Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
