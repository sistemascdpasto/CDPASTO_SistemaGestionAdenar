import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Trash2, Truck, User } from 'lucide-react';

interface NovedadDetalle {
    id: number;
    sku: string | null;
    producto: string;
    cantidad_revisada: number | null;
    cantidad_revisada_unidad: string | null;
    cantidad_novedad: number;
    causal: string | null;
    causal_especificacion: string | null;
    observacion: string | null;
    evidencias: { id: number; url: string }[];
}

interface RevisionDetalle {
    id: number;
    fecha_formateada: string;
    vehiculo: { id: number; placa: string } | null;
    responsable: { id: number; nombre: string } | null;
    resultado: 'sin_novedades' | 'con_novedades' | null;
    finalizada_en: string | null;
    usuario: string | null;
    total_novedades: number;
    novedades: NovedadDetalle[];
}

export default function RevisionAleatoriaShow({ revision }: { revision: RevisionDetalle }) {
    const { auth } = usePage<SharedData>().props;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Reparto', href: '/modules/reparto' },
        { title: 'Revisión Aleatoria', href: '/modules/reparto/revision-aleatoria' },
        { title: 'Historial', href: '/modules/reparto/revision-aleatoria/historial' },
        { title: revision.fecha_formateada, href: `/modules/reparto/revision-aleatoria/${revision.id}` },
    ];

    const eliminar = () => {
        if (!confirm('¿Eliminar esta revisión? Libera la fecha para poder registrar una nueva. Esta acción no se puede deshacer.')) return;
        router.delete(route('reparto.revision-aleatoria.destroy', revision.id));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Revisión ${revision.fecha_formateada}`} />
            <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Revisión del {revision.fecha_formateada}</h1>
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                            <CalendarDays className="size-4" /> Finalizada a las {revision.finalizada_en}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild className="gap-1.5">
                            <Link href={route('reparto.revision-aleatoria.historial')}>
                                <ArrowLeft className="size-4" /> Volver al historial
                            </Link>
                        </Button>
                        {auth.isAdmin && (
                            <Button variant="destructive" size="sm" onClick={eliminar} className="gap-1.5">
                                <Trash2 className="size-4" /> Eliminar
                            </Button>
                        )}
                    </div>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border">
                    <div
                        className={`flex items-center gap-2 rounded-t-xl px-5 py-3 ${
                            revision.resultado === 'con_novedades'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        }`}
                    >
                        {revision.resultado === 'con_novedades' ? <AlertTriangle className="size-5" /> : <CheckCircle2 className="size-5" />}
                        <p className="text-sm font-bold">
                            {revision.resultado === 'con_novedades'
                                ? `${revision.total_novedades} novedad(es) encontrada(s)`
                                : 'Sin novedades'}
                        </p>
                    </div>
                    <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
                        <Dato label="Vehículo" valor={revision.vehiculo?.placa ?? '—'} icon={Truck} />
                        <Dato label="Responsable" valor={revision.responsable?.nombre ?? '—'} icon={User} />
                        <Dato label="Hora finalización" valor={revision.finalizada_en ?? '—'} icon={CalendarDays} />
                        <Dato label="Registrado por" valor={revision.usuario ?? '—'} icon={User} />
                    </div>
                </div>

                {revision.novedades.length > 0 && (
                    <div className="space-y-3">
                        {revision.novedades.map((n, i) => (
                            <div key={n.id} className="rounded-xl border border-sidebar-border/70 bg-card p-4 shadow-sm dark:border-sidebar-border">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-bold text-foreground">
                                        Novedad {i + 1} — {n.producto} {n.sku && <span className="font-normal text-muted-foreground">({n.sku})</span>}
                                    </p>
                                    <Badge variant="outline">{n.causal}</Badge>
                                </div>
                                <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                                    <p>
                                        Cantidad revisada:{' '}
                                        <strong className="text-foreground">
                                            {n.cantidad_revisada ?? '—'}
                                            {n.cantidad_revisada !== null && n.cantidad_revisada_unidad && ` (${n.cantidad_revisada_unidad})`}
                                        </strong>
                                    </p>
                                    <p>
                                        Cantidad con novedad en unidades: <strong className="text-foreground">{n.cantidad_novedad}</strong>
                                    </p>
                                    {n.causal_especificacion && (
                                        <p>
                                            Especificación: <strong className="text-foreground">{n.causal_especificacion}</strong>
                                        </p>
                                    )}
                                </div>
                                {n.observacion && <p className="mt-2 text-xs text-muted-foreground italic">"{n.observacion}"</p>}
                                {n.evidencias.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {n.evidencias.map((e) => (
                                            <a key={e.id} href={e.url} target="_blank" rel="noreferrer">
                                                <img src={e.url} className="h-20 w-20 rounded-md border border-border object-cover transition-transform hover:scale-105" />
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function Dato({ label, valor, icon: Icon }: { label: string; valor: string; icon: React.ElementType }) {
    return (
        <div className="rounded-lg border border-sidebar-border/70 bg-muted/30 p-3 dark:border-sidebar-border">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                <Icon className="size-3" /> {label}
            </p>
            <p className="mt-0.5 text-sm font-bold text-foreground">{valor}</p>
        </div>
    );
}
