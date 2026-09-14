import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { SeccionCard, type DocumentInfo } from '@/pages/seguridad/colaboradores/colaborador-form-fields';
import { SimpleFileField } from '@/pages/gente/colaboradores/wizard/components/simple-file-field';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { Ban, CalendarClock, CheckCircle2, Download, FileCheck2, FileText, History, LoaderCircle, Pencil, Play, Plus, Stethoscope, Trash2, User } from 'lucide-react';
import { FormEventHandler, useEffect, useState } from 'react';

const TIPO_LABELS: Record<string, string> = { ingreso: 'Ingreso', periodico: 'Periódico', egreso: 'Egreso' };

const ESTADO_LABELS: Record<string, string> = {
    sin_iniciar: 'Sin Iniciar',
    demorada: 'Demorada',
    en_proceso: 'En Proceso',
    terminada: 'Terminada',
    pendiente: 'Pendiente',
    programado: 'Programado',
    ejecutado: 'Ejecutado',
};

const ESTADO_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    sin_iniciar: 'secondary',
    demorada: 'destructive',
    en_proceso: 'default',
    terminada: 'outline',
    pendiente: 'secondary',
    programado: 'default',
    ejecutado: 'outline',
};

const ESTADO_EXAMEN_LABELS: Record<string, string> = {
    pendiente: 'Pendiente',
    programado: 'Programado',
    realizado: 'Realizado',
};

// Tipos
// ============================================================================

interface ExamenLigero {
    id: number;
    nombre: string;
}

interface ExamenEvaluacionRow {
    id: number;
    obligatorio: boolean;
    origen: 'matriz' | 'adicional';
    estado: 'pendiente' | 'programado' | 'realizado';
    fecha_programacion: string | null;
    fecha_ejecucion: string | null;
    soporte_path: string | null;
    fecha_ingreso_pdf: string | null;
    hora_ingreso_pdf: string | null;
    examen: ExamenLigero;
}

interface ColaboradorDetalle {
    id: number;
    nombres: string;
    apellidos: string;
    cedula: string;
    cargo: string | null;
    centro: string | null;
    area: string | null;
    fecha_ingreso_empresa: string | null;
    fecha_retiro_empresa: string | null;
}

interface ResponsableLigero {
    id: number;
    first_name: string;
    last_name: string;
}

interface SeguimientoRow {
    id: number;
    fecha_seguimiento: string;
    estado_seguimiento: string;
    observacion: string | null;
    responsable: ResponsableLigero | null;
    fecha_proximo_seguimiento: string | null;
    carta_recomendacion_entregada: boolean;
    soporte_path: string | null;
}

interface EvaluacionRecomendacionRow {
    id: number;
    observacion: string | null;
    soporte_path: string | null;
    activa: boolean;
    fecha_registro: string;
    recomendacion: { id: number; nombre: string; categoria: string };
    seguimientos: SeguimientoRow[];
    origen_evaluacion?: string; // Para mostrar INGRESO/PERIÓDICO/EGRESO
    fecha_origen?: string; // Fecha de la evaluación origen
    evaluacion_medica_id?: number; // ID de la evaluación a la que pertenece
}

interface EvaluacionDetalle {
    id: number;
    tipo_evaluacion: string;
    numero_periodo: number | null;
    fecha_evaluacion: string;
    proximo_examen_fecha: string | null;
    fecha_entrada_bandeja: string | null;
    fecha_limite: string | null;
    estado: string;
    observacion: string | null;
    emite: string | null;
    seguimiento_recomendaciones: string | null;
    seguimiento_recomendaciones_detalle: string | null;
    estado_seguimiento: string | null;
    empresa: string | null;
    carta_entregada: boolean | null;
    carta_entregada_observacion: string | null;
    colaborador: ColaboradorDetalle;
    concepto_aptitud: { id: number; nombre: string } | null;
    examenes: ExamenEvaluacionRow[];
    recomendaciones: EvaluacionRecomendacionRow[];
}

interface HistorialEvaluacionRow {
    id: number;
    tipo_evaluacion: string;
    numero_periodo: number | null;
    ciclo_numero?: number;
    fecha_evaluacion: string;
    proximo_examen_fecha: string | null;
    fecha_limite: string | null;
    estado: string;
    emite: string | null;
    concepto_aptitud: { id: number; nombre: string } | null;
    examenes: ExamenEvaluacionRow[];
}

interface RecomendacionLigera {
    id: number;
    nombre: string;
    categoria: string;
}

// Helper de formateo seguro de fechas
// ============================================================================

function formatFecha(dateStr?: string | null): string {
    if (!dateStr) return '—';
    const clean = String(dateStr).split('T')[0].trim();
    if (!clean) return '—';
    const parts = clean.split('-');
    if (parts.length === 3) {
        const [y, m, d] = parts.map(Number);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            const dateObj = new Date(y, m - 1, d);
            return isNaN(dateObj.getTime()) ? clean : dateObj.toLocaleDateString('es-CO');
        }
    }
    const fallback = new Date(dateStr);
    return isNaN(fallback.getTime()) ? '—' : fallback.toLocaleDateString('es-CO');
}

type PdfPreview = { url: string; label: string };

function PdfPreviewDialog({ preview, onClose }: { preview: PdfPreview | null; onClose: () => void }) {
    return (
        <Dialog open={preview !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] max-w-3xl">
                <DialogHeader>
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
                </DialogHeader>
                {preview && (
                    <iframe
                        src={preview.url}
                        title={preview.label}
                        className="h-[75vh] w-full rounded-md border border-border"
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function soporteUrl(path: string): string {
    if (!path) return '';
    // Si ya es una URL completa (empieza con http), retornarla tal cual
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }
    // Si ya empieza con /storage/, retornarla tal cual
    if (path.startsWith('/storage/')) {
        return path;
    }
    // Si empieza con /, retornarla tal cual (ruta absoluta)
    if (path.startsWith('/')) {
        return path;
    }
    // De lo contrario, agregar /storage/ al inicio
    return `/storage/${path}`;
}

interface SoporteFileItem extends DocumentInfo {
    url: string;
}

function parseSoportePaths(pathStr?: string | null): string[] {
    if (!pathStr) return [];
    const trimmed = String(pathStr).trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.filter((p): p is string => typeof p === 'string' && p.trim() !== '');
            }
        } catch {
            // fallback
        }
    }
    return [trimmed];
}

