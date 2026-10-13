<?php

namespace Tests\Feature\Colaborador;

use App\Models\GeovictoriaAsistencia;
use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class IncidenciaGeovictoriaTest extends TestCase
{
    use RefreshDatabase;

    private function colaboradorUser(string $cedula = '1002003004'): User
    {
        Role::findOrCreate('Colaborador', 'web');
        $user = User::factory()->create();
        $user->assignRole('Colaborador');

        Colaborador::create([
            'user_id' => $user->id,
            'cedula' => $cedula,
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'cargo' => 'Conductor',
            'turno' => 'manana',
            'area' => 'Ruta Norte',
            'is_active' => true,
        ]);

        return $user;
    }

    private function registro(array $overrides = []): GeovictoriaAsistencia
    {
        return GeovictoriaAsistencia::create([
            'identificador' => '1002003004',
            'fecha' => now()->toDateString(),
            'apellidos' => 'Portal',
            'nombres' => 'Laura',
            'cargo' => 'Conductor',
            'grupo' => 'Bogota',
            'entrada' => '06:00',
            'salida' => '18:00',
            'horas_trabajadas' => '11:30',
            'exceso_jornada' => false,
            'descanso_no_efectivo' => false,
            ...$overrides,
        ]);
    }

    public function test_colaborador_solo_ve_sus_propias_incidencias(): void
    {
        $user = $this->colaboradorUser('1002003004');
        $this->registro(['exceso_jornada' => true]);
        $this->registro(['identificador' => '9999999999', 'exceso_jornada' => true]);

        $response = $this->actingAs($user)->get(route('portal.mis-incidencias-geovictoria.index'));

        $response->assertOk()->assertInertia(fn ($page) => $page
            ->component('colaborador/mis-incidencias-geovictoria/index')
            ->has('incidencias.data', 1)
        );
    }

    public function test_solo_se_listan_filas_con_alguna_incidencia(): void
    {
        $user = $this->colaboradorUser();
        $this->registro(['exceso_jornada' => false, 'descanso_no_efectivo' => false, 'fecha' => now()->toDateString()]);
        $this->registro(['exceso_jornada' => true, 'fecha' => now()->subDay()->toDateString()]);
        $this->registro(['descanso_no_efectivo' => true, 'fecha' => now()->subDays(2)->toDateString()]);

        $response = $this->actingAs($user)->get(route('portal.mis-incidencias-geovictoria.index'));

        $response->assertInertia(fn ($page) => $page->has('incidencias.data', 2));
    }

    public function test_resumen_cuenta_recientes_por_separado_de_historicas(): void
    {
        $user = $this->colaboradorUser();
        $this->registro(['exceso_jornada' => true, 'fecha' => now()->toDateString()]);
        $this->registro(['descanso_no_efectivo' => true, 'fecha' => now()->subDays(60)->toDateString()]);

        $response = $this->actingAs($user)->get(route('portal.mis-incidencias-geovictoria.index'));

        $response->assertInertia(fn ($page) => $page
            ->where('resumen.total_exceso_jornada', 1)
            ->where('resumen.total_descanso_no_efectivo', 1)
            ->where('resumen.recientes_30_dias', 1)
        );
    }

    public function test_colaborador_sin_incidencias_recibe_respuesta_vacia_sin_error(): void
    {
        $user = $this->colaboradorUser();

        $response = $this->actingAs($user)->get(route('portal.mis-incidencias-geovictoria.index'));

        $response->assertOk()->assertInertia(fn ($page) => $page
            ->has('incidencias.data', 0)
            ->where('resumen.total_exceso_jornada', 0)
            ->where('resumen.total_descanso_no_efectivo', 0)
            ->where('resumen.recientes_30_dias', 0)
            ->where('resumen.ultima_fecha', null)
        );
    }
}
