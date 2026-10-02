<?php

namespace Tests\Unit;

use App\Http\Controllers\Reparto\ModulacionController;
use App\Models\Reparto\ModulacionBarrio;
use App\Models\Reparto\ModulacionMunicipio;
use App\Services\Reparto\ModulacionUbicacionesService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request as HttpRequest;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ModulacionUbicacionesServiceTest extends TestCase
{
    use RefreshDatabase;

    // ─── municipios() ────────────────────────────────────────────────────────

    public function test_municipios_retorna_lista_del_catalogo_local(): void
    {
        ModulacionMunicipio::create([
            'nombre'             => 'Pasto',
            'nombre_normalizado' => 'pasto',
            'origen'             => 'catalogo_clientes',
        ]);
        ModulacionMunicipio::create([
            'nombre'             => 'Ipiales',
            'nombre_normalizado' => 'ipiales',
            'origen'             => 'catalogo_clientes',
        ]);

        $municipios = app(ModulacionUbicacionesService::class)->municipios();

        $this->assertCount(2, $municipios);
        $this->assertSame(['Ipiales', 'Pasto'], array_column($municipios, 'nombre'));
    }

    public function test_municipios_retorna_array_vacio_si_catalogo_local_esta_vacio(): void
    {
        $municipios = app(ModulacionUbicacionesService::class)->municipios();

        $this->assertSame([], $municipios);
    }

    public function test_municipios_retorna_array_vacio_si_tabla_no_existe(): void
    {
        Schema::shouldReceive('hasTable')
            ->once()
            ->with('modulacion_municipios')
            ->andReturn(false);

        $municipios = app(ModulacionUbicacionesService::class)->municipios();

        $this->assertSame([], $municipios);
    }

    // ─── barrios() ───────────────────────────────────────────────────────────

    public function test_barrios_retorna_catalogo_local_del_municipio(): void
    {
        $municipio = ModulacionMunicipio::create([
            'codigo_dane'        => '52001',
            'nombre'             => 'Pasto',
            'nombre_normalizado' => 'pasto',
            'origen'             => 'catalogo_clientes',
        ]);

        ModulacionBarrio::create([
            'municipio_id'       => $municipio->id,
            'nombre'             => 'Achalay',
            'nombre_normalizado' => 'achalay',
            'origen'             => 'catalogo_clientes',
        ]);
        ModulacionBarrio::create([
            'municipio_id'       => $municipio->id,
            'nombre'             => 'Agualongo',
            'nombre_normalizado' => 'agualongo',
            'origen'             => 'catalogo_clientes',
        ]);

        $resultado = app(ModulacionUbicacionesService::class)->barrios((string) $municipio->id);

        $this->assertSame([
            ['id' => '1', 'nombre' => 'Achalay'],
            ['id' => '2', 'nombre' => 'Agualongo'],
        ], $resultado['data']);
        $this->assertFalse($resultado['api_disponible']);
    }

    // ─── registrarMunicipio() / registrarBarrio() ─────────────────────────────

    public function test_registra_municipios_y_barrios_manuales_sin_duplicarlos(): void
    {
        $service = app(ModulacionUbicacionesService::class);

        $municipio         = $service->registrarMunicipio('  Municipio   Nuevo ');
        $municipioDuplicado = $service->registrarMunicipio('MUNICIPIO NUEVO');
        $barrio            = $service->registrarBarrio($municipio['id'], '  Barrio   Nuevo ');
        $barrioDuplicado   = $service->registrarBarrio($municipio['id'], 'BARRIO NUEVO');

        $this->assertTrue($municipio['creado']);
        $this->assertFalse($municipioDuplicado['creado']);
        $this->assertSame($municipio['id'], $municipioDuplicado['id']);
        $this->assertSame('Municipio Nuevo', $municipio['nombre']);
        $this->assertTrue($barrio['creado']);
        $this->assertFalse($barrioDuplicado['creado']);
        $this->assertSame($barrio['id'], $barrioDuplicado['id']);
        $this->assertSame('Barrio Nuevo', $barrio['nombre']);
        $this->assertDatabaseCount('modulacion_municipios', 1);
        $this->assertDatabaseCount('modulacion_barrios', 1);
    }

    public function test_permite_agregar_municipios_y_barrios_faltantes_y_evitar_duplicados(): void
    {
        $service = app(ModulacionUbicacionesService::class);

        $service->guardarUbicacionesDeRutas([
            ['viajes' => [
                ['lugares' => 'Municipio nuevo', 'barrio' => '  Barrio   nuevo '],
                ['lugares' => ' MUNICIPIO   NUEVO ', 'barrio' => 'barrio nuevo'],
            ]],
        ]);

        $municipio        = ModulacionMunicipio::where('nombre_normalizado', 'municipio nuevo')->firstOrFail();
        $catalogoActualizado = $service->barrios((string) $municipio->id);

        $this->assertNull($municipio->codigo_dane);
        $this->assertSame(1, ModulacionMunicipio::where('nombre_normalizado', 'municipio nuevo')->count());
        $this->assertSame(1, ModulacionBarrio::where('municipio_id', $municipio->id)->count());
        $this->assertSame(
            [['id' => '1', 'nombre' => 'Barrio nuevo']],
            $catalogoActualizado['data']
        );
        $this->assertContains(
            ['id' => (string) $municipio->id, 'nombre' => 'Municipio Nuevo'],
            $service->municipios()
        );
    }

    public function test_guarda_varios_barrios_del_mismo_municipio_en_un_viaje(): void
    {
        app(ModulacionUbicacionesService::class)->guardarUbicacionesDeRutas([
            [
                'viajes' => [
                    [
                        'lugares' => 'Pasto',
                        'barrio'  => 'Centro',
                        'destinos' => [
                            ['lugares' => 'Pasto', 'barrio' => 'Centro'],
                            ['lugares' => 'Pasto', 'barrio' => 'San Andres'],
                        ],
                    ],
                ],
            ],
        ]);

        $this->assertDatabaseCount('modulacion_municipios', 1);
        $this->assertDatabaseCount('modulacion_barrios', 2);
        $this->assertDatabaseHas('modulacion_barrios', ['nombre_normalizado' => 'centro']);
        $this->assertDatabaseHas('modulacion_barrios', ['nombre_normalizado' => 'san andres']);
    }

    // ─── endpoint barrios (sin anidar data) ──────────────────────────────────

    public function test_endpoint_de_barrios_devuelve_la_lista_sin_anidar_data(): void
    {
        $municipio = ModulacionMunicipio::create([
            'codigo_dane'        => '52001',
            'nombre'             => 'Pasto',
            'nombre_normalizado' => 'pasto',
            'origen'             => 'catalogo_clientes',
        ]);
        ModulacionBarrio::create([
            'municipio_id'       => $municipio->id,
            'nombre'             => 'Achalay',
            'nombre_normalizado' => 'achalay',
            'origen'             => 'catalogo_clientes',
        ]);

        $response = app(ModulacionController::class)->barrios(
            HttpRequest::create('/modules/reparto/modulacion/referencias/barrios', 'GET', [
                'municipio_id' => (string) $municipio->id,
            ]),
            app(ModulacionUbicacionesService::class)
        );
        $payload = $response->getData(true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame([['id' => '1', 'nombre' => 'Achalay']], $payload['data']);
        $this->assertFalse($payload['api_disponible']);
    }
}
