import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import {
    Calendar,
    CheckCircle2,
    Clock,
    FileText,
    ImageIcon,
    Info,
    Sparkles,
    Star,
    User,
    UserCheck,
    X,
} from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Portal', href: '/portal' },
    { title: 'Mi Plan Padrinos', href: '/portal/mi-plan-padrinos' },
];

interface Evidencia {
    id: number;
    url: string;
}

interface EtapaInfo {
    label: string;
    fecha_prueba_formateada: string;
    aplica: boolean;
    estado: 'realizada' | 'pendiente' | 'no_aplica';
    fecha_realizacion: string | null;
    realizado_por: string | null;
    evidencias: Evidencia[];
}

interface EvidenciaItem {
    id: number;
    url: string;
}

interface ApadrinadoListaItem {
    id: number;
    nombre_completo: string;
    cargo: string;
    imagen: string | null;
    fecha_inicio: string;
    fecha_fin: string | null;
    dias: number;
    activo: boolean;
    evidencias: Record<string, EvidenciaItem[]>; // '7_dias' | '30_dias' | '90_dias'
}

interface HistorialApadrinadoItem {
    padrino_id: number;
    padrino_nombre: string;
    padrino_cargo: string;
    padrino_imagen: string | null;
    fecha_inicio: string;
    fecha_fin: string | null;
    dias: number;
    activo: boolean;
    evidencias: Record<string, EvidenciaItem[]>; // mis propias evidencias
}

interface ColaboradorInfo {
    id: number;
    nombre_completo: string;
    cedula: string;
    cargo: string;
    area: string;
    turno: string;
    imagen: string | null;
    fecha_ingreso: string;
    es_padrino: boolean;
    tipo_padrino: string | null;
    // historial
    fecha_ingreso_texto: string;
    dias_en_empresa: number;
    veces_padrino: number;
    dias_total_padrino: number;
    tiempo_total_texto: string;
    apadrinados_lista: ApadrinadoListaItem[];
    veces_apadrinado: number;
    historial_apadrinado: HistorialApadrinadoItem[];
    correo: string | null;
    celular: string | null;
    mensaje_padrino: string | null;
}

interface Props {
    colaborador: ColaboradorInfo;
    etapas: Record<string, EtapaInfo>;
}

const COLORES_ETAPA: Record<string, string> = {
    '7_dias': 'border-l-amber-500',
    '30_dias': 'border-l-blue-500',
    '90_dias': 'border-l-purple-500',
};

const COLORES_TITULO: Record<string, string> = {
    '7_dias': 'text-amber-700 dark:text-amber-400',
    '30_dias': 'text-blue-700 dark:text-blue-400',
    '90_dias': 'text-purple-700 dark:text-purple-400',
};

// ─── Carpetas de evidencias compactas (solo lectura) ─────────────────────────
const ETAPAS_CONFIG = [
    { key: '7_dias',  label: '7 Días',  colorBg: 'bg-blue-50',   colorBorder: 'border-blue-200',   colorText: 'text-blue-700'   },
    { key: '30_dias', label: '30 Días', colorBg: 'bg-purple-50', colorBorder: 'border-purple-200', colorText: 'text-purple-700' },
    { key: '90_dias', label: '90 Días', colorBg: 'bg-amber-50',  colorBorder: 'border-amber-200',  colorText: 'text-amber-700'  },
];

