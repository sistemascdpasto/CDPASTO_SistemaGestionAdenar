import { Button } from '@/components/ui/button';
import { loginWithPasskey, PasskeyError, passkeysSupported } from '@/lib/passkeys';
import { Fingerprint, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * «Ingresar con huella / Face ID» en la pantalla de login. Solo aparece si el navegador soporta
 * passkeys; el dispositivo muestra las cuentas que tienen la llave activada.
 */
export function PasskeyLoginButton() {
    const [supported, setSupported] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => setSupported(passkeysSupported()), []);

    if (!supported) return null;

    const ingresar = async () => {
        setError(null);
        setLoading(true);
        try {
            const destino = await loginWithPasskey();
            // Recarga completa: así la app arranca con la sesión nueva (y Nexus muestra anuncios).
            window.location.assign(destino || '/dashboard');
        } catch (e) {
            if (!(e instanceof PasskeyError && e.cancelled)) {
                setError(e instanceof Error ? e.message : 'No fue posible ingresar con huella.');
            }
            setLoading(false);
        }
    };

    return (
        <div className="grid gap-2">
            <div className="text-muted-foreground flex items-center gap-3 text-xs">
                <span className="bg-border h-px flex-1" />o<span className="bg-border h-px flex-1" />
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={ingresar} disabled={loading}>
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
                Ingresar con huella o Face ID
            </Button>
            {error && <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
    );
}
