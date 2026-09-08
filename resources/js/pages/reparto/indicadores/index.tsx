import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    ArcElement,
    BarController,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Filler,
    LinearScale,
    LineController,
    LineElement,
    PolarAreaController,
    PieController,
    PointElement,
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
    Check,
    ChevronDown,
    ClipboardCheck,
    Clock,
    Map,
    MapPin,
    Truck,
    User,
    X,
    Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bar, Line, Pie, PolarArea } from 'react-chartjs-2';
import { Link } from '@inertiajs/react';

ChartJS.register(
    CategoryScale, LinearScale, BarElement, BarController,
    PointElement, LineElement, LineController, Filler,
    RadialLinearScale, PolarAreaController,
    PieController, ArcElement,
    Tooltip, Legend,
);

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reparto', href: '/modules/reparto/modulacion' },
    { title: 'Indicadores de Velocidad', href: '/modules/reparto/indicadores' },
];

interface Punto {
    id: number; fecha: string; hora: string; placa: string;
    alerta: string; velocidad: number; coordenada: string;
    eventos: number; regional: string; cd: string; lat: number; lon: number;
}

interface Colaborador {
    cedula: string;
    nombre: string;
}

interface AdherenciaDist {
    '≥ 90% (Óptimo)': number;
    '70–89% (Aceptable)': number;
    '< 70% (Crítico)': number;
    'Sin dato': number;
}

interface TopTripulante {
    nombre: string | null;
    cedula: string;
    placa: string;
    fecha: string;
    pre: number;
    post: number | null;
}

interface Adherencia {
    distPre: AdherenciaDist;
    distPost: AdherenciaDist;
    topBajaPre: TopTripulante[];
    promPre: number | null;
    promPost: number | null;
    total: number;
}

interface Props {
    puntos: Punto[];
    porFecha: { labels: string[]; series: { placa: string; conductor: string | null; valores: number[] }[] };
    porPlaca: { placa: string; total: number }[];
    porMes: { mes: string; total: number; placas: string[] }[];
    centro: { lat: number; lon: number };
    placas: string[];
    placasSeleccionadas: string[];
    colaboradores: Colaborador[];
    colaboradoresSeleccionados: Colaborador[];
    placasDelColaborador: string[];
    filters: { fecha_desde: string; fecha_hasta: string; placas: string[]; cedulas: string[] };
    totales: { puntos: number; eventos: number };
    mesLabel: string;
}

