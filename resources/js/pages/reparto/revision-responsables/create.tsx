import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { ColaboradorSearchSelect, type ColaboradorOption } from '@/pages/seguridad/pruebas/colaborador-search-select';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Revisión Aleatoria', href: '/modules/reparto/revision-aleatoria' },
    { title: 'Responsables', href: '/modules/reparto/revision-responsables' },
    { title: 'Agregar responsable', href: '/modules/reparto/revision-responsables/create' },
];

interface FormData {
    colaborador_id: string;
    [key: string]: string;
}

export default function CreateRevisionResponsable({ colaboradores }: { colaboradores: ColaboradorOption[] }) {
    const { data, setData, post, processing, errors } = useForm<FormData>({ colaborador_id: '' });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('reparto.revision-responsables.store'));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Agregar responsable" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall title="Agregar responsable" description="Selecciona un colaborador activo para que participe en la ruleta." />

                <form onSubmit={submit} className="w-full max-w-md space-y-6">
                    <ColaboradorSearchSelect
                        id="colaborador_id"
                        label="Colaborador"
                        colaboradores={colaboradores}
                        selectedId={data.colaborador_id}
                        onSelect={(c) => setData('colaborador_id', c ? String(c.id) : '')}
                        error={errors.colaborador_id}
                    />

                    <Button type="submit" disabled={processing || !data.colaborador_id}>
                        {processing && <LoaderCircle className="size-4 animate-spin" />}
                        Agregar a la ruleta
                    </Button>
                </form>
            </div>
        </AppLayout>
    );
}
