import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { ProrrogarContratoDialog } from '@/pages/gente/colaboradores/prorrogar-contrato-dialog';
import { SimpleFileField } from '@/pages/gente/colaboradores/wizard/components/simple-file-field';
import { type DocumentInfo } from '@/pages/seguridad/colaboradores/colaborador-form-fields';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    Calendar,
    CalendarClock,
    CheckCircle2,
    Clock,
    ExternalLink,
    FileDown,
    FileText,
    FolderOpen,
    History,
    LoaderCircle,
    Pencil,
    Plus,
    Save,
    Trash2,
    Upload,
    User,
    XCircle,
} from 'lucide-react';
import { FormEventHandler, useRef, useState } from 'react';

interface HistorialCargoItem {
    id: number;
    cargo: string;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    estado: string;
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
    fecha_nueva: string | null;
    tipo: 'prorroga' | 'finalizacion';
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
    historial_cargos?: HistorialCargoItem[];

    // nuevos
    prorrogas?: ProrrogaItem[];
    dias_para_vencimiento?: number | null;
    tiene_finalizacion?: boolean;
}

interface CampoContrato {
    key: string;
    label: string;
}

interface DocumentoContratoItem extends DocumentInfo {
    id?: number | null;
}

interface FechaPreavisoItem {
    fecha: string;
    fecha_formateada: string;
    es_actual: boolean;
    estado: string;
    documento: {
        id: number;
        name: string;
        path: string;
        fecha?: string | null;
    } | null;
}

