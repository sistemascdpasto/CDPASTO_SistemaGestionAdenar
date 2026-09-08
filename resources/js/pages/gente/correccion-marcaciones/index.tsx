import HeadingSmall from '@/components/heading-small';
import { KpiCard, KpiCardGrid } from '@/components/kpi-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    BarChart2,
    Calendar,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    Download,
    FileSpreadsheet,
    LoaderCircle,
    Search,
    Trash2,
    Upload,
    UserCheck,
    Users,
    XCircle,
} from 'lucide-react';
import { FormEventHandler, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'Corrección de Marcaciones', href: '/modules/gente/correccion-marcaciones' },
];

// Paleta de colores de Gente + semáforo validado por daltonismo
const ACCENT = '#E3A11E';
const COLOR_SUCCESS = '#3F7A22';
const COLOR_WARNING = '#fab219';
const COLOR_ERROR   = '#d03b3b';

// ─────────── Tipos ─────────────────────────────────────────────────────────

interface RegistroRow {
    id: number;
    identificacion: string;
    fecha: string;
    hora: string | null;
    tipo: string | null;
    centro_costo: string | null;
    comentario: string | null;
    nombre_completo: string | null;
    cargo: string | null;
    colaborador_encontrado: boolean;
    error_validacion: string | null;
    created_at: string;
}

