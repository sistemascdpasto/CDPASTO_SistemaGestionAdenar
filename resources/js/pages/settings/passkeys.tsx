import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { PasskeyError, passkeysSupported, registerPasskey } from '@/lib/passkeys';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Fingerprint, LoaderCircle, Smartphone, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Ingreso con huella', href: '/settings/passkeys' }];

interface Passkey {
    id: string;
    alias: string;
    created_at: string;
    last_used_at: string | null;
}

const fecha = (value: string | null) =>
    value ? new Date(value).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function Passkeys({ passkeys }: { passkeys: Passkey[] }) {
    const [supported, setSupported] = useState(true);
    const [loading, setLoading] = useState(false);
    const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

    useEffect(() => setSupported(passkeysSupported()), []);

    const activar = async () => {
        setMensaje(null);
        setLoading(true);
        try {
            await registerPasskey();
            setMensaje({ tipo: 'ok', texto: 'Listo: ya puedes ingresar con tu huella o Face ID en este dispositivo.' });
            router.reload({ only: ['passkeys', 'auth'] });
        } catch (e) {
            if (!(e instanceof PasskeyError && e.cancelled)) {
                setMensaje({ tipo: 'error', texto: e instanceof Error ? e.message : 'No fue posible activarlo.' });
            }
        } finally {
            setLoading(false);
        }
    };

    const quitar = (passkey: Passkey) => {
        if (!confirm(`¿Quitar el ingreso con huella de «${passkey.alias}»?`)) return;
        router.delete(route('passkeys.destroy', passkey.id), { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Ingreso con huella" />

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall
                        title="Ingreso con huella o Face ID"
                        description="Entra sin escribir tu contraseña usando la huella, el rostro o el PIN de tu celular. Tu huella nunca sale del dispositivo: el sistema solo guarda una llave de seguridad."
                    />

                    {supported ? (
                        <Button type="button" onClick={activar} disabled={loading}>
                            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
                            Activar en este dispositivo
                        </Button>
                    ) : (
                        <p className="text-muted-foreground text-sm">Este navegador no permite el ingreso con huella. Usa Chrome en Android o Safari en iPhone (iOS 16 o superior).</p>
                    )}

                    {mensaje && (
                        <p className={mensaje.tipo === 'ok' ? 'text-sm text-green-600' : 'text-sm text-red-600 dark:text-red-400'}>{mensaje.texto}</p>
                    )}

                    <div className="divide-y rounded-lg border">
                        {passkeys.length === 0 && <p className="text-muted-foreground p-4 text-sm">Todavía no has activado el ingreso con huella en ningún dispositivo.</p>}
                        {passkeys.map((passkey) => (
                            <div key={passkey.id} className="flex items-center gap-3 p-4">
                                <Smartphone className="text-muted-foreground h-5 w-5 shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{passkey.alias}</p>
                                    <p className="text-muted-foreground text-xs">
                                        Activado el {fecha(passkey.created_at)} · último uso {fecha(passkey.last_used_at)}
                                    </p>
                                </div>
                                <Button type="button" variant="ghost" size="icon" onClick={() => quitar(passkey)} aria-label={`Quitar ${passkey.alias}`}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    <p className="text-muted-foreground text-xs">
                        Si cambias o pierdes el celular, quita aquí ese dispositivo. Siempre puedes seguir ingresando con tu cédula y contraseña.
                    </p>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
