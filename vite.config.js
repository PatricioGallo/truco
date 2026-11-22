import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

// `--mode mock` usa un servidor simulado (sin Supabase) para probar.
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // La app queda instalada en el celular: contra la compu se juega sin conexión
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'naipes/*.webp'],
      manifest: {
        name: 'Truco',
        short_name: 'Truco',
        lang: 'es',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#2A1B14',
        theme_color: '#2A1B14',
        icons: [
          { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/storage/v1/object/public/avatars/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'avatars', cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  base: './',
  resolve: {
    alias: {
      '@api': fileURLToPath(new URL(mode === 'mock' ? './src/api/mock.js' : './src/api/supabase.js', import.meta.url)),
    },
  },
}))
