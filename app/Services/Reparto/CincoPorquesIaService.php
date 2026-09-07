<?php

namespace App\Services\Reparto;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Asistente de análisis de causa raíz (5 Por Qué) sobre la API de Groq
 * (compatible con el formato chat-completions de OpenAI), el mismo proveedor
 * que ya usa el chatbot interno (ver App\Http\Controllers\ChatbotController).
 *
 * Dos operaciones:
 *  - opcionesSiguienteNivel(): dado el problema y los "por qué" ya elegidos,
 *    propone N respuestas plausibles para el siguiente "¿por qué?".
 *  - conclusion(): dado el problema y los 5 "por qué", redacta la causa raíz
 *    principal y un plan de acción.
 */
class CincoPorquesIaService
{
    private const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

    /**
     * @param  array<int, string>  $seleccionados  "Por qué" ya definidos (0 a 4).
     * @return array<int, string>
     */
    public function opcionesSiguienteNivel(
        string $problema,
        string $rutina,
        string $indicador,
        array $seleccionados,
    ): array {
        $nivel = count($seleccionados) + 1;
        $cantidad = (int) config('cinco_porques.opciones_por_nivel', 5);

        $cadena = $this->cadenaTexto($problema, $seleccionados);

        $instruccion = <<<TXT
        Estás guiando un análisis de causa raíz con la técnica de los 5 Por Qué en un centro de
        distribución de bebidas (operación de reparto). Contexto:
        - Rutina a la que aplica: {$rutina}
        - Indicador afectado: {$indicador}
        {$cadena}

        Propón {$cantidad} respuestas DISTINTAS y plausibles a la pregunta "¿Por qué?" del nivel {$nivel}
        (es decir, por qué ocurre lo último de la cadena de arriba; si el nivel es 1, por qué ocurre el
        problema). Cada opción: una sola frase concreta, en español, orientada a proceso/método/recurso y
        no a culpar personas. Evita respuestas genéricas ("falta de compromiso") y evita repetir ideas.

        Responde SOLO con un objeto JSON con esta forma exacta:
        {"opciones": ["...", "...", "...", "...", "..."]}
        TXT;

        $json = $this->pedirJson($instruccion);

        $opciones = collect($json['opciones'] ?? [])
            ->filter(fn ($o) => is_string($o) && trim($o) !== '')
            ->map(fn ($o) => trim($o))
            ->values()
            ->all();

        if ($opciones === []) {
            throw new RuntimeException('La IA no devolvió opciones utilizables.');
        }

        return array_slice($opciones, 0, $cantidad);
    }

    /**
     * @param  array<int, string>  $porques  Los 5 "por qué" definidos.
     * @return array{causa_raiz: string, plan_accion: string}
     */
    public function conclusion(
        string $problema,
        string $rutina,
        string $indicador,
        array $porques,
    ): array {
        $cadena = $this->cadenaTexto($problema, $porques);

        $instruccion = <<<TXT
        Cierra un análisis de causa raíz (5 Por Qué) de una operación de reparto de un centro de
        distribución de bebidas. Contexto:
        - Rutina a la que aplica: {$rutina}
        - Indicador afectado: {$indicador}
        {$cadena}

        Con base en esa cadena:
        1. "causa_raiz": redacta en una o dos frases la causa raíz principal (la del último "por qué",
           expresada como una condición del proceso que, de corregirse, evitaría el problema).
        2. "plan_accion": propón un plan de acción concreto y accionable (2 a 5 acciones, cada una con
           un verbo de acción; puedes numerarlas con saltos de línea). En español, sin culpar personas.

        Responde SOLO con un objeto JSON con esta forma exacta:
        {"causa_raiz": "...", "plan_accion": "..."}
        TXT;

        $json = $this->pedirJson($instruccion);

        $causaRaiz = trim((string) ($json['causa_raiz'] ?? ''));
        $planAccion = trim((string) ($json['plan_accion'] ?? ''));

        if ($causaRaiz === '' || $planAccion === '') {
            throw new RuntimeException('La IA no devolvió una conclusión utilizable.');
        }

        return ['causa_raiz' => $causaRaiz, 'plan_accion' => $planAccion];
    }

    /**
     * @param  array<int, string>  $porques
     */
    private function cadenaTexto(string $problema, array $porques): string
    {
        $lineas = ['- Problema a resolver: '.trim($problema)];

        foreach (array_values($porques) as $i => $porque) {
            $lineas[] = '- Por qué '.($i + 1).': '.trim((string) $porque);
        }

        return implode("\n", $lineas);
    }

    /**
     * @return array<string, mixed>
     */
    private function pedirJson(string $instruccion): array
    {
        $apiKey = config('services.groq.api_key');

        if (blank($apiKey)) {
            throw new RuntimeException('El asistente de IA no está configurado (falta GROQ_API_KEY).');
        }

        $modelo = config('services.groq.model');

        $payload = [
            'model' => $modelo,
            'messages' => [
                ['role' => 'system', 'content' => 'Eres un facilitador experto en análisis de causa raíz. Respondes siempre en español y SOLO con JSON válido, sin texto adicional.'],
                ['role' => 'user', 'content' => $instruccion],
            ],
            'temperature' => 0.6,
            'max_tokens' => 1200,
            'response_format' => ['type' => 'json_object'],
        ];

        if (str_contains((string) $modelo, 'gpt-oss')) {
            $payload['reasoning_effort'] = 'low';
        }

        try {
            $respuesta = Http::withToken($apiKey)
                ->timeout(45)
                ->post(self::GROQ_ENDPOINT, $payload);
        } catch (\Throwable $e) {
            Log::error('CincoPorques IA: error al conectar con Groq.', ['error' => $e->getMessage()]);

            throw new RuntimeException('No se pudo conectar con el asistente de IA. Intenta de nuevo en unos segundos.');
        }

        if ($respuesta->failed()) {
            Log::error('CincoPorques IA: Groq respondió con error.', [
                'status' => $respuesta->status(),
                'body' => $respuesta->body(),
            ]);

            throw new RuntimeException('El asistente de IA no pudo procesar la solicitud. Intenta de nuevo en unos segundos.');
        }

        $contenido = $respuesta->json('choices.0.message.content');

        $json = $this->extraerJson(is_string($contenido) ? $contenido : '');

        if (! is_array($json)) {
            Log::warning('CincoPorques IA: respuesta no era JSON válido.', ['contenido' => $contenido]);

            throw new RuntimeException('El asistente de IA devolvió una respuesta con formato inesperado. Intenta de nuevo.');
        }

        return $json;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function extraerJson(string $contenido): ?array
    {
        $contenido = trim($contenido);

        // Algunos modelos envuelven el JSON en fences ```json ... ```.
        $contenido = preg_replace('/^```(?:json)?\s*|\s*```$/i', '', $contenido) ?? $contenido;

        $decodificado = json_decode($contenido, true);
        if (is_array($decodificado)) {
            return $decodificado;
        }

        // Último recurso: quedarse con el primer objeto {...} que aparezca.
        if (preg_match('/\{.*\}/s', $contenido, $m)) {
            $decodificado = json_decode($m[0], true);
            if (is_array($decodificado)) {
                return $decodificado;
            }
        }

        return null;
    }
}
