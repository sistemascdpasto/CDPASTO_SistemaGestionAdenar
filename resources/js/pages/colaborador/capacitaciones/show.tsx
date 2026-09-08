import { FileIcon, getFileCategoryInfo } from '@/components/capacitaciones/file-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    CheckCircle2,
    Download,
    ExternalLink,
    Eye,
    FileSpreadsheet,
    FileText,
    Folder,
    Presentation,
    Search,
    Video,
} from 'lucide-react';
import { FormEventHandler, useState } from 'react';

interface CarpetaInfo {
    id: number;
    nombre: string;
    descripcion: string | null;
    color: string;
    total_materiales: number;
    revisados_count: number;
    porcentaje: number;
    completada: boolean;
}

interface Subcarpeta {
    id: number;
    nombre: string;
    descripcion: string | null;
    color: string;
    portada_url: string | null;
    total_materiales: number;
    revisados_count: number;
    porcentaje: number;
    completada: boolean;
}

interface Ancestro {
    id: number;
    nombre: string;
}

interface Material {
    id: number;
    titulo: string;
    descripcion: string | null;
    tipo: string;
    archivo_path: string | null;
    archivo_url: string | null;
    archivo_nombre_original: string | null;
    tamano_humano: string | null;
    mime_type: string | null;
    enlace_externo: string | null;
    revisada: boolean;
    created_at: string;
}

