import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { AlertCircle, CalendarDays, Clock, Download, FileSpreadsheet, Search, Trash2, Upload, Users } from 'lucide-react';
import { useState } from 'react';
import { CalendarioFestivosDialog } from './calendario-festivos-dialog';
import { ImportarAusentismoDialog } from './importar-dialog';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'Ausentismo', href: '/modules/gente/ausentismo' },
];

interface AusentismoRow {
    id: number;
    colaborador_id: number | null;
    apellidos: string | null;
    nombres: string | null;
    identificador: string;
    grupo: string | null;
    fecha: string;
    permiso: string | null;
    turno: string | null;
    entro_1: string | null;
    atraso_1: string | null;
    salio_1: string | null;
    adelanto_1: string | null;
    entro_2: string | null;
    atraso_2: string | null;
    salio_2: string | null;
    adelanto_2: string | null;
    created_at: string;
}

interface Kpis {
    total: number;
    total_colaboradores: number;
    total_con_permiso: number;
    total_con_atraso: number;
}

interface Options {
    grupos: string[];
    permisos: string[];
}

interface Filters {
    search: string;
    grupo: string;
    permiso: string;
    fecha_desde: string;
    fecha_hasta: string;
}

interface PaginatedData<T> {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
}

interface Props {
    registros: PaginatedData<AusentismoRow>;
    kpis: Kpis;
    options: Options;
    filters: Filters;
}

