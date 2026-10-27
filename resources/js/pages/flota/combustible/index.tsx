import HeadingSmall from '@/components/heading-small';
import { KpiCard, KpiCardGrid } from '@/components/kpi-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    Banknote,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Fuel,
    Gauge,
    LoaderCircle,
    RefreshCw,
    TrendingDown,
    Truck,
} from 'lucide-react';
import { Fragment, FormEventHandler, useEffect, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    Pie,
    PieChart,
    ComposedChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Flota', href: '/modules/flota' },
    { title: 'Análisis de Combustible', href: '/modules/flota/combustible' },
];

const COLOR_DISTRIBUCION: Record<string, string> = {
    'Sin tanqueadas revisadas': '#94a3b8',
    'Sin meta asignada': '#64748b',
    'Bajo meta (<85%)': '#dc2626',
    'Cerca de la meta (85-99%)': '#d97706',
    'Cumple la meta (≥100%)': '#15803d',
};

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
    // Solo presentes el día de una tanqueada: los galones de esa tanqueada
    // y el rendimiento del tramo que cerró (km desde la tanqueada anterior
    // ÷ estos galones) — ver RendimientoCombustibleCalculator.
    galones_tanqueada: number | null;
    rendimiento_tanqueada: number | null;
}

interface Kpis {
    vehiculos_con_datos: number;
    km_total: number;
    galones_total: number;
    costo_total: number;
    rendimiento_promedio: number | null;
    vehiculos_bajo_meta: number;
}

interface TendenciaDia {
    fecha: string;
    km: number;
    galones: number;
    costo: number;
}

interface DistribucionRango {
    rango: string;
    total: number;
}

type Filters = { desde: string; hasta: string };

function formatFechaCorta(fecha: string): string {
    const [, mes, dia] = fecha.split('-');
    return `${dia}/${mes}`;
}

function cumplimientoColor(pct: number | null): string {
    if (pct === null) return 'text-muted-foreground';
    if (pct >= 100) return 'text-emerald-600 dark:text-emerald-400';
    if (pct >= 85) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
}

