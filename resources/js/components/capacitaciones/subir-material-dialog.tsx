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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from '@inertiajs/react';
import {
    Calendar,
    FileSpreadsheet,
    FileText,
    FileType,
    FileUp,
    Globe,
    HardDriveUpload,
    Link2,
    LoaderCircle,
    Mail,
    Presentation,
    Star,
    UploadCloud,
    Video,
} from 'lucide-react';
import { FormEventHandler, useEffect, useState } from 'react';

interface MaterialData {
    id?: number;
    titulo: string;
    descripcion?: string | null;
    tipo?: string | null;
    enlace_externo?: string | null;
    destacada?: boolean;
    fecha_programada?: string | null;
}

export function SubirMaterialDialog({
    open,
    onOpenChange,
    carpetaId,
    materialEditar,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    carpetaId: number;
    materialEditar?: MaterialData | null;
}) {
    const esEdicion = !!materialEditar?.id;
    const [origen, setOrigen] = useState<'archivo' | 'enlace'>(
        materialEditar?.enlace_externo ? 'enlace' : 'archivo'
    );

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm<{
        titulo: string;
        descripcion: string;
        tipo: string;
        archivo: File | null;
        enlace_externo: string;
        destacada: boolean;
        fecha_programada: string;
    }>({
        titulo: materialEditar?.titulo || '',
        descripcion: materialEditar?.descripcion || '',
        tipo: materialEditar?.tipo || 'auto',
        archivo: null,
        enlace_externo: materialEditar?.enlace_externo || '',
        destacada: materialEditar?.destacada || false,
        fecha_programada: materialEditar?.fecha_programada || '',
    });

    useEffect(() => {
        if (open) {
            setData({
                titulo: materialEditar?.titulo || '',
                descripcion: materialEditar?.descripcion || '',
                tipo: materialEditar?.tipo || 'auto',
                archivo: null,
                enlace_externo: materialEditar?.enlace_externo || '',
                destacada: materialEditar?.destacada || false,
                fecha_programada: materialEditar?.fecha_programada || '',
            });
            setOrigen(materialEditar?.enlace_externo ? 'enlace' : 'archivo');
            clearErrors();
        } else {
            reset();
        }
    }, [open, materialEditar]);

    const handleSubmit: FormEventHandler = (e) => {
        e.preventDefault();

        if (esEdicion && materialEditar?.id) {
            put(route('capacitaciones.materiales.update', materialEditar.id), {
                preserveScroll: true,
                onSuccess: () => onOpenChange(false),
            });
        } else {
            post(route('capacitaciones.materiales.store', carpetaId), {
                preserveScroll: true,
                forceFormData: true,
                onSuccess: () => onOpenChange(false),
            });
        }
    };

    const handleFileChange = (file: File | null) => {
        setData((prev) => {
            const nuevoTitulo = prev.titulo.trim() === '' && file ? file.name.replace(/\.[^/.]+$/, '') : prev.titulo;
            return {
                ...prev,
                archivo: file,
                titulo: nuevoTitulo,
            };
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UploadCloud className="size-5 text-teal-600 dark:text-teal-400" />
                            {esEdicion ? 'Editar Material' : 'Subir Nuevo Material'}
                        </DialogTitle>
                        <DialogDescription>
                            {esEdicion
                                ? 'Actualiza los detalles del material de capacitación.'
                                : 'Adjunta un archivo o enlace e ingresa la fecha programada en el calendario.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {!esEdicion && (
                            <div className="flex rounded-lg border bg-muted/40 p-1">
                                <Button
                                    type="button"
                                    variant={origen === 'archivo' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setOrigen('archivo')}
                                    className="flex-1 gap-2 text-xs"
                                >
                                    <HardDriveUpload className="size-3.5" />
                                    Subir Archivo Local
                                </Button>
                                <Button
                                    type="button"
                                    variant={origen === 'enlace' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setOrigen('enlace')}
                                    className="flex-1 gap-2 text-xs"
                                >
                                    <Globe className="size-3.5" />
                                    Enlace / Video Externo
                                </Button>
                            </div>
                        )}

                        {!esEdicion && origen === 'archivo' && (
                            <div className="grid gap-2">
                                <Label htmlFor="archivo">Archivo *</Label>
                                <div className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-5 text-center transition-colors hover:border-teal-500/50">
                                    <FileUp className="mb-2 size-8 text-muted-foreground" />
                                    <p className="text-sm font-medium text-foreground">
                                        {data.archivo ? data.archivo.name : 'Haz clic o arrastra un archivo aquí'}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Videos (MP4), Presentaciones (PPTX), Documentos (PDF, DOCX), Hojas de cálculo (XLSX) hasta 100MB
                                    </p>
                                    <Input
                                        id="archivo"
                                        type="file"
                                        className="absolute inset-0 cursor-pointer opacity-0"
                                        onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                                        required={!esEdicion && origen === 'archivo'}
                                    />
                                </div>
                                {errors.archivo && <p className="text-xs text-destructive">{errors.archivo}</p>}
                            </div>
                        )}

                        {(esEdicion || origen === 'enlace') && (
                            <div className="grid gap-2">
                                <Label htmlFor="enlace_externo">Enlace web o URL de video</Label>
                                <Input
                                    id="enlace_externo"
                                    type="url"
                                    placeholder="https://youtube.com/... o https://drive.google.com/..."
                                    value={data.enlace_externo}
                                    onChange={(e) => setData('enlace_externo', e.target.value)}
                                    required={origen === 'enlace'}
                                />
                                {errors.enlace_externo && <p className="text-xs text-destructive">{errors.enlace_externo}</p>}
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label htmlFor="titulo">Título del material *</Label>
                            <Input
                                id="titulo"
                                placeholder="Ej: Uso correcto de EPP, Capacitación SST..."
                                value={data.titulo}
                                onChange={(e) => setData('titulo', e.target.value)}
                                required
                            />
                            {errors.titulo && <p className="text-xs text-destructive">{errors.titulo}</p>}
                        </div>

                        {/* FECHA PROGRAMADA DEL CALENDARIO CON ALERTA A CORREOS */}
                        <div className="grid gap-2 p-3 rounded-xl border border-teal-500/30 bg-teal-500/5">
                            <Label htmlFor="fecha_programada" className="flex items-center gap-1.5 font-bold text-teal-700 dark:text-teal-300">
                                <Calendar className="size-4" /> Fecha Programada del Calendario
                            </Label>
                            <Input
                                id="fecha_programada"
                                type="date"
                                value={data.fecha_programada}
                                onChange={(e) => setData('fecha_programada', e.target.value)}
                                className="bg-background"
                            />
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Mail className="size-3 text-teal-600 dark:text-teal-400" />
                                Al guardar una fecha, se enviará automáticamente un correo a los colaboradores indicando el mes programado.
                            </p>
                            {errors.fecha_programada && <p className="text-xs text-destructive">{errors.fecha_programada}</p>}
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="tipo">Tipo de recurso</Label>
                                <Select value={data.tipo} onValueChange={(val) => setData('tipo', val)}>
                                    <SelectTrigger id="tipo">
                                        <SelectValue placeholder="Seleccionar tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">Automático (Detectar)</SelectItem>
                                        <SelectItem value="video">
                                            <span className="flex items-center gap-2"><Video className="size-3.5" /> Video</span>
                                        </SelectItem>
                                        <SelectItem value="presentacion">
                                            <span className="flex items-center gap-2"><Presentation className="size-3.5" /> Presentación (PowerPoint)</span>
                                        </SelectItem>
                                        <SelectItem value="hoja_calculo">
                                            <span className="flex items-center gap-2"><FileSpreadsheet className="size-3.5" /> Hoja de cálculo (Excel)</span>
                                        </SelectItem>
                                        <SelectItem value="pdf">
                                            <span className="flex items-center gap-2"><FileText className="size-3.5" /> Documento PDF</span>
                                        </SelectItem>
                                        <SelectItem value="documento">
                                            <span className="flex items-center gap-2"><FileType className="size-3.5" /> Documento de texto</span>
                                        </SelectItem>
                                        <SelectItem value="enlace">
                                            <span className="flex items-center gap-2"><Link2 className="size-3.5" /> Enlace externo</span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-end">
                                <div className="flex items-center gap-2 border rounded-lg p-2.5 w-full hover:bg-muted/30">
                                    <Checkbox
                                        id="destacada"
                                        checked={data.destacada}
                                        onCheckedChange={(checked) => setData('destacada', checked === true)}
                                    />
                                    <Label htmlFor="destacada" className="text-xs font-semibold flex items-center gap-1 cursor-pointer">
                                        <Star className="size-3.5 text-amber-500 fill-amber-500" /> Destacar este recurso
                                    </Label>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="descripcion">Descripción (opcional)</Label>
                            <Textarea
                                id="descripcion"
                                placeholder="Detalla los puntos clave o instrucciones del material..."
                                value={data.descripcion}
                                onChange={(e) => setData('descripcion', e.target.value)}
                                rows={2}
                            />
                            {errors.descripcion && <p className="text-xs text-destructive">{errors.descripcion}</p>}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={processing || !data.titulo.trim()}>
                            {processing && <LoaderCircle className="mr-2 size-4 animate-spin" />}
                            {esEdicion ? 'Guardar Cambios' : 'Subir Material'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
