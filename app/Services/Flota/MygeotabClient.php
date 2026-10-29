<?php

namespace App\Services\Flota;

use App\Support\MygeotabCredentials;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Wrapper delgado sobre el JSON-RPC de MyGeotab (https://my.geotab.com/apiv1).
 * No usa el SDK oficial en Python (mygeotab) porque esta app es Laravel/PHP:
 * se replica el mismo protocolo (Authenticate + Get genérico) directo con
 * Illuminate\Support\Facades\Http, igual que ya hace ChatbotController con
 * Groq (timeout explícito, manejo de error en 3 capas).
 *
 * El sessionId se cachea ~50 minutos (login tiene rate limit en MyGeotab) y
 * se reintenta una sola vez si una llamada falla por sesión inválida — las
 * credenciales se leen siempre de MygeotabCredentials::current() (BD si el
 * admin ya las configuró ahí, si no el valor semilla del .env), nunca se
 * guardan hardcodeadas.
 */
class MygeotabClient
{
    private const ENDPOINT = 'https://my.geotab.com/apiv1';

    private const CACHE_KEY = 'mygeotab.session_id';

    /**
     * @param  array{username: string, password: string, database: string}|null  $credenciales
     *                                                                                          Para "Probar conexión" desde el panel de admin, antes de guardar: se le
     *                                                                                          pasan las credenciales del formulario en vez de leer MygeotabCredentials::current().
     */
    public function autenticar(?array $credenciales = null): string
    {
        $cacheKey = self::CACHE_KEY;

        if ($credenciales === null) {
            $sessionId = Cache::get($cacheKey);
            if ($sessionId) {
                return $sessionId;
            }
        }

        $creds = $credenciales ?? MygeotabCredentials::current();

        if (blank($creds['username'] ?? null) || blank($creds['password'] ?? null) || blank($creds['database'] ?? null)) {
            throw new RuntimeException('Las credenciales de MyGeotab no están configuradas.');
        }

        $respuesta = $this->llamar('Authenticate', [
            'userName' => $creds['username'],
            'password' => $creds['password'],
            'database' => $creds['database'],
        ], autenticando: true);

        $sessionId = $respuesta['credentials']['sessionId'] ?? null;

        if (blank($sessionId)) {
            throw new RuntimeException('MyGeotab no devolvió una sesión válida.');
        }

        if ($credenciales === null) {
            Cache::put($cacheKey, $sessionId, now()->addMinutes(50));
        }

        return $sessionId;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function dispositivos(): array
    {
        return $this->get('Device');
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function viajes(string $fromDateIso, string $toDateIso): array
    {
        return $this->get('Trip', [
            'fromDate' => $fromDateIso,
            'toDate' => $toDateIso,
        ]);
    }

    /**
     * Estado actual por dispositivo (velocidad, posición, y hace cuánto
     * está en ese estado vía 'currentStateDuration') — para detectar
     * vehículos detenidos sin tener que inferirlo comparando sondeos.
     *
     * @return array<int, array<string, mixed>>
     */
    public function estadosDispositivos(): array
    {
        return $this->get('DeviceStatusInfo');
    }

    /**
     * @param  array<string, mixed>  $search
     * @return array<int, array<string, mixed>>
     */
    private function get(string $typeName, array $search = []): array
    {
        $params = ['typeName' => $typeName];
        if ($search !== []) {
            $params['search'] = $search;
        }

        try {
            return $this->llamarConSesion('Get', $params);
        } catch (SesionMygeotabInvalidaException) {
            // Un solo reintento con sesión fresca: el sessionId cacheado
            // puede haber sido invalidado del lado de MyGeotab (expiró o lo
            // cerraron) antes de que caducara nuestra caché local.
            Cache::forget(self::CACHE_KEY);

            return $this->llamarConSesion('Get', $params);
        }
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<int, array<string, mixed>>
     */
    private function llamarConSesion(string $method, array $params): array
    {
        $sessionId = $this->autenticar();
        $creds = MygeotabCredentials::current();

        $params['credentials'] = [
            'database' => $creds['database'],
            'sessionId' => $sessionId,
            'userName' => $creds['username'],
        ];

        $resultado = $this->llamar($method, $params);

        return is_array($resultado) ? $resultado : [];
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>|array<int, array<string, mixed>>
     *
     * @throws SesionMygeotabInvalidaException
     */
    private function llamar(string $method, array $params, bool $autenticando = false): array
    {
        try {
            $respuesta = Http::timeout(45)->post(self::ENDPOINT, [
                'method' => $method,
                'params' => $params,
            ]);
        } catch (\Throwable $e) {
            Log::error('MyGeotab: error de conexión.', ['method' => $method, 'error' => $e->getMessage()]);

            throw new RuntimeException('No se pudo conectar con MyGeotab en este momento.', previous: $e);
        }

        if ($respuesta->failed()) {
            Log::error('MyGeotab: respuesta HTTP no exitosa.', [
                'method' => $method,
                'status' => $respuesta->status(),
                'body' => $respuesta->body(),
            ]);

            throw new RuntimeException('MyGeotab respondió con un error de servidor.');
        }

        $error = $respuesta->json('error');

        if ($error) {
            $nombreError = $error['name'] ?? '';
            $mensaje = $error['message'] ?? 'Error desconocido de MyGeotab.';

            Log::error('MyGeotab: error de API.', ['method' => $method, 'error' => $error]);

            if (! $autenticando && in_array($nombreError, ['InvalidUserException', 'DbUnavailableException'], true)) {
                throw new SesionMygeotabInvalidaException($mensaje);
            }

            throw new RuntimeException("MyGeotab: {$mensaje}");
        }

        return $respuesta->json('result') ?? [];
    }
}
