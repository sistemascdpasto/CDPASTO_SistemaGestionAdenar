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

        $this->actingAs($gente)->patch(route('gente.colaboradores.toggle-activo', $colaborador))->assertRedirect();

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
