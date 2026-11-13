
import { SafeImage } from '@/components/safe-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { EntrenamientoDialog } from '@/pages/gente/colaboradores/entrenamiento-dialog';
import { LlamadoAtencionDialog } from '@/pages/gente/colaboradores/llamado-atencion-dialog';
import {
    calcularEdad,
    type DocumentInfo,
} from '@/pages/seguridad/colaboradores/colaborador-form-fields';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    Download,
    FileDown,
    FileSpreadsheet,
    FileText,
    GraduationCap,
    OctagonX,
    Power,
    User,
    XCircle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';

interface ColaboradorDetalle {
    id: number;
    cedula: string;
    nombres: string;
    apellidos: string;
    cargo: string | null;
    turno: string | null;
    area: string | null;
    imagen: string | null;

    // Identificación
    tipo_documento: string | null;
    tipo_documento_otro_label: string | null;
    expedido_en: string | null;
    sexo: string | null;
    fecha_nacimiento: string | null;

    // Contacto y ubicación
    ciudad_residencia: string | null;
    direccion: string | null;
    estrato: string | null;
    celular_1: string | null;
    celular_2: string | null;
    correo: string | null;

    // Información personal
    estado_civil: string | null;
    estado_civil_otro: string | null;
    nombre_pareja: string | null;
    hijos: { nombre: string; fecha_nacimiento: string; edad: string }[] | null;

    // Contactos de emergencia
    emergencia_parentezco_1: string | null;
    emergencia_nombre_1: string | null;
    emergencia_telefono_1: string | null;
    emergencia_parentezco_2: string | null;
    emergencia_nombre_2: string | null;
    emergencia_telefono_2: string | null;

    // Condiciones particulares
    discapacidad: string | null;
    discapacidad_tipo: string | null;
    discapacidad_observaciones: string | null;
    victima_conflicto: string | null;
    victima_conflicto_observaciones: string | null;
    libreta_militar: string | null;
    runt_aplica: string | null;

    // Seguridad social
    eps: string | null;
    eps_otro: string | null;
    afp: string | null;
    afp_otro: string | null;
    arl: string | null;
    arl_otro: string | null;

    // Antecedentes en la empresa
    ha_trabajado_antes: string | null;
    cargo_anterior: string | null;
    fecha_ultima_laboral: string | null;
    motivo_retiro: string | null;
    motivo_retiro_observaciones: string | null;

    // Experiencia
    tiene_experiencia: string | null;
    area_experiencia: string | null;
    cargo_experiencia: string | null;
    anios_experiencia: number | null;

    // Requisitos del cargo
    manejo_defensivo_aplica: string | null;
    conduccion_carga_pesada_aplica: string | null;
    experiencia_terreno_plano: string | null;
    experiencia_terreno_montanoso: string | null;

    // Puesto de trabajo
    centro: string | null;
    centro_trabajo: string | null;

    // Licencia de conducción
    licencia_conduccion_categorias: string[] | null;
    fecha_licencia: string | null;
    fecha_vencimiento_licencia: string | null;
    restricciones_licencia: string | null;

    // SENA (aprendiz)
    sena_especialidad: string | null;
    sena_numero_grupo: number | null;
    sena_institucion: string | null;
    sena_nit: string | null;
    sena_centro_formacion: string | null;

    // QR
    codigo_qr_skap: string | null;

    documento_cedula: DocumentInfo[];
    documento_licencia_conduccion: DocumentInfo[];
    documento_carnet_manejo_defensivo: DocumentInfo[];
    documento_certificado_manejo_defensivo: DocumentInfo[];
    documento_carnet_ingreso_cd: DocumentInfo[];
    documento_simit: DocumentInfo[];
    documento_examen_medico_ocupacional: DocumentInfo[];
    documento_recordatorio_vehiculo_licencia_conduccion: DocumentInfo[];
    documento_eps: DocumentInfo[];
    documento_pension: DocumentInfo[];
    documento_titulo_bachiller: DocumentInfo[];
    documento_titulo_academico: DocumentInfo[];

    is_active: boolean;
    tiene_finalizacion?: boolean;
}

interface IndiceRiesgo {
    puntaje: number;
    nivel: 'Bajo' | 'Medio' | 'Alto';
    pruebas_positivas: number;
    salud_mala: number;
    dias_considerados: number;
}

