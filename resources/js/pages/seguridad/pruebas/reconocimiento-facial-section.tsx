import { CameraCaptureDialog } from '@/components/camera-capture-dialog';
import { ReconocimientoFacialLiveDialog } from '@/pages/seguridad/pruebas/reconocimiento-facial-live-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Camera,
    CheckCircle2,
    AlertTriangle,
    UserX,
    Upload,
    ScanFace,
    UserCheck,
    Loader2,
    X,
    Radio,
    Sparkles,
    ChevronDown,
    type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';

/** Tipo único de colaborador: el diálogo en vivo debe importarlo desde aquí. */
export interface ColaboradorReconocido {
    id: number;
    nombres: string;
    apellidos: string;
    cedula: string;
    cargo?: string | null;
}

/** Métricas reales de la identificación en vivo (el diálogo debe enviarlas). */
export interface IdentificacionMeta {
    confidence?: number;
    similarity?: number;
}

export interface ResultadoReconocimiento {
    success: boolean;
    status: 'match' | 'uncertain' | 'no_match' | 'no_face' | 'sin_candidatos' | 'service_unavailable' | 'error';
    target_face_detected?: boolean;
    confidence?: number;
    distance?: number;
    similarity?: number;
    threshold?: number;
    colaborador?: ColaboradorReconocido | null;
    nombres?: string;
    apellidos?: string;
    cedula?: string;
    cargo?: string | null;
    colaborador_id?: number;
    message?: string;
    elapsed_seconds?: number;
}

interface Props {
    colaboradores?: ColaboradorReconocido[];
    facialServiceUrl: string;
    facialGalleryStatus: { ready: boolean; loaded: number; message?: string | null };
    onColaboradorIdentificado: (colaboradorId: number, foto?: File) => void;
    colaboradorSeleccionadoId?: string;
}

const MAX_FOTO_BYTES = 5 * 1024 * 1024; // igual que FACIAL_MAX_UPLOAD en el servicio
const RECONOCER_URL = '/modules/seguridad/pruebas/reconocer-rostro';

const MENSAJES: Record<
    'no_match' | 'no_face' | 'sin_candidatos' | 'service_unavailable' | 'error',
    { icono: LucideIcon; titulo: string; texto: string; tono: string }
> = {
    no_match: {
        icono: UserX,
        titulo: 'Persona no identificada',
        texto: 'No se encontró coincidencia con los colaboradores registrados con fotografía.',
        tono: 'bg-slate-400',
    },
    no_face: {
        icono: ScanFace,
        titulo: 'No se detectó un rostro',
        texto: 'Colócate de frente, con buena iluminación, e inténtalo de nuevo.',
        tono: 'bg-slate-400',
    },
    sin_candidatos: {
        icono: AlertTriangle,
        titulo: 'Sin fotografías para comparar',
        texto: 'Ningún colaborador tiene una fotografía que se pueda procesar.',
        tono: 'bg-amber-500',
    },
    service_unavailable: {
        icono: AlertTriangle,
        titulo: 'Servicio no disponible',
        texto: 'El servicio de reconocimiento no está disponible en este momento.',
        tono: 'bg-slate-400',
    },
    error: {
        icono: AlertTriangle,
        titulo: 'No se pudo completar el análisis',
        texto: 'Inténtalo de nuevo en unos instantes.',
        tono: 'bg-slate-400',
    },
};

/** Los datos del colaborador pueden venir en el resultado o resolverse por id desde la lista. */
function resolverColaborador(r: ResultadoReconocimiento, lista: ColaboradorReconocido[]) {
    const porId = lista.find((c) => c.id === r.colaborador_id);
    const fuente = r.colaborador ?? porId;
    return {
        nombre: `${r.nombres ?? fuente?.nombres ?? ''} ${r.apellidos ?? fuente?.apellidos ?? ''}`.trim(),
        cedula: r.cedula ?? fuente?.cedula,
        cargo: r.cargo ?? fuente?.cargo,
    };
}

function Confianza({ valor, className }: { valor?: number; className: string }) {
    if (valor == null) return null; // 0 es un valor válido: no usar `&&`
    return <span className={`text-xs font-semibold ${className}`}>{valor}% de confianza</span>;
}

interface ColaboradorCardProps {
    tipo: 'match' | 'uncertain';
    resultado: ResultadoReconocimiento;
    nombre: string;
    cedula?: string;
    cargo?: string | null;
    children?: ReactNode;
}

