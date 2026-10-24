<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use App\Support\MygeotabCredentials;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class MygeotabCredentialTest extends TestCase
{
    use RefreshDatabase;

    private function usuarioConRol(string $rol): User
    {
        Role::findOrCreate($rol, 'web');
        $user = User::factory()->create();
        $user->assignRole($rol);

        return $user;
    }

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.mygeotab.username' => 'semilla@ejemplo.com',
            'services.mygeotab.password' => 'semilla-secreta',
            'services.mygeotab.database' => 'tenant_semilla',
        ]);
    }

    public function test_un_administrador_puede_ver_el_formulario_sin_que_se_filtre_la_contrasena(): void
    {
        $admin = $this->usuarioConRol('Administrador');

        $response = $this->actingAs($admin)->get(route('admin.mygeotab-credenciales.edit'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->where('credenciales.username', 'semilla@ejemplo.com')
            ->where('credenciales.tiene_password', true)
            ->missing('credenciales.password')
            ->where('fuente', 'env'));
    }

    public function test_un_usuario_sin_rol_administrador_no_puede_ver_ni_actualizar(): void
    {
        $flota = $this->usuarioConRol('Flota');

        $this->actingAs($flota)->get(route('admin.mygeotab-credenciales.edit'))->assertForbidden();
        $this->actingAs($flota)->put(route('admin.mygeotab-credenciales.update'), [
            'username' => 'intruso@ejemplo.com',
            'database' => 'otro',
        ])->assertForbidden();
    }

    public function test_un_administrador_puede_actualizar_las_credenciales_y_quedan_cifradas(): void
    {
        $admin = $this->usuarioConRol('Administrador');

        $this->actingAs($admin)->put(route('admin.mygeotab-credenciales.update'), [
            'username' => 'nuevo@ejemplo.com',
            'password' => 'nueva-clave',
            'database' => 'tenant_nuevo',
        ])->assertRedirect();

        $this->assertSame('nuevo@ejemplo.com', MygeotabCredentials::current()['username']);
        $this->assertSame('nueva-clave', MygeotabCredentials::current()['password']);
        $this->assertTrue(MygeotabCredentials::tieneCredencialesEnBd());

        // La columna en bruto nunca debe contener la contraseña en texto plano.
        $crudo = \DB::table('mygeotab_credenciales')->where('id', 1)->first();
        $this->assertStringNotContainsString('nueva-clave', $crudo->password);
    }

    public function test_dejar_la_contrasena_en_blanco_al_actualizar_conserva_la_anterior(): void
    {
        $admin = $this->usuarioConRol('Administrador');

        MygeotabCredentials::actualizar([
            'username' => 'original@ejemplo.com',
            'password' => 'clave-original',
            'database' => 'tenant_original',
        ], $admin);

        $this->actingAs($admin)->put(route('admin.mygeotab-credenciales.update'), [
            'username' => 'original@ejemplo.com',
            'password' => '',
            'database' => 'tenant_original',
        ])->assertRedirect();

        $this->assertSame('clave-original', MygeotabCredentials::current()['password']);
    }

    public function test_probar_conexion_reporta_exito_cuando_mygeotab_autentica(): void
    {
        $admin = $this->usuarioConRol('Administrador');

        Http::fake([
            'https://my.geotab.com/*' => Http::response(['result' => ['credentials' => ['sessionId' => 'sesion-abc']]]),
        ]);

        $this->actingAs($admin)->postJson(route('admin.mygeotab-credenciales.probar'), [
            'username' => 'usuario@ejemplo.com',
            'password' => 'clave',
            'database' => 'tenant',
        ])->assertOk()->assertJson(['ok' => true]);
    }

    public function test_probar_conexion_reporta_error_cuando_mygeotab_rechaza(): void
    {
        $admin = $this->usuarioConRol('Administrador');

        Http::fake([
            'https://my.geotab.com/*' => Http::response(['error' => ['name' => 'InvalidUserException', 'message' => 'Credenciales inválidas']]),
        ]);

        $this->actingAs($admin)->postJson(route('admin.mygeotab-credenciales.probar'), [
            'username' => 'usuario@ejemplo.com',
            'password' => 'clave-mala',
            'database' => 'tenant',
        ])->assertStatus(422)->assertJson(['ok' => false]);
    }
}
