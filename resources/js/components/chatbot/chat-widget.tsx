import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MessageCircle, RotateCcw, Send, User, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MarkdownLite } from './markdown-lite';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

const STORAGE_KEY = 'adenar-chatbot-mensajes';
const AVATAR_ASISTENTE = '/images/dario-avatar.webp';

function AvatarAsistente({ className }: { className?: string }) {
    return (
        <div className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted', className)}>
            <img src={AVATAR_ASISTENTE} alt="Mijito" className="size-full object-cover" />
        </div>
    );
}

const PREGUNTAS_SUGERIDAS = ['¿Qué es DPO y cuáles son sus 7 pilares?', '¿Cuál es el sueño del CD y sus KPIs?', 'Límites de velocidad', '¿Qué son las 5-S?'];

function leerHistorialGuardado(): ChatMessage[] {
    try {
        const crudo = window.localStorage.getItem(STORAGE_KEY);
        if (!crudo) return [];
        const datos = JSON.parse(crudo);
        return Array.isArray(datos) ? datos : [];
    } catch {
        return [];
    }
}

function guardarHistorial(mensajes: ChatMessage[]) {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mensajes));
    } catch {
        // localStorage puede no estar disponible (modo privado, cuota llena); no es crítico.
    }
}

function leerCookie(nombre: string): string | null {
    const match = document.cookie.match(new RegExp('(?:^|; )' + nombre + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Widget flotante de chatbot, disponible para todos los roles (se monta una
 * sola vez en AppSidebarLayout). Responde tanto preguntas generales como
 * preguntas del folleto DPO, vía POST /chatbot/mensaje (Groq en el backend).
 * El historial se guarda solo en localStorage del navegador — no hay
 * persistencia en servidor.
 */
export function ChatWidget() {
    const [abierto, setAbierto] = useState(false);
    const [mensajes, setMensajes] = useState<ChatMessage[]>([]);
    const [texto, setTexto] = useState('');
    const [enviando, setEnviando] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setMensajes(leerHistorialGuardado());
    }, []);

    useEffect(() => {
        if (mensajes.length > 0) guardarHistorial(mensajes);
    }, [mensajes]);

    useEffect(() => {
        if (!scrollRef.current) return;
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [mensajes, enviando, abierto]);

    useEffect(() => {
        if (abierto) inputRef.current?.focus();
    }, [abierto]);

    async function enviarMensaje(contenido: string) {
        const mensaje = contenido.trim();
        if (!mensaje || enviando) return;

        const historialPrevio = mensajes;
        const siguientes: ChatMessage[] = [...historialPrevio, { role: 'user', content: mensaje }];
        setMensajes(siguientes);
        setTexto('');
        setEnviando(true);

        try {
            const respuesta = await fetch(route('chatbot.send'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': leerCookie('XSRF-TOKEN') ?? '',
                },
                body: JSON.stringify({
                    mensaje,
                    // Debe coincidir con ChatbotController::MAX_HISTORIAL en el backend.
                    historial: historialPrevio.slice(-10),
                }),
            });

            const datos = await respuesta.json().catch(() => null);

            if (!respuesta.ok || !datos?.message) {
                throw new Error(datos?.message ?? 'No se pudo obtener respuesta del asistente.');
            }

            setMensajes((prev) => [...prev, { role: 'assistant', content: datos.message }]);
        } catch (error) {
            const mensajeError = error instanceof Error ? error.message : 'No pude conectarme con el asistente. Intenta de nuevo en unos segundos.';
            setMensajes((prev) => [...prev, { role: 'assistant', content: mensajeError }]);
        } finally {
            setEnviando(false);
        }
    }

    function nuevaConversacion() {
        setMensajes([]);
        try {
            window.localStorage.removeItem(STORAGE_KEY);
        } catch {
            // Ignorar si localStorage no está disponible.
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setAbierto((valor) => !valor)}
                aria-label={abierto ? 'Cerrar asistente' : 'Abrir asistente'}
                className="fixed right-5 bottom-5 z-50 flex size-14 items-center justify-center rounded-full text-white shadow-lg transition-transform duration-200 hover:scale-105 active:scale-95"
                style={{ backgroundImage: 'linear-gradient(135deg, #3F7A22, #264F13)' }}
            >
                {abierto ? <X className="size-6" /> : <MessageCircle className="size-6" />}
            </button>

            {abierto && (
                <div className="animate-in slide-in-from-bottom-4 fade-in fixed right-5 bottom-24 z-50 flex h-[32rem] max-h-[75vh] w-[92vw] max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl duration-200">
                    <div
                        className="flex shrink-0 items-center gap-3 px-4 py-3 text-white"
                        style={{ backgroundImage: 'linear-gradient(135deg, #3F7A22, #264F13)' }}
                    >
                        <AvatarAsistente className="size-9 ring-2 ring-white/30" />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">Mijito Chat Bot</p>
                            <p className="truncate text-xs text-white/80">Pregúntame sobre DPO, indicadores o el sistema</p>
                        </div>
                        <button
                            type="button"
                            onClick={nuevaConversacion}
                            title="Nueva conversación"
                            aria-label="Nueva conversación"
                            className="shrink-0 rounded-md p-1.5 opacity-90 hover:bg-white/15 hover:opacity-100"
                        >
                            <RotateCcw className="size-4" />
                        </button>
                    </div>

                    <div ref={scrollRef} className="flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-3 py-4">
                        {mensajes.length === 0 && (
                            <div className="flex flex-col gap-3">
                                <div className="flex items-start gap-2">
                                    <AvatarAsistente className="size-7" />
                                    <div className="min-w-0 rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm text-foreground">
                                        ¡Hola! Soy Mijito, el asistente de ADENAR S.A.S. Puedo ayudarte con preguntas del modelo DPO,
                                        indicadores, seguridad, flota, o cualquier otra duda que tengas.
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 pl-9">
                                    {PREGUNTAS_SUGERIDAS.map((pregunta) => (
                                        <button
                                            key={pregunta}
                                            type="button"
                                            onClick={() => enviarMensaje(pregunta)}
                                            className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-[#3F7A22] hover:text-[#3F7A22]"
                                        >
                                            {pregunta}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {mensajes.map((mensaje, indice) => (
                            <div key={indice} className={cn('flex items-start gap-2', mensaje.role === 'user' && 'flex-row-reverse')}>
                                {mensaje.role === 'user' ? (
                                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#3F7A22]/15 text-[#3F7A22]">
                                        <User className="size-4" />
                                    </div>
                                ) : (
                                    <AvatarAsistente className="size-7" />
                                )}
                                <div
                                    className={cn(
                                        'min-w-0 max-w-[85%] rounded-2xl px-3 py-2 text-sm break-words',
                                        mensaje.role === 'user'
                                            ? 'rounded-tr-sm bg-[#3F7A22] whitespace-pre-wrap text-white'
                                            : 'rounded-tl-sm bg-muted text-foreground',
                                    )}
                                >
                                    {mensaje.role === 'user' ? mensaje.content : <MarkdownLite texto={mensaje.content} />}
                                </div>
                            </div>
                        ))}

                        {enviando && (
                            <div className="flex items-start gap-2">
                                <AvatarAsistente className="size-7" />
                                <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-3 py-2.5">
                                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
                                </div>
                            </div>
                        )}
                    </div>

                    <form
                        onSubmit={(evento) => {
                            evento.preventDefault();
                            enviarMensaje(texto);
                        }}
                        className="flex shrink-0 items-center gap-2 border-t border-border p-3"
                    >
                        <Input
                            ref={inputRef}
                            value={texto}
                            onChange={(evento) => setTexto(evento.target.value)}
                            placeholder="Escribe tu pregunta..."
                            disabled={enviando}
                            className="h-9"
                        />
                        <Button type="submit" size="icon" className="size-9 shrink-0" disabled={enviando || texto.trim().length === 0}>
                            <Send className="size-4" />
                        </Button>
                    </form>
                </div>
            )}
        </>
    );
}
