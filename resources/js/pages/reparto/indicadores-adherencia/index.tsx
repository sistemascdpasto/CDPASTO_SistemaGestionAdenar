import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import {
    ArcElement,
    CategoryScale,
    Chart as ChartJS,
    DoughnutController,
    Filler,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Tooltip,
    Legend,
    type ChartOptions,
    type TooltipItem,
} from 'chart.js';
import {
    AlertTriangle,
    Activity,
    BarChart3,
    Calendar,
    CheckCircle2,
    ClipboardCheck,
    Clock,
    Map,
    Search,
    TrendingDown,
    TrendingUp,
    Trophy,
    Users,
    X,
    XCircle,
    Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
    DoughnutController, ArcElement,
    CategoryScale, LinearScale,
    PointElement, LineElement, LineController, Filler,
    Tooltip, Legend,
);

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reparto', href: '/modules/reparto/modulacion' },
    { title: 'Indicadores de Adherencia', href: '/modules/reparto/indicadores-adherencia' },
];

// ─── Tipos ─────────────────────────────────────────────────────────────────────
interface Dist {
    '≥ 90% (Óptimo)': number;
    '70–89% (Aceptable)': number;
    '< 70% (Crítico)': number;
    'Sin dato': number;
}
interface FechaPunto { fecha: string; promPre: number; promPost: number }
interface Tripulante  { nombre: string; pre: number | null; post: number | null }
interface Celda       { estado: 'ok' | 'critico'; promPre: number | null; promPost: number | null; tripulantes: Tripulante[] }
interface Heatmap {
    placas: string[]; dias: number[];
    celdas: Record<string, Celda>;
    totalCeldas: number; celdasOk: number; celdasCritico: number;
    celdasVacio: number; pctDiligenciamiento: number;
}
interface TopRow    { nombre: string | null; cedula: string; placa: string; fecha: string; pre: number; post: number | null }
interface PlacaKpi  { placa: string; prom: number; total?: number; criticos?: number }
interface Props {
    distPre: Dist; distPost: Dist;
    promPre: number | null; promPost: number | null;
    total: number; porFecha: FechaPunto[];
    topBajaPre: TopRow[]; heatmap: Heatmap;
    kpis: { totalTripulantes: number; celdasCritico: number; celdasVacio: number };
    topMejor: PlacaKpi[]; topCriticos: PlacaKpi[];
    placas: string[];
    filters: { fecha_desde: string; fecha_hasta: string; placa: string; documento: string };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function pctLabel(v: number | null): string {
    if (v === null) return '—';
    if (v >= 90) return 'Excelente';
    if (v >= 70) return 'Aceptable';
    return 'Crítico';
}
function pctRing(v: number | null): string {
    if (v === null) return '#d1d5db';
    if (v >= 90)   return '#22c55e';
    if (v >= 70)   return '#f59e0b';
    return '#ef4444';
}
function chipColor(v: number): string {
    if (v >= 100) return 'bg-green-100 text-green-700';
    if (v >= 70)  return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
}
function barColor(v: number): string {
    if (v >= 90) return 'bg-green-400';
    if (v >= 70) return 'bg-yellow-400';
    return 'bg-red-400';
}

// ─── Tooltip heatmap ───────────────────────────────────────────────────────────
function HeatTooltip({ celda, dia, placa, x, y }: { celda: Celda; dia: number; placa: string; x: number; y: number }) {
    return (
        <div
            className="fixed z-[999] pointer-events-none bg-popover rounded-xl shadow-md border border-sidebar-border/70 p-3 w-60"
            style={{ left: x + 14, top: y + 14 }}
        >
            <div className="flex items-center justify-between mb-1.5 border-b border-sidebar-border/70 pb-1.5">
                <span className="font-bold text-xs font-mono text-blue-600">{placa}</span>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">Día {dia}</span>
            </div>
            <div className="flex gap-1.5 mb-1.5">
                {celda.promPre !== null && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${chipColor(celda.promPre)}`}>
                        Pre {celda.promPre}%
                    </span>
                )}
                {celda.promPost !== null && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${chipColor(celda.promPost)}`}>
                        Post {celda.promPost}%
                    </span>
                )}
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
                {celda.tripulantes.map((t, i) => (
                    <div key={i} className="flex items-center justify-between gap-1 bg-muted rounded px-1.5 py-0.5">
                        <span className="text-[9px] text-muted-foreground truncate flex-1">{t.nombre}</span>
                        <div className="flex gap-0.5 shrink-0">
                            {t.pre  !== null && <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${chipColor(t.pre)}`}>{t.pre}%</span>}
                            {t.post !== null && <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${chipColor(t.post)}`}>{t.post}%</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Heatmap Grid ──────────────────────────────────────────────────────────────
function HeatmapGrid({ heatmap }: { heatmap: Heatmap }) {
    const [tooltip, setTooltip] = useState<{ celda: Celda; dia: number; placa: string; x: number; y: number } | null>(null);
    const { placas, dias, celdas } = heatmap;

    if (placas.length === 0 || dias.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <ClipboardCheck className="h-10 w-10" />
                <p className="text-sm text-muted-foreground">Sin datos para el período seleccionado.</p>
            </div>
        );
    }

    const CELL_H = 16;
    const LEFT_W = 26;
    const TOP_H  = 56;

    return (
        <div className="w-full overflow-x-auto">
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: `${LEFT_W}px repeat(${placas.length}, minmax(26px, 1fr))`,
                    minWidth: LEFT_W + placas.length * 26,
                }}
            >
                {/* esquina */}
                <div className="sticky top-0 left-0 z-20 bg-card border-b border-r border-sidebar-border/70" style={{ height: TOP_H }} />

                {/* cabecera placas */}
                {placas.map((p) => (
                    <div key={p} className="sticky top-0 z-10 flex items-end justify-center bg-card border-b border-r border-sidebar-border/70 pb-1" style={{ height: TOP_H }}>
                        <span className="text-[8px] font-mono text-muted-foreground leading-none" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                            {p}
                        </span>
                    </div>
                ))}

                {/* filas */}
                {dias.map((dia) => (
                    <div key={dia} style={{ display: 'contents' }}>
                        <div
                            className="sticky left-0 z-10 flex items-center justify-center bg-card border-b border-r border-sidebar-border/70 text-[8px] font-semibold text-muted-foreground select-none"
                            style={{ height: CELL_H }}
                        >{dia}</div>
                        {placas.map((placa) => {
                            const key   = `${dia}|${placa}`;
                            const celda = celdas[key] ?? null;
                            let bg = 'bg-muted';
                            if (celda?.estado === 'ok')      bg = 'bg-emerald-200';
                            if (celda?.estado === 'critico') bg = 'bg-rose-200';
                            return (
                                <div
                                    key={key}
                                    className={`${bg} border-b border-r border-background cursor-default transition-all duration-75 hover:brightness-90 hover:ring-1 hover:ring-border`}
                                    style={{ height: CELL_H }}
                                    onMouseEnter={(e) => celda && setTooltip({ celda, dia, placa, x: e.clientX, y: e.clientY })}
                                    onMouseMove={(e)  => celda && setTooltip((p) => p ? { ...p, x: e.clientX, y: e.clientY } : null)}
                                    onMouseLeave={() => setTooltip(null)}
                                />
                            );
                        })}
                    </div>
                ))}
            </div>
            {tooltip && <HeatTooltip {...tooltip} />}
        </div>
    );
}

// ─── Mini sparkline inline (SVG) ──────────────────────────────────────────────
function Spark({ data, color }: { data: number[]; color: string }) {
    if (data.length < 2) return null;
    const h = 28, w = 80;
    const min = Math.min(...data), max = Math.max(...data);
    const range = max - min || 1;
    const pts = data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((v - min) / range) * h;
        return `${x},${y}`;
    }).join(' ');
    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}

