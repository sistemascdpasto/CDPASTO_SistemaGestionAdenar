import { CrearCarpetaDialog } from '@/components/capacitaciones/crear-carpeta-dialog';
import { FileIcon, getFileCategoryInfo } from '@/components/capacitaciones/file-icon';
import { SubirMaterialDialog } from '@/components/capacitaciones/subir-material-dialog';
import HeadingSmall from '@/components/heading-small';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    Download,
    Eye,
    EyeOff,
    ExternalLink,
    FileText,
    Folder,
    FolderPlus,
    MoreVertical,
    Pencil,
    Plus,
    Search,
    Trash2,
    UploadCloud,
    Video,
} from 'lucide-react';
import { FormEventHandler, useEffect, useState } from 'react';

interface Carpeta {
    id: number;
    nombre: string;
    descripcion: string | null;
    color: string | null;
    visible_colaborador?: boolean;
    created_at: string;
}

interface Subcarpeta {
    id: number;
    nombre: string;
    descripcion: string | null;
    color: string | null;
    portada_url: string | null;
    visible_colaborador?: boolean;
    materiales_count: number;
    created_at: string;
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
    archivo_nombre_original: string | null;
    tamano_humano: string | null;
    mime_type: string | null;
    enlace_externo: string | null;
    created_at: string;
}

