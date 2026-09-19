<?php

namespace Tests\Feature\Seguridad;

use App\Models\Seguridad\Alcoholimetro;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AlcoholimetroTest extends TestCase
{
    use RefreshDatabase;

    private function seguridadUser(): User
    {
        $role = Role::create(['name' => 'Seguridad', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    public function test_can_create_alcoholimetro(): void
    {
        $user = $this->seguridadUser();

        $response = $this->actingAs($user)->post(route('seguridad.dispositivos.store'), [
            'codigo' => 'ALC-TEST-01',
            'marca' => 'Dräger',
            'modelo' => 'Alcotest 6820',
            'valor_min' => '0',
            'valor_max' => '0.1',
            'estado' => 'Disponible',
        ]);

        $dispositivo = Alcoholimetro::where('codigo', 'ALC-TEST-01')->firstOrFail();
        $response->assertRedirect(route('seguridad.dispositivos.show', $dispositivo));
        $this->assertEquals('Dräger', $dispositivo->marca);
    }

    public function test_can_create_alcoholimetro_with_pdf_and_excel_documents(): void
    {
        Storage::fake('public');
        $user = $this->seguridadUser();

        $pdf = UploadedFile::fake()->create('calibracion.pdf', 100, 'application/pdf');
        $excel = UploadedFile::fake()->create('reporte_mantenimiento.xlsx', 100, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $response = $this->actingAs($user)->post(route('seguridad.dispositivos.store'), [
            'codigo' => 'ALC-DOC-01',
            'marca' => 'Dräger',
            'modelo' => '6820',
            'valor_min' => '0',
            'valor_max' => '0.1',
            'estado' => 'Disponible',
            'documentos' => [$pdf, $excel],
        ]);

        $dispositivo = Alcoholimetro::where('codigo', 'ALC-DOC-01')->firstOrFail();
        $response->assertRedirect(route('seguridad.dispositivos.show', $dispositivo));

        $this->assertCount(2, $dispositivo->documentos);
        $this->assertEquals('calibracion.pdf', $dispositivo->documentos->first()->nombre_original);
        $this->assertEquals('reporte_mantenimiento.xlsx', $dispositivo->documentos->last()->nombre_original);

        Storage::disk('public')->assertExists($dispositivo->documentos->first()->path);
        Storage::disk('public')->assertExists($dispositivo->documentos->last()->path);
    }

    public function test_can_create_alcoholimetro_with_single_document_unwrapped(): void
    {
        Storage::fake('public');
        $user = $this->seguridadUser();

        $singleExcel = UploadedFile::fake()->create('hoja_datos.xlsx', 100, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $response = $this->actingAs($user)->post(route('seguridad.dispositivos.store'), [
            'codigo' => 'ALC-SINGLE-01',
            'marca' => 'Dräger',
            'modelo' => '6820',
            'valor_min' => '0',
            'valor_max' => '0.1',
            'estado' => 'Disponible',
            'documentos' => $singleExcel,
        ]);

        $dispositivo = Alcoholimetro::where('codigo', 'ALC-SINGLE-01')->firstOrFail();
        $response->assertRedirect(route('seguridad.dispositivos.show', $dispositivo));

        $this->assertCount(1, $dispositivo->documentos);
        $this->assertEquals('hoja_datos.xlsx', $dispositivo->documentos->first()->nombre_original);
        Storage::disk('public')->assertExists($dispositivo->documentos->first()->path);
    }

    public function test_can_update_alcoholimetro_documents(): void
    {
        Storage::fake('public');
        $user = $this->seguridadUser();

        $dispositivo = Alcoholimetro::create([
            'codigo' => 'ALC-UPDATE-01',
            'marca' => 'Dräger',
            'modelo' => '6820',
            'valor_min' => '0',
            'valor_max' => '0.1',
            'estado' => 'Disponible',
        ]);

        $doc1 = UploadedFile::fake()->create('doc1.pdf', 100, 'application/pdf');
        $this->actingAs($user)->put(route('seguridad.dispositivos.update', $dispositivo), [
            'codigo' => 'ALC-UPDATE-01',
            'marca' => 'Dräger',
            'modelo' => '6820',
            'valor_min' => '0',
            'valor_max' => '0.1',
            'estado' => 'Disponible',
            'documentos' => [$doc1],
        ]);

        $dispositivo->refresh();
        $this->assertCount(1, $dispositivo->documentos);

        $doc2 = UploadedFile::fake()->create('doc2.xlsx', 100, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $this->actingAs($user)->put(route('seguridad.dispositivos.update', $dispositivo), [
            'codigo' => 'ALC-UPDATE-01',
            'marca' => 'Dräger',
            'modelo' => '6820',
            'valor_min' => '0',
            'valor_max' => '0.1',
            'estado' => 'Disponible',
            'documentos' => [$doc2],
            'deleted_documentos_indices' => [0],
        ]);

        $dispositivo->refresh();
        $this->assertCount(1, $dispositivo->documentos);
        $this->assertEquals('doc2.xlsx', $dispositivo->documentos->first()->nombre_original);
    }
}
