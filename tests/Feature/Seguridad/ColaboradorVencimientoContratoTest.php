<?php

namespace Tests\Feature\Seguridad;

use App\Mail\Gente\ContratosPorVencerMail;
use App\Models\Seguridad\Alerta;
use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ColaboradorVencimientoContratoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Role::findOrCreate('Administrador', 'web');
        Role::findOrCreate('Seguridad', 'web');
        Role::findOrCreate('Gente', 'web');
        Role::findOrCreate('Contratos', 'web');
    }

    private function colaborador(array $overrides = []): Colaborador
    {
        return Colaborador::create([
            'cedula' => '700100200',
            'nombres' => 'Marcela',
            'apellidos' => 'Ortiz',
            'is_active' => true,
            'estado_registro' => 'completo',
            'wizard_step' => 4,
            ...$overrides,
        ]);
    }

    public function test_it_creates_an_alert_for_contracts_expiring_soon(): void
    {
        Mail::fake();

        $colaborador = $this->colaborador(['fecha_retiro_empresa' => now()->addDays(10)->toDateString()]);

        $this->artisan('seguridad:revisar-vencimiento-contratos')->assertSuccessful();

        $this->assertSame(1, Alerta::where('colaborador_id', $colaborador->id)
            ->where('tipo', 'retiro_proximo')
            ->where('pilar', 'gente')
            ->count());
    }

    public function test_notifica_solo_a_contratos(): void
    {
        Mail::fake();

        $contratos = User::factory()->create(['email' => 'contratos@ejemplo.com']);
        $contratos->assignRole('Contratos');
        $gente = User::factory()->create(['email' => 'gente@ejemplo.com']);
        $gente->assignRole('Gente');
        $seguridad = User::factory()->create(['email' => 'seguridad@ejemplo.com']);
        $seguridad->assignRole('Seguridad');

        $this->colaborador(['fecha_retiro_empresa' => now()->addDays(10)->toDateString()]);

        $this->artisan('seguridad:revisar-vencimiento-contratos')->assertSuccessful();

        // El correo debe llegar al rol Contratos
        Mail::assertSent(ContratosPorVencerMail::class, fn ($mail) => $mail->hasTo('contratos@ejemplo.com'));

        // No debe llegar a Gente ni a Seguridad
        Mail::assertNotSent(ContratosPorVencerMail::class, fn ($mail) => $mail->hasTo('gente@ejemplo.com'));
        Mail::assertNotSent(ContratosPorVencerMail::class, fn ($mail) => $mail->hasTo('seguridad@ejemplo.com'));
    }

    public function test_it_does_not_duplicate_the_alert_on_a_second_run(): void
    {
        Mail::fake();

        $colaborador = $this->colaborador(['fecha_retiro_empresa' => now()->addDays(10)->toDateString()]);

        $this->artisan('seguridad:revisar-vencimiento-contratos');
        $this->artisan('seguridad:revisar-vencimiento-contratos');

        $this->assertSame(1, Alerta::where('colaborador_id', $colaborador->id)->count());
    }

    public function test_it_ignores_contracts_far_from_expiring(): void
    {
        Mail::fake();

        $this->colaborador(['fecha_retiro_empresa' => now()->addMonths(6)->toDateString()]);

        $this->artisan('seguridad:revisar-vencimiento-contratos');

        $this->assertSame(0, Alerta::where('tipo', 'retiro_proximo')->count());
    }

    public function test_it_ignores_draft_colaboradores(): void
    {
        Mail::fake();

        $this->colaborador([
            'cedula' => '700100201',
            'fecha_retiro_empresa' => now()->addDays(5)->toDateString(),
            'estado_registro' => 'borrador',
            'wizard_step' => 3,
        ]);

        $this->artisan('seguridad:revisar-vencimiento-contratos');

        $this->assertSame(0, Alerta::where('tipo', 'retiro_proximo')->count());
    }
}
