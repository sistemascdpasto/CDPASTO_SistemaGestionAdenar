import InputError from '@/components/input-error';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SeccionCard } from '@/pages/seguridad/colaboradores/colaborador-form-fields';
import { CalendarClock, Camera, ClipboardList, Cpu, FileText, FileUp, Gauge, Plus, Wrench, X } from 'lucide-react';
import { useRef, useState } from 'react';

export interface MantenimientoNuevo {
    fecha: string;
    descripcion: string;
}

export interface MantenimientoGuardado {
    id: number;
    fecha: string;
    descripcion: string;
    realizado_por: string | null;
}

export interface DispositivoFormData {
    codigo: string;
    marca: string;
    modelo: string;
    fecha_calibracion: string;
    fecha_vencimiento_certificado: string;
    valor_min: string;
    valor_max: string;
    estado: string;
    imagenes: File[];
    deleted_imagenes_indices: number[];
    documentos: File[];
    deleted_documentos_indices: number[];
    mantenimientos: MantenimientoNuevo[];
    [key: string]: string | File | File[] | number[] | MantenimientoNuevo[] | null;
}

const ESTADOS = ['Disponible', 'En uso', 'En mantenimiento', 'Fuera de servicio'];

interface DispositivoFormFieldsProps {
    data: DispositivoFormData;
    setData: <K extends keyof DispositivoFormData>(key: K, value: DispositivoFormData[K]) => void;
    errors: Partial<Record<keyof DispositivoFormData, string>>;
    processing: boolean;
    savedImagenes?: string[];
    savedDocumentos?: { id: number; url: string; nombre_original: string }[];
    savedMantenimientos?: MantenimientoGuardado[];
}

