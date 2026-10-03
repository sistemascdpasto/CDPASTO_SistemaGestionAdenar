<?php

namespace Tests\Feature\Gente;

use App\Models\Gente\ColaboradorPadrinoCriterio;
use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PlanPadrinoCriteriosTest extends TestCase
{
    use RefreshDatabase;

    protected User $userGente;
    protected User $userSeguridad;

    protected function setUp(): void
    {
        parent::setUp();

        Role::create(['name' => 'Administrador', 'guard_name' => 'web']);
        Role::create(['name' => 'Gente', 'guard_name' => 'web']);
        Role::create(['name' => 'Seguridad', 'guard_name' => 'web']);

        $this->userGente = User::factory()->create(['is_active' => true]);
        $this->userGente->assignRole('Gente');

        $this->userSeguridad = User::factory()->create(['is_active' => true]);
        $this->userSeguridad->assignRole('Seguridad');
    }

    public function test_criterios_view_renders_only_operational_collaborators(): void
    {
        // 1. Colaborador Operativo
        $operativo = Colaborador::create([
            'is_active' => true,
            'cedula' => '1001',
            'nombres' => 'Juan',
            'apellidos' => 'Pérez',
            'area' => 'Operativa',
            'cargo' => 'Conductor',
            'fecha_ingreso_empresa' => Carbon::today()->subMonths(6),
            'estado_registro' => 'completo',
        ]);

        // 2. Colaborador Administrativo
        $administrativo = Colaborador::create([
            'is_active' => true,
            'cedula' => '1002',
            'nombres' => 'María',
            'apellidos' => 'Gómez',
            'area' => 'Administrativa',
            'cargo' => 'Auxiliar Administrativo',
            'fecha_ingreso_empresa' => Carbon::today()->subYears(1),
            'estado_registro' => 'completo',
        ]);

        $response = $this->actingAs($this->userGente)
            ->get(route('gente.plan-padrinos.criterios'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('gente/plan-padrinos/criterios')
            ->has('colaboradores', 1)
            ->where('colaboradores.0.id', $operativo->id)
            ->where('colaboradores.0.nombre_completo', 'Juan Pérez')
            ->where('colaboradores.0.antiguedad_texto', '6 meses')
            ->where('colaboradores.0.nivel_autonomia', 'Nivel 3')
        );
    }

    public function test_can_update_colaborador_nivel_autonomia(): void
    {
        $operativo = Colaborador::create([
            'is_active' => true,
            'cedula' => '1003',
            'nombres' => 'Carlos',
            'apellidos' => 'López',
            'area' => 'Operativa',
            'cargo' => 'Auxiliar de Reparto',
            'nivel_autonomia' => null,
            'estado_registro' => 'completo',
        ]);

        $response = $this->actingAs($this->userGente)
            ->post(route('gente.plan-padrinos.criterios.autonomia'), [
                'colaborador_id' => $operativo->id,
                'nivel_autonomia' => 'Nivel 3',
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('colaboradores', [
            'id' => $operativo->id,
            'nivel_autonomia' => 'Nivel 3',
        ]);
    }

    public function test_read_only_user_can_view_criterios_but_cannot_update(): void
    {
        $operativo = Colaborador::create([
            'is_active' => true,
            'cedula' => '1004',
            'nombres' => 'Pedro',
            'apellidos' => 'Martínez',
            'area' => 'Operativa',
            'cargo' => 'Montacarguista',
            'estado_registro' => 'completo',
        ]);

        // Seguridad solo tiene lectura
        $responseView = $this->actingAs($this->userSeguridad)
            ->get(route('gente.plan-padrinos.criterios'));

        $responseView->assertOk();

        // Intento de actualización de Seguridad falla con 403 Forbidden
        $responseUpdate = $this->actingAs($this->userSeguridad)
            ->post(route('gente.plan-padrinos.criterios.autonomia'), [
                'colaborador_id' => $operativo->id,
                'nivel_autonomia' => 'Padrino',
            ]);

        $responseUpdate->assertForbidden();
    }

    public function test_import_criterios_excel_matches_by_qr_safety(): void
    {
        $operativo = Colaborador::create([
            'is_active' => true,
            'cedula' => '1005',
            'codigo_qr_skap' => 'F1V2ETVY',
            'nombres' => 'Jhon Ferney',
            'apellidos' => 'Amado',
            'area' => 'Operativa',
            'cargo' => 'Conductor',
            'estado_registro' => 'completo',
        ]);

        $csvContent = implode("\n", [
            'QR Safety,Nombre,Funcional 7 días,Funcional 30 días,Funcional 90 días,Funcional,Hab. técnicas 1,Hab. técnicas 2,Hab. técnicas 3,Habilidades Técnicas,Autonomía 1,Autonomía 2,Autonomía 3,Autonomía 4,Autonomía',
            'F1V2ETVY,Jhon Ferney Amado,100,100,100,100,100,100,100,100,100,100,100,100,100',
        ]);

        $archivo = UploadedFile::fake()->createWithContent('evaluacion_criterios.csv', $csvContent);

        $response = $this->actingAs($this->userGente)
            ->post(route('gente.plan-padrinos.criterios.importar'), [
                'archivo' => $archivo,
            ]);

        $response->assertRedirect(route('gente.plan-padrinos.criterios'));

        $this->assertDatabaseHas('colaborador_padrino_criterios', [
            'colaborador_id' => $operativo->id,
            'qr_safety' => 'F1V2ETVY',
            'funcional_total' => 100,
            'habilidades_tecnicas_total' => 100,
            'autonomia_total' => 100,
        ]);

        $this->assertDatabaseHas('colaboradores', [
            'id' => $operativo->id,
            'nivel_autonomia' => 'Nivel 4',
        ]);
    }

    public function test_can_download_criterios_csv_template(): void
    {
        $response = $this->actingAs($this->userGente)
            ->get(route('gente.plan-padrinos.criterios.plantilla'));

        $response->assertOk();
        $response->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    }

    public function test_can_clear_imported_criterios(): void
    {
        ColaboradorPadrinoCriterio::create([
            'qr_safety' => 'TEST1234',
            'nombre_excel' => 'Prueba Test',
            'autonomia_total' => 100,
        ]);

        $this->assertDatabaseCount('colaborador_padrino_criterios', 1);

        $response = $this->actingAs($this->userGente)
            ->post(route('gente.plan-padrinos.criterios.limpiar'));

        $response->assertRedirect(route('gente.plan-padrinos.criterios'));
        $this->assertDatabaseCount('colaborador_padrino_criterios', 0);
    }
}
