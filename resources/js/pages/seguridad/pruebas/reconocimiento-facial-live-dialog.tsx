import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
    CheckCircle2,
    FlipHorizontal2,
    RefreshCw,
    ScanFace,
    TriangleAlert,
    UserCheck,
    Video,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Flag de logs de diagnóstico ─────────────────────────────────────────────
// Solo activos en desarrollo Y con ?facial_debug en la URL, para evitar spam
// incluso en dev. Agrega ?facial_debug a la URL para activarlos manualmente.
const DEV_LOGS =
    import.meta.env.DEV === true &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('facial_debug');

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface ColaboradorItem {
    id: number;
    nombres: string;
    apellidos: string;
    cedula: string;
    cargo?: string;
}

interface FaceBox {
    box: [number, number, number, number]; // x, y, w, h
    score: number;
    identity?: IdentityResult | null;
}

interface IdentityResult {
    status: 'match' | 'uncertain' | 'no_match';
    match: boolean;
    colaborador_id?: number;
    confidence?: number;
    similarity?: number;
    live?: boolean;
    liveness_score?: number | null;
    message?: string;
}

interface FrameResponse {
    type: string;
    faces?: FaceBox[];
    identity?: IdentityResult | null;
    ms?: number;
    w?: number;
    h?: number;
}

interface LiveDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    colaboradores: ColaboradorItem[];
    onColaboradorSeleccionado: (colaborador: ColaboradorItem, fotoCapturada?: File) => void;
    fastApiWsUrl?: string;
    fastApiHttpUrl?: string;
}

// ─── Construcción de URLs ─────────────────────────────────────────────────────
// VITE_FACIAL_SERVICE_URL  → URL pública del servicio (Railway, etc.)
// VITE_FACIAL_API_KEY      → token compartido con el servicio Python (FACIAL_API_KEY)
// Sin variable configurada → usa el servicio local en 127.0.0.1:8001

function buildFacialUrls(): { wsUrl: string; httpUrl: string } {
    const configuredBase = (import.meta.env.VITE_FACIAL_SERVICE_URL as string | undefined)
        ?.trim()
        .replace(/\/+$/, '');

    const base = configuredBase || 'http://127.0.0.1:8001';

    const wsBase = base.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');

    const apiKey = (import.meta.env.VITE_FACIAL_API_KEY as string | undefined)?.trim() ?? '';
    const token = apiKey ? `?token=${encodeURIComponent(apiKey)}` : '';

    return {
        wsUrl: `${wsBase}/ws/reconocer${token}`,
        httpUrl: `${base}/frame`,
    };
}

const { wsUrl: DEFAULT_WS_URL, httpUrl: DEFAULT_HTTP_URL } = buildFacialUrls();
const FACIAL_API_KEY = (import.meta.env.VITE_FACIAL_API_KEY as string | undefined) ?? '';

// ─── Utilidades ──────────────────────────────────────────────────────────────

