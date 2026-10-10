import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Camera,
    ChevronDown,
    Eye,
    FileText,
    Folder,
    FolderOpen,
    HeartHandshake,
    HeartHandshake as ParejasIcon,
    ImageIcon,
    ListChecks,
    Search,
    Sparkles,
    Star,
    Trash2,
    Upload,
    UserCheck,
    Users,
} from 'lucide-react';
import { useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'Plan Padrinos', href: '/modules/gente/plan-padrinos' },
    { title: 'Parejas Padrinos y Apadrinados', href: '/modules/gente/plan-padrinos/parejas' },
];

interface HistorialApadrinadoItem {
    id: number;
    nombre_completo: string;
    cargo: string;
    imagen: string | null;
    fecha_ingreso: string;
}

interface HistorialPadrino {
    veces_padrino: number;
    apadrinados_list: HistorialApadrinadoItem[];
    fue_apadrinado: boolean;
    padrino_guia: {
        id: number;
        nombre_completo: string;
        cargo: string;
        imagen: string | null;
    } | null;
    fecha_ingreso: string;
}

interface PadrinoSummary {
    id: number;
    nombre_completo: string;
    cargo: string;
    imagen: string | null;
    historial?: HistorialPadrino;
}

interface Evidencia {
    id: number;
    url: string;
    etapa?: string;
    fecha?: string | null;
}

interface Apadrinado {
    id: number;
    cedula: string;
    nombre_completo: string;
    cargo: string;
    area: string;
    imagen: string | null;
    fecha_ingreso: string;
    antiguedad_texto: string;
    dias_en_empresa: number;
    es_padrino: boolean;
    tipo_padrino: string | null;
    padrino_id: number | null;
    padrino: PadrinoSummary | null;
    nivel_autonomia: string;
    evidencias?: Evidencia[];
}

interface Metrics {
    total_padrinos: number;
    total_apadrinados: number;
    parejas_activas: number;
    sin_padrino: number;
}

interface Filters {
    search: string;
    padrino_id: number | null;
}

interface Props {
    padrinos: PadrinoSummary[];
    apadrinados: Apadrinado[];
    metrics: Metrics;
    filters: Filters;
}

