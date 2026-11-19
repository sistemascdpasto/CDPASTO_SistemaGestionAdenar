import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    AlertCircle,
    AlertTriangle,
    Calendar,
    CheckCircle2,
    Download,
    FileSpreadsheet,
    Upload,
    Users,
    Briefcase,
    MapPin,
    RefreshCw,
    X,
    XCircle,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reparto', href: '/modules/reparto/modulacion' },
    { title: 'Eventos de Tripulación', href: '/modules/reparto/eventos-tripulacion' },
];

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Evento {
    id: number;
    fecha: string | null;
    placa: string | null;
    doc_transporte: string | null;
    documento: string | null;
    nombre: string | null;
    cargo: string | null;
    entrega_en_rango: number | null;
    rechazos: number | null;
    alertas_velocidad_curvas: number | null;
    adherencia_tiempo: number | null;
    modulacion: number | null;
    adherencia_checklist_pre: number | null;
    adherencia_checklist_post: number | null;
    rmd: string | null;
    adherencia_checklist: number | null;
    created_at: string | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface Paginator {
    data: Evento[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: PaginationLink[];
}

interface Props {
    eventos: Paginator;
    filters: {
        placa: string;
        cedula: string;
        nombre: string;
        doc_transporte: string;
        fecha_desde: string;
        fecha_hasta: string;
        planeacion_fecha: string;
    };
    fechas_planeaciones: string[];
    flash?: { success?: string; error?: string; warning?: string };
    errors?: { archivo?: string; [key: string]: string | undefined };
}

// ─── Definición de columnas ───────────────────────────────────────────────────
// [clave, etiqueta, fija?]
type ColKey = keyof Evento;

const COLUMNAS: [ColKey, string, boolean][] = [
    ['fecha',                    'Fecha',                        true],
    ['placa',                    'Placa',                        true],
    ['doc_transporte',           'Doc. Transporte',              false],
    ['documento',                'Cédula',                       true],
    ['nombre',                   'Nombre',                       false],
    ['cargo',                    'Cargo',                        false],
    ['entrega_en_rango',         'Entrega en Rango',             false],
    ['rechazos',                 'Rechazos',                     false],
    ['alertas_velocidad_curvas', '# Alertas Vel. Curvas',        false],
    ['adherencia_tiempo',        '% Adherencia al Tiempo',       false],
    ['modulacion',               'Modulación',                   false],
    ['adherencia_checklist_pre', 'Adherencia CL Pre Op.',        false],
    ['adherencia_checklist_post','Adherencia CL Post Op.',       false],
    ['rmd',                      'RMD',                          false],
];

const FIXED_COLS = new Set<ColKey>(
    COLUMNAS.filter(([, , fixed]) => fixed).map(([k]) => k)
);

// Columnas visibles la primera vez que alguien abre el módulo (sin
// preferencia guardada en localStorage todavía). Con las 18 columnas
// completas la tabla generaba un scroll horizontal excesivo; el resto
// de columnas se puede activar desde el selector "Columnas".
const DEFAULT_COLS: ColKey[] = [
    'fecha',
    'placa',
    'documento',
    'nombre',
    'cargo',
    'entrega_en_rango',
    'rechazos',
    'alertas_velocidad_curvas',
    'adherencia_tiempo',
    'modulacion',
    'adherencia_checklist_pre',
    'adherencia_checklist_post',
];

const PCT_FIELDS = new Set<ColKey>([
    'adherencia_checklist_pre',
    'adherencia_checklist_post',
    'modulacion',
    'adherencia_tiempo',
    'entrega_en_rango',
    'rechazos',
]);


const STORAGE_KEY = 'eventos_tripulacion_cols_visibles';

// ─── Helpers de formato ────────────────────────────────────────────────────────
function formatFecha(fecha: string | null): string {
    if (!fecha) return '—';
    const solo = String(fecha).split('T')[0].split(' ')[0];
    const [y, m, d] = solo.split('-');
    return `${d}/${m}/${y}`;
}


function formatValor(campo: ColKey, val: unknown): string {
    if (val === null || val === undefined || val === '') return '—';
    if (campo === 'fecha') return formatFecha(val as string);
    if (PCT_FIELDS.has(campo)) {
        const n = Number(val);
        return isNaN(n) ? String(val) : `${n % 1 === 0 ? n : n.toFixed(2)}%`;
    }
    return String(val);
}

/** Renderiza el contenido interior de una celda según el tipo de campo */
function CeldaContenido({ campo, val }: { campo: ColKey; val: unknown }) {
    if (campo === 'placa') {
        return <span className="font-mono font-bold text-foreground">{val ? String(val) : '—'}</span>;
    }
    if (campo === 'nombre') {
        return val
            ? <span className="text-foreground">{String(val)}</span>
            : <span className="text-muted-foreground">—</span>;
    }
    if (campo === 'cargo') {
        return val
            ? <span className="text-foreground">{String(val)}</span>
            : <span className="text-muted-foreground">—</span>;
    }
    if (campo === 'doc_transporte') {
        return val
            ? <span className="font-mono text-foreground">{String(val)}</span>
            : <span className="text-muted-foreground italic text-xs">—</span>;
    }
    if (PCT_FIELDS.has(campo)) {
        return (val !== null && val !== undefined)
            ? <span className="text-foreground">{formatValor(campo, val)}</span>
            : <span className="text-muted-foreground text-xs">—</span>;
    }
    return <span className="text-foreground">{formatValor(campo, val)}</span>;
}

type Filters = {
    placa: string; cedula: string; nombre: string;
    doc_transporte: string; fecha_desde: string; fecha_hasta: string;
    planeacion_fecha: string;
};

// ─── Modal de importación (nodo raíz siempre en el árbol) ─────────────────────
interface ImportModalProps {
    open: boolean;
    selectedFile: File | null;
    isUploading: boolean;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    fechasPlaneaciones: string[];
    fechaPlaneacion: string;
    onFechaPlaneacionChange: (f: string) => void;
    onClose: () => void;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onImport: () => void;
    onDownloadTemplate: () => void;
}

function ImportModal({
    open, selectedFile, isUploading,
    fileInputRef, fechasPlaneaciones, fechaPlaneacion, onFechaPlaneacionChange,
    onClose, onFileChange, onImport, onDownloadTemplate,
}: ImportModalProps) {
    if (!open) return null;

    const puedeImportar = !!selectedFile && !!fechaPlaneacion && !isUploading;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-2 sm:p-4">
            <div className="bg-card rounded-t-xl sm:rounded-xl shadow-md w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
                {/* Cabecera */}
                <div className="flex items-center justify-between border-b px-4 sm:px-6 py-3 sm:py-4 sticky top-0 bg-card z-10">
                    <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2 text-foreground">
                        <FileSpreadsheet className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                        <span className="truncate">Importar Eventos</span>
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-muted-foreground transition-colors p-1 -mr-1 shrink-0"
                    >
                        <X className="h-5 w-5 sm:h-5 sm:w-5" />
                    </button>
                </div>

                {/* Cuerpo */}
                <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">

                    {/* Selector de planeación — obligatorio */}
                    <div className="space-y-1.5">
                        <Label className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            Fecha de planeación <span className="text-destructive">*</span>
                        </Label>
                        <select
                            value={fechaPlaneacion}
                            onChange={(e) => onFechaPlaneacionChange(e.target.value)}
                            className="w-full h-9 sm:h-10 rounded-md border border-input bg-background px-2 py-1 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="">— Selecciona una planeación —</option>
                            {fechasPlaneaciones.map((f) => {
                                const [y, m, d] = f.split('-');
                                return (
                                    <option key={f} value={f}>{d}/{m}/{y}</option>
                                );
                            })}
                        </select>
                        {!fechaPlaneacion && (
                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                                Debes seleccionar la planeación antes de importar.
                            </p>
                        )}
                    </div>

                    <div className="rounded-lg border border-sidebar-border/70 bg-muted/50 p-3 sm:p-4 text-xs text-muted-foreground dark:border-sidebar-border space-y-1 sm:space-y-1">
                        <p className="font-semibold">Columnas esperadas:</p>
                        <p className="text-[10px] sm:text-xs leading-relaxed text-muted-foreground break-words">
                            TRANSPORTE · PLACA · ENTREGA EN RANGO · RECHAZOS ·
                            # ALERTAS VELOCIDAD · % ADH. TIEMPO · MODULACION ·
                            ADHERENCIA CL PRE OP. · ADHERENCIA CL POST OP. · RMD
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground italic">
                            La fecha se toma de la planeación seleccionada.
                        </p>
                        <button
                            type="button"
                            onClick={onDownloadTemplate}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                            <Download className="h-3 w-3" />
                            Descargar plantilla
                        </button>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs sm:text-sm font-semibold text-foreground">
                            Archivo Excel (.xlsx, .xls) o CSV
                        </Label>
                        <div
                            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-input bg-muted p-4 sm:p-8 text-center cursor-pointer hover:border-foreground/30 hover:bg-muted transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground mb-1.5 sm:mb-2" />
                            {selectedFile ? (
                                <div className="space-y-0.5 sm:space-y-1 w-full min-w-0">
                                    <p className="text-xs sm:text-sm font-semibold text-muted-foreground truncate">{selectedFile.name}</p>
                                    <p className="text-[10px] sm:text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                            ) : (
                                <div className="space-y-0.5 sm:space-y-1">
                                    <p className="text-xs sm:text-sm text-muted-foreground">Clic para seleccionar archivo</p>
                                    <p className="text-[10px] sm:text-xs text-muted-foreground">xlsx, xls, csv · máx. 20 MB</p>
                                </div>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                className="hidden"
                                onChange={onFileChange}
                            />
                        </div>
                    </div>
                </div>

                {/* Pie */}
                <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 border-t px-4 sm:px-6 py-3 sm:py-4 sticky bottom-0 bg-card">
                    <Button variant="outline" onClick={onClose} disabled={isUploading} className="w-full sm:w-auto order-2 sm:order-1 h-9 sm:h-10 text-xs sm:text-sm">
                        Cancelar
                    </Button>
                    <Button
                        onClick={onImport}
                        disabled={!puedeImportar}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold min-w-full sm:min-w-[130px] order-1 sm:order-2 h-9 sm:h-10 text-xs sm:text-sm"
                    >
                        {isUploading
                            ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin shrink-0" />Procesando...</>
                            : <><Upload className="h-4 w-4 mr-2 shrink-0" />Importar</>
                        }
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function EventosTripulacionIndex({ eventos, filters, fechas_planeaciones, flash, errors }: Props) {
    const [placa,         setPlaca]         = useState(filters.placa ?? '');
    const [cedula,        setCedula]        = useState(filters.cedula ?? '');
    const [nombre,        setNombre]        = useState(filters.nombre ?? '');
    const [docTransporte, setDocTransporte] = useState(filters.doc_transporte ?? '');
    const [fechaDesde,    setFechaDesde]    = useState(filters.fecha_desde ?? '');
    const [fechaHasta,    setFechaHasta]    = useState(filters.fecha_hasta ?? '');
    const [planeacionFecha, setPlaneacionFecha] = useState(filters.planeacion_fecha ?? '');
    const [isRefreshing,  setIsRefreshing]  = useState(false);
    const [showWarning,   setShowWarning]   = useState(true);

    // Importación
    const [showImportModal, setShowImportModal] = useState(false);
    const [selectedFile,    setSelectedFile]    = useState<File | null>(null);
    const [isUploading,     setIsUploading]     = useState(false);
    const [fechaImport,     setFechaImport]     = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Selector de columnas
    const [colsVisibles, setColsVisibles] = useState<Set<ColKey>>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const arr = JSON.parse(saved) as string[];
                return new Set<ColKey>([
                    ...Array.from(FIXED_COLS),
                    ...arr.filter((k) => COLUMNAS.some(([c]) => c === k)),
                ] as ColKey[]);
            }
        } catch { /* ignore */ }
        return new Set(DEFAULT_COLS);
    });
    const [showColPicker, setShowColPicker] = useState(false);

    const toggleCol = (k: ColKey) => {
        if (FIXED_COLS.has(k)) return;
        setColsVisibles((prev) => {
            const next = new Set(prev);
            if (next.has(k)) {
                next.delete(k);
            } else {
                next.add(k);
            }
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next))); } catch { /* ignore */ }
            return next;
        });
    };

    const columnasMostradas = COLUMNAS.filter(([k]) => colsVisibles.has(k));

    // Debounce para filtros de texto
    const debouncedPlaca         = useDebouncedValue(placa, 150);
    const debouncedCedula        = useDebouncedValue(cedula, 150);
    const debouncedNombre        = useDebouncedValue(nombre, 150);
    const debouncedDocTransporte = useDebouncedValue(docTransporte, 150);
    const debouncedFechaDesde    = useDebouncedValue(fechaDesde, 0);
    const debouncedFechaHasta    = useDebouncedValue(fechaHasta, 0);

    const isFirstRender = useRef(true);

    // Abrir el bloque de pendientes automáticamente cada vez que llega un warning nuevo
    React.useEffect(() => {
        if (flash?.warning) setShowWarning(true);
    }, [flash?.warning]);

    const applyFilters = (overrides: Partial<Filters> = {}) => {
        router.get(
            route('reparto.eventos-tripulacion.index'),
            {
                placa:            overrides.placa            ?? debouncedPlaca,
                cedula:           overrides.cedula           ?? debouncedCedula,
                nombre:           overrides.nombre           ?? debouncedNombre,
                doc_transporte:   overrides.doc_transporte   ?? debouncedDocTransporte,
                fecha_desde:      overrides.fecha_desde      ?? debouncedFechaDesde,
                fecha_hasta:      overrides.fecha_hasta      ?? debouncedFechaHasta,
                planeacion_fecha: overrides.planeacion_fecha ?? planeacionFecha,
            },
            { preserveState: true, preserveScroll: true, replace: true }
        );
    };

    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        applyFilters({});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedPlaca, debouncedCedula, debouncedNombre, debouncedDocTransporte, debouncedFechaDesde, debouncedFechaHasta, planeacionFecha]);

    const handleClear = () => {
        setPlaca(''); setCedula(''); setNombre('');
        setDocTransporte(''); setFechaDesde(''); setFechaHasta('');
        setPlaneacionFecha('');
        router.get(route('reparto.eventos-tripulacion.index'), {}, { preserveState: false });
    };

    const hasActiveFilters = placa || cedula || nombre || docTransporte || fechaDesde || fechaHasta || planeacionFecha;

    // Actualizar desde alertas existentes
    const handleRefresh = () => {
        if (confirm('¿Actualizar eventos desde las alertas existentes?')) {
            setIsRefreshing(true);
            router.post(route('reparto.eventos-tripulacion.refresh'), {}, {
                preserveScroll: true,
                onSuccess: () => setIsRefreshing(false),
                onError:   () => setIsRefreshing(false),
            });
        }
    };

    // Importación — cierra el modal ANTES del POST para que React
    // no tenga el modal montado cuando Inertia hace el swap de DOM
    const handleImport = () => {
        if (!selectedFile || !fechaImport) return;

        const fileToUpload  = selectedFile;
        const fechaToUpload = fechaImport;

        // 1. Cerrar el modal y limpiar estado local PRIMERO
        setShowImportModal(false);
        setSelectedFile(null);
        setFechaImport('');
        setIsUploading(true);

        // 2. Luego enviar el archivo junto con la fecha de la planeación
        const fd = new FormData();
        fd.append('archivo', fileToUpload);
        fd.append('fecha_planeacion', fechaToUpload);
        router.post(route('reparto.eventos-tripulacion.store'), fd as unknown as Record<string, unknown>, {
            forceFormData: true,
            preserveScroll: true,
            onFinish: () => {
                setIsUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedFile(e.target.files?.[0] ?? null);
    };

    const handleDownloadTemplate = () => {
        window.location.href = route('reparto.eventos-tripulacion.template');
    };

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Eventos de Tripulación" />

            <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 md:p-6 max-w-full mx-auto">

                {/* Flash success */}
                {flash?.success && (
                    <div className="flex items-start gap-2 sm:gap-3 rounded-lg border border-green-200 bg-green-50 p-2 sm:p-3 text-green-800">
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5 text-green-600" />
                        <p className="text-xs sm:text-sm font-medium whitespace-pre-line break-words">{flash.success}</p>
                    </div>
                )}

                {/* Flash warning — pendientes de revisión, colapsable */}
                {flash?.warning && (
                    <div className="rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-900">
                        <button
                            type="button"
                            onClick={() => setShowWarning(v => !v)}
                            className="flex w-full items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 text-left"
                        >
                            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-yellow-600" />
                            <span className="text-xs sm:text-sm font-semibold flex-1">
                                Filas pendientes de revisión — no se guardaron
                            </span>
                            <span className="text-[10px] sm:text-xs text-yellow-700">
                                {showWarning ? 'Ocultar' : 'Ver detalle'}
                            </span>
                        </button>
                        {showWarning && (
                            <div className="border-t border-yellow-200 px-3 pb-3 sm:px-4 sm:pb-4 pt-2">
                                <pre className="text-[10px] sm:text-xs whitespace-pre-wrap break-words font-mono leading-relaxed">
                                    {flash.warning}
                                </pre>
                            </div>
                        )}
                    </div>
                )}

                {flash?.error && (
                    <div className="flex items-start gap-2 sm:gap-3 rounded-lg border border-red-200 bg-red-50 p-2 sm:p-3 text-red-800">
                        <XCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5 text-red-500" />
                        <p className="text-xs sm:text-sm font-medium break-words">{flash.error}</p>
                    </div>
                )}
                {errors?.archivo && (
                    <div className="flex items-start gap-2 sm:gap-3 rounded-lg border border-red-200 bg-red-50 p-2 sm:p-3 text-red-800">
                        <XCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5 text-red-500" />
                        <p className="text-xs sm:text-sm font-medium break-words">{errors.archivo}</p>
                    </div>
                )}

                {/* Encabezado */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 border-b pb-3 sm:pb-4">
                    <div>
                        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <Users className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-muted-foreground" />
                            Eventos de Tripulación
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            {eventos.total} registro{eventos.total !== 1 ? 's' : ''} de tripulación
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap w-full md:w-auto">

                        {/* Selector de columnas */}
                        <div className="relative w-full sm:w-auto">
                            <Button
                                variant="outline"
                                onClick={() => setShowColPicker((v) => !v)}
                                className="text-muted-foreground border-input w-full sm:w-auto text-xs sm:text-sm"
                            >
                                Columnas ({columnasMostradas.length}/{COLUMNAS.length})
                            </Button>
                            {showColPicker && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowColPicker(false)} />
                                    <div className="absolute right-0 left-0 sm:left-auto sm:w-72 top-full mt-1 z-50 bg-card border rounded-lg shadow-md p-3 w-full sm:w-72 max-h-[60vh] sm:max-h-[70vh] overflow-y-auto">
                                        <p className="text-xs font-semibold text-muted-foreground mb-2">Mostrar / ocultar columnas</p>
                                        <div className="space-y-1">
                                            {COLUMNAS.map(([k, label, fixed]) => (
                                                <label
                                                    key={k}
                                                    className={`flex items-center gap-2 text-xs sm:text-sm cursor-pointer rounded px-1 py-0.5 hover:bg-muted/60 ${fixed ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={colsVisibles.has(k)}
                                                        onChange={() => toggleCol(k)}
                                                        disabled={fixed}
                                                        className="h-3.5 w-3.5"
                                                    />
                                                    <span className="truncate">{label}</span>
                                                    {fixed && <span className="text-[10px] sm:text-xs text-muted-foreground ml-auto shrink-0">fija</span>}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <Button
                            variant="outline"
                            onClick={handleDownloadTemplate}
                            className="border-green-600 text-green-700 hover:bg-green-50 text-xs sm:text-sm w-full sm:w-auto"
                        >
                            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            <span className="hidden sm:inline">Plantilla</span>
                            <span className="sm:hidden">Plant.</span>
                        </Button>

                        <Button
                            onClick={() => setShowImportModal(true)}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs sm:text-sm w-full sm:w-auto"
                        >
                            <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            <span className="hidden sm:inline">Subir Excel</span>
                            <span className="sm:hidden">Subir</span>
                        </Button>

                        <Button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold text-xs sm:text-sm w-full sm:w-auto"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                            {isRefreshing ? (
                                <><span className="hidden sm:inline">Actualizando...</span><span className="sm:hidden">Act.</span></>
                            ) : (
                                <><span className="hidden sm:inline">Actualizar</span><span className="sm:hidden">Act.</span></>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Filtros */}
                <Card className="shadow-sm border bg-card">
                    <CardContent className="pt-3 sm:pt-4 p-3 sm:p-4 md:p-6">
                        <div className="space-y-2 sm:space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                                <div className="grid gap-1">
                                    <Label className="text-[10px] sm:text-xs font-semibold text-muted-foreground">
                                        <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3 inline mr-0.5 sm:mr-1" />Placa
                                    </Label>
                                    <Input
                                        placeholder="Ej: COLJV386"
                                        value={placa}
                                        onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                                        className="uppercase font-mono text-xs sm:text-sm h-9 sm:h-10"
                                    />
                                </div>
                                <div className="grid gap-1">
                                    <Label className="text-[10px] sm:text-xs font-semibold text-muted-foreground">
                                        <Briefcase className="h-2.5 w-2.5 sm:h-3 sm:w-3 inline mr-0.5 sm:mr-1" />Cédula
                                    </Label>
                                    <Input
                                        placeholder="Documento..."
                                        value={cedula}
                                        onChange={(e) => setCedula(e.target.value)}
                                        className="font-mono text-xs sm:text-sm h-9 sm:h-10"
                                    />
                                </div>
                                <div className="grid gap-1">
                                    <Label className="text-[10px] sm:text-xs font-semibold text-muted-foreground">
                                        <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3 inline mr-0.5 sm:mr-1" />Nombre
                                    </Label>
                                    <Input
                                        placeholder="Nombres o apellidos..."
                                        value={nombre}
                                        onChange={(e) => setNombre(e.target.value)}
                                        className="text-xs sm:text-sm h-9 sm:h-10"
                                    />
                                </div>
                                <div className="grid gap-1">
                                    <Label className="text-[10px] sm:text-xs font-semibold text-muted-foreground">
                                        <FileSpreadsheet className="h-2.5 w-2.5 sm:h-3 sm:w-3 inline mr-0.5 sm:mr-1" />Doc.
                                    </Label>
                                    <Input
                                        placeholder="Ej: OTM-123456"
                                        value={docTransporte}
                                        onChange={(e) => setDocTransporte(e.target.value)}
                                        className="font-mono text-xs sm:text-sm h-9 sm:h-10"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                                <div className="grid gap-1">
                                    <Label className="text-[10px] sm:text-xs font-semibold text-muted-foreground">
                                        <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3 inline mr-0.5 sm:mr-1" />Planeación
                                    </Label>
                                    <select
                                        value={planeacionFecha}
                                        onChange={(e) => setPlaneacionFecha(e.target.value)}
                                        className="h-9 sm:h-10 rounded-md border border-input bg-background px-2 py-1 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                    >
                                        <option value="">Todas las fechas</option>
                                        {fechas_planeaciones.map((f) => {
                                            const [y, m, d] = f.split('-');
                                            return (
                                                <option key={f} value={f}>{d}/{m}/{y}</option>
                                            );
                                        })}
                                    </select>
                                </div>
                                <div className="grid gap-1">
                                    <Label className="text-[10px] sm:text-xs font-semibold text-muted-foreground">
                                        <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3 inline mr-0.5 sm:mr-1" />F. Desde
                                    </Label>
                                    <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="text-xs sm:text-sm h-9 sm:h-10" />
                                </div>
                                <div className="grid gap-1">
                                    <Label className="text-[10px] sm:text-xs font-semibold text-muted-foreground">
                                        <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3 inline mr-0.5 sm:mr-1" />F. Hasta
                                    </Label>
                                    <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="text-xs sm:text-sm h-9 sm:h-10" />
                                </div>
                                {hasActiveFilters && (
                                    <div className="sm:col-span-2 md:col-span-1 lg:col-span-2 flex items-end">
                                        <Button type="button" variant="outline" onClick={handleClear} className="w-full h-9 sm:h-10 text-xs sm:text-sm">
                                            <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1" />
                                            <span className="hidden sm:inline">Limpiar filtros</span>
                                            <span className="sm:hidden">Limpiar</span>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Tabla */}
                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader className="pb-2 sm:pb-3 border-b p-3 sm:p-4 md:py-4 md:px-6">
                        <CardTitle className="text-sm sm:text-base font-semibold flex flex-wrap items-center gap-2">
                            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                            <span className="truncate">Registros de eventos</span>
                            {eventos.from !== null && (
                                <Badge variant="secondary" className="ml-0 sm:ml-2 text-[10px] sm:text-xs whitespace-nowrap">
                                    {eventos.from}–{eventos.to} / {eventos.total}
                                </Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 p-0">
                        <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                            <Table className="text-[10px] sm:text-xs whitespace-nowrap w-full">
                                <TableHeader className="bg-muted/50 sticky top-0">
                                    <TableRow>
                                        {columnasMostradas.map(([k, label]) => (
                                            <TableHead
                                                key={k}
                                                className="font-semibold px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs border-r last:border-r-0 whitespace-nowrap"
                                            >
                                                {label}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {eventos.data.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={columnasMostradas.length}
                                                className="text-center py-8 sm:py-12 text-muted-foreground"
                                            >
                                                <div className="flex flex-col items-center gap-2 px-2">
                                                    <FileSpreadsheet className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
                                                    <span className="text-xs sm:text-sm">
                                                        {hasActiveFilters
                                                            ? 'No se encontraron registros con ese criterio.'
                                                            : 'No hay registros. Sube un Excel o usa Actualizar.'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        eventos.data.map((evento) => (
                                            <TableRow
                                                key={evento.id}
                                                className="hover:bg-muted/60/80 dark:hover:bg-muted/40 border-b"
                                            >
                                                {columnasMostradas.map(([k]) => (
                                                    <TableCell
                                                        key={k}
                                                        className={`px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs ${
                                                            PCT_FIELDS.has(k) ? 'text-center' : ''
                                                        }`}
                                                    >
                                                        <CeldaContenido campo={k} val={evento[k]} />
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Paginación */}
                        {eventos.last_page > 1 && (
                            <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2 px-2 sm:px-4 py-2 sm:py-3 border-t">
                                <p className="text-[11px] sm:text-sm text-muted-foreground text-center sm:text-left order-2 sm:order-1">
                                    Pág. {eventos.current_page} de {eventos.last_page}
                                </p>
                                <div className="flex gap-1 flex-wrap justify-center order-1 sm:order-2 w-full sm:w-auto">
                                    {eventos.links.map((link, i) => (
                                        <Button
                                            key={i}
                                            size="sm"
                                            variant={link.active ? 'default' : 'outline'}
                                            disabled={!link.url}
                                            onClick={() => link.url && router.get(link.url, {}, { preserveScroll: true })}
                                            className={`h-7 sm:h-8 min-w-[1.75rem] sm:min-w-[2rem] px-1.5 sm:px-2 text-[10px] sm:text-xs flex-1 sm:flex-none ${link.active ? 'bg-primary text-primary-foreground border-primary' : ''}`}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Modal de Importación ─────────────────────────────────────────── */}
            <ImportModal
                open={showImportModal}
                selectedFile={selectedFile}
                isUploading={isUploading}
                fileInputRef={fileInputRef}
                fechasPlaneaciones={fechas_planeaciones}
                fechaPlaneacion={fechaImport}
                onFechaPlaneacionChange={setFechaImport}
                onClose={() => { setShowImportModal(false); setSelectedFile(null); setFechaImport(''); }}
                onFileChange={handleFileChange}
                onImport={handleImport}
                onDownloadTemplate={handleDownloadTemplate}
            />
        </AppLayout>
    );
}
