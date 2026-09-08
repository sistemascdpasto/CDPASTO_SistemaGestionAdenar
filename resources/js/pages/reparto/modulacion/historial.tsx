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
import { Eye, FileText, Trash2, Truck, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Historial de Planeaciones', href: '/modules/reparto/modulacion-historial' },
];

interface Planeacion {
    id: number;
    fecha: string;
    ud_programado_por: string | null;
    despachado_por_nombre: string | null;
    total_rutas: number;
    total_tripulantes: number;
    total_novedades: number;
    placas: string[];
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface Paginator {
    data: Planeacion[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: PaginationLink[];
}

interface Props {
    planeaciones: Paginator;
    filters: {
        fecha_desde: string;
        fecha_hasta: string;
        placa: string;
    };
}

type Filters = {
    fecha_desde: string;
    fecha_hasta: string;
    placa: string;
};

function formatFecha(fecha: string) {
    const [y, m, d] = fecha.split('-');
    return `${d}/${m}/${y}`;
}

function getDiaSemana(fecha: string) {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long' });
}

export default function HistorialModulacion({ planeaciones, filters }: Props) {
    const [fechaDesde, setFechaDesde] = useState(filters.fecha_desde ?? '');
    const [fechaHasta, setFechaHasta] = useState(filters.fecha_hasta ?? '');
    const [placa, setPlaca] = useState(filters.placa ?? '');

    const debouncedFechaDesde = useDebouncedValue(fechaDesde);
    const debouncedFechaHasta = useDebouncedValue(fechaHasta);
    const debouncedPlaca = useDebouncedValue(placa);

    const isFirstRender = useRef(true);

    const applyFilters = (overrides: Partial<Filters>) => {
        router.get(
            route('reparto.modulacion.historial'),
            {
                fecha_desde: overrides.fecha_desde ?? debouncedFechaDesde,
                fecha_hasta: overrides.fecha_hasta ?? debouncedFechaHasta,
                placa: overrides.placa ?? debouncedPlaca,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        applyFilters({});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedFechaDesde, debouncedFechaHasta, debouncedPlaca]);

    const handleClear = () => {
        setFechaDesde('');
        setFechaHasta('');
        setPlaca('');
        router.get(route('reparto.modulacion.historial'), {}, { preserveState: false });
    };

    const handleDeleteModulacion = (id: number, fecha: string) => {
        if (confirm(`¿Está seguro de eliminar la planeación del ${formatFecha(fecha)}? Esta acción no se puede deshacer.`)) {
            router.delete(route('reparto.modulacion.destroy', id), {
                onSuccess: () => router.get(route('reparto.modulacion.historial'), {}, { preserveState: false }),
            });
        }
    };

    const hasActiveFilters = Boolean(fechaDesde || fechaHasta || placa);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Historial de Planeaciones de Ruta" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <HeadingSmall
                        title="Historial de Planeaciones de Ruta"
                        description={`${planeaciones.total} planeación${planeaciones.total !== 1 ? 'es' : ''} registrada${planeaciones.total !== 1 ? 's' : ''}.`}
                    />
                    <Button asChild>
                        <Link href={route('reparto.modulacion.index')}>
                            <Truck className="size-4" />
                            Nueva planeación
                        </Link>
                    </Button>
                </div>

                <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => e.preventDefault()}>
                    <div className="grid gap-2">
                        <Label htmlFor="fecha_desde">Fecha desde</Label>
                        <Input id="fecha_desde" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="fecha_hasta">Fecha hasta</Label>
                        <Input id="fecha_hasta" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="placa">Placa</Label>
                        <Input
                            id="placa"
                            type="text"
                            placeholder="Ej: COLJV386"
                            value={placa}
                            onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                            className="font-mono uppercase"
                        />
                    </div>
                    {hasActiveFilters && (
                        <div className="flex items-end">
                            <Button type="button" variant="outline" onClick={handleClear} className="w-full">
                                <X className="size-4" />
                                Limpiar
                            </Button>
                        </div>
                    )}
                </form>

                <div className="overflow-x-auto rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-36">Fecha</TableHead>
                                <TableHead>Programado por</TableHead>
                                <TableHead>Despachado por</TableHead>
                                <TableHead className="text-center">Rutas</TableHead>
                                <TableHead className="text-center">Tripulantes</TableHead>
                                <TableHead className="text-center">Novedades</TableHead>
                                <TableHead className="min-w-[200px]">Vehículos</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {planeaciones.data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <FileText className="size-9 text-muted-foreground/50" />
                                            <span>
                                                {hasActiveFilters
                                                    ? 'No se encontraron planeaciones con ese criterio de búsqueda.'
                                                    : 'No hay planeaciones registradas aún.'}
                                            </span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                planeaciones.data.map((plan) => (
                                    <TableRow key={plan.id}>
                                        <TableCell>
                                            <div className="text-sm font-medium text-foreground">{formatFecha(plan.fecha)}</div>
                                            <div className="text-[11px] capitalize text-muted-foreground">{getDiaSemana(plan.fecha)}</div>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {plan.ud_programado_por || <span className="text-muted-foreground">—</span>}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {plan.despachado_por_nombre || <span className="text-muted-foreground">—</span>}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary">
                                                <Truck className="size-3" />
                                                {plan.total_rutas}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary">
                                                <Users className="size-3" />
                                                {plan.total_tripulantes}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {plan.total_novedades > 0 ? (
                                                <Badge variant="secondary">{plan.total_novedades}</Badge>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {plan.placas.length === 0 ? (
                                                    <span className="text-xs text-muted-foreground">Sin vehículos</span>
                                                ) : (
                                                    plan.placas.map((p) => (
                                                        <Badge key={p} variant="outline" className="px-1.5 py-0 font-mono text-[11px]">
                                                            {p}
                                                        </Badge>
                                                    ))
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="outline" asChild>
                                                    <Link href={route('reparto.modulacion.index', { fecha: plan.fecha, readOnly: 'true' })}>
                                                        <Eye className="size-3.5" />
                                                        Ver
                                                    </Link>
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleDeleteModulacion(plan.id, plan.fecha)}
                                                    className="text-destructive hover:text-destructive"
                                                    aria-label="Eliminar planeación"
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {planeaciones.last_page > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-muted-foreground">
                            Página {planeaciones.current_page} de {planeaciones.last_page}
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {planeaciones.links.map((link, i) => (
                                <Button
                                    key={i}
                                    size="sm"
                                    variant={link.active ? 'default' : 'outline'}
                                    disabled={!link.url}
                                    onClick={() => link.url && router.get(link.url, {}, { preserveScroll: true })}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
