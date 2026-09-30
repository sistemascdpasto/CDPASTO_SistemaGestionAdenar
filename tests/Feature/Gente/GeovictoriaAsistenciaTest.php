<?php

namespace Tests\Feature\Gente;

use App\Models\GeovictoriaAsistencia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class GeovictoriaAsistenciaTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsRole(string $roleName): User
    {
        $role = Role::create(['name' => $roleName, 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function registro(array $overrides = []): GeovictoriaAsistencia
    {
        return GeovictoriaAsistencia::create([
            'identificador' => '12345678',
            'fecha' => now()->toDateString(),
            'apellidos' => 'Perez',
            'nombres' => 'Juan',
            'cargo' => 'Movilizador',
            'grupo' => 'Bogota',
            'entrada' => '06:00',
            'salida' => '18:00',
            'horas_trabajadas' => '11:30',
            'exceso_jornada' => true,
            'descanso_no_efectivo' => false,
            ...$overrides,
        ]);
    }

    public function test_gente_can_list_registros(): void
    {
        $user = $this->actingAsRole('Gente');
        $this->registro();
        $this->registro(['identificador' => '87654321', 'nombres' => 'Ana']);

        $response = $this->actingAs($user)->get(route('gente.asistencia-geovictoria.index'));

        $response->assertInertia(fn ($page) => $page->has('registros.data', 2));
    }

    public function test_reparto_can_also_access_the_module(): void
    {
        $user = $this->actingAsRole('Reparto');
        $this->registro();

        $this->actingAs($user)->get(route('gente.asistencia-geovictoria.index'))
            ->assertOk();
    }

    public function test_other_roles_cannot_access_the_module(): void
    {
        $user = $this->actingAsRole('Seguridad');

        $this->actingAs($user)->get(route('gente.asistencia-geovictoria.index'))
            ->assertForbidden();
    }

    public function test_indicadores_are_computed_correctly(): void
    {
        $user = $this->actingAsRole('Gente');
        $this->registro(['identificador' => 'A1', 'exceso_jornada' => true, 'descanso_no_efectivo' => false, 'horas_trabajadas' => '10:00']);
        $this->registro(['identificador' => 'A2', 'exceso_jornada' => false, 'descanso_no_efectivo' => true, 'horas_trabajadas' => '08:00']);
        $this->registro(['identificador' => 'A3', 'exceso_jornada' => false, 'descanso_no_efectivo' => false, 'horas_trabajadas' => '09:00']);

        $response = $this->actingAs($user)->get(route('gente.asistencia-geovictoria.index'));

        $response->assertInertia(function ($page) {
            $indicadores = $page->toArray()['props']['indicadores'];

            $this->assertSame(3, $indicadores['resumen']['total_registros']);
            $this->assertSame(3, $indicadores['resumen']['empleados']);
            $this->assertEquals(33.3, $indicadores['resumen']['pct_exceso_jornada']);
            $this->assertEquals(33.3, $indicadores['resumen']['pct_descanso_no_efectivo']);
            $this->assertSame('09:00', $indicadores['resumen']['promedio_horas_trabajadas']);

            $this->assertCount(30, $indicadores['tendencia_diaria']);
            $hoy = collect($indicadores['tendencia_diaria'])->last();
            $this->assertSame(1, $hoy['exceso_jornada']);
            $this->assertSame(1, $hoy['descanso_no_efectivo']);

            $topEmpleados = collect($indicadores['top_empleados'])->keyBy('identificador');
            $this->assertSame(1, $topEmpleados['A1']['total_exceso_jornada']);
            $this->assertSame(1, $topEmpleados['A2']['total_descanso_no_efectivo']);
            $this->assertArrayNotHasKey('A3', $topEmpleados);
        });
    }

    public function test_it_filters_by_search_and_tipo(): void
    {
        $user = $this->actingAsRole('Gente');
        $this->registro(['identificador' => '12345678', 'nombres' => 'Juan', 'exceso_jornada' => true, 'descanso_no_efectivo' => false]);
        $this->registro(['identificador' => '87654321', 'nombres' => 'Ana', 'exceso_jornada' => false, 'descanso_no_efectivo' => true]);

        $response = $this->actingAs($user)->get(route('gente.asistencia-geovictoria.index', ['search' => 'Ana']));
        $response->assertInertia(fn ($page) => $page->has('registros.data', 1));

        $response = $this->actingAs($user)->get(route('gente.asistencia-geovictoria.index', ['tipo' => 'exceso_jornada']));
        $response->assertInertia(fn ($page) => $page->has('registros.data', 1));
    }

    public function test_hoy_shows_only_todays_registros_with_marcacion_fields_and_resumen(): void
    {
        $user = $this->actingAsRole('Gente');
        $this->registro([
            'identificador' => 'A1',
            'turno' => 'Diurno',
            'permiso' => 'Ninguno',
            'salida_descanso' => '10:00',
            'ingreso_descanso' => '10:30',
            'hea' => '01:00',
            'hec' => '00:30',
            'hnt' => '00:00',
            'exceso_jornada' => true,
            'descanso_no_efectivo' => false,
            'horas_descanso_previo' => '9h 30m',
        ]);
        $this->registro(['identificador' => 'A2', 'exceso_jornada' => false, 'descanso_no_efectivo' => true]);
        // Registro de ayer: no debe aparecer en "hoy".
        $this->registro(['identificador' => 'A3', 'fecha' => now()->subDay()->toDateString()]);

        $response = $this->actingAs($user)->get(route('gente.asistencia-geovictoria.index'));

        $response->assertInertia(function ($page) {
            $hoy = $page->toArray()['props']['hoy'];

            $this->assertSame(2, $hoy['resumen']['total']);
            $this->assertSame(1, $hoy['resumen']['exceso_jornada']);
            $this->assertSame(1, $hoy['resumen']['descanso_no_efectivo']);

            $registros = collect($hoy['registros'])->keyBy('identificador');
            $this->assertCount(2, $registros);
            $this->assertSame('Diurno', $registros['A1']['turno']);
            $this->assertSame('Ninguno', $registros['A1']['permiso']);
            $this->assertSame('10:00', $registros['A1']['salida_descanso']);
            $this->assertSame('01:00', $registros['A1']['hea']);
            $this->assertSame('00:30', $registros['A1']['hec']);
            $this->assertSame('00:00', $registros['A1']['hnt']);
            // Mismos campos de incidencia que trae la tabla de Detalle.
            $this->assertTrue($registros['A1']['exceso_jornada']);
            $this->assertFalse($registros['A1']['descanso_no_efectivo']);
            $this->assertSame('9h 30m', $registros['A1']['horas_descanso_previo']);
        });
    }

    public function test_seguimiento_lists_late_salidas_of_yesterday_and_today_with_estado(): void
    {
        $user = $this->actingAsRole('Gente');
        $hoy = now()->toDateString();
        $ayer = now()->subDay()->toDateString();
        $manana = now()->addDay()->toDateString();

        // Ayer salió tarde y hoy entró respetando el descanso -> cumplio.
        $this->registro(['identificador' => 'B1', 'fecha' => $ayer, 'salida' => '20:00', 'hora_minima_entrada' => "{$hoy} 07:00"]);
        $this->registro(['identificador' => 'B1', 'fecha' => $hoy, 'entrada' => '07:30', 'descanso_no_efectivo' => false]);
        // Ayer salió tarde y hoy entró antes de tiempo -> incumplio.
        $this->registro(['identificador' => 'B2', 'fecha' => $ayer, 'salida' => '21:00', 'hora_minima_entrada' => "{$hoy} 08:00"]);
        $this->registro(['identificador' => 'B2', 'fecha' => $hoy, 'entrada' => '06:00', 'descanso_no_efectivo' => true]);
        // Hoy salió tarde, todavía no hay registro de mañana -> pendiente.
        $this->registro(['identificador' => 'B3', 'fecha' => $hoy, 'salida' => '19:00', 'hora_minima_entrada' => "{$manana} 06:00"]);
        // Salió antes de las 18:30 -> no entra al seguimiento.
        $this->registro(['identificador' => 'B4', 'fecha' => $hoy]);
        // Hace dos días -> fuera del rango ayer/hoy.
        $this->registro(['identificador' => 'B5', 'fecha' => now()->subDays(2)->toDateString(), 'hora_minima_entrada' => "{$ayer} 07:00"]);

        $response = $this->actingAs($user)->get(route('gente.asistencia-geovictoria.index'));

        $response->assertInertia(function ($page) use ($hoy) {
            $seguimiento = collect($page->toArray()['props']['seguimiento']);

            $this->assertSame(['B1', 'B2', 'B3'], $seguimiento->pluck('identificador')->all());
            $porId = $seguimiento->keyBy('identificador');
            $this->assertSame('cumplio', $porId['B1']['estado']);
            $this->assertSame('07:30', $porId['B1']['entrada_siguiente']);
            $this->assertSame("{$hoy} 07:00", $porId['B1']['hora_minima_entrada']);
            $this->assertSame('incumplio', $porId['B2']['estado']);
            $this->assertSame('pendiente', $porId['B3']['estado']);
            $this->assertNull($porId['B3']['entrada_siguiente']);
        });
    }

    public function test_por_grupo_cargo_and_horas_indicators_are_computed_correctly(): void
    {
        $user = $this->actingAsRole('Gente');
        $this->registro([
            'identificador' => 'A1', 'grupo' => 'Bogota', 'cargo' => 'Movilizador',
            'exceso_jornada' => true, 'descanso_no_efectivo' => false, 'horas_trabajadas' => '10:00',
        ]);
        $this->registro([
            'identificador' => 'A2', 'grupo' => 'Bogota', 'cargo' => 'Conductor',
            'exceso_jornada' => false, 'descanso_no_efectivo' => true, 'horas_trabajadas' => '08:00',
        ]);
        $this->registro([
            'identificador' => 'A3', 'grupo' => 'Medellin', 'cargo' => 'Conductor',
            'exceso_jornada' => false, 'descanso_no_efectivo' => false, 'horas_trabajadas' => '06:00',
        ]);

        $response = $this->actingAs($user)->get(route('gente.asistencia-geovictoria.index'));

        $response->assertInertia(function ($page) {
            $indicadores = $page->toArray()['props']['indicadores'];

            $porGrupo = collect($indicadores['por_grupo'])->keyBy('grupo');
            $this->assertSame(1, $porGrupo['Bogota']['exceso_jornada']);
            $this->assertSame(1, $porGrupo['Bogota']['descanso_no_efectivo']);
            $this->assertSame(0, $porGrupo['Medellin']['exceso_jornada']);
            $this->assertSame(0, $porGrupo['Medellin']['descanso_no_efectivo']);

            $porCargo = collect($indicadores['distribucion_cargo'])->keyBy('cargo');
            $this->assertSame(1, $porCargo['Movilizador']['total']);
            $this->assertSame(2, $porCargo['Conductor']['total']);

            $horasPorCargo = collect($indicadores['horas_promedio_cargo'])->keyBy('cargo');
            $this->assertEquals(10.0, $horasPorCargo['Movilizador']['horas']);
            $this->assertEquals(7.0, $horasPorCargo['Conductor']['horas']);
        });
    }

    public function test_indicadores_respect_the_fecha_desde_and_fecha_hasta_filters(): void
    {
        $user = $this->actingAsRole('Gente');
        $this->registro([
            'identificador' => 'A1', 'fecha' => '2026-08-01', 'cargo' => 'Movilizador',
            'exceso_jornada' => true, 'descanso_no_efectivo' => false, 'horas_trabajadas' => '10:00',
        ]);
        // Fuera del rango que se va a filtrar: no debe contar en ningún indicador.
        $this->registro([
            'identificador' => 'A2', 'fecha' => '2026-07-01', 'cargo' => 'Conductor',
            'exceso_jornada' => true, 'descanso_no_efectivo' => true, 'horas_trabajadas' => '05:00',
        ]);

        $response = $this->actingAs($user)->get(route('gente.asistencia-geovictoria.index', [
            'fecha_desde' => '2026-08-01',
            'fecha_hasta' => '2026-08-31',
        ]));

        $response->assertInertia(function ($page) {
            $indicadores = $page->toArray()['props']['indicadores'];

            $this->assertSame(1, $indicadores['resumen']['total_registros']);
            $this->assertSame(1, $indicadores['resumen']['empleados']);
            $this->assertEquals(100.0, $indicadores['resumen']['pct_exceso_jornada']);

            $tendencia = collect($indicadores['tendencia_diaria'])->keyBy('fecha');
            $this->assertSame(1, $tendencia['2026-08-01']['exceso_jornada']);
            $this->assertArrayNotHasKey('2026-07-01', $tendencia);

            $porCargo = collect($indicadores['distribucion_cargo'])->keyBy('cargo');
            $this->assertSame(1, $porCargo['Movilizador']['total']);
            $this->assertArrayNotHasKey('Conductor', $porCargo);
        });
    }
}
