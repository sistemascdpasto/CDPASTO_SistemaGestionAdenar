import InputError from '@/components/input-error';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, X } from 'lucide-react';
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
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nuevo = e.target.files?.[0];
        if (nuevo) {
            setPreview(URL.createObjectURL(nuevo));
            onChange(nuevo);
        }
        if (inputRef.current) inputRef.current.value = '';
    };

    const removeFoto = () => {
        setPreview(null);
        onChange(null);
        setShowDeleteDialog(false);
    };

    const imagenActual = preview ?? (existingPath ? (existingPath.startsWith('http') || existingPath.startsWith('/') ? existingPath : `/storage/${existingPath}`) : null);

    return (
        <div className="mx-auto flex max-w-[200px] flex-col items-center gap-3">
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} disabled={disabled} />
            <div className="group relative aspect-square w-full max-w-[160px] overflow-hidden rounded-full border-2 border-dashed border-emerald-200 bg-emerald-50/60 transition-colors hover:border-emerald-300 dark:border-emerald-500/25 dark:bg-emerald-500/5">
                {imagenActual ? (
                    <>
                        <img
                            src={imagenActual}
                            alt="Foto del colaborador"
                            className="h-full w-full object-cover cursor-pointer"
                            onClick={() => setShowPreview(true)}
                        />
                        <div
                            onClick={() => setShowPreview(true)}
                            className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/45 group-hover:opacity-100 cursor-pointer"
                            title="Ver fotografía"
                        >
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    inputRef.current?.click();
                                }}
                                disabled={disabled}
                                className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm"
                            >
                                Cambiar foto
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDeleteDialog(true);
                                }}
                                disabled={disabled}
                                className="rounded-full bg-white/95 p-2 text-red-600 shadow-sm"
                                aria-label="Eliminar imagen"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                    </>
                ) : (
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
                )}
            </div>
            <InputError message={error} />

            {/* Vista previa estandarizada de la fotografía sin fondo negro y con X para salir */}
            {showPreview && imagenActual && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-xs animate-in fade-in-0 duration-200"
                    onClick={() => setShowPreview(false)}
                >
                    <div
                        className="relative h-[380px] w-[320px] sm:h-[420px] sm:w-[350px] overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-2xl animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => setShowPreview(false)}
                            className="absolute top-4 right-4 z-20 flex size-8 items-center justify-center rounded-full bg-white/95 text-foreground shadow-md transition hover:bg-white hover:text-red-600 focus:outline-hidden dark:bg-zinc-800/90 dark:text-white"
                            aria-label="Cerrar fotografía"
                            title="Salir"
                        >
                            <X className="size-4" />
                        </button>
                        <img
                            src={imagenActual}
                            alt="Foto del colaborador"
                            className="h-full w-full rounded-xl object-cover"
                        />
                    </div>
                </div>
            )}

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent className="bg-red-50 border-red-200">
                    <AlertDialogTitle className="text-red-900">Eliminar imagen</AlertDialogTitle>
                    <AlertDialogDescription className="text-red-800">
                        ¿Estás seguro de que deseas eliminar esta imagen? Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                    <div className="flex justify-end gap-2 pt-4">
                        <AlertDialogCancel className="bg-muted text-foreground hover:bg-muted/80">Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={removeFoto} className="bg-red-500 text-white hover:bg-red-600">
                            Eliminar
                        </AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
