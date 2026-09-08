<?php

namespace Tests\Feature;

use App\Models\Flota\Varada;
use App\Models\Flota\Vehiculo;
use App\Models\Reparto\CincoPorque;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class NotificacionesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['Administrador', 'Seguridad', 'Reparto', 'Gente', 'Flota'] as $rol) {
            Role::findOrCreate($rol, 'web');
        }
    }

    private function usuario(string ...$roles): User
    {
        $user = User::factory()->create();
        $user->assignRole($roles);

        return $user;
    }

    public function test_un_usuario_de_flota_recibe_notificaciones_de_su_pilar_y_no_las_de_gente(): void
    {
        $vehiculo = Vehiculo::create([
            'placa' => 'XYZ789',
            'is_active' => true,
            'fecha_vencimiento_soat' => now()->subDay()->toDateString(),
        ]);
        Varada::create(['placa' => $vehiculo->placa, 'fecha_reportada' => now()->subDays(2)]);

        $this->actingAs($this->usuario('Flota'))
            ->getJson('/notificaciones')
            ->assertOk()
            ->assertJsonPath('grupos.0.key', 'documentos_flota')
            ->assertJsonFragment(['key' => 'varadas'])
            ->assertJsonMissing(['key' => 'pruebas_periodo']);
    }

    public function test_reparto_recibe_los_5_por_que_sin_plan(): void
    {
        CincoPorque::create([
            'user_id' => $this->usuario('Reparto')->id,
            'fecha' => now()->toDateString(),
            'rutina' => 'Matutina de distribución',
            'indicador' => 'Devolución',
            'problema' => 'Problema de prueba',
            'plan_accion' => null,
        ]);

        $this->actingAs($this->usuario('Reparto'))
            ->getJson('/notificaciones')
            ->assertOk()
            ->assertJsonFragment(['key' => 'cinco_porques'])
            ->assertJsonPath('total', 1);
    }

    public function test_el_administrador_ve_grupos_de_todos_los_pilares(): void
    {
        $vehiculo = Vehiculo::create([
            'placa' => 'ADM111',
            'is_active' => true,
            'fecha_vencimiento_tecnomecanica' => now()->addDays(5)->toDateString(),
        ]);
        Varada::create(['placa' => $vehiculo->placa, 'fecha_reportada' => now()]);

        $this->actingAs($this->usuario('Administrador'))
            ->getJson('/notificaciones')
            ->assertOk()
            ->assertJsonFragment(['key' => 'documentos_flota']);
    }

    public function test_sin_novedades_el_feed_va_vacio(): void
    {
        $this->actingAs($this->usuario('Reparto'))
            ->getJson('/notificaciones')
            ->assertOk()
            ->assertExactJson(['total' => 0, 'grupos' => []]);
    }
}