// ─── Mapa (lazy para evitar SSR) ─────────────────────────────────────────────
function MapaVelocidad({ puntos, centro }: { puntos: Punto[]; centro: { lat: number; lon: number } }) {
    const [MC, setMC] = useState<any>(null);

    useEffect(() => {
        const id = 'leaflet-css';
        if (!document.getElementById(id)) {
            const link = document.createElement('link');
            link.id = id; link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }
        Promise.all([import('leaflet'), import('react-leaflet')]).then(([L, RL]) => {
            delete (L.Icon.Default.prototype as any)._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            });
            setMC({ MapContainer: RL.MapContainer, TileLayer: RL.TileLayer, CircleMarker: RL.CircleMarker, Tooltip: RL.Tooltip });
        });
    }, []);

    if (!MC) {
        return (
            <div className="w-full h-[420px] rounded-xl bg-muted flex items-center justify-center">
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Map className="h-5 w-5 animate-pulse text-red-500" />
                    Cargando mapa...
                </div>
            </div>
        );
    }

    const { MapContainer, TileLayer, CircleMarker, Tooltip } = MC;
    return (
        <MapContainer center={[centro.lat, centro.lon]} zoom={12}
            style={{ height: '420px', width: '100%', borderRadius: '0.75rem' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
            {puntos.map((p) => (
                <CircleMarker key={p.id} center={[p.lat, p.lon]}
                    radius={p.velocidad > 50 ? 9 : p.velocidad > 30 ? 7 : 5}
                    pathOptions={{
                        color:       p.velocidad > 50 ? '#dc2626' : p.velocidad > 30 ? '#f97316' : '#2563eb',
                        fillColor:   p.velocidad > 50 ? '#fca5a5' : p.velocidad > 30 ? '#fdba74' : '#93c5fd',
                        fillOpacity: 0.85, weight: 1.5,
                    }}>
                    <Tooltip>
                        <div className="min-w-[160px] space-y-1 text-xs">
                            <div className="mb-1 border-b pb-1 text-sm font-bold">{p.placa}</div>
                            <div className="flex items-center gap-1.5">
                                <Calendar className="size-3 shrink-0 text-muted-foreground" />
                                {p.fecha}
                                <Clock className="ml-1 size-3 shrink-0 text-muted-foreground" />
                                {p.hora}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <AlertTriangle className="size-3 shrink-0 text-muted-foreground" />
                                {p.alerta}
                            </div>
                            <div className="flex items-center gap-1.5 font-semibold">
                                <Zap className="size-3 shrink-0 text-muted-foreground" />
                                {p.velocidad} km/h
                            </div>
                            {p.regional !== '—' && (
                                <div className="flex items-center gap-1.5">
                                    <MapPin className="size-3 shrink-0 text-muted-foreground" />
                                    {p.regional} — {p.cd}
                                </div>
                            )}
                        </div>
                    </Tooltip>
                </CircleMarker>
            ))}
        </MapContainer>
    );
}

// ─── Hook: posición del dropdown via portal (escapa cualquier stacking context) ─
function usePortalDropdown() {
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [rect, setRect] = useState<DOMRect | null>(null);

    const updateRect = () => {
        if (triggerRef.current) {
            setRect(triggerRef.current.getBoundingClientRect());
        }
    };

    return { triggerRef, rect, updateRect };
}

// ─── Multiselect de placas (dropdown con checkboxes) ─────────────────────────
function PlacasMultiselect({
    opciones,
    seleccionadas,
    disabled,
    onChange,
}: {
    opciones: string[];
    seleccionadas: string[];
    disabled?: boolean;
    onChange: (nuevas: string[]) => void;
}) {
    const [open, setOpen]     = useState(false);
    const [buscar, setBuscar] = useState('');
    const { triggerRef, rect, updateRect } = usePortalDropdown();

    // Cierra al click fuera
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            // El portal está fuera del DOM del trigger, comparamos por data-attr
            const portal = document.getElementById('placas-dropdown-portal');
            if (triggerRef.current && !triggerRef.current.contains(target) && !portal?.contains(target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Recalcula posición al hacer scroll o resize
    useEffect(() => {
        if (!open) return;
        window.addEventListener('scroll', updateRect, true);
        window.addEventListener('resize', updateRect);
        return () => {
            window.removeEventListener('scroll', updateRect, true);
            window.removeEventListener('resize', updateRect);
        };
    }, [open]);

    const filtradas = opciones.filter((p) =>
        p.toLowerCase().includes(buscar.toLowerCase()),
    );

    const toggle = (p: string) => {
        const next = seleccionadas.includes(p)
            ? seleccionadas.filter((x) => x !== p)
            : [...seleccionadas, p];
        onChange(next);
    };

    const label =
        disabled                     ? 'Filtrado por colaborador'
        : seleccionadas.length === 0 ? 'Todas las placas'
        : seleccionadas.length === 1 ? seleccionadas[0]
        : `${seleccionadas.length} placas`;

    const dropdown = open && !disabled && rect ? createPortal(
        <div
            id="placas-dropdown-portal"
            style={{
                position: 'fixed',
                top:   rect.bottom + 4,
                left:  rect.left,
                width: rect.width,
                minWidth: 240,
                zIndex: 99999,
            }}
            className="rounded-md border bg-card shadow-md"
        >
            <div className="p-2 border-b">
                <input
                    autoFocus
                    placeholder="Buscar placa…"
                    value={buscar}
                    onChange={(e) => setBuscar(e.target.value)}
                    className="w-full rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono uppercase bg-background"
                />
            </div>
            <ul className="max-h-60 overflow-y-auto py-1">
                {filtradas.length === 0 && (
                    <li className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</li>
                )}
                {filtradas.map((p) => {
                    const marcada = seleccionadas.includes(p);
                    return (
                        <li key={p}>
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()} // evita blur antes de click
                                onClick={() => toggle(p)}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent font-mono uppercase"
                            >
                                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${marcada ? 'bg-primary border-primary' : 'border-input'}`}>
                                    {marcada && <Check className="h-3 w-3 text-white" />}
                                </span>
                                {p}
                            </button>
                        </li>
                    );
                })}
            </ul>
            <div className="border-t p-2 flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                    {seleccionadas.length > 0 ? `${seleccionadas.length} seleccionada(s)` : 'Ninguna'}
                </span>
                {seleccionadas.length > 0 && (
                    <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onChange([])}
                        className="text-xs text-red-500 hover:underline"
                    >
                        Limpiar
                    </button>
                )}
            </div>
        </div>,
        document.body,
    ) : null;

    return (
        <div className="relative w-full">
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                onClick={() => { if (!disabled) { updateRect(); setOpen((v) => !v); } }}
                className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-ring ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <span className="truncate text-left">{label}</span>
                <ChevronDown className={`h-4 w-4 opacity-50 shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {dropdown}
        </div>
    );
}

// ─── Multiselect de colaboradores con búsqueda ───────────────────────────────
function ColaboradorMultiselect({
    opciones,
    cedulas,
    disabled,
    onChange,
}: {
    opciones: Colaborador[];
    cedulas: string[];
    disabled?: boolean;
    onChange: (cedulas: string[]) => void;
}) {
    const [open, setOpen]     = useState(false);
    const [buscar, setBuscar] = useState('');
    const { triggerRef, rect, updateRect } = usePortalDropdown();

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            const portal = document.getElementById('colaborador-dropdown-portal');
            if (triggerRef.current && !triggerRef.current.contains(target) && !portal?.contains(target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        window.addEventListener('scroll', updateRect, true);
        window.addEventListener('resize', updateRect);
        return () => {
            window.removeEventListener('scroll', updateRect, true);
            window.removeEventListener('resize', updateRect);
        };
    }, [open]);

    const filtrados = opciones.filter(
        (c) =>
            c.nombre.toLowerCase().includes(buscar.toLowerCase()) ||
            c.cedula.includes(buscar),
    );

    const toggle = (cedula: string) => {
        const next = cedulas.includes(cedula)
            ? cedulas.filter((x) => x !== cedula)
            : [...cedulas, cedula];
        onChange(next);
    };

    const label =
        disabled             ? 'Filtrado por placa(s)'
        : cedulas.length === 0 ? 'Todos los colaboradores'
        : cedulas.length === 1
            ? (opciones.find((c) => c.cedula === cedulas[0])?.nombre ?? cedulas[0])
            : `${cedulas.length} colaboradores`;

    const dropdown = open && !disabled && rect ? createPortal(
        <div
            id="colaborador-dropdown-portal"
            style={{
                position: 'fixed',
                top:      rect.bottom + 4,
                left:     rect.left,
                width:    rect.width,
                minWidth: 300,
                zIndex:   99999,
            }}
            className="rounded-md border bg-card shadow-md"
        >
            <div className="p-2 border-b">
                <input
                    autoFocus
                    placeholder="Buscar nombre o cédula…"
                    value={buscar}
                    onChange={(e) => setBuscar(e.target.value)}
                    className="w-full rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background"
                />
            </div>
            <ul className="max-h-64 overflow-y-auto py-1">
                {filtrados.length === 0 && (
                    <li className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</li>
                )}
                {filtrados.map((c) => {
                    const marcado = cedulas.includes(c.cedula);
                    return (
                        <li key={c.cedula}>
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => toggle(c.cedula)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                            >
                                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${marcado ? 'bg-primary border-primary' : 'border-input'}`}>
                                    {marcado && <Check className="h-3 w-3 text-white" />}
                                </span>
                                <span className="flex flex-col text-left">
                                    <span>{c.nombre}</span>
                                    <span className="text-xs text-muted-foreground font-mono">{c.cedula}</span>
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            <div className="border-t p-2 flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                    {cedulas.length > 0 ? `${cedulas.length} seleccionado(s)` : 'Ninguno'}
                </span>
                {cedulas.length > 0 && (
                    <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onChange([])}
                        className="text-xs text-red-500 hover:underline"
                    >
                        Limpiar
                    </button>
                )}
            </div>
        </div>,
        document.body,
    ) : null;

    return (
        <div className="relative w-full">
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                onClick={() => { if (!disabled) { updateRect(); setOpen((v) => !v); } }}
                className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <span className="truncate text-left">{label}</span>
                <ChevronDown className={`h-4 w-4 opacity-50 shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {dropdown}
        </div>
    );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function IndicadoresIndex({
    puntos, porFecha, porPlaca, porMes, centro,
    placas, placasSeleccionadas: initPlacas,
    colaboradores, colaboradoresSeleccionados: initColabs, placasDelColaborador,
    filters, totales, mesLabel,
}: Props) {
    const [fechaDesde, setFechaDesde] = useState(filters.fecha_desde ?? '');
    const [fechaHasta, setFechaHasta] = useState(filters.fecha_hasta ?? '');
    const [placasSel, setPlacasSel]   = useState<string[]>(initPlacas ?? []);
    const [cedulasSel, setCedulasSel] = useState<string[]>(filters.cedulas ?? []);
    const [mapaOpen, setMapaOpen]     = useState(true);

    const skipDateEffect = useRef(false);
    const isFirstRender  = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        if (skipDateEffect.current) { skipDateEffect.current = false; return; }
        router.get(
            route('reparto.indicadores.index'),
            { fecha_desde: fechaDesde, fecha_hasta: fechaHasta, placas: placasSel, cedulas: cedulasSel },
            { preserveState: true, preserveScroll: true, replace: true },
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fechaDesde, fechaHasta]);

    // Cambio de placas → limpia colaboradores
    const handlePlacasChange = (nuevas: string[]) => {
        skipDateEffect.current = true;
        setPlacasSel(nuevas);
        setCedulasSel([]);
        router.get(
            route('reparto.indicadores.index'),
            { fecha_desde: fechaDesde, fecha_hasta: fechaHasta, placas: nuevas, cedulas: [] },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    // Cambio de colaboradores → limpia placas manuales
    const handleColaboradoresChange = (nuevasCedulas: string[]) => {
        skipDateEffect.current = true;
        setCedulasSel(nuevasCedulas);
        setPlacasSel([]);
        router.get(
            route('reparto.indicadores.index'),
            { fecha_desde: fechaDesde, fecha_hasta: fechaHasta, placas: [], cedulas: nuevasCedulas },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const handleClear = () => {
        skipDateEffect.current = true;
        setFechaDesde(''); setFechaHasta(''); setPlacasSel([]); setCedulasSel([]);
        router.get(route('reparto.indicadores.index'), {}, { preserveState: false });
    };

    const hasFilters = fechaDesde || fechaHasta || placasSel.length > 0 || cedulasSel.length > 0;
    const placasBloqueadas     = cedulasSel.length > 0;
    const colaboradoresBloq    = placasSel.length > 0;

    // ── Paleta de colores ─────────────────────────────────────────────────────
    const PALETTE = [
        { line: '#4A90E2', fill0: 'rgba(74,144,226,0.40)',  fill1: 'rgba(74,144,226,0.05)'  },
        { line: '#FF7F00', fill0: 'rgba(255,127,0,0.35)',   fill1: 'rgba(255,127,0,0.05)'   },
        { line: '#16a34a', fill0: 'rgba(22,163,74,0.35)',   fill1: 'rgba(22,163,74,0.05)'   },
        { line: '#9333ea', fill0: 'rgba(147,51,234,0.35)',  fill1: 'rgba(147,51,234,0.05)'  },
        { line: '#dc2626', fill0: 'rgba(220,38,38,0.35)',   fill1: 'rgba(220,38,38,0.05)'   },
        { line: '#0891b2', fill0: 'rgba(8,145,178,0.35)',   fill1: 'rgba(8,145,178,0.05)'   },
        { line: '#d97706', fill0: 'rgba(217,119,6,0.35)',   fill1: 'rgba(217,119,6,0.05)'   },
        { line: '#be185d', fill0: 'rgba(190,24,93,0.35)',   fill1: 'rgba(190,24,93,0.05)'   },
        { line: '#15803d', fill0: 'rgba(21,128,61,0.35)',   fill1: 'rgba(21,128,61,0.05)'   },
        { line: '#1d4ed8', fill0: 'rgba(29,78,216,0.35)',   fill1: 'rgba(29,78,216,0.05)'   },
    ];

    // Label activo para títulos de gráficas
    const labelActivo =
        cedulasSel.length > 0
            ? cedulasSel.length === 1
                ? (initColabs.find((c) => c.cedula === cedulasSel[0])?.nombre ?? cedulasSel[0])
                : `${cedulasSel.length} colaboradores`
            : placasSel.length === 1
              ? placasSel[0]
              : placasSel.length > 1
                ? `${placasSel.length} placas`
                : null;

    // ── Chart: eventos por día ────────────────────────────────────────────────
    const chartPorFecha = {
        labels: porFecha.labels,
        datasets: porFecha.series.map((serie, i) => {
            const color = PALETTE[i % PALETTE.length];
            return {
                label:     serie.placa,
                conductor: serie.conductor ?? null, // metadato para el tooltip
                data:      serie.valores,
                borderColor: color.line,
                backgroundColor: (ctx: any) => {
                    const { chart } = ctx;
                    const { ctx: c, chartArea } = chart;
                    if (!chartArea) return color.fill0;
                    const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    g.addColorStop(0, color.fill0);
                    g.addColorStop(1, color.fill1);
                    return g;
                },
                tension: 0.4,
                fill: porFecha.series.length === 1,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBackgroundColor: '#fff',
                pointBorderColor: color.line,
                pointBorderWidth: 2,
                borderWidth: 2.5,
            };
        }),
    };

    const tituloFecha = labelActivo ? `Eventos por Día — ${labelActivo}` : 'Eventos por Día — Total General';
    const tituloMes   = labelActivo ? `Eventos por Mes — ${labelActivo}` : 'Eventos por Mes — Total General';

    // ── Chart: PolarArea por mes ──────────────────────────────────────────────
    const COLORES_MESES = [
        'rgba(74,144,226,0.80)', 'rgba(80,200,120,0.80)', 'rgba(255,127,0,0.80)',
        'rgba(220,38,38,0.80)',  'rgba(147,51,234,0.80)', 'rgba(8,145,178,0.80)',
        'rgba(217,119,6,0.80)',  'rgba(190,24,93,0.80)',  'rgba(21,128,61,0.80)',
        'rgba(29,78,216,0.80)',  'rgba(180,83,9,0.80)',   'rgba(107,114,128,0.80)',
    ];
    const chartPorMes = {
        labels: porMes.map((e) => e.mes),
        datasets: [{
            label: 'Eventos',
            data:  porMes.map((e) => e.total),
            // Guardamos el array de placas por mes como metadato
            placasPorMes: porMes.map((e) => e.placas),
            backgroundColor: COLORES_MESES,
            borderColor: COLORES_MESES.map((c) => c.replace('0.80', '1')),
            borderWidth: 1.5,
        }],
    };

    // ── Chart: top 10 placas ──────────────────────────────────────────────────
    const chartPorPlaca = {
        labels: porPlaca.map((e) => e.placa),
        datasets: [{
            label: 'Eventos',
            data: porPlaca.map((e) => e.total),
            backgroundColor: (ctx: any) => {
                const { chart } = ctx;
                const { ctx: c, chartArea } = chart;
                if (!chartArea) return 'rgba(220,38,38,0.5)';
                const g = c.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
                g.addColorStop(0, 'rgba(220,38,38,0.15)');
                g.addColorStop(1, 'rgba(220,38,38,0.72)');
                return g;
            },
            borderColor: '#dc2626', borderWidth: 1.5, borderRadius: 6, borderSkipped: false,
        }],
    };

    // ── Opciones Chart.js ─────────────────────────────────────────────────────
    const optionsPorFecha: ChartOptions<'line'> = {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: porFecha.series.length > 1, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, color: '#6b7280' } },
            title: { display: true, text: tituloFecha, font: { size: 16, weight: 'bold' }, color: '#374151', padding: { bottom: 12 } },
            tooltip: {
                backgroundColor: '#1f2937', titleColor: '#fff', bodyColor: '#e5e7eb',
                borderColor: '#4A90E2', borderWidth: 1, padding: 10, cornerRadius: 8,
                callbacks: {
                    label: (ctx: TooltipItem<'line'>) => {
                        const ds = ctx.dataset as any;
                        const lineas: string[] = [`${ds.label}: ${ctx.parsed.y} eventos`];
                        if (ds.conductor) lineas.push(`Conductor: ${ds.conductor}`);
                        return lineas;
                    },
                },
            },
        },
        scales: {
            y: { beginAtZero: true, title: { display: true, text: 'Cantidad de Excesos', color: '#6b7280', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#6b7280', font: { size: 11 } } },
            x: { title: { display: true, text: 'Días del período', color: '#6b7280', font: { size: 11 } }, grid: { display: false }, ticks: { color: '#6b7280', font: { size: 11 } } },
        },
    };

    const optionsPorMes: ChartOptions<'polarArea'> = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { display: true, position: 'right', labels: { boxWidth: 12, font: { size: 11 }, color: '#6b7280', padding: 10 } },
            title: { display: true, text: tituloMes, font: { size: 16, weight: 'bold' }, color: '#374151', padding: { bottom: 8 } },
            tooltip: {
                backgroundColor: '#1f2937', titleColor: '#fff', bodyColor: '#e5e7eb',
                borderColor: '#FF7F00', borderWidth: 1, padding: 10, cornerRadius: 8,
                callbacks: {
                    label: (ctx: TooltipItem<'polarArea'>) => {
                        const ds = ctx.dataset as any;
                        const total = ctx.parsed.r;
                        const placas: string[] = ds.placasPorMes?.[ctx.dataIndex] ?? [];
                        const lineas: string[] = [`${total} eventos`];
                        if (placas.length > 0) {
                            // Mostrar hasta 8 placas, el resto como "+N más"
                            const visibles = placas.slice(0, 8);
                            const resto    = placas.length - visibles.length;
                            visibles.forEach((p) => lineas.push(`${p}`));
                            if (resto > 0) lineas.push(`+ ${resto} más`);
                        }
                        return lineas;
                    },
                },
            },
        },
        scales: { r: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.07)' }, ticks: { color: '#9ca3af', font: { size: 10 }, backdropColor: 'transparent' } } },
    };

    const optionsPorPlaca: ChartOptions<'bar'> = {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1f2937', titleColor: '#fff', bodyColor: '#e5e7eb',
                borderColor: '#dc2626', borderWidth: 1, padding: 10, cornerRadius: 8,
                callbacks: { label: (ctx: TooltipItem<'bar'>) => ` ${ctx.parsed.x} eventos` },
            },
        },
        scales: {
            x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#6b7280', font: { size: 11 } } },
            y: { grid: { display: false }, ticks: { color: '#374151', font: { size: 11, family: 'monospace' } as any } },
        },
    };

    const subtituloFecha = labelActivo
        ? `${labelActivo} · período seleccionado`
        : 'Total de todos los vehículos · período seleccionado';

    const subtituloMes = labelActivo
        ? `${labelActivo} · año en curso`
        : 'Total de todos los vehículos · año en curso';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Indicadores de Velocidad" />

            <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">

                {/* ── Selector de indicador ───────────────────────────────── */}
                <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
                    <Link
                        href={route('reparto.indicadores-resumen.index')}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-sm transition-all"
                    >
                        <BarChart3 className="h-4 w-4" />
                        Resumen Ejecutivo
                    </Link>
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-card text-sm font-semibold text-red-600 shadow-sm border border-sidebar-border/70 dark:border-sidebar-border cursor-default">
                        <Map className="h-4 w-4" />
                        Indicadores de Velocidad
                    </span>
                    <Link
                        href={route('reparto.indicadores-adherencia.index')}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-sm transition-all"
                    >
                        <ClipboardCheck className="h-4 w-4" />
                        Indicadores de Adherencia
                    </Link>
                    <Link
                        href={route('reparto.indicadores-tiempo.index')}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-sm transition-all"
                    >
                        <Clock className="h-4 w-4" />
                        Adherencia al Tiempo
                    </Link>
                    <Link
                        href={route('reparto.indicadores-entrega-rango.index')}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-sm transition-all"
                    >
                        <Activity className="h-4 w-4" />
                        Entrega en Rango
                    </Link>
                </div>

                {/* ── Encabezado ─────────────────────────────────────────── */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-foreground">
                            <Map className="h-7 w-7 text-red-600" />
                            Indicadores de Velocidad
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">Alertas de velocidad crítica en ruta</p>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2 shadow-sm">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                            <div>
                                <p className="text-[11px] text-red-500 font-semibold">Alertas</p>
                                <p className="text-xl font-bold text-red-700">{totales.puntos.toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 shadow-sm">
                            <Zap className="h-5 w-5 text-orange-500" />
                            <div>
                                <p className="text-[11px] text-orange-500 font-semibold">Eventos</p>
                                <p className="text-xl font-bold text-orange-700">{totales.eventos.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Filtros ────────────────────────────────────────────── */}
                <Card className="shadow-sm border bg-card relative z-50">
                    <CardContent className="pt-4 space-y-3">
                        {/* Fila 1: fechas */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="grid gap-1">
                                <Label className="text-xs font-semibold text-muted-foreground">
                                    <Calendar className="h-3 w-3 inline mr-1" />Fecha desde
                                </Label>
                                <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-xs font-semibold text-muted-foreground">
                                    <Calendar className="h-3 w-3 inline mr-1" />Fecha hasta
                                </Label>
                                <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
                            </div>
                        </div>

                        {/* Fila 2: placas + colaborador + limpiar */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                            <div className="grid gap-1">
                                <Label className="text-xs font-semibold text-muted-foreground">
                                    <Truck className="h-3 w-3 inline mr-1" />Placa(s)
                                </Label>
                                <PlacasMultiselect
                                    opciones={placas}
                                    seleccionadas={placasSel}
                                    disabled={placasBloqueadas}
                                    onChange={handlePlacasChange}
                                />
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-xs font-semibold text-muted-foreground">
                                    <User className="h-3 w-3 inline mr-1" />Colaborador(es)
                                </Label>
                                <ColaboradorMultiselect
                                    opciones={colaboradores}
                                    cedulas={cedulasSel}
                                    disabled={colaboradoresBloq}
                                    onChange={handleColaboradoresChange}
                                />
                            </div>
                            {hasFilters && (
                                <div className="flex items-end">
                                    <Button variant="outline" onClick={handleClear} className="w-full">
                                        <X className="h-4 w-4 mr-1" />Limpiar
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Chips de contexto */}
                        {(placasSel.length > 0 || cedulasSel.length > 0) && (
                            <div className="flex flex-wrap gap-1.5 pt-3 border-t">

                                {/* Chips de colaboradores seleccionados */}
                                {cedulasSel.length > 0 && initColabs.map((c) => (
                                    <span key={c.cedula} className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                                        <User className="h-3 w-3" />
                                        {c.nombre}
                                        <button
                                            type="button"
                                            onClick={() => handleColaboradoresChange(cedulasSel.filter((x) => x !== c.cedula))}
                                            className="hover:text-red-600 ml-0.5"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}

                                {/* Chips de placas del colaborador (solo lectura, informativo) */}
                                {cedulasSel.length > 0 && placasDelColaborador.map((p) => (
                                    <span key={p} className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-mono px-2 py-0.5 rounded-full border border-green-200">
                                        {p}
                                    </span>
                                ))}

                                {/* Chips de placas manuales */}
                                {placasSel.map((p) => (
                                    <span key={p} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-mono font-semibold px-2 py-0.5 rounded-full">
                                        {p}
                                        <button
                                            type="button"
                                            onClick={() => handlePlacasChange(placasSel.filter((x) => x !== p))}
                                            className="hover:text-red-600 ml-0.5"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Leyenda y Mapa Desplegable ──────────────────────────── */}
                <div className="rounded-xl border border-sidebar-border/70 dark:border-sidebar-border bg-card shadow-md overflow-hidden transition-all">
                    <button
                        type="button"
                        onClick={() => setMapaOpen((prev) => !prev)}
                        className="w-full flex flex-wrap items-center justify-between gap-4 p-4 text-xs text-foreground hover:bg-muted/60/50 transition-colors text-left focus:outline-none cursor-pointer"
                    >
                        <div className="flex flex-wrap items-center gap-4">
                            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-blue-500" />Hasta 30 km/h</span>
                            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-orange-500" />31–50 km/h</span>
                            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-red-600" />Más de 50 km/h</span>
                        </div>
                        <div className="flex items-center gap-3 ml-auto">
                            <Badge variant="secondary">{puntos.length} puntos en mapa</Badge>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${mapaOpen ? 'rotate-180' : ''}`} />
                        </div>
                    </button>

                    {mapaOpen && (
                        <div className="border-t border-sidebar-border/70 dark:border-sidebar-border">
                            <MapaVelocidad puntos={puntos} centro={centro} />
                        </div>
                    )}
                </div>

                {/* ── Gráficas fila 1: por día + por mes ─────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-card p-6 rounded-xl shadow-md border border-sidebar-border/70 dark:border-sidebar-border">
                        <p className="text-xs text-muted-foreground mb-4 truncate">{subtituloFecha}</p>
                        {porFecha.series.length === 0
                            ? <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">Sin datos para el período seleccionado</div>
                            : (
                                <div className="relative" style={{ height: porFecha.series.length > 1 ? '320px' : '208px' }}>
                                    <Line data={chartPorFecha} options={optionsPorFecha} />
                                </div>
                            )
                        }
                    </div>
                    <div className="bg-card p-6 rounded-xl shadow-md border border-sidebar-border/70 dark:border-sidebar-border">
                        <p className="text-xs text-muted-foreground mb-4">{subtituloMes}</p>
                        {porMes.every((e) => e.total === 0)
                            ? <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">Sin datos del año actual</div>
                            : <div className="relative h-72"><PolarArea data={chartPorMes} options={optionsPorMes} /></div>
                        }
                    </div>
                </div>

                {/* ── Top 10 placas (mes actual) ─────────────────────────── */}
                <div className="bg-card p-6 rounded-xl shadow-md border border-sidebar-border/70 dark:border-sidebar-border">
                    <h2 className="text-lg font-bold mb-1 text-foreground flex items-center gap-2">
                        <Truck className="h-5 w-5 text-red-500" />
                        Top 10 Vehículos con Más Eventos
                    </h2>
                    <p className="text-xs text-muted-foreground mb-4">
                        Mes completo · <span className="font-semibold capitalize">{mesLabel}</span>
                    </p>
                    {porPlaca.length === 0
                        ? <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sin datos para el mes actual</div>
                        : <div className="h-64"><Bar data={chartPorPlaca} options={optionsPorPlaca} /></div>
                    }
                </div>

            </div>
        </AppLayout>
    );
}
