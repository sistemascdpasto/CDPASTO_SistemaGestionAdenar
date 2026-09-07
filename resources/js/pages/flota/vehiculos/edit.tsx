import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { DocumentInfo, VehiculoFormData, VehiculoFormFields } from '@/pages/flota/vehiculos/vehiculo-form-fields';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler } from 'react';

interface EditableVehiculo {
    id: number;
    placa: string;
    truck_type: string | null;
    modelo: string | null;
    capacidad_pallets: number | null;
    is_active: boolean;

    fecha_vencimiento_soat: string | null;
    fecha_vencimiento_tecnomecanica: string | null;

    documento_soat: DocumentInfo[];
    documento_rtm: DocumentInfo[];
    documento_codigo_qr: DocumentInfo[];
    documento_licencia_transito: DocumentInfo[];
}

export default function EditVehiculo({ vehiculo }: { vehiculo: EditableVehiculo }) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Flota', href: '/modules/flota' },
        { title: 'Documentación', href: '/modules/flota/vehiculos' },
        { title: vehiculo.placa, href: `/modules/flota/vehiculos/${vehiculo.id}/edit` },
    ];

    const { data, setData, post, processing, errors, transform } = useForm<VehiculoFormData>({
        placa: vehiculo.placa,
        truck_type: vehiculo.truck_type ?? '',
        modelo: vehiculo.modelo ?? '',
        capacidad_pallets: vehiculo.capacidad_pallets?.toString() ?? '',
        imagen: null,

        fecha_vencimiento_soat: vehiculo.fecha_vencimiento_soat ?? '',
        fecha_vencimiento_tecnomecanica: vehiculo.fecha_vencimiento_tecnomecanica ?? '',

        documento_soat: [],
        documento_rtm: [],
        documento_codigo_qr: [],
        documento_licencia_transito: [],

        is_active: vehiculo.is_active,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        transform((formData) => ({ ...formData, _method: 'PUT' }));
        post(route('flota.vehiculos.update', vehiculo.id), { forceFormData: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Editar vehículo" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall title="Editar vehículo" description="Actualiza los datos y documentos del vehículo." />

                <form onSubmit={submit} className="w-full min-w-0 space-y-6">
                    <VehiculoFormFields
                        data={data}
                        setData={setData}
                        errors={errors}
                        processing={processing}
                        readonlyPlaca
                        existingDocumentos={{
                            documento_soat: vehiculo.documento_soat,
                            documento_rtm: vehiculo.documento_rtm,
                            documento_codigo_qr: vehiculo.documento_codigo_qr,
                            documento_licencia_transito: vehiculo.documento_licencia_transito,
                        }}
                    />

                    <Button type="submit" disabled={processing}>
                        {processing && <LoaderCircle className="size-4 animate-spin" />}
                        Guardar cambios
                    </Button>
                </form>
            </div>
        </AppLayout>
    );
}