export default function ColaboradorCarpetaShow({
    carpeta,
    subcarpetas = [],
    ancestros = [],
    materiales,
    filters,
}: {
    carpeta: CarpetaInfo;
    subcarpetas?: Subcarpeta[];
    ancestros?: Ancestro[];
    materiales: Material[];
    filters: { buscar?: string };
}) {
    const [busqueda, setBusqueda] = useState(filters.buscar || '');
    const [materialSeleccionado, setMaterialSeleccionado] = useState<Material | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Mi Centro de Capacitaciones', href: '/portal/capacitaciones' },
        ...(ancestros || []).map((anc) => ({
            title: anc.nombre,
            href: `/portal/capacitaciones/carpetas/${anc.id}`,
        })),
        { title: carpeta.nombre, href: `/portal/capacitaciones/carpetas/${carpeta.id}` },
    ];

    const handleBuscar: FormEventHandler = (e) => {
        e.preventDefault();
        router.get(
            route('portal.capacitaciones.carpetas.show', carpeta.id),
            { buscar: busqueda },
            { preserveState: true, replace: true }
        );
    };

    const marcarRevisada = (material: Material) => {
        router.post(
            route('portal.capacitaciones.materiales.marcar-revisada', material.id),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    if (materialSeleccionado?.id === material.id) {
                        setMaterialSeleccionado({ ...materialSeleccionado, revisada: true });
                    }
                },
            }
        );
    };

    const abrirVistaPrevia = (material: Material) => {
        setMaterialSeleccionado(material);
        if (!material.revisada) {
            marcarRevisada(material);
        }
    };

    const folderColor = carpeta.color || '#0D9488';
    const parentHref = (ancestros && ancestros.length > 0)
        ? `/portal/capacitaciones/carpetas/${ancestros[ancestros.length - 1].id}`
        : route('portal.capacitaciones.index');

    // Helper para detectar si un enlace es embebible de YouTube
    const getYoutubeEmbedUrl = (url: string | null) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return match && match[2].length === 11 ? `https://www.youtube-nocookie.com/embed/${match[2]}` : null;
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Capacitación - ${carpeta.nombre}`} />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4 md:p-6 max-w-7xl mx-auto w-full">
                {/* Cabecera con retorno y métrica de la carpeta */}
                <div className="flex flex-col gap-4 border-b pb-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="sm" asChild className="gap-1.5 text-muted-foreground hover:text-foreground">
                                <Link href={parentHref}>
                                    <ArrowLeft className="size-4" />
                                    Volver
                                </Link>
                            </Button>

                            <div className="flex items-center gap-3">
                                <div
                                    className="flex size-11 items-center justify-center rounded-xl shadow-sm"
                                    style={{ backgroundColor: `${folderColor}20`, color: folderColor }}
                                >
                                    <Folder className="size-6 fill-current" />
                                </div>
                                <div>
                                    <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2.5">
                                        {carpeta.nombre}
                                        {carpeta.completada && (
                                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-xs">
                                                <CheckCircle2 className="size-3 mr-1" /> Completada
                                            </Badge>
                                        )}
                                    </h1>
                                    {carpeta.descripcion && (
                                        <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl mt-0.5">
                                            {carpeta.descripcion}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-2 self-start sm:self-auto border">
                            <div className="text-right">
                                <p className="text-xs text-muted-foreground font-medium">Progreso en categoría</p>
                                <p className="text-sm font-bold text-foreground">
                                    {carpeta.revisados_count} de {carpeta.total_materiales} revisados ({carpeta.porcentaje}%)
                                </p>
                            </div>
                            <div className="size-10 rounded-full border-2 border-teal-500 flex items-center justify-center font-bold text-xs text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50">
                                {carpeta.porcentaje}%
                            </div>
                        </div>
                    </div>

                    {/* Barra de progreso de la categoría */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted mt-1">
                        <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                                width: `${carpeta.porcentaje}%`,
                                backgroundColor: carpeta.completada ? '#10B981' : folderColor,
                            }}
                        />
                    </div>
                </div>

                {/* Barra de Búsqueda Interna */}
                <form onSubmit={handleBuscar} className="flex gap-2 max-w-xl">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder={`Buscar material dentro de ${carpeta.nombre}...`}
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            className="pl-9 rounded-xl"
                        />
                    </div>
                    <Button type="submit" variant="secondary" className="rounded-xl">
                        Buscar
                    </Button>
                    {busqueda && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setBusqueda('');
                                router.get(
                                    route('portal.capacitaciones.carpetas.show', carpeta.id),
                                    {},
                                    { preserveState: true, replace: true }
                                );
                            }}
                            className="rounded-xl"
                        >
                            Limpiar
                        </Button>
                    )}
                </form>

                {/* SECCIÓN DE SUBCARPETAS (Si existen en el portal del colaborador) */}
                {subcarpetas.length > 0 && (
                    <div className="space-y-3">
                        <h2 className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                            <Folder className="size-4" />
                            Subcarpetas de Aprendizaje ({subcarpetas.length})
                        </h2>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {subcarpetas.map((sub) => {
                                const subColor = sub.color || '#0D9488';
                                return (
                                    <Link
                                        key={sub.id}
                                        href={route('portal.capacitaciones.carpetas.show', sub.id)}
                                        className="group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-sidebar-border/70 dark:border-sidebar-border"
                                    >
                                        {sub.portada_url ? (
                                            <div className="relative h-36 w-full overflow-hidden bg-muted">
                                                <img
                                                    src={sub.portada_url}
                                                    alt={sub.nombre}
                                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                                                <div
                                                    className="absolute bottom-2.5 left-3 size-8 rounded-lg flex items-center justify-center shadow-md"
                                                    style={{ backgroundColor: subColor, color: '#ffffff' }}
                                                >
                                                    <Folder className="size-4 fill-current" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                className="h-2 w-full"
                                                style={{ backgroundColor: subColor }}
                                            />
                                        )}

                                        <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                            <div>
                                                {!sub.portada_url && (
                                                    <div
                                                        className="flex size-9 shrink-0 items-center justify-center rounded-xl mb-2"
                                                        style={{
                                                            backgroundColor: `${subColor}1a`,
                                                            color: subColor,
                                                        }}
                                                    >
                                                        <Folder className="size-4 fill-current opacity-90" />
                                                    </div>
                                                )}

                                                <h3 className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                                                    {sub.nombre}
                                                </h3>
                                                {sub.descripcion && (
                                                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                                        {sub.descripcion}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                                                <span className="font-medium text-foreground/80">
                                                    {sub.revisados_count} de {sub.total_materiales} revisados
                                                </span>
                                                <span className="text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                                                    Ver carpeta →
                                                </span>
                                            </div>
                                        </CardContent>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Listado de Materiales con Vista Previa Clara */}
                <div className="space-y-4">
                    {materiales.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-sidebar-border/80 p-12 text-center">
                            <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                <Folder className="size-7" />
                            </div>
                            <h3 className="mt-4 text-base font-medium text-foreground">
                                No hay materiales disponibles en esta categoría
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                                Los recursos de estudio se habilitarán próximamente.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {materiales.map((mat) => {
                                const catInfo = getFileCategoryInfo(mat.tipo, mat.mime_type);
                                const isPdf = mat.tipo === 'pdf' || (mat.mime_type && mat.mime_type.includes('pdf'));
                                const isVideo = mat.tipo === 'video' || (mat.mime_type && mat.mime_type.includes('video'));
                                const youtubeUrl = getYoutubeEmbedUrl(mat.enlace_externo);

                                return (
                                    <Card
                                        key={mat.id}
                                        className={`group relative overflow-hidden border transition-all duration-200 hover:shadow-md ${
                                            mat.revisada
                                                ? 'border-sidebar-border/70 bg-card/70'
                                                : 'border-teal-500/40 bg-teal-500/5 shadow-sm'
                                        }`}
                                    >
                                        <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                                            <div className="space-y-3">
                                                {/* Header de la tarjeta */}
                                                <div className="flex items-start justify-between gap-2">
                                                    <div
                                                        className={`flex size-12 shrink-0 items-center justify-center rounded-xl border ${catInfo.bgColor} ${catInfo.borderColor}`}
                                                    >
                                                        <FileIcon tipo={mat.tipo} mime={mat.mime_type} className="size-6" />
                                                    </div>

                                                    {mat.revisada ? (
                                                        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800 text-xs font-semibold">
                                                            <CheckCircle2 className="size-3 mr-1" />
                                                            Revisada
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 text-xs font-medium">
                                                            Pendiente
                                                        </Badge>
                                                    )}
                                                </div>

                                                {/* Título y descripción */}
                                                <div>
                                                    <h3 className="font-bold text-base text-foreground line-clamp-2">
                                                        {mat.titulo}
                                                    </h3>
                                                    {mat.descripcion && (
                                                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                                            {mat.descripcion}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Metadatos */}
                                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-1">
                                                    <span className="font-medium text-foreground/80">{catInfo.label}</span>
                                                    {mat.tamano_humano && (
                                                        <>
                                                            <span>·</span>
                                                            <span>{mat.tamano_humano}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Botones de acción y vista previa */}
                                            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/60">
                                                {/* Botón Vista Previa / Reproducir */}
                                                {(mat.archivo_url || mat.enlace_externo) && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => abrirVistaPrevia(mat)}
                                                        className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 flex-1"
                                                    >
                                                        {isVideo || youtubeUrl ? (
                                                            <>
                                                                <Video className="size-4" />
                                                                Ver Video
                                                            </>
                                                        ) : isPdf ? (
                                                            <>
                                                                <Eye className="size-4" />
                                                                Ver Documento
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Eye className="size-4" />
                                                                Vista Previa
                                                            </>
                                                        )}
                                                    </Button>
                                                )}

                                                {/* Botón Descargar */}
                                                {mat.archivo_path && (
                                                    <Button size="sm" variant="outline" asChild className="gap-1.5">
                                                        <a
                                                            href={route('portal.capacitaciones.materiales.descargar', mat.id)}
                                                            title="Descargar archivo"
                                                        >
                                                            <Download className="size-4" />
                                                            <span className="hidden sm:inline">Descargar</span>
                                                        </a>
                                                    </Button>
                                                )}

                                                {/* Botón Marcar como Revisada si aún está pendiente */}
                                                {!mat.revisada && (
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => marcarRevisada(mat)}
                                                        className="text-xs gap-1"
                                                        title="Marcar manualmente como revisada"
                                                    >
                                                        <CheckCircle2 className="size-3.5 text-teal-600" />
                                                        Marcar revisada
                                                    </Button>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL DE VISTA PREVIA CLARA DE DOCUMENTOS Y VIDEOS */}
            <Dialog open={!!materialSeleccionado} onOpenChange={(open) => !open && setMaterialSeleccionado(null)}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-6">
                    {materialSeleccionado && (
                        <>
                            <DialogHeader className="space-y-1">
                                <div className="flex items-center justify-between gap-4">
                                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                        <FileIcon tipo={materialSeleccionado.tipo} mime={materialSeleccionado.mime_type} className="size-5" />
                                        {materialSeleccionado.titulo}
                                    </DialogTitle>
                                    {materialSeleccionado.revisada && (
                                        <Badge className="bg-emerald-600 text-white text-xs shrink-0">
                                            <CheckCircle2 className="size-3 mr-1" /> Revisada
                                        </Badge>
                                    )}
                                </div>
                                {materialSeleccionado.descripcion && (
                                    <p className="text-xs text-muted-foreground">{materialSeleccionado.descripcion}</p>
                                )}
                            </DialogHeader>

                            {/* Contenido Visual Interactivo */}
                            <div className="flex-1 overflow-y-auto rounded-xl border bg-muted/20 p-2 my-3 min-h-[350px] flex items-center justify-center">
                                {/* 1. Video de YouTube / Externo */}
                                {getYoutubeEmbedUrl(materialSeleccionado.enlace_externo) ? (
                                    <iframe
                                        src={getYoutubeEmbedUrl(materialSeleccionado.enlace_externo)!}
                                        className="w-full h-[450px] rounded-lg shadow-sm border-0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        title={materialSeleccionado.titulo}
                                    />
                                ) : (materialSeleccionado.tipo === 'video' || (materialSeleccionado.mime_type && materialSeleccionado.mime_type.includes('video'))) && materialSeleccionado.archivo_url ? (
                                    /* 2. Video local MP4 / WebM */
                                    <video
                                        controls
                                        className="w-full max-h-[500px] rounded-lg shadow-md bg-black"
                                        src={materialSeleccionado.archivo_url}
                                    >
                                        Tu navegador no soporta la reproducción de video.
                                    </video>
                                ) : (materialSeleccionado.tipo === 'pdf' || (materialSeleccionado.mime_type && materialSeleccionado.mime_type.includes('pdf'))) && materialSeleccionado.archivo_url ? (
                                    /* 3. PDF embebido directo */
                                    <iframe
                                        src={materialSeleccionado.archivo_url}
                                        className="w-full h-[550px] rounded-lg shadow-sm border"
                                        title={materialSeleccionado.titulo}
                                    />
                                ) : (materialSeleccionado.tipo === 'imagen' || (materialSeleccionado.mime_type && materialSeleccionado.mime_type.includes('image'))) && materialSeleccionado.archivo_url ? (
                                    /* 4. Imagen */
                                    <img
                                        src={materialSeleccionado.archivo_url}
                                        alt={materialSeleccionado.titulo}
                                        className="max-w-full max-h-[550px] rounded-lg shadow-sm object-contain"
                                    />
                                ) : materialSeleccionado.archivo_url ? (
                                    /* 5. Otros documentos (PowerPoint, Excel, Word, etc.) */
                                    <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-md mx-auto">
                                        <div className="size-20 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center border-2 border-teal-200 dark:border-teal-800">
                                            <FileIcon tipo={materialSeleccionado.tipo} mime={materialSeleccionado.mime_type} className="size-10" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-lg text-foreground">{materialSeleccionado.titulo}</h4>
                                            <p className="text-sm text-muted-foreground mt-2">
                                                {materialSeleccionado.archivo_nombre_original || 'Material de capacitación'}
                                            </p>
                                            {materialSeleccionado.tamano_humano && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Tamaño: {materialSeleccionado.tamano_humano}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-2 w-full">
                                            <Button asChild className="bg-teal-600 hover:bg-teal-700 text-white gap-2 w-full">
                                                <a href={route('portal.capacitaciones.materiales.descargar', materialSeleccionado.id)}>
                                                    <Download className="size-4" />
                                                    Descargar para Ver
                                                </a>
                                            </Button>
                                            <p className="text-xs text-muted-foreground px-2">
                                                Descarga el archivo para abrirlo con la aplicación correspondiente en tu equipo
                                            </p>
                                        </div>
                                    </div>
                                ) : materialSeleccionado.enlace_externo ? (
                                    /* 6. Enlace Externo */
                                    <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-md mx-auto">
                                        <div className="size-16 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
                                            <FileIcon tipo={materialSeleccionado.tipo} mime={materialSeleccionado.mime_type} className="size-8" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-base text-foreground">{materialSeleccionado.titulo}</h4>
                                            <p className="text-xs text-muted-foreground mt-1">Recurso externo</p>
                                        </div>
                                        <Button asChild className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
                                            <a
                                                href={materialSeleccionado.enlace_externo}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <ExternalLink className="size-4" />
                                                Abrir Recurso Externo
                                            </a>
                                        </Button>
                                    </div>
                                ) : null}
                            </div>

                            {/* Footer del diálogo */}
                            <div className="flex items-center justify-between pt-2 border-t">
                                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    {materialSeleccionado.revisada && <CheckCircle2 className="size-3.5 text-[#15803d]" />}
                                    {materialSeleccionado.revisada ? 'Completado en tu avance' : 'Visualizando material'}
                                </span>
                                <div className="flex gap-2">
                                    {materialSeleccionado.archivo_path && (
                                        <Button variant="outline" size="sm" asChild className="gap-1.5">
                                            <a href={route('portal.capacitaciones.materiales.descargar', materialSeleccionado.id)}>
                                                <Download className="size-4" />
                                                Descargar
                                            </a>
                                        </Button>
                                    )}
                                    <Button size="sm" onClick={() => setMaterialSeleccionado(null)}>
                                        Cerrar
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
