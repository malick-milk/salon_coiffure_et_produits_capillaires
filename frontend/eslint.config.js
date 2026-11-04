/**
 * ESLint : analyse le code SANS l'exécuter, pour attraper les erreurs que TypeScript ne voit pas.
 * Lancer : npm run lint   (et npm run lint -- --fix pour corriger automatiquement ce qui peut l'être)
 *
 * - typescript-eslint : variables inutilisées, « any » implicites, promesses oubliées…
 * - react-hooks       : les règles des hooks (un hook jamais dans un if, dépendances des useEffect)
 * - jsx-a11y          : accessibilité (image sans texte alternatif, bouton sans nom, label orphelin…)
 */
import js from '@eslint/js'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'public/mockServiceWorker.js'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, jsxA11y.flatConfigs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Un fichier de page exporte ses composants ; le rechargement à chaud reste fiable
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // _variable = « je sais qu'elle est inutilisée » (convention)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Nos champs maison rendent un vrai <input> : un <label> qui les entoure est donc bien associé
      'jsx-a11y/label-has-associated-control': ['error', { controlComponents: ['Input', 'AdminInput', 'AdminSelect', 'PasswordInput', 'Textarea'], assert: 'either', depth: 3 }],
    },
  },
  {
    // Scripts Node (parcours Playwright) : CommonJS, globals de Node
    files: ['e2e/**/*.cjs'],
    extends: [js.configs.recommended],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser } },
  },
)
