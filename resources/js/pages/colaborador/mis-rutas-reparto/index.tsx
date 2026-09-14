import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { CalendarDays, MapPin, Route, Truck, User, Users } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Mis Planeaciones de Ruta', href: '/portal/mis-rutas-reparto' },
];

interface Viaje {
    lugares: string;
    barrio: string;
    cliente: string;
    peso: string;
}

interface MiembroTripulacion {
    colaborador_id?: number | string;
    cedula: string;
    nombres: string;
    cargo: string;
}

interface PlaneacionRow {
    id: number;
    fecha: string | null;
    placa: string;
    cargo: string | null;
    es_conductor: boolean;
    ud_programado_por: string | null;
    despachado_por: string | null;
    viajes: Viaje[];
    tripulacion: MiembroTripulacion[];
}

interface Props {
    planeaciones: PlaneacionRow[];
}

function formatFecha(fecha: string | null): string {
    if (!fecha) return '—';
    const [y, m, d] = fecha.split('-');
    return `${d}/${m}/${y}`;
}

function getDiaSemana(fecha: string | null): string {
    if (!fecha) return '';
    const date = new Date(fecha + 'T12:00:00');
    return date.toLocaleDateString('es-CO', { weekday: 'long' });
}

export default function MisRutasReparto({ planeaciones }: Props) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Mis Planeaciones de Ruta" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall
                    title="Mis Planeaciones de Ruta"
                    description="Rutas de reparto en las que has sido asignado como conductor o tripulante."
                />

                {planeaciones.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                        <Route className="h-12 w-12 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">
                            Todavía no tienes planeaciones de ruta registradas.
                        </p>
                    </div>
                )}

                <div className="grid gap-4">
                    {planeaciones.map((plan) => (
                        <Card
                            key={plan.id}
                            className="border-sidebar-border/70 dark:border-sidebar-border border-l-4 border-l-red-500"
                        >
                            {/* Encabezado de la Card */}
                            <CardHeader className="pb-3 border-b">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                                        <Truck className="h-5 w-5 text-red-600 shrink-0" />
                                        <span className="font-mono text-red-600">{plan.placa}</span>
                                    </CardTitle>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge
                                            variant={plan.es_conductor ? 'default' : 'secondary'}
                                            className={
                                                plan.es_conductor
                                                    ? 'bg-red-600 text-white'
                                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                            }
                                        >
                                            <User className="h-3 w-3 mr-1" />
                                            {plan.es_conductor ? 'Conductor principal' : 'Tripulante'}
                                        </Badge>
                                        {plan.cargo && (
                                            <Badge variant="outline" className="text-xs font-normal">
                                                {plan.cargo}
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                {/* Fecha */}
                                <div className="flex items-center gap-1.5 mt-1">
                                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-sm font-semibold text-foreground">
                                        {formatFecha(plan.fecha)}
                                    </span>
                                    {plan.fecha && (
                                        <span className="text-xs text-muted-foreground capitalize">
                                            — {getDiaSemana(plan.fecha)}
                                        </span>
                                    )}
                                </div>
                            </CardHeader>

                            <CardContent className="pt-4 space-y-4">
                                {/* Datos generales */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                    {plan.ud_programado_por && (
                                        <div>
                                            <p className="text-xs text-muted-foreground font-semibold">
                                                Programado por
                                            </p>
                                            <p className="font-medium text-foreground mt-0.5">
                                                {plan.ud_programado_por}
                                            </p>
                                        </div>
                                    )}
                                    {plan.despachado_por && (
                                        <div>
                                            <p className="text-xs text-muted-foreground font-semibold">
                                                Despachado por
                                            </p>
                                            <p className="font-medium text-foreground mt-0.5">
                                                {plan.despachado_por}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Viajes */}
                                {plan.viajes.length > 0 && (
                                    <div>
                                        <p className="text-xs text-muted-foreground font-semibold mb-2 flex items-center gap-1">
                                            <MapPin className="h-3.5 w-3.5 text-red-500" />
                                            Viajes programados
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {plan.viajes.map((viaje, idx) => (
                                                <div
                                                    key={idx}
                                                    className="bg-muted rounded-md border p-2.5 text-xs space-y-1"
                                                >
                                                    <p className="font-bold text-red-600">Viaje {idx + 1}</p>
                                                    <div className="flex justify-between gap-2">
                                                        <span className="text-muted-foreground">Destino:</span>
                                                        <span className="font-medium text-right">
                                                            {viaje.lugares ? `Nariño — ${viaje.lugares}` : '—'}
                                                        </span>
                                                    </div>
                                                    {viaje.barrio && (
                                                    <div className="flex justify-between gap-2">
                                                        <span className="text-muted-foreground">Barrio:</span>
                                                        <span className="font-medium">{viaje.barrio}</span>
                                                    </div>
                                                    )}
                                                    <div className="flex justify-between gap-2">
                                                        <span className="text-muted-foreground">Cliente:</span>
                                                        <span className="font-medium">{viaje.cliente || '—'}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-2">
                                                        <span className="text-muted-foreground">Peso:</span>
                                                        <span className="font-medium">
                                                            {viaje.peso ? `${viaje.peso} ton` : '—'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Tripulación */}
                                {plan.tripulacion.length > 0 && (
                                    <div>
                                        <p className="text-xs text-muted-foreground font-semibold mb-2 flex items-center gap-1">
                                            <Users className="h-3.5 w-3.5 text-blue-500" />
                                            Tripulación completa
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {plan.tripulacion.map((miembro, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-full px-2.5 py-1 text-xs"
                                                >
                                                    <User className="h-3 w-3 text-blue-500 shrink-0" />
                                                    <span className="font-medium text-blue-800 dark:text-blue-200">
                                                        {miembro.nombres}
                                                    </span>
                                                    {miembro.cargo && (
                                                        <span className="text-blue-500">· {miembro.cargo}</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </AppLayout>
    );
}
