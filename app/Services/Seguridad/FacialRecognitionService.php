<?php

namespace App\Services\Seguridad;

use App\Models\Seguridad\Colaborador;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;

class FacialRecognitionService
{
    protected string $fastApiUrl;

    public function __construct()
    {
        $this->fastApiUrl = config('services.facial.url', 'http://127.0.0.1:8001');
    }

    /**
     * Resuelve la ruta del binario de Python (.venv_facial2).
     */
    protected function getPythonBinary(): string
    {
        $venvWindows = base_path('.venv_facial2\\Scripts\\python.exe');
        if (file_exists($venvWindows)) {
            return $venvWindows;
        }

        $venvLinux = base_path('.venv_facial2/bin/python');
        if (file_exists($venvLinux)) {
            return $venvLinux;
        }

        return config('services.facial.python_path', 'python');
    }

    /**
     * Asegura que el microservicio FastAPI esté activo.
     * Si no responde en el puerto configurado, intenta levantarlo en segundo plano automáticamente.
     */
    
public function ensureServiceRunning(): bool
{
    try {
        $response = Http::timeout(5)
            ->withHeaders([
                'X-API-Key' => $this->getApiKey(),
            ])
            ->get("{$this->fastApiUrl}/health");

        return $response->successful();
    } catch (\Throwable $e) {
        Log::warning(
            '[FacialRecognitionService] FastAPI no está disponible: '
            . $e->getMessage()
        );

        return false;
    }
}


    /**
     * Devuelve la API key configurada para el microservicio facial.
     */
  protected function getApiKey(): string
{
    return (string) config('services.facial.api_key', '');
}
    /**
     * Sincroniza la galería de colaboradores activos con FastAPI para reconocimiento en vivo.
     *
     * Envía las fotografías reales como archivos multipart (no rutas locales),
     * y se autentica con el header X-API-Key.
     *
     * Contrato multipart:
     *   - Campo "candidates_json": JSON con [{id, nombres, apellidos, cedula, cargo}, ...]
     *   - Archivos "foto_{id}": bytes de la fotografía de cada colaborador
     */
   public function sincronizarGaleria(): array
{
    if (! $this->ensureServiceRunning()) {
        return [
            'success' => false,
            'loaded' => 0,
            'message' => 'El servicio de reconocimiento facial no está disponible.',
        ];
    }

        $colaboradores = Colaborador::query()
            ->completos()
            ->where('is_active', true)
            ->whereNotNull('imagen')
            ->get(['id', 'nombres', 'apellidos', 'cedula', 'cargo', 'imagen']);

        $candidatesMeta = [];
        $attachments    = [];

        foreach ($colaboradores as $c) {
            $absPath = Storage::disk('public')->path($c->imagen);
            if (! file_exists($absPath)) {
                continue;
            }

            $bytes = @file_get_contents($absPath);
            if ($bytes === false || $bytes === '') {
                continue;
            }

            $candidatesMeta[] = [
                'id'        => $c->id,
                'nombres'   => $c->nombres,
                'apellidos' => $c->apellidos,
                'cedula'    => $c->cedula,
                'cargo'     => $c->cargo,
            ];

            // Nombre del archivo adjunto: "foto_{id}" — FastAPI lo busca con este patrón
            $attachments[] = [
                'foto_' . $c->id,
                $bytes,
                basename($c->imagen),
            ];
        }

        if (empty($candidatesMeta)) {
            return ['success' => false, 'loaded' => 0, 'message' => 'Sin candidatos con foto'];
        }

        try {
            $request = Http::timeout(30)
                ->connectTimeout(5)
                ->withHeaders(['X-API-Key' => $this->getApiKey()])
                ->asMultipart();

            // Adjuntar metadatos como campo de texto
            $request = $request->attach('candidates_json', json_encode($candidatesMeta, JSON_UNESCAPED_UNICODE));

            // Adjuntar cada fotografía como archivo binario
            foreach ($attachments as [$name, $bytes, $filename]) {
                $request = $request->attach($name, $bytes, $filename);
            }

            $response = $request->post("{$this->fastApiUrl}/galeria/sincronizar");

            if (! $response->successful()) {
                Log::warning('[FacialRecognitionService] FastAPI rechazó la sincronización de la galería.', [
                    'status' => $response->status(),
                ]);

                return [
                    'success' => false,
                    'loaded' => 0,
                    'message' => 'No se pudo sincronizar la galería. Verifica la URL y FACIAL_API_KEY del servicio facial.',
                ];
            }

            $result = $response->json();
            if (! is_array($result) || ! ($result['success'] ?? false) || (int) ($result['loaded'] ?? 0) < 1) {
                Log::warning('[FacialRecognitionService] FastAPI no cargó colaboradores en la galería.', [
                    'status' => $response->status(),
                    'loaded' => is_array($result) ? (int) ($result['loaded'] ?? 0) : 0,
                ]);

                return [
                    'success' => false,
                    'loaded' => 0,
                    'message' => 'El servicio respondió, pero no cargó colaboradores con fotografías procesables.',
                ];
            }

            return $result;
        } catch (\Throwable $e) {
            Log::error('[FacialRecognitionService] sincronizarGaleria falló: ' . $e->getMessage());

            return [
                'success' => false,
                'loaded' => 0,
                'message' => 'No fue posible conectar con el servicio para sincronizar la galería.',
            ];
        }
    }

