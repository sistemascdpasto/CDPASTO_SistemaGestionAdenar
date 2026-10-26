import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/input-error';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { CheckCircle2, LoaderCircle, XCircle } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

function leerCookie(nombre: string): string | null {
    const match = document.cookie.match(new RegExp(`(?:^|; )${nombre}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

interface Credenciales {
    username: string | null;
    database: string | null;
    tiene_password: boolean;
}

export default function EditMygeotabCredenciales({ credenciales, fuente }: { credenciales: Credenciales; fuente: 'base_de_datos' | 'env' }) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Credenciales MyGeotab', href: '/admin/mygeotab-credenciales' },
    ];

    const { data, setData, put, processing, errors } = useForm({
        username: credenciales.username ?? '',
        password: '',
        database: credenciales.database ?? '',
    });

    const [prueba, setPrueba] = useState<{ estado: 'idle' | 'cargando' | 'ok' | 'error'; mensaje?: string }>({ estado: 'idle' });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        put(route('admin.mygeotab-credenciales.update'));
    };

    const probarConexion = async () => {
        setPrueba({ estado: 'cargando' });
        try {
            const respuesta = await fetch(route('admin.mygeotab-credenciales.probar'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': leerCookie('XSRF-TOKEN') ?? '',
                },
                body: JSON.stringify(data),
            });
            const resultado = await respuesta.json().catch(() => null);
            setPrueba({
                estado: respuesta.ok ? 'ok' : 'error',
                mensaje: resultado?.message ?? 'No se pudo verificar la conexión.',
            });
        } catch {
            setPrueba({ estado: 'error', mensaje: 'No se pudo verificar la conexión.' });
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Credenciales MyGeotab" />
            <div className="flex h-full flex-1 flex-col gap-8 rounded-xl p-4">
                <div className="max-w-2xl space-y-6">
                    <HeadingSmall
                        title="Credenciales MyGeotab"
                        description="Usadas para sincronizar los kilómetros diarios por vehículo (pilar Flota). La contraseña de MyGeotab rota periódicamente: actualízala aquí, sin necesidad de redeploy."
                    />

                    {fuente === 'env' && (
                        <Alert>
                            <AlertDescription>
                                Todavía no se ha guardado ninguna credencial desde este panel — se está usando el valor semilla configurado en el
                                servidor. Al guardar aquí, este formulario pasa a ser la fuente de verdad.
                            </AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={submit} className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="username">Usuario</Label>
                            <Input id="username" value={data.username} onChange={(e) => setData('username', e.target.value)} autoComplete="off" />
                            <InputError message={errors.username} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input
                                id="password"
                                type="password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                placeholder={credenciales.tiene_password ? 'Dejar en blanco para no cambiarla' : ''}
                                autoComplete="new-password"
                            />
                            <InputError message={errors.password} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="database">Base de datos (tenant de MyGeotab)</Label>
                            <Input id="database" value={data.database} onChange={(e) => setData('database', e.target.value)} autoComplete="off" />
                            <InputError message={errors.database} />
                        </div>

                        {prueba.estado === 'ok' && (
                            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                                <CheckCircle2 className="size-4" />
                                <AlertDescription>{prueba.mensaje}</AlertDescription>
                            </Alert>
                        )}
                        {prueba.estado === 'error' && (
                            <Alert variant="destructive">
                                <XCircle className="size-4" />
                                <AlertDescription>{prueba.mensaje}</AlertDescription>
                            </Alert>
                        )}

                        <div className="flex gap-3">
                            <Button type="submit" disabled={processing}>
                                {processing && <LoaderCircle className="size-4 animate-spin" />}
                                Guardar
                            </Button>
                            <Button type="button" variant="outline" disabled={prueba.estado === 'cargando'} onClick={probarConexion}>
                                {prueba.estado === 'cargando' && <LoaderCircle className="size-4 animate-spin" />}
                                Probar conexión
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}
