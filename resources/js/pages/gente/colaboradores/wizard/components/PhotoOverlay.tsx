import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { router } from '@inertiajs/react';
import { Loader2, Plus, X } from 'lucide-react';
import { useRef, useState } from 'react';

interface PhotoOverlayProps {
    colaboradorId?: number | null;
    fotoSrc: string | null;
    fotoAlt: string;
    onChange?: (file: File) => void;
    onDelete?: () => void;
}

export default function PhotoOverlay({
    colaboradorId,
    fotoSrc,
    fotoAlt,
    onChange,
    onDelete,
}: PhotoOverlayProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        onChange?.(file);

        if (colaboradorId) {
            setIsProcessing(true);
            router.post(
                route('gente.colaboradores.foto.update', colaboradorId),
                { imagen: file },
                {
                    forceFormData: true,
                    preserveScroll: true,
                    onFinish: () => {
                        setIsProcessing(false);
                        if (inputRef.current) inputRef.current.value = '';
                    },
                }
            );
        } else {
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    const handleConfirmDelete = () => {
        setConfirmDeleteOpen(false);
        onDelete?.();

        if (colaboradorId) {
            setIsProcessing(true);
            router.delete(
                route('gente.colaboradores.foto.destroy', colaboradorId),
                {
                    preserveScroll: true,
                    onFinish: () => {
                        setIsProcessing(false);
                    },
                }
            );
        }
    };

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isProcessing}
            />

            {fotoSrc ? (
                <>
                    <div
                        className="group relative shrink-0 h-32 w-32 cursor-pointer"
                        onClick={() => !isProcessing && setPreviewModalOpen(true)}
                    >
                        <img
                            src={fotoSrc}
                            alt={fotoAlt}
                            className="h-32 w-32 rounded-full object-cover"
                        />

                        {isProcessing ? (
                            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
                                <Loader2 className="size-6 animate-spin text-white" />
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-full bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/50 group-hover:opacity-100">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        inputRef.current?.click();
                                    }}
                                    className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-medium text-foreground shadow-sm hover:bg-white transition-colors"
                                >
                                    Cambiar
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteOpen(true);
                                    }}
                                    className="flex items-center justify-center rounded-full bg-white/95 p-1.5 text-red-600 shadow-sm hover:bg-white hover:text-red-700 transition-colors"
                                    aria-label="Eliminar foto"
                                >
                                    <X className="size-3.5" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Preview Modal */}
                    {previewModalOpen && (
                        <div
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                            onClick={() => setPreviewModalOpen(false)}
                        >
                            <div
                                className="relative h-[400px] w-[340px] overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    type="button"
                                    onClick={() => setPreviewModalOpen(false)}
                                    className="absolute top-3 right-3 z-20 flex size-8 items-center justify-center rounded-full bg-white/95 text-foreground shadow-md hover:text-red-600 transition-colors"
                                    aria-label="Cerrar vista previa"
                                >
                                    <X className="size-4" />
                                </button>
                                <img
                                    src={fotoSrc}
                                    alt={fotoAlt}
                                    className="h-full w-full rounded-xl object-cover"
                                />
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div
                    className="flex h-32 w-32 items-center justify-center rounded-full bg-muted text-muted-foreground shrink-0 cursor-pointer border-2 border-dashed border-muted-foreground/30 hover:border-emerald-400 transition-colors"
                    onClick={() => !isProcessing && inputRef.current?.click()}
                    title="Subir foto"
                >
                    {isProcessing ? (
                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    ) : (
                        <div className="flex flex-col items-center gap-1">
                            <Plus className="size-5" />
                            <span className="text-xs text-muted-foreground font-medium">Subir foto</span>
                        </div>
                    )}
                </div>
            )}

            {/* Confirmation Dialog for Delete */}
            <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar fotografía?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará la fotografía del colaborador. ¿Deseas continuar?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
