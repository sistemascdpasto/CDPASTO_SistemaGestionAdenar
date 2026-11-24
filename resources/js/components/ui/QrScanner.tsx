import { BrowserQRCodeReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { Camera, ScanLine, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface QrScannerProps {
    /** Se llama una sola vez con el texto leído. El padre decide qué hacer. */
    onResult: (text: string) => void;
    onClose: () => void;
    hint?: string;
}

const esCamaraTrasera = (d: MediaDeviceInfo) => /back|rear|environment/i.test(d.label);
const nombreCamara = (d: MediaDeviceInfo, i: number) => d.label?.trim() || `Cámara ${i + 1}`;

export function QrScanner({ onResult, onClose, hint = 'Apunta la cámara al código QR' }: QrScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const controlsRef = useRef<IScannerControls | null>(null);
    const onResultRef = useRef(onResult);
    onResultRef.current = onResult;

    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);
    const [found, setFound] = useState<string | null>(null);

    // 1. Listar cámaras y preseleccionar (única o trasera)
    useEffect(() => {
        BrowserQRCodeReader.listVideoInputDevices()
            .then((list) => {
                setDevices(list);
                setSelectedId((list.length === 1 ? list[0] : list.find(esCamaraTrasera))?.deviceId ?? null);
if (list.length === 0) {
    setError('No se encontró ninguna cámara en este dispositivo.');
}            })
            .catch(() => setError('No se pudo acceder a la cámara. Verifica los permisos del navegador.'));
    }, []);

    // 2. Arrancar el lector al elegir cámara
    useEffect(() => {
        if (!selectedId || !videoRef.current) return;

        let cancelled = false;
        setScanning(true);
        setFound(null);
        setError(null);

        new BrowserQRCodeReader()
            .decodeFromVideoDevice(selectedId, videoRef.current, (result) => {
                if (!result) return;

                controlsRef.current?.stop();
                setScanning(false);
                setFound(result.getText());
                onResultRef.current(result.getText());
            })
            .then((controls) => (cancelled ? controls.stop() : (controlsRef.current = controls)))
            .catch(() => {
                if (cancelled) return;
                setError('No se pudo iniciar la cámara seleccionada.');
                setScanning(false);
            });

        return () => {
            cancelled = true;
            controlsRef.current?.stop();
            controlsRef.current = null;
        };
    }, [selectedId]);

    return (
        <div className="flex flex-col items-center gap-4">
            {devices.length > 1 && (
                <div className="w-full max-w-xs space-y-2">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Camera className="size-3.5" />
                        Selecciona la cámara
                    </label>
                    <div className="flex flex-col gap-1.5">
                        {devices.map((d, i) => (
                            <button
                                key={d.deviceId}
                                type="button"
                                onClick={() => setSelectedId(d.deviceId)}
                                className={[
                                    'w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                                    selectedId === d.deviceId
                                        ? 'border-primary bg-primary/10 font-medium text-primary'
                                        : 'border-sidebar-border/70 text-foreground hover:bg-accent dark:border-sidebar-border',
                                ].join(' ')}
                            >
                                {nombreCamara(d, i)}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {selectedId && (
                <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-xl border border-sidebar-border/70 bg-black dark:border-sidebar-border">
                    <video ref={videoRef} className="h-full w-full object-cover" />

                    {scanning && (
                        <div className="pointer-events-none absolute inset-8">
                            <div className="absolute left-0 top-0 size-6 rounded-tl border-l-2 border-t-2 border-white" />
                            <div className="absolute right-0 top-0 size-6 rounded-tr border-r-2 border-t-2 border-white" />
                            <div className="absolute bottom-0 left-0 size-6 rounded-bl border-b-2 border-l-2 border-white" />
                            <div className="absolute bottom-0 right-0 size-6 rounded-br border-b-2 border-r-2 border-white" />
                            <div className="absolute inset-0 overflow-hidden">
                                <div className="animate-scan-line h-0.5 w-full bg-green-400 opacity-80" />
                            </div>
                        </div>
                    )}

                    {found && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
                            <div className="flex size-12 items-center justify-center rounded-full bg-green-500">
                                <ScanLine className="size-6 text-white" />
                            </div>
                            <p className="px-4 text-center text-sm font-semibold text-white">¡QR detectado!</p>
                            <p className="max-w-[200px] truncate px-4 text-center text-xs text-white/70">{found}</p>
                        </div>
                    )}
                </div>
            )}

            {scanning && <p className="text-center text-xs text-muted-foreground">{hint}</p>}
            {error && <p className="text-center text-sm text-red-500">{error}</p>}

            <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
                <X className="size-4" /> Cancelar
            </button>
        </div>
    );
}