function cleanFileName(path: string): string {
    if (!path) return 'Archivo PDF';
    const raw = path.split('/').pop() || 'Archivo PDF';
    // Remove leading timestamp prefix if present (e.g. 1724089300_file.pdf -> file.pdf)
    const clean = raw.replace(/^\d{10,}_/, '');
    // If it's a long 40-char random hash like Rs4mD79m49QhqaVxk0N8fCGkaodMRJPPuP7ijnbi.pdf, make it friendly
    if (clean.length >= 35 && !clean.includes(' ') && !clean.includes('-') && !clean.includes('_')) {
        return 'Documento_adjunto.pdf';
    }
    return clean;
}

function getSoporteFiles(pathStr?: string | null): SoporteFileItem[] {
    const paths = parseSoportePaths(pathStr);
    return paths.map((path) => ({
        path,
        name: cleanFileName(path),
        fecha: null,
        url: soporteUrl(path),
    }));
}

function IniciarEvaluacionButton({ evaluacionId }: { evaluacionId: number }) {
    const { post, processing } = useForm({});

    return (
        <Button
            type="button"
            onClick={() =>
                post(route('seguridad.examenes-medicos.iniciar', evaluacionId), {
                    preserveScroll: true,
                })
            }
            disabled={processing}
        >
            {processing ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />}
            Iniciar evaluación
        </Button>
    );
}

