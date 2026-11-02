/// <reference types="vitest/config" />
// Configuration de Vite : le serveur de développement et l'outil de build.
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    react(), // JSX, rafraîchissement instantané (Fast Refresh)
    tailwindcss(), // Tailwind CSS v4 : génère uniquement les classes réellement utilisées
  ],
  resolve: {
    // Alias "@" = dossier src : on écrit "@/lib/format" au lieu de "../../../lib/format"
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    // Les appels /api et /sanctum sont transmis à Laravel (php artisan serve).
    // Le navigateur croit parler au même serveur : pas de problème de CORS en développement.
    // 127.0.0.1 et NON « localhost » : depuis Node 17, « localhost » peut désigner l'adresse IPv6 ::1
    // (fréquent sous Windows), alors que « php artisan serve » n'écoute que sur 127.0.0.1 (IPv4).
    // Le proxy échouait alors (ECONNREFUSED) et la connexion semblait refuser le mot de passe.
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/sanctum': 'http://127.0.0.1:8000',
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Les bibliothèques changent rarement : dans un fichier à part, le navigateur les garde
        // en cache d'une mise en ligne à l'autre ; seul le code du projet est retéléchargé.
        manualChunks: {
          react: ['react', 'react-dom', 'react-dom/client', 'react-router'],
          data: ['@tanstack/react-query', 'axios', 'zustand'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom', // simule un navigateur pour tester les composants
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: false,
  },
})