// ─── Donut simple ──────────────────────────────────────────────────────────────
function DonutKpi({ pct, label, color, size = 100 }: { pct: number | null; label: string; color: string; size?: number }) {
    const val = pct ?? 0;
    const data = {
        datasets: [{
            data: [val, Math.max(0, 100 - val)],
            backgroundColor: [color, '#f3f4f6'],
            borderWidth: 0,
            circumference: 360,
            rotation: -90,
        }],
    };
    const opts: ChartOptions<'doughnut'> = {
        responsive: false,
        cutout: '78%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        animation: { duration: 600 },
    };
    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <Doughnut data={data} options={opts} width={size} height={size} />
            <div className="absolute flex flex-col items-center leading-tight">
                <span className="text-lg font-extrabold text-foreground" style={{ color }}>
                    {pct !== null ? `${pct}%` : '—'}
                </span>
                <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
            </div>
        </div>
    );
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function IndicadoresAdherenciaIndex({
    distPre, distPost, promPre, promPost, total, porFecha,
    topBajaPre, heatmap, kpis, topMejor, topCriticos, placas, filters,
}: Props) {
    const [fechaDesde, setFechaDesde] = useState(filters.fecha_desde ?? '');
    const [fechaHasta, setFechaHasta] = useState(filters.fecha_hasta ?? '');
    const [placa,      setPlaca]      = useState(filters.placa ?? '');
    const [documento,  setDocumento]  = useState(filters.documento ?? '');

    const applyFilters = (ov: Partial<typeof filters> = {}) =>
        router.get(route('reparto.indicadores-adherencia.index'), {
            fecha_desde: ov.fecha_desde ?? fechaDesde,
            fecha_hasta: ov.fecha_hasta ?? fechaHasta,
            placa:       ov.placa       ?? placa,
            documento:   ov.documento   ?? documento,
        }, { preserveState: true, preserveScroll: true, replace: true });

    const handleClear = () => {
        setFechaDesde(''); setFechaHasta(''); setPlaca(''); setDocumento('');
        router.get(route('reparto.indicadores-adherencia.index'), {}, { preserveState: false });
    };
    const hasFilters = fechaDesde || fechaHasta || placa || documento;

    // ── Dist helpers ───────────────────────────────────────────────────────────
    const LABELS = ['≥ 90% (Óptimo)', '70–89% (Aceptable)', '< 70% (Crítico)', 'Sin dato'] as const;
    const COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#d1d5db'];

    const mkDonutData = (dist: Dist) => ({
        labels: LABELS as unknown as string[],
        datasets: [{
            data: LABELS.map((l) => dist[l] ?? 0),
            backgroundColor: COLORS,
            borderWidth: 0,
            hoverOffset: 6,
        }],
    });

    const donutOpts = (titulo: string): ChartOptions<'doughnut'> => ({
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
            legend: { display: true, position: 'right', labels: { boxWidth: 10, font: { size: 10 }, color: '#6b7280', padding: 8 } },
            title: { display: false },
            tooltip: {
                callbacks: {
                    label: (ctx: TooltipItem<'doughnut'>) => {
                        const v = ctx.parsed as number;
                        const t = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                        return ` ${v} (${t > 0 ? ((v / t) * 100).toFixed(1) : 0}%)`;
                    },
                },
            },
        },
    });

    // ── Tendencia línea ────────────────────────────────────────────────────────
    const lineData = {
        labels: porFecha.map((p) => p.fecha),
        datasets: [
            {
                label: 'Pre Operacional',
                data: porFecha.map((p) => p.promPre),
                borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,.08)',
                tension: 0.4, fill: true, pointRadius: 2, borderWidth: 2,
                pointBackgroundColor: '#22c55e',
            },
            {
                label: 'Post Operacional',
                data: porFecha.map((p) => p.promPost),
                borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.08)',
                tension: 0.4, fill: true, pointRadius: 2, borderWidth: 2,
                pointBackgroundColor: '#3b82f6',
            },
        ],
    };

    const lineOpts: ChartOptions<'line'> = {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, color: '#6b7280' } },
            tooltip: {
                callbacks: { label: (ctx: TooltipItem<'line'>) => ` ${ctx.dataset.label}: ${ctx.parsed.y}%` },
            },
        },
        scales: {
            y: {
                min: 0, max: 100,
                ticks: { color: '#9ca3af', font: { size: 10 }, callback: (v) => `${v}%` },
                grid: { color: 'rgba(0,0,0,.04)' },
            },
            x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 10 } } },
        },
    };

    // ── Sparkline data ─────────────────────────────────────────────────────────
    const sparkPre   = porFecha.map((p) => p.promPre);
    const sparkPost  = porFecha.map((p) => p.promPost);
    const sparkCrit  = porFecha.map((_, i) => {
        const day = porFecha[i]?.fecha ?? '';
        return 0; // placeholder — se puede calcular si se pasa por fecha
    });

    const cumplTotal = total > 0 ? Object.values(distPre).reduce((a, b) => a + b, 0) : 0;
    const pctCriticos = cumplTotal > 0 ? +((((distPre['< 70% (Crítico)'] ?? 0) / cumplTotal) * 100).toFixed(1)) : 0;
    const pctSinReg   = heatmap.totalCeldas > 0
        ? +((heatmap.celdasVacio / heatmap.totalCeldas * 100).toFixed(1)) : 0;

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Indicadores de Adherencia — ADENAR S.A.S." />

            <div className="min-h-screen bg-muted/40">

                {/* ══ BARRA DE NAVEGACIÓN / TABS ════════════════════════════ */}
                <div className="bg-card border-b border-sidebar-border/70 dark:border-sidebar-border px-4 md:px-6 py-2 flex items-center gap-1">
                    <Link
                        href={route('reparto.indicadores-resumen.index')}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
                    >
                        <BarChart3 className="h-3.5 w-3.5" />
                        Resumen Ejecutivo
                    </Link>
                    <Link
                        href={route('reparto.indicadores.index')}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
                    >
                        <Map className="h-3.5 w-3.5" />
                        Indicadores de Velocidad
                    </Link>
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border border-transparent bg-foreground text-background">
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        Indicadores de Adherencia
                    </span>
                    <Link
                        href={route('reparto.indicadores-tiempo.index')}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
                    >
                        <Clock className="h-3.5 w-3.5" />
                        Adherencia al Tiempo
                    </Link>
                    <Link
                        href={route('reparto.indicadores-entrega-rango.index')}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
                    >
                        <Activity className="h-3.5 w-3.5" />
                        Entrega en Rango
                    </Link>
                </div>

                <div className="space-y-5 p-4 md:p-6 max-w-[1600px] mx-auto">

                    {/* ══ ENCABEZADO ════════════════════════════════════════ */}
                    <div className="bg-card rounded-xl shadow-sm border border-sidebar-border/70 dark:border-sidebar-border px-6 py-4">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            {/* Título */}
                            <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                    <ClipboardCheck className="h-6 w-6 text-emerald-500" />
                                    <h1 className="text-xl font-bold text-foreground">
                                        Lista de verificación de Indicadores de Adherencia
                                    </h1>
                                </div>
                                <p className="text-xs text-muted-foreground ml-8">Pre y Post Operacional · por fecha, placa y tripulante</p>
                            </div>
                            {/* Badges de estado */}
                            <div className="flex items-center gap-2 flex-wrap shrink-0">
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Pre: {promPre !== null ? `${promPre}%` : '—'}
                                </span>
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Post: {promPost !== null ? `${promPost}%` : '—'}
                                </span>
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-sidebar-border/70">
                                    {total.toLocaleString()} registros
                                </span>
                            </div>
                        </div>

                        {/* Filtros */}
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <Label className="text-[10px] font-semibold text-muted-foreground mb-1 block">
                                    <Calendar className="h-3 w-3 inline mr-1" />FECHA DESDE
                                </Label>
                                <Input type="date" value={fechaDesde} placeholder="dd/mm/aaaa"
                                    className="h-8 text-xs rounded-lg"
                                    onChange={(e) => { setFechaDesde(e.target.value); applyFilters({ fecha_desde: e.target.value }); }} />
                            </div>
                            <div>
                                <Label className="text-[10px] font-semibold text-muted-foreground mb-1 block">
                                    <Calendar className="h-3 w-3 inline mr-1" />FECHA HASTA
                                </Label>
                                <Input type="date" value={fechaHasta} placeholder="dd/mm/aaaa"
                                    className="h-8 text-xs rounded-lg"
                                    onChange={(e) => { setFechaHasta(e.target.value); applyFilters({ fecha_hasta: e.target.value }); }} />
                            </div>
                            <div>
                                <Label className="text-[10px] font-semibold text-muted-foreground mb-1 block">PLACA</Label>
                                <Input placeholder="Ej: COLJV386" value={placa}
                                    className="h-8 text-xs rounded-lg uppercase font-mono"
                                    onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                                    onBlur={() => applyFilters()}
                                    onKeyDown={(e) => e.key === 'Enter' && applyFilters()} />
                            </div>
                            <div>
                                <Label className="text-[10px] font-semibold text-muted-foreground mb-1 block">CÉDULA</Label>
                                <div className="relative">
                                    <Input placeholder="Documento..." value={documento}
                                        className="h-8 text-xs rounded-lg pr-8 font-mono"
                                        onChange={(e) => setDocumento(e.target.value)}
                                        onBlur={() => applyFilters()}
                                        onKeyDown={(e) => e.key === 'Enter' && applyFilters()} />
                                    <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                            </div>
                        </div>
                        {hasFilters && (
                            <div className="mt-2 flex justify-end">
                                <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 text-xs text-muted-foreground hover:text-foreground">
                                    <X className="h-3 w-3 mr-1" />Limpiar filtros
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* ══ KPI CARDS ══════════════════════════════════════════ */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {/* Cumplimiento Global — donut */}
                        <div className="bg-card rounded-xl shadow-sm border border-sidebar-border/70 dark:border-sidebar-border p-4 col-span-2 md:col-span-1 flex flex-col items-center justify-center gap-2">
                            <p className="text-[11px] font-semibold text-muted-foreground text-center">Cumplimiento Global</p>
                            <DonutKpi pct={promPre} label={pctLabel(promPre)} color={pctRing(promPre)} size={90} />
                            <div className="flex items-center gap-1 text-[10px] text-green-600 font-semibold">
                                <TrendingUp className="h-3 w-3" />
                                <Spark data={sparkPre.slice(-7)} color="#22c55e" />
                            </div>
                        </div>

                        {/* Registros Totales */}
                        <div className="bg-card rounded-xl shadow-sm border border-sidebar-border/70 dark:border-sidebar-border p-4 flex flex-col justify-between">
                            <div className="flex items-start justify-between">
                                <p className="text-[11px] font-semibold text-muted-foreground">Registros Totales</p>
                                <ClipboardCheck className="h-4 w-4 text-blue-400" />
                            </div>
                            <p className="text-3xl font-extrabold text-foreground mt-1">{total.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground">Este período</p>
                            <div className="mt-2">
                                <Spark data={sparkPre.slice(-10)} color="#3b82f6" />
                            </div>
                        </div>

                        {/* Críticos */}
                        <div className="bg-card rounded-xl shadow-sm border border-sidebar-border/70 dark:border-sidebar-border p-4 flex flex-col justify-between">
                            <div className="flex items-start justify-between">
                                <p className="text-[11px] font-semibold text-muted-foreground">Críticos</p>
                                <AlertTriangle className="h-4 w-4 text-red-400" />
                            </div>
                            <p className="text-3xl font-extrabold text-red-500 mt-1">{kpis.celdasCritico}</p>
                            <p className="text-[10px] text-muted-foreground">{pctCriticos}% del total</p>
                            <div className="mt-2">
                                <Spark data={Array(10).fill(pctCriticos)} color="#ef4444" />
                            </div>
                        </div>

                        {/* Sin Registro */}
                        <div className="bg-card rounded-xl shadow-sm border border-sidebar-border/70 dark:border-sidebar-border p-4 flex flex-col justify-between">
                            <div className="flex items-start justify-between">
                                <p className="text-[11px] font-semibold text-muted-foreground">Sin Registro</p>
                                <XCircle className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <p className="text-3xl font-extrabold text-muted-foreground mt-1">{heatmap.celdasVacio}</p>
                            <p className="text-[10px] text-muted-foreground">{pctSinReg}% del total</p>
                            <div className="mt-2">
                                <Spark data={Array(10).fill(pctSinReg)} color="#9ca3af" />
                            </div>
                        </div>

                        {/* Tripulantes */}
                        <div className="bg-card rounded-xl shadow-sm border border-sidebar-border/70 dark:border-sidebar-border p-4 flex flex-col justify-between">
                            <div className="flex items-start justify-between">
                                <p className="text-[11px] font-semibold text-muted-foreground">Tripulantes</p>
                                <Users className="h-4 w-4 text-purple-400" />
                            </div>
                            <p className="text-3xl font-extrabold text-purple-500 mt-1">{kpis.totalTripulantes}</p>
                            <p className="text-[10px] text-muted-foreground">Activos en período</p>
                            <div className="mt-2">
                                <Spark data={sparkPost.slice(-10)} color="#a855f7" />
                            </div>
                        </div>
                    </div>

                    {/* ══ HEATMAP ════════════════════════════════════════════ */}
                    <div className="bg-card rounded-xl shadow-sm border border-sidebar-border/70 dark:border-sidebar-border p-4">
                        {/* cabecera heatmap */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                            <h2 className="text-sm font-bold text-foreground">
                                Matriz de Cumplimiento — Checklist Pre/Post Operacional
                            </h2>
                            <div className="flex gap-1.5 flex-wrap text-[10px]">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-semibold border border-green-100">
                                    <CheckCircle2 className="h-2.5 w-2.5" />{heatmap.celdasOk} Al 100%
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold border border-red-100">
                                    <XCircle className="h-2.5 w-2.5" />{heatmap.celdasCritico} críticos
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold border border-sidebar-border/70">
                                    {heatmap.celdasVacio} sin registro
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold border ${
                                    heatmap.pctDiligenciamiento >= 90 ? 'bg-green-50 text-green-700 border-green-200'
                                    : heatmap.pctDiligenciamiento >= 70 ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                    : 'bg-red-50 text-red-600 border-red-100'
                                }`}>
                                    {heatmap.pctDiligenciamiento}% diligenciamiento
                                </span>
                            </div>
                        </div>

                        {/* leyenda */}
                        <div className="flex flex-wrap gap-4 mb-3 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-sm bg-emerald-200 border border-emerald-300 inline-block" />
                                100% Pre y Post (todos los tripulantes)
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-sm bg-rose-200 border border-rose-300 inline-block" />
                                Al menos un tripulante bajo 100%
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-sm bg-muted border border-sidebar-border/70 inline-block" />
                                Sin registro
                            </span>
                        </div>

                        <HeatmapGrid heatmap={heatmap} />

                        <p className="text-[10px] text-muted-foreground mt-2 text-center">
                            Pasa el cursor sobre una celda para ver detalles
                        </p>
                    </div>

                    {/* ══ FILA: DONUT PRE · DONUT POST · TENDENCIA ══════════ */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                        {/* Donut Pre */}
                        <div className="bg-card rounded-xl shadow-sm border border-sidebar-border/70 dark:border-sidebar-border p-5">
                            <h3 className="text-xs font-bold text-muted-foreground mb-3">Cumplimiento Pre Operacional</h3>
                            <div className="flex items-center gap-4">
                                <div style={{ height: 130, width: 130, flexShrink: 0 }}>
                                    <Doughnut data={mkDonutData(distPre)} options={donutOpts('Pre')} />
                                </div>
                                <div className="flex-1 space-y-1.5">
                                    {LABELS.map((l, i) => {
                                        const v = distPre[l] ?? 0;
                                        const t = Object.values(distPre).reduce((a, b) => a + b, 0);
                                        return (
                                            <div key={l} className="flex items-center justify-between text-[10px]">
                                                <span className="flex items-center gap-1 text-muted-foreground">
                                                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS[i] }} />
                                                    {l.split(' ')[0]}
                                                </span>
                                                <span className="font-semibold text-foreground">
                                                    {t > 0 ? ((v / t) * 100).toFixed(0) : 0}%
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="mt-3 text-center text-[11px] text-muted-foreground font-mono">
                                {total.toLocaleString()} / {promPre !== null ? `${promPre}%` : '—'}
                            </div>
                        </div>

                        {/* Donut Post */}
                        <div className="bg-card rounded-xl shadow-sm border border-sidebar-border/70 dark:border-sidebar-border p-5">
                            <h3 className="text-xs font-bold text-muted-foreground mb-3">Cumplimiento Post Operacional</h3>
                            <div className="flex items-center gap-4">
                                <div style={{ height: 130, width: 130, flexShrink: 0 }}>
                                    <Doughnut data={mkDonutData(distPost)} options={donutOpts('Post')} />
                                </div>
                                <div className="flex-1 space-y-1.5">
                                    {LABELS.map((l, i) => {
                                        const v = distPost[l] ?? 0;
                                        const t = Object.values(distPost).reduce((a, b) => a + b, 0);
                                        return (
                                            <div key={l} className="flex items-center justify-between text-[10px]">
                                                <span className="flex items-center gap-1 text-muted-foreground">
                                                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS[i] }} />
                                                    {l.split(' ')[0]}
                                                </span>
                                                <span className="font-semibold text-foreground">
                                                    {t > 0 ? ((v / t) * 100).toFixed(0) : 0}%
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="mt-3 text-center text-[11px] text-muted-foreground font-mono">
                                {Object.values(distPost).reduce((a, b) => a + b, 0).toLocaleString()} / {promPost !== null ? `${promPost}%` : '—'}
                            </div>
                        </div>

                        {/* Tendencia */}
                        <div className="bg-card rounded-xl shadow-sm border border-sidebar-border/70 dark:border-sidebar-border p-5">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold text-muted-foreground">Tendencia de Cumplimiento</h3>
                                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-sidebar-border/70">
                                    Últimos {porFecha.length} días
                                </span>
                            </div>
                            {porFecha.length === 0 ? (
                                <div className="h-32 flex items-center justify-center text-muted-foreground">
                                    <TrendingUp className="h-8 w-8" />
                                </div>
                            ) : (
                                <div style={{ height: 150 }}>
                                    <Line data={lineData} options={lineOpts} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ══ FILA: TOP VEHÍCULOS · ATENCIÓN · INSIGHTS ══════════ */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                        {/* Top vehículos mejor cumplimiento */}
                        <div className="bg-card rounded-xl shadow-sm border border-sidebar-border/70 dark:border-sidebar-border p-5">
                            <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 mb-3">
                                <Trophy className="h-4 w-4 text-yellow-500" />
                                Top Vehículos con Mejor Cumplimiento
                            </h3>
                            {topMejor.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-6">Sin datos</p>
                            ) : (
                                <div className="space-y-2">
                                    {topMejor.map((row, i) => (
                                        <div key={row.placa} className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
                                            <span className="text-xs font-mono font-semibold text-foreground w-20 shrink-0">{row.placa}</span>
                                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${barColor(row.prom)}`}
                                                    style={{ width: `${Math.min(row.prom, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-bold text-muted-foreground w-10 text-right shrink-0">{row.prom}%</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button className="mt-4 w-full text-center text-[10px] text-emerald-600 hover:text-emerald-700 font-semibold py-1 border border-emerald-100 rounded-lg hover:bg-emerald-50 transition-colors">
                                Ver todos los vehículos
                            </button>
                        </div>

                        {/* Atención requerida */}
                        <div className="bg-card rounded-xl shadow-sm border border-sidebar-border/70 dark:border-sidebar-border p-5">
                            <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 mb-3">
                                <AlertTriangle className="h-4 w-4 text-orange-500" />
                                Atención Requerida
                            </h3>
                            {topCriticos.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-6">Sin críticos</p>
                            ) : (
                                <div className="space-y-2">
                                    {topCriticos.map((row) => (
                                        <div key={row.placa} className="flex items-center gap-2">
                                            <span className="text-xs font-mono font-semibold text-foreground w-20 shrink-0">{row.placa}</span>
                                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-red-400"
                                                    style={{ width: `${Math.min(row.prom, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-bold text-red-500 w-10 text-right shrink-0">{row.prom}%</span>
                                            {(row.criticos ?? 0) > 0 && (
                                                <span className="text-[9px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full border border-red-100 shrink-0">
                                                    {row.criticos} crít.
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button className="mt-4 w-full text-center text-[10px] text-red-500 hover:text-red-600 font-semibold py-1 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
                                Ver todos los críticos
                            </button>
                        </div>

                        {/* Insights */}
                        <div className="bg-card rounded-xl shadow-sm border border-sidebar-border/70 dark:border-sidebar-border p-5">
                            <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 mb-3">
                                <Zap className="h-4 w-4 text-blue-500" />
                                Insights Inteligentes
                            </h3>
                            <div className="space-y-3">
                                {promPre !== null && promPre >= 90 && (
                                    <div className="flex gap-2 p-2 bg-green-50 rounded-xl border border-green-100">
                                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[10px] font-bold text-green-700">¡Excelente trabajo!</p>
                                            <p className="text-[10px] text-green-600">El cumplimiento global está por encima del objetivo del 90%.</p>
                                        </div>
                                    </div>
                                )}
                                {kpis.celdasCritico > 0 && (
                                    <div className="flex gap-2 p-2 bg-orange-50 rounded-xl border border-orange-100">
                                        <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[10px] font-bold text-orange-700">Oportunidad de mejora</p>
                                            <p className="text-[10px] text-orange-600">{kpis.celdasCritico} registros críticos requieren atención inmediata.</p>
                                        </div>
                                    </div>
                                )}
                                {heatmap.celdasVacio > 0 && (
                                    <div className="flex gap-2 p-2 bg-blue-50 rounded-xl border border-blue-100">
                                        <XCircle className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[10px] font-bold text-blue-700">Consistencia</p>
                                            <p className="text-[10px] text-blue-600">Mantén la consistencia en los registros post operacionales.</p>
                                        </div>
                                    </div>
                                )}
                                {promPre !== null && promPre < 70 && (
                                    <div className="flex gap-2 p-2 bg-red-50 rounded-xl border border-red-100">
                                        <TrendingDown className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[10px] font-bold text-red-700">Alerta crítica</p>
                                            <p className="text-[10px] text-red-600">El promedio está por debajo del umbral mínimo del 70%.</p>
                                        </div>
                                    </div>
                                )}
                                {kpis.celdasCritico === 0 && heatmap.celdasVacio === 0 && total > 0 && (
                                    <div className="flex gap-2 p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[10px] font-bold text-emerald-700">Período perfecto</p>
                                            <p className="text-[10px] text-emerald-600">Todos los registros cumplen al 100% en el período.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Pie de página ─────────────────────────────────────── */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-muted-foreground px-1">
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
                            Actualización automática con cada importación de Excel
                        </span>
                    </div>

                </div>
            </div>
        </AppLayout>
    );
}
