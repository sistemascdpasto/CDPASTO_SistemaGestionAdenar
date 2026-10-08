import { KpiCard, KpiCardGrid } from '@/components/kpi-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { AlertTriangle, PackageSearch, Percent, Truck, Weight } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Flota', href: '/modules/flota' },
    { title: 'Ocupación de Carga', href: '/modules/flota/ocupacion-carga' },
];

interface Fila {
    id: number;
    fecha: string;
    placa: string;
    peso_toneladas: number;
    capacidad_kg: number | null;
    ocupacion_pct: number | null;
}

interface PorVehiculo {
    placa: string;
    promedio: number;
    rutas: number;
}

interface Kpis {
    total_rutas: number;
    promedio_ocupacion: number | null;
    rutas_sobrecargadas: number;
    vehiculos_sin_capacidad: number;
}

function BadgeOcupacion({ pct }: { pct: number | null }) {
    if (pct === null) {
        return (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
                <AlertTriangle className="size-3" />
                Sin capacidad registrada
            </Badge>
        );
    }

    const variant = pct > 100 ? 'bg-red-600 text-white' : pct >= 80 ? 'bg-amber-500 text-white' : 'bg-green-700 text-white';

    return <Badge className={variant}>{pct}%</Badge>;
}

export default function OcupacionCargaIndex({
    filas,
    kpis,
    ocupacion_por_vehiculo,
    filters,
}: {
    filas: Fila[];
    kpis: Kpis;
    ocupacion_por_vehiculo: PorVehiculo[];
    filters: { desde: string; hasta: string; placa: string };
}) {
    const [desde, setDesde] = useState(filters.desde);
    const [hasta, setHasta] = useState(filters.hasta);
    const [placa, setPlaca] = useState(filters.placa);

    const aplicar = () => router.get(route('flota.ocupacion-carga.index'), { desde, hasta, placa }, { preserveState: true });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Ocupación de Carga" />
            <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Ocupación de Carga</h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Con qué porcentaje de su capacidad sale cada vehículo en la Planeación de ruta.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" asChild className="gap-1.5">
                        <Link href={route('flota.vehiculos.index')}>
                            <Truck className="size-4" /> Documentación de Flota
                        </Link>
                    </Button>
                </div>

                {/* Filtros */}
                <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border px-4 py-3">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Desde</Label>
                            <Input type="date" value={desde} className="h-8 w-36 text-xs" onChange={(e) => setDesde(e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Hasta</Label>
                            <Input type="date" value={hasta} className="h-8 w-36 text-xs" onChange={(e) => setHasta(e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Placa</Label>
                            <Input
                                value={placa}
                                placeholder="Todas"
                                className="h-8 w-32 text-xs"
                                onChange={(e) => setPlaca(e.target.value)}
                            />
                        </div>
                        <Button size="sm" onClick={aplicar} className="h-8 bg-green-700 hover:bg-green-800 text-white">
                            Aplicar
                        </Button>
                    </div>
                </div>

                <KpiCardGrid className="sm:grid-cols-2 lg:grid-cols-4">
                    <KpiCard
                        label="Promedio de ocupación"
                        value={kpis.promedio_ocupacion ?? '—'}
                        suffix={kpis.promedio_ocupacion !== null ? '%' : ''}
                        icon={Percent}
                        color="#2563eb"
                    />
                    <KpiCard label="Rutas sobrecargadas (>100%)" value={kpis.rutas_sobrecargadas} icon={AlertTriangle} color="#dc2626" />
                    <KpiCard label="Vehículos sin capacidad registrada" value={kpis.vehiculos_sin_capacidad} icon={PackageSearch} color="#d97706" />
                    <KpiCard label="Rutas evaluadas" value={kpis.total_rutas} icon={Weight} color="#15803d" />
                </KpiCardGrid>

                {ocupacion_por_vehiculo.length > 0 && (
                    <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Ocupación promedio por vehículo (top 10 por cantidad de rutas)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={ocupacion_por_vehiculo}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis dataKey="placa" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} unit="%" />
                                    <Tooltip formatter={(value) => [`${value}%`, 'Ocupación promedio']} />
                                    <Bar dataKey="promedio" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                <div className="overflow-x-auto rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Placa</TableHead>
                                <TableHead>Peso total</TableHead>
                                <TableHead>Capacidad</TableHead>
                                <TableHead>Ocupación</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filas.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                                        No hay rutas con peso registrado en este rango.
                                    </TableCell>
                                </TableRow>
                            )}
                            {filas.map((fila) => (
                                <TableRow key={fila.id}>
                                    <TableCell>{fila.fecha}</TableCell>
                                    <TableCell className="font-mono font-medium">{fila.placa}</TableCell>
                                    <TableCell>{fila.peso_toneladas} ton</TableCell>
                                    <TableCell>{fila.capacidad_kg ? `${fila.capacidad_kg.toLocaleString()} Kg` : '—'}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <BadgeOcupacion pct={fila.ocupacion_pct} />
                                            {fila.ocupacion_pct === null && (
                                                <Link
                                                    href={route('flota.vehiculos.index', { search: fila.placa })}
                                                    className="text-xs text-primary hover:underline"
                                                >
                                                    Registrar
                                                </Link>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </AppLayout>
    );
}
