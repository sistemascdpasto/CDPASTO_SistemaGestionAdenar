<?php

namespace Tests\Feature\Reparto;

use App\Models\Flota\Vehiculo;
use App\Models\Reparto\RevisionAleatoria;
use App\Models\Reparto\RevisionResponsable;
use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class RevisionAleatoriaTest extends TestCase
{
    use RefreshDatabase;

    private function repartoUser(): User
    {
        Role::findOrCreate('Administrador', 'web');
        Role::findOrCreate('Reparto', 'web');
        $user = User::factory()->create();
        $user->assignRole('Reparto');

        return $user;
    }

    private function conVehiculoYResponsable(): void
    {
        Vehiculo::create(['placa' => 'ABC123', 'is_active' => true]);

        $colaborador = Colaborador::create([
            'cedula' => '900111111', 'nombres' => 'Juan', 'apellidos' => 'Pérez', 'estado_registro' => 'completo', 'is_active' => true,
        ]);
        RevisionResponsable::create(['colaborador_id' => $colaborador->id, 'is_active' => true]);
    }

    public function test_solo_se_puede_seleccionar_el_vehiculo_una_vez_por_dia(): void
    {
        $this->conVehiculoYResponsable();
        $user = $this->repartoUser();

        $this->actingAs($user)->post(route('reparto.revision-aleatoria.seleccionar-vehiculo'))->assertRedirect();
        $this->assertSame(1, RevisionAleatoria::whereDate('fecha', now())->count());

        // Segundo intento el mismo día: no crea una segunda fila, responde con error.
        $this->actingAs($user)->post(route('reparto.revision-aleatoria.seleccionar-vehiculo'))
            ->assertRedirect()
            ->assertSessionHas('error');

        $this->assertSame(1, RevisionAleatoria::whereDate('fecha', now())->count());
    }

    public function test_la_constraint_unique_de_fecha_impide_dos_filas_el_mismo_dia_a_nivel_de_base_de_datos(): void
    {
        RevisionAleatoria::create(['fecha' => now()->toDateString(), 'user_id' => User::factory()->create()->id]);

        $this->expectException(QueryException::class);

        RevisionAleatoria::create(['fecha' => now()->toDateString(), 'user_id' => User::factory()->create()->id]);
    }

    public function test_no_se_puede_seleccionar_responsable_sin_haber_seleccionado_vehiculo_primero(): void
    {
        $this->conVehiculoYResponsable();
        $user = $this->repartoUser();

        $this->actingAs($user)->post(route('reparto.revision-aleatoria.seleccionar-responsable'))
            ->assertRedirect()
            ->assertSessionHas('error');

        $this->assertSame(0, RevisionAleatoria::count());
    }

    public function test_flujo_completo_sin_novedades_marca_la_revision_como_finalizada(): void
    {
        $this->conVehiculoYResponsable();
        $user = $this->repartoUser();

        $this->actingAs($user)->post(route('reparto.revision-aleatoria.seleccionar-vehiculo'));
        $this->actingAs($user)->post(route('reparto.revision-aleatoria.seleccionar-responsable'));

        $this->actingAs($user)->post(route('reparto.revision-aleatoria.finalizar'), [
            'resultado' => 'sin_novedades',
        ])->assertRedirect(route('reparto.revision-aleatoria.index'));

        $revision = RevisionAleatoria::whereDate('fecha', now())->firstOrFail();
        $this->assertSame('sin_novedades', $revision->resultado);
        $this->assertNotNull($revision->finalizada_en);

        // No se puede volver a finalizar la revisión de hoy.
        $this->actingAs($user)->post(route('reparto.revision-aleatoria.finalizar'), [
            'resultado' => 'sin_novedades',
        ])->assertSessionHas('error');
    }

    public function test_un_usuario_sin_rol_reparto_ni_administrador_no_puede_acceder(): void
    {
        Role::findOrCreate('Seguridad', 'web');
        $user = User::factory()->create();
        $user->assignRole('Seguridad');

        $this->actingAs($user)->get(route('reparto.revision-aleatoria.index'))->assertForbidden();
    }
}
