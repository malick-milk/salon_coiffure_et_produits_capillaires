/**
 * Réduire une photo DANS LE NAVIGATEUR avant de l'envoyer.
 *
 * Une photo de téléphone pèse 3 à 8 Mo ; le serveur n'accepte que 2 Mo (protection décidée à l'étape 10).
 * Réduite à 2000 px de côté et enregistrée en JPEG, elle pèse environ 300 à 800 Ko : l'envoi est rapide,
 * même en 3G, et coûte moins de données mobiles. Le serveur la recadre ensuite en carré 1200 px (WebP).
 */
export const MAX_SIDE = 2000

/** Nouvelles dimensions en gardant les proportions ; une image déjà petite n'est jamais agrandie */
export function fitWithin(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const ratio = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) }
}

export async function resizeImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    // imageOrientation « from-image » : une photo prise en portrait reste droite (étiquette EXIF du téléphone)
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(`« ${file.name} » n'est pas une image lisible. Utilisez une photo JPG, PNG ou WebP.`)
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Votre navigateur ne peut pas préparer la photo.')
  ctx.fillStyle = '#ffffff' // une image PNG transparente ne devient pas noire en JPEG
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
  if (!blob) throw new Error('Votre navigateur ne peut pas préparer la photo.')
  return blob
}
