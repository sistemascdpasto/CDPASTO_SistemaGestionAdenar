import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import {
    BarController,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    DoughnutController,
    ArcElement,
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
    Calendar,
    CheckCircle2,
    ClipboardCheck,
    Clock,
    Map,
    Target,
    TrendingDown,
    TrendingUp,
    Truck,
    Users,
    X,
    XCircle,
    Zap,
    Activity,
    BarChart3,
} from 'lucide-react';
import { useState, Fragment } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
    BarController, BarElement,
    DoughnutController, ArcElement,
    CategoryScale, LinearScale,
    PointElement, LineElement, LineController, Filler,
    Tooltip, Legend,
);

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reparto', href: '/modules/reparto/modulacion' },
    { title: 'Adherencia al Tiempo', href: '/modules/reparto/indicadores-tiempo' },
];

// ─── Tipos ─────────────────────────────────────────────────────────────────────
interface Kpis {
    promedio: number | null; total: number;
    bajo_critico: number; pct_bajo_critico: number;
    ceros: number; en_meta: number; pct_en_meta: number;
    gap: number | null; meta: number;
    personas: number; placas: number; dias_con_datos: number;
}
interface DiaPunto {
    fecha: string; fecha_full: string;
    promedio: number; bajo_critico: number; ceros: number; total: number;
    placas: string[];
    personas: { nombre: string; placa: string; promedio: number }[];
}
interface DowPunto  {
    dia: string; promedio: number | null; total: number; bajo_critico: number;
    placas: string[];
    personas: { nombre: string; placa: string; promedio: number }[];
}
interface HistBucket{ rango: string; inicio: number; total: number }
interface Persona   { documento: string; nombre: string; cargo: string; placa: string; dias: number; promedio: number; bajo_critico: number; ceros: number; en_meta: number; pct_acumulado?: number }
interface ScatterPt  { nombre: string; dias: number; promedio: number; ceros: number; cargo: string }
interface CargoPtPersona { nombre: string; placa: string; promedio: number; dias: number; bajo_critico: number; fecha_min: string; fecha_max: string }
interface CargoPt    {
    cargo: string; promedio: number; total: number; bajo_critico: number; pct_bajo: number;
    placas: string[]; personas: CargoPtPersona[]; fecha_min: string; fecha_max: string;
}
interface PlacaPt    { placa: string; promedio: number; total: number }
interface HmNombre   { documento: string; nombre: string }
interface HeatmapData{ personas: HmNombre[]; dias: string[]; celdas: Record<string, number> }
interface Props {
    kpis: Kpis; sparkline: number[];
    por_dia: DiaPunto[]; patron_dow: DowPunto[];
    histograma: HistBucket[]; bandas: Record<string, number>;
    rank_bottom: Persona[]; rank_top: Persona[];
    pareto: Persona[]; scatter: ScatterPt[];
    por_cargo: CargoPt[]; por_placa: PlacaPt[];
    heatmap: HeatmapData;
    cargos: string[];
    todasPlacas: string[];
    filters: { fecha_desde: string; fecha_hasta: string; cargo: string; placas: string[] };
}

// ─── Colores semáforo ──────────────────────────────────────────────────────────
const COLORES = {
    critico : '#ef4444',
    bajo    : '#f97316',
    medio   : '#eab308',
    bueno   : '#22c55e',
    optimo  : '#16a34a',
    meta    : '#3b82f6',
};

function colorBanda(v: number): string {
    if (v < 50) return COLORES.critico;
    if (v < 80) return COLORES.bajo;
    if (v < 90) return COLORES.medio;
    if (v < 95) return COLORES.bueno;
    return COLORES.optimo;
}
function bgBanda(v: number): string {
    if (v < 50) return 'bg-red-100 text-red-700';
    if (v < 80) return 'bg-orange-100 text-orange-700';
    if (v < 90) return 'bg-yellow-100 text-yellow-700';
    if (v < 95) return 'bg-green-100 text-green-700';
    return 'bg-emerald-100 text-emerald-700';
}
function labelBanda(v: number): string {
    if (v < 50) return 'Crítico';
    if (v < 80) return 'Bajo';
    if (v < 90) return 'Medio';
    if (v < 95) return 'Bueno';
    return 'Óptimo';
}

