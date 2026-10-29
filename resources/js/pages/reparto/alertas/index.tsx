import AlertasIndex, { type AlertasPaginator } from '@/components/alertas/alertas-index';
import HeadingSmall from '@/components/heading-small';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Reparto', href: '/modules/reparto' },
    { title: 'Alertas', href: '/modules/reparto/alertas' },
];

export default function RepartoAlertasIndex({ alertas, filters }: { alertas: AlertasPaginator; filters: { estado: string } }) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Alertas" />
            <HeadingSmall title="Alertas" description="Vehículos detenidos y demás avisos del pilar Reparto." />
            <AlertasIndex
                routeIndex="reparto.alertas.index"
                routeAtender="reparto.alertas.atender"
                routeDestroy="reparto.alertas.destroy"
                alertas={alertas}
                filters={filters}
            />
        </AppLayout>
    );
}
