import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, ArrowDown, ArrowUp, BarChart3, ClipboardList, Minus, Tags, TrendingUp, Truck, Users } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: '5 Por Qué', href: '/cinco-porques' },
    { title: 'Historial', href: '/cinco-porques/historial' },
    { title: 'Indicadores', href: '/cinco-porques/indicadores' },
];

const TODOS = '__todos__';
const PALETA = ['#0369a1', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#15803d', '#b91c1c', '#4338ca'];

interface Kpis {
    total_analisis: number;
    variacion_vs_periodo_anterior: number;
    promedio_por_dia: number;
    indicador_mas_frecuente: string;
    indicador_mas_frecuente_total: number;
    vehiculos_involucrados: number;
    ejecutores_participantes: number;
}

function KpiCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: React.ElementType; color: string }) {
    return (
        <div className="flex flex-col gap-1.5 rounded-xl border border-sidebar-border/70 bg-card p-4 shadow-sm dark:border-sidebar-border">
            <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-semibold text-muted-foreground">{label}</p>
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="size-3.5" style={{ color }} />
                </div>
            </div>
            <p className="text-2xl leading-none font-extrabold tabular-nums" style={{ color }}>
                {value}
            </p>
            {sub && <p className="text-[10px] leading-snug text-muted-foreground">{sub}</p>}
        </div>
    );
}

