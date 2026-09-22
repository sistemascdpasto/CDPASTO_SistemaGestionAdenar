import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { CarretaFormData, CarretaFormFields } from '@/pages/flota/carretas/carreta-form-fields';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Flota', href: '/modules/flota' },
    { title: 'Carretas', href: '/modules/flota/carretas' },
    { title: 'Nueva carreta', href: '/modules/flota/carretas/create' },
];

export default function CreateCarreta() {
    const { data, setData, post, processing, errors } = useForm<CarretaFormData>({
        placa: '',
        tipo: '',
        is_active: true,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('flota.carretas.store'));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Nueva carreta" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall title="Nueva carreta" description="Registra una carreta y su disponibilidad." />

                <form onSubmit={submit} className="w-full min-w-0 space-y-6">
                    <CarretaFormFields data={data} setData={setData} errors={errors} processing={processing} />

                    <Button type="submit" disabled={processing}>
                        {processing && <LoaderCircle className="size-4 animate-spin" />}
                        Crear carreta
                    </Button>
                </form>
            </div>
        </AppLayout>
    );
}
