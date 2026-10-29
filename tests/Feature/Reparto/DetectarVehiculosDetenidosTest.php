<?php

namespace Tests\Feature\Reparto;

use App\Enums\Role as RoleEnum;
use App\Models\Reparto\Modulacion;
use App\Models\Reparto\ModulacionItem;
use App\Models\User;
use App\Notifications\Seguridad\AlertaGenerada;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class DetectarVehiculosDetenidosTest extends TestCase
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

        Role::findOrCreate(RoleEnum::Reparto->value, 'web');
        Role::findOrCreate(RoleEnum::Administrador->value, 'web');

        $reparto = User::factory()->create(['email' => 'reparto@ejemplo.com']);
        $reparto->assignRole(RoleEnum::Reparto->value);
        $admin = User::factory()->create(['email' => 'admin@ejemplo.com']);
        $admin->assignRole(RoleEnum::Administrador->value);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    /**
     * Fuera de la bodega por defecto (la bodega está en 1.153695,-77.305209),
     * detenido hace 40 minutos (sobre el umbral de 30).
     *
     * @param  array<string, mixed>  $overrides
     */
    private function fakearMygeotab(array $overrides = []): void
    {
        Cache::forget('mygeotab.session_id');

        $estado = array_merge([
            'device' => ['id' => 'b1'],
            'speed' => 0,
            'latitude' => 1.5,
            'longitude' => -77.5,
            'dateTime' => now()->copy()->setTimezone('UTC')->toIso8601ZuluString(),
            'currentStateDuration' => '00:40:00',
        ], $overrides);

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

            return Http::response(['error' => ['message' => 'no mock']], 500);
        });
    }

    private function crearRutaHoyParaPsx001(): void
    {
        $modulacion = Modulacion::create(['fecha' => now()->toDateString()]);
        ModulacionItem::create(['modulacion_id' => $modulacion->id, 'placa' => 'psx001', 'nombres' => 'Juan Pérez']);
    }

    public function test_notifica_cuando_pasan_los_3_filtros(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-27 14:00:00', config('app.timezone')));
        Notification::fake();
        $this->fakearMygeotab();
        $this->crearRutaHoyParaPsx001();

        $this->artisan('reparto:detectar-vehiculos-detenidos')->assertSuccessful();

        // 2 destinatarios: Reparto + Administrador.
        Notification::assertSentTimes(AlertaGenerada::class, 2);
        Notification::assertSentTo(User::where('email', 'reparto@ejemplo.com')->first(), AlertaGenerada::class);
        Notification::assertSentTo(User::where('email', 'admin@ejemplo.com')->first(), AlertaGenerada::class);

        $this->assertDatabaseHas('alertas', [
            'tipo' => 'vehiculo_detenido',
            'pilar' => 'reparto',
        ]);
    }

    public function test_no_notifica_fuera_de_horario_laboral(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-27 23:30:00', config('app.timezone')));
        Notification::fake();
        $this->fakearMygeotab();
        $this->crearRutaHoyParaPsx001();

        $this->artisan('reparto:detectar-vehiculos-detenidos')->assertSuccessful();

        Notification::assertNothingSent();
    }

    public function test_no_notifica_sin_ruta_activa_hoy(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-27 14:00:00', config('app.timezone')));
        Notification::fake();
        $this->fakearMygeotab();
        // Sin crearRutaHoyParaPsx001(): no hay Modulación hoy para esta placa.

        $this->artisan('reparto:detectar-vehiculos-detenidos')->assertSuccessful();

        Notification::assertNothingSent();
    }

    public function test_no_notifica_dentro_de_la_geocerca_de_la_bodega(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-27 14:00:00', config('app.timezone')));
        Notification::fake();
        $this->fakearMygeotab(['latitude' => 1.153695, 'longitude' => -77.305209]);
        $this->crearRutaHoyParaPsx001();

        $this->artisan('reparto:detectar-vehiculos-detenidos')->assertSuccessful();

        Notification::assertNothingSent();
    }

    public function test_no_notifica_antes_de_30_minutos(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-27 14:00:00', config('app.timezone')));
        Notification::fake();
        $this->fakearMygeotab(['currentStateDuration' => '00:10:00']);
        $this->crearRutaHoyParaPsx001();

        $this->artisan('reparto:detectar-vehiculos-detenidos')->assertSuccessful();

        Notification::assertNothingSent();
    }

    public function test_no_duplica_notificacion_en_corridas_sucesivas(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-27 14:00:00', config('app.timezone')));
        Notification::fake();
        $this->fakearMygeotab();
        $this->crearRutaHoyParaPsx001();

        $this->artisan('reparto:detectar-vehiculos-detenidos')->assertSuccessful();
        $this->artisan('reparto:detectar-vehiculos-detenidos')->assertSuccessful();

        // 2 destinatarios en UNA sola corrida real; la segunda no repite.
        Notification::assertSentTimes(AlertaGenerada::class, 2);
    }
}
