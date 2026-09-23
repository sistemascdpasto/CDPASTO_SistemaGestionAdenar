import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { CausalFormData, CausalFormFields } from '@/pages/reparto/revision-causales/causal-form-fields';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Revisión Aleatoria', href: '/modules/reparto/revision-aleatoria' },
    { title: 'Causales', href: '/modules/reparto/revision-causales' },
    { title: 'Nueva causal', href: '/modules/reparto/revision-causales/create' },
];

export default function CreateRevisionCausal() {
    const { data, setData, post, processing, errors } = useForm<CausalFormData>({
        nombre: '',
        requiere_especificacion: false,
        is_active: true,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('reparto.revision-causales.store'));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Nueva causal" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall title="Nueva causal" description="Agrega un motivo de novedad disponible en la Revisión Aleatoria." />

                <form onSubmit={submit} className="w-full min-w-0 space-y-6">
                    <CausalFormFields data={data} setData={setData} errors={errors} processing={processing} />

                    <Button type="submit" disabled={processing}>
                        {processing && <LoaderCircle className="size-4 animate-spin" />}
                        Crear causal
                    </Button>
                </form>
            </div>
        </AppLayout>
    );
}
