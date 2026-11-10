import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Eye, FileSpreadsheet, FileStack, Search, Users, X } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'Contratos', href: '/modules/gente/contratos' },
];

interface ContratoRow {
    id: number;
    cedula: string;
    nombres: string;
    apellidos: string;
    cargo: string | null;
    tipo_contrato: string | null;
    fecha_ingreso_empresa: string | null;
    fecha_retiro_empresa: string | null;
    ultima_fecha_prorroga: string | null;
    cantidad_prorrogas: number;
    is_active: boolean;
    tiene_finalizacion?: boolean;
}

interface PaginatedData<T> {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
}

interface Filters {
    search: string;
    estado: string;
    estado_contrato: string;
    fecha_inicio_desde: string;
    fecha_inicio_hasta: string;
    fecha_fin_desde: string;
    fecha_fin_hasta: string;
}

interface Props {
    colaboradores: PaginatedData<ContratoRow>;
    filters: Filters;
}

function formatFecha(fecha: string | null): string {
    if (!fecha) return '—';
    const [year, month, day] = fecha.split('-');
    return `${day}/${month}/${year}`;
}

function calcularEstadoContrato(
    fechaRetiro: string | null,
    tieneFinalizacion = false,
): { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' } {
    if (tieneFinalizacion) return { label: 'Finalizado', variant: 'secondary' };
    if (!fechaRetiro)      return { label: 'Sin fecha fin', variant: 'secondary' };
    const hoy    = new Date();
    const retiro = new Date(fechaRetiro);
    const dias   = Math.ceil((retiro.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    if (dias < 0)   return { label: 'Vencido', variant: 'destructive' };
    if (dias <= 35) return { label: `Vence en ${dias}d`, variant: 'outline' };
    return { label: 'Vigente', variant: 'default' };
}

/** X posicionada en la esquina derecha del contenedor relativo */
function ClearBtn({ onClear }: { onClear: () => void }) {
    return (
        <button
            type="button"
            onClick={onClear}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 z-10 -translate-y-1/2"
        >
            <X className="h-3.5 w-3.5" />
        </button>
    );
}

/** Columna de filtro con label + slot relativo para la X */
function FilterCol({ label, hasValue, onClear, children }: {
    label: string;
    hasValue: boolean;
    onClear: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">{label}</span>
            <div className="relative">
                {children}
                {hasValue && <ClearBtn onClear={onClear} />}
            </div>
        </div>
    );
}

export default function ContratosIndex({ colaboradores, filters }: Props) {
    const [search,           setSearch]           = useState(filters?.search             || '');
    const [estado,           setEstado]           = useState(filters?.estado             || 'activo');
    const [estadoContrato,   setEstadoContrato]   = useState(filters?.estado_contrato    || 'todos');
    const [fechaInicioDesde, setFechaInicioDesde] = useState(filters?.fecha_inicio_desde || '');
    const [fechaInicioHasta, setFechaInicioHasta] = useState(filters?.fecha_inicio_hasta || '');
    const [fechaFinDesde,    setFechaFinDesde]    = useState(filters?.fecha_fin_desde    || '');
    const [fechaFinHasta,    setFechaFinHasta]    = useState(filters?.fecha_fin_hasta    || '');

    const rows = colaboradores?.data || [];

    const handleFilter = (
        s   = search,
        e   = estado,
        ec  = estadoContrato,
        fid = fechaInicioDesde,
        fih = fechaInicioHasta,
        ffd = fechaFinDesde,
        ffh = fechaFinHasta,
    ) => {
        router.get(
            '/modules/gente/contratos',
            {
                search:             s,
                estado:             e  === 'todos' ? '' : e,
                estado_contrato:    ec === 'todos' ? '' : ec,
                fecha_inicio_desde: fid,
                fecha_inicio_hasta: fih,
                fecha_fin_desde:    ffd,
                fecha_fin_hasta:    ffh,
            },
            { preserveState: true, replace: true },
        );
    };

    // El exportUrl siempre refleja los filtros activos en ese momento
    const exportParams = new URLSearchParams({
        search,
        estado:             estado          === 'todos' ? '' : estado,
        estado_contrato:    estadoContrato  === 'todos' ? '' : estadoContrato,
        fecha_inicio_desde: fechaInicioDesde,
        fecha_inicio_hasta: fechaInicioHasta,
        fecha_fin_desde:    fechaFinDesde,
        fecha_fin_hasta:    fechaFinHasta,
    }).toString();
    const exportUrl = `/modules/gente/contratos/exportar?${exportParams}`;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Contratos - Módulo Gente" />

            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                {/* Header Banner */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-200 bg-gradient-to-r from-blue-500/10 via-cyan-500/5 to-transparent p-6 shadow-sm dark:border-cyan-900/50 dark:from-blue-950/30">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <FileStack className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
                                <h1 className="text-foreground border-l-4 border-cyan-500 pl-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
                                    Contratos
                                </h1>
                            </div>
                            <p className="text-muted-foreground text-sm">
                                Consulta las fechas de inicio y finalización de contrato de cada colaborador.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="text-muted-foreground flex items-center gap-2 text-sm">
                                <Users className="h-4 w-4" />
                                <span>{colaboradores?.total ?? 0} colaboradores</span>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                                <a href={exportUrl}>
                                    <FileSpreadsheet className="mr-2 h-4 w-4 text-cyan-700 dark:text-cyan-300" />
                                    Exportar Excel
                                </a>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Filtros + Tabla */}
                <Card>
                    <CardHeader className="border-b border-cyan-100 bg-sky-50/70 pb-4 dark:border-cyan-950 dark:bg-slate-900/50">
                        <CardTitle className="text-base font-semibold">Lista de contratos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">

                        {/* ── Fila 1: 4 columnas iguales ── */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                            {/* Búsqueda — ocupa 2 columnas */}
                            <div className="flex flex-col gap-1 sm:col-span-2">
                                <span className="text-muted-foreground text-xs font-medium">Buscar</span>
                                <div className="relative">
                                    <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
                                    <Input
                                        type="text"
                                        placeholder="Nombre, apellido o cédula..."
                                        value={search}
                                        onChange={(e) => { setSearch(e.target.value); handleFilter(e.target.value, estado, estadoContrato, fechaInicioDesde, fechaInicioHasta, fechaFinDesde, fechaFinHasta); }}
                                        className="pl-9 pr-8"
                                    />
                                    {search !== '' && (
                                        <ClearBtn onClear={() => { setSearch(''); handleFilter('', estado, estadoContrato, fechaInicioDesde, fechaInicioHasta, fechaFinDesde, fechaFinHasta); }} />
                                    )}
                                </div>
                            </div>

                            {/* Estado de registro */}
                            <FilterCol
                                label="Estado de registro"
                                hasValue={estado !== 'todos'}
                                onClear={() => { setEstado('todos'); handleFilter(search, 'todos', estadoContrato, fechaInicioDesde, fechaInicioHasta, fechaFinDesde, fechaFinHasta); }}
                            >
                                <Select
                                    value={estado}
                                    onValueChange={(v) => { setEstado(v); handleFilter(search, v, estadoContrato, fechaInicioDesde, fechaInicioHasta, fechaFinDesde, fechaFinHasta); }}
                                >
                                    <SelectTrigger className={`w-full ${estado !== 'todos' ? 'pr-8' : ''}`}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos</SelectItem>
                                        <SelectItem value="activo">Activos</SelectItem>
                                        <SelectItem value="inactivo">Inactivos</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FilterCol>

                            {/* Estado del contrato */}
                            <FilterCol
                                label="Estado del contrato"
                                hasValue={estadoContrato !== 'todos'}
                                onClear={() => { setEstadoContrato('todos'); handleFilter(search, estado, 'todos', fechaInicioDesde, fechaInicioHasta, fechaFinDesde, fechaFinHasta); }}
                            >
                                <Select
                                    value={estadoContrato}
                                    onValueChange={(v) => { setEstadoContrato(v); handleFilter(search, estado, v, fechaInicioDesde, fechaInicioHasta, fechaFinDesde, fechaFinHasta); }}
                                >
                                    <SelectTrigger className={`w-full ${estadoContrato !== 'todos' ? 'pr-8' : ''}`}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos</SelectItem>
                                        <SelectItem value="vigente">Vigente</SelectItem>
                                        <SelectItem value="por_vencer">Por vencer (≤35 días)</SelectItem>
                                        <SelectItem value="vencido">Vencido</SelectItem>
                                        <SelectItem value="finalizado">Finalizado</SelectItem>
                                        <SelectItem value="sin_fecha">Sin fecha fin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FilterCol>
                        </div>

                        {/* ── Fila 2: 4 columnas iguales — fechas ── */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                            <FilterCol
                                label="Fecha inicio desde"
                                hasValue={fechaInicioDesde !== ''}
                                onClear={() => { setFechaInicioDesde(''); handleFilter(search, estado, estadoContrato, '', fechaInicioHasta, fechaFinDesde, fechaFinHasta); }}
                            >
                                <Input
                                    type="date"
                                    value={fechaInicioDesde}
                                    onChange={(e) => { setFechaInicioDesde(e.target.value); handleFilter(search, estado, estadoContrato, e.target.value, fechaInicioHasta, fechaFinDesde, fechaFinHasta); }}
                                    className={`w-full ${fechaInicioDesde !== '' ? 'pr-8' : ''}`}
                                />
                            </FilterCol>

                            <FilterCol
                                label="Fecha inicio hasta"
                                hasValue={fechaInicioHasta !== ''}
                                onClear={() => { setFechaInicioHasta(''); handleFilter(search, estado, estadoContrato, fechaInicioDesde, '', fechaFinDesde, fechaFinHasta); }}
                            >
                                <Input
                                    type="date"
                                    value={fechaInicioHasta}
                                    onChange={(e) => { setFechaInicioHasta(e.target.value); handleFilter(search, estado, estadoContrato, fechaInicioDesde, e.target.value, fechaFinDesde, fechaFinHasta); }}
                                    className={`w-full ${fechaInicioHasta !== '' ? 'pr-8' : ''}`}
                                />
                            </FilterCol>

                            <FilterCol
                                label="Fecha finalización desde"
                                hasValue={fechaFinDesde !== ''}
                                onClear={() => { setFechaFinDesde(''); handleFilter(search, estado, estadoContrato, fechaInicioDesde, fechaInicioHasta, '', fechaFinHasta); }}
                            >
                                <Input
                                    type="date"
                                    value={fechaFinDesde}
                                    onChange={(e) => { setFechaFinDesde(e.target.value); handleFilter(search, estado, estadoContrato, fechaInicioDesde, fechaInicioHasta, e.target.value, fechaFinHasta); }}
                                    className={`w-full ${fechaFinDesde !== '' ? 'pr-8' : ''}`}
                                />
                            </FilterCol>

                            <FilterCol
                                label="Fecha finalización hasta"
                                hasValue={fechaFinHasta !== ''}
                                onClear={() => { setFechaFinHasta(''); handleFilter(search, estado, estadoContrato, fechaInicioDesde, fechaInicioHasta, fechaFinDesde, ''); }}
                            >
                                <Input
                                    type="date"
                                    value={fechaFinHasta}
                                    onChange={(e) => { setFechaFinHasta(e.target.value); handleFilter(search, estado, estadoContrato, fechaInicioDesde, fechaInicioHasta, fechaFinDesde, e.target.value); }}
                                    className={`w-full ${fechaFinHasta !== '' ? 'pr-8' : ''}`}
                                />
                            </FilterCol>
                        </div>

                        {/* Tabla */}
                        <div className="overflow-x-auto rounded-xl border border-sky-200 dark:border-slate-700">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gradient-to-r from-[#1a3a5c] via-[#1e5f74] to-[#2a9d8f] hover:brightness-110">
                                        <TableHead className="text-white">N.º prórrogas</TableHead>
                                        <TableHead className="text-white">Nombre</TableHead>
                                        <TableHead className="text-white">Cédula</TableHead>
                                        <TableHead className="text-white">Tipo de contrato</TableHead>
                                        <TableHead className="text-white">Fecha inicio de contrato</TableHead>
                                        <TableHead className="text-white">Fecha finalización de contrato</TableHead>
                                        <TableHead className="text-white">Estado</TableHead>
                                        <TableHead className="text-right text-white">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-muted-foreground py-10 text-center">
                                                No se encontraron colaboradores.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        rows.map((row) => {
                                            const fechaFinContrato = row.ultima_fecha_prorroga ?? row.fecha_retiro_empresa;
                                            const { label, variant } = calcularEstadoContrato(fechaFinContrato, Boolean(row.tiene_finalizacion));
                                            return (
                                                <TableRow key={row.id}>
                                                    <TableCell className="text-center text-sm">{row.cantidad_prorrogas}</TableCell>
                                                    <TableCell className="font-medium">
                                                        {row.nombres} {row.apellidos}
                                                        {row.cargo && <p className="text-muted-foreground text-xs">{row.cargo}</p>}
                                                    </TableCell>
                                                    <TableCell className="text-sm">{row.cedula}</TableCell>
                                                    <TableCell className="text-sm">{row.tipo_contrato ?? '—'}</TableCell>
                                                    <TableCell className="text-sm">{formatFecha(row.fecha_ingreso_empresa)}</TableCell>
                                                    <TableCell className="text-sm">{formatFecha(fechaFinContrato)}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={variant}>{label}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1.5">
                                                            <Button variant="outline" size="sm" asChild>
                                                                <Link href={`/modules/gente/contratos/${row.id}`}>
                                                                    <Eye className="h-3.5 w-3.5" />
                                                                </Link>
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Paginación */}
                        {(colaboradores?.prev_page_url || colaboradores?.next_page_url) && (
                            <div className="text-muted-foreground flex items-center justify-between pt-2 text-sm">
                                <span>
                                    Página {colaboradores.current_page} de {colaboradores.last_page}
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={!colaboradores.prev_page_url}
                                        onClick={() =>
                                            colaboradores.prev_page_url && router.get(colaboradores.prev_page_url, {}, { preserveState: true })
                                        }
                                    >
                                        Anterior
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={!colaboradores.next_page_url}
                                        onClick={() =>
                                            colaboradores.next_page_url && router.get(colaboradores.next_page_url, {}, { preserveState: true })
                                        }
                                    >
                                        Siguiente
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
