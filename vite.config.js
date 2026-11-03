import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Midlertidigt uden minificering, så fejlbeskeder viser rigtige funktionsnavne
  build: { minify: false, sourcemap: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Just Nails by AK',
        short_name: 'Just Nails',
        description: 'Book tid hos Just Nails by AK',
        lang: 'da',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0B0A09',
        background_color: '#0B0A09',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
