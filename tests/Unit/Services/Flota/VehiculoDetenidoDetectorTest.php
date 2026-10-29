<?php

namespace Tests\Unit\Services\Flota;

use App\Models\Flota\VehiculoEstadoMygeotab;
use App\Services\Flota\VehiculoDetenidoDetector;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class VehiculoDetenidoDetectorTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.mygeotab.username' => 'usuario@ejemplo.com',
            'services.mygeotab.password' => 'secreta',
            'services.mygeotab.database' => 'tenant_prueba',
        ]);
    }

    /**
     * @param  array<string, mixed>  $estadoOverrides
     */
    private function fakearMygeotab(array $estadoOverrides = []): void
    {
        Cache::forget('mygeotab.session_id');

        $estado = array_merge([
            'device' => ['id' => 'b1'],
            'speed' => 0,
            'latitude' => 1.2,
            'longitude' => -77.3,
            'dateTime' => '2026-10-27T15:51:36.063Z',
            'currentStateDuration' => '00:30:00',
        ], $estadoOverrides);

        Http::fake(function ($request) use ($estado) {
            $metodo = $request['method'] ?? null;

            if ($metodo === 'Authenticate') {
                return Http::response(['result' => ['credentials' => ['sessionId' => 'sesion-123']]]);
            }

            if ($metodo === 'Get' && ($request['params']['typeName'] ?? null) === 'Device') {
                return Http::response(['result' => [
                    ['id' => 'b1', 'name' => 'COPSX001', 'licensePlate' => 'COPSX001'],
                ]]);
            }

            if ($metodo === 'Get' && ($request['params']['typeName'] ?? null) === 'DeviceStatusInfo') {
                return Http::response(['result' => [$estado]]);
            }

            return Http::response(['error' => ['name' => 'Desconocido', 'message' => 'Método no mockeado']], 500);
        });
    }

    public function test_detecta_detenido_y_calcula_detenido_desde_desde_current_state_duration(): void
    {
        $this->fakearMygeotab(['dateTime' => '2026-10-27T15:51:36.000Z', 'currentStateDuration' => '00:30:00']);

        app(VehiculoDetenidoDetector::class)->actualizarEstados();

        $fila = VehiculoEstadoMygeotab::where('placa', 'PSX001')->first();

        $this->assertNotNull($fila);
        $this->assertTrue($fila->detenido);
        // 15:51:36 UTC - 30min = 15:21:36 UTC = 10:21:36 America/Bogota (-5h).
        $this->assertSame('2026-10-27 10:21:36', $fila->detenido_desde->toDateTimeString());
    }

    public function test_parsea_duracion_con_dias(): void
    {
        // "2.21:01:10" = 2 días, 21h, 1min, 10s (formato TimeSpan de MyGeotab).
        $this->fakearMygeotab(['dateTime' => '2026-10-27T15:51:36.000Z', 'currentStateDuration' => '2.21:01:10']);

        app(VehiculoDetenidoDetector::class)->actualizarEstados();

        $fila = VehiculoEstadoMygeotab::where('placa', 'PSX001')->first();

        $this->assertSame('2026-10-24 13:50:26', $fila->detenido_desde->toDateTimeString());
    }

    public function test_vehiculo_en_movimiento_limpia_detenido_desde_y_notificado_en(): void
    {
        VehiculoEstadoMygeotab::create([
            'placa' => 'PSX001',
            'detenido' => true,
            'detenido_desde' => now()->subHour(),
            'notificado_en' => now(),
        ]);

        $this->fakearMygeotab(['speed' => 45]);

        app(VehiculoDetenidoDetector::class)->actualizarEstados();

        $fila = VehiculoEstadoMygeotab::where('placa', 'PSX001')->first();

        $this->assertFalse($fila->detenido);
        $this->assertNull($fila->detenido_desde);
        $this->assertNull($fila->notificado_en);
    }

    /**
     * Regresión del bug real encontrado al probar contra la API real de
     * MyGeotab: 'dateTime' viene en UTC y hay que convertirlo a la zona de
     * la app ANTES de guardar (Eloquent no convierte zonas horarias al
     * leer de la BD, reinterpreta los mismos dígitos). Sin esa conversión,
     * dos corridas seguidas de la MISMA parada calculaban un
     * 'detenido_desde' distinto cada vez (un desfase de varias horas) y
     * eso reiniciaba 'notificado_en' sin parar — nunca llegaba a notificar.
     */
    public function test_corridas_consecutivas_de_la_misma_parada_preservan_notificado_en(): void
    {
        Cache::forget('mygeotab.session_id');

        // Http::fake() con una segunda llamada DENTRO del mismo test no
        // reemplaza la primera (confirmado aparte) — para simular dos
        // sondeos reales y sucesivos hace falta un solo fake que devuelva
        // una respuesta distinta en cada llamada, vía un contador.
        $numeroDeConsulta = 0;
        $estadosPorConsulta = [
            ['device' => ['id' => 'b1'], 'speed' => 0, 'latitude' => 1.2, 'longitude' => -77.3, 'dateTime' => '2026-10-27T15:00:00.000Z', 'currentStateDuration' => '01:00:00'],
            // Segundo sondeo, 5 minutos después, misma parada: la duración
            // reportada por MyGeotab avanza en la misma proporción.
            ['device' => ['id' => 'b1'], 'speed' => 0, 'latitude' => 1.2, 'longitude' => -77.3, 'dateTime' => '2026-10-27T15:05:00.000Z', 'currentStateDuration' => '01:05:00'],
        ];

        Http::fake(function ($request) use (&$numeroDeConsulta, $estadosPorConsulta) {
            $metodo = $request['method'] ?? null;

            if ($metodo === 'Authenticate') {
                return Http::response(['result' => ['credentials' => ['sessionId' => 'sesion-123']]]);
            }

            if ($metodo === 'Get' && ($request['params']['typeName'] ?? null) === 'Device') {
                return Http::response(['result' => [
                    ['id' => 'b1', 'name' => 'COPSX001', 'licensePlate' => 'COPSX001'],
                ]]);
            }

            if ($metodo === 'Get' && ($request['params']['typeName'] ?? null) === 'DeviceStatusInfo') {
                $estado = $estadosPorConsulta[min($numeroDeConsulta, count($estadosPorConsulta) - 1)];
                $numeroDeConsulta++;

                return Http::response(['result' => [$estado]]);
            }

            return Http::response(['error' => ['message' => 'no mock']], 500);
        });

        app(VehiculoDetenidoDetector::class)->actualizarEstados();
        VehiculoEstadoMygeotab::where('placa', 'PSX001')->update(['notificado_en' => now()]);

        app(VehiculoDetenidoDetector::class)->actualizarEstados();

        $fila = VehiculoEstadoMygeotab::where('placa', 'PSX001')->first();

        $this->assertNotNull($fila->notificado_en, 'notificado_en no debería reiniciarse si es la misma parada.');
    }

    public function test_una_parada_nueva_reinicia_notificado_en(): void
    {
        // Estado "anterior" sembrado directo en BD (no con varias llamadas
        // seguidas a Http::fake() dentro del mismo test — no es confiable
        // fuera de un TestCase real, ver MygeotabSyncTest para el mismo
        // criterio de un solo fake por test): una parada vieja, ya
        // notificada, que arrancó horas antes de lo que reporta ahora MyGeotab.
        VehiculoEstadoMygeotab::create([
            'placa' => 'PSX001',
            'detenido' => true,
            'detenido_desde' => Carbon::parse('2026-10-27 05:00:00', 'America/Bogota'),
            'notificado_en' => now(),
        ]);

        // MyGeotab ahora reporta una parada corta y reciente: se movió y se
        // volvió a detener entre sondeos — es un evento nuevo.
        $this->fakearMygeotab(['dateTime' => '2026-10-27T16:00:00.000Z', 'currentStateDuration' => '00:02:00']);
        app(VehiculoDetenidoDetector::class)->actualizarEstados();

        $fila = VehiculoEstadoMygeotab::where('placa', 'PSX001')->first();

        $this->assertNull($fila->notificado_en);
    }

    public function test_quita_el_prefijo_co_de_la_placa_del_dispositivo(): void
    {
        $this->fakearMygeotab();

        app(VehiculoDetenidoDetector::class)->actualizarEstados();

        $this->assertDatabaseHas('vehiculo_estado_mygeotab', ['placa' => 'PSX001']);
        $this->assertDatabaseMissing('vehiculo_estado_mygeotab', ['placa' => 'COPSX001']);
    }
}
