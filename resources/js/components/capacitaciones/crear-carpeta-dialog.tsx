import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { router, useForm } from '@inertiajs/react';
import {
    Eye,
    EyeOff,
    FolderPlus,
    ImagePlus,
    LoaderCircle,
    Palette,
    X,
} from 'lucide-react';
import { FormEventHandler, useEffect, useState } from 'react';

interface CarpetaData {
    id?: number;
    nombre: string;
    descripcion?: string | null;
    color?: string | null;
    portada_url?: string | null;
    visible_colaborador?: boolean;
}

const PRESET_COLORS = [
    '#0D9488', // Teal
    '#3F7A22', // Green SST
    '#2563EB', // Blue
    '#D97706', // Amber
    '#DC2626', // Red
    '#7C3AED', // Purple
    '#DB2777', // Pink
    '#4B5563', // Slate
];

export function CrearCarpetaDialog({
    open,
    onOpenChange,
    carpetaEditar,
    parentId,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    carpetaEditar?: CarpetaData | null;
    parentId?: number | null;
}) {
    const esEdicion = !!carpetaEditar?.id;
    const [previewUrl, setPreviewUrl] = useState<string | null>(carpetaEditar?.portada_url || null);

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm<{
        parent_id?: number | null;
        nombre: string;
        descripcion: string;
        color: string;
        visible_colaborador: boolean;
        portada: File | null;
        _method?: string;
    }>({
        parent_id: parentId || null,
        nombre: carpetaEditar?.nombre || '',
        descripcion: carpetaEditar?.descripcion || '',
        color: carpetaEditar?.color || '#0D9488',
        visible_colaborador: carpetaEditar?.visible_colaborador ?? true,
        portada: null,
    });

    useEffect(() => {
        if (open) {
            setData({
                parent_id: parentId || null,
                nombre: carpetaEditar?.nombre || '',
                descripcion: carpetaEditar?.descripcion || '',
                color: carpetaEditar?.color || '#0D9488',
                visible_colaborador: carpetaEditar?.visible_colaborador ?? true,
                portada: null,
            });
            setPreviewUrl(carpetaEditar?.portada_url || null);
            clearErrors();
        } else {
            reset();
            setPreviewUrl(null);
        }
    }, [open, carpetaEditar, parentId]);

    const handleImageChange = (file: File | null) => {
        setData('portada', file);
        if (file) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        } else {
            setPreviewUrl(carpetaEditar?.portada_url || null);
        }
    };

    const handleSubmit: FormEventHandler = (e) => {
        e.preventDefault();
        if (esEdicion && carpetaEditar?.id) {
            router.post(
                route('capacitaciones.carpetas.update', carpetaEditar.id),
                {
                    ...data,
                    _method: 'PUT',
                },
                {
                    preserveScroll: true,
                    forceFormData: true,
                    onSuccess: () => onOpenChange(false),
                }
            );
        } else {
            post(route('capacitaciones.carpetas.store'), {
                preserveScroll: true,
                forceFormData: true,
                onSuccess: () => onOpenChange(false),
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FolderPlus className="size-5 text-teal-600 dark:text-teal-400" />
                            {esEdicion ? 'Editar Carpeta' : 'Nueva Carpeta de Capacitación'}
                        </DialogTitle>
                        <DialogDescription>
                            {esEdicion
                                ? 'Modifica el nombre, descripción, color o foto de portada.'
                                : 'Crea una carpeta temática para organizar y estructurar los materiales.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Foto de Portada */}
                        <div className="grid gap-2">
                            <Label className="flex items-center gap-1.5">
                                <ImagePlus className="size-4 text-muted-foreground" /> Foto de Portada (Opcional)
                            </Label>
                            {previewUrl ? (
                                <div className="relative rounded-xl overflow-hidden border border-sidebar-border h-36 bg-muted group">
                                    <img
                                        src={previewUrl}
                                        alt="Portada previa"
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <Button type="button" size="sm" variant="outline" asChild>
                                            <label htmlFor="portada-cambiar-input" className="cursor-pointer">
                                                Cambiar imagen
                                            </label>
                                        </Button>
                                        <input
                                            id="portada-cambiar-input"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
                                        />
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="destructive"
                                            className="size-7"
                                            onClick={() => {
                                                setData('portada', null);
                                                setPreviewUrl(null);
                                            }}
                                        >
                                            <X className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <label className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 p-4 text-center cursor-pointer hover:border-teal-500/50 transition-colors bg-muted/20">
                                    <ImagePlus className="size-7 text-muted-foreground mb-1" />
                                    <span className="text-xs font-medium text-foreground">
                                        Subir foto de portada para la carpeta
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">PNG, JPG, WebP hasta 10MB</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
                                    />
                                </label>
                            )}
                            {errors.portada && <p className="text-xs text-destructive">{errors.portada}</p>}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="nombre">Nombre de la carpeta *</Label>
                            <Input
                                id="nombre"
                                placeholder="Ej: Seguridad SST, Inducción, Emergencias..."
                                value={data.nombre}
                                onChange={(e) => setData('nombre', e.target.value)}
                                autoFocus
                                required
                            />
                            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre}</p>}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="descripcion">Descripción (opcional)</Label>
                            <Textarea
                                id="descripcion"
                                placeholder="Breve resumen del contenido que albergará esta carpeta..."
                                value={data.descripcion}
                                onChange={(e) => setData('descripcion', e.target.value)}
                                rows={2}
                            />
                            {errors.descripcion && <p className="text-xs text-destructive">{errors.descripcion}</p>}
                        </div>

                        <div className="grid gap-2">
                            <Label className="flex items-center gap-1.5">
                                <Palette className="size-4 text-muted-foreground" /> Color distintivo
                            </Label>
                            <div className="flex flex-wrap items-center gap-2">
                                {PRESET_COLORS.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        aria-label={`Color ${c}`}
                                        aria-pressed={data.color === c}
                                        className={`size-7 rounded-full transition-transform focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                                            data.color === c ? 'scale-110 ring-2 ring-foreground ring-offset-2' : 'hover:scale-105'
                                        }`}
                                        style={{ backgroundColor: c }}
                                        onClick={() => setData('color', c)}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Configuración de Visibilidad para Colaboradores */}
                        <div className="grid gap-2 pt-2 border-t">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="visible_colaborador" className="flex items-center gap-1.5 cursor-pointer font-medium text-xs text-foreground">
                                    {data.visible_colaborador ? (
                                        <Eye className="size-4 text-teal-600 dark:text-teal-400" />
                                    ) : (
                                        <EyeOff className="size-4" style={{ color: '#d03b3b' }} />
                                    )}
                                    <span>Visibilidad para Colaboradores</span>
                                </Label>
                                <Checkbox
                                    id="visible_colaborador"
                                    checked={data.visible_colaborador}
                                    onCheckedChange={(checked) => setData('visible_colaborador', checked === true)}
                                />
                            </div>
                            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                                {data.visible_colaborador ? (
                                    <>
                                        <Eye className="mt-0.5 size-3 shrink-0 text-[#15803d]" />
                                        <span>Esta carpeta estará visible para el personal en su portal de capacitaciones.</span>
                                    </>
                                ) : (
                                    <>
                                        <EyeOff className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                                        <span>Esta carpeta estará oculta para los colaboradores (solo visible para administradores).</span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={processing || !data.nombre.trim()}>
                            {processing && <LoaderCircle className="mr-2 size-4 animate-spin" />}
                            {esEdicion ? 'Guardar Cambios' : 'Crear Carpeta'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