export default function CapacitacionCarpetaShow({
    carpeta,
    subcarpetas = [],
    ancestros = [],
    materiales,
    filters,
}: {
    carpeta: Carpeta;
    subcarpetas?: Subcarpeta[];
    ancestros?: Ancestro[];
    materiales: Material[];
    filters: { buscar?: string };
}) {
    const [busqueda, setBusqueda] = useState(filters.buscar || '');
    const [dialogoSubir, setDialogoSubir] = useState(false);
    const [materialEditar, setMaterialEditar] = useState<Material | null>(null);
    const [materialEliminar, setMaterialEliminar] = useState<Material | null>(null);
    const [materialVistaPrevia, setMaterialVistaPrevia] = useState<Material | null>(null);
    const [officeViewerFailed, setOfficeViewerFailed] = useState(false);

    // Diálogos para subcarpetas
    const [dialogoCrearCarpeta, setDialogoCrearCarpeta] = useState(false);
    const [subcarpetaEditar, setSubcarpetaEditar] = useState<Subcarpeta | null>(null);
    const [subcarpetaEliminar, setSubcarpetaEliminar] = useState<Subcarpeta | null>(null);

    useEffect(() => {
        document.body.style.pointerEvents = '';
    });

    // Reinicia el estado de fallo del visor de Office cada vez que se abre una vista previa distinta
    useEffect(() => {
        setOfficeViewerFailed(false);
    }, [materialVistaPrevia?.id]);

    // Construir breadcrumbs dinámicos incluyendo ancestros
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Capacitaciones', href: '/modules/capacitaciones' },
        ...(ancestros || []).map((anc) => ({
            title: anc.nombre,
            href: `/modules/capacitaciones/carpetas/${anc.id}`,
        })),
        { title: carpeta.nombre, href: `/modules/capacitaciones/carpetas/${carpeta.id}` },
    ];

    const handleBuscar: FormEventHandler = (e) => {
        e.preventDefault();
        router.get(
            route('capacitaciones.carpetas.show', carpeta.id),
            { buscar: busqueda },
            { preserveState: true, replace: true }
        );
    };

    const handleEliminarMaterial = () => {
        if (!materialEliminar) return;
        router.delete(route('capacitaciones.materiales.destroy', materialEliminar.id), {
            preserveScroll: true,
            onSuccess: () => setMaterialEliminar(null),
        });
    };

    const handleEliminarSubcarpeta = () => {
        if (!subcarpetaEliminar) return;
        router.delete(route('capacitaciones.carpetas.destroy', subcarpetaEliminar.id), {
            preserveScroll: true,
            onSuccess: () => setSubcarpetaEliminar(null),
        });
    };

    // Helper para detectar si un enlace es embebible de YouTube
    const getYoutubeEmbedUrl = (url: string | null) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return match && match[2].length === 11 ? `https://www.youtube-nocookie.com/embed/${match[2]}` : null;
    };

    const folderColor = carpeta.color || '#0D9488';
    const parentHref = (ancestros && ancestros.length > 0)
        ? `/modules/capacitaciones/carpetas/${ancestros[ancestros.length - 1].id}`
        : route('capacitaciones.index');

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Capacitación - ${carpeta.nombre}`} />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4 md:p-6">
                {/* Botón Volver y Encabezado de la Carpeta */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-muted-foreground hover:text-foreground">
                            <Link href={parentHref}>
                                <ArrowLeft className="size-4" />
                                Volver
                            </Link>
                        </Button>

                        <div className="flex items-center gap-2.5">
                            <div
                                className="flex size-10 items-center justify-center rounded-lg"
                                style={{ backgroundColor: `${folderColor}20`, color: folderColor }}
                            >
                                <Folder className="size-5 fill-current" />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <HeadingSmall title={carpeta.nombre} description={carpeta.descripcion || undefined} />
                                <Badge variant="secondary" className="font-normal text-xs">
                                    {materiales.length} {materiales.length === 1 ? 'material' : 'materiales'}
                                </Badge>
                                {carpeta.visible_colaborador === false && (
                                    <Badge
                                        variant="outline"
                                        className="text-[10px] font-medium"
                                        style={{ color: '#d03b3b', borderColor: '#d03b3b4d', backgroundColor: '#d03b3b1a' }}
                                    >
                                        <EyeOff className="size-3 mr-1" style={{ color: '#d03b3b' }} />
                                        <span>Oculta a colaboradores</span>
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => {
                                setSubcarpetaEditar(null);
                                setDialogoCrearCarpeta(true);
                            }}
                            variant="outline"
                            className="shadow-sm"
                        >
                            <FolderPlus className="mr-2 size-4" />
                            Nueva subcarpeta
                        </Button>

                        <Button
                            onClick={() => {
                                setMaterialEditar(null);
                                setDialogoSubir(true);
                            }}
                            className="shadow-sm"
                        >
                            <Plus className="mr-2 size-4" />
                            Subir archivo
                        </Button>
                    </div>
                </div>

                {/* Barra de Búsqueda de Materiales */}
                <form onSubmit={handleBuscar} className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder={`Buscar dentro de ${carpeta.nombre}...`}
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Button type="submit" variant="secondary">
                        Buscar
                    </Button>
                    {busqueda && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setBusqueda('');
                                router.get(
                                    route('capacitaciones.carpetas.show', carpeta.id),
                                    {},
                                    { preserveState: true, replace: true }
                                );
                            }}
                        >
                            Limpiar
                        </Button>
                    )}
                </form>

                {/* SECCIÓN DE SUBCARPETAS (Si existen) */}
                {subcarpetas.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                                <Folder className="size-4" />
                                Subcarpetas ({subcarpetas.length})
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {subcarpetas.map((sub) => {
                                const subColor = sub.color || '#0D9488';
                                return (
                                    <Card
                                        key={sub.id}
                                        className="group relative flex flex-col justify-between overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-md border-sidebar-border/70 dark:border-sidebar-border bg-card"
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
                                                <div className="flex items-start justify-between gap-2">
                                                    {!sub.portada_url && (
                                                        <div
                                                            className="flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
                                                            style={{
                                                                backgroundColor: `${subColor}1a`,
                                                                color: subColor,
                                                            }}
                                                        >
                                                            <Folder className="size-4 fill-current opacity-90" />
                                                        </div>
                                                    )}

                                                    <div className="ml-auto">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="size-8 text-muted-foreground hover:text-foreground"
                                                                >
                                                                    <MoreVertical className="size-4" />
                                                                    <span className="sr-only">Opciones</span>
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="notranslate">
                                                                <DropdownMenuItem
                                                                    onClick={() => {
                                                                        setSubcarpetaEditar(sub);
                                                                        setDialogoCrearCarpeta(true);
                                                                    }}
                                                                >
                                                                    <Pencil className="mr-2 size-4" />
                                                                    <span>Editar subcarpeta</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="text-destructive focus:text-destructive"
                                                                    onClick={() => setSubcarpetaEliminar(sub)}
                                                                >
                                                                    <Trash2 className="mr-2 size-4" />
                                                                    <span>Eliminar</span>
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </div>

                                                <Link
                                                    href={route('capacitaciones.carpetas.show', sub.id)}
                                                    className="mt-2 block"
                                                >
                                                    <h3 className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors flex items-center justify-between gap-1">
                                                        <span>{sub.nombre}</span>
                                                        <span className="shrink-0">
                                                            {sub.visible_colaborador === false && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-[9px] font-medium px-1.5 py-0"
                                                                    style={{ color: '#d03b3b', borderColor: '#d03b3b4d', backgroundColor: '#d03b3b1a' }}
                                                                >
                                                                    <EyeOff className="size-2.5 mr-0.5" style={{ color: '#d03b3b' }} />
                                                                    <span>Oculta</span>
                                                                </Badge>
                                                            )}
                                                        </span>
                                                    </h3>
                                                    {sub.descripcion && (
                                                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                                            {sub.descripcion}
                                                        </p>
                                                    )}
                                                </Link>
                                            </div>

                                            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                                                <span className="font-medium text-foreground/80">
                                                    {sub.materiales_count} {sub.materiales_count === 1 ? 'material' : 'materiales'}
                                                </span>
                                                <Link
                                                    href={route('capacitaciones.carpetas.show', sub.id)}
                                                    className="text-teal-600 dark:text-teal-400 font-semibold hover:underline flex items-center gap-1"
                                                >
                                                    Abrir <ArrowRight className="size-3" />
                                                </Link>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Listado de Materiales */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                            <FileText className="size-4" />
                            Materiales ({materiales.length})
                        </h2>
                    </div>

                    {materiales.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-sidebar-border/80 p-12 text-center">
                            <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                <UploadCloud className="size-7" />
                            </div>
                            <h3 className="mt-4 text-base font-medium text-foreground">
                                No hay materiales directos en esta carpeta
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                                Sube presentaciones, videos, hojas de cálculo o documentos para los colaboradores.
                            </p>
                            <Button
                                onClick={() => {
                                    setMaterialEditar(null);
                                    setDialogoSubir(true);
                                }}
                                variant="outline"
                                className="mt-4"
                            >
                                <Plus className="mr-2 size-4" />
                                Subir primer archivo
                            </Button>
                        </div>
                    ) : (
                        <div className="divide-y rounded-xl border border-sidebar-border/70 bg-card overflow-hidden dark:border-sidebar-border shadow-sm">
                            {materiales.map((mat) => {
                                const catInfo = getFileCategoryInfo(mat.tipo, mat.mime_type);
                                const fecha = new Date(mat.created_at).toLocaleDateString('es-CO', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                });

                                return (
                                    <div
                                        key={mat.id}
                                        className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/40"
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            <div
                                                className={`flex size-12 shrink-0 items-center justify-center rounded-xl border ${catInfo.bgColor} ${catInfo.borderColor}`}
                                            >
                                                <FileIcon tipo={mat.tipo} mime={mat.mime_type} className="size-6" />
                                            </div>

                                            <div className="min-w-0">
                                                <h4 className="text-sm font-semibold text-foreground truncate">
                                                    {mat.titulo}
                                                </h4>
                                                {mat.descripcion && (
                                                    <p className="text-xs text-muted-foreground line-clamp-1">
                                                        {mat.descripcion}
                                                    </p>
                                                )}
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                    <span className="font-medium">{catInfo.label}</span>
                                                    {mat.tamano_humano && (
                                                        <>
                                                            <span>·</span>
                                                            <span>{mat.tamano_humano}</span>
                                                        </>
                                                    )}
                                                    <span>·</span>
                                                    <span>{fecha}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Acciones del Material */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            {mat.archivo_path && (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8"
                                                        onClick={() => setMaterialVistaPrevia(mat)}
                                                        title="Vista previa"
                                                    >
                                                        <Eye className="size-4 text-muted-foreground hover:text-foreground" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="size-8" asChild>
                                                        <a
                                                            href={route('capacitaciones.materiales.descargar', mat.id)}
                                                            title="Descargar archivo"
                                                        >
                                                            <Download className="size-4 text-muted-foreground hover:text-foreground" />
                                                        </a>
                                                    </Button>
                                                </>
                                            )}

                                            {mat.enlace_externo && (
                                                <Button variant="ghost" size="icon" className="size-8" asChild>
                                                    <a
                                                        href={mat.enlace_externo}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        title="Abrir enlace externo"
                                                    >
                                                        <ExternalLink className="size-4 text-muted-foreground hover:text-foreground" />
                                                    </a>
                                                </Button>
                                            )}

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8 text-muted-foreground hover:text-foreground"
                                                    >
                                                        <MoreVertical className="size-4" />
                                                        <span className="sr-only">Opciones</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="notranslate">
                                                    {mat.archivo_path && (
                                                        <>
                                                            <DropdownMenuItem onClick={() => setMaterialVistaPrevia(mat)}>
                                                                <Eye className="mr-2 size-4" />
                                                                <span>Vista previa</span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem asChild>
                                                                <a href={route('capacitaciones.materiales.descargar', mat.id)}>
                                                                    <Download className="mr-2 size-4" />
                                                                    <span>Descargar</span>
                                                                </a>
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                    {mat.enlace_externo && (
                                                        <DropdownMenuItem asChild>
                                                            <a
                                                                href={mat.enlace_externo}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                            >
                                                                <ExternalLink className="mr-2 size-4" />
                                                                <span>Abrir enlace</span>
                                                            </a>
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            setMaterialEditar(mat);
                                                            setDialogoSubir(true);
                                                        }}
                                                    >
                                                        <Pencil className="mr-2 size-4" />
                                                        <span>Editar información</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:text-destructive"
                                                        onClick={() => setMaterialEliminar(mat)}
                                                    >
                                                        <Trash2 className="mr-2 size-4" />
                                                        <span>Eliminar</span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Subir / Editar Material */}
            <SubirMaterialDialog
                open={dialogoSubir}
                onOpenChange={setDialogoSubir}
                carpetaId={carpeta.id}
                materialEditar={materialEditar}
            />

            {/* Modal Crear / Editar Subcarpeta */}
            <CrearCarpetaDialog
                open={dialogoCrearCarpeta}
                onOpenChange={setDialogoCrearCarpeta}
                carpetaEditar={subcarpetaEditar}
                parentId={carpeta.id}
            />

            {/* MODAL DE VISTA PREVIA */}
            <Dialog open={!!materialVistaPrevia} onOpenChange={(open) => !open && setMaterialVistaPrevia(null)}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-6">
                    {materialVistaPrevia && (
                        <>
                            <DialogHeader className="space-y-1">
                                <div className="flex items-center justify-between gap-4">
                                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                        <FileIcon tipo={materialVistaPrevia.tipo} mime={materialVistaPrevia.mime_type} className="size-5" />
                                        {materialVistaPrevia.titulo}
                                    </DialogTitle>
                                </div>
                                {materialVistaPrevia.descripcion && (
                                    <p className="text-xs text-muted-foreground">{materialVistaPrevia.descripcion}</p>
                                )}
                            </DialogHeader>

                            {/* Contenido Visual Interactivo */}
                            <div className="flex-1 overflow-y-auto rounded-xl border bg-muted/20 p-2 my-3 min-h-[350px] flex items-center justify-center">
                                {/* 1. Video de YouTube / Externo */}
                                {getYoutubeEmbedUrl(materialVistaPrevia.enlace_externo) ? (
                                    <iframe
                                        src={getYoutubeEmbedUrl(materialVistaPrevia.enlace_externo)!}
                                        className="w-full h-[450px] rounded-lg shadow-sm border-0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        title={materialVistaPrevia.titulo}
                                    />
                                ) : (materialVistaPrevia.tipo === 'video' || (materialVistaPrevia.mime_type && materialVistaPrevia.mime_type.includes('video'))) && materialVistaPrevia.archivo_path ? (
                                    /* 2. Video local MP4 / WebM */
                                    <video
                                        controls
                                        className="w-full max-h-[500px] rounded-lg shadow-md bg-black"
                                        src={materialVistaPrevia.archivo_path}
                                    >
                                        Tu navegador no soporta la reproducción de video.
                                    </video>
                                ) : (materialVistaPrevia.tipo === 'pdf' || (materialVistaPrevia.mime_type && materialVistaPrevia.mime_type.includes('pdf'))) && materialVistaPrevia.archivo_path ? (
                                    /* 3. PDF embebido directo */
                                    <iframe
                                        src={materialVistaPrevia.archivo_path}
                                        className="w-full h-[550px] rounded-lg shadow-sm border"
                                        title={materialVistaPrevia.titulo}
                                    />
                                ) : (materialVistaPrevia.tipo === 'imagen' || (materialVistaPrevia.mime_type && materialVistaPrevia.mime_type.includes('image'))) && materialVistaPrevia.archivo_path ? (
                                    /* 4. Imagen */
                                    <img
                                        src={materialVistaPrevia.archivo_path}
                                        alt={materialVistaPrevia.titulo}
                                        className="max-w-full max-h-[550px] rounded-lg shadow-sm object-contain"
                                    />
                                ) : materialVistaPrevia.archivo_path ? (
                                    /* 5. Otros documentos usando ViewerJS */
                                    officeViewerFailed ? (
                                        <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-md mx-auto">
                                            <div className="size-20 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
                                                <FileText className="size-10" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-lg text-foreground">{materialVistaPrevia.titulo}</h4>
                                                <p className="text-sm text-muted-foreground mt-2">La vista previa no se pudo cargar</p>
                                            </div>
                                            <Button asChild className="gap-2">
                                                <a href={route('capacitaciones.materiales.descargar', materialVistaPrevia.id)}>
                                                    <Download className="size-4" />
                                                    Descargar para Ver
                                                </a>
                                            </Button>
                                        </div>
                                    ) : (
                                        <iframe
                                            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent('https://' + window.location.hostname + materialVistaPrevia.archivo_path)}`}
                                            className="w-full h-[550px] rounded-lg shadow-sm border"
                                            title={materialVistaPrevia.titulo}
                                            onError={() => setOfficeViewerFailed(true)}
                                        />
                                    )
                                ) : materialVistaPrevia.enlace_externo ? (
                                    /* 6. Enlace Externo */
                                    <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-md mx-auto">
                                        <div className="size-16 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
                                            <FileIcon tipo={materialVistaPrevia.tipo} mime={materialVistaPrevia.mime_type} className="size-8" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-base text-foreground">{materialVistaPrevia.titulo}</h4>
                                            <p className="text-xs text-muted-foreground mt-1">Recurso externo</p>
                                        </div>
                                        <Button asChild className="gap-2">
                                            <a
                                                href={materialVistaPrevia.enlace_externo}
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
                            <div className="flex items-center justify-end pt-2 border-t gap-2">
                                {materialVistaPrevia.archivo_path && (
                                    <Button variant="outline" size="sm" asChild className="gap-1.5">
                                        <a href={route('capacitaciones.materiales.descargar', materialVistaPrevia.id)}>
                                            <Download className="size-4" />
                                            Descargar
                                        </a>
                                    </Button>
                                )}
                                <Button size="sm" onClick={() => setMaterialVistaPrevia(null)}>
                                    Cerrar
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Modal Confirmación Eliminar Material */}
            <AlertDialog open={!!materialEliminar} onOpenChange={(open) => !open && setMaterialEliminar(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar el material "{materialEliminar?.titulo}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará el archivo del sistema de forma permanente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleEliminarMaterial}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Modal Confirmación Eliminar Subcarpeta */}
            <AlertDialog open={!!subcarpetaEliminar} onOpenChange={(open) => !open && setSubcarpetaEliminar(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar la subcarpeta "{subcarpetaEliminar?.nombre}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará permanentemente la subcarpeta, sus subcarpetas anidadas y sus materiales.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleEliminarSubcarpeta}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Eliminar subcarpeta
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
