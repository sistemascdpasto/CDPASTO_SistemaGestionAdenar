<?php

namespace Tests\Feature\Admin;

use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class UserColaboradorEstadoTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole(Role::findOrCreate('Administrador', 'web'));

        return $admin;
    }

    private function usuarioConColaborador(): array
    {
        $user = User::factory()->create(['is_active' => true]);
        $colaborador = Colaborador::create([
            'user_id' => $user->id,
            'cedula' => '1085000111',
            'nombres' => 'Ana',
            'apellidos' => 'Pérez',
            'is_active' => true,
        ]);

        return [$user, $colaborador];
    }

    public function test_desactivar_un_usuario_desactiva_su_colaborador_y_reactivarlo_lo_reactiva(): void
    {
        $admin = $this->admin();
        [$user, $colaborador] = $this->usuarioConColaborador();

        $this->actingAs($admin)->patch(route('admin.users.toggle-status', $user))->assertRedirect();
        $this->assertFalse($user->fresh()->is_active);
        $this->assertFalse($colaborador->fresh()->is_active);

        $this->actingAs($admin)->patch(route('admin.users.toggle-status', $user))->assertRedirect();
        $this->assertTrue($colaborador->fresh()->is_active);
    }

    public function test_reactivating_a_finalized_employee_allows_reentry_without_erasing_contract_or_job_history(): void
    {
        Role::findOrCreate('Gente', 'web');
        Role::findOrCreate('Colaborador', 'web');
        $admin = $this->admin();
        $admin->assignRole('Gente');
        [$user, $colaborador] = $this->usuarioConColaborador();
        $colaborador->update([
            'estado_registro' => 'completo',
            'wizard_step' => 4,
            'area' => 'Operativa',
            'cargo' => 'Auxiliar',
            'tipo_contrato' => 'Término fijo',
            'fecha_ingreso_empresa' => '2025-01-01',
            'fecha_retiro_empresa' => '2026-11-30',
        ]);
        $contratoAnterior = $colaborador->contratos()->create([
            'tipo_contrato' => 'Término fijo',
            'fecha_inicio' => '2025-01-01',
            'fecha_fin' => '2026-11-30',
            'estado' => 'activo',
        ]);
        $cargoAnterior = $colaborador->cargos()->create([
            'cargo' => 'Auxiliar',
            'fecha_inicio' => '2025-01-01',
            'estado' => 'ACTIVO',
        ]);

        $this->actingAs($admin)->patch(route('gente.colaboradores.prorrogar-contrato', $colaborador), [
            'fecha_retiro_empresa' => '2026-11-30',
            'tipo' => 'finalizacion',
            'observaciones' => 'Finalización por cierre de contrato',
        ])->assertRedirect();

        $finalizacion = $colaborador->prorrogas()->where('tipo', 'finalizacion')->firstOrFail();
        $this->assertSame($contratoAnterior->id, $finalizacion->contrato_id);
        $this->assertSame('finalizado', $contratoAnterior->fresh()->estado);

        $this->actingAs($admin)->patch(route('admin.users.toggle-status', $user))->assertRedirect();
        $this->assertTrue($colaborador->fresh()->is_active);
        $this->assertFalse($colaborador->fresh()->tieneFinalizacionConfirmada());

        $this->actingAs($admin)
            ->get(route('gente.colaboradores.edit', $colaborador))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('esReingreso', true));

        $this->actingAs($admin)->patch(route('gente.colaboradores.paso3.update', $colaborador), [
            'area' => 'Operativa',
            'cargo' => 'Conductor',
            'guardar_historial_cargo' => 'si',
            'cargo_fecha_inicio' => '2026-12-01',
            'tipo_contrato' => 'Término fijo',
            'fecha_ingreso_empresa' => '2026-12-01',
            'fecha_retiro_empresa' => '2027-11-30',
            'es_nuevo_contrato' => '1',
            'nuevo_tipo_contrato' => 'Indefinido',
            'nuevo_fecha_inicio' => '2026-12-01',
            'nuevo_fecha_fin' => '2027-11-30',
            'contratos_editados' => '[]',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $this->assertSame(2, $colaborador->contratos()->count());
        $contratoNuevo = $colaborador->contratos()->reorder()->orderByDesc('id')->firstOrFail();
        $cargoNuevo = $colaborador->cargos()->where('estado', 'ACTIVO')->firstOrFail();

        $this->assertSame('finalizado', $contratoAnterior->fresh()->estado);
        $this->assertSame('2025-01-01', $contratoAnterior->fresh()->fecha_inicio->toDateString());
        $this->assertSame('Indefinido', $contratoNuevo->tipo_contrato);
        $this->assertSame('2026-12-01', $contratoNuevo->fecha_inicio->toDateString());
        $this->assertSame('INACTIVO', $cargoAnterior->fresh()->estado);
        $this->assertSame('2026-11-30', $cargoAnterior->fresh()->fecha_fin->toDateString());
        $this->assertSame('Conductor', $cargoNuevo->cargo);
        $this->assertSame('2026-12-01', $cargoNuevo->fecha_inicio->toDateString());
        $this->assertModelExists($finalizacion->fresh());
        $this->assertFalse($colaborador->fresh()->esReingreso());

        $this->actingAs($admin)
            ->get(route('gente.colaboradores.index'))
            ->assertInertia(fn ($page) => $page->where('colaboradores.data.0.tiene_finalizacion', false));

        $this->actingAs($admin)
            ->get(route('gente.contratos.index'))
            ->assertInertia(fn ($page) => $page->where('colaboradores.data.0.tiene_finalizacion', false));
    }

    public function test_cambiar_el_estado_desde_cualquier_lugar_se_refleja_en_el_colaborador(): void
    {
        [$user, $colaborador] = $this->usuarioConColaborador();

        $user->update(['is_active' => false]);
        $this->assertFalse($colaborador->fresh()->is_active);

        // Un cambio que no toca el estado no altera al colaborador.
        $colaborador->fresh()->update(['is_active' => true]);
        $user->fresh()->update(['first_name' => 'Otro']);
        $this->assertTrue($colaborador->fresh()->is_active);
    }

    public function test_desactivar_el_colaborador_sigue_desactivando_su_usuario(): void
    {
        $gente = User::factory()->create();
        $gente->assignRole(Role::findOrCreate('Gente', 'web'));
        [$user, $colaborador] = $this->usuarioConColaborador();
        $colaborador->update([
            'cargo' => 'CONDUCTOR',
            'area' => 'Operativa',
        ]);
        $fechaInicio = now()->addDay()->toDateString();
        $fechaFin = now()->addMonths(6)->toDateString();

        $this->actingAs($gente)->patch(route('gente.colaboradores.paso3.update', $colaborador), [
            'is_active' => false,
            'es_nuevo_contrato' => '1',
            'nuevo_tipo_contrato' => 'Término fijo',
            'nuevo_fecha_inicio' => $fechaInicio,
            'nuevo_fecha_fin' => $fechaFin,
            'nuevo_cargo' => 'SUPERVISOR',
            'nuevo_area' => 'Operativa',
            'cargo' => 'SUPERVISOR',
            'area' => 'Operativa',
            'cargo_fecha_inicio' => $fechaInicio,
            'guardar_historial_cargo' => 'si',
        ])->assertRedirect(route('gente.colaboradores.show', $colaborador));

        $this->assertFalse($colaborador->fresh()->is_active);
        $this->assertFalse($user->fresh()->is_active);
    }

    public function test_la_migracion_alinea_los_colaboradores_de_usuarios_ya_inactivos(): void
    {
        [$user, $colaborador] = $this->usuarioConColaborador();
        // Estado previo a la sincronización: usuario inactivo, colaborador activo.
        User::whereKey($user->id)->update(['is_active' => false]);

        (require database_path('migrations/2026_10_09_000000_sync_inactive_users_to_colaboradores.php'))->up();

        $this->assertFalse($colaborador->fresh()->is_active);
    }
}
