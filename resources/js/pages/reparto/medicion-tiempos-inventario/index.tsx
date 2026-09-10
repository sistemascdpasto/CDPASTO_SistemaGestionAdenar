import HeadingSmall from '@/components/heading-small';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Eye, Plus, Trash2, Edit, Clock, User, Calendar, Download, Truck, Timer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Medición de Tiempos en Inventario', href: '/modules/reparto/medicion-tiempos-inventario' },
];

interface MedicionTiempo {
    id: number;
    fecha_medicion: string | null;
    hora_inicio: string | null;
    hora_fin: string | null;
    duracion_minutos: number | null;
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

export default function MedicionTiemposInventarioIndex({ registros, filters, puedeVerTodos }: Props) {
    const safeFilters = filters || {};
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
                                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3">
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