// ─── Mini sparkline SVG ────────────────────────────────────────────────────────
function Spark({ data, color = '#22c55e', h = 32, w = 100 }: { data: number[]; color?: string; h?: number; w?: number }) {
    if (data.length < 2) return null;
    const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
    const pts = data.map((v, i) =>
        `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`
    ).join(' ');
    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8"
                strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color, spark, sparkColor }:
    { label: string; value: string; sub?: string; icon: any; color: string; spark?: number[]; sparkColor?: string }) {
    return (
        <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm p-4 flex flex-col justify-between gap-2">
            <div className="flex items-start justify-between">
                <p className="text-[11px] font-semibold text-muted-foreground leading-tight">{label}</p>
                <Icon className="h-4 w-4 shrink-0" style={{ color }} />
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

// ─── Barra de persona ──────────────────────────────────────────────────────────
function PersonBar({ persona, meta }: { persona: Persona; meta: number }) {
    const pct = persona.promedio;
    const color = colorBanda(pct);
    return (
        <li className="flex items-center gap-2 py-1.5">
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-1 mb-0.5">
                    <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-semibold text-foreground truncate block">
                            {persona.nombre || persona.documento}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {persona.placa && (
                                <span className="text-[9px] font-mono font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
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
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
                    <div className="absolute top-0 bottom-0 w-px bg-blue-400 opacity-60"
                        style={{ left: `${meta}%` }} />
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                    {persona.dias} jornadas · {persona.bajo_critico} bajo 80%
                    {persona.ceros > 0 && ` · ${persona.ceros} en 0%`}
                </p>
            </div>
        </li>
    );
}

// ─── Celda heatmap ─────────────────────────────────────────────────────────────
function hmColor(v: number | undefined): string {
    if (v === undefined) return '#f3f4f6';
    if (v === 0) return '#fca5a5';
    if (v < 50)  return '#fecaca';
    if (v < 80)  return '#fed7aa';
    if (v < 90)  return '#fef08a';
    if (v < 95)  return '#bbf7d0';
    return '#86efac';
}

// ─── Cargo detalle: acordeón con tabla de personas ────────────────────────────
function CargoDetalle({ datos, meta }: { datos: CargoPt[]; meta: number }) {
    const [abierto, setAbierto] = useState<string | null>(null);

    return (
        <div className="divide-y divide-border">
            {datos.map((c) => {
                const isOpen = abierto === c.cargo;
                return (
                    <div key={c.cargo}>
                        {/* Fila resumen del cargo */}
                        <button
                            type="button"
                            onClick={() => setAbierto(isOpen ? null : c.cargo)}
                            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/60 transition-colors text-left"
                        >
                            {/* Barra de progreso */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-foreground truncate">{c.cargo}</span>
                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                        <span className="text-[10px] text-muted-foreground">{c.fecha_min} – {c.fecha_max}</span>
                                        <span className="text-[10px] font-bold" style={{ color: colorBanda(c.promedio) }}>{c.promedio}%</span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${bgBanda(c.promedio)}`}>
                                            {labelBanda(c.promedio)}
                                        </span>
                                    </div>
                                </div>
                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden relative">
                                    <div className="h-full rounded-full" style={{ width: `${Math.min(c.promedio, 100)}%`, background: colorBanda(c.promedio) }} />
                                    <div className="absolute top-0 bottom-0 w-px bg-blue-400 opacity-50" style={{ left: `${meta}%` }} />
                                </div>
                                <div className="flex gap-3 mt-1 text-[9px] text-muted-foreground">
                                    <span>{c.total} jornadas</span>
                                    <span className="text-red-400">{c.bajo_critico} bajo 80% ({c.pct_bajo}%)</span>
                                    <span>{c.personas.length} personas</span>
                                    <span className="font-mono">{c.placas.slice(0, 4).join(' · ')}{c.placas.length > 4 ? ` +${c.placas.length - 4}` : ''}</span>
                                </div>
                            </div>
                            <span className="text-muted-foreground text-[10px] shrink-0">{isOpen ? '▲' : '▼'}</span>
                        </button>

                        {/* Tabla expandida de personas */}
                        {isOpen && (
                            <div className="px-5 pb-4 bg-muted/40">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[10px] mt-2">
                                        <thead>
                                            <tr className="text-muted-foreground border-b border-sidebar-border/70 dark:border-sidebar-border">
                                                <th className="text-left font-semibold py-1.5 pr-3">Persona</th>
                                                <th className="text-left font-semibold py-1.5 pr-3">Placa</th>
                                                <th className="text-center font-semibold py-1.5 pr-3">Promedio</th>
                                                <th className="text-center font-semibold py-1.5 pr-3">Jornadas</th>
                                                <th className="text-center font-semibold py-1.5 pr-3">Bajo 80%</th>
                                                <th className="text-left font-semibold py-1.5">Período</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {c.personas.map((p, i) => (
                                                <tr key={p.nombre ? `${p.nombre}-${p.placa}-${i}` : i} className={`border-b border-sidebar-border/70 dark:border-sidebar-border/50 ${i % 2 === 0 ? '' : 'bg-card/30'}`}>
                                                    <td className="py-1.5 pr-3 font-semibold text-foreground truncate max-w-[180px]">
                                                        {p.nombre}
                                                    </td>
                                                    <td className="py-1.5 pr-3">
                                                        <span className="font-mono font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                                                            {p.placa || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="py-1.5 pr-3 text-center">
                                                        <span className={`font-bold px-2 py-0.5 rounded-full ${bgBanda(p.promedio)}`}>
                                                            {p.promedio}%
                                                        </span>
                                                    </td>
                                                    <td className="py-1.5 pr-3 text-center text-muted-foreground">{p.dias}</td>
                                                    <td className="py-1.5 pr-3 text-center">
                                                        {p.bajo_critico > 0
                                                            ? <span className="text-red-500 font-semibold">{p.bajo_critico}</span>
                                                            : <span className="text-muted-foreground">0</span>
                                                        }
                                                    </td>
                                                    <td className="py-1.5 text-muted-foreground font-mono">
                                                        {p.fecha_min} – {p.fecha_max}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {/* Placas del cargo */}
                                {c.placas.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-3">
                                        <span className="text-[9px] text-muted-foreground font-semibold mr-1">Placas:</span>
                                        {c.placas.map(p => (
                                            <span key={p} className="text-[9px] font-mono font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-sidebar-border/70 dark:border-sidebar-border">
                                                {p}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Multi-select de placas con búsqueda y checkboxes ────────────────────────
function PlacaMultiSelect({
    todas, seleccionadas, onChange,
}: { todas: string[]; seleccionadas: string[]; onChange: (v: string[]) => void }) {
    const [open,    setOpen]    = useState(false);
    const [buscar,  setBuscar]  = useState('');
    const ref = useState<HTMLDivElement | null>(null);

    const filtradas = todas.filter(p =>
        buscar === '' || p.toLowerCase().includes(buscar.toLowerCase())
    );

    const toggle = (placa: string) => {
        const next = seleccionadas.includes(placa)
            ? seleccionadas.filter(p => p !== placa)
            : [...seleccionadas, placa];
        onChange(next);
    };

    const toggleAll = () => {
        onChange(seleccionadas.length === todas.length ? [] : [...todas]);
    };

    return (
        <div className="relative">
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full h-8 px-2 text-xs rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-card text-left flex items-center justify-between gap-1 hover:border-border focus:ring-1 focus:ring-ring focus:outline-none transition-colors"
            >
                <span className="truncate text-muted-foreground">
                    {seleccionadas.length === 0
                        ? 'Todas las placas'
                        : seleccionadas.length === 1
                            ? seleccionadas[0]
                            : `${seleccionadas.length} placas seleccionadas`}
                </span>
                <span className="text-muted-foreground shrink-0">{open ? '▲' : '▼'}</span>
            </button>

            {/* Chips de selección */}
            {seleccionadas.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                    {seleccionadas.map(p => (
                        <span key={p}
                            className="inline-flex items-center gap-0.5 text-[9px] font-mono font-bold bg-muted text-foreground border border-sidebar-border/70 px-1.5 py-0.5 rounded-full">
                            {p}
                            <button type="button" onClick={() => toggle(p)}
                                className="ml-0.5 text-blue-400 hover:text-blue-700">×</button>
                        </span>
                    ))}
                    <button type="button" onClick={() => onChange([])}
                        className="text-[9px] text-muted-foreground hover:text-red-500 underline ml-1">
                        Limpiar
                    </button>
                </div>
            )}

            {/* Dropdown */}
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-sidebar-border/70 dark:border-sidebar-border rounded-xl shadow-md w-64 max-h-72 flex flex-col">
                        {/* Búsqueda */}
                        <div className="p-2 border-b border-sidebar-border/70 dark:border-sidebar-border">
                            <input
                                autoFocus
                                type="text"
                                placeholder="Buscar placa..."
                                value={buscar}
                                onChange={e => setBuscar(e.target.value.toUpperCase())}
                                className="w-full h-7 px-2 text-xs rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-muted font-mono uppercase focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                        </div>
                        {/* Seleccionar todas */}
                        <label className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted/60 cursor-pointer border-b border-sidebar-border/70 dark:border-sidebar-border">
                            <input type="checkbox"
                                checked={seleccionadas.length === todas.length && todas.length > 0}
                                onChange={toggleAll}
                                className="accent-blue-600 w-3 h-3" />
                            Seleccionar todas ({todas.length})
                        </label>
                        {/* Lista */}
                        <div className="overflow-y-auto flex-1">
                            {filtradas.length === 0
                                ? <p className="text-[10px] text-muted-foreground text-center py-4">Sin resultados</p>
                                : filtradas.map(p => (
                                    <label key={p}
                                        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                        <input type="checkbox"
                                            checked={seleccionadas.includes(p)}
                                            onChange={() => toggle(p)}
                                            className="accent-blue-600 w-3 h-3 shrink-0" />
                                        <span className="text-[11px] font-mono font-semibold text-foreground">
                                            {p}
                                        </span>
                                        {seleccionadas.includes(p) && (
                                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                        )}
                                    </label>
                                ))
                            }
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function IndicadoresTiempoIndex({
    kpis, sparkline, por_dia, patron_dow,
    histograma, bandas, rank_bottom, rank_top,
    pareto, scatter, por_cargo, por_placa,
    heatmap, cargos, todasPlacas, filters,
}: Props) {
    const [fechaDesde, setFechaDesde] = useState(filters.fecha_desde ?? '');
    const [fechaHasta, setFechaHasta] = useState(filters.fecha_hasta ?? '');
    const [cargo,      setCargo]      = useState(filters.cargo ?? '');
    const [placasSel,  setPlacasSel]  = useState<string[]>(filters.placas ?? []);
    const [rankMode,   setRankMode]   = useState<'bottom' | 'top'>('bottom');
    const [diaMetric,  setDiaMetric]  = useState<'bajo' | 'ceros'>('bajo');
    const [showHeatmap,  setShowHeatmap]  = useState(false);
    const [showPlacas,   setShowPlacas]   = useState(false);
    const [showRanking,  setShowRanking]  = useState(true);
    const [showCargos,   setShowCargos]   = useState(false);

    const apply = (ov: Partial<{ fecha_desde: string; fecha_hasta: string; cargo: string; placas: string[] }> = {}) =>
        router.get(route('reparto.indicadores-tiempo.index'), {
            fecha_desde: ov.fecha_desde ?? fechaDesde,
            fecha_hasta: ov.fecha_hasta ?? fechaHasta,
            cargo:       ov.cargo       ?? cargo,
            placas:      ov.placas      ?? placasSel,
        }, { preserveState: true, preserveScroll: true, replace: true });

    const clearFilters = () => {
        setFechaDesde(''); setFechaHasta(''); setCargo(''); setPlacasSel([]);
        router.get(route('reparto.indicadores-tiempo.index'), {}, { preserveState: false });
    };
    const hasFilters = fechaDesde || fechaHasta || cargo || placasSel.length > 0;

    // ── Gráfica diaria ──────────────────────────────────────────────────────
    const diarioData: any = {
        labels: por_dia.map(p => p.fecha),
        datasets: [
            {
                type: 'bar' as const,
                label: diaMetric === 'bajo' ? 'Jornadas bajo 80%' : 'Jornadas en 0%',
                data: por_dia.map(p => diaMetric === 'bajo' ? p.bajo_critico : p.ceros),
                backgroundColor: diaMetric === 'bajo' ? 'rgba(249,115,22,.35)' : 'rgba(239,68,68,.35)',
                borderColor:     diaMetric === 'bajo' ? '#f97316' : '#ef4444',
                borderWidth: 1,
                yAxisID: 'y2',
                order: 2,
            },
            {
                type: 'line' as const,
                label: 'Promedio diario',
                data: por_dia.map(p => p.promedio),
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34,197,94,.08)',
                tension: 0.4, fill: true,
                pointRadius: 3, borderWidth: 2,
                yAxisID: 'y',
                order: 1,
            },
        ],
    };
    const diarioOpts: ChartOptions<'bar'> = {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, color: '#6b7280' } },
            tooltip: {
                callbacks: {
                    label: (ctx: any) =>
                        ` ${ctx.dataset.label}: ${ctx.parsed.y}${ctx.dataset.yAxisID === 'y' ? '%' : ''}`,
                    afterBody: (items: any[]) => {
                        const idx   = items[0]?.dataIndex;
                        const punto = por_dia[idx];
                        if (!punto) return [];
                        const lines: string[] = [];
                        if (punto.placas.length > 0)
                            lines.push('', `Placas: ${punto.placas.join(' · ')}`);
                        if (punto.personas.length > 0) {
                            lines.push('Top incumplidores:');
                            punto.personas.slice(0, 5).forEach(p =>
                                lines.push(`  ${p.nombre} (${p.placa}) → ${p.promedio}%`)
                            );
                        }
                        return lines;
                    },
                },
            },
        },
        scales: {
            y:  { min: 0, max: 100, position: 'left',  grid: { color: 'rgba(0,0,0,.04)' }, ticks: { color: '#9ca3af', font: { size: 10 }, callback: (v: any) => `${v}%` } },
            y2: { min: 0, position: 'right', grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 10 } } },
            x:  { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 10 }, maxRotation: 45 } },
        },
    };

    // ── Histograma ──────────────────────────────────────────────────────────
    const histData = {
        labels: histograma.map(b => b.rango),
        datasets: [{
            label: 'Jornadas',
            data: histograma.map(b => b.total),
            backgroundColor: histograma.map(b => colorBanda(b.inicio)),
            borderRadius: 4,
        }],
    };
    const histOpts: ChartOptions<'bar'> = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx: TooltipItem<'bar'>) => ` ${ctx.parsed.y} jornadas` } },
        },
        scales: {
            y: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { color: '#9ca3af', font: { size: 10 } } },
            x: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 9 } } },
        },
    };

    // ── Donut bandas ────────────────────────────────────────────────────────
    const bandasLabels  = Object.keys(bandas);
    const bandasValues  = Object.values(bandas);
    const bandasColors  = [COLORES.critico, COLORES.bajo, COLORES.medio, COLORES.bueno, COLORES.optimo];
    const donutData = {
        labels: bandasLabels,
        datasets: [{ data: bandasValues, backgroundColor: bandasColors, borderWidth: 0, hoverOffset: 6 }],
    };
    const donutOpts: ChartOptions<'doughnut'> = {
        responsive: true, maintainAspectRatio: false, cutout: '70%',
        plugins: {
            legend: { display: true, position: 'right', labels: { boxWidth: 10, font: { size: 10 }, color: '#6b7280', padding: 8 } },
            tooltip: { callbacks: { label: (ctx: TooltipItem<'doughnut'>) => {
                const v = ctx.parsed as number;
                const t = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                return ` ${v} (${t > 0 ? ((v / t) * 100).toFixed(1) : 0}%)`;
            }}},
        },
    };

    // ── DOW ─────────────────────────────────────────────────────────────────
    const dowData = {
        labels: patron_dow.map(d => d.dia),
        datasets: [{
            label: 'Promedio',
            data: patron_dow.map(d => d.promedio),
            backgroundColor: patron_dow.map(d => colorBanda(d.promedio ?? 0) + 'cc'),
            borderColor:     patron_dow.map(d => colorBanda(d.promedio ?? 0)),
            borderWidth: 1.5, borderRadius: 6,
        }],
    };
    const dowOpts: ChartOptions<'bar'> = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (ctx: TooltipItem<'bar'>) =>
                        ` Promedio: ${ctx.parsed.y}% · ${patron_dow[ctx.dataIndex]?.total} jornadas`,
                    afterBody: (items: any[]) => {
                        const idx   = items[0]?.dataIndex;
                        const punto = patron_dow[idx];
                        if (!punto) return [];
                        const lines: string[] = [];
                        if (punto.placas.length > 0)
                            lines.push('', `Placas: ${punto.placas.join(' · ')}`);
                        if (punto.personas.length > 0) {
                            lines.push('Peor promedio:');
                            punto.personas.forEach(p =>
                                lines.push(`  ${p.nombre} (${p.placa}) → ${p.promedio}%`)
                            );
                        }
                        return lines;
                    },
                },
            },
        },
        scales: {
            y: { min: 0, max: 100, ticks: { color: '#9ca3af', font: { size: 10 }, callback: (v: any) => `${v}%` }, grid: { color: 'rgba(0,0,0,.04)' } },
            x: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 11 } } },
        },
    };

    // ── Pareto ──────────────────────────────────────────────────────────────
    const paretoData: any = {
        labels: pareto.map(p => p.placa ? `${p.nombre || p.documento} (${p.placa})` : (p.nombre || p.documento)),
        datasets: [
            {
                type: 'bar' as const,
                label: 'Jornadas bajo 80%',
                data: pareto.map(p => p.bajo_critico),
                backgroundColor: '#f97316aa',
                borderColor: '#f97316', borderWidth: 1,
                yAxisID: 'y', order: 2,
            },
            {
                type: 'line' as const,
                label: '% Acumulado',
                data: pareto.map(p => p.pct_acumulado),
                borderColor: '#ef4444',
                pointRadius: 3, borderWidth: 2,
                yAxisID: 'y2', order: 1,
            },
        ],
    };
    const paretoOpts: ChartOptions<'bar'> = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, color: '#6b7280' } },
        },
        scales: {
            y:  { position: 'left',  ticks: { color: '#9ca3af', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,.04)' } },
            y2: { position: 'right', min: 0, max: 100, grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 10 }, callback: (v: any) => `${v}%` } },
            x:  { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 9 }, maxRotation: 45 } },
        },
    };

    // ── Por cargo ───────────────────────────────────────────────────────────
    const cargoData = {
        labels: por_cargo.map(c => c.cargo),
        datasets: [
            {
                type: 'bar' as const,
                label: '% Bajo 80%',
                data: por_cargo.map(c => c.pct_bajo),
                backgroundColor: '#f9731655',
                borderColor: '#f97316', borderWidth: 1,
                yAxisID: 'y2', order: 2,
            },
            {
                type: 'bar' as const,
                label: 'Promedio',
                data: por_cargo.map(c => c.promedio),
                backgroundColor: por_cargo.map(c => colorBanda(c.promedio) + 'cc'),
                borderRadius: 4,
                yAxisID: 'y', order: 1,
            },
        ],
    };
    const cargoOpts: ChartOptions<'bar'> = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, color: '#6b7280' } },
        },
        scales: {
            y:  { min: 0, max: 100, position: 'left',  ticks: { color: '#9ca3af', font: { size: 10 }, callback: (v: any) => `${v}%` }, grid: { color: 'rgba(0,0,0,.04)' } },
            y2: { min: 0, max: 100, position: 'right', ticks: { color: '#9ca3af', font: { size: 10 }, callback: (v: any) => `${v}%` }, grid: { display: false } },
            x:  { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 10 } } },
        },
    };

    const rankData = rankMode === 'bottom' ? rank_bottom : rank_top;

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Adherencia al Tiempo — Reparto" />

            <div className="min-h-screen bg-muted/40">

                {/* ── TABS ─────────────────────────────────────────────────── */}
                <div className="bg-card border-b border-sidebar-border/70 dark:border-sidebar-border px-4 md:px-6 py-2 flex items-center gap-1 flex-wrap">
                    <Link href={route('reparto.indicadores-resumen.index')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all">
                        <BarChart3 className="h-3.5 w-3.5" />Resumen Ejecutivo
                    </Link>
                    <Link href={route('reparto.indicadores.index')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all">
                        <Map className="h-3.5 w-3.5" />Indicadores de Velocidad
                    </Link>
                    <Link href={route('reparto.indicadores-adherencia.index')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all">
                        <ClipboardCheck className="h-3.5 w-3.5" />Adherencia Checklist
                    </Link>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border border-transparent bg-foreground text-background">
                        <Clock className="h-3.5 w-3.5" />Adherencia al Tiempo
                    </span>
                    <Link href={route('reparto.indicadores-entrega-rango.index')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all">
                        <Activity className="h-3.5 w-3.5" />Entrega en Rango
                    </Link>
                </div>

                <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">

                    {/* ── HERO / ENCABEZADO ─────────────────────────────────── */}
                    <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm px-6 py-5">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">

                            {/* Izquierda: pregunta + KPI grande */}
                            <div className="flex-1">
                                <p className="text-[10px] font-bold text-blue-500 mb-1">La pregunta</p>
                                <h1 className="text-xl font-bold text-foreground leading-snug mb-1">
                                    ¿Qué tan lejos está el reparto de <em className="not-italic text-blue-600">cumplir su tiempo</em>?
                                </h1>
                                <p className="text-xs text-muted-foreground mb-4">
                                    Cada registro es una jornada de una persona en un vehículo, medida como
                                    % de adherencia al tiempo planificado. La meta interna es {kpis.meta}%.
                                </p>
                                {kpis.promedio !== null ? (
                                    <div className="flex items-end gap-3">
                                        <div>
                                            <span className="text-5xl font-extrabold" style={{ color: colorBanda(kpis.promedio) }}>
                                                {kpis.promedio}
                                            </span>
                                            <span className="text-2xl font-bold text-muted-foreground">%</span>
                                        </div>
                                        <div className="mb-1">
                                            <p className="text-xs font-semibold text-muted-foreground">Adherencia promedio</p>
                                            {kpis.gap !== null && kpis.gap > 0 && (
                                                <div className="flex items-center gap-1 text-xs text-red-500 font-semibold mt-0.5">
                                                    <TrendingDown className="h-3.5 w-3.5" />
                                                    {kpis.gap} puntos bajo la meta de {kpis.meta}%
                                                </div>
                                            )}
                                            {kpis.gap !== null && kpis.gap <= 0 && (
                                                <div className="flex items-center gap-1 text-xs text-green-600 font-semibold mt-0.5">
                                                    <TrendingUp className="h-3.5 w-3.5" />
                                                    Por encima de la meta de {kpis.meta}%
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Sin datos para el período seleccionado.</p>
                                )}
                                <div className="mt-3">
                                    <Spark data={sparkline} color={kpis.promedio !== null ? colorBanda(kpis.promedio) : '#9ca3af'} h={36} w={180} />
                                    <p className="text-[9px] text-muted-foreground mt-0.5">Promedio día a día del período</p>
                                </div>
                            </div>

                            {/* Derecha: sidefigs */}
                            <div className="lg:w-64 space-y-3">
                                <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/10 rounded-xl p-3 border border-red-100">
                                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xl font-extrabold text-red-600">{kpis.pct_bajo_critico}%</p>
                                        <p className="text-[10px] text-muted-foreground">de las jornadas terminó bajo 80%
                                            <span className="font-semibold"> ({kpis.bajo_critico} de {kpis.total})</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 bg-orange-50 dark:bg-orange-900/10 rounded-xl p-3 border border-orange-100">
                                    <XCircle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xl font-extrabold text-orange-600">{kpis.ceros}</p>
                                        <p className="text-[10px] text-muted-foreground">jornadas registradas en 0% de adherencia</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 bg-green-50 dark:bg-green-900/10 rounded-xl p-3 border border-green-100">
                                    <Target className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xl font-extrabold text-green-600">{kpis.pct_en_meta}%</p>
                                        <p className="text-[10px] text-muted-foreground">de las jornadas alcanzó la meta de {kpis.meta}% o más</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── FILTROS ────────────────────────────────────────────── */}
                    <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm px-5 py-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                            <div className="grid gap-1">
                                <Label className="text-[10px] font-bold text-muted-foreground">
                                    <Calendar className="h-3 w-3 inline mr-1" />Fecha desde
                                </Label>
                                <Input type="date" value={fechaDesde} className="h-8 text-xs rounded-lg"
                                    onChange={e => { setFechaDesde(e.target.value); apply({ fecha_desde: e.target.value }); }} />
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-[10px] font-bold text-muted-foreground">
                                    <Calendar className="h-3 w-3 inline mr-1" />Fecha hasta
                                </Label>
                                <Input type="date" value={fechaHasta} className="h-8 text-xs rounded-lg"
                                    onChange={e => { setFechaHasta(e.target.value); apply({ fecha_hasta: e.target.value }); }} />
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-[10px] font-bold text-muted-foreground">Cargo</Label>
                                <select value={cargo}
                                    className="h-8 text-xs rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-card px-2 text-foreground focus:ring-1 focus:ring-ring focus:outline-none"
                                    onChange={e => { setCargo(e.target.value); apply({ cargo: e.target.value }); }}>
                                    <option value="">Todos los cargos</option>
                                    {cargos.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-[10px] font-bold text-muted-foreground">Placa(s)</Label>
                                <PlacaMultiSelect
                                    todas={todasPlacas}
                                    seleccionadas={placasSel}
                                    onChange={v => { setPlacasSel(v); apply({ placas: v }); }}
                                />
                            </div>
                        </div>
                        {hasFilters && (
                            <div className="mt-2 flex justify-between items-center">
                                <p className="text-[10px] text-muted-foreground">
                                    Viendo <b>{kpis.total.toLocaleString()} registros</b>
                                    {cargo && <> · cargo: <b>{cargo}</b></>}
                                    {placasSel.length > 0 && <> · <b>{placasSel.length} placa{placasSel.length > 1 ? 's' : ''}</b></>}
                                    · <b>{kpis.personas} personas</b>
                                </p>
                                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs text-muted-foreground">
                                    <X className="h-3 w-3 mr-1" />Limpiar
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* ── KPI CARDS ─────────────────────────────────────────── */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <KpiCard label="Registros totales" value={kpis.total.toLocaleString()}
                            sub="Este período" icon={Zap} color="#3b82f6" spark={sparkline} sparkColor="#3b82f6" />
                        <KpiCard label="Promedio general" value={kpis.promedio !== null ? `${kpis.promedio}%` : '—'}
                            sub={kpis.promedio !== null ? labelBanda(kpis.promedio) : 'Sin datos'}
                            icon={Target} color={kpis.promedio !== null ? colorBanda(kpis.promedio) : '#9ca3af'} />
                        <KpiCard label="Bajo 80%" value={`${kpis.bajo_critico}`}
                            sub={`${kpis.pct_bajo_critico}% del total`}
                            icon={AlertTriangle} color="#f97316" />
                        <KpiCard label="Jornadas en 0%" value={`${kpis.ceros}`}
                            sub="Sin adherencia" icon={XCircle} color="#ef4444" />
                        <KpiCard label="Alcanzaron meta" value={`${kpis.en_meta}`}
                            sub={`${kpis.pct_en_meta}% ≥ ${kpis.meta}%`}
                            icon={CheckCircle2} color="#22c55e" />
                        <KpiCard label="Personas" value={`${kpis.personas}`}
                            sub={`${kpis.placas} vehículos`} icon={Users} color="#8b5cf6" />
                    </div>

                    {/* ══ LAYOUT PRINCIPAL: izquierda gráficas · derecha panel colapsable ══ */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

                        {/* ── COLUMNA IZQUIERDA (2/3) ──────────────────────── */}
                        <div className="xl:col-span-2 space-y-4">

                            {/* S01 — Distribución (Donut) */}
                            <section>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-[10px] font-bold bg-foreground text-background px-2 py-0.5 rounded-full">01</span>
                                    <h2 className="text-sm font-bold text-foreground">El promedio esconde dos mundos</h2>
                                </div>
                                <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm p-5">
                                    <h3 className="text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1.5">
                                        <Target className="h-4 w-4 text-purple-500" />
                                        ¿Cuánto pesa cada nivel?
                                    </h3>
                                    <p className="text-[10px] text-muted-foreground mb-3">Participación de cada banda sobre el total</p>
                                    {bandasValues.some(v => v > 0)
                                        ? <div style={{ height: 180 }}><Doughnut data={donutData} options={donutOpts} /></div>
                                        : <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
                                    }
                                    <div className="mt-3 space-y-1">
                                        {bandasLabels.map((l, i) => {
                                            const v = bandasValues[i];
                                            const t = bandasValues.reduce((a, b) => a + b, 0);
                                            return (
                                                <div key={l} className="flex items-center justify-between text-[10px]">
                                                    <span className="flex items-center gap-1 text-muted-foreground">
                                                        <span className="w-2 h-2 rounded-full" style={{ background: bandasColors[i] }} />{l}
                                                    </span>
                                                    <span className="font-semibold text-foreground">
                                                        {t > 0 ? ((v / t) * 100).toFixed(1) : 0}% ({v})
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </section>

                            {/* S02 — Cuándo: Diario arriba, DOW abajo */}
                            <section>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-[10px] font-bold bg-foreground text-background px-2 py-0.5 rounded-full">02</span>
                                    <h2 className="text-sm font-bold text-foreground">¿Cuándo se cae el cumplimiento?</h2>
                                </div>
                                <div className="space-y-4">
                                    {/* Diario — ancho completo */}
                                    <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm p-5">
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                                                <Calendar className="h-4 w-4 text-green-500" />
                                                Promedio diario y jornadas incumplidas
                                            </h3>
                                            <div className="flex gap-1">
                                                {(['bajo', 'ceros'] as const).map(v => (
                                                    <button key={v} onClick={() => setDiaMetric(v)}
                                                        className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold transition-colors ${diaMetric === v ? 'bg-foreground text-background border-sidebar-border' : 'text-muted-foreground border-sidebar-border/70 hover:border-border'}`}>
                                                        {v === 'bajo' ? 'Bajo 80%' : 'En 0%'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mb-3">Línea: promedio del día · Columnas: jornadas problemáticas · Pasa el cursor para ver placas y personas</p>
                                        {por_dia.length > 0
                                            ? <div style={{ height: 260 }}><Bar data={diarioData} options={diarioOpts} /></div>
                                            : <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
                                        }
                                    </div>

                                    {/* DOW — ancho completo debajo */}
                                    <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm p-5">
                                        <h3 className="text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1.5">
                                            <Clock className="h-4 w-4 text-blue-500" />
                                            Patrón por día de la semana
                                        </h3>
                                        <p className="text-[10px] text-muted-foreground mb-3">Promedio de adherencia por día · Pasa el cursor para ver placas y personas</p>
                                        {patron_dow.length > 0
                                            ? <div style={{ height: 220 }}><Bar data={dowData} options={dowOpts} /></div>
                                            : <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
                                        }
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* ── COLUMNA DERECHA (1/3): acordeones ────────────── */}
                        <div className="xl:col-span-1 space-y-3">

                            {/* S03 — Nombres concretos (acordeón) */}
                            <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm overflow-hidden">
                                <button
                                    onClick={() => setShowRanking(v => !v)}
                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/60 transition-colors"
                                >
                                    <div className="flex items-center gap-2 text-left">
                                        <span className="text-[10px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded-full">03</span>
                                        <span className="text-xs font-bold text-foreground">Incumplimiento — nombres concretos</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0 ml-2">
                                        {showRanking ? '▲' : '▼'}
                                    </span>
                                </button>
                                {showRanking && (
                                    <div className="border-t border-sidebar-border/70 dark:border-sidebar-border px-4 pb-4">
                                        <p className="text-[10px] text-muted-foreground mt-3 mb-1">Solo personas con 10+ jornadas</p>
                                        <div className="flex gap-1 mb-3">
                                            {(['bottom', 'top'] as const).map(v => (
                                                <button key={v} onClick={() => setRankMode(v)}
                                                    className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold transition-colors ${rankMode === v ? 'bg-foreground text-background border-sidebar-border' : 'text-muted-foreground border-sidebar-border/70 hover:border-border'}`}>
                                                    {v === 'bottom' ? 'Más bajos' : 'Más altos'}
                                                </button>
                                            ))}
                                        </div>
                                        {rankData.length === 0
                                            ? <p className="text-xs text-muted-foreground text-center py-4">Sin datos suficientes</p>
                                            : <ul className="space-y-0.5 max-h-80 overflow-y-auto pr-1">
                                                {rankData.map(p => <PersonBar key={p.documento} persona={p} meta={kpis.meta} />)}
                                              </ul>
                                        }
                                    </div>
                                )}
                            </div>

                            {/* Comparación entre cargos (siempre visible, colapsable) */}
                            <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm overflow-hidden">
                                <button
                                    onClick={() => setShowCargos(v => !v)}
                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/60 transition-colors"
                                >
                                    <div className="flex items-center gap-2 text-left">
                                        <Users className="h-4 w-4 text-purple-500 shrink-0" />
                                        <span className="text-xs font-bold text-foreground">Comparación entre cargos</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0 ml-2">
                                        {showCargos ? '▲' : '▼'}
                                    </span>
                                </button>
                                {showCargos && (
                                    <div className="border-t border-sidebar-border/70 dark:border-sidebar-border">
                                        {por_cargo.length === 0
                                            ? <div className="h-16 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
                                            : <CargoDetalle datos={por_cargo} meta={kpis.meta} />
                                        }
                                    </div>
                                )}
                            </div>

                            {/* S04 — El detalle: heatmap */}
                            <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm overflow-hidden">
                                <button
                                    onClick={() => setShowHeatmap(v => !v)}
                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/60 transition-colors"
                                >
                                    <div className="flex items-center gap-2 text-left">
                                        <span className="text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full">04</span>
                                        <span className="text-xs font-bold text-foreground">Mapa de calor: persona por día</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0 ml-2">
                                        {showHeatmap ? '▲' : '▼'}
                                    </span>
                                </button>
                                {showHeatmap && (
                                    <div className="px-4 pb-4 border-t border-sidebar-border/70 dark:border-sidebar-border">
                                        <p className="text-[10px] text-muted-foreground mt-3 mb-2">
                                            Solo personas con 15+ días. Vacío = sin registro.
                                        </p>
                                        {heatmap.personas.length === 0
                                            ? <p className="text-xs text-muted-foreground text-center py-4">Sin personas con 15+ días</p>
                                            : (
                                                <div className="overflow-x-auto">
                                                    <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: `110px repeat(${heatmap.dias.length}, minmax(12px, 1fr))`,
                                                        minWidth: 110 + heatmap.dias.length * 12,
                                                        gap: 1,
                                                    }}>
                                                        <div className="sticky left-0 bg-card z-10" />
                                                        {heatmap.dias.map(d => (
                                                            <div key={d} className="text-[7px] text-center text-muted-foreground font-mono pb-0.5">
                                                                {d.slice(8)}
                                                            </div>
                                                        ))}
                                                        {heatmap.personas.map(p => (
                                                            <Fragment key={p.documento || p.nombre}>
                                                                <div key={`n-${p.documento || p.nombre}`}
                                                                    className="sticky left-0 bg-card z-10 text-[9px] font-semibold text-muted-foreground truncate pr-1 flex items-center">
                                                                    {p.nombre}
                                                                </div>
                                                                {heatmap.dias.map(d => {
                                                                    const v = heatmap.celdas[p.documento + '|' + d];
                                                                    return (
                                                                        <div key={`${p.documento || p.nombre}-${d}`}
                                                                            className="rounded-sm cursor-default hover:ring-1 hover:ring-border"
                                                                            style={{ height: 13, background: hmColor(v) }}
                                                                            title={v !== undefined ? `${p.nombre} · ${d}: ${v}%` : `${p.nombre} · ${d}: sin registro`}
                                                                        />
                                                                    );
                                                                })}
                                                            </Fragment>
                                                        ))}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 mt-2 text-[8px] text-muted-foreground">
                                                        {[['#fca5a5','0%'],['#fed7aa','1–49%'],['#fef08a','50–79%'],
                                                          ['#bbf7d0','80–89%'],['#86efac','90–94%'],['#4ade80','≥95%'],
                                                          ['#f3f4f6','Sin reg.']].map(([c, l]) => (
                                                            <span key={l} className="flex items-center gap-0.5">
                                                                <span className="w-2 h-2 rounded-sm inline-block border border-sidebar-border/70" style={{ background: c }} />{l}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        }
                                    </div>
                                )}
                            </div>

                            {/* S04 — Adherencia por vehículo */}
                            <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm overflow-hidden">
                                <button
                                    onClick={() => setShowPlacas(v => !v)}
                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/60 transition-colors"
                                >
                                    <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                                        <Truck className="h-4 w-4 text-purple-500 shrink-0" />
                                        Adherencia por vehículo
                                    </span>
                                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0 ml-2">
                                        {showPlacas ? '▲' : '▼'}
                                    </span>
                                </button>
                                {showPlacas && (
                                    <div className="px-4 pb-4 border-t border-sidebar-border/70 dark:border-sidebar-border">
                                        {por_placa.length === 0
                                            ? <p className="text-xs text-muted-foreground text-center py-4">Sin vehículos con 10+ jornadas</p>
                                            : (
                                                <div className="mt-3 space-y-1.5 max-h-80 overflow-y-auto pr-1">
                                                    {por_placa.map(p => (
                                                        <div key={p.placa} className="flex items-center gap-2">
                                                            <span className="text-[10px] font-mono font-bold text-muted-foreground w-20 shrink-0">{p.placa}</span>
                                                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden relative">
                                                                <div className="h-full rounded-full"
                                                                    style={{ width: `${Math.min(p.promedio, 100)}%`, background: colorBanda(p.promedio) }} />
                                                                <div className="absolute top-0 bottom-0 w-px bg-blue-400 opacity-50"
                                                                    style={{ left: `${kpis.meta}%` }} />
                                                            </div>
                                                            <span className="text-[10px] font-bold w-9 text-right shrink-0" style={{ color: colorBanda(p.promedio) }}>
                                                                {p.promedio}%
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )
                                        }
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>

                    {/* ── FOOTER ────────────────────────────────────────────── */}
                    <footer className="text-[10px] text-muted-foreground space-y-1 pt-2 border-t border-sidebar-border/70 dark:border-sidebar-border">
                        <div><b className="text-muted-foreground">Fuente</b> · Tabla eventos_tripulacion — campo % Adherencia al Tiempo</div>
                        <div><b className="text-muted-foreground">Cálculo</b> · Incumplida = menor a 80%. Promedios simples (cada jornada pesa igual).</div>
                        <div><b className="text-muted-foreground">Alcance</b> · {kpis.total.toLocaleString()} registros · {kpis.personas} personas · {kpis.placas} vehículos · {kpis.dias_con_datos} días con datos</div>
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
                            Actualización automática con cada importación de Excel
                        </div>
                    </footer>

                </div>
            </div>
        </AppLayout>
    );
}
