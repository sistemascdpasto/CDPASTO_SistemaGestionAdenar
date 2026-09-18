import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Clock, LoaderCircle } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

interface MomentoData {
    id: number;
    hora: string;
    fecha_hora: string;
    estado: string;
    observacion: string;
}

interface Props {
    colaborador: {
        id: number;
        nombre_completo: string;
        cedula: string;
        cargo: string | null;
        area: string | null;
    };
    fecha: string;
    ingreso: MomentoData | null;
    salida: MomentoData | null;
}

const ESTADO_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
    Bueno: 'default',
    Regular: 'secondary',
    Malo: 'destructive',
};

function FormMomento({
    condicion,
    label,
}: {
    condicion: MomentoData;
    label: string;
}) {
    const { data, setData, patch, processing, errors } = useForm({
        fecha_hora: condicion.fecha_hora,
        estado: condicion.estado,
        observacion: condicion.observacion,
    });

    const requiereObservacion = data.estado === 'Regular' || data.estado === 'Malo';

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        patch(route('seguridad.condiciones-salud.update', condicion.id), {
            preserveScroll: true,
        });
    };

    return (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            {/* Encabezado del momento */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{label}</span>
                    <Badge variant={ESTADO_VARIANT[condicion.estado] ?? 'secondary'}>
                        {condicion.estado}
                    </Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3.5" />
                    {condicion.hora}
                </div>
            </div>

            <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-2">
                    <Label htmlFor={`fecha_hora-${condicion.id}`}>Fecha y Hora</Label>
                    <Input
                        id={`fecha_hora-${condicion.id}`}
                        type="datetime-local"
                        value={data.fecha_hora}
                        onChange={(e) => setData('fecha_hora', e.target.value)}
                    />
                    <InputError message={errors.fecha_hora} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`estado-${condicion.id}`}>Estado</Label>
                    <Select value={data.estado} onValueChange={(v) => setData('estado', v)}>
                        <SelectTrigger id={`estado-${condicion.id}`}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Bueno">Bueno</SelectItem>
                            <SelectItem value="Regular">Regular</SelectItem>
                            <SelectItem value="Malo">Malo</SelectItem>
                        </SelectContent>
                    </Select>
                    <InputError message={errors.estado} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`observacion-${condicion.id}`}>
                        Observación{requiereObservacion && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Textarea
                        id={`observacion-${condicion.id}`}
                        rows={3}
                        value={data.observacion}
                        onChange={(e) => setData('observacion', e.target.value)}
                        placeholder={
                            requiereObservacion
                                ? 'Describa la condición del colaborador'
                                : 'Observaciones adicionales (opcional)'
                        }
                    />
                    <InputError message={errors.observacion} />
                </div>

                <div className="flex justify-end">
                    <Button type="submit" disabled={processing} size="sm">
                        {processing && <LoaderCircle className="size-4 animate-spin" />}
                        Guardar {label.toLowerCase()}
                    </Button>
                </div>
            </form>
        </div>
    );
}

