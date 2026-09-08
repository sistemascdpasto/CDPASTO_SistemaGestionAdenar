import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle, BarChart3, CalendarDays, CheckCircle2, Clock,
    ClipboardList, Plus, Timer, Truck, Trophy, Wrench, XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Flota', href: '/modules/flota' },
    { title: 'Actas de Taller', href: '/modules/flota/actas-taller' },
    { title: 'Dashboard', href: '/modules/flota/actas-taller/dashboard' },
];

const COLORS = ['#15803d', '#0891b2', '#d97706', '#dc2626', '#7c3aed', '#db2777'];

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

export default function ActasTallerDashboard({ kpis, novedades_por_mes, novedades_por_tipo, vehiculos_mas_novedades, filters }: {
    kpis: any; novedades_por_mes: any[]; novedades_por_tipo: any[]; vehiculos_mas_novedades: any[];
    filters: { desde: string; hasta: string };
}) {
    const [desde, setDesde] = useState(filters.desde);
    const [hasta, setHasta] = useState(filters.hasta);

    const aplicar = () => router.get(route('flota.actas-taller.dashboard'), { desde, hasta }, { preserveState: true });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard — Actas de Taller" />
            <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6">

                {/* Título */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                            Dashboard — Novedades a Taller
                        </h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Resumen e indicadores de gestión
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild className="gap-1.5">
                            <Link href={route('flota.actas-taller.index')}>
                                <ClipboardList className="size-4" /> Actas
                            </Link>
                        </Button>
                        <Button size="sm" asChild className="gap-1.5 bg-green-700 hover:bg-green-800 text-white">
                            <Link href={route('flota.actas-taller.create')}>
                                <Plus className="size-4" /> Nueva Acta
                            </Link>
                        </Button>
                    </div>
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

                {/* KPI cards — 2 cols móvil / 3 tablet / 6 desktop */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <KpiCard label="Vehículos a taller" value={kpis.vehiculos_enviados} sub="Este período" icon={Truck} color="#15803d" />
                    <KpiCard label="Actas creadas"      value={kpis.actas_creadas}      sub="Este período" icon={ClipboardList} color="#0891b2" />
                    <KpiCard label="Novedades"           value={kpis.total_novedades}    sub="Reportadas"   icon={AlertTriangle} color="#d97706" />
                    <KpiCard label="Solucionadas"        value={kpis.solucionadas}       sub="Este período" icon={CheckCircle2} color="#15803d" />
                    <KpiCard label="Pendientes"          value={kpis.pendientes}         sub="Sin resolver" icon={XCircle}      color={kpis.pendientes > 0 ? '#dc2626' : '#15803d'} />
                    <KpiCard label="% Cumplimiento"      value={`${kpis.pct_cumplimiento}%`} sub={`${kpis.solucionadas} de ${kpis.total_novedades} solucionadas`} icon={BarChart3} color={kpis.pct_cumplimiento >= 80 ? '#15803d' : '#d97706'} />
                </div>

                {/* Segunda fila de KPIs */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <KpiCard label="Tiempo prom. solución" value={`${kpis.tiempo_promedio} días`} sub="Rápido: 0–2 días"     icon={Timer}  color="#15803d" />
                    <KpiCard label="Actas cerradas"        value={kpis.actas_cerradas}             sub={`${kpis.actas_creadas} creadas`} icon={CheckCircle2} color="#0891b2" />
                    <KpiCard label="Novedades vencidas"    value={kpis.vencidas}                   sub="Requieren atención"  icon={Clock}  color={kpis.vencidas > 0 ? '#dc2626' : '#15803d'} />
                    <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border p-4">
                        <p className="text-[10px] font-semibold text-muted-foreground mb-1">Taller con mejor tiempo</p>
                        {kpis.taller_mejor ? (
                            <>
                                <div className="flex items-center gap-1.5">
                                    <Trophy className="size-4 text-amber-500" />
                                    <p className="text-sm font-bold text-foreground truncate">{kpis.taller_mejor.taller}</p>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{kpis.taller_mejor.promedio} días promedio</p>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">Sin datos</p>
                        )}
                    </div>
                </div>

                {/* Gráficas */}
                <div className="grid gap-5 lg:grid-cols-2">

                    {/* Novedades por mes */}
                    <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border p-5">
                        <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-foreground"><CalendarDays className="size-4" /> Novedades por mes</p>
                        {novedades_por_mes.length > 0 ? (
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={novedades_por_mes} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                    <Bar dataKey="total" fill="#15803d" radius={[4, 4, 0, 0]} name="Novedades" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <p className="text-sm text-center text-muted-foreground py-8">Sin datos</p>}
                    </div>

                    {/* Novedades por tipo */}
                    <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border p-5">
                        <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-foreground"><Wrench className="size-4" /> Novedades por tipo</p>
                        {novedades_por_tipo.length > 0 ? (
                            <div className="flex items-center gap-4">
                                <ResponsiveContainer width="50%" height={200}>
                                    <PieChart>
                                        <Pie data={novedades_por_tipo} dataKey="total" nameKey="categoria" cx="50%" cy="50%" outerRadius={80}>
                                            {novedades_por_tipo.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: any, n: any) => [`${v}`, n]} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex-1 space-y-1.5">
                                    {novedades_por_tipo.slice(0, 6).map((item, i) => (
                                        <div key={i} className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <div className="size-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                                                <p className="text-[11px] text-muted-foreground truncate max-w-[100px]">{item.categoria}</p>
                                            </div>
                                            <p className="text-[11px] font-bold text-foreground">{item.total}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : <p className="text-sm text-center text-muted-foreground py-8">Sin datos</p>}
                    </div>
                </div>

                {/* Vehículos con más novedades */}
                {vehiculos_mas_novedades.length > 0 && (
                    <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border overflow-hidden">
                        <div className="border-b border-sidebar-border/70 px-5 py-3 dark:border-sidebar-border">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Truck className="size-4" /> Vehículos con más novedades</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-sidebar-border/70 bg-muted dark:border-sidebar-border dark:bg-muted">
                                        <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-green-700 dark:text-green-400">#</th>
                                        <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-green-700 dark:text-green-400">Placa</th>
                                        <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-green-700 dark:text-green-400">Novedades</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {vehiculos_mas_novedades.map((v, i) => (
                                        <tr key={i} className="hover:bg-muted/60/30">
                                            <td className="px-5 py-2 text-xs text-muted-foreground">{i + 1}</td>
                                            <td className="px-5 py-2 font-mono font-bold text-green-700 dark:text-green-400">{v.placa}</td>
                                            <td className="px-5 py-2 text-right tabular-nums font-semibold text-foreground">{v.total}</td>
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
