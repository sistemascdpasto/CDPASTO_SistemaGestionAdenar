import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Filler,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
} from 'chart.js';
import {
    AlertTriangle,
    AlertCircle,
    CalendarDays,
    Calendar,
    Check,
    CheckCircle2,
    ChevronsUpDown,
    Clock,
    Fingerprint,
    Download,
    Eye,
    FileSpreadsheet,
    Filter,
    LoaderCircle,
    MapPin,
    RefreshCw,
    TrendingDown,
    TrendingUp,
    Users,
    DollarSign,
    X,
    Target,
    Truck,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler, Tooltip, Legend, ChartDataLabels);

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Compensación Variable Diaria', href: '/modules/reparto/compensacion-variable-diaria' },
];

// ─── Paleta (tomada de Mi Compensación Diaria · vista colaborador VERDE) ─────
const COLOR_MODULO  = '#15803d';
const COLOR_SUCCESS = '#15803d';
const COLOR_WARNING = '#f59e0b';
const COLOR_CRITICAL= '#dc2626';
const COLOR_BLUE    = '#3b82f6';
const COLOR_PURPLE  = '#8b5cf6';
const COLOR_CYAN    = '#0891b2';
const COLOR_ROSE    = '#059669';

export interface CompensacionDiariaRow {
    id: number;
    fecha: string | null;
    anio: number | null;
    mes: string | null;
    placa: string | null;
    transporte: string | null;
    rr: string | null;
    cedula: string | null;
    nombre_completo: string | null;
    cargo: string | null;
    rechazos: number;
    cal_rechazos: number;
    cal_rechazos_2: number;
    valor_x_dia: number;
    valor_var: number;
    valor_perdido: number;
    porcentaje_variable: string | null;
    porcentaje_variable_no_cum: string | null;
    meta_1: number;
    meta_2: number;
}

interface PaginationLink { url: string | null; label: string; active: boolean; }

interface Paginator {
    data: CompensacionDiariaRow[];
    links: PaginationLink[];
    total: number;
    current_page: number;
    per_page: number;
}

interface IndicadoresGlobales {
    total_registros: number;
    total_rechazos: number;
    total_cal_rechazos: number;
    total_cal_rechazos_2: number;
    total_valor_x_dia: number;
    total_valor_var: number;
    total_valor_perdido: number;
    total_meta_1: number;
    total_meta_2: number;
    prom_rechazos: number;
    colaboradores_unicos: number;
    vehiculos_unicos: number;
}

interface TotalesPorDia {
    fechas: string[];
    rechazos: number[];
    valor_x_dia: number[];
    valor_var: number[];
    valor_perdido: number[];
}

interface TotalesMensuales {
    meses: string[];
    rechazos: number[];
    valor_var: number[];
    valor_perdido: number[];
    meta_1: number[];
    meta_2: number[];
}

interface Catalogos {
    anios: number[];
    meses: string[];
    cargos: string[];
    cedulas: string[];
    nombres: string[];
    placas: string[];
    transportes: string[];
    rrs: string[];
}

interface FiltrosReales {
    fecha_desde?: string;
    fecha_hasta?: string;
    anio?: number | string;
    mes?: string | string[];
    cedula?: string | string[];
    nombre_completo?: string | string[];
    cargo?: string | string[];
    placa?: string | string[];
    transporte?: string | string[];
    rr?: string | string[];
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount || 0);
}

function formatDate(d: string | null): string {
    if (!d) return '-';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Mini sparkline SVG (estilo Adherencia al Tiempo) ────────────────────────
function Spark({ data, color = COLOR_SUCCESS, h = 32, w = 100 }: { data: number[]; color?: string; h?: number; w?: number }) {
    if (data.length < 2) return null;
    const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
    const pts = data.map((v, i) =>
        `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`
    ).join(' ');
    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
            {/* polyline */}<polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}

const COLUMNAS: [keyof CompensacionDiariaRow, string, boolean][] = [
    ['fecha', 'Fecha', true],
    ['anio', 'Año', false],
    ['placa', 'Placa', true],
    ['transporte', 'Transporte', false],
    ['cedula', 'Cédula', true],
    ['nombre_completo', 'Nombre Completo', true],
    ['cargo', 'Cargo', true],
    ['rechazos', 'Rechazos', true],
    ['valor_x_dia', 'Valor x Día', true],
    ['valor_perdido', 'Valor Perdido', true],
    ['meta_1', 'Meta 100% (< 2,0%)', false],
    ['meta_2', 'Meta 80% (< 2,4%)', true],
    ['valor_var', 'Valor Ganado', true],
];

const MESES_ES: Record<number, string> = {
    1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
    5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
    9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
};



// ─── KpiCard (estilo Adherencia al Tiempo, colores paleta CV) ────────────────
function KpiCard({ label, value, sub, icon: Icon, color, spark, sparkColor }:
    { label: string; value: string; sub?: string; icon?: React.ElementType; color: string; spark?: number[]; sparkColor?: string }) {
    return (
        <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm p-4 flex flex-col justify-between gap-2">
            <div className="flex items-start justify-between">
                <p className="text-[11px] font-semibold text-muted-foreground leading-tight">{label}</p>
                {Icon && <Icon className="h-4 w-4 shrink-0" style={{ color }} />}
            </div>
            <p className="text-2xl font-extrabold" style={{ color }}>{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
            {spark && spark.length > 1 && (
                <div className="mt-1">
                    <Spark data={spark} color={sparkColor ?? color} h={28} w={90} />
                </div>
            )}
        </div>
    );
}

// ─── Gráficas (versión compacta · 3 en una fila) ─────────────────────────────
function GraficoBarrasValorDiario({ data }: { data: TotalesPorDia }) {
    const labels = (data?.fechas || []).map(f => {
        const dt = new Date(f);
        return isNaN(dt.getTime()) ? f : `${dt.getDate()}/${dt.getMonth() + 1}`;
    });
    const chartData = {
        labels,
        datasets: [
            { label: 'Valor Variable ($)', data: data?.valor_var || [], backgroundColor: `${COLOR_SUCCESS}b3`, borderColor: COLOR_SUCCESS, borderWidth: 1 },
            { label: 'Valor Perdido ($)', data: data?.valor_perdido || [], backgroundColor: `${COLOR_CRITICAL}a6`, borderColor: COLOR_CRITICAL, borderWidth: 1 },
        ],
    };

    if ((data?.fechas || []).length === 0) {
        return (
            <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm p-3">
                <h3 className="text-[11px] font-bold text-muted-foreground mb-0.5 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 shrink-0" style={{ color: COLOR_SUCCESS }} />
                    Valor Variable vs Perdido
                </h3>
                <p className="text-[9px] text-muted-foreground mb-2">Comparativa diaria</p>
                <div className="h-36 flex items-center justify-center text-muted-foreground text-xs">Sin datos</div>
            </div>
        );
    }

    return (
        <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm p-3">
            <h3 className="text-[11px] font-bold text-muted-foreground mb-0.5 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 shrink-0" style={{ color: COLOR_SUCCESS }} />
                Valor Variable vs Perdido
            </h3>
            <p className="text-[9px] text-muted-foreground mb-2">Comparativa diaria</p>
            <div style={{ height: 160 }}>
                <Bar data={chartData} options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, datalabels: { display: false } },
                    scales: {
                        x: { ticks: { color: '#9ca3af', font: { size: 8 } }, grid: { display: false } },
                        y: { beginAtZero: true, ticks: { color: '#9ca3af', font: { size: 8 }, callback: (v: string | number) => '$' + Number(v).toLocaleString('es-CO', { maximumFractionDigits: 0, notation: 'compact' }), maxTicksLimit: 5 }, grid: { color: 'rgba(0,0,0,.04)' } }
                    }
                }} />
            </div>
        </div>
    );
}

