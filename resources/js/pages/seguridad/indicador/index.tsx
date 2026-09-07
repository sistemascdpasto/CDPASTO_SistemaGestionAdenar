import HeadingSmall from '@/components/heading-small';
import { KpiCard, KpiCardGrid } from '@/components/kpi-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    Activity,
    AlertTriangle,
    BarChart3,
    BellRing,
    CalendarClock,
    ClipboardCheck,
    ClipboardList,
    HeartPulse,
    ShieldCheck,
    Stethoscope,
    TestTube,
    Wine,
} from 'lucide-react';
import { useState, type ComponentType } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'Tablero de Indicadores', href: '/modules/seguridad/indicador' },
];

const PALETA = ['#3F7A22', '#0369A1', '#B45309', '#7C3AED', '#DB2777', '#0891B2', '#65A30D', '#DC2626'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function periodoLabel(periodo: string): string {
    const [anio, mes] = periodo.split('-').map(Number);
    return `${MESES[mes - 1]} ${String(anio).slice(2)}`;
}

interface Breakdown {
    label: string;
    total: number;
}
interface SerieMes {
    periodo: string;
    total: number;
    [k: string]: string | number;
}

interface Data {
    rango: { desde: string; hasta: string };
    alcoholimetria: {
        total_pruebas: number;
        realizadas: number;
        programadas: number;
        positivas: number;
        pct_positivas: number;
        por_tipo: { tipo: string; total: number }[];
        serie_mensual: SerieMes[];
        dispositivos_por_estado: Breakdown[];
        dispositivos_total: number;
        calibraciones_por_vencer: number;
    };
    acis: {
        total: number;
        serie_mensual: SerieMes[];
        por_area: Breakdown[];
        por_clasificacion: Breakdown[];
        por_estatus: Breakdown[];
        por_tipo_reporte: Breakdown[];
    };
    owd: {
        evaluaciones: number;
        preguntas_ok: number;
        preguntas_no_ok: number;
        pct_cumplimiento: number;
        serie_mensual: SerieMes[];
        por_pilar: Breakdown[];
        planes_accion_total: number;
        planes_accion_abiertos: number;
        planes_accion_vencidos: number;
    };
    examenes_medicos: {
        total: number;
        por_concepto: { label: string; total: number }[];
        proximos_a_vencer: number;
        recomendaciones_activas: number;
        recomendaciones_pendientes: number;
    };
    condiciones_salud: {
        total: number;
        con_novedad: number;
        pct_con_novedad: number;
        por_estado: { label: string; total: number }[];
        serie_mensual: SerieMes[];
    };
    morbilidad: {
        total: number;
        completadas: number;
        borradores: number;
        serie_mensual: SerieMes[];
    };
    alertas: {
        total: number;
        abiertas: number;
        atendidas: number;
        por_tipo: { label: string; total: number }[];
    };
}

function Seccion({ titulo, icon: Icon, accent, children }: { titulo: string; icon: ComponentType<{ className?: string }>; accent: string; children: React.ReactNode }) {
    return (
        <section className="grid gap-4">
            <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${accent}1a`, color: accent }}>
                    <Icon className="size-4" />
                </div>
                <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
            </div>
            {children}
        </section>
    );
}

function ChartCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
    return (
        <Card className="border-sidebar-border/70 dark:border-sidebar-border">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}

function SerieMensualChart({ data, extraKey, extraLabel, color = '#3F7A22' }: { data: SerieMes[]; extraKey?: string; extraLabel?: string; color?: string }) {
    const datos = data.map((d) => ({ ...d, etiqueta: periodoLabel(d.periodo) }));
    if (datos.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Sin datos en el rango.</p>;
    return (
        <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={datos} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="total" name="Total" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} />
                {extraKey && (
                    <Area type="monotone" dataKey={extraKey} name={extraLabel ?? extraKey} stroke="#DC2626" fill="#DC2626" fillOpacity={0.12} strokeWidth={2} />
                )}
            </AreaChart>
        </ResponsiveContainer>
    );
}

function BreakdownChart({ data, colorByIndex = false, color = '#0369A1' }: { data: Breakdown[]; colorByIndex?: boolean; color?: string }) {
    if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Sin datos en el rango.</p>;
    return (
        <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34)}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={140} />
                <Tooltip />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {data.map((_, i) => (
                        <Cell key={i} fill={colorByIndex ? PALETA[i % PALETA.length] : color} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

export default function IndicadorIndex({ data, filtros }: { data: Data; filtros: { desde: string; hasta: string } }) {
    const [desde, setDesde] = useState(filtros.desde);
    const [hasta, setHasta] = useState(filtros.hasta);

    const aplicar = () => router.get(route('seguridad.indicador.index'), { desde, hasta }, { preserveState: true, replace: true });

    const a = data.alcoholimetria;
    const c = data.acis;
    const o = data.owd;
    const e = data.examenes_medicos;
    const s = data.condiciones_salud;
    const m = data.morbilidad;
    const al = data.alertas;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tablero de Indicadores — Seguridad" />
            <div className="flex h-full flex-1 flex-col gap-8 rounded-xl p-4">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <HeadingSmall
                        title="Tablero de Indicadores"
                        description="KPIs, tendencias y análisis de todos los módulos del pilar de Seguridad."
                    />
                    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-muted/30 p-2.5">
                        <div className="grid gap-1">
                            <Label htmlFor="desde" className="text-xs">
                                Desde
                            </Label>
                            <Input id="desde" type="date" value={desde} onChange={(ev) => setDesde(ev.target.value)} className="h-9 w-40" />
                        </div>
                        <div className="grid gap-1">
                            <Label htmlFor="hasta" className="text-xs">
                                Hasta
                            </Label>
                            <Input id="hasta" type="date" value={hasta} onChange={(ev) => setHasta(ev.target.value)} className="h-9 w-40" />
                        </div>
                        <Button type="button" size="sm" variant="secondary" onClick={aplicar}>
                            Aplicar
                        </Button>
                    </div>
                </div>

                {/* ── Alcoholimetría ─────────────────────────────────────────── */}
                <Seccion titulo="Alcoholimetría" icon={Wine} accent="#3F7A22">
                    <KpiCardGrid className="sm:grid-cols-2 lg:grid-cols-4">
                        <KpiCard label="Pruebas realizadas" value={a.realizadas} icon={TestTube} color="#3F7A22" />
                        <KpiCard label="Pruebas positivas" value={a.positivas} icon={AlertTriangle} color="#D4102A" secondaryText={`${a.pct_positivas}% de las realizadas`} />
                        <KpiCard label="Pruebas programadas" value={a.programadas} icon={CalendarClock} color="#0369A1" />
                        <KpiCard label="Dispositivos por calibrar" value={a.calibraciones_por_vencer} icon={AlertTriangle} color="#E3A11E" secondaryText={`${a.dispositivos_total} dispositivos en total`} />
                    </KpiCardGrid>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <ChartCard titulo="Pruebas por mes (y positivas)">
                            <SerieMensualChart data={a.serie_mensual} extraKey="positivas" extraLabel="Positivas" />
                        </ChartCard>
                        <ChartCard titulo="Realizadas por tipo">
                            <BreakdownChart data={a.por_tipo.map((t) => ({ label: t.tipo, total: t.total }))} colorByIndex />
                        </ChartCard>
                        <ChartCard titulo="Dispositivos por estado">
                            <BreakdownChart data={a.dispositivos_por_estado} colorByIndex />
                        </ChartCard>
                    </div>
                </Seccion>

                {/* ── ACIS ──────────────────────────────────────────────────── */}
                <Seccion titulo="ACIS — Actos y Condiciones Inseguras" icon={ShieldCheck} accent="#0369A1">
                    <KpiCardGrid className="sm:grid-cols-2 lg:grid-cols-4">
                        <KpiCard label="Reportes ACI" value={c.total} icon={ClipboardList} color="#0369A1" />
                        <KpiCard label="Pendientes de asignar" value={c.por_estatus.find((x) => x.label === 'Pendiente')?.total ?? 0} icon={AlertTriangle} color="#E3A11E" />
                        <KpiCard label="Asignados" value={c.por_estatus.find((x) => x.label === 'Asignado')?.total ?? 0} icon={Activity} color="#B45309" />
                        <KpiCard label="Cerrados" value={c.por_estatus.find((x) => x.label === 'Cerrado')?.total ?? 0} icon={ClipboardCheck} color="#3F7A22" />
                    </KpiCardGrid>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <ChartCard titulo="Reportes por mes">
                            <SerieMensualChart data={c.serie_mensual} color="#0369A1" />
                        </ChartCard>
                        <ChartCard titulo="Por clasificación de riesgo">
                            <BreakdownChart data={c.por_clasificacion} colorByIndex />
                        </ChartCard>
                        <ChartCard titulo="Por área">
                            <BreakdownChart data={c.por_area} color="#B45309" />
                        </ChartCard>
                        <ChartCard titulo="Por tipo de reporte">
                            <BreakdownChart data={c.por_tipo_reporte} colorByIndex />
                        </ChartCard>
                    </div>
                </Seccion>

                {/* ── Evaluaciones OWD ──────────────────────────────────────── */}
                <Seccion titulo="Evaluaciones OWD" icon={ClipboardCheck} accent="#B45309">
                    <KpiCardGrid className="sm:grid-cols-2 lg:grid-cols-4">
                        <KpiCard label="Evaluaciones" value={o.evaluaciones} icon={ClipboardList} color="#B45309" />
                        <KpiCard label="% Cumplimiento" value={o.pct_cumplimiento} suffix="%" decimals={1} icon={Activity} color="#3F7A22" secondaryText={`${o.preguntas_ok} OK / ${o.preguntas_no_ok} no conformes`} />
                        <KpiCard label="Planes de acción abiertos" value={o.planes_accion_abiertos} icon={ClipboardList} color="#0369A1" secondaryText={`${o.planes_accion_total} en total`} />
                        <KpiCard label="Planes de acción vencidos" value={o.planes_accion_vencidos} icon={AlertTriangle} color="#D4102A" />
                    </KpiCardGrid>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <ChartCard titulo="Evaluaciones por mes (y no conformidades)">
                            <SerieMensualChart data={o.serie_mensual} extraKey="no_conformes" extraLabel="No conformes" color="#B45309" />
                        </ChartCard>
                        <ChartCard titulo="Evaluaciones por pilar">
                            <BreakdownChart data={o.por_pilar} colorByIndex />
                        </ChartCard>
                    </div>
                </Seccion>

                {/* ── Exámenes Médicos ──────────────────────────────────────── */}
                <Seccion titulo="Exámenes Médicos Ocupacionales" icon={Stethoscope} accent="#7C3AED">
                    <KpiCardGrid className="sm:grid-cols-2 lg:grid-cols-4">
                        <KpiCard label="Evaluaciones en el rango" value={e.total} icon={Stethoscope} color="#7C3AED" />
                        <KpiCard label="Próximos a vencer" value={e.proximos_a_vencer} icon={CalendarClock} color="#E3A11E" secondaryText="En los próximos 30 días" />
                        <KpiCard label="Recomendaciones activas" value={e.recomendaciones_activas} icon={ClipboardList} color="#0369A1" />
                        <KpiCard label="Recomendaciones pendientes" value={e.recomendaciones_pendientes} icon={AlertTriangle} color="#D4102A" />
                    </KpiCardGrid>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <ChartCard titulo="Por concepto de aptitud">
                            <BreakdownChart data={e.por_concepto} colorByIndex />
                        </ChartCard>
                    </div>
                </Seccion>

                {/* ── Condiciones de Salud ──────────────────────────────────── */}
                <Seccion titulo="Condiciones de Salud" icon={HeartPulse} accent="#DB2777">
                    <KpiCardGrid className="sm:grid-cols-2 lg:grid-cols-3">
                        <KpiCard label="Registros" value={s.total} icon={HeartPulse} color="#DB2777" />
                        <KpiCard label="Con novedad" value={s.con_novedad} icon={AlertTriangle} color="#D4102A" secondaryText={`${s.pct_con_novedad}% del total`} />
                        <KpiCard label="Estado 'Malo'" value={s.por_estado.find((x) => x.label === 'Malo')?.total ?? 0} icon={AlertTriangle} color="#991B1B" />
                    </KpiCardGrid>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <ChartCard titulo="Registros por mes (y con novedad)">
                            <SerieMensualChart data={s.serie_mensual} extraKey="con_novedad" extraLabel="Con novedad" color="#DB2777" />
                        </ChartCard>
                        <ChartCard titulo="Por estado reportado">
                            <BreakdownChart data={s.por_estado} colorByIndex />
                        </ChartCard>
                    </div>
                </Seccion>

                {/* ── Encuestas de Morbilidad ───────────────────────────────── */}
                <Seccion titulo="Encuestas de Morbilidad" icon={ClipboardList} accent="#0891B2">
                    <KpiCardGrid className="sm:grid-cols-3">
                        <KpiCard label="Encuestas iniciadas" value={m.total} icon={ClipboardList} color="#0891B2" />
                        <KpiCard label="Completadas" value={m.completadas} icon={ClipboardCheck} color="#3F7A22" />
                        <KpiCard label="En borrador" value={m.borradores} icon={ClipboardList} color="#E3A11E" />
                    </KpiCardGrid>
                    <ChartCard titulo="Encuestas iniciadas por mes">
                        <SerieMensualChart data={m.serie_mensual} color="#0891B2" />
                    </ChartCard>
                </Seccion>

                {/* ── Alertas ───────────────────────────────────────────────── */}
                <Seccion titulo="Alertas del pilar de Seguridad" icon={BellRing} accent="#D4102A">
                    <KpiCardGrid className="sm:grid-cols-3">
                        <KpiCard label="Alertas generadas" value={al.total} icon={BellRing} color="#D4102A" />
                        <KpiCard label="Abiertas" value={al.abiertas} icon={AlertTriangle} color="#E3A11E" />
                        <KpiCard label="Atendidas" value={al.atendidas} icon={ClipboardCheck} color="#3F7A22" />
                    </KpiCardGrid>
                    <ChartCard titulo="Alertas por tipo">
                        <BreakdownChart data={al.por_tipo} colorByIndex />
                    </ChartCard>
                </Seccion>

                <p className="pb-4 text-center text-xs text-muted-foreground">
                    Rango analizado: {data.rango.desde} — {data.rango.hasta} · <BarChart3 className="inline size-3" /> Los indicadores de vencimientos
                    (dispositivos, exámenes, planes de acción) se calculan a la fecha de hoy.
                </p>
            </div>
        </AppLayout>
    );
}
