import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { DispositivoFormData, DispositivoFormFields } from '@/pages/seguridad/dispositivos/dispositivo-form-fields';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'Dispositivos', href: '/modules/seguridad/dispositivos' },
    { title: 'Nuevo dispositivo', href: '/modules/seguridad/dispositivos/create' },
];

const emptyForm = (): DispositivoFormData => ({
    codigo: '',
    marca: '',
    modelo: '',
    fecha_calibracion: '',
    fecha_vencimiento_certificado: '',
    valor_min: '0',
    valor_max: '0.1',
    estado: 'Disponible',
    imagenes: [],
    deleted_imagenes_indices: [],
    documentos: [],
    deleted_documentos_indices: [],
    mantenimientos: [],
});

export default function CreateDispositivo() {
    const [data, setDataState] = useState<DispositivoFormData>(emptyForm());
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

        (data.documentos as File[]).forEach((file) => {
            form.append('documentos[]', file);
        });

        (data.mantenimientos as { fecha: string; descripcion: string }[]).forEach((m, i) => {
            form.append(`mantenimientos[${i}][fecha]`, m.fecha);
            form.append(`mantenimientos[${i}][descripcion]`, m.descripcion);
        });

        router.post(route('seguridad.dispositivos.store'), form as any, {
            onError: (errs) => {
                setErrors(errs as any);
                setProcessing(false);
            },
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Nuevo dispositivo" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall title="Nuevo dispositivo" description="Registra un alcoholimetro y su informacion tecnica." />

                <form onSubmit={submit} className="grid gap-6">
                    <DispositivoFormFields data={data} setData={setData} errors={errors} processing={processing} />

                    <div className="flex justify-end">
                        <Button type="submit" disabled={processing}>
                            {processing && <LoaderCircle className="size-4 animate-spin" />}
                            Registrar dispositivo
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}