<?php

namespace Tests\Feature\Reparto;

use App\Models\Seguridad\Alerta;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AlertaControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['Administrador', 'Reparto', 'Gente'] as $rol) {
            Role::findOrCreate($rol, 'web');
        }
    }

    private function usuario(string $rol): User
    {
        $user = User::factory()->create();
        $user->assignRole($rol);

        return $user;
    }

    public function test_reparto_solo_ve_alertas_de_su_propio_pilar(): void
    {
        Alerta::create(['tipo' => 'vehiculo_detenido', 'mensaje' => 'La placa ABC123 lleva detenida 35 minutos.']);
        Alerta::create(['tipo' => 'retiro_proximo', 'mensaje' => 'Contrato de Juan vence pronto.']);

        $respuesta = $this->actingAs($this->usuario('Reparto'))->get(route('reparto.alertas.index'));

        $respuesta->assertOk()->assertInertia(fn ($page) => $page
            ->component('reparto/alertas/index')
            ->has('alertas.data', 1)
            ->where('alertas.data.0.tipo', 'vehiculo_detenido'));
    }

    public function test_administrador_ve_alertas_de_todos_los_pilares_en_la_pantalla_de_reparto(): void
    {
        Alerta::create(['tipo' => 'vehiculo_detenido', 'mensaje' => 'La placa ABC123 lleva detenida 35 minutos.']);
        Alerta::create(['tipo' => 'retiro_proximo', 'mensaje' => 'Contrato de Juan vence pronto.']);

        $respuesta = $this->actingAs($this->usuario('Administrador'))->get(route('reparto.alertas.index'));

        $respuesta->assertOk()->assertInertia(fn ($page) => $page->has('alertas.data', 2));
    }

    public function test_gente_no_puede_entrar_a_las_alertas_de_reparto(): void
    {
        $this->actingAs($this->usuario('Gente'))->get(route('reparto.alertas.index'))->assertForbidden();
    }

    public function test_reparto_puede_marcar_una_alerta_como_atendida(): void
    {
        $alerta = Alerta::create(['tipo' => 'vehiculo_detenido', 'mensaje' => 'La placa ABC123 lleva detenida 35 minutos.']);

        $this->actingAs($this->usuario('Reparto'))
            ->patch(route('reparto.alertas.atender', $alerta))
            ->assertRedirect();

        $this->assertTrue($alerta->fresh()->atendida);
    }
}