function GraficoLineaRechazos({ data }: { data: TotalesPorDia }) {
    const labels = (data?.fechas || []).map(f => {
        const dt = new Date(f);
        return isNaN(dt.getTime()) ? f : `${dt.getDate()}/${dt.getMonth() + 1}`;
    });
    const chartData = {
        labels,
        datasets: [{
            label: '% Rechazos',
            data: data?.rechazos || [],
            borderColor: COLOR_WARNING,
            backgroundColor: `${COLOR_WARNING}26`,
            borderWidth: 2, tension: 0.4, fill: true, pointRadius: 2,
        }],
    };

    if ((data?.fechas || []).length === 0) {
        return (
            <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm p-3">
                <h3 className="text-[11px] font-bold text-muted-foreground mb-0.5 flex items-center gap-1.5">
                    <TrendingDown className="h-3.5 w-3.5 shrink-0" style={{ color: COLOR_WARNING }} />
                    Tendencia Rechazos
                </h3>
                <p className="text-[9px] text-muted-foreground mb-2">Evolución diaria</p>
                <div className="h-36 flex items-center justify-center text-muted-foreground text-xs">Sin datos</div>
            </div>
        );
    }

    return (
        <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm p-3">
            <h3 className="text-[11px] font-bold text-muted-foreground mb-0.5 flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5 shrink-0" style={{ color: COLOR_WARNING }} />
                Tendencia Rechazos
            </h3>
            <p className="text-[9px] text-muted-foreground mb-2">Evolución diaria</p>
            <div style={{ height: 160 }}>
                <Line data={chartData} options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, datalabels: { display: false } },
                    scales: {
                        x: { ticks: { color: '#9ca3af', font: { size: 8 } }, grid: { display: false } },
                        y: { beginAtZero: true, ticks: { color: '#9ca3af', font: { size: 8 }, callback: (v: string | number) => `${v}%`, maxTicksLimit: 5 }, grid: { color: 'rgba(0,0,0,.04)' } }
                    }
                }} />
            </div>
        </div>
    );
}

function GraficoBarrasMensual({ data }: { data: TotalesMensuales }) {
    const labels = data?.meses || [];
    const chartData = {
        labels,
        datasets: [
            { label: 'Valor Var ($)', data: data?.valor_var || [], backgroundColor: `${COLOR_MODULO}b3`, borderColor: COLOR_MODULO, borderWidth: 1 },
            { label: 'Meta 1 (< 2,0%)', data: data?.meta_1 || [], backgroundColor: `${COLOR_SUCCESS}80`, borderColor: COLOR_SUCCESS, borderWidth: 1 },
            { label: 'Meta 2 (< 2,4%)', data: data?.meta_2 || [], backgroundColor: `${COLOR_PURPLE}80`, borderColor: COLOR_PURPLE, borderWidth: 1 },
        ],
    };

    const hayDatos = (data?.valor_var || []).some(v => v > 0) || (data?.meta_1 || []).some(v => v > 0) || (data?.meta_2 || []).some(v => v > 0);

    if (!hayDatos) {
        return (
            <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm p-3">
                <h3 className="text-[11px] font-bold text-muted-foreground mb-0.5 flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" style={{ color: COLOR_MODULO }} />
                    Totales Mensuales vs Metas
                </h3>
                <p className="text-[9px] text-muted-foreground mb-2">Acumulado mensual</p>
                <div className="h-36 flex items-center justify-center text-muted-foreground text-xs">Sin datos</div>
            </div>
        );
    }

    return (
        <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm p-3">
            <h3 className="text-[11px] font-bold text-muted-foreground mb-0.5 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" style={{ color: COLOR_MODULO }} />
                Totales Mensuales vs Metas
            </h3>
            <p className="text-[9px] text-muted-foreground mb-2">Acumulado mensual</p>
            <div style={{ height: 160 }}>
                <Bar data={chartData} options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, datalabels: { display: false } },
                    scales: {
                        x: { ticks: { color: '#6b7280', font: { size: 8 } }, grid: { display: false } },
                        y: { beginAtZero: true, ticks: { color: '#9ca3af', font: { size: 8 }, callback: (v: string | number) => '$' + Number(v).toLocaleString('es-CO', { maximumFractionDigits: 0, notation: 'compact' }), maxTicksLimit: 5 }, grid: { color: 'rgba(0,0,0,.04)' } }
                    }
                }} />
            </div>
        </div>
    );
}

