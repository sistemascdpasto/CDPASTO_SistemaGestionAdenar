import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    BarChart3,
    CalendarDays,
    CircleDollarSign,
    ExternalLink,
    Info,
    TrendingDown,
    Trophy,
} from 'lucide-react';
import React, { useState } from 'react';

// ─── Breadcrumbs ─────────────────────────────────────────────────────────────

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Portal', href: '/portal' },
    { title: 'Mi Compensación Mensual', href: '/portal/mi-compensacion-variable' },
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

function barColor(pct: number): string {
    if (pct >= 90) return 'bg-green-500';
    if (pct >= 70) return 'bg-amber-600';
    return 'bg-red-500';
}

// ─── Card base ───────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border ${className}`}>
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
                <p className="text-sm font-semibold text-foreground">{title}</p>
                {subtitle && <p className="text-xs capitalize text-muted-foreground">{subtitle}</p>}
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
        : muted ? 'text-muted-foreground'
        : 'text-foreground';
    return (
        <div>
            <p className="mb-0.5 text-[10px] text-muted-foreground">{label}</p>
            <p className={`text-base font-bold tabular-nums leading-tight ${color}`}>{value}</p>
        </div>
    );
}

// ─── Fila de mes ─────────────────────────────────────────────────────────────

function FilaMes({ registro, maxPago }: { registro: RegistroMes; maxPago: number }) {
    const [open, setOpen] = useState(false);

    if (registro.es_futuro) {
        return (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-sidebar-border/70 px-4 py-3 dark:border-sidebar-border">
                <span className="w-24 text-xs font-semibold text-muted-foreground dark:text-muted-foreground">{registro.mes}</span>
                <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">Sin datos aún</span>
            </div>
        );
    }

    const pctObtenido = registro.salario_variable > 0
        ? Math.min(Math.round((registro.pago_variable_dt / registro.salario_variable) * 100), 100)
        : 0;
    const barWidth = maxPago > 0 ? Math.round((registro.pago_variable_dt / maxPago) * 100) : 0;

    return (
        <div className="overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
            {/* Fila principal — clickeable para expandir */}
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60/50"
            >
                {/* Mes */}
                <span className="w-24 shrink-0 text-xs font-bold text-foreground">
                    {registro.mes}
                </span>

                {/* Barra de pago */}
                <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold tabular-nums text-foreground">
                                {formatCOP(registro.pago_variable_dt)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                                Tu rechazo fue de <span className="font-semibold text-foreground">{registro.porcentaje_rechazos}%</span>
                            </span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-semibold text-foreground">
                                {pctObtenido}%
                            </span>
                            <span className="text-[9px] text-muted-foreground">
                                Valor: {formatCOP(registro.salario_variable)}
                            </span>
                        </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${barColor(pctObtenido)}`}
                            style={{ width: `${barWidth}%` }}
                        />
                    </div>
                </div>

                {/* Chevron */}
                <div className="shrink-0 text-muted-foreground">
                    {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </div>
            </button>

            {/* Detalle expandible */}
            {open && (
                <div className="border-t border-green-200 px-4 py-4" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                        <Kpi label="Ganaste:" value={formatCOP(registro.total_pago)} />
                        <Kpi label="Tus días trabajados:" value={registro.dias_trabajados} />
                        <Kpi label="Tu rechazo fue de:" value={`${registro.porcentaje_rechazos}%`} />
                        <Kpi label="Habilitadores" value={registro.habilitadores} />
                        <Kpi label="Tus ausencias justificadas:" value={registro.ausencia_justificada} />
                        <Kpi label="Aus. injustificada" value={registro.ausencia_injustificada} />
                        <Kpi label="Adherencia GP" value={registro.adherencia_gp ?? '—'} />
                        <Kpi label="Fatalidades TRI" value={registro.tri_fatalidades} />
                        <Kpi label="Variable" value={registro.variable ?? '—'} />
                    </div>
                    {/* Botón ir al detalle diario del mes */}
                    {(() => {
                        const anio = registro.anio;
                        const mes  = registro.mes_num;
                        const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
                        const ultimoDia = new Date(anio, mes, 0).getDate();
                        const hasta = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
                        const url = route('portal.mi-compensacion.index', { fecha_desde: desde, fecha_hasta: hasta });
                        return (
                            <div className="mt-4 flex justify-end">
                                <a
                                    href={url}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-white px-3 py-1.5 text-xs font-semibold text-green-800 shadow-sm transition hover:bg-green-50 dark:border-green-700/40 dark:bg-green-900/10 dark:text-green-300 dark:hover:bg-green-900/20"
                                >
                                    <ExternalLink className="size-3.5" />
                                    Ver detalle diario de {registro.mes}
                                </a>
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MisCompensacionVariableIndex() {
    const pageProps = (usePage<Record<string, unknown>>().props || {}) as Record<string, unknown>;
    const colaborador: Colaborador | null  = pageProps.colaborador as Colaborador | null;
    const registros: RegistroMes[]         = (pageProps.registros as RegistroMes[]) ?? [];
    const resumen: Resumen | null          = pageProps.resumen as Resumen | null;
    const anioSeleccionado: number         = (pageProps.anio_seleccionado as number) ?? new Date().getFullYear();
    const aniosDisponibles: number[]       = (pageProps.anios_disponibles as number[]) ?? [];
    const error: string | null             = pageProps.error as string | null;

    const [anio, setAnio] = useState(anioSeleccionado);

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
                <Head title="Mi Compensación Mensual" />
                <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6">
                    <h1 className="text-2xl font-bold text-foreground">Mi Compensación Mensual</h1>
                    <Card className="p-5">
                        <p className="text-sm text-red-600">{error || 'No se pudo cargar la información.'}</p>
                    </Card>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Mi Compensación Mensual" />
            <div className="flex flex-col gap-4 px-4 pb-10 pt-6 sm:px-6">

                {/* ── Título ── */}

                {/* ── CARD HERO ── */}
                <Card>
                    <div className="flex items-center gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">

                        {/* Avatar + título + nombre */}
                        <div className="flex items-center gap-2.5 sm:shrink-0">
                            <div
                                className="flex h-12 w-12 items-center justify-center rounded-xl shadow-sm shrink-0"
                                style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%)' }}
                            >
                                <CircleDollarSign className="h-6 w-6 text-white" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-tight">Mi Compensación Mensual</h1>
                                <p className="truncate text-xs font-semibold text-green-700 dark:text-green-400">
                                    {colaborador.nombre_completo} · CC {colaborador.cedula}
                                </p>
                                <p className="text-[11px] text-muted-foreground">{colaborador.cargo ?? 'Sin cargo'}</p>
                            </div>
                        </div>

                        {/* Decorativo central */}
                        <div
                            className="mx-4 hidden flex-1 items-center justify-center sm:flex"
                            style={{
                                minHeight: '80px',
                                background: 'radial-gradient(circle at 50% 60%, #bbf7d0 0%, #f0fdf4 55%, transparent 90%)',
                                borderRadius: '0.75rem',
                            }}
                        >
                            <BarChart3 className="size-12 text-green-200 dark:text-green-900" />
                        </div>

                        {/* Círculo % anual */}
                        {resumen ? (
                            <div className="flex items-center gap-2 sm:shrink-0">
                                <div className="relative shrink-0">
                                    <svg width="56" height="56" viewBox="0 0 100 100">
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
                                        <span className="text-sm font-extrabold leading-none text-green-700 dark:text-green-400">
                                            {pctAnual}%
                                        </span>
                                        <span className="text-[8px] font-medium text-muted-foreground">del año</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-foreground">
                                        {pctAnual >= 90 ? '¡Excelente año!' : pctAnual >= 70 ? '¡Buen año!' : 'Hay oportunidad'}
                                    </p>
                                    <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                                        {resumen.meses_con_datos} {resumen.meses_con_datos === 1 ? 'mes' : 'meses'} con datos
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground sm:shrink-0">Sin datos para {anio}</p>
                        )}
                    </div>
                </Card>

                {/* ── CARD SELECTOR AÑO ── */}
                <Card className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <CalendarDays className="size-4 shrink-0 text-green-700" />
                        <span className="text-sm font-semibold text-foreground">Año</span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                        {(aniosDisponibles.length > 0 ? aniosDisponibles : [anio]).map((a) => (
                            <button
                                key={a}
                                type="button"
                                onClick={() => handleAnioChange(a)}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                    a === anio
                                        ? 'text-white border-transparent'
                                        : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-700/40 dark:bg-green-900/10'
                                }`}
                                style={a === anio ? { background: 'linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%)' } : {}}
                            >
                                {a}
                            </button>
                        ))}
                    </div>
                </Card>

                {/* ── Sin datos ── */}
                {registros.filter((r) => !r.es_futuro).length === 0 && (
                    <Card className="flex flex-col items-center gap-2 p-8 text-center">
                        <Info className="size-5 text-muted-foreground" />
                        <p className="text-sm font-medium text-foreground">
                            Sin información para {anio}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Selecciona otro año o espera a que se cargue la información.
                        </p>
                    </Card>
                )}

                {/* ── KPI resumen ── */}
                {resumen && resumen.meses_con_datos > 0 && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {/* Total ganado */}
                        <div className="rounded-xl border border-green-200 p-4" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' }}>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%)' }}>
                                    <CircleDollarSign className="size-4 text-white" />
                                </div>
                                <span className="text-[10px] font-semibold text-muted-foreground">Total ganado</span>
                            </div>
                            <p className="text-xl font-extrabold tabular-nums" style={{ color: '#047857' }}>
                                {formatCOP(resumen.total_pago_variable)}
                            </p>
                            <p className="mt-1 text-[10px] text-muted-foreground">pago variable DT acumulado</p>
                        </div>

                        {/* Promedio rechazos */}
                        <div className={`rounded-xl border p-4 ${resumen.promedio_rechazos < 2.1 ? 'border-green-200' : 'border-red-100 bg-red-50 dark:border-red-800/40 dark:bg-red-900/10'}`}
                            style={resumen.promedio_rechazos < 2.1 ? { background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' } : {}}>
                            <div className="flex items-center gap-2 mb-2">
                                <div
                                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${resumen.promedio_rechazos >= 2.1 ? 'bg-red-100 dark:bg-red-900/40' : ''}`}
                                    style={resumen.promedio_rechazos < 2.1 ? { background: 'linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%)' } : {}}
                                >
                                    <AlertTriangle className={`size-4 ${resumen.promedio_rechazos < 2.1 ? 'text-white' : 'text-red-600 dark:text-red-400'}`} />
                                </div>
                                <span className="text-[10px] font-semibold text-muted-foreground">Promedio de tus rechazos en {anio}</span>
                            </div>
                            <p className={`text-xl font-extrabold tabular-nums ${resumen.promedio_rechazos < 2.1 ? '' : 'text-red-600 dark:text-red-400'}`}
                                style={resumen.promedio_rechazos < 2.1 ? { color: '#047857' } : {}}>
                                {resumen.promedio_rechazos}%
                            </p>
                        </div>

                        {/* Mejor mes */}
                        <Card className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-200 dark:bg-amber-900/40">
                                    <Trophy className="size-4 text-amber-800 dark:text-amber-600" />
                                </div>
                                <span className="text-[10px] font-semibold text-muted-foreground">Mejor mes</span>
                            </div>
                            <p className="text-xl font-extrabold text-amber-800 dark:text-amber-600">
                                {resumen.mejor_mes?.mes ?? '—'}
                            </p>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                                {resumen.mejor_mes ? formatCOP(resumen.mejor_mes.valor) : '—'}
                            </p>
                        </Card>

                        {/* Peor mes */}
                        <Card className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/40">
                                    <TrendingDown className="size-4 text-rose-600 dark:text-rose-400" />
                                </div>
                                <span className="text-[10px] font-semibold text-muted-foreground">Mes con oportunidad</span>
                            </div>
                            <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400">
                                {resumen.peor_mes?.mes ?? '—'}
                            </p>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                                {resumen.peor_mes ? formatCOP(resumen.peor_mes.valor) : '—'}
                            </p>
                        </Card>
                    </div>
                )}

                {/* ── Historial por mes ── */}
                {registros.length > 0 && (
                    <Card>
                        <div className="flex w-full items-center p-5">
                            <SectionHeader
                                icon={BarChart3}
                                title={`Detalle mensual ${anio}`}
                                subtitle={`${registros.filter((r) => !r.es_futuro).length} meses con información`}
                            />
                        </div>

                        <div className="flex flex-col gap-2 px-4 pb-5">
                                <p className="mb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <Info className="size-3 shrink-0" />
                                    Toca cada fila para ver el detalle del mes.
                                </p>
                                {registros.filter((r) => !r.es_futuro).map((registro) => (
                                    <FilaMes key={registro.id ?? registro.mes} registro={registro} maxPago={maxPago} />
                                ))}
                            </div>
                    </Card>
                )}

                {/* ── Leyenda de colores ── */}
                <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-4 rounded-full bg-green-500" /> ≥ 90% del salario variable
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-4 rounded-full bg-amber-600" /> 70–89%
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-4 rounded-full bg-red-500" /> &lt; 70%
                    </span>
                </div>

            </div>
        </AppLayout>
    );
}
