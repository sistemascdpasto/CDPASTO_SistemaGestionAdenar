<?php

namespace Tests\Feature\Flota;

use App\Models\Flota\VehiculoKilometroDiario;
use App\Services\Flota\MygeotabKilometrosSyncService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MygeotabSyncTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::forget('mygeotab.session_id');
        config([
            'services.mygeotab.username' => 'usuario@ejemplo.com',
            'services.mygeotab.password' => 'secreta',
            'services.mygeotab.database' => 'tenant_prueba',
            'services.mygeotab.sync_token' => 'token-de-prueba',
        ]);
    }

    private function fakearMygeotab(): void
    {
        Http::fake(function ($request) {
            $metodo = $request['method'] ?? null;

            if ($metodo === 'Authenticate') {
                return Http::response(['result' => ['credentials' => ['sessionId' => 'sesion-123']]]);
            }

            if ($metodo === 'Get' && ($request['params']['typeName'] ?? null) === 'Device') {
                return Http::response(['result' => [
                    ['id' => 'b1', 'name' => 'COPSX001', 'licensePlate' => 'COPSX001'],
                    ['id' => 'b2', 'name' => 'COLJU894', 'licensePlate' => ' colju894 '],
                ]]);
            }

            if ($metodo === 'Get' && ($request['params']['typeName'] ?? null) === 'Trip') {
                return Http::response(['result' => [
                    ['device' => ['id' => 'b1'], 'distance' => 50.5, 'start' => '2026-10-23T10:00:00.000Z'],
                    ['device' => ['id' => 'b1'], 'distance' => 20.25, 'start' => '2026-10-23T15:00:00.000Z'],
                    ['device' => ['id' => 'b2'], 'distance' => 100, 'start' => '2026-10-23T12:00:00.000Z'],
                ]]);
            }

            return Http::response(['error' => ['name' => 'Desconocido', 'message' => 'Método no mockeado']], 500);
        });
    }

    public function test_sincroniza_y_suma_km_por_dispositivo_normalizando_la_placa(): void
    {
        $this->fakearMygeotab();

        $resumen = app(MygeotabKilometrosSyncService::class)->sincronizarDia(
            Carbon::parse('2026-10-23', config('app.timezone'))
        );

        $this->assertSame(2, $resumen['vehiculos_actualizados']);
        $this->assertSame(3, $resumen['viajes_procesados']);

        $this->assertDatabaseHas('vehiculo_kilometros_diarios', [
            'fecha' => '2026-10-23',
            'placa' => 'COPSX001',
            'distancia_km' => 70.75,
        ]);
        $this->assertDatabaseHas('vehiculo_kilometros_diarios', [
            'fecha' => '2026-10-23',
            'placa' => 'COLJU894',
            'distancia_km' => 100,
        ]);
    }

    public function test_resincronizar_el_mismo_dia_actualiza_en_vez_de_duplicar(): void
    {
        $this->fakearMygeotab();
        $servicio = app(MygeotabKilometrosSyncService::class);
        $fecha = Carbon::parse('2026-10-23', config('app.timezone'));

        $servicio->sincronizarDia($fecha);
        $servicio->sincronizarDia($fecha);

        $this->assertSame(2, VehiculoKilometroDiario::count());
    }

    public function test_el_endpoint_de_sincronizacion_exige_el_token(): void
    {
        $this->postJson(route('api.mygeotab.sincronizar-km'))->assertStatus(401);
        $this->postJson(route('api.mygeotab.sincronizar-km'), [], ['Authorization' => 'Bearer invalido'])->assertStatus(401);
    }

    public function test_el_endpoint_de_sincronizacion_funciona_con_el_token_correcto(): void
    {
        $this->fakearMygeotab();

        $response = $this->postJson(
            route('api.mygeotab.sincronizar-km'),
            ['fecha' => '2026-10-23'],
            ['Authorization' => 'Bearer token-de-prueba']
        );

        $response->assertOk()->assertJson([
            'fecha' => '2026-10-23',
            'vehiculos_actualizados' => 2,
        ]);
    }
}
