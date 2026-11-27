import { IconActionButton } from '@/components/icon-action-button';
import { SafeImage } from '@/components/safe-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { ImportarColaboradoresDialog } from '@/pages/gente/colaboradores/importar-dialog';
import { type WizardCatalogos } from '@/pages/gente/colaboradores/wizard/catalogos';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowRight, AlertTriangle, Briefcase, Calendar, CircleAlert, Download, Eye, FileText, Filter, Pencil, Plus, Search, Settings, Trash2, Upload, Users, X } from 'lucide-react';
import { FormEventHandler, useEffect, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'Colaboradores', href: '/modules/gente/colaboradores' },
];

interface ColaboradorRow {
    id: number;
    cedula: string;
    nombres: string;
    apellidos: string;
    area: string | null;
    cargo: string | null;
    centro: string | null;
    celular_1: string | null;
    codigo_qr_skap: string | null;
    correo: string | null;
    direccion: string | null;
    centro_trabajo: string | null;
    eps: string | null;
    eps_otro: string | null;
    arl: string | null;
    arl_otro: string | null;
    fecha_ingreso_empresa: string | null;
    fecha_vencimiento_licencia: string | null;
    tipo_padrino: string | null;
    imagen: string | null;
    is_active: boolean;
    tiene_finalizacion?: boolean;
    estado_registro: 'borrador' | 'completo';
    wizard_step: number | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface ColaboradoresPaginator {
    data: ColaboradorRow[];
    links: PaginationLink[];
    from: number | null;
    to: number | null;
    total: number;
    per_page: number;
}

type ViewMode = 'lista' | 'fotografias';

interface Resumen {
    total: number;
    activos: number;
    inactivos: number;
    borradores: number;
    area_operativa: number;
    area_administrativa: number;
    contratos_proximos: number;
    contratos_vencidos: number;
    licencias_proximas: number;
    licencias_vencidas: number;
}

type Filters = {
    search: string;
    registro: string;
    estado: string;
    area: string;
    cargo: string;
    centro: string;
    tipo_contrato: string;
    eps: string;
    arl: string;
    fecha_ingreso_desde: string;
    fecha_ingreso_hasta: string;
    vencimiento_contrato: string;
    licencia_vencimiento: string;
    per_page: string;
};

const TODOS = 'todos';

export default function ColaboradoresIndex({
    colaboradores,
    resumen,
    filters,
    borradoresCount,
    catalogos,
}: {
    colaboradores: ColaboradoresPaginator;
    resumen: Resumen;
    filters: Filters;
    borradoresCount: number;
    catalogos: WizardCatalogos;
}) {
    const { auth } = usePage<SharedData>().props;
    // Crear/importar/editar/eliminar colaboradores es exclusivo de Gente
    // (Administrador siempre pasa).
    const canManageColaboradores = auth.isAdmin || auth.roles.includes('Gente');

    const [search, setSearch] = useState(filters.search);
    const [viewMode, setViewMode] = useState<ViewMode>('lista');
    const debouncedSearch = useDebouncedValue(search);
    const isFirstRender = useRef(true);

    const applyFilters = (overrides: Partial<Filters>) => {
        router.get(route('gente.colaboradores.index'), { ...filters, search, ...overrides }, { preserveState: true, replace: true });
    };

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        applyFilters({ search: debouncedSearch });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch]);

    const submitFilters: FormEventHandler = (e) => {
        e.preventDefault();
        applyFilters({ search });
    };

    const toggleBorradores = () => {
        applyFilters({ registro: filters.registro === 'borrador' ? '' : 'borrador' });
    };

    const destroyColaborador = (colaborador: ColaboradorRow) => {
        router.delete(route('gente.colaboradores.destroy', colaborador.id), { preserveScroll: true });
    };

    const getInitials = (colaborador: ColaboradorRow) => {
        const first = colaborador.nombres?.trim().charAt(0) ?? '';
        const last = colaborador.apellidos?.trim().charAt(0) ?? '';
        return `${first}${last}`.toUpperCase();
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Colaboradores " />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                {/* ── Card header ──────────────────────────────────────────────── */}
                <div className="rounded-2xl border border-border/70 bg-card shadow-sm px-8 pt-6 pb-4">
                    {/* Fila superior: ícono + título + botones */}
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3 shrink-0">
                            <div
                                className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl shadow-sm shrink-0"
                                style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%)' }}
                            >
                                <Users className="h-7 w-7 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                                    Colaboradores
                                </h1>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    Administra el listado de colaboradores.
                                </p>
                            </div>
                        </div>
                        {canManageColaboradores && (
                            <div className="flex flex-nowrap gap-2 items-center shrink-0">
                                <ImportarColaboradoresDialog
                                    trigger={
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs border-green-300 text-green-700 hover:bg-green-50"
                                        >
                                            <Upload className="size-3.5 mr-1.5" />
                                            <span className="hidden sm:inline">Importar Excel</span>
                                            <span className="sm:hidden">Importar</span>
                                        </Button>
                                    }
                                />
                                <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs border-green-300 text-green-700 hover:bg-green-50"
                                >
                                    <a href={route('gente.colaboradores.exportar')}>
                                        <Download className="size-3.5 mr-1.5" />
                                        <span className="hidden sm:inline">Exportar Excel</span>
                                        <span className="sm:hidden">Exportar</span>
                                    </a>
                                </Button>
                                <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs border-green-300 text-green-700 hover:bg-green-50"
                                >
                                    <Link href={route('gente.configuracion-catalogo.index')}>
                                        <Settings className="size-3.5 mr-1.5" />
                                        <span className="hidden sm:inline">Configuración</span>
                                        <span className="sm:hidden">Config.</span>
                                    </Link>
                                </Button>
                                <Button
                                    asChild
                                    size="sm"
                                    className="h-8 text-xs font-semibold text-white hover:brightness-110 border border-white/30"
                                    style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%)' }}
                                >
                                    <Link href={route('gente.colaboradores.create')}>
                                        <Plus className="size-3.5 mr-1.5" />
                                        <span className="hidden sm:inline">Nuevo colaborador</span>
                                        <span className="sm:hidden">Nuevo</span>
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Separador */}
                    <div className="border-t border-border/50" />

                    {/* Separador */}
                    <div className="border-t border-border/50 mt-4" />

                    {/* Fila inferior: métricas + botones vista/borradores */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-3">
                        <div className="flex flex-col items-center">
                            <span className="text-sm font-bold text-foreground">{resumen.total}</span>
                            <span className="text-[11px] text-muted-foreground">Total</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-sm font-bold text-foreground">{resumen.activos}</span>
                            <span className="text-[11px] text-muted-foreground">Activos</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-sm font-bold text-foreground">{resumen.inactivos}</span>
                            <span className="text-[11px] text-muted-foreground">Inactivos</span>
                        </div>
                        <div className="w-px h-5 bg-border/60" />
                        <div className="flex flex-col items-center">
                            <span className="text-sm font-bold text-foreground">{resumen.area_operativa}</span>
                            <span className="text-[11px] text-muted-foreground">Operativos</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-sm font-bold text-foreground">{resumen.area_administrativa}</span>
                            <span className="text-[11px] text-muted-foreground">Administrativos</span>
                        </div>
                        <div className="w-px h-5 bg-border/60" />
                        

                        {/* Vista + Borradores — esquina inferior derecha */}
                        <div className="ml-auto flex items-center gap-2">
                            <div className="flex rounded-md border border-green-300 p-0.5 h-8">
                                <Button
                                    type="button"
                                    variant={viewMode === 'lista' ? 'default' : 'ghost'}
                                    size="sm"
                                    className={`h-6 text-xs px-2 ${viewMode !== 'lista' ? 'text-green-700 hover:bg-green-50' : ''}`}
                                    onClick={() => setViewMode('lista')}
                                >
                                    Lista
                                </Button>
                                <Button
                                    type="button"
                                    variant={viewMode === 'fotografias' ? 'default' : 'ghost'}
                                    size="sm"
                                    className={`h-6 text-xs px-2 ${viewMode !== 'fotografias' ? 'text-green-700 hover:bg-green-50' : ''}`}
                                    onClick={() => setViewMode('fotografias')}
                                >
                                    Fotos
                                </Button>
                            </div>
                            {borradoresCount > 0 && (
                                <Button
                                    type="button"
                                    variant={filters.registro === 'borrador' ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-8 text-xs border-green-300 text-green-700 hover:bg-green-50"
                                    onClick={toggleBorradores}
                                >
                                    Borradores ({borradoresCount})
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Card filtros ─────────────────────────────────────────────── */}
                <div className="rounded-2xl border border-border/70 bg-card shadow-sm px-6 py-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Filter className="h-3.5 w-3.5 text-green-700 dark:text-green-400" />
                            Filtros de búsqueda
                        </span>
                        {(filters.search || filters.estado || filters.cargo || filters.centro || filters.tipo_contrato || filters.fecha_ingreso_desde || filters.fecha_ingreso_hasta || filters.vencimiento_contrato || filters.licencia_vencimiento || filters.registro) && (
                            <button
                                type="button"
                                onClick={() => applyFilters({ search: '', estado: '', area: '', cargo: '', centro: '', tipo_contrato: '', fecha_ingreso_desde: '', fecha_ingreso_hasta: '', vencimiento_contrato: '', licencia_vencimiento: '', registro: '' })}
                                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 hover:underline cursor-pointer transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
                        {/* Búsqueda */}
                        <div className="grid gap-1">
                            <Label className="text-[11px] font-medium text-muted-foreground flex items-center">
                                <Search className="h-3 w-3 inline mr-1 text-muted-foreground/70" />Buscar
                            </Label>
                            <form onSubmit={submitFilters} className="flex items-center gap-1">
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cédula, nombre..."
                                    className="text-xs h-8 rounded-lg"
                                />
                            </form>
                        </div>

                        {/* Estado */}
                        <div className="grid gap-1">
                            <Label className="text-[11px] font-medium text-muted-foreground flex items-center">
                                <Users className="h-3 w-3 inline mr-1 text-muted-foreground/70" />Estado
                            </Label>
                            <Select value={filters.estado || TODOS} onValueChange={(value) => applyFilters({ estado: value === TODOS ? '' : value })}>
                                <SelectTrigger className="text-xs h-8 rounded-lg">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Todos</SelectItem>
                                    <SelectItem value="activo">Activo</SelectItem>
                                    <SelectItem value="inactivo">Inactivo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Centro */}
                        <div className="grid gap-1">
                            <Label className="text-[11px] font-medium text-muted-foreground flex items-center">
                                <Briefcase className="h-3 w-3 inline mr-1 text-muted-foreground/70" />Centro
                            </Label>
                            <Select value={filters.centro || TODOS} onValueChange={(value) => applyFilters({ centro: value === TODOS ? '' : value })}>
                                <SelectTrigger className="text-xs h-8 rounded-lg">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Todos</SelectItem>
                                    {catalogos.centros.map((c) => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Tipo contrato */}
                        <div className="grid gap-1">
                            <Label className="text-[11px] font-medium text-muted-foreground flex items-center">
                                <FileText className="h-3 w-3 inline mr-1 text-muted-foreground/70" />Contrato
                            </Label>
                            <Select value={filters.tipo_contrato || TODOS} onValueChange={(value) => applyFilters({ tipo_contrato: value === TODOS ? '' : value })}>
                                <SelectTrigger className="text-xs h-8 rounded-lg">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Todos</SelectItem>
                                    {catalogos.tiposContrato.map((tipo) => (
                                        <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Ingreso desde */}
                        <div className="grid gap-1">
                            <Label className="text-[11px] font-medium text-muted-foreground flex items-center">
                                <Calendar className="h-3 w-3 inline mr-1 text-muted-foreground/70" />Ingreso desde
                            </Label>
                            <Input
                                type="date"
                                value={filters.fecha_ingreso_desde}
                                onChange={(e) => applyFilters({ fecha_ingreso_desde: e.target.value })}
                                className="text-xs h-8 rounded-lg"
                            />
                        </div>

                        {/* Ingreso hasta */}
                        <div className="grid gap-1">
                            <Label className="text-[11px] font-medium text-muted-foreground flex items-center">
                                <Calendar className="h-3 w-3 inline mr-1 text-muted-foreground/70" />Ingreso hasta
                            </Label>
                            <Input
                                type="date"
                                value={filters.fecha_ingreso_hasta}
                                onChange={(e) => applyFilters({ fecha_ingreso_hasta: e.target.value })}
                                className="text-xs h-8 rounded-lg"
                            />
                        </div>

                        {/* Cargo */}
                        <div className="grid gap-1">
                            <Label className="text-[11px] font-medium text-muted-foreground flex items-center">
                                <Briefcase className="h-3 w-3 inline mr-1 text-muted-foreground/70" />Cargo
                            </Label>
                            <Select value={filters.cargo || TODOS} onValueChange={(value) => applyFilters({ cargo: value === TODOS ? '' : value })}>
                                <SelectTrigger className="text-xs h-8 rounded-lg">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Todos</SelectItem>
                                    {catalogos.cargos.map((c: string) => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Licencia */}
                        <div className="grid gap-1">
                            <Label className="text-[11px] font-medium text-muted-foreground flex items-center">
                                <AlertTriangle className="h-3 w-3 inline mr-1 text-muted-foreground/70" />Lic. conducción
                            </Label>
                            <Select value={filters.licencia_vencimiento || TODOS} onValueChange={(value) => applyFilters({ licencia_vencimiento: value === TODOS ? '' : value })}>
                                <SelectTrigger className="text-xs h-8 rounded-lg">
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Todas</SelectItem>
                                    <SelectItem value="proximas">Próximas a vencer (≤ 1 año)</SelectItem>
                                    <SelectItem value="vencidas">Vencidas</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                    </div>
                </div>

                {viewMode === 'lista' ? (
                    <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                        {/* ── Table header bar ─────────────────────────────────── */}
                        <div
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-emerald-200/80 dark:border-emerald-800/80 rounded-t-lg"
                            style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.18) 100%)', backdropFilter: 'blur(8px)' }}
                        >
                            <div className="flex items-center gap-2">
                                <CircleAlert className="h-8 w-10 text-emerald-800 dark:text-emerald-300 shrink-0" />
                                <span className="text-sm font-extrabold text-emerald-950 dark:text-white tracking-wide">
                                    Colaboradores
                                </span>
                                <div className="inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold ml-2 text-[10px] sm:text-xs whitespace-nowrap bg-emerald-500/20 text-emerald-900 dark:text-emerald-100 border border-emerald-400/40">
                                    {colaboradores.from ?? 1}–{colaboradores.to ?? colaboradores.data.length} / {colaboradores.total}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-emerald-900 dark:text-emerald-200">
                                <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">Mostrar:</span>
                                <select
                                    value={filters.per_page || colaboradores.per_page}
                                    onChange={(e) => applyFilters({ per_page: e.target.value })}
                                    className="h-7 rounded-lg border border-emerald-300/80 dark:border-emerald-700 bg-white/90 dark:bg-card px-2 text-xs font-semibold text-emerald-950 dark:text-emerald-100 shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                                >
                                    <option value="10">10 registros</option>
                                    <option value="25">25 registros</option>
                                    <option value="50">50 registros</option>
                                    <option value="100">100 registros</option>
                                    <option value="200">200 registros</option>
                                </select>
                            </div>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow
                                    className="border-b border-emerald-200/80 dark:border-emerald-800/80 divide-x divide-emerald-200/60 dark:divide-emerald-800/60"
                                    style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.18) 100%)', backdropFilter: 'blur(8px)' }}
                                >
                                    <TableHead className="text-black dark:text-white text-sm font-bold">#</TableHead>
                                    <TableHead className="text-black dark:text-white text-sm font-bold">Identificación</TableHead>
                                    <TableHead className="text-black dark:text-white text-sm font-bold">Nombres y apellidos</TableHead>
                                    <TableHead className="text-black dark:text-white text-sm font-bold">Área</TableHead>
                                    <TableHead className="text-black dark:text-white text-sm font-bold">Centro</TableHead>
                                    <TableHead className="text-black dark:text-white text-sm font-bold">Cargo</TableHead>
                                    <TableHead className="text-black dark:text-white text-sm font-bold">Estado</TableHead>
                                    <TableHead className="text-black dark:text-white text-sm font-bold text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {colaboradores.data.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-muted-foreground py-6 text-center">
                                            No se encontraron colaboradores.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {colaboradores.data.map((colaborador, index) => (
                                    <TableRow key={colaborador.id} className="divide-x divide-border/60">
                                        <TableCell className="text-black dark:text-white font-medium">{(colaboradores.from ?? 1) + index}</TableCell>
                                        <TableCell>{colaborador.cedula}</TableCell>
                                        <TableCell className="font-medium">
                                            {colaborador.nombres} {colaborador.apellidos}
                                        </TableCell>
                                        <TableCell>{colaborador.area ?? '—'}</TableCell>
                                        <TableCell>{colaborador.centro ?? '—'}</TableCell>
                                        <TableCell>{colaborador.cargo ?? '—'}</TableCell>
                                        <TableCell>
                                            {colaborador.estado_registro === 'borrador' ? (
                                                <Badge variant="secondary">Borrador · Paso {colaborador.wizard_step ?? 1}</Badge>
                                            ) : (
                                                <span className={colaborador.is_active ? 'text-black font-medium' : 'text-red-600 font-medium'}>
                                                    {colaborador.is_active ? 'Activo' : 'Inactivo'}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {colaborador.estado_registro === 'borrador' ? (
                                                canManageColaboradores && (
                                                    <div className="flex justify-end gap-1">
                                                        <IconActionButton
                                                            icon={ArrowRight}
                                                            label="Continuar registro"
                                                            href={route('gente.colaboradores.wizard', colaborador.id)}
                                                        />
                                                        <Dialog>
                                                            <TooltipProvider delayDuration={200}>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <DialogTrigger asChild>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="text-destructive hover:text-destructive"
                                                                                aria-label="Eliminar borrador"
                                                                            >
                                                                                <Trash2 className="size-4" />
                                                                            </Button>
                                                                        </DialogTrigger>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>Eliminar borrador</TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                            <DialogContent>
                                                                <DialogTitle>
                                                                    ¿Eliminar el borrador de {colaborador.nombres} {colaborador.apellidos}?
                                                                </DialogTitle>
                                                                <DialogDescription>
                                                                    Se perderá el progreso del registro (paso {colaborador.wizard_step ?? 1} de
                                                                    4). Esta acción no se puede deshacer.
                                                                </DialogDescription>
                                                                <DialogFooter>
                                                                    <DialogClose asChild>
                                                                        <Button variant="secondary">Cancelar</Button>
                                                                    </DialogClose>
                                                                    <Button variant="destructive" onClick={() => destroyColaborador(colaborador)}>
                                                                        Eliminar
                                                                    </Button>
                                                                </DialogFooter>
                                                            </DialogContent>
                                                        </Dialog>
                                                    </div>
                                                )
                                            ) : (
                                                <div className="flex justify-end gap-1">
                                                    <IconActionButton
                                                        icon={Eye}
                                                        label="Ver"
                                                        href={route('gente.colaboradores.show', colaborador.id)}
                                                    />
                                                    {canManageColaboradores && colaborador.is_active && !colaborador.tiene_finalizacion && (
                                                        <IconActionButton
                                                            icon={Pencil}
                                                            label="Editar"
                                                            href={route('gente.colaboradores.edit', colaborador.id)}
                                                        />
                                                    )}
                                                    {canManageColaboradores && colaborador.is_active && !colaborador.tiene_finalizacion && (
                                                        <Dialog>
                                                            <TooltipProvider delayDuration={200}>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <DialogTrigger asChild>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="text-destructive hover:text-destructive"
                                                                                aria-label="Eliminar"
                                                                            >
                                                                                <Trash2 className="size-4" />
                                                                            </Button>
                                                                        </DialogTrigger>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>Eliminar</TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                            <DialogContent>
                                                                <DialogTitle>
                                                                    ¿Eliminar a {colaborador.nombres} {colaborador.apellidos}?
                                                                </DialogTitle>
                                                                <DialogDescription>
                                                                    Esta acción elimina al colaborador de forma lógica; su historial de pruebas
                                                                    se conserva.
                                                                </DialogDescription>
                                                                <DialogFooter>
                                                                    <DialogClose asChild>
                                                                        <Button variant="secondary">Cancelar</Button>
                                                                    </DialogClose>
                                                                    <Button variant="destructive" onClick={() => destroyColaborador(colaborador)}>
                                                                        Eliminar
                                                                    </Button>
                                                                </DialogFooter>
                                                            </DialogContent>
                                                        </Dialog>
                                                    )}
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        {colaboradores.data.length === 0 && (
                            <div className="col-span-full rounded-lg border border-dashed border-sidebar-border/70 p-8 text-center text-muted-foreground">
                                No se encontraron colaboradores.
                            </div>
                        )}
                        {colaboradores.data.map((colaborador) => (
                            <div key={colaborador.id} className="overflow-hidden rounded-xl border border-sidebar-border/70 bg-background shadow-sm">
                                {/* Fotografía cuadrada con aspect-ratio 1:1 */}
                                <div className="relative w-full" style={{ paddingBottom: '100%' }}>
                                    <div className="absolute inset-0 bg-muted/40">
                                    {colaborador.imagen ? (
                                        <SafeImage
                                            src={`/storage/${colaborador.imagen}`}
                                            alt={`${colaborador.nombres} ${colaborador.apellidos}`}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-muted text-2xl font-semibold text-muted-foreground">
                                            {getInitials(colaborador)}
                                        </div>
                                    )}
                                    {/* Botones Ver / Editar sobre la fotografía */}
                                    <div className="absolute bottom-2 right-2 flex gap-1">
                                        {colaborador.estado_registro === 'borrador' ? (
                                            canManageColaboradores && (
                                                <IconActionButton
                                                    icon={ArrowRight}
                                                    label="Continuar registro"
                                                    variant="outline"
                                                    href={route('gente.colaboradores.wizard', colaborador.id)}
                                                />
                                            )
                                        ) : (
                                            <>
                                                <IconActionButton
                                                    icon={Eye}
                                                    label="Ver"
                                                    variant="outline"
                                                    href={route('gente.colaboradores.show', colaborador.id)}
                                                />
                                                {canManageColaboradores && !colaborador.tiene_finalizacion && (
                                                    <IconActionButton
                                                        icon={Pencil}
                                                        label="Editar"
                                                        variant="outline"
                                                        href={route('gente.colaboradores.edit', colaborador.id)}
                                                    />
                                                )}
                                            </>
                                        )}
                                    </div>
                                    </div>
                                </div>
                                <div className="px-3 py-2">
                                    <div className="flex flex-wrap items-center gap-1">
                                        {colaborador.estado_registro === 'borrador' ? (
                                            <Badge variant="secondary" className="text-[10px]">Borrador · Paso {colaborador.wizard_step ?? 1}</Badge>
                                        ) : null}
                                    </div>
                                    <div className="mt-1.5">
                                        <Link href={route('gente.colaboradores.show', colaborador.id)} className="text-sm font-bold hover:underline leading-tight block uppercase">
                                            {colaborador.nombres} {colaborador.apellidos}
                                        </Link>
                                        <p className="text-[11px] text-muted-foreground">{colaborador.cedula}</p>
                                    </div>
                                    <dl className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                                        <div>
                                            <dt className="text-[9px] uppercase tracking-wide">Centro</dt>
                                            <dd className="text-foreground truncate">{colaborador.centro ?? '—'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-[9px] uppercase tracking-wide">Cargo</dt>
                                            <dd className="text-foreground truncate">{colaborador.cargo ?? '—'}</dd>
                                        </div>
                                    </dl>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {colaboradores.links.length > 3 && (
                    <div
                        className="flex justify-center px-4 py-3 border-t border-emerald-200/80 dark:border-emerald-800/80 rounded-b-lg"
                        style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.14) 100%)', backdropFilter: 'blur(8px)' }}
                    >
                        <div className="flex gap-1 flex-wrap justify-center">
                            {colaboradores.links.map((link, index) => (
                                <Button
                                    key={index}
                                    size="sm"
                                    disabled={!link.url}
                                    asChild={!!link.url}
                                    className={[
                                        'h-7 sm:h-8 min-w-[1.75rem] sm:min-w-[2rem] px-2 text-xs flex-1 sm:flex-none rounded-md font-medium',
                                        link.active
                                            ? 'bg-emerald-600 text-white border border-emerald-700 shadow-sm hover:bg-emerald-700'
                                            : 'border border-emerald-200/80 dark:border-emerald-800 bg-background text-black dark:text-black hover:bg-emerald-50 dark:hover:bg-emerald-950/60',
                                    ].join(' ')}
                                >
                                    {link.url ? (
                                        <Link href={link.url} preserveScroll preserveState dangerouslySetInnerHTML={{ __html: link.label }} />
                                    ) : (
                                        <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                    )}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
