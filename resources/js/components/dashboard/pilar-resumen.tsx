import { CountUp } from '@/components/count-up';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { findModule, flattenSubmodules, submoduleHref } from '@/data/modules';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export type Tone = 'default' | 'good' | 'warn' | 'bad';

export interface PilarKpi {
    label: string;
    value: number | string;
    suffix?: string;
    decimals?: number;
    hint?: string;
    tone?: Tone;
}

export interface PilarPendiente {
    label: string;
    value: number;
    href: string;
    tone?: Tone;
}

export interface PilarSerie {
    key: string;
    label: string;
    color: string;
}

export interface PilarResumenData {
    titulo: string;
    href: string;
    kpis: PilarKpi[];
    tendencia: Array<{ periodo: string; [k: string]: string | number }>;
    tendencia_titulo: string;
    tendencia_series: PilarSerie[];
    pendientes: PilarPendiente[];
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function periodoLabel(periodo: string): string {
    const [anio, mes] = periodo.split('-').map(Number);
    return `${MESES[mes - 1]} ${String(anio).slice(2)}`;
}

const TONE_TEXT: Record<Tone, string> = {
    default: 'text-foreground',
    good: 'text-[#3F7A22]',
    warn: 'text-[#B45309]',
    bad: 'text-[#D4102A]',
};

function MetricCard({ kpi }: { kpi: PilarKpi }) {
    const tone = kpi.tone ?? 'default';
    return (
        <Card className="border-sidebar-border/70 dark:border-sidebar-border">
            <CardHeader className="space-y-0 pb-1.5">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
            </CardHeader>
            <CardContent>
                <p className={cn('text-2xl font-semibold tracking-tight', TONE_TEXT[tone])}>
                    {typeof kpi.value === 'number' ? (
                        <CountUp end={kpi.value} decimals={kpi.decimals} suffix={kpi.suffix} />
                    ) : (
                        kpi.value
                    )}
                </p>
                {kpi.hint && <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>}
            </CardContent>
        </Card>
    );
}

function TendenciaChart({ data, series, titulo }: { data: PilarResumenData['tendencia']; series: PilarSerie[]; titulo: string }) {
    const datos: Array<Record<string, string | number>> = data.map((d) => ({ ...d, etiqueta: periodoLabel(d.periodo) }));
    const vacio = datos.every((d) => series.every((s) => Number(d[s.key] ?? 0) === 0));

    return (
        <Card className="border-sidebar-border/70 dark:border-sidebar-border">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
            </CardHeader>
            <CardContent>
                {vacio ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">Sin datos en el rango.</p>
                ) : (
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={datos} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                            <defs>
                                {series.map((s) => (
                                    <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={s.color} stopOpacity={0.25} />
                                        <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                                    </linearGradient>
                                ))}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={32} />
                            <Tooltip />
                            {series.map((s) => (
                                <Area
                                    key={s.key}
                                    type="monotone"
                                    dataKey={s.key}
                                    name={s.label}
                                    stroke={s.color}
                                    fill={`url(#grad-${s.key})`}
                                    strokeWidth={2}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}

function Pendientes({ pendientes }: { pendientes: PilarPendiente[] }) {
    return (
        <Card className="border-sidebar-border/70 dark:border-sidebar-border">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Requiere atención</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1">
                {pendientes.map((p) => {
                    const tone = p.value === 0 ? 'good' : (p.tone ?? 'warn');
                    return (
                        <Link
                            key={p.label}
                            href={p.href}
                            className="group flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
                        >
                            <span className="flex items-center gap-2 text-foreground">
                                {p.value === 0 && <CheckCircle2 className="size-3.5 text-[#3F7A22]" />}
                                {p.label}
                            </span>
                            <span className={cn('shrink-0 font-semibold tabular-nums', TONE_TEXT[tone])}>{p.value}</span>
                        </Link>
                    );
                })}
            </CardContent>
        </Card>
    );
}

export function PilarResumen({ slug, data }: { slug: string; data: PilarResumenData }) {
    const mod = findModule(slug);
    const accent = mod?.accent ?? '#3F7A22';
    const Icon = mod?.icon;
    const accesos = mod ? flattenSubmodules(mod.submodules).slice(0, 8) : [];

    return (
        <section className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    {Icon && (
                        <div className="flex size-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${accent}1a`, color: accent }}>
                            <Icon className="size-5" />
                        </div>
                    )}
                    <h2 className="text-lg font-semibold tracking-tight">{data.titulo}</h2>
                </div>
                <Link
                    href={data.href}
                    className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                    Abrir módulo
                    <ArrowRight className="size-3.5" />
                </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {data.kpis.map((kpi) => (
                    <MetricCard key={kpi.label} kpi={kpi} />
                ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <TendenciaChart data={data.tendencia} series={data.tendencia_series} titulo={data.tendencia_titulo} />
                <Pendientes pendientes={data.pendientes} />
            </div>

            {accesos.length > 0 && mod && (
                <div className="flex flex-wrap gap-2">
                    {accesos.map((sub) => (
                        <Link
                            key={sub.slug ?? sub.title}
                            href={submoduleHref(mod, sub)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-sidebar-border/70 bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground dark:border-sidebar-border"
                        >
                            <sub.icon className="size-3.5" style={{ color: accent }} />
                            {sub.title}
                        </Link>
                    ))}
                </div>
            )}
        </section>
    );
}
