/**
 * QrScanner — componente que activa la cámara del dispositivo para leer
 * códigos QR usando @zxing/browser. Al detectar un QR navega a la URL
 * decodificada (si es una URL del sistema) o llama a onResult con el texto.
 *
 * Uso:
 *   <QrScanner onResult={(text) => { ... }} onClose={() => { ... }} />
 */
import { router } from '@inertiajs/react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { ScanLine, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Props {
    onResult?: (text: string) => void;
    onClose: () => void;
}

export function QrScanner({ onResult, onClose }: Props) {
    const videoRef   = useRef<HTMLVideoElement>(null);
    const readerRef  = useRef<BrowserMultiFormatReader | null>(null);
    const onResultRef = useRef(onResult);
    const onCloseRef  = useRef(onClose);
    onResultRef.current = onResult;
    onCloseRef.current  = onClose;
    const [error, setError]       = useState<string | null>(null);
    const [scanning, setScanning] = useState(true);
    const [found, setFound]       = useState<string | null>(null);

    useEffect(() => {
        const codeReader = new BrowserMultiFormatReader();
        readerRef.current = codeReader;

        codeReader
            .listVideoInputDevices()
            .then(devices => {
                if (!devices.length) {
                    setError('No se encontró ninguna cámara en este dispositivo.');
                    return;
                }

                // Preferir cámara trasera en móviles
                const device =
                    devices.find(d => /back|rear|environment/i.test(d.label)) ??
                    devices[devices.length - 1];

                codeReader.decodeFromVideoDevice(
                    device.deviceId,
                    videoRef.current!,
                    (result, err) => {
                        if (result) {
                            const text = result.getText();
                            setScanning(false);
                            setFound(text);
                            codeReader.reset();

                            if (onResultRef.current) {
                                onResultRef.current(text);
                                return;
                            }

                            // Comportamiento por defecto: si es URL del sistema navega con Inertia,
                            // si es URL externa abre en nueva pestaña.
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
                                // No es una URL — el texto es el número de serie del extintor
                                // Buscamos el extintor por número de serie a través de la ruta autenticada
                                if (text && text.trim()) {
                                    router.visit(`/modules/flota/extintores?serie=${encodeURIComponent(text.trim())}`);
                                    onCloseRef.current();
                                }
                            }
                        }
                        if (err && !(err instanceof NotFoundException)) {
                            // NotFoundException es normal (frame sin QR), ignorar
                        }
                    },
                );
            })
            .catch(() => {
                setError('No se pudo acceder a la cámara. Verifica los permisos del navegador.');
            });

        return () => {
            readerRef.current?.reset();
        };
    }, []);

    return (
        <div className="flex flex-col items-center gap-4">
            {/* Video */}
            <div className="relative w-full overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border bg-black aspect-square max-w-xs mx-auto">
                <video ref={videoRef} className="w-full h-full object-cover" />

                {/* Marco de escaneo animado */}
                {scanning && !error && (
                    <>
                        {/* Esquinas */}
                        <div className="absolute inset-8 pointer-events-none">
                            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl" />
                            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr" />
                            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl" />
                            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br" />
                        </div>
                        {/* Línea animada */}
                        <div className="absolute inset-x-8 pointer-events-none overflow-hidden"
                            style={{ top: '2rem', bottom: '2rem' }}>
                            <div className="animate-scan-line w-full h-0.5 bg-green-400 opacity-80" />
                        </div>
                    </>
                )}

                {/* Estado: encontrado */}
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

            {/* Error */}
            {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            {/* Instrucción */}
            {scanning && !error && (
                <p className="text-xs text-muted-foreground text-center">
                    Apunta la cámara al código QR del extintor
                </p>
            )}

            <button type="button" onClick={onClose}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <X className="size-4" /> Cancelar
            </button>
        </div>
    );
}
