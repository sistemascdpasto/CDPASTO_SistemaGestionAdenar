<?php

namespace App\Services\Reparto;

use App\Models\Reparto\Cliente;
use App\Models\Reparto\ModulacionBarrio;
use App\Models\Reparto\ModulacionMunicipio;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Servicio de ubicaciones para la planeación de ruta.
 *
 * Fuente única de verdad: reparto_clientes.
 * Los municipios y barrios se leen directamente de esa tabla.
 * modulacion_municipios / modulacion_barrios solo se usan para
 * guardar ubicaciones ingresadas manualmente desde la planeación.
 */
class ModulacionUbicacionesService
{
    /**
     * Retorna el departamento fijo: Nariño.
     *
     * @return array<int, array{id: string, nombre: string}>
     */
    public function departamentos(): array
    {
        return [['id' => '52', 'nombre' => 'Nariño']];
    }

    /**
     * Lista todos los municipios únicos de reparto_clientes,
     * combinados con los registrados manualmente en modulacion_municipios.
     *
     * El `id` de cada municipio es su nombre normalizado (slug), de forma que
     * el endpoint de barrios pueda recibirlo y buscar directamente en reparto_clientes.
     *
     * @return array<int, array{id: string, nombre: string}>
     */
    public function municipios(): array
    {
        $resultado = collect();

        // 1. Municipios de reparto_clientes
        if (Schema::hasTable('reparto_clientes')) {
            Cliente::select('municipio')
                ->whereNotNull('municipio')
                ->where('municipio', '!=', '')
                ->distinct()
                ->orderBy('municipio')
                ->get()
                ->each(function ($row) use (&$resultado) {
                    $nombre = trim((string) $row->municipio);
                    if ($nombre === '') return;
                    $slug = $this->normalizar($nombre);
                    $resultado->put($slug, [
                        'id'     => $slug,
                        'nombre' => mb_convert_case($nombre, MB_CASE_TITLE, 'UTF-8'),
                    ]);
                });
        }

        // 2. Municipios agregados manualmente en planeaciones anteriores
        if (Schema::hasTable('modulacion_municipios')) {
            ModulacionMunicipio::orderBy('nombre')
                ->get(['id', 'nombre', 'nombre_normalizado'])
                ->each(function (ModulacionMunicipio $m) use (&$resultado) {
                    $slug = $m->nombre_normalizado ?? $this->normalizar($m->nombre);
                    // Solo agregar si no viene ya de reparto_clientes
                    if (! $resultado->has($slug)) {
                        $resultado->put($slug, [
                            'id'     => $slug,
                            'nombre' => $m->nombre,
                        ]);
                    }
                });
        }

        return $resultado->sortBy('nombre')->values()->all();
    }

    /**
     * Lista los barrios únicos de un municipio.
     * $municipioId es el nombre normalizado (slug) del municipio.
     *
     * @return array{data: array<int, array{id: string, nombre: string}>, api_disponible: bool}
     */
    public function barrios(string $municipioId): array
    {
        $resultado = collect();

        // 1. Barrios desde reparto_clientes (busca por nombre normalizado del municipio)
        if (Schema::hasTable('reparto_clientes')) {
            Cliente::select('barrio')
                ->whereNotNull('barrio')
                ->where('barrio', '!=', '')
                ->whereRaw('LOWER(TRIM(municipio)) LIKE ?', ['%' . $this->normalizar($municipioId) . '%'])
                ->distinct()
                ->orderBy('barrio')
                ->get()
                ->each(function ($row) use (&$resultado) {
                    $nombre = trim((string) $row->barrio);
                    if ($nombre === '') return;
                    $slug = $this->normalizar($nombre);
                    $resultado->put($slug, [
                        'id'     => $slug,
                        'nombre' => mb_convert_case($nombre, MB_CASE_TITLE, 'UTF-8'),
                    ]);
                });
        }

        // 2. Barrios manuales de modulacion_barrios para este municipio (por nombre normalizado)
        if (Schema::hasTable('modulacion_municipios')) {
            $municipio = ModulacionMunicipio::where('nombre_normalizado', $municipioId)->first();
            if ($municipio) {
                $municipio->barrios()
                    ->orderBy('nombre')
                    ->get(['id', 'nombre', 'nombre_normalizado'])
                    ->each(function (ModulacionBarrio $b) use (&$resultado) {
                        $slug = $b->nombre_normalizado ?? $this->normalizar($b->nombre);
                        if (! $resultado->has($slug)) {
                            $resultado->put($slug, [
                                'id'     => $slug,
                                'nombre' => $b->nombre,
                            ]);
                        }
                    });
            }
        }

        return [
            'data'           => $resultado->sortBy('nombre')->values()->all(),
            'api_disponible' => false,
        ];
    }

    /**
     * Crea o recupera un municipio en modulacion_municipios.
     * Devuelve su nombre normalizado como id (slug).
     *
     * @return array{id: string, nombre: string, creado: bool}
     */
    public function registrarMunicipio(string $nombre): array
    {
        $nombre            = trim(preg_replace('/\s+/u', ' ', $nombre) ?? $nombre);
        $slug              = $this->normalizar($nombre);
        $nombreTitleCase   = mb_convert_case($nombre, MB_CASE_TITLE, 'UTF-8');

        $municipio = ModulacionMunicipio::firstOrCreate(
            ['nombre_normalizado' => $slug],
            ['nombre' => $nombreTitleCase, 'origen' => 'manual']
        );

        return [
            'id'     => $slug,           // el frontend usa este id para pedir barrios
            'nombre' => $municipio->nombre,
            'creado' => $municipio->wasRecentlyCreated,
        ];
    }

    /**
     * Crea o recupera un barrio en modulacion_barrios.
     * $municipioId es el slug (nombre normalizado) del municipio.
     *
     * @return array{id: string, nombre: string, creado: bool}
     */
    public function registrarBarrio(string $municipioId, string $nombre): array
    {
        $slug      = $this->normalizar($nombre);
        $nombreTC  = mb_convert_case(
            trim(preg_replace('/\s+/u', ' ', $nombre) ?? $nombre),
            MB_CASE_TITLE,
            'UTF-8'
        );

        // Buscar o crear el municipio en modulacion_municipios por slug
        $municipio = ModulacionMunicipio::firstOrCreate(
            ['nombre_normalizado' => $municipioId],
            [
                'nombre' => mb_convert_case($municipioId, MB_CASE_TITLE, 'UTF-8'),
                'origen' => 'manual',
            ]
        );

        $barrio = ModulacionBarrio::firstOrCreate(
            [
                'municipio_id'       => $municipio->id,
                'nombre_normalizado' => $slug,
            ],
            ['nombre' => $nombreTC, 'origen' => 'manual']
        );

        return [
            'id'     => $slug,
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
                    if ($nombreMunicipio === '') continue;

                    $municipio    = $this->registrarMunicipio($nombreMunicipio);
                    $nombreBarrio = trim((string) ($destino['barrio'] ?? ''));
                    if ($nombreBarrio !== '') {
                        $this->registrarBarrio($municipio['id'], $nombreBarrio);
                    }
                }
            }
        }
    }

    // ─── Helper ──────────────────────────────────────────────────────────────

    private function normalizar(string $nombre): string
    {
        return Str::ascii(
            mb_strtolower(trim(preg_replace('/\s+/u', ' ', $nombre) ?? $nombre), 'UTF-8')
        );
    }
}
