import HeadingSmall from '@/components/heading-small';
import { SafeImage } from '@/components/safe-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { CondicionSaludDialog } from '@/pages/gente/colaboradores/condicion-salud-dialog';
import { EntrenamientoDialog } from '@/pages/gente/colaboradores/entrenamiento-dialog';
import { LlamadoAtencionDialog } from '@/pages/gente/colaboradores/llamado-atencion-dialog';
import {
    CARGOS_ANTERIORES,
    DOCUMENTO_FIELDS,
    DOCUMENT_GROUPS,
    ESTADOS_CIVILES,
    calcularEdad,
    type DocumentInfo,
} from '@/pages/seguridad/colaboradores/colaborador-form-fields';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    Download,
    FileSpreadsheet,
    FileText,
    FolderOpen,
    GraduationCap,
    HeartPulse,
    IdCard,
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

    expedido_en: string | null;
    sexo: string | null;
    fecha_nacimiento: string | null;
    ciudad_residencia: string | null;
    direccion: string | null;
    estrato: string | null;
    celular_1: string | null;
    celular_2: string | null;
    correo: string | null;
    estado_civil: string | null;

    discapacidad: string | null;
    victima_conflicto: string | null;
    libreta_militar: string | null;

    ha_trabajado_antes: string | null;
    cargo_anterior: string | null;
    fecha_ultima_laboral: string | null;

    tiene_experiencia: string | null;
    area_experiencia: string | null;
    cargo_experiencia: string | null;
    anios_experiencia: number | null;

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

const NIVEL_VARIANT: Record<IndiceRiesgo['nivel'], 'default' | 'secondary' | 'destructive'> = {
    Bajo: 'default',
    Medio: 'secondary',
    Alto: 'destructive',
};

const TURNO_LABELS: Record<string, string> = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' };

const SEXO_LABELS: Record<string, string> = { femenino: 'Femenino', masculino: 'Masculino' };
const SI_NO_LABELS: Record<string, string> = { si: 'Sí', no: 'No' };
const APLICA_LABELS: Record<string, string> = { aplica: 'Aplica', no_aplica: 'No aplica' };

