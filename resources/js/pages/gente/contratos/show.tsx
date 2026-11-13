import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { ProrrogarContratoDialog } from '@/pages/gente/colaboradores/prorrogar-contrato-dialog';
import { type DocumentInfo } from '@/pages/seguridad/colaboradores/colaborador-form-fields';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    Briefcase,
    Calendar,
    CalendarClock,
    Clock,
    ExternalLink,
    FileDown,
    FileText,
    FolderOpen,
    History,
    LoaderCircle,
    Pencil,
    Save,
    Trash2,
    Upload,
    User,
    X,
    XCircle,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { EditarCargoDialog } from '@/pages/gente/colaboradores/editar-cargo-dialog';
import { EditarActivacionDialog, type ActivacionEditableItem } from '@/pages/gente/colaboradores/editar-activacion-dialog';
import { FinalizarContratoDialog } from '@/pages/gente/colaboradores/finalizar-contrato-dialog';

interface HistorialCargoItem {
    id: number;
    cargo: string;
    area?: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    estado: string;
    pertenece_a: string;
}

interface ActivacionHistorialItem {
    id: string | number;
    is_active: boolean;
    tipo: string;
    fecha: string | null;
    motivo: string | null;
    observaciones: string | null;
    usuario?: string | null;
}

interface ProrrogaItem {
    id: number;
    fecha_anterior: string | null;
    fecha_inicio: string | null;
    fecha_nueva: string | null;
    tipo: 'prorroga' | 'finalizacion';
    contrato_id?: number | null;
    numero_prorroga?: number | null;
    observaciones: string | null;
    documento_path: string | null;
    documento_nombre: string | null;
    registrado_por: string | null;
    fecha_registro: string;
}

interface ColaboradorContrato {
    id: number;
    cedula: string;
    nombres: string;
    apellidos: string;
    nombre_completo: string;
    cargo: string | null;
    area: string | null;
    tipo_contrato: string | null;
    fecha_ingreso_empresa: string | null;
    fecha_retiro_empresa: string | null;
    fecha_vencimiento_vigente?: string | null;
    is_active: boolean;
    imagen: string | null;

    ha_trabajado_antes?: string | null;
    cargo_anterior?: string | null;
    fecha_ultima_laboral?: string | null;
    motivo_retiro?: string | null;
    motivo_retiro_observaciones?: string | null;

    historial_activaciones?: ActivacionHistorialItem[];
    centro?: string | null;
    centro_trabajo?: string | null;
    contrato_fecha_desde?: string | null;
    contrato_fecha_hasta?: string | null;
    contrato_actual_id?: number | null;
    cantidad_prorrogas_contrato_actual?: number;
    contrato_actual_es_aprendiz?: boolean;
    historial_cargos?: HistorialCargoItem[];

    // nuevos
    prorrogas?: ProrrogaItem[];
    dias_para_vencimiento?: number | null;
    tiene_finalizacion?: boolean;
    historial_contratos?: HistorialContratoItem[];
}

interface HistorialContratoItem {
    id: number;
    tipo_contrato: string;
    tipo_contrato_otro: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    fecha_vigencia?: string | null;
    ultima_prorroga_fecha?: string | null;
    estado: string;
    observaciones: string | null;
    registrado_por: string | null;
    fecha_registro: string;
    cantidad_prorrogas?: number;
    es_aprendiz?: boolean;
}

interface DocumentoContratoItem extends Omit<DocumentInfo, 'path' | 'name'> {
    path: string | null;
    name?: string | null;
    id?: number | null;
    contrato_id?: number | null;
    tipo_contrato?: string | null;
}

interface DocumentoPreavisoItem extends DocumentInfo {
    id: number;
}

interface FechaPreavisoItem {
    fecha: string;
    fecha_formateada: string;
    es_actual: boolean;
    estado: string;
    fecha_desde?: string | null;
    fecha_hasta?: string | null;
    documento: DocumentoPreavisoItem | null;
}

interface Props {
    colaborador: ColaboradorContrato;
    documentos: Record<string, DocumentoContratoItem[]>;
    catalogos: {
        cargos: string[];
        tiposContrato: string[];
        perfilesCargos: Record<string, string>;
    };
    fechas_preaviso?: FechaPreavisoItem[];
    otros_preavisos?: DocumentoPreavisoItem[];
}

function formatFecha(fecha: string | null | undefined): string {
    if (!fecha) return '—';
    if (fecha.includes('/')) return fecha;
    const partes = fecha.split('-');
    if (partes.length !== 3) return fecha;
    const [year, month, day] = partes;
    return `${day}/${month}/${year}`;
}