function EmptyChart({ children }: { children: React.ReactNode }) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{children}</p>;
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
                                    <TableHead className="text-right">Tanqueada (gl)</TableHead>
                                    <TableHead className="text-right">Rendimiento tramo</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filas.map((f) => (
                                    <TableRow key={f.fecha} className={f.galones_tanqueada !== null ? 'bg-amber-50 dark:bg-amber-500/10' : undefined}>
                                        <TableCell>{f.fecha}</TableCell>
                                        <TableCell>{f.ruta ?? '—'}</TableCell>
                                        <TableCell>{f.conductor ?? '—'}</TableCell>
                                        <TableCell className="text-right">{f.km ?? '—'}</TableCell>
                                        <TableCell className="text-right">{f.galones_tanqueada ?? '—'}</TableCell>
                                        <TableCell className="text-right font-medium">
                                            {f.rendimiento_tanqueada !== null ? `${f.rendimiento_tanqueada} km/gl` : '—'}
                                        </TableCell>
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

export default function AnalisisCombustibleIndex({
    por_placa: porPlaca,
    kpis,
    tendencia_diaria: tendenciaDiaria,
    distribucion_cumplimiento: distribucionCumplimiento,
    ranking_rendimiento: rankingRendimiento,
    ranking_bajo_rendimiento: rankingBajoRendimiento,
    filters,
}: {
    por_placa: FilaPlaca[];
    kpis: Kpis;
    tendencia_diaria: TendenciaDia[];
    distribucion_cumplimiento: DistribucionRango[];
    ranking_rendimiento: FilaPlaca[];
    ranking_bajo_rendimiento: FilaPlaca[];
    filters: Filters;
}) {
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

    const sinDistribucion = distribucionCumplimiento.every((r) => r.total === 0);

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

                <KpiCardGrid className="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    <KpiCard label="Vehículos con datos" value={kpis.vehiculos_con_datos} icon={Truck} color="#2B6CB0" />
                    <KpiCard label="Km totales" value={kpis.km_total.toLocaleString('es-CO')} icon={Fuel} color="#2B6CB0" />
                    <KpiCard label="Galones tanqueados" value={kpis.galones_total.toLocaleString('es-CO')} icon={Fuel} color="#D97706" />
                    <KpiCard label="Costo total combustible" value={`$${kpis.costo_total.toLocaleString('es-CO')}`} icon={Banknote} color="#7c3aed" />
                    <KpiCard
                        label="Rendimiento promedio"
                        value={kpis.rendimiento_promedio ? `${kpis.rendimiento_promedio} km/gl` : '—'}
                        icon={Gauge}
                        color="#15803d"
                    />
                    <KpiCard label="Vehículos bajo meta" value={kpis.vehiculos_bajo_meta} icon={TrendingDown} color="#dc2626" />
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

                <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Tendencia diaria — km recorridos y galones tanqueados
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {tendenciaDiaria.length === 0 ? (
                                <EmptyChart>No hay datos suficientes en este rango.</EmptyChart>
                            ) : (
                                <ResponsiveContainer width="100%" height={280}>
                                    <ComposedChart data={tendenciaDiaria}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="fecha" tickFormatter={formatFechaCorta} tick={{ fontSize: 12 }} />
                                        <YAxis yAxisId="km" tick={{ fontSize: 12 }} />
                                        <YAxis yAxisId="galones" orientation="right" tick={{ fontSize: 12 }} />
                                        <Tooltip
                                            labelFormatter={(label) => formatFechaCorta(String(label))}
                                            formatter={(value, name) => [value, name === 'km' ? 'Km' : 'Galones']}
                                        />
                                        <Legend
                                            wrapperStyle={{ fontSize: 12 }}
                                            formatter={(value) => (value === 'km' ? 'Km recorridos' : 'Galones tanqueados')}
                                        />
                                        <Bar yAxisId="km" dataKey="km" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                        <Line yAxisId="galones" type="monotone" dataKey="galones" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">Vehículos por cumplimiento de meta</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {sinDistribucion ? (
                                <EmptyChart>No hay vehículos con datos en este rango.</EmptyChart>
                            ) : (
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie
                                            data={distribucionCumplimiento}
                                            dataKey="total"
                                            nameKey="rango"
                                            innerRadius={55}
                                            outerRadius={90}
                                            paddingAngle={2}
                                        >
                                            {distribucionCumplimiento.map((r) => (
                                                <Cell key={r.rango} fill={COLOR_DISTRIBUCION[r.rango] ?? '#64748b'} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value, _name, item) => [`${value} vehículo(s)`, item.payload.rango]} />
                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {rankingRendimiento.length > 0 && (
                    <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">Rendimiento por vehículo (top 10)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={rankingRendimiento}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis dataKey="placa" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} unit=" km/gl" />
                                    <Tooltip
                                        formatter={(value, _name, item) => [
                                            `${value} km/gl${item.payload.meta_km_gl ? ` (meta: ${item.payload.meta_km_gl})` : ''}`,
                                            'Rendimiento',
                                        ]}
                                    />
                                    <Bar dataKey="rendimiento_km_gl" fill="#15803d" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                {rankingBajoRendimiento.length > 0 && (
                    <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Vehículos con menor rendimiento (candidatos a revisar)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Placa</TableHead>
                                            <TableHead className="text-right">Km/gl</TableHead>
                                            <TableHead className="text-right">Meta</TableHead>
                                            <TableHead className="text-right">Cumplimiento</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rankingBajoRendimiento.map((v) => (
                                            <TableRow key={v.placa}>
                                                <TableCell className="font-medium">{v.placa}</TableCell>
                                                <TableCell className="text-right">{v.rendimiento_km_gl}</TableCell>
                                                <TableCell className="text-right">{v.meta_km_gl ?? '—'}</TableCell>
                                                <TableCell className={`text-right font-medium ${cumplimientoColor(v.cumplimiento_pct)}`}>
                                                    {v.cumplimiento_pct !== null ? (
                                                        <Badge
                                                            className={
                                                                v.cumplimiento_pct >= 100
                                                                    ? 'bg-emerald-700 text-white'
                                                                    : v.cumplimiento_pct >= 85
                                                                      ? 'bg-amber-500 text-white'
                                                                      : 'bg-rose-600 text-white'
                                                            }
                                                        >
                                                            {v.cumplimiento_pct}%
                                                        </Badge>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}

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
                                                // ml-auto (no solo text-right en el <TableCell>): el Input de
                                                // shadcn es display:flex, y text-align del padre no afecta a
                                                // elementos de bloque — sin esto quedaba pegado a la izquierda.
                                                className="ml-auto w-20 text-right"
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
