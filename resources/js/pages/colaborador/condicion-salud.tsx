import HeadingSmall from '@/components/heading-small';
import { SafeImage } from '@/components/safe-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import InputError from '@/components/input-error';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { AlertTriangle, Clock, FileSignature, LoaderCircle } from 'lucide-react';
import { FormEventHandler, useMemo } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Condición de Salud', href: '/portal/condicion-salud' },
];

const ESTADOS = [
    {
        value: 'Bueno',
        className:
            'border-emerald-300 text-emerald-700 data-[selected=true]:border-emerald-500 data-[selected=true]:bg-emerald-500 data-[selected=true]:text-white dark:border-emerald-500/30 dark:text-emerald-300 dark:data-[selected=true]:border-emerald-500',
    },
    {
        value: 'Regular',
        className:
            'border-amber-300 text-amber-700 data-[selected=true]:border-amber-500 data-[selected=true]:bg-amber-500 data-[selected=true]:text-white dark:border-amber-500/30 dark:text-amber-300 dark:data-[selected=true]:border-amber-500',
    },
    {
        value: 'Malo',
        className:
            'border-red-300 text-red-700 data-[selected=true]:border-red-500 data-[selected=true]:bg-red-500 data-[selected=true]:text-white dark:border-red-500/30 dark:text-red-300 dark:data-[selected=true]:border-red-500',
    },
];

interface FirmaPrueba {
    fecha_hora: string;
    tipo: string;
    firma_url: string;
}

interface RegistroHoy {
    estado: string;
    observacion: string | null;
}

interface Consentimiento {
    version: string;
    texto: string;
}

interface ColaboradorIdentidad {
    nombre_completo: string;
    cargo: string | null;
    area: string | null;
}

interface UltimoIngreso {
    fecha_hora: string;
    hora: string;
    es_de_hoy: boolean;
    minutos_transcurridos: number | null;
}

interface CondicionSaludForm {
    momento: 'ingreso' | 'salida';
    estado: string;
    observacion: string;
    consentimiento_aceptado: boolean;
    [key: string]: string | boolean;
}

