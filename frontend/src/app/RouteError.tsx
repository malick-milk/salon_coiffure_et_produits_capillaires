import { Link } from 'react-router'

/** Affiché si un composant plante : l'utilisateur voit un message clair, pas une page blanche */
export function RouteError() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="font-display text-4xl">Un incident est survenu</h1>
      <p className="text-muted">La page n'a pas pu s'afficher. Réessayez dans un instant.</p>
      <Link to="/" className="rounded-full bg-gold px-6 py-3 font-semibold text-ink">
        Retour à l'accueil
      </Link>
    </main>
  )
}
