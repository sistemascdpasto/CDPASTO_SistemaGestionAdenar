<?php

namespace Tests\Feature\Seguridad;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class RutogramasTest extends TestCase
{
    use RefreshDatabase;

    public function test_seguridad_puede_abrir_el_modulo_de_rutogramas(): void
    {
        $role = Role::findOrCreate('Seguridad', 'web');
        $user = User::factory()->create();
        $user->assignRole($role);

        $this->actingAs($user)
            ->get(route('seguridad.rutogramas.index'))
            ->assertInertia(fn ($page) => $page
                ->component('seguridad/rutogramas/index')
                ->where('vista', 'rutas'));
    }

    public function test_cada_submodulo_abre_su_vista_de_rutogramas(): void
    {
        $role = Role::findOrCreate('Seguridad', 'web');
        $user = User::factory()->create();
        $user->assignRole($role);

        foreach ([
            'criticidad' => 'criticidad',
            'conductores' => 'conductores',
            'mapa-calor' => 'mapa',
        ] as $segment => $vista) {
            $this->actingAs($user)
                ->get(route('seguridad.rutogramas.vista', $segment))
                ->assertInertia(fn ($page) => $page
                    ->component('seguridad/rutogramas/index')
                    ->where('vista', $vista));
        }
    }

    public function test_rutogramas_requiere_autenticacion(): void
    {
        $this->get(route('seguridad.rutogramas.index'))
            ->assertRedirect(route('login'));
    }
}
