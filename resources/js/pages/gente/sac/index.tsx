import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { AlertCircle, CheckCircle2, Clock, Download, FileSpreadsheet, HelpCircle, Search, Trash2, Upload, UserCheck, Users, X } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'SAC', href: '/modules/gente/sac' },
];

interface ColaboradorInfo {
    id: number;
    nombres: string;
    apellidos: string;
    cedula: string;
    cargo?: string;
}

interface SacRow {
    id: number;
    anio: string | null;
    numero_caso_estandar: string | null;
    nombre_cuenta: string | null;
    nombre_contacto: string | null;
    fecha: string | null;
    descripcion: string | null;
    fecha_resuelto: string | null;
    comentario: string | null;
    aplica: string | null;
    mes: string | null;
    subcategoria: string | null;
    motivo_queja: string | null;
    placa: string | null;
    responsable: string | null;
    colaborador_id: number | null;
    colaborador: ColaboradorInfo | null;
    documento_transporte: string | null;
    plan_accion: string | null;
    tiempo_cierre_caso: string | null;
    porcentaje_si_no: string | null;
    cumplimiento_cierre: string | null;
    ytd: string | null;
    hora: string | null;
    created_at: string;
}

interface Kpis {
    total: number;
    resueltos: number;
    asociados: number;
    porcentaje_asociados: number;
}

interface Options {
    anios: string[];
    meses: string[];
    subcategorias: string[];
    responsables: string[];
}

interface Filters {
    search: string;
    mes: string;
    anio: string;
    subcategoria: string;
    responsable: string;
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
    registros: PaginatedData<SacRow>;
    kpis: Kpis;
    options: Options;
    filters: Filters;
}

