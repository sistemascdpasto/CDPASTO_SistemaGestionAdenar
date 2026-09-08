import { PilarResumen, type PilarResumenData } from '@/components/dashboard/pilar-resumen';
import { ModuleCard } from '@/components/module-card';
import { Reveal } from '@/components/reveal';
import { ShinyText } from '@/components/shiny-text';
import { modules } from '@/data/modules';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, usePage } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
];

interface Resumen {
    rango: { desde: string; hasta: string };
    pilares: Record<string, PilarResumenData>;
}

export default function RoleDashboard({ modules: accessibleSlugs, resumen }: { modules: string[]; resumen: Resumen }) {
    const { auth } = usePage<SharedData>().props;
    const accessibleModules = modules.filter((mod) => accessibleSlugs.includes(mod.slug));
    const conResumen = accessibleModules.filter((mod) => resumen.pilares[mod.slug]);
    const sinResumen = accessibleModules.filter((mod) => !resumen.pilares[mod.slug]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-8 rounded-xl p-4">
                <Reveal>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Bienvenido, <ShinyText color={accessibleModules[0]?.accent ?? '#3F7A22'}>{auth.user.name}</ShinyText>
                    </h1>
                    <p className="text-muted-foreground">
                        Resumen de {conResumen.length === 1 ? 'tu pilar' : 'tus pilares'} de trabajo · últimos 6 meses ({resumen.rango.desde} —{' '}
                        {resumen.rango.hasta}).
                    </p>
                </Reveal>

                {accessibleModules.length === 0 && (
                    <p className="text-muted-foreground">Todavía no tienes módulos asignados. Contacta a un administrador.</p>
                )}

                {conResumen.map((mod) => (
                    <PilarResumen key={mod.slug} slug={mod.slug} data={resumen.pilares[mod.slug]} />
                ))}

                {sinResumen.length > 0 && (
                    <div>
                        <h2 className="mb-3 text-lg font-medium tracking-tight">Otros módulos</h2>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                            {sinResumen.map((mod, index) => (
                                <Reveal key={mod.slug} delay={index * 80}>
                                    <ModuleCard title={mod.title} href={`/modules/${mod.slug}`} icon={mod.icon} color={mod.accent} />
                                </Reveal>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
