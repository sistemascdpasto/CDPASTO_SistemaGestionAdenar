import AppLayout from '@/layouts/app-layout';
import { Head, router, usePage } from '@inertiajs/react';
import {
    CalendarDays,
    CircleDollarSign,
    Info,
    Star,
    TrendingUp,
    ChevronRight,
} from 'lucide-react';
import React, { useRef, useState } from 'react';

// (no hay constantes globales aquí)

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegistroDiaSimple {
    id: number | null;
    fecha: string;
    rechazos: number;
    valor_x_dia: number;
    valor_var: number;
    valor_perdido: number;
    porcentaje_variable: string;
    cal_rechazos: number;
    meta_1: number;
    meta_2: number;
}

interface RegistroDia {
    id: number | null;
    fecha_desde: string;
    fecha_hasta: string;
    dias_en_rango: number;
    rechazos: number;
    rechazos_porcentaje: number;
    valor_x_dia: number;
    valor_x_dia_por_dia: number;
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


// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCOP(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(amount || 0);
}

function formatDateShort(d: string | null): string {
    if (!d) return '—';
    const [y, m, day] = d.split('-').map(Number);
    const dt = new Date(y, m - 1, day);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Card base ───────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border ${className}`}>
            {children}
        </div>
    );
}

// ─── DateRangePicker con atajos ───────────────────────────────────────────────

interface Atajo { label: string; desde: string; hasta: string; }

function hoy()         { return new Date().toISOString().split('T')[0]; }
function diasAtras(n: number) {
    const d = new Date(); d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
}
function primerDiaMes(offset = 0) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset);
    return d.toISOString().split('T')[0];
}
function ultimoDiaMes(offset = 0) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset + 1); d.setDate(0);
    return d.toISOString().split('T')[0];
}
function lunesDeEstaSemana() {
    const d = new Date();
    const day = d.getDay(); // 0=dom
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
}

const ATAJOS: Atajo[] = [
    { label: 'Hoy',            desde: hoy(),              hasta: hoy()              },
    { label: 'Ayer',           desde: diasAtras(1),       hasta: diasAtras(1)       },
    { label: 'Esta semana',    desde: lunesDeEstaSemana(), hasta: hoy()             },
    { label: 'Últimos 7 días', desde: diasAtras(6),       hasta: hoy()              },
    { label: 'Últimos 15 días',desde: diasAtras(14),      hasta: hoy()              },
    { label: 'Mes actual',     desde: primerDiaMes(),     hasta: hoy()              },
    { label: 'Mes anterior',   desde: primerDiaMes(-1),   hasta: ultimoDiaMes(-1)   },
];

function DateRangePicker({
    desde, hasta,
    onChange,
}: {
    desde: string; hasta: string;
    onChange: (desde: string, hasta: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const labelAtajo = ATAJOS.find(a => a.desde === desde && a.hasta === hasta)?.label ?? null;

    const aplicar = (d: string, h: string) => { onChange(d, h); setOpen(false); };

    // Formato legible del rango
    const labelRango = (() => {
        if (desde === hasta) return formatDateShort(desde);
        return `${formatDateShort(desde)} — ${formatDateShort(hasta)}`;
    })();

    return (
        <div className="grid gap-1" ref={ref}>

            {/* Botón disparador */}
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-2.5 py-1.5 text-left text-sm text-foreground transition hover:border-green-500 hover:bg-green-100 focus:outline-none dark:border-green-700/40 dark:bg-green-900/10"
            >
                <CalendarDays className="size-3.5 shrink-0 text-green-700" />
                <span className="flex-1 truncate">
                    {labelAtajo
                        ? <><span className="font-semibold" style={{ color: '#047857' }}>{labelAtajo}</span> <span className="text-[11px] text-muted-foreground">({labelRango})</span></>
                        : <span className="text-sm text-foreground">{labelRango}</span>
                    }
                </span>
                <ChevronRight className={`size-3.5 shrink-0 text-green-700 transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>

            {/* Panel desplegable */}
            {open && (
                <div className="mt-1 rounded-xl border border-sidebar-border/70 bg-card shadow-lg dark:border-sidebar-border z-30 overflow-hidden">
                    {/* Atajos rápidos */}
                    <div className="flex flex-wrap gap-1.5 p-3 border-b border-sidebar-border/70 dark:border-sidebar-border">
                        {ATAJOS.map(a => {
                            const activo = a.desde === desde && a.hasta === hasta;
                            return (
                                <button
                                    key={a.label}
                                    type="button"
                                    onClick={() => aplicar(a.desde, a.hasta)}
                                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors border ${
                                        activo
                                            ? 'text-white border-transparent'
                                            : 'bg-muted text-muted-foreground border-sidebar-border/70 hover:border-green-400 hover:text-green-700 dark:border-sidebar-border'
                                    }`}
                                    style={activo ? { background: 'linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%)', borderColor: 'transparent' } : {}}
                                >
                                    {a.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Inputs manuales */}
                    <div className="grid grid-cols-2 gap-2 p-3">
                        <div className="grid gap-1">
                            <label className="text-[10px] font-semibold text-muted-foreground">Desde</label>
                            <input
                                type="date"
                                value={desde}
                                max={hasta}
                                onChange={e => onChange(e.target.value, hasta)}
                                className="h-8 w-full rounded-lg border border-sidebar-border/70 bg-muted px-2 text-xs text-foreground focus:outline-none dark:border-sidebar-border dark:bg-muted"
                            />
                        </div>
                        <div className="grid gap-1">
                            <label className="text-[10px] font-semibold text-muted-foreground">Hasta</label>
                            <input
                                type="date"
                                value={hasta}
                                min={desde}
                                max={hoy()}
                                onChange={e => onChange(desde, e.target.value)}
                                className="h-8 w-full rounded-lg border border-sidebar-border/70 bg-muted px-2 text-xs text-foreground focus:outline-none dark:border-sidebar-border dark:bg-muted"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 px-3 pb-3">
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="rounded-lg px-3 py-1 text-xs font-semibold text-white transition hover:brightness-110"
                            style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%)' }}
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Tabla día por día ───────────────────────────────────────────────────────

function TablaDiaria({ registros }: { registros: RegistroDiaSimple[] }) {

    if (registros.length === 0) {
        return (
            <div className="rounded-xl border border-sidebar-border/70 bg-card p-4 text-sm text-muted-foreground dark:border-sidebar-border">
                Sin registros para el período seleccionado.
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border overflow-hidden">
            {/* Header con botón toggle */}
            <div className="flex items-center gap-2.5 border-b border-sidebar-border/70 bg-muted/40 px-4 py-3 dark:border-sidebar-border">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-green-700">
                    <CalendarDays className="size-3.5 text-white" />
                </div>
                <p className="text-sm font-semibold text-foreground">Detalle por día</p>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    {registros.length} {registros.length === 1 ? 'día' : 'días'}
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-sidebar-border/70 bg-muted/30 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:border-sidebar-border">
                            <th className="px-4 py-2">Fecha</th>
                            <th className="px-4 py-2 text-right">Rechazos</th>
                            <th className="px-4 py-2 text-right">Valor del día</th>
                            <th className="px-4 py-2 text-right">Ganado</th>
                            <th className="px-4 py-2 text-right">Perdido</th>
                            <th className="px-4 py-2 text-center">Resultado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {registros.map((r, idx) => {
                            const cal = Number(r.cal_rechazos ?? 0);
                            const es100 = cal >= 1.0;
                            const es80  = cal >= 0.8 && cal < 1.0;

                            const resultadoLabel = es100 ? '100%' : es80 ? '80%' : '0%';
                            const resultadoBg    = es100
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : es80
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';

                            const rechColor = Number(r.rechazos) >= 2.4
                                ? 'text-red-600 dark:text-red-400'
                                : Number(r.rechazos) >= 2.0
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-green-700 dark:text-green-400';

                            const [y, m, d] = r.fecha.split('-').map(Number);
                            const fechaLabel = new Date(y, m - 1, d)
                                .toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

                            return (
                                <tr
                                    key={r.id ?? idx}
                                    className="border-b border-sidebar-border/40 transition-colors hover:bg-muted/30 dark:border-sidebar-border/30"
                                >
                                    <td className="px-4 py-2.5 font-medium text-black dark:text-black">{fechaLabel}</td>
                                    <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${rechColor}`}>
                                        {Number(r.rechazos).toFixed(2)}%
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-black dark:text-black">
                                        {formatCOP(r.valor_x_dia)}
                                    </td>
                                    <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                                        es100
                                            ? 'text-green-700 dark:text-green-400'
                                            : es80
                                            ? 'text-orange-500 dark:text-orange-400'
                                            : 'text-black dark:text-black'
                                    }`}>
                                        {formatCOP(r.valor_var)}
                                    </td>
                                    <td className={`px-4 py-2.5 text-right tabular-nums ${Number(r.valor_perdido) > 0 ? 'text-red-500' : 'text-black dark:text-black'}`}>
                                        {formatCOP(r.valor_perdido)}
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${resultadoBg}`}>
                                            {resultadoLabel}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    {/* Totales */}
                    <tfoot>
                        <tr className="border-t-2 border-sidebar-border/70 bg-muted/40 font-semibold dark:border-sidebar-border">
                            <td className="px-4 py-2.5 text-[11px] text-black dark:text-black" colSpan={2}>
                                Total {registros.length} días
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-black dark:text-black">
                                {formatCOP(registros.reduce((s, r) => s + Number(r.valor_x_dia), 0))}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold tabular-nums text-green-700 dark:text-green-400">
                                {formatCOP(registros.reduce((s, r) => s + Number(r.valor_var), 0))}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-red-500">
                                {formatCOP(registros.reduce((s, r) => s + Number(r.valor_perdido), 0))}
                            </td>
                            <td />
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MiCompensacionIndex() {
    const pageProps = (usePage<Record<string, unknown>>().props || {}) as Record<string, unknown>;
    const colaborador: Colaborador | null      = pageProps.colaborador as Colaborador | null;
    const fechaDesdeProps: string              = (pageProps.fecha_desde as string) ?? new Date().toISOString().slice(0, 7) + '-01';
    const fechaHastaProps: string              = (pageProps.fecha_hasta as string) ?? new Date().toISOString().split('T')[0];
    const registroDia: RegistroDia | null       = pageProps.registro_dia as RegistroDia | null;
    const registros: RegistroDiaSimple[]        = (pageProps.registros as RegistroDiaSimple[]) ?? [];
    const error: string | null = pageProps.error as string | null;

    const [fechaDesde, setFechaDesde] = useState(fechaDesdeProps);
    const [fechaHasta, setFechaHasta] = useState(fechaHastaProps);

    const handleRangeChange = (desde: string, hasta: string) => {
        setFechaDesde(desde);
        setFechaHasta(hasta);
        router.get(
            route('portal.mi-compensacion.index'),
            { fecha_desde: desde, fecha_hasta: hasta },
            { preserveState: true, preserveScroll: true },
        );
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

    const _rechPct = registroDia?.rechazos_porcentaje ?? 0;
    // cumpleMeta2: rechazos < 2.0% → gana 100%
    // cumpleMeta1: rechazos < 2.4% → gana 80%
    const pctNum      = registroDia ? parseFloat(registroDia.porcentaje_variable) : 0;
    const cumpleTotal = pctNum >= 100;

    const CIRCUM = 276.46;
    const dash   = Math.min((pctNum / 100) * CIRCUM, CIRCUM);

    return (
        <AppLayout breadcrumbs={[
            { title: 'Portal', href: '/portal' },
            { title: 'Mi Compensación', href: '/portal/mi-compensacion' },
        ]}>
            <Head title="Mi Compensación Diaria" />
            <div className="flex flex-col gap-4 px-4 pb-10 pt-6 sm:px-6">

                {/* ══ CARD 1 — HERO ══ */}
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
                                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-tight">Mi Compensación Diaria</h1>
                                <p className="truncate text-xs font-semibold text-green-700 dark:text-green-400">
                                    {colaborador.nombre_completo} · CC {colaborador.cedula}
                                </p>
                                <p className="text-[11px] text-muted-foreground">{colaborador.cargo}</p>
                            </div>
                        </div>

                        {/* Centro decorativo */}
                        <div className="mx-4 hidden flex-1 items-center justify-center sm:flex"
                            style={{ minHeight: '80px', background: 'radial-gradient(circle at 50% 60%, #bbf7d0 0%, #f0fdf4 55%, transparent 90%)', borderRadius: '0.75rem' }}>
                            <TrendingUp className="size-12 text-green-200 dark:text-green-900" />
                        </div>

                        {/* Círculo % */}
                        {registroDia ? (
                            <div className="flex items-center gap-2 sm:shrink-0">
                                <div className="relative shrink-0">
                                    <svg width="56" height="56" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="44" fill="none" stroke="#bbf7d0" strokeWidth="9" />
                                        <circle cx="50" cy="50" r="44" fill="none" stroke="#15803d" strokeWidth="9"
                                            strokeLinecap="round" strokeDasharray={`${dash} ${CIRCUM}`} transform="rotate(-90 50 50)" />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-sm font-extrabold leading-none text-green-700 dark:text-green-400">{pctNum}%</span>
                                        <span className="text-[8px] font-medium text-muted-foreground">variable</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-foreground">
                                        {cumpleTotal ? '¡Excelente!' : pctNum >= 80 ? '¡Bien!' : 'Mejora aquí'}
                                    </p>
                                    <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                                        {cumpleTotal ? 'Cumpliste el 100%.'
                                            : pctNum >= 80 ? 'Meta principal cumplida.'
                                            : 'Reduce tus rechazos.'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground sm:shrink-0">Selecciona un período</p>
                        )}
                    </div>
                </Card>

                {/* ══ CARD FILTRO PERÍODO ══ */}
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <CalendarDays className="size-4 shrink-0 text-green-700" />
                        <span className="text-sm font-semibold text-foreground">Filtros de período</span>
                    </div>
                    <div className="mt-3">
                        <DateRangePicker
                            desde={fechaDesde}
                            hasta={fechaHasta}
                            onChange={handleRangeChange}
                        />
                    </div>
                </Card>

                {/* ══ Sin datos del día ══ */}
                {!registroDia ? (
                    <Card className="flex flex-col items-center gap-2 p-8 text-center">
                        <Info className="size-5 text-muted-foreground" />
                        <p className="text-sm font-medium text-foreground">
                            Sin información para {fechaDesde === fechaHasta ? formatDateShort(fechaDesde) : `${formatDateShort(fechaDesde)} — ${formatDateShort(fechaHasta)}`}
                        </p>
                        <p className="text-xs text-muted-foreground">Selecciona otro período o espera a que se cargue la información.</p>
                    </Card>
                ) : (
                    <>
                        {/* ══ CARD CARGO + VALOR DEL DÍA  +  CARD RESULTADO ══ */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                            {/* Card valor del día */}
                            <Card className="p-4">
                                <div className="flex flex-col gap-1">
                                    <p className="text-[11px] text-muted-foreground">
                                        Tu valor del día es:
                                    </p>
                                    <p className="text-4xl font-extrabold tabular-nums text-black dark:text-black">
                                        {formatCOP(registroDia.valor_x_dia_por_dia)}
                                    </p>
                                </div>
                            </Card>

                            {/* Card resultado: usa cal_rechazos = valor_var / valor_x_dia del rango */}
                            {(() => {
                                const cal = Number(registroDia.cal_rechazos ?? 0);
                                const rechPct = Number(registroDia.rechazos_porcentaje ?? 0).toFixed(2);
                                if (cal >= 1.0) {
                                    return (
                                        <div className="flex flex-col gap-2 rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm dark:border-green-700/40 dark:bg-green-900/10">
                                            <div className="flex items-center gap-2">
                                                <CircleDollarSign className="size-5 shrink-0 text-green-600" />
                                                <p className="text-sm font-bold text-black dark:text-black">
                                                    ¡Felicitaciones, ganaste el 100%!
                                                </p>
                                            </div>
                                            <p className="text-4xl font-extrabold tabular-nums text-black dark:text-black">
                                                {formatCOP(registroDia.valor_var)}
                                            </p>
                                            <p className="text-[11px] text-black dark:text-black">
                                                Tu rechazo es de{' '}
                                                <span className="font-semibold">{rechPct}%</span>
                                            </p>
                                        </div>
                                    );
                                } else if (cal >= 0.8) {
                                    return (
                                        <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-700/40 dark:bg-amber-900/10">
                                            <div className="flex items-center gap-2">
                                                <CircleDollarSign className="size-5 shrink-0 text-amber-500" />
                                                <p className="text-sm font-bold text-black dark:text-black">
                                                    Ganaste el 80%
                                                </p>
                                            </div>
                                            <p className="text-4xl font-extrabold tabular-nums text-amber-700 dark:text-amber-400">
                                                {formatCOP(registroDia.valor_var)}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                <p className="text-[11px] text-black dark:text-black">
                                                    Tu rechazo es de{' '}
                                                    <span className="font-semibold">{rechPct}%</span>
                                                </p>
                                                <p className="text-[11px] text-black dark:text-black">
                                                    Dejaste de ganar:{' '}
                                                    <span className="font-semibold text-red-500">
                                                        {formatCOP(registroDia.valor_perdido)}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm dark:border-red-700/40 dark:bg-red-900/10">
                                            <div className="flex items-center gap-2">
                                                <CircleDollarSign className="size-5 shrink-0 text-red-500" />
                                                <p className="text-sm font-bold text-black dark:text-black">
                                                    Hoy aprendemos, mañana alcanzamos nuevos logros.
                                                </p>
                                            </div>
                                            <p className="text-4xl font-extrabold tabular-nums text-red-600 dark:text-red-400">
                                                {formatCOP(0)}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                <p className="text-[11px] text-black dark:text-black">
                                                    Tu rechazo es de{' '}
                                                    <span className="font-semibold">{rechPct}%</span>
                                                </p>
                                                <p className="text-[11px] text-black dark:text-black">
                                                    Dejaste de ganar:{' '}
                                                    <span className="font-semibold text-red-500">
                                                        {formatCOP(registroDia.valor_perdido)}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                    );
                                }
                            })()}
                        </div>

                        {/* ══ TABLA DÍA POR DÍA ══ */}
                        <TablaDiaria registros={registros} />

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
