<?php

namespace Tests\Feature\Seguridad;

use App\Models\Seguridad\Alcoholimetro;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\PruebaAlcoholemia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class IndicadorDashboardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // AlertaNotifier (disparado al registrar una prueba positiva) busca
        // usuarios con estos roles al notificar.
        foreach (['Administrador', 'Seguridad', 'Reparto'] as $rol) {
            Role::findOrCreate($rol, 'web');
        }
    }

    private function usuario(string $rol): User
    {
        Role::findOrCreate($rol, 'web');
        $user = User::factory()->create();
        $user->assignRole($rol);

        return $user;
    }

    public function test_seguridad_puede_ver_el_tablero_y_otros_roles_no(): void
    {
        $this->actingAs($this->usuario('Seguridad'))
            ->get(route('seguridad.indicador.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('seguridad/indicador/index')->has('data.alcoholimetria'));

        Role::findOrCreate('Reparto', 'web');
        $reparto = User::factory()->create();
        $reparto->assignRole('Reparto');
        $this->actingAs($reparto)->get(route('seguridad.indicador.index'))->assertForbidden();
    }

    public function test_los_kpis_de_alcoholimetria_reflejan_los_datos_del_rango(): void
    {
        $seguridad = $this->usuario('Seguridad');

        $colaborador = Colaborador::create([
            'cedula' => '900900900',
            'nombres' => 'Luis',
            'apellidos' => 'Prueba',
            'estado_registro' => 'completo',
            'is_active' => true,
        ]);
        $dispositivo = Alcoholimetro::create(['codigo' => 'ALC-9', 'valor_min' => 0, 'valor_max' => 1, 'estado' => 'Disponible']);

        // 2 realizadas (1 positiva) dentro del rango + 1 fuera del rango.
        PruebaAlcoholemia::create([
            'colaborador_id' => $colaborador->id, 'tipo' => 'pre_ruta', 'alcoholimetro_id' => $dispositivo->id,
            'resultado' => 0, 'estado' => 'realizada', 'fecha_hora' => now()->subDays(2), 'responsable_id' => $seguridad->id,
        ]);
        PruebaAlcoholemia::create([
            'colaborador_id' => $colaborador->id, 'tipo' => 'ruta', 'alcoholimetro_id' => $dispositivo->id,
            'resultado' => 0.3, 'estado' => 'realizada', 'fecha_hora' => now()->subDays(1), 'responsable_id' => $seguridad->id,
        ]);
        PruebaAlcoholemia::create([
            'colaborador_id' => $colaborador->id, 'tipo' => 'ruta', 'alcoholimetro_id' => $dispositivo->id,
            'resultado' => 0.9, 'estado' => 'realizada', 'fecha_hora' => now()->subYear(), 'responsable_id' => $seguridad->id,
        ]);

        $this->actingAs($seguridad)
            ->get(route('seguridad.indicador.index', ['desde' => now()->subDays(10)->toDateString(), 'hasta' => now()->toDateString()]))
            ->assertInertia(fn ($page) => $page
                ->where('data.alcoholimetria.realizadas', 2)
                ->where('data.alcoholimetria.positivas', 1)
            );
    }
}
