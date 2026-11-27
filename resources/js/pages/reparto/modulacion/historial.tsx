import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Calendar, ChevronDown, Eye, FileSpreadsheet, FileText, Filter, MapPinned, Pencil, Trash2, Truck, X } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx-js-style';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Historial de Planeaciones', href: '/modules/reparto/modulacion-historial' },
];

const CENTROS = ['UC', 'UD'] as const;

interface RutaDetalle {
    id: number;
    placa: string;
    doc_tras: string;
    responsable: string;
    destino: string;
    municipio?: string;
    barrio?: string;
    destinos?: { municipio: string; barrio: string }[];
    cliente: string;
    peso: string;
    centro?: string; // opcional: si el backend lo envía, se valida
}

interface Planeacion {
    id: number;
    fecha: string;
    ud_programado_por: string | null;
    despachado_por_nombre: string | null;
    total_rutas: number;
    total_tripulantes: number;
    placas: string[];
    rutas_detalle?: RutaDetalle[];
    centro?: string; // opcional: si el backend lo envía, se valida
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
    placas_disponibles?: string[];
    filters: {
        fecha_desde: string;
        fecha_hasta: string;
        placa: string;
        centro: string;
        doc_transporte: string;
    };
}

type Filters = {
    fecha_desde: string;
    fecha_hasta: string;
    placa: string;
    centro: string;
    doc_transporte: string;
};

function formatFecha(fecha: string) {
    const [y, m, d] = fecha.split('-');
    return `${d}/${m}/${y}`;
}

function getDiaSemana(fecha: string) {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long' });
}

// ─── Estilos Excel (constantes fuera del componente) ─────────────
const BORDER_THIN = {
    top: { style: 'thin' as const, color: { rgb: '000000' } },
    bottom: { style: 'thin' as const, color: { rgb: '000000' } },
    left: { style: 'thin' as const, color: { rgb: '000000' } },
    right: { style: 'thin' as const, color: { rgb: '000000' } },
};

const HEADER_STYLE = {
    font: { bold: true, name: 'Calibri', sz: 11, color: { rgb: '000000' } },
    fill: { fgColor: { rgb: 'BDD7EE' } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
    border: BORDER_THIN,
};

const BODY_STYLE = (horizontal: 'left' | 'center') => ({
    font: { name: 'Calibri', sz: 11, color: { rgb: '000000' } },
    alignment: { horizontal, vertical: 'center' as const },
    border: BORDER_THIN,
});

const BODY_STYLE_LEFT = BODY_STYLE('left');
const BODY_STYLE_CENTER = BODY_STYLE('center');
const CENTER_COLS = [0, 1, 2, 8];

const EXCEL_HEADERS = [
    'Fecha',
    'Placa',
    'Documento de Transporte',
    'Responsable',
    'Municipio',
    'Barrio',
    'Destino Completo',
    'Cliente',
    'Peso',
];

const EXCEL_COLS = [14, 14, 24, 28, 22, 25, 32, 25, 16].map((wch) => ({ wch }));

// ─── Columnas de detalle de ruta (configuración, sin JSX repetido) ─
const Vacio = () => <span className="text-muted-foreground/70">—</span>;

const COLUMNAS_RUTA: {
    render: (r: RutaDetalle) => ReactNode;
    title: (r: RutaDetalle) => string;
    className: string;
}[] = [
    {
        className: 'text-xs font-mono',
        title: (r) => r.doc_tras || '—',
        render: (r) => r.doc_tras || <Vacio />,
    },
    {
        className: 'text-xs font-medium',
        title: (r) => r.responsable || '—',
        render: (r) => r.responsable || <Vacio />,
    },
    {
        className: 'flex flex-col text-xs',
        title: (r) => r.destino || '—',
        render: (r) => (
            <>
                {r.municipio && (
                    <span className="font-semibold text-foreground flex items-center gap-1">
                        <span className="inline-block size-1.5 rounded-full bg-emerald-600 shrink-0" />
                        <span>{r.municipio}</span>
                    </span>
                )}
                <span className={r.municipio ? 'text-muted-foreground text-[11px]' : 'text-xs'}>
                    {r.barrio || r.destino || <Vacio />}
                </span>
            </>
        ),
    },
    {
        className: 'text-xs',
        title: (r) => r.cliente || '—',
        render: (r) => r.cliente || <Vacio />,
    },
    {
        className: 'text-xs',
        title: (r) => r.peso || '—',
        render: (r) => r.peso || <Vacio />,
    },
];

function ColumnaRutas({
    rutas,
    visibleRutas,
    columna,
}: {
    rutas: RutaDetalle[];
    visibleRutas: RutaDetalle[];
    columna: (typeof COLUMNAS_RUTA)[number];
}) {
    return (
        <TableCell className="align-top">
            <div className="flex flex-col gap-1.5">
                {rutas.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                ) : (
                    visibleRutas.map((r, idx) => (
                        <div key={idx} className={columna.className} title={columna.title(r)}>
                            {columna.render(r)}
                        </div>
                    ))
                )}
            </div>
        </TableCell>
    );
}

