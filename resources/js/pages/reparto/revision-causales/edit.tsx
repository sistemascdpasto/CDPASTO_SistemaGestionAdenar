import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { CausalFormData, CausalFormFields } from '@/pages/reparto/revision-causales/causal-form-fields';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler } from 'react';

interface EditableCausal {
    id: number;
    nombre: string;
    requiere_especificacion: boolean;
    is_active: boolean;
}

export default function EditRevisionCausal({ causal }: { causal: EditableCausal }) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Reparto', href: '/modules/reparto' },
        { title: 'Revisión Aleatoria', href: '/modules/reparto/revision-aleatoria' },
        { title: 'Causales', href: '/modules/reparto/revision-causales' },
        { title: causal.nombre, href: `/modules/reparto/revision-causales/${causal.id}/edit` },
    ];

    const { data, setData, put, processing, errors } = useForm<CausalFormData>({
        nombre: causal.nombre,
        requiere_especificacion: causal.requiere_especificacion,
        is_active: causal.is_active,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        put(route('reparto.revision-causales.update', causal.id));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Editar ${causal.nombre}`} />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall title={`Editar causal ${causal.nombre}`} description="Actualiza los datos de la causal." />

                <form onSubmit={submit} className="w-full min-w-0 space-y-6">
                    <CausalFormFields data={data} setData={setData} errors={errors} processing={processing} />

                    <Button type="submit" disabled={processing}>
                        {processing && <LoaderCircle className="size-4 animate-spin" />}
                        Guardar cambios
                    </Button>
                </form>
            </div>
        </AppLayout>
    );
}