function ColaboradorCard({ tipo, resultado, nombre, cedula, cargo, children }: ColaboradorCardProps) {
    const esMatch = tipo === 'match';
    const Icono = esMatch ? CheckCircle2 : AlertTriangle;

    return (
        <div
            className={
                esMatch
                    ? 'rounded-lg border-2 border-emerald-500 bg-emerald-50/60 p-4 dark:border-emerald-600 dark:bg-emerald-950/30'
                    : 'rounded-lg border-2 border-amber-400 bg-amber-50/60 p-4 dark:border-amber-600 dark:bg-amber-950/30'
            }
        >
            <div className="flex items-start gap-3">
                <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full text-white ${esMatch ? 'bg-emerald-500' : 'bg-amber-500'}`}
                >
                    <Icono className="size-5" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        {esMatch ? (
                            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 text-xs">Coincidencia confiable</Badge>
                        ) : (
                            <Badge
                                variant="outline"
                                className="border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 text-xs"
                            >
                                Resultado incierto
                            </Badge>
                        )}
                        <Confianza
                            valor={resultado.confidence}
                            className={esMatch ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}
                        />
                    </div>

                    <p className={esMatch ? 'mt-2 text-base font-bold text-foreground' : 'mt-2 text-sm font-semibold text-foreground'}>
                        {esMatch ? nombre : `Posible: ${nombre}`}
                    </p>

                    {cedula && (
                        <p className="text-xs text-muted-foreground">
                            Cédula / Documento: <span className="font-medium text-foreground">{cedula}</span>
                        </p>
                    )}
                    {cargo && (
                        <p className="text-xs text-muted-foreground">
                            Cargo: <span className="font-medium text-foreground">{cargo}</span>
                        </p>
                    )}

                    {!esMatch && (
                        <p className="mt-1.5 text-xs text-amber-800 dark:text-amber-300">
                            {resultado.message || 'La similitud no es concluyente. Por favor confirma la identidad.'}
                        </p>
                    )}

                    <div className="mt-3 flex items-center gap-2">{children}</div>
                </div>
            </div>
        </div>
    );
}

export function ReconocimientoFacialSection({
    colaboradores = [],
    facialServiceUrl,
    facialGalleryStatus,
    onColaboradorIdentificado,
    colaboradorSeleccionadoId,
}: Props) {
    const [seccionAbierta, setSeccionAbierta] = useState(false);
    const [liveAbierto, setLiveAbierto] = useState(false);
    const [camaraAbierta, setCamaraAbierta] = useState(false);
    const [fotoCapturada, setFotoCapturada] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [procesando, setProcesando] = useState(false);
    const [resultado, setResultado] = useState<ResultadoReconocimiento | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    // La URL del preview se crea y se revoca en un solo lugar: al cambiar la foto y al desmontar.
    useEffect(() => {
        if (!fotoCapturada) {
            setPreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(fotoCapturada);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [fotoCapturada]);

    // Cancela una comparación en curso si el componente se desmonta.
    useEffect(() => () => abortRef.current?.abort(), []);

    const handleFotoObtenida = useCallback((file: File) => {
        setFotoCapturada(file);
        setResultado(null);
    }, []);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setResultado({ success: false, status: 'error', message: 'El archivo seleccionado no es una imagen.' });
            return;
        }
        if (file.size > MAX_FOTO_BYTES) {
            setResultado({ success: false, status: 'error', message: 'La fotografía no debe superar los 5 MB.' });
            return;
        }
        handleFotoObtenida(file);
    };

    const limpiarFoto = () => {
        abortRef.current?.abort();
        setFotoCapturada(null);
        setResultado(null);
    };

    const handleLiveIdentificado = (colaborador: ColaboradorReconocido, foto?: File, meta?: IdentificacionMeta) => {
        if (foto) handleFotoObtenida(foto);
        setResultado({
            success: true,
            status: 'match',
            confidence: meta?.confidence, // dato real del servicio; si falta, no se muestra
            similarity: meta?.similarity,
            colaborador_id: colaborador.id,
            nombres: colaborador.nombres,
            apellidos: colaborador.apellidos,
            cedula: colaborador.cedula,
            cargo: colaborador.cargo,
            message: 'Identificado en tiempo real.',
        });
        onColaboradorIdentificado(colaborador.id, foto);
    };

    const ejecutarComparacion = async () => {
        if (!fotoCapturada) return;

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setProcesando(true);
        setResultado(null);

        try {
            const formData = new FormData();
            formData.append('foto', fotoCapturada);

            const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

            const response = await fetch(RECONOCER_URL, {
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': csrf || '', Accept: 'application/json' },
                body: formData,
                signal: controller.signal,
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                setResultado({
                    success: false,
                    status: 'error',
                    message: errData?.message || 'No se pudo comunicar con el servicio de reconocimiento.',
                });
                return;
            }

            const data: ResultadoReconocimiento = await response.json();
            setResultado(data);

            if (data.status === 'match' && data.colaborador_id) {
                onColaboradorIdentificado(data.colaborador_id, fotoCapturada);
            }
        } catch (err) {
            if ((err as DOMException)?.name === 'AbortError') return;
            console.warn('Reconocimiento facial: fallo de conexión', err);
            setResultado({
                success: false,
                status: 'service_unavailable',
                message: 'No fue posible conectar con el servicio de reconocimiento.',
            });
        } finally {
            if (abortRef.current === controller) setProcesando(false);
        }
    };

    const seleccionar = () => {
        if (resultado?.colaborador_id) {
            onColaboradorIdentificado(resultado.colaborador_id, fotoCapturada ?? undefined);
        }
    };

    const datos = useMemo(
        () => (resultado ? resolverColaborador(resultado, colaboradores) : null),
        [resultado, colaboradores],
    );

    const yaSeleccionado =
        resultado?.colaborador_id != null && String(colaboradorSeleccionadoId) === String(resultado.colaborador_id);

    const renderResultado = () => {
        if (!resultado || !datos) return null;

        if (resultado.status === 'match' || resultado.status === 'uncertain') {
            const esMatch = resultado.status === 'match';
            return (
                <ColaboradorCard tipo={resultado.status} resultado={resultado} {...datos}>
                    {resultado.colaborador_id != null && (
                        <Button
                            type="button"
                            size="sm"
                            variant={esMatch ? 'default' : 'outline'}
                            onClick={seleccionar}
                            className={
                                esMatch
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 text-xs gap-1.5 shadow-sm'
                                    : 'border-amber-400 hover:bg-amber-100 text-xs gap-1.5 dark:border-amber-700'
                            }
                        >
                            <UserCheck className="size-3.5" />
                            {esMatch
                                ? yaSeleccionado
                                    ? 'Colaborador seleccionado'
                                    : 'Seleccionar colaborador'
                                : 'Confirmar y seleccionar'}
                        </Button>
                    )}
                </ColaboradorCard>
            );
        }

        const info = MENSAJES[resultado.status];
        const Icono = info.icono;
        return (
            <div className="rounded-lg border border-slate-300 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                <div className="flex items-start gap-3">
                    <div className={`flex size-9 shrink-0 items-center justify-center rounded-full text-white ${info.tono}`}>
                        <Icono className="size-5" />
                    </div>
                    <div>
                        <Badge variant="secondary" className="text-xs">
                            {info.titulo}
                        </Badge>
                        <p className="mt-2 text-xs text-muted-foreground">{resultado.message || info.texto}</p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/40 to-background p-4 shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/10">
            {/* Encabezado — clic para plegar/desplegar */}
            <button
                type="button"
                onClick={() => setSeccionAbierta((v) => !v)}
                aria-expanded={seccionAbierta}
                className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
            >
                <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm dark:bg-emerald-500">
                        <ScanFace className="size-4" />
                    </div>
                    <div>
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            Reconocimiento Facial
                            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
                                En tiempo real
                            </span>
                        </h4>
                        <p className="text-xs text-muted-foreground">
                            Identifica al colaborador con la cámara o analiza una fotografía
                        </p>
                    </div>
                </div>

                <ChevronDown
                    className={`size-4 shrink-0 text-emerald-600 transition-transform duration-200 dark:text-emerald-400 ${seccionAbierta ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Contenido plegable */}
            {seccionAbierta && (
                <>
                    {/* Separador + botón de cámara en vivo */}
                    <div className="mt-3 flex flex-wrap items-center justify-end border-t border-emerald-100 pt-3 dark:border-emerald-900/40">
                        <p
                            role={facialGalleryStatus.ready ? 'status' : 'alert'}
                            className={`mr-auto text-xs ${facialGalleryStatus.ready ? 'text-emerald-700 dark:text-emerald-300' : 'text-destructive'}`}
                        >
                            {facialGalleryStatus.ready
                                ? `Galería sincronizada: ${facialGalleryStatus.loaded} colaboradores.`
                                : facialGalleryStatus.message ||
                                  'No se cargó la galería facial. Verifica FACIAL_API_URL y FACIAL_API_KEY en Railway.'}
                        </p>
                        <Button
                            type="button"
                            onClick={() => setLiveAbierto(true)}
                            disabled={!facialGalleryStatus.ready}
                            className="gap-1.5 bg-emerald-600 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                        >
                            <Radio className="size-3.5 animate-pulse text-emerald-200" />
                            Iniciar Cámara en Vivo
                        </Button>
                    </div>

                    {/* Contenido principal */}
                    <div className="mt-4 grid items-start gap-4 sm:grid-cols-12">
                        {/* Fotografía */}
                        <div className="flex flex-col items-center sm:col-span-5">
                            {previewUrl ? (
                                <div className="relative w-full max-w-[220px]">
                                    <img
                                        src={previewUrl}
                                        alt="Fotografía capturada"
                                        className="aspect-square w-full rounded-lg border-2 border-emerald-500/60 object-cover shadow-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={limpiarFoto}
                                        title="Quitar foto"
                                        aria-label="Quitar fotografía"
                                        className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600"
                                    >
                                        <X className="size-3.5" />
                                    </button>
                                    <div className="mt-1 text-center text-[11px] text-muted-foreground">Fotografía asociada</div>
                                </div>
                            ) : (
                                <div className="flex aspect-square w-full max-w-[220px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-emerald-300/70 bg-emerald-50/30 p-4 text-center dark:border-emerald-800/60 dark:bg-emerald-950/10">
                                    <Camera className="mb-2 size-10 text-emerald-600/70 dark:text-emerald-400/70" />
                                    <p className="text-xs font-medium text-foreground">Sin fotografía estática</p>
                                    <p className="mt-1 text-[11px] text-muted-foreground">
                                        Inicia la cámara en vivo o adjunta una imagen
                                    </p>
                                </div>
                            )}

                            <div className="mt-3 flex w-full max-w-[220px] flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCamaraAbierta(true)}
                                    className="flex-1 gap-1.5 border-emerald-300 text-xs hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/40"
                                >
                                    <Camera className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                    Foto estática
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="gap-1.5 text-xs"
                                >
                                    <Upload className="size-3.5" />
                                    Subir
                                </Button>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    aria-label="Subir fotografía"
                                    onChange={handleFileChange}
                                />
                            </div>

                            {previewUrl && (
                                <Button
                                    type="button"
                                    onClick={ejecutarComparacion}
                                    disabled={procesando}
                                    className="mt-3 w-full max-w-[220px] gap-2 bg-emerald-600 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                                >
                                    {procesando ? (
                                        <>
                                            <Loader2 className="size-4 animate-spin" />
                                            Comparando...
                                        </>
                                    ) : (
                                        <>
                                            <ScanFace className="size-4" />
                                            Analizar fotografía
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>

                        {/* Resultados */}
                        <div className="flex flex-col justify-center sm:col-span-7" aria-live="polite">
                            {procesando && (
                                <div className="flex flex-col items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50/40 p-6 text-center dark:border-emerald-800/50 dark:bg-emerald-950/20">
                                    <Loader2 className="mb-2 size-8 animate-spin text-emerald-600 dark:text-emerald-400" />
                                    <p className="text-sm font-semibold text-foreground">Analizando fotografía...</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Comparando el rostro con los colaboradores registrados.
                                    </p>
                                </div>
                            )}

                            {!procesando && !resultado && (
                                <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/20 p-4 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                                        <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
                                        <span>Reconocimiento en tiempo real:</span>
                                    </div>
                                    <p>
                                        Presiona <strong>"Iniciar Cámara en Vivo"</strong> para abrir la cámara. El sistema
                                        detectará el rostro mientras estás frente a la pantalla e indicará el nombre del
                                        colaborador y el nivel de confianza al instante.
                                    </p>
                                </div>
                            )}

                            {!procesando && renderResultado()}
                        </div>
                    </div>
                </>
            )}

            <ReconocimientoFacialLiveDialog
                open={liveAbierto}
                onOpenChange={setLiveAbierto}
                colaboradores={colaboradores}
                facialServiceUrl={facialServiceUrl}
                onColaboradorSeleccionado={handleLiveIdentificado}
            />

            <CameraCaptureDialog
                open={camaraAbierta}
                onOpenChange={setCamaraAbierta}
                onCapture={handleFotoObtenida}
                titulo="Tomar fotografía"
            />
        </div>
    );
}