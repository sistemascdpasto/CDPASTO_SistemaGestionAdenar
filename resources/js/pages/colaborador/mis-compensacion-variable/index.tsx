import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    BarChart3,
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    CircleDollarSign,
    Info,
    Star,
    TrendingDown,
    TrendingUp,
    Trophy,
    User,
    XCircle,
} from 'lucide-react';
import React, { useState } from 'react';

// ─── Breadcrumbs ─────────────────────────────────────────────────────────────

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Portal', href: '/portal' },
    { title: 'Mi Compensación Variable', href: '/portal/mi-compensacion-variable' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Colaborador {
    cedula: string;
    nombre_completo: string;
    cargo: string | null;
}

interface RegistroMes {
    id: number;
    anio: number;
    mes: string;
    mes_num: number;
    mes2: string | null;
    regional: string | null;
    cd: string | null;
    ausencia_justificada: number;
    ausencia_injustificada: number;
    tri_fatalidades: number;
    adherencia_gp: string | null;
    market_refusals: string | null;
    porcentaje_rechazos: number;
    habilitadores: number;
    variable: string | null;
    dias_trabajados: number;
    salario_variable: number;
    pago_variable_dt: number;
    total_pago: number;
    es_futuro: boolean;
}

interface Resumen {
    total_pago_variable: number;
    total_salario: number;
    meses_con_datos: number;
    promedio_rechazos: number;
    mejor_mes: { mes: string; valor: number } | null;
    peor_mes: { mes: string; valor: number } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCOP(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(amount || 0);
}

function pctColor(pct: number): string {
    if (pct >= 90) return 'text-green-700 dark:text-green-400';
    if (pct >= 70) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
}

function barColor(pct: number): string {
    if (pct >= 90) return 'bg-green-500';
    if (pct >= 70) return 'bg-amber-400';
    return 'bg-red-500';
}

// ─── Card base ───────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}>
            {children}
        </div>
    );
}

// ─── Section header ──────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
    return (
        <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-700">
                <Icon className="size-4 text-white" />
            </div>
            <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
                {subtitle && <p className="text-xs capitalize text-gray-400">{subtitle}</p>}
            </div>
        </div>
    );
}

// ─── KPI pequeño ─────────────────────────────────────────────────────────────

function Kpi({ label, value, green, red, muted }: {
    label: string; value: React.ReactNode;
    green?: boolean; red?: boolean; muted?: boolean;
}) {
    const color = green
        ? 'text-green-700 dark:text-green-400'
        : red ? 'text-red-600 dark:text-red-400'
        : muted ? 'text-gray-400'
        : 'text-gray-900 dark:text-gray-100';
    return (
        <div>
            <p className="mb-0.5 text-[10px] text-gray-400">{label}</p>
            <p className={`text-base font-bold tabular-nums leading-tight ${color}`}>{value}</p>
        </div>
    );
}

// ─── Chip ────────────────────────────────────────────────────────────────────

