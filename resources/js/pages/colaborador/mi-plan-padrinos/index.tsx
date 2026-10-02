import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Calendar, CheckCircle2, Clock, ImageIcon, ShieldAlert, User } from 'lucide-react';

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

export default function MiPlanPadrinos({ colaborador, etapas }: Props) {
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

                    {/* Badge padrino */}
                    {colaborador.es_padrino && (
                        <div className="shrink-0">
                            <Badge className="bg-emerald-600 text-white text-xs px-3 py-1.5">
                                ✓ Padrino activo
                                {colaborador.tipo_padrino && ` · ${colaborador.tipo_padrino}`}
                            </Badge>
                        </div>
                    )}
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
        </AppLayout>
    );
}
