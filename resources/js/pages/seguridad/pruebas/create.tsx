import { CameraCaptureDialog } from '@/components/camera-capture-dialog';
import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/input-error';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { SeccionCard } from '@/pages/seguridad/colaboradores/colaborador-form-fields';
import { ColaboradorSearchSelect, type ColaboradorOption } from '@/pages/seguridad/pruebas/colaborador-search-select';
import { FirmaPad, type FirmaPadHandle } from '@/pages/seguridad/pruebas/firma-pad';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { CalendarClock, Camera, ClipboardList, Gauge, LoaderCircle, Paperclip, PenTool, ShieldCheck, Users, X } from 'lucide-react';
import { FormEventHandler, useEffect, useRef, useState } from 'react';

const breadcrumbsBase: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Seguridad', href: '/modules/seguridad' },
    { title: 'Pruebas de Alcoholemia', href: '/modules/seguridad/pruebas' },
];

interface DispositivoOption {
    id: number;
    codigo: string;
    valor_min: string;
    valor_max: string;
}

interface PruebaData {
    id: number;
    colaborador_id: number;
    tipo: string;
    es_programacion: boolean;
    programada_en: string | null;
    alcoholimetro_id: number | null;
    resultado: string | null;
    consentimiento_aceptado: boolean;
    evidencia_path: string | null;
    evidencias_paths?: string[];
    firma_path: string | null;
    observaciones: string | null;
    estado: string;
    colaborador: { id: number; nombres: string; apellidos: string; cedula: string } | null;
    alcoholimetro: { id: number; codigo: string; valor_min: string; valor_max: string } | null;
}

interface PruebaForm {
    colaborador_id: string;
    tipo: string;
    es_programacion: boolean;
    programada_en: string;
    alcoholimetro_id: string;
    resultado: string;
    consentimiento_aceptado: boolean;
    evidencia: File[];
    evidencias: File[];
    firma: File | null;
    observaciones: string;
    deleted_evidencias_indices?: number[];
    deleted_evidencias_adicionales_indices?: number[];
    [key: string]: string | boolean | File | File[] | number[] | null | undefined;
}

const CONSENTIMIENTO_TEXTO =
    'Declaro que he sido informado(a) sobre la realización de la prueba de alcoholimetría, su finalidad preventiva dentro del Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST), el procedimiento aplicable y el tratamiento reservado de sus resultados, de conformidad con la normativa vigente.';

type PickedFile = { file: File; preview: string };

/**
 * Grilla de miniaturas para subir/ver evidencias fotográficas: combina las ya
 * guardadas (marcables para borrar cuando se está editando) con las nuevas
 * recién seleccionadas.
 */
