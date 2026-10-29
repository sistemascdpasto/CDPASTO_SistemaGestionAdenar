<?php

namespace Tests\Feature\Seguridad;

use App\Models\Seguridad\Alerta;
use App\Models\Seguridad\Colaborador;
use App\Models\User;
use App\Notifications\Seguridad\AlertaGenerada;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ColaboradorVencimientoContratoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // AlertaNotifier manda 'retiro_proximo' exclusivamente al rol
        // Contratos (no a Gente ni a Administrador) — ver
        // test_notifica_solo_a_contratos. findOrCreate: la migración
        // 2026_10_29_080000_create_contratos_role ya crea el rol Contratos.
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
        Notification::fake();

        $colaborador = $this->colaborador(['fecha_retiro_empresa' => now()->addDays(10)->toDateString()]);

        $this->artisan('seguridad:revisar-vencimiento-contratos')->assertSuccessful();

        $this->assertSame(1, Alerta::where('colaborador_id', $colaborador->id)
            ->where('tipo', 'retiro_proximo')
            ->where('pilar', 'gente')
            ->count());
    }

    public function test_notifica_solo_a_contratos(): void
    {
        Notification::fake();

        $contratos = User::factory()->create(['email' => 'contratos@ejemplo.com']);
        $contratos->assignRole('Contratos');
        $gente = User::factory()->create(['email' => 'gente@ejemplo.com']);
        $gente->assignRole('Gente');
        $seguridad = User::factory()->create(['email' => 'seguridad@ejemplo.com']);
        $seguridad->assignRole('Seguridad');

        $this->colaborador(['fecha_retiro_empresa' => now()->addDays(10)->toDateString()]);

        $this->artisan('seguridad:revisar-vencimiento-contratos')->assertSuccessful();

        Notification::assertSentTo($contratos, AlertaGenerada::class);
        Notification::assertNotSentTo($gente, AlertaGenerada::class);
        Notification::assertNotSentTo($seguridad, AlertaGenerada::class);
    }

    public function test_it_does_not_duplicate_the_alert_on_a_second_run(): void
    {
        Notification::fake();

        $colaborador = $this->colaborador(['fecha_retiro_empresa' => now()->addDays(10)->toDateString()]);

        $this->artisan('seguridad:revisar-vencimiento-contratos');
        $this->artisan('seguridad:revisar-vencimiento-contratos');

        $this->assertSame(1, Alerta::where('colaborador_id', $colaborador->id)->count());
    }

    public function test_it_ignores_contracts_far_from_expiring(): void
    {
        Notification::fake();

        $this->colaborador(['fecha_retiro_empresa' => now()->addMonths(6)->toDateString()]);

        $this->artisan('seguridad:revisar-vencimiento-contratos');

        $this->assertSame(0, Alerta::where('tipo', 'retiro_proximo')->count());
    }

    public function test_it_ignores_draft_colaboradores(): void
    {
        Notification::fake();

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