function Chip({ ok, label }: { ok: boolean; label: string }) {
    const base = ok
        ? 'bg-green-700 text-white'
        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${base}`}>
            {ok ? <CheckCircle2 className="size-2.5" /> : <XCircle className="size-2.5" />}
            {label}
        </span>
    );
}

// ─── Fila de mes ─────────────────────────────────────────────────────────────

function FilaMes({ registro, maxPago }: { registro: RegistroMes; maxPago: number }) {
    const [open, setOpen] = useState(false);

    if (registro.es_futuro) {
        return (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-gray-200 px-4 py-3 dark:border-gray-800">
                <span className="w-24 text-xs font-semibold text-gray-300 dark:text-gray-600">{registro.mes}</span>
                <span className="text-[10px] text-gray-300 dark:text-gray-600">Sin datos aún</span>
            </div>
        );
    }

    const pctObtenido = registro.salario_variable > 0
        ? Math.min(Math.round((registro.pago_variable_dt / registro.salario_variable) * 100), 100)
        : 0;
    const barWidth = maxPago > 0 ? Math.round((registro.pago_variable_dt / maxPago) * 100) : 0;

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            {/* Fila principal — clickeable para expandir */}
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
                {/* Mes */}
                <span className="w-24 shrink-0 text-xs font-bold text-gray-700 dark:text-gray-300">
                    {registro.mes}
                </span>

                {/* Barra de pago */}
                <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <span className={`text-sm font-extrabold tabular-nums ${pctColor(pctObtenido)}`}>
                            {formatCOP(registro.pago_variable_dt)}
                        </span>
                        <span className={`text-[10px] font-semibold ${pctColor(pctObtenido)}`}>
                            {pctObtenido}%
                        </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${barColor(pctObtenido)}`}
                            style={{ width: `${barWidth}%` }}
                        />
                    </div>
                </div>

                {/* Habilitador */}
                <div className="hidden shrink-0 sm:block">
                    <Chip ok={registro.habilitadores >= 1} label={registro.habilitadores >= 1 ? 'Habilitado' : 'No habilitado'} />
                </div>

                {/* Chevron */}
                <div className="shrink-0 text-gray-400">
                    {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </div>
            </button>

            {/* Detalle expandible */}
            {open && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-800/30">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                        <Kpi label="Salario variable" value={formatCOP(registro.salario_variable)} />
                        <Kpi label="Pago variable DT" value={formatCOP(registro.pago_variable_dt)} green />
                        <Kpi label="Total pago" value={formatCOP(registro.total_pago)} green />
                        <Kpi label="Días trabajados" value={registro.dias_trabajados} />
                        <Kpi
                            label="% Rechazos"
                            value={`${registro.porcentaje_rechazos}%`}
                            green={registro.porcentaje_rechazos < 2.1}
                            red={registro.porcentaje_rechazos >= 2.6}
                        />
                        <Kpi label="Habilitadores" value={registro.habilitadores} green={registro.habilitadores >= 1} red={registro.habilitadores < 1} />
                        <Kpi
                            label="Aus. justificada"
                            value={registro.ausencia_justificada}
                            green={registro.ausencia_justificada === 0}
                            red={registro.ausencia_justificada > 0}
                        />
                        <Kpi
                            label="Aus. injustificada"
                            value={registro.ausencia_injustificada}
                            green={registro.ausencia_injustificada === 0}
                            red={registro.ausencia_injustificada > 0}
                        />
                        <Kpi label="Adherencia GP" value={registro.adherencia_gp ?? '—'} />
                        <Kpi label="Market refusals" value={registro.market_refusals ?? '—'} />
                        <Kpi label="Fatalidades TRI" value={registro.tri_fatalidades} green={registro.tri_fatalidades === 0} red={registro.tri_fatalidades > 0} />
                        <Kpi label="Variable" value={registro.variable ?? '—'} />
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MisCompensacionVariableIndex() {
    const pageProps = usePage<any>().props || {};
    const colaborador: Colaborador | null  = pageProps.colaborador;
    const registros: RegistroMes[]         = pageProps.registros ?? [];
    const resumen: Resumen | null          = pageProps.resumen;
    const anioSeleccionado: number         = pageProps.anio_seleccionado ?? new Date().getFullYear();
    const aniosDisponibles: number[]       = pageProps.anios_disponibles ?? [];
    const error: string | null             = pageProps.error;

    const [anio, setAnio] = useState(anioSeleccionado);
    const [historialOpen, setHistorialOpen] = useState(true);

    const handleAnioChange = (val: number) => {
        setAnio(val);
        router.get(route('portal.mi-compensacion-variable.index'), { anio: val }, { preserveState: true, preserveScroll: true });
    };

    const maxPago = Math.max(...registros.filter((r) => !r.es_futuro).map((r) => r.pago_variable_dt), 1);

    const pctAnual = resumen && resumen.total_salario > 0
        ? Math.min(Math.round((resumen.total_pago_variable / resumen.total_salario) * 100), 100)
        : 0;

    const CIRCUM = 276.46;
    const dash   = (pctAnual / 100) * CIRCUM;

    if (error || !colaborador) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Mi Compensación Variable" />
                <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mi Compensación Variable</h1>
                    <Card className="p-5">
                        <p className="text-sm text-red-600">{error || 'No se pudo cargar la información.'}</p>
                    </Card>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Mi Compensación Variable" />
            <div className="flex flex-col gap-4 px-4 pb-10 sm:px-6">

                {/* ── Título ── */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
                        Mi Compensación Variable
                    </h1>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                        Historial mensual de tu compensación variable por año.
                    </p>
                </div>

                {/* ── CARD HERO ── */}
                <Card>
                    <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">

                        {/* Perfil + selector año */}
                        <div className="flex flex-col gap-3 sm:shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-700">
                                    <User className="size-4 text-white" />
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold leading-tight text-gray-900 dark:text-gray-100">
                                        {colaborador.nombre_completo}
                                    </p>
                                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
                                        CC {colaborador.cedula} · {colaborador.cargo ?? 'Sin cargo'}
                                    </p>
                                </div>
                            </div>

                            {/* Selector de año */}
                            <div className="grid gap-1">
                                <label className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
                                    <CalendarDays className="size-3 text-green-700" /> Año
                                </label>
                                <div className="flex gap-1.5">
                                    {(aniosDisponibles.length > 0 ? aniosDisponibles : [anio]).map((a) => (
                                        <button
                                            key={a}
                                            type="button"
                                            onClick={() => handleAnioChange(a)}
                                            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                                a === anio
                                                    ? 'border-green-600 bg-green-700 text-white'
                                                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                            }`}
                                        >
                                            {a}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Decorativo central */}
                        <div
                            className="mx-4 hidden flex-1 items-center justify-center sm:flex"
                            style={{
                                minHeight: '100px',
                                background: 'radial-gradient(circle at 50% 60%, #bbf7d0 0%, #f0fdf4 55%, transparent 90%)',
                                borderRadius: '0.75rem',
                            }}
                        >
                            <BarChart3 className="size-16 text-green-200 dark:text-green-900" />
                        </div>

                        {/* Círculo % anual */}
                        {resumen ? (
                            <div className="flex items-center gap-3 sm:shrink-0">
                                <div className="relative shrink-0">
                                    <svg width="76" height="76" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="44" fill="none" stroke="#bbf7d0" strokeWidth="9" />
                                        <circle
                                            cx="50" cy="50" r="44" fill="none"
                                            stroke="#15803d" strokeWidth="9"
                                            strokeLinecap="round"
                                            strokeDasharray={`${dash} ${CIRCUM}`}
                                            transform="rotate(-90 50 50)"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-lg font-extrabold leading-none text-green-700 dark:text-green-400">
                                            {pctAnual}%
                                        </span>
                                        <span className="text-[9px] font-medium text-gray-400">del año</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                                        {pctAnual >= 90 ? '¡Excelente año!' : pctAnual >= 70 ? '¡Buen año!' : 'Hay oportunidad'}
                                    </p>
                                    <p className="mt-0.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                                        {resumen.meses_con_datos} {resumen.meses_con_datos === 1 ? 'mes' : 'meses'} con datos
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 sm:shrink-0">Sin datos para {anio}</p>
                        )}
                    </div>
                </Card>

                {/* ── Sin datos ── */}
                {registros.filter((r) => !r.es_futuro).length === 0 && (
                    <Card className="flex flex-col items-center gap-2 p-8 text-center">
                        <Info className="size-5 text-gray-300" />
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Sin información para {anio}
                        </p>
                        <p className="text-xs text-gray-400">
                            Selecciona otro año o espera a que se cargue la información.
                        </p>
                    </Card>
                )}

                {/* ── KPI resumen ── */}
                {resumen && resumen.meses_con_datos > 0 && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {/* Total ganado */}
                        <Card className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/40">
                                    <CircleDollarSign className="size-4 text-green-700 dark:text-green-400" />
                                </div>
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                    Total ganado
                                </span>
                            </div>
                            <p className="text-xl font-extrabold text-green-700 dark:text-green-400 tabular-nums">
                                {formatCOP(resumen.total_pago_variable)}
                            </p>
                            <p className="mt-1 text-[10px] text-gray-400">pago variable DT acumulado</p>
                        </Card>

                        {/* Promedio rechazos */}
                        <Card className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${resumen.promedio_rechazos < 2.1 ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
                                    <AlertTriangle className={`size-4 ${resumen.promedio_rechazos < 2.1 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                                </div>
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                    Prom. rechazos
                                </span>
                            </div>
                            <p className={`text-xl font-extrabold tabular-nums ${resumen.promedio_rechazos < 2.1 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {resumen.promedio_rechazos}%
                            </p>
                            <p className="mt-1 text-[10px] text-gray-400">promedio anual · meta &lt;2.1%</p>
                        </Card>

                        {/* Mejor mes */}
                        <Card className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                                    <Trophy className="size-4 text-amber-600 dark:text-amber-400" />
                                </div>
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                    Mejor mes
                                </span>
                            </div>
                            <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                                {resumen.mejor_mes?.mes ?? '—'}
                            </p>
                            <p className="mt-1 text-[10px] text-gray-400">
                                {resumen.mejor_mes ? formatCOP(resumen.mejor_mes.valor) : '—'}
                            </p>
                        </Card>

                        {/* Peor mes */}
                        <Card className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/40">
                                    <TrendingDown className="size-4 text-rose-600 dark:text-rose-400" />
                                </div>
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                    Mes más bajo
                                </span>
                            </div>
                            <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400">
                                {resumen.peor_mes?.mes ?? '—'}
                            </p>
                            <p className="mt-1 text-[10px] text-gray-400">
                                {resumen.peor_mes ? formatCOP(resumen.peor_mes.valor) : '—'}
                            </p>
                        </Card>
                    </div>
                )}

                {/* ── Historial por mes ── */}
                {registros.length > 0 && (
                    <Card>
                        <button
                            type="button"
                            onClick={() => setHistorialOpen((v) => !v)}
                            className="flex w-full items-center justify-between p-5 text-left"
                        >
                            <SectionHeader
                                icon={BarChart3}
                                title={`Detalle mensual ${anio}`}
                                subtitle={`${registros.filter((r) => !r.es_futuro).length} meses con información`}
                            />
                            <div className="text-gray-400">
                                {historialOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                            </div>
                        </button>

                        {historialOpen && (
                            <div className="flex flex-col gap-2 px-4 pb-5">
                                <p className="text-[10px] text-gray-400 mb-1">
                                    💡 Toca cada fila para ver el detalle del mes.
                                </p>
                                {registros.map((registro) => (
                                    <FilaMes key={registro.id ?? registro.mes} registro={registro} maxPago={maxPago} />
                                ))}
                            </div>
                        )}
                    </Card>
                )}

                {/* ── Leyenda de colores ── */}
                <div className="flex flex-wrap gap-3 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-4 rounded-full bg-green-500" /> ≥ 90% del salario variable
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-4 rounded-full bg-amber-400" /> 70–89%
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-4 rounded-full bg-red-500" /> &lt; 70%
                    </span>
                </div>

            </div>
        </AppLayout>
    );
}