    /**
     * Compara una imagen capturada con los colaboradores activos que tienen foto.
     */
    public function reconocer(UploadedFile $foto): array
    {
        $this->ensureServiceRunning();

        // 2. Verificar que haya colaboradores registrados con foto (la galería ya está cargada en FastAPI)
        $colaboradores = Colaborador::query()
            ->completos()
            ->where('is_active', true)
            ->whereNotNull('imagen')
            ->get(['id', 'nombres', 'apellidos', 'cedula', 'cargo', 'turno', 'imagen']);

        if ($colaboradores->isEmpty()) {
            return [
                'success' => false,
                'status' => 'sin_candidatos',
                'target_face_detected' => false,
                'colaborador' => null,
                'message' => 'No hay colaboradores registrados con fotografía en el sistema.',
            ];
        }

        // 3. Procesar mediante el microservicio FastAPI
        try {
            $response = Http::timeout(25)
                ->withHeaders(['X-API-Key' => $this->getApiKey()])
                ->attach('foto', file_get_contents($foto->getRealPath()), $foto->getClientOriginalName() ?: 'captura.jpg')
                ->post("{$this->fastApiUrl}/reconocer");

            if ($response->successful()) {
                $data = $response->json();
                if (isset($data['colaborador_id'])) {
                    $matched = $colaboradores->firstWhere('id', $data['colaborador_id']);
                    $data['colaborador'] = $matched ? [
                        'id' => $matched->id,
                        'nombres' => $matched->nombres,
                        'apellidos' => $matched->apellidos,
                        'cedula' => $matched->cedula,
                        'cargo' => $matched->cargo,
                    ] : null;
                    $data['nombres'] = $matched?->nombres;
                    $data['apellidos'] = $matched?->apellidos;
                    $data['cedula'] = $matched?->cedula;
                    $data['cargo'] = $matched?->cargo;
                }
                return $data;
            }

            Log::warning('Respuesta no exitosa de FastAPI: ' . $response->body());
            return [
                'success' => false,
                'status' => 'error',
                'target_face_detected' => false,
                'colaborador' => null,
                'message' => 'El servicio biométrico devolvió un error al comparar la imagen.',
            ];
        } catch (\Throwable $e) {
            Log::error('Microservicio FastAPI no disponible: ' . $e->getMessage());
            return [
                'success' => false,
                'status' => 'service_unavailable',
                'target_face_detected' => false,
                'colaborador' => null,
                'message' => 'El servicio de reconocimiento facial no está disponible en este momento.',
            ];
        }
    }
}
