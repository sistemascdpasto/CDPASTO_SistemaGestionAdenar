<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ChatbotTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.groq.api_key' => 'clave-de-prueba']);
    }

    private function usuarioConRol(string $rol): User
    {
        Role::create(['name' => $rol, 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($rol);

        return $user;
    }

    public function test_un_usuario_de_cualquier_rol_puede_enviar_un_mensaje_al_chatbot(): void
    {
        Http::fake([
            'https://api.groq.com/*' => Http::response([
                'choices' => [
                    ['message' => ['content' => 'El TML es el Tiempo Medio de Liberación, con meta de 59 minutos.']],
                ],
            ]),
        ]);

        $user = $this->usuarioConRol('Flota');

        $response = $this->actingAs($user)->postJson(route('chatbot.send'), [
            'mensaje' => '¿Qué es el TML?',
        ]);

        $response->assertOk()->assertJson([
            'message' => 'El TML es el Tiempo Medio de Liberación, con meta de 59 minutos.',
        ]);

        Http::assertSent(function ($request) {
            return $request->url() === 'https://api.groq.com/openai/v1/chat/completions'
                && $request['messages'][0]['role'] === 'system'
                && str_contains($request['messages'][0]['content'], 'FRAGMENTOS RELEVANTES DEL FOLLETO')
                && str_contains($request['messages'][0]['content'], 'TML')
                && $request['messages'][array_key_last($request['messages'])]['content'] === '¿Qué es el TML?';
        });
    }

    public function test_el_limite_de_tokens_enviado_a_groq_es_generoso(): void
    {
        Http::fake([
            'https://api.groq.com/*' => Http::response([
                'choices' => [['message' => ['content' => 'Respuesta corta.'], 'finish_reason' => 'stop']],
            ]),
        ]);

        $user = $this->usuarioConRol('Reparto');

        $this->actingAs($user)->postJson(route('chatbot.send'), ['mensaje' => 'Hola']);

        Http::assertSent(fn ($request) => $request['max_tokens'] >= 1500);
    }

    public function test_si_groq_corta_la_respuesta_por_longitud_se_avisa_al_usuario(): void
    {
        Http::fake([
            'https://api.groq.com/*' => Http::response([
                'choices' => [[
                    'message' => ['content' => 'Esta respuesta quedó a mi'],
                    'finish_reason' => 'length',
                ]],
            ]),
        ]);

        $user = $this->usuarioConRol('Reparto');

        $response = $this->actingAs($user)->postJson(route('chatbot.send'), ['mensaje' => 'Explícame todo el modelo DPO']);

        $response->assertOk();
        $this->assertStringContainsString('Esta respuesta quedó a mi', $response->json('message'));
        $this->assertStringContainsString('recortada por longitud', $response->json('message'));
    }

    public function test_un_usuario_no_autenticado_no_puede_usar_el_chatbot(): void
    {
        $response = $this->postJson(route('chatbot.send'), ['mensaje' => 'Hola']);

        $response->assertStatus(401);
    }

    public function test_el_mensaje_es_obligatorio(): void
    {
        $user = $this->usuarioConRol('Reparto');

        $response = $this->actingAs($user)->postJson(route('chatbot.send'), []);

        $response->assertStatus(422)->assertJsonValidationErrors('mensaje');
    }

    public function test_si_groq_responde_con_error_el_endpoint_devuelve_un_mensaje_amigable(): void
    {
        Http::fake([
            'https://api.groq.com/*' => Http::response(['error' => 'boom'], 500),
        ]);

        $user = $this->usuarioConRol('Gente');

        $response = $this->actingAs($user)->postJson(route('chatbot.send'), ['mensaje' => 'Hola']);

        $response->assertStatus(502);
        $this->assertIsString($response->json('message'));
    }

    public function test_sin_api_key_configurada_devuelve_un_error_claro(): void
    {
        config(['services.groq.api_key' => null]);

        $user = $this->usuarioConRol('Seguridad');

        $response = $this->actingAs($user)->postJson(route('chatbot.send'), ['mensaje' => 'Hola']);

        $response->assertStatus(503);
    }
}
