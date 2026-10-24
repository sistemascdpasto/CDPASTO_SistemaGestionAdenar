import HeadingSmall from '@/components/heading-small';
import { KpiCard, KpiCardGrid } from '@/components/kpi-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, Fuel, LoaderCircle, RefreshCw, Truck } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Flota', href: '/modules/flota' },
    { title: 'Análisis de Combustible', href: '/modules/flota/combustible' },
];

interface FilaPlaca {
    placa: string;
    km_total: number;
    dias_con_datos: number;
}

type Filters = { desde: string; hasta: string };

export default function AnalisisCombustibleIndex({ por_placa: porPlaca, filters }: { por_placa: FilaPlaca[]; filters: Filters }) {
    const { flash } = usePage<{ flash?: { status?: { message: string; type: string } } }>().props;
    const [desde, setDesde] = useState(filters.desde);
    const [hasta, setHasta] = useState(filters.hasta);
    const [fechaSync, setFechaSync] = useState(new Date(Date.now() - 86400000).toISOString().slice(0, 10));
    const [sincronizando, setSincronizando] = useState(false);

    const applyFilters: FormEventHandler = (e) => {
        e.preventDefault();
        router.get(route('flota.combustible.index'), { desde, hasta }, { preserveState: true, replace: true });
    };

    const sincronizarAhora = () => {
        setSincronizando(true);
        router.post(
            route('flota.combustible.sincronizar'),
            { fecha: fechaSync },
            { preserveScroll: true, onFinish: () => setSincronizando(false) },
        );
    };

    const kmTotal = porPlaca.reduce((acc, f) => acc + f.km_total, 0);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Análisis de Combustible" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall
                    title="Análisis de Combustible"
                    description="Kilómetros diarios por vehículo (MyGeotab). El cruce con tanqueadas y rendimiento km/gl llega en un próximo incremento."
                />

                {flash?.status && (
                    <div
                        className={`flex items-center gap-2 rounded-lg border p-4 text-sm font-medium shadow-xs ${
                            flash.status.type === 'success'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}
                    >
                        {flash.status.type === 'success' ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
                        <span>{flash.status.message}</span>
                    </div>
                )}

                <KpiCardGrid className="sm:grid-cols-2 lg:grid-cols-3">
                    <KpiCard label="Vehículos con datos" value={porPlaca.length} icon={Truck} color="#2B6CB0" />
                    <KpiCard label="Km totales en el rango" value={Math.round(kmTotal).toLocaleString('es-CO')} icon={Fuel} color="#2B6CB0" />
                </KpiCardGrid>

                <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                    <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-4">
                        <div className="grid gap-1">
                            <Label className="text-xs text-muted-foreground">Desde</Label>
                            <Input type="date" className="w-40" value={desde} onChange={(e) => setDesde(e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-xs text-muted-foreground">Hasta</Label>
                            <Input type="date" className="w-40" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                        </div>
                        <Button type="submit" variant="secondary">
                            Filtrar
                        </Button>
                    </form>

                    <div className="flex items-end gap-2">
                        <div className="grid gap-1">
                            <Label className="text-xs text-muted-foreground">Sincronizar día</Label>
                            <Input type="date" className="w-40" value={fechaSync} onChange={(e) => setFechaSync(e.target.value)} />
                        </div>
                        <Button type="button" variant="outline" disabled={sincronizando} onClick={sincronizarAhora}>
                            {sincronizando ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                            Sincronizar ahora
                        </Button>
                    </div>
                </div>

                <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Placa</TableHead>
                                <TableHead>Días con datos</TableHead>
                                <TableHead className="text-right">Km total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {porPlaca.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                                        Todavía no hay kilómetros sincronizados en este rango.
                                    </TableCell>
                                </TableRow>
                            )}
                            {porPlaca.map((fila) => (
                                <TableRow key={fila.placa}>
                                    <TableCell className="font-medium">{fila.placa}</TableCell>
                                    <TableCell>{fila.dias_con_datos}</TableCell>
                                    <TableCell className="text-right">{fila.km_total.toLocaleString('es-CO')}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </AppLayout>
    );
}
