<?php

namespace Tests\Feature\Flota;

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

        foreach (['Administrador', 'Flota', 'Gente'] as $rol) {
            Role::findOrCreate($rol, 'web');
        }
    }

    private function usuario(string $rol): User
    {
        $user = User::factory()->create();
        $user->assignRole($rol);

        return $user;
    }

    public function test_flota_solo_ve_alertas_de_su_propio_pilar(): void
    {
        Alerta::create(['tipo' => 'vencimiento_soat', 'mensaje' => 'SOAT de ABC123 por vencer.']);
        Alerta::create(['tipo' => 'retiro_proximo', 'mensaje' => 'Contrato de Juan vence pronto.']);

        $respuesta = $this->actingAs($this->usuario('Flota'))->get(route('flota.alertas.index'));

        $respuesta->assertOk()->assertInertia(fn ($page) => $page
            ->component('flota/alertas/index')
            ->has('alertas.data', 1)
            ->where('alertas.data.0.tipo', 'vencimiento_soat'));
    }

    public function test_administrador_ve_alertas_de_todos_los_pilares_en_la_pantalla_de_flota(): void
    {
        Alerta::create(['tipo' => 'vencimiento_soat', 'mensaje' => 'SOAT de ABC123 por vencer.']);
        Alerta::create(['tipo' => 'retiro_proximo', 'mensaje' => 'Contrato de Juan vence pronto.']);

        $respuesta = $this->actingAs($this->usuario('Administrador'))->get(route('flota.alertas.index'));

        $respuesta->assertOk()->assertInertia(fn ($page) => $page->has('alertas.data', 2));
    }

    public function test_gente_no_puede_entrar_a_las_alertas_de_flota(): void
    {
        $this->actingAs($this->usuario('Gente'))->get(route('flota.alertas.index'))->assertForbidden();
    }

    public function test_flota_puede_marcar_una_alerta_como_atendida(): void
    {
        $alerta = Alerta::create(['tipo' => 'vencimiento_soat', 'mensaje' => 'SOAT de ABC123 por vencer.']);

        $this->actingAs($this->usuario('Flota'))
            ->patch(route('flota.alertas.atender', $alerta))
            ->assertRedirect();

        $this->assertTrue($alerta->fresh()->atendida);
    }
}