function PlacaComboboxFilter({
    value,
    onChange,
    placas,
}: {
    value: string;
    onChange: (val: string) => void;
    placas: string[];
}) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const filteredPlacas = placas.filter((p) => p.toLowerCase().includes(value.trim().toLowerCase()));

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative flex items-center">
                <Input
                    id="placa"
                    type="text"
                    placeholder="Escriba o seleccione placa..."
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value.toUpperCase());
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    className="font-mono uppercase pr-8"
                    autoComplete="off"
                />
                {value ? (
                    <button
                        type="button"
                        onClick={() => {
                            onChange('');
                            setOpen(false);
                        }}
                        className="absolute right-2.5 text-muted-foreground hover:text-foreground"
                    >
                        <X className="size-4" />
                    </button>
                ) : (
                    <ChevronDown className="absolute right-2.5 size-4 text-muted-foreground pointer-events-none" />
                )}
            </div>

            {open && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md text-popover-foreground">
                    {filteredPlacas.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                            {value.trim() ? `Sin coincidencias para "${value}"` : 'No hay placas registradas'}
                        </div>
                    ) : (
                        filteredPlacas.map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => {
                                    onChange(p);
                                    setOpen(false);
                                }}
                                className={`flex w-full items-center justify-between rounded-sm px-3 py-1.5 font-mono text-xs hover:bg-accent hover:text-accent-foreground ${
                                    value === p ? 'bg-accent/50 font-bold text-primary' : ''
                                }`}
                            >
                                <span>{p}</span>
                                {value === p && <span className="text-xs text-primary">✓</span>}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

export default function HistorialModulacion({ planeaciones, placas_disponibles = [], filters }: Props) {
    const [fechaDesde, setFechaDesde] = useState(filters.fecha_desde ?? '');
    const [fechaHasta, setFechaHasta] = useState(filters.fecha_hasta ?? '');
    const [placa, setPlaca] = useState(filters.placa ?? '');
    const [centro, setCentro] = useState(filters.centro ?? '');
    const [docTransporte, setDocTransporte] = useState(filters.doc_transporte ?? '');
    const [exportUrl, setExportUrl] = useState<string | null>(null);
    const [expandedRows, setExpandedRows] = useState<number[]>([]);

    const debouncedFechaDesde = useDebouncedValue(fechaDesde);
    const debouncedFechaHasta = useDebouncedValue(fechaHasta);
    const debouncedPlaca = useDebouncedValue(placa);
    const debouncedDocTransporte = useDebouncedValue(docTransporte);

    const isFirstRender = useRef(true);

    // ─── REGLA ÚNICA: todo parámetro/ruta/link lleva el centro activo ───
    const conCentro = <T extends object>(params: T = {} as T) => ({ ...params, centro });

    const rutaHistorial = (params: object = {}) => route('reparto.modulacion.historial', conCentro(params));
    const rutaModulacion = (params: object = {}) => route('reparto.modulacion.index', conCentro(params));

    // ─── Aislamiento de datos por centro (defensa en el cliente) ───
    const mismoCentro = (item: { centro?: string }) => !item.centro || item.centro === centro;
    const rutasDeCentro = (plan: Planeacion) => (plan.rutas_detalle ?? []).filter(mismoCentro);
    const planesVisibles = centro ? planeaciones.data.filter(mismoCentro) : [];

    const toggleExpandRow = (id: number) => {
        setExpandedRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]));
    };

    const applyFilters = (overrides: Partial<Filters>) => {
        router.get(
            route('reparto.modulacion.historial'),
            {
                fecha_desde: overrides.fecha_desde ?? debouncedFechaDesde,
                fecha_hasta: overrides.fecha_hasta ?? debouncedFechaHasta,
                placa: overrides.placa ?? debouncedPlaca,
                centro: overrides.centro ?? centro,
                doc_transporte: overrides.doc_transporte ?? debouncedDocTransporte,
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
    }, [debouncedFechaDesde, debouncedFechaHasta, debouncedPlaca, debouncedDocTransporte]);

    // El centro no se puede deseleccionar y al cambiarlo se reinicia todo lo dependiente de él
    const handleCentroChange = (newCentro: string) => {
        if (newCentro === centro) return;
        setCentro(newCentro);
        setPlaca('');
        setExpandedRows([]);
        applyFilters({ centro: newCentro, placa: '' });
    };

    // Limpiar NO borra el centro
    const handleClear = () => {
        setFechaDesde('');
        setFechaHasta('');
        setPlaca('');
        setDocTransporte('');
        router.get(rutaHistorial(), {}, { preserveState: false });
    };

    const handleDeleteModulacion = (id: number, fecha: string) => {
        if (confirm(`¿Está seguro de eliminar la planeación del ${formatFecha(fecha)}? Esta acción no se puede deshacer.`)) {
            router.delete(route('reparto.modulacion.destroy', id), {
                data: conCentro(),
                onSuccess: () => router.get(rutaHistorial(), {}, { preserveState: false }),
            });
        }
    };

    const handleExportExcel = (fecha: string) => {
        setExportUrl(
            rutaModulacion({
                fecha,
                readOnly: 'true',
                exportExcel: 'true',
                _export: Date.now(),
            }),
        );
    };

    const getFechaHoyStr = () => {
        const todayObj = new Date();
        const year = todayObj.getFullYear();
        const month = String(todayObj.getMonth() + 1).padStart(2, '0');
        const day = String(todayObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getPlaneacionesFiltradasOActuales = () => {
        const hasDateFilter = Boolean(fechaDesde || fechaHasta);
        const fechaHoy = getFechaHoyStr();
        return hasDateFilter ? planesVisibles : planesVisibles.filter((plan) => plan.fecha === fechaHoy);
    };

    const handleExportarExcelPorPlaca = () => {
        const dataAExportar = getPlaneacionesFiltradasOActuales();

        if (dataAExportar.length === 0) {
            alert(
                fechaDesde || fechaHasta
                    ? `No hay planeaciones de ${centro} en la tabla para exportar.`
                    : `No hay planeaciones de ${centro} registradas para el día de hoy (${formatFecha(getFechaHoyStr())}).`,
            );
            return;
        }

        const filaVacia = (fecha: string) => [formatFecha(fecha), 'Sin vehículo', '', '', '', '', '', '', ''];
        const filaRuta = (fecha: string, r: RutaDetalle) => [
            formatFecha(fecha),
            r.placa || '',
            r.doc_tras || '',
            r.responsable || '',
            r.municipio || '',
            r.barrio || '',
            r.destino || '',
            r.cliente || '',
            r.peso || '',
        ];

        const filas: (string | number)[][] = dataAExportar.flatMap((plan) => {
            const rutas = rutasDeCentro(plan);
            return rutas.length === 0 ? [filaVacia(plan.fecha)] : rutas.map((r) => filaRuta(plan.fecha, r));
        });

        const worksheet = XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, ...filas]);
        worksheet['!cols'] = EXCEL_COLS;

        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        const rowsInfo: { hpt: number }[] = [];

        for (let R = range.s.r; R <= range.e.r; ++R) {
            rowsInfo.push({ hpt: R === 0 ? 26 : 20 });

            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                worksheet[cellRef] = worksheet[cellRef] ?? { t: 's', v: '' };
                worksheet[cellRef].s = R === 0 ? HEADER_STYLE : CENTER_COLS.includes(C) ? BODY_STYLE_CENTER : BODY_STYLE_LEFT;
            }
        }

        worksheet['!rows'] = rowsInfo;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Reporte ${centro} por Placa`);
        const fechaArchivo = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `Reporte_Planeaciones_${centro}_Por_Placa_${fechaArchivo}.xlsx`);
    };

    // El centro es un contexto permanente, no un filtro "limpiable"
    const hasActiveFilters = Boolean(fechaDesde || fechaHasta || placa || docTransporte);

    const mensajeVacio = !centro
        ? 'Seleccione un centro (UC o UD) para ver las planeaciones.'
        : hasActiveFilters
          ? 'No se encontraron planeaciones con ese criterio de búsqueda.'
          : `No hay planeaciones registradas para ${centro} aún.`;

    const totalPlaneaciones = centro ? planeaciones.total : 0;
    const hasPlacaFilter = Boolean(placa.trim());

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Historial de Planeaciones de Ruta" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="rounded-2xl border border-border/70 bg-card px-8 py-6 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div
                                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm sm:h-16 sm:w-16"
                                style={{ background: 'linear-gradient(135deg, rgb(6, 78, 59) 0%, rgb(4, 120, 87) 60%, rgb(5, 150, 105) 100%)' }}
                            >
                                <Truck className="h-7 w-7 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                                    Historial de Planeaciones
                                </h1>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    {totalPlaneaciones} planeación{totalPlaneaciones !== 1 ? 'es' : ''} registrada{totalPlaneaciones !== 1 ? 's' : ''}.
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="outline" disabled={!centro} onClick={handleExportarExcelPorPlaca} className="h-8 text-xs border-green-300 text-green-700 hover:bg-green-50">
                                <FileSpreadsheet className="h-3.5 w-3.5 mr-1 sm:mr-1.5" />
                                <span className="hidden sm:inline">Exportar Excel por Placa</span>
                                <span className="sm:hidden">Excel</span>
                            </Button>
                            <Button asChild disabled={!centro} className="h-8 text-xs border-green-300 text-green-700 hover:bg-green-50 bg-background border" variant="outline">
                                <Link href={rutaModulacion()}>
                                    <Truck className="h-3.5 w-3.5 mr-1 sm:mr-1.5" />
                                    <span className="hidden sm:inline">Nueva planeación</span>
                                    <span className="sm:hidden">Nueva</span>
                                </Link>
                            </Button>
                        </div>
                    </div>
                    {/* Toggle UC / UD dentro de la card, debajo del título */}
                    <div className="flex items-center gap-3 border-t border-border/50 mt-4 pt-3">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Centro:</span>
                        <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/50">
                            {CENTROS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => handleCentroChange(c)}
                                    className={`px-5 py-1.5 rounded-md text-sm font-bold transition-all ${
                                        centro === c
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                    }`}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>



                <div className="rounded-2xl border border-border/70 bg-card shadow-sm px-6 py-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Filter className="h-3.5 w-3.5 text-green-700 dark:text-green-400" />
                            Filtros de búsqueda
                        </span>
                        {hasActiveFilters && (
                            <Button type="button" variant="ghost" size="sm" onClick={handleClear} className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1">
                                <X className="size-3" />
                                Limpiar
                            </Button>
                        )}
                    </div>
                    <form className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3" onSubmit={(e) => e.preventDefault()}>
                        <div className="grid gap-1">
                            <Label htmlFor="fecha_desde" className="text-[11px] font-medium text-muted-foreground flex items-center">
                                <Calendar className="h-3 w-3 inline mr-1 text-muted-foreground/70" />
                                F. Desde
                            </Label>
                            <Input id="fecha_desde" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="text-xs h-8 rounded-lg" />
                        </div>
                        <div className="grid gap-1">
                            <Label htmlFor="fecha_hasta" className="text-[11px] font-medium text-muted-foreground flex items-center">
                                <Calendar className="h-3 w-3 inline mr-1 text-muted-foreground/70" />
                                F. Hasta
                            </Label>
                            <Input id="fecha_hasta" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="text-xs h-8 rounded-lg" />
                        </div>
                        <div className="grid gap-1 col-span-2 sm:col-span-1">
                            <Label htmlFor="placa" className="text-[11px] font-medium text-muted-foreground flex items-center">
                                <MapPinned className="h-3 w-3 inline mr-1 text-muted-foreground/70" />
                                Placa
                            </Label>
                            <PlacaComboboxFilter value={placa} onChange={setPlaca} placas={placas_disponibles} />
                        </div>
                        <div className="grid gap-1 col-span-2 sm:col-span-1">
                            <Label htmlFor="doc_transporte" className="text-[11px] font-medium text-muted-foreground flex items-center">
                                <FileSpreadsheet className="h-3 w-3 inline mr-1 text-muted-foreground/70" />
                                Doc. Transporte
                            </Label>
                            <Input
                                id="doc_transporte"
                                type="text"
                                value={docTransporte}
                                onChange={(e) => setDocTransporte(e.target.value)}
                                placeholder="Ej: OTM-123456"
                                className="text-xs h-8 rounded-lg font-mono"
                            />
                        </div>
                    </form>
                </div>

                <div className="overflow-x-auto rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-28">Fecha</TableHead>
                                <TableHead className="min-w-[140px]">Doc. Transporte</TableHead>
                                <TableHead className="min-w-[160px]">Responsable Ruta</TableHead>
                                <TableHead className="min-w-[160px]">Destino (Municipio / Barrio)</TableHead>
                                <TableHead className="min-w-[140px]">Cliente</TableHead>
                                <TableHead className="min-w-[100px]">Peso</TableHead>
                                <TableHead className="min-w-[120px]">Vehículos</TableHead>
                                <TableHead className="text-center">Rutas</TableHead>
                                <TableHead className="text-center">Tripulantes</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {planesVisibles.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <FileText className="size-9 text-muted-foreground/50" />
                                            <span>{mensajeVacio}</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                planesVisibles.map((plan) => {
                                    const rutas = rutasDeCentro(plan);
                                    const isExpanded = expandedRows.includes(plan.id);
                                    const showAll = isExpanded || hasPlacaFilter;
                                    const visibleRutas = showAll ? rutas : rutas.slice(0, 2);
                                    const hasMoreRutas = rutas.length > 2 && !showAll;
                                    const isExpandable = rutas.length > 2 && !hasPlacaFilter;

                                    return (
                                        <TableRow
                                            key={plan.id}
                                            className={isExpandable ? 'cursor-pointer hover:bg-muted/30 transition-colors' : ''}
                                            onClick={() => isExpandable && toggleExpandRow(plan.id)}
                                        >
                                            <TableCell className="align-top">
                                                <div className="text-sm font-medium text-foreground">{formatFecha(plan.fecha)}</div>
                                                <div className="text-[11px] capitalize text-muted-foreground">{getDiaSemana(plan.fecha)}</div>
                                            </TableCell>

                                            {COLUMNAS_RUTA.map((columna, i) => (
                                                <ColumnaRutas key={i} rutas={rutas} visibleRutas={visibleRutas} columna={columna} />
                                            ))}

                                            <TableCell className="align-top">
                                                <div className="flex flex-col gap-1.5">
                                                    {rutas.length === 0 ? (
                                                        <span className="text-xs text-muted-foreground">Sin vehículos</span>
                                                    ) : (
                                                        <>
                                                            {visibleRutas.map((r, idx) => {
                                                                const isMatch =
                                                                    hasPlacaFilter && r.placa.trim().toUpperCase() === placa.trim().toUpperCase();
                                                                return (
                                                                    <div key={idx}>
                                                                        <Link
                                                                            href={rutaModulacion({ fecha: plan.fecha, readOnly: 'true', placa: r.placa })}
                                                                            className="inline-block transition-transform hover:scale-105"
                                                                            title={`Abrir planeación para la placa ${r.placa} del ${formatFecha(plan.fecha)}`}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <Badge
                                                                                variant={isMatch ? 'default' : 'outline'}
                                                                                className={`px-1.5 py-0 font-mono text-[11px] cursor-pointer transition-colors ${
                                                                                    isMatch
                                                                                        ? 'bg-yellow-300 text-yellow-950 border-yellow-500 font-bold shadow-sm hover:bg-yellow-400'
                                                                                        : 'hover:bg-accent hover:text-accent-foreground'
                                                                                }`}
                                                                            >
                                                                                {r.placa}
                                                                            </Badge>
                                                                        </Link>
                                                                    </div>
                                                                );
                                                            })}

                                                            {hasMoreRutas && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleExpandRow(plan.id);
                                                                    }}
                                                                    className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline text-left cursor-pointer transition-colors"
                                                                    title="Ver todas las rutas de esta planeación"
                                                                >
                                                                    + {rutas.length - 2} más
                                                                </button>
                                                            )}

                                                            {isExpanded && isExpandable && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleExpandRow(plan.id);
                                                                    }}
                                                                    className="mt-1 text-[11px] text-muted-foreground hover:underline text-left cursor-pointer transition-colors"
                                                                >
                                                                    Ver menos
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>

                                            <TableCell className="align-top text-center text-sm">
                                                {plan.total_rutas}
                                            </TableCell>
                                            <TableCell className="align-top text-center text-sm">
                                                {plan.total_tripulantes}
                                            </TableCell>

                                            <TableCell className="align-top" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex flex-col items-end gap-1">
                                                    {/* Fila 1: Ver y Editar */}
                                                    <div className="flex gap-1">
                                                        <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-foreground" asChild title="Ver planeación">
                                                            <Link href={rutaModulacion({ fecha: plan.fecha, readOnly: 'true' })}>
                                                                <Eye className="size-4" />
                                                            </Link>
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="size-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" asChild title={`Editar planeación del ${formatFecha(plan.fecha)}`}>
                                                            <Link href={rutaModulacion({ fecha: plan.fecha })}>
                                                                <Pencil className="size-4" />
                                                            </Link>
                                                        </Button>
                                                    </div>
                                                    {/* Fila 2: Rutogramas + Excel + Eliminar (sin borde) */}
                                                    <div className="flex gap-1">
                                                        <Button size="icon" variant="ghost" className="size-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" asChild title={`Ver Rutograma del ${formatFecha(plan.fecha)}`}>
                                                            <Link href={`/modules/seguridad/rutogramas?fecha=${plan.fecha}&centro=${centro}`}>
                                                                <MapPinned className="size-4" />
                                                            </Link>
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="size-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleExportExcel(plan.fecha)} title={`Exportar planeación del ${formatFecha(plan.fecha)} a Excel`}>
                                                            <FileSpreadsheet className="size-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteModulacion(plan.id, plan.fecha)} title={`Eliminar planeación del ${formatFecha(plan.fecha)}`}>
                                                            <Trash2 className="size-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {centro && planeaciones.last_page > 1 && (
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
                                    onClick={() => link.url && router.get(link.url, conCentro(), { preserveScroll: true })}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {exportUrl && (
                    <iframe key={exportUrl} src={exportUrl} title="Exportación de planeación a Excel" className="hidden" />
                )}
            </div>
        </AppLayout>
    );
}