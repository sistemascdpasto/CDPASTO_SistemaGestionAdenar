import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    AlarmClock,
    AlertTriangle,
    CalendarDays,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    ClipboardList,
    Clock,
    Flag,
    Flame,
    Fuel,
    Gem,
    Lightbulb,
    Package,
    Radio,
    RotateCcw,
    Sparkles,
    Star,
    Trophy,
    Truck,
    User,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// ─── Breadcrumbs ─────────────────────────────────────────────────────────────

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Portal', href: '/portal' },
    { title: 'Mis Estrellas del Camión', href: '/portal/mis-indicadores-reparto' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Colaborador {
    nombre: string;
    cedula: string;
    cargo: string;
    placa?: string;
    imagen?: string | null;
}
interface Indicadores {
    promedios: Record<string, number | null>;
    cumplimiento: Record<string, number | null>;
    estrellas: number;
    total_indicadores: number;
    total_jornadas: number;
    metas: Record<string, number>;
}
interface HistPunto {
    fecha: string;
    placa: string;
    adh: number | null;
    entrega: number | null;
    cl_pre: number | null;
}
interface Periodo { desde: string; hasta: string }
interface MesOption { value: string; label: string }
interface Props {
    colaborador: Colaborador;
    indicadores: Indicadores | null;
    historial: HistPunto[];
    periodo: Periodo | null;
    mesSeleccionado: string;
    mesesDisponibles: MesOption[];
}

// ─── Config de indicadores ────────────────────────────────────────────────────

const CONFIG = [
    { key: 'excesos',     titulo: 'No exceder el tiempo en ruta',    Icon: Clock, invertido: true,
      fmtVal: (v: number|null) => v === null ? 'Sin dato' : v === 0 ? '0 excesos' : `${v} excesos/jornada`,
      fmtMeta: (_m: number) => '0 excesos por jornada' },
    { key: 'alertas',     titulo: 'Manejar despacio en las curvas',   Icon: AlertTriangle, invertido: true,
      fmtVal: (v: number|null) => v === null ? 'Sin dato' : v === 0 ? '0 alertas' : `${v} alertas/jornada`,
      fmtMeta: (_m: number) => '0 alertas por jornada' },
    { key: 'cl_pre',      titulo: 'Revisar el camión antes de salir', Icon: ClipboardCheck, invertido: false,
      fmtVal: (v: number|null) => v === null ? 'Sin dato' : `${v}%`,
      fmtMeta: (_m: number) => '100% (todos los días)' },
    { key: 'cl_post',     titulo: 'Revisar el camión al volver',      Icon: Flag, invertido: false,
      fmtVal: (v: number|null) => v === null ? 'Sin dato' : `${v}%`,
      fmtMeta: (_m: number) => '100% (todos los días)' },
    { key: 'combustible', titulo: 'Rendimiento de Combustible',       Icon: Fuel, invertido: false,
      fmtVal: (v: number|null) => v === null ? 'Sin dato' : `${v}%`,
      fmtMeta: (m: number) => `${m}% o más` },
    { key: 'modulacion',  titulo: 'Modulación',                       Icon: Radio, invertido: false,
      fmtVal: (v: number|null) => v === null ? 'Sin dato' : `${v}%`,
      fmtMeta: (m: number) => `${m}% de las veces` },
    { key: 'adh_tiempo',  titulo: 'Cumplir el horario del día',       Icon: AlarmClock, invertido: false,
      fmtVal: (v: number|null) => v === null ? 'Sin dato' : `${v}%`,
      fmtMeta: (m: number) => `${m}% o más` },
    { key: 'entrega',     titulo: 'Entregar a tiempo',                 Icon: Package, invertido: false,
      fmtVal: (v: number|null) => v === null ? 'Sin dato' : `${v}%`,
      fmtMeta: (m: number) => `${m}% o más` },
    { key: 'rechazos',    titulo: 'Rechazos',                          Icon: RotateCcw, invertido: true,
      fmtVal: (v: number|null) => v === null ? 'Sin dato' : `${v}%`,
      fmtMeta: (m: number) => `menos de ${m}%` },
    { key: 'rmd',         titulo: 'Calificación (RMD)',               Icon: Trophy, invertido: false,
      fmtVal: (v: number|null) => v === null ? 'Sin dato' : `${v} de 5`,
      fmtMeta: (m: number) => `${m} de 5` },
] as const;

const MESES_COMPLETOS = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function chipCls(cumpl: number | null): string {
    if (cumpl === null) return 'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground';
    if (cumpl >= 95)    return 'bg-green-700 text-white';
    if (cumpl >= 70)    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
}

function estadoLabel(cumpl: number | null): string {
    if (cumpl === null) return 'Sin dato';
    if (cumpl >= 95)    return 'Cumplida';
    if (cumpl >= 70)    return 'Cerca';
    return 'Por mejorar';
}

function barColor(cumpl: number | null): string {
    if (cumpl === null) return 'bg-muted';
    if (cumpl >= 95)    return 'bg-green-600';
    if (cumpl >= 70)    return 'bg-amber-400';
    return 'bg-red-400';
}

// ─── Componentes base (igual que Mi Compensación Diaria) ─────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border ${className}`}>
            {children}
        </div>
    );
}

