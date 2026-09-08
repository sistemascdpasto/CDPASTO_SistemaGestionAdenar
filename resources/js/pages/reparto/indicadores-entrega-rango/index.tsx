import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import {
    ArcElement,
    BarController,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    DoughnutController,
    Filler,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    RadarController,
    RadialLinearScale,
    Tooltip,
    Legend,
    type ChartOptions,
    type TooltipItem,
} from 'chart.js';
import {
    Activity,
    AlertTriangle,
    BarChart3,
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
} from 'lucide-react';
import { useState } from 'react';
import { Bar, Doughnut, Line, Radar } from 'react-chartjs-2';

ChartJS.register(
    BarController, BarElement,
    DoughnutController, ArcElement,
    RadarController, RadialLinearScale,
    CategoryScale, LinearScale,
    PointElement, LineElement, LineController, Filler,
    Tooltip, Legend,
);

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reparto', href: '/modules/reparto/modulacion' },
    { title: 'Entrega en Rango', href: '/modules/reparto/indicadores-entrega-rango' },
];

// ─── Tipos ─────────────────────────────────────────────────────────────────────
interface Kpis {
    promedio: number | null; total: number;
    en_meta: number; pct_en_meta: number;
    bajo: number; pct_bajo: number;
    ceros: number; gap: number | null; meta: number;
    personas: number; placas: number;
}
interface RadarDow   { dia: string; promedio: number | null; total: number; bajo: number }
interface RadarBrecha{ dia: string; brecha: number | null }
interface DiaPunto   { fecha: string; promedio: number; en_meta: number; bajo: number; total: number;
                       placas: string[]; personas: { nombre: string; placa: string; promedio: number }[] }
interface Persona    { documento: string; nombre: string; placa: string; cargo: string;
                       dias: number; promedio: number; en_meta: number; bajo: number;
                       fecha_min: string; fecha_max: string }
interface CargoPers  { nombre: string; placa: string; promedio: number; dias: number;
                       bajo: number; fecha_min: string; fecha_max: string }
interface Cargo      { cargo: string; promedio: number; total: number; bajo: number; pct_bajo: number;
                       placas: string[]; fecha_min: string; fecha_max: string; personas: CargoPers[] }
interface PlacaPt    { placa: string; promedio: number; total: number }
interface Props {
    kpis: Kpis;
    radar_principal: RadarDow[];
    radar_brecha: RadarBrecha[];
    sparkline: number[];
    por_dia: DiaPunto[];
    bandas: Record<string, number>;
    rank_bottom: Persona[];
    rank_top: Persona[];
    por_cargo: Cargo[];
    por_placa: PlacaPt[];
    todasPlacas: string[];
    cargos: string[];
    filters: { fecha_desde: string; fecha_hasta: string; cargo: string; placas: string[] };
}

// ─── Helpers semáforo ──────────────────────────────────────────────────────────
function colorV(v: number): string {
    if (v < 50) return '#ef4444';
    if (v < 80) return '#f97316';
    if (v < 90) return '#eab308';
    if (v < 95) return '#22c55e';
    return '#16a34a';
}
function bgV(v: number): string {
    if (v < 50) return 'bg-red-100 text-red-700';
    if (v < 80) return 'bg-orange-100 text-orange-700';
    if (v < 90) return 'bg-yellow-100 text-yellow-700';
    if (v < 95) return 'bg-green-100 text-green-700';
    return 'bg-emerald-100 text-emerald-700';
}
function labelV(v: number): string {
    if (v < 50) return 'Crítico';
    if (v < 80) return 'Bajo';
    if (v < 90) return 'Medio';
    if (v < 95) return 'Bueno';
    return 'Óptimo';
}

