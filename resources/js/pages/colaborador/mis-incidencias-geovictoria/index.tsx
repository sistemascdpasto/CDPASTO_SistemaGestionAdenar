import HeadingSmall from '@/components/heading-small';
import { KpiCard, KpiCardGrid } from '@/components/kpi-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, BedDouble, CheckCircle2, Timer } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Mis Incidencias GeoVictoria', href: '/portal/mis-incidencias-geovictoria' },
];

const COLOR_EXCESO_JORNADA = '#d03b3b';
const COLOR_DESCANSO_NO_EFECTIVO = '#fab219';

interface IncidenciaRow {
    id: number;
    fecha: string;
    exceso_jornada: boolean;
    descanso_no_efectivo: boolean;
    turno: string | null;
    entrada: string | null;
    salida: string | null;
    horas_trabajadas: string | null;
    horas_descanso_previo: string | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface IncidenciasPaginator {
    data: IncidenciaRow[];
    links: PaginationLink[];
}

interface Resumen {
    total_exceso_jornada: number;
    total_descanso_no_efectivo: number;
    recientes_30_dias: number;
    ultima_fecha: string | null;
}

export default function MisIncidenciasGeovictoria({ incidencias, resumen }: { incidencias: IncidenciasPaginator; resumen: Resumen }) {
    const totalIncidencias = resumen.total_exceso_jornada + resumen.total_descanso_no_efectivo;
    const tieneRecientes = resumen.recientes_30_dias > 0;
    const tieneHistoricas = totalIncidencias > 0;

    const banner = tieneRecientes
        ? {
              iconBg: 'bg-destructive',
              cardClass: 'border-destructive/40 bg-destructive/5',
              icon: AlertTriangle,
              titulo: 'Tienes incidencias recientes',
              mensaje:
                  'NO debes volver a caer en excesos de jornada ni en descansos no efectivos. Cumple siempre tu horario de entrada, salida y descanso.',
          }
        : tieneHistoricas
          ? {
                iconBg: 'bg-amber-500',
                cardClass: 'border-amber-500/40 bg-amber-500/5',
                icon: AlertTriangle,
                titulo: 'Mantén este buen comportamiento',
                mensaje:
                    'No tienes incidencias en los últimos 30 días. Recuerda: NO debes volver a caer en excesos de jornada ni en descansos no efectivos.',
            }
          : {
                iconBg: 'bg-green-700',
                cardClass: 'border-green-700/40 bg-green-700/5',
                icon: CheckCircle2,
                titulo: '¡Vas muy bien!',
                mensaje: 'No tienes incidencias de exceso de jornada ni de descanso no efectivo registradas. Sigue así.',
            };

    const BannerIcon = banner.icon;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Mis Incidencias GeoVictoria" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall
                    title="Mis incidencias GeoVictoria"
                    description="Revisa tus excesos de jornada y descansos no efectivos registrados por la marcación."
                />

                <Card className={`p-4 ${banner.cardClass}`}>
                    <div className="flex items-start gap-3">
                        <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${banner.iconBg}`}>
                            <BannerIcon className="size-5 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">{banner.titulo}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{banner.mensaje}</p>
                        </div>
                    </div>
                </Card>

                <KpiCardGrid className="sm:grid-cols-2 lg:grid-cols-4">
                    <KpiCard label="Exceso de jornada" value={resumen.total_exceso_jornada} icon={Timer} color={COLOR_EXCESO_JORNADA} />
                    <KpiCard
                        label="Descanso no efectivo"
                        value={resumen.total_descanso_no_efectivo}
                        icon={BedDouble}
                        color={COLOR_DESCANSO_NO_EFECTIVO}
                    />
                    <KpiCard label="Últimos 30 días" value={resumen.recientes_30_dias} icon={AlertTriangle} color="#d03b3b" />
                    <KpiCard label="Última incidencia" value={resumen.ultima_fecha ?? 'Sin registros'} icon={CheckCircle2} color="#3F7A22" />
                </KpiCardGrid>

                <Card className="p-4">
                    <CardContent className="grid gap-3 p-0 sm:grid-cols-2">
                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                            <Timer className="mt-0.5 size-3.5 shrink-0" style={{ color: COLOR_EXCESO_JORNADA }} />
                            <p>
                                <span className="font-semibold text-foreground">Exceso de jornada:</span> trabajaste más tiempo del permitido en tu
                                turno ese día.
                            </p>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                            <BedDouble className="mt-0.5 size-3.5 shrink-0" style={{ color: COLOR_DESCANSO_NO_EFECTIVO }} />
                            <p>
                                <span className="font-semibold text-foreground">Descanso no efectivo:</span> no cumpliste el tiempo mínimo de
                                descanso entre tu salida y tu siguiente entrada.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Turno</TableHead>
                                <TableHead>Entrada</TableHead>
                                <TableHead>Salida</TableHead>
                                <TableHead>Horas trabajadas</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {incidencias.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-muted-foreground py-6 text-center">
                                        No tienes incidencias registradas.
                                    </TableCell>
                                </TableRow>
                            )}
                            {incidencias.data.map((incidencia) => (
                                <TableRow key={incidencia.id}>
                                    <TableCell>{incidencia.fecha}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {incidencia.exceso_jornada && <Badge variant="destructive">Exceso de jornada</Badge>}
                                            {incidencia.descanso_no_efectivo && (
                                                <Badge variant="outline" className="border-transparent bg-amber-500 text-white">
                                                    Descanso no efectivo
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>{incidencia.turno ?? '—'}</TableCell>
                                    <TableCell>{incidencia.entrada ?? '—'}</TableCell>
                                    <TableCell>{incidencia.salida ?? '—'}</TableCell>
                                    <TableCell>{incidencia.horas_trabajadas ?? '—'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {incidencias.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {incidencias.links.map((link, index) => (
                            <Button key={index} variant={link.active ? 'default' : 'outline'} size="sm" disabled={!link.url} asChild={!!link.url}>
                                {link.url ? (
                                    <Link href={link.url} preserveScroll dangerouslySetInnerHTML={{ __html: link.label }} />
                                ) : (
                                    <span dangerouslySetInnerHTML={{ __html: link.label }} />
                                )}
                            </Button>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
