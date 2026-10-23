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
            $response = Http::timeout(1)->get("{$this->fastApiUrl}/health");
            if ($response->successful()) {
                return true;
            }
        } catch (\Throwable) {
            // El servicio no está respondiendo
        }

        try {
            $python = $this->getPythonBinary();
            $basePath = base_path();

            if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
                $cmd = "start /B \"\" \"{$python}\" -m uvicorn facial_service.main:app --host 127.0.0.1 --port 8001 > nul 2>&1";
                pclose(popen("cd /d \"{$basePath}\" && {$cmd}", "r"));
            } else {
                $cmd = "nohup \"{$python}\" -m uvicorn facial_service.main:app --host 127.0.0.1 --port 8001 > /dev/null 2>&1 &";
                exec("cd \"{$basePath}\" && {$cmd}");
            }

            // Esperar brevemente (hasta 2.5s) a que el servidor inicialice
            for ($i = 0; $i < 5; $i++) {
                usleep(500000);
                try {
                    $res = Http::timeout(1)->get("{$this->fastApiUrl}/health");
                    if ($res->successful()) {
                        Log::info('[FacialRecognitionService] Microservicio FastAPI iniciado en segundo plano exitosamente.');
                        return true;
                    }
                } catch (\Throwable) {
                    continue;
                }
            }
        } catch (\Throwable $e) {
            Log::warning('[FacialRecognitionService] Error intentando arrancar FastAPI: ' . $e->getMessage());
        }

        return false;
    }

    /**
     * Sincroniza la galería de colaboradores activos con FastAPI para reconocimiento en vivo.
     */
    public function sincronizarGaleria(): array
    {
        $this->ensureServiceRunning();

        $colaboradores = Colaborador::query()
            ->completos()
            ->where('is_active', true)
            ->whereNotNull('imagen')
            ->get(['id', 'nombres', 'apellidos', 'cedula', 'cargo', 'imagen']);

        $candidates = [];
        foreach ($colaboradores as $c) {
            $absPath = Storage::disk('public')->path($c->imagen);
            if (file_exists($absPath)) {
                $candidates[] = [
                    'id' => $c->id,
                    'image_path' => str_replace('\\', '/', $absPath),
                ];
            }
        }

        if (empty($candidates)) {
            return ['success' => false, 'loaded' => 0, 'message' => 'Sin candidatos con foto'];
        }

        try {
            $response = Http::timeout(6)->post("{$this->fastApiUrl}/galeria/sincronizar", [
                'candidates' => $candidates,
            ]);

            return $response->json() ?? ['success' => false];
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * Compara una imagen capturada con los colaboradores activos que tienen foto.
     */
    public function reconocer(UploadedFile $foto): array
    {
        $this->ensureServiceRunning();

        // 1. Consultar colaboradores activos con imagen
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

        // 2. Preparar lista de candidatos existentes en disco
        $candidates = [];
        foreach ($colaboradores as $c) {
            $absPath = Storage::disk('public')->path($c->imagen);
            if (file_exists($absPath)) {
                $candidates[] = [
                    'id' => $c->id,
                    'nombres' => $c->nombres,
                    'apellidos' => $c->apellidos,
                    'cedula' => $c->cedula,
                    'cargo' => $c->cargo,
                    'image_path' => str_replace('\\', '/', $absPath),
                ];
            }
        }

        if (empty($candidates)) {
            return [
                'success' => false,
                'status' => 'sin_candidatos',
                'target_face_detected' => false,
                'colaborador' => null,
                'message' => 'Las fotografías de los colaboradores no se encuentran disponibles en el almacenamiento local.',
            ];
        }

        // 3. Procesar mediante el microservicio FastAPI
        try {
            $response = Http::timeout(25)
                ->attach('foto', file_get_contents($foto->getRealPath()), $foto->getClientOriginalName() ?: 'captura.jpg')
                ->post("{$this->fastApiUrl}/reconocer", [
                    'candidates_json' => json_encode($candidates, JSON_UNESCAPED_SLASHES),
                ]);

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
