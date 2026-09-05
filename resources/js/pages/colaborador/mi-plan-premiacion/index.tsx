import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    Award,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    ShieldCheck,
    Star,
    Trophy,
    User,
    Users,
    Truck,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Portal', href: '/portal' },
    { title: 'Mi Plan Premiación', href: '/portal/mi-plan-premiacion' },
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
    emoji: string;
    titulo: string;
    meta_desc: string;
}

interface HistorialAci {
    mes: string;
    total: number;
    pct: number;
    cumple: boolean;
}

interface Props {
    colaborador: ColaboradorInfo;
    metricas: Record<string, Metrica>;
    historial_aci: HistorialAci[];
    mes: number;
    anio: number;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES_NOMBRES = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const PILAR_CONFIG = {
    Seguridad: { bgLight: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800/50', text: 'text-emerald-700 dark:text-emerald-400', bar: 'bg-emerald-500', emoji: '🛡️', max: 35 },
    Gente:     { bgLight: 'bg-amber-50 dark:bg-amber-900/20',   border: 'border-amber-200 dark:border-amber-800/50',   text: 'text-amber-700 dark:text-amber-400',   bar: 'bg-amber-400',   emoji: '👥', max: 15 },
    Reparto:   { bgLight: 'bg-rose-50 dark:bg-rose-900/20',     border: 'border-rose-200 dark:border-rose-800/50',     text: 'text-rose-700 dark:text-rose-400',     bar: 'bg-rose-500',    emoji: '🚚', max: 35 },
    Flota:     { bgLight: 'bg-blue-50 dark:bg-blue-900/20',     border: 'border-blue-200 dark:border-blue-800/50',     text: 'text-blue-700 dark:text-blue-400',     bar: 'bg-blue-500',    emoji: '🔧', max: 15 },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chipCls(valor: number | null): string {
    if (valor === null) return 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500';
    if (valor >= 95)   return 'bg-green-700 text-white';
    if (valor >= 50)   return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
}

function barColor(valor: number | null): string {
    if (valor === null) return 'bg-gray-200';
    if (valor >= 95)    return 'bg-green-600';
    if (valor >= 50)    return 'bg-amber-400';
    return 'bg-red-400';
}

function estadoLabel(valor: number | null): string {
    if (valor === null) return 'Sin dato';
    if (valor >= 100)  return '✓ Meta cumplida';
    if (valor >= 50)   return '↑ En progreso';
    return '✗ Por mejorar';
}

// ─── Componentes base ─────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}>
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
        <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ease-out ${color}`} style={{ width: `${w}%` }} />
        </div>
    );
}

function FilaMetrica({ metrica }: { metrica: Metrica }) {
    const cumple = metrica.valor !== null && metrica.valor >= 95;
    return (
        <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0 dark:border-gray-800">
            <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-base ${cumple ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                {metrica.emoji}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-snug">
                            {metrica.titulo}
                            <span className="ml-1 text-[10px] font-normal text-gray-400">({metrica.peso}%)</span>
                        </p>
                        <p className="text-[10px] text-gray-400">{metrica.meta_desc}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${chipCls(metrica.valor)}`}>
                        {estadoLabel(metrica.valor)}
                    </span>
                </div>
                <div className="mt-1.5">
                    <Barra pct={metrica.valor ?? 0} color={barColor(metrica.valor)} />
                </div>
                <p className="mt-1 text-[10px] text-gray-400">
                    Resultado: <strong className="text-gray-600 dark:text-gray-300">{metrica.label}</strong>
                </p>
            </div>
            {cumple && <span className="shrink-0 text-base">⭐</span>}
        </div>
    );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function MiPlanPremiacion({ colaborador, metricas, historial_aci, mes, anio }: Props) {

    const metricasList = Object.values(metricas);
    const cumplidas    = metricasList.filter(m => m.valor !== null && m.valor >= 95);
    const porMejorar   = metricasList.filter(m => m.valor !== null && m.valor < 95);
    const sinDato      = metricasList.filter(m => m.valor === null);
    const estrellas    = cumplidas.length;
    const totalPesos   = metricasList.length;

    // Resultados por pilar
    const pilares = ['Seguridad', 'Gente', 'Reparto', 'Flota'] as const;
    const resultadoPilares = pilares.map(pilar => {
        const items  = metricasList.filter(m => m.pilar === pilar);
        const puntos = items.reduce((acc, m) => acc + (m.valor !== null ? (Math.min(m.valor, 100) / 100) * m.peso : 0), 0);
        return { pilar, puntos: Math.min(puntos, PILAR_CONFIG[pilar].max), max: PILAR_CONFIG[pilar].max };
    });
    const calificacionTotal = resultadoPilares.reduce((acc, p) => acc + p.puntos, 0);

    // Selector de mes
    const [calOpen, setCalOpen]               = useState(false);
    const [anioCalendario, setAnioCalendario] = useState(anio);
    const [cargando, setCargando]             = useState(false);
    const calRef = useRef<HTMLDivElement>(null);

    const mesActual = { mes: new Date().getMonth() + 1, anio: new Date().getFullYear() };

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
        router.get(route('portal.mi-plan-premiacion'), { mes: newMes, anio: newAnio }, {
            preserveState: true,
            onFinish: () => setCargando(false),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Mi Plan Premiación" />
            <div className="flex flex-col gap-4 px-4 pb-10 sm:px-6">

                {/* Título */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
                        Mi Plan Premiación
                    </h1>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                        Tus indicadores de desempeño — {MESES_NOMBRES[mes - 1]} {anio}
                    </p>
                </div>

                {/* ══ CARD HERO ══ */}
                <Card>
                    <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">

                        {/* Avatar + nombre + estrellas */}
                        <div className="flex items-center gap-4">
                            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-green-700">
                                {colaborador.imagen ? (
                                    <img src={`/storage/${colaborador.imagen}`} alt={colaborador.nombre_completo}
                                        className="size-full object-cover"
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                                ) : (
                                    <User className="size-8 text-white" />
                                )}
                            </div>
                            <div>
                                <p className="text-base font-bold leading-tight text-gray-900 dark:text-gray-100">
                                    {colaborador.nombre_completo}
                                </p>
                                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
                                    {colaborador.cargo}{colaborador.area ? ` · ${colaborador.area}` : ''}
                                </p>
                                {/* Estrellas */}
                                <div className="mt-2 flex items-center gap-0.5 flex-wrap">
                                    {Array.from({ length: totalPesos }).map((_, i) => (
                                        <span key={i}
                                            className={`text-sm transition-all duration-300 ${i < estrellas ? 'opacity-100' : 'opacity-20 grayscale'}`}
                                            style={{ transitionDelay: `${i * 40}ms` }}>
                                            ⭐
                                        </span>
                                    ))}
                                    <span className="ml-2 text-xs font-bold text-gray-500">{estrellas}/{totalPesos}</span>
                                </div>
                            </div>
                        </div>

                        {/* Calificación total */}
                        <div className="flex flex-col items-center gap-1 px-4">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Calificación Total</p>
                            <p className={`text-4xl font-black tabular-nums ${
                                calificacionTotal >= 70 ? 'text-emerald-600 dark:text-emerald-400'
                                : calificacionTotal >= 50 ? 'text-amber-600 dark:text-amber-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}>
                                {calificacionTotal.toFixed(1)}%
                            </p>
                            <p className="text-[10px] text-gray-400">
                                {calificacionTotal >= 70 ? '🏆 ¡Meta alcanzada!' : calificacionTotal > 0 ? '📈 En progreso' : '—'}
                            </p>
                        </div>

                        {/* Selector de mes */}
                        <div className="relative" ref={calRef}>
                            <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-gray-500">
                                <CalendarDays className="size-3 text-green-700" /> Período de consulta
                            </label>
                            <button
                                type="button"
                                onClick={() => setCalOpen(v => !v)}
                                disabled={cargando}
                                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                            >
                                <CalendarDays className="size-4 text-green-700 shrink-0" />
                                {MESES_NOMBRES[mes - 1]} {anio}
                                <span className="text-gray-400 text-xs">{cargando ? '⏳' : calOpen ? '▲' : '▼'}</span>
                            </button>

                            {calOpen && (
                                <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
                                    {/* Navegación año */}
                                    <div className="flex items-center justify-between bg-green-50 px-3 py-2.5 dark:bg-green-900/20">
                                        <button type="button" onClick={() => setAnioCalendario(a => a - 1)}
                                            className="flex size-7 items-center justify-center rounded-lg hover:bg-white transition dark:hover:bg-gray-800">
                                            <ChevronLeft className="size-4 text-green-700" />
                                        </button>
                                        <span className="text-sm font-bold text-green-800 dark:text-green-300">{anioCalendario}</span>
                                        <button type="button" onClick={() => setAnioCalendario(a => a + 1)}
                                            className="flex size-7 items-center justify-center rounded-lg hover:bg-white transition dark:hover:bg-gray-800">
                                            <ChevronRight className="size-4 text-green-700" />
                                        </button>
                                    </div>
                                    {/* Grid meses */}
                                    <div className="grid grid-cols-4 gap-1.5 p-3">
                                        {MESES_NOMBRES.map((nombre, idx) => {
                                            const seleccionado = idx + 1 === mes && anioCalendario === anio;
                                            const esActual     = idx + 1 === mesActual.mes && anioCalendario === mesActual.anio;
                                            return (
                                                <button key={idx} type="button"
                                                    onClick={() => cambiarMes(idx + 1, anioCalendario)}
                                                    title={nombre}
                                                    className={`rounded-xl py-2 text-xs font-semibold transition-all ${
                                                        seleccionado ? 'bg-green-700 text-white shadow'
                                                        : esActual   ? 'border border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                                                        : 'bg-gray-50 text-gray-600 hover:bg-green-50 hover:text-green-700 dark:bg-gray-800 dark:text-gray-400'
                                                    }`}
                                                >
                                                    {MESES_CORTOS[idx]}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex gap-2 border-t border-gray-100 px-3 py-2 dark:border-gray-800">
                                        <button type="button"
                                            onClick={() => cambiarMes(mesActual.mes, mesActual.anio)}
                                            className="flex-1 rounded-lg bg-amber-50 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 transition dark:bg-amber-900/20 dark:text-amber-300">
                                            Mes actual
                                        </button>
                                        <button type="button" onClick={() => setCalOpen(false)}
                                            className="flex-1 rounded-lg bg-gray-100 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-200 transition dark:bg-gray-800 dark:text-gray-300">
                                            Cerrar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Barra de progreso total */}
                    <div className="border-t border-gray-100 px-5 py-3 dark:border-gray-800">
                        <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                            <span>Progreso hacia la meta (70%)</span>
                            <span className="font-bold text-gray-600 dark:text-gray-300">{calificacionTotal.toFixed(1)} / 100%</span>
                        </div>
                        <div className="relative h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-visible">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${calificacionTotal >= 70 ? 'bg-emerald-500' : calificacionTotal >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                                style={{ width: `${Math.min(calificacionTotal, 100)}%` }}
                            />
                            {/* Marcador 70% */}
                            <div className="absolute top-0 bottom-0 w-0.5 bg-emerald-400" style={{ left: '70%' }}>
                                <span className="absolute -top-4 left-1 text-[9px] font-bold text-emerald-600 whitespace-nowrap">70%</span>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* ══ TARJETAS POR PILAR ══ */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {resultadoPilares.map(({ pilar, puntos, max }) => {
                        const cfg = PILAR_CONFIG[pilar];
                        return (
                            <div key={pilar} className={`rounded-2xl border p-3 ${cfg.bgLight} ${cfg.border}`}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-base">{cfg.emoji}</span>
                                    <span className={`text-[10px] font-bold uppercase tracking-wide ${cfg.text}`}>{pilar}</span>
                                </div>
                                <p className={`text-2xl font-black tabular-nums ${cfg.text}`}>
                                    {puntos.toFixed(1)}<span className="text-sm font-medium">/{max}%</span>
                                </p>
                                <div className="mt-2 h-1.5 w-full rounded-full bg-white/60 dark:bg-black/20 overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`}
                                        style={{ width: `${Math.min((puntos / max) * 100, 100)}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ══ MÉTRICAS ══ */}
                <div className="grid gap-4 md:grid-cols-2">

                    {/* Metas cumplidas */}
                    <Card className="overflow-hidden">
                        <div className="flex items-center justify-between border-b border-gray-100 bg-green-50 px-4 py-3 dark:border-gray-800 dark:bg-green-900/10">
                            <div className="flex items-center gap-2">
                                <div className="flex size-7 items-center justify-center rounded-full bg-green-700">
                                    <Star className="size-3.5 text-white" />
                                </div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Lo que estoy haciendo bien</p>
                            </div>
                            <span className="inline-flex items-center rounded-full bg-green-700 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                                {cumplidas.length}/{totalPesos}
                            </span>
                        </div>
                        <div className="divide-y divide-gray-50 px-4 dark:divide-gray-800">
                            {cumplidas.length > 0 ? cumplidas.map((m, i) => (
                                <FilaMetrica key={i} metrica={m} />
                            )) : (
                                <p className="py-6 text-center text-sm text-gray-400">Sin metas cumplidas aún este mes.</p>
                            )}
                        </div>
                    </Card>

                    {/* Por mejorar + sin dato */}
                    <div className="flex flex-col gap-4">
                        {porMejorar.length > 0 && (
                            <Card className="overflow-hidden">
                                <div className="flex items-center justify-between border-b border-gray-100 bg-red-50 px-4 py-3 dark:border-gray-800 dark:bg-red-900/10">
                                    <div className="flex items-center gap-2">
                                        <div className="flex size-7 items-center justify-center rounded-full bg-red-500">
                                            <Award className="size-3.5 text-white" />
                                        </div>
                                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Lo que puedo mejorar</p>
                                    </div>
                                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                        {porMejorar.length}
                                    </span>
                                </div>
                                <div className="divide-y divide-gray-50 px-4 dark:divide-gray-800">
                                    {porMejorar.map((m, i) => <FilaMetrica key={i} metrica={m} />)}
                                </div>
                            </Card>
                        )}

                        {sinDato.length > 0 && (
                            <Card className="overflow-hidden">
                                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/50">
                                    <div className="flex items-center gap-2">
                                        <div className="flex size-7 items-center justify-center rounded-full bg-gray-400">
                                            <Star className="size-3.5 text-white" />
                                        </div>
                                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Datos pendientes</p>
                                    </div>
                                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                        {sinDato.length}
                                    </span>
                                </div>
                                <div className="divide-y divide-gray-50 px-4 dark:divide-gray-800">
                                    {sinDato.map((m, i) => <FilaMetrica key={i} metrica={m} />)}
                                </div>
                            </Card>
                        )}
                    </div>
                </div>

                {/* ══ HISTORIAL ACI ══ */}
                {historial_aci.length > 0 && (
                    <Card className="p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="flex size-7 items-center justify-center rounded-full bg-green-700">
                                <ShieldCheck className="size-3.5 text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Mi historial ACI — últimos 6 meses</p>
                                <p className="text-[10px] text-gray-400">Meta: 32 ACI = 100%</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                            {historial_aci.map((h, i) => (
                                <div key={i} className={`rounded-xl border p-2.5 text-center ${
                                    h.cumple
                                        ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
                                        : h.total > 0
                                            ? 'border-amber-100 bg-amber-50/50 dark:border-amber-900/30'
                                            : 'border-gray-100 bg-gray-50 dark:border-gray-800 opacity-60'
                                }`}>
                                    <p className="text-[10px] text-gray-400 leading-none">{h.mes}</p>
                                    <p className={`mt-1 text-lg font-black tabular-nums ${h.cumple ? 'text-green-700 dark:text-green-400' : 'text-gray-500'}`}>
                                        {h.total}
                                    </p>
                                    <p className="text-[9px] text-gray-400">{h.pct}%</p>
                                    {h.cumple && <span className="text-xs">⭐</span>}
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {/* ══ RECONOCIMIENTOS ══ */}
                <Card className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="flex size-7 items-center justify-center rounded-full bg-green-700">
                            <Trophy className="size-3.5 text-white" />
                        </div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Mis reconocimientos del período</p>
                    </div>

                    {/* Grid de estrellas */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                        {Array.from({ length: totalPesos }).map((_, i) => (
                            <div key={i} className={`flex size-9 items-center justify-center rounded-xl border-2 transition-all duration-500 ${
                                i < estrellas
                                    ? 'border-amber-300 bg-amber-50 shadow dark:border-amber-600 dark:bg-amber-900/20'
                                    : 'border-gray-200 bg-gray-50 opacity-40 dark:border-gray-700 dark:bg-gray-800'
                            }`} style={{ transitionDelay: `${i * 40}ms` }}>
                                <span className="text-sm">{i < estrellas ? '⭐' : '☆'}</span>
                            </div>
                        ))}
                    </div>

                    {/* Insignias */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {[
                            { icon: '🌟', title: `${cumplidas.length} meta${cumplidas.length !== 1 ? 's' : ''} cumplida${cumplidas.length !== 1 ? 's' : ''}`, desc: 'Indicadores que alcanzaron el 100%', active: cumplidas.length > 0 },
                            { icon: '🏆', title: 'Calificación ≥ 70%', desc: 'Meta general del plan premiación', active: calificacionTotal >= 70 },
                            { icon: '💎', title: `${totalPesos} estrellas`, desc: '¡Perfecto! Todas las metas cumplidas', active: estrellas === totalPesos },
                        ].map((b, i) => (
                            <div key={i} className={`rounded-xl border p-3 transition-all ${
                                b.active
                                    ? 'border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10'
                                    : 'border-gray-100 bg-gray-50 opacity-50 dark:border-gray-800 dark:bg-gray-800/40'
                            }`}>
                                <span className="text-2xl">{b.icon}</span>
                                <p className="mt-1.5 text-xs font-bold text-gray-800 dark:text-gray-200">{b.title}</p>
                                <p className="text-[10px] text-gray-400">{b.desc}</p>
                            </div>
                        ))}
                    </div>

                    {calificacionTotal >= 70 && (
                        <div className="mt-4 rounded-xl bg-green-700 py-3 text-center text-white">
                            <p className="text-sm font-bold">🎉 ¡Felicitaciones! Alcanzaste la meta del Plan Premiación</p>
                        </div>
                    )}
                </Card>

            </div>
        </AppLayout>
    );
}
