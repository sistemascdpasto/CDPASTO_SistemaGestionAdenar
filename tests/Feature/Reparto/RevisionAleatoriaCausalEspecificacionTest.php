<?php

namespace Tests\Feature\Reparto;

use App\Models\Flota\Vehiculo;
use App\Models\Reparto\RevisionAleatoria;
use App\Models\Reparto\RevisionCausal;
use App\Models\Reparto\RevisionResponsable;
use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class RevisionAleatoriaCausalEspecificacionTest extends TestCase
{
    use RefreshDatabase;

    public function test_no_se_puede_finalizar_con_causal_otro_sin_especificar_el_motivo(): void
    {
        Role::findOrCreate('Reparto', 'web');
        $user = User::factory()->create();
        $user->assignRole('Reparto');

        Vehiculo::create(['placa' => 'ABC123', 'is_active' => true]);
        $colaborador = Colaborador::create([
            'cedula' => '900111111', 'nombres' => 'Juan', 'apellidos' => 'Pérez', 'estado_registro' => 'completo', 'is_active' => true,
        ]);
        RevisionResponsable::create(['colaborador_id' => $colaborador->id, 'is_active' => true]);
        $causalOtro = RevisionCausal::create(['nombre' => 'Otro', 'requiere_especificacion' => true, 'is_active' => true]);

        $this->actingAs($user)->post(route('reparto.revision-aleatoria.seleccionar-vehiculo'));
        $this->actingAs($user)->post(route('reparto.revision-aleatoria.seleccionar-responsable'));

        $this->actingAs($user)->post(route('reparto.revision-aleatoria.finalizar'), [
            'resultado' => 'con_novedades',
            'novedades' => [
                ['producto' => 'Test', 'cantidad_novedad' => 1, 'causal_id' => $causalOtro->id, 'causal_especificacion' => ''],
            ],
        ])->assertSessionHasErrors();

        $this->assertNull(RevisionAleatoria::whereDate('fecha', now())->first()->finalizada_en);
    }
}
