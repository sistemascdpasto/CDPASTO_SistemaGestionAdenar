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
import { ChevronDown, Eye, FileSpreadsheet, FileText, Trash2, Truck, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx-js-style';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Historial de Planeaciones', href: '/modules/reparto/modulacion-historial' },
];

interface RutaDetalle {
    id: number;
    placa: string;
    doc_tras: string;
    responsable: string;
    destino: string;
    cliente: string;
    peso: string;
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
    };
}

type Filters = {
    fecha_desde: string;
    fecha_hasta: string;
    placa: string;
};

function formatFecha(fecha: string) {
    const [y, m, d] = fecha.split('-');
    return `${d}/${m}/${y}`;
}

function getDiaSemana(fecha: string) {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long' });
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

    const filteredPlacas = placas.filter((p) =>
        p.toLowerCase().includes(value.trim().toLowerCase())
    );

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
    const [exportUrl, setExportUrl] = useState<string | null>(null);
    const [expandedRows, setExpandedRows] = useState<number[]>([]);

    const toggleExpandRow = (id: number) => {
        setExpandedRows((prev) =>
            prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]
        );
    };

    const debouncedFechaDesde = useDebouncedValue(fechaDesde);
    const debouncedFechaHasta = useDebouncedValue(fechaHasta);
    const debouncedPlaca = useDebouncedValue(placa);

    const isFirstRender = useRef(true);

    const applyFilters = (overrides: Partial<Filters>) => {
        router.get(
            route('reparto.modulacion.historial'),
            {
                fecha_desde: overrides.fecha_desde ?? debouncedFechaDesde,
                fecha_hasta: overrides.fecha_hasta ?? debouncedFechaHasta,
                placa: overrides.placa ?? debouncedPlaca,
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
    }, [debouncedFechaDesde, debouncedFechaHasta, debouncedPlaca]);

    const handleClear = () => {
        setFechaDesde('');
        setFechaHasta('');
        setPlaca('');
        router.get(route('reparto.modulacion.historial'), {}, { preserveState: false });
    };

    const handleDeleteModulacion = (id: number, fecha: string) => {
        if (confirm(`¿Está seguro de eliminar la planeación del ${formatFecha(fecha)}? Esta acción no se puede deshacer.`)) {
            router.delete(route('reparto.modulacion.destroy', id), {
                onSuccess: () => router.get(route('reparto.modulacion.historial'), {}, { preserveState: false }),
            });
        }
    };

    const handleExportExcel = (fecha: string) => {
        const url = route('reparto.modulacion.index', {
            fecha,
            readOnly: 'true',
            exportExcel: 'true',
            _export: Date.now(),
        });
        setExportUrl(url);
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
        if (hasDateFilter) {
            return planeaciones.data;
        }
        const fechaHoy = getFechaHoyStr();
        return planeaciones.data.filter((plan) => plan.fecha === fechaHoy);
    };

    const handleExportarExcelPorPlaca = () => {
        const dataAExportar = getPlaneacionesFiltradasOActuales();
        if (dataAExportar.length === 0) {
            const hasDateFilter = Boolean(fechaDesde || fechaHasta);
            alert(
                hasDateFilter
                    ? 'No hay planeaciones en la tabla para exportar.'
                    : `No hay planeaciones registradas para el día de hoy (${formatFecha(getFechaHoyStr())}) para exportar.`
            );
            return;
        }

        const filas: (string | number)[][] = [];

        dataAExportar.forEach((plan) => {
            const rutas = plan.rutas_detalle ?? [];
            if (rutas.length === 0) {
                filas.push([
                    formatFecha(plan.fecha),
                    'Sin vehículo',
                    '',
                    '',
                    '',
                    '',
                    '',
                ]);
            } else {
                rutas.forEach((r) => {
                    filas.push([
                        formatFecha(plan.fecha),
                        r.placa || '',
                        r.doc_tras || '',
                        r.responsable || '',
                        r.destino || '',
                        r.cliente || '',
                        r.peso || '',
                    ]);
                });
            }
        });

        const worksheet = XLSX.utils.aoa_to_sheet([
            [
                'Fecha',
                'Placa',
                'Documento de Transporte',
                'Responsable',
                'Destino',
                'Cliente',
                'Peso',
            ],
            ...filas,
        ]);

        // ─── Estilos para la tabla ──────────────────────────────
        const BORDER_THIN = {
            top: { style: 'thin' as const, color: { rgb: '000000' } },
            bottom: { style: 'thin' as const, color: { rgb: '000000' } },
            left: { style: 'thin' as const, color: { rgb: '000000' } },
            right: { style: 'thin' as const, color: { rgb: '000000' } },
        };

        const HEADER_STYLE = {
            font: { bold: true, name: 'Calibri', sz: 11, color: { rgb: '000000' } },
            fill: { fgColor: { rgb: 'BDD7EE' } }, // Azul claro
            alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
            border: BORDER_THIN,
        };

        const BODY_STYLE_LEFT = {
            font: { name: 'Calibri', sz: 11, color: { rgb: '000000' } },
            alignment: { horizontal: 'left' as const, vertical: 'center' as const },
            border: BORDER_THIN,
        };

        const BODY_STYLE_CENTER = {
            font: { name: 'Calibri', sz: 11, color: { rgb: '000000' } },
            alignment: { horizontal: 'center' as const, vertical: 'center' as const },
            border: BORDER_THIN,
        };

        // Anchos de columna
        worksheet['!cols'] = [
            { wch: 14 },
            { wch: 14 },
            { wch: 24 },
            { wch: 28 },
            { wch: 25 },
            { wch: 25 },
            { wch: 16 },
        ];

        // Recorrer todas las celdas y aplicar bordes + estilos de encabezado y datos
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        const rowsInfo: { hpt: number }[] = [{ hpt: 26 }];

        for (let R = range.s.r; R <= range.e.r; ++R) {
            if (R > 0) {
                rowsInfo.push({ hpt: 20 });
            }

            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                if (!worksheet[cellRef]) {
                    worksheet[cellRef] = { t: 's', v: '' };
                }

                if (R === 0) {
                    worksheet[cellRef].s = HEADER_STYLE;
                } else {
                    const isCenterCol = C === 0 || C === 1 || C === 2 || C === 6;
                    worksheet[cellRef].s = isCenterCol ? BODY_STYLE_CENTER : BODY_STYLE_LEFT;
                }
            }
        }

        worksheet['!rows'] = rowsInfo;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte por Placa');
        const fechaArchivo = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `Reporte_Planeaciones_Por_Placa_${fechaArchivo}.xlsx`);
    };

    const hasActiveFilters = Boolean(fechaDesde || fechaHasta || placa);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Historial de Planeaciones de Ruta" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <HeadingSmall
                        title="Historial de Planeaciones de Ruta"
                        description={`${planeaciones.total} planeación${planeaciones.total !== 1 ? 'es' : ''} registrada${planeaciones.total !== 1 ? 's' : ''}.`}
                    />
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={handleExportarExcelPorPlaca}>
                            <FileSpreadsheet className="size-4 text-emerald-600" />
                            Exportar Excel por Placa
                        </Button>
                        <Button asChild>
                            <Link href={route('reparto.modulacion.index')}>
                                <Truck className="size-4" />
                                Nueva planeación
                            </Link>
                        </Button>
                    </div>
                </div>

                <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => e.preventDefault()}>
                    <div className="grid gap-2">
                        <Label htmlFor="fecha_desde">Fecha desde</Label>
                        <Input id="fecha_desde" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="fecha_hasta">Fecha hasta</Label>
                        <Input id="fecha_hasta" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="placa">Placa</Label>
                        <PlacaComboboxFilter
                            value={placa}
                            onChange={setPlaca}
                            placas={placas_disponibles}
                        />
                    </div>
                    {hasActiveFilters && (
                        <div className="flex items-end">
                            <Button type="button" variant="outline" onClick={handleClear} className="w-full">
                                <X className="size-4" />
                                Limpiar
                            </Button>
                        </div>
                    )}
                </form>

                <div className="overflow-x-auto rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-28">Fecha</TableHead>
                                <TableHead className="min-w-[140px]">Doc. Transporte</TableHead>
                                <TableHead className="min-w-[140px]">Programado por</TableHead>
                                <TableHead className="min-w-[160px]">Responsable Ruta</TableHead>
                                <TableHead className="min-w-[140px]">Destino</TableHead>
                                <TableHead className="min-w-[140px]">Cliente</TableHead>
                                <TableHead className="min-w-[100px]">Peso</TableHead>
                                <TableHead className="min-w-[120px]">Vehículos</TableHead>
                                <TableHead className="text-center">Rutas</TableHead>
                                <TableHead className="text-center">Tripulantes</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {planeaciones.data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={11} className="py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <FileText className="size-9 text-muted-foreground/50" />
                                            <span>
                                                {hasActiveFilters
                                                    ? 'No se encontraron planeaciones con ese criterio de búsqueda.'
                                                    : 'No hay planeaciones registradas aún.'}
                                            </span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                planeaciones.data.map((plan) => {
                                    const rutas = plan.rutas_detalle ?? [];
                                    const isExpanded = expandedRows.includes(plan.id);
                                    const hasPlacaFilter = Boolean(placa.trim());
                                    const showAll = isExpanded || hasPlacaFilter;
                                    const visibleRutas = showAll ? rutas : rutas.slice(0, 2);
                                    const hasMoreRutas = rutas.length > 2 && !showAll;

                                    return (
                                        <TableRow
                                            key={plan.id}
                                            className={rutas.length > 2 && !hasPlacaFilter ? 'cursor-pointer hover:bg-muted/30 transition-colors' : ''}
                                            onClick={() => {
                                                if (rutas.length > 2 && !hasPlacaFilter) {
                                                    toggleExpandRow(plan.id);
                                                }
                                            }}
                                        >
                                            <TableCell className="align-top">
                                                <div className="text-sm font-medium text-foreground">{formatFecha(plan.fecha)}</div>
                                                <div className="text-[11px] capitalize text-muted-foreground">{getDiaSemana(plan.fecha)}</div>
                                            </TableCell>
                                            <TableCell className="align-top">
                                                <div className="flex flex-col gap-1.5">
                                                    {rutas.length === 0 ? (
                                                        <span className="text-xs text-muted-foreground">—</span>
                                                    ) : (
                                                        visibleRutas.map((r, idx) => (
                                                            <div key={idx} className="text-xs font-mono" title={r.doc_tras || '—'}>
                                                                {r.doc_tras || <span className="text-muted-foreground/70">—</span>}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top text-xs">
                                                {plan.ud_programado_por || <span className="text-muted-foreground/70">—</span>}
                                            </TableCell>
                                            <TableCell className="align-top">
                                                <div className="flex flex-col gap-1.5">
                                                    {rutas.length === 0 ? (
                                                        <span className="text-xs text-muted-foreground">—</span>
                                                    ) : (
                                                        visibleRutas.map((r, idx) => (
                                                            <div key={idx} className="text-xs font-medium" title={r.responsable || '—'}>
                                                                {r.responsable || <span className="text-muted-foreground/70">—</span>}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top">
                                                <div className="flex flex-col gap-1.5">
                                                    {rutas.length === 0 ? (
                                                        <span className="text-xs text-muted-foreground">—</span>
                                                    ) : (
                                                        visibleRutas.map((r, idx) => (
                                                            <div key={idx} className="text-xs" title={r.destino || '—'}>
                                                                {r.destino || <span className="text-muted-foreground/70">—</span>}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top">
                                                <div className="flex flex-col gap-1.5">
                                                    {rutas.length === 0 ? (
                                                        <span className="text-xs text-muted-foreground">—</span>
                                                    ) : (
                                                        visibleRutas.map((r, idx) => (
                                                            <div key={idx} className="text-xs" title={r.cliente || '—'}>
                                                                {r.cliente || <span className="text-muted-foreground/70">—</span>}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top">
                                                <div className="flex flex-col gap-1.5">
                                                    {rutas.length === 0 ? (
                                                        <span className="text-xs text-muted-foreground">—</span>
                                                    ) : (
                                                        visibleRutas.map((r, idx) => (
                                                            <div key={idx} className="text-xs" title={r.peso || '—'}>
                                                                {r.peso || <span className="text-muted-foreground/70">—</span>}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top">
                                                <div className="flex flex-col gap-1.5">
                                                    {rutas.length === 0 ? (
                                                        <span className="text-xs text-muted-foreground">Sin vehículos</span>
                                                    ) : (
                                                        <>
                                                            {visibleRutas.map((r, idx) => {
                                                                const isMatch = Boolean(placa.trim()) && r.placa.trim().toUpperCase() === placa.trim().toUpperCase();
                                                                return (
                                                                    <div key={idx}>
                                                                        <Link
                                                                            href={route('reparto.modulacion.index', { fecha: plan.fecha, readOnly: 'true', placa: r.placa })}
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

                                                            {isExpanded && !hasPlacaFilter && rutas.length > 2 && (
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
                                            <TableCell className="align-top text-center">
                                                <Badge variant="secondary">
                                                    <Truck className="size-3" />
                                                    {plan.total_rutas}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="align-top text-center">
                                                <Badge variant="secondary">
                                                    <Users className="size-3" />
                                                    {plan.total_tripulantes}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="align-top" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex justify-end gap-1.5">
                                                    <Button
                                                        size="icon"
                                                        variant="outline"
                                                        className="size-8 text-emerald-600 hover:text-emerald-700"
                                                        onClick={() => handleExportExcel(plan.fecha)}
                                                        title={`Exportar planeación del ${formatFecha(plan.fecha)} a Excel`}
                                                    >
                                                        <FileSpreadsheet className="size-4" />
                                                    </Button>
                                                    <Button size="icon" variant="outline" className="size-8" asChild title="Ver planeación">
                                                        <Link href={route('reparto.modulacion.index', { fecha: plan.fecha, readOnly: 'true' })}>
                                                            <Eye className="size-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleDeleteModulacion(plan.id, plan.fecha)}
                                                        title={`Eliminar planeación del ${formatFecha(plan.fecha)}`}
                                                    >
                                                        <Trash2 className="size-4" />
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

                {planeaciones.last_page > 1 && (
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
                                    onClick={() => link.url && router.get(link.url, {}, { preserveScroll: true })}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {exportUrl && (
                    <iframe
                        key={exportUrl}
                        src={exportUrl}
                        title="Exportación de planeación a Excel"
                        className="hidden"
                    />
                )}
            </div>
        </AppLayout>
    );
}
