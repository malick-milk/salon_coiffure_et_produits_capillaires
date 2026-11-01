/**
 * Titre et description de la page (SEO, ADR-009).
 * React 19 place automatiquement <title> et <meta> dans le <head>, où qu'ils soient rendus :
 * plus besoin de bibliothèque comme react-helmet.
 */
export function Seo({ title, description }: { title: string; description?: string }) {
  return (
    <>
      <title>{`${title} — Dabo Hair`}</title>
      {description && <meta name="description" content={description} />}
    </>
  )
}
