<?php

namespace App\Http\Controllers;

use App\Support\Chatbot\DpoFaqKnowledgeBase;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Chatbot interno disponible para todos los roles autenticados (Seguridad,
 * Reparto, Gente, Flota, Administrador), montado como widget flotante en
 * AppSidebarLayout. Responde tanto preguntas generales (como cualquier IA)
 * como preguntas del "Folleto 2026 - Entrevista Reparto" (modelo DPO,
 * indicadores, políticas de seguridad, procesos de flota).
 *
 * Usa la API de Groq (compatible con el formato de chat completions de
 * OpenAI). El historial de la conversación lo maneja el cliente (no se
 * persiste en BD): en cada mensaje el frontend reenvía los últimos turnos.
 *
 * El plan gratuito de Groq limita a 8000 tokens por minuto por organización,
 * así que en vez de inyectar el folleto completo (~9000 tokens) en cada
 * petición, se seleccionan solo las entradas del folleto relacionadas con la
 * pregunta actual (ver DpoFaqKnowledgeBase::buscarRelevantes) y esas son las
 * que se agregan al system prompt.
 */
class ChatbotController extends Controller
{
    private const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

    // Cuántos turnos previos (usuario + asistente) se reenvían como
    // contexto, para no dejar crecer el costo/tamaño de la petición sin
    // límite en conversaciones largas.
    private const MAX_HISTORIAL = 10;

    // Cuántas entradas del folleto DPO se agregan como contexto por
    // pregunta (ver comentario de clase sobre el límite de tokens de Groq).
    private const MAX_FRAGMENTOS_FAQ = 6;

    // Los turnos del historial se truncan a esta longitud antes de mandarlos
    // a Groq (una respuesta anterior del asistente puede ser mucho más larga
    // que esto — no tiene sentido rechazar la petición completa por eso, así
    // que la validación de abajo es permisiva y el recorte pasa aquí).
    private const MAX_CARACTERES_POR_TURNO_HISTORIAL = 600;

    public function send(Request $request): JsonResponse
    {
        $validado = $request->validate([
            'mensaje' => ['required', 'string', 'max:2000'],
            'historial' => ['sometimes', 'array', 'max:'.self::MAX_HISTORIAL],
            'historial.*.role' => ['required_with:historial', 'string', 'in:user,assistant'],
            'historial.*.content' => ['required_with:historial', 'string', 'max:4000'],
        ]);

        $apiKey = config('services.groq.api_key');

        if (blank($apiKey)) {
            Log::error('Chatbot: falta GROQ_API_KEY en la configuración.');

            return response()->json([
                'message' => 'El asistente no está configurado todavía. Contacta al administrador del sistema.',
            ], 503);
        }

        $historial = array_slice($validado['historial'] ?? [], -self::MAX_HISTORIAL);
        $mensajeActual = $validado['mensaje'];

        $fragmentosFaq = DpoFaqKnowledgeBase::buscarRelevantes(
            $this->consultaParaBusqueda($mensajeActual, $historial),
            self::MAX_FRAGMENTOS_FAQ
        );

        $mensajes = [
            ['role' => 'system', 'content' => $this->systemPrompt($fragmentosFaq)],
            ...array_map(fn (array $turno) => [
                'role' => $turno['role'],
                'content' => $this->truncar($turno['content'], self::MAX_CARACTERES_POR_TURNO_HISTORIAL),
            ], $historial),
            ['role' => 'user', 'content' => $mensajeActual],
        ];

        $modelo = config('services.groq.model');

        $payload = [
            'model' => $modelo,
            'messages' => $mensajes,
            'temperature' => 0.4,
            // Los modelos "gpt-oss" gastan parte de este presupuesto en
            // razonamiento interno antes de escribir la respuesta visible
            // (ver reasoning_effort abajo), así que un límite bajo cortaba
            // respuestas a mitad de frase incluso para preguntas normales.
            'max_tokens' => 1536,
        ];

        // Los modelos de razonamiento "gpt-oss" de Groq soportan (y sin esto
        // pueden gastar el max_tokens completo "pensando", devolviendo el
        // contenido final vacío) el parámetro reasoning_effort. Otros modelos
        // del catálogo de Groq lo rechazan con un 400, así que solo se manda
        // cuando el modelo configurado es de esa familia.
        if (str_contains($modelo, 'gpt-oss')) {
            $payload['reasoning_effort'] = 'low';
        }

        try {
            $respuesta = Http::withToken($apiKey)
                ->timeout(45)
                ->post(self::GROQ_ENDPOINT, $payload);
        } catch (\Throwable $e) {
            Log::error('Chatbot: error al conectar con Groq.', ['error' => $e->getMessage()]);

            return response()->json([
                'message' => 'No pude conectarme con el asistente en este momento. Intenta de nuevo en unos segundos.',
            ], 502);
        }

        if ($respuesta->failed()) {
            Log::error('Chatbot: Groq respondió con error.', [
                'status' => $respuesta->status(),
                'body' => $respuesta->body(),
            ]);

            return response()->json([
                'message' => 'El asistente no pudo procesar tu pregunta. Intenta de nuevo en unos segundos.',
            ], 502);
        }

        $texto = $respuesta->json('choices.0.message.content');

        if (blank($texto)) {
            return response()->json([
                'message' => 'No obtuve una respuesta clara. ¿Puedes reformular tu pregunta?',
            ], 502);
        }

        // Si aun con el límite de arriba la respuesta se corta (pregunta
        // que pedía algo excepcionalmente extenso), que quede explícito en
        // vez de dejar una frase a medias sin avisar.
        if ($respuesta->json('choices.0.finish_reason') === 'length') {
            $texto .= "\n\n_(Respuesta recortada por longitud — escribe \"continúa\" para seguir.)_";
        }

        return response()->json(['message' => $texto]);
    }

