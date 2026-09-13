import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { BarChart3, CheckCircle2, ClipboardList, Eye, FileSpreadsheet, FileText, Plus, Trash2, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Flota', href: '/modules/flota' },
    { title: 'Actas de Taller', href: '/modules/flota/actas-taller' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActaResumen {
    id: number;
    numero_acta: string;
    placa: string;
    taller: string | null;
    motivo_ingreso: string | null;
    fecha_entrega: string | null;
    fecha_cierre: string | null;
    estado_acta: string;
    estado_label: string;
    estado_color: string;
    total_novedades: number;
    novedades_solucionadas: number;
    novedades_pendientes: number;
}

interface Paginator {
    data: ActaResumen[];
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
}

interface Props {
    actas: Paginator;
    vehiculos: string[];
    filters: { placa?: string; estado?: string; desde?: string; hasta?: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ESTADO_BADGE: Record<string, string> = {
    en_taller:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    cerrada:    'bg-green-700 text-white',
    cancelada:  'bg-muted text-muted-foreground',
};

function BadgeEstado({ estado, label }: { estado: string; label: string }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${ESTADO_BADGE[estado] ?? 'bg-muted text-muted-foreground'}`}>
            {label}
        </span>
    );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ActasTallerIndex({ actas, vehiculos, filters }: Props) {
    const [placa,  setPlaca]  = useState(filters.placa  ?? '');
    const [estado, setEstado] = useState(filters.estado ?? '');
    const [desde,  setDesde]  = useState(filters.desde  ?? '');
    const [hasta,  setHasta]  = useState(filters.hasta  ?? '');
    const [confirmId, setConfirmId] = useState<number | null>(null);

    // Flash de éxito tras crear o eliminar
    const { props } = usePage<{ flash?: { status?: string } }>();
    const flashStatus = (props as any).flash?.status ?? (props as any).status ?? null;
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    useEffect(() => {
        if (flashStatus) setSuccessMsg(flashStatus);
    }, [flashStatus]);

    const aplicar = (overrides: Partial<typeof filters> = {}) => {
        router.get(route('flota.actas-taller.index'), {
            placa:  overrides.placa  ?? placa,
            estado: overrides.estado ?? estado,
            desde:  overrides.desde  ?? desde,
            hasta:  overrides.hasta  ?? hasta,
        }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const limpiar = () => {
        setPlaca(''); setEstado(''); setDesde(''); setHasta('');
        router.get(route('flota.actas-taller.index'), {}, { preserveState: false });
    };

    const hayFiltros = placa || estado || desde || hasta;

    const exportUrl = (ruta: string) =>
        route(ruta, { placa, estado, desde, hasta });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Actas de Taller" />
            <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6">

                {/* Banner éxito */}
                {successMsg && (
                    <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-3 dark:border-green-800/40 dark:bg-green-900/10">
                        <CheckCircle2 className="size-5 shrink-0 text-green-700" />
                        <p className="flex-1 text-sm font-semibold text-green-800 dark:text-green-300">{successMsg}</p>
                        <button type="button" onClick={() => setSuccessMsg(null)}
                            className="text-green-400 hover:text-green-600 transition-colors">
                            <XCircle className="size-4" />
                        </button>
                    </div>
                )}

                {/* Título */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                            Actas de Entrega a Taller
                        </h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Gestión de mantenimiento de vehículos · {actas.total} actas registradas
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild className="gap-1.5">
                            <Link href={route('flota.actas-taller.dashboard')}>
                                <BarChart3 className="size-4" /> Dashboard
                            </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild className="gap-1.5">
                            <a href={exportUrl('flota.actas-taller.exportar-excel')}>
                                <FileSpreadsheet className="size-4" /> Excel
                            </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild className="gap-1.5">
                            <a href={exportUrl('flota.actas-taller.exportar-pdf')}>
                                <FileText className="size-4" /> PDF lista
                            </a>
                        </Button>
                        <Button size="sm" asChild className="gap-1.5 bg-green-700 hover:bg-green-800 text-white">
                            <Link href={route('flota.actas-taller.create')}>
                                <Plus className="size-4" /> Nueva Acta
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Filtros */}
                <div className="rounded-2xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border p-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Placa</Label>
                            <select value={placa} onChange={e => { setPlaca(e.target.value); aplicar({ placa: e.target.value }); }}
                                className="h-8 rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                                <option value="">Todas las placas</option>
                                {vehiculos.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Estado</Label>
                            <select value={estado} onChange={e => { setEstado(e.target.value); aplicar({ estado: e.target.value }); }}
                                className="h-8 rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                                <option value="">Todos los estados</option>
                                <option value="en_taller">En taller</option>
                                <option value="cerrada">Cerrada</option>
                                <option value="cancelada">Cancelada</option>
                            </select>
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Desde</Label>
                            <Input type="date" value={desde} className="h-8 text-xs"
                                onChange={e => { setDesde(e.target.value); aplicar({ desde: e.target.value }); }} />
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Hasta</Label>
                            <Input type="date" value={hasta} className="h-8 text-xs"
                                onChange={e => { setHasta(e.target.value); aplicar({ hasta: e.target.value }); }} />
                        </div>
                    </div>
                    {hayFiltros && (
                        <div className="mt-2 flex justify-end">
                            <Button variant="ghost" size="sm" onClick={limpiar} className="h-7 text-xs text-muted-foreground gap-1">
                                <X className="size-3" /> Limpiar filtros
                            </Button>
                        </div>
                    )}
                </div>

                {/* Tabla */}
                <div className="rounded-2xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted dark:bg-muted">
                                    <TableHead className="text-[11px] font-semibold text-green-700 dark:text-green-400">Nº Acta</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-green-700 dark:text-green-400">Placa</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-green-700 dark:text-green-400">Taller</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-green-700 dark:text-green-400">Motivo</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-green-700 dark:text-green-400">Entrega</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-green-700 dark:text-green-400">Cierre</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-green-700 dark:text-green-400">Estado</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-green-700 dark:text-green-400">Novedades</TableHead>
                                    <TableHead className="text-[11px] font-semibold text-green-700 dark:text-green-400 text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {actas.data.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                                            <ClipboardList className="mx-auto mb-2 size-6 text-muted-foreground/60" />
                                            No hay actas registradas
                                        </TableCell>
                                    </TableRow>
                                )}
                                {actas.data.map(acta => (
                                    <TableRow key={acta.id} className="hover:bg-muted/50 transition-colors">
                                        <TableCell className="text-xs font-mono font-bold text-green-700 dark:text-green-400">
                                            {acta.numero_acta}
                                        </TableCell>
                                        <TableCell className="text-xs font-mono font-semibold text-foreground">
                                            {acta.placa}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                                            {acta.taller ?? '—'}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                                            {acta.motivo_ingreso ?? '—'}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                            {acta.fecha_entrega ?? '—'}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                            {acta.fecha_cierre ?? '—'}
                                        </TableCell>
                                        <TableCell>
                                            <BadgeEstado estado={acta.estado_acta} label={acta.estado_label} />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs tabular-nums text-muted-foreground">{acta.total_novedades}</span>
                                                {acta.novedades_solucionadas > 0 && (
                                                    <span className="inline-flex items-center gap-0.5 text-[10px] text-green-700 dark:text-green-400">
                                                        <CheckCircle2 className="size-3" />{acta.novedades_solucionadas}
                                                    </span>
                                                )}
                                                {acta.novedades_pendientes > 0 && (
                                                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                                        {acta.novedades_pendientes} pend.
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0">
                                                    <Link href={route('flota.actas-taller.show', acta.id)}>
                                                        <Eye className="size-4 text-muted-foreground hover:text-green-700" />
                                                    </Link>
                                                </Button>
                                                {confirmId === acta.id ? (
                                                    <span className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => router.delete(route('flota.actas-taller.destroy', acta.id))}
                                                            className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors">
                                                            Confirmar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setConfirmId(null)}
                                                            className="text-muted-foreground hover:text-foreground transition-colors">
                                                            <X className="size-3.5" />
                                                        </button>
                                                    </span>
                                                ) : (
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                                        onClick={() => setConfirmId(acta.id)}>
                                                        <Trash2 className="size-4 text-muted-foreground/60 hover:text-red-500 transition-colors" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Paginación */}
                    {actas.last_page > 1 && (
                        <div className="flex items-center justify-between border-t border-sidebar-border/70 px-4 py-3 dark:border-sidebar-border">
                            <p className="text-[11px] text-muted-foreground">
                                Página {actas.current_page} de {actas.last_page} · {actas.total} actas
                            </p>
                            <div className="flex gap-1">
                                {actas.current_page > 1 && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                                        onClick={() => router.get(route('flota.actas-taller.index'), { ...filters, page: actas.current_page - 1 })}>
                                        ‹ Anterior
                                    </Button>
                                )}
                                {actas.current_page < actas.last_page && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                                        onClick={() => router.get(route('flota.actas-taller.index'), { ...filters, page: actas.current_page + 1 })}>
                                        Siguiente ›
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
