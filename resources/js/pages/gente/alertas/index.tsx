import AlertasIndex, { type AlertasPaginator } from '@/components/alertas/alertas-index';
import HeadingSmall from '@/components/heading-small';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'Alertas', href: '/modules/gente/alertas' },
];

export default function GenteAlertasIndex({ alertas, filters }: { alertas: AlertasPaginator; filters: { estado: string } }) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Alertas" />
            <HeadingSmall title="Alertas" description="Contratos próximos a vencer y demás avisos del pilar Gente." />
            <AlertasIndex
                routeIndex="gente.alertas.index"
                routeAtender="gente.alertas.atender"
                routeDestroy="gente.alertas.destroy"
                alertas={alertas}
                filters={filters}
            />
        </AppLayout>
    );
}