export function DispositivoFormFields({
    data,
    setData,
    errors,
    processing,
    savedImagenes = [],
    savedDocumentos = [],
    savedMantenimientos = [],
}: DispositivoFormFieldsProps) {
    const imagenesInputRef = useRef<HTMLInputElement>(null);
    const documentosInputRef = useRef<HTMLInputElement>(null);
    const [filesImagenes, setFilesImagenes] = useState<{ file: File; preview: string }[]>([]);
    const [filesDocumentos, setFilesDocumentos] = useState<File[]>([]);
    const [deletedIndices, setDeletedIndices] = useState<number[]>([]);
    const [deletedDocIndices, setDeletedDocIndices] = useState<number[]>([]);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);

    // Estado local del formulario de nuevo mantenimiento
    const [mFecha, setMFecha] = useState('');
    const [mDescripcion, setMDescripcion] = useState('');

    const handleImagenesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newFiles = Array.from(e.target.files ?? []).map((file) => ({ file, preview: URL.createObjectURL(file) }));
        const updated = [...filesImagenes, ...newFiles];
        setFilesImagenes(updated);
        setData(
            'imagenes',
            updated.map((f) => f.file),
        );
        if (imagenesInputRef.current) imagenesInputRef.current.value = '';
    };

    const removeImagen = (index: number) => {
        const updated = filesImagenes.filter((_, i) => i !== index);
        setFilesImagenes(updated);
        setData(
            'imagenes',
            updated.map((f) => f.file),
        );
    };

    const handleDocumentosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newFiles = Array.from(e.target.files ?? []);
        const updated = [...filesDocumentos, ...newFiles];
        setFilesDocumentos(updated);
        setData('documentos', updated);
        if (documentosInputRef.current) documentosInputRef.current.value = '';
    };

    const removeDocumento = (index: number) => {
        const updated = filesDocumentos.filter((_, i) => i !== index);
        setFilesDocumentos(updated);
        setData('documentos', updated);
    };

    const removeSavedDocumento = (index: number) => {
        const updated = deletedDocIndices.includes(index)
            ? deletedDocIndices.filter((i) => i !== index)
            : [...deletedDocIndices, index];
        setDeletedDocIndices(updated);
        setData('deleted_documentos_indices', updated);
    };

    const agregarMantenimiento = () => {
        if (!mFecha || !mDescripcion.trim()) return;
        const updated: MantenimientoNuevo[] = [
            ...(data.mantenimientos as MantenimientoNuevo[]),
            { fecha: mFecha, descripcion: mDescripcion.trim() },
        ];
        setData('mantenimientos', updated);
        setMFecha('');
        setMDescripcion('');
    };

    const quitarMantenimiento = (index: number) => {
        const updated = (data.mantenimientos as MantenimientoNuevo[]).filter((_, i) => i !== index);
        setData('mantenimientos', updated);
    };

    const removeSavedImagen = (index: number) => {
        if (deletedIndices.includes(index)) {
            const updated = deletedIndices.filter((i) => i !== index);
            setDeletedIndices(updated);
            setData('deleted_imagenes_indices', updated);
        } else {
            setPendingDeleteIndex(index);
            setShowDeleteDialog(true);
        }
    };

    const confirmDelete = () => {
        if (pendingDeleteIndex !== null) {
            const updated = [...deletedIndices, pendingDeleteIndex];
            setDeletedIndices(updated);
            setData('deleted_imagenes_indices', updated);
        }
        setShowDeleteDialog(false);
        setPendingDeleteIndex(null);
    };

    return (
        <div className="grid gap-6">
            <SeccionCard icon={Cpu} titulo="Información del dispositivo" tono="verde">
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="grid gap-2">
                        <Label htmlFor="codigo">Código / Serial</Label>
                        <Input id="codigo" name="codigo" value={data.codigo} onChange={(e) => setData('codigo', e.target.value)} disabled={processing} required autoFocus />
                        <InputError message={errors.codigo} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="marca">Marca</Label>
                        <Input id="marca" name="marca" value={data.marca} onChange={(e) => setData('marca', e.target.value)} disabled={processing} />
                        <InputError message={errors.marca} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="modelo">Modelo</Label>
                        <Input id="modelo" name="modelo" value={data.modelo} onChange={(e) => setData('modelo', e.target.value)} disabled={processing} />
                        <InputError message={errors.modelo} />
                    </div>
                </div>
            </SeccionCard>

            <SeccionCard icon={CalendarClock} titulo="Calibración" tono="azul">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="fecha_calibracion">Fecha de calibración</Label>
                        <Input
                            id="fecha_calibracion"
                            name="fecha_calibracion"
                            type="date"
                            value={data.fecha_calibracion}
                            onChange={(e) => setData('fecha_calibracion', e.target.value)}
                            disabled={processing}
                        />
                        <InputError message={errors.fecha_calibracion} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="fecha_vencimiento_certificado">Vencimiento del certificado</Label>
                        <Input
                            id="fecha_vencimiento_certificado"
                            name="fecha_vencimiento_certificado"
                            type="date"
                            value={data.fecha_vencimiento_certificado}
                            onChange={(e) => setData('fecha_vencimiento_certificado', e.target.value)}
                            disabled={processing}
                        />
                        <InputError message={errors.fecha_vencimiento_certificado} />
                    </div>
                </div>
            </SeccionCard>

            <SeccionCard icon={Gauge} titulo="Rango de valores y estado" tono="verde">
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="grid gap-2">
                        <Label htmlFor="valor_min">Valor mínimo válido</Label>
                        <Input
                            id="valor_min"
                            name="valor_min"
                            type="number"
                            step="0.001"
                            value={data.valor_min}
                            onChange={(e) => setData('valor_min', e.target.value)}
                            disabled={processing}
                            required
                        />
                        <InputError message={errors.valor_min} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="valor_max">Valor máximo válido</Label>
                        <Input
                            id="valor_max"
                            name="valor_max"
                            type="number"
                            step="0.001"
                            value={data.valor_max}
                            onChange={(e) => setData('valor_max', e.target.value)}
                            disabled={processing}
                            required
                        />
                        <InputError message={errors.valor_max} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="estado">Estado</Label>
                        <Select value={data.estado} onValueChange={(value) => setData('estado', value)} disabled={processing}>
                            <SelectTrigger id="estado" aria-label="Estado">
                                <SelectValue placeholder="Selecciona un estado" />
                            </SelectTrigger>
                            <SelectContent>
                                {ESTADOS.map((estado) => (
                                    <SelectItem key={estado} value={estado}>
                                        {estado}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={errors.estado} />
                    </div>
                </div>
            </SeccionCard>

            <SeccionCard icon={Camera} titulo="Imágenes del dispositivo" subtitulo="Opcional" tono="verde">
                <input ref={imagenesInputRef} id="imagenes" name="imagenes[]" type="file" accept="image/*" multiple className="hidden" onChange={handleImagenesChange} />
                <InputError message={errors.imagenes} />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {savedImagenes.map((path, index) => (
                        <div
                            key={`saved-${index}`}
                            className={`group relative cursor-pointer transition-opacity ${deletedIndices.includes(index) ? 'opacity-50' : ''}`}
                        >
                            <img
                                src={path}
                                alt={`Imagen guardada ${index + 1}`}
                                className="h-24 w-full rounded-lg border-2 border-emerald-300 object-cover transition-transform group-hover:scale-105 dark:border-emerald-500/40"
                            />
                            <div className="absolute left-1 top-1 rounded-full bg-emerald-600 px-2 py-1 text-xs font-semibold text-white dark:bg-emerald-500">
                                Guardada
                            </div>
                            <button
                                type="button"
                                onClick={() => removeSavedImagen(index)}
                                className={`absolute right-1 top-1 flex size-5 items-center justify-center rounded-full shadow transition-colors ${
                                    deletedIndices.includes(index) ? 'bg-muted-foreground text-white' : 'bg-red-500 text-white hover:bg-red-600'
                                }`}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                    {filesImagenes.map((item, index) => (
                        <div key={`new-${index}`} className="group relative cursor-pointer">
                            <img
                                src={item.preview}
                                alt={`Nueva imagen ${index + 1}`}
                                className="h-24 w-full rounded-lg border-2 border-sky-300 object-cover transition-transform group-hover:scale-105 dark:border-sky-500/40"
                            />
                            <div className="absolute left-1 top-1 rounded-full bg-sky-600 px-2 py-1 text-xs font-semibold text-white dark:bg-sky-500">Nueva</div>
                            <button
                                type="button"
                                onClick={() => removeImagen(index)}
                                className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={() => imagenesInputRef.current?.click()}
                        className="flex h-24 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                        <span className="text-2xl font-light leading-none">+</span>
                        <span className="mt-1 text-xs">Agregar</span>
                    </button>
                </div>
            </SeccionCard>

            <SeccionCard icon={FileText} titulo="Documentos del dispositivo" subtitulo="PDF o Excel · Opcional" tono="azul">
                <input
                    ref={documentosInputRef}
                    id="documentos"
                    name="documentos[]"
                    type="file"
                    accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    multiple
                    className="hidden"
                    onChange={handleDocumentosChange}
                />
                <InputError message={errors.documentos} />

                <div className="flex flex-col gap-2">
                    {/* Documentos guardados en BD */}
                    {savedDocumentos.map((doc, index) => (
                        <div
                            key={`saved-doc-${index}`}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-opacity ${
                                deletedDocIndices.includes(index) ? 'opacity-40 line-through' : ''
                            }`}
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <FileText className="size-4 shrink-0 text-sky-500" />
                                <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="truncate font-medium text-foreground hover:underline"
                                >
                                    {doc.nombre_original}
                                </a>
                                <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                                    Guardado
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => removeSavedDocumento(index)}
                                title={deletedDocIndices.includes(index) ? 'Restaurar' : 'Marcar para eliminar'}
                                className={`ml-3 shrink-0 flex size-6 items-center justify-center rounded-full transition-colors ${
                                    deletedDocIndices.includes(index)
                                        ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                                        : 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                                }`}
                            >
                                <X className="size-3" />
                            </button>
                        </div>
                    ))}

                    {/* Documentos nuevos pendientes de guardar */}
                    {filesDocumentos.map((file, index) => (
                        <div
                            key={`new-doc-${index}`}
                            className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm dark:border-amber-800/40 dark:bg-amber-950/20"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <FileUp className="size-4 shrink-0 text-amber-500" />
                                <span className="truncate font-medium text-foreground">{file.name}</span>
                                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                    Nuevo
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => removeDocumento(index)}
                                className="ml-3 shrink-0 flex size-6 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 transition-colors"
                            >
                                <X className="size-3" />
                            </button>
                        </div>
                    ))}

                    {/* Botón agregar */}
                    <button
                        type="button"
                        onClick={() => documentosInputRef.current?.click()}
                        className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                        <FileUp className="size-4" />
                        Agregar documento (PDF, Excel)
                    </button>
                </div>
            </SeccionCard>

            {/* ── Mantenimientos ───────────────────────────────────────── */}
            <SeccionCard icon={Wrench} titulo="Mantenimientos" subtitulo="Se acumulan — se pueden registrar varios" tono="azul">
                <div className="flex flex-col gap-4">

                    {/* Historial ya guardado (solo lectura) */}
                    {savedMantenimientos.length > 0 && (
                        <div className="rounded-lg border border-border overflow-hidden">
                            <div className="bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <ClipboardList className="size-3.5" />
                                Historial guardado ({savedMantenimientos.length})
                            </div>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-28 text-xs">Fecha</TableHead>
                                        <TableHead className="text-xs">Descripción</TableHead>
                                        <TableHead className="w-36 text-xs">Registrado por</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {savedMantenimientos.map((m) => (
                                        <TableRow key={m.id}>
                                            <TableCell className="font-mono text-xs">{m.fecha}</TableCell>
                                            <TableCell className="text-sm whitespace-pre-wrap">{m.descripcion}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{m.realizado_por ?? '—'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Nuevos a agregar en este guardado */}
                    {(data.mantenimientos as MantenimientoNuevo[]).length > 0 && (
                        <div className="flex flex-col gap-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Nuevos en este guardado ({(data.mantenimientos as MantenimientoNuevo[]).length})
                            </p>
                            {(data.mantenimientos as MantenimientoNuevo[]).map((m, i) => (
                                <div
                                    key={i}
                                    className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm dark:border-amber-800/40 dark:bg-amber-950/20"
                                >
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                        <span className="font-mono text-xs text-muted-foreground">{m.fecha}</span>
                                        <span className="text-sm text-foreground whitespace-pre-wrap">{m.descripcion}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => quitarMantenimiento(i)}
                                        title="Quitar"
                                        className="mt-0.5 shrink-0 flex size-6 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 transition-colors"
                                    >
                                        <X className="size-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Formulario para agregar un mantenimiento más */}
                    <div className="grid gap-3 rounded-lg border border-dashed border-border p-3">
                        <p className="text-xs font-medium text-muted-foreground">Agregar mantenimiento</p>
                        <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto]">
                            <div className="grid gap-1">
                                <Label htmlFor="mant_fecha" className="text-xs">Fecha *</Label>
                                <Input
                                    id="mant_fecha"
                                    type="date"
                                    value={mFecha}
                                    onChange={(e) => setMFecha(e.target.value)}
                                    disabled={processing}
                                />
                            </div>
                            <div className="grid gap-1">
                                <Label htmlFor="mant_descripcion" className="text-xs">Descripción *</Label>
                                <textarea
                                    id="mant_descripcion"
                                    rows={2}
                                    placeholder="Describe el mantenimiento realizado…"
                                    value={mDescripcion}
                                    onChange={(e) => setMDescripcion(e.target.value)}
                                    disabled={processing}
                                    className="border-input bg-background flex min-h-[38px] w-full resize-none rounded-md border px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                                />
                            </div>
                            <div className="flex items-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={!mFecha || !mDescripcion.trim() || processing}
                                    onClick={agregarMantenimiento}
                                    className="gap-1.5 whitespace-nowrap"
                                >
                                    <Plus className="size-3.5" />
                                    Agregar
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </SeccionCard>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent className="border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-950">
                    <AlertDialogTitle className="text-red-900 dark:text-red-200">
                        Eliminar imagen
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-red-800 dark:text-red-300">
                        ¿Estás seguro de que deseas eliminar esta imagen del dispositivo? Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                    <div className="flex justify-end gap-3">
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600">
                            Eliminar
                        </AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
