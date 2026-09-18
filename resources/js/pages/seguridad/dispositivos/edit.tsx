import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { DispositivoFormData, MantenimientoGuardado } from '@/pages/seguridad/dispositivos/dispositivo-form-fields';
import { DispositivoFormFields } from '@/pages/seguridad/dispositivos/dispositivo-form-fields';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

interface EditableDispositivo {
    id: number;
    codigo: string;
    marca: string | null;
    modelo: string | null;
    fecha_calibracion: string | null;
    fecha_vencimiento_certificado: string | null;
    valor_min: string;
    valor_max: string;
    estado: string;
    imagenes_paths?: string[];
    documentos_paths?: { id: number; url: string; nombre_original: string }[];
}

export default function EditDispositivo({
    dispositivo,
    mantenimientos = [],
}: {
    dispositivo: EditableDispositivo;
    mantenimientos?: MantenimientoGuardado[];
}) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Seguridad', href: '/modules/seguridad' },
        { title: 'Dispositivos', href: '/modules/seguridad/dispositivos' },
        { title: dispositivo.codigo, href: `/modules/seguridad/dispositivos/${dispositivo.id}/edit` },
    ];

    const [data, setDataState] = useState<DispositivoFormData>({
        codigo: dispositivo.codigo,
        marca: dispositivo.marca ?? '',
        modelo: dispositivo.modelo ?? '',
        fecha_calibracion: dispositivo.fecha_calibracion ?? '',
        fecha_vencimiento_certificado: dispositivo.fecha_vencimiento_certificado ?? '',
        valor_min: dispositivo.valor_min,
        valor_max: dispositivo.valor_max,
        estado: dispositivo.estado,
        imagenes: [],
        deleted_imagenes_indices: [],
        documentos: [],
        deleted_documentos_indices: [],
        mantenimientos: [],
    });

    const [errors, setErrors] = useState<Partial<Record<keyof DispositivoFormData, string>>>({});
    const [processing, setProcessing] = useState(false);

    const setData = <K extends keyof DispositivoFormData>(key: K, value: DispositivoFormData[K]) => {
        setDataState((prev) => ({ ...prev, [key]: value }));
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        setProcessing(true);
        setErrors({});

        const form = new FormData();
        form.append('_method', 'PUT');
        form.append('codigo', data.codigo ?? '');
        form.append('marca', data.marca ?? '');
        form.append('modelo', data.modelo ?? '');
        form.append('fecha_calibracion', data.fecha_calibracion ?? '');
        form.append('fecha_vencimiento_certificado', data.fecha_vencimiento_certificado ?? '');
        form.append('valor_min', data.valor_min ?? '0');
        form.append('valor_max', data.valor_max ?? '0.1');
        form.append('estado', data.estado ?? 'Disponible');

        (data.imagenes as File[]).forEach((file) => {
            form.append('imagenes[]', file);
        });

        (data.deleted_imagenes_indices as number[]).forEach((index) => {
            form.append('deleted_imagenes_indices[]', String(index));
        });

        (data.documentos as File[]).forEach((file) => {
            form.append('documentos[]', file);
        });

        (data.deleted_documentos_indices as number[]).forEach((index) => {
            form.append('deleted_documentos_indices[]', String(index));
        });

        (data.mantenimientos as { fecha: string; descripcion: string }[]).forEach((m, i) => {
            form.append(`mantenimientos[${i}][fecha]`, m.fecha);
            form.append(`mantenimientos[${i}][descripcion]`, m.descripcion);
        });

        router.post(route('seguridad.dispositivos.update', dispositivo.id), form as any, {
            onError: (errs) => {
                setErrors(errs as any);
                setProcessing(false);
            },
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Editar dispositivo" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall title="Editar dispositivo" description="Actualiza la informacion tecnica del alcoholimetro." />

                <form onSubmit={submit} className="grid gap-6">
                    <DispositivoFormFields
                        data={data}
                        setData={setData}
                        errors={errors}
                        processing={processing}
                        savedImagenes={dispositivo.imagenes_paths ?? []}
                        savedDocumentos={dispositivo.documentos_paths ?? []}
                        savedMantenimientos={mantenimientos}
                    />

                    <div className="flex justify-end">
                        <Button type="submit" disabled={processing}>
                            {processing && <LoaderCircle className="size-4 animate-spin" />}
                            Guardar cambios
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}