export default function CondicionSaludPortal({
    colaborador,
    puedeFirmar,
    firmaPrueba,
    registrosHoy,
    entradaAbierta = false,
    ultimoIngreso = null,
    jornadaAbierta,
    consentimiento,
}: {
    colaborador: ColaboradorIdentidad;
    puedeFirmar: boolean;
    firmaPrueba: FirmaPrueba | null;
    registrosHoy: Record<string, RegistroHoy>;
    entradaAbierta?: boolean;
    ultimoIngreso?: UltimoIngreso | null;
    jornadaAbierta: boolean;
    consentimiento: Consentimiento;
}) {
    const tieneEntradaAbierta = entradaAbierta || jornadaAbierta;

    const ingresoBloqueado = tieneEntradaAbierta || Boolean(registrosHoy.ingreso);
    const salidaBloqueada = !tieneEntradaAbierta;
    const ambosCompletados = Boolean(registrosHoy.ingreso) && Boolean(registrosHoy.salida);

    const esperaHoraIncompleta =
        tieneEntradaAbierta &&
        ultimoIngreso?.minutos_transcurridos !== null &&
        (ultimoIngreso?.minutos_transcurridos ?? 0) < 60;

    const { data, setData, post, processing, errors } = useForm<CondicionSaludForm>({
        momento: tieneEntradaAbierta ? 'salida' : 'ingreso',
        estado: '',
        observacion: '',
        consentimiento_aceptado: false,
    });

    const fechaHoraActual = useMemo(() => new Date().toLocaleString(), []);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('portal.condicion-salud.store'), { preserveScroll: true });
    };

    const requiereObservacion = data.estado === 'Regular' || data.estado === 'Malo';

    if (!puedeFirmar) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Condición de Salud" />
                <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 rounded-xl p-4 text-center">
                    <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <AlertTriangle className="size-8" />
                    </div>
                    <HeadingSmall
                        title="Aún no puedes registrar tu condición de salud"
                        description="Necesitas tener al menos una prueba de alcoholemia realizada, ya que tu firma electrónica se toma de esa prueba."
                    />
                    <Button asChild>
                        <Link href="/portal/pruebas">Ver mis pruebas</Link>
                    </Button>
                </div>
            </AppLayout>
        );
    }

    if (ambosCompletados) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Condición de Salud" />
                <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 rounded-xl p-4 text-center">
                    <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                        <FileSignature className="size-8" />
                    </div>
                    <HeadingSmall
                        title="Ya completaste tu registro de hoy"
                        description="Registraste tu ingreso y tu salida. Cada registro queda firmado y no se puede modificar."
                    />
                    <Button asChild>
                        <Link href="/portal/condicion-salud/historial">Ver mi historial</Link>
                    </Button>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Condición de Salud" />
            <div className="mx-auto flex h-full w-full max-w-2xl flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <HeadingSmall title="Condición de Salud" description="Registra tu estado al ingreso y a la salida de tu jornada." />
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/portal/condicion-salud/historial">Ver mi historial</Link>
                    </Button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm">
                    <div>
                        <span className="font-medium text-foreground">{colaborador.nombre_completo}</span>
                        <span className="text-muted-foreground">
                            {' '}
                            {[colaborador.cargo, colaborador.area].filter(Boolean).join(' · ')}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="size-3.5" />
                        {fechaHoraActual}
                    </div>
                </div>

                {firmaPrueba && (
                    <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                            <FileSignature className="size-4 text-muted-foreground" />
                            <CardTitle className="text-sm font-medium text-muted-foreground">Tu firma electrónica</CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-center gap-4">
                            <SafeImage src={firmaPrueba.firma_url} alt="Firma" className="h-16 w-32 rounded-md border border-border object-contain bg-white" />
                            <p className="text-sm text-muted-foreground">
                                Capturada en tu prueba de alcoholemia de tipo <span className="font-medium capitalize">{firmaPrueba.tipo}</span> del{' '}
                                {new Date(firmaPrueba.fecha_hora).toLocaleString()}.
                            </p>
                        </CardContent>
                    </Card>
                )}

                <form onSubmit={submit} className="space-y-4">
                    <div className="grid gap-2">
                        <Label>Momento</Label>
                        <div className="flex gap-2">
                            {(['ingreso', 'salida'] as const).map((momento) => {
                                const deshabilitado = momento === 'ingreso' ? ingresoBloqueado : salidaBloqueada;
                                return (
                                    <button
                                        key={momento}
                                        type="button"
                                        disabled={deshabilitado}
                                        data-selected={data.momento === momento}
                                        onClick={() => setData('momento', momento)}
                                        className="flex-1 rounded-md border px-3 py-2 text-sm capitalize transition-colors data-[selected=true]:border-primary data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        {momento}
                                    </button>
                                );
                            })}
                        </div>
                        {tieneEntradaAbierta && (
                            <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                                {ultimoIngreso?.es_de_hoy
                                    ? `Tienes una entrada abierta de hoy (${ultimoIngreso.hora}). Registra tu salida para cerrar este ciclo.`
                                    : `Tienes una entrada anterior abierta sin cerrar (del ${ultimoIngreso?.fecha_hora ?? 'día anterior'}). Registra tu salida para poder iniciar una nueva entrada.`}
                            </p>
                        )}
                        {data.momento === 'salida' && esperaHoraIncompleta && (
                            <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
                                <Clock className="mt-0.5 size-3.5 shrink-0" />
                                Debes esperar como mínimo 1 hora desde tu entrada para poder registrar la salida (Entrada a las {ultimoIngreso?.hora}. Faltan {60 - (ultimoIngreso?.minutos_transcurridos ?? 0)} minutos).
                            </p>
                        )}
                        {!tieneEntradaAbierta && data.momento === 'ingreso' && registrosHoy.ingreso && (
                            <p className="text-xs text-muted-foreground">
                                Ya registraste tu entrada de hoy como{' '}
                                <Badge variant="secondary">{registrosHoy.ingreso.estado}</Badge>.
                            </p>
                        )}
                        <InputError message={errors.momento} />
                    </div>

                    <div className="grid gap-2">
                        <Label>Estado</Label>
                        <div className="flex gap-2">
                            {ESTADOS.map((estado) => (
                                <button
                                    key={estado.value}
                                    type="button"
                                    data-selected={data.estado === estado.value}
                                    onClick={() => setData('estado', estado.value)}
                                    className={cn('flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors', estado.className)}
                                >
                                    {estado.value}
                                </button>
                            ))}
                        </div>
                        <InputError message={errors.estado} />
                    </div>

                    {requiereObservacion && (
                        <div className="grid gap-2">
                            <Label htmlFor="observacion">Observación (obligatoria)</Label>
                            <textarea
                                id="observacion"
                                className="border-input bg-background flex min-h-20 w-full rounded-md border px-3 py-2 text-sm"
                                value={data.observacion}
                                onChange={(e) => setData('observacion', e.target.value)}
                            />
                            <InputError message={errors.observacion} />
                        </div>
                    )}

                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                        <p className="mb-3 max-h-40 overflow-y-auto text-xs leading-relaxed text-muted-foreground">{consentimiento.texto}</p>
                        <div className="flex items-start gap-2">
                            <Checkbox
                                id="consentimiento_aceptado"
                                checked={data.consentimiento_aceptado}
                                onCheckedChange={(checked) => setData('consentimiento_aceptado', checked === true)}
                            />
                            <Label htmlFor="consentimiento_aceptado" className="text-sm font-normal">
                                He leído y acepto la declaración anterior, y autorizo el uso de mi firma digital mostrada arriba como mi firma
                                electrónica para este registro (Ley 527 de 1999).
                            </Label>
                        </div>
                        <InputError message={errors.consentimiento_aceptado} />
                    </div>

                    <Button
                        type="submit"
                        disabled={
                            processing ||
                            !data.estado ||
                            !data.consentimiento_aceptado ||
                            (data.momento === 'salida' && esperaHoraIncompleta)
                        }
                    >
                        {processing && <LoaderCircle className="size-4 animate-spin" />}
                        Registrar {data.momento}
                    </Button>
                </form>
            </div>
        </AppLayout>
    );
}
