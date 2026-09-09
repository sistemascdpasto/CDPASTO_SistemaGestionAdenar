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
    CalendarDays,
    Calendar,
    Check,
    CheckCircle2,
    ChevronsUpDown,
    Clock,
    Fingerprint,
    Download,
    Eye,
    Filter,
    LoaderCircle,
    RefreshCw,
    TrendingDown,
    TrendingUp,
    Users,
    DollarSign,
    X,
    Activity,
    Zap,
    Target,
    Truck,
} from 'lucide-react';
import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler, Tooltip, Legend);

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
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}

const COLUMNAS: [keyof CompensacionDiariaRow, string, boolean][] = [
    ['fecha', 'Fecha', true],
    ['anio', 'Año', false],
    ['mes', 'Mes', false],
    ['placa', 'Placa', true],
    ['transporte', 'Transporte', false],
    ['cedula', 'Cédula', true],
    ['nombre_completo', 'Nombre Completo', true],
    ['cargo', 'Cargo', true],
    ['rechazos', 'Rechazos', true],
    ['cal_rechazos', 'Cal-Rechazos', true],
    ['cal_rechazos_2', 'Cal-Rechazos 2', false],
    ['valor_x_dia', 'Valor x Día', true],
    ['valor_var', 'Valor Var', true],
    ['valor_perdido', 'Valor Perdido', true],
    ['porcentaje_variable', '% Variable', true],
    ['porcentaje_variable_no_cum', '% Var No Cum', false],
    ['meta_1', 'Meta ≤ 2,1%', false],
    ['meta_2', 'Meta < 2,6%', true],
];

const LS_COLS = 'cvd_cols_v1';

// ─── KpiCard (estilo Adherencia al Tiempo, colores paleta CV) ────────────────
function KpiCard({ label, value, sub, icon: Icon, color, spark, sparkColor }:
    { label: string; value: string; sub?: string; icon: any; color: string; spark?: number[]; sparkColor?: string }) {
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

// ─── PersonBar (estilo Adherencia al Tiempo · top/bottom colaboradores) ──────
function PersonBar({ persona, metaPct }: { persona: CompensacionDiariaRow; metaPct: number }) {
    const pct = Number(persona.rechazos ?? 0);
    const color = pct > 2.6 ? COLOR_CRITICAL : pct > 2.1 ? COLOR_WARNING : COLOR_SUCCESS;
    return (
        <li className="flex items-center gap-2 py-1.5">
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-1 mb-0.5">
                    <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-semibold text-foreground truncate block">
                            {persona.nombre_completo || persona.cedula}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {persona.placa && (
                                <span
                                    className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                                    style={{ color: COLOR_BLUE, background: `${COLOR_BLUE}1a`, border: `1px solid ${COLOR_BLUE}33` }}>
                                    {persona.placa}
                                </span>
                            )}
                            {persona.cargo && (
                                <span className="text-[9px] text-muted-foreground truncate">{persona.cargo}</span>
                            )}
                        </div>
                    </div>
                    <span className="text-[11px] font-bold shrink-0" style={{ color }}>{pct}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden relative">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct * 10, 100)}%`, background: color }} />
                    <div className="absolute top-0 bottom-0 w-px opacity-60" style={{ left: `${metaPct * 10}%`, background: COLOR_BLUE }} />
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                    Var: {formatCurrency(Number(persona.valor_var ?? 0))} · Perd: {formatCurrency(Number(persona.valor_perdido ?? 0))}
                </p>
            </div>
        </li>
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
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: '#9ca3af', font: { size: 8 } }, grid: { display: false } },
                        y: { beginAtZero: true, ticks: { color: '#9ca3af', font: { size: 8 }, callback: (v: any) => '$' + Number(v).toLocaleString('es-CO', { maximumFractionDigits: 0, notation: 'compact' }), maxTicksLimit: 5 }, grid: { color: 'rgba(0,0,0,.04)' } }
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
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: '#9ca3af', font: { size: 8 } }, grid: { display: false } },
                        y: { beginAtZero: true, ticks: { color: '#9ca3af', font: { size: 8 }, callback: (v: any) => `${v}%`, maxTicksLimit: 5 }, grid: { color: 'rgba(0,0,0,.04)' } }
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
            { label: 'Meta 1 (≤ 2,1%)', data: data?.meta_1 || [], backgroundColor: `${COLOR_SUCCESS}80`, borderColor: COLOR_SUCCESS, borderWidth: 1 },
            { label: 'Meta 2 (< 2,6%)', data: data?.meta_2 || [], backgroundColor: `${COLOR_PURPLE}80`, borderColor: COLOR_PURPLE, borderWidth: 1 },
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
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: '#6b7280', font: { size: 8 } }, grid: { display: false } },
                        y: { beginAtZero: true, ticks: { color: '#9ca3af', font: { size: 8 }, callback: (v: any) => '$' + Number(v).toLocaleString('es-CO', { maximumFractionDigits: 0, notation: 'compact' }), maxTicksLimit: 5 }, grid: { color: 'rgba(0,0,0,.04)' } }
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
                style={{ ['--tw-ring-color' as any]: COLOR_MODULO }}>
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

