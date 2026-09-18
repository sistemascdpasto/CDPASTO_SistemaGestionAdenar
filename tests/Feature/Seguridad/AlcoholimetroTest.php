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
}
