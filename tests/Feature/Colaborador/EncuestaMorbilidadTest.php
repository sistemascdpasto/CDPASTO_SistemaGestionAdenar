<?php

namespace Tests\Feature\Colaborador;

use App\Models\Seguridad\Colaborador;
use App\Models\Seguridad\EncuestaMorbilidad;
use App\Models\User;
use App\Services\Colaborador\MorbilidadCatalogoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class EncuestaMorbilidadTest extends TestCase
{
    use RefreshDatabase;

    private function colaboradorUser(): array
    {
        $role = Role::create(['name' => 'Colaborador', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($role);

        $colaborador = Colaborador::create([
            'user_id' => $user->id,
            'cedula' => '1002003004',
            'nombres' => 'Laura',
            'apellidos' => 'Portal',
            'cargo' => 'Conductor',
            'area' => 'Ruta Norte',
            'estado_registro' => 'completo',
        ]);

        return [$user, $colaborador];
    }

    private function paso1Valido(): array
    {
        return [
            'empresa' => 'ADENAR',
            'correo_electronico' => 'colaborador@test.com',
            'edad' => 30,
            'estado_civil' => 'Soltero(a)',
            'tiene_hijos' => 'No',
            'hijos' => [],
            'personas_a_cargo' => 'No',
            'personas_cargo_detalle' => [],
            'nivel_escolaridad' => 'Profesional',
            'estrato_socioeconomico' => 'Estrato 3',
            'tenencia_vivienda' => 'Propia',
            'ciudad_residencia' => 'Pasto',
            'direccion_residencia' => 'Calle 10 # 20-30',
            'tipo_contratacion' => 'Término Indefinido',
            'cargo_paso1' => 'Conductor',
            'area_paso1' => 'Logística',
            'antiguedad_empresa' => '1 a 3 años',
            'antiguedad_cargo' => '1 a 3 años',
            'duracion_contrato' => 'Indefinido',
            'turno' => 'Día',
            'promedio_ingresos' => '2 a 3 SMMLV',
        ];
    }

    /**
     * Genera un payload de respuestas válido para todas las preguntas
     * obligatorias del catálogo, usando el valor "no aplica" de cada tipo
     * (que nunca exige detalle) — evita tener que transcribir a mano las
     * ~99 preguntas obligatorias en cada test.
     *
     * @return array<int, array{numero: int, valor: ?string, detalle: ?string}>
     */
    private function respuestasCompletasMinimas(): array
    {
        $catalogo = (new MorbilidadCatalogoService())->preguntasPlanas();

        return collect($catalogo)->map(function ($pregunta, $numero) {
            $valor = match ($pregunta['tipo']) {
                'si_no', 'si_no_detalle' => 'No',
                'aplica_detalle' => 'No aplica',
                'mano_dominante' => 'Derecha',
                'opcion_unica' => $pregunta['opciones'][0] ?? 'No',
                default => '1',
            };

            return ['numero' => $numero, 'valor' => $valor, 'detalle' => null];
        })->values()->all();
    }

    public function test_abrir_la_encuesta_crea_un_borrador_con_precarga_correcta(): void
    {
        [$user, $colaborador] = $this->colaboradorUser();

        $this->actingAs($user)->get(route('portal.encuesta-morbilidad'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('colaborador/encuesta-morbilidad/index')
                ->where('colaborador.nombre_completo', 'Laura Portal')
                ->where('colaborador.cedula', '1002003004')
                ->where('colaborador.area', 'Ruta Norte')
                ->where('colaborador.cargo', 'Conductor')
            );

        $this->assertSame(1, EncuestaMorbilidad::where('colaborador_id', $colaborador->id)->count());
        $this->assertSame(EncuestaMorbilidad::ESTADO_BORRADOR, $colaborador->encuestasMorbilidad()->first()->estado);

        // Volver a abrirla retoma el mismo borrador, no crea uno nuevo.
        $this->actingAs($user)->get(route('portal.encuesta-morbilidad'));
        $this->assertSame(1, EncuestaMorbilidad::where('colaborador_id', $colaborador->id)->count());
    }

    public function test_guardar_progreso_persiste_respuestas_parciales_sin_exigir_obligatoriedad(): void
    {
        [$user, $colaborador] = $this->colaboradorUser();

        $this->actingAs($user)->get(route('portal.encuesta-morbilidad'));
        $encuesta = $colaborador->encuestasMorbilidad()->firstOrFail();

        $this->actingAs($user)->post(route('portal.encuesta-morbilidad.guardar', $encuesta), [
            'respuestas' => [
                ['numero' => 7, 'valor' => 'Si', 'detalle' => 'Migraña frecuente'],
            ],
        ])->assertRedirect();

        $this->assertSame(EncuestaMorbilidad::ESTADO_BORRADOR, $encuesta->fresh()->estado);
        $respuesta = $encuesta->respuestas()->where('numero_pregunta', 7)->firstOrFail();
        $this->assertSame('Si', $respuesta->valor);
        $this->assertSame('Migraña frecuente', $respuesta->detalle);
    }

    public function test_enviar_con_preguntas_obligatorias_faltantes_devuelve_errores_y_no_completa(): void
    {
        [$user, $colaborador] = $this->colaboradorUser();

        $this->actingAs($user)->get(route('portal.encuesta-morbilidad'));
        $encuesta = $colaborador->encuestasMorbilidad()->firstOrFail();

        $this->actingAs($user)->post(route('portal.encuesta-morbilidad.enviar', $encuesta), [
            'respuestas' => [],
        ])->assertSessionHasErrors(['respuestas.7.valor', 'respuestas.60.valor', 'respuestas.97.valor']);

        $this->assertSame(EncuestaMorbilidad::ESTADO_BORRADOR, $encuesta->fresh()->estado);
    }

    public function test_enviar_completo_marca_la_encuesta_como_completada(): void
    {
        [$user, $colaborador] = $this->colaboradorUser();

        $this->actingAs($user)->get(route('portal.encuesta-morbilidad'));
        $encuesta = $colaborador->encuestasMorbilidad()->firstOrFail();

        $this->actingAs($user)->post(route('portal.encuesta-morbilidad.enviar', $encuesta), [
            'paso1' => $this->paso1Valido(),
            'respuestas' => $this->respuestasCompletasMinimas(),
        ])->assertRedirect(route('portal.encuesta-morbilidad.historial'));

        $encuesta->refresh();
        $this->assertSame(EncuestaMorbilidad::ESTADO_COMPLETADA, $encuesta->estado);
        $this->assertNotNull($encuesta->enviado_en);
    }

    public function test_no_se_puede_editar_ni_reenviar_una_encuesta_ya_completada(): void
    {
        [$user, $colaborador] = $this->colaboradorUser();

        $this->actingAs($user)->get(route('portal.encuesta-morbilidad'));
        $encuesta = $colaborador->encuestasMorbilidad()->firstOrFail();

        $this->actingAs($user)->post(route('portal.encuesta-morbilidad.enviar', $encuesta), [
            'paso1' => $this->paso1Valido(),
            'respuestas' => $this->respuestasCompletasMinimas(),
        ]);

        $this->actingAs($user)->post(route('portal.encuesta-morbilidad.guardar', $encuesta), [
            'respuestas' => [['numero' => 7, 'valor' => 'Si', 'detalle' => 'x']],
        ])->assertForbidden();

        $this->actingAs($user)->post(route('portal.encuesta-morbilidad.enviar', $encuesta), [
            'paso1' => $this->paso1Valido(),
            'respuestas' => $this->respuestasCompletasMinimas(),
        ])->assertForbidden();

        // Abrir de nuevo la encuesta inicia una nueva, no reabre la completada.
        $this->actingAs($user)->get(route('portal.encuesta-morbilidad'));
        $this->assertSame(2, EncuestaMorbilidad::where('colaborador_id', $colaborador->id)->count());
    }

    public function test_usuario_sin_colaborador_vinculado_recibe_403(): void
    {
        $role = Role::create(['name' => 'Colaborador', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole($role);

        $this->actingAs($user)->get(route('portal.encuesta-morbilidad'))->assertForbidden();
    }

    public function test_si_no_detalle_exige_detalle_solo_cuando_el_valor_es_si(): void
    {
        [$user, $colaborador] = $this->colaboradorUser();

        $this->actingAs($user)->get(route('portal.encuesta-morbilidad'));
        $encuesta = $colaborador->encuestasMorbilidad()->firstOrFail();

        $respuestas = $this->respuestasCompletasMinimas();
        $respuestas[array_search(7, array_column($respuestas, 'numero'), true)] = ['numero' => 7, 'valor' => 'Si', 'detalle' => null];

        $this->actingAs($user)->post(route('portal.encuesta-morbilidad.enviar', $encuesta), [
            'paso1' => $this->paso1Valido(),
            'respuestas' => $respuestas,
        ])->assertSessionHasErrors('respuestas.7.detalle');

        $respuestas[array_search(7, array_column($respuestas, 'numero'), true)] = ['numero' => 7, 'valor' => 'Si', 'detalle' => 'Migraña'];

        $this->actingAs($user)->post(route('portal.encuesta-morbilidad.enviar', $encuesta), [
            'paso1' => $this->paso1Valido(),
            'respuestas' => $respuestas,
        ])->assertSessionDoesntHaveErrors();
    }

    public function test_aplica_detalle_exige_detalle_solo_cuando_el_valor_es_aplica(): void
    {
        [$user, $colaborador] = $this->colaboradorUser();

        $this->actingAs($user)->get(route('portal.encuesta-morbilidad'));
        $encuesta = $colaborador->encuestasMorbilidad()->firstOrFail();

        $respuestas = $this->respuestasCompletasMinimas();
        $respuestas[array_search(29, array_column($respuestas, 'numero'), true)] = ['numero' => 29, 'valor' => 'Aplica', 'detalle' => null];

        $this->actingAs($user)->post(route('portal.encuesta-morbilidad.enviar', $encuesta), [
            'paso1' => $this->paso1Valido(),
            'respuestas' => $respuestas,
        ])->assertSessionHasErrors('respuestas.29.detalle');
    }
}