// ─── Filtros (estilo Adherencia al Tiempo) ────────────────────────────────────
function MultiSelectSearchable({ label, placeholder, selectedValues, options, onChange }:
    { label: string; placeholder?: string; selectedValues?: string | string[]; options?: (string | number)[]; onChange: (vals: string[]) => void; }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const selectedArr = useMemo(() => {
        if (!selectedValues) return [] as string[];
        return Array.isArray(selectedValues) ? selectedValues.map(String) : String(selectedValues).split(',').map(s => s.trim()).filter(Boolean);
    }, [selectedValues]);
    const filtered = useMemo(() => {
        const opts = (options || []).map(String);
        if (!search) return opts;
        return opts.filter(o => o.toLowerCase().includes(search.toLowerCase()));
    }, [options, search]);
    const toggle = (val: string) => {
        const next = selectedArr.includes(val) ? selectedArr.filter(v => v !== val) : [...selectedArr, val];
        onChange(next);
    };
    return (
        <div className="relative grid gap-1">
            <Label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                <Filter className="h-3 w-3 inline shrink-0" style={{ color: COLOR_MODULO }} />
                {label}
            </Label>
            <button type="button" onClick={() => setOpen(!open)}
                className="h-8 w-full rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-card px-2 text-left text-xs flex items-center justify-between gap-1 hover:border-border focus:ring-1 focus:outline-none"
                style={{ '--tw-ring-color': COLOR_MODULO } as React.CSSProperties}>
                <span className={`truncate ${selectedArr.length ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {selectedArr.length ? `${selectedArr.length} seleccionado(s)` : placeholder || 'Todos...'}
                </span>
                <ChevronsUpDown className="size-3 text-muted-foreground shrink-0" />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setSearch(''); }} />
                    <div className="absolute z-20 mt-1 w-full rounded-xl border border-sidebar-border/70 dark:border-sidebar-border bg-card shadow-md max-h-60 overflow-y-auto">
                        <div className="sticky top-0 p-1.5 bg-card border-b border-sidebar-border/70 dark:border-sidebar-border">
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..."
                                className="w-full rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-transparent px-2 py-1 text-[11px] focus:outline-none" />
                        </div>
                        <div className="py-1">
                            {filtered.length === 0 && <div className="px-2 py-1.5 text-[11px] text-muted-foreground">Sin resultados</div>}
                            {filtered.map((opt) => (
                                <div key={opt} onClick={() => toggle(opt)}
                                    className={`cursor-pointer px-3 py-1 text-[11px] flex items-center gap-2 ${selectedArr.includes(opt)
                                        ? 'text-foreground'
                                        : 'hover:bg-muted/60 text-foreground'}`}
                                    style={selectedArr.includes(opt) ? { background: `${COLOR_MODULO}10` } : {}}>
                                    <span className="flex h-3 w-3 items-center justify-center rounded-sm border border-input"
                                        style={selectedArr.includes(opt) ? { background: COLOR_MODULO, borderColor: COLOR_MODULO, color: '#fff' } : {}}>
                                        {selectedArr.includes(opt) && <Check className="size-2.5" />}
                                    </span>
                                    <span className="truncate">{opt}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Gráficas de barras horizontales por rol ─────────────────────────────────
interface BarEntry { nombre: string; valor: number; }

// ─── Descarga: canvas nativo puro (sin html2canvas) ──────────────────────────
// Dibuja encabezado (título, subtítulo, total) + copia el canvas de Chart.js
// en un offscreen a 4× con fondo blanco → sin dependencia de colores CSS modernos.
function descargarCardNativa(
    chartCanvasRef: React.RefObject<HTMLDivElement | null>,
    titulo: string,
    subtitulo: string,
    total: string,
    color: string,
    nombre: string,
) {
    const wrapper = chartCanvasRef.current;
    if (!wrapper) return;
    const srcCanvas = wrapper.querySelector('canvas');
    if (!srcCanvas) return;

    const ESCALA   = 4;
    const PAD      = 20 * ESCALA;
    const H_HEADER = 72 * ESCALA;   // zona de encabezado sobre la gráfica

    const W = srcCanvas.width  * ESCALA;
    const H = srcCanvas.height * ESCALA + H_HEADER + PAD;

    const off = document.createElement('canvas');
    off.width  = W;
    off.height = H;

    const ctx = off.getContext('2d');
    if (!ctx) return;

    // ── Fondo blanco ──
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // ── Franja de color sutil en el encabezado ──
    ctx.fillStyle = `${color}18`;
    ctx.fillRect(0, 0, W, H_HEADER);

    // ── Acento lateral ──
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 6 * ESCALA, H_HEADER);

    // ── Título ──
    ctx.fillStyle = '#111827';
    ctx.font = `bold ${13 * ESCALA}px Inter, system-ui, sans-serif`;
    ctx.fillText(titulo, PAD + 8 * ESCALA, 26 * ESCALA);

    // ── Subtítulo ──
    ctx.fillStyle = '#6b7280';
    ctx.font = `${10 * ESCALA}px Inter, system-ui, sans-serif`;
    ctx.fillText(subtitulo, PAD + 8 * ESCALA, 42 * ESCALA);

    // ── Total ──
    ctx.fillStyle = color;
    ctx.font = `bold ${11 * ESCALA}px Inter, system-ui, sans-serif`;
    ctx.fillText(total, PAD + 8 * ESCALA, 60 * ESCALA);

    // ── Gráfica ──
    ctx.drawImage(srcCanvas, 0, H_HEADER, W, srcCanvas.height * ESCALA);

    // ── Borde gris claro alrededor de toda la card ──
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth   = 2 * ESCALA;
    ctx.strokeRect(0, 0, W, H);

    const url   = off.toDataURL('image/png', 1.0);
    const link  = document.createElement('a');
    link.href     = url;
    link.download = `${nombre}.png`;
    link.click();
}

function GraficoBarrasHorizontalesPorRol({
    titulo,
    subtitulo,
    entries,
    color,
    icon: Icon,
    nombreArchivo,
    fixedChartHeight,
}: {
    titulo: string;
    subtitulo: string;
    entries: BarEntry[];
    color: string;
    icon: React.ElementType;
    nombreArchivo: string;
    fixedChartHeight?: number;
}) {
    // ref sobre el div que envuelve el <Bar> (solo el canvas de Chart.js)
    const chartWrapperRef = useRef<HTMLDivElement | null>(null);
    const [descargando, setDescargando] = useState(false);

    const totalFormateado = new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', maximumFractionDigits: 0,
    }).format(entries.reduce((s, e) => s + e.valor, 0));

    const handleDescargar = () => {
        setDescargando(true);
        // Pequeño timeout para que el spinner se pinte antes de bloquear el hilo
        setTimeout(() => {
            try {
                descargarCardNativa(
                    chartWrapperRef,
                    titulo,
                    subtitulo,
                    `Total: ${totalFormateado}`,
                    color,
                    nombreArchivo,
                );
            } finally {
                setDescargando(false);
            }
        }, 50);
    };

    if (entries.length === 0) {
        return (
            <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm p-4">
                <h3 className="text-[11px] font-bold text-muted-foreground mb-0.5 flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                    {titulo}
                </h3>
                <p className="text-[9px] text-muted-foreground mb-2">{subtitulo}</p>
                <div className="h-36 flex items-center justify-center text-muted-foreground text-xs">Sin datos</div>
            </div>
        );
    }

    const sorted = [...entries].sort((a, b) => b.valor - a.valor).slice(0, 15);
    const max = sorted[0]?.valor || 1;

    const chartData = {
        labels: sorted.map(e => {
            const parts = e.nombre.trim().split(' ');
            if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
            return e.nombre;
        }),
        datasets: [{
            label: 'Valor Ganado ($)',
            data: sorted.map(e => e.valor),
            backgroundColor: color,
            borderColor: color,
            borderWidth: 0,
            borderRadius: 4,
        }],
    };

    const chartHeight = fixedChartHeight ?? Math.max(180, sorted.length * 30);

    return (
        <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm p-4">
            {/* Header: título + controles */}
            <div className="flex items-start justify-between mb-0.5">
                <h3 className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                    {titulo}
                </h3>
                <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${color}25`, color }}>
                        {sorted.length} personas
                    </span>
                    <button
                        type="button"
                        title="Descargar imagen de esta gráfica"
                        onClick={handleDescargar}
                        disabled={descargando}
                        className="flex items-center justify-center h-5 w-5 rounded hover:bg-muted/70 transition-colors disabled:opacity-50"
                        style={{ color: '#9ca3af' }}
                        onMouseEnter={e => { if (!descargando) e.currentTarget.style.color = color; }}
                        onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
                    >
                        {descargando
                            ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            : <Download className="h-3.5 w-3.5" />
                        }
                    </button>
                </div>
            </div>
            <p className="text-[9px] text-muted-foreground mb-1">{subtitulo}</p>
            <p className="text-xs font-extrabold mb-3" style={{ color }}>
                Total: {totalFormateado}
            </p>
            {/* ref solo sobre el wrapper del canvas de Chart.js */}
            <div ref={chartWrapperRef} style={{ height: chartHeight }}>
                <Bar
                    data={chartData}
                    plugins={[ChartDataLabels]}
                    options={{
                        indexAxis: 'y' as const,
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: { padding: { right: 72 } },
                        plugins: {
                            legend: { display: false },
                            tooltip: { enabled: false },
                            datalabels: {
                                anchor: 'end',
                                align: 'end',
                                clip: false,
                                color: '#6b7280',
                                font: { size: 9, weight: 'bold' as const },
                                formatter: (value: number) =>
                                    new Intl.NumberFormat('es-CO', {
                                        style: 'currency',
                                        currency: 'COP',
                                        maximumFractionDigits: 0,
                                    }).format(value),
                            },
                        },
                        scales: {
                            x: {
                                beginAtZero: true,
                                max: max * 1.75,
                                display: false,
                                grid: { display: false },
                            },
                            y: {
                                ticks: {
                                    color: '#6b7280',
                                    font: { size: 9 },
                                    crossAlign: 'far' as const,
                                },
                                grid: { display: false },
                            },
                        },
                    }}
                />
            </div>
        </div>
    );
}

// Guards defensivos fuera del componente (constantes)
const DEFAULT_PAGINATOR: Paginator = { data: [], links: [], total: 0, current_page: 1, per_page: 25 };
const DEFAULT_INDICADORES: IndicadoresGlobales = { total_registros: 0, total_rechazos: 0, total_cal_rechazos: 0, total_cal_rechazos_2: 0, total_valor_x_dia: 0, total_valor_var: 0, total_valor_perdido: 0, total_meta_1: 0, total_meta_2: 0, prom_rechazos: 0, colaboradores_unicos: 0, vehiculos_unicos: 0 };
const DEFAULT_TOTALES_DIA: TotalesPorDia = { fechas: [], rechazos: [], valor_x_dia: [], valor_var: [], valor_perdido: [] };
const DEFAULT_TOTALES_MES: TotalesMensuales = { meses: [], rechazos: [], valor_var: [], valor_perdido: [], meta_1: [], meta_2: [] };
const DEFAULT_CATALOGOS: Catalogos = { anios: [], meses: [], cargos: [], cedulas: [], nombres: [], placas: [], transportes: [], rrs: [] };

