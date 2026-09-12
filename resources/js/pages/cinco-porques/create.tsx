import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { LoaderCircle, Sparkles, TriangleAlert } from 'lucide-react';
import { FormEventHandler, useCallback, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: '5 Por Qué', href: '/cinco-porques' },
];

const NIVELES = [0, 1, 2, 3, 4] as const;
const OTRO = '__otro__';

function leerCookie(nombre: string): string | null {
    const match = document.cookie.match(new RegExp('(?:^|; )' + nombre + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
}

interface NivelEstado {
    opciones: string[];
    seleccion: string; // texto de la opción elegida, OTRO, o ''
    custom: string; // texto libre cuando seleccion === OTRO
    cargando: boolean;
}

const nivelVacio = (): NivelEstado => ({ opciones: [], seleccion: '', custom: '', cargando: false });

function textoNivel(n: NivelEstado): string {
    if (n.seleccion === OTRO) return n.custom.trim();
    return n.seleccion.trim();
}

export default function CincoPorquesCreate({
    ejecutor,
    vehiculos,
    rutinaFija,
    indicadores,
}: {
    ejecutor: string;
    vehiculos: { id: number; placa: string }[];
    rutinaFija: string;
    indicadores: string[];
}) {
    const [fecha, setFecha] = useState('');
    const [vehiculo, setVehiculo] = useState('');
    // La rutina es fija ("Matutina de distribución"): se muestra como campo de
    // solo lectura y se envía tal cual.
    const [rutina] = useState(rutinaFija);
    const [indicador, setIndicador] = useState('');
    const [problema, setProblema] = useState('');

    const [niveles, setNiveles] = useState<NivelEstado[]>(NIVELES.map(nivelVacio));
    const [causaRaiz, setCausaRaiz] = useState('');
    const [planAccion, setPlanAccion] = useState('');
    const [generandoConclusion, setGenerandoConclusion] = useState(false);
    const [iaSugerencias, setIaSugerencias] = useState<Record<string, unknown>>({});

    const [errorIa, setErrorIa] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [errores, setErrores] = useState<Record<string, string>>({});

    const cabeceraLista = rutina !== '' && indicador !== '' && problema.trim().length > 0;

    const llamarIa = useCallback(
        async (seleccionados: string[]): Promise<{ tipo: string; opciones?: string[]; causa_raiz?: string; plan_accion?: string } | null> => {
            const respuesta = await fetch(route('cinco-porques.ia.analizar'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': leerCookie('XSRF-TOKEN') ?? '',
                },
                body: JSON.stringify({ problema, rutina, indicador, seleccionados }),
            });
            const datos = await respuesta.json().catch(() => null);
            if (!respuesta.ok) {
                throw new Error(datos?.message ?? 'No se pudo obtener la respuesta de la IA.');
            }
            return datos;
        },
        [problema, rutina, indicador],
    );

    const seleccionadosHasta = (limite: number): string[] => {
        const acc: string[] = [];
        for (let i = 0; i < limite; i++) {
            const t = textoNivel(niveles[i]);
            if (!t) break;
            acc.push(t);
        }
        return acc;
    };

    /**
     * Genera las opciones del nivel `indice`. `cadenaPrevia` son los "por qué"
     * de los niveles anteriores; si se omite se toman del estado actual (para
     * el botón "Regenerar opciones" de un nivel ya definido).
     */
    const generarNivel = async (indice: number, cadenaPrevia?: string[]) => {
        setErrorIa(null);
        const seleccionados = cadenaPrevia ?? seleccionadosHasta(indice);
        if (seleccionados.length !== indice) return;

        setNiveles((prev) => prev.map((n, i) => (i === indice ? { ...n, cargando: true } : n)));
        try {
            const datos = await llamarIa(seleccionados);
            const opciones = datos?.opciones ?? [];
            setNiveles((prev) =>
                prev.map((n, i) => {
                    if (i < indice) return n;
                    if (i === indice) return { ...nivelVacio(), opciones };
                    return nivelVacio();
                }),
            );
            setCausaRaiz('');
            setPlanAccion('');
            setIaSugerencias((prev) => ({ ...prev, [`nivel_${indice + 1}`]: opciones }));
        } catch (e) {
            setErrorIa(e instanceof Error ? e.message : 'Error al consultar la IA.');
            setNiveles((prev) => prev.map((n, i) => (i === indice ? { ...n, cargando: false } : n)));
        }
    };

    const generarConclusion = async () => {
        setErrorIa(null);
        const seleccionados = seleccionadosHasta(5);
        if (seleccionados.length < 5) return;

        setGenerandoConclusion(true);
        try {
            const datos = await llamarIa(seleccionados);
            setCausaRaiz(datos?.causa_raiz ?? '');
            setPlanAccion(datos?.plan_accion ?? '');
            setIaSugerencias((prev) => ({
                ...prev,
                conclusion: { causa_raiz: datos?.causa_raiz, plan_accion: datos?.plan_accion },
            }));
        } catch (e) {
            setErrorIa(e instanceof Error ? e.message : 'Error al consultar la IA.');
        } finally {
            setGenerandoConclusion(false);
        }
    };

    // Al elegir/definir la respuesta de un nivel, se limpian los siguientes.
    const setSeleccionNivel = (indice: number, patch: Partial<NivelEstado>) => {
        setNiveles((prev) =>
            prev.map((n, i) => {
                if (i === indice) return { ...n, ...patch };
                if (i > indice) return nivelVacio();
                return n;
            }),
        );
        setCausaRaiz('');
        setPlanAccion('');
    };

    const nivelDefinido = (i: number) => textoNivel(niveles[i]).length > 0;
    const todosLosPorques = NIVELES.every((_, i) => nivelDefinido(i));
    const puedeGuardar =
        vehiculo !== '' && cabeceraLista && todosLosPorques && causaRaiz.trim() !== '' && planAccion.trim() !== '' && !enviando;

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        setErrores({});
        setEnviando(true);
        router.post(
            route('cinco-porques.store'),
            {
                fecha,
                vehiculo_id: vehiculo ? Number(vehiculo) : null,
                rutina,
                indicador,
                problema,
                porque_1: textoNivel(niveles[0]),
                porque_2: textoNivel(niveles[1]),
                porque_3: textoNivel(niveles[2]),
                porque_4: textoNivel(niveles[3]),
                porque_5: textoNivel(niveles[4]),
                causa_raiz: causaRaiz,
                plan_accion: planAccion,
                ia_sugerencias: JSON.stringify(iaSugerencias),
            },
            {
                onError: (errs) => setErrores(errs as Record<string, string>),
                onFinish: () => setEnviando(false),
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="5 Por Qué" />
            <div className="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <HeadingSmall title="5 Por Qué" description="Análisis de causa raíz asistido por IA." />
                    <Button variant="outline" size="sm" asChild>
                        <Link href={route('cinco-porques.historial')}>Ver historial</Link>
                    </Button>
                </div>

                <form onSubmit={submit} className="space-y-6">
                    {/* HEAD */}
                    <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                        <CardHeader>
                            <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">Encabezado</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="fecha">Fecha</Label>
                                <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-fit" />
                                <InputError message={errores.fecha} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Nombre de quien ejecuta</Label>
                                <div className="border-input bg-muted text-muted-foreground flex h-10 items-center rounded-md border px-3 text-sm">
                                    {ejecutor}
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label>Vehículo</Label>
                                <Select value={vehiculo} onValueChange={setVehiculo}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar placa" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vehiculos.length === 0 && (
                                            <SelectItem value="__none__" disabled>
                                                No hay vehículos activos
                                            </SelectItem>
                                        )}
                                        {vehiculos.map((v) => (
                                            <SelectItem key={v.id} value={String(v.id)}>
                                                {v.placa}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={errores.vehiculo_id} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* QUESTIONS */}
                    <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                        <CardHeader>
                            <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">Datos del análisis</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="grid gap-2">
                                <Label>Rutina a la que aplica</Label>
                                <div className="border-input bg-muted text-muted-foreground flex h-10 items-center rounded-md border px-3 text-sm">
                                    {rutina}
                                </div>
                                <InputError message={errores.rutina} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Indicador afectado</Label>
                                <Select
                                    value={indicador}
                                    onValueChange={(v) => {
                                        setIndicador(v);
                                        setNiveles(NIVELES.map(nivelVacio));
                                        setCausaRaiz('');
                                        setPlanAccion('');
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {indicadores.map((i) => (
                                            <SelectItem key={i} value={i}>
                                                {i}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={errores.indicador} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="problema">Problema a resolver</Label>
                                <Textarea
                                    id="problema"
                                    value={problema}
                                    onChange={(e) => setProblema(e.target.value)}
                                    placeholder="Describe con detalle el problema que quieres analizar…"
                                    className="min-h-24"
                                />
                                <InputError message={errores.problema} />
                            </div>

                            <div>
                                <Button type="button" onClick={() => generarNivel(0)} disabled={!cabeceraLista || niveles[0].cargando}>
                                    {niveles[0].cargando ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                                    {niveles[0].opciones.length > 0 ? 'Reiniciar análisis con IA' : 'Analizar con IA'}
                                </Button>
                                {!cabeceraLista && (
                                    <p className="text-muted-foreground mt-1.5 text-xs">
                                        Completa rutina, indicador y el problema para empezar el análisis.
                                    </p>
                                )}
                            </div>

                            {errorIa && (
                                <p className="flex items-start gap-1.5 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
                                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                                    {errorIa}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* 5 ¿POR QUÉ? */}
                    {niveles[0].opciones.length > 0 && (
                        <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                            <CardHeader>
                                <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">5 ¿Por qué?</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-5">
                                {NIVELES.map((_, indice) => {
                                    const nivel = niveles[indice];
                                    const habilitado = indice === 0 || nivelDefinido(indice - 1);
                                    if (!habilitado && nivel.opciones.length === 0) return null;

                                    return (
                                        <div key={indice} className="border-border grid gap-2 rounded-lg border p-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <Label className="text-amber-600">¿Por qué? {indice + 1}</Label>
                                                {nivel.opciones.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => generarNivel(indice)}
                                                        disabled={nivel.cargando}
                                                        className="text-primary text-xs hover:underline disabled:opacity-50"
                                                    >
                                                        Regenerar opciones
                                                    </button>
                                                )}
                                            </div>

                                            {nivel.cargando && (
                                                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                                                    <LoaderCircle className="size-3.5 animate-spin" /> Generando opciones…
                                                </p>
                                            )}

                                            {nivel.opciones.length === 0 && !nivel.cargando && (
                                                <Button type="button" size="sm" variant="secondary" onClick={() => generarNivel(indice)}>
                                                    <Sparkles className="size-3.5" /> Generar opciones del ¿Por qué? {indice + 1}
                                                </Button>
                                            )}

                                            <div className="grid gap-1.5">
                                                {nivel.opciones.map((opcion) => (
                                                    <button
                                                        key={opcion}
                                                        type="button"
                                                        data-selected={nivel.seleccion === opcion}
                                                        onClick={() => {
                                                            setSeleccionNivel(indice, { seleccion: opcion, custom: '' });
                                                            if (indice < 4) void generarNivel(indice + 1, [...seleccionadosHasta(indice), opcion]);
                                                        }}
                                                        className={cn(
                                                            'rounded-md border px-3 py-2 text-left text-sm transition-colors',
                                                            'data-[selected=true]:border-primary data-[selected=true]:bg-primary/5',
                                                            'hover:border-primary/50',
                                                        )}
                                                    >
                                                        {opcion}
                                                    </button>
                                                ))}
                                                {nivel.opciones.length > 0 && (
                                                    <button
                                                        type="button"
                                                        data-selected={nivel.seleccion === OTRO}
                                                        onClick={() => setSeleccionNivel(indice, { seleccion: OTRO })}
                                                        className="text-muted-foreground data-[selected=true]:border-primary data-[selected=true]:text-foreground hover:border-primary/50 rounded-md border border-dashed px-3 py-2 text-left text-sm transition-colors"
                                                    >
                                                        Escribir otra respuesta…
                                                    </button>
                                                )}
                                            </div>

                                            {nivel.seleccion === OTRO && (
                                                <div className="grid gap-1.5">
                                                    <Textarea
                                                        value={nivel.custom}
                                                        onChange={(e) => setSeleccionNivel(indice, { seleccion: OTRO, custom: e.target.value })}
                                                        placeholder={`Escribe el ¿Por qué? ${indice + 1}…`}
                                                        className="min-h-16"
                                                    />
                                                    {indice < 4 && nivel.custom.trim() !== '' && (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="secondary"
                                                            onClick={() =>
                                                                generarNivel(indice + 1, [...seleccionadosHasta(indice), nivel.custom.trim()])
                                                            }
                                                        >
                                                            Continuar al ¿Por qué? {indice + 2}
                                                        </Button>
                                                    )}
                                                </div>
                                            )}

                                            <InputError message={errores[`porque_${indice + 1}`]} />
                                        </div>
                                    );
                                })}

                                {todosLosPorques && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={generarConclusion}
                                        disabled={generandoConclusion}
                                        className="w-fit"
                                    >
                                        {generandoConclusion ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                                        {causaRaiz ? 'Regenerar causa raíz y plan' : 'Generar causa raíz y plan de acción'}
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* CONCLUSIÓN */}
                    {(causaRaiz !== '' || planAccion !== '' || todosLosPorques) && (
                        <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                            <CardHeader>
                                <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">Conclusión</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="causa_raiz">Causa Raíz (Principal)</Label>
                                    <Textarea
                                        id="causa_raiz"
                                        value={causaRaiz}
                                        onChange={(e) => setCausaRaiz(e.target.value)}
                                        placeholder="La IA la propondrá; puedes ajustarla."
                                        className="min-h-16"
                                    />
                                    <InputError message={errores.causa_raiz} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="plan_accion">Plan de acción</Label>
                                    <Textarea
                                        id="plan_accion"
                                        value={planAccion}
                                        onChange={(e) => setPlanAccion(e.target.value)}
                                        placeholder="La IA lo propondrá; puedes ajustarlo."
                                        className="min-h-28"
                                    />
                                    <InputError message={errores.plan_accion} />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="flex flex-col items-start gap-1.5">
                        <Button type="submit" disabled={!puedeGuardar}>
                            {enviando && <LoaderCircle className="size-4 animate-spin" />}
                            Guardar análisis
                        </Button>
                        {vehiculo === '' && todosLosPorques && causaRaiz.trim() !== '' && planAccion.trim() !== '' && (
                            <p className="text-muted-foreground text-xs">Selecciona la placa del vehículo para poder guardar el análisis.</p>
                        )}
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