function labelDe(catalogo: { value: string; label: string }[], valor: string | null): string {
    return catalogo.find((opcion) => opcion.value === valor)?.label ?? valor ?? '—';
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="grid gap-0.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium text-foreground">{value ?? '—'}</dd>
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
}) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Gente', href: '/modules/gente' },
        { title: 'Colaboradores', href: '/modules/gente/colaboradores' },
        { title: `${colaborador.nombres} ${colaborador.apellidos}`, href: `/modules/gente/colaboradores/${colaborador.id}` },
    ];

    const { auth } = usePage<SharedData>().props;
    // Mismo criterio que en el listado: escritura sobre el colaborador es
    // exclusiva de Gente; "crear evaluación" y "condición de salud" son
    // funciones de Seguridad, ajenas al módulo de colaboradores.
    const canManageColaboradores = auth.isAdmin || auth.roles.includes('Gente');
    const canEvaluar = auth.isAdmin || auth.roles.includes('Seguridad');

    const tieneAlgunDocumento = DOCUMENTO_FIELDS.some((doc) => documentosDe(colaborador, doc.key).length > 0);
    const [preview, setPreview] = useState<DocumentoPreview | null>(null);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${colaborador.nombres} ${colaborador.apellidos}`} />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        {colaborador.imagen ? (
                            <SafeImage
                                src={`/storage/${colaborador.imagen}`}
                                alt={`${colaborador.nombres} ${colaborador.apellidos}`}
                                className="h-24 w-24 rounded-full object-cover"
                            />
                        ) : (
                            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                <User className="size-8" />
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <HeadingSmall
                                title={`${colaborador.nombres} ${colaborador.apellidos}`}
                                description={`Cédula ${colaborador.cedula}${colaborador.cargo ? ` · ${colaborador.cargo}` : ''}`}
                            />
                            <div className="flex flex-wrap gap-1.5">
                                {colaborador.turno && <Badge variant="secondary">{TURNO_LABELS[colaborador.turno] ?? colaborador.turno}</Badge>}
                                {colaborador.area && <Badge variant="secondary">{colaborador.area}</Badge>}
                                <Badge variant={colaborador.is_active ? 'default' : 'destructive'}>{colaborador.is_active ? 'Activo' : 'Inactivo'}</Badge>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {canManageColaboradores && (
                            <Button
                                variant={colaborador.is_active ? 'destructive' : 'default'}
                                onClick={() =>
                                    router.patch(route('gente.colaboradores.toggle-activo', colaborador.id), {}, { preserveScroll: true })
                                }
                            >
                                <Power className="mr-2 size-4" />
                                {colaborador.is_active ? 'Desactivar' : 'Activar'}
                            </Button>
                        )}
                        {canEvaluar && (
                            <CondicionSaludDialog
                                colaboradorId={colaborador.id}
                                trigger={
                                    <Button variant="outline">
                                        <HeartPulse className="mr-2 size-4" />
                                        Registrar condición de salud
                                    </Button>
                                }
                            />
                        )}
                    </div>
                </div>

                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Índice de riesgo (últimos {indiceRiesgo.dias_considerados} días)</CardTitle>
                        <Badge variant={NIVEL_VARIANT[indiceRiesgo.nivel]}>{indiceRiesgo.nivel}</Badge>
                    </CardHeader>
                    <CardContent className="text-muted-foreground text-sm">
                        Puntaje {indiceRiesgo.puntaje} — {indiceRiesgo.pruebas_positivas} prueba(s) positiva(s), {indiceRiesgo.salud_mala} episodio(s)
                        de salud "Malo".
                    </CardContent>
                </Card>

                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <IdCard className="size-4" />
                            Información personal
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                            <InfoRow label="Expedido en" value={colaborador.expedido_en} />
                            <InfoRow label="Sexo" value={colaborador.sexo ? (SEXO_LABELS[colaborador.sexo] ?? colaborador.sexo) : null} />
                            <InfoRow
                                label="Fecha de nacimiento"
                                value={colaborador.fecha_nacimiento ? `${colaborador.fecha_nacimiento} (${calcularEdad(colaborador.fecha_nacimiento)})` : null}
                            />
                            <InfoRow label="Ciudad de residencia" value={colaborador.ciudad_residencia} />
                            <InfoRow label="Dirección" value={colaborador.direccion} />
                            <InfoRow label="Estrato" value={colaborador.estrato} />
                            <InfoRow label="Celular principal" value={colaborador.celular_1} />
                            <InfoRow label="Celular alterno" value={colaborador.celular_2} />
                            <InfoRow label="Correo" value={colaborador.correo} />
                            <InfoRow label="Estado civil" value={colaborador.estado_civil ? (ESTADOS_CIVILES.find((e) => e.value === colaborador.estado_civil)?.label ?? colaborador.estado_civil) : null} />
                            <InfoRow label="Discapacidad" value={colaborador.discapacidad ? (APLICA_LABELS[colaborador.discapacidad] ?? colaborador.discapacidad) : null} />
                            <InfoRow label="Víctima del conflicto" value={colaborador.victima_conflicto ? (SI_NO_LABELS[colaborador.victima_conflicto] ?? colaborador.victima_conflicto) : null} />
                            <InfoRow label="Libreta militar" value={colaborador.libreta_militar ? (APLICA_LABELS[colaborador.libreta_militar] ?? colaborador.libreta_militar) : null} />
                        </dl>
                    </CardContent>
                </Card>

                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">Antecedentes y experiencia</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                            <InfoRow label="¿Trabajó antes en la empresa?" value={colaborador.ha_trabajado_antes ? (SI_NO_LABELS[colaborador.ha_trabajado_antes] ?? colaborador.ha_trabajado_antes) : null} />
                            <InfoRow label="Cargo anterior" value={colaborador.cargo_anterior ? labelDe(CARGOS_ANTERIORES, colaborador.cargo_anterior) : null} />
                            <InfoRow label="Fecha última laboral" value={colaborador.fecha_ultima_laboral} />
                            <InfoRow label="¿Tiene experiencia?" value={colaborador.tiene_experiencia ? (SI_NO_LABELS[colaborador.tiene_experiencia] ?? colaborador.tiene_experiencia) : null} />
                            <InfoRow label="Área de experiencia" value={colaborador.area_experiencia} />
                            <InfoRow label="Cargo de experiencia" value={colaborador.cargo_experiencia} />
                            <InfoRow label="Años de experiencia" value={colaborador.anios_experiencia} />
                        </dl>
                    </CardContent>
                </Card>

                {colaborador.codigo_qr_skap && (
                    <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">Código QR SKAP</CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-center gap-4">
                            <div className="rounded-lg bg-white p-2">
                                <QRCodeSVG value={colaborador.codigo_qr_skap} size={96} />
                            </div>
                            <span className="text-sm text-muted-foreground">{colaborador.codigo_qr_skap}</span>
                        </CardContent>
                    </Card>
                )}

                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <FolderOpen className="size-4" />
                            Documentos
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {tieneAlgunDocumento ? (
                            <div className="grid gap-5 sm:grid-cols-2">
                                {DOCUMENT_GROUPS.map((grupo) => {
                                    const camposDelGrupo = DOCUMENTO_FIELDS.filter((doc) => doc.grupo === grupo && documentosDe(colaborador, doc.key).length > 0);
                                    if (camposDelGrupo.length === 0) return null;

                                    return (
                                        <div key={grupo} className="space-y-2">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{grupo}</p>
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
                                                                        onClick={() => setPreview({ url, label: `${doc.label} — ${label}`, esPdf: pdf })}
                                                                        className="inline-flex items-center gap-1 text-primary underline underline-offset-4"
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
                        ) : (
                            <p className="text-sm text-muted-foreground">No se han cargado documentos.</p>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-sidebar-border/70 dark:border-sidebar-border">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">Certificados de aprendizaje</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-2 sm:grid-cols-2">
                        <div className="flex items-center gap-2 text-sm">
                            {certificadosAprendizaje.escuelaPilotos ? (
                                <CheckCircle2 className="size-4 text-emerald-600" />
                            ) : (
                                <XCircle className="size-4 text-muted-foreground" />
                            )}
                            Certificado escuela de pilotos
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            {certificadosAprendizaje.brigadista ? (
                                <CheckCircle2 className="size-4 text-emerald-600" />
                            ) : (
                                <XCircle className="size-4 text-muted-foreground" />
                            )}
                            Certificado de Brigadista
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-medium tracking-tight">Llamados de atención</h2>
                            {canManageColaboradores && (
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
                                        <TableHead>Observación</TableHead>
                                        <TableHead>Registrado por</TableHead>
                                        <TableHead>Documento</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {llamadosAtencion.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-muted-foreground py-6 text-center">
                                                Sin llamados de atención registrados.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {llamadosAtencion.map((llamado) => (
                                        <TableRow key={llamado.id}>
                                            <TableCell>{new Date(llamado.fecha_hora).toLocaleString()}</TableCell>
                                            <TableCell className="max-w-xs truncate" title={llamado.observacion}>{llamado.observacion}</TableCell>
                                            <TableCell>{llamado.registradoPor?.name ?? '—'}</TableCell>
                                            <TableCell>
                                                {llamado.path ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreview({ url: resolverUrl(llamado.path as string), label: 'Documento del llamado de atención', esPdf: esPdf(llamado.path as string) })}
                                                        className="inline-flex items-center gap-1 text-primary underline underline-offset-4"
                                                    >
                                                        <FileText className="size-3.5" />
                                                        Ver
                                                    </button>
                                                ) : (
                                                    '—'
                                                )}
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
                            {canManageColaboradores && (
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
                                            <TableCell>{entrenamiento.entrenamiento?.nombre ?? '—'}</TableCell>
                                            <TableCell>{entrenamiento.fecha_registro}</TableCell>
                                            <TableCell>{entrenamiento.hora_registro}</TableCell>
                                            <TableCell>{entrenamiento.registradoPor?.name ?? '—'}</TableCell>
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
                                            <TableCell>{prueba.resultado ?? '—'}</TableCell>
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
                                                <Badge
                                                    variant={
                                                        condicion.estado === 'Malo'
                                                            ? 'destructive'
                                                            : condicion.estado === 'Regular'
                                                              ? 'secondary'
                                                              : 'default'
                                                    }
                                                >
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
                    <h2 className="text-lg font-medium tracking-tight">Exámenes médicos ocupacionales</h2>
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
                                            Sin evaluaciones médicas registradas.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {evaluacionesMedicas.map((evaluacion) => (
                                    <TableRow key={evaluacion.id}>
                                        <TableCell>{new Date(evaluacion.fecha_evaluacion).toLocaleDateString()}</TableCell>
                                        <TableCell className="capitalize">{evaluacion.tipo_evaluacion}</TableCell>
                                        <TableCell>{evaluacion.concepto_aptitud?.nombre ?? '—'}</TableCell>
                                        <TableCell>
                                            <Badge variant={evaluacion.estado === 'terminada' ? 'default' : 'secondary'}>
                                                {evaluacion.estado === 'sin_iniciar'
                                                    ? 'Sin Iniciar'
                                                    : evaluacion.estado === 'demorada'
                                                      ? 'Demorada'
                                                      : evaluacion.estado === 'en_proceso'
                                                        ? 'En Proceso'
                                                        : 'Terminada'}
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
                            Este tipo de archivo no se puede previsualizar. Descárgalo para abrirlo.
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
