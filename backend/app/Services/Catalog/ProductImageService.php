<?php

namespace App\Services\Catalog;

use App\Models\Product;
use App\Models\ProductImage;
use GdImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Photos des produits envoyées depuis l'ERP.
 *
 * Chaque photo est RÉ-ENCODÉE par GD : recadrée en carré au centre, réduite à 1200 px au plus,
 * enregistrée en WebP. Deux bénéfices :
 * - toutes les fiches ont le même format, quel que soit le téléphone qui a pris la photo ;
 * - sécurité : seuls les pixels sont recopiés, tout contenu caché dans le fichier envoyé (script,
 *   données EXIF dont la position GPS du téléphone) est éliminé.
 *
 * Fichiers : disque « public » (storage/app/public/produits), servis sous /storage/produits/…
 * En production, ce dossier est dans « shared » : il survit aux déploiements (deploy.sh).
 */
class ProductImageService
{
    public const MAX_IMAGES = 4;

    public const SIZE = 1200;

    public function add(Product $product, UploadedFile $file): ProductImage
    {
        if ($product->images()->count() >= self::MAX_IMAGES) {
            throw ValidationException::withMessages(['image' => 'Un produit a 4 photos au plus : supprimez-en une avant d\'en ajouter.']);
        }

        $webp = $this->toSquareWebp($file);
        $path = 'produits/'.Str::limit($product->slug, 60, '').'-'.Str::lower(Str::random(8)).'.webp';
        Storage::disk('public')->put($path, $webp);

        return DB::transaction(function () use ($product, $path) {
            $isFirst = ! $product->images()->exists();

            return $product->images()->create([
                'path' => '/storage/'.$path,
                'alt_text' => $product->brand?->name ? $product->displayName().' · '.$product->brand->name : $product->displayName(),
                'position' => (int) $product->images()->max('position') + ($isFirst ? 0 : 1),
                'is_primary' => $isFirst, // la première photo devient la photo principale
            ]);
        });
    }

    public function remove(Product $product, ProductImage $image): void
    {
        if ($product->is_active && $product->images()->count() === 1) {
            throw ValidationException::withMessages(['image' => 'Un produit en vente doit garder au moins une photo. Retirez-le d\'abord de la vente.']);
        }

        DB::transaction(function () use ($product, $image) {
            $image->delete();
            if ($image->is_primary) {
                $product->images()->orderBy('position')->first()?->update(['is_primary' => true]);
            }
        });
        // Seules les photos envoyées par l'ERP sont supprimées du disque (pas celles du dossier du site, /images/…)
        if (str_starts_with($image->path, '/storage/')) {
            Storage::disk('public')->delete(Str::after($image->path, '/storage/'));
        }
    }

    public function makePrimary(Product $product, ProductImage $image): void
    {
        // La principale passe en tête (position 0), les autres gardent leur ordre derrière elle
        DB::transaction(function () use ($product, $image) {
            $others = $product->images()->whereKeyNot($image->id)->orderBy('position')->get();
            $image->update(['is_primary' => true, 'position' => 0]);
            foreach ($others as $i => $other) {
                $other->update(['is_primary' => false, 'position' => $i + 1]);
            }
        });
    }

    /** Lit l'image, la redresse (photos de téléphone tournées), la recadre en carré et la réduit */
    private function toSquareWebp(UploadedFile $file): string
    {
        $source = @imagecreatefromstring((string) file_get_contents($file->getRealPath()));
        if (! $source instanceof GdImage) {
            throw ValidationException::withMessages(['image' => 'Ce fichier n\'est pas une image lisible (JPG, PNG ou WebP).']);
        }
        $source = $this->applyExifOrientation($source, $file);

        $width = imagesx($source);
        $height = imagesy($source);
        $side = min($width, $height);
        $target = min($side, self::SIZE);

        $square = imagecreatetruecolor($target, $target);
        // Fond blanc : une image PNG transparente ne devient pas noire
        imagefill($square, 0, 0, (int) imagecolorallocate($square, 255, 255, 255));
        imagecopyresampled($square, $source, 0, 0, intdiv($width - $side, 2), intdiv($height - $side, 2), $target, $target, $side, $side);

        ob_start();
        imagewebp($square, null, 82);

        return (string) ob_get_clean();
    }

    /** Un téléphone enregistre souvent la photo « couchée » avec une étiquette EXIF « tourner de 90° » */
    private function applyExifOrientation(GdImage $image, UploadedFile $file): GdImage
    {
        if (! function_exists('exif_read_data') || ! in_array($file->getMimeType(), ['image/jpeg', 'image/jpg'], true)) {
            return $image;
        }
        $orientation = (int) (@exif_read_data($file->getRealPath())['Orientation'] ?? 1);
        $angle = match ($orientation) {
            3 => 180,
            6 => -90,
            8 => 90,
            default => 0,
        };

        return $angle === 0 ? $image : (imagerotate($image, $angle, 0) ?: $image);
    }
}
