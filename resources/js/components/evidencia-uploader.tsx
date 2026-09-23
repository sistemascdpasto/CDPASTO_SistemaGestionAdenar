import { CameraCaptureDialog } from '@/components/camera-capture-dialog';
import InputError from '@/components/input-error';
import { Label } from '@/components/ui/label';
import { Camera, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';

export interface PickedFile {
    file: File;
    preview: string;
    [key: string]: File | string;
}

/**
 * Grilla de miniaturas para tomar/subir evidencia fotográfica antes de
 * guardar (sin modo "editar ya guardadas" — para eso ver el patrón más
 * completo en seguridad/pruebas/create.tsx).
 */
export function EvidenciaUploader({
    files,
    onChange,
    error,
    label = 'Evidencia fotográfica',
}: {
    files: PickedFile[];
    onChange: (files: PickedFile[]) => void;
    error?: string;
    label?: string;
}) {
    const inputId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [camaraAbierta, setCamaraAbierta] = useState(false);

    const agregarArchivos = (nuevos: File[]) => {
        if (nuevos.length === 0) return;
        onChange([...files, ...nuevos.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
    };

    const onAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
        agregarArchivos(Array.from(e.target.files ?? []));
        e.target.value = '';
    };

    const removeFile = (index: number) => {
        onChange(files.filter((_, i) => i !== index));
    };

    return (
        <div className="grid gap-2">
            <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
            <input ref={inputRef} id={inputId} type="file" accept="image/*" multiple className="hidden" onChange={onAdd} />
            <InputError message={error} />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {files.map((item, index) => (
                    <div key={index} className="group relative">
                        <img src={item.preview} alt={`Evidencia ${index + 1}`} className="h-20 w-full rounded-lg border border-sky-300 object-cover dark:border-sky-500/40" />
                        <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
                            aria-label="Quitar foto"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="border-border text-muted-foreground hover:border-primary hover:text-primary flex h-20 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors"
                >
                    <span className="text-xl leading-none font-light">+</span>
                    <span className="mt-1 text-[10px]">Subir</span>
                </button>
                <button
                    type="button"
                    onClick={() => setCamaraAbierta(true)}
                    className="border-border text-muted-foreground hover:border-primary hover:text-primary flex h-20 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors"
                >
                    <Camera className="size-5" />
                    <span className="mt-1 text-[10px]">Foto</span>
                </button>
            </div>
            <CameraCaptureDialog open={camaraAbierta} onOpenChange={setCamaraAbierta} onCapture={(file) => agregarArchivos([file])} titulo={label} />
        </div>
    );
}
