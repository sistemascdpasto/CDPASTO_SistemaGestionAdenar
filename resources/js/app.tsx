import '../css/app.css';

import { ErrorBoundary } from '@/components/error-boundary';
import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { route as routeFn } from 'ziggy-js';
import { initializeTheme } from './hooks/use-appearance';

declare global {
    const route: typeof routeFn;
}

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

const CHUNK_RELOAD_KEY = 'adenar:chunk-reload-at';

/**
 * Un deploy nuevo cambia los hashes de los chunks de Vite; un usuario con la
 * app vieja abierta que navega a un módulo intenta cargar un chunk que ya no
 * existe (404) y se queda con pantalla en blanco. Cuando falla la precarga de
 * un módulo, recargamos la página una sola vez para traer los assets nuevos.
 */
function recargarPorChunkObsoleto(): void {
    try {
        const ultima = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
        if (Date.now() - ultima < 20_000) return;
        sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    } catch {
        // sessionStorage no disponible; recargar igual.
    }
    window.location.reload();
}

window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    recargarPorChunkObsoleto();
});

const paginas = import.meta.glob('./pages/**/*.tsx');

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(`./pages/${name}.tsx`, paginas).catch(() => {
            recargarPorChunkObsoleto();
            // Promesa que nunca resuelve: la página se está recargando.
            return new Promise<never>(() => {});
        }),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <ErrorBoundary reloadOnUnrecoverable>
                <App {...props} />
            </ErrorBoundary>,
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