function EvidenciaUploader({
    label,
    inputId,
    inputRef,
    onAdd,
    onCaptureFile,
    savedPaths,
    deletedIndices,
    canDeleteSaved,
    onToggleSaved,
    newFiles,
    onRemoveNew,
    onPreview,
    error,
}: {
    label: string;
    inputId: string;
    inputRef: React.RefObject<HTMLInputElement | null>;
    onAdd: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onCaptureFile?: (file: File) => void;
    savedPaths: { path: string; index: number }[];
    deletedIndices: number[];
    canDeleteSaved: boolean;
    onToggleSaved: (index: number) => void;
    newFiles: PickedFile[];
    onRemoveNew: (index: number) => void;
    onPreview: (path: string) => void;
    error?: string;
}) {
    const [camaraAbierta, setCamaraAbierta] = useState(false);

    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            <input ref={inputRef} id={inputId} type="file" accept="image/*" multiple className="hidden" onChange={onAdd} />
            <InputError message={error} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {savedPaths.map(({ path, index }) => (
                    <div
                        key={`saved-${index}`}
                        className={`group relative cursor-pointer ${deletedIndices.includes(index) ? 'opacity-50' : ''}`}
                        onClick={() => !deletedIndices.includes(index) && onPreview(path)}
                    >
                        <img
                            src={path}
                            alt={`Guardada ${index + 1}`}
                            className="border-border h-24 w-full rounded-lg border object-cover transition-transform group-hover:scale-105"
                        />
                        <span className="absolute top-1 left-1 rounded bg-emerald-600 px-1.5 py-0.5 text-xs text-white dark:bg-emerald-500">
                            Guardada
                        </span>
                        {canDeleteSaved && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleSaved(index);
                                }}
                                className={`absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full text-white shadow transition-colors ${
                                    deletedIndices.includes(index) ? 'bg-muted-foreground' : 'bg-red-500 hover:bg-red-600'
                                }`}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                ))}
                {newFiles.map((item, index) => (
                    <div key={`new-${index}`} className="group relative cursor-pointer">
                        <img
                            src={item.preview}
                            alt={`Nueva ${index + 1}`}
                            onClick={() => onPreview(item.preview)}
                            className="h-24 w-full rounded-lg border border-sky-300 object-cover transition-transform group-hover:scale-105 dark:border-sky-500/40"
                        />
                        <button
                            type="button"
                            onClick={() => onRemoveNew(index)}
                            className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="border-border text-muted-foreground hover:border-primary hover:text-primary flex h-24 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors"
                >
                    <span className="text-2xl leading-none font-light">+</span>
                    <span className="mt-1 text-xs">Subir archivo</span>
                </button>
                {onCaptureFile && (
                    <button
                        type="button"
                        onClick={() => setCamaraAbierta(true)}
                        className="border-border text-muted-foreground hover:border-primary hover:text-primary flex h-24 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors"
                    >
                        <Camera className="size-6" />
                        <span className="mt-1 text-xs">Tomar foto</span>
                    </button>
                )}
            </div>
            {onCaptureFile && (
                <CameraCaptureDialog
                    open={camaraAbierta}
                    onOpenChange={setCamaraAbierta}
                    onCapture={onCaptureFile}
                    titulo="Evidencia fotográfica"
                />
            )}
        </div>
    );
}

/** Lista compacta de archivos PDF adjuntos (adicionales): sin miniaturas, con nombre y enlace de descarga. */
function PdfUploader({
    label,
    inputId,
    inputRef,
    onAdd,
    savedPaths,
    deletedIndices,
    canDeleteSaved,
    onToggleSaved,
    newFiles,
    onRemoveNew,
    error,
}: {
    label: string;
    inputId: string;
    inputRef: React.RefObject<HTMLInputElement | null>;
    onAdd: (e: React.ChangeEvent<HTMLInputElement>) => void;
    savedPaths: { path: string; index: number }[];
    deletedIndices: number[];
    canDeleteSaved: boolean;
    onToggleSaved: (index: number) => void;
    newFiles: PickedFile[];
    onRemoveNew: (index: number) => void;
    error?: string;
}) {
    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            <input ref={inputRef} id={inputId} type="file" accept="application/pdf" multiple className="hidden" onChange={onAdd} />
            <InputError message={error} />
            <div className="flex flex-wrap gap-2">
                {savedPaths.map(({ path, index }) => (
                    <div
                        key={`saved-${index}`}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                            deletedIndices.includes(index)
                                ? 'border-border bg-muted text-muted-foreground opacity-60'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                        }`}
                    >
                        <Paperclip className="size-4 shrink-0" />
                        <a href={path} target="_blank" rel="noreferrer" className="max-w-[180px] truncate hover:underline">
                            {path.split('/').pop()}
                        </a>
                        {canDeleteSaved && (
                            <button
                                type="button"
                                onClick={() => onToggleSaved(index)}
                                aria-label="Quitar PDF"
                                className="text-muted-foreground hover:text-red-600"
                            >
                                <X className="size-3.5" />
                            </button>
                        )}
                    </div>
                ))}
                {newFiles.map((item, index) => (
                    <div
                        key={`new-${index}`}
                        className="flex items-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300"
                    >
                        <Paperclip className="size-4 shrink-0" />
                        <span className="max-w-[180px] truncate">{item.file.name}</span>
                        <button
                            type="button"
                            onClick={() => onRemoveNew(index)}
                            aria-label={`Quitar ${item.file.name}`}
                            className="text-sky-600 hover:text-red-600"
                        >
                            <X className="size-3.5" />
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="border-border text-muted-foreground hover:border-primary hover:text-primary flex items-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-2 text-sm transition-colors"
                >
                    <Paperclip className="size-4" />
                    Adjuntar PDF
                </button>
            </div>
        </div>
    );
}

export default function CreatePrueba({
    colaboradores,
    dispositivosDisponibles,
    prueba,
}: {
    colaboradores: ColaboradorOption[];
    dispositivosDisponibles: DispositivoOption[];
    prueba?: PruebaData;
}) {
    const breadcrumbs: BreadcrumbItem[] = prueba
        ? [...breadcrumbsBase, { title: 'Editar prueba', href: `/modules/seguridad/pruebas/${prueba.id}/edit` }]
        : [...breadcrumbsBase, { title: 'Registrar prueba', href: '/modules/seguridad/pruebas/create' }];
    const { data, setData, post, processing, errors, transform } = useForm<PruebaForm>({
        colaborador_id: prueba?.colaborador_id ? String(prueba.colaborador_id) : '',
        tipo: prueba?.tipo ?? 'pre_ruta',
        es_programacion: prueba ? prueba.estado === 'programada' : false,
        programada_en: prueba?.programada_en ? String(prueba.programada_en) : '',
        alcoholimetro_id: prueba?.alcoholimetro_id ? String(prueba.alcoholimetro_id) : '',
        resultado: prueba?.resultado ? String(prueba.resultado) : '0',
        consentimiento_aceptado: prueba?.consentimiento_aceptado ?? false,
        evidencia: [],
        evidencias: [],
        firma: null,
        observaciones: prueba?.observaciones ?? '',
    });

    const colaboradorSeleccionado = colaboradores.find((c) => String(c.id) === data.colaborador_id);

    const firmaPadRef = useRef<FirmaPadHandle>(null);

    // Precarga la última firma registrada al seleccionar un colaborador
    useEffect(() => {
        if (!data.colaborador_id) {
            firmaPadRef.current?.clear();
            return;
        }
        // En modo edición no sobreescribimos la firma existente
        if (prueba) return;

        fetch(route('seguridad.pruebas.ultima-firma', { colaborador: data.colaborador_id }))
            .then((res) => res.json())
            .then((json: { firma_url: string | null }) => {
                if (json.firma_url) {
                    firmaPadRef.current?.loadFromUrl(json.firma_url);
                } else {
                    firmaPadRef.current?.clear();
                }
            })
            .catch(() => { /* ignorar errores de red */ });
    }, [data.colaborador_id]);
    const evidenciaInputRef = useRef<HTMLInputElement>(null);
    const evidenciasInputRef = useRef<HTMLInputElement>(null);
    // Rutas guardadas en el servidor; nunca se mutan localmente, solo se marcan para borrar.
    const [savedEvidencias] = useState<string[]>(prueba?.evidencias_paths ?? []);
    const [deletedEvidenciasIndices, setDeletedEvidenciasIndices] = useState<number[]>([]);
    const [deletedEvidenciasAdicionalesIndices, setDeletedEvidenciasAdicionalesIndices] = useState<number[]>([]);
    const [filesEvidencia, setFilesEvidencia] = useState<PickedFile[]>([]);
    const [filesEvidencias, setFilesEvidencias] = useState<PickedFile[]>([]);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);
    const [deleteType, setDeleteType] = useState<'evidencia' | 'adicional' | null>(null);

    // La evidencia principal siempre es imagen y las adicionales siempre PDF,
    // así que el tipo de archivo separa el listado guardado de forma
    // confiable — se conserva el índice original porque el backend borra por
    // posición dentro de la colección completa de evidencias.
    const savedConIndice = savedEvidencias.map((path, index) => ({ path, index }));
    const savedFotos = savedConIndice.filter(({ path }) => !/\.pdf$/i.test(path));
    const savedPdfs = savedConIndice.filter(({ path }) => /\.pdf$/i.test(path));

    const agregarArchivosEvidencia = (archivos: File[]) => {
        if (archivos.length === 0) return;
        const updated = [...filesEvidencia, ...archivos.map((file) => ({ file, preview: URL.createObjectURL(file) }))];
        setFilesEvidencia(updated);
        setData(
            'evidencia',
            updated.map((f) => f.file),
        );
    };

    const addEvidencia = (e: React.ChangeEvent<HTMLInputElement>) => {
        agregarArchivosEvidencia(Array.from(e.target.files ?? []));
        if (evidenciaInputRef.current) evidenciaInputRef.current.value = '';
    };

    const removeEvidencia = (index: number) => {
        const updated = filesEvidencia.filter((_, i) => i !== index);
        setFilesEvidencia(updated);
        setData(
            'evidencia',
            updated.map((f) => f.file),
        );
    };

    const removeSavedEvidencia = (index: number) => {
        if (deletedEvidenciasIndices.includes(index)) {
            // Si ya estaba marcada, simplemente la desmarcamos
            const updated = deletedEvidenciasIndices.filter((i) => i !== index);
            setDeletedEvidenciasIndices(updated);
            setData('deleted_evidencias_indices', updated);
        } else {
            // Mostrar diálogo de confirmación
            setPendingDeleteIndex(index);
            setDeleteType('evidencia');
            setShowDeleteDialog(true);
        }
    };

    const confirmDeleteEvidencia = () => {
        if (pendingDeleteIndex !== null) {
            const updated = [...deletedEvidenciasIndices, pendingDeleteIndex];
            setDeletedEvidenciasIndices(updated);
            setData('deleted_evidencias_indices', updated);
        }
        setShowDeleteDialog(false);
        setPendingDeleteIndex(null);
        setDeleteType(null);
    };

    const addEvidencias = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newFiles = Array.from(e.target.files ?? []).map((file) => ({ file, preview: URL.createObjectURL(file) }));
        const updated = [...filesEvidencias, ...newFiles];
        setFilesEvidencias(updated);
        setData(
            'evidencias',
            updated.map((f) => f.file),
        );
        if (evidenciasInputRef.current) evidenciasInputRef.current.value = '';
    };

    const removeEvidencias = (index: number) => {
        const updated = filesEvidencias.filter((_, i) => i !== index);
        setFilesEvidencias(updated);
        setData(
            'evidencias',
            updated.map((f) => f.file),
        );
    };

    const removeSavedEvidencias = (index: number) => {
        if (deletedEvidenciasAdicionalesIndices.includes(index)) {
            // Si ya estaba marcada, simplemente la desmarcamos
            const updated = deletedEvidenciasAdicionalesIndices.filter((i) => i !== index);
            setDeletedEvidenciasAdicionalesIndices(updated);
            setData('deleted_evidencias_adicionales_indices', updated);
        } else {
            // Mostrar diálogo de confirmación
            setPendingDeleteIndex(index);
            setDeleteType('adicional');
            setShowDeleteDialog(true);
        }
    };

    const confirmDeleteAdicional = () => {
        if (pendingDeleteIndex !== null) {
            const updated = [...deletedEvidenciasAdicionalesIndices, pendingDeleteIndex];
            setDeletedEvidenciasAdicionalesIndices(updated);
            setData('deleted_evidencias_adicionales_indices', updated);
        }
        setShowDeleteDialog(false);
        setPendingDeleteIndex(null);
        setDeleteType(null);
    };

    const requiereConsentimiento = !data.es_programacion;
    const puedeGuardar = !requiereConsentimiento || data.consentimiento_aceptado;

    const submit: FormEventHandler = async (e) => {
        e.preventDefault();

        if (!puedeGuardar) {
            return;
        }

        const firma = await firmaPadRef.current?.getFile();
        transform((data) => ({ ...data, firma: firma ?? null, ...(prueba ? { _method: 'PUT' } : {}) }));

        if (prueba) {
            post(route('seguridad.pruebas.update', prueba.id), { forceFormData: true });
            return;
        }

        post(route('seguridad.pruebas.store'), { forceFormData: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={prueba ? 'Editar prueba de alcoholemia' : 'Registrar prueba de alcoholemia'} />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <HeadingSmall
                    title={prueba ? 'Editar prueba de alcoholemia' : 'Registrar prueba de alcoholemia'}
                    description={
                        prueba
                            ? 'Modifica los datos de la prueba y guarda los cambios.'
                            : 'Selecciona al colaborador y completa los datos de la prueba.'
                    }
                />

                <form onSubmit={submit} className="grid gap-6">
                    <SeccionCard icon={Users} titulo="Colaborador y tipo de prueba" tono="verde">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <ColaboradorSearchSelect
                                id="colaborador_search"
                                label="Colaborador"
                                colaboradores={colaboradores}
                                selectedId={data.colaborador_id}
                                onSelect={(colaborador) => setData('colaborador_id', colaborador ? String(colaborador.id) : '')}
                                error={errors.colaborador_id}
                            />

                            <div className="grid gap-2">
                                <Label htmlFor="tipo">Tipo de prueba</Label>
                                <Select value={data.tipo} onValueChange={(value) => setData('tipo', value)}>
                                    <SelectTrigger id="tipo">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pre_ruta">Pre Ruta</SelectItem>
                                        <SelectItem value="ruta">Ruta</SelectItem>
                                        <SelectItem value="post_ruta">Post Ruta</SelectItem>
                                        <SelectItem value="jl">JL</SelectItem>
                                        <SelectItem value="segundo_viaje">Segundo viaje</SelectItem>
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.tipo} />
                            </div>
                        </div>

                        {colaboradorSeleccionado && (
                            <div className="mt-4 grid gap-3 rounded-lg border border-emerald-200 bg-white/60 p-3 text-sm sm:grid-cols-4 dark:border-emerald-500/20 dark:bg-black/10">
                                <div>
                                    <p className="text-muted-foreground text-[11px] tracking-wide uppercase">Identificación</p>
                                    <p className="text-foreground font-medium">{colaboradorSeleccionado.cedula}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-[11px] tracking-wide uppercase">Nombres</p>
                                    <p className="text-foreground font-medium">{colaboradorSeleccionado.nombres}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-[11px] tracking-wide uppercase">Apellidos</p>
                                    <p className="text-foreground font-medium">{colaboradorSeleccionado.apellidos}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-[11px] tracking-wide uppercase">Cargo</p>
                                    <p className="text-foreground font-medium">{colaboradorSeleccionado.cargo ?? '—'}</p>
                                </div>
                            </div>
                        )}
                    </SeccionCard>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="es_programacion"
                            checked={data.es_programacion}
                            onCheckedChange={(checked) => setData('es_programacion', checked === true)}
                        />
                        <Label htmlFor="es_programacion" className="font-normal">
                            Programar para más tarde
                        </Label>
                    </div>

                    {data.es_programacion ? (
                        <SeccionCard icon={CalendarClock} titulo="Programación" tono="azul">
                            <div className="grid gap-2 sm:max-w-xs">
                                <Label htmlFor="programada_en">Fecha y hora programada</Label>
                                <Input
                                    id="programada_en"
                                    type="datetime-local"
                                    value={data.programada_en}
                                    onChange={(e) => setData('programada_en', e.target.value)}
                                />
                                <InputError message={errors.programada_en} />
                            </div>
                        </SeccionCard>
                    ) : (
                        <>
                            <SeccionCard icon={Gauge} titulo="Dispositivo y resultado" tono="verde">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="alcoholimetro_id">Dispositivo</Label>
                                        <Select value={data.alcoholimetro_id} onValueChange={(value) => setData('alcoholimetro_id', value)}>
                                            <SelectTrigger id="alcoholimetro_id">
                                                <SelectValue placeholder="Selecciona un dispositivo disponible" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {dispositivosDisponibles.map((dispositivo) => (
                                                    <SelectItem key={dispositivo.id} value={String(dispositivo.id)}>
                                                        {dispositivo.codigo}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <InputError message={errors.alcoholimetro_id} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="resultado">Resultado</Label>
                                        <Input
                                            id="resultado"
                                            type="number"
                                            inputMode="decimal"
                                            min="0"
                                            step="0.001"
                                            value={data.resultado}
                                            onChange={(e) => setData('resultado', e.target.value.replace(/[^0-9.]/g, ''))}
                                            onKeyDown={(e) => {
                                                if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                                            }}
                                        />
                                        <InputError message={errors.resultado} />
                                    </div>
                                </div>
                            </SeccionCard>

                            <SeccionCard icon={Camera} titulo="Evidencia fotográfica" tono="azul">
                                <div className="grid gap-6">
                                    <EvidenciaUploader
                                        label="Evidencia principal (foto)"
                                        inputId="evidencia"
                                        inputRef={evidenciaInputRef}
                                        onAdd={addEvidencia}
                                        onCaptureFile={(file) => agregarArchivosEvidencia([file])}
                                        savedPaths={savedFotos}
                                        deletedIndices={deletedEvidenciasIndices}
                                        canDeleteSaved={Boolean(prueba)}
                                        onToggleSaved={removeSavedEvidencia}
                                        newFiles={filesEvidencia}
                                        onRemoveNew={removeEvidencia}
                                        onPreview={setSelectedImage}
                                        error={errors.evidencia}
                                    />
                                </div>
                            </SeccionCard>

                            <SeccionCard icon={Paperclip} titulo="Evidencia adicional (PDF)" subtitulo="Opcional" tono="verde">
                                <PdfUploader
                                    label="Documentos PDF"
                                    inputId="evidencias"
                                    inputRef={evidenciasInputRef}
                                    onAdd={addEvidencias}
                                    savedPaths={savedPdfs}
                                    deletedIndices={deletedEvidenciasAdicionalesIndices}
                                    canDeleteSaved={Boolean(prueba)}
                                    onToggleSaved={removeSavedEvidencias}
                                    newFiles={filesEvidencias}
                                    onRemoveNew={removeEvidencias}
                                    error={errors.evidencias}
                                />
                            </SeccionCard>

                            <SeccionCard icon={PenTool} titulo="Firma del colaborador" tono="azul">
                                <div className="max-w-md">
                                    <FirmaPad ref={firmaPadRef} />
                                </div>
                            </SeccionCard>

                            <SeccionCard icon={ShieldCheck} titulo="Consentimiento informado" tono="verde">
                                <div className="flex items-start space-x-2">
                                    <Checkbox
                                        id="consentimiento_aceptado"
                                        className="mt-0.5"
                                        checked={data.consentimiento_aceptado}
                                        onCheckedChange={(checked) => setData('consentimiento_aceptado', checked === true)}
                                    />
                                    <Label htmlFor="consentimiento_aceptado" className="leading-snug font-normal">
                                        {CONSENTIMIENTO_TEXTO}
                                    </Label>
                                </div>
                                <InputError message={errors.consentimiento_aceptado} />
                            </SeccionCard>
                        </>
                    )}

                    <SeccionCard icon={ClipboardList} titulo="Observaciones" subtitulo="Opcional" tono="azul">
                        <textarea
                            id="observaciones"
                            className="border-input bg-background flex min-h-20 w-full rounded-md border px-3 py-2 text-sm"
                            value={data.observaciones}
                            onChange={(e) => setData('observaciones', e.target.value)}
                        />
                        <InputError message={errors.observaciones} />
                    </SeccionCard>

                    <div className="flex justify-end">
                        <Button type="submit" disabled={processing || !puedeGuardar}>
                            {processing && <LoaderCircle className="size-4 animate-spin" />}
                            {data.es_programacion
                                ? prueba
                                    ? 'Actualizar programación'
                                    : 'Programar prueba'
                                : prueba
                                  ? 'Actualizar prueba'
                                  : 'Registrar prueba'}
                        </Button>
                    </div>
                </form>
            </div>

            {selectedImage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setSelectedImage(null)}>
                    <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="absolute top-4 right-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/75"
                        >
                            <X className="h-6 w-6" />
                        </button>
                        <img src={selectedImage} alt="Vista previa" className="h-auto w-full rounded-lg" />
                    </div>
                </div>
            )}

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent className="border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-950">
                    <AlertDialogTitle className="text-red-900 dark:text-red-200">
                        {deleteType === 'adicional' ? 'Eliminar PDF' : 'Eliminar imagen'}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-red-800 dark:text-red-300">
                        {deleteType === 'adicional'
                            ? '¿Estás seguro de que deseas eliminar este PDF? Esta acción no se puede deshacer y el archivo se eliminará permanentemente.'
                            : '¿Estás seguro de que deseas eliminar esta imagen? Esta acción no se puede deshacer y la imagen se eliminará permanentemente.'}
                    </AlertDialogDescription>
                    <div className="flex justify-end gap-2 pt-4">
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (deleteType === 'evidencia') {
                                    confirmDeleteEvidencia();
                                } else if (deleteType === 'adicional') {
                                    confirmDeleteAdicional();
                                }
                            }}
                            className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                        >
                            Eliminar
                        </AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