function FormCrearMomento({
    colaboradorId,
    momento,
    fecha,
}: {
    colaboradorId: number;
    momento: 'ingreso' | 'salida';
    fecha: string;
}) {
    const defaultHora = momento === 'ingreso' ? '08:00' : '17:00';
    const initialFechaHora = `${fecha}T${defaultHora}`;

    const { data, setData, post, processing, errors } = useForm({
        colaborador_id: colaboradorId,
        momento,
        estado: 'Bueno',
        observacion: '',
        fecha_hora: initialFechaHora,
        _redirect_editar: true,
    });

    const requiereObservacion = data.estado === 'Regular' || data.estado === 'Malo';

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('seguridad.condiciones-salud.store'), {
            preserveScroll: true,
        });
    };

    const label = momento === 'ingreso' ? 'Ingreso' : 'Salida';

    return (
        <div className="rounded-2xl border border-dashed border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">Crear {label.toLowerCase()}</span>
                    <Badge variant="outline">Sin registro</Badge>
                </div>
            </div>

            <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-2">
                    <Label htmlFor={`crear-fecha_hora-${momento}`}>Fecha y Hora</Label>
                    <Input
                        id={`crear-fecha_hora-${momento}`}
                        type="datetime-local"
                        value={data.fecha_hora}
                        onChange={(e) => setData('fecha_hora', e.target.value)}
                    />
                    <InputError message={errors.fecha_hora} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`crear-estado-${momento}`}>Estado</Label>
                    <Select value={data.estado} onValueChange={(v) => setData('estado', v)}>
                        <SelectTrigger id={`crear-estado-${momento}`}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Bueno">Bueno</SelectItem>
                            <SelectItem value="Regular">Regular</SelectItem>
                            <SelectItem value="Malo">Malo</SelectItem>
                        </SelectContent>
                    </Select>
                    <InputError message={errors.estado} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`crear-observacion-${momento}`}>
                        Observación{requiereObservacion && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Textarea
                        id={`crear-observacion-${momento}`}
                        rows={3}
                        value={data.observacion}
                        onChange={(e) => setData('observacion', e.target.value)}
                        placeholder={
                            requiereObservacion
                                ? 'Describa la condición del colaborador'
                                : 'Observaciones adicionales (opcional)'
                        }
                    />
                    <InputError message={errors.observacion} />
                </div>

                <div className="flex justify-end">
                    <Button type="submit" disabled={processing} size="sm">
                        {processing && <LoaderCircle className="size-4 animate-spin" />}
                        Crear {label.toLowerCase()}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default function CondicionSaludEdit({ colaborador, fecha, ingreso, salida }: Props) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Seguridad', href: '/modules/seguridad' },
        { title: 'Condiciones de Salud', href: route('seguridad.condiciones-salud.index') },
        { title: `Editar — ${colaborador.nombre_completo}`, href: '#' },
    ];

    const [seleccion, setSeleccion] = useState<'ingreso' | 'salida'>(
        ingreso ? 'ingreso' : 'salida',
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Editar condición — ${colaborador.nombre_completo}`} />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" asChild className="-ml-2">
                                <Link href={route('seguridad.condiciones-salud.index')}>
                                    <ArrowLeft className="size-4" />
                                    Volver
                                </Link>
                            </Button>
                        </div>
                        <h1 className="text-xl font-bold text-foreground">
                            Editar condición de salud
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {colaborador.nombre_completo} &nbsp;·&nbsp; CC {colaborador.cedula}
                            {colaborador.cargo && <> &nbsp;·&nbsp; {colaborador.cargo}</>}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">{fecha}</p>
                    </div>
                </div>

                {/* Selector ingreso / salida */}
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setSeleccion('ingreso')}
                        className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors ${
                            seleccion === 'ingreso'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-card text-muted-foreground hover:bg-muted'
                        }`}
                    >
                        Ingreso
                        {ingreso ? (
                            <span className="ml-2 text-xs font-normal opacity-75">
                                {ingreso.hora}
                            </span>
                        ) : (
                            <span className="ml-2 text-xs font-normal opacity-60">
                                (Sin registro)
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => setSeleccion('salida')}
                        className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors ${
                            seleccion === 'salida'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-card text-muted-foreground hover:bg-muted'
                        }`}
                    >
                        Salida
                        {salida ? (
                            <span className="ml-2 text-xs font-normal opacity-75">
                                {salida.hora}
                            </span>
                        ) : (
                            <span className="ml-2 text-xs font-normal opacity-60">
                                (Sin registro)
                            </span>
                        )}
                    </button>
                </div>

                {/* Formulario del momento seleccionado */}
                {seleccion === 'ingreso' ? (
                    ingreso ? (
                        <FormMomento condicion={ingreso} label="Ingreso" />
                    ) : (
                        <FormCrearMomento colaboradorId={colaborador.id} momento="ingreso" fecha={fecha} />
                    )
                ) : salida ? (
                    <FormMomento condicion={salida} label="Salida" />
                ) : (
                    <FormCrearMomento colaboradorId={colaborador.id} momento="salida" fecha={fecha} />
                )}
            </div>
        </AppLayout>
    );
}