export default function CincoPorquesIndicadores({
    filtros,
    kpis,
    analisisPorDia,
    porIndicador,
    porVehiculo,
    porEjecutor,
    indicadoresDisponibles,
    vehiculosDisponibles,
}: {
    filtros: { desde: string; hasta: string; indicador?: string; vehiculo_id?: string };
    kpis: Kpis;
    analisisPorDia: { fecha: string; total: number }[];
    porIndicador: { indicador: string; total: number }[];
    porVehiculo: { placa: string; total: number }[];
    porEjecutor: { ejecutor: string; total: number }[];
    indicadoresDisponibles: string[];
    vehiculosDisponibles: { id: number; placa: string }[];
}) {
    const [form, setForm] = useState({
        desde: filtros.desde,
        hasta: filtros.hasta,
        indicador: filtros.indicador ?? '',
        vehiculo_id: filtros.vehiculo_id ?? '',
    });

    const aplicar = (overrides?: Partial<typeof form>) => {
        const datos = { ...form, ...overrides };
        setForm(datos);
        router.get(route('cinco-porques.indicadores'), datos, { preserveState: true });
    };

    const hoy = () => new Date().toISOString().slice(0, 10);
    const haceNDias = (n: number) => {
        const d = new Date();
        d.setDate(d.getDate() - n);
        return d.toISOString().slice(0, 10);
    };
    const inicioMes = (offsetMeses = 0) => {
        const d = new Date();
        d.setMonth(d.getMonth() + offsetMeses, 1);
        return d.toISOString().slice(0, 10);
    };
    const finMesAnterior = () => {
        const d = new Date();
        d.setDate(0);
        return d.toISOString().slice(0, 10);
    };

    const variacion = kpis.variacion_vs_periodo_anterior;
    const colorVariacion = variacion > 0 ? '#dc2626' : variacion < 0 ? '#15803d' : '#6b7280';
    const IconoVariacion = variacion > 0 ? ArrowUp : variacion < 0 ? ArrowDown : Minus;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Indicadores — 5 Por Qué" />
            <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Indicadores de 5 Por Qué</h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Dónde se concentran los análisis de causa raíz y quién los está realizando.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" asChild className="gap-1.5">
                        <Link href={route('cinco-porques.historial')}>
                            <ArrowLeft className="size-4" /> Volver
                        </Link>
                    </Button>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-card p-4 shadow-sm dark:border-sidebar-border">
                    <div className="mb-3 flex flex-wrap gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => aplicar({ desde: hoy(), hasta: hoy() })}>
                            Hoy
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => aplicar({ desde: haceNDias(6), hasta: hoy() })}>
                            Últimos 7 días
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => aplicar({ desde: haceNDias(29), hasta: hoy() })}>
                            Últimos 30 días
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => aplicar({ desde: inicioMes(), hasta: hoy() })}>
                            Este mes
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => aplicar({ desde: inicioMes(-1), hasta: finMesAnterior() })}>
                            Mes anterior
                        </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Desde</Label>
                            <Input type="date" value={form.desde} className="h-8 text-xs" onChange={(e) => setForm({ ...form, desde: e.target.value })} />
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Hasta</Label>
                            <Input type="date" value={form.hasta} className="h-8 text-xs" onChange={(e) => setForm({ ...form, hasta: e.target.value })} />
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Indicador</Label>
                            <Select value={form.indicador || TODOS} onValueChange={(v) => setForm({ ...form, indicador: v === TODOS ? '' : v })}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Todos</SelectItem>
                                    {indicadoresDisponibles.map((i) => (
                                        <SelectItem key={i} value={i}>
                                            {i}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Placa</Label>
                            <Select value={form.vehiculo_id || TODOS} onValueChange={(v) => setForm({ ...form, vehiculo_id: v === TODOS ? '' : v })}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Todas</SelectItem>
                                    {vehiculosDisponibles.map((v) => (
                                        <SelectItem key={v.id} value={String(v.id)}>
                                            {v.placa}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end">
                            <Button size="sm" onClick={() => aplicar()} className="h-8 w-full bg-green-700 text-white hover:bg-green-800">
                                Aplicar
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <KpiCard label="Total análisis" value={kpis.total_analisis} icon={ClipboardList} color="#0369a1" />
                    <KpiCard
                        label="Vs. período anterior"
                        value={`${variacion > 0 ? '+' : ''}${variacion}%`}
                        sub="Mismo rango de días, justo antes"
                        icon={IconoVariacion}
                        color={colorVariacion}
                    />
                    <KpiCard label="Promedio por día" value={kpis.promedio_por_dia} icon={TrendingUp} color="#7c3aed" />
                    <KpiCard
                        label="Indicador más frecuente"
                        value={kpis.indicador_mas_frecuente}
                        sub={`${kpis.indicador_mas_frecuente_total} análisis`}
                        icon={Tags}
                        color="#d97706"
                    />
                    <KpiCard label="Vehículos involucrados" value={kpis.vehiculos_involucrados} icon={Truck} color="#0891b2" />
                    <KpiCard label="Ejecutores participantes" value={kpis.ejecutores_participantes} icon={Users} color="#15803d" />
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-xl border border-sidebar-border/70 bg-card p-5 shadow-sm dark:border-sidebar-border">
                        <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            <TrendingUp className="size-4" /> Análisis por día
                        </p>
                        {analisisPorDia.length > 0 ? (
                            <ResponsiveContainer width="100%" height={240}>
                                <LineChart data={analisisPorDia} margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="fecha" tick={{ fontSize: 9, fill: '#9ca3af' }} />
                                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                    <Line type="monotone" dataKey="total" name="Análisis" stroke="#0369a1" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="py-8 text-center text-sm text-muted-foreground">Sin datos en el rango seleccionado.</p>
                        )}
                    </div>

                    <div className="rounded-xl border border-sidebar-border/70 bg-card p-5 shadow-sm dark:border-sidebar-border">
                        <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            <Tags className="size-4" /> Análisis por indicador afectado
                        </p>
                        {porIndicador.length > 0 ? (
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={porIndicador} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                                    <YAxis
                                        type="category"
                                        dataKey="indicador"
                                        width={140}
                                        tick={{ fontSize: 9, fill: '#9ca3af' }}
                                        interval={0}
                                    />
                                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                    <Bar dataKey="total" name="Análisis" radius={[0, 4, 4, 0]}>
                                        {porIndicador.map((_, i) => (
                                            <Cell key={i} fill={PALETA[i % PALETA.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="py-8 text-center text-sm text-muted-foreground">Sin datos en el rango seleccionado.</p>
                        )}
                    </div>

                    <div className="rounded-xl border border-sidebar-border/70 bg-card p-5 shadow-sm dark:border-sidebar-border">
                        <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            <Truck className="size-4" /> Análisis por vehículo (top 10)
                        </p>
                        {porVehiculo.length > 0 ? (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={porVehiculo} margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="placa" tick={{ fontSize: 9, fill: '#9ca3af' }} />
                                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                    <Bar dataKey="total" name="Análisis" fill="#0891b2" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="py-8 text-center text-sm text-muted-foreground">Sin vehículos en el rango seleccionado.</p>
                        )}
                    </div>

                    <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border overflow-hidden">
                        <div className="border-b border-sidebar-border/70 px-5 py-3 dark:border-sidebar-border">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                <BarChart3 className="size-4" /> Análisis por ejecutor (top 10)
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-sidebar-border/70 bg-muted dark:border-sidebar-border dark:bg-muted">
                                        <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-green-700 dark:text-green-400">Ejecutor</th>
                                        <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-green-700 dark:text-green-400">Análisis</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {porEjecutor.length === 0 && (
                                        <tr>
                                            <td colSpan={2} className="px-5 py-6 text-center text-xs text-muted-foreground">
                                                Sin datos en el rango seleccionado.
                                            </td>
                                        </tr>
                                    )}
                                    {porEjecutor.map((e, i) => (
                                        <tr key={i}>
                                            <td className="px-5 py-2 text-xs font-semibold text-foreground">{e.ejecutor}</td>
                                            <td className="px-5 py-2 text-right text-xs tabular-nums text-foreground">{e.total}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
