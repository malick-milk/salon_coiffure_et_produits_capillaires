import { Link } from 'react-router'
import { Seo } from '@/components/common/Seo'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-24 text-center">
      <Seo title="Page introuvable" />
      <p className="font-display text-7xl text-gold">404</p>
      <h1 className="font-display text-3xl font-semibold">Cette page n’existe plus</h1>
      <p className="text-muted">Nos gammes, elles, sont toujours là : tout ce qu’il faut pour vos cheveux, à un seul prix.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild><Link to="/boutique?category=gammes">Voir les gammes</Link></Button>
        <Button asChild variant="outline"><Link to="/">Accueil</Link></Button>
      </div>
    </div>
  )
}
