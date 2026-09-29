<?php

namespace Tests\Unit;

use App\Http\Controllers\Reparto\ModulacionController;
use App\Models\Reparto\ModulacionMunicipio;
use App\Services\Reparto\ModulacionUbicacionesService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Http\Request as HttpRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ModulacionUbicacionesServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cache.default' => 'array']);
        Cache::flush();
    }

    public function test_carga_municipios_y_barrios_postales_en_catalogos_locales(): void
    {
        Http::fake([
            'https://geoportal.dane.gov.co/*/319/query*' => Http::response([
                'features' => [
                    ['attributes' => ['DPTO_CCDGO' => '52', 'DPTO_CNMBRE' => 'NARIÑO']],
                    ['attributes' => ['DPTO_CCDGO' => '05', 'DPTO_CNMBRE' => 'ANTIOQUIA']],
                ],
            ]),
            'https://geoportal.dane.gov.co/*/317/query*' => Http::response([
                'features' => [
                    ['attributes' => ['DPTO_CCDGO' => '52', 'MPIO_CDPMP' => '52001', 'MPIO_CNMBRE' => 'PASTO']],
                    ['attributes' => ['DPTO_CCDGO' => '05', 'MPIO_CDPMP' => '05001', 'MPIO_CNMBRE' => 'MEDELLÍN']],
                ],
            ]),
            'https://visor.codigopostal.gov.co/*/3/query*' => Http::response([
                'features' => [
                    ['attributes' => ['Codigo' => '11051', 'Codigo_DANE' => '52001']],
                ],
            ]),
            'https://visor.codigopostal.gov.co/*/1/query*' => Http::response([
                'features' => [
                    ['attributes' => ['Codigo' => '6634', 'Nombre' => 'Achalay']],
                    ['attributes' => ['Codigo' => '6798', 'Nombre' => 'Agualongo']],
                ],
            ]),
        ]);

        $service = app(ModulacionUbicacionesService::class);

        $this->assertSame([['id' => '52', 'nombre' => 'Nariño']], $service->departamentos());
        $municipios = $service->municipios();
        $this->assertCount(1, $municipios);
        $this->assertSame('Pasto', $municipios[0]['nombre']);

        $municipio = \App\Models\Reparto\ModulacionMunicipio::findOrFail($municipios[0]['id']);
        $this->assertSame('52001', $municipio->codigo_dane);
        $this->assertSame([
            'data' => [
                ['id' => '1', 'nombre' => 'Achalay'],
                ['id' => '2', 'nombre' => 'Agualongo'],
            ],
            'api_disponible' => true,
        ], $service->barrios((string) $municipio->id));

        Http::assertSent(fn (Request $request) => str_contains($request->url(), '/319/query')
            && $request['where'] === "DPTO_CCDGO = '52'");
        Http::assertSent(fn (Request $request) => str_contains($request->url(), '/317/query')
            && $request['where'] === "DPTO_CCDGO = '52'");
        Http::assertSent(fn (Request $request) => str_contains($request->url(), '/3/query')
            && $request['where'] === "Codigo_DANE = '52001'");
        Http::assertSent(fn (Request $request) => str_contains($request->url(), '/1/query')
            && $request['where'] === "MunicipioID = '11051'");
    }

    public function test_permite_agregar_municipios_y_barrios_faltantes_y_evitar_duplicados(): void
    {
        Http::fake([
            'https://geoportal.dane.gov.co/*/317/query*' => Http::response([
                'features' => [
                    ['attributes' => ['DPTO_CCDGO' => '52', 'MPIO_CDPMP' => '52001', 'MPIO_CNMBRE' => 'PASTO']],
                ],
            ]),
        ]);

        $service = app(ModulacionUbicacionesService::class);

        $service->guardarUbicacionesDeRutas([
            ['viajes' => [
                ['lugares' => 'Municipio nuevo', 'barrio' => '  Barrio   nuevo '],
                ['lugares' => ' MUNICIPIO   NUEVO ', 'barrio' => 'barrio nuevo'],
            ]],
        ]);

        $municipio = \App\Models\Reparto\ModulacionMunicipio::where('nombre_normalizado', 'municipio nuevo')->firstOrFail();
        $catalogoActualizado = $service->barrios((string) $municipio->id);

        $this->assertNull($municipio->codigo_dane);
        $this->assertSame(1, \App\Models\Reparto\ModulacionMunicipio::where('nombre_normalizado', 'municipio nuevo')->count());
        $this->assertSame(1, \App\Models\Reparto\ModulacionBarrio::where('municipio_id', $municipio->id)->count());
        $this->assertSame(
            [['id' => '1', 'nombre' => 'Barrio nuevo']],
            $catalogoActualizado['data']
        );
        $this->assertContains(
            ['id' => (string) $municipio->id, 'nombre' => 'Municipio Nuevo'],
            $service->municipios()
        );
    }

    public function test_devuelve_municipios_de_dane_si_falla_el_catalogo_local(): void
    {
        Http::fake([
            'https://geoportal.dane.gov.co/*/317/query*' => Http::response([
                'features' => [
                    ['attributes' => ['DPTO_CCDGO' => '52', 'MPIO_CDPMP' => '52001', 'MPIO_CNMBRE' => 'PASTO']],
                ],
            ]),
        ]);
        Schema::shouldReceive('hasTable')
            ->once()
            ->with('modulacion_municipios')
            ->andThrow(new \PDOException('Database unavailable'));

        $municipios = app(ModulacionUbicacionesService::class)->municipios();

        $this->assertSame([['id' => '52001', 'nombre' => 'Pasto']], $municipios);
    }

    public function test_endpoint_de_barrios_devuelve_la_lista_sin_anidar_data(): void
    {
        Http::fake([
            'https://visor.codigopostal.gov.co/*/3/query*' => Http::response([
                'features' => [
                    ['attributes' => ['Codigo' => '11051', 'Codigo_DANE' => '52001']],
                ],
            ]),
            'https://visor.codigopostal.gov.co/*/1/query*' => Http::response([
                'features' => [
                    ['attributes' => ['Codigo' => '6634', 'Nombre' => 'Achalay']],
                ],
            ]),
        ]);

        $municipio = ModulacionMunicipio::create([
            'codigo_dane' => '52001',
            'nombre' => 'Pasto',
            'nombre_normalizado' => 'pasto',
            'origen' => 'dane',
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
        $this->assertTrue($payload['api_disponible']);
    }
}