interface PruebaRow {
    id: number;
    tipo: string;
    resultado: string | null;
    es_positivo: boolean;
    estado: string;
    fecha_hora: string;
    alcoholimetro: { codigo: string } | null;
}

interface CondicionRow {
    id: number;
    momento: string;
    estado: string;
    observacion: string | null;
    fecha_hora: string;
}

interface EvaluacionMedicaRow {
    id: number;
    tipo_evaluacion: string;
    fecha_evaluacion: string;
    estado: string;
    concepto_aptitud: { nombre: string } | null;
}

interface LlamadoAtencionRow {
    id: number;
    observacion: string;
    path: string | null;
    fecha_hora: string;
    registradoPor: { name: string } | null;
}

interface EntrenamientoRow {
    id: number;
    fecha_registro: string;
    hora_registro: string;
    entrenamiento: { nombre: string } | null;
    registradoPor: { name: string } | null;
}

interface CertificadosAprendizaje {
    escuelaPilotos: boolean;
    brigadista: boolean;
}

const SEXO_LABELS: Record<string, string> = { femenino: 'Femenino', masculino: 'Masculino' };
const SI_NO_LABELS: Record<string, string> = { si: 'Si', no: 'No' };
const APLICA_LABELS: Record<string, string> = { aplica: 'Aplica', no_aplica: 'No aplica' };

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="grid gap-0.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium text-foreground">{value ?? '-'}</dd>
        </div>
    );
}

function CvSection({ titulo, children }: { titulo: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-emerald-100 bg-white p-5 shadow-xs dark:border-emerald-900/50 dark:bg-emerald-950/10">
            <h3 className="mb-4 border-l-4 border-emerald-500 pl-3 text-xs font-bold tracking-widest text-emerald-700 uppercase dark:text-emerald-400">
                {titulo}
            </h3>
            {children}
        </div>
    );
}

function documentosDe(colaborador: ColaboradorDetalle, key: string): DocumentInfo[] {
    return (colaborador as unknown as Record<string, DocumentInfo[]>)[key] ?? [];
}

function resolverUrl(path: string): string {
    return path.startsWith('/') ? path : `/storage/${path}`;
}

function esPdf(path: string): boolean {
    return path.toLowerCase().endsWith('.pdf');
}

type DocumentoPreview = { url: string; label: string; esPdf: boolean };

