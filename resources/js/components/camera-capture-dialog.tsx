import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, FlipHorizontal2, RefreshCw, Timer, TriangleAlert, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const OPCIONES_TIMER = [5, 10, 15] as const;
type OpcionTimer = (typeof OPCIONES_TIMER)[number];
type FacingMode  = 'environment' | 'user'; // trasera | frontal

/**
 * Diálogo para tomar una fotografía con la cámara del dispositivo y devolverla
 * como `File` (JPEG). Incluye temporizador configurable: 5, 10 o 15 segundos.
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
    const videoRef         = useRef<HTMLVideoElement>(null);
    const streamRef        = useRef<MediaStream | null>(null);
    const fallbackInputRef = useRef<HTMLInputElement>(null);
    const countdownRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [error,       setError]       = useState<string | null>(null);
    const [listo,       setListo]       = useState(false);
    const [cuenta,      setCuenta]      = useState<number | null>(null);
    const [segundosSel, setSegundosSel] = useState<OpcionTimer>(5);
    const [camara,      setCamara]      = useState<FacingMode>('environment');

    const detener = useCallback(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setListo(false);
        setCuenta(null);
        if (countdownRef.current) { clearTimeout(countdownRef.current); countdownRef.current = null; }
    }, []);

    const iniciar = useCallback(async (facing: FacingMode = camara) => {
        setError(null);
        setListo(false);
        setCuenta(null);
        // Detener stream anterior si existe
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (!navigator.mediaDevices?.getUserMedia) {
            setError('Este dispositivo o navegador no permite usar la cámara. Puedes adjuntar una foto desde el archivo.');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: facing } },
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
    }, [camara]);

    useEffect(() => {
        if (open) { void iniciar(); } else { detener(); }
        return () => detener();
    }, [open, iniciar, detener]);

    // ── Captura real ──────────────────────────────────────────────────────────
    const capturar = useCallback(() => {
        const video = videoRef.current;
        if (!video || !video.videoWidth) return;
        const MAX_LADO = 1920;
        const escala = Math.min(1, MAX_LADO / Math.max(video.videoWidth, video.videoHeight));
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(video.videoWidth  * escala);
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
    }, [onCapture, onOpenChange]);

    // ── Cuenta regresiva ──────────────────────────────────────────────────────
    const iniciarTemporizador = () => {
        if (!listo) return;
        setCuenta(segundosSel);
    };

    useEffect(() => {
        if (cuenta === null) return;
        if (cuenta === 0) {
            setCuenta(null);
            capturar();
            return;
        }
        countdownRef.current = setTimeout(() => setCuenta((c) => (c !== null ? c - 1 : null)), 1000);
        return () => { if (countdownRef.current) clearTimeout(countdownRef.current); };
    }, [cuenta, capturar]);

    const cancelarTemporizador = () => {
        if (countdownRef.current) { clearTimeout(countdownRef.current); countdownRef.current = null; }
        setCuenta(null);
    };

    const cambiarCamara = () => {
        const nueva: FacingMode = camara === 'environment' ? 'user' : 'environment';
        setCamara(nueva);
        void iniciar(nueva);
    };

    const desdeArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) { onCapture(file); onOpenChange(false); }
        e.target.value = '';
    };

    const enConteo = cuenta !== null;

    // Arco SVG para la cuenta regresiva
    const radio  = 54;
    const circum = 2 * Math.PI * radio;
    const pct    = enConteo && cuenta !== null ? (cuenta / segundosSel) * 100 : 0;
    const dash   = (pct / 100) * circum;

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
                        <div className="relative overflow-hidden rounded-lg border border-border bg-black">
                            <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" />

                            {/* Botón cambiar cámara — esquina superior derecha */}
                            {listo && !enConteo && (
                                <button
                                    type="button"
                                    onClick={cambiarCamara}
                                    title={camara === 'environment' ? 'Cambiar a cámara frontal' : 'Cambiar a cámara trasera'}
                                    className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
                                >
                                    <FlipHorizontal2 className="size-4" />
                                </button>
                            )}

                            {/* Overlay cuenta regresiva */}
                            {enConteo && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                                    {/* Círculo SVG con arco de progreso */}
                                    <div className="relative flex items-center justify-center">
                                        <svg width="128" height="128" viewBox="0 0 128 128">
                                            <circle cx="64" cy="64" r={radio} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
                                            <circle
                                                cx="64" cy="64" r={radio}
                                                fill="none"
                                                stroke="white"
                                                strokeWidth="8"
                                                strokeLinecap="round"
                                                strokeDasharray={`${dash} ${circum}`}
                                                transform="rotate(-90 64 64)"
                                                style={{ transition: 'stroke-dasharray 0.9s linear' }}
                                            />
                                        </svg>
                                        <div className="absolute flex flex-col items-center">
                                            <span className="text-5xl font-extrabold leading-none text-white drop-shadow-lg">
                                                {cuenta}
                                            </span>
                                            <span className="mt-0.5 text-xs font-medium text-white/70">seg</span>
                                        </div>
                                    </div>
                                    <p className="mt-2 text-sm font-medium text-white/80">Preparándose para capturar…</p>
                                </div>
                            )}
                        </div>
                    )}

                    <input ref={fallbackInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={desdeArchivo} />

                    {/* Selector de duración del temporizador */}
                    {!error && !enConteo && (
                        <div className="flex items-center gap-2">
                            <Timer className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Temporizador:</span>
                            <div className="flex gap-1">
                                {OPCIONES_TIMER.map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setSegundosSel(s)}
                                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                                            segundosSel === s
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                        }`}
                                    >
                                        {s}s
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => fallbackInputRef.current?.click()} disabled={enConteo}>
                            Adjuntar desde archivo
                        </Button>

                        {error ? (
                            <Button type="button" variant="secondary" onClick={() => void iniciar()}>
                                <RefreshCw className="size-4" />
                                Reintentar cámara
                            </Button>
                        ) : enConteo ? (
                            <Button type="button" variant="destructive" onClick={cancelarTemporizador}>
                                <X className="size-4" />
                                Cancelar ({cuenta}s)
                            </Button>
                        ) : (
                            <>
                                {/* Iniciar temporizador con el tiempo seleccionado */}
                                <Button type="button" variant="secondary" onClick={iniciarTemporizador} disabled={!listo}
                                    title={`Captura automática en ${segundosSel} segundos`}>
                                    <Timer className="size-4" />
                                    {segundosSel}s
                                </Button>

                                {/* Captura inmediata */}
                                <Button type="button" onClick={capturar} disabled={!listo}>
                                    <Camera className="size-4" />
                                    Capturar
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
