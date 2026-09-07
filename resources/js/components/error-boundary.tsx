import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    /**
     * Si un error de reconciliación del DOM (típico de Google Translate) no se
     * resuelve tras los reintentos, recarga la página una sola vez en vez de
     * dejar al usuario con una pantalla rota. Úsese solo en el boundary raíz.
     */
    reloadOnUnrecoverable?: boolean;
}

interface State {
    hasError: boolean;
    error: Error | null;
    retryCount: number;
}

const RELOAD_GUARD_KEY = 'adenar:error-boundary-reloaded-at';
// Ventana en la que NO se vuelve a auto-recargar (evita loops si la página
// está genuinamente rota).
const RELOAD_GUARD_MS = 20_000;

function esErrorDeReconciliacionDom(error: Error): boolean {
    const m = error?.message ?? '';
    return (
        m.includes('insertBefore') ||
        m.includes('removeChild') ||
        m.includes('appendChild') ||
        m.includes('not a child') ||
        m.includes('Failed to execute') ||
        // Vite: un chunk de página quedó obsoleto tras un deploy.
        m.includes('Failed to fetch dynamically imported module') ||
        m.includes('error loading dynamically imported module') ||
        m.includes('Importing a module script failed')
    );
}

function recargarUnaVez(): boolean {
    try {
        const ultima = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
        if (Date.now() - ultima < RELOAD_GUARD_MS) {
            return false;
        }
        sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    } catch {
        // sessionStorage no disponible: recargar de todas formas.
    }
    window.location.reload();
    return true;
}

/**
 * ErrorBoundary resiliente que:
 * - Auto-reintenta hasta 2 veces en errores de reconciliación DOM (insertBefore, removeChild, etc.)
 * - Como último recurso (boundary raíz) recarga la página una sola vez.
 * - Muestra un fallback amigable solo cuando ya no hay nada más que hacer.
 */
export class ErrorBoundary extends Component<Props, State> {
    private static MAX_AUTO_RETRIES = 2;

    public state: State = {
        hasError: false,
        error: null,
        retryCount: 0,
    };

    public static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary atrapó un error no controlado:', error, errorInfo);

        if (!esErrorDeReconciliacionDom(error)) {
            return;
        }

        if (this.state.retryCount < ErrorBoundary.MAX_AUTO_RETRIES) {
            document.body.style.pointerEvents = '';
            setTimeout(() => {
                this.setState((prev) => ({
                    hasError: false,
                    error: null,
                    retryCount: prev.retryCount + 1,
                }));
            }, 100);

            return;
        }

        // Reintentos agotados: en el boundary raíz, recargar una vez.
        if (this.props.reloadOnUnrecoverable && recargarUnaVez()) {
            // La página se está recargando; no renderizamos el fallback.
        }
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="border-sidebar-border/50 bg-muted/30 my-4 flex flex-col items-center justify-center rounded-xl border p-8 text-center">
                    <div className="bg-muted text-muted-foreground mb-3 flex size-10 items-center justify-center rounded-full">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                    <h3 className="text-foreground text-sm font-semibold">No se pudo cargar esta sección</h3>
                    <p className="text-muted-foreground mt-1 max-w-md text-xs">
                        Se produjo un error temporal. Vuelve a cargar la página para continuar.
                    </p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="mt-3 rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-700"
                    >
                        Recargar
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
