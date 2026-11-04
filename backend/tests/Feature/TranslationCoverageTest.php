<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\File;
use Illuminate\Validation\Validator;
use Tests\TestCase;

/**
 * Garde-fou : chaque règle de validation utilisée dans le code doit avoir un message EN FRANÇAIS.
 * Sans traduction, l'utilisateur voit une clé brute comme « validation.gt.numeric ».
 * Le test lit le code lui-même : une règle ajoutée demain sans traduction le fera échouer.
 */
class TranslationCoverageTest extends TestCase
{
    protected bool $seed = false;

    /** Règles sans message propre (modificateurs) */
    private const MODIFIERS = ['nullable', 'sometimes', 'bail', 'present', 'filled'];

    public function test_chaque_regle_de_validation_utilisee_a_un_message_francais(): void
    {
        $rules = [];
        // Seuls ces dossiers contiennent des règles de validation (les modèles ont des « casts » comme 'decimal:2')
        $files = array_merge(File::allFiles(app_path('Http/Controllers')), File::allFiles(app_path('Http/Requests')), File::allFiles(app_path('Console')));
        foreach ($files as $file) {
            // Les chaînes de règles : 'required', 'max:100', 'regex:/…/', dans un tableau de validation
            preg_match_all("/'((?:[a-z_]+)(?::[^']*)?)'/", $file->getContents(), $m);
            foreach ($m[1] as $candidate) {
                $name = explode(':', $candidate)[0];
                if ($this->isRule($name)) {
                    $rules[$name] = true;
                }
            }
        }
        $this->assertNotEmpty($rules);

        $missing = [];
        foreach (array_keys($rules) as $rule) {
            if (in_array($rule, self::MODIFIERS, true)) {
                continue;
            }
            $message = trans("validation.$rule", [], 'fr');
            if ($message === "validation.$rule") {
                $missing[] = $rule;
            }
        }
        $this->assertSame([], $missing, 'Règles sans traduction dans lang/fr/validation.php : '.implode(', ', $missing));
    }

    public function test_chaque_champ_valide_a_un_nom_francais(): void
    {
        $fields = [];
        $files = array_merge(File::allFiles(app_path('Http/Controllers')), File::allFiles(app_path('Http/Requests')));
        foreach ($files as $file) {
            // 'batch_number' => ['required', …] : la clé d'un tableau de règles
            preg_match_all("/'([a-z_]+(?:\\.[a-z_*]+)*)' => \\[\\s*'(?:required|nullable|sometimes|bail)/", $file->getContents(), $m);
            foreach ($m[1] as $field) {
                $fields[$field] = true;
            }
        }
        $this->assertNotEmpty($fields);
        $attributes = trans('validation.attributes', [], 'fr');
        $missing = array_values(array_filter(array_keys($fields), fn ($f) => ! isset($attributes[$f])));
        sort($missing);
        $this->assertSame([], $missing, 'Champs sans nom français (validation.attributes) : '.implode(', ', $missing));
    }

    /** Un nom est une règle de validation si Laravel le connaît (méthode validateXxx) */
    private function isRule(string $name): bool
    {
        return method_exists(Validator::class, 'validate'.str_replace('_', '', ucwords($name, '_')));
    }
}
