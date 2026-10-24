import HeadingSmall from '@/components/heading-small';
import { KpiCard, KpiCardGrid } from '@/components/kpi-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Fuel, Gauge, LoaderCircle, RefreshCw, Truck } from 'lucide-react';
import { Fragment, FormEventHandler, useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Flota', href: '/modules/flota' },
    { title: 'Análisis de Combustible', href: '/modules/flota/combustible' },
];

interface FilaPlaca {
    placa: string;
    km_total: number;
    dias_con_datos: number;
    galones_total: number;
    total_pagado: number;
    rendimiento_km_gl: number | null;
    costo_km: number | null;
    meta_km_gl: number | null;
    cumplimiento_pct: number | null;
}

interface FilaDia {
    fecha: string;
    km: number | null;
    ruta: string | null;
    conductor: string | null;
}

type Filters = { desde: string; hasta: string };

function cumplimientoColor(pct: number | null): string {
    if (pct === null) return 'text-muted-foreground';
    if (pct >= 100) return 'text-emerald-600 dark:text-emerald-400';
    if (pct >= 85) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
}

function DetallePlacaRow({ placa, desde, hasta }: { placa: string; desde: string; hasta: string }) {
    const [filas, setFilas] = useState<FilaDia[] | null>(null);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        fetch(`${route('flota.combustible.detalle-placa')}?${new URLSearchParams({ placa, desde, hasta })}`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
        })
            .then((r) => r.json())
            .then((data: { filas: FilaDia[] }) => setFilas(data.filas))
            .finally(() => setCargando(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <TableRow>
            <TableCell colSpan={9} className="bg-muted/30 p-0">
                <div className="p-3">
                    {cargando ? (
                        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                            <LoaderCircle className="size-4 animate-spin" />
                            Cargando detalle por día...
                        </div>
                    ) : !filas || filas.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">Sin km ni rutas registradas en este rango.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Ruta</TableHead>
                                    <TableHead>Conductor</TableHead>
                                    <TableHead className="text-right">Km</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filas.map((f) => (
                                    <TableRow key={f.fecha}>
                                        <TableCell>{f.fecha}</TableCell>
                                        <TableCell>{f.ruta ?? '—'}</TableCell>
                                        <TableCell>{f.conductor ?? '—'}</TableCell>
                                        <TableCell className="text-right">{f.km ?? '—'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </TableCell>
        </TableRow>
    );
}

export default function AnalisisCombustibleIndex({ por_placa: porPlaca, filters }: { por_placa: FilaPlaca[]; filters: Filters }) {
    const { flash } = usePage<{ flash?: { status?: { message: string; type: string } } }>().props;
    const [desde, setDesde] = useState(filters.desde);
    const [hasta, setHasta] = useState(filters.hasta);
    const [fechaSync, setFechaSync] = useState(new Date(Date.now() - 86400000).toISOString().slice(0, 10));
    const [sincronizando, setSincronizando] = useState(false);
    const [expandida, setExpandida] = useState<string | null>(null);
    const [metas, setMetas] = useState<Record<string, string>>({});

    const applyFilters: FormEventHandler = (e) => {
        e.preventDefault();
        router.get(route('flota.combustible.index'), { desde, hasta }, { preserveState: true, replace: true });
    };

    const sincronizarAhora = () => {
        setSincronizando(true);
        router.post(
            route('flota.combustible.sincronizar'),
            { fecha: fechaSync },
            { preserveScroll: true, onFinish: () => setSincronizando(false) },
        );
    };

    const guardarMeta = (placa: string) => {
        const valor = metas[placa];
        router.patch(
            route('flota.combustible.meta.update', placa),
            { meta_km_gl: valor === '' ? null : valor },
            { preserveScroll: true, preserveState: true },
        );
    };

    const kmTotal = porPlaca.reduce((acc, f) => acc + f.km_total, 0);
    const galonesTotal = porPlaca.reduce((acc, f) => acc + f.galones_total, 0);
    const rendimientoPromedio = galonesTotal > 0 ? kmTotal / galonesTotal : null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Análisis de Combustible" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <HeadingSmall
                        title="Análisis de Combustible"
                        description="Kilómetros (MyGeotab) cruzados con tanqueadas confirmadas — rendimiento km/gl por vehículo."
                    />
                    <Button variant="outline" asChild>
                        <Link href={route('flota.combustible.vouchers.index')}>Vouchers de Tanqueo</Link>
                    </Button>
                </div>

                {flash?.status && (
                    <div
                        className={`flex items-center gap-2 rounded-lg border p-4 text-sm font-medium shadow-xs ${
                            flash.status.type === 'success'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}
                    >
                        {flash.status.type === 'success' ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
                        <span>{flash.status.message}</span>
                    </div>
                )}

                <KpiCardGrid className="sm:grid-cols-2 lg:grid-cols-4">
                    <KpiCard label="Vehículos con datos" value={porPlaca.length} icon={Truck} color="#2B6CB0" />
                    <KpiCard label="Km totales en el rango" value={Math.round(kmTotal).toLocaleString('es-CO')} icon={Fuel} color="#2B6CB0" />
                    <KpiCard label="Galones tanqueados (revisados)" value={galonesTotal.toLocaleString('es-CO')} icon={Fuel} color="#D97706" />
                    <KpiCard
                        label="Rendimiento promedio"
                        value={rendimientoPromedio ? `${rendimientoPromedio.toFixed(2)} km/gl` : '—'}
                        icon={Gauge}
                        color="#15803d"
                    />
                </KpiCardGrid>

                <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                    <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-4">
                        <div className="grid gap-1">
                            <Label className="text-xs text-muted-foreground">Desde</Label>
                            <Input type="date" className="w-40" value={desde} onChange={(e) => setDesde(e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-xs text-muted-foreground">Hasta</Label>
                            <Input type="date" className="w-40" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                        </div>
                        <Button type="submit" variant="secondary">
                            Filtrar
                        </Button>
                    </form>

                    <div className="flex items-end gap-2">
                        <div className="grid gap-1">
                            <Label className="text-xs text-muted-foreground">Sincronizar día</Label>
                            <Input type="date" className="w-40" value={fechaSync} onChange={(e) => setFechaSync(e.target.value)} />
                        </div>
                        <Button type="button" variant="outline" disabled={sincronizando} onClick={sincronizarAhora}>
                            {sincronizando ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                            Sincronizar ahora
                        </Button>
                    </div>
                </div>

                <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead></TableHead>
                                <TableHead>Placa</TableHead>
                                <TableHead className="text-right">Km</TableHead>
                                <TableHead className="text-right">Galones</TableHead>
                                <TableHead className="text-right">Total pagado</TableHead>
                                <TableHead className="text-right">Costo/km</TableHead>
                                <TableHead className="text-right">Km/gl</TableHead>
                                <TableHead className="text-right">Meta</TableHead>
                                <TableHead className="text-right">Cumplimiento</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {porPlaca.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                                        Todavía no hay datos en este rango.
                                    </TableCell>
                                </TableRow>
                            )}
                            {porPlaca.map((fila) => (
                                <Fragment key={fila.placa}>
                                    <TableRow className="cursor-pointer" onClick={() => setExpandida(expandida === fila.placa ? null : fila.placa)}>
                                        <TableCell>
                                            {expandida === fila.placa ? (
                                                <ChevronDown className="size-4 text-muted-foreground" />
                                            ) : (
                                                <ChevronRight className="size-4 text-muted-foreground" />
                                            )}
                                        </TableCell>
                                        <TableCell className="font-medium">{fila.placa}</TableCell>
                                        <TableCell className="text-right">{fila.km_total.toLocaleString('es-CO')}</TableCell>
                                        <TableCell className="text-right">{fila.galones_total.toLocaleString('es-CO')}</TableCell>
                                        <TableCell className="text-right">{fila.total_pagado.toLocaleString('es-CO')}</TableCell>
                                        <TableCell className="text-right">{fila.costo_km ? fila.costo_km.toLocaleString('es-CO') : '—'}</TableCell>
                                        <TableCell className="text-right font-medium">{fila.rendimiento_km_gl ?? '—'}</TableCell>
                                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                className="w-20 text-right"
                                                defaultValue={fila.meta_km_gl ?? ''}
                                                onChange={(e) => setMetas({ ...metas, [fila.placa]: e.target.value })}
                                                onBlur={() => guardarMeta(fila.placa)}
                                            />
                                        </TableCell>
                                        <TableCell className={`text-right font-medium ${cumplimientoColor(fila.cumplimiento_pct)}`}>
                                            {fila.cumplimiento_pct !== null ? `${fila.cumplimiento_pct}%` : '—'}
                                        </TableCell>
                                    </TableRow>
                                    {expandida === fila.placa && <DetallePlacaRow placa={fila.placa} desde={desde} hasta={hasta} />}
                                </Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </AppLayout>
    );
}
