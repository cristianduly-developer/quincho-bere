import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    target: 'esnext',       // elimina polyfills innecesarios para browsers modernos (~8% menos bundle)
    minify: 'esbuild',      // más rápido y resultado similar a terser
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-512.svg'],
      manifest: {
        name: 'App Eventos',
        short_name: 'App Eventos',
        description: 'Gestión de reservas y eventos para espacios',
        theme_color: '#C4602B',
        background_color: '#FDF8F3',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cacheId: 'qb-v5',
        navigateFallbackDenylist: [/^\/ayuda/, /^\/evento/],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        // Assets con hash → cachear 1 año (inmutables)
        globIgnores: ['sw.js', 'workbox-*.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/pmohyepcqfvkwijmljee\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-v2',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Fuentes de Google si se agregan en el futuro
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
        ],
      },
    }),
  ],
})
