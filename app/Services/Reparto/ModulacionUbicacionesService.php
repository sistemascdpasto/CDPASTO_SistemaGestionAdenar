<?php

namespace App\Services\Reparto;

use App\Models\Reparto\ModulacionBarrio;
use App\Models\Reparto\ModulacionMunicipio;
use App\Services\Seguridad\UbicacionesColombiaService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;

class ModulacionUbicacionesService
{
    private const DANE_BASE =
        'https://geoportal.dane.gov.co/mparcgis/rest/services/Divipola/Serv_DIVIPOLA_MGN_2025/FeatureServer';

    private const CODIGO_POSTAL_BASE =
        'https://visor.codigopostal.gov.co/arcgis/rest/services/DivisionAdministrativa/MapServer';

    private const CODIGO_NARINO = '52';

    public function __construct(private readonly UbicacionesColombiaService $ubicacionesColombia) {}

    /**
     * @return array<int, array{id: string, nombre: string}>
     */
    public function departamentos(): array
    {
        return Cache::remember(
            'reparto.modulacion.departamento.narino',
            now()->addDay(),
            function (): array {
                $payload = $this->consultarArcgis(self::DANE_BASE.'/319/query', [
                    'where' => "DPTO_CCDGO = '".self::CODIGO_NARINO."'",
                    'outFields' => 'DPTO_CCDGO,DPTO_CNMBRE',
                    'returnGeometry' => 'false',
                ], 'departamentos de Nariño');

                return collect($payload['features'])
                    ->map(fn (array $feature) => $feature['attributes'] ?? [])
                    ->filter(fn (array $attributes) => ($attributes['DPTO_CCDGO'] ?? null) === self::CODIGO_NARINO)
                    ->map(fn (array $attributes) => [
                        'id' => self::CODIGO_NARINO,
                        'nombre' => 'Nariño',
                    ])
                    ->unique('id')
                    ->values()
                    ->all();
            }
        );
    }

    /**
     * @return array<int, array{id: string, nombre: string}>
     */
    public function municipios(): array
    {
        $municipiosApi = [];
        try {
            $payload = $this->consultarArcgis(self::DANE_BASE.'/317/query', [
                'where' => "DPTO_CCDGO = '".self::CODIGO_NARINO."'",
                'outFields' => 'MPIO_CDPMP,MPIO_CNMBRE,DPTO_CCDGO',
                'returnGeometry' => 'false',
                'orderByFields' => 'MPIO_CNMBRE',
            ], 'municipios de Nariño');

            $municipiosApi = collect($payload['features'])
                ->map(fn (array $feature) => $feature['attributes'] ?? [])
                ->filter(fn (array $attributes) => ($attributes['DPTO_CCDGO'] ?? null) === self::CODIGO_NARINO
                    && ! empty($attributes['MPIO_CDPMP'])
                    && ! empty($attributes['MPIO_CNMBRE']))
                ->map(fn (array $attributes) => [
                    'codigo_dane' => (string) $attributes['MPIO_CDPMP'],
                    'nombre' => mb_convert_case((string) $attributes['MPIO_CNMBRE'], MB_CASE_TITLE, 'UTF-8'),
                    'id_externo' => null,
                ])
                ->unique('codigo_dane')
                ->values()
                ->all();
        } catch (ConnectionException|RequestException|RuntimeException $exception) {
            Log::warning('No se pudo actualizar el catálogo de municipios desde DANE.', [
                'error' => $exception->getMessage(),
            ]);
        }

        if ($municipiosApi === []) {
            $municipiosApi = $this->municipiosDesdeApiColombia();
        }

        try {
            if (! Schema::hasTable('modulacion_municipios')) {
                return $this->municipiosSinCatalogoLocal($municipiosApi);
            }

            foreach ($municipiosApi as $index => $municipioApi) {
                $normalizado = $this->normalizar($municipioApi['nombre']);
                $consulta = ModulacionMunicipio::query()->where('nombre_normalizado', $normalizado);
                if ($municipioApi['codigo_dane'] !== null) {
                    $consulta->orWhere('codigo_dane', $municipioApi['codigo_dane']);
                }
                $municipio = $consulta->first();

                if ($municipio) {
                    $datos = [
                        'nombre' => $municipioApi['nombre'],
                        'nombre_normalizado' => $normalizado,
                    ];
                    if ($municipioApi['codigo_dane'] !== null) {
                        $datos['codigo_dane'] = $municipioApi['codigo_dane'];
                    }
                    $municipio->update($datos);
                } else {
                    $municipio = ModulacionMunicipio::create([
                        'codigo_dane' => $municipioApi['codigo_dane'],
                        'nombre' => $municipioApi['nombre'],
                        'nombre_normalizado' => $normalizado,
                        'origen' => 'dane',
                    ]);
                }

                $municipiosApi[$index] = [
                    'id' => (string) $municipio->id,
                    'nombre' => $municipio->nombre,
                ];
            }

            $municipiosLocales = ModulacionMunicipio::query()
                ->orderBy('nombre')
                ->get(['id', 'nombre'])
                ->map(fn (ModulacionMunicipio $municipio) => [
                    'id' => (string) $municipio->id,
                    'nombre' => $municipio->nombre,
                ])
                ->all();

            return collect($municipiosApi)
                ->merge($municipiosLocales)
                ->unique(fn (array $municipio) => $this->normalizar($municipio['nombre']))
                ->sortBy('nombre', SORT_NATURAL | SORT_FLAG_CASE)
                ->values()
                ->all();
        } catch (\PDOException $exception) {
            Log::warning('No se pudo acceder al catálogo local de municipios; se usará la respuesta de DANE.', [
                'error' => $exception->getMessage(),
            ]);

            return $this->municipiosSinCatalogoLocal($municipiosApi);
        }
    }

