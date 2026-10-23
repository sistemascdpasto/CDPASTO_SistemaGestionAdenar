import { Button } from '@/components/ui/button';
import { PasskeyError, platformAuthenticatorAvailable, registerPasskey } from '@/lib/passkeys';
import { type SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { Fingerprint, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const DIAS_ANTES_DE_VOLVER_A_PREGUNTAR = 30;

function claveAviso(userId: number | string): string {
    return `passkey-aviso:${userId}`;
}

function esCelularOApp(): boolean {
    return window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(display-mode: standalone)').matches;
}

/**
 * Tras ingresar con contraseña desde el celular (o la PWA), ofrece activar el ingreso con
 * huella / Face ID. Si dice «Ahora no», se vuelve a ofrecer en 30 días.
 */
export function PasskeyPrompt() {
    const { auth } = usePage<SharedData>().props;
    const [visible, setVisible] = useState(false);
    const [estado, setEstado] = useState<'idle' | 'loading' | 'done'>('idle');
    const [error, setError] = useState<string | null>(null);
    const userId = auth?.user?.id;

    useEffect(() => {
        if (!userId || auth.hasPasskey) return;

        try {
            const ultimo = Number(localStorage.getItem(claveAviso(userId)) || 0);
            if (Date.now() - ultimo < DIAS_ANTES_DE_VOLVER_A_PREGUNTAR * 24 * 3600 * 1000) return;
        } catch {
            return;
        }

        let cancelado = false;
        const timer = setTimeout(async () => {
            if (!cancelado && esCelularOApp() && (await platformAuthenticatorAvailable())) setVisible(true);
        }, 2500);

        return () => {
            cancelado = true;
            clearTimeout(timer);
        };
    }, [userId, auth?.hasPasskey]);

    if (!visible || !userId) return null;

    const posponer = () => {
        try {
            localStorage.setItem(claveAviso(userId), String(Date.now()));
        } catch {
            /* sin almacenamiento */
        }
        setVisible(false);
    };

    const activar = async () => {
        setError(null);
        setEstado('loading');
        try {
            await registerPasskey();
            setEstado('done');
            router.reload({ only: ['auth'] });
            setTimeout(() => setVisible(false), 2500);
        } catch (e) {
            setEstado('idle');
            if (!(e instanceof PasskeyError && e.cancelled)) {
                setError(e instanceof Error ? e.message : 'No fue posible activarlo.');
            }
        }
    };

    return (
        <div
            role="dialog"
            aria-label="Activar ingreso con huella o Face ID"
            className="bg-card text-card-foreground fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border p-4 shadow-2xl sm:bottom-6"
        >
            <button type="button" onClick={posponer} className="text-muted-foreground absolute top-3 right-3" aria-label="Cerrar">
                <X className="h-4 w-4" />
            </button>
            <div className="flex gap-3">
                <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                    <Fingerprint className="h-5 w-5" />
                </div>
                <div className="min-w-0 pr-4">
                    <p className="font-semibold">{estado === 'done' ? '¡Listo!' : 'Ingresa más rápido'}</p>
                    <p className="text-muted-foreground mt-0.5 text-sm">
                        {estado === 'done'
                            ? 'La próxima vez toca «Ingresar con huella o Face ID» en el inicio de sesión.'
                            : 'Activa el ingreso con tu huella o Face ID en este celular. Tu huella nunca sale del dispositivo.'}
                    </p>
                    {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
                </div>
            </div>
            {estado !== 'done' && (
                <div className="mt-3 flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={posponer}>
                        Ahora no
                    </Button>
                    <Button type="button" size="sm" onClick={activar} disabled={estado === 'loading'}>
                        <Fingerprint className="h-4 w-4" />
                        Activar
                    </Button>
                </div>
            )}
        </div>
    );
}
