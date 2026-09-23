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

    private function conVarios(int $vehiculos, int $responsables = 1): void
    {
        for ($i = 0; $i < $vehiculos; $i++) {
            Vehiculo::create(['placa' => 'VEH'.$i, 'is_active' => true]);
        }
        for ($i = 0; $i < $responsables; $i++) {
            $colaborador = Colaborador::create([
                'cedula' => '90011111'.$i, 'nombres' => 'Resp', 'apellidos' => (string) $i, 'estado_registro' => 'completo', 'is_active' => true,
            ]);
            RevisionResponsable::create(['colaborador_id' => $colaborador->id, 'is_active' => true]);
        }
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

    public function test_la_constraint_unique_de_slot_impide_dos_filas_con_el_mismo_numero_del_dia_a_nivel_de_base_de_datos(): void
    {
        RevisionAleatoria::create(['fecha' => now()->toDateString(), 'numero_del_dia' => 1, 'user_id' => User::factory()->create()->id]);

        $this->expectException(QueryException::class);

        RevisionAleatoria::create(['fecha' => now()->toDateString(), 'numero_del_dia' => 1, 'user_id' => User::factory()->create()->id]);
    }

    public function test_la_constraint_unique_de_vehiculo_impide_repetir_vehiculo_el_mismo_dia_a_nivel_de_base_de_datos(): void
    {
        $vehiculo = Vehiculo::create(['placa' => 'ABC123', 'is_active' => true]);
        $userId = User::factory()->create()->id;

        RevisionAleatoria::create(['fecha' => now()->toDateString(), 'numero_del_dia' => 1, 'vehiculo_id' => $vehiculo->id, 'user_id' => $userId]);

        $this->expectException(QueryException::class);

        RevisionAleatoria::create(['fecha' => now()->toDateString(), 'numero_del_dia' => 2, 'vehiculo_id' => $vehiculo->id, 'user_id' => $userId]);
    }

    public function test_se_pueden_hacer_hasta_tres_revisiones_por_dia_sin_repetir_vehiculo(): void
    {
        $this->conVarios(vehiculos: 3);
        $user = $this->repartoUser();

        $placasUsadas = [];
        for ($i = 1; $i <= 3; $i++) {
            $this->actingAs($user)->post(route('reparto.revision-aleatoria.seleccionar-vehiculo'))->assertRedirect()->assertSessionHasNoErrors();
            $revision = RevisionAleatoria::whereDate('fecha', now())->where('numero_del_dia', $i)->firstOrFail();
            $this->assertNotContains($revision->vehiculo_id, $placasUsadas, 'No debe repetir vehículo el mismo día.');
            $placasUsadas[] = $revision->vehiculo_id;

            // Completa la revisión para poder pasar a la siguiente.
            $this->actingAs($user)->post(route('reparto.revision-aleatoria.seleccionar-responsable'));
            $this->actingAs($user)->post(route('reparto.revision-aleatoria.finalizar'), ['resultado' => 'sin_novedades']);
        }

        $this->assertSame(3, RevisionAleatoria::whereDate('fecha', now())->count());
        $this->assertCount(3, array_unique($placasUsadas));
    }

    public function test_no_se_puede_iniciar_una_cuarta_revision_el_mismo_dia(): void
    {
        $this->conVarios(vehiculos: 3, responsables: 1);
        $user = $this->repartoUser();

        for ($i = 1; $i <= 3; $i++) {
            $this->actingAs($user)->post(route('reparto.revision-aleatoria.seleccionar-vehiculo'));
            $this->actingAs($user)->post(route('reparto.revision-aleatoria.seleccionar-responsable'));
            $this->actingAs($user)->post(route('reparto.revision-aleatoria.finalizar'), ['resultado' => 'sin_novedades']);
        }

        $this->actingAs($user)->post(route('reparto.revision-aleatoria.seleccionar-vehiculo'))
            ->assertRedirect()
            ->assertSessionHas('error');

        $this->assertSame(3, RevisionAleatoria::whereDate('fecha', now())->count());
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
