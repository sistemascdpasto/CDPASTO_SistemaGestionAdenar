<?php

namespace Tests\Feature\Seguridad;

use App\Models\Seguridad\Alcoholimetro;
use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\PruebaAlcoholemia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PruebaAlcoholemiaTest extends TestCase
{
    use RefreshDatabase;

    private function seguridadUser(): User
    {
        $role = Role::create(['name' => 'Seguridad', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    private function colaborador(): Colaborador
    {
        return Colaborador::create([
            'cedula' => '1002003004',
            'nombres' => 'Carlos',
            'apellidos' => 'Mendoza',
            'cargo' => 'Conductor',
            'turno' => 'manana',
            'estado_registro' => 'completo',
            'is_active' => true,
        ]);
    }

    private function alcoholimetro(): Alcoholimetro
    {
        return Alcoholimetro::create([
            'codigo' => 'ALC-001',
            'valor_min' => 0,
            'valor_max' => 1,
            'estado' => 'Disponible',
        ]);
    }

    public function test_create_page_exposes_cargo_for_each_colaborador(): void
    {
        $user = $this->seguridadUser();
        $this->colaborador();

        $response = $this->actingAs($user)->get(route('seguridad.pruebas.create'));

        $response->assertInertia(fn ($page) => $page
            ->where('colaboradores.0.cargo', 'Conductor')
        );
    }

    public function test_it_accepts_a_pdf_as_additional_evidence(): void
    {
        Storage::fake('public');
        $user = $this->seguridadUser();
        $colaborador = $this->colaborador();
        $dispositivo = $this->alcoholimetro();

        $response = $this->actingAs($user)->post(route('seguridad.pruebas.store'), [
            'colaborador_id' => $colaborador->id,
            'tipo' => 'pre_ruta',
            'alcoholimetro_id' => $dispositivo->id,
            'resultado' => '0.000',
            'consentimiento_aceptado' => true,
            'evidencias' => [UploadedFile::fake()->create('soporte.pdf', 100, 'application/pdf')],
        ]);

        $response->assertRedirect(route('seguridad.pruebas.index'));
        $prueba = PruebaAlcoholemia::where('colaborador_id', $colaborador->id)->firstOrFail();
        $this->assertCount(1, $prueba->evidencias);
    }

    public function test_it_rejects_a_non_pdf_file_as_additional_evidence(): void
    {
        Storage::fake('public');
        $user = $this->seguridadUser();
        $colaborador = $this->colaborador();
        $dispositivo = $this->alcoholimetro();

        $response = $this->actingAs($user)->post(route('seguridad.pruebas.store'), [
            'colaborador_id' => $colaborador->id,
            'tipo' => 'pre_ruta',
            'alcoholimetro_id' => $dispositivo->id,
            'resultado' => '0.000',
            'consentimiento_aceptado' => true,
            'evidencias' => [UploadedFile::fake()->image('foto.jpg')],
        ]);

        $response->assertSessionHasErrors('evidencias.0');
        $this->assertDatabaseMissing('pruebas_alcoholemia', ['colaborador_id' => $colaborador->id]);
    }

    public function test_it_requires_consentimiento_aceptado_when_not_scheduling(): void
    {
        $user = $this->seguridadUser();
        $colaborador = $this->colaborador();
        $dispositivo = $this->alcoholimetro();

        $response = $this->actingAs($user)->post(route('seguridad.pruebas.store'), [
            'colaborador_id' => $colaborador->id,
            'tipo' => 'pre_ruta',
            'alcoholimetro_id' => $dispositivo->id,
            'resultado' => '0.000',
            'consentimiento_aceptado' => false,
        ]);

        $response->assertSessionHasErrors('consentimiento_aceptado');
    }

    public function test_it_can_schedule_a_prueba_for_later_without_accepting_consentimiento(): void
    {
        $user = $this->seguridadUser();
        $colaborador = $this->colaborador();

        // Igual que lo que realmente manda Inertia por FormData: booleans
        // como '1'/'0' (no true/false nativos de PHP). El formulario siempre
        // incluye 'consentimiento_aceptado' aunque esa sección no se muestre
        // al programar — no debe bloquear el guardado.
        $response = $this->actingAs($user)->post(route('seguridad.pruebas.store'), [
            'colaborador_id' => $colaborador->id,
            'tipo' => 'pre_ruta',
            'es_programacion' => '1',
            'programada_en' => now()->addDay()->format('Y-m-d\TH:i'),
            'consentimiento_aceptado' => '0',
        ]);

        $response->assertRedirect(route('seguridad.pruebas.index'));
        $this->assertDatabaseHas('pruebas_alcoholemia', [
            'colaborador_id' => $colaborador->id,
            'estado' => 'programada',
        ]);
    }

    public function test_tipo_selector_accepts_the_renamed_values(): void
    {
        $user = $this->seguridadUser();
        $colaborador = $this->colaborador();
        $dispositivo = $this->alcoholimetro();

        $response = $this->actingAs($user)->post(route('seguridad.pruebas.store'), [
            'colaborador_id' => $colaborador->id,
            'tipo' => 'post_ruta',
            'alcoholimetro_id' => $dispositivo->id,
            'resultado' => '0.000',
            'consentimiento_aceptado' => true,
        ]);

        $response->assertRedirect(route('seguridad.pruebas.index'));
        $this->assertDatabaseHas('pruebas_alcoholemia', [
            'colaborador_id' => $colaborador->id,
            'tipo' => 'post_ruta',
        ]);
    }

    public function test_it_rejects_the_old_tipo_values(): void
    {
        $user = $this->seguridadUser();
        $colaborador = $this->colaborador();
        $dispositivo = $this->alcoholimetro();

        $response = $this->actingAs($user)->post(route('seguridad.pruebas.store'), [
            'colaborador_id' => $colaborador->id,
            'tipo' => 'entrada',
            'alcoholimetro_id' => $dispositivo->id,
            'resultado' => '0.000',
            'consentimiento_aceptado' => true,
        ]);

        $response->assertSessionHasErrors('tipo');
    }

    public function test_evidencia_principal_path_finds_the_image_regardless_of_upload_order(): void
    {
        $colaborador = $this->colaborador();
        $prueba = PruebaAlcoholemia::create([
            'colaborador_id' => $colaborador->id,
            'tipo' => 'pre_ruta',
            'consentimiento_aceptado' => true,
            'responsable_id' => $this->seguridadUser()->id,
            'fecha_hora' => now(),
            'estado' => 'realizada',
        ]);

        // A propósito en orden "adicional primero" — la posición no debe
        // importar, solo la extensión (PDF vs. imagen).
        $prueba->evidencias()->create(['path' => 'evidencias/soporte.pdf']);
        $prueba->evidencias()->create(['path' => 'evidencias/foto.jpg']);

        $this->assertSame('evidencias/foto.jpg', $prueba->evidenciaPrincipalPath());
    }

    public function test_evidencia_principal_path_is_null_when_only_pdfs_are_attached(): void
    {
        $colaborador = $this->colaborador();
        $prueba = PruebaAlcoholemia::create([
            'colaborador_id' => $colaborador->id,
            'tipo' => 'pre_ruta',
            'consentimiento_aceptado' => true,
            'responsable_id' => $this->seguridadUser()->id,
            'fecha_hora' => now(),
            'estado' => 'realizada',
        ]);

        $prueba->evidencias()->create(['path' => 'evidencias/soporte.pdf']);

        $this->assertNull($prueba->evidenciaPrincipalPath());
    }

    public function test_pdf_and_excel_export_routes_render_without_error_for_mixed_evidence(): void
    {
        Storage::fake('public');
        $user = $this->seguridadUser();
        $colaborador = $this->colaborador();
        $dispositivo = $this->alcoholimetro();

        $this->actingAs($user)->post(route('seguridad.pruebas.store'), [
            'colaborador_id' => $colaborador->id,
            'tipo' => 'pre_ruta',
            'alcoholimetro_id' => $dispositivo->id,
            'resultado' => '0.000',
            'consentimiento_aceptado' => true,
            'evidencia' => [UploadedFile::fake()->image('foto.jpg')],
            'evidencias' => [UploadedFile::fake()->create('soporte.pdf', 100, 'application/pdf')],
        ]);

        $prueba = PruebaAlcoholemia::where('colaborador_id', $colaborador->id)->firstOrFail();
        $fotoPath = $prueba->evidencias()->where('path', 'like', '%.jpg')->firstOrFail()->path;
        $this->assertSame($fotoPath, $prueba->evidenciaPrincipalPath());

        $this->actingAs($user)->get(route('seguridad.pruebas.exportar-pdf'))->assertOk();
        $this->actingAs($user)->get(route('seguridad.pruebas.exportar-excel'))->assertOk();
    }

    public function test_excel_export_headings_and_row_no_longer_include_evidencias_adicionales(): void
    {
        Storage::fake('public');
        $colaborador = $this->colaborador();
        $prueba = PruebaAlcoholemia::create([
            'colaborador_id' => $colaborador->id,
            'tipo' => 'pre_ruta',
            'consentimiento_aceptado' => true,
            'responsable_id' => $this->seguridadUser()->id,
            'fecha_hora' => now(),
            'estado' => 'realizada',
        ]);
        // La foto se sube después del PDF a propósito, para probar que el
        // reporte no depende del orden en que se guardaron las evidencias.
        $prueba->evidencias()->create(['path' => 'evidencias/soporte.pdf']);
        $prueba->evidencias()->create(['path' => 'evidencias/foto.jpg']);

        $export = new \App\Exports\Seguridad\PruebasExport(collect([$prueba]));

        $this->assertSame(
            ['Fecha', 'Colaborador', 'Cédula', 'Tipo', 'Origen Planeación', 'Ruta Asignada', 'Dispositivo', 'Resultado', 'Evaluación', 'Estado', 'Responsable', 'Firma', 'Evidencia principal'],
            $export->headings()
        );

        $fila = $export->map($prueba);
        $this->assertCount(13, $fila);
        $this->assertSame('', end($fila));
    }

    public function test_it_can_create_and_update_fecha_hora_of_a_prueba_and_photo(): void
    {
        Storage::fake('public');
        $user = $this->seguridadUser();
        $colaborador = $this->colaborador();
        $dispositivo = $this->alcoholimetro();

        $fechaPersonalizada = '2026-09-18T10:30';

        $response = $this->actingAs($user)->post(route('seguridad.pruebas.store'), [
            'colaborador_id' => $colaborador->id,
            'tipo' => 'pre_ruta',
            'alcoholimetro_id' => $dispositivo->id,
            'resultado' => '0.000',
            'consentimiento_aceptado' => true,
            'fecha_hora' => $fechaPersonalizada,
        ]);

        $response->assertRedirect(route('seguridad.pruebas.index'));

        $prueba = PruebaAlcoholemia::where('colaborador_id', $colaborador->id)->firstOrFail();
        $this->assertSame('2026-09-18 10:30:00', $prueba->fecha_hora->format('Y-m-d H:i:s'));

        // Editar fecha y hora
        $nuevaFechaHora = '2026-09-18T14:45';

        $updateResponse = $this->actingAs($user)->put(route('seguridad.pruebas.update', $prueba), [
            'colaborador_id' => $colaborador->id,
            'tipo' => 'pre_ruta',
            'alcoholimetro_id' => $dispositivo->id,
            'resultado' => '0.000',
            'consentimiento_aceptado' => true,
            'fecha_hora' => $nuevaFechaHora,
        ]);

        $updateResponse->assertRedirect(route('seguridad.pruebas.index'));

        $prueba->refresh();
        $this->assertSame('2026-09-18 14:45:00', $prueba->fecha_hora->format('Y-m-d H:i:s'));
    }

    public function test_cobertura_planeacion_calculates_correct_summary_metrics_and_text(): void
    {
        $fecha = '2026-09-24';
        $user = $this->seguridadUser();
        $col1 = $this->colaborador();
        $col2 = Colaborador::create([
            'cedula' => '999888777',
            'nombres' => 'María',
            'apellidos' => 'Gómez',
            'cargo' => 'Auxiliar',
            'is_active' => true,
            'estado_registro' => 'completo',
        ]);

        $modulacion = \App\Models\Reparto\Modulacion::create([
            'fecha' => $fecha,
            'user_id' => $user->id,
        ]);

        $modulacion->items()->create([
            'placa' => 'ABC-123',
            'ud' => 'UD-01',
            'cargo' => 'Conductor',
            'colaborador_id' => $col1->id,
            'cedula' => $col1->cedula,
            'nombres' => $col1->nombres,
            'tripulacion' => [
                ['colaborador_id' => $col2->id, 'cedula' => $col2->cedula, 'nombres' => $col2->nombres, 'cargo' => 'Auxiliar'],
            ],
        ]);

        // Registrar prueba para col1
        $prueba = PruebaAlcoholemia::create([
            'colaborador_id' => $col1->id,
            'tipo' => 'pre_ruta',
            'resultado' => '0.000',
            'responsable_id' => $user->id,
            'fecha_hora' => "{$fecha} 08:00:00",
            'estado' => 'realizada',
        ]);

        $this->assertTrue($prueba->pertenece_planeacion);
        $this->assertStringContainsString('ABC-123', $prueba->ruta_asignada);

        $service = app(\App\Services\Seguridad\CoberturaPlaneacionService::class);
        $resumen = $service->obtenerResumenCobertura($fecha);

        $this->assertSame(2, $resumen['total_planeados']);
        $this->assertSame(1, $resumen['total_realizados']);
        $this->assertSame(1, $resumen['total_pendientes']);
        $this->assertSame(50.0, $resumen['porcentaje_cobertura']);
        $this->assertStringContainsString('2 colaboradores planeados — 1 realizados — 1 pendientes — 50,00% de cobertura', $resumen['resumen_texto']);
    }

    public function test_prueba_for_unplanned_collaborator_is_registered_as_evaluacion_adicional_without_blocking(): void
    {
        $user = $this->seguridadUser();
        $colaborador = $this->colaborador();
        $dispositivo = $this->alcoholimetro();

        $response = $this->actingAs($user)->post(route('seguridad.pruebas.store'), [
            'colaborador_id' => $colaborador->id,
            'tipo' => 'pre_ruta',
            'alcoholimetro_id' => $dispositivo->id,
            'resultado' => '0.000',
            'consentimiento_aceptado' => true,
        ]);

        $response->assertRedirect(route('seguridad.pruebas.index'));
        $prueba = PruebaAlcoholemia::where('colaborador_id', $colaborador->id)->firstOrFail();

        $this->assertFalse($prueba->pertenece_planeacion);
        $this->assertNull($prueba->modulacion_id);
    }
}
