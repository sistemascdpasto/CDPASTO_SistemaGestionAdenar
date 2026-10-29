<?php

namespace Tests\Feature\Gente;

use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ColaboradorAutoprovisionTest extends TestCase
{
    use RefreshDatabase;

    private function genteUser(): User
    {
        $role = Role::create(['name' => 'Gente', 'guard_name' => 'web']);
        Role::create(['name' => 'Colaborador', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    public function test_it_creates_a_colaborador_user_account_with_cedula_as_credentials(): void
    {
        $user = $this->genteUser();

        $this->actingAs($user)->post(route('gente.colaboradores.store'), [
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'tipo_documento' => 'Cédula de ciudadanía',
            'is_active' => true,
        ])->assertRedirectContains('/wizard');

        $colaborador = Colaborador::where('cedula', '1002003004')->firstOrFail();

        $this->assertNotNull($colaborador->user_id);

        $cuenta = User::find($colaborador->user_id);
        $this->assertNotNull($cuenta);
        $this->assertSame('1002003004', $cuenta->identification_number);
        $this->assertTrue($cuenta->hasRole('Colaborador'));
        $this->assertTrue(Hash::check('1002003004', $cuenta->password));

        // Puede iniciar sesión con cédula como usuario y contraseña.
        $this->post(route('logout'));
        $this->post(route('login'), [
            'identification_number' => '1002003004',
            'password' => '1002003004',
        ])->assertRedirect(route('dashboard'));
    }

    public function test_it_copies_the_correo_field_to_the_new_account_email(): void
    {
        $user = $this->genteUser();

        $this->actingAs($user)->post(route('gente.colaboradores.store'), [
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'tipo_documento' => 'Cédula de ciudadanía',
            'correo' => 'laura.portal@example.com',
            'is_active' => true,
        ])->assertRedirectContains('/wizard');

        $colaborador = Colaborador::where('cedula', '1002003004')->firstOrFail();
        $cuenta = User::find($colaborador->user_id);

        $this->assertSame('laura.portal@example.com', $cuenta->email);
    }

    public function test_it_does_not_overwrite_email_when_it_would_collide_with_another_user(): void
    {
        $user = $this->genteUser();

        User::factory()->create(['email' => 'laura.portal@example.com']);

        $this->actingAs($user)->post(route('gente.colaboradores.store'), [
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'tipo_documento' => 'Cédula de ciudadanía',
            'correo' => 'laura.portal@example.com',
            'is_active' => true,
        ])->assertRedirectContains('/wizard');

        $colaborador = Colaborador::where('cedula', '1002003004')->firstOrFail();
        $cuenta = User::find($colaborador->user_id);

        $this->assertNull($cuenta->email);
    }

    public function test_updating_correo_syncs_the_linked_user_email(): void
    {
        $user = $this->genteUser();

        $this->actingAs($user)->post(route('gente.colaboradores.store'), [
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'tipo_documento' => 'Cédula de ciudadanía',
            'is_active' => true,
        ]);

        $colaborador = Colaborador::where('cedula', '1002003004')->firstOrFail();
        $this->assertNull(User::find($colaborador->user_id)->email);

        $this->actingAs($user)->put(route('gente.colaboradores.update', $colaborador), [
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'correo' => 'laura.nueva@example.com',
            'is_active' => true,
        ])->assertRedirect(route('gente.colaboradores.index'));

        $this->assertSame('laura.nueva@example.com', User::find($colaborador->user_id)->email);
    }

    public function test_edit_page_loads_without_error_when_colaborador_has_a_linked_user(): void
    {
        $user = $this->genteUser();

        $this->actingAs($user)->post(route('gente.colaboradores.store'), [
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'tipo_documento' => 'Cédula de ciudadanía',
            'is_active' => true,
        ]);

        $colaborador = Colaborador::where('cedula', '1002003004')->firstOrFail();

        $this->actingAs($user)
            ->get(route('gente.colaboradores.edit', $colaborador))
            ->assertOk();
    }

    public function test_it_reuses_an_existing_user_with_the_same_identification_number(): void
    {
        $user = $this->genteUser();

        $cuentaExistente = User::factory()->create(['identification_number' => '1002003004']);

        $this->actingAs($user)->post(route('gente.colaboradores.store'), [
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'tipo_documento' => 'Cédula de ciudadanía',
            'is_active' => true,
        ])->assertRedirectContains('/wizard');

        $colaborador = Colaborador::where('cedula', '1002003004')->firstOrFail();

        $this->assertSame($cuentaExistente->id, $colaborador->user_id);
        $this->assertTrue($cuentaExistente->fresh()->hasRole('Colaborador'));
        // Solo existen el usuario de Seguridad y la cuenta reutilizada — no se creó una nueva.
        $this->assertSame(2, User::count());
    }

    public function test_it_respects_a_manually_selected_user_id_over_autoprovisioning(): void
    {
        $user = $this->genteUser();

        $cuenta = User::factory()->create();
        $cuenta->assignRole('Colaborador');

        $this->actingAs($user)->post(route('gente.colaboradores.store'), [
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'tipo_documento' => 'Cédula de ciudadanía',
            'is_active' => true,
            'user_id' => $cuenta->id,
        ])->assertRedirectContains('/wizard');

        $colaborador = Colaborador::where('cedula', '1002003004')->firstOrFail();

        $this->assertSame($cuenta->id, $colaborador->user_id);
        // Solo existen el usuario de Seguridad y la cuenta seleccionada manualmente.
        $this->assertSame(2, User::count());
    }
}
