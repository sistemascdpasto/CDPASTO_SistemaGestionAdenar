import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
    Filter,
    Upload,
    Users,
    MapPin,
    RefreshCw,
    X,
    XCircle,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reparto', href: '/modules/reparto/modulacion' },
    { title: 'Eventos Diarios', href: '/modules/reparto/eventos-tripulacion' },
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
    horas_trabajadas: string | null;
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
        buscar: string;
        doc_transporte: string;
        fecha_desde: string;
        fecha_hasta: string;
        planeacion_fecha: string;
        per_page?: number | string;
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
    ['horas_trabajadas',         'Horas Trabajadas',             false],
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
    'horas_trabajadas',
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
    if (campo === 'horas_trabajadas') {
        if (val === null || val === undefined || val === '') {
            return <span className="text-muted-foreground text-xs">—</span>;
        }
        const horas = Number(String(val).split(':')[0]);
        const rojo = !isNaN(horas) && horas >= 10;
        return <span className={rojo ? 'font-bold text-red-600' : 'text-foreground'}>{String(val)}</span>;
    }
    return <span className="text-foreground">{formatValor(campo, val)}</span>;
}

type Filters = {
    placa: string; buscar: string;
    doc_transporte: string; fecha_desde: string; fecha_hasta: string;
    planeacion_fecha: string;
    per_page?: number | string;
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
    onClose, onFileChange, onImport, onDownloadTemplate: _onDownloadTemplate,
}: ImportModalProps) {
    // ── Helpers de formato ────────────────────────────────────────────────────
    const DIAS_ES  = ['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'];
    const MESES_ES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

    const toSpanish = React.useCallback((iso: string): string => {
        const dt = new Date(iso + 'T00:00:00');
        if (isNaN(dt.getTime())) return iso;
        return `${DIAS_ES[dt.getDay()]} ${dt.getDate()} ${MESES_ES[dt.getMonth()]} ${dt.getFullYear()}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Estado del combobox
    const [inputText,  setInputText]  = useState('');
    const [showList,   setShowList]   = useState(false);
    const comboRef = useRef<HTMLDivElement>(null);

    // Sincronizar inputText cuando el valor externo cambia (ej: limpiar modal)
    React.useEffect(() => {
        if (!fechaPlaneacion) {
            setInputText('');
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(fechaPlaneacion)) {
            setInputText(toSpanish(fechaPlaneacion));
        }
    }, [fechaPlaneacion, toSpanish]);

    // Cerrar lista al hacer clic fuera
    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
                setShowList(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    /** Normaliza un string para comparación: minúsculas, sin tildes, sin espacios extra */
    const normalize = (s: string) =>
        s.toLowerCase()
         .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
         .replace(/\s+/g, ' ').trim();

    /** Convierte dd/mm/yyyy → yyyy-mm-dd para buscar en el array ISO */
    const dmy2iso = (s: string): string | null => {
        const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
        if (!m) return null;
        return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    };

    /** Filtra las opciones según lo que el usuario escribió */
    const opcionesFiltradas = React.useMemo(() => {
        const q = normalize(inputText);
        if (!q) return fechasPlaneaciones;
        const iso = dmy2iso(inputText);
        return fechasPlaneaciones.filter((f) => {
            if (iso && f.startsWith(iso)) return true;
            return normalize(toSpanish(f)).includes(q);
        });
    }, [inputText, fechasPlaneaciones, toSpanish]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputText(e.target.value);
        setShowList(true);
        const iso = dmy2iso(e.target.value);
        const exactMatch = fechasPlaneaciones.find(
            (f) => normalize(toSpanish(f)) === normalize(e.target.value) || (iso && f === iso)
        );
        onFechaPlaneacionChange(exactMatch ?? '');
    };

    const handleSelectOption = (iso: string) => {
        setInputText(toSpanish(iso));
        onFechaPlaneacionChange(iso);
        setShowList(false);
    };

    // Guard: todos los hooks ya están declarados arriba
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
                        <div ref={comboRef} className="relative">
                            <input
                                type="text"
                                value={inputText}
                                onChange={handleInputChange}
                                onFocus={() => setShowList(true)}
                                placeholder="Escribe fecha (ej: 02/11/2026) o día..."
                                className="w-full h-9 sm:h-10 rounded-md border border-input bg-background px-3 py-1 text-xs sm:text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                autoComplete="off"
                            />
                            {showList && opcionesFiltradas.length > 0 && (
                                <ul className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-md border border-input bg-background shadow-lg">
                                    {opcionesFiltradas.map((f) => {
                                        const label = toSpanish(f);
                                        // Formato secundario dd/mm/yyyy
                                        const [y, m, d] = f.split('-');
                                        const dmy = `${d}/${m}/${y}`;
                                        return (
                                            <li
                                                key={f}
                                                onMouseDown={() => handleSelectOption(f)}
                                                className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-muted ${
                                                    fechaPlaneacion === f ? 'bg-muted font-semibold text-foreground' : 'text-foreground'
                                                }`}
                                            >
                                                <span>{label}</span>
                                                <span className="text-muted-foreground font-mono text-[10px]">{dmy}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                            {showList && opcionesFiltradas.length === 0 && inputText && (
                                <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-background shadow-lg px-3 py-2 text-xs text-muted-foreground">
                                    Sin resultados para "{inputText}"
                                </div>
                            )}
                        </div>
                        {!fechaPlaneacion && (
                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                                Debes seleccionar la planeación antes de importar.
                            </p>
                        )}
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
                                    <p className="text-sm sm:text-base text-muted-foreground mt-0.5">Clic para seleccionar archivo</p>
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
    const [buscar,        setBuscar]        = useState(filters.buscar ?? '');
    const [docTransporte, setDocTransporte] = useState(filters.doc_transporte ?? '');
    const [fechaDesde,    setFechaDesde]    = useState(filters.fecha_desde ?? '');
    const [fechaHasta,    setFechaHasta]    = useState(filters.fecha_hasta ?? '');
    const [planeacionFecha, setPlaneacionFecha] = useState(filters.planeacion_fecha ?? '');
    const [perPage,         setPerPage]         = useState<number>(Number(filters.per_page) || eventos.per_page || 25);
    const [isRefreshing,    setIsRefreshing]    = useState(false);
    const [showWarning,     setShowWarning]     = useState(true);

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
    const debouncedBuscar        = useDebouncedValue(buscar, 150);
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
                buscar:           overrides.buscar           ?? debouncedBuscar,
                doc_transporte:   overrides.doc_transporte   ?? debouncedDocTransporte,
                fecha_desde:      overrides.fecha_desde      ?? debouncedFechaDesde,
                fecha_hasta:      overrides.fecha_hasta      ?? debouncedFechaHasta,
                planeacion_fecha: overrides.planeacion_fecha ?? planeacionFecha,
                per_page:         overrides.per_page         ?? perPage,
            },
            { preserveState: true, preserveScroll: true, replace: true }
        );
    };

    const handlePerPageChange = (val: string | number) => {
        const n = Number(val);
        setPerPage(n);
        applyFilters({ per_page: n });
    };

    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        applyFilters({});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedPlaca, debouncedBuscar, debouncedDocTransporte, debouncedFechaDesde, debouncedFechaHasta, planeacionFecha]);

    const handleClear = () => {
        setPlaca(''); setBuscar('');
        setDocTransporte(''); setFechaDesde(''); setFechaHasta('');
        setPlaneacionFecha('');
        router.get(route('reparto.eventos-tripulacion.index'), { per_page: perPage }, { preserveState: false });
    };

    const hasActiveFilters = placa || buscar || docTransporte || fechaDesde || fechaHasta || planeacionFecha;

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
        router.post(route('reparto.eventos-tripulacion.store'), fd, {
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
        // Prioridad para determinar la fecha de la plantilla:
        // 1. Fecha seleccionada en el modal de importación
        // 2. Filtro de planeación exacta (planeacion_fecha en el estado)
        // 3. Filtro fecha_desde (si está activo y es una fecha exacta)
        // 4. Si no hay nada, el servidor usa today() por defecto
        const iso = /^\d{4}-\d{2}-\d{2}$/;
        const fechaEfectiva =
            (fechaImport      && iso.test(fechaImport))      ? fechaImport      :
            (planeacionFecha  && iso.test(planeacionFecha))  ? planeacionFecha  :
            (fechaDesde       && iso.test(fechaDesde))       ? fechaDesde       :
            null;

        const url = new URL(route('reparto.eventos-tripulacion.template'), window.location.origin);
        if (fechaEfectiva) {
            url.searchParams.set('fecha', fechaEfectiva);
        }
        window.location.href = url.toString();
    };

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Eventos Diarios" />

            <div className="w-full max-w-[1900px] mx-auto px-2 sm:px-3 lg:px-4 py-4 sm:py-5 flex flex-1 flex-col gap-4 sm:gap-5 min-w-0 box-border">

                {/* Flash success */}
                {flash?.success && (
                    <div className="flex items-start gap-2 sm:gap-3 rounded-lg border border-green-200 bg-green-50 p-2.5 sm:p-3 text-green-800">
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

                {/* ── Card 1: Título ─────────────────────────────────────────────── */}
                <div className="rounded-2xl border border-border/70 bg-card shadow-sm px-8 py-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div
                                className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl shadow-sm shrink-0"
                                style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%)' }}
                            >
                                <Users className="h-7 w-7 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                                    Eventos Diarios
                                </h1>
                                <p className="text-sm sm:text-base text-muted-foreground mt-0.5">
                                    {eventos.total} registro{eventos.total !== 1 ? 's' : ''} de tripulación
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2 flex-wrap items-center">

                            {/* Selector de columnas */}
                            <div className="relative">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowColPicker((v) => !v)}
                                    className="h-8 text-xs text-green-700 border-green-300 hover:bg-green-50"
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
                                size="sm"
                                onClick={handleDownloadTemplate}
                                className="h-8 text-xs border-green-300 text-green-700 hover:bg-green-50"
                            >
                                <Download className="h-3.5 w-3.5 mr-1 sm:mr-1.5" />
                                <span className="hidden sm:inline">Plantilla</span>
                                <span className="sm:hidden">Plant.</span>
                            </Button>

                            <a
                                href={route('reparto.eventos-tripulacion.exportar', {
                                    placa:            placa            || undefined,
                                    buscar:           buscar           || undefined,
                                    doc_transporte:   docTransporte    || undefined,
                                    fecha_desde:      fechaDesde       || undefined,
                                    fecha_hasta:      fechaHasta       || undefined,
                                    planeacion_fecha: planeacionFecha  || undefined,
                                } as Record<string, string>)}
                            >
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs border-green-300 text-green-700 hover:bg-green-50"
                                >
                                    <Download className="h-3.5 w-3.5 mr-1 sm:mr-1.5" />
                                    <span className="hidden sm:inline">Exportar</span>
                                    <span className="sm:hidden">Exp.</span>
                                </Button>
                            </a>

                            <Button
                                size="sm"
                                onClick={() => setShowImportModal(true)}
                                className="h-8 text-xs font-semibold text-white hover:brightness-110 border border-white/30"
                                style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%)' }}
                            >
                                <Upload className="h-3.5 w-3.5 mr-1 sm:mr-1.5" />
                                <span className="hidden sm:inline">Subir Excel</span>
                                <span className="sm:hidden">Subir</span>
                            </Button>

                            <Button
                                size="sm"
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                className="h-8 text-xs text-white font-semibold hover:brightness-110 border border-white/30"
                                style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%)' }}
                            >
                                <RefreshCw className={`h-3.5 w-3.5 mr-1 sm:mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                                {isRefreshing ? (
                                    <><span className="hidden sm:inline">Actualizando...</span><span className="sm:hidden">Act.</span></>
                                ) : (
                                    <><span className="hidden sm:inline">Actualizar</span><span className="sm:hidden">Act.</span></>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
                {/* ── Fin Card 1 ─────────────────────────────────────────────────── */}

                {/* ── Card 2: Filtros ─────────────────────────────────────────────── */}
                <div className="rounded-2xl border border-border/70 bg-card shadow-sm px-6 py-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Filter className="h-3.5 w-3.5 text-green-700 dark:text-green-400" />
                            Filtros de búsqueda
                        </span>
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 hover:underline cursor-pointer transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
                        <div className="grid gap-1">
                            <Label className="text-[11px] font-medium text-muted-foreground flex items-center">
                                <MapPin className="h-3 w-3 inline mr-1 text-muted-foreground/70" />Placa
                            </Label>
                            <Input
                                placeholder="Ej: COLJV386"
                                value={placa}
                                onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                                className="uppercase font-mono text-xs h-8.5 rounded-lg"
                            />
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[11px] font-medium text-muted-foreground flex items-center">
                                <Users className="h-3 w-3 inline mr-1 text-muted-foreground/70" />Colaborador
                            </Label>
                            <Input
                                placeholder="Cédula o nombre..."
                                value={buscar}
                                onChange={(e) => setBuscar(e.target.value)}
                                className="text-xs h-8.5 rounded-lg"
                            />
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[11px] font-medium text-muted-foreground flex items-center">
                                <FileSpreadsheet className="h-3 w-3 inline mr-1 text-muted-foreground/70" />Doc.
                            </Label>
                            <Input
                                placeholder="Ej: OTM-123456"
                                value={docTransporte}
                                onChange={(e) => setDocTransporte(e.target.value)}
                                className="font-mono text-xs h-8.5 rounded-lg"
                            />
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[11px] font-medium text-muted-foreground flex items-center">
                                <Calendar className="h-3 w-3 inline mr-1 text-muted-foreground/70" />F. Desde
                            </Label>
                            <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="text-xs h-8.5 rounded-lg" />
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[11px] font-medium text-muted-foreground flex items-center">
                                <Calendar className="h-3 w-3 inline mr-1 text-muted-foreground/70" />F. Hasta
                            </Label>
                            <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="text-xs h-8.5 rounded-lg" />
                        </div>
                    </div>
                </div>
                {/* ── Fin Card 2 ─────────────────────────────────────────────────── */}

                {/* ── Card 2: Tabla ──────────────────────────────────────────────── */}
                <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
                <div className="rounded-xl overflow-hidden border border-emerald-200/80 dark:border-emerald-800/80 bg-card shadow-xs">
                    <div
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-emerald-200/80 dark:border-emerald-800/80"
                        style={{
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.18) 100%)',
                            backdropFilter: 'blur(8px)',
                        }}
                    >
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-8 w-10 text-emerald-800 dark:text-emerald-300 shrink-0" />
                            <span className="text-sm font-extrabold text-emerald-950 dark:text-white tracking-wide">
                                Registros de eventos
                            </span>
                            {eventos.from !== null && (
                                <Badge className="ml-2 text-[10px] sm:text-xs whitespace-nowrap bg-emerald-500/20 text-emerald-900 dark:text-emerald-100 border border-emerald-400/40">
                                    {eventos.from}–{eventos.to} / {eventos.total}
                                </Badge>
                            )}
                        </div>

                        {/* Selector de cantidad de registros */}
                        <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-emerald-900 dark:text-emerald-200">
                            <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">Mostrar:</span>
                            <select
                                value={perPage}
                                onChange={(e) => handlePerPageChange(e.target.value)}
                                className="h-7.5 rounded-lg border border-emerald-300/80 dark:border-emerald-700 bg-white/90 dark:bg-card px-2 text-xs font-semibold text-emerald-950 dark:text-emerald-100 shadow-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                            >
                                <option value="10">10 registros</option>
                                <option value="25">25 registros</option>
                                <option value="50">50 registros</option>
                                <option value="100">100 registros</option>
                                <option value="200">200 registros</option>
                            </select>
                        </div>
                    </div>
                        <div className="overflow-x-auto">
                            <Table className="text-[10px] sm:text-xs whitespace-nowrap w-full">
                                <TableHeader className="sticky top-0 z-10">
                                    <TableRow
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.16) 0%, rgba(5, 150, 105, 0.24) 100%)',
                                            backdropFilter: 'blur(8px)',
                                        }}
                                        className="border-b border-emerald-200/80 dark:border-emerald-800/80 hover:bg-transparent"
                                    >
                                        <TableHead className="font-bold px-2 sm:px-3 py-2 text-[10px] sm:text-xs text-emerald-950 dark:text-emerald-100 border-r border-emerald-300/40 dark:border-emerald-800/60 whitespace-nowrap text-center w-10">
                                            #
                                        </TableHead>
                                        {columnasMostradas.map(([k, label]) => (
                                            <TableHead
                                                key={k}
                                                className="font-bold px-2.5 sm:px-3 py-2 text-[10px] sm:text-xs text-emerald-950 dark:text-emerald-100 border-r border-emerald-300/40 dark:border-emerald-800/60 last:border-r-0 whitespace-nowrap"
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
                                                colSpan={columnasMostradas.length + 1}
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
                                        eventos.data.map((evento, idx) => (
                                            <TableRow
                                                key={evento.id}
                                                className="hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40 transition-colors border-b border-emerald-100/80 dark:border-emerald-900/40"
                                            >
                                                <TableCell className="px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs text-center font-semibold text-emerald-700 dark:text-emerald-400 border-r border-emerald-100/80 dark:border-emerald-900/40 w-10 select-none">
                                                    {(eventos.current_page - 1) * eventos.per_page + idx + 1}
                                                </TableCell>
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
                            <div
                                className="flex justify-center px-4 py-3 border-t border-emerald-200/80 dark:border-emerald-800/80"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.14) 100%)',
                                    backdropFilter: 'blur(8px)',
                                }}
                            >
                                <div className="flex gap-1 flex-wrap justify-center">
                                    {eventos.links.map((link, i) => (
                                        <Button
                                            key={i}
                                            size="sm"
                                            variant={link.active ? 'default' : 'outline'}
                                            disabled={!link.url}
                                            onClick={() => link.url && router.get(link.url, {}, { preserveScroll: true })}
                                            className={`h-7 sm:h-8 min-w-[1.75rem] sm:min-w-[2rem] px-2 text-xs flex-1 sm:flex-none ${
                                                link.active
                                                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs hover:bg-emerald-700'
                                                    : 'border-emerald-200/80 text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/60'
                                            }`}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                </div>{/* fin tabla inner */}
                </div>{/* fin Card 2 */}
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
