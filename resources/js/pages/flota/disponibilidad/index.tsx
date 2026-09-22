import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { CalendarDays, ChevronLeft, ChevronRight, FileSpreadsheet, History, Truck, Wrench } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Flota', href: '/modules/flota' },
    { title: 'Disponibilidad', href: '/modules/flota/disponibilidad' },
];

const COLOR_DISPONIBLE = '#15803d';
const COLOR_INDISPONIBLE = '#dc2626';

interface Resumen {
    asignada: number;
    indisponible: number;
    disponible: number;
    porcentaje: number;
}

interface FilaTaller {
    placa: string;
    fecha_ingreso: string | null;
    novedades: string;
    entrega_estimada: string;
    dias_en_taller: number | null;
    taller: string;
}

function ContadorFila({ label, value, color }: { label: string; value: number; color?: string }) {
    return (
        <div className="flex items-center justify-between rounded-lg border border-sidebar-border/70 bg-card px-3 py-2 dark:border-sidebar-border">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="text-lg font-extrabold tabular-nums" style={color ? { color } : undefined}>
                {value}
            </p>
        </div>
    );
}

function DonaDisponibilidad({ porcentaje, disponible, indisponible }: { porcentaje: number; disponible: number; indisponible: number }) {
    const data = [
        { name: 'Disponible', value: disponible, fill: COLOR_DISPONIBLE },
        { name: 'Indisponible', value: indisponible, fill: COLOR_INDISPONIBLE },
    ];

    return (
        <div className="relative flex size-32 shrink-0 items-center justify-center">
            {disponible + indisponible > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={62} paddingAngle={2} isAnimationActive={false}>
                            {data.map((entry, index) => (
                                <Cell key={index} fill={entry.fill} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="text-xs text-muted-foreground">Sin datos</div>
            )}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold text-foreground">{porcentaje}%</span>
                <span className="text-[9px] font-bold text-muted-foreground">Disponible</span>
            </div>
        </div>
    );
}

function BloqueDisponibilidad({ titulo, icon: Icon, resumen }: { titulo: string; icon: React.ElementType; resumen: Resumen }) {
    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-card p-5 shadow-sm dark:border-sidebar-border">
            <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Icon className="size-4" /> {titulo}
            </p>
            <div className="flex items-center gap-5">
                <div className="flex-1 space-y-2">
                    <ContadorFila label={`${titulo} asignada`} value={resumen.asignada} />
                    <ContadorFila label={`${titulo} indisponible`} value={resumen.indisponible} color={resumen.indisponible > 0 ? COLOR_INDISPONIBLE : undefined} />
                    <ContadorFila label={`${titulo} disponible`} value={resumen.disponible} color={COLOR_DISPONIBLE} />
                </div>
                <DonaDisponibilidad porcentaje={resumen.porcentaje} disponible={resumen.disponible} indisponible={resumen.indisponible} />
            </div>
        </div>
    );
}

export default function DisponibilidadFlotaIndex({
    fecha,
    fechaFormateada,
    esHoy,
    resumenFlota,
    resumenCarretas,
    tabla,
}: {
    fecha: string;
    fechaFormateada: string;
    esHoy: boolean;
    resumenFlota: Resumen;
    resumenCarretas: Resumen;
    tabla: FilaTaller[];
}) {
    const irAFecha = (nuevaFecha: string) => {
        router.get(route('flota.disponibilidad.index'), { fecha: nuevaFecha }, { preserveState: true, preserveScroll: true });
    };

    const sumarDias = (dias: number) => {
        const d = new Date(fecha + 'T00:00:00');
        d.setDate(d.getDate() + dias);
        irAFecha(d.toISOString().slice(0, 10));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Disponibilidad de Flota" />
            <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Reporte de Disponibilidad de Flota ADENAR — CD Pasto</h1>
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                            <CalendarDays className="size-4" /> {fechaFormateada}
                            {esHoy && (
                                <Badge variant="outline" className="ml-1 text-[10px]">
                                    Hoy
                                </Badge>
                            )}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild className="gap-1.5">
                            <Link href={route('flota.disponibilidad.historico')}>
                                <History className="size-4" /> Ver histórico
                            </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild className="gap-1.5">
                            <a href={route('flota.disponibilidad.exportar-excel', { fecha })}>
                                <FileSpreadsheet className="size-4" /> Exportar a Excel
                            </a>
                        </Button>
                    </div>
                </div>

                {/* Selector de día */}
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sidebar-border/70 bg-card px-4 py-3 shadow-sm dark:border-sidebar-border">
                    <Button variant="outline" size="icon" className="size-8" onClick={() => sumarDias(-1)} aria-label="Día anterior">
                        <ChevronLeft className="size-4" />
                    </Button>
                    <Input type="date" value={fecha} max={new Date().toISOString().slice(0, 10)} onChange={(e) => irAFecha(e.target.value)} className="h-8 w-40 text-xs" />
                    <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        onClick={() => sumarDias(1)}
                        disabled={esHoy}
                        aria-label="Día siguiente"
                    >
                        <ChevronRight className="size-4" />
                    </Button>
                    {!esHoy && (
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => irAFecha(new Date().toISOString().slice(0, 10))}>
                            Volver a hoy
                        </Button>
                    )}
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                    <BloqueDisponibilidad titulo="Flota" icon={Truck} resumen={resumenFlota} />
                    <BloqueDisponibilidad titulo="Carretas" icon={Wrench} resumen={resumenCarretas} />
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border overflow-hidden">
                    <div className="border-b border-sidebar-border/70 px-5 py-3 dark:border-sidebar-border">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            <Wrench className="size-4" /> Vehículos y carretas en taller — {fechaFormateada}
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Placa</TableHead>
                                    <TableHead>Fecha ingreso</TableHead>
                                    <TableHead>Novedades reportadas</TableHead>
                                    <TableHead>Entrega estimada</TableHead>
                                    <TableHead className="text-right">Días en taller</TableHead>
                                    <TableHead>Taller</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tabla.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                                            No hay vehículos ni carretas en taller.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {tabla.map((fila, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="font-mono font-bold text-green-700 dark:text-green-400">{fila.placa}</TableCell>
                                        <TableCell>{fila.fecha_ingreso ?? '—'}</TableCell>
                                        <TableCell className="max-w-xs truncate" title={fila.novedades}>
                                            {fila.novedades}
                                        </TableCell>
                                        <TableCell>{fila.entrega_estimada}</TableCell>
                                        <TableCell className="text-right tabular-nums">{fila.dias_en_taller ?? '—'}</TableCell>
                                        <TableCell>{fila.taller}</TableCell>
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
