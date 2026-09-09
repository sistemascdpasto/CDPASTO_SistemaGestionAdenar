import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Clock, Calendar, User, Truck, MapPin, FileText, Edit, Trash2 } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Medición de Tiempos en Inventario', href: '/modules/reparto/medicion-tiempos-inventario' },
    { title: 'Detalle', href: '' },
];

interface ColaboradorInfo {
    nombre_completo: string;
    cedula: string;
}

interface VehiculoInfo {
    placa: string;
    modelo: string;
}

interface Registro {
    id: number;
    fecha_medicion: string | null;
    placa_vehiculo: string | null;
    centro: string | null;
    regional: string | null;
    cedula_colaborador: string | null;
    nombre_colaborador: string | null;
    hora_inicio: string | null;
    hora_fin: string | null;
    duracion_minutos: number | null;
    tipo_inventario: string | null;
    estado: string | null;
    observaciones: string | null;
    creado_por: string | null;
    fecha_creacion: string | null;
    usuario: string | null;
    colaborador_info: ColaboradorInfo | null;
    vehiculo_info: VehiculoInfo | null;
}

interface Props {
    registro: Registro;
}

function formatFecha(fecha: string | null) {
    if (!fecha) return '-';
    const [y, m, d] = fecha.split('-');
    return `${d}/${m}/${y}`;
}

function formatHora(hora: string | null) {
    return hora || '-';
}

function formatDuracion(minutos: number | null) {
    if (!minutos) return '-';
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (horas > 0) {
        return `${horas}h ${mins}m`;
    }
    return `${mins}m`;
}

function getEstadoBadge(estado: string | null) {
    if (!estado) return <Badge variant="secondary">Sin estado</Badge>;
    
    const variant = estado.toLowerCase() === 'completado' ? 'default' : 
                    estado.toLowerCase() === 'en_proceso' ? 'secondary' : 
                    estado.toLowerCase() === 'cancelado' ? 'destructive' : 'outline';
    
    return <Badge variant={variant}>{estado}</Badge>;
}

export default function MedicionTiemposInventarioShow({ registro }: Props) {
    const deleteRegistro = () => {
        if (confirm('¿Está seguro de eliminar esta medición de tiempo?')) {
            window.location.href = route('reparto.medicion-tiempos-inventario.destroy', registro.id);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Detalle de Medición #${registro.id}`} />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <HeadingSmall>Detalle de Medición #{registro.id}</HeadingSmall>
                    <div className="flex gap-2">
                        <Link href={route('reparto.medicion-tiempos-inventario.edit', registro.id)}>
                            <Button variant="outline">
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                            </Button>
                        </Link>
                        <Button variant="destructive" onClick={deleteRegistro}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Información General */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Información General
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Fecha de Medición</p>
                                    <p className="font-medium">{formatFecha(registro.fecha_medicion)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Tipo de Inventario</p>
                                    <p className="font-medium">
                                        {registro.tipo_inventario ? (
                                            <Badge variant="outline">{registro.tipo_inventario}</Badge>
                                        ) : '-'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Estado</p>
                                    <p className="font-medium">{getEstadoBadge(registro.estado)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">ID Registro</p>
                                    <p className="font-medium">#{registro.id}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Información de Tiempo */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                Información de Tiempo
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Hora Inicio</p>
                                    <p className="font-medium">{formatHora(registro.hora_inicio)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Hora Fin</p>
                                    <p className="font-medium">{formatHora(registro.hora_fin)}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-sm text-muted-foreground">Duración Total</p>
                                    <p className="text-2xl font-bold">{formatDuracion(registro.duracion_minutos)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Información del Vehículo */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Truck className="h-5 w-5" />
                                Información del Vehículo
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Placa</p>
                                    <p className="font-medium">{registro.placa_vehiculo || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Modelo</p>
                                    <p className="font-medium">{registro.vehiculo_info?.modelo || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Centro</p>
                                    <p className="font-medium">{registro.centro || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Regional</p>
                                    <p className="font-medium">{registro.regional || '-'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Información del Colaborador */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Información del Colaborador
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Nombre</p>
                                    <p className="font-medium">
                                        {registro.colaborador_info?.nombre_completo || registro.nombre_colaborador || '-'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Cédula</p>
                                    <p className="font-medium">
                                        {registro.colaborador_info?.cedula || registro.cedula_colaborador || '-'}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Información de Registro */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Información de Registro
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <p className="text-sm text-muted-foreground">Registrado por</p>
                                    <p className="font-medium flex items-center gap-2">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        {registro.usuario || registro.creado_por || '-'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Fecha de Registro</p>
                                    <p className="font-medium">
                                        {registro.fecha_creacion 
                                            ? new Date(registro.fecha_creacion).toLocaleString('es-CO')
                                            : '-'}
                                    </p>
                                </div>
                            </div>
                            {registro.observaciones && (
                                <div className="mt-4 pt-4 border-t">
                                    <p className="text-sm text-muted-foreground mb-2">Observaciones</p>
                                    <p className="text-sm bg-muted p-3 rounded-md">{registro.observaciones}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="flex justify-start">
                    <Link href={route('reparto.medicion-tiempos-inventario.index')}>
                        <Button variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver al Listado
                        </Button>
                    </Link>
                </div>
            </div>
        </AppLayout>
    );
}