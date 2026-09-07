<?php

namespace Tests\Feature\Capacitaciones;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CapacitacionesAccesoTest extends TestCase
{
    use RefreshDatabase;

    private function usuario(string $rol): User
    {
        Role::findOrCreate($rol, 'web');
        $user = User::factory()->create();
        $user->assignRole($rol);

        return $user;
    }

    public function test_todos_los_roles_de_pilar_pueden_entrar_a_capacitaciones(): void
    {
        foreach (['Administrador', 'Seguridad', 'Reparto', 'Gente', 'Flota'] as $rol) {
            $this->actingAs($this->usuario($rol))
                ->get(route('capacitaciones.index'))
                ->assertOk();
        }
    }

    public function test_un_colaborador_sin_otro_rol_no_entra_a_la_gestion_de_capacitaciones(): void
    {
        $this->actingAs($this->usuario('Colaborador'))
            ->get(route('capacitaciones.index'))
            ->assertForbidden();
    }
}
