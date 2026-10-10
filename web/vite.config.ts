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
      includeAssets: ['icons/*.png', 'demo/*.png'],
      manifest: {
        name: 'Blackout Box',
        short_name: 'Blackout Box',
        description: 'The storm and flood app that works when nothing else does.',
        theme_color: '#FFFFFF',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        id: '/',
        categories: ['weather', 'health', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/apple-touch-icon-180.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,png,svg,json,woff2,webmanifest}'],
        globIgnores: ['media/**/*.{mp4,webm,mov}', '**/node_modules/**'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Google Fonts (Inter, Material Symbols Rounded): cache after the first online visit so offline text is not unstyled
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
            // Grok media set (videos are not precached so the app installs fast); manifest.json stays network-fresh
            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/media/') && !url.pathname.endsWith('.json'),
            handler: 'CacheFirst',
            options: { cacheName: 'media', expiration: { maxEntries: 80 }, cacheableResponse: { statuses: [0, 200] }, rangeRequests: true },
          },
          {
            // terrain (Terrarium DEM) tiles for the map's flood slider, so flooding works offline
            urlPattern: /^https:\/\/s3\.amazonaws\.com\/elevation-tiles-prod\/terrarium\//,
            handler: 'CacheFirst',
            options: { cacheName: 'dem-tiles', expiration: { maxEntries: 600, maxAgeSeconds: 30 * 24 * 3600 }, cacheableResponse: { statuses: [0, 200] } },
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
