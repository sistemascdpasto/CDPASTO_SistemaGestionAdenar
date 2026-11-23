<?php

namespace App\Services\Seguridad;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Consume el dataset público de instituciones de educación (datos.gov.co)
 * para poblar el select de "Institución de formación" del bloque
 * condicional Aprendiz SENA (HU02, Paso 1). Mismo patrón que
 * RutasCriticasDatosAbiertosService / UbicacionesColombiaService.
 */
class InstitucionesSenaService
{
    private const URL = 'https://www.datos.gov.co/resource/n5yy-8nav.json';

    private const CACHE_KEY = 'seguridad.colaboradores.instituciones-sena';

    /**
     * @return array<int, array{nombre: string, nit: string}>
     */
    public function instituciones(): array
    {
        $datosEnCache = Cache::get(self::CACHE_KEY);

        if (is_array($datosEnCache) && $datosEnCache !== []) {
            return $datosEnCache;
        }

        $datos = $this->consultar();

        if ($datos !== []) {
            Cache::put(self::CACHE_KEY, $datos, config('gente.referencias_externas.cache_ttl_segundos'));
        }

        return $datos;
    }

    /**
     * @return array<int, array{nombre: string, nit: string}>
     */
    private function consultar(): array
    {
        try {
            $response = Http::acceptJson()
                ->withHeaders(['User-Agent' => 'SistemaGestionAdenar-SGSST/1.0'])
                ->timeout(10)
                ->retry([500, 1000, 2000])
                ->get(self::URL, ['$limit' => 100]);

            if (! $response->successful()) {
                Log::warning('datos.gov.co devolvió un error para instituciones SENA', [
                    'status' => $response->status(),
                ]);

                return [];
            }

            $items = $response->json() ?? [];

            return collect($items)
                ->filter(fn (array $item) => ! empty($item['nombre_instituci_n']))
                ->map(fn (array $item) => [
                    'nombre' => $item['nombre_instituci_n'],
                    'nit' => $item['n_mero_identificaci_n'] ?? '',
                ])
                ->unique('nombre')
                ->sortBy('nombre')
                ->values()
                ->all();
        } catch (Throwable $e) {
            Log::warning('No se pudo consultar el dataset de instituciones (datos.gov.co)', ['error' => $e->getMessage()]);

            return [];
        }
    }
}