interface Props {
    colaborador: ColaboradorContrato;
    documentos: Record<string, DocumentoContratoItem[]>;
    campos: CampoContrato[];
    fechas_preaviso?: FechaPreavisoItem[];
    otros_preavisos?: DocumentoContratoItem[];
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
    isActive = true,
    tieneFinalizacion = false,
): { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' } {
    if (tieneFinalizacion || !isActive) {
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

export default function ContratoShow({ colaborador, documentos, campos, fechas_preaviso = [], otros_preavisos = [] }: Props) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Gente', href: '/modules/gente' },
        { title: 'Contratos', href: '/modules/gente/contratos' },
        { title: colaborador.nombre_completo, href: `/modules/gente/contratos/${colaborador.id}` },
    ];

    const { data, setData, post, processing, errors, reset } = useForm<{
        documento_contrato: File[];
        documento_carnet_ingreso_cd: File[];
        documento_preaviso_terminacion: File[];
        documento_prorroga: File[];
        [key: string]: File[];
    }>({
        documento_contrato: [],
        documento_carnet_ingreso_cd: [],
        documento_preaviso_terminacion: [],
        documento_prorroga: [],
    });
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
        fecha_nueva: string;
        observaciones: string;
    }>({
        tipo: 'prorroga',
        fecha_anterior: '',
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
    const [prorrogaEnEdicion, setProrrogaEnEdicion] = useState<number | null>(null);
    const [eliminandoId, setEliminandoId] = useState<number | null>(null);
    const [dialogFinalizar, setDialogFinalizar] = useState(false);
    const [finalizando, setFinalizando] = useState(false);
    const [tipoFinalizacion, setTipoFinalizacion] = useState<'anticipado' | 'renuncia' | ''>('');
    const [obsFinalizacion, setObsFinalizacion] = useState('');
    const [archivoFinalizacion, setArchivoFinalizacion] = useState<File | null>(null);
    const [subiendoDocProrroga, setSubiendoDocProrroga] = useState<number | null>(null);
    const [eliminandoDocProrroga, setEliminandoDocProrroga] = useState<number | null>(null);
    const [draggingId, setDraggingId] = useState<number | null>(null);
    const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

    // Estados para preavisos por fecha
    const [subiendoPreavisoFecha, setSubiendoPreavisoFecha] = useState<string | null>(null);
    const [draggingPreavisoFecha, setDraggingPreavisoFecha] = useState<string | null>(null);
    const [fechasPreavisoExtra, setFechasPreavisoExtra] = useState<FechaPreavisoItem[]>([]);
    const [mostrarFormNuevaFecha, setMostrarFormNuevaFecha] = useState(false);
    const [nuevaFechaInput, setNuevaFechaInput] = useState('');
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

    const handleAgregarFechaExtra = () => {
        if (!nuevaFechaInput) return;
        const yaExiste = [...fechas_preaviso, ...fechasPreavisoExtra].some((fp) => fp.fecha === nuevaFechaInput);
        if (yaExiste) {
            alert('Esta fecha ya se encuentra en la lista de preavisos.');
            return;
        }
        const partes = nuevaFechaInput.split('-');
        const formateada = partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : nuevaFechaInput;
        setFechasPreavisoExtra((prev) => [
            ...prev,
            {
                fecha: nuevaFechaInput,
                fecha_formateada: formateada,
                es_actual: false,
                estado: 'Fecha manual',
                documento: null,
            },
        ]);
        setNuevaFechaInput('');
        setMostrarFormNuevaFecha(false);
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

    const iniciarEdicionProrroga = (prorroga: ProrrogaItem) => {
        setProrrogaEnEdicion(prorroga.id);
        setDatosProrroga({
            tipo: prorroga.tipo,
            fecha_anterior: prorroga.fecha_anterior ?? '',
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

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(`/modules/gente/contratos/${colaborador.id}/documentos`, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => reset(),
        });
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

    const tieneFinalizacion = colaborador.tiene_finalizacion ?? false;
    const { label: estadoLabel, variant: estadoVariant } = estadoContrato(colaborador.fecha_retiro_empresa, colaborador.is_active, tieneFinalizacion);
    const todasFechasPreaviso = [...fechas_preaviso, ...fechasPreavisoExtra];
    const totalArchivosNuevos = Object.values(data).reduce((acc, files) => acc + (files?.length || 0), 0);
    const errorDelCampoContrato = (campo: string) =>
        Object.entries(errors)
            .filter(([clave]) => clave === campo || clave.startsWith(`${campo}.`))
            .map(([, mensaje]) => mensaje)
            .join(' ');
    const tieneRetiroPrevio = Boolean(colaborador.fecha_ultima_laboral);
    const historialActivaciones = colaborador.historial_activaciones ?? [];
    const prorrogas = colaborador.prorrogas ?? [];
    const dias = colaborador.dias_para_vencimiento ?? null;
    const mostrarAlerta = !tieneFinalizacion && colaborador.is_active && dias !== null && dias <= 35;

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

                {/* ── Banner de alerta de vencimiento ─────────────────────────────── */}
                {mostrarAlerta && (
                    <div
                        className={`flex flex-col gap-3 rounded-xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
                        dias < 0
                            ? 'border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20'
                            : 'border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            {dias < 0 ? (
                                <XCircle className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" />
                            ) : (
                                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                            )}
                            <div>
                                <p
                                    className={`text-sm font-semibold ${dias < 0 ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}
                                >
                                    {dias < 0
                                        ? `Contrato vencido hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`
                                        : dias === 0
                                            ? 'El contrato vence hoy'
                                          : `El contrato vence en ${dias} día${dias !== 1 ? 's' : ''}`}
                                </p>
                                <p className="text-muted-foreground mt-0.5 text-xs">
                                    Fecha de finalización: <span className="font-medium">{formatFecha(colaborador.fecha_retiro_empresa)}</span>
                                    {' — '} Debes decidir si prorrogar o confirmar la finalización del contrato.
                                </p>
                            </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                            <ProrrogarContratoDialog
                                colaboradorId={colaborador.id}
                                nombreCompleto={colaborador.nombre_completo}
                                fechaActual={colaborador.fecha_retiro_empresa}
                                trigger={
                                    <Button size="sm" className="gap-1.5 bg-amber-600 text-white hover:bg-amber-700">
                                        <CalendarClock className="size-4" />
                                        Prorrogar
                                    </Button>
                                }
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                                onClick={() => setDialogFinalizar(true)}
                            >
                                <XCircle className="size-4" />
                                Confirmar finalización
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── Diálogo de confirmación de finalización ─────────────────────── */}
                <Dialog open={dialogFinalizar} onOpenChange={setDialogFinalizar}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <XCircle className="h-5 w-5 text-red-600" />
                                Finalizar contrato
                            </DialogTitle>
                            <DialogDescription>
                                El contrato se va a finalizar la fecha{' '}
                                <strong className="text-foreground">{formatFecha(colaborador.fecha_retiro_empresa)}</strong>. ¿Está seguro de esto?
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                                Esta acción registrará la finalización del contrato y no se podrá revertir.
                            </div>

                            {/* Tipo de finalización */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Tipo de finalización</Label>
                                <Select
                                    value={tipoFinalizacion}
                                    onValueChange={(v) => setTipoFinalizacion(v as 'anticipado' | 'renuncia')}
                                    disabled={finalizando}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona el tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="anticipado">Finalización de contrato anticipado</SelectItem>
                                        <SelectItem value="renuncia">Renuncia por parte del trabajador</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Archivo de respaldo */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">
                                    Documento de respaldo <span className="text-muted-foreground font-normal">(opcional)</span>
                                </Label>
                                <Input
                                    type="file"
                                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                    onChange={(e) => setArchivoFinalizacion(e.target.files?.[0] ?? null)}
                                    disabled={finalizando}
                                />
                                <p className="text-muted-foreground text-xs">Carta de renuncia, acuerdo de terminación, etc.</p>
                            </div>

                            {/* Observaciones */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Observaciones</Label>
                                <textarea
                                    rows={2}
                                    value={obsFinalizacion}
                                    onChange={(e) => setObsFinalizacion(e.target.value)}
                                    disabled={finalizando}
                                    placeholder="Describe el motivo de la finalización..."
                                    className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-1 focus-visible:outline-none"
                                />
                            </div>
                        </div>

                        <DialogFooter className="gap-2">
                            <Button type="button" variant="outline" onClick={() => setDialogFinalizar(false)} disabled={finalizando}>
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                className="bg-red-600 text-white hover:bg-red-700"
                                disabled={finalizando || !tipoFinalizacion}
                                onClick={() => {
                                    setFinalizando(true);
                                    const obsText = `${tipoFinalizacion === 'anticipado' ? 'Finalización de contrato anticipado' : 'Renuncia por parte del trabajador'}${obsFinalizacion ? ': ' + obsFinalizacion : ''}`;

                                    // 1. Registrar finalización
                                    router.patch(
                                        route('gente.colaboradores.prorrogar-contrato', colaborador.id),
                                        {
                                            fecha_retiro_empresa: colaborador.fecha_retiro_empresa,
                                            tipo: 'finalizacion',
                                            observaciones: obsText,
                                        },
                                        {
                                            preserveScroll: true,
                                            onSuccess: () => {
                                                // 2. Si hay archivo, subirlo
                                                if (archivoFinalizacion) {
                                                    const fd = new FormData();
                                                    fd.append('documento_preaviso_terminacion', archivoFinalizacion);
                                                    router.post(`/modules/gente/contratos/${colaborador.id}/documentos`, fd, {
                                                        preserveScroll: true,
                                                        forceFormData: true,
                                                    });
                                                }
                                                setDialogFinalizar(false);
                                                setFinalizando(false);
                                                setTipoFinalizacion('');
                                                setObsFinalizacion('');
                                                setArchivoFinalizacion(null);
                                            },
                                            onError: () => setFinalizando(false),
                                        },
                                    );
                                }}
                            >
                                {finalizando ? <LoaderCircle className="size-4 animate-spin" /> : null}
                                Guardar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Tarjeta de Información General */}
                <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-6 shadow-sm dark:border-amber-900/50 dark:from-amber-950/20">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            {colaborador.imagen ? (
                                <img
                                    src={colaborador.imagen.startsWith('/') ? colaborador.imagen : `/storage/${colaborador.imagen}`}
                                    alt={colaborador.nombre_completo}
                                    className="size-16 rounded-full border-2 border-amber-300 object-cover shadow-sm dark:border-amber-700"
                                />
                            ) : (
                                <div className="flex size-16 items-center justify-center rounded-full border-2 border-amber-300 bg-amber-100 text-amber-800 shadow-sm dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
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
                                    {colaborador.cargo && (
                                        <>
                                            {' '}
                                            &bull; Cargo: <span className="text-foreground font-medium">{colaborador.cargo}</span>
                                        </>
                                    )}
                                    {colaborador.area && (
                                        <>
                                            {' '}
                                            &bull; Área: <span className="text-foreground font-medium">{colaborador.area}</span>
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {!tieneFinalizacion && colaborador.is_active && (
                                <ProrrogarContratoDialog
                                    colaboradorId={colaborador.id}
                                    nombreCompleto={colaborador.nombre_completo}
                                    fechaActual={colaborador.fecha_retiro_empresa}
                                    trigger={
                                        <Button variant="outline" size="sm" className="gap-1.5">
                                            <Calendar className="size-4 text-amber-600" />
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
                                <Link href={`/modules/gente/colaboradores/${colaborador.id}`}>
                                    <ExternalLink className="size-4" />
                                    Ver colaborador
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ── Stepper: Paso 1 (Tablas) · Paso 2 (Documentos) ── */}
                <div className="w-full">
                    {/* Barra de progreso condensada para móvil */}
                    <div className="mb-3 flex items-center justify-between text-xs sm:hidden">
                        <span className="text-foreground font-semibold">
                            Paso {pasoActual} de 2: {pasoActual === 1 ? 'Tablas e Historiales' : 'Documentación'}
                        </span>
                    </div>
                    <div className="bg-muted mb-4 h-1.5 w-full overflow-hidden rounded-full sm:hidden">
                        <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${(pasoActual / 2) * 100}%` }} />
                    </div>

                    {/* Pills de pasos (desktop y tablet) */}
                    <ol className="hidden gap-3 sm:grid sm:grid-cols-2">
                        <li>
                            <button
                                type="button"
                                onClick={() => setPasoActual(1)}
                                className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${
                                    pasoActual === 1
                                        ? 'border-amber-400 bg-amber-50/70 shadow-xs dark:border-amber-600/40 dark:bg-amber-950/20'
                                        : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-amber-200 dark:hover:border-amber-900/40'
                                }`}
                            >
                                <div
                                    className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                                        pasoActual === 1 ? 'bg-amber-600 text-white shadow-xs' : 'bg-muted text-muted-foreground'
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
                                        ? 'border-amber-400 bg-amber-50/70 shadow-xs dark:border-amber-600/40 dark:bg-amber-950/20'
                                        : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-amber-200 dark:hover:border-amber-900/40'
                                }`}
                            >
                                <div
                                    className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                                        pasoActual === 2 ? 'bg-amber-600 text-white shadow-xs' : 'bg-muted text-muted-foreground'
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
                            <div className="border-border bg-card overflow-hidden rounded-xl border shadow-xs">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/40">
                                            <TableHead className="font-semibold">Fecha de ingreso</TableHead>
                                            <TableHead className="font-semibold">Fecha de salida</TableHead>
                                            <TableHead className="font-semibold">Cargo</TableHead>
                                            <TableHead className="font-semibold">Tipo de contrato</TableHead>
                                            <TableHead className="font-semibold">Estado</TableHead>
                                            <TableHead className="font-semibold">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow>
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
                                                    formatFecha(colaborador.fecha_retiro_empresa)
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {contratoEnEdicion ? (
                                                    <div className="grid min-w-36 gap-1">
                                                        <Input
                                                            value={datosContrato.cargo}
                                                            onChange={(e) => setDatosContrato('cargo', e.target.value)}
                                                            maxLength={100}
                                                            disabled={guardandoContrato}
                                                            aria-label="Cargo"
                                                            className="h-9"
                                                        />
                                                        <InputError message={erroresContrato.cargo} />
                                                    </div>
                                                ) : (
                                                    colaborador.cargo || '—'
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {contratoEnEdicion ? (
                                                    <div className="grid min-w-44 gap-1">
                                                        <Input
                                                            value={datosContrato.tipo_contrato}
                                                            onChange={(e) => setDatosContrato('tipo_contrato', e.target.value)}
                                                            maxLength={100}
                                                            disabled={guardandoContrato}
                                                            aria-label="Tipo de contrato"
                                                            className="h-9"
                                                        />
                                                        <InputError message={erroresContrato.tipo_contrato} />
                                                    </div>
                                                ) : (
                                                    colaborador.tipo_contrato || '—'
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {tieneFinalizacion || !colaborador.is_active ? 'Finalizado' : 'Vigente'}
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
                                                    ) : (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={iniciarEdicionContrato}
                                                        >
                                                            <Pencil className="size-4" />
                                                            Editar
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                        {tieneRetiroPrevio && (
                                            <TableRow>
                                                <TableCell>—</TableCell>
                                                <TableCell>{formatFecha(colaborador.fecha_ultima_laboral)}</TableCell>
                                                <TableCell>{colaborador.cargo_anterior || '—'}</TableCell>
                                                <TableCell>
                                                    {colaborador.motivo_retiro
                                                        ? `Retiro: ${colaborador.motivo_retiro}`
                                                        : 'Contrato anterior'}
                                                </TableCell>
                                                <TableCell>Finalizado</TableCell>
                                                <TableCell />
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
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/40">
                                    <TableHead className="font-semibold">Tipo</TableHead>
                                    <TableHead className="font-semibold">Fecha anterior</TableHead>
                                    <TableHead className="font-semibold">Nueva fecha</TableHead>
                                    <TableHead className="font-semibold">Observaciones</TableHead>
                                    <TableHead className="font-semibold">Registrado por</TableHead>
                                    <TableHead className="font-semibold">Fecha de registro</TableHead>
                                    <TableHead className="font-semibold">Prórroga</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {prorrogas.length === 0 ? (
                                    <TableRow>
                                                <TableCell colSpan={7} className="text-muted-foreground py-6 text-center text-xs">
                                            Sin registros de prórrogas o finalizaciones.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    prorrogas.map((p) => (
                                        <TableRow key={p.id}>
                                            <TableCell>
                                                        {prorrogaEnEdicion === p.id ? (
                                                            <div className="grid min-w-36 gap-1">
                                                                <Select
                                                                    value={datosProrroga.tipo}
                                                                    onValueChange={(value) =>
                                                                        setDatosProrroga('tipo', value as 'prorroga' | 'finalizacion')
                                                                    }
                                                                    disabled={guardandoProrroga}
                                                                >
                                                                    <SelectTrigger className="h-9">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="prorroga">Prórroga</SelectItem>
                                                                        <SelectItem value="finalizacion">Finalización</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <InputError message={erroresProrroga.tipo} />
                                                            </div>
                                                        ) : p.tipo === 'finalizacion' ? (
                                                    <span className="font-medium text-red-600 dark:text-red-400">Finalización</span>
                                                ) : (
                                                            <span className="text-foreground font-medium">Prórroga</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {prorrogaEnEdicion === p.id ? (
                                                            <div className="grid min-w-36 gap-1">
                                                                <Input
                                                                    type="date"
                                                                    value={datosProrroga.fecha_anterior}
                                                                    onChange={(e) => setDatosProrroga('fecha_anterior', e.target.value)}
                                                                    disabled={guardandoProrroga}
                                                                    aria-label="Fecha anterior"
                                                                    className="h-9"
                                                                />
                                                                <InputError message={erroresProrroga.fecha_anterior} />
                                                            </div>
                                                        ) : (
                                                            formatFecha(p.fecha_anterior)
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
                                                    <TableCell className="text-muted-foreground max-w-xs text-xs">
                                                        {prorrogaEnEdicion === p.id ? (
                                                            <div className="grid min-w-44 gap-1">
                                                                <Input
                                                                    value={datosProrroga.observaciones}
                                                                    onChange={(e) => setDatosProrroga('observaciones', e.target.value)}
                                                                    maxLength={500}
                                                                    disabled={guardandoProrroga}
                                                                    aria-label="Observaciones"
                                                                    className="h-9"
                                                                />
                                                                <InputError message={erroresProrroga.observaciones} />
                                                            </div>
                                                        ) : (
                                                            p.observaciones || '—'
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
                                                            ) : (
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
                                                            )}
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
                                                            <span className="max-w-[130px] truncate">{p.documento_nombre || 'Prórroga'}</span>
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
                                    ))
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
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/40">
                                    <TableHead className="font-semibold">Estado</TableHead>
                                    <TableHead className="font-semibold">Fecha</TableHead>
                                    <TableHead className="font-semibold">Motivo</TableHead>
                                    <TableHead className="font-semibold">Observaciones</TableHead>
                                    <TableHead className="font-semibold">Registrado por</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {historialActivaciones.length === 0 ? (
                                    <TableRow>
                                                <TableCell colSpan={5} className="text-muted-foreground py-6 text-center text-xs">
                                            Sin registros de cambio de activación o desactivación.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    historialActivaciones.map((item, index) => (
                                        <TableRow key={item.id ?? index}>
                                            <TableCell>{item.is_active ? 'Activado' : 'Desactivado'}</TableCell>
                                            <TableCell className="whitespace-nowrap">{item.fecha || '—'}</TableCell>
                                            <TableCell>{item.motivo || '—'}</TableCell>
                                                    <TableCell className="text-muted-foreground max-w-xs text-xs">
                                                        {item.observaciones || '—'}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-xs">{item.usuario || '—'}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                        {/* Botón avanzar al paso 2 */}
                        <div className="flex justify-end pt-2">
                            <Button type="button" onClick={() => setPasoActual(2)} className="gap-2 bg-amber-600 text-white hover:bg-amber-700">
                                Continuar a Documentos
                                <ArrowRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════════ */}
                {/* ── PASO 2: DOCUMENTOS DE CONTRATO ───────────────────────────── */}
                {/* ══════════════════════════════════════════════════════════════════ */}
                {pasoActual === 2 && (
                    <div className="space-y-4">
                        {/* Documentación de contrato */}
                <Card>
                            <CardHeader className="border-border border-b pb-4">
                        <div className="flex items-center gap-2.5">
                            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                                <FolderOpen className="size-5" />
                            </div>
                            <div>
                                <CardTitle className="text-base font-semibold">Documentación de contrato</CardTitle>
                                <CardDescription className="text-xs">
                                    Gestiona, visualiza y adjunta los documentos asociados al contrato laboral de este colaborador.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                            <CardContent className="space-y-6 pt-6">
                        {/* ── Preavisos por fecha de finalización ── */}
                        <div className="space-y-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                            <h3 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                                        <CalendarClock className="size-4 text-amber-600" />
                                        Preavisos de terminación por fecha
                                    </h3>
                                            <p className="text-muted-foreground mt-0.5 text-xs">
                                                Cada fecha en que el contrato finaliza o fue prorrogado requiere su preaviso. Arrastra o sube el
                                                documento en la casilla correspondiente.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                            className="gap-1 self-start text-xs sm:self-auto"
                                    onClick={() => setMostrarFormNuevaFecha(!mostrarFormNuevaFecha)}
                                >
                                    <Plus className="size-3.5" />
                                    {mostrarFormNuevaFecha ? 'Cancelar' : 'Agregar otra fecha'}
                                </Button>
                            </div>

                            {/* Formulario para agregar fecha manual si aplica */}
                            {mostrarFormNuevaFecha && (
                                        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/10">
                                            <span className="text-xs font-medium text-amber-900 dark:text-amber-300">Fecha de preaviso:</span>
                                    <input
                                        type="date"
                                        value={nuevaFechaInput}
                                        onChange={(e) => setNuevaFechaInput(e.target.value)}
                                                className="border-input bg-background focus:ring-ring rounded-md border px-2.5 py-1 text-xs shadow-xs focus:ring-1 focus:outline-none"
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                                className="h-7 bg-amber-600 text-xs text-white hover:bg-amber-700"
                                        onClick={handleAgregarFechaExtra}
                                        disabled={!nuevaFechaInput}
                                    >
                                        Crear casilla
                                    </Button>
                                </div>
                            )}

                            {/* Lista de casillas por fecha de finalización */}
                            <div className="grid gap-3 sm:grid-cols-2">
                                {todasFechasPreaviso.length === 0 ? (
                                            <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-xs sm:col-span-2">
                                                No se han detectado fechas de finalización aún. Puedes registrar prórrogas o agregar una fecha con el
                                                botón superior.
                                    </div>
                                ) : (
                                    todasFechasPreaviso.map((fp) => {
                                        const estaSubiendo = subiendoPreavisoFecha === fp.fecha;
                                        const estaArrastrando = draggingPreavisoFecha === fp.fecha;

                                        return (
                                            <div
                                                key={fp.fecha}
                                                        className={`flex flex-col justify-between gap-3 rounded-xl border p-3.5 transition-all ${
                                                    fp.es_actual
                                                        ? 'border-amber-300 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/10'
                                                        : 'border-border bg-card/60 dark:bg-card/40'
                                                }`}
                                            >
                                                {/* Cabecera de la fecha */}
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                                    <Calendar
                                                                        className={`size-3.5 ${fp.es_actual ? 'text-amber-600' : 'text-muted-foreground'}`}
                                                                    />
                                                                    <span className="text-foreground text-sm font-bold">{fp.fecha_formateada}</span>
                                                        </div>
                                                                <p className="text-muted-foreground mt-0.5 text-[11px]">{fp.estado}</p>
                                                    </div>
                                                    {fp.es_actual ? (
                                                                <Badge className="shrink-0 bg-amber-600 px-2 py-0.5 text-[10px] text-white hover:bg-amber-600">
                                                            Fecha actual
                                                        </Badge>
                                                    ) : (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-muted-foreground shrink-0 px-2 py-0.5 text-[10px]"
                                                                >
                                                            Histórico
                                                        </Badge>
                                                    )}
                                                </div>

                                                {/* Contenido / Documento */}
                                                {fp.documento ? (
                                                            <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                                                        <a
                                                            href={fp.documento.path}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                                    className="inline-flex max-w-[200px] items-center gap-1.5 truncate text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
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
                                                                className={`group flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-xs transition-all select-none ${
                                                            estaArrastrando
                                                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-400/20 dark:bg-emerald-950/30 dark:text-emerald-300'
                                                                        : 'border-muted-foreground/30 hover:bg-muted/40 text-muted-foreground hover:text-foreground hover:border-emerald-500/60'
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
                                                                        <span className="text-xs font-medium">Subiendo preaviso...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Upload className="size-3.5 shrink-0 transition-transform group-hover:-translate-y-0.5" />
                                                                <span className="text-xs">
                                                                            {estaArrastrando
                                                                                ? 'Suelta el archivo aquí'
                                                                                : 'Arrastra o haz clic para subir preaviso'}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Otros preavisos registrados */}
                            {otros_preavisos.length > 0 && (
                                        <div className="border-border bg-muted/20 space-y-2 rounded-lg border p-3">
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

                        {/* ── Otros documentos de contrato ── */}
                                <div className="border-border border-t pt-4">
                                    <h4 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                                Otros documentos de contrato
                            </h4>
                            <form onSubmit={submit} className="space-y-6">
                                        {errors.documentos && (
                                            <p
                                                role="alert"
                                                className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
                                            >
                                                {errors.documentos}
                                            </p>
                                        )}
                                <div className="grid gap-6 sm:grid-cols-2">
                                    {campos.map((campo) => {
                                        const docsExistentes = documentos[campo.key] || [];
                                        return (
                                                    <div
                                                        key={campo.key}
                                                        className="border-border bg-card/60 dark:bg-card/40 rounded-xl border p-4 transition-colors hover:border-emerald-300"
                                                    >
                                                <SimpleFileField
                                                    label={campo.label}
                                                    files={data[campo.key] || []}
                                                    existing={docsExistentes}
                                                    onRemoveExisting={(index) => {
                                                        const doc = docsExistentes[index];
                                                        if (doc) handleEliminarDocumento(doc);
                                                    }}
                                                    onChange={(files) => setData(campo.key, files)}
                                                            error={errorDelCampoContrato(campo.key)}
                                                    disabled={processing || eliminandoId !== null}
                                                    multiple={true}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                                        <div className="border-border flex items-center justify-between border-t pt-4">
                                            <p className="text-muted-foreground text-xs">
                                        {totalArchivosNuevos > 0 ? (
                                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                                {totalArchivosNuevos} archivo(s) listo(s) para guardar.
                                            </span>
                                        ) : (
                                            'Arrastra o adjunta nuevos archivos en cualquiera de los campos anteriores.'
                                        )}
                                    </p>
                                            <Button
                                                type="submit"
                                                disabled={processing || totalArchivosNuevos === 0 || eliminandoId !== null}
                                                className="gap-2"
                                            >
                                        {processing ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                                        Guardar documentos
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </CardContent>
                </Card>

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
