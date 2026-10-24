<?php

namespace App\Services\Flota;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Extrae datos estructurados (galones, total pagado, fecha) de la foto de
 * un voucher de tanqueo usando Gemini (Google AI Studio), con salida JSON
 * forzada vía responseSchema — no hace falta parsear texto libre.
 *
 * Llamada síncrona (dentro del request de subida del Colaborador), mismo
 * criterio que la sincronización de MyGeotab: no hay queue worker corriendo
 * en Railway todavía, así que nada de este módulo usa ShouldQueue. El
 * manejo de error en 3 capas replica el de ChatbotController (Groq).
 */
class GeminiVoucherExtractorService
{
    private const ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

    // Lado largo máximo (px) de la imagen que se manda a Gemini. Desde que
    // "Tomar foto" pasó a usar la cámara nativa del celular (sin la
    // compresión a ≤1920px que hacía el navegador), una foto sin redimensionar
    // puede tardar más de los 30s de max_execution_time de PHP en subirse y
    // procesarse — eso causó un 500 real en producción (Fatal error no
    // capturable por try/catch). Para OCR de texto impreso 1600px alcanza de
    // sobra; la foto original de mayor calidad se guarda intacta en disco
    // para que Flota la revise.
    private const LADO_MAXIMO_PX = 1600;

    private const CALIDAD_JPEG = 85;

    private const PROMPT = <<<'PROMPT'
        Esta imagen es la foto de un voucher/recibo de una estación de servicio en Colombia, de
        una tanqueada de combustible para un vehículo de reparto. Extrae exactamente estos datos:

        - galones: cantidad de galones de combustible comprados (número decimal, sin unidades).
        - total_pagado: valor total pagado en pesos colombianos (número, sin símbolos ni puntos de mil).
        - precio_galon: precio por galón en pesos colombianos, si aparece explícito (número, o null si no aparece).
        - fecha: fecha del voucher en formato YYYY-MM-DD, si es legible (o null si no se puede leer).
        - confianza: "alta" si los números se leen con claridad, "media" si hay alguna duda razonable,
          "baja" si la imagen está borrosa, incompleta o los valores son difíciles de distinguir.

        Si no puedes identificar galones o total_pagado con ninguna certeza, usa confianza "baja" y
        deja esos campos en null en vez de inventar un número.
        PROMPT;

    /**
     * @return array{galones: ?float, total_pagado: ?float, precio_galon: ?float, fecha: ?string, confianza: string, raw: array}
     */
    public function extraer(string $fotoPath): array
    {
        $apiKey = config('services.gemini.api_key');

        if (blank($apiKey)) {
            Log::error('Gemini: falta GEMINI_API_KEY en la configuración.');

            throw new RuntimeException('El lector de vouchers no está configurado todavía.');
        }

        $bytes = Storage::disk('public')->get($fotoPath);
        [$bytes, $mime] = $this->redimensionar($bytes);
        $modelo = config('services.gemini.model', 'gemini-2.5-flash');

        $payload = [
            'contents' => [[
                'parts' => [
                    ['text' => self::PROMPT],
                    ['inline_data' => ['mime_type' => $mime, 'data' => base64_encode($bytes)]],
                ],
            ]],
            'generationConfig' => [
                'responseMimeType' => 'application/json',
                'responseSchema' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'galones' => ['type' => 'NUMBER', 'nullable' => true],
                        'total_pagado' => ['type' => 'NUMBER', 'nullable' => true],
                        'precio_galon' => ['type' => 'NUMBER', 'nullable' => true],
                        'fecha' => ['type' => 'STRING', 'nullable' => true],
                        'confianza' => ['type' => 'STRING', 'enum' => ['alta', 'media', 'baja']],
                    ],
                    'required' => ['confianza'],
                ],
            ],
        ];

        try {
            // Por debajo del max_execution_time de PHP en el servidor (30s):
            // así, si Gemini de verdad se cuelga, es Guzzle quien lanza una
            // excepción capturable por el catch de abajo, no un fatal de PHP
            // no capturable que tumba el request entero con un 500.
            $respuesta = Http::withHeaders(['x-goog-api-key' => $apiKey])
                ->timeout(20)
                ->post(self::ENDPOINT_BASE.$modelo.':generateContent', $payload);
        } catch (\Throwable $e) {
            Log::error('Gemini: error al conectar.', ['error' => $e->getMessage()]);

            throw new RuntimeException('No se pudo conectar con el lector de vouchers en este momento.', previous: $e);
        }

        if ($respuesta->failed()) {
            Log::error('Gemini: respuesta con error.', [
                'status' => $respuesta->status(),
                'body' => $respuesta->body(),
            ]);

            throw new RuntimeException('El lector de vouchers no pudo procesar la foto.');
        }

        $texto = $respuesta->json('candidates.0.content.parts.0.text');
        $datos = is_string($texto) ? json_decode($texto, true) : null;

        if (! is_array($datos) || ! isset($datos['confianza'])) {
            Log::error('Gemini: respuesta sin el formato esperado.', ['body' => $respuesta->body()]);

            throw new RuntimeException('El lector de vouchers no devolvió un resultado válido.');
        }

        return [
            'galones' => isset($datos['galones']) ? (float) $datos['galones'] : null,
            'total_pagado' => isset($datos['total_pagado']) ? (float) $datos['total_pagado'] : null,
            'precio_galon' => isset($datos['precio_galon']) ? (float) $datos['precio_galon'] : null,
            'fecha' => $datos['fecha'] ?? null,
            'confianza' => $datos['confianza'],
            'raw' => $datos,
        ];
    }

    /**
     * Reduce el lado largo de la imagen a LADO_MAXIMO_PX (nunca agranda) y la
     * recomprime a JPEG — mismo patrón que App\Support\ImagenPdf::reducir().
     * Si GD no puede decodificar el formato (algunos HEIC), se manda la
     * imagen original tal cual en vez de fallar: más lento, pero sigue
     * funcionando.
     *
     * @return array{0: string, 1: string} [bytes, mime_type]
     */
    private function redimensionar(string $bytes): array
    {
        $origen = @imagecreatefromstring($bytes);

        if (! $origen) {
            return [$bytes, 'image/jpeg'];
        }

        [$ancho, $alto] = [imagesx($origen), imagesy($origen)];
        $escala = min(1, self::LADO_MAXIMO_PX / max($ancho, $alto));
        $nuevoAncho = max(1, (int) round($ancho * $escala));
        $nuevoAlto = max(1, (int) round($alto * $escala));

        $destino = imagecreatetruecolor($nuevoAncho, $nuevoAlto);
        imagefill($destino, 0, 0, imagecolorallocate($destino, 255, 255, 255));
        imagecopyresampled($destino, $origen, 0, 0, 0, 0, $nuevoAncho, $nuevoAlto, $ancho, $alto);
        imagedestroy($origen);

        ob_start();
        imagejpeg($destino, null, self::CALIDAD_JPEG);
        imagedestroy($destino);
        $jpeg = ob_get_clean();

        return [$jpeg ?: $bytes, 'image/jpeg'];
    }
}
