import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Calendar,
    Camera,
    ChevronDown,
    Clock,
    Eye,
    FileText,
    Folder,
    FolderOpen,
    HeartHandshake,
    ImageIcon,
    ListChecks,
    Plus,
    Search,
    Star,
    Trash2,
    Upload,
    UserCheck,
    UserPlus,
    Users,
} from 'lucide-react';
import { useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Gente', href: '/modules/gente' },
    { title: 'Plan Padrinos', href: '/modules/gente/plan-padrinos' },
    { title: 'Apadrinados', href: '/modules/gente/plan-padrinos/apadrinados' },
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
    evidencias: Evidencia[];
}

interface Metrics {
    total: number;
    recientes_30: number;
    periodo_prueba_90: number;
}

interface Filters {
    search: string;
}

interface Props {
    apadrinados: Apadrinado[];
    padrinosList: PadrinoSummary[];
    metrics: Metrics;
    filters: Filters;
}

function EvidenciasSeccion({
    colaboradorId,
    evidencias = [],
    canManage,
}: {
    colaboradorId: number;
    evidencias: Evidencia[];
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
        <div className="mt-2 pt-3 border-t border-border/60 flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Carpetas de Evidencias ({evidencias.length} en total)
                    </span>
                </div>
                <span className="text-[11px] text-muted-foreground font-medium">
                    Haz clic en una carpeta para desplegar archivos
                </span>
            </div>

            {/* CARPETAS DESPLEGABLES */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                                className="w-full flex items-center justify-between p-3.5 text-left font-bold text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            >
                                <div className="flex items-center gap-2.5">
                                    {estaAbierta ? (
                                        <FolderOpen className={`h-5 w-5 ${c.colorText}`} />
                                    ) : (
                                        <Folder className={`h-5 w-5 ${c.colorText}`} />
                                    )}
                                    <span className={`text-xs font-bold ${c.colorText}`}>
                                        {c.titulo}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge className={`${c.badgeBg} text-[10px] px-2 py-0.5 font-bold`}>
                                        {archivosCarpeta.length} {archivosCarpeta.length === 1 ? 'archivo' : 'archivos'}
                                    </Badge>
                                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${estaAbierta ? 'rotate-180' : ''}`} />
                                </div>
                            </button>

                            {estaAbierta && (
                                <div className="p-3.5 border-t border-black/10 dark:border-white/10 bg-background/90 flex flex-col gap-3">
                                    {canManage && (
                                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
                                            <span className="text-[11px] font-semibold text-muted-foreground">
                                                Subir a esta carpeta:
                                            </span>
                                            <input
                                                type="file"
                                                ref={getRef(c.key)}
                                                onChange={(e) => handleUploadFiles(e, c.key)}
                                                accept="image/*,.pdf,application/pdf"
                                                multiple
                                                className="hidden"
                                                id={`file-input-${colaboradorId}-${c.key}`}
                                            />
                                            <Button
                                                size="sm"
                                                disabled={subiendoEtapa === c.key}
                                                onClick={() => getRef(c.key).current?.click()}
                                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 font-medium shadow-2xs"
                                            >
                                                <Upload className="h-3 w-3" />
                                                {subiendoEtapa === c.key ? 'Subiendo...' : 'Subir Archivo'}
                                            </Button>
                                        </div>
                                    )}

                                    {archivosCarpeta.length === 0 ? (
                                        <div className="flex items-center justify-center p-4 text-center rounded-lg border border-dashed border-border/70 text-muted-foreground text-xs gap-2 bg-muted/20">
                                            <ImageIcon className="h-4 w-4 opacity-50" />
                                            <span>No hay evidencias guardadas en {c.titulo}.</span>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
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
                                                                    Documento PDF
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

            {/* Lightbox Dialog para Fotos */}
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

// ─── Mini card del grid para Apadrinados ────────────────────────────────────
function ApadrinadoMiniCard({
    apadrinado,
    onClick,
}: {
    apadrinado: Apadrinado;
    onClick: () => void;
}) {
    const partes = apadrinado.nombre_completo.trim().split(' ');
    const nombre1 = partes[0] ?? '';
    const nombre2 = partes.slice(1, 3).join(' ');

    return (
        <div
            onClick={onClick}
            className="group relative overflow-hidden rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 text-left bg-white border border-sky-100 hover:border-sky-300 cursor-pointer"
            style={{ aspectRatio: '3/4' }}
        >
            {/* Fondo con ondas decorativas azuladas */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 400" preserveAspectRatio="none">
                <ellipse cx="270" cy="30" rx="80" ry="80" fill="#bae6fd" opacity="0.5" />
                <ellipse cx="-20" cy="380" rx="100" ry="80" fill="#7dd3fc" opacity="0.4" />
                <path d="M0,300 Q150,250 300,320 L300,400 L0,400 Z" fill="#e0f2fe" opacity="0.6" />
            </svg>

            {/* Foto grande — 70% superior */}
            <div className="relative h-[68%] overflow-hidden">
                {apadrinado.imagen ? (
                    <img
                        src={`/storage/${apadrinado.imagen}`}
                        alt={apadrinado.nombre_completo}
                        className="absolute inset-0 w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-sky-100 to-sky-200">
                        <UserCheck className="h-16 w-16 text-sky-600" />
                    </div>
                )}
                {/* Onda sobre la foto */}
                <svg className="absolute bottom-0 left-0 w-full pointer-events-none" viewBox="0 0 300 40" preserveAspectRatio="none" style={{ height: 40 }}>
                    <path d="M0,20 Q75,0 150,20 Q225,40 300,20 L300,40 L0,40 Z" fill="white" />
                </svg>
                {/* Badge */}
                <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                    <Users className="h-2.5 w-2.5" /> Apadrinado
                </span>
            </div>

            {/* Datos — 32% inferior */}
            <div className="relative flex flex-col items-center justify-center px-3 pb-3 pt-1 text-center gap-0.5">
                <p className="text-sm font-black text-sky-500 leading-tight">{nombre1}</p>
                <p className="text-sm font-black text-sky-700 leading-tight">{nombre2}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{apadrinado.cargo}</p>
                <p className="text-[9px] font-semibold text-sky-600 mt-0.5">Ingreso: {apadrinado.fecha_ingreso}</p>
            </div>
        </div>
    );
}

// ─── Modal de detalle del apadrinado ─────────────────────────────────────────
function ApadrinadoDetalleModal({
    apadrinado,
    padrinosList,
    canManage,
    open,
    onOpenChange,
}: {
    apadrinado: Apadrinado;
    padrinosList: PadrinoSummary[];
    canManage: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [updatingId, setUpdatingId] = useState<number | null>(null);

    const handleAsignarPadrino = (colaboradorId: number, padrinoId: number | null) => {
        setUpdatingId(colaboradorId);
        router.post(
            route('gente.plan-padrinos.apadrinados.asignar-padrino'),
            { colaborador_id: colaboradorId, padrino_id: padrinoId },
            {
                preserveScroll: true,
                onSuccess: () => onOpenChange(false),
                onFinish: () => setUpdatingId(null),
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <UserCheck className="h-5 w-5 text-sky-600" />
                        {apadrinado.nombre_completo}
                    </DialogTitle>
                    <DialogDescription>{apadrinado.cargo}</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-2">
                    {/* Foto y datos básicos */}
                    <div className="flex items-center gap-4">
                        {apadrinado.imagen ? (
                            <img
                                src={`/storage/${apadrinado.imagen}`}
                                alt={apadrinado.nombre_completo}
                                className="h-20 w-20 rounded-full object-cover border-4 border-sky-300 shadow-md shrink-0"
                            />
                        ) : (
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sky-100 border-4 border-sky-300 shadow-md shrink-0">
                                <UserCheck className="h-9 w-9 text-sky-600" />
                            </div>
                        )}
                        <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-xs font-mono text-muted-foreground">Cédula: {apadrinado.cedula}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5 text-sky-600" />
                                Ingreso: <strong className="text-foreground ml-1">{apadrinado.fecha_ingreso}</strong>
                            </span>
                            <span className="text-xs text-muted-foreground">
                                Antigüedad: <strong className="text-foreground">{apadrinado.antiguedad_texto}</strong>
                            </span>
                            <span className="text-xs text-muted-foreground">
                                Área: <strong className="text-foreground">{apadrinado.area}</strong>
                            </span>
                        </div>
                    </div>

                    {/* Asignación de padrino */}
                    {canManage && (
                        <div className="flex flex-col gap-2 bg-sky-500/5 rounded-xl p-3 border border-sky-200">
                            <span className="text-xs font-bold text-sky-700">Asignar Padrino Guía:</span>
                            <Select
                                disabled={updatingId === apadrinado.id}
                                value={String(apadrinado.padrino_id ?? 'ninguno')}
                                onValueChange={(val) =>
                                    handleAsignarPadrino(apadrinado.id, val === 'ninguno' ? null : parseInt(val, 10))
                                }
                            >
                                <SelectTrigger className="h-9 text-xs bg-background border-sky-300">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ninguno" className="text-xs">Sin Padrino</SelectItem>
                                    {padrinosList.map((p) => (
                                        <SelectItem key={p.id} value={String(p.id)} className="text-xs font-medium text-purple-700">
                                            ★ {p.nombre_completo}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Carpetas de evidencias */}
                    <EvidenciasSeccion
                        colaboradorId={apadrinado.id}
                        evidencias={apadrinado.evidencias || []}
                        canManage={canManage}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function ApadrinadosIndex({ apadrinados, padrinosList, metrics, filters }: Props) {
    const { auth } = usePage<SharedData>().props;
    const canManage = auth.isAdmin || auth.roles.includes('Gente');

    const [search, setSearch] = useState(filters.search || '');
    const [detalleApadrinado, setDetalleApadrinado] = useState<Apadrinado | null>(null);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearch(val);
        router.get(
            route('gente.plan-padrinos.apadrinados'),
            { search: val },
            { preserveState: true, replace: true }
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Apadrinados sin Padrino — Plan Padrino" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4 md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <HeadingSmall
                        title="Apadrinados sin Padrino Asignado"
                        description="Colaboradores marcados como Apadrinados que aún no tienen un Padrino Guía asignado. Los que ya tienen pareja activa se muestran en la vista Parejas."
                    />

                    {canManage && (
                        <Link
                            href="/modules/gente/plan-padrinos/padrinos"
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
                        >
                            <Plus className="h-4 w-4" />
                            Crear Apadrinamiento
                        </Link>
                    )}
                </div>

                {/* Pestañas del submódulo */}
                <div className="flex items-center gap-2 border-b pb-2 flex-wrap">
                    <Link
                        href="/modules/gente/plan-padrinos"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                    >
                        <HeartHandshake className="h-4 w-4" />
                        Seguimiento de Pruebas (7, 30, 90 días)
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
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground shadow-xs"
                    >
                        <Users className="h-4 w-4" />
                        Apadrinados
                    </Link>
                    <Link
                        href="/modules/gente/plan-padrinos/parejas"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                    >
                        <HeartHandshake className="h-4 w-4" />
                        Parejas Padrino - Apadrinado
                    </Link>
                </div>

                {/* Tarjetas de métricas */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Card className="border-border/60 bg-card shadow-xs">
                        <CardContent className="flex items-center justify-between p-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Total sin Padrino
                                </span>
                                <span className="text-2xl font-bold text-foreground">
                                    {metrics.total}
                                </span>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                <Users className="h-5 w-5" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-card shadow-xs">
                        <CardContent className="flex items-center justify-between p-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Ingresos Recientes (≤ 30d)
                                </span>
                                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                    {metrics.recientes_30}
                                </span>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <UserPlus className="h-5 w-5" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-card shadow-xs">
                        <CardContent className="flex items-center justify-between p-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    En Prueba (≤ 90d)
                                </span>
                                <span className="text-2xl font-bold text-sky-600 dark:text-sky-400">
                                    {metrics.periodo_prueba_90}
                                </span>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                                <Clock className="h-5 w-5" />
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
                </div>

                {/* Grid de mini cards — igual que la vista de Padrinos */}
                {apadrinados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
                        <Users className="h-16 w-16 opacity-20" />
                        <p className="text-sm">No hay colaboradores apadrinados pendientes de asignación.</p>
                        <p className="text-xs">Todos los apadrinados ya tienen un Padrino Guía. Revisa la vista <strong>Parejas</strong>.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {apadrinados.map((item) => (
                            <ApadrinadoMiniCard
                                key={item.id}
                                apadrinado={item}
                                onClick={() => setDetalleApadrinado(item)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modal de detalle del apadrinado */}
            {detalleApadrinado && (
                <ApadrinadoDetalleModal
                    apadrinado={detalleApadrinado}
                    padrinosList={padrinosList}
                    canManage={canManage}
                    open={!!detalleApadrinado}
                    onOpenChange={(open) => { if (!open) setDetalleApadrinado(null); }}
                />
            )}
        </AppLayout>
    );
}
