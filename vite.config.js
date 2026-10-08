import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
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
            // Registrado a mano desde app.tsx (virtual:pwa-register) para
            // controlar el momento, en vez de que el plugin inyecte su
            // propio <script> — esta vista es un app.blade.php, no el
            // index.html que el plugin espera gestionar.
            injectRegister: false,
            registerType: 'autoUpdate',
            devOptions: { enabled: false },
            // El build normal de Laravel/Vite escribe los assets con hash en
            // public/build/ (vite.base = "/build/"), pero un service worker
            // solo puede controlar (scope) rutas por debajo de la carpeta
            // donde se sirve su propio archivo. Si sw.js quedara en
            // /build/sw.js jamás podría controlar /dashboard, /modules/...
            // etc. Por eso se saca el service worker a la raíz pública
            // (public/sw.js, servido en "/sw.js") y se fuerza base/scope a
            // "/" para que el código de registro (virtual:pwa-register)
            // apunte ahí en vez de a "/build/sw.js".
            outDir: 'public',
            base: '/',
            scope: '/',
            manifest: {
                name: 'Sistema de Gestión Adenar',
                short_name: 'Adenar',
                description: 'Sistema de gestión ADENAR: seguridad, reparto, gente y flota.',
                lang: 'es',
                // "/" renderiza welcome.tsx. No se usa /dashboard porque esa
                // ruta exige sesión: para alguien sin login, abrir la app
                // instalada terminaría cayendo directo en /login en vez de
                // en la pantalla de bienvenida.
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
                // Solo se cachean los assets estáticos versionados por hash
                // (JS/CSS/fuentes/íconos del build). Nada de navigateFallback:
                // cada navegación Inertia sigue yendo siempre al servidor, así
                // que los datos (asistencias, revisiones, indicadores, etc.)
                // nunca se sirven desde caché.
                globDirectory: 'public',
                globPatterns: ['build/**/*.{js,css,woff2,woff,png,svg,ico}'],
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: true,
            },
        }),
    ],
    esbuild: {
        jsx: 'automatic',
    },
});