import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { CarretaFormData, CarretaFormFields } from '@/pages/flota/carretas/carreta-form-fields';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler } from 'react';

interface EditableCarreta {
    id: number;
    identificacion: string;
    tipo: string | null;
    is_active: boolean;
}

export default function EditCarreta({ carreta }: { carreta: EditableCarreta }) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Flota', href: '/modules/flota' },
        { title: 'Carretas', href: '/modules/flota/carretas' },
        { title: carreta.identificacion, href: `/modules/flota/carretas/${carreta.id}/edit` },
    ];

    const { data, setData, put, processing, errors } = useForm<CarretaFormData>({
        identificacion: carreta.identificacion,
        tipo: carreta.tipo ?? '',
        is_active: carreta.is_active,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        put(route('flota.carretas.update', carreta.id));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Editar ${carreta.identificacion}`} />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall title={`Editar carreta ${carreta.identificacion}`} description="Actualiza los datos de la carreta." />

                <form onSubmit={submit} className="w-full min-w-0 space-y-6">
                    <CarretaFormFields data={data} setData={setData} errors={errors} processing={processing} />

                    <Button type="submit" disabled={processing}>
                        {processing && <LoaderCircle className="size-4 animate-spin" />}
                        Guardar cambios
                    </Button>
                </form>
            </div>
        </AppLayout>
    );
}
