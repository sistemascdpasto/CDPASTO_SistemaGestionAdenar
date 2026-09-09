import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Calendar, CheckCircle2, Clock, Loader2, Play, Route, StopCircle, UserCheck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'Medición Tiempos Inv. Vehículos', href: '/modules/gente/responsable-ruta' },
];

interface ColaboradorResponsable {
    id: number;
    cedula: string;
    nombre_completo: string;
    cargo: string;
    codigo_qr_skap: string | null;
}

interface EstadoColaborador {
    id: number;
    inicio: string | null;
    inicio_fecha: string | null;
    fin: string | null;
    fin_fecha: string | null;
    duracion_minutos: number | null;
    duracion_formateada: string | null;
    esta_finalizado: boolean;
}

type EstadosPorColaborador = Record<string, EstadoColaborador | undefined>;

interface PageProps {
    fecha_actual: string;
    colaboradores: ColaboradorResponsable[];
    estados_por_colaborador: EstadosPorColaborador;
    success?: string;
    errors?: Record<string, string>;
}

type ModoVerificacion = 'inicio' | 'finalizacion';

export default function ResponsableRutaIndex({ fecha_actual, colaboradores = [], estados_por_colaborador = {} }: PageProps) {
    const pageProps = usePage<PageProps>().props;
    const success = pageProps.success;
    const errors = pageProps.errors || {};

    const [fecha] = useState<string>(fecha_actual);
    const [colaboradorId, setColaboradorId] = useState<string>('');
    const [modo, setModo] = useState<ModoVerificacion>('inicio');
    const [processing, setProcessing] = useState<boolean>(false);

    const selectedColaborador = colaboradores.find((c) => String(c.id) === colaboradorId);
    const estadoActual = selectedColaborador
        ? estados_por_colaborador[String(selectedColaborador.id)]
        : undefined;

    const tieneInicio = !!estadoActual?.inicio;
    const estaFinalizado = !!estadoActual?.esta_finalizado;

    // Cuando cambia el colaborador: ajustar el modo por defecto.
    useEffect(() => {
        if (!selectedColaborador) {
            setModo('inicio');
            return;
        }
        if (estaFinalizado) {
            // Proceso cerrado: mostramos cualquier cosa, los botones estarán bloqueados
            setModo('finalizacion');
        } else if (tieneInicio) {
            // Inicio sin fin → habilitamos finalización
            setModo('finalizacion');
        } else {
            // Nada aún → inicio
            setModo('inicio');
        }
    }, [colaboradorId, selectedColaborador, estaFinalizado, tieneInicio]);

    // Reglas de habilitación
    const inicioHabilitado = !!selectedColaborador && !tieneInicio && !estaFinalizado;
    const finalizacionHabilitada = !!selectedColaborador && tieneInicio && !estaFinalizado;

    const formatFechaVisual = (iso: string): string => {
        try {
            const d = new Date(iso + 'T00:00:00');
            return d.toLocaleDateString('es-CO', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        } catch {
            return iso;
        }
    };

    const formatearHora = (h: string | null | undefined): string => {
        if (!h) return '';
        return h;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (processing) return;

        const id = colaboradorId ? parseInt(colaboradorId, 10) : 0;
        if (!id) return;

        // El botón correspondiente según el modo
        const url =
            modo === 'inicio'
                ? '/modules/gente/responsable-ruta/inicio'
                : '/modules/gente/responsable-ruta/finalizacion';

        setProcessing(true);
        router.post(
            url,
            { colaborador_id: id },
            {
                preserveScroll: true,
                onFinish: () => {
                    setProcessing(false);
                },
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Medición de Tiempos en Inventario de Vehículos de Distribución" />

            <div className="space-y-6 p-6">
                {/* Header */}
                <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent p-6 shadow-sm dark:border-blue-900/50 dark:from-blue-950/20">
                    <div className="flex items-center gap-2">
                        <Route className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Medición de Tiempos en Inventario de Vehículos de Distribución
                        </h1>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Registro de tiempos: Inicio y Finalización de la comprobación de inventario del vehículo por el Responsable de Ruta.
                    </p>
                </div>

                {/* Alertas */}
                {success && (
                    <Alert variant="default" className="border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900/50">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        <AlertTitle className="text-emerald-800 dark:text-emerald-300 text-sm font-bold">
                            Registro exitoso
                        </AlertTitle>
                        <AlertDescription className="text-emerald-700 dark:text-emerald-400 text-xs">
                            {success}
                        </AlertDescription>
                    </Alert>
                )}
                {errors?.colaborador_id && (
                    <Alert variant="destructive">
                        <StopCircle className="h-5 w-5" />
                        <AlertTitle className="text-sm font-bold">Error de validación</AlertTitle>
                        <AlertDescription className="text-xs">{errors.colaborador_id}</AlertDescription>
                    </Alert>
                )}

                {/* Formulario */}
                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            <CardTitle className="text-base font-semibold">
                                Registro de Tiempos
                            </CardTitle>
                        </div>
                        <CardDescription className="text-xs">
                            La fecha se asigna automáticamente al ingresar a la vista y no es editable. Solo un registro (Inicio + Fin) por colaborador y día.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4" onSubmit={handleSubmit}>
                            {/* Fecha (no editable) */}
                            <div className="space-y-2">
                                <Label htmlFor="fecha" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5" />
                                    Fecha del Registro
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="fecha"
                                        type="date"
                                        value={fecha}
                                        disabled
                                        readOnly
                                        className="bg-muted cursor-not-allowed opacity-80 pl-9"
                                    />
                                    <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                                </div>
                                <p className="text-[11px] font-medium text-blue-700 dark:text-blue-400">
                                    📅 {formatFechaVisual(fecha)}
                                </p>
                            </div>

                            {/* Select Responsable de Ruta */}
                            <div className="space-y-2">
                                <Label htmlFor="colaborador" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <UserCheck className="h-3.5 w-3.5" />
                                    Responsable de Ruta
                                </Label>
                                <Select value={colaboradorId} onValueChange={setColaboradorId}>
                                    <SelectTrigger id="colaborador" className="w-full">
                                        <SelectValue placeholder="Seleccione el responsable..." />
                                    </SelectTrigger>
                                    <SelectContent align="start" className="max-h-80">
                                        {colaboradores.length === 0 ? (
                                            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                                                No hay responsables de ruta activos.
                                            </div>
                                        ) : (
                                            colaboradores.map((c) => {
                                                const est = estados_por_colaborador[String(c.id)];
                                                const estadoBadge = est
                                                    ? est.esta_finalizado
                                                        ? { label: 'CERRADO', color: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50' }
                                                        : { label: 'EN PROGRESO', color: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50' }
                                                    : { label: 'SIN INICIAR', color: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/50' };

                                                return (
                                                    <SelectItem key={c.id} value={String(c.id)} className="text-sm py-2">
                                                        <div className="flex w-full items-center justify-between gap-3">
                                                            <div className="flex flex-col leading-tight">
                                                                <span className="font-semibold">{c.nombre_completo}</span>
                                                                <span className="text-[10px] text-muted-foreground font-mono">
                                                                    CC {c.cedula}
                                                                </span>
                                                            </div>
                                                            <Badge
                                                                variant="outline"
                                                                className={`shrink-0 text-[9px] font-bold tracking-wide border ${estadoBadge.color}`}
                                                            >
                                                                {estadoBadge.label}
                                                            </Badge>
                                                        </div>
                                                    </SelectItem>
                                                );
                                            })
                                        )}
                                    </SelectContent>
                                </Select>
                                <p className="text-[11px] text-muted-foreground">
                                    Responsables cargados:{' '}
                                    <span className="font-bold text-foreground">{colaboradores.length}</span>
                                </p>
                            </div>

                            {/* Tipo: Inicio / Finalización */}
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5" />
                                    Tiempo de Verificación de Carga
                                </Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {/* Opción INICIO */}
                                    <button
                                        type="button"
                                        onClick={() => setModo('inicio')}
                                        disabled={!inicioHabilitado && modo !== 'inicio'}
                                        className={`relative flex items-center justify-start gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-all ${
                                            modo === 'inicio'
                                                ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-600'
                                                : inicioHabilitado
                                                  ? 'border-slate-200 bg-white hover:bg-slate-50 hover:border-emerald-300 dark:bg-slate-900 dark:border-slate-700 dark:hover:border-emerald-700 dark:hover:bg-slate-800'
                                                  : 'cursor-not-allowed opacity-40 bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700/50'
                                        }`}
                                    >
                                        <Play
                                            className={`h-4 w-4 shrink-0 ${
                                                modo === 'inicio' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                                            }`}
                                        />
                                        <div className="flex flex-col items-start leading-tight">
                                            <span>Inicio</span>
                                            {estadoActual?.inicio && (
                                                <span className="text-[9px] font-mono font-bold opacity-80">
                                                    {formatearHora(estadoActual.inicio)}
                                                </span>
                                            )}
                                        </div>
                                    </button>

                                    {/* Opción FINALIZACIÓN */}
                                    <button
                                        type="button"
                                        onClick={() => setModo('finalizacion')}
                                        disabled={!finalizacionHabilitada && modo !== 'finalizacion'}
                                        className={`relative flex items-center justify-start gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-all ${
                                            modo === 'finalizacion'
                                                ? 'border-rose-500 bg-rose-50 text-rose-800 ring-2 ring-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-600'
                                                : finalizacionHabilitada
                                                  ? 'border-slate-200 bg-white hover:bg-slate-50 hover:border-rose-300 dark:bg-slate-900 dark:border-slate-700 dark:hover:border-rose-700 dark:hover:bg-slate-800'
                                                  : 'cursor-not-allowed opacity-40 bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700/50'
                                        }`}
                                    >
                                        <StopCircle
                                            className={`h-4 w-4 shrink-0 ${
                                                modo === 'finalizacion'
                                                    ? 'text-rose-600 dark:text-rose-400'
                                                    : 'text-muted-foreground'
                                            }`}
                                        />
                                        <div className="flex flex-col items-start leading-tight">
                                            <span>Finalización</span>
                                            {estadoActual?.fin && (
                                                <span className="text-[9px] font-mono font-bold opacity-80">
                                                    {formatearHora(estadoActual.fin)}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    {!selectedColaborador
                                        ? 'Seleccione primero un responsable.'
                                        : estaFinalizado
                                          ? '✅ Proceso finalizado hoy. No se permiten más cambios.'
                                          : tieneInicio
                                            ? '✓ Inicio registrado. Ahora seleccione Finalización.'
                                            : 'Primero registre el Inicio para poder finalizar.'}
                                </p>
                            </div>

                            {/* Acciones (botón submit) */}
                            <div className="flex items-end justify-start sm:justify-end">
                                <Button
                                    type="submit"
                                    disabled={
                                        processing ||
                                        !selectedColaborador ||
                                        (modo === 'inicio' && !inicioHabilitado) ||
                                        (modo === 'finalizacion' && !finalizacionHabilitada)
                                    }
                                    className={`w-full sm:w-auto ${
                                        modo === 'inicio'
                                            ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500'
                                            : 'bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500'
                                    }`}
                                >
                                    {processing ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Guardando...
                                        </>
                                    ) : modo === 'inicio' ? (
                                        <>
                                            <Play className="mr-2 h-4 w-4" />
                                            Guardar Inicio
                                        </>
                                    ) : (
                                        <>
                                            <StopCircle className="mr-2 h-4 w-4" />
                                            Guardar Finalización
                                        </>
                                    )}
                                </Button>
                            </div>

                            {/* Resumen del seleccionado */}
                            {selectedColaborador && (
                                <div className="col-span-1 sm:col-span-2 lg:col-span-4">
                                    <Card
                                        className={`${
                                            estaFinalizado
                                                ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                                                : tieneInicio
                                                  ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20'
                                                  : 'border-blue-200 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20'
                                        }`}
                                    >
                                        <CardContent className="py-4">
                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                                {/* Datos del colaborador */}
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-sm font-bold text-foreground">
                                                            {selectedColaborador.nombre_completo}
                                                        </p>
                                                        <Badge
                                                            variant="outline"
                                                            className={
                                                                estaFinalizado
                                                                    ? 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50'
                                                                    : tieneInicio
                                                                      ? 'border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50'
                                                                      : 'border-slate-300 bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/50'
                                                            }
                                                        >
                                                            {estaFinalizado
                                                                ? '✓ Cerrado'
                                                                : tieneInicio
                                                                  ? '⏳ En progreso'
                                                                  : '○ Sin iniciar'}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        <span className="font-mono">CC {selectedColaborador.cedula}</span>
                                                        {' · '}
                                                        <span className="font-medium text-blue-700 dark:text-blue-400">
                                                            {selectedColaborador.cargo}
                                                        </span>
                                                    </p>
                                                </div>

                                                {/* Tiempos */}
                                                <div className="flex flex-wrap items-center gap-4 text-xs">
                                                    {estadoActual?.inicio ? (
                                                        <div className="flex flex-col rounded-md bg-white/70 dark:bg-slate-900/60 px-3 py-1.5 border border-slate-200 dark:border-slate-700/60">
                                                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                                                Inicio
                                                            </span>
                                                            <span className="font-mono font-bold text-foreground text-sm">
                                                                {formatearHora(estadoActual.inicio)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col rounded-md bg-white/50 dark:bg-slate-900/30 px-3 py-1.5 border border-dashed border-slate-300 dark:border-slate-700/50">
                                                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                                                Inicio
                                                            </span>
                                                            <span className="font-mono font-bold text-slate-400 text-sm">
                                                                --:--:--
                                                            </span>
                                                        </div>
                                                    )}

                                                    <span className="text-foreground/30 font-bold">→</span>

                                                    {estadoActual?.fin ? (
                                                        <div className="flex flex-col rounded-md bg-white/70 dark:bg-slate-900/60 px-3 py-1.5 border border-slate-200 dark:border-slate-700/60">
                                                            <span className="text-[9px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                                                                Fin
                                                            </span>
                                                            <span className="font-mono font-bold text-foreground text-sm">
                                                                {formatearHora(estadoActual.fin)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col rounded-md bg-white/50 dark:bg-slate-900/30 px-3 py-1.5 border border-dashed border-slate-300 dark:border-slate-700/50">
                                                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                                                Fin
                                                            </span>
                                                            <span className="font-mono font-bold text-slate-400 text-sm">
                                                                --:--:--
                                                            </span>
                                                        </div>
                                                    )}

                                                    {estadoActual?.duracion_formateada ? (
                                                        <div className="flex flex-col rounded-md bg-indigo-100 dark:bg-indigo-950/40 px-3 py-1.5 border border-indigo-200 dark:border-indigo-900/50">
                                                            <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                                                                Duración
                                                            </span>
                                                            <span className="font-mono font-extrabold text-indigo-800 dark:text-indigo-300 text-sm">
                                                                {estadoActual.duracion_formateada}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        estadoActual?.inicio && (
                                                            <div className="flex flex-col rounded-md bg-violet-50 dark:bg-violet-950/20 px-3 py-1.5 border border-violet-200 dark:border-violet-900/40">
                                                                <span className="text-[9px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                                                                    En proceso
                                                                </span>
                                                                <span className="font-mono font-bold text-violet-700 dark:text-violet-300 text-sm">
                                                                    ...calculando
                                                                </span>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
