<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laragear\WebAuthn\Models\WebAuthnCredential;
use Tests\TestCase;

class PasskeyTest extends TestCase
{
    use RefreshDatabase;

    private function credencial(User $user, string $alias = 'iPhone · Safari'): WebAuthnCredential
    {
        $credencial = $user->makeWebAuthnCredential([
            'id' => Str::random(32),
            'user_id' => (string) Str::uuid(),
            'alias' => $alias,
            'counter' => 0,
            'rp_id' => 'localhost',
            'origin' => 'http://localhost',
            'public_key' => 'clave-publica-de-prueba',
        ]);
        $credencial->save();

        return $credencial;
    }

    public function test_guests_get_a_login_challenge_without_typing_their_id(): void
    {
        $response = $this->postJson(route('webauthn.login.options'))->assertOk();

        $this->assertNotEmpty($response->json('challenge'));
        $this->assertSame('required', $response->json('userVerification'));
        // Ingreso sin usuario: el dispositivo ofrece las cuentas que tiene guardadas.
        $this->assertEmpty($response->json('allowCredentials') ?? []);
    }

    public function test_only_logged_in_users_can_register_a_passkey(): void
    {
        $this->postJson(route('webauthn.register.options'))->assertUnauthorized();

        $user = User::factory()->create(['name' => 'Ana Pérez']);

        $response = $this->actingAs($user)->postJson(route('webauthn.register.options'))->assertOk();

        // En el selector del celular se ve el nombre y la identificación de la cuenta.
        $this->assertSame((string) $user->identification_number, $response->json('user.name'));
        $this->assertSame('Ana Pérez', $response->json('user.displayName'));
        $this->assertSame('required', $response->json('authenticatorSelection.residentKey'));
        $this->assertSame('required', $response->json('authenticatorSelection.userVerification'));
    }

    public function test_a_logged_in_user_can_not_request_a_login_challenge(): void
    {
        $this->actingAs(User::factory()->create())->postJson(route('webauthn.login.options'))->assertStatus(302);
    }

    public function test_the_settings_page_lists_only_the_users_devices_and_lets_remove_them(): void
    {
        $user = User::factory()->create();
        $otro = User::factory()->create();
        $mia = $this->credencial($user);
        $ajena = $this->credencial($otro, 'Android · Chrome');

        $this->actingAs($user)->get(route('passkeys.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('settings/passkeys')
                ->has('passkeys', 1)
                ->where('passkeys.0.alias', 'iPhone · Safari')
                ->where('auth.hasPasskey', true));

        // No puede borrar la llave de otra persona.
        $this->actingAs($user)->delete(route('passkeys.destroy', $ajena->id))->assertNotFound();
        $this->assertTrue(WebAuthnCredential::whereKey($ajena->id)->exists());

        $this->actingAs($user)->delete(route('passkeys.destroy', $mia->id))->assertRedirect();
        $this->assertFalse(WebAuthnCredential::whereKey($mia->id)->exists());
    }

    public function test_password_login_still_works_with_the_passkey_provider(): void
    {
        $user = User::factory()->create();

        $this->post('/login', ['identification_number' => $user->identification_number, 'password' => 'password'])
            ->assertRedirect(route('dashboard', absolute: false));
        $this->assertAuthenticatedAs($user);
    }
}
