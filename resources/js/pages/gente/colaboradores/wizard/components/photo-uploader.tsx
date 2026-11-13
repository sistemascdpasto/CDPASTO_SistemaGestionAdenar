import InputError from '@/components/input-error';
import { Plus } from 'lucide-react';
import { useRef, useState } from 'react';

interface PhotoUploaderProps {
    file: File | null;
    existingPath: string | null;
    onChange: (file: File | null) => void;
    error?: string;
    disabled?: boolean;
}

export function PhotoUploader({ file, existingPath, onChange, error, disabled }: PhotoUploaderProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(() => {
        return file instanceof File ? URL.createObjectURL(file) : null;
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nuevo = e.target.files?.[0];
        if (nuevo) {
            setPreview(URL.createObjectURL(nuevo));
            onChange(nuevo);
        }
        if (inputRef.current) inputRef.current.value = '';
    };

    const imagenActual = preview ?? (existingPath ? (existingPath.startsWith('http') || existingPath.startsWith('/') ? existingPath : `/storage/${existingPath}`) : null);

    return (
        <div className="mx-auto flex max-w-[200px] flex-col items-center gap-3">
            <input ref={inputRef} id="wizard-foto-input" type="file" accept="image/*" className="hidden" onChange={handleChange} disabled={disabled} />

            {/* Sin imagen: mostrar círculo con botón subir */}
            {!imagenActual && (
                <div className="relative aspect-square w-full max-w-[160px] overflow-hidden rounded-full border-2 border-dashed border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/25 dark:bg-emerald-500/5">
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={disabled}
                        className="flex h-full w-full flex-col items-center justify-center gap-2 text-emerald-700/70 transition-colors hover:text-emerald-700 dark:text-emerald-300/70"
                    >
                        <div className="flex size-11 items-center justify-center rounded-full bg-white shadow-sm dark:bg-emerald-500/10">
                            <Plus className="size-5" />
                        </div>
                        <span className="text-xs font-medium">Subir foto</span>
                    </button>
                </div>
            )}

            {/* Con imagen: los controles están en la foto del encabezado */}
            <InputError message={error} />
        </div>
    );
}
