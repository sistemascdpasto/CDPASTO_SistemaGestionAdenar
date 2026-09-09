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
import { Eye, Plus, Trash2, Edit, Clock, User, Calendar } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Medición de Tiempos en Inventario', href: '/modules/reparto/medicion-tiempos-inventario' },
];

interface MedicionTiempo {
    id: number;
    fecha_medicion: string | null;
    placa_vehiculo: string | null;
    centro: string | null;
    regional: string | null;
    cedula_colaborador: string | null;
    nombre_colaborador: string | null;
    hora_inicio: string | null;
    hora_fin: string | null;
    duracion_minutos: number | null;
    tipo_inventario: string | null;
    estado: string | null;
    observaciones: string | null;
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
    return hora || '-';
}

function formatDuracion(minutos: number | null) {
    if (!minutos) return '-';
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (horas > 0) {
        return `${horas}h ${mins}m`;
    }
    return `${mins}m`;
}

function getEstadoBadge(estado: string | null) {
    if (!estado) return <Badge variant="secondary">Sin estado</Badge>;
    
    const variant = estado.toLowerCase() === 'completado' ? 'default' : 
                    estado.toLowerCase() === 'en_proceso' ? 'secondary' : 
                    estado.toLowerCase() === 'cancelado' ? 'destructive' : 'outline';
    
    return <Badge variant={variant}>{estado}</Badge>;
}

export default function MedicionTiemposInventarioIndex({ registros, filters, puedeVerTodos }: Props) {
    const [fechaDesde, setFechaDesde] = useState(filters.fecha_desde ?? '');
    const [fechaHasta, setFechaHasta] = useState(filters.fecha_hasta ?? '');
    const [placa, setPlaca] = useState(filters.placa ?? '');
    const [colaborador, setColaborador] = useState(filters.colaborador ?? '');

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
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        applyFilters({});
    }, [debouncedFechaDesde, debouncedFechaHasta, debouncedPlaca, debouncedColaborador]);

    const clearFilters = () => {
        setFechaDesde('');
        setFechaHasta('');
        setPlaca('');
        setColaborador('');
        applyFilters({ fecha_desde: '', fecha_hasta: '', placa: '', colaborador: '' });
    };

    const deleteRegistro = (id: number) => {
        if (confirm('¿Está seguro de eliminar esta medición de tiempo?')) {
            router.delete(route('reparto.medicion-tiempos-inventario.destroy', id));
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Medición de Tiempos en Inventario de Vehículos de Distribución" />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <HeadingSmall>Medición de Tiempos en Inventario de Vehículos de Distribución</HeadingSmall>
                    <Link href={route('reparto.medicion-tiempos-inventario.create')}>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Nueva Medición
                        </Button>
                    </Link>
                </div>

                {/* Filtros */}
                <div className="rounded-lg border bg-card p-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-2">
                            <Label htmlFor="fecha_desde">Fecha Desde</Label>
                            <Input
                                id="fecha_desde"
                                type="date"
                                value={fechaDesde}
                                onChange={(e) => setFechaDesde(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fecha_hasta">Fecha Hasta</Label>
                            <Input
                                id="fecha_hasta"
                                type="date"
                                value={fechaHasta}
                                onChange={(e) => setFechaHasta(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="placa">Placa Vehículo</Label>
                            <Input
                                id="placa"
                                placeholder="Buscar por placa..."
                                value={placa}
                                onChange={(e) => setPlaca(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="colaborador">Colaborador</Label>
                            <Input
                                id="colaborador"
                                placeholder="Buscar por nombre..."
                                value={colaborador}
                                onChange={(e) => setColaborador(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <Button variant="outline" onClick={clearFilters}>
                            Limpiar Filtros
                        </Button>
                    </div>
                </div>

                {/* Tabla de registros */}
                <div className="rounded-lg border bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Vehículo</TableHead>
                                <TableHead>Colaborador</TableHead>
                                <TableHead>Horario</TableHead>
                                <TableHead>Duración</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Registrado por</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {registros.data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-8">
                                        No se encontraron registros
                                    </TableCell>
                                </TableRow>
                            ) : (
                                registros.data.map((registro) => (
                                    <TableRow key={registro.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                {formatFecha(registro.fecha_medicion)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{registro.placa_vehiculo || '-'}</div>
                                            {registro.centro && (
                                                <div className="text-sm text-muted-foreground">{registro.centro}</div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{registro.nombre_colaborador || '-'}</div>
                                            {registro.cedula_colaborador && (
                                                <div className="text-sm text-muted-foreground">{registro.cedula_colaborador}</div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-muted-foreground" />
                                                <span>{formatHora(registro.hora_inicio)} - {formatHora(registro.hora_fin)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{formatDuracion(registro.duracion_minutos)}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{registro.tipo_inventario || '-'}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {getEstadoBadge(registro.estado)}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                <div>
                                                    <div className="font-medium">{registro.usuario || registro.creado_por || '-'}</div>
                                                    {registro.fecha_creacion && (
                                                        <div className="text-xs text-muted-foreground">
                                                            {new Date(registro.fecha_creacion).toLocaleString('es-CO')}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Link href={route('reparto.medicion-tiempos-inventario.show', registro.id)}>
                                                    <Button variant="ghost" size="sm">
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                                <Link href={route('reparto.medicion-tiempos-inventario.edit', registro.id)}>
                                                    <Button variant="ghost" size="sm">
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => deleteRegistro(registro.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>

                    {/* Paginación */}
                    {registros.last_page > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t">
                            <div className="text-sm text-muted-foreground">
                                Mostrando {registros.from} a {registros.to} de {registros.total} registros
                            </div>
                            <div className="flex gap-2">
                                {registros.links.map((link, index) => (
                                    <Button
                                        key={index}
                                        variant={link.active ? 'default' : 'outline'}
                                        size="sm"
                                        disabled={!link.url}
                                        onClick={() => link.url && router.get(link.url)}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}