export default function SacIndex({ registros, kpis, options, filters }: Props) {
    const [search, setSearch] = useState(filters?.search || '');
    const [mes, setMes] = useState(filters?.mes || 'todos');
    const [anio, setAnio] = useState(filters?.anio || 'todos');
    const [subcategoria, setSubcategoria] = useState(filters?.subcategoria || 'todas');
    const [responsable, setResponsable] = useState(filters?.responsable || 'todos');
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const safeKpis = {
        total: kpis?.total ?? 0,
        resueltos: kpis?.resueltos ?? 0,
        asociados: kpis?.asociados ?? 0,
        porcentaje_asociados: kpis?.porcentaje_asociados ?? 0,
    };

    const safeOptions = {
        anios: options?.anios || [],
        meses: options?.meses || [],
        subcategorias: options?.subcategorias || [],
        responsables: options?.responsables || [],
    };

    const safeRegistros = registros?.data || [];

    const handleFilter = (
        newSearch = search,
        newMes = mes,
        newAnio = anio,
        newSub = subcategoria,
        newResp = responsable
    ) => {
        const query: Record<string, string> = {};
        if (newSearch) query.search = newSearch;
        if (newMes && newMes !== 'todos') query.mes = newMes;
        if (newAnio && newAnio !== 'todos') query.anio = newAnio;
        if (newSub && newSub !== 'todas') query.subcategoria = newSub;
        if (newResp && newResp !== 'todos') query.responsable = newResp;

        router.get('/modules/gente/sac', query, {
            preserveState: true,
            replace: true,
        });
    };

    const resetFilters = () => {
        setSearch('');
        setMes('todos');
        setAnio('todos');
        setSubcategoria('todas');
        setResponsable('todos');
        router.get('/modules/gente/sac', {}, { preserveState: true, replace: true });
    };

    const handleImportSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!importFile) return;

        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('archivo', importFile);

        router.post('/modules/gente/sac/importar', formData, {
            onSuccess: () => {
                setIsImportOpen(false);
                setImportFile(null);
                setIsSubmitting(false);
            },
            onError: () => {
                setIsSubmitting(false);
            },
        });
    };

    const handleLimpiar = () => {
        if (confirm('¿Está seguro de que desea eliminar TODOS los registros de SAC? Esta acción no se puede deshacer.')) {
            router.post('/modules/gente/sac/limpiar');
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="SAC - Servicio al Cliente" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4 md:p-6">
                {/* Encabezado y Acciones */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            SAC - Servicio al Cliente
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Gestión, seguimiento e importación de casos de Servicio al Cliente asociados a colaboradores.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open('/modules/gente/sac/plantilla', '_blank')}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Plantilla Excel
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/modules/gente/sac/exportar?search=${search}&mes=${mes === 'todos' ? '' : mes}&anio=${anio === 'todos' ? '' : anio}&subcategoria=${subcategoria === 'todas' ? '' : subcategoria}&responsable=${responsable === 'todos' ? '' : responsable}`, '_blank')}
                        >
                            <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" />
                            Exportar CSV
                        </Button>

                        <Button
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={() => setIsImportOpen(true)}
                        >
                            <Upload className="mr-2 h-4 w-4" />
                            Importar Excel
                        </Button>

                        {safeKpis.total > 0 && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleLimpiar}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Limpiar Registros
                            </Button>
                        )}
                    </div>
                </div>

                {/* Tarjetas de KPIs */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Casos</CardTitle>
                            <FileSpreadsheet className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{safeKpis.total}</div>
                            <p className="text-xs text-muted-foreground">Casos registrados en SAC</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Casos Resueltos</CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-600">{safeKpis.resueltos}</div>
                            <p className="text-xs text-muted-foreground">Con fecha de solución registrada</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Responsables Asociados</CardTitle>
                            <UserCheck className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600">{safeKpis.asociados}</div>
                            <p className="text-xs text-muted-foreground">Vinculados a tabla colaboradores</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">% Coincidencia Colaborador</CardTitle>
                            <Users className="h-4 w-4 text-purple-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-purple-600">{safeKpis.porcentaje_asociados}%</div>
                            <p className="text-xs text-muted-foreground">Efectividad del mapeo automático</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filtros */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                            <div className="lg:col-span-2">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar caso, cuenta, contacto, placa..."
                                        value={search}
                                        onChange={(e) => {
                                            setSearch(e.target.value);
                                            handleFilter(e.target.value);
                                        }}
                                        className="pl-9"
                                    />
                                </div>
                            </div>

                            <div>
                                <Select
                                    value={anio}
                                    onValueChange={(val) => {
                                        setAnio(val);
                                        handleFilter(search, mes, val);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Año" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos los años</SelectItem>
                                        {safeOptions.anios.map((a) => (
                                            <SelectItem key={a} value={a}>
                                                {a}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Select
                                    value={mes}
                                    onValueChange={(val) => {
                                        setMes(val);
                                        handleFilter(search, val, anio);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Mes" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos los meses</SelectItem>
                                        {safeOptions.meses.map((m) => (
                                            <SelectItem key={m} value={m}>
                                                {m}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Select
                                    value={subcategoria}
                                    onValueChange={(val) => {
                                        setSubcategoria(val);
                                        handleFilter(search, mes, anio, val);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Subcategoría" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todas">Todas las subcategorías</SelectItem>
                                        {safeOptions.subcategorias.map((s) => (
                                            <SelectItem key={s} value={s}>
                                                {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-2">
                                <Select
                                    value={responsable}
                                    onValueChange={(val) => {
                                        setResponsable(val);
                                        handleFilter(search, mes, anio, subcategoria, val);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Responsable" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos los responsables</SelectItem>
                                        {safeOptions.responsables.map((r) => (
                                            <SelectItem key={r} value={r}>
                                                {r}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {(search || mes !== 'todos' || anio !== 'todos' || subcategoria !== 'todas' || responsable !== 'todos') && (
                                    <Button variant="ghost" size="sm" onClick={resetFilters} title="Limpiar filtros">
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Tabla de Registros */}
                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted dark:bg-muted">
                                        <TableHead className="w-[120px]">Caso / Fecha</TableHead>
                                        <TableHead>Cuenta & Contacto</TableHead>
                                        <TableHead>Motivo / Subcategoría</TableHead>
                                        <TableHead>Placa & Docto</TableHead>
                                        <TableHead>Responsable (Excel)</TableHead>
                                        <TableHead>Colaborador Sistema</TableHead>
                                        <TableHead>Cierre / Cumplimiento</TableHead>
                                        <TableHead className="max-w-[200px]">Detalle</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {safeRegistros.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                                No se encontraron registros de SAC con los filtros aplicados.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        safeRegistros.map((row) => (
                                            <TableRow key={row.id}>
                                                <TableCell className="align-top font-medium">
                                                    <div className="text-amber-700 dark:text-amber-400 font-semibold">
                                                        {row.numero_caso_estandar || `#${row.id}`}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {row.fecha || 'Sin fecha'}
                                                    </div>
                                                    {row.anio && (
                                                        <Badge variant="outline" className="mt-1 text-[10px]">
                                                            {row.anio} {row.mes ? `- ${row.mes}` : ''}
                                                        </Badge>
                                                    )}
                                                </TableCell>

                                                <TableCell className="align-top">
                                                    <div className="font-medium text-foreground">
                                                        {row.nombre_cuenta || '-'}
                                                    </div>
                                                    {row.nombre_contacto && (
                                                        <div className="text-xs text-muted-foreground">
                                                            Contacto: {row.nombre_contacto}
                                                        </div>
                                                    )}
                                                </TableCell>

                                                <TableCell className="align-top">
                                                    <div className="text-sm font-medium">
                                                        {row.motivo_queja || '-'}
                                                    </div>
                                                    {row.subcategoria && (
                                                        <div className="text-xs text-amber-600 dark:text-amber-400">
                                                            {row.subcategoria}
                                                        </div>
                                                    )}
                                                </TableCell>

                                                <TableCell className="align-top">
                                                    {row.placa && (
                                                        <Badge variant="secondary" className="font-mono text-xs">
                                                            {row.placa}
                                                        </Badge>
                                                    )}
                                                    {row.documento_transporte && (
                                                        <div className="text-xs text-muted-foreground mt-0.5">
                                                            {row.documento_transporte}
                                                        </div>
                                                    )}
                                                </TableCell>

                                                <TableCell className="align-top text-sm">
                                                    {row.responsable || <span className="text-muted-foreground italic">No especificado</span>}
                                                </TableCell>

                                                <TableCell className="align-top">
                                                    {row.colaborador ? (
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                                {row.colaborador.nombres} {row.colaborador.apellidos}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                CC: {row.colaborador.cedula}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                                                            Sin Coincidencia
                                                        </Badge>
                                                    )}
                                                </TableCell>

                                                <TableCell className="align-top">
                                                    <div className="text-xs space-y-1">
                                                        {row.fecha_resuelto ? (
                                                            <div className="text-emerald-600 font-medium">
                                                                Resuelto: {row.fecha_resuelto}
                                                            </div>
                                                        ) : (
                                                            <div className="text-amber-600 flex items-center gap-1">
                                                                <Clock className="h-3 w-3" /> Pendiente
                                                            </div>
                                                        )}
                                                        {row.tiempo_cierre_caso && (
                                                            <div className="text-muted-foreground">
                                                                Tiempo: {row.tiempo_cierre_caso}h
                                                            </div>
                                                        )}
                                                        {row.cumplimiento_cierre && (
                                                            <Badge className="bg-blue-600 text-[10px]">
                                                                {row.cumplimiento_cierre}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>

                                                <TableCell className="align-top max-w-[200px]">
                                                    {row.descripcion && (
                                                        <p className="text-xs text-foreground line-clamp-2" title={row.descripcion}>
                                                            {row.descripcion}
                                                        </p>
                                                    )}
                                                    {row.comentario && (
                                                        <p className="text-[11px] text-muted-foreground italic mt-1 line-clamp-1" title={row.comentario}>
                                                            {row.comentario}
                                                        </p>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* Paginación */}
                {registros && registros.last_page > 1 && (
                    <div className="flex items-center justify-between pt-2">
                        <p className="text-xs text-muted-foreground">
                            Mostrando {registros.data.length} de {registros.total} registros (Página {registros.current_page} de {registros.last_page})
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!registros.prev_page_url}
                                onClick={() => registros.prev_page_url && router.get(registros.prev_page_url)}
                            >
                                Anterior
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!registros.next_page_url}
                                onClick={() => registros.next_page_url && router.get(registros.next_page_url)}
                            >
                                Siguiente
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Importación Excel */}
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5 text-amber-600" />
                            Importar Excel de SAC
                        </DialogTitle>
                        <DialogDescription>
                            Seleccione el archivo Excel (.xlsx, .xls) o CSV de Servicio al Cliente. El sistema asociará automáticamente el nombre del campo <strong>RESPONSABLE</strong> con la lista de colaboradores.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleImportSubmit} className="space-y-4 py-2">
                        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-amber-500 transition-colors">
                            <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-2" />
                            <label htmlFor="sac-file-input" className="cursor-pointer text-sm font-medium text-amber-600 hover:text-amber-700">
                                {importFile ? importFile.name : 'Haga clic para seleccionar archivo'}
                            </label>
                            <p className="text-xs text-muted-foreground mt-1">Soporta .xlsx, .xls o .csv (Max 20MB)</p>
                            <input
                                id="sac-file-input"
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                className="hidden"
                                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                            />
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button type="button" variant="outline" onClick={() => setIsImportOpen(false)}>
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={!importFile || isSubmitting}
                                className="bg-amber-600 hover:bg-amber-700 text-white"
                            >
                                {isSubmitting ? 'Procesando...' : 'Iniciar Importación'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
