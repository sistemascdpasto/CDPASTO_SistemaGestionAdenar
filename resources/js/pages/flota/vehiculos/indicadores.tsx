import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Clock, Percent, Timer, Truck } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Flota', href: '/modules/flota' },
    { title: 'Documentación', href: '/modules/flota/vehiculos' },
    { title: 'Indicadores de Disponibilidad', href: '/modules/flota/vehiculos/indicadores' },
];

const COLORS = { disponible: '#15803d', no_disponible: '#dc2626' };

function KpiCard({ label, value, sub, icon: Icon, color }: {
    label: string; value: string | number; sub?: string; icon: React.ElementType; color: string;
}) {
    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border p-4 flex flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-semibold text-muted-foreground">{label}</p>
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="size-3.5" style={{ color }} />
                </div>
            </div>
            <p className="text-3xl font-extrabold tabular-nums leading-none" style={{ color }}>{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground leading-snug">{sub}</p>}
        </div>
    );
}

interface Kpis {
    total_vehiculos: number;
    disponibles: number;
    no_disponibles: number;
    pct_disponibilidad: number;
    cambios_periodo: number;
    tiempo_promedio_no_disponible: number | null;
}

interface CambioMes {
    mes: string;
    disponible: number;
    no_disponible: number;
}

interface RankingItem {
    placa: string;
    total: number;
}

interface NovedadReciente {
    placa: string;
    novedad: string;
    fecha: string;
    usuario: string | null;
}

