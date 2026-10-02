<?php

namespace App\Services\Reparto;

use App\Models\Reparto\ModulacionBarrio;
use App\Models\Reparto\ModulacionMunicipio;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Servicio de ubicaciones para la planeación de ruta.
 * Trabaja exclusivamente con las tablas locales modulacion_municipios
 * y modulacion_barrios — sin ninguna llamada a APIs externas.
 */
class ModulacionUbicacionesService
{
    /**
     * Retorna el departamento fijo: Nariño.
     * Ya no consulta ninguna API externa.
     *
     * @return array<int, array{id: string, nombre: string}>
     */
    public function departamentos(): array
    {
        return [['id' => '52', 'nombre' => 'Nariño']];
    }

    /**
     * Lista todos los municipios del catálogo local, ordenados por nombre.
     *
     * @return array<int, array{id: string, nombre: string}>
     */
    public function municipios(): array
    {
        if (! Schema::hasTable('modulacion_municipios')) {
            return [];
        }

        return ModulacionMunicipio::orderBy('nombre')
            ->get(['id', 'nombre'])
            ->map(fn (ModulacionMunicipio $m) => [
                'id'     => (string) $m->id,
                'nombre' => $m->nombre,
            ])
            ->all();
    }

    /**
     * Lista los barrios de un municipio desde el catálogo local.
     *
     * @return array{data: array<int, array{id: string, nombre: string}>, api_disponible: bool}
     */
    public function barrios(string $municipioId): array
    {
        if (! Schema::hasTable('modulacion_municipios')) {
            return ['data' => [], 'api_disponible' => false];
        }

        $municipio = ModulacionMunicipio::query()
            ->when(
                ctype_digit($municipioId),
                fn ($q) => $q->whereKey($municipioId)->orWhere('codigo_dane', $municipioId)
            )
            ->firstOrFail();

        return [
            'data'          => $this->catalogoLocal($municipio),
            'api_disponible' => false,
        ];
    }

    /**
     * Crea o recupera un municipio por nombre normalizado.
     *
     * @return array{id: string, nombre: string, creado: bool}
     */
    public function registrarMunicipio(string $nombre): array
    {
        $nombre           = trim(preg_replace('/\s+/u', ' ', $nombre) ?? $nombre);
        $nombreNormalizado = $this->normalizar($nombre);

        $municipio = ModulacionMunicipio::firstOrCreate(
            ['nombre_normalizado' => $nombreNormalizado],
            ['nombre' => mb_convert_case($nombre, MB_CASE_TITLE, 'UTF-8'), 'origen' => 'manual']
        );

        return [
            'id'     => (string) $municipio->id,
            'nombre' => $municipio->nombre,
            'creado' => $municipio->wasRecentlyCreated,
        ];
    }

    /**
     * Crea o recupera un barrio dentro de un municipio.
     *
     * @return array{id: string, nombre: string, creado: bool}
     */
    public function registrarBarrio(string $municipioId, string $nombre): array
    {
        $municipio = ModulacionMunicipio::findOrFail($municipioId);
        $barrio    = $this->guardarEnCatalogo($municipio, $nombre, 'manual');

        return [
            'id'     => (string) $barrio->id,
            'nombre' => $barrio->nombre,
            'creado' => $barrio->wasRecentlyCreated,
        ];
    }

    /**
     * Persiste los municipios y barrios de una planeación al guardar las rutas.
     *
     * @param  array<int, array<string, mixed>>  $rutas
     */
    public function guardarUbicacionesDeRutas(array $rutas): void
    {
        foreach ($rutas as $ruta) {
            foreach ($ruta['viajes'] ?? [] as $viaje) {
                $destinos = $viaje['destinos'] ?? [[
                    'lugares' => $viaje['lugares'] ?? '',
                    'barrio'  => $viaje['barrio']  ?? '',
                ]];

                foreach ($destinos as $destino) {
                    $nombreMunicipio = trim((string) ($destino['lugares'] ?? ''));
                    if ($nombreMunicipio === '') {
                        continue;
                    }

                    $municipio    = $this->registrarMunicipio($nombreMunicipio);
                    $nombreBarrio = trim((string) ($destino['barrio'] ?? ''));
                    if ($nombreBarrio !== '') {
                        $this->registrarBarrio($municipio['id'], $nombreBarrio);
                    }
                }
            }
        }
    }

    // ─── Helpers privados ────────────────────────────────────────────────────

    private function guardarEnCatalogo(ModulacionMunicipio $municipio, string $nombre, string $origen): ModulacionBarrio
    {
        $nombre = trim(preg_replace('/\s+/u', ' ', $nombre) ?? $nombre);

        return ModulacionBarrio::firstOrCreate(
            [
                'municipio_id'       => $municipio->id,
                'nombre_normalizado' => $this->normalizar($nombre),
            ],
            [
                'nombre' => $nombre,
                'origen' => $origen,
            ]
        );
    }

    /**
     * @return array<int, array{id: string, nombre: string}>
     */
    private function catalogoLocal(ModulacionMunicipio $municipio): array
    {
        return $municipio->barrios()
            ->orderBy('nombre')
            ->get(['id', 'nombre'])
            ->map(fn (ModulacionBarrio $b) => [
                'id'     => (string) $b->id,
                'nombre' => $b->nombre,
            ])
            ->all();
    }

    private function normalizar(string $nombre): string
    {
        return Str::ascii(
            mb_strtolower(trim(preg_replace('/\s+/u', ' ', $nombre) ?? $nombre), 'UTF-8')
        );
    }
}
