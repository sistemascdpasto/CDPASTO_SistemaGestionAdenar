<?php

namespace Tests\Feature\Gente;

use App\Models\Gente\ContratoProrroga;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\Entrenamiento;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ColaboradorRegistrosDuranteContratoTest extends TestCase
{
    use RefreshDatabase;

    private function genteUser(): User
    {
        Role::create(['name' => 'Gente', 'guard_name' => 'web']);
        Role::create(['name' => 'Colaborador', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole('Gente');

        return $user;
    }

    private function colaboradorCompleto(): Colaborador
    {
        return Colaborador::create([
            'cedula' => '800100200',
            'nombres' => 'Carlos',
            'apellidos' => 'Ramírez',
            'is_active' => true,
            'estado_registro' => 'completo',
            'wizard_step' => 4,
        ]);
    }

    public function test_it_accepts_any_contract_end_date_when_extending_a_contract(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();
        $colaborador->update(['fecha_retiro_empresa' => '2026-12-31']);

        $this->actingAs($user)->patch(
            route('gente.colaboradores.prorrogar-contrato', $colaborador),
            ['fecha_retiro_empresa' => '2023-04-06'],
        )->assertRedirect();

        $this->assertSame('2023-04-06', $colaborador->fresh()->fecha_retiro_empresa->toDateString());
        $this->assertSame('2023-04-06', $colaborador->prorrogas()->firstOrFail()->fecha_nueva->toDateString());
    }

    public function test_it_stores_contract_documents_and_rejects_an_empty_upload(): void
    {
        Storage::fake('public');
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();
        $documento = UploadedFile::fake()->create('contrato.pdf', 100, 'application/pdf');

        $this->actingAs($user)->post(route('gente.contratos.documentos.store', $colaborador), [
            'documento_contrato' => [$documento],
        ])->assertRedirect();

        $registro = $colaborador->documentos()->where('campo', 'documento_contrato')->firstOrFail();
        Storage::disk('public')->assertExists($registro->path);

        $this->actingAs($user)->post(route('gente.contratos.documentos.store', $colaborador), [])
            ->assertSessionHasErrors('documentos');
    }

    public function test_it_updates_the_current_contract_details_from_the_contract_table(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();
        $colaborador->update([
            'fecha_ingreso_empresa' => '2026-01-01',
            'fecha_retiro_empresa' => '2026-12-31',
            'cargo' => 'Cargo original',
            'tipo_contrato' => 'Contrato original',
        ]);

        $this->actingAs($user)->patch(route('gente.contratos.datos.update', $colaborador), [
            'fecha_ingreso_empresa' => '2018-03-04',
            'fecha_retiro_empresa' => '2019-08-09',
            'cargo' => 'CONDUCTOR',
            'tipo_contrato' => 'Contrato a término fijo',
            'is_active' => false,
        ])->assertRedirect();

        $colaborador->refresh();
        $this->assertSame('2018-03-04', $colaborador->fecha_ingreso_empresa->toDateString());
        $this->assertSame('2019-08-09', $colaborador->fecha_retiro_empresa->toDateString());
        $this->assertSame('CONDUCTOR', $colaborador->cargo);
        $this->assertSame('Contrato a término fijo', $colaborador->tipo_contrato);
        $this->assertTrue($colaborador->is_active);
    }

    public function test_updating_the_current_contract_rejects_invalid_dates(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();
        $colaborador->update(['fecha_retiro_empresa' => '2026-12-31']);

        $this->actingAs($user)->patch(route('gente.contratos.datos.update', $colaborador), [
            'fecha_retiro_empresa' => 'no-es-fecha',
        ])->assertSessionHasErrors('fecha_retiro_empresa');

        $this->assertSame('2026-12-31', $colaborador->fresh()->fecha_retiro_empresa->toDateString());
    }

    public function test_it_stores_a_llamado_de_atencion_with_an_optional_document(): void
    {
        Storage::fake('public');
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();

        $this->actingAs($user)->post(route('gente.colaboradores.llamados-atencion.store', $colaborador), [
            'observacion' => 'Llegó tarde a la jornada.',
            'documento' => UploadedFile::fake()->create('soporte.pdf', 100, 'application/pdf'),
        ])->assertRedirect();

        $this->assertSame(1, $colaborador->llamadosAtencion()->count());
        $llamado = $colaborador->llamadosAtencion()->first();
        $this->assertSame('Llegó tarde a la jornada.', $llamado->observacion);
        $this->assertSame($user->id, $llamado->registrado_por_id);
        $this->assertNotNull($llamado->path);
        Storage::disk('public')->assertExists($llamado->path);
    }

    public function test_llamado_de_atencion_requires_an_observacion(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();

        $this->actingAs($user)->post(route('gente.colaboradores.llamados-atencion.store', $colaborador), [])
            ->assertSessionHasErrors('observacion');
    }

    public function test_it_creates_a_new_entrenamiento_catalog_entry_on_the_fly(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();

        $this->actingAs($user)->post(route('gente.colaboradores.entrenamientos.store', $colaborador), [
            'entrenamiento_nombre' => 'Manejo defensivo',
            'fecha_registro' => '2026-02-01',
            'hora_registro' => '08:30',
        ])->assertRedirect();

        $entrenamiento = Entrenamiento::where('nombre', 'Manejo defensivo')->firstOrFail();
        $this->assertSame(1, $colaborador->entrenamientos()->count());
        $registro = $colaborador->entrenamientos()->first();
        $this->assertSame($entrenamiento->id, $registro->entrenamiento_id);
        $this->assertSame($user->id, $registro->registrado_por_id);
    }

    public function test_the_same_entrenamiento_can_be_repeated_on_a_different_date_without_overwriting_history(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();
        $entrenamiento = Entrenamiento::create(['nombre' => 'Primeros auxilios']);

        $this->actingAs($user)->post(route('gente.colaboradores.entrenamientos.store', $colaborador), [
            'entrenamiento_id' => $entrenamiento->id,
            'fecha_registro' => '2026-01-05',
            'hora_registro' => '09:00',
        ]);

        $this->actingAs($user)->post(route('gente.colaboradores.entrenamientos.store', $colaborador), [
            'entrenamiento_id' => $entrenamiento->id,
            'fecha_registro' => '2026-02-05',
            'hora_registro' => '09:00',
        ]);

        $this->assertSame(1, Entrenamiento::where('nombre', 'Primeros auxilios')->count());
        $this->assertSame(2, $colaborador->entrenamientos()->count());
    }

    public function test_it_updates_a_contract_extension_and_syncs_the_current_date_for_the_latest_record(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();
        $colaborador->update(['fecha_retiro_empresa' => '2026-12-31']);
        $prorroga = ContratoProrroga::create([
            'colaborador_id' => $colaborador->id,
            'registrado_por' => $user->id,
            'fecha_anterior' => '2026-06-30',
            'fecha_nueva' => '2026-12-31',
            'tipo' => 'prorroga',
            'observaciones' => 'Registro original',
        ]);
        $registradoEn = $prorroga->created_at;

        $this->actingAs($user)->patch(
            route('gente.contratos.prorrogas.update', [$colaborador, $prorroga]),
            [
                'tipo' => 'prorroga',
                'fecha_anterior' => '2026-07-15',
                'fecha_nueva' => '2027-01-31',
                'observaciones' => 'Fecha corregida',
            ],
        )->assertRedirect();

        $prorroga->refresh();
        $this->assertSame('2026-07-15', $prorroga->fecha_anterior->toDateString());
        $this->assertSame('2027-01-31', $prorroga->fecha_nueva->toDateString());
        $this->assertSame('Fecha corregida', $prorroga->observaciones);
        $this->assertSame($user->id, $prorroga->registrado_por);
        $this->assertSame($registradoEn->toDateTimeString(), $prorroga->created_at->toDateTimeString());
        $this->assertSame('2027-01-31', $colaborador->fresh()->fecha_retiro_empresa->toDateString());
    }

    public function test_editing_an_older_contract_extension_does_not_change_the_current_contract_date(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();
        $colaborador->update(['fecha_retiro_empresa' => '2027-12-31']);
        $anterior = ContratoProrroga::create([
            'colaborador_id' => $colaborador->id,
            'registrado_por' => $user->id,
            'fecha_anterior' => '2026-01-01',
            'fecha_nueva' => '2026-06-30',
            'tipo' => 'prorroga',
        ]);
        ContratoProrroga::create([
            'colaborador_id' => $colaborador->id,
            'registrado_por' => $user->id,
            'fecha_anterior' => '2026-06-30',
            'fecha_nueva' => '2027-12-31',
            'tipo' => 'prorroga',
        ]);

        $this->actingAs($user)->patch(
            route('gente.contratos.prorrogas.update', [$colaborador, $anterior]),
            [
                'tipo' => 'prorroga',
                'fecha_anterior' => '2025-12-01',
                'fecha_nueva' => '2026-07-15',
                'observaciones' => 'Corrección histórica',
            ],
        )->assertRedirect();

        $this->assertSame('2027-12-31', $colaborador->fresh()->fecha_retiro_empresa->toDateString());
    }

    public function test_show_reports_certificado_status_based_on_uploaded_documents(): void
    {
        Storage::fake('public');
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();

        $response = $this->actingAs($user)->get(route('gente.colaboradores.show', $colaborador));
        $response->assertInertia(fn ($page) => $page
            ->where('certificadosAprendizaje.escuelaPilotos', false)
            ->where('certificadosAprendizaje.brigadista', false)
        );

        $colaborador->documentos()->create([
            'campo' => 'documento_escuela_pilotos',
            'path' => 'colaboradores/documentos/escuela.pdf',
            'fecha_documento' => now()->toDateString(),
        ]);

        $response = $this->actingAs($user)->get(route('gente.colaboradores.show', $colaborador));
        $response->assertInertia(fn ($page) => $page
            ->where('certificadosAprendizaje.escuelaPilotos', true)
            ->where('certificadosAprendizaje.brigadista', false)
        );
    }
}