export default function ColaboradorShow({
    colaborador,
    indiceRiesgo,
    pruebas,
    condicionesSalud,
    evaluacionesMedicas,
    llamadosAtencion,
    entrenamientos,
    entrenamientosCatalogo,
    certificadosAprendizaje,
    documentoGrupos,
    documentoFields,
}: {
    colaborador: ColaboradorDetalle;
    indiceRiesgo: IndiceRiesgo;
    pruebas: PruebaRow[];
    condicionesSalud: CondicionRow[];
    evaluacionesMedicas: EvaluacionMedicaRow[];
    llamadosAtencion: LlamadoAtencionRow[];
    entrenamientos: EntrenamientoRow[];
    entrenamientosCatalogo: { id: number; nombre: string }[];
    certificadosAprendizaje: CertificadosAprendizaje;
    documentoGrupos: string[];
    documentoFields: { key: string; label: string; grupo: string }[];
}) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Gente', href: '/modules/gente' },
        { title: 'Colaboradores', href: '/modules/gente/colaboradores' },
        { title: `${colaborador.nombres} ${colaborador.apellidos}`, href: `/modules/gente/colaboradores/${colaborador.id}` },
    ];

    const { auth } = usePage<SharedData>().props;
    const canManageColaboradores = auth.isAdmin || auth.roles.includes('Gente');
    const puedeEditar = canManageColaboradores && colaborador.is_active && !colaborador.tiene_finalizacion;

    const tieneAlgunDocumento = documentoFields.some((doc) => documentosDe(colaborador, doc.key).length > 0);
    const [preview, setPreview] = useState<DocumentoPreview | null>(null);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${colaborador.nombres} ${colaborador.apellidos}`} />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">

                {/* Banner CV */}
                <div className="overflow-hidden rounded-2xl border border-emerald-200/60 shadow-sm dark:border-emerald-800/40">
                    <div className="flex items-end gap-6 px-8 py-6"
                        style={{
                            background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(5,150,105,0.18) 100%)',
                            backdropFilter: 'blur(8px)',
                        }}
                    >
                        <div className="shrink-0">
                            {colaborador.imagen ? (
                                <SafeImage
                                    src={`/storage/${colaborador.imagen}`}
                                    alt={`${colaborador.nombres} ${colaborador.apellidos}`}
                                    className="h-36 w-36 rounded-xl border-4 border-white/30 object-cover shadow-md"
                                />
                            ) : (
                                <div className="flex h-36 w-36 items-center justify-center rounded-xl border-4 border-white/30 bg-emerald-400 shadow-md dark:bg-emerald-600">
                                    <User className="size-16 text-white/70" />
                                </div>
                            )}
                        </div>
                        <div className="pb-1">
                            <h1 className="text-3xl font-extrabold tracking-tight text-emerald-900 sm:text-4xl dark:text-white">
                                {colaborador.nombres} {colaborador.apellidos}
                            </h1>
                            {colaborador.cargo && (
                                <p className="mt-1 text-base font-medium tracking-wide text-emerald-700 dark:text-emerald-200">
                                    {colaborador.cargo}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-emerald-100 bg-emerald-50 dark:divide-emerald-900 dark:bg-emerald-950/40 sm:grid-cols-4">
                        {colaborador.cedula && (
                            <div className="px-5 py-3">
                                <p className="text-[10px] font-semibold tracking-widest text-emerald-600 uppercase dark:text-emerald-400">Documento</p>
                                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">{colaborador.cedula}</p>
                            </div>
                        )}
                        {colaborador.area && (
                            <div className="px-5 py-3">
                                <p className="text-[10px] font-semibold tracking-widest text-emerald-600 uppercase dark:text-emerald-400">Area</p>
                                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">{colaborador.area}</p>
                            </div>
                        )}
                        {colaborador.centro_trabajo && (
                            <div className="px-5 py-3">
                                <p className="text-[10px] font-semibold tracking-widest text-emerald-600 uppercase dark:text-emerald-400">Centro</p>
                                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">{colaborador.centro_trabajo}</p>
                            </div>
                        )}
                        <div className="px-5 py-3">
                            <p className={`text-sm font-semibold ${colaborador.is_active ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600'}`}>
                                {colaborador.tiene_finalizacion ? 'Finalizado' : colaborador.is_active ? 'Activo' : 'Inactivo'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Banner: colaborador inactivo */}
                {!colaborador.is_active && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 dark:border-amber-700/50 dark:bg-amber-950/20">
                        <OctagonX className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div>
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                                Colaborador inactivo — edición bloqueada
                            </p>
                            <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-400">
                                Este colaborador está desactivado. No se pueden realizar cambios hasta que sea reactivado.
                                {canManageColaboradores && ' Use el botón "Activar" para restaurar el acceso completo.'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Boton activar/desactivar + PDF */}
                <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" asChild className="gap-1.5">
                        <a
                            href={`/modules/gente/colaboradores/${colaborador.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <FileDown className="size-4" />
                            Exportar PDF
                        </a>
                    </Button>
                    {canManageColaboradores && !colaborador.tiene_finalizacion && (
                        <Button
                            variant={colaborador.is_active ? 'destructive' : 'default'}
                            onClick={() => router.patch(route('gente.colaboradores.toggle-activo', colaborador.id), {}, { preserveScroll: true })}
                        >
                            <Power className="mr-2 size-4" />
                            {colaborador.is_active ? 'Desactivar' : 'Activar'}
                        </Button>
                    )}
                </div>

                {/* Cuerpo: columna principal + lateral */}
                <div className="grid gap-6 lg:grid-cols-3">

                    {/* Columna principal */}
                    <div className="space-y-5 lg:col-span-2">

                        {/* Indice de riesgo */}
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-5 py-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold tracking-widest text-emerald-700 uppercase dark:text-emerald-400">
                                    Indice de riesgo - ultimos {indiceRiesgo.dias_considerados} dias
                                </p>
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                    indiceRiesgo.nivel === 'Alto' ? 'bg-red-100 text-red-700' :
                                    indiceRiesgo.nivel === 'Medio' ? 'bg-amber-100 text-amber-700' :
                                    'bg-emerald-100 text-emerald-700'
                                }`}>{indiceRiesgo.nivel}</span>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Puntaje {indiceRiesgo.puntaje} · {indiceRiesgo.pruebas_positivas} prueba(s) positiva(s) · {indiceRiesgo.salud_mala} episodio(s) de salud "Malo"
                            </p>
                        </div>

                        {/* Identificacion */}
                        {(colaborador.tipo_documento || colaborador.expedido_en || colaborador.sexo || colaborador.fecha_nacimiento) && (
                            <CvSection titulo="Identificacion">
                                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                                    {colaborador.tipo_documento && <InfoRow label="Tipo de documento" value={colaborador.tipo_documento === 'Otro' ? (colaborador.tipo_documento_otro_label ?? 'Otro') : colaborador.tipo_documento} />}
                                    {colaborador.expedido_en && <InfoRow label="Expedido en" value={colaborador.expedido_en} />}
                                    {colaborador.sexo && <InfoRow label="Sexo" value={SEXO_LABELS[colaborador.sexo] ?? colaborador.sexo} />}
                                    {colaborador.fecha_nacimiento && <InfoRow label="Fecha de nacimiento" value={`${colaborador.fecha_nacimiento} (${calcularEdad(colaborador.fecha_nacimiento)})`} />}
                                </dl>
                            </CvSection>
                        )}

                        {/* Informacion personal */}
                        {(colaborador.estado_civil || colaborador.nombre_pareja || (colaborador.hijos && colaborador.hijos.length > 0)) && (
                            <CvSection titulo="Informacion personal">
                                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                                    {colaborador.estado_civil && <InfoRow label="Estado civil" value={colaborador.estado_civil === 'Otro' ? (colaborador.estado_civil_otro ?? 'Otro') : colaborador.estado_civil} />}
                                    {colaborador.nombre_pareja && <InfoRow label="Conyuge / companero(a)" value={colaborador.nombre_pareja} />}
                                </dl>
                                {colaborador.hijos && colaborador.hijos.length > 0 && (
                                    <div className="mt-3">
                                        <p className="text-muted-foreground mb-2 text-xs">Hijos</p>
                                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                            {colaborador.hijos.map((hijo, i) => (
                                                <div key={i} className="rounded-md border border-emerald-100 bg-emerald-50/40 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950/20">
                                                    <span className="font-medium">{hijo.nombre}</span>
                                                    {hijo.edad && <span className="text-muted-foreground ml-2 text-xs">{hijo.edad} anos</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CvSection>
                        )}

                        {/* Condiciones particulares */}
                        {(colaborador.discapacidad || colaborador.victima_conflicto || colaborador.libreta_militar || colaborador.runt_aplica) && (
                            <CvSection titulo="Condiciones particulares">
                                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                                    {colaborador.discapacidad && <InfoRow label="Discapacidad" value={APLICA_LABELS[colaborador.discapacidad] ?? colaborador.discapacidad} />}
                                    {colaborador.discapacidad === 'aplica' && colaborador.discapacidad_tipo && <InfoRow label="Tipo de discapacidad" value={colaborador.discapacidad_tipo} />}
                                    {colaborador.discapacidad === 'aplica' && colaborador.discapacidad_observaciones && <InfoRow label="Obs. discapacidad" value={colaborador.discapacidad_observaciones} />}
                                    {colaborador.victima_conflicto && <InfoRow label="Victima del conflicto" value={SI_NO_LABELS[colaborador.victima_conflicto] ?? colaborador.victima_conflicto} />}
                                    {colaborador.victima_conflicto === 'si' && colaborador.victima_conflicto_observaciones && <InfoRow label="Obs. conflicto" value={colaborador.victima_conflicto_observaciones} />}
                                    {colaborador.libreta_militar && <InfoRow label="Libreta militar" value={APLICA_LABELS[colaborador.libreta_militar] ?? colaborador.libreta_militar} />}
                                    {colaborador.runt_aplica && <InfoRow label="RUNT" value={APLICA_LABELS[colaborador.runt_aplica] ?? colaborador.runt_aplica} />}
                                </dl>
                            </CvSection>
                        )}

                        {/* Antecedentes en la empresa */}
                        {(colaborador.ha_trabajado_antes || colaborador.cargo_anterior || colaborador.fecha_ultima_laboral || colaborador.motivo_retiro) && (
                            <CvSection titulo="Antecedentes en la empresa">
                                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                                    {colaborador.ha_trabajado_antes && <InfoRow label="Trabajo antes?" value={SI_NO_LABELS[colaborador.ha_trabajado_antes] ?? colaborador.ha_trabajado_antes} />}
                                    {colaborador.cargo_anterior && <InfoRow label="Cargo anterior" value={colaborador.cargo_anterior} />}
                                    {colaborador.fecha_ultima_laboral && <InfoRow label="Fecha ultima laboral" value={colaborador.fecha_ultima_laboral} />}
                                    {colaborador.motivo_retiro && <InfoRow label="Motivo de retiro" value={colaborador.motivo_retiro} />}
                                    {colaborador.motivo_retiro_observaciones && <InfoRow label="Observaciones" value={colaborador.motivo_retiro_observaciones} />}
                                </dl>
                            </CvSection>
                        )}

                        {/* Experiencia */}
                        {(colaborador.tiene_experiencia || colaborador.area_experiencia || colaborador.cargo_experiencia || colaborador.anios_experiencia != null) && (
                            <CvSection titulo="Experiencia">
                                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                                    {colaborador.tiene_experiencia && <InfoRow label="Tiene experiencia?" value={SI_NO_LABELS[colaborador.tiene_experiencia] ?? colaborador.tiene_experiencia} />}
                                    {colaborador.area_experiencia && <InfoRow label="Area" value={colaborador.area_experiencia} />}
                                    {colaborador.cargo_experiencia && <InfoRow label="Cargo" value={colaborador.cargo_experiencia} />}
                                    {colaborador.anios_experiencia != null && <InfoRow label="Anos" value={colaborador.anios_experiencia} />}
                                </dl>
                            </CvSection>
                        )}

                        {/* Requisitos del cargo */}
                        {(colaborador.manejo_defensivo_aplica || colaborador.conduccion_carga_pesada_aplica || colaborador.experiencia_terreno_plano || colaborador.experiencia_terreno_montanoso) && (
                            <CvSection titulo="Requisitos del cargo">
                                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                                    {colaborador.manejo_defensivo_aplica && <InfoRow label="Manejo defensivo" value={APLICA_LABELS[colaborador.manejo_defensivo_aplica] ?? colaborador.manejo_defensivo_aplica} />}
                                    {colaborador.conduccion_carga_pesada_aplica && <InfoRow label="Carga pesada" value={APLICA_LABELS[colaborador.conduccion_carga_pesada_aplica] ?? colaborador.conduccion_carga_pesada_aplica} />}
                                    {colaborador.experiencia_terreno_plano && <InfoRow label="Terreno plano" value={SI_NO_LABELS[colaborador.experiencia_terreno_plano] ?? colaborador.experiencia_terreno_plano} />}
                                    {colaborador.experiencia_terreno_montanoso && <InfoRow label="Terreno montanoso" value={SI_NO_LABELS[colaborador.experiencia_terreno_montanoso] ?? colaborador.experiencia_terreno_montanoso} />}
                                </dl>
                            </CvSection>
                        )}

                        {/* Licencia de conduccion */}
                        {(colaborador.licencia_conduccion_categorias?.length || colaborador.fecha_licencia || colaborador.fecha_vencimiento_licencia || colaborador.restricciones_licencia) && (
                            <CvSection titulo="Licencia de conduccion">
                                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                                    {colaborador.licencia_conduccion_categorias && colaborador.licencia_conduccion_categorias.length > 0 && <InfoRow label="Categorias" value={colaborador.licencia_conduccion_categorias.join(', ')} />}
                                    {colaborador.fecha_licencia && <InfoRow label="Fecha de licencia" value={colaborador.fecha_licencia} />}
                                    {colaborador.fecha_vencimiento_licencia && <InfoRow label="Vencimiento" value={colaborador.fecha_vencimiento_licencia} />}
                                    {colaborador.restricciones_licencia && <InfoRow label="Restricciones" value={colaborador.restricciones_licencia} />}
                                </dl>
                            </CvSection>
                        )}

                        {/* SENA */}
                        {(colaborador.sena_especialidad || colaborador.sena_institucion || colaborador.sena_centro_formacion) && (
                            <CvSection titulo="Aprendiz SENA">
                                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                                    {colaborador.sena_especialidad && <InfoRow label="Especialidad" value={colaborador.sena_especialidad} />}
                                    {colaborador.sena_numero_grupo && <InfoRow label="N. grupo" value={colaborador.sena_numero_grupo} />}
                                    {colaborador.sena_institucion && <InfoRow label="Institucion" value={colaborador.sena_institucion} />}
                                    {colaborador.sena_nit && <InfoRow label="NIT" value={colaborador.sena_nit} />}
                                    {colaborador.sena_centro_formacion && <InfoRow label="Centro de formacion" value={colaborador.sena_centro_formacion} />}
                                </dl>
                            </CvSection>
                        )}

                        {/* Documentos */}
                        {tieneAlgunDocumento && (
                            <CvSection titulo="Documentos">
                                <div className="grid gap-5 sm:grid-cols-2">
                                    {documentoGrupos.map((grupo) => {
                                        const camposDelGrupo = documentoFields.filter((doc) => doc.grupo === grupo && documentosDe(colaborador, doc.key).length > 0);
                                        if (camposDelGrupo.length === 0) return null;
                                        return (
                                            <div key={grupo} className="space-y-2">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">{grupo}</p>
                                                <ul className="space-y-1.5 text-sm">
                                                    {camposDelGrupo.map((doc) => (
                                                        <li key={doc.key} className="grid gap-1">
                                                            <span className="text-muted-foreground">{doc.label}</span>
                                                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                                                                {documentosDe(colaborador, doc.key).map((documento, index) => {
                                                                    const url = resolverUrl(documento.path);
                                                                    const pdf = esPdf(documento.path);
                                                                    const label = documento.fecha ?? `Archivo ${index + 1}`;
                                                                    return (
                                                                        <button
                                                                            key={`${doc.key}-${index}`}
                                                                            type="button"
                                                                            onClick={() => setPreview({ url, label: `${doc.label} - ${label}`, esPdf: pdf })}
                                                                            className="inline-flex items-center gap-1 text-emerald-700 underline underline-offset-4 hover:text-emerald-900 dark:text-emerald-400"
                                                                        >
                                                                            {pdf ? <FileText className="size-3.5" /> : <FileSpreadsheet className="size-3.5" />}
                                                                            {label}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CvSection>
                        )}

                        {/* Certificados de aprendizaje */}
                        <CvSection titulo="Certificados de aprendizaje">
                            <div className="grid gap-2 sm:grid-cols-2">
                                <div className="flex items-center gap-2 text-sm">
                                    {certificadosAprendizaje.escuelaPilotos ? <CheckCircle2 className="size-4 text-emerald-600" /> : <XCircle className="size-4 text-muted-foreground" />}
                                    Certificado escuela de pilotos
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    {certificadosAprendizaje.brigadista ? <CheckCircle2 className="size-4 text-emerald-600" /> : <XCircle className="size-4 text-muted-foreground" />}
                                    Certificado de Brigadista
                                </div>
                            </div>
                        </CvSection>
                    </div>

                    {/* Columna lateral */}
                    <div className="space-y-5">

                        {/* Contacto */}
                        {(colaborador.celular_1 || colaborador.celular_2 || colaborador.correo || colaborador.ciudad_residencia || colaborador.direccion || colaborador.estrato) && (
                            <CvSection titulo="Contacto">
                                <ul className="space-y-2 text-sm">
                                    {colaborador.celular_1 && (
                                        <li className="flex items-start gap-2">
                                            <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                                            <span>{colaborador.celular_1}</span>
                                        </li>
                                    )}
                                    {colaborador.celular_2 && (
                                        <li className="flex items-start gap-2">
                                            <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                                            <span>{colaborador.celular_2}</span>
                                        </li>
                                    )}
                                    {colaborador.correo && (
                                        <li className="flex items-start gap-2">
                                            <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                                            <span className="break-all">{colaborador.correo}</span>
                                        </li>
                                    )}
                                    {colaborador.ciudad_residencia && (
                                        <li className="flex items-start gap-2">
                                            <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                                            <span>{colaborador.ciudad_residencia}</span>
                                        </li>
                                    )}
                                    {colaborador.direccion && (
                                        <li className="flex items-start gap-2">
                                            <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                                            <span>{colaborador.direccion}</span>
                                        </li>
                                    )}
                                    {colaborador.estrato && (
                                        <li className="flex items-start gap-2">
                                            <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                                            <span>Estrato {colaborador.estrato}</span>
                                        </li>
                                    )}
                                </ul>
                            </CvSection>
                        )}

                        {/* Seguridad social */}
                        {(colaborador.eps || colaborador.afp || colaborador.arl) && (
                            <CvSection titulo="Seguridad social">
                                <ul className="space-y-2 text-sm">
                                    {colaborador.eps && (
                                        <li className="flex items-start gap-2">
                                            <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                                            <span><span className="font-medium">EPS:</span> {colaborador.eps === 'Otro' ? (colaborador.eps_otro ?? 'Otro') : colaborador.eps}</span>
                                        </li>
                                    )}
                                    {colaborador.afp && (
                                        <li className="flex items-start gap-2">
                                            <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                                            <span><span className="font-medium">AFP:</span> {colaborador.afp === 'Otro' ? (colaborador.afp_otro ?? 'Otro') : colaborador.afp}</span>
                                        </li>
                                    )}
                                    {colaborador.arl && (
                                        <li className="flex items-start gap-2">
                                            <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                                            <span><span className="font-medium">ARL:</span> {colaborador.arl === 'Otro' ? (colaborador.arl_otro ?? 'Otro') : colaborador.arl}</span>
                                        </li>
                                    )}
                                </ul>
                            </CvSection>
                        )}

                        {/* Contactos de emergencia */}
                        {(colaborador.emergencia_nombre_1 || colaborador.emergencia_nombre_2) && (
                            <CvSection titulo="Contactos de emergencia">
                                <ul className="space-y-3 text-sm">
                                    {colaborador.emergencia_nombre_1 && (
                                        <li>
                                            <p className="font-medium">{colaborador.emergencia_nombre_1}</p>
                                            {colaborador.emergencia_parentezco_1 && <p className="text-muted-foreground text-xs">{colaborador.emergencia_parentezco_1}</p>}
                                            {colaborador.emergencia_telefono_1 && <p className="text-xs">{colaborador.emergencia_telefono_1}</p>}
                                        </li>
                                    )}
                                    {colaborador.emergencia_nombre_2 && (
                                        <li>
                                            <p className="font-medium">{colaborador.emergencia_nombre_2}</p>
                                            {colaborador.emergencia_parentezco_2 && <p className="text-muted-foreground text-xs">{colaborador.emergencia_parentezco_2}</p>}
                                            {colaborador.emergencia_telefono_2 && <p className="text-xs">{colaborador.emergencia_telefono_2}</p>}
                                        </li>
                                    )}
                                </ul>
                            </CvSection>
                        )}

                        {/* QR SKAP */}
                        {colaborador.codigo_qr_skap && (
                            <CvSection titulo="Codigo QR SKAP">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="rounded-lg bg-white p-2 shadow-sm">
                                        <QRCodeSVG value={colaborador.codigo_qr_skap} size={96} />
                                    </div>
                                    <span className="text-muted-foreground text-xs">{colaborador.codigo_qr_skap}</span>
                                </div>
                            </CvSection>
                        )}
                    </div>
                </div>

                {/* Tablas */}
                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-medium tracking-tight">Llamados de atencion</h2>
                            {puedeEditar && (
                                <LlamadoAtencionDialog
                                    colaboradorId={colaborador.id}
                                    trigger={
                                        <Button variant="outline" size="sm">
                                            <AlertTriangle className="mr-2 size-4" />
                                            Registrar
                                        </Button>
                                    }
                                />
                            )}
                        </div>
                        <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Observacion</TableHead>
                                        <TableHead>Registrado por</TableHead>
                                        <TableHead>Documento</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {llamadosAtencion.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-muted-foreground py-6 text-center">
                                                Sin llamados de atencion registrados.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {llamadosAtencion.map((llamado) => (
                                        <TableRow key={llamado.id}>
                                            <TableCell>{new Date(llamado.fecha_hora).toLocaleString()}</TableCell>
                                            <TableCell className="max-w-xs truncate" title={llamado.observacion}>{llamado.observacion}</TableCell>
                                            <TableCell>{llamado.registradoPor?.name ?? '-'}</TableCell>
                                            <TableCell>
                                                {llamado.path ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreview({ url: resolverUrl(llamado.path as string), label: 'Documento del llamado de atencion', esPdf: esPdf(llamado.path as string) })}
                                                        className="inline-flex items-center gap-1 text-primary underline underline-offset-4"
                                                    >
                                                        <FileText className="size-3.5" />
                                                        Ver
                                                    </button>
                                                ) : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-medium tracking-tight">Entrenamientos mensuales</h2>
                            {puedeEditar && (
                                <EntrenamientoDialog
                                    colaboradorId={colaborador.id}
                                    catalogo={entrenamientosCatalogo}
                                    trigger={
                                        <Button variant="outline" size="sm">
                                            <GraduationCap className="mr-2 size-4" />
                                            Registrar
                                        </Button>
                                    }
                                />
                            )}
                        </div>
                        <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Entrenamiento</TableHead>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Hora</TableHead>
                                        <TableHead>Registrado por</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {entrenamientos.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-muted-foreground py-6 text-center">
                                                Sin entrenamientos registrados.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {entrenamientos.map((entrenamiento) => (
                                        <TableRow key={entrenamiento.id}>
                                            <TableCell>{entrenamiento.entrenamiento?.nombre ?? '-'}</TableCell>
                                            <TableCell>{entrenamiento.fecha_registro}</TableCell>
                                            <TableCell>{entrenamiento.hora_registro}</TableCell>
                                            <TableCell>{entrenamiento.registradoPor?.name ?? '-'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-3">
                        <h2 className="text-lg font-medium tracking-tight">Pruebas de alcoholemia</h2>
                        <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Resultado</TableHead>
                                        <TableHead>Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pruebas.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-muted-foreground py-6 text-center">
                                                Sin pruebas registradas.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {pruebas.map((prueba) => (
                                        <TableRow key={prueba.id}>
                                            <TableCell>{new Date(prueba.fecha_hora).toLocaleString()}</TableCell>
                                            <TableCell className="capitalize">{prueba.tipo}</TableCell>
                                            <TableCell>{prueba.resultado ?? '-'}</TableCell>
                                            <TableCell>
                                                {prueba.estado === 'programada' ? (
                                                    <Badge variant="secondary">Programada</Badge>
                                                ) : (
                                                    <Badge variant={prueba.es_positivo ? 'destructive' : 'default'}>
                                                        {prueba.es_positivo ? 'Positivo' : 'Negativo'}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h2 className="text-lg font-medium tracking-tight">Condiciones de salud</h2>
                        <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Momento</TableHead>
                                        <TableHead>Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {condicionesSalud.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-muted-foreground py-6 text-center">
                                                Sin registros de salud.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {condicionesSalud.map((condicion) => (
                                        <TableRow key={condicion.id}>
                                            <TableCell>{new Date(condicion.fecha_hora).toLocaleString()}</TableCell>
                                            <TableCell className="capitalize">{condicion.momento}</TableCell>
                                            <TableCell>
                                                <Badge variant={condicion.estado === 'Malo' ? 'destructive' : condicion.estado === 'Regular' ? 'secondary' : 'default'}>
                                                    {condicion.estado}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <h2 className="text-lg font-medium tracking-tight">Examenes medicos ocupacionales</h2>
                    <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Concepto de aptitud</TableHead>
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {evaluacionesMedicas.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-muted-foreground py-6 text-center">
                                            Sin evaluaciones medicas registradas.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {evaluacionesMedicas.map((evaluacion) => (
                                    <TableRow key={evaluacion.id}>
                                        <TableCell>{new Date(evaluacion.fecha_evaluacion).toLocaleDateString()}</TableCell>
                                        <TableCell className="capitalize">{evaluacion.tipo_evaluacion}</TableCell>
                                        <TableCell>{evaluacion.concepto_aptitud?.nombre ?? '-'}</TableCell>
                                        <TableCell>
                                            <Badge variant={evaluacion.estado === 'terminada' ? 'default' : 'secondary'}>
                                                {evaluacion.estado === 'sin_iniciar' ? 'Sin Iniciar' : evaluacion.estado === 'demorada' ? 'Demorada' : evaluacion.estado === 'en_proceso' ? 'En Proceso' : 'Terminada'}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

            </div>

            <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
                <DialogContent className="max-h-[90vh] max-w-3xl">
                    <DialogTitle className="flex items-center justify-between gap-4 pr-6">
                        <span className="truncate">{preview?.label}</span>
                        {preview && (
                            <Button variant="outline" size="sm" asChild>
                                <a href={preview.url} target="_blank" rel="noreferrer" download>
                                    <Download className="size-4" />
                                    Descargar
                                </a>
                            </Button>
                        )}
                    </DialogTitle>
                    {preview?.esPdf ? (
                        <iframe src={preview.url} title={preview.label} className="h-[75vh] w-full rounded-md border border-border" />
                    ) : (
                        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border text-sm text-muted-foreground">
                            <FileSpreadsheet className="size-8" />
                            Este tipo de archivo no se puede previsualizar. Descargalo para abrirlo.
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
