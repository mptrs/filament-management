import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// On a GitHub Pages project site the app is served from /<repo>/, so the CI
// workflow passes BASE_PATH. Locally it is just /.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Spoolhive',
        short_name: 'Spoolhive',
        description: 'What filament you own, what is loaded, and what is still sealed.',
        theme_color: '#101114',
        background_color: '#101114',
        display: 'standalone',
        orientation: 'portrait',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json}'],
        // Never cache writes or the inventory read - those must hit the network
        // and fall back to our own localStorage copy instead.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [],
      },
    }),
  ],
});
