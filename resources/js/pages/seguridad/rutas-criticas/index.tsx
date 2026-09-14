import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { MapPinned, SquareArrowOutUpRight } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'Mapa de Rutas Críticas', href: '/modules/seguridad/rutas-criticas' },
];

// Centro aproximado del departamento de Nariño, Colombia (entre Pasto y la costa Pacífica).
const WAZE_LAT = 1.29;
const WAZE_LON = -77.75;
const WAZE_ZOOM = 8;

interface AfectacionVia {
    fecha?: string;
    municipio?: string;
    zona?: string;
    corredor_vial_via_que_conduce?: string;
    nombre_del_sector?: string;
    motivo_de_la_afectaci_n_vial?: string;
    condici_n_climatica?: string;
    estado_de_reporte?: string;
    evento_presentado?: string;
    kilometros_de_represamiento?: string;
}

interface SectorCritico {
    tramo?: string;
    nombre?: string;
    municipio?: string;
    entidad?: string;
    fallecidos?: string;
    gizscore?: string;
}

const ESTADO_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
    CERRADO: 'destructive',
    ABIERTO: 'default',
};

function formatearFecha(fecha?: string): string {
    if (!fecha) return '—';
    const date = new Date(fecha);
    return Number.isNaN(date.getTime()) ? fecha : date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function RutasCriticasIndex({
    afectacionesVia,
    sectoresCriticos,
}: {
    afectacionesVia: AfectacionVia[];
    sectoresCriticos: SectorCritico[];
}) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Mapa de Rutas Críticas" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall
                    title="Mapa de Rutas Críticas"
                    description="Tráfico en vivo, accidentes, baches, derrumbes y demás incidentes reportados por la comunidad de Waze, junto con reportes oficiales de vías afectadas en el departamento de Nariño."
                />

                <Card className="overflow-hidden border-sidebar-border/70 dark:border-sidebar-border">
                    <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                        <MapPinned className="size-10 text-muted-foreground" />
                        <div>
                            <p className="text-sm font-semibold text-foreground">El mapa incrustado de Waze ya no está disponible</p>
                            <p className="mt-1 max-w-md text-sm text-muted-foreground">
                                Waze restringió el acceso a su widget público de mapa en vivo (tráfico, accidentes, baches) desde sitios
                                externos como este; ya no es algo que se pueda arreglar desde nuestro lado. Puedes seguir consultando esa
                                información directamente en Waze.
                            </p>
                        </div>
                        <Button asChild className="gap-1.5">
                            <a href={`https://www.waze.com/live-map/?zoom=${WAZE_ZOOM}&lat=${WAZE_LAT}&lon=${WAZE_LON}`} target="_blank" rel="noreferrer">
                                <SquareArrowOutUpRight className="size-4" /> Abrir mapa de Waze en vivo
                            </a>
                        </Button>
                    </CardContent>
                </Card>

                <div className="space-y-3">
                    <div>
                        <h2 className="text-lg font-medium tracking-tight">Vías afectadas reportadas (Policía Nacional - DIPON)</h2>
                        <p className="text-sm text-muted-foreground">
                            Cierres, derrumbes, deslizamientos y otras afectaciones viales oficiales para Nariño, según el dataset "Estado de
                            Vías" de Datos Abiertos Colombia. Se actualiza cada pocas horas, no es información al instante.
                        </p>
                    </div>
                    <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Municipio</TableHead>
                                    <TableHead>Vía / Sector</TableHead>
                                    <TableHead>Motivo</TableHead>
                                    <TableHead>Evento</TableHead>
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {afectacionesVia.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-muted-foreground py-6 text-center">
                                            No hay reportes recientes disponibles (o la fuente no respondió en este momento).
                                        </TableCell>
                                    </TableRow>
                                )}
                                {afectacionesVia.map((afectacion, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{formatearFecha(afectacion.fecha)}</TableCell>
                                        <TableCell>{afectacion.municipio ?? '—'}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{afectacion.corredor_vial_via_que_conduce ?? '—'}</span>
                                                {afectacion.nombre_del_sector && (
                                                    <span className="text-xs text-muted-foreground">{afectacion.nombre_del_sector}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{afectacion.motivo_de_la_afectaci_n_vial ?? afectacion.condici_n_climatica ?? '—'}</TableCell>
                                        <TableCell>{afectacion.evento_presentado ?? '—'}</TableCell>
                                        <TableCell>
                                            {afectacion.estado_de_reporte ? (
                                                <Badge variant={ESTADO_VARIANT[afectacion.estado_de_reporte] ?? 'secondary'}>
                                                    {afectacion.estado_de_reporte}
                                                </Badge>
                                            ) : (
                                                '—'
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <div className="space-y-3">
                    <div>
                        <h2 className="text-lg font-medium tracking-tight">Tramos históricamente críticos (ANSV / ANI / INVÍAS)</h2>
                        <p className="text-sm text-muted-foreground">
                            Sectores de la red vial en Nariño con mayor siniestralidad histórica, según el dataset "Sectores Críticos de
                            Siniestralidad Vial" de la Agencia Nacional de Seguridad Vial, disponible en Datos Abiertos Colombia.
                        </p>
                    </div>
                    <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tramo</TableHead>
                                    <TableHead>Municipio</TableHead>
                                    <TableHead>Entidad</TableHead>
                                    <TableHead className="text-right">Fallecidos (histórico)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sectoresCriticos.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-muted-foreground py-6 text-center">
                                            No hay información disponible (o la fuente no respondió en este momento).
                                        </TableCell>
                                    </TableRow>
                                )}
                                {sectoresCriticos.map((sector, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{sector.tramo ?? sector.nombre ?? '—'}</TableCell>
                                        <TableCell>{sector.municipio ?? '—'}</TableCell>
                                        <TableCell>{sector.entidad ?? '—'}</TableCell>
                                        <TableCell className="text-right font-medium text-red-600 dark:text-red-500">
                                            {sector.fallecidos ?? '—'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <p className="text-xs text-muted-foreground">
                    Fuentes: Waze (tráfico en vivo, reportado por la comunidad), Dirección de Tránsito y Transporte - Policía Nacional (DIPON) y
                    Agencia Nacional de Seguridad Vial (ANSV), a través del portal oficial{' '}
                    <a href="https://www.datos.gov.co" target="_blank" rel="noreferrer" className="underline">
                        Datos Abiertos Colombia
                    </a>
                    .
                </p>
            </div>
        </AppLayout>
    );
}
