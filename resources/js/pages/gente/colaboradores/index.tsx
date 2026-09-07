import HeadingSmall from '@/components/heading-small';
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
import { calcularTiempoTrabajado } from '@/pages/seguridad/colaboradores/colaborador-form-fields';
import { ImportarColaboradoresDialog } from '@/pages/gente/colaboradores/importar-dialog';
import { type WizardCatalogos } from '@/pages/gente/colaboradores/wizard/catalogos';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowRight, AlertTriangle, Briefcase, Eye, FileWarning, Pencil, Plus, Search, Trash2, Upload, Users, UserCheck, UserX } from 'lucide-react';
import { FormEventHandler, useEffect, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'Colaboradores', href: '/modules/gente/colaboradores' },
];

const TIPO_PADRINO_LABELS: Record<string, string> = { padrino: 'Padrino', plan_padrino_personal_nuevo: 'Plan padrino personal nuevo' };

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
    tipo_padrino: string | null;
    imagen: string | null;
    is_active: boolean;
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
};

const TODOS = 'todos';

function nombreArl(colaborador: ColaboradorRow): string {
    if (!colaborador.arl) return '—';
    return colaborador.arl === 'Otro' ? (colaborador.arl_otro ?? 'Otro') : colaborador.arl;
}

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
            <Head title="Colaboradores" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <HeadingSmall title="Colaboradores" description="Administra el listado de colaboradores para las pruebas de alcoholemia." />
                    {canManageColaboradores && (
                        <div className="flex flex-wrap gap-2">
                            <ImportarColaboradoresDialog
                                trigger={
                                    <Button type="button" variant="outline">
                                        <Upload className="size-4" />
                                        Importar Excel
                                    </Button>
                                }
                            />
                            <Button asChild>
                                <Link href={route('gente.colaboradores.create')}>
                                    <Plus className="size-4" />
                                    Nuevo colaborador
                                </Link>
                            </Button>
                        </div>
                    )}
                </div>

                {/* KPI Cards — estilo plan de premiación */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                    {/* Total */}
                    <div className="col-span-2 sm:col-span-2 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm dark:border-slate-800 dark:from-slate-900/60 dark:to-slate-900/30">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                                <Users className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                            </div>
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total colaboradores</span>
                        </div>
                        <p className="text-3xl font-black text-slate-900 dark:text-slate-100">{resumen.total}</p>
                        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">registros completos</p>
                    </div>

                    {/* Activos */}
                    <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/20 dark:to-transparent">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                                <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Activos</span>
                        </div>
                        <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400">{resumen.activos}</p>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                            <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: resumen.total > 0 ? `${(resumen.activos / resumen.total) * 100}%` : '0%' }}
                            />
                        </div>
                        <p className="mt-1 text-[11px] text-emerald-600/70 dark:text-emerald-500">
                            {resumen.total > 0 ? `${Math.round((resumen.activos / resumen.total) * 100)}%` : '—'} del total
                        </p>
                    </div>

                    {/* Inactivos */}
                    <div className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-4 shadow-sm dark:border-rose-900/50 dark:from-rose-950/20 dark:to-transparent">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/40">
                                <UserX className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                            </div>
                            <span className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">Inactivos</span>
                        </div>
                        <p className="text-3xl font-black text-rose-600 dark:text-rose-400">{resumen.inactivos}</p>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-rose-100 dark:bg-rose-900/40">
                            <div
                                className="h-full rounded-full bg-rose-500 transition-all duration-500"
                                style={{ width: resumen.total > 0 ? `${(resumen.inactivos / resumen.total) * 100}%` : '0%' }}
                            />
                        </div>
                        <p className="mt-1 text-[11px] text-rose-600/70 dark:text-rose-500">
                            {resumen.total > 0 ? `${Math.round((resumen.inactivos / resumen.total) * 100)}%` : '—'} del total
                        </p>
                    </div>

                    {/* Área Operativa */}
                    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm dark:border-blue-900/50 dark:from-blue-950/20 dark:to-transparent">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                                <Briefcase className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">Operativos</span>
                        </div>
                        <p className="text-3xl font-black text-blue-700 dark:text-blue-400">{resumen.area_operativa}</p>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/40">
                            <div
                                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                                style={{ width: resumen.total > 0 ? `${(resumen.area_operativa / resumen.total) * 100}%` : '0%' }}
                            />
                        </div>
                        <p className="mt-1 text-[11px] text-blue-600/70 dark:text-blue-500">área operativa</p>
                    </div>

                    {/* Área Administrativa */}
                    <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm dark:border-amber-900/50 dark:from-amber-950/20 dark:to-transparent">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                                <Briefcase className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Administrativos</span>
                        </div>
                        <p className="text-3xl font-black text-amber-700 dark:text-amber-400">{resumen.area_administrativa}</p>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-amber-100 dark:bg-amber-900/40">
                            <div
                                className="h-full rounded-full bg-amber-500 transition-all duration-500"
                                style={{ width: resumen.total > 0 ? `${(resumen.area_administrativa / resumen.total) * 100}%` : '0%' }}
                            />
                        </div>
                        <p className="mt-1 text-[11px] text-amber-600/70 dark:text-amber-500">área administrativa</p>
                    </div>

                    {/* Contratos próximos a vencer */}
                    <div className={`rounded-xl border p-4 shadow-sm bg-gradient-to-br to-white dark:to-transparent ${
                        resumen.contratos_proximos > 0
                            ? 'border-orange-200 from-orange-50 dark:border-orange-900/50 dark:from-orange-950/20'
                            : 'border-slate-200 from-slate-50 dark:border-slate-800 dark:from-slate-900/30'
                    }`}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                                resumen.contratos_proximos > 0
                                    ? 'bg-orange-100 dark:bg-orange-900/40'
                                    : 'bg-slate-100 dark:bg-slate-800'
                            }`}>
                                <AlertTriangle className={`h-4 w-4 ${
                                    resumen.contratos_proximos > 0
                                        ? 'text-orange-600 dark:text-orange-400'
                                        : 'text-slate-400 dark:text-slate-500'
                                }`} />
                            </div>
                            <span className={`text-xs font-semibold uppercase tracking-wide ${
                                resumen.contratos_proximos > 0
                                    ? 'text-orange-700 dark:text-orange-400'
                                    : 'text-slate-500 dark:text-slate-400'
                            }`}>Por vencer</span>
                        </div>
                        <p className={`text-3xl font-black ${
                            resumen.contratos_proximos > 0
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-slate-400 dark:text-slate-500'
                        }`}>{resumen.contratos_proximos}</p>
                        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">contratos próximos</p>
                    </div>

                    {/* Contratos vencidos */}
                    <div className={`rounded-xl border p-4 shadow-sm bg-gradient-to-br to-white dark:to-transparent ${
                        resumen.contratos_vencidos > 0
                            ? 'border-red-200 from-red-50 dark:border-red-900/50 dark:from-red-950/20'
                            : 'border-slate-200 from-slate-50 dark:border-slate-800 dark:from-slate-900/30'
                    }`}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                                resumen.contratos_vencidos > 0
                                    ? 'bg-red-100 dark:bg-red-900/40'
                                    : 'bg-slate-100 dark:bg-slate-800'
                            }`}>
                                <FileWarning className={`h-4 w-4 ${
                                    resumen.contratos_vencidos > 0
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-slate-400 dark:text-slate-500'
                                }`} />
                            </div>
                            <span className={`text-xs font-semibold uppercase tracking-wide ${
                                resumen.contratos_vencidos > 0
                                    ? 'text-red-700 dark:text-red-400'
                                    : 'text-slate-500 dark:text-slate-400'
                            }`}>Vencidos</span>
                        </div>
                        <p className={`text-3xl font-black ${
                            resumen.contratos_vencidos > 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-slate-400 dark:text-slate-500'
                        }`}>{resumen.contratos_vencidos}</p>
                        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">contratos vencidos</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                    <form onSubmit={submitFilters} className="flex max-w-sm items-center gap-2">
                        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Identificación, nombres o apellidos..." />
                        <Button type="submit" variant="secondary" size="icon" aria-label="Buscar">
                            <Search className="size-4" />
                        </Button>
                    </form>

                    <Select value={filters.estado || TODOS} onValueChange={(value) => applyFilters({ estado: value === TODOS ? '' : value })}>
                        <SelectTrigger className="w-36">
                            <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={TODOS}>Estado: todos</SelectItem>
                            <SelectItem value="activo">Activo</SelectItem>
                            <SelectItem value="inactivo">Inactivo</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={filters.area || TODOS} onValueChange={(value) => applyFilters({ area: value === TODOS ? '' : value })}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="Área" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={TODOS}>Área: todas</SelectItem>
                            <SelectItem value="Administrativa">Administrativa</SelectItem>
                            <SelectItem value="Operativa">Operativa</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={filters.cargo || TODOS} onValueChange={(value) => applyFilters({ cargo: value === TODOS ? '' : value })}>
                        <SelectTrigger className="w-44">
                            <SelectValue placeholder="Cargo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={TODOS}>Cargo: todos</SelectItem>
                            {catalogos.cargos.map((cargo) => (
                                <SelectItem key={cargo} value={cargo}>
                                    {cargo}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filters.centro || TODOS} onValueChange={(value) => applyFilters({ centro: value === TODOS ? '' : value })}>
                        <SelectTrigger className="w-36">
                            <SelectValue placeholder="Centro" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={TODOS}>Centro: todos</SelectItem>
                            {catalogos.centros.map((centro) => (
                                <SelectItem key={centro} value={centro}>
                                    {centro}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filters.tipo_contrato || TODOS} onValueChange={(value) => applyFilters({ tipo_contrato: value === TODOS ? '' : value })}>
                        <SelectTrigger className="w-56">
                            <SelectValue placeholder="Tipo de contrato" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={TODOS}>Tipo de contrato: todos</SelectItem>
                            {catalogos.tiposContrato.map((tipo) => (
                                <SelectItem key={tipo} value={tipo}>
                                    {tipo}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filters.eps || TODOS} onValueChange={(value) => applyFilters({ eps: value === TODOS ? '' : value })}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="EPS" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={TODOS}>EPS: todas</SelectItem>
                            {catalogos.epsOpciones.map((eps) => (
                                <SelectItem key={eps} value={eps}>
                                    {eps}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filters.arl || TODOS} onValueChange={(value) => applyFilters({ arl: value === TODOS ? '' : value })}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="ARL" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={TODOS}>ARL: todas</SelectItem>
                            {catalogos.arlOpciones.map((arl) => (
                                <SelectItem key={arl} value={arl}>
                                    {arl}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="grid gap-1">
                        <Label className="text-xs text-muted-foreground">Ingreso desde</Label>
                        <Input
                            type="date"
                            className="w-40"
                            value={filters.fecha_ingreso_desde}
                            onChange={(e) => applyFilters({ fecha_ingreso_desde: e.target.value })}
                        />
                    </div>
                    <div className="grid gap-1">
                        <Label className="text-xs text-muted-foreground">Ingreso hasta</Label>
                        <Input
                            type="date"
                            className="w-40"
                            value={filters.fecha_ingreso_hasta}
                            onChange={(e) => applyFilters({ fecha_ingreso_hasta: e.target.value })}
                        />
                    </div>

                    <Select
                        value={filters.vencimiento_contrato || TODOS}
                        onValueChange={(value) => applyFilters({ vencimiento_contrato: value === TODOS ? '' : value })}
                    >
                        <SelectTrigger className="w-52">
                            <SelectValue placeholder="Vencimiento de contrato" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={TODOS}>Vencimiento: todos</SelectItem>
                            <SelectItem value="proximos">Próximos a vencer</SelectItem>
                            <SelectItem value="vencidos">Vencidos</SelectItem>
                            <SelectItem value="vigentes">Vigentes</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex rounded-md border border-sidebar-border/70 p-1">
                        <Button type="button" variant={viewMode === 'lista' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('lista')}>
                            Lista
                        </Button>
                        <Button
                            type="button"
                            variant={viewMode === 'fotografias' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('fotografias')}
                        >
                            Fotografías
                        </Button>
                    </div>

                    {borradoresCount > 0 && (
                        <Button type="button" variant={filters.registro === 'borrador' ? 'default' : 'outline'} size="sm" onClick={toggleBorradores}>
                            Borradores ({borradoresCount})
                        </Button>
                    )}
                </div>

                {viewMode === 'lista' ? (
                    <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>#</TableHead>
                                    <TableHead>Identificación</TableHead>
                                    <TableHead>Nombres y apellidos</TableHead>
                                    <TableHead>Área</TableHead>
                                    <TableHead>Cargo</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {colaboradores.data.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-muted-foreground py-6 text-center">
                                            No se encontraron colaboradores.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {colaboradores.data.map((colaborador, index) => (
                                    <TableRow key={colaborador.id}>
                                        <TableCell className="text-muted-foreground">{(colaboradores.from ?? 1) + index}</TableCell>
                                        <TableCell>{colaborador.cedula}</TableCell>
                                        <TableCell className="font-medium">
                                            {colaborador.nombres} {colaborador.apellidos}
                                        </TableCell>
                                        <TableCell>{colaborador.area ?? '—'}</TableCell>
                                        <TableCell>{colaborador.cargo ?? '—'}</TableCell>
                                        <TableCell>
                                            {colaborador.estado_registro === 'borrador' ? (
                                                <Badge variant="secondary">Borrador · Paso {colaborador.wizard_step ?? 1}</Badge>
                                            ) : (
                                                <Badge variant={colaborador.is_active ? 'default' : 'destructive'}>
                                                    {colaborador.is_active ? 'Activo' : 'Inactivo'}
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {colaborador.estado_registro === 'borrador' ? (
                                                canManageColaboradores && (
                                                    <div className="flex justify-end">
                                                        <IconActionButton
                                                            icon={ArrowRight}
                                                            label="Continuar registro"
                                                            href={route('gente.colaboradores.wizard', colaborador.id)}
                                                        />
                                                    </div>
                                                )
                                            ) : (
                                                <div className="flex justify-end gap-1">
                                                    <IconActionButton
                                                        icon={Eye}
                                                        label="Ver"
                                                        href={route('gente.colaboradores.show', colaborador.id)}
                                                    />
                                                    {canManageColaboradores && (
                                                        <IconActionButton
                                                            icon={Pencil}
                                                            label="Editar"
                                                            href={route('gente.colaboradores.edit', colaborador.id)}
                                                        />
                                                    )}
                                                    {canManageColaboradores && (
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
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {colaboradores.data.length === 0 && (
                            <div className="col-span-full rounded-lg border border-dashed border-sidebar-border/70 p-8 text-center text-muted-foreground">
                                No se encontraron colaboradores.
                            </div>
                        )}
                        {colaboradores.data.map((colaborador) => (
                            <div key={colaborador.id} className="overflow-hidden rounded-2xl border border-sidebar-border/70 bg-background shadow-sm">
                                <div className="flex h-48 items-center justify-center bg-muted/40 p-4">
                                    {colaborador.imagen ? (
                                        <SafeImage
                                            src={`/storage/${colaborador.imagen}`}
                                            alt={`${colaborador.nombres} ${colaborador.apellidos}`}
                                            className="h-full w-full rounded-xl object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center rounded-xl bg-muted text-3xl font-semibold text-muted-foreground">
                                            {getInitials(colaborador)}
                                        </div>
                                    )}
                                </div>
                                <div className="p-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {colaborador.estado_registro === 'borrador' ? (
                                            <Badge variant="secondary">Borrador · Paso {colaborador.wizard_step ?? 1}</Badge>
                                        ) : (
                                            <Badge variant={colaborador.is_active ? 'default' : 'destructive'}>
                                                {colaborador.is_active ? 'Activo' : 'Inactivo'}
                                            </Badge>
                                        )}
                                        {colaborador.cargo ? <Badge variant="secondary">{colaborador.cargo}</Badge> : null}
                                    </div>
                                    <div className="mt-3">
                                        <Link href={route('gente.colaboradores.show', colaborador.id)} className="text-base font-semibold hover:underline">
                                            {colaborador.nombres} {colaborador.apellidos}
                                        </Link>
                                        <p className="mt-1 text-sm text-muted-foreground">{colaborador.cedula}</p>
                                    </div>
                                    <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                                        <div>
                                            <dt className="text-[11px] uppercase tracking-wide">Tiempo trabajado</dt>
                                            <dd className="text-foreground">{calcularTiempoTrabajado(colaborador.fecha_ingreso_empresa)}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-[11px] uppercase tracking-wide">Centro</dt>
                                            <dd className="text-foreground">{colaborador.centro ?? '—'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-[11px] uppercase tracking-wide">Tipo padrino</dt>
                                            <dd className="text-foreground">{colaborador.tipo_padrino ? (TIPO_PADRINO_LABELS[colaborador.tipo_padrino] ?? colaborador.tipo_padrino) : '—'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-[11px] uppercase tracking-wide">ARL</dt>
                                            <dd className="text-foreground">{nombreArl(colaborador)}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-[11px] uppercase tracking-wide">% Autónomo</dt>
                                            <dd className="text-foreground">—</dd>
                                        </div>
                                    </dl>
                                    {colaborador.estado_registro === 'borrador' ? (
                                        canManageColaboradores && (
                                            <div className="mt-4">
                                                <IconActionButton
                                                    icon={ArrowRight}
                                                    label="Continuar registro"
                                                    variant="outline"
                                                    href={route('gente.colaboradores.wizard', colaborador.id)}
                                                />
                                            </div>
                                        )
                                    ) : (
                                        <div className="mt-4 flex flex-wrap gap-1">
                                            <IconActionButton
                                                icon={Eye}
                                                label="Ver"
                                                variant="outline"
                                                href={route('gente.colaboradores.show', colaborador.id)}
                                            />
                                            {canManageColaboradores && (
                                                <IconActionButton
                                                    icon={Pencil}
                                                    label="Editar"
                                                    variant="outline"
                                                    href={route('gente.colaboradores.edit', colaborador.id)}
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {colaboradores.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {colaboradores.links.map((link, index) => (
                            <Button key={index} variant={link.active ? 'default' : 'outline'} size="sm" disabled={!link.url} asChild={!!link.url}>
                                {link.url ? (
                                    <Link href={link.url} preserveScroll dangerouslySetInnerHTML={{ __html: link.label }} />
                                ) : (
                                    <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                )}
                            </Button>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