function SectionHeader({ icon: Icon, title, subtitle, right }: {
    icon: React.ElementType; title: string; subtitle?: string; right?: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-700">
                    <Icon className="size-4 text-white" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
                </div>
            </div>
            {right}
        </div>
    );
}

function Chip({ children, cls }: { children: React.ReactNode; cls: string }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${cls}`}>
            {children}
        </span>
    );
}

// ─── Barra animada ────────────────────────────────────────────────────────────

function Barra({ pct, color }: { pct: number; color: string }) {
    const [w, setW] = useState(0);
    useEffect(() => {
        const t = setTimeout(() => setW(Math.min(pct, 100)), 150);
        return () => clearTimeout(t);
    }, [pct]);
    return (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ease-out ${color}`} style={{ width: `${w}%` }} />
        </div>
    );
}

// ─── Fila de indicador ────────────────────────────────────────────────────────

function FilaIndicador({ cfg, cumpl, promedio, meta }: {
    cfg: typeof CONFIG[number]; cumpl: number | null; promedio: number | null; meta: number;
}) {
    return (
        <div className="flex items-start gap-3 py-3 border-b border-sidebar-border/70 last:border-0 dark:border-sidebar-border">
            <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${cumpl !== null && cumpl >= 95 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                <cfg.Icon className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-foreground leading-snug">{cfg.titulo}</p>
                    <Chip cls={chipCls(cumpl)}>{estadoLabel(cumpl)}</Chip>
                </div>
                <div className="mt-1.5">
                    <Barra pct={cumpl ?? 0} color={barColor(cumpl)} />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-[10px] text-muted-foreground">
                        Resultado: <strong className="text-muted-foreground">{cfg.fmtVal(promedio)}</strong>
                    </p>
                    <p className="text-[10px] text-muted-foreground hidden sm:block">
                        Meta: {cfg.fmtMeta(meta)}
                    </p>
                </div>
            </div>
            {cumpl !== null && cumpl >= 95 && (
                <Star className="size-4 shrink-0 fill-amber-400 text-amber-400" />
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MisIndicadoresReparto({
    colaborador, indicadores, historial, periodo, mesSeleccionado, mesesDisponibles,
}: Props) {
    const TOTAL = 10;

    const safe = indicadores ?? {
        promedios: Object.fromEntries(CONFIG.map(c => [c.key, null])),
        cumplimiento: Object.fromEntries(CONFIG.map(c => [c.key, null])),
        estrellas: 0,
        total_indicadores: TOTAL,
        total_jornadas: 0,
        metas: Object.fromEntries(CONFIG.map(c => [
            c.key,
            c.key === 'rmd' ? 4 : c.key === 'cl_pre' || c.key === 'cl_post' ? 100 : 95,
        ])),
    } as Indicadores;

    const estrellas = safe.estrellas;

    const okList      = CONFIG.filter(c => (safe.cumplimiento[c.key] ?? 0) >= 95);
    const mejorarList = CONFIG.filter(c => { const v = safe.cumplimiento[c.key]; return v !== null && v < 95; });
    const sinDatoList = CONFIG.filter(c => safe.cumplimiento[c.key] === null || safe.cumplimiento[c.key] === undefined);

    const selSplit  = (mesSeleccionado || '').split('-');
    const propAnio  = Number(selSplit[0]) || new Date().getFullYear();
    const propMesIdx = (Number(selSplit[1]) || 1) - 1;

    const [tab, setTab]                       = useState<'resumen' | 'jornadas' | 'consejos'>('resumen');
    const [calOpen, setCalOpen]               = useState(false);
    const [anioCalendario, setAnioCalendario] = useState(propAnio);
    const [cargando, setCargando]             = useState(false);
    const calRef = useRef<HTMLDivElement>(null);

    const mesActualKey = (() => {
        const n = new Date();
        return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
    })();

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (calRef.current && !calRef.current.contains(e.target as Node)) setCalOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const cambiarMes = (mes: string) => {
        setCalOpen(false);
        setCargando(true);
        const [a] = mes.split('-');
        if (a) setAnioCalendario(Number(a));
        router.get(route('portal.mis-indicadores-reparto'), { mes }, {
            preserveState: true, preserveScroll: true,
            onFinish: () => setCargando(false),
        });
    };

    const TABS = [
        { id: 'resumen'  as const, icon: Star,          label: 'Mi resumen' },
        { id: 'jornadas' as const, icon: ClipboardList, label: 'Jornadas' },
        { id: 'consejos' as const, icon: Lightbulb,     label: 'Consejos' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Mis Estrellas del Camión" />
            <div className="flex flex-col gap-4 px-4 pb-10 sm:px-6">

                {/* Título */}
                <div>
                    <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                        Mis Estrellas del Camión
                    </h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        Tus indicadores de desempeño en reparto.
                    </p>
                </div>

                {/* Sin datos del período */}
                {indicadores === null && (
                    <Card className="flex items-start gap-3 p-4">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                            <span className="text-sm">ℹ️</span>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">Sin reportes para este período</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">Cuando el equipo cargue los datos de reparto, verás aquí tus resultados.</p>
                        </div>
                    </Card>
                )}

                {/* ══ CARD HERO ══ */}
                <Card>
                    <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">

                        {/* Izquierda: avatar + nombre + estrellas */}
                        <div className="flex items-center gap-3">
                            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-green-700">
                                {colaborador.imagen ? (
                                    <img src={`/storage/${colaborador.imagen}`} alt={colaborador.nombre}
                                        className="size-full object-cover"
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                                ) : (
                                    <User className="size-7 text-white" />
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-bold leading-tight text-foreground">{colaborador.nombre}</p>
                                <p className="mt-0.5 text-[10px] font-semibold text-green-700 dark:text-green-400">
                                    {colaborador.cargo}{colaborador.placa ? ` · ${colaborador.placa}` : ''}
                                </p>
                                {/* Estrellas */}
                                <div className="mt-2 flex items-center gap-0.5">
                                    {Array.from({ length: TOTAL }).map((_, i) => (
                                        <Star
                                            key={i}
                                            className={`size-3.5 transition-all duration-300 ${i < estrellas ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
                                            style={{ transitionDelay: `${i * 60}ms` }}
                                        />
                                    ))}
                                    <span className="ml-2 text-xs font-bold text-muted-foreground">{estrellas}/{TOTAL}</span>
                                </div>
                            </div>
                        </div>

                        {/* Centro: selector de mes */}
                        <div className="relative" ref={calRef}>
                            <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                                <CalendarDays className="size-3 text-green-700" /> Período de consulta
                            </label>
                            <button
                                type="button"
                                onClick={() => setCalOpen(v => !v)}
                                disabled={cargando}
                                className="flex items-center gap-2 rounded-lg border border-sidebar-border/70 bg-muted px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-50 dark:border-sidebar-border dark:bg-muted dark:text-foreground"
                            >
                                <CalendarDays className="size-4 text-green-700 shrink-0" />
                                {MESES_COMPLETOS[propMesIdx]} {propAnio}
                                <span className="text-muted-foreground text-xs">{cargando ? '⏳' : calOpen ? '▲' : '▼'}</span>
                            </button>

                            {/* Dropdown calendario — solo meses del año */}
                            {calOpen && (
                                <div className="absolute left-0 z-50 mt-2 w-72 rounded-xl border border-sidebar-border/70 bg-popover shadow-md dark:border-sidebar-border overflow-hidden sm:right-0 sm:left-auto">
                                    {/* Header año */}
                                    <div className="flex items-center justify-between bg-green-50 px-3 py-2.5 dark:bg-green-900/20">
                                        <button type="button" onClick={() => setAnioCalendario(a => a - 1)}
                                            className="flex size-7 items-center justify-center rounded-lg hover:bg-muted transition">
                                            <ChevronLeft className="size-4 text-green-700" />
                                        </button>
                                        <span className="text-sm font-bold text-green-800 dark:text-green-300">{anioCalendario}</span>
                                        <button type="button" onClick={() => setAnioCalendario(a => a + 1)}
                                            className="flex size-7 items-center justify-center rounded-lg hover:bg-muted transition">
                                            <ChevronRight className="size-4 text-green-700" />
                                        </button>
                                    </div>
                                    {/* Grid de meses */}
                                    <div className="grid grid-cols-4 gap-1.5 p-3">
                                        {MESES_COMPLETOS.map((nombre, idx) => {
                                            const key = `${anioCalendario}-${String(idx + 1).padStart(2, '0')}`;
                                            const seleccionado = key === mesSeleccionado;
                                            const esActual     = key === mesActualKey;
                                            const disabled = Array.isArray(mesesDisponibles) && mesesDisponibles.length > 0
                                                && !mesesDisponibles.some(m => m.value === key);
                                            return (
                                                <button key={idx} type="button"
                                                    disabled={disabled}
                                                    onClick={() => cambiarMes(key)}
                                                    title={nombre}
                                                    className={`rounded-xl py-2 text-xs font-semibold transition-all ${
                                                        seleccionado ? 'bg-green-700 text-white shadow'
                                                        : esActual ? 'border border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                                                        : disabled ? 'cursor-not-allowed text-muted-foreground dark:text-muted-foreground'
                                                        : 'bg-muted text-muted-foreground hover:bg-green-50 hover:text-green-700 dark:bg-muted dark:text-muted-foreground'
                                                    }`}
                                                >
                                                    {MESES_CORTOS[idx]}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex gap-2 border-t border-sidebar-border/70 px-3 py-2 dark:border-sidebar-border">
                                        <button type="button" onClick={() => cambiarMes(mesActualKey)}
                                            className="flex-1 rounded-lg bg-amber-50 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 transition dark:bg-amber-900/20 dark:text-amber-300">
                                            Mes actual
                                        </button>
                                        <button type="button" onClick={() => setCalOpen(false)}
                                            className="flex-1 rounded-lg bg-muted py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted/60 transition dark:bg-muted dark:text-muted-foreground">
                                            Cerrar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Derecha: período + camión decorativo */}
                        <div className="flex items-center gap-4">
                            {periodo && (
                                <div className="text-right">
                                    <p className="text-[10px] text-muted-foreground">Período</p>
                                    <p className="text-xs font-semibold text-foreground">{periodo.desde} → {periodo.hasta}</p>
                                </div>
                            )}
                            <Truck className="size-8 text-green-200 dark:text-green-900 hidden sm:block" />
                        </div>
                    </div>
                </Card>

                {/* ══ TABS ══ */}
                <div className="flex gap-2">
                    {TABS.map(({ id, icon: Icon, label }) => (
                        <button key={id} type="button" onClick={() => setTab(id)}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition sm:flex-none sm:px-4 ${
                                tab === id
                                    ? 'border-green-700 bg-green-700 text-white shadow-sm'
                                    : 'border-sidebar-border/70 bg-card text-muted-foreground hover:bg-muted/60 dark:border-sidebar-border dark:text-muted-foreground'
                            }`}
                        >
                            <Icon className="size-3.5" />
                            {label}
                        </button>
                    ))}
                </div>

                {/* ══ TAB: RESUMEN ══ */}
                {tab === 'resumen' && (
                    <>
                        {/* Grid cumplimiento / mejorar */}
                        <div className="grid gap-4 md:grid-cols-2">
                            {/* Lo que hago bien */}
                            <Card className="overflow-hidden">
                                <div className="flex items-center justify-between border-b border-sidebar-border/70 bg-green-50 px-4 py-3 dark:border-sidebar-border dark:bg-green-900/10">
                                    <SectionHeader icon={Star} title="Lo que hago bien" />
                                    <Chip cls="bg-green-700 text-white">{okList.length}/{TOTAL}</Chip>
                                </div>
                                <div className="divide-y divide-border px-4 dark:divide-border">
                                    {okList.length > 0 ? okList.map(c => (
                                        <FilaIndicador key={c.key} cfg={c}
                                            cumpl={safe.cumplimiento[c.key] ?? null}
                                            promedio={safe.promedios[c.key] ?? null}
                                            meta={safe.metas[c.key]} />
                                    )) : (
                                        <p className="py-6 text-center text-sm text-muted-foreground">Sin indicadores cumplidos aún.</p>
                                    )}
                                </div>
                            </Card>

                            {/* Lo que debo mejorar + sin dato */}
                            <div className="flex flex-col gap-4">
                                {mejorarList.length > 0 && (
                                    <Card className="overflow-hidden">
                                        <div className="flex items-center justify-between border-b border-sidebar-border/70 bg-red-50 px-4 py-3 dark:border-sidebar-border dark:bg-red-900/10">
                                            <SectionHeader icon={Star} title="Lo que debo mejorar" />
                                            <Chip cls="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">{mejorarList.length}</Chip>
                                        </div>
                                        <div className="divide-y divide-border px-4 dark:divide-border">
                                            {mejorarList.map(c => (
                                                <FilaIndicador key={c.key} cfg={c}
                                                    cumpl={safe.cumplimiento[c.key] ?? null}
                                                    promedio={safe.promedios[c.key] ?? null}
                                                    meta={safe.metas[c.key]} />
                                            ))}
                                        </div>
                                    </Card>
                                )}

                                {sinDatoList.length > 0 && (
                                    <Card className="overflow-hidden">
                                        <div className="flex items-center justify-between border-b border-sidebar-border/70 bg-muted px-4 py-3 dark:border-sidebar-border dark:bg-muted">
                                            <SectionHeader icon={Star} title="Datos que faltan" />
                                            <Chip cls="bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground">{sinDatoList.length}</Chip>
                                        </div>
                                        <div className="divide-y divide-border px-4 dark:divide-border">
                                            {sinDatoList.map(c => (
                                                <FilaIndicador key={c.key} cfg={c}
                                                    cumpl={null} promedio={null}
                                                    meta={safe.metas[c.key]} />
                                            ))}
                                        </div>
                                    </Card>
                                )}
                            </div>
                        </div>

                        {/* Reconocimientos */}
                        <Card className="p-5">
                            <SectionHeader icon={Star} title="Mis reconocimientos del período"
                                subtitle="Cada meta cumplida es un logro" />

                            {/* Estrellas visuales */}
                            <div className="mt-4 flex flex-wrap gap-1.5">
                                {Array.from({ length: TOTAL }).map((_, i) => (
                                    <div key={i} className={`flex size-10 items-center justify-center rounded-xl border-2 transition-all duration-500 ${
                                        i < estrellas
                                            ? 'border-amber-300 bg-amber-50 shadow dark:border-amber-600 dark:bg-amber-900/20'
                                            : 'border-sidebar-border/70 bg-muted opacity-40 dark:border-sidebar-border dark:bg-muted'
                                    }`} style={{ transitionDelay: `${i * 60}ms` }}>
                                        <Star className={i < estrellas ? 'size-4 fill-amber-400 text-amber-400' : 'size-4 text-muted-foreground/40'} />
                                    </div>
                                ))}
                            </div>

                            {/* Insignias */}
                            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                {[
                                    { Icon: Sparkles, title: `${okList.length} meta${okList.length !== 1 ? 's' : ''} cumplida${okList.length !== 1 ? 's' : ''}`, desc: 'Cumpliste la meta en el período', active: okList.length > 0 },
                                    { Icon: Flame, title: 'Promedio ≥ 70%', desc: 'Jornadas con muy buen desempeño', active: CONFIG.filter(c => (safe.cumplimiento[c.key] ?? 0) >= 70).length > 0 },
                                    { Icon: Gem, title: `${TOTAL} estrellas`, desc: '¡Lo hiciste perfecto! Todas las metas', active: estrellas === TOTAL },
                                ].map((b, i) => (
                                    <div key={i} className={`rounded-xl border p-3 transition-all ${
                                        b.active
                                            ? 'border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10'
                                            : 'border-sidebar-border/70 bg-muted opacity-50 dark:border-sidebar-border dark:bg-muted/40'
                                    }`}>
                                        <b.Icon className={`size-6 ${b.active ? 'text-amber-500' : 'text-muted-foreground'}`} />
                                        <p className="mt-1.5 text-xs font-bold text-foreground">{b.title}</p>
                                        <p className="text-[10px] text-muted-foreground">{b.desc}</p>
                                    </div>
                                ))}
                            </div>

                            {estrellas === TOTAL && (
                                <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-green-700 py-3 text-center text-sm font-bold text-white">
                                    <Trophy className="size-4" />
                                    ¡Camión estrella del período! ¡Felicitaciones!
                                </div>
                            )}
                        </Card>
                    </>
                )}

                {/* ══ TAB: JORNADAS ══ */}
                {tab === 'jornadas' && (
                    <Card>
                        <div className="border-b border-sidebar-border/70 px-4 py-3 dark:border-sidebar-border">
                            <SectionHeader icon={ClipboardList} title="Mis últimas jornadas"
                                right={<Chip cls="bg-green-700 text-white">{historial.length} jornadas</Chip>} />
                        </div>

                        {historial.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-sidebar-border/70 bg-muted dark:border-sidebar-border dark:bg-muted">
                                            {['Fecha','Placa','Adh. Tiempo','Entrega','CL Pre'].map(h => (
                                                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-green-700 dark:text-green-400">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {historial.map((h, i) => (
                                            <tr key={i} className="hover:bg-muted/60/30 transition-colors">
                                                <td className="px-4 py-2 font-medium text-foreground">{h.fecha}</td>
                                                <td className="px-4 py-2 font-mono font-semibold text-green-700 dark:text-green-400">{h.placa || '—'}</td>
                                                <td className="px-4 py-2">
                                                    {h.adh !== null
                                                        ? <Chip cls={chipCls(h.adh)}>{h.adh}%</Chip>
                                                        : <span className="text-muted-foreground">—</span>}
                                                </td>
                                                <td className="px-4 py-2">
                                                    {h.entrega !== null
                                                        ? <Chip cls={chipCls(h.entrega)}>{h.entrega}%</Chip>
                                                        : <span className="text-muted-foreground">—</span>}
                                                </td>
                                                <td className="px-4 py-2">
                                                    {h.cl_pre !== null
                                                        ? <Chip cls={chipCls(h.cl_pre >= 100 ? 100 : h.cl_pre)}>{h.cl_pre}%</Chip>
                                                        : <span className="text-muted-foreground">—</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 p-10 text-center">
                                <ClipboardList className="size-6 text-muted-foreground" />
                                <p className="text-sm font-medium text-muted-foreground">Sin jornadas registradas</p>
                                <p className="text-xs text-muted-foreground">Cuando el equipo cargue las jornadas, aparecerán aquí.</p>
                            </div>
                        )}

                        {/* Leyenda de colores */}
                        <div className="flex flex-wrap gap-3 border-t border-sidebar-border/70 px-4 py-3 dark:border-sidebar-border">
                            {[
                                { cls: 'bg-green-700 text-white', label: 'Excelente — cumpliste la meta' },
                                { cls: 'bg-amber-100 text-amber-700', label: 'Cerca — sigue mejorando' },
                                { cls: 'bg-red-100 text-red-700',   label: 'Necesita atención' },
                            ].map(({ cls, label }) => (
                                <div key={label} className="flex items-center gap-1.5">
                                    <span className={`inline-block size-2.5 rounded-full ${cls.split(' ')[0]}`} />
                                    <span className="text-[10px] text-muted-foreground">{label}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {/* ══ TAB: CONSEJOS ══ */}
                {tab === 'consejos' && (
                    <Card>
                        <div className="border-b border-sidebar-border/70 px-4 py-3 dark:border-sidebar-border">
                            <SectionHeader icon={Lightbulb} title="Consejos para obtener todas las estrellas"
                                subtitle="Una estrella por cada meta cumplida" />
                        </div>
                        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                            {CONFIG.map((c) => {
                                const v = safe.cumplimiento[c.key];
                                const ok = v !== null && v >= 95;
                                return (
                                    <div key={c.key} className={`rounded-xl border p-3 ${
                                        ok
                                            ? 'border-green-100 bg-green-50 dark:border-green-800/40 dark:bg-green-900/10'
                                            : 'border-amber-100 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10'
                                    }`}>
                                        <div className="flex items-start gap-2.5">
                                            <c.Icon className={`size-5 shrink-0 ${ok ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`} />
                                            <div>
                                                <p className="text-xs font-bold text-foreground">{c.titulo}</p>
                                                <p className={`mt-0.5 flex items-center gap-1 text-[10px] font-semibold ${ok ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                                                    {ok ? (
                                                        <>
                                                            <CheckCircle2 className="size-3" /> ¡Ya lo estás haciendo bien!
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Lightbulb className="size-3" /> Meta: {c.fmtMeta(safe.metas[c.key])}
                                                        </>
                                                    )}
                                                </p>
                                                {!ok && (
                                                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                                                        Anótalo en tu checklist diario para mejorar.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                )}

                {/* Banner motivacional */}
                <Card className="p-4">
                    <div className="flex items-center gap-2.5">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-700">
                            <Star className="size-4 text-white" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-foreground">
                                {estrellas === TOTAL ? '¡Camión estrella!' : estrellas >= 7 ? '¡Muy buen trabajo!' : '¡Tú puedes mejorar!'}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                                {estrellas === TOTAL
                                    ? 'Obtuviste todas las estrellas del período. ¡Eres el mejor!'
                                    : estrellas >= 7
                                      ? `Te faltan ${TOTAL - estrellas} estrellas para llegar arriba. ¡Sigue así!`
                                      : `Con ${TOTAL - estrellas} cambios puedes subir rápido. ¡Tú puedes!`}
                            </p>
                        </div>
                    </div>
                </Card>
            </div>
        </AppLayout>
    );
}
