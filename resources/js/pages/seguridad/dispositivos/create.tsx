import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { DispositivoFormData, DispositivoFormFields } from '@/pages/seguridad/dispositivos/dispositivo-form-fields';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'Dispositivos', href: '/modules/seguridad/dispositivos' },
    { title: 'Nuevo dispositivo', href: '/modules/seguridad/dispositivos/create' },
];

export default function CreateDispositivo() {
    const { data, setData, post, processing, errors } = useForm<DispositivoFormData>({
        codigo: '',
        marca: '',
        modelo: '',
        fecha_calibracion: '',
        fecha_vencimiento_certificado: '',
        documento: null,
        valor_min: '0',
        valor_max: '0.1',
        estado: 'Disponible',
        imagenes: [],
        deleted_imagenes_indices: [],
        documentos: [],
        deleted_documentos_indices: [],
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('seguridad.dispositivos.store'));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Nuevo dispositivo" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall title="Nuevo dispositivo" description="Registra un alcoholímetro y su información técnica." />

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
