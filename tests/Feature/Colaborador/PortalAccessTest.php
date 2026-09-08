<?php

namespace Tests\Feature\Colaborador;

use App\Models\Seguridad\Colaborador;
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
        $role = Role::create(['name' => 'Seguridad', 'guard_name' => 'web']);
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
            );
    }
}
