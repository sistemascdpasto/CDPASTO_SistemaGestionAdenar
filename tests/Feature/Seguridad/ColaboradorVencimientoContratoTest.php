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

    public function test_crea_alerta_en_el_dia_exacto_del_umbral_35(): void
    {
        Notification::fake();

        $colaborador = $this->colaborador(['fecha_retiro_empresa' => now()->addDays(35)->toDateString()]);

        $this->artisan('seguridad:revisar-vencimiento-contratos')->assertSuccessful();

        $this->assertSame(1, Alerta::where('colaborador_id', $colaborador->id)
            ->where('tipo', 'retiro_proximo')
            ->where('pilar', 'gente')
            ->count());
    }

    public function test_crea_alerta_en_el_dia_exacto_del_umbral_40(): void
    {
        Notification::fake();

        $colaborador = $this->colaborador(['fecha_retiro_empresa' => now()->addDays(40)->toDateString()]);

        $this->artisan('seguridad:revisar-vencimiento-contratos')->assertSuccessful();

        $this->assertSame(1, Alerta::where('colaborador_id', $colaborador->id)
            ->where('tipo', 'retiro_proximo_40')
            ->where('pilar', 'gente')
            ->count());
    }

    public function test_crea_alerta_en_el_dia_exacto_del_umbral_5(): void
    {
        Notification::fake();

        $colaborador = $this->colaborador(['fecha_retiro_empresa' => now()->addDays(5)->toDateString()]);

        $this->artisan('seguridad:revisar-vencimiento-contratos')->assertSuccessful();

        $this->assertSame(1, Alerta::where('colaborador_id', $colaborador->id)
            ->where('tipo', 'retiro_proximo_5')
            ->where('pilar', 'gente')
            ->count());
    }

    public function test_notifica_a_contratos_y_administrador(): void
    {
        Notification::fake();

        $contratos = User::factory()->create(['email' => 'contratos@ejemplo.com']);
        $contratos->assignRole('Contratos');
        $admin = User::factory()->create(['email' => 'admin@ejemplo.com']);
        $admin->assignRole('Administrador');
        $gente = User::factory()->create(['email' => 'gente@ejemplo.com']);
        $gente->assignRole('Gente');

        $this->colaborador(['fecha_retiro_empresa' => now()->addDays(35)->toDateString()]);

        $this->artisan('seguridad:revisar-vencimiento-contratos')->assertSuccessful();

        Notification::assertSentTo($contratos, AlertaGenerada::class);
        Notification::assertSentTo($admin, AlertaGenerada::class);
        Notification::assertNotSentTo($gente, AlertaGenerada::class);
    }

    public function test_turno_12_y_17_solo_notifica_a_frecuentes(): void
    {
        Notification::fake();

        $frecuente = User::factory()->create([
            'email' => 'frecuente@ejemplo.com',
            'alertas_contratos_tres_veces_dia' => true,
        ]);
        $frecuente->assignRole('Contratos');

        $noFrecuente = User::factory()->create([
            'email' => 'normal@ejemplo.com',
            'alertas_contratos_tres_veces_dia' => false,
        ]);
        $noFrecuente->assignRole('Contratos');

        $this->colaborador(['fecha_retiro_empresa' => now()->addDays(35)->toDateString()]);

        // Turno de mediodía / tarde (--solo-35 implica soloFrecuentes = true)
        $this->artisan('seguridad:revisar-vencimiento-contratos --solo-35')->assertSuccessful();

        Notification::assertSentTo($frecuente, AlertaGenerada::class);
        Notification::assertNotSentTo($noFrecuente, AlertaGenerada::class);
    }

    public function test_no_genera_alerta_fuera_de_los_dias_exactos(): void
    {
        Notification::fake();

        // Faltan 20 días — no es ninguno de los umbrales exactos
        $this->colaborador(['fecha_retiro_empresa' => now()->addDays(20)->toDateString()]);

        $this->artisan('seguridad:revisar-vencimiento-contratos');

        $this->assertSame(0, Alerta::where('tipo', 'retiro_proximo')->count());
        $this->assertSame(0, Alerta::where('tipo', 'retiro_proximo_40')->count());
        $this->assertSame(0, Alerta::where('tipo', 'retiro_proximo_5')->count());
    }

    public function test_no_genera_alerta_para_colaboradores_borrador(): void
    {
        Notification::fake();

        $this->colaborador([
            'cedula' => '700100201',
            'fecha_retiro_empresa' => now()->addDays(35)->toDateString(),
            'estado_registro' => 'borrador',
            'wizard_step' => 3,
        ]);

        $this->artisan('seguridad:revisar-vencimiento-contratos');

        $this->assertSame(0, Alerta::where('tipo', 'retiro_proximo')->count());
    }

    public function test_no_duplica_la_alerta_si_ya_existe_una_hoy(): void
    {
        Notification::fake();

        $colaborador = $this->colaborador(['fecha_retiro_empresa' => now()->addDays(35)->toDateString()]);

        $this->artisan('seguridad:revisar-vencimiento-contratos');
        $this->artisan('seguridad:revisar-vencimiento-contratos');

        // Solo debe existir 1 alerta del tipo principal del día 35
        $this->assertSame(1, Alerta::where('colaborador_id', $colaborador->id)
            ->where('tipo', 'retiro_proximo')
            ->whereDate('created_at', now())
            ->count());
    }
}
