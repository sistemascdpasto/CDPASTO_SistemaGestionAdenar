import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

const streamShim = fileURLToPath(new URL('./resources/js/shims/stream.ts', import.meta.url));

export default defineConfig({
    resolve: {
        alias: [
            {
                find: /^stream$/,
                replacement: streamShim,
            },
        ],
    },
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            ssr: 'resources/js/ssr.jsx',
            refresh: true,
        }),
        react(),
        tailwindcss(),
        VitePWA({
            injectRegister: false,
            registerType: 'autoUpdate',
            devOptions: { enabled: false },
            outDir: 'public',
            base: '/',
            scope: '/',
            manifest: {
                name: 'Sistema de Gestión Adenar',
                short_name: 'Adenar',
                description: 'Sistema de gestión ADENAR: seguridad, reparto, gente y flota.',
                lang: 'es',
                start_url: '/',
                scope: '/',
                display: 'standalone',
                background_color: '#ffffff',
                theme_color: '#E41515',
                icons: [
                    { src: '/images/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                    { src: '/images/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                    { src: '/images/pwa/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
            },
            workbox: {
                globDirectory: 'public',
                globPatterns: ['build/**/*.{js,css,woff2,woff,png,svg,ico}'],
                globIgnores: ['**/*.webmanifest', '**/*.html'],
                manifestTransforms: [
                    async (entries) => ({
                        manifest: entries.filter((e) => !e.url.endsWith('.webmanifest')),
                        warnings: [],
                    }),
                ],
                navigateFallback: null,
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: true,
            },
        }),
        {
            name: 'remove-manifest-from-sw-precache',
            enforce: 'post',
            closeBundle: {
                order: 'post',
                sequential: true,
                handler() {
                    const swPath = 'public/sw.js';
                    if (!fs.existsSync(swPath)) return;
                    const content = fs.readFileSync(swPath, 'utf-8');
                    const cleaned = content.replace(/,?\{url:"manifest\.webmanifest",[^}]+\}/g, '');
                    if (cleaned !== content) {
                        fs.writeFileSync(swPath, cleaned);
                    }
                },
            },
        },
    ],
    esbuild: {
        jsx: 'automatic',
    },
});