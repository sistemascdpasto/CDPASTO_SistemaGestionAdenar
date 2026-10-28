import AlertasIndex, { type AlertasPaginator } from '@/components/alertas/alertas-index';
import HeadingSmall from '@/components/heading-small';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Flota', href: '/modules/flota' },
    { title: 'Alertas', href: '/modules/flota/alertas' },
];

export default function FlotaAlertasIndex({ alertas, filters }: { alertas: AlertasPaginator; filters: { estado: string } }) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Alertas" />
            <HeadingSmall title="Alertas" description="Vencimientos de SOAT, tecnomecánica y demás avisos del pilar Flota." />
            <AlertasIndex routeIndex="flota.alertas.index" routeAtender="flota.alertas.atender" alertas={alertas} filters={filters} />
        </AppLayout>
    );
}
