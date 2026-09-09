import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Clock, Save } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Medición de Tiempos en Inventario', href: '/modules/reparto/medicion-tiempos-inventario' },
    { title: 'Nueva Medición', href: '' },
];

interface Vehiculo {
    id: number;
    placa: string;
    modelo: string;
}

interface Colaborador {
    id: number;
    cedula: string;
    nombres: string;
    apellidos: string;
}

interface Props {
    vehiculos: Vehiculo[];
    colaboradores: Colaborador[];
}

export default function MedicionTiemposInventarioCreate({ vehiculos, colaboradores }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        fecha_medicion: new Date().toISOString().split('T')[0],
        placa_vehiculo: '',
        centro: '',
        regional: '',
        cedula_colaborador: '',
        nombre_colaborador: '',
        hora_inicio: '',
        hora_fin: '',
        tipo_inventario: '',
        estado: 'completado',
        observaciones: '',
        vehiculo_id: '',
        colaborador_id: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('reparto.medicion-tiempos-inventario.store'));
    };

    const handleVehiculoChange = (vehiculoId: string) => {
        const vehiculo = vehiculos.find(v => v.id === parseInt(vehiculoId));
        setData({
            ...data,
            vehiculo_id: vehiculoId,
            placa_vehiculo: vehiculo?.placa || '',
        });
    };

    const handleColaboradorChange = (colaboradorId: string) => {
        const colaborador = colaboradores.find(c => c.id === parseInt(colaboradorId));
        setData({
            ...data,
            colaborador_id: colaboradorId,
            cedula_colaborador: colaborador?.cedula || '',
            nombre_colaborador: colaborador ? `${colaborador.nombres} ${colaborador.apellidos}` : '',
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Nueva Medición de Tiempo en Inventario" />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <HeadingSmall>Nueva Medición de Tiempo en Inventario</HeadingSmall>
                    <Link href={route('reparto.medicion-tiempos-inventario.index')}>
                        <Button variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver
                        </Button>
                    </Link>
                </div>

                <div className="rounded-lg border bg-card p-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Información básica */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Información Básica</h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="fecha_medicion">Fecha de Medición *</Label>
                                    <Input
                                        id="fecha_medicion"
                                        type="date"
                                        value={data.fecha_medicion}
                                        onChange={(e) => setData('fecha_medicion', e.target.value)}
                                        error={errors.fecha_medicion}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="tipo_inventario">Tipo de Inventario</Label>
                                    <Select value={data.tipo_inventario} onValueChange={(value) => setData('tipo_inventario', value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar tipo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="inicial">Inicial</SelectItem>
                                            <SelectItem value="final">Final</SelectItem>
                                            <SelectItem value="parcial">Parcial</SelectItem>
                                            <SelectItem value="rotativo">Rotativo</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Información del vehículo */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Información del Vehículo</h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="vehiculo_id">Vehículo</Label>
                                    <Select value={data.vehiculo_id} onValueChange={handleVehiculoChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar vehículo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {vehiculos.map((vehiculo) => (
                                                <SelectItem key={vehiculo.id} value={vehiculo.id.toString()}>
                                                    {vehiculo.placa} - {vehiculo.modelo}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="placa_vehiculo">Placa (Manual)</Label>
                                    <Input
                                        id="placa_vehiculo"
                                        value={data.placa_vehiculo}
                                        onChange={(e) => setData('placa_vehiculo', e.target.value)}
                                        placeholder="Ej: ABC-123"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="centro">Centro</Label>
                                    <Input
                                        id="centro"
                                        value={data.centro}
                                        onChange={(e) => setData('centro', e.target.value)}
                                        placeholder="Ej: Centro Norte"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="regional">Regional</Label>
                                    <Input
                                        id="regional"
                                        value={data.regional}
                                        onChange={(e) => setData('regional', e.target.value)}
                                        placeholder="Ej: Bogotá"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Información del colaborador */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Información del Colaborador</h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="colaborador_id">Colaborador</Label>
                                    <Select value={data.colaborador_id} onValueChange={handleColaboradorChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar colaborador" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {colaboradores.map((colaborador) => (
                                                <SelectItem key={colaborador.id} value={colaborador.id.toString()}>
                                                    {colaborador.nombres} {colaborador.apellidos} - {colaborador.cedula}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="cedula_colaborador">Cédula (Manual)</Label>
                                    <Input
                                        id="cedula_colaborador"
                                        value={data.cedula_colaborador}
                                        onChange={(e) => setData('cedula_colaborador', e.target.value)}
                                        placeholder="Ej: 123456789"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="nombre_colaborador">Nombre del Colaborador (Manual)</Label>
                                    <Input
                                        id="nombre_colaborador"
                                        value={data.nombre_colaborador}
                                        onChange={(e) => setData('nombre_colaborador', e.target.value)}
                                        placeholder="Ej: Juan Pérez"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Información de tiempo */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                Información de Tiempo
                            </h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="hora_inicio">Hora Inicio</Label>
                                    <Input
                                        id="hora_inicio"
                                        type="time"
                                        value={data.hora_inicio}
                                        onChange={(e) => setData('hora_inicio', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="hora_fin">Hora Fin</Label>
                                    <Input
                                        id="hora_fin"
                                        type="time"
                                        value={data.hora_fin}
                                        onChange={(e) => setData('hora_fin', e.target.value)}
                                    />
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                La duración se calculará automáticamente basándose en las horas de inicio y fin.
                            </p>
                        </div>

                        {/* Estado y observaciones */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Estado y Observaciones</h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="estado">Estado *</Label>
                                    <Select value={data.estado} onValueChange={(value) => setData('estado', value)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="completado">Completado</SelectItem>
                                            <SelectItem value="en_proceso">En Proceso</SelectItem>
                                            <SelectItem value="cancelado">Cancelado</SelectItem>
                                            <SelectItem value="pendiente">Pendiente</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="observaciones">Observaciones</Label>
                                <Textarea
                                    id="observaciones"
                                    value={data.observaciones}
                                    onChange={(e) => setData('observaciones', e.target.value)}
                                    placeholder="Agregue cualquier observación relevante..."
                                    rows={3}
                                />
                            </div>
                        </div>

                        {/* Botones de acción */}
                        <div className="flex justify-end gap-4 pt-4 border-t">
                            <Link href={route('reparto.medicion-tiempos-inventario.index')}>
                                <Button variant="outline" type="button">
                                    Cancelar
                                </Button>
                            </Link>
                            <Button type="submit" disabled={processing}>
                                <Save className="mr-2 h-4 w-4" />
                                {processing ? 'Guardando...' : 'Guardar Medición'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}