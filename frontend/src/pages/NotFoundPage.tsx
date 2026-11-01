import { Link } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-24 text-center">
      <Seo title="Page introuvable" />
      <p className="font-display text-7xl text-gold">404</p>
      <h1 className="font-display text-3xl font-semibold">Cette page n'existe pas</h1>
      <p className="text-muted">Le lien est peut-être incorrect, ou le produit n'est plus disponible.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild><Link to="/">Accueil</Link></Button>
        <Button asChild variant="outline"><Link to="/boutique">Boutique</Link></Button>
      </div>
    </div>
  )
}
