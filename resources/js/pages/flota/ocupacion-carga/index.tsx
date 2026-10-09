import { KpiCard, KpiCardGrid } from '@/components/kpi-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    PackageSearch,
    Percent,
    Scale,
    Truck,
    Weight,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Flota', href: '/modules/flota' },
    { title: 'Ocupación de Carga', href: '/modules/flota/ocupacion-carga' },
];

const PAGE_SIZES = [10, 25, 50, 100];

const COLOR_DISTRIBUCION: Record<string, string> = {
    'Bajo (<50%)': '#94a3b8',
    'Óptimo (50-80%)': '#15803d',
    'Alto (80-100%)': '#d97706',
    'Sobrecarga (>100%)': '#dc2626',
};

interface Fila {
    id: number;
    fecha: string;
    placa: string;
    peso_toneladas: number;
    capacidad_kg: number | null;
    ocupacion_pct: number | null;
}

interface PorVehiculo {
    placa: string;
    promedio: number;
    rutas: number;
}

interface TendenciaDia {
    fecha: string;
    promedio: number;
    rutas: number;
}

interface DistribucionRango {
    rango: string;
    total: number;
}

interface TopSobrecargado {
    placa: string;
    veces_sobrecargado: number;
    promedio: number;
    maximo: number;
}

interface Kpis {
    total_rutas: number;
    promedio_ocupacion: number | null;
    rutas_sobrecargadas: number;
    vehiculos_sin_capacidad: number;
    peso_total_toneladas: number;
}

function formatFechaCorta(fecha: string): string {
    const [, mes, dia] = fecha.split('-');
    return `${dia}/${mes}`;
}

function BadgeOcupacion({ pct }: { pct: number | null }) {
    if (pct === null) {
        return (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
                <AlertTriangle className="size-3" />
                Sin capacidad registrada
            </Badge>
        );
    }

    const variant = pct > 100 ? 'bg-red-600 text-white' : pct >= 80 ? 'bg-amber-500 text-white' : 'bg-green-700 text-white';

    return <Badge className={variant}>{pct}%</Badge>;
}

function EmptyChart({ children }: { children: React.ReactNode }) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

