import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { ImageIcon, Trash2, Upload } from 'lucide-react';
import { useRef } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'Encuestas Morbilidad', href: route('seguridad.encuestas-morbilidad.index') },
    { title: 'Portadas de Secciones', href: route('seguridad.encuestas-morbilidad.secciones.index') },
];

interface Seccion {
    id: number;
    numero: number;
    titulo: string;
    descripcion: string | null;
    imagen_portada: string | null;
    imagen_portada_url: string | null;
    activo: boolean;
}

// ─── Card de una sección ──────────────────────────────────────────────────────

function SeccionCard({ seccion }: { seccion: Seccion }) {
    const fileRef = useRef<HTMLInputElement>(null);


    const subir = (file: File) => {
        const data = new FormData();
        data.append('imagen', file);
        router.post(
            route('seguridad.encuestas-morbilidad.secciones.portada', seccion.id),
            data,
            { forceFormData: true, preserveScroll: true }
        );
    };

    const eliminar = () => {
        router.delete(
            route('seguridad.encuestas-morbilidad.secciones.portada.destroy', seccion.id),
            { preserveScroll: true }
        );
    };

    return (
        <div className="rounded-2xl border border-sidebar-border/70 bg-card shadow-sm dark:border-sidebar-border overflow-hidden">
            {/* Portada */}
            <div className="relative h-40 w-full bg-muted flex items-center justify-center">
                {seccion.imagen_portada_url ? (
                    <img
                        src={seccion.imagen_portada_url}
                        alt={`Portada sección ${seccion.numero}`}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ImageIcon className="size-10" />
                        <p className="text-xs">Sin portada</p>
                    </div>
                )}
                {/* Número de sección superpuesto */}
                <div className="absolute top-2 left-2 flex size-8 items-center justify-center rounded-full bg-green-700 text-xs font-bold text-white shadow">
                    {seccion.numero}
                </div>
            </div>

            {/* Info */}
            <div className="p-4 space-y-3">
                <div>
                    <p className="text-sm font-semibold text-foreground leading-tight">
                        Sección {seccion.numero}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {seccion.titulo}
                    </p>
                </div>

                {/* Acciones */}
                <div className="flex gap-2">
                    {/* Input oculto */}
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) subir(file);
                            e.target.value = '';
                        }}
                    />
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1.5 text-xs"
                        onClick={() => fileRef.current?.click()}
                    >
                        <Upload className="size-3.5" />
                        {seccion.imagen_portada ? 'Cambiar' : 'Subir portada'}
                    </Button>
                    {seccion.imagen_portada && (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={eliminar}
                        >
                            <Trash2 className="size-3.5" />
                            Quitar
                        </Button>
                    )}
                </div>

                {/* Mensaje de formato */}
                <p className="text-[10px] text-muted-foreground">
                    JPG, PNG o WebP · Máx. 4 MB
                </p>
            </div>
        </div>
    );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function EncuestaMorbilidadSecciones({ secciones }: { secciones: Seccion[] }) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Portadas de Secciones — Encuesta de Morbilidad" />
            <div className="flex flex-col gap-5 px-4 pb-10 sm:px-6">

                {/* Título */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                            Portadas de Secciones
                        </h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Sube una imagen de portada para cada sección de la encuesta de morbilidad sentida.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                        <Link href={route('seguridad.encuestas-morbilidad.preguntas.index')}>
                            Ver catálogo de preguntas
                        </Link>
                    </Button>
                </div>

                {/* Grid de secciones */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {secciones.map(s => (
                        <SeccionCard key={s.id} seccion={s} />
                    ))}
                </div>

                {secciones.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-16 text-center">
                        <ImageIcon className="size-10 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">No hay secciones registradas.</p>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
