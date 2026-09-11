import { FileIcon, getFileCategoryInfo } from '@/components/capacitaciones/file-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowRight,
    CheckCircle2,
    Clock,
    Download,
    ExternalLink,
    Folder,
    GraduationCap,
    Search,
    Star,
} from 'lucide-react';
import { FormEventHandler, useMemo, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Mi Centro de Capacitaciones', href: '/portal/capacitaciones' },
];

interface CarpetaProgreso {
    id: number;
    nombre: string;
    descripcion: string | null;
    color: string;
    icono: string;
    portada_url?: string | null;
    total_materiales: number;
    revisados_count: number;
    porcentaje: number;
    completada: boolean;
}

interface MaterialItem {
    id: number;
    titulo: string;
    descripcion: string | null;
    tipo: string;
    tamano_humano: string | null;
    archivo_url?: string | null;
    enlace_externo: string | null;
    revisada?: boolean;
    carpeta: {
        id: number;
        nombre: string;
        color: string | null;
    } | null;
    revisada_humano?: string;
}

interface ProgresoGeneral {
    total_categorias: number;
    categorias_completadas: number;
    porcentaje_general: number;
}

export default function CentroCapacitacionesIndex({
    carpetas,
    progreso,
    destacadas,
    recientes,
    resultadosBusqueda,
    filters,
    banner,
}: {
    carpetas: CarpetaProgreso[];
    progreso: ProgresoGeneral;
    destacadas: MaterialItem[];
    recientes: MaterialItem[];
    resultadosBusqueda: MaterialItem[] | null;
    filters: { buscar?: string };
    banner: { frase: string | null; sub_frase: string | null; imagen_url: string | null } | null;
}) {
    const [busqueda, setBusqueda] = useState(filters.buscar || '');

    const handleBuscar: FormEventHandler = (e) => {
        e.preventDefault();
        if (!busqueda.trim()) return;
        router.get(route('portal.capacitaciones.index'), { buscar: busqueda }, { preserveState: true, replace: true });
    };

    const limpiarBusqueda = () => {
        setBusqueda('');
        router.get(route('portal.capacitaciones.index'), {}, { preserveState: true, replace: true });
    };

    // Filtrado en vivo sobre carpetas
    const carpetasFiltradas = useMemo(() => {
        if (!busqueda.trim()) return carpetas;
        const query = busqueda.toLowerCase();
        return carpetas.filter(
            (c) => 
                c.nombre.toLowerCase().includes(query) || 
                (c.descripcion && c.descripcion.toLowerCase().includes(query))
        );
    }, [carpetas, busqueda]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Centro de Capacitaciones" />

            {banner && (banner.imagen_url || banner.frase) && (
                <div className="relative flex min-h-[200px] md:min-h-[260px] w-full overflow-hidden bg-teal-950">
                    {/* Imagen rectangular que ocupa más de la mitad */}
                    {banner.imagen_url && (
                        <div className="hidden md:block w-[58%] shrink-0 relative">
                            <img
                                src={banner.imagen_url}
                                alt="Banner capacitaciones"
                                className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-teal-950/80" />
                        </div>
                    )}
                    {/* Imagen en móvil — ocupa todo el ancho con overlay fuerte */}
                    {banner.imagen_url && (
                        <div className="absolute inset-0 md:hidden">
                            <img
                                src={banner.imagen_url}
                                alt="Banner capacitaciones"
                                className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-teal-950/75" />
                        </div>
                    )}
                    {/* Texto — al lado derecho en desktop, centrado en móvil */}
                    <div className={`relative z-10 flex flex-col justify-center gap-4 p-6 md:p-10 ${banner.imagen_url ? 'md:flex-1' : 'w-full items-center text-center'}`}>
                        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
                            <GraduationCap className="size-4 text-teal-300" />
                            <span>Portal de Aprendizaje</span>
                        </div>
                        {banner.frase && (
                            <p className="text-xl md:text-3xl font-extrabold leading-tight tracking-tight text-white">
                                {banner.frase}
                            </p>
                        )}
                        {banner.sub_frase && (
                            <p className="text-sm md:text-base text-teal-100 max-w-lg">
                                {banner.sub_frase}
                            </p>
                        )}
                    </div>
                </div>
            )}

            <div className="flex h-full flex-1 flex-col gap-8 rounded-xl p-4 md:p-6 max-w-7xl mx-auto w-full">
                {/* 1. ENCABEZADO Y BUSCADOR DINAMICO EN TIEMPO REAL */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-900 p-6 md:p-8 text-white shadow-lg">
                    <div className="relative z-10 max-w-3xl space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-md">
                            <GraduationCap className="size-4 text-teal-300" />
                            <span>Portal de Aprendizaje</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
                             MI CENTRO DE CAPACITACIONES
                        </h1>
                        <p className="text-teal-100 text-sm md:text-base">
                            Aprende y consulta el material disponible para tu desarrollo y seguridad laboral.
                        </p>

                        {/* Buscador dinámico que busca a medida que escribe */}
                        <form onSubmit={handleBuscar} className="pt-3">
                            <div className="flex flex-col sm:flex-row gap-2 max-w-2xl">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Que estas buscando? (filtrar carpetas, temas o materiales en vivo...)"
                                        value={busqueda}
                                        onChange={(e) => setBusqueda(e.target.value)}
                                        className="pl-10 h-11 bg-white text-foreground placeholder:text-muted-foreground/80 rounded-xl shadow-inner border-0 focus-visible:ring-2 focus-visible:ring-teal-400"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        type="submit"
                                        className="h-11 px-5 bg-teal-500 hover:bg-teal-400 text-teal-950 font-semibold rounded-xl shadow-md transition-transform active:scale-95"
                                    >
                                        Buscar global
                                    </Button>
                                    {busqueda && (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={limpiarBusqueda}
                                            className="h-11 px-4 bg-white/20 hover:bg-white/30 text-white border-0 rounded-xl"
                                        >
                                            Limpiar
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>

                    <div className="absolute right-0 top-0 -mt-10 -mr-10 size-64 rounded-full bg-white/5 blur-2xl pointer-events-none" />
                </div>

                {/* RESULTADOS DE BÚSQUEDA GLOBAL DEL BACKEND (Si se envió el formulario de búsqueda) */}
                {resultadosBusqueda !== null && (
                    <div className="space-y-4 rounded-xl border border-teal-200 bg-teal-50/40 p-5 dark:border-teal-900/50 dark:bg-teal-950/20">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                <Search className="size-4 text-teal-600 dark:text-teal-400" />
                                Capacitaciones encontradas para "{busqueda}" ({resultadosBusqueda.length})
                            </h2>
                            <Button variant="ghost" size="sm" onClick={limpiarBusqueda} className="text-xs">
                                Ver todas las categorias
                            </Button>
                        </div>

                        {resultadosBusqueda.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                                No se encontraron capacitaciones individuales que coincidan con tu busqueda.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {resultadosBusqueda.map((mat) => {
                                    const catInfo = getFileCategoryInfo(mat.tipo);
                                    return (
                                        <Card key={mat.id} className="border-sidebar-border/70 overflow-hidden hover:shadow-sm bg-card">
                                            <CardContent className="p-4 space-y-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className={`flex size-10 items-center justify-center rounded-lg ${catInfo.bgColor}`}>
                                                        <FileIcon tipo={mat.tipo} className="size-5" />
                                                    </div>
                                                    {mat.revisada ? (
                                                        <Badge variant="outline" className="text-xs text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800">
                                                            <CheckCircle2 className="size-3 mr-1" /> Revisada
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="text-xs">
                                                            Pendiente
                                                        </Badge>
                                                    )}
                                                </div>

                                                <div>
                                                    <h3 className="font-semibold text-sm line-clamp-1">{mat.titulo}</h3>
                                                    {mat.descripcion && (
                                                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{mat.descripcion}</p>
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                                                    <span className="font-medium text-teal-600 dark:text-teal-400">
                                                         {mat.carpeta?.nombre}
                                                    </span>
                                                    {mat.carpeta && (
                                                        <Link
                                                            href={route('portal.capacitaciones.carpetas.show', mat.carpeta.id)}
                                                            className="text-xs font-semibold hover:underline flex items-center gap-1"
                                                        >
                                                            Abrir <ArrowRight className="size-3" />
                                                        </Link>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* 2. SECCIÓN: MIS CAPACITACIONES - PROGRESO GENERAL */}
                <Card className="border-teal-500/30 bg-gradient-to-r from-card to-teal-500/5 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                                         MIS CAPACITACIONES
                                    </h2>
                                    {progreso.porcentaje_general === 100 && (
                                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
                                            100% Completado!
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Has completado{' '}
                                    <span className="font-bold text-foreground">
                                        {progreso.categorias_completadas} de {progreso.total_categorias}
                                    </span>{' '}
                                    categorias
                                </p>
                            </div>

                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl md:text-4xl font-extrabold text-teal-600 dark:text-teal-400">
                                    {progreso.porcentaje_general}%
                                </span>
                                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                                    Progreso global
                                </span>
                            </div>
                        </div>

                        {/* Barra de progreso dinámica */}
                        <div className="mt-4 space-y-1.5">
                            <div className="h-3.5 w-full overflow-hidden rounded-full bg-muted/80 p-0.5 shadow-inner">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500 shadow-sm"
                                    style={{ width: `${progreso.porcentaje_general}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                                <span>0% Inicio</span>
                                <span>50% En avance</span>
                                <span>100% Completado</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. SECCIÓN: CAPACITACIONES DESTACADAS */}
                {destacadas.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Star className="size-5 text-amber-500 fill-amber-500" />
                            <h2 className="text-base font-bold uppercase tracking-wider text-foreground">
                                Capacitaciones Destacadas
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {destacadas.map((destacada) => {
                                const catInfo = getFileCategoryInfo(destacada.tipo);
                                return (
                                    <Card
                                        key={destacada.id}
                                        className="group relative overflow-hidden border-amber-500/30 bg-gradient-to-b from-card to-amber-500/5 transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
                                    >
                                        <CardContent className="p-5 space-y-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className={`flex size-11 items-center justify-center rounded-xl ${catInfo.bgColor}`}>
                                                    <FileIcon tipo={destacada.tipo} className="size-6" />
                                                </div>
                                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-xs">
                                                    Destacada
                                                </Badge>
                                            </div>

                                            <div>
                                                <h3 className="font-bold text-foreground line-clamp-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                                    {destacada.titulo}
                                                </h3>
                                                {destacada.descripcion && (
                                                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                                        {destacada.descripcion}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/60">
                                                <span className="font-medium text-foreground/80">
                                                     {destacada.carpeta?.nombre}
                                                </span>
                                                {destacada.carpeta && (
                                                    <Link
                                                        href={route('portal.capacitaciones.carpetas.show', destacada.carpeta.id)}
                                                        className="font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                                                    >
                                                        Ir a material ?
                                                    </Link>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 4. SECCIÓN: PROGRESO INDIVIDUAL - EXPLORA POR CATEGORÍA CON FOTOS DE PORTADA */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                             Explora por Categoría ({carpetasFiltradas.length})
                        </h2>
                    </div>

                    {carpetasFiltradas.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-sidebar-border/80 p-12 text-center">
                            <div className="flex size-14 items-center justify-center rounded-full bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
                                <Folder className="size-7" />
                            </div>
                            <h3 className="mt-4 text-base font-medium text-foreground">
                                {busqueda ? 'No hay categorías que coincidan con tu búsqueda' : 'No hay categorías disponibles'}
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                                {busqueda ? 'Intenta buscar con otra palabra clave.' : 'El equipo administrativo publicará los módulos de capacitación próximamente.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {carpetasFiltradas.map((carpeta) => {
                                const folderColor = carpeta.color || '#0D9488';
                                return (
                                    <Card
                                        key={carpeta.id}
                                        className="group relative flex flex-col justify-between overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg border-sidebar-border/70 dark:border-sidebar-border bg-card"
                                    >
                                        {/* Foto de Portada o Barra de Color */}
                                        {carpeta.portada_url ? (
                                            <div className="relative h-64 w-full overflow-hidden bg-muted">
                                                <img
                                                    src={carpeta.portada_url}
                                                    alt={carpeta.nombre}
                                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                                                <div
                                                    className="absolute bottom-2.5 left-3 size-9 rounded-lg flex items-center justify-center shadow-md"
                                                    style={{ backgroundColor: folderColor, color: '#ffffff' }}
                                                >
                                                    <Folder className="size-5 fill-current" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                className="h-2 w-full"
                                                style={{ backgroundColor: folderColor }}
                                            />
                                        )}

                                        <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-4">
                                            <div>
                                                <div className="flex items-start justify-between gap-2">
                                                    {!carpeta.portada_url && (
                                                        <div
                                                            className="flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
                                                            style={{
                                                                backgroundColor: `${folderColor}1a`,
                                                                color: folderColor,
                                                            }}
                                                        >
                                                            <Folder className="size-5 fill-current opacity-90" />
                                                        </div>
                                                    )}

                                                    {carpeta.completada ? (
                                                        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800 text-xs font-semibold ml-auto">
                                                            <CheckCircle2 className="size-3 mr-1" />
                                                            ? COMPLETADA 100%
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-xs font-bold text-muted-foreground ml-auto">
                                                            {carpeta.porcentaje}%
                                                        </span>
                                                    )}
                                                </div>

                                                <h3 className="mt-2 font-bold text-base text-foreground line-clamp-1 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                                                    {carpeta.nombre}
                                                </h3>

                                                {carpeta.descripcion && (
                                                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                                        {carpeta.descripcion}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Barra de progreso de la carpeta */}
                                            <div className="space-y-2 pt-2 border-t border-border/50">
                                                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                                                    <span>
                                                        {carpeta.revisados_count} de {carpeta.total_materiales} revisadas
                                                    </span>
                                                </div>

                                                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-300"
                                                        style={{
                                                            width: `${carpeta.porcentaje}%`,
                                                            backgroundColor: carpeta.completada ? '#10B981' : folderColor,
                                                        }}
                                                    />
                                                </div>

                                                <Button
                                                    asChild
                                                    variant={carpeta.completada ? 'outline' : 'default'}
                                                    size="sm"
                                                    className="w-full mt-2 rounded-xl"
                                                    style={
                                                        !carpeta.completada
                                                            ? { backgroundColor: folderColor, color: '#ffffff' }
                                                            : undefined
                                                    }
                                                >
                                                    <Link href={route('portal.capacitaciones.carpetas.show', carpeta.id)}>
                                                        {carpeta.completada ? 'Repasar material' : 'Continuar ?'}
                                                    </Link>
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 5. SECCIÓN: CAPACITACIONES RECIENTES DEL USUARIO */}
                {recientes.length > 0 && (
                    <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-2">
                            <Clock className="size-5 text-teal-600 dark:text-teal-400" />
                            <h2 className="text-base font-bold uppercase tracking-wider text-foreground">
                                 Capacitaciones Recientes
                            </h2>
                        </div>
                        <p className="text-xs text-muted-foreground -mt-2">
                            Últimas capacitaciones que has consultado en tu perfil.
                        </p>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {recientes.map((reciente) => {
                                const catInfo = getFileCategoryInfo(reciente.tipo);
                                return (
                                    <div
                                        key={reciente.id}
                                        className="flex items-center justify-between gap-3 rounded-xl border border-sidebar-border/70 p-3.5 bg-card transition-all hover:bg-muted/40 dark:border-sidebar-border shadow-sm"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${catInfo.bgColor}`}>
                                                <FileIcon tipo={reciente.tipo} className="size-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">
                                                    {reciente.titulo}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                    {reciente.carpeta && (
                                                        <span className="font-medium text-teal-600 dark:text-teal-400 truncate max-w-[120px]">
                                                             {reciente.carpeta.nombre}
                                                        </span>
                                                    )}
                                                    <span>•</span>
                                                    <span className="capitalize">{reciente.revisada_humano}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="shrink-0">
                                            {reciente.carpeta && (
                                                <Button size="sm" variant="ghost" asChild className="size-8 p-0">
                                                    <Link
                                                        href={route('portal.capacitaciones.carpetas.show', reciente.carpeta.id)}
                                                        title="Ver capacitacion"
                                                    >
                                                        <ArrowRight className="size-4 text-muted-foreground hover:text-foreground" />
                                                    </Link>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