function estadoContrato(
    fechaRetiro: string | null,
    tieneFinalizacion = false,
): { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' } {
    if (tieneFinalizacion) {
        return { label: 'Finalizado', variant: 'secondary' };
    }
    if (!fechaRetiro) return { label: 'Sin fecha fin', variant: 'secondary' };
    const hoy = new Date();
    const retiro = new Date(fechaRetiro);
    const diasRestantes = Math.ceil((retiro.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    if (diasRestantes < 0) return { label: 'Vencido', variant: 'destructive' };
    if (diasRestantes <= 35) return { label: `Vence en ${diasRestantes}d`, variant: 'outline' };
    return { label: 'Vigente', variant: 'default' };
}

export default function ContratoShow({ colaborador, documentos, catalogos, fechas_preaviso = [], otros_preavisos = [] }: Props) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Gente', href: '/modules/gente' },
        { title: 'Contratos', href: '/modules/gente/contratos' },
        { title: colaborador.nombre_completo, href: `/modules/gente/contratos/${colaborador.id}` },
    ];

    const {
        data: datosProrroga,
        setData: setDatosProrroga,
        patch: actualizarProrroga,
        processing: guardandoProrroga,
        errors: erroresProrroga,
        clearErrors: limpiarErroresProrroga,
    } = useForm<{
        tipo: 'prorroga' | 'finalizacion';
        fecha_anterior: string;
        fecha_inicio: string;
        fecha_nueva: string;
        observaciones: string;
    }>({
        tipo: 'prorroga',
        fecha_anterior: '',
        fecha_inicio: '',
        fecha_nueva: '',
        observaciones: '',
    });

    const {
        data: datosContrato,
        setData: setDatosContrato,
        patch: actualizarContrato,
        processing: guardandoContrato,
        errors: erroresContrato,
        clearErrors: limpiarErroresContrato,
    } = useForm({
        fecha_ingreso_empresa: colaborador.fecha_ingreso_empresa ?? '',
        fecha_retiro_empresa: colaborador.fecha_retiro_empresa ?? '',
        cargo: colaborador.cargo ?? '',
        tipo_contrato: colaborador.tipo_contrato ?? '',
    });

    const [pasoActual, setPasoActual] = useState(1);
    const [contratoEnEdicion, setContratoEnEdicion] = useState(false);
    const [eliminandoContrato, setEliminandoContrato] = useState(false);
    const [contratoEditandoId, setContratoEditandoId] = useState<number | null>(null);
    const [contratoEditandoDatos, setContratoEditandoDatos] = useState<{ fecha_inicio: string; fecha_fin: string; tipo_contrato: string }>({
        fecha_inicio: '',
        fecha_fin: '',
        tipo_contrato: '',
    });
    const [guardandoContratoHistorial, setGuardandoContratoHistorial] = useState(false);
    const [eliminandoContratoHistorial, setEliminandoContratoHistorial] = useState<number | null>(null);
    const [eliminandoAntecedente, setEliminandoAntecedente] = useState(false);
    const [prorrogaEnEdicion, setProrrogaEnEdicion] = useState<number | null>(null);
    const [eliminandoId, setEliminandoId] = useState<number | null>(null);
    const [subiendoDocProrroga, setSubiendoDocProrroga] = useState<number | null>(null);
    const [eliminandoDocProrroga, setEliminandoDocProrroga] = useState<number | null>(null);
    const [eliminandoProrroga, setEliminandoProrroga] = useState<number | null>(null);
    const [draggingId, setDraggingId] = useState<number | null>(null);
    const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

    // Estados para preavisos por fecha
    const [subiendoPreavisoFecha, setSubiendoPreavisoFecha] = useState<string | null>(null);
    const [draggingPreavisoFecha, setDraggingPreavisoFecha] = useState<string | null>(null);
    const [subiendoContrato, setSubiendoContrato] = useState<string | null>(null);
    const [contratoSubiendoId, setContratoSubiendoId] = useState<number | null>(null);
    const [draggingContratoId, setDraggingContratoId] = useState<number | null>(null);
    const contratoInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

    const [cargoAEditar, setCargoAEditar] = useState<HistorialCargoItem | null>(null);
    const [modalEditarCargoOpen, setModalEditarCargoOpen] = useState(false);

    // Estados para editar registros del historial de activación
    const [activacionAEditar, setActivacionAEditar] = useState<ActivacionEditableItem | null>(null);
    const [modalEditarActivacionOpen, setModalEditarActivacionOpen] = useState(false);

    const handleSubirContrato = (contratoId: number, file: File) => {
        setContratoSubiendoId(contratoId);
        setSubiendoContrato(file.name);
        const fd = new FormData();
        fd.append('documento_contrato[]', file);
        fd.append('contrato_id', String(contratoId));
        router.post(`/modules/gente/contratos/${colaborador.id}/documentos`, fd, {
            forceFormData: true,
            preserveScroll: true,
            onFinish: () => {
                setContratoSubiendoId(null);
                setSubiendoContrato(null);
            },
        });
    };

    const preavisoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const handleSubirPreaviso = (fecha: string, file: File) => {
        setSubiendoPreavisoFecha(fecha);
        router.post(
            `/modules/gente/contratos/${colaborador.id}/preavisos`,
            { documento: file, fecha },
            {
                forceFormData: true,
                preserveScroll: true,
                onFinish: () => {
                    setSubiendoPreavisoFecha(null);
                    const input = preavisoInputRefs.current[fecha];
                    if (input) input.value = '';
                },
            },
        );
    };

    const handleEliminarPreaviso = (docId: number) => {
        if (!confirm('¿Estás seguro de eliminar este documento de preaviso?')) return;
        setEliminandoId(docId);
        router.delete(`/modules/gente/contratos/${colaborador.id}/documentos/${docId}`, {
            preserveScroll: true,
            onFinish: () => setEliminandoId(null),
        });
    };

    const handleSubirDocumentoProrroga = (prorrogaId: number, file: File) => {
        setSubiendoDocProrroga(prorrogaId);
        router.post(
            `/modules/gente/contratos/${colaborador.id}/prorrogas/${prorrogaId}/documento`,
            { documento: file },
            {
                forceFormData: true,
                preserveScroll: true,
                onFinish: () => {
                    setSubiendoDocProrroga(null);
                    // Limpiar el input file
                    const input = fileInputRefs.current[prorrogaId];
                    if (input) input.value = '';
                },
            },
        );
    };

    const handleEliminarDocumentoProrroga = (prorrogaId: number) => {
        if (!confirm('¿Estás seguro de eliminar el documento de esta prórroga?')) return;
        setEliminandoDocProrroga(prorrogaId);
        router.delete(`/modules/gente/contratos/${colaborador.id}/prorrogas/${prorrogaId}/documento`, {
            preserveScroll: true,
            onFinish: () => setEliminandoDocProrroga(null),
        });
    };

    const handleEliminarProrroga = (prorroga: ProrrogaItem) => {
        const tipo = prorroga.tipo === 'finalizacion' ? 'finalización' : 'prórroga';
        if (!confirm(`¿Eliminar esta ${tipo} y sus fechas del historial? No se modificarán las fechas actuales del contrato ni otros registros.`)) {
            return;
        }

        setEliminandoProrroga(prorroga.id);
        router.delete(route('gente.contratos.prorrogas.destroy', [colaborador.id, prorroga.id]), {
            preserveScroll: true,
            onFinish: () => setEliminandoProrroga(null),
        });
    };

    const iniciarEdicionProrroga = (prorroga: ProrrogaItem) => {
        setProrrogaEnEdicion(prorroga.id);
        setDatosProrroga({
            tipo: prorroga.tipo,
            fecha_anterior: prorroga.fecha_anterior ?? '',
            fecha_inicio: prorroga.fecha_inicio ?? '',
            fecha_nueva: prorroga.fecha_nueva ?? '',
            observaciones: prorroga.observaciones ?? '',
        });
    };

    const iniciarEdicionContrato = () => {
        limpiarErroresContrato();
        setDatosContrato({
            fecha_ingreso_empresa: colaborador.fecha_ingreso_empresa ?? '',
            fecha_retiro_empresa: colaborador.fecha_retiro_empresa ?? '',
            cargo: colaborador.cargo ?? '',
            tipo_contrato: colaborador.tipo_contrato ?? '',
        });
        setContratoEnEdicion(true);
    };

    const guardarEdicionContrato = () => {
        actualizarContrato(route('gente.contratos.datos.update', colaborador.id), {
            preserveScroll: true,
            onSuccess: () => setContratoEnEdicion(false),
        });
    };

    const handleEliminarDatosContrato = () => {
        if (!confirm('¿Eliminar las fechas y el tipo del contrato? Se conservarán el colaborador, el cargo, sus documentos y los historiales.')) {
            return;
        }

        setEliminandoContrato(true);
        router.delete(route('gente.contratos.datos.destroy', colaborador.id), {
            preserveScroll: true,
            onFinish: () => setEliminandoContrato(false),
        });
    };

    const handleEliminarContratoHistorial = (contratoId: number) => {
        if (!confirm('¿Eliminar este contrato y sus prórrogas asociadas? Esta acción no se puede deshacer.')) return;
        setEliminandoContratoHistorial(contratoId);
        router.delete(route('gente.contratos.historial.destroy', { colaborador: colaborador.id, contrato: contratoId }), {
            preserveScroll: true,
            onFinish: () => setEliminandoContratoHistorial(null),
        });
    };

    const iniciarEdicionContratoHistorial = (c: { id: number; fecha_inicio: string | null; fecha_fin: string | null; tipo_contrato: string }) => {
        setContratoEditandoDatos({
            fecha_inicio: c.fecha_inicio ?? '',
            fecha_fin: c.fecha_fin ?? '',
            tipo_contrato: c.tipo_contrato ?? '',
        });
        setContratoEditandoId(c.id);
    };

    const guardarEdicionContratoHistorial = (contratoId: number) => {
        setGuardandoContratoHistorial(true);
        router.patch(route('gente.contratos.historial.update', { colaborador: colaborador.id, contrato: contratoId }), contratoEditandoDatos, {
            preserveScroll: true,
            onSuccess: () => setContratoEditandoId(null),
            onFinish: () => setGuardandoContratoHistorial(false),
        });
    };

    const handleEliminarAntecedente = () => {
        if (
            !confirm(
                '¿Eliminar el registro del contrato anterior? Se borrarán el cargo y la fecha laboral anteriores, sin modificar el contrato actual.',
            )
        ) {
            return;
        }

        setEliminandoAntecedente(true);
        router.delete(route('gente.contratos.antecedente.destroy', colaborador.id), {
            preserveScroll: true,
            onFinish: () => setEliminandoAntecedente(false),
        });
    };

    const cancelarEdicionContrato = () => {
        limpiarErroresContrato();
        setContratoEnEdicion(false);
    };

    const guardarEdicionProrroga = (prorrogaId: number) => {
        actualizarProrroga(
            route('gente.contratos.prorrogas.update', {
                colaborador: colaborador.id,
                prorroga: prorrogaId,
            }),
            {
                preserveScroll: true,
                onSuccess: () => setProrrogaEnEdicion(null),
            },
        );
    };

    const handleEliminarDocumento = (doc: DocumentoContratoItem) => {
        if (!doc.id) return;
        if (!confirm('¿Estás seguro de eliminar este documento?')) return;
        setEliminandoId(doc.id);
        router.delete(`/modules/gente/contratos/${colaborador.id}/documentos/${doc.id}`, {
            preserveScroll: true,
            onFinish: () => setEliminandoId(null),
        });
    };

    const handleQuitarArchivo = (doc: DocumentoContratoItem) => {
        if (!doc.id || !doc.path) return;
        if (!confirm('¿Quitar el archivo? El registro se mantendrá y podrás subir uno nuevo.')) return;
        setEliminandoId(doc.id);
        router.patch(
            `/modules/gente/contratos/${colaborador.id}/documentos/${doc.id}/archivo`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setEliminandoId(null),
            },
        );
    };

    const historialContratos = colaborador.historial_contratos ?? [];
    const tieneFinalizacion = colaborador.tiene_finalizacion ?? false;
    const tieneDatosContrato = Boolean(colaborador.fecha_ingreso_empresa || colaborador.fecha_retiro_empresa || colaborador.tipo_contrato) && historialContratos.length > 0;
    const { label: estadoLabel, variant: estadoVariant } = historialContratos.length === 0
        ? { label: 'Sin contrato', variant: 'secondary' as const }
        : estadoContrato(colaborador.fecha_vencimiento_vigente ?? colaborador.fecha_retiro_empresa, tieneFinalizacion);
    const todasFechasPreaviso = [...fechas_preaviso];
    const documentosContrato = documentos['documento_contrato'] || [];
    const documentoPorContrato = new Map(
        documentosContrato
            .filter((documento): documento is DocumentoContratoItem & { contrato_id: number } => documento.contrato_id != null)
            .map((documento) => [documento.contrato_id, documento]),
    );
    const documentosSinContrato = documentosContrato.filter((documento) => documento.contrato_id == null);
    const tieneRetiroPrevio = Boolean(colaborador.fecha_ultima_laboral);
    const historialActivaciones = colaborador.historial_activaciones ?? [];
    const prorrogas = colaborador.prorrogas ?? [];
    const historialCargos = colaborador.historial_cargos ?? [];
    const dias = colaborador.dias_para_vencimiento ?? null;
    const mostrarAlerta = !tieneFinalizacion && historialContratos.length > 0 && dias !== null && dias <= 35;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Contrato - ${colaborador.nombre_completo}`} />

            <div className="space-y-6 p-6">
                {/* Botón Volver */}
                <div>
                    <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground gap-1.5">
                        <Link href="/modules/gente/contratos">
                            <ArrowLeft className="size-4" />
                            Volver a contratos
                        </Link>
                    </Button>
                </div>

                {/* Tarjeta de Información General */}
                <div className="rounded-2xl border border-cyan-200 bg-gradient-to-r from-blue-500/10 via-cyan-500/5 to-transparent p-6 shadow-sm dark:border-cyan-900/50 dark:from-blue-950/30">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            {colaborador.imagen ? (
                                <img
                                    src={colaborador.imagen.startsWith('/') ? colaborador.imagen : `/storage/${colaborador.imagen}`}
                                    alt={colaborador.nombre_completo}
                                    className="size-16 rounded-full border-2 border-cyan-300 object-cover shadow-sm dark:border-cyan-700"
                                />
                            ) : (
                                <div className="flex size-16 items-center justify-center rounded-full border-2 border-cyan-300 bg-cyan-100 text-cyan-800 shadow-sm dark:border-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">
                                    <User className="size-8" />
                                </div>
                            )}
                            <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">{colaborador.nombre_completo}</h1>
                                    <Badge variant={estadoVariant}>{estadoLabel}</Badge>
                                </div>
                                <p className="text-muted-foreground text-xs sm:text-sm">
                                    Cédula: <span className="text-foreground font-semibold">{colaborador.cedula}</span>
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
                            {!tieneFinalizacion && (
                                <ProrrogarContratoDialog
                                    colaboradorId={colaborador.id}
                                    nombreCompleto={colaborador.nombre_completo}
                                    fechaActual={colaborador.fecha_retiro_empresa}
                                    cantidadProrrogas={colaborador.cantidad_prorrogas_contrato_actual ?? 0}
                                    esAprendiz={colaborador.contrato_actual_es_aprendiz}
                                    contratos={historialContratos}
                                    prorrogas={prorrogas}
                                    catalogoTiposContrato={catalogos.tiposContrato}
                                    trigger={
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5"
                                            disabled={historialContratos.length === 0}
                                            title={historialContratos.length === 0 ? 'No se puede prorrogar porque no hay contratos registrados' : undefined}
                                        >
                                            <Calendar className="size-4 text-cyan-700 dark:text-cyan-300" />
                                            Prorrogar contrato
                                        </Button>
                                    }
                                />
                            )}
                            <Button variant="outline" size="sm" asChild className="gap-1.5">
                                <a
                                    href={`/modules/gente/contratos/${colaborador.id}/prorroga-pdf${colaborador.fecha_retiro_empresa ? `?fecha=${colaborador.fecha_retiro_empresa}` : ''}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <FileDown className="size-4" />
                                    Descargar preaviso
                                </a>
                            </Button>
                            <Button variant="outline" size="sm" asChild className="gap-1.5">
                                <a
                                    href={`/modules/gente/contratos/${colaborador.id}/certificado-laboral-pdf`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <FileText className="size-4" />
                                    Certificado laboral
                                </a>
                            </Button>
                            <Button variant="outline" size="sm" asChild className="gap-1.5">
                                <a
                                    href={`/modules/gente/contratos/${colaborador.id}/certificado-laboral-con-funciones-pdf`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <FileText className="size-4" />
                                    Certificado laboral con funciones
                                </a>
                            </Button>
                            <Button variant="outline" size="sm" asChild className="gap-1.5">
                                <Link href={`/modules/gente/colaboradores/${colaborador.id}`}>
                                    <ExternalLink className="size-4" />
                                    Ver colaborador
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Aviso bajo la tarjeta de información del contrato */}
                {mostrarAlerta && (
                    <div
                        className={`flex flex-col gap-3 rounded-xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
                            dias < 0
                                ? 'border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20'
                                : 'border-cyan-300 bg-cyan-50 dark:border-cyan-900/50 dark:bg-cyan-950/20'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            {dias < 0 ? (
                                <XCircle className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" />
                            ) : (
                                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-cyan-700 dark:text-cyan-300" />
                            )}
                            <div>
                                <p
                                    className={`text-sm font-semibold ${dias < 0 ? 'text-red-800 dark:text-red-300' : 'text-cyan-900 dark:text-cyan-200'}`}
                                >
                                    {dias < 0
                                        ? `Contrato vencido hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`
                                        : dias === 0
                                          ? 'El contrato vence hoy'
                                          : `El contrato vence en ${dias} día${dias !== 1 ? 's' : ''}`}
                                </p>
                                <p className="text-muted-foreground mt-0.5 text-xs">
                                    Fecha de finalización:{' '}
                                    <span className="font-medium">
                                        {formatFecha(colaborador.fecha_vencimiento_vigente ?? colaborador.fecha_retiro_empresa)}
                                    </span>
                                    {' — '}Confirma la finalización del contrato si corresponde.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Stepper: Paso 1 (Tablas) · Paso 2 (Documentos) ── */}
                <div className="w-full">
                    {/* Barra de progreso condensada para móvil */}
                    <div className="mb-3 flex items-center justify-between text-xs sm:hidden">
                        <span className="text-foreground font-semibold">
                            Paso {pasoActual} de 2: {pasoActual === 1 ? 'Tablas e Historiales' : 'Documentación'}
                        </span>
                    </div>
                    <div className="bg-muted mb-4 h-1.5 w-full overflow-hidden rounded-full sm:hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-[#1a3a5c] via-[#1e5f74] to-[#2a9d8f] transition-all"
                            style={{ width: `${(pasoActual / 2) * 100}%` }}
                        />
                    </div>

                    {/* Pills de pasos (desktop y tablet) */}
                    <ol className="hidden gap-3 sm:grid sm:grid-cols-2">
                        <li>
                            <button
                                type="button"
                                onClick={() => setPasoActual(1)}
                                className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${
                                    pasoActual === 1
                                        ? 'border-cyan-400 bg-cyan-50/70 shadow-xs dark:border-cyan-600/40 dark:bg-cyan-950/20'
                                        : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-cyan-200 dark:hover:border-cyan-900/40'
                                }`}
                            >
                                <div
                                    className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                                        pasoActual === 1
                                            ? 'bg-gradient-to-br from-[#1a3a5c] via-[#1e5f74] to-[#2a9d8f] text-white shadow-xs'
                                            : 'bg-muted text-muted-foreground'
                                    }`}
                                >
                                    <History className="size-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className={`truncate text-xs font-bold ${pasoActual === 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                        Paso 1 · Tablas de contrato e historiales
                                    </p>
                                    <p className="text-muted-foreground truncate text-[11px]">Contrato actual, prórrogas y activaciones</p>
                                </div>
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                onClick={() => setPasoActual(2)}
                                className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${
                                    pasoActual === 2
                                        ? 'border-cyan-400 bg-cyan-50/70 shadow-xs dark:border-cyan-600/40 dark:bg-cyan-950/20'
                                        : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-cyan-200 dark:hover:border-cyan-900/40'
                                }`}
                            >
                                <div
                                    className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                                        pasoActual === 2
                                            ? 'bg-gradient-to-br from-[#1a3a5c] via-[#1e5f74] to-[#2a9d8f] text-white shadow-xs'
                                            : 'bg-muted text-muted-foreground'
                                    }`}
                                >
                                    <FolderOpen className="size-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className={`truncate text-xs font-bold ${pasoActual === 2 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                        Paso 2 · Documentos de contrato
                                    </p>
                                    <p className="text-muted-foreground truncate text-[11px]">Preavisos por fecha, contrato firmado y soportes</p>
                                </div>
                            </button>
                        </li>
                    </ol>
                </div>

                {/* ══════════════════════════════════════════════════════════════════ */}
                {/* ── PASO 1: TABLAS E HISTORIALES ──────────────────────────────── */}
                {/* ══════════════════════════════════════════════════════════════════ */}
                {pasoActual === 1 && (
                    <div className="space-y-6">
                        {/* Tabla de contrato actual + previo */}
                        <div>
                            <div className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
                                <FileText className="size-3.5" />
                                <span>Historial de contratos</span>
                            </div>
                            <div className="border-border bg-card overflow-hidden rounded-xl border shadow-xs">
                                <Table className="table-fixed">
                                    <TableHeader>
                                        <TableRow className="bg-muted/40">
                                            <TableHead className="w-[calc(100%/6)] font-semibold">Tipo</TableHead>
                                            <TableHead className="w-[calc(100%/6)] font-semibold">Fecha inicio contrato</TableHead>
                                            <TableHead className="w-[calc(100%/6)] font-semibold">Fecha fin</TableHead>
                                            <TableHead className="w-[calc(100%/6)] font-semibold">Cargo</TableHead>
                                            <TableHead className="w-[calc(100%/6)] font-semibold">Estado</TableHead>
                                            <TableHead className="w-[calc(100%/6)] font-semibold">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {historialContratos.length > 0 ? (
                                            <>
                                                {historialContratos.map((c, i) => (
                                                    <TableRow key={c.id}>
                                                        <TableCell>
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-sm font-medium">Contrato {i + 1}</span>
                                                                {(c.cantidad_prorrogas ?? 0) > 0 && (
                                                                    <span className="text-muted-foreground text-xs">
                                                                        {c.cantidad_prorrogas} {c.cantidad_prorrogas === 1 ? 'prórroga' : 'prórrogas'}
                                                                    </span>
                                                                )}
                                                                {contratoEditandoId === c.id ? (
                                                                    <Select
                                                                        value={contratoEditandoDatos.tipo_contrato}
                                                                        onValueChange={(v) =>
                                                                            setContratoEditandoDatos((p) => ({ ...p, tipo_contrato: v }))
                                                                        }
                                                                    >
                                                                        <SelectTrigger className="h-7 text-xs">
                                                                            <SelectValue placeholder="Tipo" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {catalogos.tiposContrato.map((t) => (
                                                                                <SelectItem key={t} value={t}>
                                                                                    {t}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                ) : c.tipo_contrato ? (
                                                                    <span className="text-xs">{c.tipo_contrato}</span>
                                                                ) : (
                                                                    <span className="text-muted-foreground text-xs">Sin tipo</span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            {contratoEditandoId === c.id ? (
                                                                <Input
                                                                    type="date"
                                                                    className="h-8 text-xs"
                                                                    value={contratoEditandoDatos.fecha_inicio}
                                                                    onChange={(e) =>
                                                                        setContratoEditandoDatos((p) => ({ ...p, fecha_inicio: e.target.value }))
                                                                    }
                                                                />
                                                            ) : (
                                                                formatFecha(c.fecha_inicio)
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {contratoEditandoId === c.id ? (
                                                                <Input
                                                                    type="date"
                                                                    className="h-8 text-xs"
                                                                    value={contratoEditandoDatos.fecha_fin}
                                                                    onChange={(e) =>
                                                                        setContratoEditandoDatos((p) => ({ ...p, fecha_fin: e.target.value }))
                                                                    }
                                                                />
                                                            ) : c.fecha_vigencia && c.fecha_vigencia !== c.fecha_fin ? (
                                                                formatFecha(c.fecha_fin)
                                                            ) : (
                                                                formatFecha(c.fecha_fin)
                                                            )}
                                                        </TableCell>
                                                        <TableCell>{colaborador.cargo || '—'}</TableCell>
                                                        <TableCell>
                                                            {c.estado === 'activo' ? (
                                                                estadoVariant === 'destructive' ? (
                                                                    <span className="text-sm font-medium text-red-600 dark:text-red-400">{estadoLabel}</span>
                                                                ) : (
                                                                    <span className="text-sm">{estadoLabel}</span>
                                                                )
                                                            ) : (
                                                                <span className="text-muted-foreground text-sm">Finalizado</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {c.estado === 'activo' && !tieneFinalizacion && (
                                                                <div className="flex items-center gap-1">
                                                                    {contratoEditandoId === c.id ? (
                                                                        <>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="size-8"
                                                                                disabled={guardandoContratoHistorial}
                                                                                onClick={() => guardarEdicionContratoHistorial(c.id)}
                                                                                title="Guardar cambios"
                                                                            >
                                                                                {guardandoContratoHistorial ? (
                                                                                    <LoaderCircle className="size-4 animate-spin" />
                                                                                ) : (
                                                                                    <Save className="size-4" />
                                                                                )}
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="size-8"
                                                                                onClick={() => setContratoEditandoId(null)}
                                                                                disabled={guardandoContratoHistorial}
                                                                                title="Cancelar edición"
                                                                            >
                                                                                <XCircle className="size-4" />
                                                                            </Button>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="size-8"
                                                                                onClick={() => iniciarEdicionContratoHistorial(c)}
                                                                                title="Editar"
                                                                            >
                                                                                <Pencil className="size-4" />
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="text-destructive hover:bg-destructive/10 size-8"
                                                                                disabled={eliminandoContratoHistorial === c.id}
                                                                                onClick={() => handleEliminarContratoHistorial(c.id)}
                                                                                title="Eliminar contrato"
                                                                            >
                                                                                {eliminandoContratoHistorial === c.id ? (
                                                                                    <LoaderCircle className="size-4 animate-spin" />
                                                                                ) : (
                                                                                    <Trash2 className="size-4" />
                                                                                )}
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {tieneRetiroPrevio && (
                                                    <TableRow>
                                                        <TableCell>—</TableCell>
                                                        <TableCell>{formatFecha(colaborador.fecha_ultima_laboral)}</TableCell>
                                                        <TableCell>{colaborador.cargo_anterior || '—'}</TableCell>
                                                        <TableCell>
                                                            {colaborador.motivo_retiro ? `Retiro: ${colaborador.motivo_retiro}` : 'Contrato anterior'}
                                                        </TableCell>
                                                        <TableCell>Finalizado</TableCell>
                                                        <TableCell>—</TableCell>
                                                        <TableCell>
                                                            <Button
                                                                type="button"
                                                                variant="destructive"
                                                                size="icon"
                                                                disabled={eliminandoAntecedente}
                                                                onClick={handleEliminarAntecedente}
                                                                title="Eliminar"
                                                            >
                                                                {eliminandoAntecedente ? (
                                                                    <LoaderCircle className="size-4 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="size-4" />
                                                                )}
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </>
                                        ) : tieneDatosContrato ? (
                                            <>
                                                <TableRow>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-sm font-medium">Contrato 1</span>
                                                            {contratoEnEdicion ? (
                                                                <div className="grid gap-1">
                                                                    <Select
                                                                        value={datosContrato.tipo_contrato || '__sin_tipo_contrato__'}
                                                                        onValueChange={(value) =>
                                                                            setDatosContrato(
                                                                                'tipo_contrato',
                                                                                value === '__sin_tipo_contrato__' ? '' : value,
                                                                            )
                                                                        }
                                                                        disabled={guardandoContrato}
                                                                    >
                                                                        <SelectTrigger aria-label="Tipo de contrato" className="h-8 text-xs">
                                                                            <SelectValue placeholder="Tipo de contrato" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="__sin_tipo_contrato__">Sin tipo</SelectItem>
                                                                            {catalogos.tiposContrato.map((tipo) => (
                                                                                <SelectItem key={tipo} value={tipo}>
                                                                                    {tipo}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <InputError message={erroresContrato.tipo_contrato} />
                                                                </div>
                                                            ) : colaborador.tipo_contrato ? (
                                                                <Badge variant="outline" className="w-fit text-xs">
                                                                    {colaborador.tipo_contrato}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-muted-foreground text-xs">Sin tipo</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {contratoEnEdicion ? (
                                                            <div className="grid min-w-36 gap-1">
                                                                <Input
                                                                    type="date"
                                                                    value={datosContrato.fecha_ingreso_empresa}
                                                                    onChange={(e) => setDatosContrato('fecha_ingreso_empresa', e.target.value)}
                                                                    disabled={guardandoContrato}
                                                                    aria-label="Fecha de ingreso"
                                                                    className="h-9"
                                                                />
                                                                <InputError message={erroresContrato.fecha_ingreso_empresa} />
                                                            </div>
                                                        ) : (
                                                            formatFecha(colaborador.fecha_ingreso_empresa)
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {contratoEnEdicion ? (
                                                            <div className="grid min-w-36 gap-1">
                                                                <Input
                                                                    type="date"
                                                                    value={datosContrato.fecha_retiro_empresa}
                                                                    onChange={(e) => setDatosContrato('fecha_retiro_empresa', e.target.value)}
                                                                    disabled={guardandoContrato}
                                                                    aria-label="Fecha de salida"
                                                                    className="h-9"
                                                                />
                                                                <InputError message={erroresContrato.fecha_retiro_empresa} />
                                                            </div>
                                                        ) : (
                                                            formatFecha(
                                                                prorrogas.length > 0
                                                                    ? (prorrogas[prorrogas.length - 1].fecha_anterior ??
                                                                          colaborador.fecha_retiro_empresa)
                                                                    : (colaborador.contrato_fecha_hasta ?? colaborador.fecha_retiro_empresa),
                                                            )
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {contratoEnEdicion ? (
                                                            <div className="grid min-w-36 gap-1">
                                                                <Select
                                                                    value={datosContrato.cargo || '__sin_cargo__'}
                                                                    onValueChange={(value) =>
                                                                        setDatosContrato('cargo', value === '__sin_cargo__' ? '' : value)
                                                                    }
                                                                    disabled={guardandoContrato}
                                                                >
                                                                    <SelectTrigger aria-label="Cargo" className="h-9">
                                                                        <SelectValue placeholder="Selecciona el cargo" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="__sin_cargo__">Sin cargo</SelectItem>
                                                                        {catalogos.cargos.map((cargo) => (
                                                                            <SelectItem key={cargo} value={cargo}>
                                                                                {cargo}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <InputError message={erroresContrato.cargo} />
                                                            </div>
                                                        ) : (
                                                            colaborador.cargo || '—'
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={estadoVariant}>{estadoLabel}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1">
                                                            {contratoEnEdicion ? (
                                                                <>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        disabled={guardandoContrato}
                                                                        onClick={guardarEdicionContrato}
                                                                    >
                                                                        {guardandoContrato ? (
                                                                            <LoaderCircle className="size-4 animate-spin" />
                                                                        ) : (
                                                                            <Save className="size-4" />
                                                                        )}
                                                                        Guardar
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={cancelarEdicionContrato}
                                                                        disabled={guardandoContrato}
                                                                    >
                                                                        Cancelar
                                                                    </Button>
                                                                </>
                                                            ) : !tieneFinalizacion ? (
                                                                <>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="icon"
                                                                        onClick={iniciarEdicionContrato}
                                                                        title="Editar"
                                                                    >
                                                                        <Pencil className="size-4" />
                                                                    </Button>
                                                                    {tieneDatosContrato && (
                                                                        <Button
                                                                            type="button"
                                                                            variant="destructive"
                                                                            size="icon"
                                                                            disabled={eliminandoContrato}
                                                                            onClick={handleEliminarDatosContrato}
                                                                            title="Eliminar"
                                                                        >
                                                                            {eliminandoContrato ? (
                                                                                <LoaderCircle className="size-4 animate-spin" />
                                                                            ) : (
                                                                                <Trash2 className="size-4" />
                                                                            )}
                                                                        </Button>
                                                                    )}
                                                                </>
                                                            ) : null}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                                {tieneRetiroPrevio && (
                                                    <TableRow>
                                                        <TableCell>—</TableCell>
                                                        <TableCell>{formatFecha(colaborador.fecha_ultima_laboral)}</TableCell>
                                                        <TableCell>{colaborador.cargo_anterior || '—'}</TableCell>
                                                        <TableCell>
                                                            {colaborador.motivo_retiro ? `Retiro: ${colaborador.motivo_retiro}` : 'Contrato anterior'}
                                                        </TableCell>
                                                        <TableCell>Finalizado</TableCell>
                                                        <TableCell>—</TableCell>
                                                        <TableCell>
                                                            <Button
                                                                type="button"
                                                                variant="destructive"
                                                                size="icon"
                                                                disabled={eliminandoAntecedente}
                                                                onClick={handleEliminarAntecedente}
                                                                title="Eliminar"
                                                            >
                                                                {eliminandoAntecedente ? (
                                                                    <LoaderCircle className="size-4 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="size-4" />
                                                                )}
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </>
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-muted-foreground py-6 text-center text-sm">
                                                    No hay contratos registrados.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* ── Historial de prórrogas ────────────────────────────────────── */}
                        <div className="space-y-2">
                            <div className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
                                <History className="size-3.5" />
                                <span>Historial de prórrogas y finalizaciones</span>
                            </div>
                            <div className="border-border bg-card overflow-hidden rounded-xl border shadow-xs">
                                <Table className="table-fixed">
                                    <TableHeader>
                                        <TableRow className="bg-muted/40">
                                            <TableHead className="w-[calc(100%/6)] font-semibold">Tipo</TableHead>
                                            <TableHead className="w-[calc(100%/6)] font-semibold">Fecha inicio</TableHead>
                                            <TableHead className="w-[calc(100%/6)] font-semibold">Terminación</TableHead>
                                            <TableHead className="w-[calc(100%/6)] font-semibold">Registrado por</TableHead>
                                            <TableHead className="w-[calc(100%/6)] font-semibold">Fecha registro</TableHead>
                                            <TableHead className="w-[calc(100%/6)] font-semibold">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {prorrogas.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-muted-foreground py-6 text-center text-xs">
                                                    Sin registros de prórrogas o finalizaciones.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            prorrogas.map((p, idx) => {
                                                const contratoProrroga = historialContratos.find((contrato) => contrato.id === p.contrato_id);
                                                const numeroProrroga = p.numero_prorroga ?? prorrogas.length - idx;
                                                const esAprendiz =
                                                    contratoProrroga?.es_aprendiz ??
                                                    ((p.contrato_id === null || p.contrato_id === undefined) &&
                                                        colaborador.contrato_actual_es_aprendiz);
                                                const esProrrogaAnual = !esAprendiz && numeroProrroga > 3;
                                                const numeroContrato = contratoProrroga
                                                    ? historialContratos.findIndex((contrato) => contrato.id === contratoProrroga.id) + 1
                                                    : null;

                                                return (
                                                    <TableRow key={p.id}>
                                                        <TableCell className="text-sm">
                                                            <div className="flex flex-col gap-0.5">
                                                                {numeroContrato !== null ? (
                                                                    <span className="text-foreground">Contrato {numeroContrato}</span>
                                                                ) : (
                                                                    <span className="text-muted-foreground">Sin asociar</span>
                                                                )}
                                                                {p.tipo === 'finalizacion' ? (
                                                                    <span className="text-xs text-red-600 dark:text-red-400">Finalización</span>
                                                                ) : (
                                                                    <span className="text-muted-foreground text-xs">
                                                                        {esProrrogaAnual
                                                                            ? `Prórroga anual ${numeroProrroga - 3}`
                                                                            : `Prórroga ${numeroProrroga}`}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-sm">
                                                            {prorrogaEnEdicion === p.id ? (
                                                                <div className="grid min-w-36 gap-1">
                                                                    {datosProrroga.tipo === 'prorroga' && (
                                                                        <>
                                                                            <Input
                                                                                type="date"
                                                                                value={datosProrroga.fecha_inicio}
                                                                                onChange={(e) => setDatosProrroga('fecha_inicio', e.target.value)}
                                                                                disabled={guardandoProrroga}
                                                                                aria-label="Fecha de inicio de la prórroga"
                                                                                className="h-9"
                                                                            />
                                                                            <InputError message={erroresProrroga.fecha_inicio} />
                                                                        </>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground text-xs">
                                                                    {p.tipo === 'prorroga' && p.fecha_inicio ? formatFecha(p.fecha_inicio) : '—'}
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-sm font-medium">
                                                            {prorrogaEnEdicion === p.id ? (
                                                                <div className="grid min-w-36 gap-1">
                                                                    <Input
                                                                        type="date"
                                                                        value={datosProrroga.fecha_nueva}
                                                                        onChange={(e) => setDatosProrroga('fecha_nueva', e.target.value)}
                                                                        disabled={guardandoProrroga}
                                                                        aria-label="Nueva fecha"
                                                                        className="h-9"
                                                                    />
                                                                    <InputError message={erroresProrroga.fecha_nueva} />
                                                                </div>
                                                            ) : (
                                                                formatFecha(p.fecha_nueva)
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground text-xs">{p.registrado_por || '—'}</TableCell>
                                                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                                                            {p.fecha_registro}
                                                        </TableCell>
                                                        <TableCell className="text-xs">
                                                            <div className="mb-2 flex items-center gap-1">
                                                                {prorrogaEnEdicion === p.id ? (
                                                                    <>
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="icon"
                                                                            className="size-8"
                                                                            disabled={guardandoProrroga}
                                                                            onClick={() => guardarEdicionProrroga(p.id)}
                                                                            title="Guardar cambios"
                                                                        >
                                                                            {guardandoProrroga ? (
                                                                                <LoaderCircle className="size-4 animate-spin" />
                                                                            ) : (
                                                                                <Save className="size-4" />
                                                                            )}
                                                                        </Button>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="size-8"
                                                                            disabled={guardandoProrroga}
                                                                            onClick={() => {
                                                                                setProrrogaEnEdicion(null);
                                                                                limpiarErroresProrroga();
                                                                            }}
                                                                            title="Cancelar edición"
                                                                        >
                                                                            <XCircle className="size-4" />
                                                                        </Button>
                                                                    </>
                                                                ) : !tieneFinalizacion ? (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="size-8"
                                                                        disabled={prorrogaEnEdicion !== null || guardandoProrroga}
                                                                        onClick={() => iniciarEdicionProrroga(p)}
                                                                        title="Editar registro"
                                                                    >
                                                                        <Pencil className="size-4" />
                                                                    </Button>
                                                                ) : null}
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="text-destructive hover:bg-destructive/10 size-8"
                                                                    disabled={
                                                                        eliminandoProrroga === p.id || prorrogaEnEdicion !== null || guardandoProrroga
                                                                    }
                                                                    onClick={() => handleEliminarProrroga(p)}
                                                                    title="Eliminar registro de prórroga"
                                                                    aria-label={`Eliminar ${p.tipo === 'finalizacion' ? 'finalización' : 'prórroga'}`}
                                                                >
                                                                    {eliminandoProrroga === p.id ? (
                                                                        <LoaderCircle className="size-4 animate-spin" />
                                                                    ) : (
                                                                        <Trash2 className="size-4" />
                                                                    )}
                                                                </Button>
                                                            </div>
                                                            {p.documento_path ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    <a
                                                                        href={p.documento_path}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1 font-medium text-emerald-600 hover:text-emerald-700 hover:underline dark:text-emerald-400"
                                                                        title={p.documento_nombre || 'Ver prórroga'}
                                                                    >
                                                                        <FileText className="size-3.5 shrink-0" />
                                                                        <span className="max-w-[130px] truncate">
                                                                            {p.documento_nombre || 'Prórroga'}
                                                                        </span>
                                                                    </a>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="size-6 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                                                                        disabled={eliminandoDocProrroga === p.id}
                                                                        onClick={() => handleEliminarDocumentoProrroga(p.id)}
                                                                        title="Eliminar documento de prórroga"
                                                                    >
                                                                        {eliminandoDocProrroga === p.id ? (
                                                                            <LoaderCircle className="size-3.5 animate-spin" />
                                                                        ) : (
                                                                            <Trash2 className="size-3.5" />
                                                                        )}
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <div
                                                                    onDragOver={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        setDraggingId(p.id);
                                                                    }}
                                                                    onDragLeave={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        setDraggingId(null);
                                                                    }}
                                                                    onDrop={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        setDraggingId(null);
                                                                        const file = e.dataTransfer.files?.[0];
                                                                        if (file) handleSubirDocumentoProrroga(p.id, file);
                                                                    }}
                                                                    onClick={() => fileInputRefs.current[p.id]?.click()}
                                                                    className={`group flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed px-2.5 py-1.5 transition-all select-none ${
                                                                        draggingId === p.id
                                                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-400/20 dark:bg-emerald-950/30 dark:text-emerald-300'
                                                                            : 'border-muted-foreground/30 hover:bg-muted/40 text-muted-foreground hover:text-foreground hover:border-emerald-500/60'
                                                                    }`}
                                                                >
                                                                    <input
                                                                        type="file"
                                                                        ref={(el) => {
                                                                            fileInputRefs.current[p.id] = el;
                                                                        }}
                                                                        className="hidden"
                                                                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                                                        onChange={(e) => {
                                                                            const file = e.target.files?.[0];
                                                                            if (file) handleSubirDocumentoProrroga(p.id, file);
                                                                        }}
                                                                    />
                                                                    {subiendoDocProrroga === p.id ? (
                                                                        <>
                                                                            <LoaderCircle className="size-3.5 animate-spin text-emerald-600" />
                                                                            <span className="text-xs font-medium">Subiendo...</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Upload className="size-3.5 shrink-0 transition-transform group-hover:-translate-y-0.5" />
                                                                            <span className="text-xs">
                                                                                {draggingId === p.id ? 'Suelta el archivo' : 'Arrastra o haz clic'}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Historial de activación / desactivación */}
                        <div className="space-y-2">
                            <div className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
                                <Clock className="size-3.5" />
                                <span>Historial de activación o desactivación</span>
                            </div>
                            <div className="border-border bg-card overflow-hidden rounded-xl border shadow-xs">
                                <Table className="table-fixed">
                                    <TableHeader>
                                        <TableRow className="bg-muted/40">
                                            <TableHead className="w-[22%] font-semibold">Evento</TableHead>
                                            <TableHead className="w-[18%] font-semibold">Fecha</TableHead>
                                            <TableHead className="w-[20%] font-semibold">Motivo</TableHead>
                                            <TableHead className="w-[22%] font-semibold">Observaciones</TableHead>
                                            <TableHead className="w-[13%] font-semibold">Registrado por</TableHead>
                                            <TableHead className="w-[5%] font-semibold text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {historialActivaciones.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-muted-foreground py-6 text-center text-xs">
                                                    Sin registros de cambio de activación o desactivación.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            historialActivaciones.map((item, index) => {
                                                const esFinalizacion = item.tipo === 'finalizacion_contrato';
                                                const esActivacion = item.is_active;
                                                // Solo los registros reales (id numérico) son editables/eliminables
                                                const esReal = typeof item.id === 'number' || /^\d+$/.test(String(item.id));

                                                const badgeClasses = esFinalizacion
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                                                    : esActivacion
                                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';

                                                const etiqueta = esFinalizacion
                                                    ? 'Finalización de contrato'
                                                    : esActivacion
                                                      ? 'Activación'
                                                      : 'Desactivación';

                                                return (
                                                    <TableRow
                                                        key={item.id ?? index}
                                                        className={esFinalizacion ? 'bg-red-50/40 dark:bg-red-950/10' : ''}
                                                    >
                                                        <TableCell>
                                                            <span
                                                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClasses}`}
                                                            >
                                                                {etiqueta}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-sm whitespace-nowrap">{item.fecha || '—'}</TableCell>
                                                        <TableCell className="text-sm">{item.motivo || '—'}</TableCell>
                                                        <TableCell className="text-muted-foreground text-xs">{item.observaciones || '—'}</TableCell>
                                                        <TableCell className="text-muted-foreground text-xs">{item.usuario || '—'}</TableCell>
                                                        <TableCell className="text-right">
                                                            {esReal && (
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="size-7 text-muted-foreground hover:text-foreground"
                                                                        title="Editar registro"
                                                                        onClick={() => {
                                                                            setActivacionAEditar(item);
                                                                            setModalEditarActivacionOpen(true);
                                                                        }}
                                                                    >
                                                                        <Pencil className="size-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="size-7 text-muted-foreground hover:text-destructive"
                                                                        title="Eliminar registro"
                                                                        onClick={() => {
                                                                            if (!confirm('¿Eliminar este registro del historial de activación?')) return;
                                                                            router.delete(
                                                                                route('gente.contratos.activaciones.destroy', {
                                                                                    colaborador: colaborador.id,
                                                                                    activacion: item.id,
                                                                                }),
                                                                                { preserveScroll: true },
                                                                            );
                                                                        }}
                                                                    >
                                                                        <Trash2 className="size-3.5" />
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Historial de cargos */}
                        <div className="space-y-2">
                            <div className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
                                <Briefcase className="size-3.5" />
                                <span>Historial de cargos</span>
                            </div>
                            <div className="border-border bg-card overflow-hidden rounded-xl border shadow-xs">
                                <Table className="table-fixed">
                                    <TableHeader>
                                        <TableRow className="bg-muted/40">
                                            <TableHead className="w-[20%] font-semibold">Cargo</TableHead>
                                            <TableHead className="w-[15%] font-semibold">Área</TableHead>
                                            <TableHead className="w-[15%] font-semibold">Fecha de inicio</TableHead>
                                            <TableHead className="w-[15%] font-semibold">Fecha de fin</TableHead>
                                            <TableHead className="w-[12%] font-semibold">Estado</TableHead>
                                            <TableHead className="w-[13%] font-semibold">Pertenece a</TableHead>
                                            <TableHead className="w-[10%] font-semibold text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {historialCargos.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-muted-foreground py-6 text-center text-xs">
                                                    Sin registros de cargos.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            historialCargos.map((h) => (
                                                <TableRow key={h.id}>
                                                    <TableCell className="text-foreground font-medium">{h.cargo}</TableCell>
                                                    <TableCell className="text-muted-foreground text-xs">{h.area || '—'}</TableCell>
                                                    <TableCell className="text-sm whitespace-nowrap">{formatFecha(h.fecha_inicio)}</TableCell>
                                                    <TableCell className="text-sm whitespace-nowrap">{formatFecha(h.fecha_fin)}</TableCell>
                                                    <TableCell className="text-xs">
                                                        <span
                                                            className={
                                                                h.estado === 'ACTIVO'
                                                                    ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                                                    : 'text-muted-foreground'
                                                            }
                                                        >
                                                            {h.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-xs">{h.pertenece_a}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-7 text-muted-foreground hover:text-foreground"
                                                                title="Editar registro de cargo"
                                                                onClick={() => {
                                                                    setCargoAEditar(h);
                                                                    setModalEditarCargoOpen(true);
                                                                }}
                                                            >
                                                                <Pencil className="size-3.5" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-7 text-muted-foreground hover:text-destructive"
                                                                title="Eliminar registro"
                                                                onClick={() => {
                                                                    if (!confirm(`¿Eliminar el registro de cargo "${h.cargo}"?`)) return;
                                                                    router.delete(route('gente.colaboradores.cargos.destroy', { colaborador: colaborador.id, cargo: h.id }), {
                                                                        preserveScroll: true,
                                                                    });
                                                                }}
                                                            >
                                                                <Trash2 className="size-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Modal para editar registro de activación */}
                        <EditarActivacionDialog
                            open={modalEditarActivacionOpen}
                            onOpenChange={setModalEditarActivacionOpen}
                            colaboradorId={colaborador.id}
                            activacionItem={activacionAEditar}
                        />

                        {/* Modal para editar cargo del historial */}
                        <EditarCargoDialog
                            open={modalEditarCargoOpen}
                            onOpenChange={setModalEditarCargoOpen}
                            colaboradorId={colaborador.id}
                            cargoItem={cargoAEditar}
                            perfilesCargos={catalogos.perfilesCargos}
                        />

                        {/* Barra inferior: Finalizar contrato (izquierda) + Continuar a Documentos (derecha) */}
                        <div className="flex items-center justify-between pt-2">
                            {!tieneFinalizacion ? (
                                <FinalizarContratoDialog
                                    colaboradorId={colaborador.id}
                                    fechaUltima={colaborador.fecha_vencimiento_vigente ?? colaborador.fecha_retiro_empresa}
                                />
                            ) : (
                                <div />
                            )}
                            <Button type="button" onClick={() => setPasoActual(2)} className="gap-2 bg-[#1e5f74] text-white hover:bg-[#1a3a5c]">
                                Continuar a Documentos
                                <ArrowRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════════ */}
                {/* ── PASO 2: PREAVISOS ────────────────────────────────────────── */}
                {/* ══════════════════════════════════════════════════════════════════ */}
                {pasoActual === 2 && (
                    <div className="space-y-6">
                        {/* ── Contrato ── */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <FileText className="text-muted-foreground size-4" />
                                <h3 className="text-foreground text-sm font-semibold">Contrato</h3>
                            </div>
                            <div className="divide-border divide-y overflow-hidden rounded-xl border">
                                {historialContratos.map((contrato, index) => {
                                    const documento = documentoPorContrato.get(contrato.id);
                                    const subiendoEsteContrato = contratoSubiendoId === contrato.id;
                                    const arrastrandoEsteContrato = draggingContratoId === contrato.id;

                                    return (
                                        <div
                                            key={contrato.id}
                                            className="bg-card grid grid-cols-1 gap-3 px-4 py-3 transition-colors sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                                        >
                                            <div className="flex min-w-0 flex-col gap-1">
                                                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                                    <FileText className="text-muted-foreground size-3.5 shrink-0" />
                                                    <span className="text-foreground text-sm font-semibold whitespace-nowrap">
                                                        Contrato {index + 1}
                                                    </span>
                                                    <Badge variant="outline" className="shrink-0 px-2 py-0.5 text-[10px]">
                                                        {contrato.tipo_contrato || 'Sin tipo'}
                                                    </Badge>
                                                </div>
                                                <span className="text-muted-foreground pl-5 text-xs">
                                                    Vigencia: {formatFecha(contrato.fecha_inicio)} — {formatFecha(contrato.fecha_fin)}
                                                </span>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1.5">
                                                {documento?.path ? (
                                                    <>
                                                        <a
                                                            href={documento.path}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex max-w-[180px] items-center gap-1 truncate text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                                                            title={documento.name ?? 'Abrir documento'}
                                                        >
                                                            <span className="truncate">{documento.name ?? 'Abrir documento'}</span>
                                                            <ExternalLink className="text-muted-foreground size-3 shrink-0" />
                                                        </a>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-muted-foreground hover:bg-muted hover:text-foreground size-6 shrink-0"
                                                            disabled={eliminandoId === documento.id}
                                                            onClick={() => handleQuitarArchivo(documento)}
                                                            title="Quitar archivo sin borrar el contrato"
                                                        >
                                                            <X className="size-3.5" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-6 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                                                            disabled={eliminandoId === documento.id}
                                                            onClick={() => handleEliminarDocumento(documento)}
                                                            title="Eliminar archivo del contrato"
                                                        >
                                                            {eliminandoId === documento.id ? (
                                                                <LoaderCircle className="size-3.5 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="size-3.5" />
                                                            )}
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">Sin archivo</span>
                                                )}
                                                <input
                                                    type="file"
                                                    ref={(element) => {
                                                        contratoInputRefs.current[contrato.id] = element;
                                                    }}
                                                    className="hidden"
                                                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                                    disabled={subiendoContrato !== null || eliminandoId !== null}
                                                    onChange={(event) => {
                                                        const file = event.target.files?.[0];
                                                        if (file) handleSubirContrato(contrato.id, file);
                                                        event.target.value = '';
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    disabled={subiendoContrato !== null || eliminandoId !== null}
                                                    onDragOver={(event) => {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        setDraggingContratoId(contrato.id);
                                                    }}
                                                    onDragLeave={(event) => {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        setDraggingContratoId(null);
                                                    }}
                                                    onDrop={(event) => {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        setDraggingContratoId(null);
                                                        const file = event.dataTransfer.files[0];
                                                        if (file) handleSubirContrato(contrato.id, file);
                                                    }}
                                                    onClick={() => contratoInputRefs.current[contrato.id]?.click()}
                                                    className={`group flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-xs transition-all select-none disabled:cursor-not-allowed disabled:opacity-50 ${
                                                        arrastrandoEsteContrato
                                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                                                            : 'border-muted-foreground/30 text-muted-foreground hover:bg-muted/40 hover:text-foreground hover:border-emerald-500/60'
                                                    }`}
                                                >
                                                    {subiendoEsteContrato ? (
                                                        <LoaderCircle className="size-3.5 animate-spin" />
                                                    ) : (
                                                        <Upload className="size-3.5 shrink-0 transition-transform group-hover:-translate-y-0.5" />
                                                    )}
                                                    <span>
                                                        {subiendoEsteContrato
                                                            ? 'Subiendo...'
                                                            : arrastrandoEsteContrato
                                                              ? 'Suelta aquí'
                                                              : documento?.path
                                                                ? 'Reemplazar'
                                                                : 'Subir contrato'}
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {documentosSinContrato.map((documento, index) => (
                                    <div key={documento.id ?? documento.path ?? index} className="bg-card flex items-center justify-between gap-3 px-4 py-3">
                                        <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                                            Documento sin contrato asociado: {documento.name ?? 'archivo no disponible'}
                                        </span>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {documento.path && (
                                                <a
                                                    href={documento.path}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                                                >
                                                    <span>Abrir</span>
                                                    <ExternalLink className="size-3 shrink-0" />
                                                </a>
                                            )}
                                            {documento.id && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 gap-1 px-2 text-xs text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                                                    disabled={eliminandoId === documento.id}
                                                    onClick={() => handleEliminarDocumento(documento)}
                                                    title="Eliminar documento suelto"
                                                >
                                                    {eliminandoId === documento.id ? (
                                                        <LoaderCircle className="size-3.5 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="size-3.5" />
                                                    )}
                                                    <span>Eliminar</span>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {historialContratos.length === 0 && documentosSinContrato.length === 0 && (
                                    <div className="bg-card flex items-center justify-between gap-3 px-4 py-3">
                                        <span className="text-muted-foreground text-xs">No hay contratos registrados para cargar documentos.</span>
                                        <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                                            <Link href={`/modules/gente/colaboradores/${colaborador.id}/wizard?paso=3&redirect_to=contratos`}>
                                                <ArrowRight className="size-3.5" />
                                                Registrar contrato
                                            </Link>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Preavisos ── */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <CalendarClock className="size-4 text-cyan-700 dark:text-cyan-300" />
                                <h3 className="text-foreground text-sm font-semibold">Preavisos</h3>
                            </div>

                            {todasFechasPreaviso.length === 0 ? (
                                <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-xs">
                                    No se han detectado fechas de finalización aún.
                                </div>
                            ) : (
                                <div className="divide-border divide-y overflow-hidden rounded-xl border">
                                    {todasFechasPreaviso.map((fp) => {
                                        const estaSubiendo = subiendoPreavisoFecha === fp.fecha;
                                        const estaArrastrando = draggingPreavisoFecha === fp.fecha;
                                        const etiquetaFecha =
                                            fp.fecha_desde && fp.fecha_hasta ? `${fp.fecha_desde} — ${fp.fecha_hasta}` : fp.fecha_formateada;

                                        return (
                                            <div
                                                key={fp.fecha}
                                                className={`flex items-center gap-4 px-4 py-3 transition-colors ${
                                                    fp.es_actual ? 'bg-cyan-50/40 dark:bg-cyan-950/10' : 'bg-card'
                                                }`}
                                            >
                                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                                    <Calendar
                                                        className={`size-3.5 shrink-0 ${fp.es_actual ? 'text-cyan-700 dark:text-cyan-300' : 'text-muted-foreground'}`}
                                                    />
                                                    <span className="text-foreground text-sm font-semibold">{etiquetaFecha}</span>
                                                    {fp.es_actual && (
                                                        <Badge className="bg-[#1e5f74] px-2 py-0.5 text-[10px] text-white hover:bg-[#1a3a5c]">
                                                            Actual
                                                        </Badge>
                                                    )}
                                                </div>

                                                <div className="shrink-0">
                                                    {fp.documento ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <a
                                                                href={fp.documento.path}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex max-w-[180px] items-center gap-1 truncate text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                                                                title={fp.documento.name}
                                                            >
                                                                <FileText className="size-3.5 shrink-0 text-emerald-600" />
                                                                <span className="truncate">{fp.documento.name}</span>
                                                                <ExternalLink className="text-muted-foreground size-3 shrink-0" />
                                                            </a>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-6 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                                                                disabled={eliminandoId === fp.documento.id}
                                                                onClick={() => handleEliminarPreaviso(fp.documento!.id)}
                                                                title="Eliminar preaviso"
                                                            >
                                                                {eliminandoId === fp.documento.id ? (
                                                                    <LoaderCircle className="size-3.5 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="size-3.5" />
                                                                )}
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div
                                                            onDragOver={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setDraggingPreavisoFecha(fp.fecha);
                                                            }}
                                                            onDragLeave={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setDraggingPreavisoFecha(null);
                                                            }}
                                                            onDrop={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setDraggingPreavisoFecha(null);
                                                                const file = e.dataTransfer.files?.[0];
                                                                if (file) handleSubirPreaviso(fp.fecha, file);
                                                            }}
                                                            onClick={() => preavisoInputRefs.current[fp.fecha]?.click()}
                                                            className={`group flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-xs transition-all select-none ${
                                                                estaArrastrando
                                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                                                                    : 'border-muted-foreground/30 text-muted-foreground hover:bg-muted/40 hover:text-foreground hover:border-emerald-500/60'
                                                            }`}
                                                        >
                                                            <input
                                                                type="file"
                                                                ref={(el) => {
                                                                    preavisoInputRefs.current[fp.fecha] = el;
                                                                }}
                                                                className="hidden"
                                                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) handleSubirPreaviso(fp.fecha, file);
                                                                }}
                                                            />
                                                            {estaSubiendo ? (
                                                                <>
                                                                    <LoaderCircle className="size-3.5 animate-spin text-emerald-600" />
                                                                    <span>Subiendo...</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Upload className="size-3.5 shrink-0 transition-transform group-hover:-translate-y-0.5" />
                                                                    <span>{estaArrastrando ? 'Suelta aquí' : 'Subir preaviso'}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {otros_preavisos.length > 0 && (
                                <div className="border-border bg-muted/20 mt-2 space-y-2 rounded-lg border p-3">
                                    <p className="text-muted-foreground text-xs font-medium">Otros preavisos registrados:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {otros_preavisos.map((op) => (
                                            <div
                                                key={op.id ?? op.path}
                                                className="bg-card border-border inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs"
                                            >
                                                <a
                                                    href={op.path}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-emerald-600 hover:underline"
                                                >
                                                    <FileText className="size-3" />
                                                    <span className="max-w-[150px] truncate">{op.name || 'Preaviso'}</span>
                                                </a>
                                                {op.id && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEliminarPreaviso(op.id!)}
                                                        className="ml-1 text-red-500 hover:text-red-700"
                                                    >
                                                        <Trash2 className="size-3" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Botón volver al paso 1 */}
                        <div className="flex justify-start pt-2">
                            <Button type="button" variant="outline" onClick={() => setPasoActual(1)} className="gap-2">
                                <ArrowLeft className="size-4" />
                                Volver a Tablas de contrato
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
