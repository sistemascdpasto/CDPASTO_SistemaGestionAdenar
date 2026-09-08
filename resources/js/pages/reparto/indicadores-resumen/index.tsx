import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import {
    BarController,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Filler,
    Legend,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Tooltip,
    type ChartOptions,
    type TooltipItem,
} from 'chart.js';
import {
    Activity,
    AlertTriangle,
    BarChart3,
    Calendar,
    CheckCircle2,
    ChevronDown,
    ClipboardCheck,
    Clock,
    Map,
    Target,
    TrendingUp,
    Users,
    X,
} from 'lucide-react';
import { useState, type ComponentType } from 'react';
import { Line } from 'react-chartjs-2';

ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, PointElement, LineElement, LineController, Filler, Tooltip, Legend);

const ACCENT = '#D4102A';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Resumen Ejecutivo', href: '/modules/reparto/indicadores-resumen' },
];

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Kpis {
    cumpl_general: number | null;
    metas_cumplidas: number;
    total_indicadores: number;
    entrega_rango: number | null;
    adh_tiempo: number | null;
    total_registros: number;
    periodo_desde: string;
    periodo_hasta: string;
}
interface CargoPt {
    cargo: string;
    total: number;
    score_incump: number;
    cl_pre_cero: number;
    cl_post_cero: number;
    rechazos_sum: number;
    entrega_cero: number;
    entrega_bajo: number;
    alertas_sum: number;
    excesos_sum: number;
    adh_bajo: number;
    prom_adh: number | null;
    prom_entrega: number | null;
    prom_mod: number | null;
}
interface TendPunto {
    fecha: string;
    adh: number | null;
    entrega: number | null;
    cl_pre: number | null;
}
interface Props {
    kpis: Kpis;
    promedios: Record<string, number | null>;
    cumplimiento: Record<string, number | null>;
    brechas: Record<string, number | null>;
    etiquetas: Record<string, string>;
    unidades: Record<string, string>;
    metas: Record<string, number>;
    por_cargo: CargoPt[];
    tendencia: TendPunto[];
    todasPlacas: string[];
    cargos: string[];
    filters: { fecha_desde: string; fecha_hasta: string; cargo: string; placas: string[] };
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ORDEN_INDICADORES = ['cl_pre', 'cl_post', 'entrega', 'adh_tiempo', 'modulacion', 'rechazos', 'rmd', 'alertas', 'excesos'];
const INVERTIDOS = new Set(['rechazos', 'alertas', 'excesos']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function semaforo(pct: number | null): string {
    if (pct === null) return '#94a3b8';
    if (pct >= 90) return '#15803d';
    if (pct >= 70) return '#b45309';
    return '#dc2626';
}

function chipCls(pct: number | null): string {
    if (pct === null) return 'bg-muted text-muted-foreground';
    if (pct >= 90) return 'bg-[#15803d] text-white';
    if (pct >= 70) return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300';
    return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300';
}

function estadoLabel(pct: number | null): string {
    if (pct === null) return 'Sin datos';
    if (pct >= 90) return 'Óptimo';
    if (pct >= 70) return 'Aceptable';
    return 'Crítico';
}

// ─── Componentes base (línea de Seguridad) ───────────────────────────────────

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <div className={`rounded-xl border border-sidebar-border/70 bg-card dark:border-sidebar-border ${className}`}>{children}</div>;
}

function SectionHeader({
    icon: Icon,
    title,
    subtitle,
    badge,
}: {
    icon: ComponentType<{ className?: string }>;
    title: string;
    subtitle?: string;
    badge?: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${ACCENT}1a`, color: ACCENT }}>
                    <Icon className="size-4" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
                </div>
            </div>
            {badge}
        </div>
    );
}

function Chip({ children, cls }: { children: React.ReactNode; cls: string }) {
    return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${cls}`}>{children}</span>;
}

function Kpi({
    label,
    value,
    sub,
    color,
    icon: Icon,
}: {
    label: string;
    value: string;
    sub: string;
    color: string;
    icon: ComponentType<{ className?: string }>;
}) {
    return (
        <Card className="border-sidebar-border/70 dark:border-sidebar-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <div className="flex size-9 items-center justify-center rounded-full" style={{ backgroundColor: `${color}1a`, color }}>
                    <Icon className="size-4" />
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-2xl font-semibold tabular-nums tracking-tight" style={{ color }}>
                    {value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
            </CardContent>
        </Card>
    );
}

// ─── Barra de un indicador ────────────────────────────────────────────────────

function IndicadorBar({
    ikey,
    cumpl,
    promedio,
    meta,
    etiqueta,
    unidad,
    invertido,
}: {
    ikey: string;
    cumpl: number | null;
    promedio: number | null;
    meta: number;
    etiqueta: string;
    unidad: string;
    invertido: boolean;
}) {
    const color = semaforo(cumpl);
    const pct = cumpl ?? 0;
    const valFmt = promedio !== null ? (ikey === 'rmd' ? `${promedio}/5` : `${promedio}${unidad === '%' ? '%' : ` ${unidad}`}`) : '—';
    const metaFmt = ikey === 'rmd' ? `${meta}/5` : `${meta}${unidad === '%' ? '%' : ` ${unidad}`}`;

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-foreground">{etiqueta}</span>
                    {invertido && (
                        <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-400">
                            menor = mejor
                        </span>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">Meta: {metaFmt}</span>
                    <span className="text-xs font-bold tabular-nums" style={{ color }}>
                        {valFmt}
                    </span>
                    <Chip cls={chipCls(cumpl)}>{pct}%</Chip>
                </div>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
            </div>
        </div>
    );
}

// ─── Barra de brecha ──────────────────────────────────────────────────────────

function BrechaBar({
    ikey,
    brecha,
    meta,
    etiqueta,
    unidad,
}: {
    ikey: string;
    brecha: number | null;
    promedio: number | null;
    meta: number;
    etiqueta: string;
    unidad: string;
    invertido: boolean;
}) {
    if (!brecha || brecha === 0)
        return (
            <div className="flex items-center justify-between py-1.5 text-xs">
                <span className="text-muted-foreground">{etiqueta}</span>
                <span className="flex items-center gap-1 font-semibold text-[#15803d] dark:text-green-400">
                    <CheckCircle2 className="size-3" />
                    Meta cumplida
                </span>
            </div>
        );

    const pctBar = meta > 0 ? Math.min(100, (brecha / meta) * 100) : 0;
    const color = brecha > meta * 0.3 ? '#dc2626' : brecha > meta * 0.1 ? '#b45309' : '#ea580c';
    const brechaFmt = ikey === 'rmd' ? `−${brecha} pts` : `−${brecha}${unidad === '%' ? ' pp' : ` ${unidad}`}`;

    return (
        <div className="space-y-0.5">
            <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold text-foreground">{etiqueta}</span>
                <span className="shrink-0 text-xs font-bold tabular-nums" style={{ color }}>
                    {brechaFmt}
                </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pctBar}%`, background: color }} />
            </div>
        </div>
    );
}

// ─── Multi-select placas ──────────────────────────────────────────────────────

function PlacaMultiSelect({
    todas,
    seleccionadas,
    onChange,
}: {
    todas: string[];
    seleccionadas: string[];
    onChange: (v: string[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const [buscar, setBuscar] = useState('');
    const filtradas = todas.filter((p) => buscar === '' || p.includes(buscar));
    const toggle = (p: string) => onChange(seleccionadas.includes(p) ? seleccionadas.filter((x) => x !== p) : [...seleccionadas, p]);
    const toggleAll = () => onChange(seleccionadas.length === todas.length ? [] : [...todas]);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex h-9 w-full items-center justify-between gap-1 rounded-md border border-input bg-background px-3 text-left text-sm transition-colors hover:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring"
            >
                <span className="truncate text-muted-foreground">
                    {seleccionadas.length === 0 ? 'Todas las placas' : seleccionadas.length === 1 ? seleccionadas[0] : `${seleccionadas.length} placas`}
                </span>
                <ChevronDown className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {seleccionadas.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                    {seleccionadas.map((p) => (
                        <span
                            key={p}
                            className="inline-flex items-center gap-0.5 rounded-full border border-sidebar-border/70 bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold"
                        >
                            {p}
                            <button type="button" onClick={() => toggle(p)} className="ml-0.5 text-muted-foreground hover:text-foreground">
                                <X className="size-2.5" />
                            </button>
                        </span>
                    ))}
                    <button type="button" onClick={() => onChange([])} className="ml-1 text-[10px] text-muted-foreground underline hover:text-foreground">
                        Limpiar
                    </button>
                </div>
            )}
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute left-0 top-full z-50 mt-1 flex max-h-72 w-64 flex-col rounded-lg border border-sidebar-border/70 bg-popover shadow-lg dark:border-sidebar-border">
                        <div className="border-b border-sidebar-border/70 p-2 dark:border-sidebar-border">
                            <input
                                autoFocus
                                type="text"
                                placeholder="Buscar..."
                                value={buscar}
                                onChange={(e) => setBuscar(e.target.value.toUpperCase())}
                                className="h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-xs uppercase focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 border-b border-sidebar-border/70 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted/60 dark:border-sidebar-border">
                            <input
                                type="checkbox"
                                checked={seleccionadas.length === todas.length && todas.length > 0}
                                onChange={toggleAll}
                                className="size-3 accent-[#D4102A]"
                            />
                            Todas ({todas.length})
                        </label>
                        <div className="flex-1 overflow-y-auto">
                            {filtradas.map((p) => (
                                <label key={p} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 transition-colors hover:bg-muted/60">
                                    <input
                                        type="checkbox"
                                        checked={seleccionadas.includes(p)}
                                        onChange={() => toggle(p)}
                                        className="size-3 shrink-0 accent-[#D4102A]"
                                    />
                                    <span className="font-mono text-[11px] font-semibold text-foreground">{p}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function IndicadoresResumenIndex({
    kpis,
    promedios,
    cumplimiento,
    brechas,
    etiquetas,
    unidades,
    metas,
    por_cargo,
    tendencia,
    todasPlacas,
    cargos,
    filters,
}: Props) {
    const [fechaDesde, setFechaDesde] = useState(filters.fecha_desde ?? '');
    const [fechaHasta, setFechaHasta] = useState(filters.fecha_hasta ?? '');
    const [cargo, setCargo] = useState(filters.cargo ?? '');
    const [placasSel, setPlacasSel] = useState<string[]>(filters.placas ?? []);

    const apply = (ov: Partial<typeof filters> = {}) =>
        router.get(
            route('reparto.indicadores-resumen.index'),
            {
                fecha_desde: ov.fecha_desde ?? fechaDesde,
                fecha_hasta: ov.fecha_hasta ?? fechaHasta,
                cargo: ov.cargo ?? cargo,
                placas: ov.placas ?? placasSel,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );

    const clearFilters = () => {
        setFechaDesde('');
        setFechaHasta('');
        setCargo('');
        setPlacasSel([]);
        router.get(route('reparto.indicadores-resumen.index'), {}, { preserveState: false });
    };
    const hasFilters = fechaDesde || fechaHasta || cargo || placasSel.length > 0;

    const conBrecha = ORDEN_INDICADORES.filter((k) => (brechas[k] ?? 0) > 0).sort((a, b) => (brechas[b] ?? 0) - (brechas[a] ?? 0));

    const lineData = {
        labels: tendencia.map((p) => p.fecha),
        datasets: [
            {
                label: 'Adherencia al Tiempo',
                data: tendencia.map((p) => p.adh),
                borderColor: '#15803d',
                backgroundColor: 'rgba(21,128,61,.08)',
                tension: 0.4,
                fill: true,
                pointRadius: 2,
                borderWidth: 2,
            },
            {
                label: 'Entrega en Rango',
                data: tendencia.map((p) => p.entrega),
                borderColor: '#0891b2',
                backgroundColor: 'rgba(8,145,178,.08)',
                tension: 0.4,
                fill: true,
                pointRadius: 2,
                borderWidth: 2,
            },
            {
                label: 'Checklist Pre',
                data: tendencia.map((p) => p.cl_pre),
                borderColor: '#b45309',
                backgroundColor: 'transparent',
                tension: 0.4,
                fill: false,
                pointRadius: 2,
                borderWidth: 1.5,
                borderDash: [4, 3],
            },
        ],
    };
    const lineOpts: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, color: '#6b7280' } },
            tooltip: { callbacks: { label: (ctx: TooltipItem<'line'>) => ` ${ctx.dataset.label}: ${ctx.parsed.y}%` } },
        },
        scales: {
            y: {
                min: 0,
                max: 100,
                ticks: { color: '#9ca3af', font: { size: 10 }, callback: (v) => `${v}%` },
                grid: { color: 'rgba(128,128,128,.15)' },
            },
            x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 10 } } },
        },
    };

    const tabs = [
        { label: 'Resumen Ejecutivo', href: route('reparto.indicadores-resumen.index'), active: true, icon: BarChart3 },
        { label: 'Velocidad', href: route('reparto.indicadores.index'), active: false, icon: Map },
        { label: 'Adherencia Checklist', href: route('reparto.indicadores-adherencia.index'), active: false, icon: ClipboardCheck },
        { label: 'Adh. al Tiempo', href: route('reparto.indicadores-tiempo.index'), active: false, icon: Clock },
        { label: 'Entrega en Rango', href: route('reparto.indicadores-entrega-rango.index'), active: false, icon: Activity },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Resumen Ejecutivo — Reparto" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall
                    title="Resumen Ejecutivo de Indicadores"
                    description={`Período ${kpis.periodo_desde} – ${kpis.periodo_hasta} · ${kpis.total_registros.toLocaleString()} registros.`}
                />

                <div className="flex flex-wrap gap-2">
                    {tabs.map(({ label, href, active, icon: Icon }) =>
                        active ? (
                            <span
                                key={label}
                                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                                style={{ backgroundColor: ACCENT }}
                            >
                                <Icon className="size-3.5" />
                                {label}
                            </span>
                        ) : (
                            <Link
                                key={label}
                                href={href}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-sidebar-border/70 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground dark:border-sidebar-border"
                            >
                                <Icon className="size-3.5" />
                                {label}
                            </Link>
                        ),
                    )}
                </div>

                {/* ── Filtros ── */}
                <Panel className="p-4">
                    <SectionHeader icon={Calendar} title="Filtros" subtitle="Segmenta por fecha, cargo y placa" />
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="grid gap-1.5">
                            <Label className="text-xs">Fecha desde</Label>
                            <Input
                                type="date"
                                value={fechaDesde}
                                onChange={(e) => {
                                    setFechaDesde(e.target.value);
                                    apply({ fecha_desde: e.target.value });
                                }}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label className="text-xs">Fecha hasta</Label>
                            <Input
                                type="date"
                                value={fechaHasta}
                                onChange={(e) => {
                                    setFechaHasta(e.target.value);
                                    apply({ fecha_hasta: e.target.value });
                                }}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label className="text-xs">Cargo</Label>
                            <Select
                                value={cargo || 'todos'}
                                onValueChange={(v) => {
                                    const val = v === 'todos' ? '' : v;
                                    setCargo(val);
                                    apply({ cargo: val });
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos los cargos</SelectItem>
                                    {cargos.map((c) => (
                                        <SelectItem key={c} value={c}>
                                            {c}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1.5">
                            <Label className="text-xs">Placa(s)</Label>
                            <PlacaMultiSelect
                                todas={todasPlacas}
                                seleccionadas={placasSel}
                                onChange={(v) => {
                                    setPlacasSel(v);
                                    apply({ placas: v });
                                }}
                            />
                        </div>
                    </div>
                    {hasFilters && (
                        <div className="mt-3 flex justify-end">
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                                <X className="size-3.5" />
                                Limpiar filtros
                            </Button>
                        </div>
                    )}
                </Panel>

                {/* ── KPIs ejecutivos ── */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Kpi
                        label="Cumplimiento general"
                        value={kpis.cumpl_general !== null ? `${kpis.cumpl_general}%` : '—'}
                        sub={`${estadoLabel(kpis.cumpl_general)} · ${kpis.total_indicadores} indicadores`}
                        color={semaforo(kpis.cumpl_general)}
                        icon={Target}
                    />
                    <Kpi
                        label="Metas cumplidas"
                        value={`${kpis.metas_cumplidas} / ${kpis.total_indicadores}`}
                        sub="Indicadores con cumplimiento ≥ 95%"
                        color={kpis.metas_cumplidas >= kpis.total_indicadores * 0.7 ? '#15803d' : '#b45309'}
                        icon={CheckCircle2}
                    />
                    <Kpi
                        label="Entrega en rango"
                        value={kpis.entrega_rango !== null ? `${kpis.entrega_rango}%` : '—'}
                        sub="Promedio del período"
                        color={semaforo(cumplimiento['entrega'])}
                        icon={Activity}
                    />
                    <Kpi
                        label="Adherencia al tiempo"
                        value={kpis.adh_tiempo !== null ? `${kpis.adh_tiempo}%` : '—'}
                        sub="Promedio del período"
                        color={semaforo(cumplimiento['adh_tiempo'])}
                        icon={Clock}
                    />
                </div>

                {/* ── Cumplimiento + Brechas ── */}
                <div className="grid gap-4 xl:grid-cols-2">
                    <Panel className="p-5">
                        <SectionHeader icon={BarChart3} title="Cumplimiento por indicador" subtitle="Verde ≥ 90% · Ámbar ≥ 70% · Rojo < 70%" />
                        <div className="mt-5 space-y-4">
                            {ORDEN_INDICADORES.map((k) => (
                                <IndicadorBar
                                    key={k}
                                    ikey={k}
                                    cumpl={cumplimiento[k] ?? null}
                                    promedio={promedios[k] ?? null}
                                    meta={metas[k]}
                                    etiqueta={etiquetas[k]}
                                    unidad={unidades[k]}
                                    invertido={INVERTIDOS.has(k)}
                                />
                            ))}
                        </div>
                    </Panel>

                    <Panel className="p-5">
                        <SectionHeader icon={AlertTriangle} title="Brechas — meta vs realidad" subtitle="Mayor barra = atacar primero" />
                        <div className="mt-5">
                            {conBrecha.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 py-10">
                                    <CheckCircle2 className="size-9 text-[#15803d]/40" />
                                    <p className="text-sm font-semibold text-[#15803d] dark:text-green-400">¡Todas las metas cumplidas!</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {conBrecha.map((k) => (
                                        <BrechaBar
                                            key={k}
                                            ikey={k}
                                            brecha={brechas[k] ?? null}
                                            promedio={promedios[k] ?? null}
                                            meta={metas[k]}
                                            etiqueta={etiquetas[k]}
                                            unidad={unidades[k]}
                                            invertido={INVERTIDOS.has(k)}
                                        />
                                    ))}
                                    {ORDEN_INDICADORES.filter((k) => (brechas[k] ?? 0) === 0 && cumplimiento[k] !== null).map((k) => (
                                        <div key={k} className="flex items-center justify-between py-1 text-xs">
                                            <span className="text-muted-foreground">{etiquetas[k]}</span>
                                            <span className="flex items-center gap-1 font-semibold text-[#15803d] dark:text-green-400">
                                                <CheckCircle2 className="size-3" />
                                                Cumplida
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {conBrecha.length > 0 && (
                                <div className="mt-5 rounded-lg border border-sidebar-border/70 bg-muted/40 px-4 py-3 dark:border-sidebar-border">
                                    <p className="mb-2 text-[11px] font-semibold text-muted-foreground">Prioridad de acción:</p>
                                    <div className="space-y-1.5">
                                        {conBrecha.slice(0, 3).map((k, i) => (
                                            <div key={k} className="flex items-center gap-2 text-xs">
                                                <span
                                                    className={`flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${i === 0 ? 'bg-red-500' : i === 1 ? 'bg-amber-500' : 'bg-yellow-400'}`}
                                                >
                                                    {i + 1}
                                                </span>
                                                <span className="flex-1 truncate text-muted-foreground">{etiquetas[k]}</span>
                                                <span className="font-bold tabular-nums text-foreground">
                                                    {INVERTIDOS.has(k)
                                                        ? `+${brechas[k]} ${unidades[k]}`
                                                        : `−${brechas[k]}${unidades[k] === '%' ? ' pp' : ` ${unidades[k]}`}`}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Panel>
                </div>

                {/* ── Incumplimiento por cargo ── */}
                <Panel>
                    <div className="border-b border-sidebar-border/70 p-5 dark:border-sidebar-border">
                        <SectionHeader
                            icon={Users}
                            title="¿En quién se concentra el incumplimiento?"
                            subtitle="Suma de días problemáticos por cargo: checklist en 0%, entrega bajo 80%, adherencia bajo 80%, alertas"
                        />
                    </div>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cargo</TableHead>
                                    <TableHead className="text-center">Score</TableHead>
                                    <TableHead className="text-center">CL Pre 0%</TableHead>
                                    <TableHead className="text-center">Entrega &lt;80%</TableHead>
                                    <TableHead className="text-center">Adh &lt;80%</TableHead>
                                    <TableHead className="text-center">Alertas</TableHead>
                                    <TableHead className="text-right">Prom. Adh.</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {por_cargo.map((c) => (
                                    <TableRow key={c.cargo}>
                                        <TableCell className="max-w-[180px] truncate font-medium">{c.cargo}</TableCell>
                                        <TableCell className="text-center">
                                            <Chip
                                                cls={
                                                    c.score_incump > 20
                                                        ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                                                        : c.score_incump > 10
                                                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                                                          : 'bg-muted text-muted-foreground'
                                                }
                                            >
                                                {c.score_incump}
                                            </Chip>
                                        </TableCell>
                                        <TableCell className="text-center font-semibold tabular-nums">{c.cl_pre_cero}</TableCell>
                                        <TableCell className="text-center font-semibold tabular-nums">{c.entrega_bajo}</TableCell>
                                        <TableCell className="text-center font-semibold tabular-nums">{c.adh_bajo}</TableCell>
                                        <TableCell className="text-center font-semibold tabular-nums">{c.alertas_sum}</TableCell>
                                        <TableCell
                                            className="text-right font-bold tabular-nums"
                                            style={{ color: c.prom_adh !== null ? semaforo((c.prom_adh / metas['adh_tiempo']) * 100) : '#94a3b8' }}
                                        >
                                            {c.prom_adh !== null ? `${c.prom_adh}%` : '—'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Panel>

                {/* ── Tendencia ── */}
                <Panel className="p-5">
                    <SectionHeader icon={TrendingUp} title="Tendencia de indicadores clave" subtitle="Evolución diaria del período seleccionado" />
                    <div className="mt-5">
                        {tendencia.length > 1 ? (
                            <div style={{ height: 240 }}>
                                <Line data={lineData} options={lineOpts} />
                            </div>
                        ) : (
                            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">Sin datos de tendencia</div>
                        )}
                    </div>
                </Panel>

                <div className="space-y-1 border-t border-sidebar-border/70 pt-3 text-[11px] text-muted-foreground dark:border-sidebar-border">
                    <p>
                        <strong className="text-foreground/70">Fuente</strong> · Tabla eventos_tripulacion — todos los campos de indicadores de
                        desempeño
                    </p>
                    <p>
                        <strong className="text-foreground/70">Metas</strong> · Adh. Tiempo 95% · Entrega Rango 95% · Modulación 95% · CL Pre/Post 100%
                        · Rechazos ≤2% · RMD 5/5 · Alertas/Excesos = 0
                    </p>
                    <p>
                        <strong className="text-foreground/70">Alcance</strong> · {kpis.total_registros.toLocaleString()} registros · período{' '}
                        {kpis.periodo_desde}–{kpis.periodo_hasta}
                    </p>
                </div>
            </div>
        </AppLayout>
    );
}