// ─── Sparkline SVG ─────────────────────────────────────────────────────────────
function Spark({ data, color = '#22c55e' }: { data: number[]; color?: string }) {
    if (data.length < 2) return null;
    const h = 28, w = 90, min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
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
function KpiCard({ label, value, sub, icon: Icon, color, spark }:
    { label: string; value: string; sub?: string; icon: any; color: string; spark?: number[] }) {
    return (
        <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm p-4 flex flex-col justify-between gap-2">
            <div className="flex items-start justify-between">
                <p className="text-[11px] font-semibold text-muted-foreground leading-tight">{label}</p>
                <Icon className="h-4 w-4 shrink-0" style={{ color }} />
            </div>
            <p className="text-2xl font-extrabold" style={{ color }}>{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
            {spark && spark.length > 1 && <div className="mt-1"><Spark data={spark} color={color} /></div>}
        </div>
    );
}

// ─── Barra persona ─────────────────────────────────────────────────────────────
function PersonBar({ p, meta }: { p: Persona; meta: number }) {
    const color = colorV(p.promedio);
    return (
        <li className="py-1.5">
            <div className="flex items-baseline justify-between gap-1 mb-0.5">
                <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-semibold text-foreground truncate block">{p.nombre || p.documento}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        {p.placa && <span className="text-[9px] font-mono font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">{p.placa}</span>}
                        {p.cargo && <span className="text-[9px] text-muted-foreground truncate">{p.cargo}</span>}
                    </div>
                </div>
                <span className="text-[11px] font-bold shrink-0" style={{ color }}>{p.promedio}%</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden relative">
                <div className="h-full rounded-full" style={{ width: `${Math.min(p.promedio, 100)}%`, background: color }} />
                <div className="absolute top-0 bottom-0 w-px bg-blue-400 opacity-50" style={{ left: `${meta}%` }} />
            </div>
            <p className="text-[9px] text-muted-foreground mt-0.5">{p.dias} jornadas · {p.bajo} bajo 80% · {p.fecha_min}–{p.fecha_max}</p>
        </li>
    );
}

// ─── Cargo Detalle acordeón ────────────────────────────────────────────────────
function CargoAcordeon({ datos, meta }: { datos: Cargo[]; meta: number }) {
    const [abierto, setAbierto] = useState<string | null>(null);
    return (
        <div className="divide-y divide-border">
            {datos.map(c => {
                const isOpen = abierto === c.cargo;
                return (
                    <div key={c.cargo}>
                        <button type="button" onClick={() => setAbierto(isOpen ? null : c.cargo)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/60 transition-colors text-left">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-foreground truncate">{c.cargo}</span>
                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                        <span className="text-[10px] text-muted-foreground">{c.fecha_min}–{c.fecha_max}</span>
                                        <span className="text-[10px] font-bold" style={{ color: colorV(c.promedio) }}>{c.promedio}%</span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${bgV(c.promedio)}`}>{labelV(c.promedio)}</span>
                                    </div>
                                </div>
                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden relative">
                                    <div className="h-full rounded-full" style={{ width: `${Math.min(c.promedio, 100)}%`, background: colorV(c.promedio) }} />
                                    <div className="absolute top-0 bottom-0 w-px bg-blue-400 opacity-40" style={{ left: `${meta}%` }} />
                                </div>
                                <div className="flex gap-3 mt-1 text-[9px] text-muted-foreground">
                                    <span>{c.total} jornadas</span>
                                    <span className="text-red-400">{c.bajo} bajo 80% ({c.pct_bajo}%)</span>
                                    <span>{c.personas.length} personas</span>
                                    <span className="font-mono">{c.placas.slice(0, 4).join(' · ')}{c.placas.length > 4 ? ` +${c.placas.length - 4}` : ''}</span>
                                </div>
                            </div>
                            <span className="text-muted-foreground text-[10px] shrink-0">{isOpen ? '▲' : '▼'}</span>
                        </button>
                        {isOpen && (
                            <div className="px-4 pb-4 bg-muted/40">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[10px] mt-2">
                                        <thead>
                                            <tr className="text-muted-foreground border-b border-sidebar-border/70 dark:border-sidebar-border">
                                                <th className="text-left py-1.5 pr-3 font-semibold">Persona</th>
                                                <th className="text-left py-1.5 pr-3 font-semibold">Placa</th>
                                                <th className="text-center py-1.5 pr-3 font-semibold">Promedio</th>
                                                <th className="text-center py-1.5 pr-3 font-semibold">Jornadas</th>
                                                <th className="text-center py-1.5 pr-3 font-semibold">Bajo 80%</th>
                                                <th className="text-left py-1.5 font-semibold">Período</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {c.personas.map((p, i) => (
                                                <tr key={i} className={`border-b border-sidebar-border/70 dark:border-sidebar-border/50 ${i % 2 === 0 ? '' : 'bg-card/30'}`}>
                                                    <td className="py-1.5 pr-3 font-semibold text-foreground truncate max-w-[160px]">{p.nombre}</td>
                                                    <td className="py-1.5 pr-3">
                                                        <span className="font-mono font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded text-[9px]">{p.placa || '—'}</span>
                                                    </td>
                                                    <td className="py-1.5 pr-3 text-center">
                                                        <span className={`font-bold px-2 py-0.5 rounded-full ${bgV(p.promedio)}`}>{p.promedio}%</span>
                                                    </td>
                                                    <td className="py-1.5 pr-3 text-center text-muted-foreground">{p.dias}</td>
                                                    <td className="py-1.5 pr-3 text-center">
                                                        {p.bajo > 0 ? <span className="text-red-500 font-semibold">{p.bajo}</span> : <span className="text-muted-foreground">0</span>}
                                                    </td>
                                                    <td className="py-1.5 text-muted-foreground font-mono">{p.fecha_min}–{p.fecha_max}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {c.placas.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-3">
                                        <span className="text-[9px] text-muted-foreground font-semibold mr-1">Placas:</span>
                                        {c.placas.map(p => (
                                            <span key={p} className="text-[9px] font-mono font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-sidebar-border/70 dark:border-sidebar-border">{p}</span>
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

// ─── Multi-select placas ───────────────────────────────────────────────────────
function PlacaMultiSelect({ todas, seleccionadas, onChange }:
    { todas: string[]; seleccionadas: string[]; onChange: (v: string[]) => void }) {
    const [open,   setOpen]   = useState(false);
    const [buscar, setBuscar] = useState('');

    const filtradas = todas.filter(p => buscar === '' || p.includes(buscar));
    const toggle    = (p: string) => onChange(seleccionadas.includes(p) ? seleccionadas.filter(x => x !== p) : [...seleccionadas, p]);
    const toggleAll = () => onChange(seleccionadas.length === todas.length ? [] : [...todas]);

    return (
        <div className="relative">
            <button type="button" onClick={() => setOpen(v => !v)}
                className="w-full h-8 px-2 text-xs rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-card text-left flex items-center justify-between gap-1 hover:border-border focus:ring-1 focus:ring-ring focus:outline-none transition-colors">
                <span className="truncate text-muted-foreground">
                    {seleccionadas.length === 0 ? 'Todas las placas'
                        : seleccionadas.length === 1 ? seleccionadas[0]
                        : `${seleccionadas.length} placas`}
                </span>
                <span className="text-muted-foreground shrink-0">{open ? '▲' : '▼'}</span>
            </button>
            {seleccionadas.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                    {seleccionadas.map(p => (
                        <span key={p} className="inline-flex items-center gap-0.5 text-[9px] font-mono font-bold bg-muted text-foreground border border-sidebar-border/70 px-1.5 py-0.5 rounded-full">
                            {p}
                            <button type="button" onClick={() => toggle(p)} className="ml-0.5 text-green-400 hover:text-green-700">×</button>
                        </span>
                    ))}
                    <button type="button" onClick={() => onChange([])} className="text-[9px] text-muted-foreground hover:text-red-500 underline ml-1">Limpiar</button>
                </div>
            )}
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-sidebar-border/70 dark:border-sidebar-border rounded-xl shadow-md w-64 max-h-72 flex flex-col">
                        <div className="p-2 border-b border-sidebar-border/70 dark:border-sidebar-border">
                            <input autoFocus type="text" placeholder="Buscar..." value={buscar}
                                onChange={e => setBuscar(e.target.value.toUpperCase())}
                                className="w-full h-7 px-2 text-xs rounded-lg border border-sidebar-border/70 dark:border-sidebar-border bg-muted font-mono uppercase focus:outline-none focus:ring-1 focus:ring-ring" />
                        </div>
                        <label className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted/60 cursor-pointer border-b border-sidebar-border/70">
                            <input type="checkbox" checked={seleccionadas.length === todas.length && todas.length > 0}
                                onChange={toggleAll} className="accent-green-600 w-3 h-3" />
                            Todas ({todas.length})
                        </label>
                        <div className="overflow-y-auto flex-1">
                            {filtradas.map(p => (
                                <label key={p} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                                    <input type="checkbox" checked={seleccionadas.includes(p)}
                                        onChange={() => toggle(p)} className="accent-green-600 w-3 h-3 shrink-0" />
                                    <span className="text-[11px] font-mono font-semibold text-foreground">{p}</span>
                                    {seleccionadas.includes(p) && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />}
                                </label>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function IndicadoresEntregaRangoIndex({
    kpis, radar_principal, radar_brecha, sparkline,
    por_dia, bandas, rank_bottom, rank_top,
    por_cargo, por_placa, todasPlacas, cargos, filters,
}: Props) {
    const [fechaDesde,  setFechaDesde]  = useState(filters.fecha_desde ?? '');
    const [fechaHasta,  setFechaHasta]  = useState(filters.fecha_hasta ?? '');
    const [cargo,       setCargo]       = useState(filters.cargo ?? '');
    const [placasSel,   setPlacasSel]   = useState<string[]>(filters.placas ?? []);
    const [rankMode,    setRankMode]    = useState<'bottom' | 'top'>('bottom');
    const [diaMetric,   setDiaMetric]   = useState<'bajo' | 'en_meta'>('bajo');
    const [showRanking, setShowRanking] = useState(true);
    const [showCargos,  setShowCargos]  = useState(false);
    const [showPlacas,  setShowPlacas]  = useState(false);

    const apply = (ov: Partial<typeof filters> = {}) =>
        router.get(route('reparto.indicadores-entrega-rango.index'), {
            fecha_desde: ov.fecha_desde ?? fechaDesde,
            fecha_hasta: ov.fecha_hasta ?? fechaHasta,
            cargo:       ov.cargo       ?? cargo,
            placas:      ov.placas      ?? placasSel,
        }, { preserveState: true, preserveScroll: true, replace: true });

    const clearFilters = () => {
        setFechaDesde(''); setFechaHasta(''); setCargo(''); setPlacasSel([]);
        router.get(route('reparto.indicadores-entrega-rango.index'), {}, { preserveState: false });
    };
    const hasFilters = fechaDesde || fechaHasta || cargo || placasSel.length > 0;

    const DOW_LABELS = radar_principal.map(d => d.dia);
    const META = kpis.meta;

    // ── Radar Principal ────────────────────────────────────────────────────────
    const radarPrincipalData = {
        labels: DOW_LABELS,
        datasets: [
            {
                label: 'Promedio del día',
                data: radar_principal.map(d => d.promedio ?? 0),
                backgroundColor: 'rgba(176,122,161,0.18)',
                borderColor: '#B07AA1',
                borderWidth: 2.4,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#B07AA1',
                pointBorderWidth: 2.4,
                pointRadius: 5,
            },
            {
                label: `Meta ${META}%`,
                data: DOW_LABELS.map(() => META),
                borderColor: '#3E8C6E',
                borderWidth: 1.5,
                borderDash: [6, 5],
                backgroundColor: 'transparent',
                pointRadius: 0,
            },
        ],
    };

    const radarPrincipalOpts: ChartOptions<'radar'> = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            r: {
                min: 0, max: 100,
                ticks: { stepSize: 20, color: '#9ca3af', font: { size: 10 }, backdropColor: 'transparent' },
                grid: { color: '#E4EAEF' },
                angleLines: { color: '#DCE4EA' },
                pointLabels: { color: '#374151', font: { size: 12 } },
            },
        },
        plugins: {
            legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, color: '#6b7280' } },
            tooltip: {
                callbacks: {
                    label: (ctx: TooltipItem<'radar'>) => ` ${ctx.dataset.label}: ${ctx.parsed.r}%`,
                    afterLabel: (ctx: TooltipItem<'radar'>) => {
                        const d = radar_principal[ctx.dataIndex];
                        if (!d || ctx.datasetIndex !== 0) return '';
                        return `${d.total} jornadas · ${d.bajo} bajo 80%`;
                    },
                },
            },
        },
    };

    // ── Radar Brecha ───────────────────────────────────────────────────────────
    const brechaMax = Math.max(15, ...radar_brecha.map(d => d.brecha ?? 0));

    const radarBrechaData = {
        labels: DOW_LABELS,
        datasets: [
            {
                label: 'Brecha frente a la meta',
                data: radar_brecha.map(d => d.brecha ?? 0),
                backgroundColor: 'rgba(201,138,75,0.18)',
                borderColor: '#C98A4B',
                borderWidth: 2.4,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#C98A4B',
                pointBorderWidth: 2.4,
                pointRadius: 5,
            },
        ],
    };

    const radarBrechaOpts: ChartOptions<'radar'> = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            r: {
                min: 0, max: Math.ceil(brechaMax / 3) * 3,
                ticks: { stepSize: 3, color: '#9ca3af', font: { size: 10 }, backdropColor: 'transparent' },
                grid: { color: '#E4EAEF' },
                angleLines: { color: '#DCE4EA' },
                pointLabels: { color: '#374151', font: { size: 12 } },
            },
        },
        plugins: {
            legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, color: '#6b7280' } },
            tooltip: {
                callbacks: {
                    label: (ctx: TooltipItem<'radar'>) => ` Brecha: ${ctx.parsed.r} puntos`,
                    afterLabel: (ctx: TooltipItem<'radar'>) => {
                        const d = radar_principal[ctx.dataIndex];
                        return d ? ` Promedio real: ${d.promedio}%` : '';
                    },
                },
            },
        },
    };

    // ── Gráfica diaria ─────────────────────────────────────────────────────────
    const diarioData: any = {
        labels: por_dia.map(p => p.fecha),
        datasets: [
            {
                type: 'bar' as const,
                label: diaMetric === 'bajo' ? 'Jornadas bajo 80%' : 'Jornadas en meta',
                data: por_dia.map(p => diaMetric === 'bajo' ? p.bajo : p.en_meta),
                backgroundColor: diaMetric === 'bajo' ? 'rgba(249,115,22,.35)' : 'rgba(34,197,94,.35)',
                borderColor:     diaMetric === 'bajo' ? '#f97316' : '#22c55e',
                borderWidth: 1, yAxisID: 'y2', order: 2,
            },
            {
                type: 'line' as const,
                label: 'Promedio diario',
                data: por_dia.map(p => p.promedio),
                borderColor: '#B07AA1',
                backgroundColor: 'rgba(176,122,161,.08)',
                tension: 0.4, fill: true,
                pointRadius: 3, borderWidth: 2.5,
                yAxisID: 'y', order: 1,
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
                    label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.parsed.y}${ctx.dataset.yAxisID === 'y' ? '%' : ''}`,
                    afterBody: (items: any[]) => {
                        const idx   = items[0]?.dataIndex;
                        const punto = por_dia[idx];
                        if (!punto) return [];
                        const lines: string[] = [];
                        if (punto.placas.length > 0)
                            lines.push('', `Placas: ${punto.placas.join(' · ')}`);
                        if (punto.personas.length > 0) {
                            lines.push('Peor entrega:');
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

    // ── Donut bandas ───────────────────────────────────────────────────────────
    const bandasLabels = Object.keys(bandas);
    const bandasValues = Object.values(bandas);
    const BAND_COLORS  = ['#ef4444','#f97316','#eab308','#22c55e','#16a34a'];

    const donutData = {
        labels: bandasLabels,
        datasets: [{ data: bandasValues, backgroundColor: BAND_COLORS, borderWidth: 0, hoverOffset: 6 }],
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

    const rankData = rankMode === 'bottom' ? rank_bottom : rank_top;

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Entrega en Rango — Reparto" />

            <div className="min-h-screen bg-muted/40">

                {/* ── TABS ─────────────────────────────────────────────────── */}
                <div className="bg-card border-b border-sidebar-border/70 dark:border-sidebar-border px-4 md:px-6 py-2 flex items-center gap-1 flex-wrap">
                    <Link href={route('reparto.indicadores-resumen.index')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all">
                        <BarChart3 className="h-3.5 w-3.5" />Resumen Ejecutivo
                    </Link>
                    <Link href={route('reparto.indicadores.index')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all">
                        <Map className="h-3.5 w-3.5" />Velocidad
                    </Link>
                    <Link href={route('reparto.indicadores-adherencia.index')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all">
                        <ClipboardCheck className="h-3.5 w-3.5" />Adherencia Checklist
                    </Link>
                    <Link href={route('reparto.indicadores-tiempo.index')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all">
                        <Clock className="h-3.5 w-3.5" />Adherencia al Tiempo
                    </Link>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border border-transparent bg-foreground text-background">
                        <Activity className="h-3.5 w-3.5" />Entrega en Rango
                    </span>
                </div>

                <div className="space-y-5 p-4 md:p-6 max-w-[1500px] mx-auto">

                    {/* ── ENCABEZADO ────────────────────────────────────────── */}
                    <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm px-6 py-5">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                            <div className="flex-1">
                                <p className="text-[10px] font-bold text-green-500 mb-1">La pregunta</p>
                                <h1 className="text-xl font-bold text-foreground leading-snug mb-1">
                                    ¿Está el reparto <em className="not-italic text-green-600">entregando a tiempo</em>?
                                </h1>
                                <p className="text-xs text-muted-foreground mb-4">
                                    Porcentaje de entregas realizadas dentro del rango de tiempo planificado. Meta interna: {META}%.
                                </p>
                                {kpis.promedio !== null ? (
                                    <div className="flex items-end gap-3">
                                        <div>
                                            <span className="text-5xl font-extrabold" style={{ color: colorV(kpis.promedio) }}>{kpis.promedio}</span>
                                            <span className="text-2xl font-bold text-muted-foreground">%</span>
                                        </div>
                                        <div className="mb-1">
                                            <p className="text-xs font-semibold text-muted-foreground">Promedio general</p>
                                            {kpis.gap !== null && kpis.gap > 0 && (
                                                <div className="flex items-center gap-1 text-xs text-red-500 font-semibold mt-0.5">
                                                    <TrendingDown className="h-3.5 w-3.5" />{kpis.gap} puntos bajo la meta de {META}%
                                                </div>
                                            )}
                                            {kpis.gap !== null && kpis.gap <= 0 && (
                                                <div className="flex items-center gap-1 text-xs text-green-600 font-semibold mt-0.5">
                                                    <TrendingUp className="h-3.5 w-3.5" />Por encima de la meta de {META}%
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Sin datos para el período seleccionado.</p>
                                )}
                                <div className="mt-3">
                                    <Spark data={sparkline} color={kpis.promedio !== null ? colorV(kpis.promedio) : '#9ca3af'} />
                                    <p className="text-[9px] text-muted-foreground mt-0.5">Promedio día a día del período</p>
                                </div>
                            </div>

                            {/* Sidefigs */}
                            <div className="lg:w-64 space-y-3">
                                <div className="flex items-start gap-3 bg-green-50 dark:bg-green-900/10 rounded-xl p-3 border border-green-100">
                                    <Target className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xl font-extrabold text-green-600">{kpis.pct_en_meta}%</p>
                                        <p className="text-[10px] text-muted-foreground">jornadas alcanzó ≥{META}%
                                            <span className="font-semibold"> ({kpis.en_meta} de {kpis.total})</span></p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 bg-orange-50 dark:bg-orange-900/10 rounded-xl p-3 border border-orange-100">
                                    <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xl font-extrabold text-orange-600">{kpis.pct_bajo}%</p>
                                        <p className="text-[10px] text-muted-foreground">jornadas bajo 80%
                                            <span className="font-semibold"> ({kpis.bajo} de {kpis.total})</span></p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/10 rounded-xl p-3 border border-red-100">
                                    <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xl font-extrabold text-red-600">{kpis.ceros}</p>
                                        <p className="text-[10px] text-muted-foreground">jornadas con 0% de entrega en rango</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── FILTROS ───────────────────────────────────────────── */}
                    <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm px-5 py-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                            <div className="grid gap-1">
                                <Label className="text-[10px] font-bold text-muted-foreground"><Calendar className="h-3 w-3 inline mr-1" />Fecha desde</Label>
                                <Input type="date" value={fechaDesde} className="h-8 text-xs rounded-lg"
                                    onChange={e => { setFechaDesde(e.target.value); apply({ fecha_desde: e.target.value }); }} />
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-[10px] font-bold text-muted-foreground"><Calendar className="h-3 w-3 inline mr-1" />Fecha hasta</Label>
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
                                <PlacaMultiSelect todas={todasPlacas} seleccionadas={placasSel}
                                    onChange={v => { setPlacasSel(v); apply({ placas: v }); }} />
                            </div>
                        </div>
                        {hasFilters && (
                            <div className="mt-2 flex justify-between items-center">
                                <p className="text-[10px] text-muted-foreground">
                                    Viendo <b>{kpis.total.toLocaleString()} registros</b>
                                    {cargo && <> · <b>{cargo}</b></>}
                                    {placasSel.length > 0 && <> · <b>{placasSel.length} placa{placasSel.length > 1 ? 's' : ''}</b></>}
                                </p>
                                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs text-muted-foreground">
                                    <X className="h-3 w-3 mr-1" />Limpiar
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* ── KPI CARDS ─────────────────────────────────────────── */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        <KpiCard label="Registros totales" value={kpis.total.toLocaleString()} sub="Este período"
                            icon={Activity} color="#3b82f6" spark={sparkline} />
                        <KpiCard label="Promedio general"
                            value={kpis.promedio !== null ? `${kpis.promedio}%` : '—'}
                            sub={kpis.promedio !== null ? labelV(kpis.promedio) : 'Sin datos'}
                            icon={Target} color={kpis.promedio !== null ? colorV(kpis.promedio) : '#9ca3af'} />
                        <KpiCard label="Alcanzaron meta" value={`${kpis.en_meta}`}
                            sub={`${kpis.pct_en_meta}% ≥ ${META}%`} icon={CheckCircle2} color="#22c55e" />
                        <KpiCard label="Bajo 80%" value={`${kpis.bajo}`}
                            sub={`${kpis.pct_bajo}% del total`} icon={AlertTriangle} color="#f97316" />
                        <KpiCard label="Personas" value={`${kpis.personas}`}
                            sub={`${kpis.placas} vehículos`} icon={Users} color="#8b5cf6" />
                    </div>

                    {/* ══ LAYOUT PRINCIPAL: izquierda gráficas · derecha panel ══ */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

                        {/* ── COLUMNA IZQUIERDA (2/3) ──────────────────────── */}
                        <div className="xl:col-span-2 space-y-4">

                            {/* Dos radares lado a lado */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                {/* Radar Principal */}
                                <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm p-5">
                                    <h3 className="text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1.5">
                                        <Activity className="h-4 w-4 text-purple-500" />
                                        Promedio por día de la semana
                                    </h3>
                                    <p className="text-[10px] text-muted-foreground mb-3">
                                        Comparación con la meta de {META}% · Pasa el cursor para detalles
                                    </p>
                                    <div style={{ height: 280 }}>
                                        <Radar data={radarPrincipalData} options={radarPrincipalOpts} />
                                    </div>
                                    {/* Tabla de valores */}
                                    <div className="mt-3 space-y-1">
                                        {radar_principal.map(d => (
                                            <div key={d.dia} className="flex items-center justify-between text-[10px]">
                                                <span className="text-muted-foreground w-20 shrink-0">{d.dia}</span>
                                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden mx-2 relative">
                                                    <div className="h-full rounded-full" style={{ width: `${d.promedio ?? 0}%`, background: colorV(d.promedio ?? 0) }} />
                                                    <div className="absolute top-0 bottom-0 w-px bg-green-500 opacity-50" style={{ left: `${META}%` }} />
                                                </div>
                                                <span className="font-bold w-12 text-right shrink-0" style={{ color: colorV(d.promedio ?? 0) }}>
                                                    {d.promedio !== null ? `${d.promedio}%` : '—'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Radar Brecha */}
                                <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm p-5">
                                    <h3 className="text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1.5">
                                        <TrendingDown className="h-4 w-4 text-orange-500" />
                                        Brecha frente a la meta ({META}%)
                                    </h3>
                                    <p className="text-[10px] text-muted-foreground mb-3">
                                        Puntos que faltan para alcanzar {META}% por día · Menor = mejor
                                    </p>
                                    <div style={{ height: 280 }}>
                                        <Radar data={radarBrechaData} options={radarBrechaOpts} />
                                    </div>
                                    {/* Tabla de brechas */}
                                    <div className="mt-3 space-y-1">
                                        {radar_brecha.map((d, i) => {
                                            const prom = radar_principal[i]?.promedio;
                                            return (
                                                <div key={d.dia} className="flex items-center justify-between text-[10px]">
                                                    <span className="text-muted-foreground w-20 shrink-0">{d.dia}</span>
                                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden mx-2">
                                                        <div className="h-full rounded-full bg-orange-400"
                                                            style={{ width: `${Math.min(((d.brecha ?? 0) / 20) * 100, 100)}%` }} />
                                                    </div>
                                                    <span className="font-bold w-16 text-right shrink-0 text-orange-600">
                                                        {d.brecha !== null ? `−${d.brecha} pts` : '—'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Gráfica diaria */}
                            <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm p-5">
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                                        <Calendar className="h-4 w-4 text-green-500" />
                                        Promedio diario de entrega en rango
                                    </h3>
                                    <div className="flex gap-1">
                                        {(['bajo', 'en_meta'] as const).map(v => (
                                            <button key={v} onClick={() => setDiaMetric(v)}
                                                className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold transition-colors ${diaMetric === v ? 'bg-foreground text-background border-sidebar-border' : 'text-muted-foreground border-sidebar-border/70 hover:border-border'}`}>
                                                {v === 'bajo' ? 'Bajo 80%' : 'En meta'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground mb-3">Línea: promedio · Columnas: jornadas · Tooltip: placas y personas</p>
                                {por_dia.length > 0
                                    ? <div style={{ height: 260 }}><Bar data={diarioData} options={diarioOpts} /></div>
                                    : <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
                                }
                            </div>

                            {/* Donut distribución */}
                            <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm p-5">
                                <h3 className="text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1.5">
                                    <Target className="h-4 w-4 text-purple-500" />
                                    ¿Cuánto pesa cada nivel?
                                </h3>
                                <p className="text-[10px] text-muted-foreground mb-3">Distribución de jornadas por rango de cumplimiento</p>
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
                                                    <span className="w-2 h-2 rounded-full" style={{ background: BAND_COLORS[i] }} />{l}
                                                </span>
                                                <span className="font-semibold text-foreground">
                                                    {t > 0 ? ((v / t) * 100).toFixed(1) : 0}% ({v})
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* ── COLUMNA DERECHA (1/3): acordeones ────────────── */}
                        <div className="xl:col-span-1 space-y-3">

                            {/* Ranking */}
                            <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm overflow-hidden">
                                <button onClick={() => setShowRanking(v => !v)}
                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/60 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded-full">03</span>
                                        <span className="text-xs font-bold text-foreground">Ranking de personas</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0 ml-2">{showRanking ? '▲' : '▼'}</span>
                                </button>
                                {showRanking && (
                                    <div className="border-t border-sidebar-border/70 dark:border-sidebar-border px-4 pb-4">
                                        <p className="text-[10px] text-muted-foreground mt-3 mb-1">Solo personas con 5+ jornadas</p>
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
                                                {rankData.map(p => <PersonBar key={p.documento} p={p} meta={META} />)}
                                              </ul>
                                        }
                                    </div>
                                )}
                            </div>

                            {/* Cargos */}
                            <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm overflow-hidden">
                                <button onClick={() => setShowCargos(v => !v)}
                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/60 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <Users className="h-4 w-4 text-purple-500 shrink-0" />
                                        <span className="text-xs font-bold text-foreground">Comparación entre cargos</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0 ml-2">{showCargos ? '▲' : '▼'}</span>
                                </button>
                                {showCargos && (
                                    <div className="border-t border-sidebar-border/70 dark:border-sidebar-border">
                                        {por_cargo.length === 0
                                            ? <div className="h-16 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
                                            : <CargoAcordeon datos={por_cargo} meta={META} />
                                        }
                                    </div>
                                )}
                            </div>

                            {/* Por vehículo */}
                            <div className="bg-card rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm overflow-hidden">
                                <button onClick={() => setShowPlacas(v => !v)}
                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/60 transition-colors">
                                    <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                                        <Truck className="h-4 w-4 text-purple-500 shrink-0" />
                                        Entrega en rango por vehículo
                                    </span>
                                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0 ml-2">{showPlacas ? '▲' : '▼'}</span>
                                </button>
                                {showPlacas && (
                                    <div className="px-4 pb-4 border-t border-sidebar-border/70 dark:border-sidebar-border">
                                        {por_placa.length === 0
                                            ? <p className="text-xs text-muted-foreground text-center py-4">Sin vehículos con 5+ jornadas</p>
                                            : (
                                                <div className="mt-3 space-y-1.5 max-h-80 overflow-y-auto pr-1">
                                                    {por_placa.map(p => (
                                                        <div key={p.placa} className="flex items-center gap-2">
                                                            <span className="text-[10px] font-mono font-bold text-muted-foreground w-20 shrink-0">{p.placa}</span>
                                                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden relative">
                                                                <div className="h-full rounded-full" style={{ width: `${Math.min(p.promedio, 100)}%`, background: colorV(p.promedio) }} />
                                                                <div className="absolute top-0 bottom-0 w-px bg-green-500 opacity-40" style={{ left: `${META}%` }} />
                                                            </div>
                                                            <span className="text-[10px] font-bold w-9 text-right shrink-0" style={{ color: colorV(p.promedio) }}>{p.promedio}%</span>
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
                        <div><b className="text-muted-foreground">Fuente</b> · Tabla eventos_tripulacion — campo % Entrega en Rango</div>
                        <div><b className="text-muted-foreground">Cálculo</b> · Bajo meta = menor a 80%. Promedios simples (cada jornada pesa igual).</div>
                        <div><b className="text-muted-foreground">Alcance</b> · {kpis.total.toLocaleString()} registros · {kpis.personas} personas · {kpis.placas} vehículos</div>
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