function CarpetasEvidencias({ evidencias }: { evidencias: Record<string, EvidenciaItem[]> }) {
    const [ampliada, setAmpliada] = useState<string | null>(null);
    const total = Object.values(evidencias).flat().length;

    if (total === 0) {
        return (
            <p className="text-[10px] text-muted-foreground italic mt-1">Sin evidencias subidas.</p>
        );
    }

    return (
        <>
            <div className="flex flex-wrap gap-2 mt-1.5">
                {ETAPAS_CONFIG.map(({ key, label, colorBg, colorBorder, colorText }) => {
                    const archivos = evidencias[key] ?? [];
                    if (archivos.length === 0) return null;
                    return (
                        <div key={key} className={`rounded-lg border ${colorBorder} ${colorBg} px-2.5 py-1.5`}>
                            <p className={`text-[10px] font-bold ${colorText} mb-1`}>
                                Carpeta {label} ({archivos.length})
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {archivos.map((ev) => {
                                    const esPdf = ev.url.toLowerCase().endsWith('.pdf');
                                    return esPdf ? (
                                        <a key={ev.id} href={ev.url} target="_blank" rel="noopener noreferrer"
                                            className="flex h-10 w-10 items-center justify-center rounded border border-rose-200 bg-rose-50 hover:opacity-80 transition-opacity"
                                            title="Ver PDF">
                                            <FileText className="h-5 w-5 text-rose-500" />
                                        </a>
                                    ) : (
                                        <img key={ev.id} src={ev.url} alt="Evidencia"
                                            onClick={() => setAmpliada(ev.url)}
                                            className="h-10 w-10 rounded object-cover border border-border/50 cursor-pointer hover:opacity-80 transition-opacity"
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Lightbox */}
            <Dialog open={!!ampliada} onOpenChange={() => setAmpliada(null)}>
                <DialogContent className="sm:max-w-2xl p-2 bg-black/95 border-none">
                    <DialogTitle className="sr-only">Evidencia ampliada</DialogTitle>
                    <DialogDescription className="sr-only">Vista ampliada de la evidencia</DialogDescription>
                    {ampliada && (
                        <img src={ampliada} alt="Evidencia ampliada"
                            className="max-h-[80vh] w-auto max-w-full rounded-lg object-contain mx-auto" />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

// ─── Modal de historial Plan Padrino ─────────────────────────────────────────
function HistorialDialog({
    colaborador,
    open,
    onClose,
}: {
    colaborador: ColaboradorInfo;
    open: boolean;
    onClose: () => void;
}) {
    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="w-full max-w-lg rounded-2xl p-0 overflow-hidden shadow-2xl border-0">
                <DialogTitle className="sr-only">Mi historial Plan Padrino</DialogTitle>
                <DialogDescription className="sr-only">
                    Estadísticas de tu participación en el Plan Padrino
                </DialogDescription>

                {/* Cabecera */}
                <div className="relative flex items-center gap-4 bg-gradient-to-r from-emerald-600 to-green-500 px-5 py-4">
                    {colaborador.imagen ? (
                        <img
                            src={`/storage/${colaborador.imagen}`}
                            alt={colaborador.nombre_completo}
                            className="h-14 w-14 rounded-full object-cover border-2 border-white/60 shrink-0"
                        />
                    ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 border-2 border-white/40 shrink-0">
                            <UserCheck className="h-7 w-7 text-white" />
                        </div>
                    )}
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Mi Historial Plan Padrino</span>
                        <h3 className="text-base font-black text-white leading-tight truncate">{colaborador.nombre_completo}</h3>
                        <span className="text-[11px] text-white/80 truncate">{colaborador.cargo}</span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Cuerpo */}
                <div className="flex flex-col gap-4 p-5 max-h-[70vh] overflow-y-auto">

                    {/* Ingreso */}
                    <div className="flex items-center gap-3 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 shrink-0">
                            <Clock className="h-4 w-4 text-gray-600" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Ingreso a la empresa</span>
                            <span className="text-sm font-bold text-foreground">
                                {colaborador.fecha_ingreso_texto}
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    ({colaborador.dias_en_empresa.toLocaleString()} días en la empresa)
                                </span>
                            </span>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col items-center gap-1 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center">
                            <Star className="h-4 w-4 text-emerald-600 fill-emerald-200" />
                            <span className="text-2xl font-black text-emerald-700 leading-none">{colaborador.veces_padrino}</span>
                            <span className="text-[10px] font-semibold text-emerald-600">
                                {colaborador.veces_padrino === 1 ? 'vez padrino' : 'veces padrino'}
                            </span>
                        </div>
                        <div className="flex flex-col items-center gap-1 rounded-xl bg-green-50 border border-green-200 p-3 text-center">
                            <Clock className="h-4 w-4 text-green-600" />
                            <span className="text-xs font-black text-green-700 leading-tight">
                                {colaborador.dias_total_padrino > 0 ? colaborador.tiempo_total_texto : '—'}
                            </span>
                            <span className="text-[10px] font-semibold text-green-600">tiempo como padrino</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 rounded-xl bg-sky-50 border border-sky-200 p-3 text-center">
                            <Sparkles className="h-4 w-4 text-sky-600" />
                            <span className="text-2xl font-black text-sky-700 leading-none">{colaborador.veces_apadrinado}</span>
                            <span className="text-[10px] font-semibold text-sky-600">
                                {colaborador.veces_apadrinado === 1 ? 'vez apadrinado' : 'veces apadrinado'}
                            </span>
                        </div>
                    </div>

                    {/* Personas que he apadrinado */}
                    <div className="flex flex-col gap-2">
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Star className="h-3.5 w-3.5 text-emerald-600 fill-emerald-200" />
                            Personas que he apadrinado
                        </p>
                        {colaborador.apadrinados_lista.length === 0 ? (
                            <div className="flex items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 py-4 text-xs text-muted-foreground gap-2">
                                <Info className="h-3.5 w-3.5 opacity-50" />
                                Aún no has apadrinado a nadie.
                            </div>
                        ) : (
                            <ul className="flex flex-col gap-1.5">
                                {colaborador.apadrinados_lista.map((a, i) => (
                                    <li key={`${a.id}-${i}`} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2">
                                        {a.imagen ? (
                                            <img src={`/storage/${a.imagen}`} alt={a.nombre_completo}
                                                className="h-8 w-8 rounded-full object-cover border border-emerald-200 shrink-0" />
                                        ) : (
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 shrink-0">
                                                <UserCheck className="h-4 w-4 text-emerald-600" />
                                            </div>
                                        )}
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <span className="text-xs font-semibold text-foreground truncate">{a.nombre_completo}</span>
                                            <span className="text-[10px] text-muted-foreground truncate">{a.cargo}</span>
                                            <CarpetasEvidencias evidencias={a.evidencias ?? {}} />
                                        </div>
                                        <div className="flex flex-col items-end shrink-0 text-right gap-0.5">
                                            <span className="text-[10px] text-muted-foreground">
                                                {a.fecha_inicio} → {a.fecha_fin ?? <span className="text-emerald-600 font-semibold">Activo</span>}
                                            </span>
                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">
                                                {a.dias} días
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Cuando fui apadrinado */}
                    <div className="flex flex-col gap-2">
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-sky-600" />
                            Cuando fui apadrinado
                        </p>
                        {colaborador.historial_apadrinado.length === 0 ? (
                            <div className="flex items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 py-4 text-xs text-muted-foreground gap-2">
                                <Info className="h-3.5 w-3.5 opacity-50" />
                                No fuiste apadrinado en ningún período.
                            </div>
                        ) : (
                            <ul className="flex flex-col gap-1.5">
                                {colaborador.historial_apadrinado.map((h, i) => (
                                    <li key={`ap-${h.padrino_id}-${i}`} className="flex items-center gap-3 rounded-lg border border-sky-100 bg-sky-50/40 px-3 py-2">
                                        {h.padrino_imagen ? (
                                            <img src={`/storage/${h.padrino_imagen}`} alt={h.padrino_nombre}
                                                className="h-8 w-8 rounded-full object-cover border border-sky-200 shrink-0" />
                                        ) : (
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 shrink-0">
                                                <Star className="h-4 w-4 text-sky-600" />
                                            </div>
                                        )}
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wide">Padrino Guía</span>
                                            <span className="text-xs font-semibold text-foreground truncate">{h.padrino_nombre}</span>
                                            <span className="text-[10px] text-muted-foreground truncate">{h.padrino_cargo}</span>
                                            <CarpetasEvidencias evidencias={h.evidencias ?? {}} />
                                        </div>
                                        <div className="flex flex-col items-end shrink-0 text-right gap-0.5">
                                            <span className="text-[10px] text-muted-foreground">
                                                {h.fecha_inicio} → {h.fecha_fin ?? <span className="text-sky-600 font-semibold">Activo</span>}
                                            </span>
                                            <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-1.5 py-0.5">
                                                {h.dias} días
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function MiPlanPadrinos({ colaborador, etapas }: Props) {
    const [modalHistorial, setModalHistorial] = useState(false);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Mi Plan Padrinos" />

            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4 md:p-6">

                {/* Encabezado del colaborador */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-sidebar-border/70 bg-card p-5 shadow-sm dark:border-sidebar-border">
                    {/* Avatar */}
                    <div className="shrink-0">
                        {colaborador.imagen ? (
                            <img
                                src={`/storage/${colaborador.imagen}`}
                                alt={colaborador.nombre_completo}
                                className="h-16 w-16 rounded-full object-cover border-2 border-primary/20"
                            />
                        ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border-2 border-primary/20">
                                <User className="h-8 w-8 text-primary/60" />
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground capitalize">
                            {colaborador.nombre_completo.toLowerCase()}
                        </h1>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-sm text-muted-foreground">C.C. {colaborador.cedula}</span>
                            <span className="text-muted-foreground/40">·</span>
                            <Badge variant="outline" className="capitalize text-xs">{colaborador.cargo.toLowerCase()}</Badge>
                            {colaborador.area && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className="text-xs text-muted-foreground capitalize">{colaborador.area.toLowerCase()}</span>
                                </>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                            <span>Ingreso: <strong className="text-foreground">{colaborador.fecha_ingreso}</strong></span>
                            {colaborador.turno && <span>Turno: <strong className="text-foreground capitalize">{colaborador.turno.toLowerCase()}</strong></span>}
                        </div>
                    </div>

                    {/* Badges + botón historial */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                        {colaborador.es_padrino && (
                            <Badge className="bg-emerald-600 text-white text-xs px-3 py-1.5">
                                ✓ Padrino activo
                                {colaborador.tipo_padrino && ` · ${colaborador.tipo_padrino}`}
                            </Badge>
                        )}
                        <button
                            type="button"
                            onClick={() => setModalHistorial(true)}
                            className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors"
                        >
                            <Star className="h-3.5 w-3.5 fill-emerald-200" />
                            Ver mi historial
                        </button>
                    </div>
                </div>

                {/* Título sección */}
                <div>
                    <h2 className="text-lg font-semibold text-foreground">Pruebas de período</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Evaluaciones de seguimiento a los 7, 30 y 90 días desde tu ingreso.
                    </p>
                </div>

                {/* Tarjetas de etapas */}
                <div className="grid gap-4 sm:grid-cols-3">
                    {Object.entries(etapas).map(([etapaKey, etapa]) => (
                        <Card key={etapaKey} className={`border-l-4 shadow-sm ${COLORES_ETAPA[etapaKey] ?? 'border-l-gray-400'}`}>
                            <CardHeader className="pb-2">
                                <CardTitle className={`text-sm font-semibold ${COLORES_TITULO[etapaKey] ?? ''}`}>
                                    Prueba {etapa.label.replace('_', ' ')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">

                                {/* Fecha programada */}
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1 text-muted-foreground">
                                        <Calendar className="h-3.5 w-3.5" />
                                        Fecha programada
                                    </span>
                                    <span className="font-semibold">{etapa.fecha_prueba_formateada}</span>
                                </div>

                                {/* Estado */}
                                {!etapa.aplica || etapa.estado === 'no_aplica' ? (
                                    <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground text-center">
                                        Aún no aplica
                                    </div>
                                ) : etapa.estado === 'realizada' ? (
                                    <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-3 py-2">
                                        <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold text-xs mb-1">
                                            <CheckCircle2 className="h-4 w-4" />
                                            Realizada
                                        </div>
                                        {etapa.fecha_realizacion && (
                                            <p className="text-[11px] text-muted-foreground">
                                                Fecha: <strong className="text-foreground">{etapa.fecha_realizacion}</strong>
                                            </p>
                                        )}
                                        {etapa.realizado_por && (
                                            <p className="text-[11px] text-muted-foreground">
                                                Por: <strong className="text-foreground">{etapa.realizado_por}</strong>
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2">
                                        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold text-xs">
                                            <Clock className="h-4 w-4" />
                                            Pendiente
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            Comunícate con tu líder para agendar esta prueba.
                                        </p>
                                    </div>
                                )}

                                {/* Evidencias fotográficas */}
                                {etapa.evidencias.length > 0 && (
                                    <div>
                                        <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 mb-1.5">
                                            <ImageIcon className="h-3.5 w-3.5" />
                                            Evidencias ({etapa.evidencias.length})
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {etapa.evidencias.map((ev) => (
                                                <a
                                                    key={ev.id}
                                                    href={ev.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    title="Ver evidencia"
                                                >
                                                    <img
                                                        src={ev.url}
                                                        alt="Evidencia"
                                                        className="h-14 w-14 rounded object-cover border border-border/50 hover:opacity-80 transition-opacity"
                                                    />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {etapa.aplica && etapa.estado !== 'no_aplica' && etapa.evidencias.length === 0 && (
                                    <p className="text-[11px] text-muted-foreground/60 italic">
                                        Sin evidencias registradas aún.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Modal historial */}
            <HistorialDialog
                colaborador={colaborador}
                open={modalHistorial}
                onClose={() => setModalHistorial(false)}
            />
        </AppLayout>
    );
}
