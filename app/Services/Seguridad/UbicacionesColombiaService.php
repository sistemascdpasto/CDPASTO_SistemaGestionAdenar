<?php

namespace App\Services\Seguridad;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Consume la API pública api-colombia.com para poblar los selects de
 * "Expedido en" y "Ciudad de residencia" del wizard de colaboradores
 * (HU02, Paso 1). Sigue el mismo patrón de RutasCriticasDatosAbiertosService:
 * caché con TTL largo y fallo silencioso a [] (nunca cachea un error).
 */
class UbicacionesColombiaService
{
    private const BASE_URL = 'https://api-colombia.com/api/v1';

    /**
     * @return array<int, array{id: int, nombre: string}>
     */
    public function departamentos(): array
    {
        return $this->consultarConCache('seguridad.colaboradores.departamentos', '/Department');
    }

    /**
     * @return array<int, array{id: int, nombre: string}>
     */
    public function ciudades(int $departamentoId): array
    {
        return $this->consultarConCache(
            "seguridad.colaboradores.ciudades.{$departamentoId}",
            "/Department/{$departamentoId}/cities"
        );
    }

    /**
     * @return array<int, array{id: int, nombre: string}>
     */
    private function consultarConCache(string $clave, string $ruta): array
    {
        try {
            $datosEnCache = Cache::get($clave);

            if (is_array($datosEnCache) && $datosEnCache !== []) {
                return $datosEnCache;
            }
        } catch (Throwable $e) {
            Log::warning('No se pudo leer la caché de ubicaciones externas.', [
                'clave' => $clave,
                'error' => $e->getMessage(),
            ]);
        }

        $datos = $this->consultar($ruta);

        if ($datos !== []) {
            try {
                Cache::put($clave, $datos, config('seguridad.referencias_externas.cache_ttl_segundos'));
            } catch (Throwable $e) {
                Log::warning('No se pudo guardar la caché de ubicaciones externas.', [
                    'clave' => $clave,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $datos;
    }

    /**
     * @return array<int, array{id: int, nombre: string}>
     */
    private function consultar(string $ruta): array
    {
        try {
            $response = Http::acceptJson()
                ->withHeaders(['User-Agent' => 'SistemaGestionAdenar-SGSST/1.0'])
                ->timeout(10)
                ->retry([500, 1000, 2000])
                ->get(self::BASE_URL.$ruta);

            if (! $response->successful()) {
                Log::warning("api-colombia.com devolvió un error para {$ruta}", [
                    'status' => $response->status(),
                ]);

                return [];
            }

            $items = $response->json() ?? [];

            return collect($items)
                ->map(fn (array $item) => ['id' => $item['id'], 'nombre' => $item['name']])
                ->sortBy('nombre')
                ->values()
                ->all();
        } catch (Throwable $e) {
            Log::warning("No se pudo consultar api-colombia.com ({$ruta})", ['error' => $e->getMessage()]);

            return [];
        }
    }
}