interface PreviewRow {
    numero_fila: number;
    identificacion: string;
    fecha: string | null;
    hora: string | null;
    tipo: string | null;
    centro_costo: string | null;
    comentario: string | null;
    nombre_completo: string | null;
    cargo: string | null;
    colaborador_encontrado: boolean;
    error_validacion: string | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface RegistrosPaginator {
    data: RegistroRow[];
    links: PaginationLink[];
    total: number;
    current_page: number;
    per_page: number;
    from: number | null;
    to: number | null;
}

interface Indicadores {
    total_registros: number;
    colaboradores_unicos: number;
    encontrados_count: number;
    no_encontrados_count: number;
    con_errores_count: number;
    tipos_unicos: number;
    centros_unicos: number;
}

interface PorFecha {
    fecha: string;
    total: number;
}

interface Catalogos {
    identificaciones: string[];
    nombres: string[];
    cargos: string[];
    tipos: string[];
    centros_costo: string[];
}

interface PageProps {
    data: RegistrosPaginator;
    indicadores: Indicadores;
    totales_por_fecha: PorFecha[];
    catalogos: Catalogos;
    filters: Record<string, any>;
    hay_datos: boolean;
}

type FlashStatus = { message: string; type: 'success' | 'error' | 'info' } | undefined;

// ─────────── Helpers ───────────────────────────────────────────────────────

function safeFormatNumber(n: number | null | undefined): string {
    const v = Number(n ?? 0);
    if (Number.isNaN(v)) return '0';
    return v.toLocaleString('es-CO');
}

function pct(numerador: number, denominador: number): number {
    if (!denominador) return 0;
    return Math.round((numerador / denominador) * 100);
}

// ─────────── Vista ──────────────────────────────────────────────────────────

export default function CorreccionMarcacionesIndex() {
    const { props } = usePage<{ flash?: { status?: FlashStatus } } & PageProps>();
    const { data, indicadores, totales_por_fecha, catalogos, filters, hay_datos } = props;

    // ── Estado de filtros (actualización inmediata al cambiar) ─────────────
    const [fechaDesde, setFechaDesde] = useState<string>(filters?.fecha_desde ?? '');
    const [fechaHasta, setFechaHasta] = useState<string>(filters?.fecha_hasta ?? '');
    const [buscarIdent, setBuscarIdent]  = useState<string>(Array.isArray(filters?.identificacion) ? filters.identificacion.join(',') : (filters?.identificacion ?? ''));
    const [buscarNombre, setBuscarNombre] = useState<string>(Array.isArray(filters?.nombre_completo) ? filters.nombre_completo.join(',') : (filters?.nombre_completo ?? ''));
    const [filtroCargo, setFiltroCargo]   = useState<string>(filters?.cargo ?? '');
    const [filtroTipo, setFiltroTipo]     = useState<string>(filters?.tipo ?? '');
    const [filtroCentro, setFiltroCentro] = useState<string>(filters?.centro_costo ?? '');
    const [filtroEstadoVal, setFiltroEstadoVal] = useState<string>(filters?.estado_validacion ?? '');

    // Mensaje flash
    const [flashMsg, setFlashMsg] = useState<FlashStatus>(props.flash?.status);
    useEffect(() => {
        if (props.flash?.status) {
            setFlashMsg(props.flash.status);
            const t = setTimeout(() => setFlashMsg(undefined), 7000);
            return () => clearTimeout(t);
        }
    }, [props.flash?.status?.message]);

    // Aplicar filtros de inmediato (router.get)
    const aplicarFiltros = useMemo(
        () => debounce((override?: Partial<Record<string, any>>) => {
            const q: Record<string, any> = {
                fecha_desde: fechaDesde || '',
                fecha_hasta: fechaHasta || '',
                identificacion: buscarIdent || '',
                nombre_completo: buscarNombre || '',
                cargo: filtroCargo === 'todos' ? '' : filtroCargo,
                tipo: filtroTipo === 'todos' ? '' : filtroTipo,
                centro_costo: filtroCentro === 'todos' ? '' : filtroCentro,
                estado_validacion: filtroEstadoVal === 'todos' ? '' : filtroEstadoVal,
                ...(override ?? {}),
            };
            router.get(route('gente.correccion-marcaciones.index'), q, {
                preserveState: true,
                replace: true,
                only: ['data', 'indicadores', 'totales_por_fecha', 'catalogos', 'hay_datos'],
            });
        }, 400),
        [fechaDesde, fechaHasta, buscarIdent, buscarNombre, filtroCargo, filtroTipo, filtroCentro, filtroEstadoVal]
    );

    useEffect(() => { aplicarFiltros(); }, [aplicarFiltros]);

    const limpiarFiltros = () => {
        setFechaDesde(''); setFechaHasta('');
        setBuscarIdent(''); setBuscarNombre('');
        setFiltroCargo(''); setFiltroTipo(''); setFiltroCentro('');
        setFiltroEstadoVal('');
        router.get(route('gente.correccion-marcaciones.index'), {}, { preserveState: true, replace: true });
    };

    // ── Subida / Preview / Confirmación ────────────────────────────────────
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [subiendo, setSubiendo] = useState(false);
    const [previewDialog, setPreviewDialog] = useState(false);
    const [archivoTemporal, setArchivoTemporal] = useState<string | null>(null);
    const [previewResumen, setPreviewResumen] = useState<{
        ok: boolean;
        total_filas?: number;
        encontrados?: number;
        no_encontrados?: number;
        errores?: number;
        validas?: number;
        identificaciones_unicas?: number;
        error?: string;
    } | null>(null);

    const procesarArchivo = async (file: File) => {
        console.log('[CorreccionMarcaciones] Procesando archivo:', file.name, file.size);
        const form = new FormData();
        form.append('archivo_excel', file);
        setSubiendo(true);
        try {
            const res = await fetch(route('gente.correccion-marcaciones.preview'), {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content ?? '',
                    'Accept': 'application/json',
                },
                body: form,
                credentials: 'same-origin',
            });
            const json = await res.json();
            console.log('[CorreccionMarcaciones] Preview:', json);
            setPreviewResumen({
                ok: !!json.ok,
                total_filas: json.total_filas,
                encontrados: json.encontrados,
                no_encontrados: json.no_encontrados,
                errores: json.errores,
                validas: json.validas ?? 0,
                identificaciones_unicas: json.identificaciones_unicas,
                error: json.error,
            });
            if (json.ok && json.archivo_temporal) {
                setArchivoTemporal(json.archivo_temporal);
            } else {
                setArchivoTemporal(null);
            }
            setPreviewDialog(true);
        } catch (err: any) {
            console.error('[CorreccionMarcaciones] error preview:', err);
            setPreviewResumen({
                ok: false,
                error: err?.message ?? 'Error al procesar el archivo.',
            });
            setPreviewDialog(true);
        } finally {
            setSubiendo(false);
        }
    };

