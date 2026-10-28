<?php

namespace Tests\Feature\Flota;

use App\Models\Flota\Vehiculo;
use App\Models\Seguridad\Alerta;
use App\Models\User;
use App\Notifications\Seguridad\AlertaGenerada;
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

        foreach (['Administrador', 'Flota', 'Reparto', 'Seguridad', 'Gente'] as $rol) {
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

        Notification::assertSentTo($this->correoDestino(), AlertaGenerada::class);
        Notification::assertNotSentTo($this->usuarios['Seguridad'], AlertaGenerada::class);
        Notification::assertNotSentTo($this->usuarios['Gente'], AlertaGenerada::class);

        $this->assertDatabaseHas('alertas', [
            'tipo' => 'vencimiento_soat',
            'pilar' => 'flota',
        ]);
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
        $this->assertDatabaseCount('alertas', 0);
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

        Notification::assertSentTo($this->usuarios['Flota'], AlertaGenerada::class);
        Notification::assertSentTimes(AlertaGenerada::class, 3); // 1 vehículo (RTM30) x 3 destinatarios
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

        Notification::assertSentTimes(AlertaGenerada::class, 3);
        $this->assertDatabaseCount('alertas', 1);
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
        Notification::assertSentTimes(AlertaGenerada::class, 3);

        $vehiculo->update(['fecha_vencimiento_soat' => now()->addDays(12)->toDateString()]);
        $this->artisan('flota:revisar-vencimiento-documentos');

        Notification::assertSentTimes(AlertaGenerada::class, 6);
        $this->assertDatabaseCount('alertas', 2);
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

        Notification::assertSentTimes(AlertaGenerada::class, 3);
    }

    public function test_the_mail_message_renders_with_the_placa_and_expiry_date(): void
    {
        $vehiculo = Vehiculo::create([
            'placa' => 'MAIL01',
            'is_active' => true,
            'fecha_vencimiento_soat' => now()->addDays(15)->toDateString(),
        ]);

        $alerta = Alerta::create([
            'tipo' => 'vencimiento_soat',
            'mensaje' => "El SOAT del vehículo con placa {$vehiculo->placa} vence en 15 días.",
            'contexto' => ['vehiculo_id' => $vehiculo->id],
        ]);

        $mail = (new AlertaGenerada($alerta))->toMail($this->usuarios['Flota']);

        $this->assertStringContainsString('SOAT', $mail->subject);
        $this->assertStringContainsString('MAIL01', $mail->introLines[1] ?? implode(' ', $mail->introLines));
        $this->assertNotEmpty($mail->actionUrl);
        $this->assertStringContainsString((string) $vehiculo->id, $mail->actionUrl);
    }
}
