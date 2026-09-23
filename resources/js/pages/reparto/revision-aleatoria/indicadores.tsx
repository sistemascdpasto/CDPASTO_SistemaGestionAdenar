import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { AlertTriangle, ArrowLeft, BarChart3, CheckCircle2, ClipboardList, Package, Percent, Tags, Trophy, Truck } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Revisión Aleatoria', href: '/modules/reparto/revision-aleatoria' },
    { title: 'Indicadores', href: '/modules/reparto/revision-aleatoria/indicadores' },
];

const TODOS = '__todos__';
const COLOR_SIN = '#15803d';
const COLOR_CON = '#dc2626';
const PALETA = ['#0369a1', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#15803d'];

interface Kpis {
    total_revisiones: number;
    sin_novedades: number;
    con_novedades: number;
    total_novedades: number;
    productos_afectados: number;
    unidades_afectadas: number;
    vehiculos_revisados: number;
    pct_con_novedades: number;
    causal_mas_frecuente: string;
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

export default function RevisionAleatoriaIndicadores({
    filtros,
    kpis,
    revisionesPorDia,
    novedadesPorDia,
    porCausal,
    porVehiculo,
    porResponsable,
    topSku,
    vehiculosDisponibles,
    responsablesDisponibles,
    causalesDisponibles,
}: {
    filtros: { desde: string; hasta: string; vehiculo_id?: string; responsable_id?: string; causal_id?: string; sku?: string };
    kpis: Kpis;
    revisionesPorDia: { fecha: string; total: number }[];
    novedadesPorDia: { fecha: string; total: number }[];
    porCausal: { causal: string; total: number }[];
    porVehiculo: { placa: string; novedades: number }[];
    porResponsable: { responsable: string; revisiones: number; con_novedades: number }[];
    topSku: { sku: string; producto: string; total: number }[];
    vehiculosDisponibles: { id: number; placa: string }[];
    responsablesDisponibles: { id: number; nombre: string }[];
    causalesDisponibles: { id: number; nombre: string }[];
}) {
    const [form, setForm] = useState({
        desde: filtros.desde,
        hasta: filtros.hasta,
        vehiculo_id: filtros.vehiculo_id ?? '',
        responsable_id: filtros.responsable_id ?? '',
        causal_id: filtros.causal_id ?? '',
        sku: filtros.sku ?? '',
    });

    const aplicar = (overrides?: Partial<typeof form>) => {
        const datos = { ...form, ...overrides };
        setForm(datos);
        router.get(route('reparto.revision-aleatoria.indicadores'), datos, { preserveState: true });
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

    const donutData = [
        { name: 'Sin novedades', value: kpis.sin_novedades, fill: COLOR_SIN },
        { name: 'Con novedades', value: kpis.con_novedades, fill: COLOR_CON },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Indicadores — Revisión Aleatoria" />
            <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Indicadores de Revisión Aleatoria</h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">Trazabilidad y estadísticas de novedades de flota y producto.</p>
                    </div>
                    <Button variant="outline" size="sm" asChild className="gap-1.5">
                        <Link href={route('reparto.revision-aleatoria.index')}>
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
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Desde</Label>
                            <Input type="date" value={form.desde} className="h-8 text-xs" onChange={(e) => setForm({ ...form, desde: e.target.value })} />
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Hasta</Label>
                            <Input type="date" value={form.hasta} className="h-8 text-xs" onChange={(e) => setForm({ ...form, hasta: e.target.value })} />
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
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Responsable</Label>
                            <Select value={form.responsable_id || TODOS} onValueChange={(v) => setForm({ ...form, responsable_id: v === TODOS ? '' : v })}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Todos</SelectItem>
                                    {responsablesDisponibles.map((r) => (
                                        <SelectItem key={r.id} value={String(r.id)}>
                                            {r.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Causal</Label>
                            <Select value={form.causal_id || TODOS} onValueChange={(v) => setForm({ ...form, causal_id: v === TODOS ? '' : v })}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TODOS}>Todas</SelectItem>
                                    {causalesDisponibles.map((c) => (
                                        <SelectItem key={c.id} value={String(c.id)}>
                                            {c.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end gap-2">
                            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="h-8 text-xs" placeholder="SKU" />
                            <Button size="sm" onClick={() => aplicar()} className="h-8 bg-green-700 text-white hover:bg-green-800">
                                Aplicar
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    <KpiCard label="Total revisiones" value={kpis.total_revisiones} icon={ClipboardList} color="#0369a1" />
                    <KpiCard label="Sin novedades" value={kpis.sin_novedades} icon={CheckCircle2} color={COLOR_SIN} />
                    <KpiCard label="Con novedades" value={kpis.con_novedades} icon={AlertTriangle} color={COLOR_CON} />
                    <KpiCard label="% con novedades" value={`${kpis.pct_con_novedades}%`} icon={Percent} color={kpis.pct_con_novedades > 30 ? COLOR_CON : '#d97706'} />
                    <KpiCard label="Vehículos revisados" value={kpis.vehiculos_revisados} icon={Truck} color="#7c3aed" />
                    <KpiCard label="Total novedades" value={kpis.total_novedades} icon={AlertTriangle} color={COLOR_CON} />
                    <KpiCard label="Productos afectados" value={kpis.productos_afectados} icon={Package} color="#d97706" />
                    <KpiCard label="Unidades afectadas" value={kpis.unidades_afectadas} icon={Package} color="#d97706" />
                    <KpiCard label="Causal más frecuente" value={kpis.causal_mas_frecuente} icon={Tags} color="#0891b2" />
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-xl border border-sidebar-border/70 bg-card p-5 shadow-sm dark:border-sidebar-border">
                        <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            <BarChart3 className="size-4" /> Revisiones y novedades por día
                        </p>
                        {revisionesPorDia.length > 0 ? (
                            <ResponsiveContainer width="100%" height={220}>
                                <LineChart margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="fecha" allowDuplicatedCategory={false} tick={{ fontSize: 9, fill: '#9ca3af' }} />
                                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                    <Legend wrapperStyle={{ fontSize: 11 }} />
                                    <Line data={revisionesPorDia} type="monotone" dataKey="total" name="Revisiones" stroke="#0369a1" strokeWidth={2} dot={false} />
                                    <Line data={novedadesPorDia} type="monotone" dataKey="total" name="Novedades" stroke={COLOR_CON} strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="py-8 text-center text-sm text-muted-foreground">Sin datos en el rango seleccionado.</p>
                        )}
                    </div>

                    <div className="rounded-xl border border-sidebar-border/70 bg-card p-5 shadow-sm dark:border-sidebar-border">
                        <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            <CheckCircle2 className="size-4" /> Revisiones con/sin novedades
                        </p>
                        {kpis.total_revisiones > 0 ? (
                            <div className="flex items-center gap-4">
                                <ResponsiveContainer width="50%" height={200}>
                                    <PieChart>
                                        <Pie data={donutData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                                            {donutData.map((d, i) => (
                                                <Cell key={i} fill={d.fill} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex-1 space-y-2">
                                    {donutData.map((d, i) => (
                                        <div key={i} className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <div className="size-2.5 shrink-0 rounded-full" style={{ background: d.fill }} />
                                                <p className="text-xs text-muted-foreground">{d.name}</p>
                                            </div>
                                            <p className="text-xs font-bold text-foreground">{d.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="py-8 text-center text-sm text-muted-foreground">Sin datos en el rango seleccionado.</p>
                        )}
                    </div>

                    <div className="rounded-xl border border-sidebar-border/70 bg-card p-5 shadow-sm dark:border-sidebar-border">
                        <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            <Tags className="size-4" /> Novedades por causal
                        </p>
                        {porCausal.length > 0 ? (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={porCausal} margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="causal" tick={{ fontSize: 9, fill: '#9ca3af' }} interval={0} angle={-20} textAnchor="end" height={50} />
                                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                    <Bar dataKey="total" name="Novedades" radius={[4, 4, 0, 0]}>
                                        {porCausal.map((_, i) => (
                                            <Cell key={i} fill={PALETA[i % PALETA.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="py-8 text-center text-sm text-muted-foreground">Sin novedades en el rango seleccionado.</p>
                        )}
                    </div>

                    <div className="rounded-xl border border-sidebar-border/70 bg-card p-5 shadow-sm dark:border-sidebar-border">
                        <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            <Truck className="size-4" /> Novedades por vehículo
                        </p>
                        {porVehiculo.length > 0 ? (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={porVehiculo} margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="placa" tick={{ fontSize: 9, fill: '#9ca3af' }} />
                                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                    <Bar dataKey="novedades" name="Novedades" fill={COLOR_CON} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="py-8 text-center text-sm text-muted-foreground">Sin novedades en el rango seleccionado.</p>
                        )}
                    </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border overflow-hidden">
                        <div className="border-b border-sidebar-border/70 px-5 py-3 dark:border-sidebar-border">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                <ClipboardList className="size-4" /> Revisiones por responsable
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-sidebar-border/70 bg-muted dark:border-sidebar-border dark:bg-muted">
                                        <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-green-700 dark:text-green-400">Responsable</th>
                                        <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-green-700 dark:text-green-400">Revisiones</th>
                                        <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-green-700 dark:text-green-400">Con novedades</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {porResponsable.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-5 py-6 text-center text-xs text-muted-foreground">
                                                Sin datos en el rango seleccionado.
                                            </td>
                                        </tr>
                                    )}
                                    {porResponsable.map((r, i) => (
                                        <tr key={i}>
                                            <td className="px-5 py-2 text-xs font-semibold text-foreground">{r.responsable}</td>
                                            <td className="px-5 py-2 text-right text-xs tabular-nums text-foreground">{r.revisiones}</td>
                                            <td className="px-5 py-2 text-right text-xs tabular-nums text-foreground">{r.con_novedades}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border overflow-hidden">
                        <div className="border-b border-sidebar-border/70 px-5 py-3 dark:border-sidebar-border">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                <Trophy className="size-4" /> SKU con mayor cantidad de novedades
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-sidebar-border/70 bg-muted dark:border-sidebar-border dark:bg-muted">
                                        <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-green-700 dark:text-green-400">#</th>
                                        <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-green-700 dark:text-green-400">Producto</th>
                                        <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-green-700 dark:text-green-400">Novedades</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {topSku.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-5 py-6 text-center text-xs text-muted-foreground">
                                                Sin novedades en el rango seleccionado.
                                            </td>
                                        </tr>
                                    )}
                                    {topSku.map((s, i) => (
                                        <tr key={i}>
                                            <td className="px-5 py-2 text-xs text-muted-foreground">{i + 1}</td>
                                            <td className="px-5 py-2 text-xs font-semibold text-foreground">
                                                {s.producto} {s.sku && <span className="text-muted-foreground">({s.sku})</span>}
                                            </td>
                                            <td className="px-5 py-2 text-right text-xs tabular-nums font-bold text-foreground">{s.total}</td>
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
