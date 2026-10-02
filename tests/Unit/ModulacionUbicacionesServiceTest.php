<?php

namespace Tests\Unit;

use App\Http\Controllers\Reparto\ModulacionController;
use App\Models\Reparto\ModulacionBarrio;
use App\Models\Reparto\ModulacionMunicipio;
use App\Models\Reparto\Cliente;
use App\Services\Reparto\ModulacionUbicacionesService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request as HttpRequest;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ModulacionUbicacionesServiceTest extends TestCase
{
    use RefreshDatabase;

    // ─── municipios() ────────────────────────────────────────────────────────

    public function test_municipios_retorna_lista_desde_reparto_clientes(): void
    {
        Cliente::create([
            'codigo_cliente' => '001',
            'municipio' => 'PASTO',
            'barrio' => 'CENTRO',
        ]);
        Cliente::create([
            'codigo_cliente' => '002',
            'municipio' => 'IPIALES',
            'barrio' => 'LA MERCED',
        ]);

        $municipios = app(ModulacionUbicacionesService::class)->municipios();

        $this->assertCount(2, $municipios);
        $this->assertSame(['Ipiales', 'Pasto'], array_column($municipios, 'nombre'));
        // El id es el slug normalizado
        $this->assertSame('ipiales', $municipios[0]['id']);
        $this->assertSame('pasto', $municipios[1]['id']);
    }

    public function test_municipios_retorna_array_vacio_si_no_hay_datos(): void
    {
        $municipios = app(ModulacionUbicacionesService::class)->municipios();

        $this->assertSame([], $municipios);
    }

    public function test_municipios_incluye_manuales_no_duplicados(): void
    {
        Cliente::create(['codigo_cliente' => '001', 'municipio' => 'PASTO', 'barrio' => 'CENTRO']);

        ModulacionMunicipio::create([
            'nombre' => 'Túquerres',
            'nombre_normalizado' => 'tuquerres',
            'origen' => 'manual',
        ]);

        $municipios = app(ModulacionUbicacionesService::class)->municipios();

        $nombres = array_column($municipios, 'nombre');
        $this->assertContains('Pasto', $nombres);
        $this->assertContains('Túquerres', $nombres);
        $this->assertCount(2, $municipios);
    }

    public function test_municipios_retorna_array_vacio_si_tabla_no_existe(): void
    {
        Schema::shouldReceive('hasTable')->with('reparto_clientes')->once()->andReturn(false);
        Schema::shouldReceive('hasTable')->with('modulacion_municipios')->once()->andReturn(false);

        $municipios = app(ModulacionUbicacionesService::class)->municipios();

        $this->assertSame([], $municipios);
    }

    // ─── barrios() ───────────────────────────────────────────────────────────

    public function test_barrios_retorna_lista_desde_reparto_clientes(): void
    {
        Cliente::create(['codigo_cliente' => '001', 'municipio' => 'PASTO', 'barrio' => 'CENTRO']);
        Cliente::create(['codigo_cliente' => '002', 'municipio' => 'PASTO', 'barrio' => 'LOS CRISTALES']);
        Cliente::create(['codigo_cliente' => '003', 'municipio' => 'IPIALES', 'barrio' => 'OTRO']);

        $resultado = app(ModulacionUbicacionesService::class)->barrios('pasto');

        $nombres = array_column($resultado['data'], 'nombre');
        $this->assertContains('Centro', $nombres);
        $this->assertContains('Los Cristales', $nombres);
        $this->assertCount(2, $resultado['data']);
        $this->assertFalse($resultado['api_disponible']);
    }

    // ─── registrarMunicipio / registrarBarrio ─────────────────────────────────

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
        $this->assertSame('municipio nuevo', $municipio['id']); // id = slug
        $this->assertTrue($barrio['creado']);
        $this->assertFalse($barrioDuplicado['creado']);
        $this->assertSame($barrio['id'], $barrioDuplicado['id']);
        $this->assertDatabaseCount('modulacion_municipios', 1);
        $this->assertDatabaseCount('modulacion_barrios', 1);
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

    public function test_permite_agregar_municipios_sin_duplicarlos(): void
    {
        $service = app(ModulacionUbicacionesService::class);

        $service->guardarUbicacionesDeRutas([
            ['viajes' => [
                ['lugares' => 'Municipio nuevo', 'barrio' => 'Barrio nuevo'],
                ['lugares' => 'MUNICIPIO NUEVO',  'barrio' => 'barrio nuevo'],
            ]],
        ]);

        $this->assertDatabaseCount('modulacion_municipios', 1);
        $this->assertDatabaseCount('modulacion_barrios', 1);

        $municipios = $service->municipios();
        $this->assertContains('municipio nuevo', array_column($municipios, 'id'));
    }

    // ─── endpoint barrios (sin anidar data) ──────────────────────────────────

    public function test_endpoint_de_barrios_devuelve_la_lista_sin_anidar_data(): void
    {
        Cliente::create(['codigo_cliente' => '001', 'municipio' => 'PASTO', 'barrio' => 'ACHALAY']);

        $response = app(ModulacionController::class)->barrios(
            HttpRequest::create('/modules/reparto/modulacion/referencias/barrios', 'GET', [
                'municipio_id' => 'pasto',
            ]),
            app(ModulacionUbicacionesService::class)
        );
        $payload = $response->getData(true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame([['id' => 'achalay', 'nombre' => 'Achalay']], $payload['data']);
        $this->assertFalse($payload['api_disponible']);
    }
}
