<?php

namespace Tests\Feature\Seguridad;

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

        foreach (['Administrador', 'Seguridad', 'Gente'] as $rol) {
            Role::findOrCreate($rol, 'web');
        }
    }

    private function usuario(string $rol): User
    {
        $user = User::factory()->create();
        $user->assignRole($rol);

        return $user;
    }

    /**
     * Brian reportó que un usuario de Gente nunca veía "contrato por
     * vencer", pero Administrador sí la veía mezclada sin distinción en
     * esta pantalla. Ahora Seguridad ve solo lo suyo...
     */
    public function test_seguridad_ya_no_ve_las_alertas_de_otros_pilares(): void
    {
        Alerta::create(['tipo' => 'calibracion_proxima', 'mensaje' => 'Alcoholímetro A1 por calibrar.']);
        Alerta::create(['tipo' => 'retiro_proximo', 'mensaje' => 'Contrato de Juan vence pronto.']);

        $respuesta = $this->actingAs($this->usuario('Seguridad'))->get(route('seguridad.alertas.index'));

        $respuesta->assertOk()->assertInertia(fn ($page) => $page
            ->has('alertas.data', 1)
            ->where('alertas.data.0.tipo', 'calibracion_proxima'));
    }

    /**
     * ...pero Administrador sigue viendo todo en un solo lugar, ahora con
     * el pilar visible en cada fila (antes era una mezcla sin distinción).
     */
    public function test_administrador_ve_todos_los_pilares_organizados(): void
    {
        Alerta::create(['tipo' => 'calibracion_proxima', 'mensaje' => 'Alcoholímetro A1 por calibrar.']);
        Alerta::create(['tipo' => 'retiro_proximo', 'mensaje' => 'Contrato de Juan vence pronto.']);

        $respuesta = $this->actingAs($this->usuario('Administrador'))->get(route('seguridad.alertas.index'));

        $respuesta->assertOk()->assertInertia(fn ($page) => $page
            ->has('alertas.data', 2)
            ->where('alertas.data.0.pilar', fn ($pilar) => in_array($pilar, ['seguridad', 'gente'], true))
            ->where('alertas.data.1.pilar', fn ($pilar) => in_array($pilar, ['seguridad', 'gente'], true)));
    }
}
