import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
    Camera,
    CheckCircle2,
    FlipHorizontal2,
    Loader2,
    RefreshCw,
    ScanFace,
    TriangleAlert,
    UserCheck,
    Video,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface ColaboradorItem {
    id: number;
    nombres: string;
    apellidos: string;
    cedula: string;
    cargo?: string;
}

// Construye las URLs del servicio facial a partir de VITE_FACIAL_SERVICE_URL.
// En local (sin la variable) usa 127.0.0.1:8001.
// En Railway se debe configurar VITE_FACIAL_SERVICE_URL=https://tu-servicio.up.railway.app
// y VITE_FACIAL_API_KEY con el mismo valor que FACIAL_API_KEY del servicio Python.
function buildFacialUrls(): { wsUrl: string; httpUrl: string } {
    const base = (import.meta.env.VITE_FACIAL_SERVICE_URL as string | undefined)?.replace(/\/$/, '');
    if (base) {
        const wsBase = base.replace(/^https?:\/\//, (m) => (m === 'https://' ? 'wss://' : 'ws://'));
        const apiKey = (import.meta.env.VITE_FACIAL_API_KEY as string | undefined) ?? '';
        const token = apiKey ? `?token=${encodeURIComponent(apiKey)}` : '';
        return {
            wsUrl: `${wsBase}/ws/reconocer${token}`,
            httpUrl: `${base}/frame`,
        };
    }
    return {
        wsUrl: 'ws://127.0.0.1:8001/ws/reconocer',
        httpUrl: 'http://127.0.0.1:8001/frame',
    };
}

const { wsUrl: DEFAULT_WS_URL, httpUrl: DEFAULT_HTTP_URL } = buildFacialUrls();
const FACIAL_API_KEY = (import.meta.env.VITE_FACIAL_API_KEY as string | undefined) ?? '';

interface LiveDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    colaboradores: ColaboradorItem[];
    onColaboradorSeleccionado: (colaborador: ColaboradorItem, fotoCapturada?: File) => void;
    fastApiWsUrl?: string;
    fastApiHttpUrl?: string;
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

    const [error, setError] = useState<string | null>(null);
    const [conectadoWs, setConectadoWs] = useState<boolean>(false);
    const [servicioOffline, setServicioOffline] = useState<boolean>(false);
    const [identificado, setIdentificado] = useState<ColaboradorItem | null>(null);
    const [infoIdentidad, setInfoIdentidad] = useState<IdentityResult | null>(null);
    const [dispositivos, setDispositivos] = useState<{ deviceId: string; label: string }[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [fps, setFps] = useState<number>(0);
    const [isMirrored, setIsMirrored] = useState<boolean>(false);
    const isMirroredRef = useRef<boolean>(false);
    isMirroredRef.current = isMirrored;
    const errorCountRef = useRef<number>(0);
    // Ref para que el closure del useEffect siempre llame la versión actualizada
    const handleFrameResponseRef = useRef<(data: FrameResponse) => void>(() => {});

    const colaboradoresMap = useRef<Map<number, ColaboradorItem>>(new Map());

    useEffect(() => {
        const map = new Map<number, ColaboradorItem>();
        colaboradores.forEach((c) => map.set(c.id, c));
        colaboradoresMap.current = map;
    }, [colaboradores]);

    const detenerStream = useCallback(() => {
        if (loopTimerRef.current) {
            clearTimeout(loopTimerRef.current);
            loopTimerRef.current = null;
        }
        if (wsRef.current) {
            try {
                wsRef.current.close();
            } catch {
                // ignorar error al cerrar WebSocket
            }
            wsRef.current = null;
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setIdentificado(null);
        setInfoIdentidad(null);
        setConectadoWs(false);
    }, []);

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
            let targetId = deviceIdToUse || selectedDeviceId;

            // Priorizar cámara real que no sea virtual
            if (!targetId && navigator.mediaDevices.enumerateDevices) {
                try {
                    const allDevs = await navigator.mediaDevices.enumerateDevices();
                    const vDevs = allDevs.filter((d) => d.kind === 'videoinput');
                    const real = vDevs.find((d) => d.label && !esCamaraVirtual(d.label));
                    if (real?.deviceId) {
                        targetId = real.deviceId;
                    }
                } catch {
                    // ignorar error al enumerar dispositivos
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
                    console.warn('Video play interrupted:', e);
                }
            }

            // Enumerate
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
                const activeId = track?.getSettings()?.deviceId || targetId || vInputs[0]?.deviceId;
                if (activeId) setSelectedDeviceId(activeId);
            }
        } catch {
            setError('No se pudo acceder a la cámara seleccionada.');
        }
    }, [selectedDeviceId]);

    // Conectar WebSocket y ciclo de análisis
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
            };

            ws.onmessage = (event) => {
                isSendingRef.current = false;
                console.log('[Reconocimiento facial][WebSocket] mensaje completo recibido:', event.data);
                try {
                    const data: FrameResponse = JSON.parse(event.data);
                    handleFrameResponseRef.current(data);
                } catch (e) {
                    console.error('Error parseando frame live:', e);
                }
            };

            ws.onerror = () => {
                setConectadoWs(false);
            };

            ws.onclose = () => {
                setConectadoWs(false);
            };
        } catch {
            // WebSocket no disponible; el estado conectadoWs ya es false
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
                // Escala de inferencia eficiente
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
                                // Fallback HTTP si WS no está disponible
                                isSendingRef.current = true;
                                try {
                                    const fd = new FormData();
                                    fd.append('foto', blob, 'frame.jpg');
                                    const headers: Record<string, string> = {};
                                    if (FACIAL_API_KEY) headers['X-Api-Key'] = FACIAL_API_KEY;
                                    const resp = await fetch(fastApiHttpUrl, { method: 'POST', body: fd, headers });
                                    const responseBody = await resp.clone().text();
                                    console.log('[Reconocimiento facial][HTTP] respuesta completa:', {
                                        url: fastApiHttpUrl,
                                        status: resp.status,
                                        statusText: resp.statusText,
                                        body: responseBody,
                                    });
                                    if (resp.ok) {
                                        errorCountRef.current = 0;
                                        setServicioOffline(false);
                                        const resData: FrameResponse = await resp.json();
                                        handleFrameResponseRef.current(resData);
                                    } else {
                                        errorCountRef.current++;
                                        if (errorCountRef.current >= 3) setServicioOffline(true);
                                    }
                                } catch (e) {
                                    console.error('[Reconocimiento facial][HTTP] error en la petición:', e);
                                    errorCountRef.current++;
                                    if (errorCountRef.current >= 3) setServicioOffline(true);
                                }
                                isSendingRef.current = false;
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
    }, [open, fastApiWsUrl, fastApiHttpUrl, iniciarCamara, detenerStream]);

    // Procesar respuesta del frame y dibujar en canvas
    const handleFrameResponse = (data: FrameResponse) => {        const video = videoRef.current;
        const canvas = overlayCanvasRef.current;
        if (!video || !canvas || video.videoWidth === 0) return;

        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const faces = data.faces || [];
        let principalIdentificado: ColaboradorItem | null = null;
        let principalInfo: IdentityResult | null = null;

        // data.w y data.h corresponden a la resolución del fotograma enviado al backend (targetW x targetH)
        const frameW = data.w && data.w > 0 ? data.w : 480;
        const frameH = data.h && data.h > 0 ? data.h : Math.round((video.videoHeight / video.videoWidth) * frameW);

        // Factores de escalado exactos para llevar las coordenadas al tamaño real del video/canvas
        const scaleX = canvas.width / frameW;
        const scaleY = canvas.height / frameH;

        faces.forEach((f) => {
            const rawX = f.box[0] * scaleX;
            const rawY = f.box[1] * scaleY;
            const w = f.box[2] * scaleX;
            const h = f.box[3] * scaleY;

            // Si la vista está en modo espejo, invertir X para calzar exactamente con el video
            const x = isMirroredRef.current ? canvas.width - rawX - w : rawX;
            const y = rawY;

            // Identidad individual de este rostro específico
            const faceIdentity = f.identity ?? (faces.length === 1 ? data.identity : null);

            let color = '#38bdf8'; // azul por defecto (rostro detectado)
            let texto = 'Rostro detectado';

            if (faceIdentity) {
                if (faceIdentity.status === 'match') {
                    // Caso 1 y Caso 3: Coincidencia confiable -> mostrar nombre y %
                    color = '#10b981'; // Verde esmeralda ADENAR
                    const colab = faceIdentity.colaborador_id
                        ? colaboradoresMap.current.get(faceIdentity.colaborador_id)
                        : null;
                    const nombre = colab ? `${colab.nombres} ${colab.apellidos}` : 'Identificado';
                    texto = `✓ ${nombre} (${faceIdentity.confidence ?? 0}%)`;

                    if (colab && (!principalIdentificado || (faceIdentity.confidence ?? 0) > (principalInfo?.confidence ?? 0))) {
                        principalIdentificado = colab;
                        principalInfo = faceIdentity;
                    }
                } else if (faceIdentity.status === 'uncertain') {
                    // Coincidencia dudosa
                    color = '#f59e0b'; // Ámbar
                    const colab = faceIdentity.colaborador_id
                        ? colaboradoresMap.current.get(faceIdentity.colaborador_id)
                        : null;
                    const nombre = colab ? `${colab.nombres}` : 'Incierto';
                    texto = `? ${nombre} (${faceIdentity.confidence ?? 0}%)`;
                    if (colab && !principalIdentificado) {
                        principalIdentificado = colab;
                        principalInfo = faceIdentity;
                    }
                } else {
                    // Caso 2: Rostro desconocido -> Mostrar estrictamente "No registrado"
                    color = '#ef4444'; // Rojo
                    texto = 'No registrado';
                }
            }

            // Fondo sutil en la zona del rostro
            ctx.fillStyle = color === '#10b981' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(56, 189, 248, 0.05)';
            ctx.fillRect(x, y, w, h);

            // Borde del recuadro
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, 8);
            ctx.stroke();

            // Esquinas resaltadas de enfoque biométrico
            const cornerLen = Math.min(24, w * 0.2, h * 0.2);
            ctx.lineWidth = 4.5;
            ctx.beginPath();
            // Superior izquierda
            ctx.moveTo(x, y + cornerLen);
            ctx.lineTo(x, y);
            ctx.lineTo(x + cornerLen, y);
            // Superior derecha
            ctx.moveTo(x + w - cornerLen, y);
            ctx.lineTo(x + w, y);
            ctx.lineTo(x + w, y + cornerLen);
            // Inferior izquierda
            ctx.moveTo(x, y + h - cornerLen);
            ctx.lineTo(x, y + h);
            ctx.lineTo(x + cornerLen, y + h);
            // Inferior derecha
            ctx.moveTo(x + w - cornerLen, y + h);
            ctx.lineTo(x + w, y + h);
            ctx.lineTo(x + w, y + h - cornerLen);
            ctx.stroke();

            // Etiqueta superior con alto contraste
            ctx.font = 'bold 14px sans-serif';
            const textWidth = ctx.measureText(texto).width;
            const badgeW = textWidth + 16;
            const badgeH = 26;
            const badgeY = y > badgeH + 6 ? y - badgeH - 6 : y + h + 6;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
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
            // Limpiar identificación si no hay rostros en el frame
            setIdentificado(null);
            setInfoIdentidad(null);
        }
    };
    // Mantener el ref siempre actualizado con la última versión de la función
    handleFrameResponseRef.current = handleFrameResponse;

    const confirmarSeleccion = () => {
        if (!identificado) return;

        // Capturar fotograma actual para adjuntar
        const video = videoRef.current;
        if (video && video.videoWidth > 0) {
            const c = document.createElement('canvas');
            c.width = video.videoWidth;
            c.height = video.videoHeight;
            c.getContext('2d')?.drawImage(video, 0, 0);
            c.toBlob((blob) => {
                const foto = blob ? new File([blob], `reconocimiento-${Date.now()}.jpg`, { type: 'image/jpeg' }) : undefined;
                onColaboradorSeleccionado(identificado, foto);
                onOpenChange(false);
            }, 'image/jpeg', 0.85);
        } else {
            onColaboradorSeleccionado(identificado);
            onOpenChange(false);
        }
    };

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
                                className={conectadoWs ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50 text-[10px]' : 'border-amber-500 text-amber-600 text-[10px]'}
                            >
                                <span className={`mr-1 size-1.5 rounded-full inline-block ${conectadoWs ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'}`} />
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
                            <Button size="sm" variant="secondary" onClick={() => void iniciarCamara()} className="mt-2 text-xs">
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
                                className={`h-full w-full object-cover transition-transform duration-200 ${isMirrored ? '-scale-x-100' : ''}`}
                            />
                            <canvas
                                ref={overlayCanvasRef}
                                className="absolute inset-0 h-full w-full pointer-events-none object-cover"
                            />

                            {/* Alerta de servicio offline */}
                            {servicioOffline && (
                                <div className="absolute top-3 inset-x-3 rounded-lg bg-amber-950/90 border border-amber-500/70 p-3 text-amber-200 text-xs flex items-center justify-between shadow-lg z-20 backdrop-blur-sm animate-in fade-in">
                                    <div className="flex items-center gap-2">
                                        <TriangleAlert className="size-4 shrink-0 text-amber-400" />
                                        <span>El servicio de reconocimiento facial se está reconectando en el puerto 8001...</span>
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

                            {/* Selector de cámara y alternador de espejo */}
                            <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
                                {dispositivos.length > 1 && (
                                    <div className="bg-black/60 backdrop-blur-sm rounded-md px-2 py-1 flex items-center gap-1.5 border border-white/20">
                                        <Video className="size-3 text-white/80" />
                                        <select
                                            value={selectedDeviceId}
                                            onChange={(e) => {
                                                const id = e.target.value;
                                                setSelectedDeviceId(id);
                                                void iniciarCamara(id);
                                            }}
                                            className="bg-transparent text-white text-[11px] focus:outline-none"
                                        >
                                            {dispositivos.map((d) => (
                                                <option key={d.deviceId} value={d.deviceId} className="bg-neutral-900 text-white">
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

                            {/* Banner inferior dentro del video si hay match */}
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
                                                CC: {identificado.cedula} {identificado.cargo ? `• ${identificado.cargo}` : ''}
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
                        Sitúate de frente a la cámara. El sistema detecta y asocia al colaborador automáticamente.
                    </p>

                    <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
                        Cerrar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
