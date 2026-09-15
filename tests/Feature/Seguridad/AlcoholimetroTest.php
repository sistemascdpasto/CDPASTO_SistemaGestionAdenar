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

    public function test_can_create_alcoholimetro_with_pdf_document(): void
    {
        Storage::fake('public');
        $user = $this->seguridadUser();
        $pdf = UploadedFile::fake()->create('certificado.pdf', 100, 'application/pdf');

        $response = $this->actingAs($user)->post(route('seguridad.dispositivos.store'), [
            'codigo' => 'ALC-TEST-01',
            'marca' => 'Dräger',
            'modelo' => 'Alcotest 6820',
            'valor_min' => '0',
            'valor_max' => '0.1',
            'estado' => 'Disponible',
            'documentos' => [$pdf],
        ]);

        $dispositivo = Alcoholimetro::where('codigo', 'ALC-TEST-01')->firstOrFail();
        $response->assertRedirect(route('seguridad.dispositivos.show', $dispositivo));

        $this->assertCount(1, $dispositivo->documentos);
        $this->assertNotNull($dispositivo->documento_path);
        Storage::disk('public')->assertExists($dispositivo->documentos->first()->path);
    }

    public function test_show_page_exposes_document_paths(): void
    {
        Storage::fake('public');
        $user = $this->seguridadUser();
        $pdf = UploadedFile::fake()->create('manual.pdf', 100, 'application/pdf');

        $this->actingAs($user)->post(route('seguridad.dispositivos.store'), [
            'codigo' => 'ALC-TEST-02',
            'valor_min' => '0',
            'valor_max' => '0.1',
            'estado' => 'Disponible',
            'documentos' => [$pdf],
        ]);

        $dispositivo = Alcoholimetro::where('codigo', 'ALC-TEST-02')->firstOrFail();

        $response = $this->actingAs($user)->get(route('seguridad.dispositivos.show', $dispositivo));

        $response->assertInertia(fn ($page) => $page
            ->has('dispositivo.documentos_paths', 1)
        );
    }
}