export default function CompensacionVariableDiariaIndex() {
    const pageProps = usePage<Record<string, unknown>>().props || {};

    console.log('CompensacionVariableDiariaIndex pageProps:', pageProps);

    const data: Paginator = (pageProps.data as Paginator) ?? DEFAULT_PAGINATOR;
    const indicadores: IndicadoresGlobales = (pageProps.indicadores as IndicadoresGlobales) ?? DEFAULT_INDICADORES;
    const totales_por_dia: TotalesPorDia = (pageProps.totales_por_dia as TotalesPorDia) ?? DEFAULT_TOTALES_DIA;
    const totales_mensuales: TotalesMensuales = (pageProps.totales_mensuales as TotalesMensuales) ?? DEFAULT_TOTALES_MES;
    const filters: FiltrosReales = pageProps.filters || {};
    const catalogos: Catalogos = (pageProps.catalogos as Catalogos) || DEFAULT_CATALOGOS;
    // El controlador usa ->with('status', [...]) que el middleware comparte como pageProps.status
    const statusAlert = (pageProps.status as { type: string, message: string }) || null;

    console.log('CompensacionVariableDiariaIndex data:', { data, indicadores, totales_por_dia, totales_mensuales, filters, catalogos });

    const LS_HIDE_COLS = 'cvd_hidden_cols_v1';
    const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
        try { const s = localStorage.getItem(LS_HIDE_COLS); return s ? new Set(JSON.parse(s)) : new Set(COLUMNAS.filter(([,, h]) => !h).map(([k]) => k)); } catch { return new Set(); }
    });
    useEffect(() => { try { localStorage.setItem(LS_HIDE_COLS, JSON.stringify(Array.from(hiddenCols))); } catch { /* empty */ } }, [hiddenCols]);
    const toggleCol = (k: string) => { const next = new Set(hiddenCols); if (next.has(k)) next.delete(k); else next.add(k); setHiddenCols(next); };
    const [colsModalOpen, setColsModalOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedRow, setSelectedRow] = useState<CompensacionDiariaRow | null>(null);
    const [historialRow, setHistorialRow] = useState<CompensacionDiariaRow[]>([]);
    const [historialPag, setHistorialPag] = useState(1);
    const HIST_PER_PAGE = 15;
    const [calcularModalOpen, setCalcularModalOpen] = useState(false);

    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1;
    const [calcularForm, setCalcularForm] = useState({ anio: anioActual, mes: mesActual });

    useEffect(() => {
        if (calcularModalOpen) {
            setCalcularForm({ anio: anioActual, mes: mesActual });
        }
    }, [calcularModalOpen, anioActual, mesActual]);

    const aniosDisponibles = useMemo(() => {
        const arr: number[] = [];
        for (let y = anioActual - 3; y <= anioActual + 1; y++) arr.push(y);
        return arr;
    }, [anioActual]);

    const periodoSeleccionado = useMemo(() => {
        const m = MESES_ES[calcularForm.mes] || `Mes ${calcularForm.mes}`;
        return `${m} de ${calcularForm.anio}`;
    }, [calcularForm]);

    const { processing: processingCalcular } = useForm({});

    const handleCalcular = () => {
        router.post(route('reparto.compensacion-variable-diaria.calcular'), {
            anio: calcularForm.anio,
            mes: calcularForm.mes,
        }, {
            onSuccess: () => setCalcularModalOpen(false),
        });
    };

    const parseFilterArray = (val: string | string[] | undefined): string[] => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        return val.split(',').map((s) => s.trim()).filter(Boolean);
    };

    const hoyDate = new Date();
    const primerDiaMes = `${hoyDate.getFullYear()}-${String(hoyDate.getMonth() + 1).padStart(2, '0')}-01`;
    const ultimoDiaMes = new Date(hoyDate.getFullYear(), hoyDate.getMonth() + 1, 0).toISOString().split('T')[0];

    const [formFilters, setFormFilters] = useState<FiltrosReales & { anio?: number | string; mes?: string | string[]; cedula?: string | string[]; nombre_completo?: string | string[]; cargo?: string | string[]; placa?: string | string[]; transporte?: string | string[]; }>({
        fecha_desde: (filters.fecha_desde as string) || primerDiaMes,
        fecha_hasta: (filters.fecha_hasta as string) || ultimoDiaMes,
        cargo: parseFilterArray(filters.cargo),
        cedula: parseFilterArray(filters.cedula),
        nombre_completo: parseFilterArray(filters.nombre_completo),
        placa: parseFilterArray(filters.placa),
        transporte: parseFilterArray(filters.transporte),
    });
    const filtersKey = JSON.stringify(filters);
    useEffect(() => {
        setFormFilters(prev => ({
            ...prev,
            fecha_desde: (filters.fecha_desde as string) || primerDiaMes,
            fecha_hasta: (filters.fecha_hasta as string) || ultimoDiaMes,
            cargo: parseFilterArray(filters.cargo),
            cedula: parseFilterArray(filters.cedula),
            nombre_completo: parseFilterArray(filters.nombre_completo),
            placa: parseFilterArray(filters.placa),
            transporte: parseFilterArray(filters.transporte),
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filtersKey]);

    const executeFilterQuery = (filtersObj: typeof formFilters) => {
        const cleanParams: Record<string, string> = {};
        Object.entries(filtersObj).forEach(([k, v]) => {
            if (Array.isArray(v)) {
                if (v.length > 0) cleanParams[k] = v.join(',');
            } else if (v !== '' && v !== null && v !== undefined) {
                cleanParams[k] = String(v);
            }
        });
        router.get(route('reparto.compensacion-variable-diaria.index'), cleanParams, {
            preserveState: true, preserveScroll: true, replace: true,
        });
    };

    const limpiarFiltros = () => {
        const vacio = {
            fecha_desde: '', fecha_hasta: '',
            cargo: [], cedula: [], nombre_completo: [], placa: [], transporte: [],
        };
        setFormFilters(vacio);
        router.get(route('reparto.compensacion-variable-diaria.index'), {}, { preserveState: true, preserveScroll: true, replace: true });
    };

    const handleMultiSelectChange = (key: keyof typeof formFilters) => (vals: string[]) => {
        const updated = { ...formFilters, [key]: vals };
        setFormFilters(updated);
        executeFilterQuery(updated);
    };
    const handleDateInputChange = (key: 'fecha_desde' | 'fecha_hasta') => (v: string) => {
        const updated = { ...formFilters, [key]: v };
        setFormFilters(updated);
        executeFilterQuery(updated);
    };

    const handleOpenDetail = async (row: CompensacionDiariaRow) => {
        setSelectedRow(row);
        setDrawerOpen(true);
        setHistorialRow([]);
        setHistorialPag(1);
        try {
            const res = await fetch(route('reparto.compensacion-variable-diaria.detalle', { id: row.id }));
            const json = await res.json();
            if (json?.historial) setHistorialRow(json.historial);
        } catch { setHistorialRow([row]); }
    };

    const totalRegistros   = Number(indicadores?.total_registros   ?? 0) || 0;
    const totalValorVar    = Number(indicadores?.total_valor_var    ?? 0) || 0;
    const totalValorPerd   = Number(indicadores?.total_valor_perdido?? 0) || 0;
    const _totalRechazos    = Number(indicadores?.total_rechazos     ?? 0) || 0;
    const _promRechazos     = Number(indicadores?.prom_rechazos      ?? 0) || 0;
    const colsUnicos       = Number(indicadores?.colaboradores_unicos?? 0) || 0;
    const vehUnicos        = Number(indicadores?.vehiculos_unicos   ?? 0) || 0;
    const visibleCols = COLUMNAS.filter(([k]) => !hiddenCols.has(k));
    const _sparklineValorVar = totales_por_dia.valor_var || [];

    // ─── Datos agrupados por rol para gráficas de barras horizontales ────────
    const { conductoresData, responsablesData, auxiliaresData } = useMemo(() => {
        const rows = data?.data || [];

        const agruparPorNombre = (filteredRows: CompensacionDiariaRow[]): BarEntry[] => {
            const map: Record<string, number> = {};
            filteredRows.forEach(r => {
                const nombre = (r.nombre_completo || '(Sin nombre)').trim();
                map[nombre] = (map[nombre] || 0) + (Number(r.valor_var) || 0);
            });
            return Object.entries(map).map(([nombre, valor]) => ({ nombre, valor }));
        };

        const conductores = rows.filter(r => {
            const c = (r.cargo || '').toLowerCase();
            return c.includes('conductor') || c.includes('chofer') || c.includes('chófer');
        });
        const responsables = rows.filter(r => {
            const c = (r.cargo || '').toLowerCase();
            return c.includes('responsable') || c.includes('resp.') || c.includes('jefe de reparto') || c.includes('supervisor');
        });
        const auxiliares = rows.filter(r => {
            const c = (r.cargo || '').toLowerCase();
            return c.includes('auxiliar') || c.includes('asistente') || c.includes('ayudante');
        });

        return {
            conductoresData: agruparPorNombre(conductores),
            responsablesData: agruparPorNombre(responsables),
            auxiliaresData: agruparPorNombre(auxiliares),
        };
    }, [data?.data]);

    // Altura compartida: todas las cards de gráficas de rol usan la misma
    const alturaPorRol = useMemo(() => {
        const alturas = [conductoresData, responsablesData, auxiliaresData].map(
            arr => Math.max(180, Math.min(arr.length, 15) * 30)
        );
        return Math.max(...alturas);
    }, [conductoresData, responsablesData, auxiliaresData]);

    const hasFilters = (formFilters.fecha_desde || formFilters.fecha_hasta || (formFilters.cargo as string[])?.length > 0 ||
        (formFilters.cedula as string[])?.length > 0 || (formFilters.nombre_completo as string[])?.length > 0 ||
        (formFilters.placa as string[])?.length > 0 || (formFilters.transporte as string[])?.length > 0);

    // ─── RENDER ────────────────────────────────────────────────────────────────
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Compensación Variable Diaria" />

            <div className="min-h-screen bg-muted/40 w-full overflow-x-hidden">
                <div className="p-3 sm:p-4 md:p-5 lg:p-6 max-w-full 2xl:max-w-[1600px] mx-auto space-y-4 w-full box-border min-w-0">

                    {/* HERO / TÍTULO */}
                    <div className="rounded-2xl border border-border/70 bg-card shadow-sm px-8 py-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

                            {/* Icono + título + stats */}
                            <div className="flex items-center gap-3">
                                <div
                                    className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl shadow-sm shrink-0"
                                    style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%)' }}
                                >
                                    <CalendarDays className="h-7 w-7 text-white" />
                                </div>
                                <div className="min-w-0">
                                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                                        Compensación Variable Diaria
                                    </h1>
                                    {/* Stats debajo del título */}
                                    <div className="flex items-center gap-4 mt-1">
                                        <div className="text-left">
                                            <p className="text-[9px] font-semibold text-muted-foreground">Total ganado</p>
                                            <p className="text-base font-extrabold tabular-nums leading-tight" style={{ color: '#15803d' }}>
                                                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(totalValorVar)}
                                            </p>
                                            <p className="text-[9px] text-muted-foreground">valor variable</p>
                                        </div>
                                        <div className="w-px h-8 bg-border" />
                                        <div className="text-left">
                                            <p className="text-[9px] font-semibold text-muted-foreground">Valor perdido</p>
                                            <p className="text-base font-extrabold tabular-nums leading-tight"
                                                style={{ color: totalValorPerd > 0 ? '#dc2626' : '#15803d' }}>
                                                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(totalValorPerd)}
                                            </p>
                                            <p className="text-[9px] text-muted-foreground">{totalValorPerd > 0 ? 'por incumplimiento' : 'sin pérdidas'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Botones de acción */}
                            <div className="flex gap-2 flex-wrap items-center">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs text-green-700 border-green-300 hover:bg-green-50"
                                    onClick={(e) => { e.stopPropagation(); setColsModalOpen(true); }}
                                >
                                    <Eye className="h-3.5 w-3.5 mr-1 sm:mr-1.5" />
                                    <span className="hidden sm:inline">Columnas</span>
                                    <span className="sm:hidden">Col.</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs border-green-300 text-green-700 hover:bg-green-50"
                                    asChild
                                >
                                    <a href={route('reparto.compensacion-variable-diaria.exportar', formFilters as Record<string, unknown>)}>
                                        <Download className="h-3.5 w-3.5 mr-1 sm:mr-1.5" />
                                        <span className="hidden sm:inline">Exportar</span>
                                        <span className="sm:hidden">Exp.</span>
                                    </a>
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-8 text-xs font-semibold text-white hover:brightness-110 border border-white/30"
                                    style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%)' }}
                                    onClick={(e) => { e.stopPropagation(); setCalcularModalOpen(true); }}
                                >
                                    <RefreshCw className="h-3.5 w-3.5 mr-1 sm:mr-1.5" />
                                    <span className="hidden sm:inline">Calcular</span>
                                    <span className="sm:hidden">Cal.</span>
                                </Button>
                            </div>
                        </div>
                    </div>



                    {statusAlert && (
                        <div className={`flex items-start gap-3 rounded-xl p-4 text-sm font-medium shadow-md border-2 ${
                            statusAlert.type === 'success'
                                ? 'text-emerald-800 dark:text-emerald-200'
                                : 'text-rose-800 dark:text-rose-200'
                        }`}
                            style={statusAlert.type === 'success'
                                ? { background: `${COLOR_SUCCESS}18`, borderColor: COLOR_SUCCESS }
                                : { background: '#dc26261a', borderColor: '#dc2626' }}>
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full"
                                style={{ background: statusAlert.type === 'success' ? `${COLOR_SUCCESS}25` : '#dc262625' }}>
                                {statusAlert.type === 'success'
                                    ? <CheckCircle2 className="size-5" style={{ color: COLOR_SUCCESS }} />
                                    : <AlertTriangle className="size-5" style={{ color: '#dc2626' }} />}
                            </div>
                            <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="font-bold text-sm" style={{ color: statusAlert.type === 'success' ? COLOR_SUCCESS : '#dc2626' }}>
                                    {statusAlert.type === 'success' ? 'Cálculo completado' : 'Error en el cálculo'}
                                </span>
                                <span className="text-xs font-normal opacity-90">{statusAlert.message}</span>
                            </div>
                        </div>
                    )}

                    {/* FILTROS */}
                    <div className="rounded-2xl border border-border/70 bg-card shadow-sm px-6 py-5 w-full box-border relative z-30">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <Filter className="h-3.5 w-3.5 text-green-700 dark:text-green-400" />
                                Filtros de búsqueda
                            </span>
                            {hasFilters && (
                                <button type="button" onClick={limpiarFiltros}
                                    className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 hover:underline">
                                    <X className="h-3.5 w-3.5" />Limpiar
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
                            <div className="grid gap-1">
                                <Label className="text-[11px] font-medium text-muted-foreground flex items-center">
                                    <Calendar className="h-3 w-3 inline mr-1 text-muted-foreground/70" />F. Desde
                                </Label>
                                <Input type="date" value={formFilters.fecha_desde || ''} className="h-8 text-xs rounded-lg"
                                    onChange={e => handleDateInputChange('fecha_desde')(e.target.value)} />
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-[11px] font-medium text-muted-foreground flex items-center">
                                    <Calendar className="h-3 w-3 inline mr-1 text-muted-foreground/70" />F. Hasta
                                </Label>
                                <Input type="date" value={formFilters.fecha_hasta || ''} className="h-8 text-xs rounded-lg"
                                    onChange={e => handleDateInputChange('fecha_hasta')(e.target.value)} />
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-[11px] font-medium text-muted-foreground flex items-center">
                                    <Users className="h-3 w-3 inline mr-1 text-muted-foreground/70" />Colaborador
                                </Label>
                                <MultiSelectSearchable label="" placeholder="Cédula o nombre..." selectedValues={formFilters.cedula} options={catalogos.cedulas} onChange={handleMultiSelectChange('cedula')} />
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-[11px] font-medium text-muted-foreground flex items-center">
                                    <MapPin className="h-3 w-3 inline mr-1 text-muted-foreground/70" />Placa
                                </Label>
                                <MultiSelectSearchable label="" placeholder="Todas las placas" selectedValues={formFilters.placa} options={catalogos.placas} onChange={handleMultiSelectChange('placa')} />
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-[11px] font-medium text-muted-foreground flex items-center">
                                    <FileSpreadsheet className="h-3 w-3 inline mr-1 text-muted-foreground/70" />Cargo
                                </Label>
                                <MultiSelectSearchable label="" placeholder="Todos los cargos" selectedValues={formFilters.cargo} options={catalogos.cargos} onChange={handleMultiSelectChange('cargo')} />
                            </div>
                        </div>

                    </div>

                    {/* ══ LAYOUT PRINCIPAL: 3 gráficas en fila + tabla ══ */}
                    <div className="space-y-5 w-full box-border min-w-0">

                        {/* GRÁFICAS · 3 compactas, responsive, con más espacio entre ellas */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full min-w-0">
                            <div className="min-w-0 w-full box-border">
                                <GraficoBarrasValorDiario data={totales_por_dia} />
                            </div>
                            <div className="min-w-0 w-full box-border">
                                <GraficoLineaRechazos data={totales_por_dia} />
                            </div>
                            <div className="min-w-0 w-full box-border">
                                <GraficoBarrasMensual data={totales_mensuales} />
                            </div>
                        </div>

                        {/* GRÁFICAS POR ROL · barras horizontales */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full min-w-0">
                            <div className="min-w-0 w-full box-border">
                                <GraficoBarrasHorizontalesPorRol
                                    titulo="Conductores"
                                    subtitulo="Valor variable ganado por conductor"
                                    entries={conductoresData}
                                    color="#3b82f6"
                                    icon={Truck}
                                    nombreArchivo="compensacion-conductores"
                                    fixedChartHeight={alturaPorRol}
                                />
                            </div>
                            <div className="min-w-0 w-full box-border">
                                <GraficoBarrasHorizontalesPorRol
                                    titulo="Responsables de Reparto"
                                    subtitulo="Valor variable ganado por responsable"
                                    entries={responsablesData}
                                    color="#f59e0b"
                                    icon={Users}
                                    nombreArchivo="compensacion-responsables"
                                    fixedChartHeight={alturaPorRol}
                                />
                            </div>
                            <div className="min-w-0 w-full box-border">
                                <GraficoBarrasHorizontalesPorRol
                                    titulo="Auxiliares"
                                    subtitulo="Valor variable ganado por auxiliar"
                                    entries={auxiliaresData}
                                    color="#9ca3af"
                                    icon={Users}
                                    nombreArchivo="compensacion-auxiliares"
                                    fixedChartHeight={alturaPorRol}
                                />
                            </div>
                        </div>

                        {/* Tabla paginada */}
                        <section>
                            <div className="bg-card rounded-xl border border-emerald-200/80 dark:border-emerald-800/80 shadow-sm overflow-hidden">
                                {/* Header de la tabla */}
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
                                            Detalle variable diaria
                                        </span>
                                        {(data?.total ?? 0) > 0 && (
                                            <Badge className="ml-2 text-[10px] sm:text-xs whitespace-nowrap bg-emerald-500/20 text-emerald-900 dark:text-emerald-100 border border-emerald-400/40">
                                                {((data?.current_page ?? 1) - 1) * (data?.per_page ?? 15) + 1}–{Math.min((data?.current_page ?? 1) * (data?.per_page ?? 15), data?.total ?? 0)} / {data?.total ?? 0}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-emerald-900 dark:text-emerald-200">
                                        <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">Mostrar:</span>
                                        <select
                                            defaultValue={data?.per_page ?? 15}
                                            onChange={(e) => router.get(route('reparto.compensacion-variable-diaria.index'), { ...formFilters, per_page: e.target.value }, { preserveState: true, preserveScroll: true, replace: true })}
                                            className="h-7 rounded-lg border border-emerald-300/80 dark:border-emerald-700 bg-white/90 dark:bg-card px-2 text-xs font-semibold text-emerald-950 dark:text-emerald-100 shadow-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
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
                                                <TableHead className="font-bold px-2 sm:px-3 py-2 text-[10px] sm:text-xs text-emerald-950 dark:text-emerald-100 border-r border-emerald-300/40 dark:border-emerald-800/60 whitespace-nowrap text-center w-10">#</TableHead>
                                                {visibleCols.map(([k, label]) => (
                                                    <TableHead key={k as string} className="font-bold px-2.5 sm:px-3 py-2 text-[10px] sm:text-xs text-emerald-950 dark:text-emerald-100 border-r border-emerald-300/40 dark:border-emerald-800/60 last:border-r-0 whitespace-nowrap">{label}</TableHead>
                                                ))}
                                                <TableHead className="font-bold px-2.5 sm:px-3 py-2 text-[10px] sm:text-xs text-emerald-950 dark:text-emerald-100 w-10 text-center">
                                                    <Eye className="size-3.5 inline" />
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(data?.data || []).length === 0 && (() => {
                                                // Precarga: generar filas para cada día del mes actual (o filtrado)
                                                const hoy = new Date();
                                                let year = hoy.getFullYear();
                                                let month = hoy.getMonth(); // 0-indexed
                                                if (formFilters.fecha_desde) {
                                                    const d = new Date(formFilters.fecha_desde + 'T00:00:00');
                                                    year = d.getFullYear(); month = d.getMonth();
                                                }
                                                const diasEnMes = new Date(year, month + 1, 0).getDate();
                                                const dias: string[] = [];
                                                for (let d = 1; d <= diasEnMes; d++) {
                                                    dias.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
                                                }
                                                return dias.map((fecha, idx) => (
                                                    <TableRow key={fecha} className="border-b border-emerald-100/60 dark:border-emerald-900/30 opacity-60">
                                                        <TableCell className="px-2 sm:px-3 py-1.5 text-[10px] text-center text-muted-foreground border-r border-emerald-100/60 w-10">{idx + 1}</TableCell>
                                                        {visibleCols.map(([k]) => (
                                                            <TableCell key={k as string} className="px-2 sm:px-3 py-1.5 text-[10px] whitespace-nowrap text-muted-foreground">
                                                                {k === 'fecha' ? formatDate(fecha) : '—'}
                                                            </TableCell>
                                                        ))}
                                                        <TableCell className="px-2 py-1.5 w-10" />
                                                    </TableRow>
                                                ));
                                            })()}
                                            {(data?.data || []).map((row, idx) => (
                                                <TableRow key={row.id}
                                                    className="hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40 transition-colors border-b border-emerald-100/80 dark:border-emerald-900/40 cursor-pointer"
                                                    onClick={() => handleOpenDetail(row)}>
                                                    <TableCell className="px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs text-center font-semibold text-emerald-700 dark:text-emerald-400 border-r border-emerald-100/80 dark:border-emerald-900/40 w-10 select-none">
                                                        {(( (data?.current_page ?? 1) - 1) * (data?.per_page ?? 15)) + idx + 1}
                                                    </TableCell>
                                                    {visibleCols.map(([k]) => {
                                                        const val = row[k as keyof CompensacionDiariaRow];
                                                        let display: React.ReactNode = val === null || val === undefined || val === '' ? '-' : String(val);
                                                        // Lee cal_rechazos del backend: 1.0 = ganó 100% | 0.8 = ganó 80% | 0.0 = ganó 0%
                                                        // Misma lógica que CompensacionVariableDiariaImportService.php
                                                        const calRechazos = Number(row.cal_rechazos) || 0;
                                                        const pct100 = calRechazos >= 1.0;
                                                        const pct80  = calRechazos >= 0.8 && calRechazos < 1.0;
                                                        const pct0   = calRechazos === 0;
                                                        const _labelPct = pct100 ? '100%' : pct80 ? '80%' : '0%';
                                                        const colorRechazos = pct0 ? COLOR_CRITICAL : pct80 ? COLOR_WARNING : COLOR_SUCCESS;
                                                        const isMoney = ['valor_x_dia', 'valor_var'].includes(k as string);
                                                        if (isMoney) display = formatCurrency(Number(val) || 0);
                                                        if (k === 'valor_perdido') {
                                                            // valor_perdido viene calculado del backend: valor_x_dia − valor_var
                                                            const perdido = Number(val) || 0;
                                                            const colorPerdido = pct100 ? COLOR_SUCCESS : pct80 ? COLOR_WARNING : COLOR_CRITICAL;
                                                            display = <span className="font-semibold text-[10px]" style={{ color: colorPerdido }}>{formatCurrency(perdido)}</span>;
                                                        }
                                                        if (k === 'fecha') display = formatDate(val as string | null);
                                                        if (k === 'cedula' || k === 'placa') display = (
                                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5"
                                                                style={k === 'placa' ? { borderColor: `${COLOR_BLUE}55`, color: COLOR_BLUE } : { borderColor: `${COLOR_MODULO}55`, color: COLOR_MODULO }}>
                                                                {val as string || '-'}
                                                            </Badge>
                                                        );
                                                        if (k === 'rechazos') {
                                                            const v = Number(val);
                                                            display = val !== null && val !== undefined && val !== ''
                                                                ? <span className="font-semibold" style={{ color: colorRechazos }}>{v}%</span>
                                                                : '-';
                                                        }
                                                        if (k === 'meta_1') {
                                                            // Meta 100%: cal_rechazos = 1.0 (backend: rechazos < 2.0%)
                                                            display = pct100
                                                                ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: COLOR_SUCCESS }}>100%</span>
                                                                : <span className="text-muted-foreground/40 text-[10px]">—</span>;
                                                        }
                                                        if (k === 'meta_2') {
                                                            // Meta 80%: cal_rechazos = 0.8 (backend: rechazos 2.0–2.39%)
                                                            // valor_var ya viene calculado del backend: valor_x_dia × 0.8
                                                            display = pct80
                                                                ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: COLOR_WARNING }}>{formatCurrency(Number(row.valor_var) || 0)}</span>
                                                                : <span className="text-muted-foreground/40 text-[10px]">—</span>;
                                                        }
                                                        return <TableCell key={k as string} className="px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs whitespace-nowrap text-foreground">{display}</TableCell>;
                                                    })}
                                                    <TableCell className="px-2 py-1.5 w-10" onClick={(e) => { e.stopPropagation(); handleOpenDetail(row); }}>
                                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-emerald-100 dark:hover:bg-emerald-900" style={{ color: COLOR_MODULO }}>
                                                            <Eye className="size-3.5" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                             {/* Total fila */}
                                             {(data?.data || []).length > 0 && (() => {
                                                 const rows = data?.data || [];
                                                 const totalGanado = rows.reduce((s, r) => s + (Number(r.valor_var) || 0), 0);
                                                 return (
                                                     <TableRow className="border-t-2 border-emerald-400/60 dark:border-emerald-600/60 bg-emerald-50/80 dark:bg-emerald-950/40 font-bold">
                                                         <TableCell className="px-2 sm:px-3 py-2 text-[10px] sm:text-xs text-center border-r border-emerald-200/80 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 w-10">Σ</TableCell>
                                                         {visibleCols.map(([k]) => (
                                                             <TableCell key={k as string} className="px-2 sm:px-3 py-2 text-[10px] sm:text-xs whitespace-nowrap">
                                                                 {k === 'valor_var'
                                                                     ? <span className="font-extrabold text-[11px]" style={{ color: COLOR_SUCCESS }}>{formatCurrency(totalGanado)}</span>
                                                                     : k === 'nombre_completo'
                                                                     ? <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">{rows.length} registros</span>
                                                                     : null}
                                                             </TableCell>
                                                         ))}
                                                         <TableCell className="px-2 py-2 w-10" />
                                                     </TableRow>
                                                 );
                                             })()}
                                        </TableBody>
                                    </Table>
                                </div>
                                <div className="flex items-center justify-between px-4 py-2.5 border-t border-emerald-200/80 dark:border-emerald-800/80 text-[11px] text-muted-foreground">
                                    <div>Pág {data?.current_page} · Total {data?.total} registros</div>
                                    <div className="flex flex-wrap gap-1">
                                        {(data?.links || []).slice(1, -1).map((l, i) => (
                                            <Link key={i} href={l.url || '#'}
                                                className={`px-2.5 py-1 rounded-md border text-[11px] ${l.active ? 'text-white border-transparent' : 'bg-card border-sidebar-border/70 dark:border-sidebar-border hover:bg-muted/60'} ${!l.url ? 'opacity-40 pointer-events-none' : ''}`}
                                                preserveState preserveScroll
                                                style={l.active ? { background: COLOR_MODULO } : {}}>
                                                {l.label.replace(/&laquo;|&raquo;/g, '')}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* FOOTER */}
                    <footer className="text-[10px] text-muted-foreground space-y-1 pt-2 border-t border-sidebar-border/70 dark:border-sidebar-border">
                        <div><b className="text-muted-foreground">Fuente</b> · Tabla compensaciones_variables_diarias — generada desde Eventos de Tripulación.</div>
                        <div><b className="text-muted-foreground">Cálculo</b> · Valor x Día = valor_cvd del cargo ÷ 26 · % ganado: 100% si rechazos {'<'} 2,0% · 80% si {'<'} 2,4% · 0% si ≥ 2,4% · Valor Perdido = Valor x Día − Valor Variable.</div>
                        <div><b className="text-muted-foreground">Alcance</b> · {totalRegistros.toLocaleString()} registros · {colsUnicos} colaboradores · {vehUnicos} vehículos</div>
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse" style={{ background: COLOR_MODULO }} />
                            Recalculable manualmente con el botón <b>"Calcular desde Eventos"</b>
                        </div>
                    </footer>

                </div>
            </div>

            {/* Dialog Columnas */}
            <Dialog open={colsModalOpen} onOpenChange={setColsModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle className="text-sm font-bold">Personalizar Columnas</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto py-2">
                        {COLUMNAS.map(([k, label]) => (
                            <label key={k as string} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/60 rounded px-2 py-1">
                                <input type="checkbox" checked={!hiddenCols.has(k as string)} onChange={() => toggleCol(k as string)}
                                    className="rounded border-input" style={{ accentColor: COLOR_MODULO }} />
                                <span>{label}</span>
                            </label>
                        ))}
                    </div>
                    <DialogFooter><DialogClose asChild><Button variant="outline" size="sm">Cerrar</Button></DialogClose></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog Calcular */}
            <Dialog open={calcularModalOpen} onOpenChange={setCalcularModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-bold flex items-center gap-2">
                            <RefreshCw className="size-4" style={{ color: COLOR_MODULO }} />
                            Calcular Compensación Variable Diaria
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1">
                                <Label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3 shrink-0" style={{ color: COLOR_MODULO }} />
                                    Mes
                                </Label>
                                <select
                                    value={calcularForm.mes}
                                    onChange={(e) => setCalcularForm({ ...calcularForm, mes: Number(e.target.value) })}
                                    className="h-9 w-full rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-card px-2 text-xs focus:ring-1 focus:outline-none"
                                    style={{ '--tw-ring-color': COLOR_MODULO } as React.CSSProperties}>
                                    {Object.entries(MESES_ES).map(([num, nombre]) => (
                                        <option key={num} value={Number(num)}>{nombre}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                                    <CalendarDays className="h-3 w-3 shrink-0" style={{ color: COLOR_MODULO }} />
                                    Año
                                </Label>
                                <select
                                    value={calcularForm.anio}
                                    onChange={(e) => setCalcularForm({ ...calcularForm, anio: Number(e.target.value) })}
                                    className="h-9 w-full rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-card px-2 text-xs focus:ring-1 focus:outline-none"
                                    style={{ '--tw-ring-color': COLOR_MODULO } as React.CSSProperties}>
                                    {aniosDisponibles.map((y) => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            El sistema calculará automáticamente la compensación variable diaria para{' '}
                            <strong style={{ color: COLOR_MODULO }}>{periodoSeleccionado}</strong>,
                            usando los datos de <strong>Eventos de Tripulación</strong> del período seleccionado.
                        </p>

                        <div className="rounded-xl p-3 text-[11px] space-y-1 border"
                            style={{ background: `${COLOR_MODULO}0d`, borderColor: `${COLOR_MODULO}33`, color: COLOR_MODULO }}>
                            <p className="font-semibold">El sistema calculará automáticamente:</p>
                            <p>· Valor del día (valor_cvd del cargo ÷ 26)</p>
                            <p>· 100% del valor si rechazos {'<'} 2,0%</p>
                            <p>· 80% del valor si rechazos {'<'} 2,4%</p>
                            <p>· 0% si rechazos ≥ 2,4%</p>
                            <p>· Valor Variable y Valor Perdido</p>
                            <p>· Cargo desde la planeación (eventos de tripulación)</p>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancelar</Button></DialogClose>
                        <Button size="sm" style={{ backgroundColor: COLOR_MODULO }}
                            onClick={handleCalcular} disabled={processingCalcular}>
                            {processingCalcular
                                ? <><LoaderCircle className="size-3.5 mr-1 animate-spin" />Calculando...</>
                                : <><RefreshCw className="size-3.5 mr-1" />Calcular {periodoSeleccionado}</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Sheet detalle */}
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl p-4 sm:p-6 overflow-y-auto">
                    <SheetHeader className="pb-2 border-b border-sidebar-border/70 dark:border-sidebar-border">
                        <SheetTitle className="text-base font-bold text-foreground">Detalle del Registro</SheetTitle>
                    </SheetHeader>
                    {selectedRow && (
                        <div className="mt-4 space-y-4">
                            <div className="rounded-xl p-4 text-white shadow-md"
                                style={{ backgroundImage: `linear-gradient(135deg, ${COLOR_MODULO}, ${COLOR_ROSE})` }}>
                                <div className="text-[10px] font-bold" style={{ color: '#ffffffcc' }}>
                                    {selectedRow.cargo || 'Cargo no especificado'}
                                </div>
                                <div className="text-lg sm:text-xl font-extrabold mt-0.5">{selectedRow.nombre_completo || '(Sin nombre)'}</div>
                                <div className="mt-3 flex flex-wrap gap-2.5 sm:gap-4 text-[11px] font-medium" style={{ color: '#ffffffdd' }}>
                                    <span className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5">
                                        <Calendar className="size-3" /> {formatDate(selectedRow.fecha)}
                                    </span>
                                    <span className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5">
                                        <Truck className="size-3" /> {selectedRow.placa || '-'}
                                    </span>
                                    <span className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5">
                                        <Fingerprint className="size-3" /> {selectedRow.cedula || '-'}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                                <KpiCard label="Rechazos" value={`${selectedRow.rechazos || 0}%`} icon={AlertTriangle}
                                    color={Number(selectedRow.rechazos || 0) >= 2.4 ? COLOR_CRITICAL : Number(selectedRow.rechazos || 0) >= 2.0 ? COLOR_WARNING : COLOR_SUCCESS} />
                                <KpiCard label="Valor x Día" value={formatCurrency(Number(selectedRow.valor_x_dia) || 0)} icon={DollarSign} color={COLOR_CYAN} />
                                <KpiCard label="Valor Variable" value={formatCurrency(Number(selectedRow.valor_var) || 0)} icon={TrendingUp} color={COLOR_SUCCESS} />
                                <KpiCard label="Valor Perdido" value={formatCurrency(Number(selectedRow.valor_perdido) || 0)} icon={TrendingDown} color={COLOR_CRITICAL} />
                                <KpiCard label="% Variable" value={selectedRow.porcentaje_variable || '-'} icon={Users} color={COLOR_BLUE} />
                                <KpiCard label="% No Cum" value={selectedRow.porcentaje_variable_no_cum || '-'} icon={Clock} color={COLOR_PURPLE} />
                                <KpiCard label="% Ganado" value={formatCurrency(Number(selectedRow.cal_rechazos) || 0)} icon={DollarSign} color={COLOR_WARNING} />
                                <KpiCard label="Meta 1" value={selectedRow.meta_1 !== null && selectedRow.meta_1 !== undefined ? `< ${selectedRow.meta_1}%` : '< 2,0%'} icon={Target} color={COLOR_SUCCESS} />
                                <KpiCard label="Meta 2" value={selectedRow.meta_2 !== null && selectedRow.meta_2 !== undefined ? `< ${selectedRow.meta_2}%` : '< 2,4%'} icon={Target} color={COLOR_BLUE} />
                            </div>

                            {historialRow.length > 0 && (() => {
                                const totalPages = Math.ceil(historialRow.length / HIST_PER_PAGE);
                                const paginated = historialRow.slice((historialPag - 1) * HIST_PER_PAGE, historialPag * HIST_PER_PAGE);
                                const totalValVar   = historialRow.reduce((s, h) => s + (Number(h.valor_var) || 0), 0);
                                const totalValPerd  = historialRow.reduce((s, h) => s + (Number(h.valor_perdido) || 0), 0);
                                const promRech      = historialRow.length > 0
                                    ? (historialRow.reduce((s, h) => s + (Number(h.rechazos) || 0), 0) / historialRow.length)
                                    : 0;
                                return (
                                    <div className="rounded-xl border border-sidebar-border/70 dark:border-sidebar-border bg-card p-3 sm:p-4 shadow-sm">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-[11px] font-bold text-muted-foreground">
                                                Todos los registros {selectedRow?.anio ?? ''} — {historialRow.length} día{historialRow.length !== 1 ? 's' : ''}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                Pág {historialPag}/{totalPages}
                                            </span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <Table className="w-full">
                                                <TableHeader>
                                                    <TableRow className="bg-muted/50">
                                                        <TableHead className="px-2 py-1.5 text-[10px]">Fecha</TableHead>
                                                        <TableHead className="px-2 py-1.5 text-[10px]">Placa</TableHead>
                                                        <TableHead className="px-2 py-1.5 text-[10px]">Rechazos</TableHead>
                                                        <TableHead className="px-2 py-1.5 text-[10px]">Valor Var</TableHead>
                                                        <TableHead className="px-2 py-1.5 text-[10px]">% Var</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {paginated.map(h => (
                                                        <TableRow key={h.id} className="hover:bg-muted/60">
                                                            <TableCell className="px-2 py-1.5 text-[11px]">{formatDate(h.fecha)}</TableCell>
                                                            <TableCell className="px-2 py-1.5 text-[11px]">{h.placa || '-'}</TableCell>
                                                            <TableCell className="px-2 py-1.5 text-[11px] font-semibold"
                                                                style={{ color: Number(h.rechazos || 0) >= 2.4 ? COLOR_CRITICAL : Number(h.rechazos || 0) >= 2.0 ? COLOR_WARNING : COLOR_SUCCESS }}>
                                                                {h.rechazos !== null && h.rechazos !== undefined ? `${h.rechazos}%` : '-'}
                                                            </TableCell>
                                                            <TableCell className="px-2 py-1.5 text-[11px]">{formatCurrency(Number(h.valor_var) || 0)}</TableCell>
                                                            <TableCell className="px-2 py-1.5 text-[11px]">{h.porcentaje_variable || '-'}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                                {/* Fila de totales */}
                                                <tfoot>
                                                    <tr className="border-t-2 bg-muted/40 font-bold">
                                                        <td className="px-2 py-2 text-[10px] font-bold text-muted-foreground" colSpan={2}>
                                                            TOTAL {historialRow.length} días
                                                        </td>
                                                        <td className="px-2 py-2 text-[11px] font-bold"
                                                            style={{ color: promRech >= 2.4 ? COLOR_CRITICAL : promRech >= 2.0 ? COLOR_WARNING : COLOR_SUCCESS }}>
                                                            {promRech.toFixed(2)}% prom
                                                        </td>
                                                        <td className="px-2 py-2 text-[11px] font-bold" style={{ color: COLOR_SUCCESS }}>
                                                            {formatCurrency(totalValVar)}
                                                        </td>
                                                        <td className="px-2 py-2 text-[11px] font-bold" style={{ color: COLOR_CRITICAL }}>
                                                            {formatCurrency(totalValPerd)} perd
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </Table>
                                        </div>
                                        {/* Paginación */}
                                        {totalPages > 1 && (
                                            <div className="flex items-center justify-center gap-1 mt-3">
                                                <button
                                                    onClick={() => setHistorialPag(p => Math.max(1, p - 1))}
                                                    disabled={historialPag === 1}
                                                    className="px-2.5 py-1 rounded-md border text-[10px] bg-card hover:bg-muted/60 disabled:opacity-40">
                                                    ‹
                                                </button>
                                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                                    <button key={p}
                                                        onClick={() => setHistorialPag(p)}
                                                        className={`px-2.5 py-1 rounded-md border text-[10px] ${p === historialPag ? 'text-white border-transparent' : 'bg-card hover:bg-muted/60'}`}
                                                        style={p === historialPag ? { background: COLOR_MODULO } : {}}>
                                                        {p}
                                                    </button>
                                                ))}
                                                <button
                                                    onClick={() => setHistorialPag(p => Math.min(totalPages, p + 1))}
                                                    disabled={historialPag === totalPages}
                                                    className="px-2.5 py-1 rounded-md border text-[10px] bg-card hover:bg-muted/60 disabled:opacity-40">
                                                    ›
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </AppLayout>
    );
}
