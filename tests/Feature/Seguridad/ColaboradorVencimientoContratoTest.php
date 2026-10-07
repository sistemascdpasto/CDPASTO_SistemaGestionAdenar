<?php

namespace Tests\Feature\Seguridad;

use App\Models\Seguridad\Alerta;
use App\Models\Seguridad\Colaborador;
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

        // AlertaNotifier busca destinatarios con estos roles al notificar.
        Role::create(['name' => 'Administrador', 'guard_name' => 'web']);
        Role::create(['name' => 'Seguridad', 'guard_name' => 'web']);
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
            ->count());
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
