import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import {
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    CircleDollarSign,
    Info,
    Lightbulb,
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
    { title: 'Mi Compensación Diaria', href: '/portal/mi-compensacion' },
];

const META_MENSUAL = 800; // COP — hardcoded por diseño del negocio

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegistroDia {
    id: number;
    fecha: string;
    rechazos: number;
    rechazos_porcentaje: number;
    valor_x_dia: number;
    valor_var: number;
    valor_perdido: number;
    porcentaje_variable: string;
    porcentaje_variable_no_cum: string;
    cal_rechazos: number;
    cal_rechazos_2: number;
    meta_1: number;
    meta_2: number;
    placa: string | null;
    transporte: string | null;
    nombre_completo: string | null;
    cargo: string | null;
}

interface Colaborador {
    cedula: string;
    nombre_completo: string;
    cargo: string;
}

interface EstadisticasMes {
    dias_trabajados: number;
    total_ganado: number;
    total_perdido: number;
    promedio_rechazos: number;
    dias_meta_1: number;
    dias_meta_2: number;
}

interface Ausencias {
    justificada: number;
    injustificada: number;
}

interface MesHistorial {
    mes_num: number;
    mes_nombre: string;
    es_futuro: boolean;
    dias_trabajados: number | null;
    total_ganado: number | null;
    total_perdido: number | null;
    promedio_rechazos: number | null;
    dias_meta_1: number | null;
    dias_meta_2: number | null;
    aus_justificada: number | null;
    aus_injustificada: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCOP(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(amount || 0);
}

function formatDateLong(d: string | null): string {
    if (!d) return '—';
    // Parsear como fecha local (evita el desfase de timezone al usar new Date('YYYY-MM-DD'))
    const [y, m, day] = d.split('-').map(Number);
    const dt = new Date(y, m - 1, day);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function formatDateShort(d: string | null): string {
    if (!d) return '—';
    const [y, m, day] = d.split('-').map(Number);
    const dt = new Date(y, m - 1, day);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Chip ────────────────────────────────────────────────────────────────────

function Chip({ ok, label, color }: { ok?: boolean; label: string; color?: string }) {
    const base = color ?? (ok ? 'bg-green-700 text-white' : 'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground');
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${base}`}>
            {ok !== undefined && (ok ? <CheckCircle2 className="size-2.5" /> : <XCircle className="size-2.5" />)}
            {label}
        </span>
    );
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

// ─── KPI ────────────────────────────────────────────────────────────────────

function Kpi({ label, value, green, red, muted }: { label: string; value: React.ReactNode; green?: boolean; red?: boolean; muted?: boolean }) {
    const color = green ? 'text-green-700 dark:text-green-400' : red ? 'text-red-600 dark:text-red-400' : muted ? 'text-muted-foreground' : 'text-foreground';
    return (
        <div>
            <p className="mb-0.5 text-[10px] text-muted-foreground">{label}</p>
            <p className={`text-base font-bold tabular-nums leading-tight ${color}`}>{value}</p>
        </div>
    );
}

// ─── Operador ────────────────────────────────────────────────────────────────

function Op({ children }: { children: React.ReactNode }) {
    return <div className="flex shrink-0 items-center justify-center self-center text-xl font-bold text-muted-foreground">{children}</div>;
}

// ─── EcuacionCard — más pequeña + tooltip que nunca queda fuera ───────────────

interface TooltipData {
    titulo: string;
    formula: string;
    explicacion: React.ReactNode;
    resultado: string;
    resultColor?: string;
}

function EcuacionCard({
    numero, label, value, subvalue, icon: Icon,
    highlight, met, neutral, tooltip,
}: {
    numero?: string; label: string; value: string; subvalue?: string;
    icon: React.ElementType; highlight?: 'green' | 'red'; met?: boolean;
    neutral?: boolean; tooltip: TooltipData;
}) {
    const [open, setOpen] = useState(false);

    const border = highlight === 'green' ? 'border-green-200 dark:border-green-700/40' : highlight === 'red' ? 'border-red-200 dark:border-red-700/40' : 'border-sidebar-border/70 dark:border-sidebar-border';
    const bg    = highlight === 'green' ? 'bg-green-50 dark:bg-green-900/10' : highlight === 'red' ? 'bg-red-50 dark:bg-red-900/10' : 'bg-card';
    const valColor = highlight === 'green' ? 'text-green-700 dark:text-green-400' : highlight === 'red' ? 'text-red-600 dark:text-red-400' : met === true ? 'text-green-700 dark:text-green-400' : met === false ? 'text-muted-foreground' : 'text-foreground';
    const iconBg   = highlight === 'green' ? 'bg-green-100 dark:bg-green-900/30' : highlight === 'red' ? 'bg-red-100 dark:bg-red-900/30' : met === true ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted';
    const iconCol  = highlight === 'green' ? 'text-green-700 dark:text-green-400' : highlight === 'red' ? 'text-red-600 dark:text-red-400' : met === true ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground';

    return (
        // El tooltip es un sibling que aparece en el flujo normal (no absolute),
        // así nunca queda tapado ni sale del contenedor.
        <div className="flex flex-1 flex-col">
            {/* Card visible */}
            <div
                className={`flex min-w-[100px] flex-1 cursor-default flex-col items-center gap-1.5 rounded-xl border px-2.5 py-3 text-center shadow-sm transition-shadow hover:shadow-md ${border} ${bg}`}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                tabIndex={0}
            >
                {numero && <span className="text-[9px] font-semibold text-muted-foreground">{numero}</span>}
                <p className="text-[11px] font-semibold text-foreground">{label}</p>
                <div className={`flex size-8 items-center justify-center rounded-full ${iconBg}`}>
                    <Icon className={`size-4 ${iconCol}`} />
                </div>
                <p className={`text-sm font-extrabold tabular-nums ${valColor}`}>{value}</p>
                {subvalue && <p className="text-[10px] font-semibold tabular-nums text-muted-foreground">{subvalue}</p>}
                {met !== undefined && <Chip ok={met} label={met ? 'Cumplida' : 'No cumplida'} />}
            </div>

            {/* Tooltip en flujo — aparece debajo con animación, desplaza el layout */}
            {open && (
                <div className="z-10 mt-1.5 w-60 rounded-xl border border-sidebar-border/70 bg-popover p-3 text-left shadow-md dark:border-sidebar-border">
                    <p className="mb-2 text-[10px] font-bold text-foreground">{tooltip.titulo}</p>
                    <div className="text-[10px] leading-relaxed text-muted-foreground">{tooltip.explicacion}</div>
                    <p className={`mt-1.5 text-xs font-extrabold tabular-nums ${tooltip.resultColor ?? 'text-green-700 dark:text-green-400'}`}>
                        = {tooltip.resultado}
                    </p>
                </div>
            )}
        </div>
    );
}

// ─── AusenciaCard ────────────────────────────────────────────────────────────

function AusenciaCard({ titulo, dias, meta, mensaje, ok }: { titulo: string; dias: number; meta?: string; mensaje: string; ok: boolean }) {
    return (
        <div className={`flex flex-col gap-2 rounded-xl border p-3 ${ok ? 'border-green-100 bg-green-50 dark:border-green-800/40 dark:bg-green-900/10' : 'border-orange-100 bg-orange-50 dark:border-orange-800/40 dark:bg-orange-900/10'}`}>
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">{titulo}</p>
                <Chip ok={ok} label={ok ? mensaje : mensaje} />
            </div>
            <p className="text-2xl font-extrabold tabular-nums text-foreground">
                {dias} {dias === 1 ? 'día' : 'días'}
            </p>
            {meta && <p className="text-[10px] text-muted-foreground">{meta}</p>}
        </div>
    );
}

// ─── MetaMensualCard ─────────────────────────────────────────────────────────

function MetaMensualCard({ ganado, meta }: { ganado: number; meta: number }) {
    const pct = Math.min(Math.round((ganado / meta) * 100), 100);
    const alcanza = ganado >= meta;
    return (
        <div className="flex flex-col gap-2 rounded-xl border border-sidebar-border/70 bg-card p-3 shadow-sm dark:border-sidebar-border">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">Tu meta mensual</p>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${alcanza ? 'bg-green-700 text-white' : 'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground'}`}>
                    <CircleDollarSign className="size-2.5" />
                    {alcanza ? '¡Alcanzada!' : 'Por mejorar'}
                </span>
            </div>
            {/* Barra de progreso */}
            <div className="h-2 w-full rounded-full bg-muted">
                <div
                    className={`h-2 rounded-full transition-all ${alcanza ? 'bg-green-600' : 'bg-amber-400'}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                    <p className="text-[9px] text-muted-foreground">Has ganado</p>
                    <p className="text-sm font-bold text-green-700 dark:text-green-400">{formatCOP(ganado)}</p>
                </div>
                <div>
                    <p className="text-[9px] text-muted-foreground">de tu meta</p>
                    <p className="text-sm font-bold text-foreground">{pct}%</p>
                </div>
                <div>
                    <p className="text-[9px] text-muted-foreground">Meta total</p>
                    <p className="text-sm font-bold text-muted-foreground">{formatCOP(meta)}</p>
                </div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MiCompensacionIndex() {
    const pageProps = usePage<any>().props || {};
    const colaborador: Colaborador | null      = pageProps.colaborador;
    const fechaSeleccionada: string | null      = pageProps.fecha_seleccionada;
    const registroDia: RegistroDia | null       = pageProps.registro_dia;
    const ausencias: Ausencias                  = pageProps.ausencias ?? { justificada: 0, injustificada: 0 };
    const historialAnual: MesHistorial[]        = pageProps.historial_anual ?? [];
    const estadisticasMes: EstadisticasMes      = pageProps.estadisticas_mes ?? {
        dias_trabajados: 0, total_ganado: 0, total_perdido: 0,
        promedio_rechazos: 0, dias_meta_1: 0, dias_meta_2: 0,
    };
    const error: string | null = pageProps.error;

    const [selectedDate, setSelectedDate] = useState(
        fechaSeleccionada || new Date().toISOString().split('T')[0],
    );
    const [historialOpen, setHistorialOpen] = useState(false);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const d = e.target.value;
        setSelectedDate(d);
        router.get(route('portal.mi-compensacion.index'), { fecha: d }, { preserveState: true, preserveScroll: true });
    };

    if (error || !colaborador) {
        return (
            <AppLayout>
                <Head title="Mi Compensación Diaria" />
                <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6">
                    <h1 className="text-2xl font-bold text-foreground">Mi Compensación Diaria</h1>
                    <Card className="p-5"><p className="text-sm text-red-600">{error || 'No se pudo cargar la información.'}</p></Card>
                </div>
            </AppLayout>
        );
    }

    const rechPct    = registroDia?.rechazos_porcentaje ?? 0;
    const cumpleMeta2 = registroDia ? rechPct < registroDia.meta_2 : false;
    const cumpleMeta1 = registroDia ? rechPct <= registroDia.meta_1 : false;
    const pctNum      = registroDia ? parseFloat(registroDia.porcentaje_variable) : 0;
    const cumpleTotal = pctNum >= 100;

    const CIRCUM = 276.46;
    const dash   = Math.min((pctNum / 100) * CIRCUM, CIRCUM);

    // Tooltips con datos reales
    const tt = registroDia ? {
        valorDia: {
            titulo: '1. Valor del día',
            formula: 'Es fijo. El mismo valor cada día que trabajas.',
            explicacion: <p>Cada día laborado vale <strong>{formatCOP(registroDia.valor_x_dia)}</strong>. Este monto es igual para todos los días — es tu punto de partida.</p>,
            resultado: formatCOP(registroDia.valor_x_dia),
        },
        meta1: {
            titulo: '2. Meta principal (80%)',
            formula: `Si tus rechazos son menores al ${registroDia.meta_2}%, ganas el 80% del día.`,
            explicacion: (
                <ul className="space-y-0.5">
                    <li>✅ Rechazos <strong>menores a {registroDia.meta_2}%</strong> → ganas el <strong>80%</strong></li>
                    <li>❌ Rechazos <strong>{registroDia.meta_2}% o más</strong> → no ganas este porcentaje</li>
                    <li className="font-medium text-green-600">Hoy tuviste {rechPct.toFixed(2)}% de rechazos</li>
                </ul>
            ),
            resultado: `${registroDia.cal_rechazos_2} × ${formatCOP(registroDia.valor_x_dia)} = ${formatCOP(registroDia.valor_x_dia * registroDia.cal_rechazos_2)}`,
            resultColor: cumpleMeta1 ? 'text-green-700' : 'text-muted-foreground',
        },
        meta2: {
            titulo: '3. Meta adicional (20%)',
            formula: `Si tus rechazos son ${registroDia.meta_1}% o menos, ganas el 20% extra.`,
            explicacion: (
                <ul className="space-y-0.5">
                    <li>✅ Rechazos <strong>{registroDia.meta_1}% o menos</strong> → ganas el <strong>20% extra</strong></li>
                    <li>❌ Rechazos <strong>mayores a {registroDia.meta_1}%</strong> → no aplica el extra</li>
                    <li className="font-medium text-green-600">Hoy tuviste {rechPct.toFixed(2)}% de rechazos</li>
                </ul>
            ),
            resultado: `${registroDia.cal_rechazos} × ${formatCOP(registroDia.valor_x_dia)} = ${formatCOP(registroDia.valor_x_dia * registroDia.cal_rechazos)}`,
            resultColor: cumpleMeta2 ? 'text-green-700' : 'text-muted-foreground',
        },
        valorGanas: {
            titulo: '4. Lo que ganaste hoy',
            formula: 'Es la suma de las dos metas que cumpliste.',
            explicacion: (
                <ul className="space-y-0.5">
                    <li>· Meta principal cumplida → <strong>80%</strong> del día</li>
                    <li>· Meta adicional cumplida → <strong>20%</strong> más</li>
                    <li>· Ambas cumplidas → <strong className="text-green-700">100%</strong> del día</li>
                </ul>
            ),
            resultado: formatCOP(registroDia.valor_var),
            resultColor: 'text-green-700',
        },
        valorPerdido: {
            titulo: '5. Lo que dejaste de ganar',
            formula: 'Es la diferencia entre el valor del día y lo que ganaste.',
            explicacion: <p>Si cumpliste todas las metas, este valor es <strong>$0</strong>. Si no, aquí ves cuánto dejaste de recibir por los rechazos del día.</p>,
            resultado: formatCOP(registroDia.valor_perdido),
            resultColor: registroDia.valor_perdido > 0 ? 'text-red-600' : 'text-muted-foreground',
        },
        pctVar: {
            titulo: '6. % que ganaste',
            formula: 'Qué parte del día ganaste según tus rechazos.',
            explicacion: <p>100% significa que cumpliste todo y ganaste el valor completo del día. Menos del 100% indica que hubo rechazos por encima de las metas.</p>,
            resultado: registroDia.porcentaje_variable,
            resultColor: 'text-green-700',
        },
        pctNoCum: {
            titulo: '7. % que no ganaste',
            formula: 'Lo que faltó para llegar al 100%.',
            explicacion: <p>Si este valor es 0%, ¡lo lograste todo! Si es mayor, muestra el porcentaje del día que no pudiste ganar por los rechazos.</p>,
            resultado: registroDia.porcentaje_variable_no_cum,
            resultColor: parseFloat(registroDia.porcentaje_variable_no_cum) > 0 ? 'text-red-600' : 'text-muted-foreground',
        },
    } : null;

    const mesActualIdx = new Date().getMonth(); // 0-based

    return (
        <AppLayout>
            <Head title="Mi Compensación Diaria" />
            <div className="flex flex-col gap-4 px-4 pb-10 sm:px-6">

                {/* Título */}
                <div>
                    <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Mi Compensación Diaria</h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">Detalle de tu compensación variable por día.</p>
                </div>

                {/* ══ CARD 1 — HERO ══ */}
                <Card>
                    <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">

                        {/* Avatar + nombre + selector — todo junto, sin caja propia */}
                        <div className="flex flex-col gap-3 sm:shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-700">
                                    <User className="size-4 text-white" />
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold leading-tight text-foreground">{colaborador.nombre_completo}</p>
                                    <p className="mt-0.5 text-[10px] font-semibold text-green-700 dark:text-green-400">
                                        CC {colaborador.cedula} · {colaborador.cargo}
                                    </p>
                                </div>
                            </div>
                            <div className="grid gap-1">
                                <label htmlFor="fecha_dia" className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                                    <CalendarDays className="size-3 text-green-700" /> Consultar día
                                </label>
                                <div className="flex items-center gap-1.5 rounded-lg border border-sidebar-border/70 bg-muted px-2.5 py-1.5 dark:border-sidebar-border dark:bg-muted">
                                    <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
                                    <input
                                        id="fecha_dia" type="date" value={selectedDate}
                                        onChange={handleDateChange}
                                        max={new Date().toISOString().split('T')[0]}
                                        className="w-full bg-transparent text-sm text-foreground focus:outline-none dark:text-foreground"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Centro decorativo — sin borde ni fondo propio */}
                        <div className="mx-4 hidden flex-1 items-center justify-center sm:flex"
                            style={{ minHeight: '100px', background: 'radial-gradient(circle at 50% 60%, #bbf7d0 0%, #f0fdf4 55%, transparent 90%)', borderRadius: '0.75rem' }}>
                            <TrendingUp className="size-16 text-green-200 dark:text-green-900" />
                        </div>

                        {/* Círculo % — sin caja propia, directo en el flujo */}
                        {registroDia ? (
                            <div className="flex items-center gap-3 sm:shrink-0">
                                <div className="relative shrink-0">
                                    <svg width="76" height="76" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="44" fill="none" stroke="#bbf7d0" strokeWidth="9" />
                                        <circle cx="50" cy="50" r="44" fill="none" stroke="#15803d" strokeWidth="9"
                                            strokeLinecap="round" strokeDasharray={`${dash} ${CIRCUM}`} transform="rotate(-90 50 50)" />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-lg font-extrabold leading-none text-green-700 dark:text-green-400">{pctNum}%</span>
                                        <span className="text-[9px] font-medium text-muted-foreground">variable</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-foreground">
                                        {cumpleTotal ? '¡Excelente!' : pctNum >= 80 ? '¡Bien!' : 'Mejora aquí'}
                                    </p>
                                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                                        {cumpleTotal ? 'Cumpliste el 100% de tu compensación del día.'
                                            : pctNum >= 80 ? 'Cumpliste la meta principal.'
                                            : 'Reduce tus rechazos para ganar más.'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground sm:shrink-0">Selecciona un día</p>
                        )}
                    </div>
                </Card>

                {/* ══ Sin datos del día ══ */}
                {!registroDia ? (
                    <Card className="flex flex-col items-center gap-2 p-8 text-center">
                        <Info className="size-5 text-muted-foreground" />
                        <p className="text-sm font-medium text-foreground">Sin información para {formatDateShort(selectedDate)}</p>
                        <p className="text-xs text-muted-foreground">Selecciona otro día o espera a que se cargue la información.</p>
                    </Card>
                ) : (
                    <>
                        {/* ══ CARDS DE AUSENCIAS + META MENSUAL ══ */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <AusenciaCard
                                titulo="Ausencias justificadas"
                                dias={ausencias.justificada}
                                meta="Esta semana · Objetivo: 0 días"
                                mensaje={ausencias.justificada === 0 ? '¡Perfecto!' : 'Con ausencias'}
                                ok={ausencias.justificada === 0}
                            />
                            <AusenciaCard
                                titulo="Ausencias injustificadas"
                                dias={ausencias.injustificada}
                                meta="Mientras menos, mejor"
                                mensaje={ausencias.injustificada === 0 ? '¡Perfecto!' : 'Hay que evitarlas'}
                                ok={ausencias.injustificada === 0}
                            />
                            <MetaMensualCard ganado={estadisticasMes.total_ganado} meta={META_MENSUAL} />
                        </div>

                        {/* ══ CARD 2 — ECUACIÓN VISUAL ══ */}
                        <Card className="p-4">
                            <SectionHeader icon={CircleDollarSign} title="¿Cómo se calculó mi pago?" subtitle={formatDateLong(registroDia.fecha)} />
                            <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <Lightbulb className="size-3 shrink-0" />
                                Toca cada card para entender qué significa ese valor.
                            </p>

                            {/* Ecuación horizontal — scroll en móvil */}
                            <div className="mt-3 overflow-x-auto pb-1">
                                <div className="flex min-w-max items-stretch gap-1.5 sm:gap-2">
                                    <EcuacionCard numero="Valor del día" label="Base fija" value={formatCOP(registroDia.valor_x_dia)} icon={CalendarDays} neutral tooltip={tt!.valorDia} />
                                    <Op>×</Op>
                                    <EcuacionCard numero="Meta principal" label="80% del día" value="80%" subvalue={formatCOP(registroDia.valor_x_dia * 0.8)} icon={cumpleMeta1 ? CheckCircle2 : XCircle} met={cumpleMeta1} tooltip={tt!.meta1} />
                                    <Op>+</Op>
                                    <EcuacionCard numero="Meta adicional" label="20% extra" value="20%" subvalue={formatCOP(registroDia.valor_x_dia * 0.2)} icon={cumpleMeta2 ? CheckCircle2 : XCircle} met={cumpleMeta2} tooltip={tt!.meta2} />
                                    <Op>=</Op>
                                    <EcuacionCard numero="Lo que ganaste" label="Hoy" value={formatCOP(registroDia.valor_var)} icon={TrendingUp} highlight="green" tooltip={tt!.valorGanas} />
                                    <Op>−</Op>
                                    <EcuacionCard numero="Lo que no ganaste" label={registroDia.valor_perdido > 0 ? 'Por rechazos' : 'Sin pérdida'} value={formatCOP(registroDia.valor_perdido)} icon={TrendingDown} highlight={registroDia.valor_perdido > 0 ? 'red' : undefined} neutral={registroDia.valor_perdido === 0} tooltip={tt!.valorPerdido} />
                                </div>
                            </div>

                            {/* Fila % variable + mensaje */}
                            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                <EcuacionCard numero="% Ganado" label="Del día" value={registroDia.porcentaje_variable} icon={TrendingUp} highlight="green" tooltip={tt!.pctVar} />
                                <EcuacionCard numero="% No ganado" label="Del día" value={registroDia.porcentaje_variable_no_cum} icon={TrendingDown} highlight={parseFloat(registroDia.porcentaje_variable_no_cum) > 0 ? 'red' : undefined} neutral={parseFloat(registroDia.porcentaje_variable_no_cum) === 0} tooltip={tt!.pctNoCum} />
                                <div className={`col-span-2 flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${cumpleTotal ? 'border-green-200 bg-green-50 dark:border-green-700/40 dark:bg-green-900/10' : 'border-amber-200 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-900/10'}`}>
                                    <Trophy className={`size-5 shrink-0 ${cumpleTotal ? 'text-green-700' : 'text-amber-500'}`} />
                                    <div>
                                        <p className={`text-xs font-bold ${cumpleTotal ? 'text-green-700' : 'text-amber-700'}`}>
                                            {cumpleTotal ? '¡Felicitaciones!' : pctNum >= 80 ? '¡Buen trabajo!' : 'Sigue mejorando'}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {cumpleTotal ? 'Cumpliste las dos metas y ganaste el 100% de tu compensación.'
                                                : pctNum >= 80 ? 'Cumpliste la meta principal. Baja los rechazos para el 100%.'
                                                : `Rechazos (${rechPct.toFixed(2)}%) superan las metas.`}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* ══ CARD 3 — RESUMEN DEL MES + HISTORIAL DESPLEGABLE ══ */}
                        <Card className="p-4">
                            <div className="flex items-center justify-between gap-3">
                                {/* Nombre del mes filtrado */}
                            {(() => {
                                const [y, m] = selectedDate.split('-').map(Number);
                                const nombreMes = new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
                                return <SectionHeader icon={Trophy} title="Resumen del mes" subtitle={nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)} />;
                            })()}
                                <button
                                    onClick={() => setHistorialOpen(v => !v)}
                                    className="flex items-center gap-1 rounded-lg border border-sidebar-border/70 bg-muted px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:bg-muted dark:border-sidebar-border dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted"
                                >
                                    {historialOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                                    {historialOpen ? 'Ocultar historial' : 'Ver historial anual'}
                                </button>
                            </div>

                            {/* KPIs mes filtrado — solo lo relevante */}
                            <div className="mt-4 flex flex-wrap items-center gap-4">
                                {/* Días trabajados */}
                                <div>
                                    <p className="mb-0.5 text-[10px] text-muted-foreground">Días trabajados</p>
                                    <p className="text-base font-bold tabular-nums text-foreground">{estadisticasMes.dias_trabajados}</p>
                                </div>

                                {/* Total ganado */}
                                <div>
                                    <p className="mb-0.5 text-[10px] text-muted-foreground">Total ganado</p>
                                    <p className="text-base font-bold tabular-nums text-green-700 dark:text-green-400">{formatCOP(estadisticasMes.total_ganado)}</p>
                                </div>

                                {/* Total perdido — solo si > 0 */}
                                {estadisticasMes.total_perdido > 0 && (
                                    <div>
                                        <p className="mb-0.5 text-[10px] text-muted-foreground">Total perdido</p>
                                        <p className="text-base font-bold tabular-nums text-red-600 dark:text-red-400">{formatCOP(estadisticasMes.total_perdido)}</p>
                                    </div>
                                )}

                                {/* Resultado del mes */}
                                <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${
                                    estadisticasMes.total_perdido === 0 && estadisticasMes.dias_trabajados > 0
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        : estadisticasMes.dias_trabajados === 0
                                          ? 'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground'
                                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                }`}>
                                    {estadisticasMes.dias_trabajados === 0 ? (
                                        <span className="text-sm">—</span>
                                    ) : estadisticasMes.total_perdido === 0 ? (
                                        <Trophy className="size-3.5" />
                                    ) : (
                                        <TrendingUp className="size-3.5" />
                                    )}
                                    <span className="text-[11px] font-semibold">
                                        {estadisticasMes.dias_trabajados === 0
                                            ? 'Sin registros'
                                            : estadisticasMes.total_perdido === 0
                                              ? '¡Excelente mes!'
                                              : 'Por mejorar'}
                                    </span>
                                </div>
                            </div>

                            {/* ── Historial enero-diciembre — desplegable ── */}
                            {historialOpen && (
                                <div className="mt-4 overflow-x-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-sidebar-border/70 bg-muted dark:border-sidebar-border dark:bg-muted">
                                                <th className="px-3 py-2 text-left font-semibold text-green-700 dark:text-green-400">Mes</th>
                                                <th className="px-3 py-2 text-center font-semibold text-green-700 dark:text-green-400">Días</th>
                                                <th className="px-3 py-2 text-right font-semibold text-green-700 dark:text-green-400">Ganado</th>
                                                <th className="px-3 py-2 text-right font-semibold text-green-700 dark:text-green-400">Valor perdido</th>
                                                <th className="px-3 py-2 text-center font-semibold text-green-700 dark:text-green-400">Aus. Just.</th>
                                                <th className="px-3 py-2 text-center font-semibold text-green-700 dark:text-green-400">Aus. Injust.</th>
                                                <th className="px-3 py-2 text-center font-semibold text-green-700 dark:text-green-400">% Rechazos</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {historialAnual.map((mes) => {
                                                const esMesActual = mes.mes_num === mesActualIdx + 1;
                                                return (
                                                    <tr
                                                        key={mes.mes_num}
                                                        className={`${esMesActual ? 'bg-green-50/60 font-semibold dark:bg-green-900/10' : ''} ${mes.es_futuro ? 'opacity-40' : ''}`}
                                                    >
                                                        <td className="px-3 py-2 text-foreground">
                                                            {mes.mes_nombre}
                                                            {esMesActual && <span className="ml-1 rounded-full bg-green-700 px-1.5 py-0.5 text-[9px] text-white">Actual</span>}
                                                        </td>
                                                        <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{mes.es_futuro ? '—' : (mes.dias_trabajados ?? 0)}</td>
                                                        <td className="px-3 py-2 text-right tabular-nums text-green-700 dark:text-green-400">{mes.es_futuro ? '—' : formatCOP(mes.total_ganado ?? 0)}</td>
                                                        <td className={`px-3 py-2 text-right tabular-nums ${(mes.total_perdido ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{mes.es_futuro ? '—' : formatCOP(mes.total_perdido ?? 0)}</td>
                                                        <td className={`px-3 py-2 text-center tabular-nums ${(mes.aus_justificada ?? 0) > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>{mes.es_futuro ? '—' : (mes.aus_justificada ?? 0)}</td>
                                                        <td className={`px-3 py-2 text-center tabular-nums ${(mes.aus_injustificada ?? 0) > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{mes.es_futuro ? '—' : (mes.aus_injustificada ?? 0)}</td>
                                                        <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{mes.es_futuro ? '—' : `${(mes.promedio_rechazos ?? 0).toFixed(2)}%`}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card>

                        {/* ══ BANNER MOTIVACIONAL ══ */}
                        <Card className="p-3.5">
                            <div className="flex items-center gap-2.5">
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-700">
                                    <Star className="size-4 text-white" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-foreground">
                                        {cumpleTotal ? '¡Sigue así!' : '¡Tú puedes mejorar!'}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {cumpleTotal ? 'Vas por muy buen camino. Mantén tus indicadores en verde.'
                                            : 'Reducir tus rechazos es la clave para ganar el 100% cada día.'}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