function ProgramarTodosDialog({ evaluacionId, disabled }: { evaluacionId: number; disabled?: boolean }) {
    const [open, setOpen] = useState(false);
    const { data, setData, patch, processing, errors, reset } = useForm({
        fecha_programacion: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        patch(route('seguridad.examenes-medicos.examenes.programar-todos', evaluacionId), {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setOpen(false);
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" variant="outline" disabled={disabled}>
                    <CalendarClock className="size-4" />
                    Programar exámenes
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarClock className="size-5 text-sky-600 dark:text-sky-400" />
                        Programar todos los exámenes
                    </DialogTitle>
                    <DialogDescription>
                        Registra la fecha de programación aplicable a todos los exámenes de esta evaluación.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="fecha_programacion_todos">Fecha programada</Label>
                        <Input
                            id="fecha_programacion_todos"
                            type="date"
                            value={data.fecha_programacion}
                            onChange={(e) => setData('fecha_programacion', e.target.value)}
                            disabled={processing}
                        />
                        <InputError message={errors.fecha_programacion} />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={processing || !data.fecha_programacion}>
                            {processing && <LoaderCircle className="size-4 animate-spin" />}
                            Programar exámenes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function EjecutarTodosDialog({ evaluacionId, disabled }: { evaluacionId: number; disabled?: boolean }) {
    const [open, setOpen] = useState(false);
    const { data, setData, post, processing, errors, reset, transform } = useForm<{
        fecha_ejecucion: string;
        soporte: File[];
    }>({
        fecha_ejecucion: '',
        soporte: [],
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        transform((formData) => ({ ...formData, soporte: formData.soporte[0] ?? null }));
        post(route('seguridad.examenes-medicos.examenes.ejecutar-todos', evaluacionId), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setOpen(false);
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" disabled={disabled}>
                    <FileCheck2 className="size-4" />
                    Registrar ejecución
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileCheck2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                        Registrar ejecución de exámenes
                    </DialogTitle>
                    <DialogDescription>
                        Registra la fecha de toma de exámenes y adjunta el soporte PDF/documento general si aplica.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="fecha_ejecucion_todos">Fecha de ejecución</Label>
                        <Input
                            id="fecha_ejecucion_todos"
                            type="date"
                            value={data.fecha_ejecucion}
                            onChange={(e) => setData('fecha_ejecucion', e.target.value)}
                            disabled={processing}
                        />
                        <InputError message={errors.fecha_ejecucion} />
                    </div>
                    <SimpleFileField
                        label="Soporte (opcional)"
                        files={data.soporte}
                        multiple={false}
                        onChange={(files) => setData('soporte', files)}
                        error={errors.soporte}
                        disabled={processing}
                    />
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={processing || !data.fecha_ejecucion}>
                            {processing && <LoaderCircle className="size-4 animate-spin" />}
                            Registrar ejecución
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function EliminarRecomendacionButton({
    evaluacionId,
    evaluacionRecomendacion,
    onSuccess,
}: {
    evaluacionId: number;
    evaluacionRecomendacion: EvaluacionRecomendacionRow;
    onSuccess?: () => void;
}) {
    const { delete: destroy, processing } = useForm({});

    const onDelete = () => {
        if (confirm(`¿Estás seguro de eliminar la recomendación "${evaluacionRecomendacion.recomendacion.nombre}"?`)) {
            destroy(route('seguridad.examenes-medicos.recomendaciones.destroy', [evaluacionId, evaluacionRecomendacion.id]), {
                preserveScroll: true,
                onSuccess: () => {
                    onSuccess?.();
                },
            });
        }
    };

    return (
        <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
            disabled={processing}
            onClick={onDelete}
        >
            <Trash2 className="size-4" />
            Eliminar
        </Button>
    );
}

function AgregarAdicionalDialog({ evaluacionId, opciones }: { evaluacionId: number; opciones: ExamenLigero[] }) {
    const [open, setOpen] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({ examen_id: '' });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('seguridad.examenes-medicos.examenes.adicional', evaluacionId), {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setOpen(false);
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" variant="outline">
                    <Plus />
                    Agregar examen adicional
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Agregar examen adicional</DialogTitle>
                    <DialogDescription>Suma un examen que no vino de la matriz del cargo.</DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="examen_id">Examen</Label>
                        <Select value={data.examen_id} onValueChange={(value) => setData('examen_id', value)} disabled={processing}>
                            <SelectTrigger id="examen_id">
                                <SelectValue placeholder="Selecciona el examen" />
                            </SelectTrigger>
                            <SelectContent>
                                {opciones.map((examen) => (
                                    <SelectItem key={examen.id} value={String(examen.id)}>
                                        {examen.nombre}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={errors.examen_id} />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={processing || !data.examen_id}>
                            {processing && <LoaderCircle className="size-4 animate-spin" />}
                            Agregar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ConceptoAptitudForm({
    evaluacion,
    conceptos,
    empresaDefault,
}: {
    evaluacion: EvaluacionDetalle;
    conceptos: { id: number; nombre: string }[];
    empresaDefault: string;
}) {
    // Precargar "SATISFACTORIO" por defecto si no hay concepto previo
    const satisfactorio = conceptos.find((c) => c.nombre.toUpperCase().includes('SATISFACTORIO'));
    const conceptoDefault = evaluacion.concepto_aptitud
        ? String(evaluacion.concepto_aptitud.id)
        : (satisfactorio ? String(satisfactorio.id) : '');

    const { data, setData, patch, processing, errors } = useForm({
        concepto_aptitud_id: conceptoDefault,
        emite: evaluacion.emite ?? '',
        empresa: evaluacion.empresa ?? (empresaDefault || 'Adenar'),
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        patch(route('seguridad.examenes-medicos.concepto-aptitud', evaluacion.id), { preserveScroll: true });
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="grid gap-2">
                    <Label htmlFor="concepto_aptitud_id">Concepto de aptitud</Label>
                    <Select
                        value={data.concepto_aptitud_id || 'none'}
                        onValueChange={(value) => setData('concepto_aptitud_id', value === 'none' ? '' : value)}
                        disabled={processing}
                    >
                        <SelectTrigger id="concepto_aptitud_id">
                            <SelectValue placeholder="Sin definir" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Sin definir</SelectItem>
                            {conceptos.map((concepto) => (
                                <SelectItem key={concepto.id} value={String(concepto.id)}>
                                    {concepto.nombre}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <InputError message={errors.concepto_aptitud_id} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="emite">Emite</Label>
                    <Input
                        id="emite"
                        placeholder="Persona o entidad que emite el concepto"
                        value={data.emite}
                        onChange={(e) => setData('emite', e.target.value)}
                        disabled={processing}
                    />
                    <InputError message={errors.emite} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="empresa">Empresa</Label>
                    <Input
                        id="empresa"
                        value={data.empresa}
                        onChange={(e) => setData('empresa', e.target.value)}
                        disabled={processing}
                    />
                    <InputError message={errors.empresa} />
                </div>
            </div>

            <div className="flex justify-end pt-2">
                <Button type="submit" disabled={processing}>
                    {processing && <LoaderCircle className="size-4 animate-spin" />}
                    Guardar concepto de aptitud
                </Button>
            </div>
        </form>
    );
}

function AgregarRecomendacionDialog({
    evaluacionId,
    opciones,
    categorias,
}: {
    evaluacionId: number;
    opciones: RecomendacionLigera[];
    categorias: Record<string, string>;
}) {
    const [open, setOpen] = useState(false);
    const { data, setData, post, processing, errors, reset, transform } = useForm<{
        recomendacion_id: string;
        observacion: string;
        soporte: File[];
    }>({
        recomendacion_id: '',
        observacion: '',
        soporte: [],
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        transform((formData) => ({
            ...formData,
            soporte: formData.soporte,
        }));
        post(route('seguridad.examenes-medicos.recomendaciones.store', evaluacionId), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setOpen(false);
            },
        });
    };

    const opcionesPorCategoria = Object.keys(categorias).map((categoria) => ({
        categoria,
        etiqueta: categorias[categoria],
        recomendaciones: opciones.filter((r) => r.categoria === categoria),
    }));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" variant="outline">
                    <Plus />
                    Agregar recomendación
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Agregar recomendación</DialogTitle>
                    <DialogDescription>Recomendación médica u ocupacional generada por esta evaluación.</DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="recomendacion_id">Recomendación</Label>
                        <Select value={data.recomendacion_id} onValueChange={(value) => setData('recomendacion_id', value)} disabled={processing}>
                            <SelectTrigger id="recomendacion_id">
                                <SelectValue placeholder="Selecciona la recomendación" />
                            </SelectTrigger>
                            <SelectContent>
                                {opcionesPorCategoria.map(
                                    (grupo) =>
                                        grupo.recomendaciones.length > 0 && (
                                            <SelectGroup key={grupo.categoria}>
                                                <SelectLabel>{grupo.etiqueta}</SelectLabel>
                                                {grupo.recomendaciones.map((recomendacion) => (
                                                    <SelectItem key={recomendacion.id} value={String(recomendacion.id)}>
                                                        {recomendacion.nombre}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        ),
                                )}
                            </SelectContent>
                        </Select>
                        <InputError message={errors.recomendacion_id} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="recomendacion_observacion">Observación (opcional)</Label>
                        <Textarea
                            id="recomendacion_observacion"
                            value={data.observacion}
                            onChange={(e) => setData('observacion', e.target.value)}
                            disabled={processing}
                        />
                        <InputError message={errors.observacion} />
                    </div>
                    <SimpleFileField
                        label="Soporte / Documento adjunto (opcional)"
                        files={data.soporte}
                        multiple={true}
                        onChange={(files) => setData('soporte', files)}
                        error={errors.soporte}
                        disabled={processing}
                    />
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={processing || !data.recomendacion_id}>
                            {processing && <LoaderCircle className="size-4 animate-spin" />}
                            Agregar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ToggleActivaButton({ evaluacionId, evaluacionRecomendacion }: { evaluacionId: number; evaluacionRecomendacion: EvaluacionRecomendacionRow }) {
    const { patch, processing } = useForm({});

    return (
        <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={processing}
            onClick={() =>
                patch(route('seguridad.examenes-medicos.recomendaciones.toggle-activa', [evaluacionId, evaluacionRecomendacion.id]), {
                    preserveScroll: true,
                })
            }
        >
            {evaluacionRecomendacion.activa ? (
                <>
                    <Ban className="size-4" /> Marcar no vigente
                </>
            ) : (
                <>
                    <CheckCircle2 className="size-4" /> Marcar vigente
                </>
            )}
        </Button>
    );
}

function SeguimientosDialog({
    evaluacionId,
    evaluacionRecomendacion,
    estados,
    categorias = {},
}: {
    evaluacionId: number;
    evaluacionRecomendacion: EvaluacionRecomendacionRow;
    estados: string[];
    categorias?: Record<string, string>;
}) {
    const [open, setOpen] = useState(false);
    // null = creating new, number = editing existing seguimiento id
    const [editingId, setEditingId] = useState<number | null>(null);
    // Guardar el soporte_path del seguimiento que se está editando
    const [editingSoportePath, setEditingSoportePath] = useState<string | null>(null);
    // ID del seguimiento que se está eliminando (para deshabilitar botón y dar feedback visual)
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const seguimientos = evaluacionRecomendacion.seguimientos;
    const ultimoSeguimiento = seguimientos.length > 0 ? seguimientos[seguimientos.length - 1] : null;

    const emptyForm = {
        fecha_seguimiento: '',
        estado_seguimiento: '',
        observacion: '',
        fecha_proximo_seguimiento: '',
        carta_recomendacion_entregada: false,
        soporte: [] as File[],
    };

    const { data, setData, post, processing, errors, reset, transform } = useForm<{
        fecha_seguimiento: string;
        estado_seguimiento: string;
        observacion: string;
        fecha_proximo_seguimiento: string;
        carta_recomendacion_entregada: boolean;
        soporte: File[];
    }>(emptyForm);

    // Load data from a specific seguimiento into the form (for editing)
    const loadSeguimiento = (seguimiento: SeguimientoRow) => {
        setEditingId(seguimiento.id);
        setEditingSoportePath(seguimiento.soporte_path || evaluacionRecomendacion.soporte_path || null);
        setData({
            fecha_seguimiento: seguimiento.fecha_seguimiento ? String(seguimiento.fecha_seguimiento).split('T')[0] : '',
            estado_seguimiento: seguimiento.estado_seguimiento || '',
            observacion: seguimiento.observacion || '',
            fecha_proximo_seguimiento: seguimiento.fecha_proximo_seguimiento ? String(seguimiento.fecha_proximo_seguimiento).split('T')[0] : '',
            carta_recomendacion_entregada: seguimiento.carta_recomendacion_entregada ?? false,
            soporte: [],
        });
    };

    // Prepare a new seguimiento, referencing the last one as defaults
    const prepareNew = () => {
        setEditingId(null);
        const lastSeg = evaluacionRecomendacion.seguimientos.length > 0
            ? evaluacionRecomendacion.seguimientos[evaluacionRecomendacion.seguimientos.length - 1]
            : null;
        setEditingSoportePath(lastSeg?.soporte_path || evaluacionRecomendacion.soporte_path || null);
        if (lastSeg) {
            setData({
                fecha_seguimiento: '',
                estado_seguimiento: lastSeg.estado_seguimiento || '',
                observacion: '',
                fecha_proximo_seguimiento: '',
                carta_recomendacion_entregada: lastSeg.carta_recomendacion_entregada ?? false,
                soporte: [],
            });
        } else {
            reset();
        }
    };

    // Cargar el último seguimiento cuando se abre el modal
    useEffect(() => {
        if (open) {
            const lastSeg = evaluacionRecomendacion.seguimientos.length > 0
                ? evaluacionRecomendacion.seguimientos[evaluacionRecomendacion.seguimientos.length - 1]
                : null;
            if (editingId === null) {
                if (lastSeg) {
                    loadSeguimiento(lastSeg);
                } else {
                    prepareNew();
                }
            }
        } else {
            setEditingId(null);
            setEditingSoportePath(null);
            reset();
        }
    }, [open]);

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
    };

    const handleRemoveExistingSoporte = (indexToRemove: number) => {
        const files = getSoporteFiles(editingSoportePath);
        const remaining = files.filter((_, idx) => idx !== indexToRemove).map((f) => f.path);
        const newPathStr = remaining.length === 0 ? null : remaining.length === 1 ? remaining[0] : JSON.stringify(remaining);
        setEditingSoportePath(newPathStr);
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        if (editingId !== null) {
            // Update existing: use POST with _method=PUT for Laravel method spoofing (required for forceFormData)
            transform((formData) => ({
                ...formData,
                soporte: formData.soporte,
                existing_soporte_path: editingSoportePath ?? '',
                _method: 'PUT',
            }));
            post(route('seguridad.examenes-medicos.recomendaciones.seguimientos.update', [evaluacionId, evaluacionRecomendacion.id, editingId]), {
                forceFormData: true,
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setOpen(false);
                },
            });
        } else {
            // Create new seguimiento
            transform((formData) => ({ ...formData, soporte: formData.soporte }));
            post(route('seguridad.examenes-medicos.recomendaciones.seguimientos.store', [evaluacionId, evaluacionRecomendacion.id]), {
                forceFormData: true,
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setOpen(false);
                },
            });
        }
    };

    const editingSeguimiento = editingId !== null ? seguimientos.find((s) => s.id === editingId) : null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" size="sm" variant="outline">
                    <History className="size-4" />
                    Seguimientos ({seguimientos.length})
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] w-[95vw] sm:max-w-4xl lg:max-w-5xl overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pr-6">
                        <div>
                            <DialogTitle>Seguimiento — {evaluacionRecomendacion.recomendacion.nombre}</DialogTitle>
                            <DialogDescription className="mt-1 flex items-center gap-2">
                                <span>Historial de seguimiento. Categoría:</span>
                                <Badge variant="outline" className="text-xs">
                                    {categorias[evaluacionRecomendacion.recomendacion.categoria] ?? evaluacionRecomendacion.recomendacion.categoria}
                                </Badge>
                            </DialogDescription>
                        </div>
                        <EliminarRecomendacionButton
                            evaluacionId={evaluacionId}
                            evaluacionRecomendacion={evaluacionRecomendacion}
                            onSuccess={() => setOpen(false)}
                        />
                    </div>
                </DialogHeader>

                {/* ============================== */}
                {/* Historial table (all seguimientos) */}
                {/* ============================== */}
                {seguimientos.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                        <Table className="w-full min-w-[700px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-24">Fecha</TableHead>
                                    <TableHead className="w-28">Estado</TableHead>
                                    <TableHead>Observación</TableHead>
                                    <TableHead className="w-36">Responsable</TableHead>
                                    <TableHead className="w-24">Próximo</TableHead>
                                    <TableHead className="w-16">Carta</TableHead>
                                    <TableHead className="min-w-[180px]">Soporte</TableHead>
                                    <TableHead className="w-20 text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {seguimientos.map((seguimiento) => {
                                    const isSelected = editingId === seguimiento.id;
                                    const soporteRow = seguimiento.soporte_path || evaluacionRecomendacion.soporte_path;
                                    const filesRow = getSoporteFiles(soporteRow);
                                    return (
                                        <TableRow
                                            key={seguimiento.id}
                                            className={`cursor-pointer transition-colors hover:bg-muted/50 ${isSelected ? 'bg-primary/5 ring-1 ring-primary/30' : ''}`}
                                            onClick={() => loadSeguimiento(seguimiento)}
                                        >
                                            <TableCell className="text-xs font-medium">{formatFecha(seguimiento.fecha_seguimiento)}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs">{seguimiento.estado_seguimiento}</Badge>
                                            </TableCell>
                                            <TableCell className="max-w-xs text-xs text-muted-foreground whitespace-pre-wrap">
                                                {seguimiento.observacion || '—'}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {seguimiento.responsable
                                                    ? `${seguimiento.responsable.first_name} ${seguimiento.responsable.last_name}`
                                                    : '—'}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {seguimiento.fecha_proximo_seguimiento
                                                    ? formatFecha(seguimiento.fecha_proximo_seguimiento)
                                                    : '—'}
                                            </TableCell>
                                            <TableCell className="text-xs">{seguimiento.carta_recomendacion_entregada ? 'Sí' : 'No'}</TableCell>
                                            <TableCell>
                                                {filesRow.length > 0 ? (
                                                    <div className="flex flex-col gap-1">
                                                        {filesRow.map((file, idx) => (
                                                            <a
                                                                key={idx}
                                                                href={file.url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-medium truncate max-w-56"
                                                                onClick={(e) => e.stopPropagation()}
                                                                title={file.name}
                                                            >
                                                                <FileText className="size-3.5 shrink-0" />
                                                                <span className="truncate">{file.name}</span>
                                                            </a>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    '—'
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-7"
                                                        onClick={() => loadSeguimiento(seguimiento)}
                                                        title="Editar seguimiento"
                                                    >
                                                        <Pencil className={`size-3.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                        disabled={deletingId === seguimiento.id}
                                                        onClick={() => {
                                                            if (confirm('¿Estás seguro de que deseas eliminar este seguimiento?')) {
                                                                setDeletingId(seguimiento.id);
                                                                router.delete(
                                                                    route('seguridad.examenes-medicos.recomendaciones.seguimientos.destroy', [
                                                                        evaluacionId,
                                                                        evaluacionRecomendacion.id,
                                                                        seguimiento.id,
                                                                    ]),
                                                                    {
                                                                        preserveScroll: true,
                                                                        preserveState: true,
                                                                        onSuccess: () => {
                                                                            setDeletingId(null);
                                                                            if (seguimientos.length <= 1) {
                                                                                setOpen(false);
                                                                            } else if (editingId === seguimiento.id) {
                                                                                prepareNew();
                                                                            }
                                                                        },
                                                                        onError: () => {
                                                                            setDeletingId(null);
                                                                        },
                                                                    }
                                                                );
                                                            }
                                                        }}
                                                        title="Eliminar seguimiento"
                                                    >
                                                        {deletingId === seguimiento.id ? (
                                                            <LoaderCircle className="size-3.5 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="size-3.5" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}

                <form onSubmit={submit} className="space-y-4 border-t border-sidebar-border/70 pt-4 dark:border-sidebar-border">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">
                            {editingId !== null ? (
                                <>
                                    <Pencil className="mr-1 inline size-3.5" />
                                    Editando seguimiento del {editingSeguimiento ? formatFecha(editingSeguimiento.fecha_seguimiento) : ''}
                                </>
                            ) : (
                                'Nuevo seguimiento'
                            )}
                        </p>
                        {editingId !== null && (
                            <Button type="button" size="sm" variant="ghost" onClick={prepareNew}>
                                <Plus className="size-3.5" />
                                Nuevo
                            </Button>
                        )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                        <div className="grid gap-2">
                            <Label htmlFor="fecha_seguimiento">Fecha de seguimiento</Label>
                            <Input
                                id="fecha_seguimiento"
                                type="date"
                                value={data.fecha_seguimiento}
                                onChange={(e) => setData('fecha_seguimiento', e.target.value)}
                                disabled={processing}
                            />
                            <InputError message={errors.fecha_seguimiento} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="estado_seguimiento">Estado</Label>
                            <Select
                                value={data.estado_seguimiento}
                                onValueChange={(value) => setData('estado_seguimiento', value)}
                                disabled={processing}
                            >
                                <SelectTrigger id="estado_seguimiento">
                                    <SelectValue placeholder="Selecciona el estado" />
                                </SelectTrigger>
                                <SelectContent>
                                    {estados.map((estado) => (
                                        <SelectItem key={estado} value={estado}>
                                            {estado}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={errors.estado_seguimiento} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="fecha_proximo_seguimiento">Próximo seguimiento (opcional)</Label>
                            <Input
                                id="fecha_proximo_seguimiento"
                                type="date"
                                value={data.fecha_proximo_seguimiento}
                                onChange={(e) => setData('fecha_proximo_seguimiento', e.target.value)}
                                disabled={processing}
                            />
                            <InputError message={errors.fecha_proximo_seguimiento} />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 py-1">
                        <input
                            id="carta_recomendacion_entregada"
                            type="checkbox"
                            checked={data.carta_recomendacion_entregada}
                            onChange={(e) => setData('carta_recomendacion_entregada', e.target.checked)}
                            disabled={processing}
                            className="size-4 rounded border-input"
                        />
                        <Label htmlFor="carta_recomendacion_entregada" className="font-normal cursor-pointer text-sm">
                            Se entregó carta de recomendación
                        </Label>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="seguimiento_observacion">Observación</Label>
                        <Textarea
                            id="seguimiento_observacion"
                            className="min-h-[90px]"
                            value={data.observacion}
                            onChange={(e) => setData('observacion', e.target.value)}
                            disabled={processing}
                        />
                        <InputError message={errors.observacion} />
                    </div>
                    <SimpleFileField
                        label={editingSoportePath
                            ? 'Soporte / Documentos adjuntos (subir nuevos archivos los agregará al registro)'
                            : 'Soporte (opcional)'}
                        files={data.soporte}
                        existing={getSoporteFiles(editingSoportePath)}
                        onRemoveExisting={handleRemoveExistingSoporte}
                        multiple={true}
                        onChange={(files) => setData('soporte', files)}
                        error={errors.soporte}
                        disabled={processing}
                    />
                    <DialogFooter>
                        <Button type="submit" disabled={processing || !data.fecha_seguimiento || !data.estado_seguimiento}>
                            {processing && <LoaderCircle className="size-4 animate-spin" />}
                            {editingId !== null ? 'Guardar cambios' : 'Registrar seguimiento'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}


// Componente principal: EvaluacionShow (Detalle y Edición)
// 

export default function EvaluacionShow({
    evaluacion,
    historialEvaluaciones = [],
    todasRecomendaciones = [],
    conceptosAptitud = [],
    examenesCatalogo = [],
    recomendacionesCatalogo = [],
    categoriasRecomendacion = {},
    estadosSeguimiento = [],
    seguimientoOpciones = [],
    empresaDefault = 'Adenar',
}: {
    evaluacion: EvaluacionDetalle;
    historialEvaluaciones?: HistorialEvaluacionRow[];
    todasRecomendaciones?: EvaluacionRecomendacionRow[];
    conceptosAptitud?: { id: number; nombre: string }[];
    examenesCatalogo?: ExamenLigero[];
    recomendacionesCatalogo?: RecomendacionLigera[];
    categoriasRecomendacion?: Record<string, string>;
    estadosSeguimiento?: string[];
    seguimientoOpciones?: string[];
    empresaDefault?: string;
}) {
    const nombreColaborador = `${evaluacion.colaborador.nombres} ${evaluacion.colaborador.apellidos}`;
    const [pdfPreview, setPdfPreview] = useState<PdfPreview | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Seguridad', href: '/modules/seguridad' },
        { title: 'Exámenes Médicos', href: '/modules/seguridad/examenes-medicos' },
        { title: nombreColaborador, href: `/modules/seguridad/examenes-medicos/${evaluacion.id}` },
    ];

    const examenesUsadosIds = new Set(evaluacion.examenes.map((e) => e.examen.id));
    const opcionesAdicionales = examenesCatalogo.filter((examen) => !examenesUsadosIds.has(examen.id));

    // Usar todas las recomendaciones del colaborador en lugar de solo las de esta evaluación
    const recomendacionesUsadasIds = new Set(todasRecomendaciones.map((r) => r.recomendacion.id));
    const opcionesRecomendaciones = recomendacionesCatalogo.filter((r) => !recomendacionesUsadasIds.has(r.id));

    const tieneExamenes = evaluacion.examenes.length > 0;
    const sinIniciar = evaluacion.estado === 'sin_iniciar';

    const tipoTituloPrincipal =
        evaluacion.tipo_evaluacion === 'ingreso'
            ? 'EXAMEN DE INGRESO'
            : evaluacion.tipo_evaluacion === 'egreso'
              ? 'EXAMEN DE EGRESO'
              : `EXAMEN PERIÓDICO${evaluacion.numero_periodo ? ` #${evaluacion.numero_periodo}` : ''}`;

    const tipoBadgeStyle =
        evaluacion.tipo_evaluacion === 'ingreso'
            ? 'bg-emerald-600 text-white dark:bg-emerald-700'
            : evaluacion.tipo_evaluacion === 'egreso'
              ? 'bg-rose-600 text-white dark:bg-rose-700'
              : 'bg-indigo-600 text-white dark:bg-indigo-700';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${tipoTituloPrincipal} — ${nombreColaborador}`} />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                {/* Banner destacado: Tipo de evaluación médica                */}
                {/* ========================================================= */}
                <div className="rounded-xl border border-sidebar-border bg-card p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <span className={`rounded-md px-3 py-1 text-xs sm:text-sm font-bold tracking-wider uppercase ${tipoBadgeStyle}`}>
                                    {tipoTituloPrincipal}
                                </span>
                                <Badge variant={ESTADO_VARIANT[evaluacion.estado] ?? 'secondary'} className="text-xs px-2.5 py-0.5">
                                    {ESTADO_LABELS[evaluacion.estado] ?? evaluacion.estado}
                                </Badge>
                            </div>
                            <h1 className="text-xl font-bold tracking-tight text-foreground">
                                {nombreColaborador}
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                {evaluacion.colaborador.cargo ? `${evaluacion.colaborador.cargo} · ` : ''}C.C: {evaluacion.colaborador.cedula} · Fecha de evaluación: {formatFecha(evaluacion.fecha_evaluacion)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 1. Datos del colaborador                                     */}
                {/* ========================================================= */}
                <SeccionCard icon={User} titulo="Datos del colaborador" tono="verde">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">C.C</p>
                            <p className="text-sm text-foreground">{evaluacion.colaborador.cedula}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Cargo</p>
                            <p className="text-sm text-foreground">{evaluacion.colaborador.cargo ?? '—'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">CD</p>
                            <p className="text-sm text-foreground">{evaluacion.colaborador.centro ?? '—'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Área</p>
                            <p className="text-sm text-foreground">{evaluacion.colaborador.area ?? '—'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Fecha de ingreso</p>
                            <p className="text-sm text-foreground">
                                {formatFecha(evaluacion.colaborador.fecha_ingreso_empresa)}
                            </p>
                        </div>
                        {evaluacion.proximo_examen_fecha && (
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Próximo examen (Periódico)</p>
                                <p className="text-sm text-foreground">
                                    {formatFecha(evaluacion.proximo_examen_fecha)}
                                </p>
                            </div>
                        )}
                    </div>
                </SeccionCard>

                {/* 2. Exámenes requeridos (Inmediatamente después de Datos)      */}
                {/* ========================================================= */}
                <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <p className="text-sm font-semibold text-foreground">Exámenes requeridos para esta evaluación</p>
                            <p className="text-xs text-muted-foreground">
                                {tieneExamenes
                                    ? 'Todos los exámenes se toman en la misma jornada médica.'
                                    : 'Esta evaluación no tiene exámenes cargados.'}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Botón Iniciar: visible si no hay exámenes */}
                            {!tieneExamenes && <IniciarEvaluacionButton evaluacionId={evaluacion.id} />}
                            {/* Botón único Programar exámenes */}
                            {tieneExamenes && (
                                <ProgramarTodosDialog
                                    evaluacionId={evaluacion.id}
                                    disabled={evaluacion.examenes.every((e) => e.estado === 'realizado')}
                                />
                            )}
                            {/* Botón único Registrar ejecución */}
                            {tieneExamenes && (
                                <EjecutarTodosDialog
                                    evaluacionId={evaluacion.id}
                                    disabled={evaluacion.examenes.every((e) => e.estado === 'realizado')}
                                />
                            )}
                            {/* Agregar adicional: solo si ya hay exámenes y hay opciones disponibles */}
                            {tieneExamenes && opcionesAdicionales.length > 0 && (
                                <AgregarAdicionalDialog evaluacionId={evaluacion.id} opciones={opcionesAdicionales} />
                            )}
                        </div>
                    </div>
                    <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Examen</TableHead>
                                    <TableHead>Origen</TableHead>
                                    <TableHead>Obligatorio</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Programación</TableHead>
                                    <TableHead>Ejecución</TableHead>
                                    <TableHead className="text-right">Soporte</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!tieneExamenes && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-muted-foreground py-6 text-center">
                                            {sinIniciar
                                                ? 'La evaluación aún no ha sido iniciada. Pulsa "Iniciar evaluación" para cargar los exámenes de la matriz.'
                                                : 'Esta evaluación no tiene exámenes — no hay matriz definida para este cargo y tipo de evaluación.'}
                                        </TableCell>
                                    </TableRow>
                                )}
                                {evaluacion.examenes.map((examenEvaluacion) => (
                                    <TableRow key={examenEvaluacion.id}>
                                        <TableCell className="font-medium">{examenEvaluacion.examen.nombre}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{examenEvaluacion.origen === 'matriz' ? 'Matriz' : 'Adicional'}</Badge>
                                        </TableCell>
                                        <TableCell>{examenEvaluacion.obligatorio ? 'Sí' : 'No'}</TableCell>
                                        <TableCell>
                                            <Badge variant={examenEvaluacion.estado === 'realizado' ? 'default' : 'secondary'}>
                                                {ESTADO_EXAMEN_LABELS[examenEvaluacion.estado]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {formatFecha(examenEvaluacion.fecha_programacion)}
                                        </TableCell>
                                        <TableCell>
                                            {formatFecha(examenEvaluacion.fecha_ejecucion)}
                                            {(examenEvaluacion.fecha_ingreso_pdf || examenEvaluacion.hora_ingreso_pdf) && (
                                                <p className="text-xs text-muted-foreground">
                                                    PDF: {formatFecha(examenEvaluacion.fecha_ingreso_pdf)}
                                                    {examenEvaluacion.hora_ingreso_pdf ? ` ${examenEvaluacion.hora_ingreso_pdf}` : ''}
                                                </p>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {examenEvaluacion.soporte_path ? (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setPdfPreview({
                                                            url: soporteUrl(examenEvaluacion.soporte_path!),
                                                            label: `Soporte — ${examenEvaluacion.examen.nombre}`,
                                                        })
                                                    }
                                                    className="inline-flex items-center gap-1 text-primary underline underline-offset-4"
                                                >
                                                    <FileText className="size-3.5" />
                                                    Ver PDF
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

                {/* 3. Concepto de aptitud + Recomendaciones                    */}
                {/* ========================================================= */}
                <SeccionCard icon={Stethoscope} titulo="Concepto de aptitud y recomendaciones" tono="azul">
                    <ConceptoAptitudForm
                        evaluacion={evaluacion}
                        conceptos={conceptosAptitud}
                        empresaDefault={empresaDefault}
                    />

                    {/* Subsección: Recomendaciones asignadas */}
                    <div className="space-y-4 pt-6 border-t border-sidebar-border/70 dark:border-sidebar-border mt-6">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">Recomendaciones asignadas</p>
                            {opcionesRecomendaciones.length > 0 && (
                                <AgregarRecomendacionDialog
                                    evaluacionId={evaluacion.id}
                                    opciones={opcionesRecomendaciones}
                                    categorias={categoriasRecomendacion}
                                />
                            )}
                        </div>

                        <div className="rounded-lg border border-sidebar-border/70 dark:border-sidebar-border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Recomendación</TableHead>
                                        <TableHead>Categoría</TableHead>
                                        <TableHead>Origen</TableHead>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Observación</TableHead>
                                        <TableHead>Vigente</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {todasRecomendaciones.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-muted-foreground py-6 text-center">
                                                Este colaborador no tiene recomendaciones registradas todavía.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {todasRecomendaciones.map((evaluacionRecomendacion) => (
                                        <TableRow key={evaluacionRecomendacion.id}>
                                            <TableCell className="font-medium">{evaluacionRecomendacion.recomendacion.nombre}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">
                                                    {categoriasRecomendacion[evaluacionRecomendacion.recomendacion.categoria] ??
                                                        evaluacionRecomendacion.recomendacion.categoria}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="text-xs">
                                                    {evaluacionRecomendacion.origen_evaluacion ?? '—'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {(() => {
                                                    const lastSeg = evaluacionRecomendacion.seguimientos && evaluacionRecomendacion.seguimientos.length > 0
                                                        ? evaluacionRecomendacion.seguimientos[evaluacionRecomendacion.seguimientos.length - 1]
                                                        : null;
                                                    return formatFecha(lastSeg?.fecha_seguimiento || evaluacionRecomendacion.fecha_origen);
                                                })()}
                                            </TableCell>
                                            <TableCell className="max-w-64 text-sm text-muted-foreground">
                                                {(() => {
                                                    const lastSeg = evaluacionRecomendacion.seguimientos && evaluacionRecomendacion.seguimientos.length > 0
                                                        ? evaluacionRecomendacion.seguimientos[evaluacionRecomendacion.seguimientos.length - 1]
                                                        : null;
                                                    return (lastSeg ? lastSeg.observacion : evaluacionRecomendacion.observacion) || '—';
                                                })()}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={evaluacionRecomendacion.activa ? 'default' : 'secondary'}>
                                                    {evaluacionRecomendacion.activa ? 'Vigente' : 'No vigente'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <SeguimientosDialog
                                                        key={`seguimientos-${evaluacionRecomendacion.id}`}
                                                        evaluacionId={evaluacion.id}
                                                        evaluacionRecomendacion={evaluacionRecomendacion}
                                                        estados={estadosSeguimiento}
                                                        categorias={categoriasRecomendacion}
                                                    />
                                                    <ToggleActivaButton 
                                                        evaluacionId={evaluacion.id} 
                                                        evaluacionRecomendacion={evaluacionRecomendacion} 
                                                    />
                                                    <EliminarRecomendacionButton 
                                                        evaluacionId={evaluacion.id} 
                                                        evaluacionRecomendacion={evaluacionRecomendacion} 
                                                    />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </SeccionCard>

                {/* 4. Historial completo de evaluaciones y exámenes            */}
                {/* ========================================================= */}
                <SeccionCard icon={History} titulo={`Historial médico de ${nombreColaborador}`} tono="azul">
                    <div className="space-y-4">
                        <p className="text-xs text-muted-foreground">
                            Historial cronológico de todas las evaluaciones médicas (ingreso, periódicos, egreso) y exámenes realizados al colaborador.
                        </p>

                        {historialEvaluaciones.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                                No hay evaluaciones previas registradas.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {historialEvaluaciones.map((historial) => {
                                    const esActual = historial.id === evaluacion.id;
                                    const tituloTipo =
                                        historial.tipo_evaluacion === 'periodico'
                                            ? `Examen Periódico ${historial.numero_periodo ? `#${historial.numero_periodo}` : ''}`
                                            : historial.tipo_evaluacion === 'ingreso'
                                              ? 'Examen de Ingreso'
                                              : 'Examen de Egreso';

                                    const totalExamenes = historial.examenes?.length ?? 0;
                                    const realizados = historial.examenes?.filter((e) => e.estado === 'realizado').length ?? 0;
                                    const cicloTexto = historial.ciclo_numero ? `Ciclo ${historial.ciclo_numero}` : null;

                                    return (
                                        <div
                                            key={historial.id}
                                            className={`rounded-lg border p-4 transition-colors ${
                                                esActual
                                                    ? 'border-primary/50 bg-primary/5 dark:bg-primary/10'
                                                    : 'border-sidebar-border/70 bg-card dark:border-sidebar-border'
                                            }`}
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sidebar-border/50 pb-3">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                      <span className="font-semibold text-foreground">{tituloTipo}</span>
                                                    {cicloTexto && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            {cicloTexto}
                                                        </Badge>
                                                    )}
                                                    {esActual && (
                                                        <Badge variant="outline" className="border-primary text-primary text-xs">
                                                            Evaluación actual
                                                        </Badge>
                                                    )}
                                                    <Badge variant={ESTADO_VARIANT[historial.estado] ?? 'secondary'}>
                                                        {ESTADO_LABELS[historial.estado] ?? historial.estado}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                    <span>
                                                        Fecha: {formatFecha(historial.fecha_evaluacion)}
                                                    </span>
                                                    {!esActual && (
                                                        <Button variant="ghost" size="sm" asChild className="h-7 text-xs text-primary">
                                                            <a href={route('seguridad.examenes-medicos.show', historial.id)}>
                                                                Ver detalles
                                                            </a>
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                                                <div>
                                                    <span className="text-muted-foreground">Concepto de aptitud:</span>
                                                    <p className="font-medium text-foreground">
                                                        {historial.concepto_aptitud?.nombre ?? 'Sin definir'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Emite:</span>
                                                    <p className="font-medium text-foreground">{historial.emite || '—'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Próximo examen periódico:</span>
                                                    <p className="font-medium text-foreground">
                                                        {formatFecha(historial.proximo_examen_fecha)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Progreso de exámenes:</span>
                                                    <div className="font-medium text-foreground">
                                                        {totalExamenes === 0 ? (
                                                            <span className="text-amber-600 dark:text-amber-400">
                                                                Pendiente de generación
                                                            </span>
                                                        ) : (
                                                            <span>
                                                                {realizados} de {totalExamenes} realizados
                                                                {realizados === totalExamenes && totalExamenes > 0 && (
                                                                    <CheckCircle2 className="inline size-3.5 text-emerald-600 dark:text-emerald-400 ml-1.5" />
                                                                )}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Desglose de los exámenes de esta evaluación */}
                                            {totalExamenes > 0 ? (
                                                <div className="mt-3 rounded-md bg-muted/40 p-3">
                                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Exámenes asignados:</p>
                                                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                                        {historial.examenes.map((ex) => (
                                                            <div
                                                                key={ex.id}
                                                                className="flex items-center justify-between rounded border border-sidebar-border/60 bg-background/80 px-2.5 py-1.5 text-xs"
                                                            >
                                                                <div className="flex items-center gap-1.5 truncate">
                                                                    {ex.estado === 'realizado' ? (
                                                                        <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                                                                    ) : (
                                                                        <CalendarClock className="size-3.5 text-amber-500 shrink-0" />
                                                                    )}
                                                                    <span className="font-medium truncate">{ex.examen.nombre}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                                                    <span className="text-muted-foreground text-[11px]">
                                                                        {ex.estado === 'realizado' && ex.fecha_ejecucion
                                                                            ? formatFecha(ex.fecha_ejecucion)
                                                                            : ESTADO_EXAMEN_LABELS[ex.estado]}
                                                                    </span>
                                                                    {ex.soporte_path && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                setPdfPreview({
                                                                                    url: soporteUrl(ex.soporte_path!),
                                                                                    label: `Soporte — ${ex.examen.nombre}`,
                                                                                })
                                                                            }
                                                                            className="text-primary hover:underline text-[11px]"
                                                                        >
                                                                            PDF
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="mt-2 text-xs italic text-muted-foreground">
                                                    Esta evaluación no tiene exámenes generados aún. Se cargarán automáticamente desde la matriz al iniciar la evaluación.
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </SeccionCard>
            </div>

            {/* Modal PDF */}
            <PdfPreviewDialog preview={pdfPreview} onClose={() => setPdfPreview(null)} />
        </AppLayout>
    );
}
