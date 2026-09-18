import InputError from '@/components/input-error';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SeccionCard } from '@/pages/seguridad/colaboradores/colaborador-form-fields';
import { CalendarClock, Camera, Cpu, Gauge, X } from 'lucide-react';
import { useRef, useState } from 'react';

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
    [key: string]: string | File | File[] | number[] | null;
}

const ESTADOS = ['Disponible', 'En uso', 'En mantenimiento', 'Fuera de servicio'];

interface DispositivoFormFieldsProps {
    data: DispositivoFormData;
    setData: <K extends keyof DispositivoFormData>(key: K, value: DispositivoFormData[K]) => void;
    errors: Partial<Record<keyof DispositivoFormData, string>>;
    processing: boolean;
    savedImagenes?: string[];
}

export function DispositivoFormFields({
    data,
    setData,
    errors,
    processing,
    savedImagenes = [],
}: DispositivoFormFieldsProps) {
    const imagenesInputRef = useRef<HTMLInputElement>(null);
    const [filesImagenes, setFilesImagenes] = useState<{ file: File; preview: string }[]>([]);
    const [deletedIndices, setDeletedIndices] = useState<number[]>([]);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);

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
