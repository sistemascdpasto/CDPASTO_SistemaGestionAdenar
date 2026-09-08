import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    Award,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Gem,
    ShieldCheck,
    Sparkles,
    Star,
    TrendingUp,
    Trophy,
    User,
    Users,
    Truck,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'Plan Premiación', href: '/modules/gente/plan-premiacion' },
    { title: 'Detalle Colaborador', href: '#' },
];

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ColaboradorInfo {
    id: number;
    nombre_completo: string;
    cedula: string;
    cargo: string;
    area: string;
    imagen: string | null;
    aci_realizadas: number;
}

interface Metrica {
    valor: number | null;
    label: string;
    pilar: 'Seguridad' | 'Gente' | 'Reparto' | 'Flota';
    peso: number;
    promedio?: number | null;
    titulo: string;
    meta_desc: string;
}

interface HistorialAci {
    mes: string;
    total: number;
    pct: number;
    cumple: boolean;
}

interface MesDisponible {
    value: number;
    label: string;
}

interface Props {
    colaborador: ColaboradorInfo;
    metricas: Record<string, Metrica>;
    historial_aci: HistorialAci[];
    mes: number;
    anio: number;
    meses_disponibles: MesDisponible[];
    umbral_checklist?: number;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES_NOMBRES = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const PILAR_CONFIG = {
    Seguridad: { color: 'emerald', max: 35, icon: ShieldCheck },
    Gente:     { color: 'amber',   max: 15, icon: Users },
    Reparto:   { color: 'rose',    max: 35, icon: Truck },
    Flota:     { color: 'blue',    max: 15, icon: Truck },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chipCls(valor: number | null, invertido = false): string {
    if (valor === null) return 'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground';
    const cumple = invertido ? valor >= 95 : valor >= 95;
    if (cumple)       return 'bg-green-700 text-white';
    if (valor >= 50)  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
}

function barColor(valor: number | null): string {
    if (valor === null) return 'bg-muted';
    if (valor >= 95) return 'bg-green-600';
    if (valor >= 50) return 'bg-amber-400';
    return 'bg-red-400';
}

function estadoLabel(valor: number | null): string {
    if (valor === null) return 'Sin dato';
    if (valor >= 100) return 'Meta cumplida';
    if (valor >= 50)  return 'En progreso';
    return 'Por mejorar';
}

// ─── Componentes ──────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border ${className}`}>
            {children}
        </div>
    );
}

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