    /**
     * @param  array<int, array{codigo_dane: ?string, nombre: string, id_externo: ?string}>  $municipios
     * @return array<int, array{id: string, nombre: string}>
     */
    private function municipiosSinCatalogoLocal(array $municipios): array
    {
        return collect($municipios)
            ->map(fn (array $municipio) => [
                'id' => $municipio['codigo_dane'] ?? $municipio['id_externo'] ?? $municipio['nombre'],
                'nombre' => $municipio['nombre'],
            ])
            ->all();
    }

    /**
     * Uses the same external catalog as the Gente module when DANE is unavailable.
     *
     * @return array<int, array{codigo_dane: null, nombre: string, id_externo: string}>
     */
    private function municipiosDesdeApiColombia(): array
    {
        $departamento = collect($this->ubicacionesColombia->departamentos())
            ->first(fn (array $item) => $this->normalizar($item['nombre']) === 'narino');

        if (! $departamento) {
            return [];
        }

        return collect($this->ubicacionesColombia->ciudades((int) $departamento['id']))
            ->map(fn (array $municipio) => [
                'codigo_dane' => null,
                'nombre' => $municipio['nombre'],
                'id_externo' => (string) $municipio['id'],
            ])
            ->all();
    }

    /**
     * @return array{id: string, nombre: string, creado: bool}
     */
    public function registrarMunicipio(string $nombre): array
    {
        $nombre = trim(preg_replace('/\s+/u', ' ', $nombre) ?? $nombre);
        $nombreNormalizado = $this->normalizar($nombre);
        $municipio = ModulacionMunicipio::firstOrCreate(
            ['nombre_normalizado' => $nombreNormalizado],
            ['nombre' => mb_convert_case($nombre, MB_CASE_TITLE, 'UTF-8'), 'origen' => 'manual']
        );

        return [
            'id' => (string) $municipio->id,
            'nombre' => $municipio->nombre,
            'creado' => $municipio->wasRecentlyCreated,
        ];
    }

    /**
     * Persists manually entered destinations when their route is saved.
     *
     * @param  array<int, array<string, mixed>>  $rutas
     */
    public function guardarUbicacionesDeRutas(array $rutas): void
    {
        foreach ($rutas as $ruta) {
            foreach ($ruta['viajes'] ?? [] as $viaje) {
                $nombreMunicipio = trim((string) ($viaje['lugares'] ?? ''));
                if ($nombreMunicipio === '') {
                    continue;
                }

                $municipio = $this->registrarMunicipio($nombreMunicipio);
                $nombreBarrio = trim((string) ($viaje['barrio'] ?? ''));
                if ($nombreBarrio !== '') {
                    $this->registrarBarrio($municipio['id'], $nombreBarrio);
                }
            }
        }
    }

    /**
     * @return array{data: array<int, array{id: string, nombre: string}>, api_disponible: bool}
     */
    public function barrios(string $municipioId): array
    {
        if (! Schema::hasTable('modulacion_municipios')) {
            return $this->barriosDesdeApi($municipioId);
        }

        $municipio = ModulacionMunicipio::query()
            ->when(
                ctype_digit($municipioId),
                fn ($query) => $query->whereKey($municipioId)->orWhere('codigo_dane', $municipioId)
            )
            ->firstOrFail();
        $apiDisponible = true;

        if ($municipio->codigo_dane) {
            try {
                $barriosApi = $this->barriosPostales($municipio->codigo_dane);
                foreach ($barriosApi['data'] as $barrio) {
                    $this->guardarEnCatalogo($municipio, $barrio['nombre'], 'visor_codigo_postal');
                }
                $apiDisponible = $barriosApi['api_disponible'];
            } catch (ConnectionException|RequestException|RuntimeException $exception) {
                Log::warning("No se pudo consultar el catálogo postal de barrios para {$municipio->codigo_dane}.", [
                    'error' => $exception->getMessage(),
                ]);
                $apiDisponible = false;
            }
        }

        return [
            'data' => $this->catalogoLocal($municipio),
            'api_disponible' => $apiDisponible,
        ];
    }

