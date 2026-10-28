<?php

namespace Tests\Feature\Gente;

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

        foreach (['Administrador', 'Gente', 'Seguridad'] as $rol) {
            Role::findOrCreate($rol, 'web');
        }
    }

    private function usuario(string $rol): User
    {
        $user = User::factory()->create();
        $user->assignRole($rol);

        return $user;
    }

    public function test_gente_solo_ve_alertas_de_su_propio_pilar(): void
    {
        Alerta::create(['tipo' => 'retiro_proximo', 'mensaje' => 'Contrato de Juan vence pronto.']);
        Alerta::create(['tipo' => 'calibracion_proxima', 'mensaje' => 'Alcoholímetro A1 por calibrar.']);

        $respuesta = $this->actingAs($this->usuario('Gente'))->get(route('gente.alertas.index'));

        $respuesta->assertOk()->assertInertia(fn ($page) => $page
            ->component('gente/alertas/index')
            ->has('alertas.data', 1)
            ->where('alertas.data.0.tipo', 'retiro_proximo'));
    }

    public function test_administrador_ve_alertas_de_todos_los_pilares_en_la_pantalla_de_gente(): void
    {
        Alerta::create(['tipo' => 'retiro_proximo', 'mensaje' => 'Contrato de Juan vence pronto.']);
        Alerta::create(['tipo' => 'calibracion_proxima', 'mensaje' => 'Alcoholímetro A1 por calibrar.']);

        $respuesta = $this->actingAs($this->usuario('Administrador'))->get(route('gente.alertas.index'));

        $respuesta->assertOk()->assertInertia(fn ($page) => $page->has('alertas.data', 2));
    }

    public function test_seguridad_no_puede_entrar_a_las_alertas_de_gente(): void
    {
        $this->actingAs($this->usuario('Seguridad'))->get(route('gente.alertas.index'))->assertForbidden();
    }

    public function test_gente_puede_marcar_una_alerta_como_atendida(): void
    {
        $alerta = Alerta::create(['tipo' => 'retiro_proximo', 'mensaje' => 'Contrato de Juan vence pronto.']);

        $this->actingAs($this->usuario('Gente'))
            ->patch(route('gente.alertas.atender', $alerta))
            ->assertRedirect();

        $this->assertTrue($alerta->fresh()->atendida);
    }
}
