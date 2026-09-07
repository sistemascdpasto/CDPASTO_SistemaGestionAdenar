import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';

interface Registro {
    id: number;
    fecha: string | null;
    ejecutor: string | null;
    placa: string | null;
    rutina: string;
    indicador: string;
    problema: string;
    porques: string[];
    causa_raiz: string | null;
    plan_accion: string | null;
    creado: string | null;
}

function Campo({ label, value }: { label: string; value: string | null }) {
    return (
        <div className="grid gap-1">
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</span>
            <span className="text-foreground text-sm">{value || '—'}</span>
        </div>
    );
}

export default function CincoPorquesShow({ registro }: { registro: Registro }) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: '5 Por Qué', href: '/cinco-porques' },
        { title: 'Historial', href: '/cinco-porques/historial' },
        { title: `#${registro.id}`, href: `/cinco-porques/${registro.id}` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`5 Por Qué #${registro.id}`} />
            <div className="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <HeadingSmall title={`Análisis 5 Por Qué #${registro.id}`} description={registro.fecha ?? ''} />
                    <Button variant="outline" size="sm" asChild>
                        <Link href={route('cinco-porques.historial')}>
                            <ArrowLeft className="size-4" /> Volver al historial
                        </Link>
                    </Button>
                </div>

                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader>
                        <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">Encabezado</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <Campo label="Fecha" value={registro.fecha} />
                        <Campo label="Ejecuta" value={registro.ejecutor} />
                        <Campo label="Vehículo" value={registro.placa} />
                        <Campo label="Rutina" value={registro.rutina} />
                        <div className="sm:col-span-2">
                            <Campo label="Indicador afectado" value={registro.indicador} />
                        </div>
                        <div className="sm:col-span-2">
                            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Problema a resolver</span>
                            <p className="text-foreground mt-1 text-sm whitespace-pre-wrap">{registro.problema}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader>
                        <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">5 ¿Por qué?</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        {registro.porques.map((porque, i) => (
                            <div key={i} className="flex gap-3">
                                <Badge variant="secondary" className="h-6 shrink-0">
                                    {i + 1}
                                </Badge>
                                <p className="text-foreground text-sm whitespace-pre-wrap">{porque}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader>
                        <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">Conclusión</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-1">
                            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Causa Raíz (Principal)</span>
                            <p className="text-foreground text-sm whitespace-pre-wrap">{registro.causa_raiz || '—'}</p>
                        </div>
                        <div className="grid gap-1">
                            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Plan de acción</span>
                            <p className="text-foreground text-sm whitespace-pre-wrap">{registro.plan_accion || '—'}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