    const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) procesarArchivo(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const confirmarImportacion = () => {
        if (!archivoTemporal) return;
        router.post(
            route('gente.correccion-marcaciones.importar'),
            { archivo_temporal: archivoTemporal },
            { preserveScroll: true }
        );
        setPreviewDialog(false);
    };

    // ── Eliminar / Limpiar confirmación ────────────────────────────────────
    const [idAEliminar, setIdAEliminar] = useState<number | null>(null);
    const [confirmLimpiar, setConfirmLimpiar] = useState(false);

    // ── Datos gráfica ──────────────────────────────────────────────────────
    const dataGrafico = useMemo(() => (totales_por_fecha ?? []).map(r => ({
        fecha: r.fecha ? r.fecha.slice(5) : '',
        Registros: r.total ?? 0,
    })), [totales_por_fecha]);

    const pctEncontrados = pct(indicadores.encontrados_count, indicadores.total_registros);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Corrección de Marcaciones — Gente" />
            <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6 max-w-7xl mx-auto w-full">

                {/* ───── Cabecera ───── */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <HeadingSmall
                        title="Corrección de Marcaciones"
                        description="Carga masiva de novedades de marcación (Entrada/Salida). Las identificaciones se validan contra la tabla de colaboradores y se traen Nombre y Cargo automáticamente."
                    />
                    <div className="flex flex-wrap gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={onFileInput}
                        />
                        <Button
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={subiendo}
                            className="gap-1.5"
                            style={{ backgroundColor: ACCENT }}
                        >
                            {subiendo
                                ? <LoaderCircle className="size-4 animate-spin" />
                                : <Upload className="size-4" />}
                            Subir Excel
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <Link href={route('gente.correccion-marcaciones.plantilla')}>
                                <FileSpreadsheet className="mr-1.5 size-4" /> Descargar Plantilla
                            </Link>
                        </Button>
                        {hay_datos && (
                            <>
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={
                                        route('gente.correccion-marcaciones.exportar') +
                                        '?' + new URLSearchParams({
                                            fecha_desde: fechaDesde,
                                            fecha_hasta: fechaHasta,
                                            identificacion: buscarIdent,
                                            nombre_completo: buscarNombre,
                                            cargo: filtroCargo,
                                            tipo: filtroTipo,
                                            centro_costo: filtroCentro,
                                            estado_validacion: filtroEstadoVal,
                                        }).toString()
                                    }>
                                        <Download className="mr-1.5 size-4" /> Exportar CSV
                                    </Link>
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => setConfirmLimpiar(true)} className="gap-1.5">
                                    <Trash2 className="size-4" /> Limpiar
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* ───── Mensaje flash ───── */}
                {flashMsg && (
                    <div
                        role="alert"
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm shadow-sm ${
                            flashMsg.type === 'success'
                                ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200'
                                : flashMsg.type === 'error'
                                ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200'
                                : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200'
                        }`}
                    >
                        <span className="font-medium">{flashMsg.message}</span>
                        <button className="ml-4 opacity-70 hover:opacity-100" onClick={() => setFlashMsg(undefined)} aria-label="Cerrar"><XCircle className="size-4" /></button>
                    </div>
                )}

                {/* ───── KPI Cards ───── */}
                <KpiCardGrid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    <KpiCard
                        label="Total Registros"
                        value={safeFormatNumber(indicadores.total_registros)}
                        icon={BarChart2}
                        color={ACCENT}
                    />
                    <KpiCard
                        label="Colaboradores Únicos"
                        value={safeFormatNumber(indicadores.colaboradores_unicos)}
                        icon={Users}
                        color="#2B6CB0"
                    />
                    <KpiCard
                        label={`Colabor. Encontrados (${pctEncontrados}%)`}
                        value={safeFormatNumber(indicadores.encontrados_count)}
                        icon={UserCheck}
                        color={COLOR_SUCCESS}
                        secondaryText={`Meta: > 95% · ${safeFormatNumber(indicadores.encontrados_count)} / ${safeFormatNumber(indicadores.total_registros)}`}
                    />
                    <KpiCard
                        label="No Encontrados / Con Error"
                        value={`${safeFormatNumber(indicadores.no_encontrados_count)} / ${safeFormatNumber(indicadores.con_errores_count)}`}
                        icon={AlertTriangle}
                        color={COLOR_ERROR}
                        secondaryText="Revisa la cédula y que el colaborador esté registrado."
                    />
                </KpiCardGrid>

                {/* ───── Gráfico ───── */}
                <Card className="border-sidebar-border/70 shadow-sm flex flex-col">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <BarChart2 className="size-4" style={{ color: ACCENT }} /> Registros por Fecha
                        </CardTitle>
                        <Badge variant="secondary" className="text-[11px] font-semibold">
                            {dataGrafico.length} días con datos
                        </Badge>
                    </CardHeader>
                    <CardContent className="flex-1">
                        {!hay_datos || dataGrafico.length === 0 ? (
                            <div className="h-56 flex flex-col items-center justify-center text-xs text-muted-foreground">
                                <FileSpreadsheet className="size-10 mb-2 opacity-60" />
                                Aún no hay registros. Usa el botón «Subir Excel» de la cabecera para cargar correcciones.
                            </div>
                        ) : (
                            <div className="h-56 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dataGrafico} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                                        <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'var(--popover)',
                                                borderColor: 'var(--border)',
                                                borderRadius: 8,
                                                fontSize: 12,
                                            }}
                                        />
                                        <Bar dataKey="Registros" fill={ACCENT} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ───── Filtros ───── */}
                <Card className="border-sidebar-border/70 shadow-sm">
                    <CardContent className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                    <Calendar className="size-3.5" /> Fecha Desde
                                </Label>
                                <Input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="h-9 text-xs" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                    <Calendar className="size-3.5" /> Fecha Hasta
                                </Label>
                                <Input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="h-9 text-xs" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                    <Search className="size-3.5" /> Identificación
                                </Label>
                                <Input
                                    placeholder="Cédula / documento"
                                    value={buscarIdent}
                                    onChange={e => setBuscarIdent(e.target.value)}
                                    className="h-9 text-xs"
                                    list="cm-list-ident"
                                />
                                <datalist id="cm-list-ident">
                                    {(catalogos?.identificaciones ?? []).slice(0, 200).map(v => (
                                        <option key={v} value={v} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                    <UserCheck className="size-3.5" /> Nombre Colaborador
                                </Label>
                                <Input
                                    placeholder="Nombre completo"
                                    value={buscarNombre}
                                    onChange={e => setBuscarNombre(e.target.value)}
                                    className="h-9 text-xs"
                                    list="cm-list-nombres"
                                />
                                <datalist id="cm-list-nombres">
                                    {(catalogos?.nombres ?? []).slice(0, 200).map(v => (
                                        <option key={v} value={v} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-muted-foreground">Cargo</Label>
                                <Select value={filtroCargo || 'todos'} onValueChange={setFiltroCargo}>
                                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todos los cargos" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos los cargos</SelectItem>
                                        {(catalogos?.cargos ?? []).map(v => (
                                            <SelectItem key={v} value={v}>{v}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                    <Clock className="size-3.5" /> Tipo Marcación
                                </Label>
                                <Select value={filtroTipo || 'todos'} onValueChange={setFiltroTipo}>
                                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todos los tipos" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos los tipos</SelectItem>
                                        {(catalogos?.tipos ?? []).map(v => (
                                            <SelectItem key={v} value={v}>{v}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-muted-foreground">Centro de Costo</Label>
                                <Select value={filtroCentro || 'todos'} onValueChange={setFiltroCentro}>
                                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todos los centros" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos los centros</SelectItem>
                                        {(catalogos?.centros_costo ?? []).map(v => (
                                            <SelectItem key={v} value={v}>{v}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={limpiarFiltros}
                                    className="h-9 flex-1 text-xs"
                                >
                                    Limpiar
                                </Button>
                                <Select value={filtroEstadoVal || 'todos'} onValueChange={setFiltroEstadoVal}>
                                    <SelectTrigger className="h-9 text-xs min-w-[140px]">
                                        <SelectValue placeholder="Estado val." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos (Estado)</SelectItem>
                                        <SelectItem value="encontrado"><span className="mr-1.5 inline-block size-2 rounded-full bg-green-500 align-middle" />Encontrado</SelectItem>
                                        <SelectItem value="no_encontrado"><span className="mr-1.5 inline-block size-2 rounded-full bg-amber-500 align-middle" />No encontrado</SelectItem>
                                        <SelectItem value="con_error"><span className="mr-1.5 inline-block size-2 rounded-full bg-red-500 align-middle" />Con error</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ───── Tabla Registros ───── */}
                <Card className="border-sidebar-border/70 shadow-sm">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <FileSpreadsheet className="size-4" style={{ color: ACCENT }} /> Registros ({safeFormatNumber(data.total)})
                        </CardTitle>
                        <Badge variant="outline" className="text-[11px]">
                            {data.from && data.to ? `Mostrando ${data.from} – ${data.to}` : '—'}
                        </Badge>
                    </CardHeader>
                    <CardContent className="pt-1">
                        <div className="rounded-lg border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="whitespace-nowrap">Identificación</TableHead>
                                        <TableHead className="whitespace-nowrap">Nombre Completo</TableHead>
                                        <TableHead className="whitespace-nowrap">Cargo</TableHead>
                                        <TableHead className="whitespace-nowrap">Fecha</TableHead>
                                        <TableHead className="whitespace-nowrap">Hora</TableHead>
                                        <TableHead className="whitespace-nowrap">Tipo</TableHead>
                                        <TableHead className="whitespace-nowrap">Centro Costo</TableHead>
                                        <TableHead className="whitespace-nowrap min-w-[180px]">Comentario</TableHead>
                                        <TableHead className="whitespace-nowrap text-center">Validación</TableHead>
                                        <TableHead className="whitespace-nowrap text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(!Array.isArray(data.data) || data.data.length === 0) ? (
                                        <TableRow>
                                            <TableCell colSpan={10} className="py-10 text-center">
                                                <div className="flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                                                    <FileSpreadsheet className="size-8 opacity-60" />
                                                    <p>{hay_datos ? 'No hay registros para los filtros seleccionados.' : 'No hay registros aún. Sube un archivo Excel para comenzar.'}</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        data.data.map(r => (
                                            <TableRow key={r.id}>
                                                <TableCell className="font-mono text-sm">{r.identificacion}</TableCell>
                                                <TableCell className="text-sm">{r.nombre_completo ?? <span className="text-muted-foreground italic">—</span>}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{r.cargo ?? '—'}</TableCell>
                                                <TableCell className="whitespace-nowrap text-xs">{r.fecha}</TableCell>
                                                <TableCell className="whitespace-nowrap text-xs font-mono">{r.hora ?? '—'}</TableCell>
                                                <TableCell className="text-xs">
                                                    {r.tipo
                                                        ? <Badge variant="outline" className="text-[11px]">{r.tipo}</Badge>
                                                        : <span className="text-muted-foreground">—</span>}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{r.centro_costo ?? '—'}</TableCell>
                                                <TableCell className="text-xs max-w-[280px] truncate" title={r.comentario ?? ''}>
                                                    {r.comentario ?? <span className="text-muted-foreground italic">—</span>}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {r.error_validacion
                                                        ? <Badge className="text-[10px]" style={{ backgroundColor: `${COLOR_ERROR}1a`, color: COLOR_ERROR, borderColor: `${COLOR_ERROR}4d` }} title={r.error_validacion}>
                                                              <XCircle className="size-3 mr-1" /> Error
                                                          </Badge>
                                                        : r.colaborador_encontrado
                                                        ? <Badge className="text-[10px]" style={{ backgroundColor: `${COLOR_SUCCESS}1a`, color: COLOR_SUCCESS, borderColor: `${COLOR_SUCCESS}4d` }}>
                                                              <CheckCircle2 className="size-3 mr-1" /> OK
                                                          </Badge>
                                                        : <Badge className="text-[10px]" style={{ backgroundColor: `${COLOR_WARNING}1a`, color: COLOR_WARNING, borderColor: `${COLOR_WARNING}4d` }}>
                                                              <AlertTriangle className="size-3 mr-1" /> No encontr.
                                                          </Badge>}
                                                </TableCell>
                                                <TableCell className="text-right whitespace-nowrap">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setIdAEliminar(r.id)}
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Paginación */}
                        {Array.isArray(data.links) && data.links.length > 1 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
                                <p className="text-[11px] text-muted-foreground">
                                    Página {data.current_page} de {Math.max(1, Math.ceil(data.total / (data.per_page || 1)))} · Total {safeFormatNumber(data.total)}
                                </p>
                                <div className="flex items-center gap-1">
                                    {data.links.map((l, idx) => {
                                        const label = l.label;
                                        const isPrev = /anterior|prev|«/i.test(label);
                                        const isNext = /siguiente|next|»/i.test(label);
                                        if (l.url === null) {
                                            return (
                                                <Button key={idx} size="sm" variant="outline" disabled className="h-8 px-3 text-xs opacity-60">
                                                    {isPrev ? <ChevronLeft className="size-4" /> : isNext ? <ChevronRight className="size-4" /> : label.replace(/&laquo;|Previous|&raquo;|Next/gi, '')}
                                                </Button>
                                            );
                                        }
                                        return (
                                            <Button
                                                key={idx}
                                                size="sm"
                                                variant={l.active ? 'default' : 'outline'}
                                                onClick={() => router.get(l.url, {}, { preserveState: true, replace: true })}
                                                className={`h-8 px-3 text-xs min-w-[32px] ${l.active ? '' : 'font-normal'}`}
                                            >
                                                {isPrev ? <ChevronLeft className="size-4" /> : isNext ? <ChevronRight className="size-4" /> : (
                                                    <span dangerouslySetInnerHTML={{ __html: label }} />
                                                )}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ══════════════════════ DIALOGOS ══════════════════════ */}

            {/* ───── Dialog Preview compacto ───── */}
            <Dialog open={previewDialog} onOpenChange={setPreviewDialog}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <FileSpreadsheet className="size-5" style={{ color: ACCENT }} />
                            Resultado de la Carga
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Solo se guardarán las filas válidas con identificación encontrada en colaboradores.
                        </DialogDescription>
                    </DialogHeader>

                    {previewResumen?.ok === false && previewResumen.error && (
                        <div className="mb-2 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900/40 px-4 py-3 text-sm text-red-700 dark:text-red-200">
                            <b>{previewResumen.error}</b>
                        </div>
                    )}

                    {previewResumen?.ok && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="rounded-xl border p-3 bg-muted/20">
                                <p className="text-[10px] font-bold text-muted-foreground">Filas subidas</p>
                                <p className="text-xl font-extrabold">{safeFormatNumber(previewResumen.total_filas ?? 0)}</p>
                            </div>
                            <div className="rounded-xl border p-3 bg-muted/20">
                                <p className="text-[10px] font-bold text-muted-foreground">Identificaciones únicas</p>
                                <p className="text-xl font-extrabold">{safeFormatNumber(previewResumen.identificaciones_unicas ?? 0)}</p>
                            </div>
                            <div className="rounded-xl border p-3 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/40">
                                <p className="text-[10px] font-bold" style={{ color: COLOR_SUCCESS }}>Válidas (guardarán)</p>
                                <p className="text-xl font-extrabold" style={{ color: COLOR_SUCCESS }}>
                                    {safeFormatNumber(previewResumen.validas ?? 0)}
                                </p>
                            </div>
                            <div className="rounded-xl border p-3 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40">
                                <p className="text-[10px] font-bold" style={{ color: COLOR_WARNING }}>No encontradas</p>
                                <p className="text-xl font-extrabold" style={{ color: COLOR_WARNING }}>{safeFormatNumber(previewResumen.no_encontrados ?? 0)}</p>
                            </div>
                            <div className="rounded-xl border p-3 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40">
                                <p className="text-[10px] font-bold" style={{ color: COLOR_ERROR }}>Con errores</p>
                                <p className="text-xl font-extrabold" style={{ color: COLOR_ERROR }}>{safeFormatNumber(previewResumen.errores ?? 0)}</p>
                            </div>
                            <div className="rounded-xl border p-3 bg-muted/10 flex flex-col justify-center">
                                <p className="text-[10px] font-bold text-muted-foreground mb-1">Archivo</p>
                                <p className="text-[11px] text-muted-foreground leading-tight">
                                    Nombre + Cargo se completan automáticamente desde la tabla de colaboradores.
                                </p>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="mt-2 sm:flex-col-reverse sm:items-stretch">
                        {previewResumen?.ok && (previewResumen.validas ?? 0) <= 0 && (
                            <div className="w-full rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-200 flex items-start gap-2">
                                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                                <span>
                                    No hay filas válidas para guardar. Revisa:
                                    <ul className="list-disc ml-4 mt-1 space-y-0.5">
                                        {(previewResumen.no_encontrados ?? 0) > 0 && (
                                            <li>{previewResumen.no_encontrados} identificación(es) no registrada(s) en colaboradores.</li>
                                        )}
                                        {(previewResumen.errores ?? 0) > 0 && (
                                            <li>{previewResumen.errores} error(es) de validación (fecha inválida o cédula vacía).</li>
                                        )}
                                    </ul>
                                </span>
                            </div>
                        )}
                        {!previewResumen?.ok && previewResumen?.error && (
                            <div className="w-full rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/40 px-3 py-2 text-[11px] text-red-700 dark:text-red-200 flex items-start gap-2">
                                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                                <span>No se puede guardar: {previewResumen.error}</span>
                            </div>
                        )}
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 w-full">
                            <DialogClose asChild>
                                <Button variant="outline" size="sm">Cancelar</Button>
                            </DialogClose>
                            <Button
                                type="button"
                                size="sm"
                                className="gap-1.5"
                                style={{
                                    backgroundColor: (previewResumen?.ok && archivoTemporal && (previewResumen.validas ?? 0) > 0) ? COLOR_SUCCESS : undefined,
                                }}
                                disabled={!previewResumen?.ok || !archivoTemporal || (previewResumen.validas ?? 0) <= 0}
                                onClick={confirmarImportacion}
                            >
                                <CheckCircle2 className="size-4" /> Guardar ({safeFormatNumber(previewResumen?.validas ?? 0)})
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ───── Confirmar Eliminar 1 registro ───── */}
            <AlertDialog open={idAEliminar !== null} onOpenChange={(o) => { if (!o) setIdAEliminar(null); }}>
                <form
                    action={route('gente.correccion-marcaciones.destroy', idAEliminar ?? 0)}
                    method="POST"
                >
                    <input type="hidden" name="_method" value="DELETE" />
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel type="button" onClick={() => setIdAEliminar(null)}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction asChild>
                                <Button variant="destructive" type="submit" size="sm">
                                    Sí, eliminar
                                </Button>
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </form>
            </AlertDialog>

            {/* ───── Confirmar Limpiar todo ───── */}
            <AlertDialog open={confirmLimpiar} onOpenChange={setConfirmLimpiar}>
                <form action={route('gente.correccion-marcaciones.limpiar')} method="POST">
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Limpiar TODOS los registros?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Se borrarán todas las correcciones de marcaciones almacenadas. Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
                            <AlertDialogAction asChild>
                                <Button variant="destructive" type="submit" size="sm">
                                    Sí, limpiar todo
                                </Button>
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </form>
            </AlertDialog>
        </AppLayout>
    );
}

// ─────────── Utilidades internas ───────────────────────────────────────────

function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
    let t: ReturnType<typeof setTimeout> | null = null;
    return function (this: any, ...args: Parameters<T>) {
        if (t) clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), delay);
    };
}