function FilaMetrica({ metrica }: { metrica: Metrica }) {
    const esChecklist = metrica.titulo === 'Checklist Pre' || metrica.titulo === 'Checklist Post';
    const aprobado    = metrica.valor !== null && metrica.valor >= 100;
    const cumple      = esChecklist ? aprobado : (metrica.valor !== null && metrica.valor >= 95);
    const PilarIcon   = PILAR_CONFIG[metrica.pilar].icon;
    return (
        <div className="flex items-start gap-3 py-3 border-b border-sidebar-border/70 last:border-0 dark:border-sidebar-border">
            <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${cumple ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                <PilarIcon className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                        <p className="text-xs font-semibold text-foreground leading-snug">
                            {metrica.titulo}
                            <span className="ml-1 text-[10px] font-normal text-muted-foreground">({metrica.peso}%)</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">{metrica.meta_desc}</p>
                    </div>
                    {esChecklist ? (
                        /* Checklist: badge Aprobado / No Aprobado */
                        metrica.valor !== null ? (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${aprobado ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                {aprobado ? 'Aprobado' : 'No Aprobado'}
                            </span>
                        ) : (
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground">Sin dato</span>
                        )
                    ) : (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${chipCls(metrica.valor)}`}>
                            {estadoLabel(metrica.valor)}
                        </span>
                    )}
                </div>
                <div className="mt-1.5">
                    <Barra pct={metrica.valor ?? 0} color={barColor(metrica.valor)} />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-[10px] text-muted-foreground">
                        {esChecklist && metrica.promedio !== null && metrica.promedio !== undefined ? (
                            <>Promedio real: <strong className="text-foreground">{metrica.promedio.toFixed(1)}%</strong></>
                        ) : (
                            <>Resultado: <strong className="text-muted-foreground">{metrica.label}</strong></>
                        )}
                    </p>
                </div>
            </div>
            {cumple && <Star className="size-4 shrink-0 fill-amber-400 text-amber-400" />}
        </div>
    );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function PlanPremiacionShow({ colaborador, metricas, historial_aci, mes, anio, umbral_checklist = 90 }: Props) {

    const metricasList = Object.values(metricas);
    const cumplidas    = metricasList.filter(m => m.valor !== null && m.valor >= 95);
    const porMejorar   = metricasList.filter(m => m.valor !== null && m.valor < 95);
    const sinDato      = metricasList.filter(m => m.valor === null);
    const totalPesos   = metricasList.length;
    const estrellas    = cumplidas.length;

    // Calcular resultado por pilar
    const pilares = ['Seguridad', 'Gente', 'Reparto', 'Flota'] as const;
    const resultadoPilares = pilares.map(pilar => {
        const items = metricasList.filter(m => m.pilar === pilar);
        const puntos = items.reduce((acc, m) => acc + (m.valor !== null ? (Math.min(m.valor, 100) / 100) * m.peso : 0), 0);
        const maxPilar = PILAR_CONFIG[pilar].max;
        return { pilar, puntos: Math.min(puntos, maxPilar), max: maxPilar };
    });
    const calificacionTotal = resultadoPilares.reduce((acc, p) => acc + p.puntos, 0);

    // Selector de mes
    const [calOpen, setCalOpen] = useState(false);
    const [anioCalendario, setAnioCalendario] = useState(anio);
    const [cargando, setCargando] = useState(false);
    const calRef = useRef<HTMLDivElement>(null);

    const mesActualKey = (() => {
        const n = new Date();
        return { mes: n.getMonth() + 1, anio: n.getFullYear() };
    })();

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (calRef.current && !calRef.current.contains(e.target as Node)) setCalOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const cambiarMes = (newMes: number, newAnio: number) => {
        setCalOpen(false);
        setCargando(true);
        router.get(`/modules/gente/plan-premiacion/${colaborador.id}`, { mes: newMes, anio: newAnio }, {
            preserveState: true,
            onFinish: () => setCargando(false),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Plan Premiación — ${colaborador.nombre_completo}`} />
            <div className="flex flex-col gap-4 px-4 pb-10 sm:px-6">

                {/* Título + botón volver */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <button
                            type="button"
                            onClick={() => router.get('/modules/gente/plan-premiacion')}
                            className="mb-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground dark:hover:text-foreground transition"
                        >
                            <ChevronLeft className="size-3.5" />
                            Volver al listado
                        </button>
                        <h1 className="text-2xl font-bold text-foreground">
                            Plan Premiación
                        </h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Detalle de indicadores — {MESES_NOMBRES[mes - 1]} {anio}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Trophy className="size-8 text-amber-400" />
                    </div>
                </div>

                {/* ══ CARD HERO ══ */}
                <Card>
                    <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">

                        {/* Izquierda: avatar + nombre + estrellas */}
                        <div className="flex items-center gap-4">
                            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-600">
                                {colaborador.imagen ? (
                                    <img src={`/storage/${colaborador.imagen}`} alt={colaborador.nombre_completo}
                                        className="size-full object-cover"
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                                ) : (
                                    <User className="size-8 text-white" />
                                )}
                            </div>
                            <div>
                                <p className="text-base font-bold leading-tight text-foreground">
                                    {colaborador.nombre_completo}
                                </p>
                                <p className="mt-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                    {colaborador.cargo} · {colaborador.area}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono">{colaborador.cedula}</p>
                                {/* Estrellas */}
                                <div className="mt-2 flex flex-wrap items-center gap-0.5">
                                    {Array.from({ length: totalPesos }).map((_, i) => (
                                        <Star
                                            key={i}
                                            className={`size-3.5 transition-all duration-300 ${i < estrellas ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/25'}`}
                                            style={{ transitionDelay: `${i * 40}ms` }}
                                        />
                                    ))}
                                    <span className="ml-2 text-xs font-bold text-muted-foreground">{estrellas}/{totalPesos}</span>
                                </div>
                            </div>
                        </div>

                        {/* Centro: calificación total */}
                        <div className="flex flex-col items-center gap-1 px-4">
                            <p className="text-[10px] font-medium text-muted-foreground">Calificación Total</p>
                            <p className={`text-4xl font-black tabular-nums ${
                                calificacionTotal >= 70 ? 'text-emerald-600 dark:text-emerald-400'
                                : calificacionTotal >= 50 ? 'text-amber-600 dark:text-amber-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}>
                                {calificacionTotal.toFixed(1)}%
                            </p>
                            <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                {calificacionTotal >= 70 ? (
                                    <>
                                        <Trophy className="size-3" /> Meta alcanzada
                                    </>
                                ) : calificacionTotal > 0 ? (
                                    <>
                                        <TrendingUp className="size-3" /> En progreso
                                    </>
                                ) : (
                                    '—'
                                )}
                            </p>
                        </div>

                        {/* Derecha: selector de mes */}
                        <div className="relative" ref={calRef}>
                            <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                                <CalendarDays className="size-3 text-amber-600" /> Período de consulta
                            </label>
                            <button
                                type="button"
                                onClick={() => setCalOpen(v => !v)}
                                disabled={cargando}
                                className="flex items-center gap-2 rounded-lg border border-sidebar-border/70 bg-muted px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-50 dark:border-sidebar-border dark:bg-muted dark:text-foreground"
                            >
                                <CalendarDays className="size-4 text-amber-600 shrink-0" />
                                {MESES_NOMBRES[mes - 1]} {anio}
                                <span className="text-muted-foreground text-xs">{cargando ? '⏳' : calOpen ? '▲' : '▼'}</span>
                            </button>

                            {calOpen && (
                                <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-sidebar-border/70 bg-popover shadow-md dark:border-sidebar-border overflow-hidden">
                                    <div className="flex items-center justify-between bg-amber-50 px-3 py-2.5 dark:bg-amber-900/20">
                                        <button type="button" onClick={() => setAnioCalendario(a => a - 1)}
                                            className="flex size-7 items-center justify-center rounded-lg hover:bg-muted transition">
                                            <ChevronLeft className="size-4 text-amber-600" />
                                        </button>
                                        <span className="text-sm font-bold text-amber-800 dark:text-amber-300">{anioCalendario}</span>
                                        <button type="button" onClick={() => setAnioCalendario(a => a + 1)}
                                            className="flex size-7 items-center justify-center rounded-lg hover:bg-muted transition">
                                            <ChevronRight className="size-4 text-amber-600" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-4 gap-1.5 p-3">
                                        {MESES_NOMBRES.map((nombre, idx) => {
                                            const seleccionado = idx + 1 === mes && anioCalendario === anio;
                                            const esActual = idx + 1 === mesActualKey.mes && anioCalendario === mesActualKey.anio;
                                            return (
                                                <button key={idx} type="button"
                                                    onClick={() => cambiarMes(idx + 1, anioCalendario)}
                                                    title={nombre}
                                                    className={`rounded-xl py-2 text-xs font-semibold transition-all ${
                                                        seleccionado ? 'bg-amber-600 text-white shadow'
                                                        : esActual ? 'border border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                                                        : 'bg-muted text-muted-foreground hover:bg-amber-50 hover:text-amber-700 dark:bg-muted dark:text-muted-foreground'
                                                    }`}
                                                >
                                                    {MESES_CORTOS[idx]}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex gap-2 border-t border-sidebar-border/70 px-3 py-2 dark:border-sidebar-border">
                                        <button type="button"
                                            onClick={() => cambiarMes(mesActualKey.mes, mesActualKey.anio)}
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
                    </div>

                    {/* Barra de progreso total */}
                    <div className="border-t border-sidebar-border/70 px-5 py-3 dark:border-sidebar-border">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                            <span>Progreso hacia la meta (70%)</span>
                            <span className="font-bold text-muted-foreground">{calificacionTotal.toFixed(1)} / 100%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${calificacionTotal >= 70 ? 'bg-emerald-500' : calificacionTotal >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                                style={{ width: `${Math.min(calificacionTotal, 100)}%` }}
                            />
                        </div>
                        {/* Marcador 70% */}
                        <div className="relative mt-1">
                            <div className="absolute left-[70%] -translate-x-1/2 text-[9px] text-emerald-600 font-bold">▲ 70%</div>
                        </div>
                    </div>
                </Card>

                {/* ══ RESUMEN POR PILAR ══ */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {resultadoPilares.map(({ pilar, puntos, max }) => {
                        const cfg = PILAR_CONFIG[pilar];
                        const pct = (puntos / max) * 100;
                        const colorMap: Record<string, string> = {
                            emerald: 'bg-emerald-100 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50',
                            amber:   'bg-amber-100 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50',
                            rose:    'bg-rose-100 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/50',
                            blue:    'bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50',
                        };
                        const textMap: Record<string, string> = {
                            emerald: 'text-emerald-700 dark:text-emerald-400',
                            amber:   'text-amber-700 dark:text-amber-400',
                            rose:    'text-rose-700 dark:text-rose-400',
                            blue:    'text-blue-700 dark:text-blue-400',
                        };
                        const barMap: Record<string, string> = {
                            emerald: 'bg-emerald-500',
                            amber:   'bg-amber-400',
                            rose:    'bg-rose-500',
                            blue:    'bg-blue-500',
                        };
                        return (
                            <div key={pilar} className={`rounded-xl border p-3 ${colorMap[cfg.color]}`}>
                                <div className="flex items-center justify-between mb-1">
                                    <cfg.icon className={`size-4 ${textMap[cfg.color]}`} />
                                    <span className={`text-[10px] font-bold ${textMap[cfg.color]}`}>{pilar}</span>
                                </div>
                                <p className={`text-2xl font-black tabular-nums ${textMap[cfg.color]}`}>
                                    {puntos.toFixed(1)}<span className="text-sm font-medium">/{max}%</span>
                                </p>
                                <div className="mt-2 h-1.5 w-full rounded-full bg-foreground/10 overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-700 ${barMap[cfg.color]}`}
                                        style={{ width: `${Math.min(pct, 100)}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ══ MÉTRICAS POR PILAR ══ */}
                <div className="grid gap-4 md:grid-cols-2">
                    {/* Lo que cumple */}
                    <Card className="overflow-hidden">
                        <div className="flex items-center justify-between border-b border-sidebar-border/70 bg-green-50 px-4 py-3 dark:border-sidebar-border dark:bg-green-900/10">
                            <div className="flex items-center gap-2">
                                <div className="flex size-7 items-center justify-center rounded-full bg-green-700">
                                    <Star className="size-3.5 text-white" />
                                </div>
                                <p className="text-sm font-semibold text-foreground">Metas cumplidas</p>
                            </div>
                            <span className="inline-flex items-center rounded-full bg-green-700 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                                {cumplidas.length}/{totalPesos}
                            </span>
                        </div>
                        <div className="divide-y divide-border px-4 dark:divide-border">
                            {cumplidas.length > 0 ? cumplidas.map((m, i) => (
                                <FilaMetrica key={i} metrica={m} />
                            )) : (
                                <p className="py-6 text-center text-sm text-muted-foreground">Sin metas cumplidas aún.</p>
                            )}
                        </div>
                    </Card>

                    {/* Lo que debe mejorar + sin dato */}
                    <div className="flex flex-col gap-4">
                        {porMejorar.length > 0 && (
                            <Card className="overflow-hidden">
                                <div className="flex items-center justify-between border-b border-sidebar-border/70 bg-red-50 px-4 py-3 dark:border-sidebar-border dark:bg-red-900/10">
                                    <div className="flex items-center gap-2">
                                        <div className="flex size-7 items-center justify-center rounded-full bg-red-500">
                                            <Award className="size-3.5 text-white" />
                                        </div>
                                        <p className="text-sm font-semibold text-foreground">Por mejorar</p>
                                    </div>
                                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                        {porMejorar.length}
                                    </span>
                                </div>
                                <div className="divide-y divide-border px-4 dark:divide-border">
                                    {porMejorar.map((m, i) => (
                                        <FilaMetrica key={i} metrica={m} />
                                    ))}
                                </div>
                            </Card>
                        )}

                        {sinDato.length > 0 && (
                            <Card className="overflow-hidden">
                                <div className="flex items-center justify-between border-b border-sidebar-border/70 bg-muted px-4 py-3 dark:border-sidebar-border dark:bg-muted">
                                    <div className="flex items-center gap-2">
                                        <div className="flex size-7 items-center justify-center rounded-full bg-muted-foreground">
                                            <Star className="size-3.5 text-white" />
                                        </div>
                                        <p className="text-sm font-semibold text-foreground">Sin datos</p>
                                    </div>
                                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground dark:bg-muted dark:text-muted-foreground">
                                        {sinDato.length}
                                    </span>
                                </div>
                                <div className="divide-y divide-border px-4 dark:divide-border">
                                    {sinDato.map((m, i) => (
                                        <FilaMetrica key={i} metrica={m} />
                                    ))}
                                </div>
                            </Card>
                        )}
                    </div>
                </div>

                {/* ══ HISTORIAL ACI ══ */}
                {historial_aci.length > 0 && (
                    <Card className="p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="flex size-7 items-center justify-center rounded-full bg-amber-600">
                                <ShieldCheck className="size-3.5 text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">Historial ACI — últimos 6 meses</p>
                                <p className="text-[10px] text-muted-foreground">Meta: 32 ACI = 100%</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                            {historial_aci.map((h, i) => (
                                <div key={i} className={`rounded-xl border p-2.5 text-center transition-all ${
                                    h.cumple
                                        ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
                                        : h.total > 0
                                            ? 'border-amber-100 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/10'
                                            : 'border-sidebar-border/70 bg-muted dark:border-sidebar-border dark:bg-muted/40 opacity-60'
                                }`}>
                                    <p className="text-[10px] text-muted-foreground leading-none">{h.mes}</p>
                                    <p className={`mt-1 text-lg font-black tabular-nums ${h.cumple ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                                        {h.total}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground">{h.pct}%</p>
                                    {h.cumple && <Star className="size-3 fill-amber-400 text-amber-400" />}
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {/* ══ RECONOCIMIENTOS ══ */}
                <Card className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="flex size-7 items-center justify-center rounded-full bg-amber-600">
                            <Trophy className="size-3.5 text-white" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">Reconocimientos del período</p>
                    </div>

                    {/* Grid de estrellas */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                        {Array.from({ length: totalPesos }).map((_, i) => (
                            <div key={i} className={`flex size-9 items-center justify-center rounded-xl border-2 transition-all duration-500 ${
                                i < estrellas
                                    ? 'border-amber-300 bg-amber-50 shadow dark:border-amber-600 dark:bg-amber-900/20'
                                    : 'border-sidebar-border/70 bg-muted opacity-40 dark:border-sidebar-border dark:bg-muted'
                            }`} style={{ transitionDelay: `${i * 40}ms` }}>
                                <Star className={i < estrellas ? 'size-4 fill-amber-400 text-amber-400' : 'size-4 text-muted-foreground/40'} />
                            </div>
                        ))}
                    </div>

                    {/* Insignias */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {[
                            { Icon: Sparkles, title: `${cumplidas.length} meta${cumplidas.length !== 1 ? 's' : ''} cumplida${cumplidas.length !== 1 ? 's' : ''}`, desc: 'Indicadores que alcanzaron el 100%', active: cumplidas.length > 0 },
                            { Icon: Trophy, title: 'Calificación ≥ 70%', desc: 'Meta general del plan premiación', active: calificacionTotal >= 70 },
                            { Icon: Gem, title: `${totalPesos} estrellas`, desc: '¡Perfecto! Todas las metas cumplidas', active: estrellas === totalPesos },
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

                    {calificacionTotal >= 70 && (
                        <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 text-center text-white">
                            <Trophy className="size-4" />
                            <p className="text-sm font-bold">¡Felicitaciones! Alcanzaste la meta del Plan Premiación</p>
                        </div>
                    )}
                </Card>
            </div>
        </AppLayout>
    );
}
