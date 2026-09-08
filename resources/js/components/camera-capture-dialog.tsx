import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, RefreshCw, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Diálogo para tomar una fotografía con la cámara del dispositivo y devolverla
 * como `File` (JPEG). En equipos sin cámara o sin permiso, ofrece el selector
 * de archivos del sistema con `capture` (que en móvil abre la cámara nativa).
 */
export function CameraCaptureDialog({
    open,
    onOpenChange,
    onCapture,
    titulo = 'Tomar fotografía',
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCapture: (file: File) => void;
    titulo?: string;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fallbackInputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [listo, setListo] = useState(false);

    const detener = useCallback(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setListo(false);
    }, []);

    const iniciar = useCallback(async () => {
        setError(null);
        setListo(false);
        if (!navigator.mediaDevices?.getUserMedia) {
            setError('Este dispositivo o navegador no permite usar la cámara. Puedes adjuntar una foto desde el archivo.');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' } },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setListo(true);
            }
        } catch {
            setError('No se pudo acceder a la cámara. Revisa los permisos del navegador o adjunta una foto desde el archivo.');
        }
    }, []);

    useEffect(() => {
        if (open) {
            void iniciar();
        } else {
            detener();
        }
        return () => detener();
    }, [open, iniciar, detener]);

    const capturar = () => {
        const video = videoRef.current;
        if (!video || !video.videoWidth) return;

        // Se reescala el fotograma para que la evidencia pese poco (el backend
        // limita a 5 MB) sin perder legibilidad.
        const MAX_LADO = 1920;
        const escala = Math.min(1, MAX_LADO / Math.max(video.videoWidth, video.videoHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(video.videoWidth * escala);
        canvas.height = Math.round(video.videoHeight * escala);
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
            (blob) => {
                if (!blob) return;
                onCapture(new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }));
                onOpenChange(false);
            },
            'image/jpeg',
            0.85,
        );
    };

    const desdeArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onCapture(file);
            onOpenChange(false);
        }
        e.target.value = '';
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{titulo}</DialogTitle>
                </DialogHeader>

                <div className="grid gap-3">
                    {error ? (
                        <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                            {error}
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-lg border border-border bg-black">
                            <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" />
                        </div>
                    )}

                    <input ref={fallbackInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={desdeArchivo} />

                    <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => fallbackInputRef.current?.click()}>
                            Adjuntar desde archivo
                        </Button>
                        {error ? (
                            <Button type="button" variant="secondary" onClick={() => void iniciar()}>
                                <RefreshCw className="size-4" />
                                Reintentar cámara
                            </Button>
                        ) : (
                            <Button type="button" onClick={capturar} disabled={!listo}>
                                <Camera className="size-4" />
                                Capturar
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
