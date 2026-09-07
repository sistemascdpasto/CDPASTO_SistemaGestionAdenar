import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { VehiculoFormData, VehiculoFormFields } from '@/pages/flota/vehiculos/vehiculo-form-fields';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Flota', href: '/modules/flota' },
    { title: 'Documentación', href: '/modules/flota/vehiculos' },
    { title: 'Nuevo vehículo', href: '/modules/flota/vehiculos/create' },
];

export default function CreateVehiculo() {
    const { data, setData, post, processing, errors } = useForm<VehiculoFormData>({
        placa: '',
        truck_type: '',
        modelo: '',
        capacidad_pallets: '',
        imagen: null,

        fecha_vencimiento_soat: '',
        fecha_vencimiento_tecnomecanica: '',

        documento_soat: [],
        documento_rtm: [],
        documento_codigo_qr: [],
        documento_licencia_transito: [],

        is_active: true,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('flota.vehiculos.store'), { forceFormData: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Nuevo vehículo" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall title="Nuevo vehículo" description="Registra un camión y su documentación habilitante." />

                <form onSubmit={submit} className="w-full min-w-0 space-y-6">
                    <VehiculoFormFields data={data} setData={setData} errors={errors} processing={processing} />

                    <Button type="submit" disabled={processing}>
                        {processing && <LoaderCircle className="size-4 animate-spin" />}
                        Crear vehículo
                    </Button>
                </form>
            </div>
        </AppLayout>
    );
}
