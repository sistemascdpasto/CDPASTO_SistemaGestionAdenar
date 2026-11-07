<?php

namespace Tests\Feature\Gente;

use App\Models\Gente\ContratoProrroga;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\Entrenamiento;
use App\Services\Gente\ContratoVigenciaService;
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

    public function test_it_clears_current_contract_data_without_deleting_the_colaborador_or_history(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();
        $colaborador->update([
            'cargo' => 'Auxiliar',
            'tipo_contrato' => 'Otro',
            'tipo_contrato_otro' => 'Contrato especial',
            'fecha_ingreso_empresa' => '2025-01-01',
            'fecha_retiro_empresa' => '2026-12-31',
            'centro' => 'SUR',
        ]);
        ContratoProrroga::create([
            'colaborador_id' => $colaborador->id,
            'registrado_por' => $user->id,
            'fecha_anterior' => '2026-12-31',
            'fecha_nueva' => '2027-12-31',
            'tipo' => 'prorroga',
        ]);
        $colaborador->cargos()->create([
            'cargo' => 'Auxiliar',
            'fecha_inicio' => '2025-01-01',
            'estado' => 'ACTIVO',
        ]);

        $this->actingAs($user)
            ->delete(route('gente.contratos.datos.destroy', $colaborador))
            ->assertRedirect();

        $colaboradorActualizado = $colaborador->fresh();
        $this->assertModelExists($colaboradorActualizado);
        $this->assertNull($colaboradorActualizado->fecha_ingreso_empresa);
        $this->assertNull($colaboradorActualizado->fecha_retiro_empresa);
        $this->assertSame('Auxiliar', $colaboradorActualizado->cargo);
        $this->assertSame('Auxiliar', $colaboradorActualizado->cargoActual?->cargo);
        $this->assertNull($colaboradorActualizado->tipo_contrato);
        $this->assertNull($colaboradorActualizado->tipo_contrato_otro);
        $this->assertSame('SUR', $colaboradorActualizado->centro);
        $this->assertSame(1, $colaboradorActualizado->prorrogas()->count());
    }

    public function test_it_deletes_only_the_selected_contract_extension_and_its_document(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();
        $colaborador->update([
            'fecha_ingreso_empresa' => '2025-01-01',
            'fecha_retiro_empresa' => '2027-12-31',
            'is_active' => false,
        ]);
        Storage::fake('public');
        $documentoPath = 'colaboradores/prorrogas/soporte.pdf';
        Storage::disk('public')->put($documentoPath, 'contenido');

        $prorroga = ContratoProrroga::create([
            'colaborador_id' => $colaborador->id,
            'registrado_por' => $user->id,
            'fecha_anterior' => '2026-12-31',
            'fecha_inicio' => '2027-01-01',
            'fecha_nueva' => '2027-12-31',
            'tipo' => 'prorroga',
            'documento_path' => $documentoPath,
            'documento_nombre' => 'soporte.pdf',
        ]);
        $otroRegistro = ContratoProrroga::create([
            'colaborador_id' => $colaborador->id,
            'registrado_por' => $user->id,
            'fecha_anterior' => '2027-12-31',
            'fecha_nueva' => '2027-12-31',
            'tipo' => 'finalizacion',
        ]);

        $this->actingAs($user)
            ->delete(route('gente.contratos.prorrogas.destroy', [$colaborador, $prorroga]))
            ->assertRedirect();

        $this->assertModelMissing($prorroga);
        $this->assertModelExists($otroRegistro);
        $this->assertSame('2027-12-31', $colaborador->fresh()->fecha_retiro_empresa->toDateString());
        $this->assertFalse($colaborador->fresh()->is_active);
        Storage::disk('public')->assertMissing($documentoPath);
    }

    public function test_it_deletes_previous_employment_history_without_changing_current_contract_data(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();
        $colaborador->update([
            'ha_trabajado_antes' => 'si',
            'cargo_anterior' => 'Responsable de reparto',
            'fecha_ultima_laboral' => '2024-06-30',
            'fecha_ingreso_empresa' => '2025-01-01',
            'fecha_retiro_empresa' => '2027-12-31',
            'motivo_retiro' => 'Renuncia',
            'motivo_retiro_observaciones' => 'Observación del contrato actual',
        ]);

        $this->actingAs($user)
            ->delete(route('gente.contratos.antecedente.destroy', $colaborador))
            ->assertRedirect();

        $colaboradorActualizado = $colaborador->fresh();
        $this->assertSame('no', $colaboradorActualizado->ha_trabajado_antes);
        $this->assertNull($colaboradorActualizado->cargo_anterior);
        $this->assertNull($colaboradorActualizado->fecha_ultima_laboral);
        $this->assertSame('2025-01-01', $colaboradorActualizado->fecha_ingreso_empresa->toDateString());
        $this->assertSame('2027-12-31', $colaboradorActualizado->fecha_retiro_empresa->toDateString());
        $this->assertSame('Renuncia', $colaboradorActualizado->motivo_retiro);
        $this->assertSame('Observación del contrato actual', $colaboradorActualizado->motivo_retiro_observaciones);
    }

    public function test_it_does_not_clear_contract_data_after_a_confirmed_finalization(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();
        $colaborador->update([
            'fecha_ingreso_empresa' => '2025-01-01',
            'fecha_retiro_empresa' => '2026-12-31',
        ]);
        ContratoProrroga::create([
            'colaborador_id' => $colaborador->id,
            'registrado_por' => $user->id,
            'fecha_anterior' => '2026-12-31',
            'fecha_nueva' => '2026-12-31',
            'tipo' => 'finalizacion',
        ]);

        $this->actingAs($user)
            ->delete(route('gente.contratos.datos.destroy', $colaborador))
            ->assertForbidden();

        $this->assertSame('2025-01-01', $colaborador->fresh()->fecha_ingreso_empresa->toDateString());
    }

    public function test_it_stores_the_prorroga_start_date_and_rejects_dates_before_the_current_contract_ends(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();
        $colaborador->update(['fecha_retiro_empresa' => '2026-12-31']);

        $this->actingAs($user)->patch(
            route('gente.colaboradores.prorrogar-contrato', $colaborador),
            [
                'fecha_inicio_prorroga' => '2027-01-11',
                'fecha_retiro_empresa' => '2027-02-10',
            ],
        )->assertRedirect();

        $prorroga = $colaborador->prorrogas()->firstOrFail();
        $this->assertSame('2027-01-11', $prorroga->fecha_inicio->toDateString());
        $this->assertSame('2027-02-10', $prorroga->fecha_nueva->toDateString());

        $this->actingAs($user)->patch(
            route('gente.colaboradores.prorrogar-contrato', $colaborador->fresh()),
            [
                'fecha_inicio_prorroga' => '2026-12-31',
                'fecha_retiro_empresa' => '2027-02-10',
            ],
        )->assertSessionHasErrors('fecha_inicio_prorroga');

        $this->assertSame(1, $colaborador->prorrogas()->count());
    }

    public function test_fourth_and_later_extensions_must_cover_one_full_year(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();
        $colaborador->update(['fecha_retiro_empresa' => '2027-03-31']);

        foreach ([
            ['2026-12-31', '2027-01-01', '2027-01-31'],
            ['2027-01-31', '2027-02-01', '2027-02-28'],
            ['2027-02-28', '2027-03-01', '2027-03-31'],
        ] as [$anterior, $inicio, $fin]) {
            ContratoProrroga::create([
                'colaborador_id' => $colaborador->id,
                'registrado_por' => $user->id,
                'fecha_anterior' => $anterior,
                'fecha_inicio' => $inicio,
                'fecha_nueva' => $fin,
                'tipo' => 'prorroga',
            ]);
        }

        $this->actingAs($user)->patch(
            route('gente.colaboradores.prorrogar-contrato', $colaborador),
            [
                'fecha_inicio_prorroga' => '2027-04-01',
                'fecha_retiro_empresa' => '2027-06-30',
            ],
        )->assertSessionHasErrors('fecha_retiro_empresa');

        $this->assertSame(3, $colaborador->prorrogas()->where('tipo', 'prorroga')->count());
        $this->assertSame('2027-03-31', $colaborador->fresh()->fecha_retiro_empresa->toDateString());

        $this->actingAs($user)->patch(
            route('gente.colaboradores.prorrogar-contrato', $colaborador->fresh()),
            [
                'fecha_inicio_prorroga' => '2027-04-01',
                'fecha_retiro_empresa' => '2028-03-31',
            ],
        )->assertRedirect();

        $this->assertSame(4, $colaborador->prorrogas()->where('tipo', 'prorroga')->count());
        $this->assertSame('2028-03-31', $colaborador->fresh()->fecha_retiro_empresa->toDateString());

        $prorrogaAnual = $colaborador->prorrogas()->where('tipo', 'prorroga')->orderByDesc('id')->firstOrFail();
        $this->actingAs($user)->patch(
            route('gente.contratos.prorrogas.update', [$colaborador, $prorrogaAnual]),
            [
                'tipo' => 'prorroga',
                'fecha_anterior' => '2027-03-31',
                'fecha_inicio' => '2027-04-01',
                'fecha_nueva' => '2027-06-30',
            ],
        )->assertSessionHasErrors('fecha_nueva');
    }

    public function test_prorroga_count_restarts_for_each_contract(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();
        $colaborador->update([
            'tipo_contrato' => 'Término fijo',
            'fecha_ingreso_empresa' => '2026-01-01',
            'fecha_retiro_empresa' => '2026-12-31',
        ]);
        $contratoAnterior = $colaborador->contratos()->create([
            'tipo_contrato' => 'Término fijo',
            'fecha_inicio' => '2024-01-01',
            'fecha_fin' => '2024-12-31',
            'estado' => 'finalizado',
        ]);
        $contratoActual = $colaborador->contratos()->create([
            'tipo_contrato' => 'Término fijo',
            'fecha_inicio' => '2026-01-01',
            'fecha_fin' => '2026-12-31',
            'estado' => 'activo',
        ]);
        $this->assertSame($contratoActual->id, app(ContratoVigenciaService::class)->contratoActual($colaborador->fresh())?->id);

        foreach ([
            ['2024-12-31', '2025-01-01', '2025-03-31'],
            ['2025-03-31', '2025-04-01', '2025-08-31'],
            ['2025-08-31', '2025-09-01', '2025-12-31'],
        ] as [$anterior, $inicio, $fin]) {
            $contratoAnterior->prorrogas()->create([
                'colaborador_id' => $colaborador->id,
                'registrado_por' => $user->id,
                'fecha_anterior' => $anterior,
                'fecha_inicio' => $inicio,
                'fecha_nueva' => $fin,
                'tipo' => 'prorroga',
            ]);
        }

        $this->actingAs($user)->patch(
            route('gente.colaboradores.prorrogar-contrato', $colaborador),
            [
                'fecha_inicio_prorroga' => '2027-01-01',
                'fecha_retiro_empresa' => '2027-01-31',
            ],
        )->assertRedirect()->assertSessionHasNoErrors();

        $primeraProrrogaContratoActual = $colaborador->prorrogas()->orderByDesc('id')->firstOrFail();
        $this->assertSame(
            $contratoActual->id,
            $primeraProrrogaContratoActual->contrato_id,
        );

        foreach ([
            ['2027-01-31', '2027-02-01', '2027-02-28'],
            ['2027-02-28', '2027-03-01', '2027-03-31'],
        ] as [$anterior, $inicio, $fin]) {
            $this->actingAs($user)->patch(
                route('gente.colaboradores.prorrogar-contrato', $colaborador->fresh()),
                ['fecha_inicio_prorroga' => $inicio, 'fecha_retiro_empresa' => $fin],
            )->assertRedirect();
        }

        $this->actingAs($user)->patch(
            route('gente.colaboradores.prorrogar-contrato', $colaborador->fresh()),
            ['fecha_inicio_prorroga' => '2027-04-01', 'fecha_retiro_empresa' => '2027-06-30'],
        )->assertSessionHasErrors('fecha_retiro_empresa');

        $this->actingAs($user)->patch(
            route('gente.colaboradores.prorrogar-contrato', $colaborador->fresh()),
            ['fecha_inicio_prorroga' => '2027-04-01', 'fecha_retiro_empresa' => '2028-03-31'],
        )->assertRedirect();

        $this->assertSame(4, $contratoActual->prorrogas()->where('tipo', 'prorroga')->count());
    }

    public function test_apprentice_contract_extensions_do_not_trigger_the_annual_rule(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();
        $colaborador->update([
            'tipo_contrato' => 'Aprendiz SENA',
            'fecha_ingreso_empresa' => '2025-01-01',
            'fecha_retiro_empresa' => '2028-03-31',
        ]);
        $contrato = $colaborador->contratos()->create([
            'tipo_contrato' => 'Aprendiz SENA',
            'fecha_inicio' => '2025-01-01',
            'fecha_fin' => '2025-12-31',
            'estado' => 'activo',
        ]);

        foreach ([
            ['2025-12-31', '2026-01-01', '2026-06-30'],
            ['2026-06-30', '2026-07-01', '2026-12-31'],
            ['2026-12-31', '2027-01-01', '2027-06-30'],
            ['2027-06-30', '2027-07-01', '2028-03-31'],
        ] as [$anterior, $inicio, $fin]) {
            $contrato->prorrogas()->create([
                'colaborador_id' => $colaborador->id,
                'registrado_por' => $user->id,
                'fecha_anterior' => $anterior,
                'fecha_inicio' => $inicio,
                'fecha_nueva' => $fin,
                'tipo' => 'prorroga',
            ]);
        }

        $this->actingAs($user)->patch(
            route('gente.colaboradores.prorrogar-contrato', $colaborador),
            ['fecha_inicio_prorroga' => '2028-04-01', 'fecha_retiro_empresa' => '2028-06-30'],
        )->assertRedirect();
    }

    public function test_new_regular_contract_starts_its_own_prorroga_count_after_apprenticeship(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();
        $colaborador->update([
            'tipo_contrato' => 'Aprendiz SENA',
            'fecha_ingreso_empresa' => '2025-01-01',
            'fecha_retiro_empresa' => '2028-03-31',
        ]);
        $contratoAprendiz = $colaborador->contratos()->create([
            'tipo_contrato' => 'Aprendiz SENA',
            'fecha_inicio' => '2025-01-01',
            'fecha_fin' => '2025-12-31',
            'estado' => 'activo',
        ]);

        foreach ([
            ['2025-12-31', '2026-01-01', '2026-06-30'],
            ['2026-06-30', '2026-07-01', '2026-12-31'],
            ['2026-12-31', '2027-01-01', '2027-06-30'],
            ['2027-06-30', '2027-07-01', '2028-03-31'],
        ] as [$anterior, $inicio, $fin]) {
            $contratoAprendiz->prorrogas()->create([
                'colaborador_id' => $colaborador->id,
                'registrado_por' => $user->id,
                'fecha_anterior' => $anterior,
                'fecha_inicio' => $inicio,
                'fecha_nueva' => $fin,
                'tipo' => 'prorroga',
            ]);
        }

        $this->actingAs($user)->patch(route('gente.colaboradores.paso3.update', $colaborador), [
            'tipo_contrato' => 'Término fijo',
            'fecha_ingreso_empresa' => '2025-01-01',
            'fecha_retiro_empresa' => '2028-03-31',
            'es_nuevo_contrato' => '1',
            'nuevo_tipo_contrato' => 'Término fijo',
            'nuevo_fecha_inicio' => '2028-04-01',
            'nuevo_fecha_fin' => '2028-04-30',
            'contratos_editados' => '[]',
        ])->assertRedirect();

        $contratoNuevo = app(ContratoVigenciaService::class)->contratoActual($colaborador->fresh());

        $this->assertSame('finalizado', $contratoAprendiz->fresh()->estado);
        $this->assertNotNull($contratoNuevo);
        $this->assertSame('Término fijo', $contratoNuevo->tipo_contrato);
        $this->assertSame('2028-04-01', $contratoNuevo->fecha_inicio->toDateString());
        $this->assertSame(0, $contratoNuevo->prorrogas()->where('tipo', 'prorroga')->count());
        $this->assertSame('2028-04-01', $colaborador->fresh()->fecha_ingreso_empresa->toDateString());

        $this->actingAs($user)->patch(
            route('gente.colaboradores.prorrogar-contrato', $colaborador->fresh()),
            ['fecha_inicio_prorroga' => '2028-05-01', 'fecha_retiro_empresa' => '2028-05-31'],
        )->assertRedirect()->assertSessionHasNoErrors();

        $this->assertSame(1, $contratoNuevo->prorrogas()->where('tipo', 'prorroga')->count());
    }

    public function test_editing_contract_dates_moves_its_prorrogas_by_the_same_number_of_days(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();
        $colaborador->update([
            'tipo_contrato' => 'Término fijo',
            'fecha_ingreso_empresa' => '2025-01-01',
            'fecha_retiro_empresa' => '2026-03-31',
        ]);
        $contrato = $colaborador->contratos()->create([
            'tipo_contrato' => 'Término fijo',
            'fecha_inicio' => '2025-01-01',
            'fecha_fin' => '2025-12-31',
            'estado' => 'activo',
        ]);
        $contratoAnterior = $colaborador->contratos()->create([
            'tipo_contrato' => 'Término fijo',
            'fecha_inicio' => '2022-01-01',
            'fecha_fin' => '2022-12-31',
            'estado' => 'finalizado',
        ]);
        $prorrogaContratoAnterior = $contratoAnterior->prorrogas()->create([
            'colaborador_id' => $colaborador->id,
            'registrado_por' => $user->id,
            'fecha_anterior' => '2022-12-31',
            'fecha_inicio' => '2023-01-01',
            'fecha_nueva' => '2023-12-31',
            'tipo' => 'prorroga',
        ]);
        $prorroga = $contrato->prorrogas()->create([
            'colaborador_id' => $colaborador->id,
            'registrado_por' => $user->id,
            'fecha_anterior' => '2025-12-31',
            'fecha_inicio' => '2026-01-01',
            'fecha_nueva' => '2026-03-31',
            'tipo' => 'prorroga',
        ]);

        $this->actingAs($user)->patch(route('gente.colaboradores.paso3.update', $colaborador), [
            'tipo_contrato' => 'Término fijo',
            'fecha_ingreso_empresa' => '2025-01-01',
            'fecha_retiro_empresa' => '2026-01-30',
            'es_nuevo_contrato' => '0',
            'contratos_editados' => json_encode([[
                'id' => $contrato->id,
                'tipo_contrato' => 'Término fijo',
                'fecha_inicio' => '2025-01-01',
                'fecha_fin' => '2026-01-30',
            ]]),
        ])->assertRedirect();

        $this->assertSame('2026-01-30', $contrato->fresh()->fecha_fin->toDateString());
        $this->assertSame('2026-01-30', $prorroga->fresh()->fecha_anterior->toDateString());
        $this->assertSame('2026-01-31', $prorroga->fresh()->fecha_inicio->toDateString());
        $this->assertSame('2026-04-30', $prorroga->fresh()->fecha_nueva->toDateString());
        $this->assertSame('2022-12-31', $prorrogaContratoAnterior->fresh()->fecha_anterior->toDateString());
        $this->assertSame('2023-01-01', $prorrogaContratoAnterior->fresh()->fecha_inicio->toDateString());
        $this->assertSame('2023-12-31', $prorrogaContratoAnterior->fresh()->fecha_nueva->toDateString());
        $this->assertSame('2026-04-30', $colaborador->fresh()->fecha_retiro_empresa->toDateString());
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

    public function test_it_accepts_contract_documents_larger_than_five_megabytes(): void
    {
        Storage::fake('public');
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();
        $documento = UploadedFile::fake()->create('contrato.pdf', 6 * 1024, 'application/pdf');

        $this->actingAs($user)->post(route('gente.contratos.documentos.store', $colaborador), [
            'documento_contrato' => [$documento],
        ])->assertRedirect();

        $registro = $colaborador->documentos()->where('campo', 'documento_contrato')->firstOrFail();
        Storage::disk('public')->assertExists($registro->path);
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

    public function test_contract_show_formats_dates_for_cargo_history(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();
        $colaborador->update([
            'fecha_ingreso_empresa' => '2026-01-01',
            'fecha_retiro_empresa' => '2026-12-31',
        ]);
        $colaborador->cargos()->create([
            'cargo' => 'CONDUCTOR',
            'fecha_inicio' => '2026-02-01',
            'fecha_fin' => '2026-12-31',
            'estado' => 'ACTIVO',
        ]);

        $this->actingAs($user)
            ->get(route('gente.contratos.show', $colaborador))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('colaborador.historial_cargos.0.fecha_inicio', '2026-02-01')
                ->where('colaborador.historial_cargos.0.fecha_fin', '2026-12-31')
                ->where('catalogos.cargos', fn ($cargos) => $cargos->contains('CONDUCTOR'))
                ->where('catalogos.tiposContrato', fn ($tipos) => $tipos->contains('Contrato a término fijo'))
            );
    }

    public function test_contract_show_orders_contract_history_by_first_start_date(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();

        foreach ([
            ['tipo_contrato' => 'Contrato 2026', 'fecha_inicio' => '2026-01-01'],
            ['tipo_contrato' => 'Sin fecha', 'fecha_inicio' => null],
            ['tipo_contrato' => 'Contrato 2025', 'fecha_inicio' => '2025-01-01'],
        ] as $contrato) {
            $colaborador->contratos()->create($contrato);
        }

        $this->actingAs($user)
            ->get(route('gente.contratos.show', $colaborador))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('colaborador.historial_contratos.0.tipo_contrato', 'Contrato 2025')
                ->where('colaborador.historial_contratos.0.fecha_inicio', '2025-01-01')
                ->where('colaborador.historial_contratos.1.tipo_contrato', 'Contrato 2026')
                ->where('colaborador.historial_contratos.2.fecha_inicio', null)
            );
    }

    public function test_contract_cargo_history_identifies_its_numbered_extension(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();
        $colaborador->update([
            'fecha_ingreso_empresa' => '2025-01-01',
            'fecha_retiro_empresa' => '2027-12-31',
        ]);

        foreach ([
            ['fecha_anterior' => '2025-12-31', 'fecha_inicio' => '2026-01-01', 'fecha_nueva' => '2026-12-31'],
            ['fecha_anterior' => '2026-12-31', 'fecha_inicio' => '2027-01-01', 'fecha_nueva' => '2027-12-31'],
        ] as $prorroga) {
            ContratoProrroga::create([
                'colaborador_id' => $colaborador->id,
                'registrado_por' => $user->id,
                ...$prorroga,
                'tipo' => 'prorroga',
            ]);
        }

        $colaborador->cargos()->create([
            'cargo' => 'CONDUCTOR',
            'fecha_inicio' => '2027-02-01',
            'fecha_fin' => '2027-12-31',
            'estado' => 'ACTIVO',
        ]);

        $this->actingAs($user)
            ->get(route('gente.contratos.show', $colaborador))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('colaborador.historial_cargos.0.pertenece_a', 'Prórroga 2')
            );
    }

    public function test_only_an_explicitly_confirmed_finalization_marks_and_locks_the_contract(): void
    {
        $user = $this->genteUser();
        $colaborador = $this->colaboradorCompleto();
        $colaborador->update([
            'fecha_ingreso_empresa' => '2026-01-01',
            'fecha_retiro_empresa' => '2026-12-31',
            'is_active' => false,
        ]);

        $this->actingAs($user)
            ->get(route('gente.contratos.show', $colaborador))
            ->assertInertia(fn ($page) => $page->where('colaborador.tiene_finalizacion', false));

        $this->actingAs($user)
            ->get(route('gente.colaboradores.index'))
            ->assertInertia(fn ($page) => $page->where('colaboradores.data.0.tiene_finalizacion', false));

        $this->actingAs($user)->patch(
            route('gente.colaboradores.prorrogar-contrato', $colaborador),
            [
                'fecha_retiro_empresa' => '2026-12-31',
                'tipo' => 'finalizacion',
                'observaciones' => 'Renuncia por parte del trabajador',
            ],
        )->assertRedirect();

        $this->assertFalse($colaborador->fresh()->is_active);
        $this->assertTrue($colaborador->fresh()->tieneFinalizacionConfirmada());

        $this->actingAs($user)
            ->get(route('gente.contratos.show', $colaborador))
            ->assertInertia(fn ($page) => $page->where('colaborador.tiene_finalizacion', true));

        $this->actingAs($user)
            ->get(route('gente.colaboradores.index'))
            ->assertInertia(fn ($page) => $page->where('colaboradores.data.0.tiene_finalizacion', true));

        $this->actingAs($user)
            ->get(route('gente.colaboradores.edit', $colaborador))
            ->assertRedirect(route('gente.colaboradores.show', $colaborador));

        $this->actingAs($user)->patch(route('gente.contratos.datos.update', $colaborador), [
            'fecha_retiro_empresa' => '2027-12-31',
        ])->assertForbidden();

        $this->actingAs($user)->patch(
            route('gente.colaboradores.prorrogar-contrato', $colaborador),
            ['fecha_retiro_empresa' => '2027-12-31'],
        )->assertForbidden();
    }
}