export default function VehiculosIndicadores({ kpis, cambios_por_mes, ranking_incidentes, novedades_recientes, filters }: {
    kpis: Kpis;
    cambios_por_mes: CambioMes[];
    ranking_incidentes: RankingItem[];
    novedades_recientes: NovedadReciente[];
    filters: { desde: string; hasta: string };
}) {
    const [desde, setDesde] = useState(filters.desde);
    const [hasta, setHasta] = useState(filters.hasta);

    const aplicar = () => router.get(route('flota.vehiculos.indicadores'), { desde, hasta }, { preserveState: true });

    const disponibilidadPie = [
        { name: 'Disponibles', value: kpis.disponibles, color: COLORS.disponible },
        { name: 'No disponibles', value: kpis.no_disponibles, color: COLORS.no_disponible },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Indicadores de Disponibilidad — Flota" />
            <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6">

                {/* Título */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <HeadingSmall title="Indicadores de Disponibilidad" description="Estado actual y tendencia de la disponibilidad de la flota." />
                    </div>
                    <Button variant="outline" size="sm" asChild className="gap-1.5">
                        <Link href={route('flota.vehiculos.index')}>
                            <ArrowLeft className="size-4" /> Documentación
                        </Link>
                    </Button>
                </div>

                {/* Filtro de fechas */}
                <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border px-4 py-3">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Desde</Label>
                            <Input type="date" value={desde} className="h-8 text-xs w-36" onChange={e => setDesde(e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Hasta</Label>
                            <Input type="date" value={hasta} className="h-8 text-xs w-36" onChange={e => setHasta(e.target.value)} />
                        </div>
                        <Button size="sm" onClick={aplicar} className="h-8 bg-green-700 hover:bg-green-800 text-white">
                            Aplicar
                        </Button>
                    </div>
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <KpiCard label="Total flota"        value={kpis.total_vehiculos} sub="Vehículos registrados" icon={Truck} color="#0891b2" />
                    <KpiCard label="Disponibles ahora"  value={kpis.disponibles}     sub="En servicio"           icon={CheckCircle2} color="#15803d" />
                    <KpiCard label="No disponibles"     value={kpis.no_disponibles}  sub="Fuera de servicio"     icon={AlertTriangle} color={kpis.no_disponibles > 0 ? '#dc2626' : '#15803d'} />
                    <KpiCard label="% Disponibilidad"   value={`${kpis.pct_disponibilidad}%`} sub="Snapshot actual" icon={Percent} color={kpis.pct_disponibilidad >= 90 ? '#15803d' : '#d97706'} />
                    <KpiCard label="Cambios de estado"  value={kpis.cambios_periodo} sub="En el período"          icon={CalendarDays} color="#0891b2" />
                    <KpiCard label="Días prom. sin servicio" value={kpis.tiempo_promedio_no_disponible ?? '—'} sub="Por incidente" icon={Timer} color="#d97706" />
                </div>

                {/* Gráficas */}
                <div className="grid gap-5 lg:grid-cols-2">

                    {/* Cambios por mes */}
                    <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border p-5">
                        <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-foreground"><CalendarDays className="size-4" /> Cambios de disponibilidad por mes</p>
                        {cambios_por_mes.length > 0 ? (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={cambios_por_mes} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                    <Bar dataKey="no_disponible" stackId="a" fill={COLORS.no_disponible} radius={[0, 0, 0, 0]} name="Marcados no disponibles" />
                                    <Bar dataKey="disponible" stackId="a" fill={COLORS.disponible} radius={[4, 4, 0, 0]} name="Vueltos a disponible" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <p className="text-sm text-center text-muted-foreground py-8">Sin datos</p>}
                    </div>

                    {/* Disponibilidad actual */}
                    <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border p-5">
                        <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-foreground"><Percent className="size-4" /> Disponibilidad actual de la flota</p>
                        {kpis.total_vehiculos > 0 ? (
                            <div className="flex items-center gap-4">
                                <ResponsiveContainer width="50%" height={200}>
                                    <PieChart>
                                        <Pie data={disponibilidadPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                                            {disponibilidadPie.map((item, i) => <Cell key={i} fill={item.color} />)}
                                        </Pie>
                                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: any, n: any) => [`${v}`, n]} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex-1 space-y-1.5">
                                    {disponibilidadPie.map((item, i) => (
                                        <div key={i} className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <div className="size-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                                                <p className="text-[11px] text-muted-foreground">{item.name}</p>
                                            </div>
                                            <p className="text-[11px] font-bold text-foreground">{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : <p className="text-sm text-center text-muted-foreground py-8">Sin datos</p>}
                    </div>
                </div>

                {/* Ranking de incidentes */}
                {ranking_incidentes.length > 0 && (
                    <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border p-5">
                        <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-foreground"><AlertTriangle className="size-4" /> Vehículos con más incidentes de no disponibilidad</p>
                        <ResponsiveContainer width="100%" height={Math.max(160, ranking_incidentes.length * 40)}>
                            <BarChart data={ranking_incidentes} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                                <YAxis type="category" dataKey="placa" tick={{ fontSize: 11, fill: '#6b7280' }} width={70} />
                                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                <Bar dataKey="total" fill={COLORS.no_disponible} radius={[0, 4, 4, 0]} name="Incidentes" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Novedades recientes */}
                {novedades_recientes.length > 0 && (
                    <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border overflow-hidden">
                        <div className="border-b border-sidebar-border/70 px-5 py-3 dark:border-sidebar-border">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Clock className="size-4" /> Novedades recientes de no disponibilidad</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-sidebar-border/70 bg-muted dark:border-sidebar-border dark:bg-muted">
                                        <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-green-700 dark:text-green-400">Placa</th>
                                        <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-green-700 dark:text-green-400">Novedad</th>
                                        <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-green-700 dark:text-green-400">Fecha</th>
                                        <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-green-700 dark:text-green-400">Registrado por</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {novedades_recientes.map((n, i) => (
                                        <tr key={i}>
                                            <td className="px-5 py-2 font-mono font-bold text-green-700 dark:text-green-400">{n.placa}</td>
                                            <td className="px-5 py-2 text-foreground max-w-xs truncate" title={n.novedad}>{n.novedad}</td>
                                            <td className="px-5 py-2 text-xs text-muted-foreground whitespace-nowrap">{n.fecha}</td>
                                            <td className="px-5 py-2 text-xs text-muted-foreground">{n.usuario ?? '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