    private function barriosDesdeApi(string $codigoDane): array
    {
        $barrios = $this->barriosPostales($codigoDane);

        return [
            'data' => $barrios['data'],
            'api_disponible' => $barrios['api_disponible'],
        ];
    }

    /**
     * @return array{data: array<int, array{id: string, nombre: string}>, api_disponible: bool}
     */
    private function barriosPostales(string $codigoDane): array
    {
        $apiDisponible = true;
        try {
            $municipioPayload = $this->consultarArcgis(self::CODIGO_POSTAL_BASE.'/3/query', [
                'where' => "Codigo_DANE = '{$codigoDane}'",
                'outFields' => 'Codigo,Codigo_DANE',
                'returnGeometry' => 'false',
            ], "identificador postal del municipio {$codigoDane}");

            $codigoPostalMunicipio = collect($municipioPayload['features'])
                ->map(fn (array $feature) => $feature['attributes'] ?? [])
                ->first(fn (array $attributes) => ($attributes['Codigo_DANE'] ?? null) === $codigoDane);

            if ($codigoPostalMunicipio && ! empty($codigoPostalMunicipio['Codigo'])) {
                $barriosPayload = $this->consultarArcgis(self::CODIGO_POSTAL_BASE.'/1/query', [
                    'where' => "MunicipioID = '".addslashes((string) $codigoPostalMunicipio['Codigo'])."'",
                    'outFields' => 'Codigo,Nombre,MunicipioID,MunicipioNombre',
                    'returnGeometry' => 'false',
                    'orderByFields' => 'Nombre',
                ], "barrios del municipio {$codigoDane}");

                return [
                    'data' => collect($barriosPayload['features'])
                        ->map(fn (array $feature) => $feature['attributes'] ?? [])
                        ->filter(fn (array $attributes) => ! empty($attributes['Nombre']))
                        ->map(fn (array $attributes) => [
                            'id' => (string) ($attributes['Codigo'] ?? $attributes['Nombre']),
                            'nombre' => trim((string) $attributes['Nombre']),
                        ])
                        ->unique(fn (array $barrio) => $this->normalizar($barrio['nombre']))
                        ->values()
                        ->all(),
                    'api_disponible' => true,
                ];
            }
        } catch (ConnectionException|RequestException|RuntimeException $exception) {
            Log::warning("No se pudo consultar el catálogo postal de barrios para {$codigoDane}.", [
                'error' => $exception->getMessage(),
            ]);
            $apiDisponible = false;
        }

        return ['data' => [], 'api_disponible' => $apiDisponible];
    }

    /**
     * @return array{id: string, nombre: string, creado: bool}
     */
    public function registrarBarrio(string $municipioId, string $nombre): array
    {
        $municipio = ModulacionMunicipio::findOrFail($municipioId);
        $barrio = $this->guardarEnCatalogo($municipio, $nombre, 'manual');

        return [
            'id' => (string) $barrio->id,
            'nombre' => $barrio->nombre,
            'creado' => $barrio->wasRecentlyCreated,
        ];
    }

    private function guardarEnCatalogo(ModulacionMunicipio $municipio, string $nombre, string $origen): ModulacionBarrio
    {
        $nombre = trim(preg_replace('/\s+/u', ' ', $nombre) ?? $nombre);

        return ModulacionBarrio::firstOrCreate(
            [
                'municipio_id' => $municipio->id,
                'nombre_normalizado' => $this->normalizar($nombre),
            ],
            [
                'nombre' => $nombre,
                'origen' => $origen,
            ]
        );
    }

    private function normalizar(string $nombre): string
    {
        return Str::ascii(mb_strtolower(trim(preg_replace('/\s+/u', ' ', $nombre) ?? $nombre), 'UTF-8'));
    }

    /**
     * @return array<int, array{id: string, nombre: string}>
     */
    private function catalogoLocal(ModulacionMunicipio $municipio): array
    {
        return $municipio->barrios()
            ->orderBy('nombre')
            ->get(['id', 'nombre'])
            ->map(fn (ModulacionBarrio $barrio) => [
                'id' => (string) $barrio->id,
                'nombre' => $barrio->nombre,
            ])
            ->all();
    }

    /**
     * @param  array<string, string>  $params
     * @return array{features: array<int, array<string, mixed>>}
     */
    private function consultarArcgis(string $url, array $params, string $recurso): array
    {
        $response = Http::acceptJson()
            ->withHeaders(['User-Agent' => 'SistemaGestionAdenar/1.0'])
            ->timeout(15)
            ->retry([500, 1000])
            ->get($url, $params + ['f' => 'json']);

        $response->throw();
        $payload = $response->json();

        if (! is_array($payload) || isset($payload['error']) || ! is_array($payload['features'] ?? null)) {
            Log::warning("La API geográfica devolvió una respuesta inválida para {$recurso}", [
                'error' => $payload['error'] ?? null,
            ]);

            throw new RuntimeException("La respuesta de la API geográfica para {$recurso} no es válida.");
        }

        return $payload;
    }
}
