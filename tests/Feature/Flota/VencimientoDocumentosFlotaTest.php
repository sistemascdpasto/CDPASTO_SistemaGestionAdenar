<?php

namespace Tests\Feature\Flota;

use App\Models\Flota\Vehiculo;
use App\Models\User;
use App\Notifications\Flota\VencimientoDocumentoVehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class VencimientoDocumentosFlotaTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @var array<string, User>
     */
    private array $usuarios = [];

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['Administrador', 'Flota', 'Reparto', 'Seguridad'] as $rol) {
            Role::create(['name' => $rol, 'guard_name' => 'web']);
            $user = User::factory()->create(['email' => strtolower($rol).'@adenar.test']);
            $user->assignRole($rol);
            $this->usuarios[$rol] = $user;
        }
    }

    private function correoDestino(): array
    {
        return [$this->usuarios['Administrador'], $this->usuarios['Flota'], $this->usuarios['Reparto']];
    }

    public function test_it_notifies_the_right_roles_when_soat_expires_within_15_days(): void
    {
        Notification::fake();

        Vehiculo::create([
            'placa' => 'SOAT15',
            'is_active' => true,
            'fecha_vencimiento_soat' => now()->addDays(15)->toDateString(),
        ]);

        $this->artisan('flota:revisar-vencimiento-documentos')->assertSuccessful();

        Notification::assertSentTo($this->correoDestino(), VencimientoDocumentoVehiculo::class);
        Notification::assertNotSentTo($this->usuarios['Seguridad'], VencimientoDocumentoVehiculo::class);
    }

    public function test_it_does_not_notify_soat_still_far_from_expiring(): void
    {
        Notification::fake();

        Vehiculo::create([
            'placa' => 'SOAT30',
            'is_active' => true,
            'fecha_vencimiento_soat' => now()->addDays(20)->toDateString(),
        ]);

        $this->artisan('flota:revisar-vencimiento-documentos')->assertSuccessful();

        Notification::assertNothingSent();
    }

    public function test_it_notifies_tecnomecanica_30_days_before_but_not_earlier(): void
    {
        Notification::fake();

        Vehiculo::create([
            'placa' => 'RTM30',
            'is_active' => true,
            'fecha_vencimiento_tecnomecanica' => now()->addDays(30)->toDateString(),
        ]);
        Vehiculo::create([
            'placa' => 'RTM40',
            'is_active' => true,
            'fecha_vencimiento_tecnomecanica' => now()->addDays(40)->toDateString(),
        ]);

        $this->artisan('flota:revisar-vencimiento-documentos')->assertSuccessful();

        Notification::assertSentTo($this->usuarios['Flota'], VencimientoDocumentoVehiculo::class);
        Notification::assertSentTimes(VencimientoDocumentoVehiculo::class, 3); // 1 vehículo (RTM30) x 3 destinatarios
    }

    public function test_it_does_not_notify_twice_for_the_same_expiry_date(): void
    {
        Notification::fake();

        Vehiculo::create([
            'placa' => 'ONCE01',
            'is_active' => true,
            'fecha_vencimiento_soat' => now()->addDays(10)->toDateString(),
        ]);

        $this->artisan('flota:revisar-vencimiento-documentos');
        $this->artisan('flota:revisar-vencimiento-documentos');

        Notification::assertSentTimes(VencimientoDocumentoVehiculo::class, 3);
    }

    public function test_it_notifies_again_when_the_expiry_date_changes(): void
    {
        Notification::fake();

        $vehiculo = Vehiculo::create([
            'placa' => 'RENEW1',
            'is_active' => true,
            'fecha_vencimiento_soat' => now()->addDays(10)->toDateString(),
        ]);

        $this->artisan('flota:revisar-vencimiento-documentos');
        Notification::assertSentTimes(VencimientoDocumentoVehiculo::class, 3);

        $vehiculo->update(['fecha_vencimiento_soat' => now()->addDays(12)->toDateString()]);
        $this->artisan('flota:revisar-vencimiento-documentos');

        Notification::assertSentTimes(VencimientoDocumentoVehiculo::class, 6);
    }

    public function test_it_also_notifies_already_expired_documents(): void
    {
        Notification::fake();

        Vehiculo::create([
            'placa' => 'VENC01',
            'is_active' => true,
            'fecha_vencimiento_soat' => now()->subDays(5)->toDateString(),
        ]);

        $this->artisan('flota:revisar-vencimiento-documentos')->assertSuccessful();

        Notification::assertSentTimes(VencimientoDocumentoVehiculo::class, 3);
    }

    public function test_the_mail_message_renders_with_the_placa_and_expiry_date(): void
    {
        $vehiculo = Vehiculo::create([
            'placa' => 'MAIL01',
            'is_active' => true,
            'fecha_vencimiento_soat' => now()->addDays(15)->toDateString(),
        ]);

        $mail = (new VencimientoDocumentoVehiculo(
            $vehiculo,
            VencimientoDocumentoVehiculo::TIPO_SOAT,
            $vehiculo->fecha_vencimiento_soat,
        ))->toMail($this->usuarios['Flota']);

        $this->assertStringContainsString('MAIL01', $mail->subject);
        $this->assertStringContainsString('SOAT', $mail->subject);
        $this->assertNotEmpty($mail->actionUrl);
    }
}
