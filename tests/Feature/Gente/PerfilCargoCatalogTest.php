<?php

namespace Tests\Feature\Gente;

use App\Models\Gente\Cargo;
use App\Models\Gente\PerfilCargo;
use App\Models\User;
use App\Services\Seguridad\ColaboradorCatalogoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PerfilCargoCatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_perfil_con_nombre_y_observaciones_se_agrega_al_catalogo_del_select(): void
    {
        Role::create(['name' => 'Gente', 'guard_name' => 'web']);
        Role::create(['name' => 'Colaborador', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole('Gente');

        Cargo::create([
            'nombre' => 'CONDUCTOR',
            'perfil' => 'Perfil legado con funciones de conducción.',
        ]);

        $this->actingAs($user)
            ->post(route('gente.perfiles-cargos.store'), [
                'nombre' => 'Perfil de reparto',
                'observaciones' => 'Apoyar las actividades de reparto y entrega.',
            ])
            ->assertRedirect();

        $perfil = PerfilCargo::query()->where('nombre', 'Perfil de reparto')->firstOrFail();
        $this->assertModelExists($perfil);
        $this->assertSame('Apoyar las actividades de reparto y entrega.', $perfil->observaciones);

        $opciones = app(ColaboradorCatalogoService::class)->perfilesCargos();
        $this->assertSame('Apoyar las actividades de reparto y entrega.', $opciones['Perfil de reparto']);
        $this->assertSame('Perfil legado con funciones de conducción.', $opciones['CONDUCTOR']);
    }
}