// Guards defensivos fuera del componente (constantes)
const DEFAULT_PAGINATOR: Paginator = { data: [], links: [], total: 0, current_page: 1, per_page: 25 };
const DEFAULT_INDICADORES: IndicadoresGlobales = { total_registros: 0, total_rechazos: 0, total_cal_rechazos: 0, total_cal_rechazos_2: 0, total_valor_x_dia: 0, total_valor_var: 0, total_valor_perdido: 0, total_meta_1: 0, total_meta_2: 0, prom_rechazos: 0, colaboradores_unicos: 0, vehiculos_unicos: 0 };
const DEFAULT_TOTALES_DIA: TotalesPorDia = { fechas: [], rechazos: [], valor_x_dia: [], valor_var: [], valor_perdido: [] };
const DEFAULT_TOTALES_MES: TotalesMensuales = { meses: [], rechazos: [], valor_var: [], valor_perdido: [], meta_1: [], meta_2: [] };
const DEFAULT_CATALOGOS: Catalogos = { anios: [], meses: [], cargos: [], cedulas: [], nombres: [], placas: [], transportes: [], rrs: [] };

export default function CompensacionVariableDiariaIndex() {
    const pageProps = usePage<any>().props || {};

    console.log('CompensacionVariableDiariaIndex pageProps:', pageProps);

    const data: Paginator = pageProps.data || DEFAULT_PAGINATOR;
    const indicadores: IndicadoresGlobales = pageProps.indicadores || DEFAULT_INDICADORES;
    const totales_por_dia: TotalesPorDia = pageProps.totales_por_dia || DEFAULT_TOTALES_DIA;
    const totales_mensuales: TotalesMensuales = pageProps.totales_mensuales || DEFAULT_TOTALES_MES;
    const filters: FiltrosReales = pageProps.filters || {};
    const catalogos: Catalogos = pageProps.catalogos || DEFAULT_CATALOGOS;
    const flash = pageProps.flash || {};
    // El controlador usa ->with('status', [...]) que el middleware comparte como pageProps.status
    const statusAlert = pageProps.status || null;

    console.log('CompensacionVariableDiariaIndex data:', { data, indicadores, totales_por_dia, totales_mensuales, filters, catalogos });

    const LS_HIDE_COLS = 'cvd_hidden_cols_v1';
    const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
        try { const s = localStorage.getItem(LS_HIDE_COLS); return s ? new Set(JSON.parse(s)) : new Set(COLUMNAS.filter(([,, h]) => !h).map(([k]) => k)); } catch { return new Set(); }
    });
    useEffect(() => { try { localStorage.setItem(LS_HIDE_COLS, JSON.stringify(Array.from(hiddenCols))); } catch {} }, [hiddenCols]);
    const toggleCol = (k: string) => { const next = new Set(hiddenCols); if (next.has(k)) next.delete(k); else next.add(k); setHiddenCols(next); };
    const [colsModalOpen, setColsModalOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedRow, setSelectedRow] = useState<CompensacionDiariaRow | null>(null);
    const [historialRow, setHistorialRow] = useState<CompensacionDiariaRow[]>([]);
    const [calcularModalOpen, setCalcularModalOpen] = useState(false);
    const [showRanking, setShowRanking] = useState(true);
    const [rankMode, setRankMode] = useState<'bottom' | 'top'>('bottom');
    const [showPlacas, setShowPlacas] = useState(false);
    const [showCargos, setShowCargos] = useState(false);

    const MESES_ES: Record<number, string> = {
        1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
        5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
        9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
    };

    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1;
    const [calcularForm, setCalcularForm] = useState({ anio: anioActual, mes: mesActual });

    useEffect(() => {
        if (calcularModalOpen) {
            setCalcularForm({ anio: anioActual, mes: mesActual });
        }
    }, [calcularModalOpen]);

    const aniosDisponibles = useMemo(() => {
        const arr: number[] = [];
        for (let y = anioActual - 3; y <= anioActual + 1; y++) arr.push(y);
        return arr;
    }, [anioActual]);

    const periodoSeleccionado = useMemo(() => {
        const m = MESES_ES[calcularForm.mes] || `Mes ${calcularForm.mes}`;
        return `${m} de ${calcularForm.anio}`;
    }, [calcularForm]);

    const { post: postCalcular, processing: processingCalcular } = useForm({});

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

    const [formFilters, setFormFilters] = useState<FiltrosReales & { anio?: number | string; mes?: string | string[]; cedula?: string | string[]; nombre_completo?: string | string[]; cargo?: string | string[]; placa?: string | string[]; transporte?: string | string[]; }>({
        fecha_desde: (filters.fecha_desde as string) || '',
        fecha_hasta: (filters.fecha_hasta as string) || '',
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
            fecha_desde: (filters.fecha_desde as string) || '',
            fecha_hasta: (filters.fecha_hasta as string) || '',
            cargo: parseFilterArray(filters.cargo),
            cedula: parseFilterArray(filters.cedula),
            nombre_completo: parseFilterArray(filters.nombre_completo),
            placa: parseFilterArray(filters.placa),
            transporte: parseFilterArray(filters.transporte),
        }));
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
        try {
            const res = await fetch(route('reparto.compensacion-variable-diaria.detalle', { id: row.id }));
            const json = await res.json();
            if (json?.historial) setHistorialRow(json.historial);
        } catch { setHistorialRow([row]); }
    };

    const totalRegistros   = Number(indicadores?.total_registros   ?? 0) || 0;
    const totalValorVar    = Number(indicadores?.total_valor_var    ?? 0) || 0;
    const totalValorPerd   = Number(indicadores?.total_valor_perdido?? 0) || 0;
    const totalRechazos    = Number(indicadores?.total_rechazos     ?? 0) || 0;
    const promRechazos     = Number(indicadores?.prom_rechazos      ?? 0) || 0;
    const colsUnicos       = Number(indicadores?.colaboradores_unicos?? 0) || 0;
    const vehUnicos        = Number(indicadores?.vehiculos_unicos   ?? 0) || 0;
    const totalCalRech     = Number(indicadores?.total_cal_rechazos ?? 0) || 0;
    const totalCalRech2    = Number(indicadores?.total_cal_rechazos_2?? 0) || 0;

    const visibleCols = COLUMNAS.filter(([k]) => !hiddenCols.has(k));
    const sparklineValorVar = totales_por_dia.valor_var || [];
    const sparklineRechazos = totales_por_dia.rechazos || [];

    // Rank colaboradores (bottom / top por % rechazos)
    const rankData = useMemo(() => {
        const arr = Array.isArray(data?.data) ? [...data.data] : [];
        const sorted = [...arr].sort((a, b) => Number(b.rechazos ?? 0) - Number(a.rechazos ?? 0));
        return rankMode === 'bottom' ? sorted.slice(0, 10) : sorted.slice().reverse().slice(0, 10);
    }, [data, rankMode]);

    // Resumen por cargo
    const resumenPorCargo = useMemo(() => {
        const arr = Array.isArray(data?.data) ? data.data : [];
        const map: Record<string, { total: number; rechazos: number; valor_var: number; valor_perdido: number; personas: Set<string>; placas: Set<string> }> = {};
        arr.forEach(r => {
            const key = r.cargo || 'Sin cargo';
            if (!map[key]) map[key] = { total: 0, rechazos: 0, valor_var: 0, valor_perdido: 0, personas: new Set(), placas: new Set() };
            map[key].total += 1;
            map[key].rechazos += Number(r.rechazos ?? 0);
            map[key].valor_var += Number(r.valor_var ?? 0);
            map[key].valor_perdido += Number(r.valor_perdido ?? 0);
            if (r.cedula) map[key].personas.add(r.cedula);
            if (r.placa) map[key].placas.add(r.placa);
        });
        return Object.entries(map).map(([cargo, v]) => ({
            cargo,
            total: v.total,
            prom_rechazos: v.total > 0 ? v.rechazos / v.total : 0,
            valor_var: v.valor_var,
            valor_perdido: v.valor_perdido,
            personas: v.personas.size,
            placas: Array.from(v.placas),
        })).sort((a, b) => b.valor_var - a.valor_var);
    }, [data]);

    // Resumen por placa
    const resumenPorPlaca = useMemo(() => {
        const arr = Array.isArray(data?.data) ? data.data : [];
        const map: Record<string, { total: number; rechazos: number; valor_var: number }> = {};
        arr.forEach(r => {
            const key = r.placa || 'S/Placa';
            if (!map[key]) map[key] = { total: 0, rechazos: 0, valor_var: 0 };
            map[key].total += 1;
            map[key].rechazos += Number(r.rechazos ?? 0);
            map[key].valor_var += Number(r.valor_var ?? 0);
        });
        return Object.entries(map).map(([placa, v]) => ({
            placa,
            total: v.total,
            prom_rechazos: v.total > 0 ? v.rechazos / v.total : 0,
            valor_var: v.valor_var,
        })).sort((a, b) => b.valor_var - a.valor_var).slice(0, 25);
    }, [data]);

    const hasFilters = (formFilters.fecha_desde || formFilters.fecha_hasta || (formFilters.cargo as any)?.length > 0 ||
        (formFilters.cedula as any)?.length > 0 || (formFilters.nombre_completo as any)?.length > 0 ||
        (formFilters.placa as any)?.length > 0 || (formFilters.transporte as any)?.length > 0);

    // ─── RENDER ────────────────────────────────────────────────────────────────
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Compensación Variable Diaria" />

            <div className="min-h-screen bg-muted/40 w-full overflow-x-hidden">
                <div className="p-3 sm:p-4 md:p-5 lg:p-6 max-w-full 2xl:max-w-[1600px] mx-auto space-y-4 w-full box-border min-w-0">

                    {/* HERO / TÍTULO + métricas principales */}
                    <div className="rounded-xl border border-sidebar-border/70 bg-card px-5 py-4 shadow-sm dark:border-sidebar-border">

                        {/* Fila superior: título + sparkline + mini stats a la derecha */}
                        <div className="flex flex-wrap items-start justify-between gap-4">

                            {/* Izquierda: título + sparkline */}
                            <div className="flex items-center gap-4 flex-wrap">
                                <h1 className="text-xl font-semibold leading-tight tracking-tight text-foreground">
                                    Compensación variable diaria
                                </h1>
                                <div>
                                    <p className="text-[9px] font-semibold text-muted-foreground mb-0.5">Tendencia</p>
                                    <Spark data={sparklineValorVar.slice(-14)} color="#15803d" h={28} w={120} />
                                </div>
                            </div>

                            {/* Derecha: rechazos + personas — pequeños */}
                            <div className="flex items-center gap-4 shrink-0">
                                <div className="text-right">
                                    <p className="text-[9px] font-semibold text-muted-foreground">Suma rechazos</p>
                                    <p className="text-base font-extrabold tabular-nums leading-tight"
                                        style={{ color: totalRechazos > 10 ? '#dc2626' : totalRechazos > 5 ? '#d97706' : '#15803d' }}>
                                        {totalRechazos.toLocaleString('es-CO')}%
                                    </p>
                                    <p className="text-[9px] text-muted-foreground">prom. {promRechazos}%/día</p>
                                </div>
                                <div className="w-px h-8 bg-border" />
                                <div className="text-right">
                                    <p className="text-[9px] font-semibold text-muted-foreground">Valor perdido</p>
                                    <p className="text-base font-extrabold tabular-nums leading-tight"
                                        style={{ color: totalValorPerd > 0 ? '#dc2626' : '#15803d' }}>
                                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(totalValorPerd)}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground">{totalValorPerd > 0 ? 'por incumplimiento' : 'sin pérdidas'}</p>
                                </div>
                                <div className="w-px h-8 bg-border" />
                                <div className="text-right">
                                    <p className="text-[9px] font-semibold text-muted-foreground">Total personas</p>
                                    <p className="text-base font-extrabold tabular-nums leading-tight" style={{ color: '#15803d' }}>
                                        {colsUnicos.toLocaleString()}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground">{vehUnicos} vehículos</p>
                                </div>
                                <div className="w-px h-8 bg-border" />
                                <p className="text-[9px] text-muted-foreground text-right">
                                    {totalRegistros.toLocaleString()}<br />registros
                                </p>
                            </div>
                        </div>

                        {/* Fila inferior: valor ganado (a la mitad del título) + valor perdido */}
                        <div className="mt-3 flex flex-wrap items-end gap-6">
                            <div>
                                <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Total ganado</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-extrabold tabular-nums leading-none" style={{ color: '#15803d' }}>
                                        {new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(totalValorVar)}
                                    </span>
                                    <span className="text-base font-bold text-muted-foreground">$</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Valor variable acumulado</p>
                            </div>

                            <div className="hidden sm:block w-px h-10 bg-border" />

                            <div>
                                <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Total perdido</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-extrabold tabular-nums leading-none"
                                        style={{ color: totalValorPerd > 0 ? '#dc2626' : '#15803d' }}>
                                        {new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(totalValorPerd)}
                                    </span>
                                    <span className="text-base font-bold text-muted-foreground">$</span>
                                </div>
                                <p className="text-[10px] mt-0.5" style={{ color: totalValorPerd > 0 ? '#dc2626' : '#6b7280' }}>
                                    {totalValorPerd > 0 ? 'Por incumplimiento de metas' : 'Sin pérdidas en el período'}
                                </p>
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
                                    {statusAlert.type === 'success' ? '✓ Cálculo completado' : 'Error en el cálculo'}
                                </span>
                                <span className="text-xs font-normal opacity-90">{statusAlert.message}</span>
                            </div>
                        </div>
                    )}

                    {/* FILTROS (estilo Adherencia al Tiempo · grid compacto + responsive) */}
                    <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm px-4 sm:px-5 py-4 w-full box-border overflow-hidden">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 items-end min-w-0">
                            <div className="grid gap-1 min-w-0">
                                <Label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3 inline mr-1 shrink-0" style={{ color: COLOR_MODULO }} />
                                    Fecha desde
                                </Label>
                                <Input type="date" value={formFilters.fecha_desde || ''} className="h-8 text-xs rounded-lg w-full max-w-full"
                                    onChange={e => handleDateInputChange('fecha_desde')(e.target.value)} />
                            </div>
                            <div className="grid gap-1 min-w-0">
                                <Label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3 inline mr-1 shrink-0" style={{ color: COLOR_MODULO }} />
                                    Fecha hasta
                                </Label>
                                <Input type="date" value={formFilters.fecha_hasta || ''} className="h-8 text-xs rounded-lg w-full max-w-full"
                                    onChange={e => handleDateInputChange('fecha_hasta')(e.target.value)} />
                            </div>
                            <div className="min-w-0"><MultiSelectSearchable label="Cargo" placeholder="Todos los cargos" selectedValues={formFilters.cargo} options={catalogos.cargos} onChange={handleMultiSelectChange('cargo')} /></div>
                            <div className="min-w-0"><MultiSelectSearchable label="Identificación" placeholder="Todas las identificaciones" selectedValues={formFilters.cedula} options={catalogos.cedulas} onChange={handleMultiSelectChange('cedula')} /></div>
                            <div className="min-w-0"><MultiSelectSearchable label="Nombre" placeholder="Todos los nombres" selectedValues={formFilters.nombre_completo} options={catalogos.nombres} onChange={handleMultiSelectChange('nombre_completo')} /></div>
                            <div className="min-w-0"><MultiSelectSearchable label="Placa" placeholder="Todas las placas" selectedValues={formFilters.placa} options={catalogos.placas} onChange={handleMultiSelectChange('placa')} /></div>
                            <div className="min-w-0 sm:col-span-2 md:col-span-3 lg:col-span-1"><MultiSelectSearchable label="Transporte" placeholder="Todos los transportes" selectedValues={formFilters.transporte} options={catalogos.transportes} onChange={handleMultiSelectChange('transporte')} /></div>
                        </div>
                        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="text-[10px] text-muted-foreground break-words min-w-0">
                                Viendo <b>{totalRegistros.toLocaleString()} registros</b>
                                {(formFilters.cargo as any)?.length > 0 && <> · cargo: <b>{(formFilters.cargo as any).length}</b></>}
                                {(formFilters.cedula as any)?.length > 0 && <> · <b>{(formFilters.cedula as any).length} identificación{(formFilters.cedula as any).length !== 1 ? 'es' : ''}</b></>}
                                {(formFilters.placa as any)?.length > 0 && <> · <b>{(formFilters.placa as any).length} placa{(formFilters.placa as any).length !== 1 ? 's' : ''}</b></>}
                                · <b>{colsUnicos} personas</b> · <b>{vehUnicos} vehículos</b>
                            </div>
                            <div className="flex flex-wrap gap-1.5 items-center shrink-0 relative z-20 pointer-events-auto">
                                <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] pointer-events-auto relative" asChild
                                    style={{ borderColor: 'rgba(21, 128, 61, 0.3)', color: '#064e3b' }}>
                                    <a href={route('reparto.compensacion-variable-diaria.exportar', formFilters as any)} onClick={(e) => e.stopPropagation()}>
                                        <Download className="size-3 mr-0.5" /> Exportar
                                    </a>
                                </Button>
                                <Button type="button" size="sm" className="h-7 text-[10px] text-white pointer-events-auto relative"
                                    style={{ backgroundColor: '#15803d' }}
                                    onClick={(e) => { e.stopPropagation(); setCalcularModalOpen(true); }}>
                                    <RefreshCw className="size-3 mr-0.5" /> Calcular
                                </Button>
                                <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px] pointer-events-auto relative" onClick={(e) => { e.stopPropagation(); setColsModalOpen(true); }}>
                                    <Eye className="size-3 mr-1" /> Columnas
                                </Button>
                                {hasFilters && (
                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); limpiarFiltros(); }} className="h-7 text-xs text-muted-foreground pointer-events-auto relative">
                                        <X className="h-3 w-3 mr-1" /> Limpiar
                                    </Button>
                                )}
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

                        {/* Tabla paginada */}
                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: COLOR_BLUE }}>01</span>
                                <h2 className="text-sm font-bold text-foreground">Detalle de jornadas (paginado)</h2>
                            </div>
                            <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50 hover:bg-muted/60">
                                                {visibleCols.map(([k, label]) => (
                                                    <TableHead key={k as string} className="px-3 py-2.5 text-[10px] font-bold text-muted-foreground whitespace-nowrap">{label}</TableHead>
                                                ))}
                                                <TableHead className="px-3 py-2.5 w-10"><Eye className="size-3.5 text-muted-foreground" /></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(data?.data || []).length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={visibleCols.length + 1} className="text-center py-12 text-xs text-muted-foreground">
                                                        No hay registros. Usa el botón <strong>"Calcular desde Eventos"</strong> para generar la compensación variable diaria.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            {(data?.data || []).map((row) => (
                                                <TableRow key={row.id} className="hover:bg-muted/60 cursor-pointer"
                                                    onClick={() => handleOpenDetail(row)}>
                                                    {visibleCols.map(([k]) => {
                                                        const val = row[k as keyof CompensacionDiariaRow];
                                                        let display: React.ReactNode = val === null || val === undefined || val === '' ? '-' : String(val);
                                                        const isMoney = ['cal_rechazos', 'cal_rechazos_2', 'valor_x_dia', 'valor_var', 'valor_perdido'].includes(k as string);
                                                        if (isMoney) display = formatCurrency(Number(val) || 0);
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
                                                                ? <span className="font-semibold" style={{ color: v > 2.6 ? COLOR_CRITICAL : v > 2.1 ? COLOR_WARNING : COLOR_SUCCESS }}>{v}%</span>
                                                                : '-';
                                                        }
                                                        if (k === 'meta_1') display = val !== null && val !== undefined && val !== '' ? `< ${Number(val)}%` : '≤ 2,1%';
                                                        if (k === 'meta_2') display = val !== null && val !== undefined && val !== '' ? `< ${Number(val)}%` : '< 2,6%';
                                                        return <TableCell key={k as string} className="px-3 py-2 text-[11px] whitespace-nowrap text-foreground">{display}</TableCell>;
                                                    })}
                                                    <TableCell className="px-3 py-2 w-10" onClick={(e) => { e.stopPropagation(); handleOpenDetail(row); }}>
                                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted" style={{ color: COLOR_MODULO }}>
                                                            <Eye className="size-3.5" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                <div className="flex items-center justify-between px-4 py-2.5 border-t border-sidebar-border/70 dark:border-sidebar-border text-[11px] text-muted-foreground">
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
                        <div><b className="text-muted-foreground">Cálculo</b> · Valor x Día = $3.846,15 · Cal-Rechazos 80% (Meta 2) + 20% (Meta 1) · Valor Perdido = (1 - % Variable) × Valor x Día.</div>
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
                                    style={{ ['--tw-ring-color' as any]: COLOR_MODULO }}>
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
                                    style={{ ['--tw-ring-color' as any]: COLOR_MODULO }}>
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
                            <p>· Valor del día ($3.846,15)</p>
                            <p>· Cal-Rechazos según meta 2 ({'<'} 2,6% → 80%)</p>
                            <p>· Cal-Rechazos 2 según meta 1 (≤ 2,1% → 20%)</p>
                            <p>· Valor Variable y Valor Perdido</p>
                            <p>· Nombre y cargo desde la BD de colaboradores</p>
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
                                    color={Number(selectedRow.rechazos || 0) > 2.6 ? COLOR_CRITICAL : Number(selectedRow.rechazos || 0) > 2.1 ? COLOR_WARNING : COLOR_SUCCESS} />
                                <KpiCard label="Valor x Día" value={formatCurrency(Number(selectedRow.valor_x_dia) || 0)} icon={DollarSign} color={COLOR_CYAN} />
                                <KpiCard label="Valor Variable" value={formatCurrency(Number(selectedRow.valor_var) || 0)} icon={TrendingUp} color={COLOR_SUCCESS} />
                                <KpiCard label="Valor Perdido" value={formatCurrency(Number(selectedRow.valor_perdido) || 0)} icon={TrendingDown} color={COLOR_CRITICAL} />
                                <KpiCard label="% Variable" value={selectedRow.porcentaje_variable || '-'} icon={Users} color={COLOR_BLUE} />
                                <KpiCard label="% No Cum" value={selectedRow.porcentaje_variable_no_cum || '-'} icon={Clock} color={COLOR_PURPLE} />
                                <KpiCard label="Cal Rechazos" value={formatCurrency(Number(selectedRow.cal_rechazos) || 0)} icon={DollarSign} color={COLOR_WARNING} />
                                <KpiCard label="Cal Rechazos 2" value={formatCurrency(Number(selectedRow.cal_rechazos_2) || 0)} icon={DollarSign} color={COLOR_PURPLE} />
                                <KpiCard label="Meta 1" value={selectedRow.meta_1 !== null && selectedRow.meta_1 !== undefined ? `≤ ${selectedRow.meta_1}%` : '≤ 2,1%'} icon={Target} color={COLOR_SUCCESS} />
                                <KpiCard label="Meta 2" value={selectedRow.meta_2 !== null && selectedRow.meta_2 !== undefined ? `< ${selectedRow.meta_2}%` : '< 2,6%'} icon={Target} color={COLOR_BLUE} />
                            </div>

                            {historialRow.length > 0 && (
                                <div className="rounded-xl border border-sidebar-border/70 dark:border-sidebar-border bg-card p-3 sm:p-4 shadow-sm">
                                    <div className="text-[11px] font-bold text-muted-foreground mb-3">
                                        Últimos días del colaborador ({historialRow.length})
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
                                                {historialRow.slice(0, 15).map(h => (
                                                    <TableRow key={h.id} className="hover:bg-muted/60">
                                                        <TableCell className="px-2 py-1.5 text-[11px]">{formatDate(h.fecha)}</TableCell>
                                                        <TableCell className="px-2 py-1.5 text-[11px]">{h.placa || '-'}</TableCell>
                                                        <TableCell className="px-2 py-1.5 text-[11px] font-semibold"
                                                            style={{ color: Number(h.rechazos || 0) > 2.6 ? COLOR_CRITICAL : Number(h.rechazos || 0) > 2.1 ? COLOR_WARNING : COLOR_SUCCESS }}>
                                                            {h.rechazos !== null && h.rechazos !== undefined ? `${h.rechazos}%` : '-'}
                                                        </TableCell>
                                                        <TableCell className="px-2 py-1.5 text-[11px]">{formatCurrency(Number(h.valor_var) || 0)}</TableCell>
                                                        <TableCell className="px-2 py-1.5 text-[11px]">{h.porcentaje_variable || '-'}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </AppLayout>
    );
}