export default function AusentismoIndex({ registros, kpis, options, filters }: Props) {
    const [search, setSearch] = useState(filters?.search || '');
    const [grupo, setGrupo] = useState(filters?.grupo || 'todos');
    const [permiso, setPermiso] = useState(filters?.permiso || 'todos');
    const [fechaDesde, setFechaDesde] = useState(filters?.fecha_desde || '');
    const [fechaHasta, setFechaHasta] = useState(filters?.fecha_hasta || '');

    const safeKpis = {
        total: kpis?.total ?? 0,
        total_colaboradores: kpis?.total_colaboradores ?? 0,
        total_con_permiso: kpis?.total_con_permiso ?? 0,
        total_con_atraso: kpis?.total_con_atraso ?? 0,
    };

    const safeOptions = {
        grupos: options?.grupos || [],
        permisos: options?.permisos || [],
    };

    const safeRegistros = registros?.data || [];

    const handleFilter = (
        newSearch = search,
        newGrupo = grupo,
        newPermiso = permiso,
        newDesde = fechaDesde,
        newHasta = fechaHasta,
    ) => {
        router.get(
            '/modules/gente/ausentismo',
            {
                search: newSearch,
                grupo: newGrupo === 'todos' ? '' : newGrupo,
                permiso: newPermiso === 'todos' ? '' : newPermiso,
                fecha_desde: newDesde,
                fecha_hasta: newHasta,
            },
            { preserveState: true, replace: true },
        );
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearch(val);
        handleFilter(val, grupo, permiso, fechaDesde, fechaHasta);
    };

    const handleGrupoChange = (val: string) => {
        setGrupo(val);
        handleFilter(search, val, permiso, fechaDesde, fechaHasta);
    };

    const handlePermisoChange = (val: string) => {
        setPermiso(val);
        handleFilter(search, grupo, val, fechaDesde, fechaHasta);
    };

    const handleFechaDesdeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setFechaDesde(val);
        handleFilter(search, grupo, permiso, val, fechaHasta);
    };

    const handleFechaHastaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setFechaHasta(val);
        handleFilter(search, grupo, permiso, fechaDesde, val);
    };

    const handleLimpiar = () => {
        if (confirm('¿Estás seguro de que deseas eliminar todos los registros de ausentismo?')) {
            router.post('/modules/gente/ausentismo/limpiar');
        }
    };

    const exportUrl = `/modules/gente/ausentismo/exportar?search=${encodeURIComponent(search)}&grupo=${grupo === 'todos' ? '' : encodeURIComponent(grupo)}&permiso=${permiso === 'todos' ? '' : encodeURIComponent(permiso)}&fecha_desde=${encodeURIComponent(fechaDesde)}&fecha_hasta=${encodeURIComponent(fechaHasta)}`;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Ausentismo - Módulo Gente" />

            <div className="space-y-6 p-6">
                {/* Header Banner */}
                <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-6 shadow-sm dark:border-amber-900/50 dark:from-amber-950/20">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <CalendarDays className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                    Ausentismo y Marcaciones
                                </h1>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Control, importación de reportes de marcaciones, turno, permisos y retardos por colaborador.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <CalendarioFestivosDialog />
                            <ImportarAusentismoDialog
                                trigger={
                                    <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                                        <Upload className="mr-2 h-4 w-4" />
                                        Importar Excel
                                    </Button>
                                }
                            />
                            <Button asChild variant="outline">
                                <a href={exportUrl} target="_blank" rel="noopener noreferrer">
                                    <Download className="mr-2 h-4 w-4" />
                                    Exportar CSV
                                </a>
                            </Button>
                            {safeKpis.total > 0 && (
                                <Button variant="ghost" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={handleLimpiar}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* KPI Resumen Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Total Registros</CardTitle>
                            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{safeKpis.total}</div>
                            <p className="text-xs text-muted-foreground">Registros procesados</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Colaboradores Evaluados</CardTitle>
                            <Users className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{safeKpis.total_colaboradores}</div>
                            <p className="text-xs text-muted-foreground">Colaboradores únicos</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Con Permiso / Ausencia</CardTitle>
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{safeKpis.total_con_permiso}</div>
                            <p className="text-xs text-muted-foreground">Novedades registradas</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Con Retardo / Atraso</CardTitle>
                            <Clock className="h-4 w-4 text-rose-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{safeKpis.total_con_atraso}</div>
                            <p className="text-xs text-muted-foreground">Registros con atraso</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filtros */}
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base font-semibold">Filtros de Búsqueda</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">Buscar</label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="text"
                                        placeholder="Nombre, cédula, turno..."
                                        value={search}
                                        onChange={handleSearchChange}
                                        className="pl-9"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">Grupo</label>
                                <Select value={grupo} onValueChange={handleGrupoChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todos los Grupos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos los Grupos</SelectItem>
                                        {safeOptions.grupos.map((g) => (
                                            <SelectItem key={g} value={g}>
                                                {g}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">Permiso</label>
                                <Select value={permiso} onValueChange={handlePermisoChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todos los Permisos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos los Permisos</SelectItem>
                                        {safeOptions.permisos.map((p) => (
                                            <SelectItem key={p} value={p}>
                                                {p}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">Fecha Desde</label>
                                <Input
                                    type="date"
                                    value={fechaDesde}
                                    onChange={handleFechaDesdeChange}
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">Fecha Hasta</label>
                                <Input
                                    type="date"
                                    value={fechaHasta}
                                    onChange={handleFechaHastaChange}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Tabla de Registros */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold">
                            Registros ({registros?.total ?? safeRegistros.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Colaborador</TableHead>
                                        <TableHead>Grupo / Turno</TableHead>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Permiso</TableHead>
                                        <TableHead className="text-center bg-muted">Bloque 1 (Entró - Atraso - Salió - Adelanto)</TableHead>
                                        <TableHead className="text-center bg-muted/70">Bloque 2 (Entró - Atraso - Salió - Adelanto)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {safeRegistros.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                                                No se encontraron registros de ausentismo con los filtros seleccionados.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        safeRegistros.map((row) => {
                                            const nomClean = row.nombres && row.nombres !== 'undefined' ? row.nombres : '';
                                            const apeClean = row.apellidos && row.apellidos !== 'undefined' ? row.apellidos : '';
                                            const nombreStr = [nomClean, apeClean].filter(Boolean).join(' ') || 'Sin nombre';
                                            const fechaStr = typeof row.fecha === 'string' ? row.fecha.split('T')[0] : (row.fecha ?? '-');
                                            return (
                                                <TableRow key={row.id}>
                                                    <TableCell>
                                                        <div>
                                                            <div className="font-semibold text-foreground text-xs">
                                                                {nombreStr}
                                                            </div>
                                                            <div className="text-xs font-mono text-muted-foreground">ID {row.identificador ?? '-'}</div>
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="text-xs">
                                                        <div className="font-medium text-foreground">{row.grupo ?? '-'}</div>
                                                        <div className="text-muted-foreground text-[11px]">{row.turno ?? '-'}</div>
                                                    </TableCell>

                                                    <TableCell className="text-xs font-mono text-muted-foreground">
                                                        {fechaStr}
                                                    </TableCell>

                                                    <TableCell className="text-xs">
                                                        {row.permiso ? (
                                                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                                                                {row.permiso}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>

                                                    {/* Bloque 1 */}
                                                    <TableCell className="text-center text-xs bg-muted/50 font-mono">
                                                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                            <span title="Entró" className="text-emerald-600 dark:text-emerald-400 font-semibold">{row.entro_1 || '--:--'}</span>
                                                            <span className="text-muted-foreground/40">/</span>
                                                            <span title="Atraso" className={row.atraso_1 && row.atraso_1 !== '00:00' && row.atraso_1 !== '00:00:00' ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-muted-foreground'}>{row.atraso_1 || '--:--'}</span>
                                                            <span className="text-muted-foreground/40">/</span>
                                                            <span title="Salió" className="text-blue-600 dark:text-blue-400">{row.salio_1 || '--:--'}</span>
                                                            <span className="text-muted-foreground/40">/</span>
                                                            <span title="Adelanto" className="text-muted-foreground">{row.adelanto_1 || '--:--'}</span>
                                                        </div>
                                                    </TableCell>

                                                    {/* Bloque 2 */}
                                                    <TableCell className="text-center text-xs bg-muted/40 font-mono">
                                                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                            <span title="Entró" className="text-emerald-600 dark:text-emerald-400 font-semibold">{row.entro_2 || '--:--'}</span>
                                                            <span className="text-muted-foreground/40">/</span>
                                                            <span title="Atraso" className={row.atraso_2 && row.atraso_2 !== '00:00' && row.atraso_2 !== '00:00:00' ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-muted-foreground'}>{row.atraso_2 || '--:--'}</span>
                                                            <span className="text-muted-foreground/40">/</span>
                                                            <span title="Salió" className="text-blue-600 dark:text-blue-400">{row.salio_2 || '--:--'}</span>
                                                            <span className="text-muted-foreground/40">/</span>
                                                            <span title="Adelanto" className="text-muted-foreground">{row.adelanto_2 || '--:--'}</span>
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
                        {(registros?.last_page ?? 1) > 1 && (
                            <div className="flex items-center justify-between border-t border-border pt-4 mt-4">
                                <span className="text-xs text-muted-foreground">
                                    Página {registros?.current_page ?? 1} de {registros?.last_page ?? 1}
                                </span>
                                <div className="flex items-center gap-2">
                                    {registros?.prev_page_url && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => router.get(registros.prev_page_url!, {}, { preserveState: true })}
                                        >
                                            Anterior
                                        </Button>
                                    )}
                                    {registros?.next_page_url && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => router.get(registros.next_page_url!, {}, { preserveState: true })}
                                        >
                                            Siguiente
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
