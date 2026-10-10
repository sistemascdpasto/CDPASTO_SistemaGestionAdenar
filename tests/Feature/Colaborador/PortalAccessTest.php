<?php

namespace Tests\Feature\Colaborador;

use App\Models\Capacitaciones\CapacitacionCarpeta;
use App\Models\Capacitaciones\CapacitacionMaterial;
use App\Models\GeovictoriaAsistencia;
use App\Models\Reparto\CompensacionVariable;
use App\Models\Reparto\CompensacionVariableDiaria;
use App\Models\Seguridad\Aci;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\EncuestaMorbilidad;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PortalAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_is_redirected_to_login(): void
    {
        $this->get(route('portal.index'))->assertRedirect(route('login'));
    }

    public function test_user_without_colaborador_role_is_forbidden(): void
    {
        $role = Role::create(['name' => 'Flota', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($role);

        $this->actingAs($user)->get(route('portal.index'))->assertForbidden();
    }

    public function test_colaborador_role_without_linked_record_sees_graceful_state(): void
    {
        $role = Role::create(['name' => 'Colaborador', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($role);

        $this->actingAs($user)
            ->get(route('portal.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('colaborador/sin-vincular'));
    }

    public function test_colaborador_role_with_linked_record_sees_dashboard_data(): void
    {
        $role = Role::create(['name' => 'Colaborador', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($role);

        Colaborador::create([
            'user_id' => $user->id,
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'cargo' => 'Conductor',
            'turno' => 'manana',
            'area' => 'Ruta Norte',
            'is_active' => true,
        ]);

        $this->actingAs($user)
            ->get(route('portal.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('dashboard/colaborador')
                ->has('colaborador')
                ->has('indiceRiesgo')
                ->has('resumen.compensacion_diaria')
                ->has('resumen.compensacion_variable')
                ->has('resumen.plan_premiacion')
                ->has('resumen.geovictoria')
                ->has('resumen.capacitaciones_pendientes')
                ->has('resumen.condicion_salud')
                ->has('resumen.encuesta_morbilidad_pendiente')
                ->has('resumen.indicadores_reparto')
            );
    }

    public function test_dashboard_resumen_refleja_datos_sembrados_de_cada_modulo(): void
    {
        $role = Role::create(['name' => 'Colaborador', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($role);

        $colaborador = Colaborador::create([
            'user_id' => $user->id,
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'cargo' => 'Conductor',
            'turno' => 'manana',
            'area' => 'Ruta Norte',
            'is_active' => true,
        ]);

        CompensacionVariableDiaria::create([
            'fecha' => now()->toDateString(),
            'anio' => now()->year,
            'mes' => now()->month,
            'cedula' => '1002003004',
            'valor_var' => 15000,
        ]);

        CompensacionVariable::create([
            'anio' => now()->year,
            'mes' => 'Enero',
            'identificador' => '1002003004',
            'pago_variable_dt' => 250000,
        ]);

        Aci::create([
            'folio' => 'ACI-TEST-0001',
            'colaborador_id' => $colaborador->id,
            'fecha_incidente' => now()->toDateString(),
        ]);

        GeovictoriaAsistencia::create([
            'identificador' => '1002003004',
            'fecha' => now()->toDateString(),
            'exceso_jornada' => true,
            'descanso_no_efectivo' => false,
        ]);

        $carpeta = CapacitacionCarpeta::create(['nombre' => 'General']);
        CapacitacionMaterial::create([
            'carpeta_id' => $carpeta->id,
            'titulo' => 'Inducción',
            'tipo' => 'documento',
            'estado' => 'publicado',
        ]);

        EncuestaMorbilidad::create([
            'colaborador_id' => $colaborador->id,
            'estado' => EncuestaMorbilidad::ESTADO_BORRADOR,
            'fecha_hora' => now(),
        ]);

        $response = $this->actingAs($user)->get(route('portal.index'));

        $response->assertOk()->assertInertia(fn ($page) => $page
            ->where('resumen.compensacion_diaria.dias_trabajados', 1)
            ->where('resumen.compensacion_variable.total_pago_variable', 250000)
            ->where('resumen.plan_premiacion.aci_realizadas', 1)
            ->where('resumen.geovictoria.recientes_30_dias', 1)
            ->where('resumen.capacitaciones_pendientes', 1)
            ->where('resumen.encuesta_morbilidad_pendiente', true)
        );
    }

    public function test_colaborador_can_view_mi_plan_premiacion(): void
    {
        $role = Role::create(['name' => 'Colaborador', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($role);

        Colaborador::create([
            'user_id' => $user->id,
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'cargo' => 'Conductor',
            'turno' => 'manana',
            'area' => 'Ruta Norte',
            'is_active' => true,
        ]);

        $this->actingAs($user)
            ->get(route('portal.mi-plan-premiacion'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('colaborador/mi-plan-premiacion/index')
                ->has('colaborador')
                ->has('metricas')
                ->has('historial_aci')
            );
    }
}
