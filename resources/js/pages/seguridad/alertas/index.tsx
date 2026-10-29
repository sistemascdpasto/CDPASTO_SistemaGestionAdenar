import HeadingSmall from '@/components/heading-small';
import AlertasIndex, { type AlertasPaginator } from '@/components/alertas/alertas-index';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'Alertas', href: '/modules/seguridad/alertas' },
];

export default function SeguridadAlertasIndex({ alertas, filters }: { alertas: AlertasPaginator; filters: { estado: string } }) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Alertas" />
            <HeadingSmall title="Alertas" description="Pruebas positivas, salud crítica, y dispositivos que requieren atención." />
            <AlertasIndex
                routeIndex="seguridad.alertas.index"
                routeAtender="seguridad.alertas.atender"
                routeDestroy="seguridad.alertas.destroy"
                alertas={alertas}
                filters={filters}
            />
        </AppLayout>
    );
}
