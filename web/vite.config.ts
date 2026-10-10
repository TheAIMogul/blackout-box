import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  resolve: { alias: { '@engine': path.resolve(import.meta.dirname, '../modules/four-hour-rule/src') } },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3001' },
    fs: { allow: ['..'] }, // engine source and data live outside web/
  },
  preview: { port: 5173, proxy: { '/api': 'http://localhost:3001' } },
  build: { chunkSizeWarningLimit: 1500 },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered in src/main.ts via virtual:pwa-register
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Blackout Box',
        short_name: 'Blackout Box',
        description: 'The hurricane app that works when nothing else does.',
        theme_color: '#1a73e8',
        background_color: '#f8f9fa',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,png,svg,json,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Google Fonts (Google Sans, Material Symbols): cache after the first online visit so offline text is not unstyled
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'bb-fonts', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            // GET data routes (map layers, tide) fall back to the last response offline.
            // /api/health is excluded so the offline badge is never a stale cached "online".
            urlPattern: ({ url, request }) => url.pathname.startsWith('/api/') && url.pathname !== '/api/health' && request.method === 'GET',
            handler: 'NetworkFirst',
            options: { cacheName: 'bb-api', networkTimeoutSeconds: 4, expiration: { maxEntries: 60 } },
          },
          {
            // map tiles/styles (OpenFreeMap) seen while online
            urlPattern: ({ url }) => url.origin === 'https://tiles.openfreemap.org',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'bb-tiles', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 7 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
