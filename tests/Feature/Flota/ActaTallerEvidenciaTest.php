<?php

namespace Tests\Feature\Flota;

use App\Models\Flota\ActaTaller;
use App\Models\Flota\ActaTallerEvidencia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ActaTallerEvidenciaTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsFlota(): User
    {
        $role = Role::create(['name' => 'Flota', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    public function test_store_guarda_la_foto_adjunta_a_una_novedad_puntual(): void
    {
        Storage::fake('public');
        $user = $this->actingAsFlota();

        $response = $this->actingAs($user)->post(route('flota.actas-taller.store'), [
            'placa' => 'ABC123',
            'fecha_entrega' => now()->format('Y-m-d H:i'),
            'novedades' => [
                ['titulo' => 'Freno delantero desgastado'],
            ],
            'evidencias_novedad' => [
                0 => [UploadedFile::fake()->image('freno.jpg')],
            ],
            'etiquetas_novedad' => [
                0 => ['Vista frontal'],
            ],
        ]);

        $response->assertRedirect(route('flota.actas-taller.index'));

        $acta = ActaTaller::with('novedades.evidencias')->firstOrFail();
        $novedad = $acta->novedades->first();

        $this->assertCount(1, $novedad->evidencias, 'La foto adjuntada a la novedad debe quedar guardada y vinculada a ella.');

        $evidencia = $novedad->evidencias->first();
        $this->assertSame($acta->id, $evidencia->acta_taller_id);
        $this->assertSame('Vista frontal', $evidencia->etiqueta);
        Storage::disk('public')->assertExists($evidencia->path);
    }

    public function test_update_agrega_una_foto_a_una_novedad_existente(): void
    {
        Storage::fake('public');
        $user = $this->actingAsFlota();

        $acta = ActaTaller::create([
            'numero_acta' => ActaTaller::generarNumero(),
            'placa' => 'ABC123',
            'fecha_entrega' => now(),
            'estado_acta' => ActaTaller::ESTADO_EN_TALLER,
            'user_id' => $user->id,
        ]);
        $novedad = $acta->novedades()->create([
            'titulo' => 'Luz trasera fundida',
            'orden' => 0,
        ]);

        $response = $this->actingAs($user)->put(route('flota.actas-taller.update', $acta), [
            'novedades' => [
                ['id' => $novedad->id, 'titulo' => 'Luz trasera fundida'],
            ],
            'evidencias_novedad' => [
                0 => [UploadedFile::fake()->image('luz.jpg')],
            ],
        ]);

        $response->assertRedirect();

        $this->assertSame(1, ActaTallerEvidencia::where('novedad_id', $novedad->id)->count());
    }

    public function test_evidencia_general_no_se_repite_en_la_novedad_y_viceversa(): void
    {
        Storage::fake('public');
        $user = $this->actingAsFlota();

        $this->actingAs($user)->post(route('flota.actas-taller.store'), [
            'placa' => 'ABC123',
            'fecha_entrega' => now()->format('Y-m-d H:i'),
            'novedades' => [
                ['titulo' => 'Espejo roto'],
            ],
            'evidencias' => [UploadedFile::fake()->image('general.jpg')],
            'evidencias_novedad' => [
                0 => [UploadedFile::fake()->image('espejo.jpg')],
            ],
        ]);

        $acta = ActaTaller::firstOrFail();

        $response = $this->actingAs($user)->get(route('flota.actas-taller.show', $acta));

        $response->assertInertia(function ($page) {
            $page->has('acta.evidencias', 1)
                ->has('acta.novedades.0.evidencias', 1);
        });
    }
}