function esCamaraVirtual(label: string): boolean {
    const l = label.toLowerCase();
    return (
        l.includes('virtual') ||
        l.includes('obs') ||
        l.includes('vcam') ||
        l.includes('droidcam') ||
        l.includes('manycam') ||
        l.includes('snap camera') ||
        l.includes('unity') ||
        l.includes('ndi')
    );
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function ReconocimientoFacialLiveDialog({
    open,
    onOpenChange,
    colaboradores,
    onColaboradorSeleccionado,
    fastApiWsUrl = DEFAULT_WS_URL,
    fastApiHttpUrl = DEFAULT_HTTP_URL,
}: LiveDialogProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSendingRef = useRef<boolean>(false);

    // BUG 4 FIX: almacenar selectedDeviceId en un ref además del state para que
    // iniciarCamara no tenga que listarlo como dependencia del useCallback
    // (evita que el cambio de dispositivo rehaga el efecto del WS completo).
    const selectedDeviceIdRef = useRef<string>('');
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

    const [error, setError] = useState<string | null>(null);
    const [conectadoWs, setConectadoWs] = useState<boolean>(false);
    const [servicioOffline, setServicioOffline] = useState<boolean>(false);
    const [identificado, setIdentificado] = useState<ColaboradorItem | null>(null);
    const [infoIdentidad, setInfoIdentidad] = useState<IdentityResult | null>(null);
    const [dispositivos, setDispositivos] = useState<{ deviceId: string; label: string }[]>([]);
    const [fps, setFps] = useState<number>(0);
    const [isMirrored, setIsMirrored] = useState<boolean>(false);
    const isMirroredRef = useRef<boolean>(false);
    isMirroredRef.current = isMirrored;
    const errorCountRef = useRef<number>(0);

    // Ref-proxy para que el closure del WS siempre llame la versión actualizada
    // de handleFrameResponse sin recrear el efecto completo.
    const handleFrameResponseRef = useRef<(data: FrameResponse) => void>(() => {});

    // BUG 1 FIX (revisado): usar un ref que se actualiza síncronamente en cada
    // render. handleFrameResponse lo leerá siempre con el mapa más reciente,
    // independientemente del ciclo de re-render o del requestAnimationFrame.
    const colaboradoresMapRef = useRef<Map<number, ColaboradorItem>>(new Map());
    // Reconstruir el mapa en cada render donde cambie el array (operación O(n), barata).
    const nextMap = new Map<number, ColaboradorItem>();
    colaboradores.forEach((c) => nextMap.set(Number(c.id), c));
    colaboradoresMapRef.current = nextMap;

    // ── Detener stream, WS y temporizadores ──────────────────────────────────
    const detenerStream = useCallback(() => {
        if (loopTimerRef.current) {
            clearTimeout(loopTimerRef.current);
            loopTimerRef.current = null;
        }
        if (wsRef.current) {
            try {
                wsRef.current.close();
            } catch {
                /* ignorar error al cerrar WebSocket */
            }
            wsRef.current = null;
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setIdentificado(null);
        setInfoIdentidad(null);
        setConectadoWs(false);
    }, []);

    // ── Iniciar cámara ────────────────────────────────────────────────────────
    // BUG 4 FIX: ya no depende de selectedDeviceId del estado — lee el ref para
    // no forzar la recreación del useEffect del WS al cambiar de dispositivo.
    const iniciarCamara = useCallback(async (deviceIdToUse?: string) => {
        setError(null);
        setIdentificado(null);
        setInfoIdentidad(null);

        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        if (!navigator.mediaDevices?.getUserMedia) {
            setError('Tu navegador o dispositivo no permite acceso a la cámara.');
            return;
        }

        try {
            // Usar el deviceId recibido por parámetro, o el del ref, o auto-detectar
            let targetId = deviceIdToUse ?? selectedDeviceIdRef.current;

            // Priorizar cámara real que no sea virtual
            if (!targetId && navigator.mediaDevices.enumerateDevices) {
                try {
                    const allDevs = await navigator.mediaDevices.enumerateDevices();
                    const vDevs = allDevs.filter((d) => d.kind === 'videoinput');
                    const real = vDevs.find((d) => d.label && !esCamaraVirtual(d.label));
                    if (real?.deviceId) targetId = real.deviceId;
                } catch {
                    /* ignorar error al enumerar dispositivos */
                }
            }

            const constraints: MediaStreamConstraints = {
                video: targetId
                    ? { deviceId: { exact: targetId }, width: { ideal: 640 }, height: { ideal: 480 } }
                    : { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false,
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                try {
                    await videoRef.current.play();
                } catch (e) {
                    console.warn('[Facial] Video play interrupted:', e);
                }
            }

            if (navigator.mediaDevices.enumerateDevices) {
                const devs = await navigator.mediaDevices.enumerateDevices();
                const vInputs = devs
                    .filter((d) => d.kind === 'videoinput')
                    .map((d, index) => ({
                        deviceId: d.deviceId,
                        label: d.label || `Cámara ${index + 1}`,
                    }));
                setDispositivos(vInputs);

                const track = stream.getVideoTracks()[0];
                const activeId = track?.getSettings()?.deviceId || targetId || vInputs[0]?.deviceId || '';
                selectedDeviceIdRef.current = activeId;
                setSelectedDeviceId(activeId);
            }
        } catch {
            setError('No se pudo acceder a la cámara seleccionada.');
        }
    }, []); // sin dependencias: lee todo desde refs

    // ── WebSocket y ciclo de fotogramas ───────────────────────────────────────
    // BUG 4 FIX: iniciarCamara ya no está en las deps porque su referencia es
    // ahora estable (useCallback vacío). El efecto solo se rehace si cambia
    // open, la URL del WS o la URL HTTP.
    useEffect(() => {
        if (!open) {
            detenerStream();
            return;
        }

        void iniciarCamara();

        let ws: WebSocket | null = null;

        try {
            ws = new WebSocket(fastApiWsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                setConectadoWs(true);
                errorCountRef.current = 0;
            };

            ws.onmessage = (event) => {
                isSendingRef.current = false;
                // Diferir el procesamiento al siguiente frame de animación para no
                // bloquear el hilo del evento WS (evita "message handler took Xms").
                const raw = event.data as string;
                requestAnimationFrame(() => {
                    try {
                        const data: FrameResponse = JSON.parse(raw);
                        handleFrameResponseRef.current(data);
                    } catch (e) {
                        console.error('[Facial][WS] Error parseando frame:', e);
                    }
                });
                if (DEV_LOGS) {
                    console.debug('[Facial][WS] frame recibido', (event.data as string).length, 'chars');
                }
            };

            ws.onerror = () => {
                setConectadoWs(false);
            };

            ws.onclose = () => {
                setConectadoWs(false);
            };
        } catch {
            /* WebSocket no disponible; conectadoWs permanece false → fallback HTTP */
        }

        let lastTime = Date.now();
        let frameCount = 0;

        const enviarFotograma = async () => {
            if (!open) return;

            const video = videoRef.current;
            if (video && video.videoWidth > 0 && !isSendingRef.current) {
                const w = video.videoWidth;
                const h = video.videoHeight;

                if (!hiddenCanvasRef.current) {
                    hiddenCanvasRef.current = document.createElement('canvas');
                }
                const hCanvas = hiddenCanvasRef.current;
                const targetW = 480;
                const targetH = Math.round((h / w) * targetW);
                hCanvas.width = targetW;
                hCanvas.height = targetH;
                const ctx = hCanvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, targetW, targetH);

                    hCanvas.toBlob(
                        async (blob) => {
                            if (!blob) return;

                            frameCount++;
                            const now = Date.now();
                            if (now - lastTime >= 1000) {
                                setFps(frameCount);
                                frameCount = 0;
                                lastTime = now;
                            }

                            if (ws && ws.readyState === WebSocket.OPEN) {
                                isSendingRef.current = true;
                                ws.send(blob);
                                errorCountRef.current = 0;
                                setServicioOffline(false);
                            } else {
                                // ── Fallback HTTP (/frame) ────────────────────────────
                                isSendingRef.current = true;
                                try {
                                    const fd = new FormData();
                                    fd.append('foto', blob, 'frame.jpg');
                                    const headers: Record<string, string> = {};
                                    if (FACIAL_API_KEY) headers['X-Api-Key'] = FACIAL_API_KEY;
                                    const resp = await fetch(fastApiHttpUrl, {
                                        method: 'POST',
                                        body: fd,
                                        headers,
                                    });
                                    if (resp.ok) {
                                        errorCountRef.current = 0;
                                        setServicioOffline(false);
                                        const resData: FrameResponse = await resp.json();
                                        handleFrameResponseRef.current(resData);
                                    } else {
                                        // BUG 3 FIX: solo loguea el error HTTP en dev
                                        if (DEV_LOGS) {
                                            console.debug('[Facial][HTTP] status', resp.status);
                                        }
                                        errorCountRef.current++;
                                        if (errorCountRef.current >= 3) setServicioOffline(true);
                                    }
                                } catch (e) {
                                    console.error('[Facial][HTTP] error en la petición:', e);
                                    errorCountRef.current++;
                                    if (errorCountRef.current >= 3) setServicioOffline(true);
                                } finally {
                                    isSendingRef.current = false;
                                }
                            }
                        },
                        'image/jpeg',
                        0.75,
                    );
                }
            }

            const nextDelay = errorCountRef.current >= 3 ? 3000 : 130;
            loopTimerRef.current = setTimeout(enviarFotograma, nextDelay);
        };

        loopTimerRef.current = setTimeout(enviarFotograma, 300);

        return () => {
            detenerStream();
        };
    }, [open, fastApiWsUrl, fastApiHttpUrl, detenerStream, iniciarCamara]);

    // ── Procesar respuesta del frame ──────────────────────────────────────────
    // Lee el mapa desde el ref (siempre la versión más reciente, incluso dentro
    // de requestAnimationFrame o closures del WS).
    const handleFrameResponse = useCallback(
        (data: FrameResponse) => {
            const video = videoRef.current;
            const canvas = overlayCanvasRef.current;
            if (!video || !canvas || video.videoWidth === 0) return;

            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Leer el mapa desde el ref: siempre tiene los datos actuales
            // aunque esta función se ejecute dentro de un requestAnimationFrame.
            const cMap = colaboradoresMapRef.current;

            const faces = data.faces ?? [];
            let principalIdentificado: ColaboradorItem | null = null;
            let principalInfo: IdentityResult | null = null;

            const frameW = data.w && data.w > 0 ? data.w : 480;
            const frameH =
                data.h && data.h > 0
                    ? data.h
                    : Math.round((video.videoHeight / video.videoWidth) * frameW);

            const scaleX = canvas.width / frameW;
            const scaleY = canvas.height / frameH;

            faces.forEach((f) => {
                const rawX = f.box[0] * scaleX;
                const rawY = f.box[1] * scaleY;
                const fw = f.box[2] * scaleX;
                const fh = f.box[3] * scaleY;

                const x = isMirroredRef.current ? canvas.width - rawX - fw : rawX;
                const y = rawY;

                const faceIdentity: IdentityResult | null | undefined =
                    f.identity ?? (faces.length === 1 ? data.identity : null);

                let color = '#38bdf8';
                let texto = 'Rostro detectado';

                if (faceIdentity) {
                    if (faceIdentity.status === 'match') {
                        color = '#10b981';
                        const colab = faceIdentity.colaborador_id != null
                            ? cMap.get(Number(faceIdentity.colaborador_id))
                            : undefined;

                        if (!colab && faceIdentity.colaborador_id != null && DEV_LOGS) {
                            console.warn(
                                `[Facial] colaborador_id ${faceIdentity.colaborador_id} no encontrado en el mapa (${cMap.size} entradas).`,
                            );
                        }

                        const nombre = colab
                            ? `${colab.nombres} ${colab.apellidos}`
                            : `Colaborador #${faceIdentity.colaborador_id ?? '?'}`;
                        texto = `✓ ${nombre} (${faceIdentity.confidence ?? 0}%)`;

                        if (
                            colab &&
                            (!principalIdentificado ||
                                (faceIdentity.confidence ?? 0) > (principalInfo?.confidence ?? 0))
                        ) {
                            principalIdentificado = colab;
                            principalInfo = faceIdentity;
                        }
                    } else if (faceIdentity.status === 'uncertain') {
                        color = '#f59e0b';
                        const colab = faceIdentity.colaborador_id != null
                            ? cMap.get(Number(faceIdentity.colaborador_id))
                            : undefined;
                        const nombre = colab ? colab.nombres : 'Incierto';
                        texto = `? ${nombre} (${faceIdentity.confidence ?? 0}%)`;
                        if (colab && !principalIdentificado) {
                            principalIdentificado = colab;
                            principalInfo = faceIdentity;
                        }
                    } else {
                        color = '#ef4444';
                        texto =
                            faceIdentity.status === 'no_match'
                                ? 'No registrado'
                                : faceIdentity.message?.slice(0, 40) ?? 'No registrado';
                    }
                }

                ctx.fillStyle = color === '#10b981' ? 'rgba(16,185,129,0.08)' : 'rgba(56,189,248,0.05)';
                ctx.fillRect(x, y, fw, fh);

                ctx.strokeStyle = color;
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.roundRect(x, y, fw, fh, 8);
                ctx.stroke();

                const cornerLen = Math.min(24, fw * 0.2, fh * 0.2);
                ctx.lineWidth = 4.5;
                ctx.beginPath();
                ctx.moveTo(x, y + cornerLen);           ctx.lineTo(x, y);            ctx.lineTo(x + cornerLen, y);
                ctx.moveTo(x + fw - cornerLen, y);       ctx.lineTo(x + fw, y);       ctx.lineTo(x + fw, y + cornerLen);
                ctx.moveTo(x, y + fh - cornerLen);       ctx.lineTo(x, y + fh);       ctx.lineTo(x + cornerLen, y + fh);
                ctx.moveTo(x + fw - cornerLen, y + fh);  ctx.lineTo(x + fw, y + fh);  ctx.lineTo(x + fw, y + fh - cornerLen);
                ctx.stroke();

                ctx.font = 'bold 14px sans-serif';
                const textWidth = ctx.measureText(texto).width;
                const badgeW = textWidth + 16;
                const badgeH = 26;
                const badgeY = y > badgeH + 6 ? y - badgeH - 6 : y + fh + 6;

                ctx.fillStyle = 'rgba(0,0,0,0.85)';
                ctx.beginPath();
                ctx.roundRect(x, badgeY, badgeW, badgeH, 6);
                ctx.fill();

                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.roundRect(x, badgeY, badgeW, badgeH, 6);
                ctx.stroke();

                ctx.fillStyle = color;
                ctx.fillText(texto, x + 8, badgeY + 18);
            });

            if (principalIdentificado) {
                setIdentificado(principalIdentificado);
                setInfoIdentidad(principalInfo);
            } else if (faces.length === 0) {
                setIdentificado(null);
                setInfoIdentidad(null);
            }
        },
        [], // sin dependencias: lee todo desde refs
    );

    // BUG 5 FIX: una sola asignación al ref-proxy
    handleFrameResponseRef.current = handleFrameResponse;

    // ── Confirmar selección ───────────────────────────────────────────────────
    const confirmarSeleccion = () => {
        if (!identificado) return;

        const video = videoRef.current;
        if (video && video.videoWidth > 0) {
            const c = document.createElement('canvas');
            c.width = video.videoWidth;
            c.height = video.videoHeight;
            c.getContext('2d')?.drawImage(video, 0, 0);
            c.toBlob(
                (blob) => {
                    const foto = blob
                        ? new File([blob], `reconocimiento-${Date.now()}.jpg`, { type: 'image/jpeg' })
                        : undefined;
                    onColaboradorSeleccionado(identificado, foto);
                    onOpenChange(false);
                },
                'image/jpeg',
                0.85,
            );
        } else {
            onColaboradorSeleccionado(identificado);
            onOpenChange(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-background">
                <DialogHeader className="p-4 border-b border-border">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                                <ScanFace className="size-4 animate-pulse" />
                            </div>
                            <div>
                                <DialogTitle className="text-sm font-semibold">
                                    Reconocimiento Facial en Vivo
                                </DialogTitle>
                                <p className="text-xs text-muted-foreground">
                                    Inferencia en tiempo real con FastAPI y OpenCV
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Badge
                                variant="outline"
                                className={
                                    conectadoWs
                                        ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50 text-[10px]'
                                        : 'border-amber-500 text-amber-600 text-[10px]'
                                }
                            >
                                <span
                                    className={`mr-1 size-1.5 rounded-full inline-block ${
                                        conectadoWs ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'
                                    }`}
                                />
                                {conectadoWs ? `En vivo WebSocket (${fps} FPS)` : 'Modo HTTP'}
                            </Badge>
                        </div>
                    </div>
                </DialogHeader>

                <div className="relative bg-black flex flex-col items-center justify-center">
                    {error ? (
                        <div className="p-8 text-center text-amber-400 flex flex-col items-center gap-2">
                            <TriangleAlert className="size-8" />
                            <p className="text-xs">{error}</p>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => void iniciarCamara()}
                                className="mt-2 text-xs"
                            >
                                <RefreshCw className="size-3.5 mr-1" /> Reintentar
                            </Button>
                        </div>
                    ) : (
                        <div className="relative aspect-video w-full max-h-[420px] overflow-hidden flex items-center justify-center">
                            <video
                                ref={videoRef}
                                playsInline
                                autoPlay
                                muted
                                className={`h-full w-full object-cover transition-transform duration-200 ${
                                    isMirrored ? '-scale-x-100' : ''
                                }`}
                            />
                            <canvas
                                ref={overlayCanvasRef}
                                className="absolute inset-0 h-full w-full pointer-events-none object-cover"
                            />

                            {/* Alerta servicio offline */}
                            {servicioOffline && (
                                <div className="absolute top-3 inset-x-3 rounded-lg bg-amber-950/90 border border-amber-500/70 p-3 text-amber-200 text-xs flex items-center justify-between shadow-lg z-20 backdrop-blur-sm animate-in fade-in">
                                    <div className="flex items-center gap-2">
                                        <TriangleAlert className="size-4 shrink-0 text-amber-400" />
                                        <span>
                                            El servicio de reconocimiento facial se está reconectando...
                                        </span>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            errorCountRef.current = 0;
                                            setServicioOffline(false);
                                        }}
                                        className="border-amber-400 text-amber-200 hover:bg-amber-900/40 text-xs h-7 ml-2 shrink-0"
                                    >
                                        <RefreshCw className="size-3 mr-1" /> Reintentar
                                    </Button>
                                </div>
                            )}

                            {/* Selector de cámara + espejo */}
                            <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
                                {dispositivos.length > 1 && (
                                    <div className="bg-black/60 backdrop-blur-sm rounded-md px-2 py-1 flex items-center gap-1.5 border border-white/20">
                                        <Video className="size-3 text-white/80" />
                                        <select
                                            value={selectedDeviceId}
                                            onChange={(e) => {
                                                const id = e.target.value;
                                                selectedDeviceIdRef.current = id;
                                                setSelectedDeviceId(id);
                                                void iniciarCamara(id);
                                            }}
                                            className="bg-transparent text-white text-[11px] focus:outline-none"
                                        >
                                            {dispositivos.map((d) => (
                                                <option
                                                    key={d.deviceId}
                                                    value={d.deviceId}
                                                    className="bg-neutral-900 text-white"
                                                >
                                                    {d.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setIsMirrored((prev) => !prev)}
                                    className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 backdrop-blur-sm transition-colors border shadow-sm ${
                                        isMirrored
                                            ? 'bg-emerald-600/90 text-white border-emerald-500'
                                            : 'bg-black/60 text-white/80 border-white/20 hover:text-white hover:bg-black/80'
                                    }`}
                                    title="Alternar vista en espejo"
                                >
                                    <FlipHorizontal2 className="size-3" />
                                    <span>{isMirrored ? 'Espejo: Sí' : 'Espejo: No'}</span>
                                </button>
                            </div>

                            {/* Banner inferior: colaborador identificado */}
                            {identificado && (
                                <div className="absolute bottom-3 inset-x-3 rounded-lg bg-emerald-950/80 backdrop-blur-md border border-emerald-500/80 p-3 shadow-lg flex items-center justify-between text-white animate-in fade-in slide-in-from-bottom-2 duration-200">
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                                            <CheckCircle2 className="size-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                                                    Coincidencia en vivo
                                                </span>
                                                <Badge className="bg-emerald-600 text-white text-[10px] h-4">
                                                    {infoIdentidad?.confidence ?? 0}%
                                                </Badge>
                                            </div>
                                            <p className="text-sm font-bold leading-tight">
                                                {identificado.nombres} {identificado.apellidos}
                                            </p>
                                            <p className="text-[11px] text-white/70">
                                                CC: {identificado.cedula}
                                                {identificado.cargo ? ` • ${identificado.cargo}` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    <Button
                                        type="button"
                                        onClick={confirmarSeleccion}
                                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs gap-1.5 shadow"
                                    >
                                        <UserCheck className="size-4" />
                                        Vincular colaborador
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-3 bg-muted/30 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                        <ScanFace className="size-4 text-emerald-600 dark:text-emerald-400" />
                        Sitúate de frente a la cámara. El sistema detecta y asocia al colaborador
                        automáticamente.
                    </p>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                        className="text-xs"
                    >
                        Cerrar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