function EvidenciasSeccion({
    colaboradorId,
    evidencias = [],
    canManage,
}: {
    colaboradorId: number;
    evidencias?: Evidencia[];
    canManage: boolean;
}) {
    const [subiendoEtapa, setSubiendoEtapa] = useState<'7_dias' | '30_dias' | '90_dias' | null>(null);
    const [eliminandoId, setEliminandoId] = useState<number | null>(null);
    const [carpetaAbierta, setCarpetaAbierta] = useState<'7_dias' | '30_dias' | '90_dias' | null>(null);
    const [archivoAmpliado, setArchivoAmpliado] = useState<{ url: string; esPdf: boolean } | null>(null);

    const ref7 = useRef<HTMLInputElement>(null);
    const ref30 = useRef<HTMLInputElement>(null);
    const ref90 = useRef<HTMLInputElement>(null);

    const getRef = (etapa: '7_dias' | '30_dias' | '90_dias') => {
        if (etapa === '7_dias') return ref7;
        if (etapa === '30_dias') return ref30;
        return ref90;
    };

    const handleUploadFiles = (e: React.ChangeEvent<HTMLInputElement>, etapa: '7_dias' | '30_dias' | '90_dias') => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const formData = new FormData();
        formData.append('colaborador_id', String(colaboradorId));
        formData.append('etapa', etapa);
        Array.from(files).forEach((file) => {
            formData.append('evidencias[]', file);
        });

        setSubiendoEtapa(etapa);
        router.post(route('gente.plan-padrinos.evidencias.subir'), formData, {
            preserveScroll: true,
            onFinish: () => {
                setSubiendoEtapa(null);
                const currentRef = getRef(etapa).current;
                if (currentRef) currentRef.value = '';
            },
        });
    };

    const handleEliminar = (evidenciaId: number) => {
        if (!confirm('¿Estás seguro de eliminar esta evidencia?')) return;
        setEliminandoId(evidenciaId);
        router.delete(route('gente.plan-padrinos.evidencias.eliminar', evidenciaId), {
            preserveScroll: true,
            onFinish: () => setEliminandoId(null),
        });
    };

    const carpetas = [
        {
            key: '7_dias' as const,
            titulo: 'Carpeta 7 Días',
            colorBg: 'bg-blue-500/10 dark:bg-blue-950/20',
            colorBorder: 'border-blue-300 dark:border-blue-800',
            colorText: 'text-blue-700 dark:text-blue-300',
            badgeBg: 'bg-blue-600 text-white',
        },
        {
            key: '30_dias' as const,
            titulo: 'Carpeta 30 Días',
            colorBg: 'bg-purple-500/10 dark:bg-purple-950/20',
            colorBorder: 'border-purple-300 dark:border-purple-800',
            colorText: 'text-purple-700 dark:text-purple-300',
            badgeBg: 'bg-purple-600 text-white',
        },
        {
            key: '90_dias' as const,
            titulo: 'Carpeta 90 Días',
            colorBg: 'bg-amber-500/10 dark:bg-amber-950/20',
            colorBorder: 'border-amber-300 dark:border-amber-800',
            colorText: 'text-amber-700 dark:text-amber-300',
            badgeBg: 'bg-amber-600 text-white',
        },
    ];

    const toggleCarpeta = (key: '7_dias' | '30_dias' | '90_dias') => {
        setCarpetaAbierta((prev) => (prev === key ? null : key));
    };

    return (
        <div className="mt-3 pt-3 border-t border-border/60 flex flex-col gap-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                        Carpetas de Evidencias ({evidencias.length} en total)
                    </span>
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">
                    Haz clic en una carpeta para desplegar información
                </span>
            </div>

            {/* CARPETAS DESPLEGABLES */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {carpetas.map((c) => {
                    const archivosCarpeta = evidencias.filter((ev) => ev.etapa === c.key);
                    const estaAbierta = carpetaAbierta === c.key;

                    return (
                        <div
                            key={c.key}
                            className={`flex flex-col rounded-xl border transition-all ${c.colorBorder} ${c.colorBg} overflow-hidden shadow-2xs`}
                        >
                            <button
                                type="button"
                                onClick={() => toggleCarpeta(c.key)}
                                className="w-full flex items-center justify-between p-3 text-left font-bold text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            >
                                <div className="flex items-center gap-2">
                                    {estaAbierta ? (
                                        <FolderOpen className={`h-4.5 w-4.5 ${c.colorText}`} />
                                    ) : (
                                        <Folder className={`h-4.5 w-4.5 ${c.colorText}`} />
                                    )}
                                    <span className={`text-xs font-bold ${c.colorText}`}>
                                        {c.titulo}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Badge className={`${c.badgeBg} text-[9px] px-1.5 py-0 font-bold`}>
                                        {archivosCarpeta.length} {archivosCarpeta.length === 1 ? 'archivo' : 'archivos'}
                                    </Badge>
                                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${estaAbierta ? 'rotate-180' : ''}`} />
                                </div>
                            </button>

                            {estaAbierta && (
                                <div className="p-3 border-t border-black/10 dark:border-white/10 bg-background/90 flex flex-col gap-2.5">
                                    {canManage && (
                                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
                                            <span className="text-[10px] font-semibold text-muted-foreground">
                                                Subir a esta carpeta:
                                            </span>
                                            <input
                                                type="file"
                                                ref={getRef(c.key)}
                                                onChange={(e) => handleUploadFiles(e, c.key)}
                                                accept="image/*,.pdf,application/pdf"
                                                multiple
                                                className="hidden"
                                                id={`file-input-pareja-${colaboradorId}-${c.key}`}
                                            />
                                            <Button
                                                size="sm"
                                                disabled={subiendoEtapa === c.key}
                                                onClick={() => getRef(c.key).current?.click()}
                                                className="h-6 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white gap-1 font-medium shadow-2xs"
                                            >
                                                <Upload className="h-3 w-3" />
                                                {subiendoEtapa === c.key ? 'Subiendo...' : 'Subir Archivo'}
                                            </Button>
                                        </div>
                                    )}

                                    {archivosCarpeta.length === 0 ? (
                                        <div className="flex items-center justify-center p-3 text-center rounded-lg border border-dashed border-border/70 bg-muted/20 text-muted-foreground text-[11px] gap-2">
                                            <ImageIcon className="h-3.5 w-3.5 opacity-50" />
                                            <span>No hay evidencias en {c.titulo} aún.</span>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                            {archivosCarpeta.map((ev) => {
                                                const esPdf = ev.url.toLowerCase().endsWith('.pdf');

                                                return (
                                                    <div
                                                        key={ev.id}
                                                        className="group relative aspect-square rounded-lg overflow-hidden border border-border/80 bg-muted shadow-2xs hover:shadow-md transition-all flex flex-col items-center justify-center"
                                                    >
                                                        {esPdf ? (
                                                            <div
                                                                className="flex flex-col items-center justify-center gap-1 p-1.5 text-center w-full h-full bg-rose-50/50 dark:bg-rose-950/20 cursor-pointer"
                                                                onClick={() => window.open(ev.url, '_blank')}
                                                            >
                                                                <FileText className="h-7 w-7 text-rose-600 dark:text-rose-400" />
                                                                <span className="text-[9px] font-bold text-foreground line-clamp-1">
                                                                    PDF
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <img
                                                                src={ev.url}
                                                                alt="Evidencia"
                                                                className="h-full w-full object-cover group-hover:scale-105 transition-transform cursor-pointer"
                                                                onClick={() => setArchivoAmpliado({ url: ev.url, esPdf: false })}
                                                            />
                                                        )}

                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="secondary"
                                                                className="h-6 w-6 bg-white/90 hover:bg-white text-black rounded-full"
                                                                onClick={() => {
                                                                    if (esPdf) {
                                                                        window.open(ev.url, '_blank');
                                                                    } else {
                                                                        setArchivoAmpliado({ url: ev.url, esPdf: false });
                                                                    }
                                                                }}
                                                                title={esPdf ? 'Abrir PDF' : 'Ver foto'}
                                                            >
                                                                <Eye className="h-3 w-3" />
                                                            </Button>
                                                            {canManage && (
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="destructive"
                                                                    disabled={eliminandoId === ev.id}
                                                                    className="h-6 w-6 rounded-full"
                                                                    onClick={() => handleEliminar(ev.id)}
                                                                    title="Eliminar"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Lightbox Dialog */}
            <Dialog open={!!archivoAmpliado} onOpenChange={() => setArchivoAmpliado(null)}>
                <DialogContent className="sm:max-w-3xl p-2 bg-black/95 border-none">
                    <DialogTitle className="sr-only">Visualización de Evidencia</DialogTitle>
                    {archivoAmpliado && !archivoAmpliado.esPdf && (
                        <div className="relative flex items-center justify-center max-h-[85vh] w-full p-2">
                            <img
                                src={archivoAmpliado.url}
                                alt="Evidencia ampliada"
                                className="max-h-[80vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function ParejasIndex({ padrinos, apadrinados, metrics, filters }: Props) {
    const { auth } = usePage<SharedData>().props;
    const canManage = auth.isAdmin || auth.roles.includes('Gente');

    const [search, setSearch] = useState(filters.search || '');
    const [padrinoFiltro, setPadrinoFiltro] = useState<string>(
        filters.padrino_id ? String(filters.padrino_id) : 'todos'
    );
    const [updatingId, setUpdatingId] = useState<number | null>(null);

    // Estado desplegable para mostrar solo el box compacto inicialmente
    const [expandidos, setExpandidos] = useState<Record<number, boolean>>({});

    const toggleExpandido = (id: number) => {
        setExpandidos((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearch(val);
        router.get(
            route('gente.plan-padrinos.parejas'),
            { search: val, padrino_id: padrinoFiltro === 'todos' ? undefined : padrinoFiltro },
            { preserveState: true, replace: true }
        );
    };

    const handlePadrinoFilterChange = (val: string) => {
        setPadrinoFiltro(val);
        router.get(
            route('gente.plan-padrinos.parejas'),
            { search, padrino_id: val === 'todos' ? undefined : val },
            { preserveState: true, replace: true }
        );
    };

    const handleAsignarPadrino = (colaboradorId: number, padrinoId: number | null) => {
        setUpdatingId(colaboradorId);
        router.post(
            route('gente.plan-padrinos.apadrinados.asignar-padrino'),
            {
                colaborador_id: colaboradorId,
                padrino_id: padrinoId,
            },
            {
                preserveScroll: true,
                onFinish: () => setUpdatingId(null),
            }
        );
    };

    // Filtrar únicamente los Padrinos que tienen al menos 1 apadrinado asignado (Parejas constituidas)
    const parejasExistentes = padrinos
        .map((padrino) => ({
            padrino,
            apadrinados: apadrinados.filter((a) => a.padrino_id === padrino.id),
        }))
        .filter((grupo) => grupo.apadrinados.length > 0);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Parejas Padrinos y Apadrinados — Plan Padrino" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4 md:p-6">
                <HeadingSmall
                    title="Catálogo de Parejas (Padrinos y Apadrinados)"
                    description="Parejas constituidas actualmente entre Padrinos Guía y colaboradores Apadrinados. Haz clic en una pareja para desplegar sus evidencias."
                />

                {/* Pestañas del submódulo */}
                <div className="flex items-center gap-2 border-b pb-2 flex-wrap">
                    <Link
                        href="/modules/gente/plan-padrinos"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                    >
                        <HeartHandshake className="h-4 w-4" />
                        Seguimiento de Pruebas
                    </Link>
                    <Link
                        href="/modules/gente/plan-padrinos/criterios"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                    >
                        <ListChecks className="h-4 w-4" />
                        Criterios y Nivel de Autonomía
                    </Link>
                    <Link
                        href="/modules/gente/plan-padrinos/padrinos"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                    >
                        <Star className="h-4 w-4" />
                        Padrinos
                    </Link>
                    <Link
                        href="/modules/gente/plan-padrinos/apadrinados"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                    >
                        <Users className="h-4 w-4" />
                        Apadrinados
                    </Link>
                    <Link
                        href="/modules/gente/plan-padrinos/parejas"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground shadow-xs"
                    >
                        <ParejasIcon className="h-4 w-4" />
                        Parejas Padrino - Apadrinado
                    </Link>
                </div>

                {/* Resumen Métricas */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Card className="border-border/60 bg-card shadow-xs">
                        <CardContent className="flex items-center justify-between p-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Padrinos Guía Activos
                                </span>
                                <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                    {metrics.total_padrinos}
                                </span>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                <Star className="h-5 w-5" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-card shadow-xs">
                        <CardContent className="flex items-center justify-between p-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Parejas Constituidas
                                </span>
                                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                    {metrics.parejas_activas}
                                </span>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <Sparkles className="h-5 w-5" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-card shadow-xs">
                        <CardContent className="flex items-center justify-between p-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Apadrinados Asignados
                                </span>
                                <span className="text-2xl font-bold text-sky-600 dark:text-sky-400">
                                    {metrics.parejas_activas}
                                </span>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                                <Users className="h-5 w-5" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filtros */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nombre, cédula o cargo..."
                            value={search}
                            onChange={handleSearchChange}
                            className="pl-9 text-sm"
                        />
                    </div>

                    <div className="w-full sm:w-64">
                        <Select value={padrinoFiltro} onValueChange={handlePadrinoFilterChange}>
                            <SelectTrigger className="h-9 text-xs font-medium">
                                <SelectValue placeholder="Filtrar por Padrino" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos" className="text-xs">Todos los Padrinos</SelectItem>
                                {padrinos.map((p) => (
                                    <SelectItem key={p.id} value={String(p.id)} className="text-xs font-medium">
                                        ★ Padrino: {p.nombre_completo}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Catálogo de parejas existentes */}
                <div className="flex flex-col gap-6">
                    {parejasExistentes.length === 0 ? (
                        <Card className="border-border/60">
                            <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground text-center">
                                <Sparkles className="h-14 w-14 opacity-20 text-purple-500" />
                                <p className="text-base font-bold text-foreground">No hay parejas de Padrino - Apadrinado constituidas aún.</p>
                                <p className="text-xs text-muted-foreground max-w-md">
                                    Crea y asigna apadrinamientos desde la vista de Apadrinados con el botón <strong>Crear Apadrinamiento</strong>.
                                </p>
                                <Button asChild className="mt-2 bg-purple-600 hover:bg-purple-700 text-white">
                                    <Link href="/modules/gente/plan-padrinos/apadrinados">
                                        Ir a Apadrinados y Asignar
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        parejasExistentes.map(({ padrino, apadrinados: apadrinadosPadrino }) => (
                            <Card key={padrino.id} className="border-purple-300/50 dark:border-purple-900/40 bg-card shadow-xs overflow-hidden">
                                <CardHeader className="bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent border-b border-purple-200/60 dark:border-purple-900/30 py-3.5 px-5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            {padrino.imagen ? (
                                                <img
                                                    src={`/storage/${padrino.imagen}`}
                                                    alt={padrino.nombre_completo}
                                                    className="h-12 w-12 rounded-full object-cover border-2 border-purple-400 shadow-xs shrink-0"
                                                />
                                            ) : (
                                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-600 text-white font-bold text-sm shadow-xs shrink-0">
                                                    <Star className="h-6 w-6 fill-current" />
                                                </div>
                                            )}
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-base font-bold text-foreground">
                                                        Padrino: {padrino.nombre_completo}
                                                    </span>
                                                    <Badge className="bg-purple-600 text-white text-[10px] px-2 py-0">
                                                        ★ Padrino Guía
                                                    </Badge>
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    Cargo: {padrino.cargo}
                                                </span>
                                            </div>
                                        </div>

                                        <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-300 font-bold text-xs py-1">
                                            {apadrinadosPadrino.length} {apadrinadosPadrino.length === 1 ? 'Apadrinado' : 'Apadrinados'}
                                        </Badge>
                                    </div>
                                </CardHeader>

                                <CardContent className="p-5 flex flex-col gap-4">
                                    {apadrinadosPadrino.map((apadrinado) => {
                                        const estaExpandido = !!expandidos[apadrinado.id];

                                        return (
                                            <div
                                                key={apadrinado.id}
                                                className="group flex flex-col gap-3 rounded-xl border border-purple-200 dark:border-purple-900/40 bg-purple-50/20 dark:bg-purple-950/10 p-4 shadow-2xs hover:border-purple-400 transition-colors cursor-pointer"
                                                onClick={() => toggleExpandido(apadrinado.id)}
                                            >
                                                {/* PAREJA SIDE BY SIDE COMPACTA */}
                                                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4 bg-card/80 p-3.5 rounded-lg border border-border/50">
                                                    {/* PADRINO GUÍA */}
                                                    <div className="flex items-center gap-3 bg-purple-500/10 p-3 rounded-lg border border-purple-300/40">
                                                        {padrino.imagen ? (
                                                            <img
                                                                src={`/storage/${padrino.imagen}`}
                                                                alt={padrino.nombre_completo}
                                                                className="h-12 w-12 rounded-full object-cover border-2 border-purple-400 shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-600 text-white font-bold text-sm shrink-0">
                                                                <Star className="h-6 w-6 fill-current" />
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase">
                                                                Padrino Guía
                                                            </span>
                                                            <span className="text-xs font-bold text-foreground truncate">
                                                                {padrino.nombre_completo}
                                                            </span>
                                                            <span className="text-[11px] text-muted-foreground truncate">
                                                                {padrino.cargo}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* ICONO CONECTOR */}
                                                    <div className="flex flex-col items-center justify-center text-purple-600">
                                                        <HeartHandshake className="h-5 w-5" />
                                                    </div>

                                                    {/* APADRINADO */}
                                                    <div className="flex items-center gap-3 bg-sky-500/10 p-3 rounded-lg border border-sky-300/40">
                                                        {apadrinado.imagen ? (
                                                            <img
                                                                src={`/storage/${apadrinado.imagen}`}
                                                                alt={apadrinado.nombre_completo}
                                                                className="h-12 w-12 rounded-full object-cover border-2 border-sky-400 shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-600 text-white font-bold text-sm shrink-0">
                                                                <UserCheck className="h-6 w-6" />
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[10px] font-bold text-sky-700 dark:text-sky-300 uppercase">
                                                                Apadrinado
                                                            </span>
                                                            <span className="text-xs font-bold text-foreground truncate">
                                                                {apadrinado.nombre_completo}
                                                            </span>
                                                            <span className="text-[11px] text-muted-foreground truncate">
                                                                {apadrinado.cargo}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* INDICADOR PARA DESPLEGAR */}
                                                <div className="flex items-center justify-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 font-semibold pt-0.5">
                                                    <span>{estaExpandido ? 'Ocultar detalles' : 'Haz clic para desplegar toda la información y carpetas'}</span>
                                                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${estaExpandido ? 'rotate-180' : ''}`} />
                                                </div>

                                                {/* CONTENIDO DESPLEGADO AL DAR CLIC */}
                                                {estaExpandido && (
                                                    <div
                                                        className="pt-3 border-t border-border/60 flex flex-col gap-3 cursor-default"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {canManage && (
                                                            <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/40">
                                                                <span className="text-xs text-muted-foreground">
                                                                    Ingreso: <strong className="text-foreground">{apadrinado.fecha_ingreso}</strong> ({apadrinado.antiguedad_texto})
                                                                </span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[11px] font-semibold text-muted-foreground">
                                                                        Reasignar Padrino:
                                                                    </span>
                                                                    <Select
                                                                        disabled={updatingId === apadrinado.id}
                                                                        value={String(apadrinado.padrino_id ?? 'ninguno')}
                                                                        onValueChange={(val) => handleAsignarPadrino(apadrinado.id, val === 'ninguno' ? null : parseInt(val, 10))}
                                                                    >
                                                                        <SelectTrigger className="h-7 text-xs bg-card border-purple-300/80 w-44">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="ninguno" className="text-xs text-muted-foreground">Desvincular (Quitar de parejas)</SelectItem>
                                                                            {padrinos.map((p) => (
                                                                                <SelectItem key={p.id} value={String(p.id)} className="text-xs font-medium">
                                                                                    ★ {p.nombre_completo}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* CARPETAS DESPLEGABLES DE EVIDENCIAS */}
                                                        <EvidenciasSeccion
                                                            colaboradorId={apadrinado.id}
                                                            evidencias={apadrinado.evidencias || []}
                                                            canManage={canManage}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