export default function OcupacionCargaIndex({
    filas,
    kpis,
    ocupacion_por_vehiculo,
    tendencia_diaria,
    distribucion_ocupacion,
    top_sobrecargados,
    filters,
}: {
    filas: Fila[];
    kpis: Kpis;
    ocupacion_por_vehiculo: PorVehiculo[];
    tendencia_diaria: TendenciaDia[];
    distribucion_ocupacion: DistribucionRango[];
    top_sobrecargados: TopSobrecargado[];
    filters: { desde: string; hasta: string; placa: string };
}) {
    const [desde, setDesde] = useState(filters.desde);
    const [hasta, setHasta] = useState(filters.hasta);
    const [placa, setPlaca] = useState(filters.placa);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    const aplicar = () => router.get(route('flota.ocupacion-carga.index'), { desde, hasta, placa }, { preserveState: true });

    const totalPages = Math.max(1, Math.ceil(filas.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const filasPagina = useMemo(() => filas.slice((safePage - 1) * pageSize, safePage * pageSize), [filas, safePage, pageSize]);

    const sinDistribucion = distribucion_ocupacion.every((r) => r.total === 0);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Ocupación de Carga" />
            <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Ocupación de Carga</h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Con qué porcentaje de su capacidad sale cada vehículo en la Planeación de ruta.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" asChild className="gap-1.5">
                        <Link href={route('flota.vehiculos.index')}>
                            <Truck className="size-4" /> Documentación de Flota
                        </Link>
                    </Button>
                </div>

                {/* Filtros */}
                <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border px-4 py-3">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Desde</Label>
                            <Input type="date" value={desde} className="h-8 w-36 text-xs" onChange={(e) => setDesde(e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Hasta</Label>
                            <Input type="date" value={hasta} className="h-8 w-36 text-xs" onChange={(e) => setHasta(e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Placa</Label>
                            <Input
                                value={placa}
                                placeholder="Todas"
                                className="h-8 w-32 text-xs"
                                onChange={(e) => setPlaca(e.target.value)}
                            />
                        </div>
                        <Button size="sm" onClick={aplicar} className="h-8 bg-green-700 hover:bg-green-800 text-white">
                            Aplicar
                        </Button>
                    </div>
                </div>

                <KpiCardGrid className="sm:grid-cols-2 lg:grid-cols-5">
                    <KpiCard
                        label="Promedio de ocupación"
                        value={kpis.promedio_ocupacion ?? '—'}
                        suffix={kpis.promedio_ocupacion !== null ? '%' : ''}
                        icon={Percent}
                        color="#2563eb"
                    />
                    <KpiCard label="Rutas sobrecargadas (>100%)" value={kpis.rutas_sobrecargadas} icon={AlertTriangle} color="#dc2626" />
                    <KpiCard label="Vehículos sin capacidad registrada" value={kpis.vehiculos_sin_capacidad} icon={PackageSearch} color="#d97706" />
                    <KpiCard label="Rutas evaluadas" value={kpis.total_rutas} icon={Weight} color="#15803d" />
                    <KpiCard label="Peso total transportado" value={kpis.peso_total_toneladas} suffix=" ton" icon={Scale} color="#7c3aed" />
                </KpiCardGrid>

                <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">Tendencia diaria de ocupación</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {tendencia_diaria.length === 0 ? (
                                <EmptyChart>No hay datos suficientes en este rango.</EmptyChart>
                            ) : (
                                <ResponsiveContainer width="100%" height={280}>
                                    <LineChart data={tendencia_diaria}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="fecha" tickFormatter={formatFechaCorta} tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} unit="%" />
                                        <Tooltip labelFormatter={(label) => formatFechaCorta(String(label))} formatter={(value) => [`${value}%`, 'Ocupación promedio']} />
                                        <ReferenceLine y={100} stroke="#dc2626" strokeDasharray="4 4" />
                                        <Line type="monotone" dataKey="promedio" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">Distribución de rutas por rango de ocupación</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {sinDistribucion ? (
                                <EmptyChart>No hay rutas con capacidad conocida en este rango.</EmptyChart>
                            ) : (
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie data={distribucion_ocupacion} dataKey="total" nameKey="rango" innerRadius={55} outerRadius={90} paddingAngle={2}>
                                            {distribucion_ocupacion.map((r) => (
                                                <Cell key={r.rango} fill={COLOR_DISTRIBUCION[r.rango] ?? '#64748b'} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value, _name, item) => [`${value} ruta(s)`, item.payload.rango]} />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {ocupacion_por_vehiculo.length > 0 && (
                    <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Ocupación promedio por vehículo (top 10 por cantidad de rutas)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={ocupacion_por_vehiculo}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis dataKey="placa" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} unit="%" />
                                    <Tooltip formatter={(value) => [`${value}%`, 'Ocupación promedio']} />
                                    <Bar dataKey="promedio" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                {top_sobrecargados.length > 0 && (
                    <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Vehículos con más rutas sobrecargadas (&gt;100%)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Placa</TableHead>
                                            <TableHead>Veces sobrecargado</TableHead>
                                            <TableHead>Ocupación promedio</TableHead>
                                            <TableHead>Pico máximo</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {top_sobrecargados.map((v) => (
                                            <TableRow key={v.placa}>
                                                <TableCell className="font-mono font-medium">{v.placa}</TableCell>
                                                <TableCell>{v.veces_sobrecargado}</TableCell>
                                                <TableCell>{v.promedio}%</TableCell>
                                                <TableCell>
                                                    <Badge className="bg-red-600 text-white">{v.maximo}%</Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Detalle por ruta ({filas.length})
                            {totalPages > 1 && (
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    — mostrando {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filas.length)} de {filas.length}
                                </span>
                            )}
                        </CardTitle>
                        <div className="flex items-center gap-1">
                            {PAGE_SIZES.map((n) => (
                                <button
                                    key={n}
                                    onClick={() => {
                                        setPageSize(n);
                                        setPage(1);
                                    }}
                                    className={`rounded px-2 py-0.5 text-xs border transition-colors ${
                                        pageSize === n
                                            ? 'bg-foreground text-background border-transparent'
                                            : 'bg-card text-muted-foreground border-sidebar-border/70 hover:bg-muted/60 dark:border-sidebar-border'
                                    }`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Placa</TableHead>
                                        <TableHead>Peso total</TableHead>
                                        <TableHead>Capacidad</TableHead>
                                        <TableHead>Ocupación</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filasPagina.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                                                No hay rutas con peso registrado en este rango.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {filasPagina.map((fila) => (
                                        <TableRow key={fila.id}>
                                            <TableCell>{fila.fecha}</TableCell>
                                            <TableCell className="font-mono font-medium">{fila.placa}</TableCell>
                                            <TableCell>{fila.peso_toneladas} ton</TableCell>
                                            <TableCell>{fila.capacidad_kg ? `${fila.capacidad_kg.toLocaleString()} Kg` : '—'}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <BadgeOcupacion pct={fila.ocupacion_pct} />
                                                    {fila.ocupacion_pct === null && (
                                                        <Link
                                                            href={route('flota.vehiculos.index', { search: fila.placa })}
                                                            className="text-xs text-primary hover:underline"
                                                        >
                                                            Registrar
                                                        </Link>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {totalPages > 1 && (
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                                <p className="text-sm text-muted-foreground">
                                    Página <span className="font-semibold text-foreground">{safePage}</span> de{' '}
                                    <span className="font-semibold text-foreground">{totalPages}</span>
                                </p>
                                <div className="flex items-center gap-1">
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(1)} disabled={safePage === 1} title="Primera página">
                                        <ChevronsLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={safePage === 1}
                                        title="Página anterior"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>

                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                                        .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                                            if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                                            acc.push(p);
                                            return acc;
                                        }, [])
                                        .map((p, idx) =>
                                            p === '...' ? (
                                                <span key={`ellipsis-${idx}`} className="px-1 text-sm text-muted-foreground select-none">
                                                    …
                                                </span>
                                            ) : (
                                                <Button
                                                    key={p}
                                                    variant={safePage === p ? 'default' : 'outline'}
                                                    size="icon"
                                                    className="h-8 w-8 text-xs"
                                                    onClick={() => setPage(p as number)}
                                                >
                                                    {p}
                                                </Button>
                                            ),
                                        )}

                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={safePage === totalPages}
                                        title="Página siguiente"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setPage(totalPages)}
                                        disabled={safePage === totalPages}
                                        title="Última página"
                                    >
                                        <ChevronsRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
