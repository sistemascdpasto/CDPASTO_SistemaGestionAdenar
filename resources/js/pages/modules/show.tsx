import { ModuleCard } from '@/components/module-card';
import { Reveal } from '@/components/reveal';
import { buildModuleSections, findModule, submoduleHref } from '@/data/modules';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, usePage } from '@inertiajs/react';

export default function ModuleShow({ module }: { module: string }) {
    const { auth } = usePage<SharedData>().props;
    const mod = findModule(module);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: mod?.title ?? 'Módulo', href: `/modules/${module}` },
    ];

    const secciones = mod ? buildModuleSections(mod, auth.roles, auth.isAdmin) : [];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={mod?.title ?? 'Módulo'} />
            <div className="flex h-full flex-1 flex-col gap-8 rounded-xl p-4">
                {mod ? (
                    <>
                        <Reveal className="flex items-center gap-3">
                            <div
                                className="flex size-11 shrink-0 items-center justify-center rounded-xl"
                                style={{ backgroundColor: `${mod.accent}1a`, color: mod.accent }}
                            >
                                <mod.icon className="size-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-semibold tracking-tight">{mod.title}</h1>
                                <p className="text-muted-foreground">Selecciona un submódulo para continuar.</p>
                            </div>
                        </Reveal>

                        {secciones.map((seccion, si) => (
                            <section key={seccion.title ?? '__sueltos__'} className="grid gap-4">
                                {seccion.title && (
                                    <Reveal className="flex items-center gap-2.5">
                                        {seccion.icon && (
                                            <div
                                                className="flex size-8 items-center justify-center rounded-lg"
                                                style={{ backgroundColor: `${mod.accent}1a`, color: mod.accent }}
                                            >
                                                <seccion.icon className="size-4" />
                                            </div>
                                        )}
                                        <h2 className="text-base font-semibold tracking-tight text-foreground">{seccion.title}</h2>
                                    </Reveal>
                                )}
                                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                                    {seccion.items.map((sub, index) => (
                                        <Reveal key={`${sub.moduleSlugOverride ?? mod.slug}/${sub.slug ?? sub.title}`} delay={(si + index) * 60}>
                                            <ModuleCard
                                                title={sub.title}
                                                href={submoduleHref(mod, sub)}
                                                icon={sub.icon}
                                                color={mod.accent}
                                            />
                                        </Reveal>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </>
                ) : (
                    <p className="text-muted-foreground">Módulo no encontrado.</p>
                )}
            </div>
        </AppLayout>
    );
}
