import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Eye, Plus, Trash2, Edit, Clock, User, Download, Truck, Timer, TrendingDown, Activity, Users } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import {
    BarElement, CategoryScale, Chart as ChartJS,
    Legend, LinearScale, Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Medición de Tiempos en Inventario', href: '/modules/reparto/medicion-tiempos-inventario' },
];

interface Indicadores {
    total_registros: number;
    con_duracion: number;
    promedio_minutos: number | null;
    minimo_minutos: number | null;
    maximo_minutos: number | null;
    suma_minutos: number;
    vehiculos_unicos: number;
    colaboradores_unicos: number;
}

interface DatosPorPeriodo {
    dias?: string[];
    meses?: string[];
    promedio: number[];
    cantidad: number[];
    minimo: number[];
    maximo: number[];
}

interface MedicionTiempo {
    id: number;
    fecha_medicion: string | null;
    hora_inicio: string | null;
    hora_fin: string | null;
    duracion_minutos: number | null;
    meta_minutos: number | null;
    tipo_inventario: string | null;
    creado_por: string | null;
    fecha_creacion: string | null;
    usuario: string | null;
    colaborador_info: string | null;
    vehiculo_info: string | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface Paginator {
    data: MedicionTiempo[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: PaginationLink[];
}

interface Props {
    registros: Paginator;
    filters: {
        fecha_desde: string;
        fecha_hasta: string;
        placa: string;
        colaborador: string;
    };
    puedeVerTodos: boolean;
    indicadores?: Indicadores;
    por_dia?: DatosPorPeriodo;
    por_mes?: DatosPorPeriodo;
}

type Filters = {
    fecha_desde: string;
    fecha_hasta: string;
    placa: string;
    colaborador: string;
};

function formatFecha(fecha: string | null) {
    if (!fecha) return '-';
    const [y, m, d] = fecha.split('-');
    return `${d}/${m}/${y}`;
}

function formatHora(hora: string | null) {
    if (!hora) return '-';
    const [hh, mm] = hora.split(':').map(Number);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

function formatDuracion(minutos: number | null) {
    if (!minutos) return '-';
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return horas > 0 ? `${horas}h ${mins}m` : `${mins}m`;
}

// ─── KpiCard ─────────────────────────────────────────────────────────────────
function KpiCard({
    label, value, sub, icon: Icon, color = '#3b82f6',
}: {
    label: string; value: string; sub?: string;
    icon: React.ElementType; color?: string;
}) {
    return (
        <div className="flex flex-col justify-between gap-2 rounded-xl border border-sidebar-border/70 bg-card p-4 shadow-sm dark:border-sidebar-border">
            <div className="flex items-start justify-between">
                <p className="text-[11px] font-semibold text-muted-foreground leading-tight">{label}</p>
                <Icon className="size-4 shrink-0" style={{ color }} />
            </div>
            <p className="text-2xl font-extrabold tabular-nums leading-none" style={{ color }}>{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
        </div>
    );
}

// ─── GraficaBarras ───────────────────────────────────────────────────────────
function GraficaBarras({
    titulo, subtitulo, labels, promedio, minimo, maximo, cantidad, color = '#3b82f6',
}: {
    titulo: string; subtitulo: string;
    labels: string[]; promedio: number[]; minimo: number[]; maximo: number[]; cantidad: number[];
    color?: string;
}) {
    if (labels.length === 0) {
        return (
            <div className="rounded-xl border border-sidebar-border/70 bg-card p-4 shadow-sm dark:border-sidebar-border">
                <p className="text-xs font-bold text-muted-foreground">{titulo}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{subtitulo}</p>
                <div className="mt-4 flex h-36 items-center justify-center text-xs text-muted-foreground">Sin datos</div>
            </div>
        );
    }

    const chartData = {
        labels,
        datasets: [
            {
                label: 'Promedio (min)',
                data: promedio,
                backgroundColor: `${color}cc`,
                borderColor: color,
                borderWidth: 1,
                borderRadius: 4,
                order: 1,
            },
            {
                label: 'Mínimo (min)',
                data: minimo,
                backgroundColor: '#22c55e99',
                borderColor: '#22c55e',
                borderWidth: 1,
                borderRadius: 4,
                order: 2,
            },
            {
                label: 'Máximo (min)',
                data: maximo,
                backgroundColor: '#ef444499',
                borderColor: '#ef4444',
                borderWidth: 1,
                borderRadius: 4,
                order: 3,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top' as const,
                labels: { font: { size: 10 }, boxWidth: 10, padding: 8 },
            },
            tooltip: {
                callbacks: {
                    afterBody: (items: any[]) => {
                        const idx = items[0]?.dataIndex;
                        return idx !== undefined ? [`Inventarios: ${cantidad[idx]}`] : [];
                    },
                },
            },
        },
        scales: {
            x: {
                ticks: { color: '#9ca3af', font: { size: 8 }, maxRotation: 45, minRotation: 0 },
                grid: { display: false },
            },
            y: {
                beginAtZero: true,
                ticks: {
                    color: '#9ca3af', font: { size: 9 }, maxTicksLimit: 6,
                    callback: (v: any) => `${v}m`,
                },
                grid: { color: 'rgba(0,0,0,.04)' },
            },
        },
    };

    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-card p-4 shadow-sm dark:border-sidebar-border">
            <p className="text-xs font-bold text-foreground">{titulo}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{subtitulo}</p>
            <div className="mt-3" style={{ height: 200 }}>
                <Bar data={chartData} options={options} />
            </div>
        </div>
    );
}

export default function MedicionTiemposInventarioIndex({ registros, filters, puedeVerTodos, indicadores, por_dia, por_mes }: Props) {
    const safeFilters = filters || {};
    const ind = indicadores ?? {} as Indicadores;

    const fmtMin = (m: number | null | undefined) => {
        if (m == null) return '-';
        const h = Math.floor(m / 60), min = m % 60;
        return h > 0 ? `${h}h ${min}m` : `${min}m`;
    };
    const [fechaDesde, setFechaDesde] = useState(safeFilters.fecha_desde ?? '');
    const [fechaHasta, setFechaHasta] = useState(safeFilters.fecha_hasta ?? '');
    const [placa, setPlaca] = useState(safeFilters.placa ?? '');
    const [colaborador, setColaborador] = useState(safeFilters.colaborador ?? '');

    const debouncedFechaDesde = useDebouncedValue(fechaDesde);
    const debouncedFechaHasta = useDebouncedValue(fechaHasta);
    const debouncedPlaca = useDebouncedValue(placa);
    const debouncedColaborador = useDebouncedValue(colaborador);

    const isFirstRender = useRef(true);

    const applyFilters = (overrides: Partial<Filters>) => {
        router.get(
            route('reparto.medicion-tiempos-inventario.index'),
            {
                fecha_desde: overrides.fecha_desde ?? debouncedFechaDesde,
                fecha_hasta: overrides.fecha_hasta ?? debouncedFechaHasta,
                placa: overrides.placa ?? debouncedPlaca,
                colaborador: overrides.colaborador ?? debouncedColaborador,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        applyFilters({});
    }, [debouncedFechaDesde, debouncedFechaHasta, debouncedPlaca, debouncedColaborador]);

    const clearFilters = () => {
        setFechaDesde(''); setFechaHasta(''); setPlaca(''); setColaborador('');
        applyFilters({ fecha_desde: '', fecha_hasta: '', placa: '', colaborador: '' });
    };

    const deleteRegistro = (id: number) => {
        if (confirm('¿Está seguro de eliminar esta medición de tiempo?')) {
            router.delete(route('reparto.medicion-tiempos-inventario.destroy', id));
        }
    };

    const exportUrl = route('reparto.medicion-tiempos-inventario.exportar', {
        ...(debouncedFechaDesde && { fecha_desde: debouncedFechaDesde }),
        ...(debouncedFechaHasta && { fecha_hasta: debouncedFechaHasta }),
        ...(debouncedPlaca      && { placa: debouncedPlaca }),
        ...(debouncedColaborador && { colaborador: debouncedColaborador }),
    } as any);

    const hasFilters = !!(debouncedFechaDesde || debouncedFechaHasta || debouncedPlaca || debouncedColaborador);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Medición de Tiempos en Inventario" />

            <div className="space-y-4 px-2 sm:px-0">

                {/* ── Cabecera ── */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-foreground sm:text-2xl">
                            Medición de Tiempos en Inventario
                        </h1>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {registros.total} registro{registros.total !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <form
                            className="hidden"
                            id="importForm"
                            onSubmit={(e) => {
                                e.preventDefault();
                                const fileInput = (e.target as HTMLFormElement).elements.namedItem('archivo') as HTMLInputElement;
                                if (fileInput.files?.length) {
                                    router.post(route('reparto.medicion-tiempos-inventario.importar'), new FormData(e.target as HTMLFormElement), {
                                        onSuccess: () => fileInput.value = '',
                                    });
                                }
                            }}
                        >
                            <input
                                type="file"
                                name="archivo"
                                id="archivoInput"
                                accept=".xlsx,.xls,.csv"
                                onChange={(e) => {
                                    if (e.target.files?.length) {
                                        document.getElementById('importForm')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                                    }
                                }}
                            />
                        </form>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => document.getElementById('archivoInput')?.click()}
                        >
                            <Download className="h-3.5 w-3.5 rotate-180" />
                            <span className="hidden sm:inline">Importar Excel</span>
                            <span className="sm:hidden">Importar</span>
                        </Button>
                        <a href={exportUrl}>
                            <Button variant="outline" size="sm" className="gap-1.5">
                                <Download className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Exportar CSV</span>
                                <span className="sm:hidden">CSV</span>
                            </Button>
                        </a>
                        <Link href={route('reparto.medicion-tiempos-inventario.create')}>
                            <Button size="sm" className="gap-1.5">
                                <Plus className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Nueva Medición</span>
                                <span className="sm:hidden">Nueva</span>
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* ── Filtros ── */}
                <div className="rounded-xl border border-sidebar-border/70 bg-card p-4 dark:border-sidebar-border">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Fecha desde</Label>
                            <Input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Fecha hasta</Label>
                            <Input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Placa</Label>
                            <Input placeholder="Buscar por placa..." value={placa} onChange={e => setPlaca(e.target.value)} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Colaborador</Label>
                            <Input placeholder="Cédula o nombre..." value={colaborador} onChange={e => setColaborador(e.target.value)} className="h-8 text-sm" />
                        </div>
                    </div>
                    {hasFilters && (
                        <div className="mt-3 flex justify-end">
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-muted-foreground">
                                Limpiar filtros
                            </Button>
                        </div>
                    )}
                </div>

                {/* ── KPI Cards ── */}
                {ind.total_registros !== undefined && ind.total_registros > 0 && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
                        <KpiCard
                            label="Total inventarios"
                            value={String(ind.total_registros)}
                            sub={`${ind.con_duracion} con duración registrada`}
                            icon={Timer}
                            color="#3b82f6"
                        />
                        <KpiCard
                            label="Promedio duración"
                            value={fmtMin(ind.promedio_minutos)}
                            sub="Por inventario"
                            icon={Activity}
                            color="#8b5cf6"
                        />
                        <KpiCard
                            label="Más rápido / Más lento"
                            value={fmtMin(ind.minimo_minutos)}
                            sub={`Máximo: ${fmtMin(ind.maximo_minutos)}`}
                            icon={TrendingDown}
                            color="#22c55e"
                        />
                        <KpiCard
                            label="Vehículos · Colaboradores"
                            value={`${ind.vehiculos_unicos} · ${ind.colaboradores_unicos}`}
                            sub="Participantes únicos"
                            icon={Users}
                            color="#f59e0b"
                        />
                    </div>
                )}

                {/* ── Gráficas de barras ── */}
                {(por_dia?.dias?.length ?? 0) > 0 || (por_mes?.meses?.length ?? 0) > 0 ? (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <GraficaBarras
                            titulo="Duración por día"
                            subtitulo="Promedio, mínimo y máximo de cada jornada (minutos)"
                            labels={por_dia?.dias ?? []}
                            promedio={por_dia?.promedio ?? []}
                            minimo={por_dia?.minimo ?? []}
                            maximo={por_dia?.maximo ?? []}
                            cantidad={por_dia?.cantidad ?? []}
                            color="#3b82f6"
                        />
                        <GraficaBarras
                            titulo="Duración por mes"
                            subtitulo="Promedio, mínimo y máximo mensual (minutos)"
                            labels={por_mes?.meses ?? []}
                            promedio={por_mes?.promedio ?? []}
                            minimo={por_mes?.minimo ?? []}
                            maximo={por_mes?.maximo ?? []}
                            cantidad={por_mes?.cantidad ?? []}
                            color="#8b5cf6"
                        />
                    </div>
                ) : null}

                {/* ── Tabla (md+) / Cards (mobile) ── */}
                {registros.data.length === 0 ? (
                    <div className="rounded-xl border border-sidebar-border/70 bg-card py-16 text-center dark:border-sidebar-border">
                        <Timer className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-30" />
                        <p className="text-sm font-medium text-foreground">No se encontraron registros</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {hasFilters ? 'Intenta con otros filtros.' : 'Aún no hay mediciones registradas.'}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Tabla — visible en md+ */}
                        <div className="hidden md:block rounded-xl border border-sidebar-border/70 bg-card overflow-hidden dark:border-sidebar-border">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="text-xs">Fecha</TableHead>
                                            <TableHead className="text-xs">Vehículo</TableHead>
                                            <TableHead className="text-xs">Colaborador</TableHead>
                                            <TableHead className="text-xs">Inicio</TableHead>
                                            <TableHead className="text-xs">Fin</TableHead>
                                            <TableHead className="text-xs">Duración</TableHead>
                                            <TableHead className="text-xs">Meta</TableHead>
                                            <TableHead className="text-xs">Tipo</TableHead>
                                            <TableHead className="text-xs">Registrado por</TableHead>
                                            <TableHead className="text-right text-xs">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {registros.data.map((registro) => (
                                            <TableRow key={registro.id} className="hover:bg-muted/40">
                                                <TableCell className="text-sm whitespace-nowrap">
                                                    {formatFecha(registro.fecha_medicion)}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-mono text-xs font-semibold text-foreground">
                                                        {registro.vehiculo_info || '-'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-sm max-w-[160px] truncate">
                                                    {registro.colaborador_info || '-'}
                                                </TableCell>
                                                <TableCell className="text-sm whitespace-nowrap text-emerald-600 dark:text-emerald-400 font-medium">
                                                    {formatHora(registro.hora_inicio)}
                                                </TableCell>
                                                <TableCell className="text-sm whitespace-nowrap text-rose-600 dark:text-rose-400 font-medium">
                                                    {formatHora(registro.hora_fin)}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm font-semibold">{formatDuracion(registro.duracion_minutos)}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm text-muted-foreground">{registro.meta_minutos ? `${registro.meta_minutos}m` : '-'}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-xs capitalize">
                                                        {registro.tipo_inventario || '-'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-xs text-foreground">{registro.usuario || registro.creado_por || '-'}</div>
                                                    {registro.fecha_creacion && (
                                                        <div className="text-[10px] text-muted-foreground">
                                                            {new Date(registro.fecha_creacion).toLocaleString('es-CO')}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Link href={route('reparto.medicion-tiempos-inventario.show', registro.id)}>
                                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                                <Eye className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </Link>
                                                        <Link href={route('reparto.medicion-tiempos-inventario.edit', registro.id)}>
                                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                                <Edit className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </Link>
                                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteRegistro(registro.id)}>
                                                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Cards — visible en mobile (<md) */}
                        <div className="grid gap-3 md:hidden">
                            {registros.data.map((registro) => (
                                <div key={registro.id} className="rounded-xl border border-sidebar-border/70 bg-card p-4 shadow-sm dark:border-sidebar-border">
                                    {/* Cabecera de la card */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                                                <Truck className="size-4 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="font-mono text-sm font-bold text-foreground">
                                                    {registro.vehiculo_info || '-'}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatFecha(registro.fecha_medicion)}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                                            {registro.tipo_inventario || '-'}
                                        </Badge>
                                    </div>

                                    {/* Colaborador */}
                                    <div className="mt-3 flex items-center gap-2">
                                        <User className="size-3.5 shrink-0 text-muted-foreground" />
                                        <span className="text-xs text-foreground">{registro.colaborador_info || '-'}</span>
                                    </div>

                                    {/* Tiempos */}
                                    <div className="mt-3 grid grid-cols-4 gap-2 rounded-lg bg-muted/40 p-3">
                                        <div className="text-center">
                                            <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Inicio</p>
                                            <p className="mt-0.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                                {formatHora(registro.hora_inicio)}
                                            </p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Fin</p>
                                            <p className="mt-0.5 text-sm font-bold text-rose-600 dark:text-rose-400">
                                                {formatHora(registro.hora_fin)}
                                            </p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Duración</p>
                                            <p className="mt-0.5 text-sm font-bold text-foreground">
                                                {formatDuracion(registro.duracion_minutos)}
                                            </p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Meta</p>
                                            <p className="mt-0.5 text-sm font-bold text-foreground">
                                                {registro.meta_minutos ? `${registro.meta_minutos}m` : '-'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Registrado por + acciones */}
                                    <div className="mt-3 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <Clock className="size-3 shrink-0 text-muted-foreground" />
                                            <span className="truncate text-[10px] text-muted-foreground">
                                                {registro.usuario || registro.creado_por || '-'}
                                            </span>
                                        </div>
                                        <div className="flex shrink-0 gap-1">
                                            <Link href={route('reparto.medicion-tiempos-inventario.show', registro.id)}>
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                    <Eye className="h-3.5 w-3.5" />
                                                </Button>
                                            </Link>
                                            <Link href={route('reparto.medicion-tiempos-inventario.edit', registro.id)}>
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>
                                            </Link>
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteRegistro(registro.id)}>
                                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Paginación */}
                        {registros.last_page > 1 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sidebar-border/70 bg-card px-4 py-3 dark:border-sidebar-border">
                                <p className="text-xs text-muted-foreground">
                                    Mostrando {registros.from}–{registros.to} de {registros.total}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {registros.links.map((link, index) => (
                                        <Button
                                            key={index}
                                            variant={link.active ? 'default' : 'outline'}
                                            size="sm"
                                            className="h-7 min-w-[28px] px-2 text-xs"
                                            disabled={!link.url}
                                            onClick={() => link.url && router.get(link.url)}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}
