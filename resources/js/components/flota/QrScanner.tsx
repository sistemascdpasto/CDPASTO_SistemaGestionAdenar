/**
 * QrScanner — componente que activa la cámara del dispositivo para leer
 * códigos QR usando @zxing/browser. Al detectar un QR navega a la URL
 * decodificada (si es una URL del sistema) o llama a onResult con el texto.
 *
 * Si hay más de una cámara disponible, muestra un selector antes de iniciar.
 *
 * Uso:
 *   <QrScanner onResult={(text) => { ... }} onClose={() => { ... }} />
 */
import { router } from '@inertiajs/react';
import { BrowserQRCodeReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { Camera, ScanLine, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Props {
    onResult?: (text: string) => void;
    onClose: () => void;
}

export function QrScanner({ onResult, onClose }: Props) {
    const videoRef    = useRef<HTMLVideoElement>(null);
    const controlsRef = useRef<IScannerControls | null>(null);
    const onResultRef = useRef(onResult);
    const onCloseRef  = useRef(onClose);
    onResultRef.current = onResult;
    onCloseRef.current  = onClose;

    const [devices, setDevices]         = useState<MediaDeviceInfo[]>([]);
    const [selectedId, setSelectedId]   = useState<string | null>(null);
    const [error, setError]             = useState<string | null>(null);
    const [scanning, setScanning]       = useState(false);
    const [found, setFound]             = useState<string | null>(null);

    // 1. Listar cámaras al montar
    useEffect(() => {
        BrowserQRCodeReader.listVideoInputDevices()
            .then((list) => {
                if (!list.length) {
                    setError('No se encontró ninguna cámara en este dispositivo.');
                    return;
                }

                setDevices(list);

                if (list.length === 1) {
                    // Si solo hay una, arrancar directamente
                    setSelectedId(list[0].deviceId);
                } else {
                    // Preseleccionar la cámara trasera si existe
                    const rear = list.find(d => /back|rear|environment/i.test(d.label));
                    setSelectedId(rear ? rear.deviceId : null);
                }
            })
            .catch(() => {
                setError('No se pudo acceder a la cámara. Verifica los permisos del navegador.');
            });
    }, []);

    // 2. Arrancar el lector cuando se confirma el dispositivo
    useEffect(() => {
        if (!selectedId || devices.length === 0) return;

        // Si hay más de una cámara y el usuario aún no eligió (selectedId es null), esperar
        if (devices.length > 1 && selectedId === null) return;

        let cancelled = false;
        setScanning(true);
        setFound(null);
        setError(null);

        const codeReader = new BrowserQRCodeReader();

        codeReader
            .decodeFromVideoDevice(selectedId, videoRef.current!, (result, err) => {
                if (result) {
                    const text = result.getText();
                    setScanning(false);
                    setFound(text);
                    controlsRef.current?.stop();

                    if (onResultRef.current) {
                        onResultRef.current(text);
                        return;
                    }

                    try {
                        const url = new URL(text);
                        const appOrigin = window.location.origin;
                        if (url.origin === appOrigin) {
                            router.visit(url.pathname + url.search);
                            onCloseRef.current();
                        } else {
                            window.open(text, '_blank', 'noopener');
                        }
                    } catch {
                        if (text && text.trim()) {
                            router.visit(`/modules/flota/extintores?serie=${encodeURIComponent(text.trim())}`);
                            onCloseRef.current();
                        }
                    }
                }
                void err;
            })
            .then((controls) => {
                if (cancelled) {
                    controls.stop();
                    return;
                }
                controlsRef.current = controls;
            })
            .catch(() => {
                if (!cancelled) {
                    setError('No se pudo iniciar la cámara seleccionada.');
                    setScanning(false);
                }
            });

        return () => {
            cancelled = true;
            controlsRef.current?.stop();
            controlsRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);

    const nombreCamara = (d: MediaDeviceInfo, i: number) =>
        d.label?.trim() || `Cámara ${i + 1}`;

    return (
        <div className="flex flex-col items-center gap-4">

            {/* Selector de cámara — solo visible si hay más de una */}
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
                                        ? 'border-primary bg-primary/10 text-primary font-medium'
                                        : 'border-sidebar-border/70 dark:border-sidebar-border hover:bg-accent text-foreground',
                                ].join(' ')}
                            >
                                {nombreCamara(d, i)}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Video — solo visible una vez seleccionada la cámara */}
            {selectedId && (
                <div className="relative w-full overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border bg-black aspect-square max-w-xs mx-auto">
                    <video ref={videoRef} className="w-full h-full object-cover" />

                    {/* Marco de escaneo */}
                    {scanning && !error && (
                        <>
                            <div className="absolute inset-8 pointer-events-none">
                                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl" />
                                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr" />
                                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl" />
                                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br" />
                            </div>
                            <div
                                className="absolute inset-x-8 pointer-events-none overflow-hidden"
                                style={{ top: '2rem', bottom: '2rem' }}
                            >
                                <div className="animate-scan-line w-full h-0.5 bg-green-400 opacity-80" />
                            </div>
                        </>
                    )}

                    {/* QR detectado */}
                    {found && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-xl gap-2">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500">
                                <ScanLine className="size-6 text-white" />
                            </div>
                            <p className="text-white text-sm font-semibold px-4 text-center">¡QR detectado!</p>
                            <p className="text-white/70 text-xs px-4 text-center break-all max-w-[200px] truncate">{found}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Instrucción */}
            {scanning && !error && selectedId && (
                <p className="text-xs text-muted-foreground text-center">
                    Apunta la cámara al código QR del extintor
                </p>
            )}

            {/* Error */}
            {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
                <X className="size-4" /> Cancelar
            </button>
        </div>
    );
}
