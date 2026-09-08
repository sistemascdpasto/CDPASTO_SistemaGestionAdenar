import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Award, BookOpen, CheckCircle2, Crown, Download, Percent, Search, Trash2, Upload, Users } from 'lucide-react';
import { useState } from 'react';
import { ImportarDpoAcademyDialog } from './importar-dialog';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'DPO Academy', href: '/modules/gente/dpo-academy' },
];

interface DpoAcademyRow {
    id: number;
    colaborador_id: number | null;
    region: string | null;
    centro: string | null;
    negocio: string | null;
    qr_safety: string | null;
    nombre: string;
    cargo: string | null;
    coronita: string | null;
    calificacion: number | null;
    status: string | null;
    created_at: string;
}

interface Kpis {
    total: number;
    promedio_calificacion: number;
    total_coronitas: number;
    total_completados: number;
}

interface Options {
    regiones: string[];
    centros: string[];
    negocios: string[];
    statuses: string[];
}

interface Filters {
    search: string;
    region: string;
    centro: string;
    negocio: string;
    status: string;
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
    registros: PaginatedData<DpoAcademyRow>;
    kpis: Kpis;
    options: Options;
    filters: Filters;
}

export default function DpoAcademyIndex({ registros, kpis, options, filters }: Props) {
    const [search, setSearch] = useState(filters?.search || '');
    const [region, setRegion] = useState(filters?.region || 'todos');
    const [centro, setCentro] = useState(filters?.centro || 'todos');
    const [negocio, setNegocio] = useState(filters?.negocio || 'todos');
    const [status, setStatus] = useState(filters?.status || 'todos');

    const safeKpis = {
        total: kpis?.total ?? 0,
        promedio_calificacion: kpis?.promedio_calificacion ?? 0,
        total_coronitas: kpis?.total_coronitas ?? 0,
        total_completados: kpis?.total_completados ?? 0,
    };

    const safeOptions = {
        regiones: options?.regiones || [],
        centros: options?.centros || [],
        negocios: options?.negocios || [],
        statuses: options?.statuses || [],
    };

    const safeRegistros = registros?.data || [];

    const handleFilter = (
        newSearch = search,
        newRegion = region,
        newCentro = centro,
        newNegocio = negocio,
        newStatus = status,
    ) => {
        router.get(
            '/modules/gente/dpo-academy',
            {
                search: newSearch,
                region: newRegion === 'todos' ? '' : newRegion,
                centro: newCentro === 'todos' ? '' : newCentro,
                negocio: newNegocio === 'todos' ? '' : newNegocio,
                status: newStatus === 'todos' ? '' : newStatus,
            },
            { preserveState: true, replace: true },
        );
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearch(val);
        handleFilter(val, region, centro, negocio, status);
    };

    const handleRegionChange = (val: string) => {
        setRegion(val);
        handleFilter(search, val, centro, negocio, status);
    };

    const handleCentroChange = (val: string) => {
        setCentro(val);
        handleFilter(search, region, val, negocio, status);
    };

    const handleNegocioChange = (val: string) => {
        setNegocio(val);
        handleFilter(search, region, centro, val, status);
    };

    const handleStatusChange = (val: string) => {
        setStatus(val);
        handleFilter(search, region, centro, negocio, val);
    };

    const handleLimpiar = () => {
        if (confirm('¿Estás seguro de que deseas eliminar todos los registros de DPO Academy?')) {
            router.post('/modules/gente/dpo-academy/limpiar');
        }
    };

    const exportUrl = `/modules/gente/dpo-academy/exportar?search=${encodeURIComponent(search)}&region=${region === 'todos' ? '' : encodeURIComponent(region)}&centro=${centro === 'todos' ? '' : encodeURIComponent(centro)}&negocio=${negocio === 'todos' ? '' : encodeURIComponent(negocio)}&status=${status === 'todos' ? '' : encodeURIComponent(status)}`;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="DPO Academy - Módulo Gente" />

            <div className="space-y-6 p-6">
                {/* Header Banner */}
                <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-6 shadow-sm dark:border-amber-900/50 dark:from-amber-950/20">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <BookOpen className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                    DPO Academy
                                </h1>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Gestión, seguimiento e importación del reporte de avance de capacitaciones DPO Academy.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <ImportarDpoAcademyDialog
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
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{safeKpis.total}</div>
                            <p className="text-xs text-muted-foreground">Registros cargados</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Promedio Calificación</CardTitle>
                            <Percent className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{safeKpis.promedio_calificacion}%</div>
                            <p className="text-xs text-muted-foreground">Promedio de puntuación</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Con Coronita</CardTitle>
                            <Award className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{safeKpis.total_coronitas}</div>
                            <p className="text-xs text-muted-foreground">Reconocimientos de excelencia</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Completados / Aprobados</CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{safeKpis.total_completados}</div>
                            <p className="text-xs text-muted-foreground">Avance exitoso</p>
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
                                        placeholder="Nombre, cargo, QR..."
                                        value={search}
                                        onChange={handleSearchChange}
                                        className="pl-9"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">Región</label>
                                <Select value={region} onValueChange={handleRegionChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todas las Regiones" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todas las Regiones</SelectItem>
                                        {safeOptions.regiones.map((r) => (
                                            <SelectItem key={r} value={r}>
                                                {r}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">Centro</label>
                                <Select value={centro} onValueChange={handleCentroChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todos los Centros" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos los Centros</SelectItem>
                                        {safeOptions.centros.map((c) => (
                                            <SelectItem key={c} value={c}>
                                                {c}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">Negocio</label>
                                <Select value={negocio} onValueChange={handleNegocioChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todos los Negocios" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos los Negocios</SelectItem>
                                        {safeOptions.negocios.map((n) => (
                                            <SelectItem key={n} value={n}>
                                                {n}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                                <Select value={status} onValueChange={handleStatusChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todos los Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos los Status</SelectItem>
                                        {safeOptions.statuses.map((s) => (
                                            <SelectItem key={s} value={s}>
                                                {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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
                                        <TableHead>Región / Centro</TableHead>
                                        <TableHead>Negocio</TableHead>
                                        <TableHead>QR Safety</TableHead>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Cargo</TableHead>
                                        <TableHead className="text-center">Coronita</TableHead>
                                        <TableHead className="text-right">Calificación</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {safeRegistros.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                                                No se encontraron registros de DPO Academy.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        safeRegistros.map((row) => {
                                            const calif = row.calificacion !== null && row.calificacion !== undefined ? Number(row.calificacion) : null;
                                            const nomClean = row.nombre && row.nombre !== 'undefined' ? row.nombre : 'Sin nombre';
                                            return (
                                                <TableRow key={row.id}>
                                                    <TableCell className="text-xs">
                                                        <div className="font-medium text-foreground">{row.region ?? '-'}</div>
                                                        <div className="text-muted-foreground">{row.centro ?? '-'}</div>
                                                    </TableCell>

                                                    <TableCell className="text-xs text-muted-foreground">
                                                        {row.negocio ?? '-'}
                                                    </TableCell>

                                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                                        {row.qr_safety ?? '-'}
                                                    </TableCell>

                                                    <TableCell className="font-semibold text-foreground text-xs">
                                                        {nomClean}
                                                    </TableCell>

                                                    <TableCell className="text-xs text-foreground">
                                                        {row.cargo ?? '-'}
                                                    </TableCell>

                                                    <TableCell className="text-center text-xs">
                                                        {row.coronita ? (
                                                            <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400"><Crown className="size-3" /> {row.coronita}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>

                                                    <TableCell className="text-right font-bold text-xs">
                                                        {calif !== null && !isNaN(calif) ? (
                                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-extrabold ${
                                                                calif >= 80
                                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                                    : calif >= 60
                                                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                                                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                                            }`}>
                                                                {calif}%
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground font-normal">S/N</span>
                                                        )}
                                                    </TableCell>

                                                    <TableCell className="text-center text-xs">
                                                        {row.status ? (
                                                            <Badge variant="outline" className="capitalize">
                                                                {row.status}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
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
                            <div className="flex items-center justify-between border-t border-sidebar-border/70/60 pt-4 mt-4 dark:border-sidebar-border">
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
