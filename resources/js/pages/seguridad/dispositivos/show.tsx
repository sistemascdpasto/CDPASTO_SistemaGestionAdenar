import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/input-error';
import { SafeImage } from '@/components/safe-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { AlertTriangle, ImageIcon, LoaderCircle } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

interface DispositivoDetalle {
    id: number;
    codigo: string;
    marca: string | null;
    modelo: string | null;
    estado: string;
    fecha_calibracion: string | null;
    fecha_vencimiento_certificado: string | null;
    valor_min: string;
    valor_max: string;
    calibracion_proxima: boolean;
    imagenes_paths?: string[];
}

interface MantenimientoRow {
    id: number;
    fecha: string;
    descripcion: string;
    realizado_por: { name: string } | null;
}

const ESTADO_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
    Disponible: 'default',
    'En uso': 'secondary',
    'En mantenimiento': 'secondary',
    'Fuera de servicio': 'destructive',
};

export default function DispositivoShow({ dispositivo, mantenimientos }: { dispositivo: DispositivoDetalle; mantenimientos: MantenimientoRow[] }) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Seguridad', href: '/modules/seguridad' },
        { title: 'Dispositivos', href: '/modules/seguridad/dispositivos' },
        { title: dispositivo.codigo, href: `/modules/seguridad/dispositivos/${dispositivo.id}` },
    ];

    const { data, setData, post, processing, errors, reset } = useForm({ fecha: '', descripcion: '' });
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const submitMantenimiento: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('seguridad.dispositivos.mantenimientos.store', dispositivo.id), {
            preserveScroll: true,
            onSuccess: () => reset(),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={dispositivo.codigo} />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-3">
                    <HeadingSmall
                        title={dispositivo.codigo}
                        description={[dispositivo.marca, dispositivo.modelo].filter(Boolean).join(' / ') || 'Alcoholímetro'}
                    />
                    <Badge variant={ESTADO_VARIANT[dispositivo.estado] ?? 'default'}>{dispositivo.estado}</Badge>
                    {dispositivo.calibracion_proxima && (
                        <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="size-3" />
                            Calibración/certificado próximo a vencer
                        </Badge>
                    )}
                </div>

                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">Detalle técnico</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
                        <p>Rango válido: {dispositivo.valor_min} — {dispositivo.valor_max}</p>
                        <p>Fecha de calibración: {dispositivo.fecha_calibracion ?? '—'}</p>
                        <p>Vencimiento del certificado: {dispositivo.fecha_vencimiento_certificado ?? '—'}</p>
                    </CardContent>
                </Card>

                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <ImageIcon className="size-4" />
                            Imágenes
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {dispositivo.imagenes_paths && dispositivo.imagenes_paths.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                                {dispositivo.imagenes_paths.map((path, index) => (
                                    <button key={index} type="button" onClick={() => setSelectedImage(path)} className="group">
                                        <SafeImage
                                            src={path}
                                            alt={`Imagen ${index + 1} de ${dispositivo.codigo}`}
                                            className="h-24 w-full rounded-lg border border-border object-cover transition-transform group-hover:scale-105"
                                        />
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No se han cargado imágenes.</p>
                        )}
                    </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-3">
                        <h2 className="text-lg font-medium tracking-tight">Historial de mantenimientos</h2>
                        <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Descripción</TableHead>
                                        <TableHead>Realizado por</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mantenimientos.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-muted-foreground py-6 text-center">
                                                Sin mantenimientos registrados.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {mantenimientos.map((mantenimiento) => (
                                        <TableRow key={mantenimiento.id}>
                                            <TableCell>{mantenimiento.fecha}</TableCell>
                                            <TableCell>{mantenimiento.descripcion}</TableCell>
                                            <TableCell>{mantenimiento.realizado_por?.name ?? '—'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h2 className="text-lg font-medium tracking-tight">Registrar mantenimiento</h2>
                        <form onSubmit={submitMantenimiento} className="space-y-4 rounded-lg border border-sidebar-border/70 p-4 dark:border-sidebar-border">
                            <div className="grid gap-2">
                                <Label htmlFor="fecha">Fecha</Label>
                                <Input id="fecha" type="date" value={data.fecha} onChange={(e) => setData('fecha', e.target.value)} required />
                                <InputError message={errors.fecha} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="descripcion">Descripción</Label>
                                <textarea
                                    id="descripcion"
                                    className="border-input bg-background flex min-h-24 w-full rounded-md border px-3 py-2 text-sm"
                                    value={data.descripcion}
                                    onChange={(e) => setData('descripcion', e.target.value)}
                                    required
                                />
                                <InputError message={errors.descripcion} />
                            </div>
                            <Button type="submit" disabled={processing}>
                                {processing && <LoaderCircle className="size-4 animate-spin" />}
                                Registrar mantenimiento
                            </Button>
                        </form>
                    </div>
                </div>
            </div>

            {selectedImage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setSelectedImage(null)}>
                    <img
                        src={selectedImage}
                        alt="Vista previa"
                        className="h-auto max-h-[85vh] w-full max-w-4xl rounded-lg object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </AppLayout>
    );
}
