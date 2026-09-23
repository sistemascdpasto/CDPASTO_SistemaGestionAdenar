import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Flota', href: '/modules/flota' },
    { title: 'Disponibilidad', href: '/modules/flota/disponibilidad' },
    { title: 'Histórico', href: '/modules/flota/disponibilidad/historico' },
];

interface Resumen {
    asignada: number;
    indisponible: number;
    disponible: number;
    porcentaje: number;
}

interface DiaHistorico {
    fecha: string;
    fechaCorta: string;
    flota: Resumen;
    carretas: Resumen;
}

export default function DisponibilidadHistorico({ filtros, dias }: { filtros: { desde: string; hasta: string }; dias: DiaHistorico[] }) {
    const [desde, setDesde] = useState(filtros.desde);
    const [hasta, setHasta] = useState(filtros.hasta);

    const aplicar = () => router.get(route('flota.disponibilidad.historico'), { desde, hasta }, { preserveState: true });

    const datosGrafica = dias.map((d) => ({
        fecha: d.fechaCorta,
        Flota: d.flota.porcentaje,
        Carretas: d.carretas.porcentaje,
    }));

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Histórico de Disponibilidad" />
            <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Histórico de Disponibilidad</h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            % de disponibilidad de Flota y Carretas día por día, recalculado a partir de las Actas de Taller.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" asChild className="gap-1.5">
                        <Link href={route('flota.disponibilidad.index')}>
                            <ArrowLeft className="size-4" /> Volver al reporte de hoy
                        </Link>
                    </Button>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm dark:border-sidebar-border">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Desde</Label>
                            <Input type="date" value={desde} className="h-8 w-36 text-xs" onChange={(e) => setDesde(e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Hasta</Label>
                            <Input type="date" value={hasta} className="h-8 w-36 text-xs" onChange={(e) => setHasta(e.target.value)} />
                        </div>
                        <Button size="sm" onClick={aplicar} className="h-8 bg-green-700 text-white hover:bg-green-800">
                            Aplicar
                        </Button>
                    </div>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-card p-5 shadow-sm dark:border-sidebar-border">
                    <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <TrendingUp className="size-4" /> Tendencia de % disponibilidad
                    </p>
                    {datosGrafica.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                            <LineChart data={datosGrafica} margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} domain={[0, 100]} unit="%" />
                                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Line type="monotone" dataKey="Flota" stroke="#15803d" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="Carretas" stroke="#0891b2" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="py-8 text-center text-sm text-muted-foreground">Sin datos en el rango seleccionado.</p>
                    )}
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead className="text-right">Flota asignada</TableHead>
                                    <TableHead className="text-right">Flota indisponible</TableHead>
                                    <TableHead className="text-right">Flota %</TableHead>
                                    <TableHead className="text-right">Carretas asignadas</TableHead>
                                    <TableHead className="text-right">Carretas indisponible</TableHead>
                                    <TableHead className="text-right">Carretas %</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {dias.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                                            Sin datos en el rango seleccionado.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {[...dias].reverse().map((dia) => (
                                    <TableRow key={dia.fecha}>
                                        <TableCell className="font-medium">
                                            <Link href={route('flota.disponibilidad.index', { fecha: dia.fecha })} className="hover:underline">
                                                {dia.fecha}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">{dia.flota.asignada}</TableCell>
                                        <TableCell className="text-right tabular-nums" style={dia.flota.indisponible > 0 ? { color: '#dc2626' } : undefined}>
                                            {dia.flota.indisponible}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold tabular-nums">{dia.flota.porcentaje}%</TableCell>
                                        <TableCell className="text-right tabular-nums">{dia.carretas.asignada}</TableCell>
                                        <TableCell className="text-right tabular-nums" style={dia.carretas.indisponible > 0 ? { color: '#dc2626' } : undefined}>
                                            {dia.carretas.indisponible}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold tabular-nums">{dia.carretas.porcentaje}%</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
