<?php

namespace Tests\Feature\Reparto;

use App\Models\Flota\Vehiculo;
use App\Models\Reparto\CincoPorque;
use App\Models\Seguridad\Colaborador;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CincoPorqueTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['Colaborador', 'Reparto', 'Administrador', 'Gente'] as $rol) {
            Role::create(['name' => $rol, 'guard_name' => 'web']);
        }

        config(['services.groq.api_key' => 'clave-de-prueba']);
    }

    private function usuario(string $rol): User
    {
        $user = User::factory()->create();
        $user->assignRole($rol);

        return $user;
    }

    private function datosValidos(array $overrides = []): array
    {
        return array_merge([
            'fecha' => now()->toDateString(),
            'vehiculo_id' => null,
            'rutina' => 'Matutina de distribución',
            'indicador' => 'Devolución',
            'problema' => 'Aumento de devoluciones en la ruta norte.',
            'porque_1' => 'No se validó el pedido al cargar.',
            'porque_2' => 'El checklist de carga no incluye validación de pedido.',
            'porque_3' => 'El formato de checklist está desactualizado.',
            'porque_4' => 'No hay un responsable de mantener el checklist.',
            'porque_5' => 'El proceso no define un dueño del documento.',
            'causa_raiz' => 'El checklist de carga no tiene dueño ni ciclo de actualización.',
            'plan_accion' => 'Asignar un responsable y revisar el checklist mensualmente.',
        ], $overrides);
    }

    public function test_colaborador_y_reparto_pueden_abrir_el_formulario(): void
    {
        $this->actingAs($this->usuario('Colaborador'))
            ->get(route('cinco-porques.create'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('rutinaFija', 'Matutina de distribución'));
        $this->actingAs($this->usuario('Reparto'))->get(route('cinco-porques.create'))->assertOk();
    }

    public function test_un_rol_no_autorizado_no_puede_entrar(): void
    {
        $this->actingAs($this->usuario('Gente'))->get(route('cinco-porques.create'))->assertForbidden();
    }

    public function test_guarda_un_analisis_y_lo_vincula_al_colaborador(): void
    {
        $user = $this->usuario('Colaborador');
        $colaborador = Colaborador::create([
            'user_id' => $user->id,
            'cedula' => '123456789',
            'nombres' => 'Ana',
            'apellidos' => 'Ruiz',
            'is_active' => true,
        ]);
        $vehiculo = Vehiculo::create(['placa' => 'ABC123', 'is_active' => true]);

        $this->actingAs($user)
            ->post(route('cinco-porques.store'), $this->datosValidos(['vehiculo_id' => $vehiculo->id]))
            ->assertRedirect(route('cinco-porques.historial'));

        $registro = CincoPorque::firstOrFail();
        $this->assertSame($user->id, $registro->user_id);
        $this->assertSame($colaborador->id, $registro->colaborador_id);
        $this->assertSame($vehiculo->id, $registro->vehiculo_id);
        $this->assertSame('El proceso no define un dueño del documento.', $registro->porque_5);
    }

    public function test_valida_la_rutina_y_el_indicador_contra_el_catalogo(): void
    {
        $this->actingAs($this->usuario('Reparto'))
            ->post(route('cinco-porques.store'), $this->datosValidos(['rutina' => 'Inventada']))
            ->assertSessionHasErrors('rutina');
    }

    public function test_colaborador_solo_ve_su_propio_historial_y_reparto_ve_todo(): void
    {
        $colab = $this->usuario('Colaborador');
        $otro = $this->usuario('Colaborador');

        CincoPorque::create([...$this->datosValidos(), 'user_id' => $colab->id]);
        CincoPorque::create([...$this->datosValidos(), 'user_id' => $otro->id]);

        $this->actingAs($colab)->get(route('cinco-porques.historial'))
            ->assertInertia(fn ($page) => $page->component('cinco-porques/historial')->has('registros.data', 1));

        $this->actingAs($this->usuario('Reparto'))->get(route('cinco-porques.historial'))
            ->assertInertia(fn ($page) => $page->has('registros.data', 2));
    }

    public function test_un_colaborador_no_puede_ver_el_detalle_de_otro(): void
    {
        $duenio = $this->usuario('Colaborador');
        $registro = CincoPorque::create([...$this->datosValidos(), 'user_id' => $duenio->id]);

        $this->actingAs($this->usuario('Colaborador'))->get(route('cinco-porques.show', $registro))->assertForbidden();
        $this->actingAs($duenio)->get(route('cinco-porques.show', $registro))->assertOk();
        $this->actingAs($this->usuario('Reparto'))->get(route('cinco-porques.show', $registro))->assertOk();
    }

    public function test_la_ia_devuelve_cinco_opciones_para_el_primer_porque(): void
    {
        Http::fake([
            'https://api.groq.com/*' => Http::response([
                'choices' => [[
                    'message' => ['content' => json_encode([
                        'opciones' => ['Opción A', 'Opción B', 'Opción C', 'Opción D', 'Opción E', 'Opción F'],
                    ])],
                ]],
            ]),
        ]);

        $this->actingAs($this->usuario('Reparto'))
            ->postJson(route('cinco-porques.ia.analizar'), [
                'problema' => 'Devoluciones altas',
                'rutina' => 'Matutina de distribución',
                'indicador' => 'Devolución',
                'seleccionados' => [],
            ])
            ->assertOk()
            ->assertJson(['tipo' => 'opciones', 'nivel' => 1])
            ->assertJsonCount(5, 'opciones');
    }

    public function test_la_ia_devuelve_la_conclusion_con_cinco_seleccionados(): void
    {
        Http::fake([
            'https://api.groq.com/*' => Http::response([
                'choices' => [[
                    'message' => ['content' => json_encode([
                        'causa_raiz' => 'Falta de estandarización del proceso de carga.',
                        'plan_accion' => '1. Documentar el proceso. 2. Capacitar. 3. Auditar.',
                    ])],
                ]],
            ]),
        ]);

        $this->actingAs($this->usuario('Colaborador'))
            ->postJson(route('cinco-porques.ia.analizar'), [
                'problema' => 'Devoluciones altas',
                'rutina' => 'Matutina de distribución',
                'indicador' => 'Devolución',
                'seleccionados' => ['p1', 'p2', 'p3', 'p4', 'p5'],
            ])
            ->assertOk()
            ->assertJson([
                'tipo' => 'conclusion',
                'causa_raiz' => 'Falta de estandarización del proceso de carga.',
            ]);
    }

    public function test_si_groq_falla_la_ia_devuelve_502(): void
    {
        Http::fake(['https://api.groq.com/*' => Http::response(['error' => 'boom'], 500)]);

        $this->actingAs($this->usuario('Reparto'))
            ->postJson(route('cinco-porques.ia.analizar'), [
                'problema' => 'x',
                'rutina' => 'Matutina de distribución',
                'indicador' => 'Devolución',
                'seleccionados' => [],
            ])
            ->assertStatus(502)
            ->assertJsonStructure(['message']);
    }
}
