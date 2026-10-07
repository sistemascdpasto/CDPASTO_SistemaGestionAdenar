<?php

namespace Tests\Feature\Gente;

use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ColaboradorIndexFiltrosTest extends TestCase
{
    use RefreshDatabase;

    private function seguridadUser(): User
    {
        Role::create(['name' => 'Seguridad', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole('Seguridad');

        return $user;
    }

    private function colaborador(array $overrides = []): Colaborador
    {
        static $contador = 0;
        $contador++;

        return Colaborador::create([
            'cedula' => "50010020{$contador}",
            'nombres' => "Colaborador{$contador}",
            'apellidos' => 'Prueba',
            'is_active' => true,
            'estado_registro' => 'completo',
            'wizard_step' => 4,
            ...$overrides,
        ]);
    }

    public function test_it_filters_by_estado_activo_inactivo(): void
    {
        $user = $this->seguridadUser();
        $this->colaborador(['is_active' => true]);
        $this->colaborador(['is_active' => false]);

        $response = $this->actingAs($user)->get(route('gente.colaboradores.index', ['estado' => 'activo']));
        $response->assertInertia(fn ($page) => $page->has('colaboradores.data', 1));

        $response = $this->actingAs($user)->get(route('gente.colaboradores.index', ['estado' => 'inactivo']));
        $response->assertInertia(fn ($page) => $page->has('colaboradores.data', 1));
    }

    public function test_it_filters_by_area_cargo_and_centro(): void
    {
        $user = $this->seguridadUser();
        $this->colaborador(['area' => 'Operativa', 'cargo' => 'CONDUCTOR', 'centro' => 'UC']);
        $this->colaborador(['area' => 'Administrativa', 'cargo' => 'PROGRAMADOR', 'centro' => 'SUR']);

        $response = $this->actingAs($user)->get(route('gente.colaboradores.index', ['area' => 'Operativa']));
        $response->assertInertia(fn ($page) => $page->has('colaboradores.data', 1)->where('colaboradores.data.0.area', 'Operativa'));

        $response = $this->actingAs($user)->get(route('gente.colaboradores.index', ['cargo' => 'PROGRAMADOR']));
        $response->assertInertia(fn ($page) => $page->has('colaboradores.data', 1)->where('colaboradores.data.0.cargo', 'PROGRAMADOR'));

        $response = $this->actingAs($user)->get(route('gente.colaboradores.index', ['centro' => 'SUR']));
        $response->assertInertia(fn ($page) => $page->has('colaboradores.data', 1)->where('colaboradores.data.0.centro', 'SUR'));
    }

    public function test_it_filters_by_eps_and_arl(): void
    {
        $user = $this->seguridadUser();
        $this->colaborador(['eps' => 'SANITAS', 'arl' => 'ARL SURA']);
        $this->colaborador(['eps' => 'EMSSANAR', 'arl' => 'AXA Colpatria']);

        $response = $this->actingAs($user)->get(route('gente.colaboradores.index', ['eps' => 'SANITAS']));
        $response->assertInertia(fn ($page) => $page->has('colaboradores.data', 1));

        $response = $this->actingAs($user)->get(route('gente.colaboradores.index', ['arl' => 'AXA Colpatria']));
        $response->assertInertia(fn ($page) => $page->has('colaboradores.data', 1));
    }

    public function test_it_filters_by_fecha_ingreso_range(): void
    {
        $user = $this->seguridadUser();
        $this->colaborador(['fecha_ingreso_empresa' => '2026-01-15']);
        $this->colaborador(['fecha_ingreso_empresa' => '2026-06-15']);

        $response = $this->actingAs($user)->get(route('gente.colaboradores.index', [
            'fecha_ingreso_desde' => '2026-01-01',
            'fecha_ingreso_hasta' => '2026-02-01',
        ]));

        $response->assertInertia(fn ($page) => $page->has('colaboradores.data', 1));
    }

    public function test_it_filters_by_vencimiento_de_contrato(): void
    {
        $user = $this->seguridadUser();
        $this->colaborador(['fecha_retiro_empresa' => now()->subDays(5)->toDateString()]); // vencido
        $this->colaborador(['fecha_retiro_empresa' => now()->addDays(10)->toDateString()]); // próximo
        $this->colaborador(['fecha_retiro_empresa' => now()->addMonths(6)->toDateString()]); // vigente

        $vencidos = $this->actingAs($user)->get(route('gente.colaboradores.index', ['vencimiento_contrato' => 'vencidos']));
        $vencidos->assertInertia(fn ($page) => $page->has('colaboradores.data', 1));

        $proximos = $this->actingAs($user)->get(route('gente.colaboradores.index', ['vencimiento_contrato' => 'proximos']));
        $proximos->assertInertia(fn ($page) => $page->has('colaboradores.data', 1));

        $vigentes = $this->actingAs($user)->get(route('gente.colaboradores.index', ['vencimiento_contrato' => 'vigentes']));
        $vigentes->assertInertia(fn ($page) => $page->has('colaboradores.data', 1));
    }

    public function test_borradores_chip_still_works_with_the_renamed_registro_param(): void
    {
        $user = $this->seguridadUser();
        $this->colaborador();
        Colaborador::create([
            'cedula' => '900999888',
            'nombres' => 'Borrador',
            'apellidos' => 'Sin Terminar',
            'estado_registro' => 'borrador',
            'wizard_step' => 1,
        ]);

        $response = $this->actingAs($user)->get(route('gente.colaboradores.index', ['registro' => 'borrador']));
        $response->assertInertia(fn ($page) => $page->has('colaboradores.data', 1)->where('borradoresCount', 1));
    }

    /**
     * Regresión: catalogos() lee de config('seguridad.colaboradores.*'), un
     * archivo de config distinto al namespace Gente del controlador — un
     * reemplazo de texto demasiado amplio al mover ColaboradorController
     * llegó a reescribir esas claves a config('gente.colaboradores.*')
     * (inexistente), dejando cada catálogo en null y rompiendo los <select>
     * del index y del wizard con un "Cannot read properties of null
     * (reading 'map')" en el navegador.
     */
    public function test_catalogos_are_not_empty(): void
    {
        $user = $this->seguridadUser();

        $response = $this->actingAs($user)->get(route('gente.colaboradores.index'));

        $response->assertInertia(function ($page) {
            $catalogos = $page->toArray()['props']['catalogos'];

            $this->assertNotEmpty($catalogos['cargos']);
            $this->assertNotEmpty($catalogos['centros']);
            $this->assertNotEmpty($catalogos['tiposDocumento']);
        });
    }
}
