<?php

namespace Tests\Feature\Seguridad;

use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\CondicionSalud;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CondicionSaludReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_combines_ingreso_and_salida_into_one_row_per_day_and_filters_by_identificacion(): void
    {
        $role = Role::create(['name' => 'Seguridad', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($role);

        $colaborador = Colaborador::create([
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'cargo' => 'Conductor',
            'area' => 'Ruta Norte',
            'is_active' => true,
        ]);

        $otro = Colaborador::create([
            'cedula' => '9998887776',
            'nombres' => 'Pedro',
            'apellidos' => 'Otro',
            'cargo' => 'Auxiliar',
            'area' => 'Bodega',
            'is_active' => true,
        ]);

        CondicionSalud::create([
            'colaborador_id' => $colaborador->id,
            'momento' => 'ingreso',
            'estado' => 'Bueno',
            'responsable_id' => $user->id,
            'fecha_hora' => now()->setTime(7, 0),
            'consentimiento_aceptado' => true,
        ]);

        CondicionSalud::create([
            'colaborador_id' => $colaborador->id,
            'momento' => 'salida',
            'estado' => 'Regular',
            'observacion' => 'Cansancio',
            'responsable_id' => $user->id,
            'fecha_hora' => now()->setTime(16, 0),
            'consentimiento_aceptado' => true,
        ]);

        CondicionSalud::create([
            'colaborador_id' => $otro->id,
            'momento' => 'ingreso',
            'estado' => 'Bueno',
            'responsable_id' => $user->id,
            'fecha_hora' => now()->setTime(7, 30),
            'consentimiento_aceptado' => true,
        ]);

        $response = $this->actingAs($user)->get(route('seguridad.condiciones-salud.index', ['identificacion' => '1002003004']));

        $response->assertOk()->assertInertia(fn ($page) => $page
            ->component('seguridad/condiciones-salud/index')
            ->has('registros.data', 1)
            ->where('registros.data.0.colaborador.cedula', '1002003004')
            ->where('registros.data.0.estado_ingreso', 'Bueno')
            ->where('registros.data.0.estado_salida', 'Regular')
            ->where('registros.data.0.observacion_salida', 'Cansancio')
        );
    }

    public function test_only_seguridad_or_admin_can_access_the_report(): void
    {
        $role = Role::create(['name' => 'Flota', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($role);

        $this->actingAs($user)->get(route('seguridad.condiciones-salud.index'))->assertForbidden();
    }

    public function test_seguridad_puede_exportar_el_historial_a_pdf_y_excel(): void
    {
        $user = User::factory()->create();
        $user->assignRole(Role::create(['name' => 'Seguridad', 'guard_name' => 'web']));

        $colaborador = Colaborador::create([
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'is_active' => true,
        ]);
        CondicionSalud::create([
            'colaborador_id' => $colaborador->id,
            'momento' => 'ingreso',
            'estado' => 'Bueno',
            'responsable_id' => $user->id,
            'fecha_hora' => now()->setTime(7, 0),
            'consentimiento_aceptado' => true,
        ]);

        $pdf = $this->actingAs($user)->get(route('seguridad.condiciones-salud.exportar-pdf'));
        $pdf->assertOk();
        $this->assertSame('application/pdf', $pdf->headers->get('content-type'));

        $excel = $this->actingAs($user)->get(route('seguridad.condiciones-salud.exportar-excel'));
        $excel->assertOk();
        $this->assertStringContainsString('condiciones-salud-', $excel->headers->get('content-disposition'));
    }
}
