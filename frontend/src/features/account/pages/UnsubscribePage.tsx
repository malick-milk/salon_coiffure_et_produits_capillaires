/**
 * « Ne plus recevoir les rappels de resserrage » : page ouverte depuis le lien d'un e-mail.
 * Le lien est SIGNÉ par le serveur : changer le numéro de la cliente dans l'adresse le rend invalide.
 * On demande une confirmation (un bouton) : un simple aperçu du lien par la messagerie ne désinscrit personne.
 */
import { useMutation } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { Button } from '@/components/ui/button'
import { apiErrorStatus, http } from '@/lib/http'

export function UnsubscribePage() {
  const { customer = '' } = useParams()
  const [params] = useSearchParams()
  const unsubscribe = useMutation({
    mutationFn: async () => (await http.post(`/reminders/unsubscribe/${encodeURIComponent(customer)}`, null, { params: { signature: params.get('signature') ?? '' } })).data,
  })

  return (
    <div className="px-4 py-16 sm:px-6">
      <Seo title="Rappels de resserrage" />
      <div className="mx-auto flex max-w-lg flex-col items-center gap-5 text-center">
        {unsubscribe.isSuccess ? (
          <>
            <span className="grid size-14 place-items-center rounded-full bg-[#163a22]"><Check className="size-7 text-[#7fc99a]" aria-hidden="true" /></span>
            <h1 className="font-display text-3xl font-semibold">C’est noté</h1>
            <p className="text-muted">Vous ne recevrez plus de rappels de resserrage. Vous pouvez toujours réserver quand vous le souhaitez.</p>
            <Button asChild><Link to="/reserver">Réserver une prestation</Link></Button>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl font-semibold">Ne plus recevoir les rappels de resserrage ?</h1>
            <p className="text-muted">Nous ne vous enverrons plus de rappel, ni par e-mail, ni dans votre espace client. Les confirmations de rendez-vous continuent.</p>
            {unsubscribe.isError && (
              <p role="alert" className="text-[#f87171]">
                {[403, 404].includes(apiErrorStatus(unsubscribe.error) ?? 0) ? 'Ce lien n’est pas valide. Utilisez le lien reçu dans l’e-mail, sans le modifier.' : 'Une erreur est survenue. Veuillez réessayer.'}
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              <Button disabled={unsubscribe.isPending} onClick={() => unsubscribe.mutate()}>Ne plus recevoir ces rappels</Button>
              <Button asChild variant="outline"><Link to="/">Garder les rappels</Link></Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