    /**
     * Texto usado para buscar entradas relevantes del folleto: la pregunta
     * actual, más el último mensaje del usuario en el historial (si lo hay),
     * para que preguntas de seguimiento cortas ("¿y cuál es la meta?") sigan
     * encontrando el tema de la conversación.
     *
     * @param  array<int, array{role: string, content: string}>  $historial
     */
    private function consultaParaBusqueda(string $mensajeActual, array $historial): string
    {
        $ultimoTurnoUsuario = collect($historial)->where('role', 'user')->last();

        return trim(($ultimoTurnoUsuario['content'] ?? '').' '.$mensajeActual);
    }

    private function truncar(string $texto, int $limite): string
    {
        return mb_strlen($texto) > $limite ? mb_substr($texto, 0, $limite).'…' : $texto;
    }

    /**
     * @param  array<int, array{seccion: string, pregunta: string, respuesta: string}>  $fragmentosFaq
     */
    private function systemPrompt(array $fragmentosFaq): string
    {
        $usuario = Auth::user();
        $nombre = $usuario?->name ?? 'colaborador';

        $base = <<<PROMPT
        Eres el asistente virtual del Sistema Integral de Gestión de ADENAR S.A.S. (CD Pasto), distribuidor
        autorizado de Bavaria en el departamento de Nariño. Ayudas a colaboradores de todos los roles (Seguridad,
        Reparto, Gente, Flota, Administración) que usan el sistema interno. El usuario actual se llama {$nombre}.

        Tienes dos tipos de consultas que puedes recibir:

        1. Preguntas sobre el modelo DPO, sus 7 pilares, indicadores (KPI/PI), políticas de seguridad, procesos de
           reparto, flota, gestión y calidad del CD Pasto — si abajo aparecen fragmentos del "Folleto 2026 -
           Entrevista Reparto" relacionados con la pregunta, úsalos como fuente de verdad y responde con esa
           información (puedes reformularla de forma más natural, pero sin inventar cifras, metas ni políticas
           que no estén ahí). Si la pregunta parece del folleto pero no hay fragmentos relacionados o no traen la
           respuesta exacta, dilo honestamente en vez de inventar.
        2. Cualquier otra pregunta general (dudas de uso del sistema, conversación, preguntas de conocimiento
           general) — respóndelas con normalidad, como un asistente de IA útil y con buena disposición.

        Responde siempre en español, de forma clara, concisa y amable. Usa listas o pasos numerados cuando ayude a
        la claridad, pero evita respuestas innecesariamente largas.
        PROMPT;

        if ($fragmentosFaq === []) {
            return $base;
        }

        $bloqueFaq = collect($fragmentosFaq)
            ->map(fn (array $f) => "P: {$f['pregunta']}\nR: {$f['respuesta']}")
            ->implode("\n\n");

        return <<<PROMPT
        {$base}

        --- FRAGMENTOS RELEVANTES DEL FOLLETO 2026 - ENTREVISTA REPARTO (CD PASTO) ---
        {$bloqueFaq}
        --- FIN DE LOS FRAGMENTOS ---
        PROMPT;
    }
}
